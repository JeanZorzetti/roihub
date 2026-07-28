# F4 — narrativa: 2-3 frases em pt-BR por projeto em cima do data/insights.json.
#
#   python ml/narrate.py            → preenche "narrative" nos projetos que ainda estao sem
#   python ml/narrate.py --force    → reescreve todas
#   python ml/narrate.py --dry-run  → imprime o prompt e sai (nao chama o CLI)
#
# Rodar DEPOIS do analyze.py: ele reescreve o arquivo inteiro e zera as narrativas, entao
# narrativa velha nunca sobrevive a numeros novos.
#
# Budget: claude-cli (assinatura), NUNCA API paga. Uma chamada por run com todos os
# projetos no mesmo prompt: o gargalo e rate limit de assinatura, nao tokens.
import json
import os
import re
import subprocess
import sys

MODEL = os.environ.get("CLAUDE_MODEL", "sonnet")
TIMEOUT_S = int(os.environ.get("CLAUDE_TIMEOUT_MS", "300000")) // 1000

INSTRUCTIONS = """Voce e analista de SEO do portfolio ROI Labs. Abaixo estao os diagnosticos
estatisticos de cada projeto (gerados por ml/analyze.py a partir do Search Console e dos
crawl stats). Escreva, para CADA projeto, 2 ou 3 frases em portugues do Brasil que:

1. digam o que esta acontecendo (le os numeros, nao os repete em lista);
2. deem a interpretacao mais provavel (ex.: impressoes multiplicando com posicao media
   piorando = conteudo novo rankeando fundo);
3. terminem em UMA acao concreta de SEO tecnico ou de conteudo.

Regras duras:
- Use SOMENTE os numeros do JSON. Nunca invente metrica, data ou concorrente.
- Sem mencionar midia paga: o portfolio e 100% SEO organico.
- "insufficient-data" quer dizer serie curta demais, nao queda. Diga isso quando for o caso.
- Banda larga na projecao e a incerteza do modelo, nao previsao de explosao.
- Nada de saudacao, titulo, bullet ou markdown. Texto corrido, no maximo 60 palavras por projeto.

Responda SO com um objeto JSON {"slug": "as frases"}, um slug por projeto, nada em volta.

DIAGNOSTICOS:
"""


def _win(windows, metric):
    if not windows:
        return "sem janelas"
    parts = []
    for w in ("4w", "12w", "26w"):
        v = (windows.get(metric) or {}).get(w) or {}
        slope = v.get("slopePctWeek")
        parts.append(f"{w} {v.get('state', '?')}" + ("" if slope is None else f" {slope:+.1f}%/sem"))
    return ", ".join(parts)


def project_facts(slug, i):
    """Uma linha por sinal — o prompt fica curto e o modelo nao precisa navegar o JSON cru."""
    lines = [f"## {slug}"]
    lines.append(f"health: {i.get('health')}/100 ({'; '.join(i.get('reasons') or []) or 'sem motivos'})")
    trend = i.get("trend") or {}
    lines.append("impressoes: " + _win(trend.get("windows"), "impressions"))
    lines.append("cliques: " + _win(trend.get("windows"), "clicks"))
    for c in i.get("changepoints") or []:
        lines.append(
            f"degrau: {c['metric']} pra {c['direction']} na semana de {c['date']} ({c['changePct']:+}%)"
        )
    for a in i.get("anomalies") or []:
        lines.append(
            f"anomalia: {a['metric']} da ultima semana {a['direction']} do normal "
            f"({a['value']} vs esperado {a['expected']}, {a['z']:.1f} sigma)"
        )
    crawl = i.get("crawl") or {}
    lines.append(f"crawl: {crawl.get('diagnosis')} — {crawl.get('detail')}")
    f = i.get("forecast")
    if f:
        nxt = ", ".join(
            f"{w['date']}: {w['value']} ({w['lo']}-{w['hi']})" for w in (f.get("weeks") or [])[:3]
        )
        lines.append(f"projecao {f.get('metric')} (ultima semana {f.get('lastWeek')}): {nxt}")
    for g in i.get("gates") or []:
        lines.append(f"gate {g['gate']} ({g['status']}): {g['sentence']}")
    if i.get("flags"):
        lines.append("flags: " + ", ".join(i["flags"]))
    return "\n".join(lines)


