import { readFileSync } from "node:fs";
import path from "node:path";
import { listProjects } from "@/lib/projects";
import { Tabs } from "../tabs";
import { fmtDay, num } from "../viz";

// Lê data/insights.json (gerado pelo ml/analyze.py, versionado — commit+push = deploy).
export const dynamic = "force-dynamic";

type TrendState = "improving" | "flat" | "declining" | "insufficient-data";
type Win = { state: TrendState; slopePctWeek: number | null };
type Insight = {
  property: string | null;
  health: number | null;
  reasons: string[];
  trend: {
    impressions: TrendState;
    clicks: TrendState;
    slopePctWeek: number | null;
    windows: { clicks: Record<string, Win>; impressions: Record<string, Win> } | null;
  };
  changepoints: { date: string; metric: string; direction: "up" | "down"; changePct: number }[];
  anomalies: { metric: string; direction: "above" | "below"; value: number; expected: number; z: number }[];
  crawl: { diagnosis: string; detail: string };
  forecast?: { metric: string; lastWeek: number; weeks: Projected[] } | null;
  gates?: Gate[];
  flags: string[];
  narrative: string | null;
};
type Projected = { date: string; value: number; lo: number; hi: number };
type GateStatus =
  | "passou"
  | "no-ritmo"
  | "em-risco"
  | "nao-cruza"
  | "falhou"
  | "distante"
  | "sem-dados"
  | "nao-mensuravel";
type Gate = { gate: string; date: string; status: GateStatus; sentence: string };
type Insights = { generatedAt: string; windowEnd: string; projects: Record<string, Insight> };

const PT_STATE: Record<TrendState, string> = {
  improving: "subindo",
  flat: "estável",
  declining: "caindo",
  "insufficient-data": "sem dados",
};
const PT_METRIC: Record<string, string> = { impressions: "impressões", clicks: "cliques" };
// Kill-gates da tese nimblabs: ✔ cruza, ✖ não cruza, ⚠ decidido pelo intervalo, ◷ ainda não dá pra dizer.
const GATE_MARK: Record<GateStatus, { icon: string; cls: string }> = {
  passou: { icon: "✔", cls: "delta-up" },
  "no-ritmo": { icon: "✔", cls: "delta-up" },
  "em-risco": { icon: "⚠", cls: "" },
  "nao-cruza": { icon: "✖", cls: "delta-down" },
  falhou: { icon: "✖", cls: "delta-down" },
  distante: { icon: "◷", cls: "" },
  "sem-dados": { icon: "◷", cls: "" },
  "nao-mensuravel": { icon: "◷", cls: "" },
};
const stateClass = (s: TrendState) =>
  s === "improving" ? "delta-up" : s === "declining" ? "delta-down" : "";
const slope = (v: number | null) =>
  v === null ? "" : ` (${v > 0 ? "+" : ""}${v.toFixed(1).replace(".", ",")}%/sem)`;

function loadInsights(): Insights | null {
  try {
    return JSON.parse(readFileSync(path.join(process.cwd(), "data", "insights.json"), "utf8"));
  } catch {
    return null;
  }
}

function healthPill(health: number | null) {
  if (health === null) return <span className="pill">SEM DADOS</span>;
  const cls = health >= 70 ? "pill pill-ok" : health >= 40 ? "pill pill-warn" : "pill pill-crit";
  return <span className={cls}>health {health}/100</span>;
}

function TrendLine({ label, state, slopePct }: { label: string; state: TrendState; slopePct: number | null }) {
  return (
    <span>
      {label}:{" "}
      <b className={stateClass(state)}>
        {PT_STATE[state]}
        {state === "improving" || state === "declining" || state === "flat" ? slope(slopePct) : ""}
      </b>
    </span>
  );
}

