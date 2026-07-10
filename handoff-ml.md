# ROI Hub — handoff: ML de diagnóstico e insights (não iniciado)

**Objetivo:** um motor que diagnostica e gera insights por projeto a partir dos dados das duas abas do hub — `/seo` (Search Console via API) e `/infra` (crawl stats via export manual) — e entrega as conclusões DENTRO do hub. Pedido do Jean em 10/07/2026; nada implementado ainda, este arquivo é o brief completo pra sessão nova.

## Decisão de linguagem: Python, SOZINHO

- **Python** porque: dataset minúsculo (10 projetos × ~16 meses de dados diários ≈ 20–50k pontos no total), execução batch semanal (zero exigência de latência), e todo o ferramental necessário é Python maduro: `pandas`, `scipy`, `statsmodels` (Holt-Winters), `ruptures` (changepoint detection), `scikit-learn` se precisar.
- **Rust NÃO entra**: só pagaria em motor de alto volume/baixa latência, que este problema não tem nem vai ter neste escopo. Python+Rust juntos = 2 toolchains pra manter sem retorno. (O aprendizado CannibalScan "Rust=motor, TS=orquestração" continua válido — aqui simplesmente não há motor que justifique.)
- **Honestidade sobre "ML"**: com 10 projetos e granularidade semanal, deep learning/modelos gordos = overfitting garantido. A v1 é **estatística robusta bem escolhida** (tendência, changepoint, anomalia, correlação, forecast simples) — isso JÁ é o motor de diagnóstico. Modelos maiores só se os dados um dia justificarem.
- **Narrativa em linguagem natural (opcional, F4)**: via `claude-cli` (assinatura, budget = claude-cli only, NUNCA API paga — regra global do Jean).

## Arquitetura (encaixa no padrão do hub: sem DB, sem serviço novo)

```
ml/ (subpasta NOVA dentro do repo roihub)
  analyze.py          ← entrypoint: puxa dados → computa → escreve data/insights.json
  gsc.py              ← GSC API (mesma service account do hub)
  crawl.py            ← parser dos CSVs de docs/ (espelho do lib/crawl.mjs)
  diagnostics.py      ← as análises (ver "O que computar")
  requirements.txt
data/insights.json    ← OUTPUT versionado; commit+push = deploy (padrão projects.json)
```

- **Job batch local** (roda na máquina do Jean, na rotina de sexta junto com o export de crawl): `python ml/analyze.py` → escreve `data/insights.json` → commit+push → hub renderiza.
- **Zero infra nova**: sem serviço Python no EasyPanel, sem DB, sem cron remoto. O hub (Next) só LÊ o JSON versionado — a renderização é uma seção/aba nova barata.
- Se um dia precisar automatizar: vira um cron no EasyPanel que faz o push. Não começar por aí.

## Dados disponíveis (tudo já resolvido, é só consumir)

1. **GSC API** — série diária de até 16 meses por propriedade: clicks, impressions, ctr, position (`searchAnalytics/query`, `dimensions:["date"]`; dá pra abrir por `query` e `page` também — útil pros insights). Auth: service account `nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`, JSON em `nimblabs/docs/review-dispute-agent-498311-oneline.txt` (⚠️ NUNCA commitar; ler via env `GOOGLE_SERVICE_ACCOUNT_JSON` ou path local). 10 propriedades, auto-descoberta via `sites.list` — replicar a lógica de `lib/gsc.ts` (resolveProperty: sc-domain exato > domínio-pai > URL-prefix; filtro de página por host).
2. **Crawl stats** — CSVs em `roihub/docs/**/{host}-Crawl-stats-AAAA-MM-DD/`: série diária de 90d (requisições, bytes, tempo de resposta) + snapshots (% por resposta, hosts, finalidades, tipos de arquivo — os dois últimos HOJE não são usados pelo hub, o ML pode usar). Regras de parse já resolvidas em `lib/crawl.mjs` (**portar 1:1**): header pt-BR → parse por POSIÇÃO de coluna; UTF-8 com BOM; label "(5xx)" agrupado; merge de exports sobrepostos por data (mais novo vence).
3. **Contexto por projeto** — `data/projects.json`: receita/blockers/decay/ação manual de cada um.

## O que computar (fases; cada uma já entrega valor sozinha)

**F0 — extração:** módulos `gsc.py` + `crawl.py` devolvendo DataFrames diários por projeto. Puxar 16 meses do GSC (não os 84 dias do hub — o histórico longo é a vantagem do ML). Critério: `analyze.py --dump` imprime as séries dos 10 projetos.

