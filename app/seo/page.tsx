import { Fragment } from "react";
import projects from "@/data/projects.json";
import { gscSeries, gscStatus, isoDaysAgo } from "@/lib/gsc";
import { bucketWeeks, totals28 } from "@/lib/series.mjs";
import { Tabs, GscFoot } from "../tabs";
import { WeekChart, Stat, Delta, InvDelta, num, compact, fmtDay } from "../viz";

// GSC roda a cada request (16 meses de histórico na API — sem DB, sem cache de build).
export const dynamic = "force-dynamic";

type Project = (typeof projects)[number];
type Week = { start: string; end: string; clicks: number; impressions: number; position: number | null; ctr: number | null };
type Window28 = { clicks: number; impressions: number; position: number | null; ctr: number | null };
type Row = Project & { weeks: Week[]; t: { current: Window28; previous: Window28 } | null };

const fmtPos = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const fmtCtr = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

export default async function SeoPage() {
  const end = isoDaysAgo(3);
  const [gsc, rows] = await Promise.all([
    gscStatus(),
    Promise.all(
      projects.map(async (p): Promise<Row> => {
        const s = await gscSeries(p.url);
        if (!s) return { ...p, weeks: [], t: null };
        return { ...p, weeks: bucketWeeks(s.days, end), t: totals28(s.days, end) };
      })
    ),
  ]);
  rows.sort((a, b) => (b.t?.current.impressions ?? -1) - (a.t?.current.impressions ?? -1));
  const withData = rows.filter((r) => r.t !== null);
  const weekHeads = withData[0]?.weeks ?? [];

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="seo" />
        </div>
        <div className="topbar-meta">progressão · 12 semanas · janela fecha em {fmtDay(end)}</div>
      </div>

      <section className="seo-grid">
        {rows.map((p) => (
          <article className="seo-card" key={p.slug}>
            <div className="seo-head">
              <div>
                <div className="proj-name">{p.nome}</div>
                <div className="proj-url">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url.replace("https://", "").replace(/\/$/, "")}
                  </a>
                </div>
              </div>
              {p.t === null && <span className="pill">SEED</span>}
            </div>
            {p.t ? (
              <>
                <div className="seo-stats">
                  <Stat label="Cliques 28d">
                    {num.format(p.t.current.clicks)} <Delta cur={p.t.current.clicks} prev={p.t.previous.clicks} />
                  </Stat>
                  <Stat label="Impressões 28d">
                    {compact.format(p.t.current.impressions)}{" "}
                    <Delta cur={p.t.current.impressions} prev={p.t.previous.impressions} />
                  </Stat>
                  <Stat label="CTR 28d">
                    {fmtCtr(p.t.current.ctr)}{" "}
                    {p.t.current.ctr !== null && p.t.previous.ctr !== null && (
                      <Delta cur={p.t.current.ctr} prev={p.t.previous.ctr} />
                    )}
                  </Stat>
                  <Stat label="Posição média">
                    {fmtPos(p.t.current.position)}{" "}
                    <InvDelta
                      cur={p.t.current.position}
                      prev={p.t.previous.position}
                      fmt={(d) => d.toFixed(1).replace(".", ",")}
                    />
                  </Stat>
                </div>
                <div className="seo-charts">
                  <WeekChart
                    title="Cliques / semana"
                    points={p.weeks.map((w) => ({ start: w.start, end: w.end, value: w.clicks }))}
                    fmt={(v) => `${num.format(v)} ${v === 1 ? "clique" : "cliques"}`}
                  />
                  <WeekChart
                    title="Impressões / semana"
                    points={p.weeks.map((w) => ({ start: w.start, end: w.end, value: w.impressions }))}
                    fmt={(v) => `${num.format(v)} ${v === 1 ? "impressão" : "impressões"}`}
                  />
                </div>
              </>
            ) : (
              <p className="seo-empty">
                Sem dados GSC —{" "}
                {gsc.state === "ok" ? "nenhuma propriedade cobre este host" : "conexão GSC indisponível"}. O ranking
                usa o seoSeed manual ({p.seoSeed}/10).
              </p>
            )}
          </article>
        ))}
      </section>

      {withData.length > 0 && (
        <details className="card table-details">
          <summary>Dados semanais em tabela ({withData.length} projetos × {weekHeads.length} semanas)</summary>
          <table>
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Métrica</th>
                {weekHeads.map((w) => (
                  <th key={w.end}>{fmtDay(w.end)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withData.map((p) => (
                <Fragment key={p.slug}>
                  <tr>
                    <td rowSpan={4} className="proj-name">
                      {p.nome}
                    </td>
                    <td>Cliques</td>
                    {p.weeks.map((w) => (
                      <td key={w.end}>{num.format(w.clicks)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Impressões</td>
                    {p.weeks.map((w) => (
                      <td key={w.end}>{num.format(w.impressions)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>CTR</td>
                    {p.weeks.map((w) => (
                      <td key={w.end}>{fmtCtr(w.ctr)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Posição</td>
                    {p.weeks.map((w) => (
                      <td key={w.end}>{fmtPos(w.position)}</td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <GscFoot gsc={gsc} />
      <p className="foot">
        Semanas de 7 dias fechando em {fmtDay(end)} (GSC atrasa ~3 dias). Δ compara os últimos 28 dias com os 28
        anteriores. Posição média ponderada por impressões — <b>cair é melhor</b>. CTR agregado da janela
        (cliques÷impressões), não média dos CTRs diários. Impressão subindo em site novo =
        Google começando a servir o site, mesmo com 0 cliques. Tudo calculado ao vivo da API do Search Console (16
        meses de histórico) — sem banco.
      </p>
    </main>
  );
}
