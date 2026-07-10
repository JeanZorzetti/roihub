import { Fragment } from "react";
import projects from "@/data/projects.json";
import { gscSeries, gscStatus, isoDaysAgo } from "@/lib/gsc";
import { bucketWeeks, totals28 } from "@/lib/series.mjs";
import { Tabs, GscFoot } from "../tabs";

// GSC roda a cada request (16 meses de histórico na API — sem DB, sem cache de build).
export const dynamic = "force-dynamic";

type Project = (typeof projects)[number];
type Week = { start: string; end: string; clicks: number; impressions: number; position: number | null };
type Window28 = { clicks: number; impressions: number; position: number | null };
type Row = Project & { weeks: Week[]; t: { current: Window28; previous: Window28 } | null };

const num = new Intl.NumberFormat("pt-BR");
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtPos = (v: number | null) => (v === null ? "—" : v.toFixed(1).replace(".", ","));
const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Δ% pra métricas onde subir é bom (cliques, impressões).
function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return null; // sem base de comparação
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return null;
  return (
    <span className={pct > 0 ? "delta-up" : "delta-down"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// Posição média: CAIR é melhor — cor pela direção invertida.
function PosDelta({ cur, prev }: { cur: number | null; prev: number | null }) {
  if (cur === null || prev === null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return null;
  return (
    <span className={d < 0 ? "delta-up" : "delta-down"}>
      {d < 0 ? "▼" : "▲"} {Math.abs(d).toFixed(1).replace(".", ",")}
    </span>
  );
}

// Colunas com topo arredondado 4px e base reta (spec dataviz: data-end redondo, baseline quadrada).
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const CW = 248;
const CH = 72;
const PLOT_TOP = 14; // reserva pro rótulo do endpoint
const BASE = CH - 2;

function WeekChart({
  title,
  weeks,
  metric,
  unit,
}: {
  title: string;
  weeks: Week[];
  metric: "clicks" | "impressions";
  unit: [string, string];
}) {
  const values = weeks.map((w) => w[metric]);
  const max = Math.max(...values);
  const slot = CW / weeks.length;
  const lastH = max > 0 ? Math.round((values[values.length - 1] / max) * (BASE - PLOT_TOP)) : 0;
  return (
    <figure className="wk-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`${title}, últimas ${weeks.length} semanas`}>
        <line x1="0" y1={BASE} x2={CW} y2={BASE} className="axis" />
        {weeks.map((w, i) => {
          const v = values[i];
          const h = max > 0 ? Math.round((v / max) * (BASE - PLOT_TOP)) : 0;
          return (
            // ponytail: tooltip = <title> nativo do SVG (hover, sem JS no cliente);
            // a tabela em <details> cobre teclado — upgrade pra tooltip JS se fizer falta
            <g key={w.end} className="wk">
              <title>{`${fmtDay(w.start)}–${fmtDay(w.end)}: ${num.format(v)} ${v === 1 ? unit[0] : unit[1]}`}</title>
              <rect x={i * slot} y="0" width={slot} height={BASE} fill="transparent" />
              {h > 0 && <path className="bar" d={barPath(i * slot + 1, BASE - h, slot - 2, h)} />}
            </g>
          );
        })}
        {max > 0 && (
          <text className="wk-end" x={CW - 1} y={Math.max(10, BASE - lastH - 4)} textAnchor="end">
            {compact.format(values[values.length - 1])}
          </text>
        )}
      </svg>
      <div className="wk-range" aria-hidden>
        <span>{fmtDay(weeks[0].start)}</span>
        <span>{fmtDay(weeks[weeks.length - 1].end)}</span>
      </div>
    </figure>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{children}</div>
    </div>
  );
}

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
                  <Stat label="Posição média">
                    {fmtPos(p.t.current.position)} <PosDelta cur={p.t.current.position} prev={p.t.previous.position} />
                  </Stat>
                </div>
                <div className="seo-charts">
                  <WeekChart title="Cliques / semana" weeks={p.weeks} metric="clicks" unit={["clique", "cliques"]} />
                  <WeekChart
                    title="Impressões / semana"
                    weeks={p.weeks}
                    metric="impressions"
                    unit={["impressão", "impressões"]}
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
                    <td rowSpan={3} className="proj-name">
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
        anteriores. Posição média ponderada por impressões — <b>cair é melhor</b>. Impressão subindo em site novo =
        Google começando a servir o site, mesmo com 0 cliques. Tudo calculado ao vivo da API do Search Console (16
        meses de histórico) — sem banco.
      </p>
    </main>
  );
}
