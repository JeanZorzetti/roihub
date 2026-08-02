import { type Health } from "@/lib/health";
import { gscStatus, type GscTrend } from "@/lib/gsc";
import { githubStatus } from "@/lib/github";
import { listReposSemSite } from "@/lib/projects";
import { WEIGHTS } from "@/lib/score.mjs";
import { evaluateAll, type Project, type Evaluated } from "@/lib/evaluate";
import { dbOn, listDone } from "@/lib/db";
import { hash8, NO_DATE } from "@/lib/agenda.mjs";
import { Tabs, GscFoot, GithubFoot } from "./tabs";

export const dynamic = "force-dynamic";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--seq650)";
  if (score >= 55) return "var(--seq550)";
  if (score >= 40) return "var(--seq400)";
  return "var(--seq250)";
}

function deltaPct(t: GscTrend): number | null {
  if (!t || t.previous === 0) return null;
  return Math.round(((t.current - t.previous) / t.previous) * 100);
}

function HealthCell({ h }: { h: Health }) {
  return h.ok ? (
    <span className="health-ok">
      <span className="dot ok" aria-hidden />
      {h.status} · {h.ms}ms
    </span>
  ) : (
    <span className="health-down">
      <span className="dot down" aria-hidden />✕ FORA DO AR
    </span>
  );
}

function TrendCell({ p }: { p: Evaluated }) {
  if (p.seoAuto === null) {
    return (
      <span className="trend">
        {p.seoSeed}/10<span className="pill">SEED</span>
      </span>
    );
  }
  const pct = deltaPct(p.trend);
  return (
    <span className="trend">
      {p.trend!.current} {p.trend!.current === 1 ? "clique" : "cliques"}{" "}
      {pct !== null && (
        <span className={pct >= 0 ? "delta-up" : "delta-down"}>
          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
        </span>
      )}
      <span className="pill">GSC</span>
    </span>
  );
}

