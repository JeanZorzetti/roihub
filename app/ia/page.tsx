import { dbOn } from "@/lib/db";
import { janela, porEmpregado, ultimaSonda, poolDatado } from "@/lib/telemetria-db.mjs";
import { estadoDoEmpregado } from "@/lib/telemetria.mjs";
import { Tabs } from "../tabs";

// specs/002-observabilidade-ia — server component, no padrão de /crm e /busca. Lê só por
// lib/telemetria-db.mjs; nenhuma escrita acontece aqui.
export const dynamic = "force-dynamic";

// `sonda` fica de fora: ela é quem PRODUZ o relógio da lacuna, mostrar seu próprio estado
// aqui duplicaria o banner de lacuna. `nao-declarado` entra: chamador que esqueceu de se
// identificar tem que aparecer, não sumir (FR-006).
const EMPREGADOS = ["autopublish-draft", "autopublish-ymyl", "rerank", "resposta", "juiz", "defasagem", "nao-declarado"];

const ESTADO_LABEL: Record<string, string> = {
  "nao-acionado": "não acionado",
  "sem-falhas": "acionado, sem falhas",
  "com-falhas": "acionado, com falhas",
  "sem-telemetria": "sem telemetria (lacuna)",
};

const ESTADO_PILL: Record<string, string> = {
  "nao-acionado": "pill",
  "sem-falhas": "pill pill-ok",
  "com-falhas": "pill pill-crit",
  "sem-telemetria": "pill pill-warn",
};

const POOL_LABEL: Record<string, string> = {
  viva: "viva",
  "rate-limit": "rate limit (429) — recarrega sozinha",
  desabilitada: "desabilitada (403) — NÃO recarrega",
  auth: "auth (401)",
  outro: "outro",
};

const POOL_PILL: Record<string, string> = {
  viva: "pill pill-ok",
  "rate-limit": "pill pill-warn",
  desabilitada: "pill pill-crit",
  auth: "pill pill-crit",
  outro: "pill",
};

// 36h = 24h + duas vezes o atraso medido do Actions (~97min) — mesma constante de
// lib/telemetria.mjs:estadoDoEmpregado (D7). Duplicada aqui só para o rótulo do banner.
const LACUNA_MS = 36 * 3_600_000;

function fmtData(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

type LinhaEmpregado = {
  empregado: string;
  chamadas: number;
  pedidos: number;
  falhas: Record<string, number>;
  tokens_entrada: number;
  tokens_saida: number;
  p50_ms: number | null;
  p95_ms: number | null;
};

export default async function Page() {
  const on = dbOn();
  const agora = new Date();
  const desde = new Date(agora.getTime() - 24 * 3_600_000);

  let porEmp: LinhaEmpregado[] = [];
  let ultima: string | Date | null = null;
  let pool: { conta: string; estado: string; desde: string | Date; visto: string | Date }[] = [];
  let linhasJanela: { empregado: string; desfecho: string }[] = [];
  let falhaLeitura = false;

  if (on) {
    // FR-007, 2ª metade: banco fora não pode virar 500 — a leitura falhando é a lacuna, não
    // um erro de página. `registrar()` já garante isso do lado da escrita (nunca lança); aqui
    // é o mesmo contrato do lado da leitura.
    try {
      [porEmp, ultima, pool, linhasJanela] = await Promise.all([
        porEmpregado({ desde, ate: agora }),
        ultimaSonda(),
        poolDatado(),
        janela({ desde, ate: agora }),
      ]);
    } catch {
      falhaLeitura = true;
    }
  }

  const lacuna = falhaLeitura || !ultima || agora.getTime() - new Date(ultima).getTime() > LACUNA_MS;
  const totalFalhas = porEmp.reduce((s, r) => s + Object.values(r.falhas).reduce((a, b) => a + b, 0), 0);

  const estados = EMPREGADOS.map((empregado) => ({
    empregado,
    estado: estadoDoEmpregado(linhasJanela.filter((l) => l.empregado === empregado), ultima, agora),
  }));

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="ia" />
        </div>
        <div className="topbar-meta">janela: últimas 24h · prod</div>
      </div>

      {!on && (
        <div className="banner" role="alert">
          Observabilidade de IA sem persistência — configure <code>DATABASE_URL</code> no ambiente e redeploy.
        </div>
      )}

      {on && lacuna && (
        <div className="banner" role="alert">
          ⚠️ Lacuna de telemetria — última sonda {ultima ? `em ${fmtData(ultima)}` : "nunca registrada"}.
          Os números abaixo podem estar incompletos: ausência de linha não é "zero falhas".
        </div>
      )}

      <section className="ag-section card">
        <h2 className="ag-h">Consumo por empregado</h2>
        {!porEmp.length ? (
          <p className="foot">Nenhuma chamada na janela.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>empregado</th>
                <th>chamadas</th>
                <th>pedidos</th>
                <th>tokens in</th>
                <th>tokens out</th>
                <th>p50</th>
                <th>p95</th>
              </tr>
            </thead>
            <tbody>
              {porEmp.map((r) => (
                <tr key={r.empregado}>
                  <td>{r.empregado}</td>
                  <td>{r.chamadas}</td>
                  <td>{r.pedidos}</td>
                  <td>{r.tokens_entrada}</td>
                  <td>{r.tokens_saida}</td>
                  <td>{r.p50_ms == null ? "—" : `${r.p50_ms}ms`}</td>
                  <td>{r.p95_ms == null ? "—" : `${r.p95_ms}ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="ag-section card">
        <h2 className="ag-h">Falhas por código</h2>
        {!totalFalhas ? (
          <p className="foot">Nenhuma falha na janela.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>empregado</th>
                <th>código</th>
                <th>contagem</th>
              </tr>
            </thead>
            <tbody>
              {porEmp.flatMap((r) =>
                Object.entries(r.falhas).map(([codigo, n]) => (
                  <tr key={`${r.empregado}-${codigo}`}>
                    <td>{r.empregado}</td>
                    <td>
                      <span className="pill pill-crit">{codigo}</span>
                    </td>
                    <td>{n}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="ag-section card">
        <h2 className="ag-h">Pool datado</h2>
        {!pool.length ? (
          <p className="foot">Nenhuma leitura do pool ainda — rode scripts/probe-pool.mjs --gravar.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>conta</th>
                <th>estado</th>
                <th>desde</th>
                <th>última confirmação</th>
              </tr>
            </thead>
            <tbody>
              {pool.map((p) => (
                <tr key={p.conta}>
                  <td>{p.conta}</td>
                  <td>
                    <span className={POOL_PILL[p.estado] ?? "pill"}>{POOL_LABEL[p.estado] ?? p.estado}</span>
                  </td>
                  <td>{fmtData(p.desde)}</td>
                  <td>{fmtData(p.visto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="ag-section card">
        <h2 className="ag-h">Estado por empregado</h2>
        <table>
          <thead>
            <tr>
              <th>empregado</th>
              <th>estado</th>
            </tr>
          </thead>
          <tbody>
            {estados.map((e) => (
              <tr key={e.empregado}>
                <td>{e.empregado}</td>
                <td>
                  <span className={ESTADO_PILL[e.estado] ?? "pill"}>{ESTADO_LABEL[e.estado] ?? e.estado}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
