import projects from "@/data/projects.json";
import { checkHealth, type Health } from "@/lib/health";
import { gscTrend, gscStatus, type GscTrend } from "@/lib/gsc";
import { computeScore, seoScoreFromClicks, WEIGHTS } from "@/lib/score.mjs";
import { Tabs, GscFoot } from "./tabs";

type Project = (typeof projects)[number];
type Evaluated = Project & {
  health: Health;
  trend: GscTrend;
  seo: number;
  seoAuto: number | null;
  decayEff: number;
  score: number;
};

async function evaluate(p: Project): Promise<Evaluated> {
  const [health, trend] = await Promise.all([checkHealth(p.url), gscTrend(p.url)]);
  const seoAuto = trend ? seoScoreFromClicks(trend.current, trend.previous) : null;
  const seo = seoAuto ?? p.seoSeed;
  const decayEff = health.ok ? p.decay : 10; // site fora do ar = decay máximo
  const score = computeScore({ receita: p.receita, blockers: p.blockers, seo, decay: decayEff });
  return { ...p, health, trend, seo, seoAuto, decayEff, score };
}

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
  const [gsc, evaluated] = await Promise.all([
    gscStatus(),
    Promise.all(projects.map(evaluate)),
  ]);
  evaluated.sort((a, b) => b.score - a.score);
  const foco = evaluated[0];
  const down = evaluated.filter((p) => !p.health.ok);
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
    { label: `Decay ×${WEIGHTS.decay}`, value: foco.decayEff },
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
          {projects.length} projetos · 1 foco · atualizado {atualizado}
        </div>
      </div>

      {down.length > 0 && (
        <div className="banner" role="alert">
          ⚠ {down.length} site{down.length > 1 ? "s" : ""} fora do ar:{" "}
          {down.map((p) => p.nome).join(", ")}
        </div>
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
            </div>
          </div>
          <div className="hero-score">
            <div className="figure" style={{ color: scoreColor(foco.score) }}>
              {foco.score}
            </div>
            <div className="figure-label">prioridade / 100</div>
          </div>
        </div>

        <div className="acao">
          → {foco.acao}
          {foco.receitaNota && <small>{foco.receitaNota}</small>}
        </div>

        {foco.blockersLista.length > 0 && (
          <ul className="hero-blockers">
            {foco.blockersLista.map((b) => (
              <li key={b}>{b}</li>
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
                  <div className="proj-name">{p.nome}</div>
                  <div className="proj-url">
                    <a href={p.url} target="_blank" rel="noreferrer">
                      {p.url.replace("https://", "").replace(/\/$/, "")}
                    </a>
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
                <td className="acao-cell">{p.acao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GscFoot gsc={gsc} />
      <p className="foot">
        Score = receita×{WEIGHTS.receita} + blockers×{WEIGHTS.blockers} + SEO×{WEIGHTS.seo} +
        decay×{WEIGHTS.decay}, cada critério 0–10. Site fora do ar força decay 10. SEO vem do
        Search Console quando <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> está configurada (pill
        GSC); senão usa o <code>seoSeed</code> manual (pill SEED). Critérios manuais: edite{" "}
        <code>data/projects.json</code> e dê push — o deploy é automático. Saúde e GSC são
        coletados ao vivo a cada carregamento.
      </p>
    </main>
  );
}