export default async function Page() {
  const [gsc, gh, evaluated, semSite, doneSet] = await Promise.all([
    gscStatus(),
    githubStatus(),
    evaluateAll(),
    listReposSemSite(),
    // falha de DB nunca derruba o hub — sem agenda, nada é riscado
    dbOn() ? listDone().catch(() => new Set<string>()) : new Set<string>(),
  ]);
  const acaoDone = (p: Project) => doneSet.has(`acao:${p.slug}:${hash8(p.acao)}@${NO_DATE}`);
  const foco = evaluated[0];
  const down = evaluated.filter((p) => !p.health.ok);
  const curados = evaluated.filter((p) => p.curated).length;
  const atualizado = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const meters: { label: string; value: number }[] = [
    { label: `Receita ×${WEIGHTS.receita}`, value: foco.receita },
    { label: `Blockers ×${WEIGHTS.blockers}`, value: foco.blockers },
    { label: `SEO ×${WEIGHTS.seo}`, value: foco.seo },
    { label: `Decay ×${WEIGHTS.decay}${foco.decayAuto !== null ? " · ML" : ""}`, value: foco.decayEff },
  ];

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="home" />
        </div>
        <div className="topbar-meta">
          {evaluated.length} projetos ({curados} curados) · 1 foco · atualizado {atualizado}
        </div>
      </div>

      {down.length > 0 && (
        <div className="banner" role="alert">
          ⚠ {down.length} site{down.length > 1 ? "s" : ""} fora do ar:{" "}
          {down.map((p) => p.nome).join(", ")}
        </div>
      )}

      {semSite.length > 0 && (
        <details className="sem-site">
          <summary>
            {semSite.length} repos ainda sem site — sem <code>homepage</code> no GitHub, ficam
            fora do ranking
          </summary>
          <ul>
            {semSite.map((r) => (
              <li key={r.name}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.name}
                </a>
                <code>gh repo edit JeanZorzetti/{r.name} --homepage https://…</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="hero">
        <p className="eyebrow">Foco de hoje — esqueça o resto</p>
        <div className="hero-top">
          <div>
            <h1 className="hero-name">{foco.nome}</h1>
            <div className="hero-url">
              <a href={foco.url} target="_blank" rel="noreferrer">
                {foco.url}
              </a>{" "}
              · <HealthCell h={foco.health} />
              {/* O ranking diz QUAL projeto e QUANTO; ele não diz o que a casa já sabe sobre ele
                  — hoje isso custa abrir a outra aba e digitar o nome de novo. `rerank=0&resposta=0`
                  de propósito: são ~0,3 s contra ~12 s, e link no ranking que faz esperar 12 s é
                  link que ninguém clica duas vezes. */}
              {" · "}
              <a href={`/busca?q=${encodeURIComponent(foco.nome)}&rerank=0&resposta=0`}>
                o que a casa sabe
              </a>
            </div>
          </div>
          <div className="hero-score">
            <div className="figure" style={{ color: scoreColor(foco.score) }}>
              {foco.score}
            </div>
            <div className="figure-label">prioridade / 100</div>
          </div>
        </div>

        <div className={acaoDone(foco) ? "acao done" : "acao"}>
          {acaoDone(foco) ? "✓" : "→"} {foco.acao}
          {foco.receitaNota && <small>{foco.receitaNota}</small>}
        </div>

        {foco.blockersLista.length > 0 && (
          <ul className="hero-blockers">
            {foco.blockersLista.map((b) => (
              <li key={b.texto}>{b.texto}</li>
            ))}
          </ul>
        )}

        <div className="meters">
          {meters.map((m) => (
            <div key={m.label}>
              <div className="meter-label">
                {m.label} <b>{m.value}/10</b>
              </div>
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${m.value * 10}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Projeto</th>
              <th>Saúde</th>
              <th>SEO 28d</th>
              <th>Score</th>
              <th>Próxima ação</th>
            </tr>
          </thead>
          <tbody>
            {evaluated.map((p, i) => (
              <tr key={p.slug}>
                <td className="rank">{i + 1}</td>
                <td>
                  <div className="proj-name">
                    {p.nome}
                    {!p.curated && <span className="pill">SEM CURADORIA</span>}
                  </div>
                  <div className="proj-url">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.url.replace("https://", "").replace(/\/$/, "")}
                    </a>
                    {p.repoUrl && (
                      <>
                        {" · "}
                        <a href={p.repoUrl} target="_blank" rel="noreferrer">
                          {p.repo}
                        </a>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <HealthCell h={p.health} />
                </td>
                <td>
                  <TrendCell p={p} />
                </td>
                <td className="score-cell">
                  <span className="score-num">{p.score}</span>
                  <div className="score-track">
                    <div
                      className="score-fill"
                      style={{ width: `${p.score}%`, background: scoreColor(p.score) }}
                    />
                  </div>
                </td>
                <td className={acaoDone(p) ? "acao-cell done" : "acao-cell"}>{p.acao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GscFoot gsc={gsc} />
      <GithubFoot gh={gh} />
      <p className="foot">
        A lista vem do GitHub: todo repo vivo com <code>homepage</code> preenchida é um projeto.
        A chave é a <b>URL do site</b>, não o repo — um repo pode servir vários sites (o monorepo{" "}
        <code>roilabs</code> serve roilabs.com.br e goiania), então cada entrada de{" "}
        <code>data/projects.json</code> aponta o seu repo pelo campo <code>repo</code> e a URL
        curada sempre vence a <code>homepage</code>. Repo sem curadoria entra com todos os
        critérios em 0 e fica no fim do ranking até ganhar receita/blockers/ação.
      </p>
      <p className="foot">
        Score = receita×{WEIGHTS.receita} + blockers×{WEIGHTS.blockers} + SEO×{WEIGHTS.seo} +
        decay×{WEIGHTS.decay}, cada critério 0–10. Site fora do ar força decay 10. SEO vem do
        Search Console quando <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> está configurada (pill
        GSC); senão usa o <code>seoSeed</code> manual (pill SEED). Decay vem da saúde do{" "}
        <code>data/insights.json</code> (10 − saúde/10, marcado ML) quando gerado há ≤ 10 dias;
        senão usa o manual. Flags do insights (ex.: crawl-waste) entram nos blockers do foco.
        Critérios manuais: edite <code>data/projects.json</code> e dê push — o deploy é
        automático. Saúde e GSC são coletados ao vivo a cada carregamento. Ação riscada = marcada
        como feita na aba Agenda (conclusão real = trocar a ação no projects.json).
      </p>
    </main>
  );
}
