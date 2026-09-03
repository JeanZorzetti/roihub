import { Fragment } from "react";
import { listProjects, type Project } from "@/lib/projects";
import { gscSeries, gscStatus, isoDaysAgo } from "@/lib/gsc";
import { bucketWeeks, totals28 } from "@/lib/series.mjs";
import { rankBySeoScore } from "@/lib/seo-score.mjs";
import { Tabs, GscFoot } from "../tabs";
import { WeekChart, Stat, Delta, InvDelta, num, compact, fmtDay, sinceGsc } from "../viz";

// GSC roda a cada request (16 meses de histórico na API — sem DB, sem cache de build).
export const dynamic = "force-dynamic";

type Week = { start: string; end: string; clicks: number; impressions: number; position: number | null; ctr: number | null };
type Window28 = { clicks: number; impressions: number; position: number | null; ctr: number | null };
type SeoScore = {
  score: number;
  rank: number;
  components: { clicks: number; ctr: number; position: number; impressions: number };
};
type Row = Project & { weeks: Week[]; t: { current: Window28; previous: Window28 } | null; seoScore?: SeoScore };

const fmtPos = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const fmtCtr = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

// mesma escala de cor do score 0-100 usado em app/page.tsx (--seq250..650)
function scoreColor(score: number): string {
  if (score >= 70) return "var(--seq650)";
  if (score >= 55) return "var(--seq550)";
  if (score >= 40) return "var(--seq400)";
  return "var(--seq250)";
}

export default async function SeoPage() {
  const end = isoDaysAgo(3);
  const projects = await listProjects();
  const [gsc, rows] = await Promise.all([
    gscStatus(),
    Promise.all(
      projects.map(async (p): Promise<Row> => {
        const s = await gscSeries(p.url);
        // `{erro}` (falha transitória) vira o mesmo estado vazio que `null` (fato real) aqui —
        // esta tela não distingue os dois motivos, só `okr-coleta.ts` precisa (design-review 03/09).
        if (!s || "erro" in s) return { ...p, weeks: [], t: null };
        return { ...p, weeks: bucketWeeks(s.days, end), t: totals28(s.days, end) };
      })
    ),
  ]);
  // Score composto (cliques 40% / CTR 30% / posição 20% / impressões 10%) — ver
  // specs/004-seo-weighted-ranking/. Projetos sem dado GSC ficam fora do cálculo e vão ao final.
  const withData = rows.filter((r) => r.t !== null);
  const withoutData = rows.filter((r) => r.t === null);
  const ranked = rankBySeoScore(
    withData.map((r) => ({
      slug: r.slug,
      nome: r.nome,
      clicks: r.t!.current.clicks,
      ctr: r.t!.current.ctr,
      position: r.t!.current.position,
      impressions: r.t!.current.impressions,
    }))
  );
  const scoreBySlug = new Map(ranked.map((s) => [s.slug, s]));
  withData.sort((a, b) => scoreBySlug.get(a.slug)!.rank - scoreBySlug.get(b.slug)!.rank);
  for (const r of withData) r.seoScore = scoreBySlug.get(r.slug);
  const orderedRows: Row[] = [...withData, ...withoutData];
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
        {orderedRows.map((p) => (
          <article
            className={p.seoScore && p.seoScore.rank <= 3 ? "seo-card seo-card--top" : "seo-card"}
            key={p.slug}
          >
            <div className="seo-head">
              <div>
                <div className="proj-name">
                  {p.seoScore && <span className="seo-rank-badge">#{p.seoScore.rank}</span>}
                  {p.nome}
                </div>
                <div className="proj-url">
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.url.replace("https://", "").replace(/\/$/, "")}
                  </a>
                  {p.gscInicio && <> · {sinceGsc(p.gscInicio)}</>}
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
                  {p.seoScore && (
                    <Stat label="Score ponderado">
                      <span
                        className="score-num"
                        title={`cliques ${fmtPct(p.seoScore.components.clicks)} · ctr ${fmtPct(
                          p.seoScore.components.ctr
                        )} · posição ${fmtPct(p.seoScore.components.position)} · impressões ${fmtPct(
                          p.seoScore.components.impressions
                        )}`}
                      >
                        {p.seoScore.score}
                      </span>
                      <div className="score-track">
                        <div
                          className="score-fill"
                          style={{ width: `${p.seoScore.score}%`, background: scoreColor(p.seoScore.score) }}
                        />
                      </div>
                    </Stat>
                  )}
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
        Ranking por score composto — cliques 40%, CTR 30%, posição 20%, impressões 10% (normalizado por
        projeto, não por valor absoluto). Projetos sem dado GSC (<span className="pill">SEED</span>) ficam de
        fora do score e vão ao final. Semanas de 7 dias fechando em {fmtDay(end)} (GSC atrasa ~3 dias). Δ
        compara os últimos 28 dias com os 28 anteriores. Posição média ponderada por impressões — <b>cair é
        melhor</b>. CTR agregado da janela
        (cliques÷impressões), não média dos CTRs diários. Impressão subindo em site novo =
        Google começando a servir o site, mesmo com 0 cliques. Tudo calculado ao vivo da API do Search Console (16
        meses de histórico) — sem banco. A sala de controle editorial e o histórico de publicação saíram desta aba: moram
        em <a href="/automacao">Automação</a>.
      </p>
    </main>
  );
}