export default async function InsightsPage() {
  const projects = await listProjects();
  const data = loadInsights();
  const ageDays = data ? Math.floor((Date.now() - Date.parse(data.generatedAt)) / 864e5) : 0;
  const rows = projects
    // repo sem curadoria e sem insight não tem o que diagnosticar — fica fora da aba
    .filter((p) => p.curated || data?.projects[p.slug])
    .map((p) => ({ p, i: data?.projects[p.slug] ?? null }))
    .sort((a, b) => (a.i?.health ?? 101) - (b.i?.health ?? 101)); // pior primeiro: aba de diagnóstico

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="insights" />
        </div>
        <div className="topbar-meta">
          {data
            ? `diagnóstico estatístico · gerado em ${fmtDay(data.generatedAt)} · janela fecha em ${fmtDay(data.windowEnd)}`
            : "diagnóstico estatístico"}
        </div>
      </div>

      {data && ageDays > 10 && (
        <div className="banner">
          Insights desatualizados: gerados há {ageDays} dias. Rode <code>python ml/analyze.py</code> e dê push.
        </div>
      )}

      {!data && (
        <div className="card seo-card">
          <p className="seo-empty">
            Sem <code>data/insights.json</code>. Rode <code>python ml/analyze.py</code> na raiz do repo (venv em{" "}
            <code>C:\venvs\roihub-ml</code>) e dê push — o deploy é automático.
          </p>
        </div>
      )}

      <section className="seo-grid">
        {data &&
          rows.map(({ p, i }) => (
            <article className="seo-card" key={p.slug}>
              <div className="seo-head">
                <div>
                  <div className="proj-name">{p.nome}</div>
                  <div className="proj-url">{i?.property ?? new URL(p.url).hostname}</div>
                </div>
                {healthPill(i?.health ?? null)}
              </div>

              {!i && <p className="seo-empty">Projeto sem análise — rode ml/analyze.py de novo.</p>}
              {i && (
                <>
                  <p className="insight-line">
                    <TrendLine label="Impressões 12sem" state={i.trend.impressions} slopePct={i.trend.slopePctWeek} />
                    {" · "}
                    <TrendLine
                      label="cliques"
                      state={i.trend.clicks}
                      slopePct={i.trend.windows?.clicks["12w"]?.slopePctWeek ?? null}
                    />
                  </p>

                  {i.gates?.map((g) => (
                    <p className="insight-line" key={g.gate}>
                      <b className={GATE_MARK[g.status].cls}>{GATE_MARK[g.status].icon}</b> {g.sentence}
                    </p>
                  ))}

                  {i.forecast && (
                    <details className="wk-table">
                      <summary>
                        projeção {i.forecast.weeks.length} semanas de{" "}
                        {PT_METRIC[i.forecast.metric] ?? i.forecast.metric} (Holt amortecido, intervalo 80%)
                      </summary>
                      <p className="seo-empty">
                        Intervalo largo não é bug: em série jovem e volátil o modelo está dizendo que não sabe
                        prever tão longe. Julgue pelas primeiras semanas.
                      </p>
                      <table>
                        <thead>
                          <tr>
                            <th>Semana de</th>
                            <th>Projeção</th>
                            <th>Intervalo 80%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {i.forecast.weeks.map((w) => (
                            <tr key={w.date}>
                              <td>{fmtDay(w.date)}</td>
                              <td>{num.format(w.value)}</td>
                              <td>
                                {num.format(w.lo)}–{num.format(w.hi)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}

                  {i.changepoints.map((c) => (
                    <p className="insight-line" key={c.date + c.metric}>
                      <b className={c.direction === "up" ? "delta-up" : "delta-down"}>
                        {c.direction === "up" ? "▲" : "▼"} {PT_METRIC[c.metric] ?? c.metric}
                      </b>{" "}
                      deram um degrau pra {c.direction === "up" ? "cima" : "baixo"} na semana de {fmtDay(c.date)} (
                      {c.changePct > 0 ? "+" : ""}
                      {num.format(c.changePct)}%)
                    </p>
                  ))}

                  {i.anomalies.map((a) => (
                    <p className="insight-line" key={a.metric}>
                      <b className={a.direction === "above" ? "delta-up" : "delta-down"}>
                        ⚠ {PT_METRIC[a.metric] ?? a.metric}
                      </b>{" "}
                      da última semana {a.direction === "above" ? "acima" : "abaixo"} do normal: {num.format(a.value)}{" "}
                      (esperado ~{num.format(a.expected)}, {a.z.toFixed(1).replace(".", ",")}σ)
                    </p>
                  ))}

                  <p className="resp-line">
                    Crawl:{" "}
                    <span className={i.crawl.diagnosis === "ok" || i.crawl.diagnosis === "no-data" ? "" : "resp-bad"}>
                      {i.crawl.detail}
                    </span>
                  </p>

                  {i.narrative && <p className="insight-line">{i.narrative}</p>}

                  <details className="wk-table">
                    <summary>por que health {i.health ?? "—"}</summary>
                    <ul className="reason-list">
                      {i.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </details>

                  {i.trend.windows && (
                    <details className="wk-table">
                      <summary>tendência por janela (4 / 12 / 26 semanas)</summary>
                      <table>
                        <thead>
                          <tr>
                            <th>Métrica</th>
                            <th>4 sem</th>
                            <th>12 sem</th>
                            <th>26 sem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(["impressions", "clicks"] as const).map((m) => (
                            <tr key={m}>
                              <td>{PT_METRIC[m]}</td>
                              {(["4w", "12w", "26w"] as const).map((w) => {
                                const win = i.trend.windows![m][w];
                                return (
                                  <td key={w} className={stateClass(win.state)}>
                                    {PT_STATE[win.state]}
                                    {slope(win.slopePctWeek)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                </>
              )}
            </article>
          ))}
      </section>

      <p className="foot">
        Gerado pelo <code>ml/analyze.py</code> (batch local, rotina de sexta): 16 meses de série diária do GSC +
        exports de crawl stats, estatística robusta — tendência Theil-Sen por janela, degraus (changepoint PELT),
        anomalia da última semana (mediana ± 3·MAD) e diagnóstico crawl↔SEO. Health 0–100 sempre com os motivos
        listados. Nos 3 bets do nimblabs, a projeção (Holt amortecido em log, intervalo 80%) responde os
        kill-gates D+90/180/270 da tese — ✔ cruza, ✖ não cruza, ◷ ainda sem veredito. Cards ordenados do pior pro
        melhor. Pra atualizar: <code>python ml/analyze.py</code> + commit+push.
      </p>
    </main>
  );
}
