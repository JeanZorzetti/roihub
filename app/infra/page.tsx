import { readdirSync, readFileSync, type Dirent } from "node:fs";
import path from "node:path";
import projects from "@/data/projects.json";
import {
  parseDailyChart,
  parseRatios,
  parseHosts,
  classifyResponses,
  mergeExports,
  bucketCrawlWeeks,
  crawlTotals28,
} from "@/lib/crawl.mjs";
import { Tabs } from "../tabs";
import { WeekChart, Stat, Delta, InvDelta, num, fmtDay } from "../viz";

// Lê os exports do repo a cada request — arquivo novo só aparece depois de commit+push (sem DB).
export const dynamic = "force-dynamic";

type CrawlDay = { date: string; requests: number; bytes: number; ms: number };
type Week = { start: string; end: string; requests: number; ms: number | null };
type Resp = { ok: number; redirect: number; notFound: number; serverError: number; other: number };
type HostRow = { host: string; requests: number; status: string };
type Property = {
  host: string;
  lastExport: string;
  end: string;
  weeks: Week[];
  t: { current: { requests: number; ms: number | null }; previous: { requests: number; ms: number | null } };
  resp: Resp;
  hosts: HostRow[];
  covered: string[];
};

const pct = (r: number) => `${(r * 100).toFixed(1).replace(".", ",")}%`;

