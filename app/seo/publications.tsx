import projects from "@/data/projects.json";
import { PROJECTS } from "@/lib/autopublish-projects.mjs";
import type { ProjectState, Publication } from "@/lib/db";
import { updatePublishingState } from "./actions";

// Os controles seguem PROJECTS, não a lista da agenda: elas divergem. Quando o tapepro
// entrou e o nimblabs saiu, a UI mostrou um projeto inexistente e escondeu um que estava
// ativo — sem controle de pausa para ele. projects.json entra só pelo nome amigável.
const PROJECT_NAMES = new Map(projects.map((project) => [project.slug, project.nome]));
const PUBLISHING_PROJECTS = PROJECTS.map(({ slug }: { slug: string }) => ({
  slug,
  nome: PROJECT_NAMES.get(slug) ?? slug,
}));
const USD = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" });
const ACTIONS = { new: "Nova página", update: "Atualização", block: "Bloqueio" };
const STATUSES = {
  running: "Em execução",
  published: "Publicado",
  updated: "Atualizado",
  blocked: "Bloqueado",
  failed: "Falhou",
  reverted: "Revertido",
};

function externalUrl(value: string | null): string | null {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function commitUrl(publication: Publication): string | null {
  return /^[\w.-]+\/[\w.-]+$/.test(publication.repository) && /^[a-f0-9]{7,64}$/i.test(publication.commitSha ?? "")
    ? `https://github.com/${publication.repository}/commit/${publication.commitSha}`
    : null;
}

function formatCost(value: unknown): string {
  const cost = Number(value);
  return Number.isFinite(cost) ? USD.format(cost) : "—";
}

function Control({
  slug,
  name,
  state,
  databaseOn,
  global = false,
}: {
  slug: string;
  name: string;
  state?: ProjectState;
  databaseOn: boolean;
  global?: boolean;
}) {
  const enabled = state?.enabled === true;
  const action = enabled ? "Pausar" : "Ativar";
  return (
    <form action={updatePublishingState} className="pub-control">
      <span>
        <strong className={global ? "brand" : undefined}>{name}</strong>{" "}
        <span className={`pill ${enabled ? "pill-ok" : "pill-crit"}`}>{enabled ? "ATIVO" : "PAUSADO"}</span>
        {state?.pausedReason && <span className="proj-url"> · {state.pausedReason}</span>}
      </span>
      <span className="ag-meta">
        <label>
          Motivo para {name}
          <input
            className="ag-in"
            name="reason"
            defaultValue={state?.pausedReason ?? ""}
            maxLength={300}
            disabled={!databaseOn}
          />
        </label>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="enabled" value={String(!enabled)} />
        <button
          className="ag-btn"
          type="submit"
          disabled={!databaseOn}
          aria-label={`${action} ${global ? "publicação global" : name}`}
        >
          {action}
        </button>
      </span>
    </form>
  );
}

export function Publications({
  publications,
  states,
  databaseOn,
}: {
  publications: Publication[];
  states: ProjectState[];
  databaseOn: boolean;
}) {
  const bySlug = new Map(states.map((state) => [state.projectSlug, state]));

  return (
    <section aria-labelledby="publishing-title">
      {!databaseOn && (
        <div className="banner" role="alert">
          Banco desativado. Defina <code>DATABASE_URL</code> no ambiente do ROI Hub e reinicie o deploy para carregar
          controles e histórico.
        </div>
      )}

      <div className="card ag-section">
        <h2 id="publishing-title" className="ag-h">
          Sala de controle editorial
        </h2>
        <div className="pub-controls">
          <Control
            slug="*"
            name="Kill switch global"
            state={bySlug.get("*")}
            databaseOn={databaseOn}
            global
          />
          {PUBLISHING_PROJECTS.map((project) => (
            <Control
              key={project.slug}
              slug={project.slug}
              name={project.nome}
              state={bySlug.get(project.slug)}
              databaseOn={databaseOn}
            />
          ))}
        </div>
      </div>

      <details className="card table-details" open>
        <summary>Histórico de publicação ({publications.length})</summary>
        {publications.length === 0 ? (
          <p className="seo-empty">Nenhuma execução registrada.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Projeto</th>
                <th>Data</th>
                <th>Ação</th>
                <th>Status</th>
                <th>Query</th>
                <th>Destino</th>
                <th>Commit</th>
                <th>Custo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {publications.map((publication) => {
                const target = externalUrl(publication.targetUrl);
                const commit = commitUrl(publication);
                return (
                  <tr key={publication.id}>
                    <td className="proj-name">{PROJECT_NAMES.get(publication.projectSlug) ?? publication.projectSlug}</td>
                    <td>{publication.runDate || "—"}</td>
                    <td>{ACTIONS[publication.action] ?? publication.action}</td>
                    <td>
                      <span className={`pub-status ${publication.status}`}>
                        {STATUSES[publication.status] ?? publication.status}
                      </span>
                    </td>
                    <td>{publication.query || "Sem query"}</td>
                    <td>
                      {target ? (
                        <a href={target} target="_blank" rel="noreferrer">
                          Abrir
                        </a>
                      ) : (
                        "Sem URL"
                      )}
                    </td>
                    <td>
                      {commit ? (
                        <a href={commit} target="_blank" rel="noreferrer">
                          {publication.commitSha?.slice(0, 7)}
                        </a>
                      ) : (
                        "Sem commit"
                      )}
                    </td>
                    <td>{formatCost(publication.estimatedCostUsd)}</td>
                    <td>{publication.reason || "Sem motivo"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </details>
    </section>
  );
}
