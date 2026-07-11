// Peças de dataviz compartilhadas entre /seo e /infra: chart de colunas semanais,
// stat com delta. Tudo server component — sem JS no cliente.

import { todaySP } from "@/lib/agenda.mjs";

export const num = new Intl.NumberFormat("pt-BR");
export const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
export const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Idade do projeto no GSC (gscInicio do projects.json) — régua de revisão de performance/crawl.
export function sinceGsc(inicio: string): string {
  const d = Math.round((Date.parse(todaySP()) - Date.parse(inicio)) / 86400000);
  return `GSC desde ${fmtDay(inicio)} · D+${d}`;
}

export type WeekPoint = { start: string; end: string; value: number | null };

// Colunas com topo arredondado 4px e base reta (spec dataviz: data-end redondo, baseline quadrada).
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const CW = 248;
const CH = 72;
const PLOT_TOP = 14; // reserva pro rótulo do endpoint
const BASE = CH - 2;

export function WeekChart({
  title,
  points,
  fmt,
}: {
  title: string;
  points: WeekPoint[];
  fmt: (v: number) => string;
}) {
  const values = points.map((p) => p.value);
  const max = Math.max(0, ...values.filter((v): v is number => v !== null));
  const slot = CW / points.length;
  const last = values[values.length - 1];
  const lastH = max > 0 && last ? Math.round((last / max) * (BASE - PLOT_TOP)) : 0;
  return (
    <figure className="wk-chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${CW} ${CH}`} role="img" aria-label={`${title}, últimas ${points.length} semanas`}>
        <line x1="0" y1={BASE} x2={CW} y2={BASE} className="axis" />
        {points.map((p, i) => {
          const v = p.value;
          const h = max > 0 && v ? Math.round((v / max) * (BASE - PLOT_TOP)) : 0;
          return (
            // ponytail: tooltip = <title> nativo do SVG (hover, sem JS no cliente);
            // a tabela-gêmea cobre teclado — upgrade pra tooltip JS se fizer falta
            <g key={p.end} className="wk">
              <title>{`${fmtDay(p.start)}–${fmtDay(p.end)}: ${v === null ? "sem dados" : fmt(v)}`}</title>
              <rect x={i * slot} y="0" width={slot} height={BASE} fill="transparent" />
              {h > 0 && <path className="bar" d={barPath(i * slot + 1, BASE - h, slot - 2, h)} />}
            </g>
          );
        })}
        {max > 0 && last !== null && (
          <text className="wk-end" x={CW - 1} y={Math.max(10, BASE - lastH - 4)} textAnchor="end">
            {compact.format(last)}
          </text>
        )}
      </svg>
      <div className="wk-range" aria-hidden>
        <span>{fmtDay(points[0].start)}</span>
        <span>{fmtDay(points[points.length - 1].end)}</span>
      </div>
    </figure>
  );
}

export function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{children}</div>
    </div>
  );
}

// Δ% pra métricas onde subir é bom (cliques, impressões, requisições).
export function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return null; // sem base de comparação
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return null;
  return (
    <span className={pct > 0 ? "delta-up" : "delta-down"}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// Δ absoluto pra métricas onde CAIR é melhor (posição média, tempo de resposta).
export function InvDelta({
  cur,
  prev,
  fmt,
}: {
  cur: number | null;
  prev: number | null;
  fmt: (d: number) => string;
}) {
  if (cur === null || prev === null) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.05) return null;
  return (
    <span className={d < 0 ? "delta-up" : "delta-down"}>
      {d < 0 ? "▼" : "▲"} {fmt(Math.abs(d))}
    </span>
  );
}