// Convenção: descompactar o export do GSC em docs/ (qualquer subpasta) e dar push.
// O nome da pasta já identifica tudo: "{host}-Crawl-stats-{YYYY-MM-DD}".
function findExports(): { host: string; exportDate: string; dir: string }[] {
  const docs = path.join(process.cwd(), "docs");
  let entries: Dirent[];
  try {
    entries = readdirSync(docs, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  const out: { host: string; exportDate: string; dir: string }[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = e.name.match(/^(.+)-Crawl-stats-(\d{4}-\d{2}-\d{2})$/i);
    if (m) out.push({ host: m[1].toLowerCase(), exportDate: m[2], dir: path.join(e.parentPath, e.name) });
  }
  return out;
}

// Arquivos internos têm nome localizado ("Gráfico de resumo…", "Tabela de respostas.csv");
// match por palavra sem acento pra sobreviver a variação de idioma/normalização.
function readCsv(dir: string, pattern: RegExp): string | null {
  try {
    const file = readdirSync(dir).find((f) => pattern.test(f));
    return file ? readFileSync(path.join(dir, file), "utf8") : null;
  } catch {
    return null;
  }
}

function loadProperties(): Property[] {
  const byHost = new Map<string, { host: string; exportDate: string; dir: string }[]>();
  for (const e of findExports()) byHost.set(e.host, [...(byHost.get(e.host) ?? []), e]);

  const props: Property[] = [];
  for (const [host, exps] of byHost) {
    const days: CrawlDay[] = mergeExports(
      exps.map((e) => ({ exportDate: e.exportDate, days: parseDailyChart(readCsv(e.dir, /resumo|chart/i) ?? "") }))
    );
    if (days.length === 0) continue;
    const latest = [...exps].sort((a, b) => a.exportDate.localeCompare(b.exportDate)).at(-1)!;
    const end = days[days.length - 1].date;
    props.push({
      host,
      lastExport: latest.exportDate,
      end,
      weeks: bucketCrawlWeeks(days, end),
      t: crawlTotals28(days, end),
      resp: classifyResponses(parseRatios(readCsv(latest.dir, /respostas|response/i) ?? "")),
      hosts: parseHosts(readCsv(latest.dir, /hosts/i) ?? ""),
      covered: projects
        .filter((p) => {
          const h = new URL(p.url).hostname;
          return h === host || h.endsWith(`.${host}`);
        })
        .map((p) => p.nome),
    });
  }
  return props.sort((a, b) => b.t.current.requests - a.t.current.requests);
}

function statusClass(status: string): string {
  if (/falha/i.test(status)) return "pill pill-crit";
  if (/problema/i.test(status)) return "pill pill-warn";
  return "pill pill-ok";
}

// ponytail: limiares fixos (OK < 85% ou 5xx ≥ 1% = infra ruim); mover pro projects.json se variar por projeto
function respAlert(r: Resp): boolean {
  return r.ok < 0.85 || r.serverError >= 0.01;
}

export default function InfraPage() {
  const props = loadProperties();
  const covered = new Set(props.flatMap((p) => p.covered));
  const uncovered = projects.filter((p) => !covered.has(p.nome));

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="infra" />
        </div>
        <div className="topbar-meta">
          rastreamento do Googlebot · {props.length} propriedade{props.length === 1 ? "" : "s"} · export manual
          semanal
        </div>
      </div>

      {props.length === 0 && (
        <div className="card seo-card">
          <p className="seo-empty">
            Nenhum export de crawl stats encontrado. No Search Console: Configurações → Estatísticas de rastreamento
            → Exportar. Descompacte a pasta (<code>host-Crawl-stats-AAAA-MM-DD</code>) em <code>docs/</code> e dê
            push — o deploy é automático.
          </p>
        </div>
      )}

      <section className="seo-grid">
        {props.map((p) => (
          <article className="seo-card" key={p.host}>
            <div className="seo-head">
              <div>
                <div className="proj-name">{p.host}</div>
                <div className="proj-url">
                  {p.covered.length > 0 ? `cobre: ${p.covered.join(", ")}` : "nenhum projeto do hub"} · dados até{" "}
                  {fmtDay(p.end)}
                </div>
              </div>
              <span className={statusClass(p.hosts[0]?.status ?? "")}>
                {p.hosts[0]?.status || "sem status"}
              </span>
            </div>

            <div className="seo-stats">
              <Stat label="Requisições 28d">
                {num.format(p.t.current.requests)}{" "}
                <Delta cur={p.t.current.requests} prev={p.t.previous.requests} />
              </Stat>
              <Stat label="Resposta média 28d">
                {p.t.current.ms === null ? "—" : `${Math.round(p.t.current.ms)} ms`}{" "}
                <InvDelta cur={p.t.current.ms} prev={p.t.previous.ms} fmt={(d) => `${Math.round(d)} ms`} />
              </Stat>
              <Stat label="Respostas OK">
                <span className={respAlert(p.resp) ? "resp-bad" : ""}>{pct(p.resp.ok)}</span>
              </Stat>
            </div>

            <p className="resp-line">
              OK (2xx/304) {pct(p.resp.ok)} · redirect {pct(p.resp.redirect)} ·{" "}
              <span className={p.resp.notFound > 0.1 ? "resp-bad" : ""}>404 {pct(p.resp.notFound)}</span> ·{" "}
              <span className={p.resp.serverError >= 0.01 ? "resp-bad" : ""}>5xx {pct(p.resp.serverError)}</span> ·
              outros {pct(p.resp.other)}
            </p>

            <div className="seo-charts">
              <WeekChart
                title="Requisições / semana"
                points={p.weeks.map((w) => ({ start: w.start, end: w.end, value: w.requests }))}
                fmt={(v) => `${num.format(v)} requisições`}
              />
              <WeekChart
                title="Resposta média / semana"
                points={p.weeks.map((w) => ({ start: w.start, end: w.end, value: w.ms && Math.round(w.ms) }))}
                fmt={(v) => `${num.format(v)} ms`}
              />
            </div>

            <details className="wk-table">
              <summary>tabela semanal</summary>
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Requisições</th>
                    <th>Resposta (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {p.weeks.map((w) => (
                    <tr key={w.end}>
                      <td>
                        {fmtDay(w.start)}–{fmtDay(w.end)}
                      </td>
                      <td>{num.format(w.requests)}</td>
                      <td>{w.ms === null ? "—" : num.format(Math.round(w.ms))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </article>
        ))}
      </section>

      {props.length > 0 && uncovered.length > 0 && (
        <p className="foot">
          Sem crawl stats (exportar do Search Console): {uncovered.map((p) => p.nome).join(", ")}.
        </p>
      )}
      <p className="foot">
        Fonte: export manual das <b>Estatísticas de rastreamento</b> do Search Console (a API não expõe esses
        dados). Rotina de sexta: Configurações → Estatísticas de rastreamento → Exportar, descompactar em{" "}
        <code>docs/</code> e dar push. Cada export cobre 90 dias e os exports semanais se emendam por data — o
        histórico cresce sem banco. Resposta média ponderada por requisições — <b>cair é melhor</b>. Infra ruim ={" "}
        OK &lt; 85% ou 5xx ≥ 1%.
      </p>
    </main>
  );
}
