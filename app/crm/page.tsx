import pipelines from "@/data/pipelines.json";
import { dbOn, listLeads, type Lead } from "@/lib/db";
import { etapasDe } from "@/lib/crm.mjs";
import { Tabs } from "../tabs";
import { mover } from "./actions";

export const dynamic = "force-dynamic";

const nomeDe = (slug: string) => pipelines.find((p) => p.slug === slug)?.nome ?? slug;

/** Dias inteiros desde `iso`. É a única pergunta que um CRM responde melhor que planilha. */
function dias(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function Linha({ lead }: { lead: Lead }) {
  const etapas = etapasDe(pipelines, lead.pipeline);
  const parado = dias(lead.desde);
  const contato = [lead.email, lead.telefone].filter(Boolean).join(" · ");

  return (
    <tr>
      <td>
        <strong>{lead.nome}</strong>
        {contato && <div className="foot">{contato}</div>}
      </td>
      <td>
        <span className="pill">{lead.origem}</span>
      </td>
      <td>
        <form action={mover} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input type="hidden" name="id" value={lead.id} />
          <input type="hidden" name="pipeline" value={lead.pipeline} />
          <select name="etapa" defaultValue={lead.etapa} className="ag-in" aria-label={`Etapa de ${lead.nome}`}>
            {etapas.map((e: string) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <input name="nota" placeholder="nota…" maxLength={300} className="ag-in" />
          <button className="ag-btn">mover</button>
        </form>
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {parado === 0 ? "hoje" : `há ${parado}d`}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {lead.valor === null ? "—" : lead.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </td>
    </tr>
  );
}

export default async function Page() {
  const on = dbOn();
  const leads = on ? await listLeads() : [];

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="crm" />
        </div>
        <div className="topbar-meta">{leads.length} leads</div>
      </div>

      {!on && (
        <div className="banner" role="alert">
          CRM sem persistência — configure <code>DATABASE_URL</code> (Postgres) no ambiente e redeploy.
        </div>
      )}

      {pipelines.map((p) => {
        const doPipeline = leads.filter((l) => l.pipeline === p.slug);
        return (
          <section key={p.slug} className="ag-section card">
            <h2 className="ag-h">
              {nomeDe(p.slug)} · {doPipeline.length}
            </h2>
            {doPipeline.length === 0 ? (
              <p className="foot">Nenhum lead. A Orion grava aqui via POST /api/crm/leads.</p>
            ) : (
              p.etapas.map((etapa) => {
                const daEtapa = doPipeline.filter((l) => l.etapa === etapa);
                if (!daEtapa.length) return null;
                return (
                  <details key={etapa} className="wk-table" open={etapa !== "ganho" && etapa !== "perdido"}>
                    <summary>
                      {etapa} ({daEtapa.length})
                    </summary>
                    <table>
                      <thead>
                        <tr>
                          <th>lead</th>
                          <th>origem</th>
                          <th>etapa</th>
                          <th>parado</th>
                          <th>valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daEtapa.map((l) => (
                          <Linha key={l.id} lead={l} />
                        ))}
                      </tbody>
                    </table>
                  </details>
                );
              })
            )}
          </section>
        );
      })}
    </main>
  );
}