def build_prompt(insights, slugs):
    blocks = [project_facts(s, insights["projects"][s]) for s in slugs]
    return INSTRUCTIONS + f"(janela fecha em {insights.get('windowEnd')})\n\n" + "\n\n".join(blocks)


def parse_narratives(text, slugs):
    """O CLI nao tem json_schema strict: o objeto vem no meio do texto (mesmo problema
    resolvido em lib/autopublish-clients.ts). Tenta bloco cercado, depois cada '{'."""
    if not text:
        return {}
    candidates = re.findall(r"```(?:json)?\s*\n([\s\S]*?)```", text)
    candidates += [text[m.start():] for m in re.finditer(r"\{", text)]
    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            try:  # prosa DEPOIS do objeto: o decoder para no fim do JSON valido
                parsed, _ = json.JSONDecoder().raw_decode(candidate.strip())
            except json.JSONDecodeError:
                continue
        if not isinstance(parsed, dict):
            continue
        out = {
            k: " ".join(v.split())
            for k, v in parsed.items()
            if k in slugs and isinstance(v, str) and v.strip()
        }
        if out:
            return out
    return {}


def run_claude(prompt):
    args = [
        os.environ.get("CLAUDE_BIN", "claude"),
        "-p",
        "--output-format", "json",
        "--model", MODEL,
        # Uma passada, sem ferramenta: o dado ja esta no prompt, nao ha o que pesquisar.
        "--effort", "low",
        "--max-turns", "1",
    ]
    proc = subprocess.run(
        args,
        input=prompt,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=TIMEOUT_S,
        # No Windows o binario e um shim .cmd e CreateProcess nao executa .cmd direto
        # (WinError 193). O prompt vai por stdin, entao nada dele chega a linha de comando.
        shell=os.name == "nt",
    )
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "").strip()[:400] or "claude-cli falhou")
    payload = json.loads(proc.stdout)
    if payload.get("is_error") or not isinstance(payload.get("result"), str):
        raise RuntimeError(str(payload.get("result"))[:400])
    return payload["result"]


def main():
    # O prompt carrega as frases dos gates (acentos, setas) e o console do Windows e cp1252:
    # sem isto o --dry-run morre em UnicodeEncodeError antes de imprimir qualquer coisa.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    path = os.path.join(repo_root, "data", "insights.json")
    with open(path, encoding="utf-8") as f:
        insights = json.load(f)

    force = "--force" in sys.argv
    slugs = [
        s
        for s, i in insights["projects"].items()
        if i.get("health") is not None and (force or not i.get("narrative"))
    ]
    if not slugs:
        print("nada a narrar (use --force pra reescrever)")
        return 0

    prompt = build_prompt(insights, slugs)
    if "--dry-run" in sys.argv:
        print(prompt)
        return 0

    print(f"claude-cli ({MODEL}): {len(slugs)} projetos, {len(prompt)} chars")
    narratives = parse_narratives(run_claude(prompt), set(slugs))
    if not narratives:
        print("ERRO: resposta sem JSON utilizavel — insights.json intacto")
        return 1

    for slug, text in narratives.items():
        insights["projects"][slug]["narrative"] = text
    insights["narratedAt"] = insights.get("generatedAt")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(insights, f, ensure_ascii=False, indent=2)
        f.write("\n")

    missing = sorted(set(slugs) - set(narratives))
    print(f"narrados {len(narratives)}/{len(slugs)}" + (f" — sem resposta: {', '.join(missing)}" if missing else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