**F1 — diagnóstico estatístico → `insights.json`:**
- **Tendência robusta**: Theil-Sen slope sobre cliques/impressões semanais (janelas 4/12/26 sem) → `improving | flat | declining` + magnitude. Robusto > OLS (outliers de semana).
- **Changepoints**: `ruptures` (PELT) na série de impressões → "impressões quebraram pra cima na semana de X" (cruzar depois com deploys/algo updates manualmente).
- **Anomalias**: última semana vs esperado (mediana móvel ± k·MAD) → alertas tipo "cliques 3σ abaixo do normal".
- **Diagnóstico crawl↔SEO**: % redirect/404/outros alto + impressões estagnadas = crawl waste (roilabs 40,6% OK, goiania 65,2%, nimblabs 60,3% no export de 10/07 — já são os 3 primeiros casos de teste reais); tempo de resposta subindo vs volume de crawl caindo (Google desiste de site lento).
- **Score de saúde SEO 0–100 por projeto** combinando os sinais acima, com os motivos listados (explicável, nunca só o número).

**F2 — render no hub:** seção "Insights" por card (ou 4ª aba "Insights") lendo `data/insights.json` + data de geração ("gerado em 11/07 — rode ml/analyze.py pra atualizar" se velho > 10 dias). Estado vazio honesto se o JSON não existir.

**F3 — forecast + kill-gates:** Holt-Winters/ETS nas impressões semanais → projeção 4–8 semanas com intervalo. Uso direto: **kill-gates D+90/180/270 dos bets nimblabs** (tese do portfólio) — "no ritmo atual, aftercare NÃO cruza o gate D+180". É o insight de maior valor de negócio do sistema.

**F4 (opcional) — narrativa:** prompt com o JSON pro `claude-cli -p` gerar 2–3 frases pt-BR por projeto ("Impressões 3× em 6 sem mas posição média piorou: conteúdo novo rankeando fundo; reforce internal links de X"). Batch, 1×/semana, custo assinatura.

## Schema proposto do insights.json (F1)

```json
{
  "generatedAt": "2026-07-11",
  "projects": {
    "goiania": {
      "health": 62,
      "trend": { "impressions": "improving", "clicks": "flat", "slopePctWeek": 8.2 },
      "changepoints": [{ "date": "2026-06-02", "metric": "impressions", "direction": "up" }],
      "anomalies": [],
      "crawl": { "diagnosis": "crawl-waste", "detail": "33,6% redirect — eco do gotcha trailing-slash nginx" },
      "flags": ["crawl-waste"],
      "narrative": null
    }
  }
}
```

## Gotchas pra próxima sessão

- **GSC atrasa ~3 dias** e OMITE dias com zero impressões — reindexar a série por calendário com fill 0 antes de qualquer análise (o hub já faz isso em JS).
- **Séries curtas/esparsas** (nimblabs ~0 cliques): métodos precisam degradar com elegância — sem dado suficiente → `"insufficient-data"`, nunca NaN/crash. Impressões são o sinal primário em site novo, não cliques.
- **Credencial**: `.gitignore` do repo já cobre `.env`; `ml/` deve ler a env ou o path do txt do nimblabs — nunca copiar o JSON pra dentro do repo.
- **Windows + OneDrive**: venv dentro do OneDrive pode corromper (mesmo padrão do node_modules, errno -4094). Criar venv FORA (`C:\venvs\roihub-ml`) ou usar `uv` com cache fora do OneDrive.
- **Python no PATH da máquina**: conferir versão ≥3.11 antes de começar (`python --version`).
- Crawl stats: cada export = 90 dias; com 1 export só (10/07) as janelas de comparação 28d-vs-28d anteriores já funcionam, mas changepoint em crawl precisa de ~2–3 meses de exports emendados — implementar, deixar ativar sozinho conforme o histórico cresce.
- Testes: seguir o padrão do repo (funções puras testáveis; `pytest` simples, sem fixtures gordas). O parse de crawl tem os casos prontos em `test/crawl.test.mjs` — portar os mesmos asserts.

## Primeiro passo concreto da sessão nova

1. Ler este arquivo + `handoff.md` + `lib/crawl.mjs` + `lib/gsc.ts`.
2. F0: `ml/` com extração GSC (16 meses, 10 propriedades) e parse dos CSVs — validar contra os números que o hub mostra (mesmos totais 28d).
3. F1 na sequência; F2 fecha o loop no hub. F3/F4 só depois de F1–F2 verificados.
