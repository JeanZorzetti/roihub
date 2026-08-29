import { Pool } from "pg";
import { validTransition } from "./autopublish-core.mjs";
import { PROJECTS } from "./autopublish-projects.mjs";

// Postgres da agenda (tabelas hub_*). Sem DATABASE_URL → aba mostra estado de setup.

export type Task = {
  id: number;
  titulo: string;
  descricao: string | null;
  projeto: string | null;
  due: string | null; // YYYY-MM-DD
  weekday: number | null; // 0-6 = recorrente semanal (domingo=0); 7 = diária
  tipo: string | null; // null = deriva do título por tipoDe(); valor = override manual
  responsavel: string | null; // null = sem dono, visível para todos; "jean" | "maria"
};

export type PublicationStatus = "running" | "published" | "updated" | "blocked" | "failed" | "reverted";
export type PublicationAction = "new" | "update" | "block";

export type Publication = {
  id: number;
  projectSlug: string;
  runDate: string;
  status: PublicationStatus;
  action: PublicationAction;
  query: string | null;
  intent: string | null;
  targetUrl: string | null;
  repository: string;
  commitSha: string | null;
  previousSha: string | null;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  imageSource: string | null;
  estimatedCostUsd: number;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  finishedAt: string | null;
};

export type ProjectState = {
  projectSlug: string;
  enabled: boolean;
  pausedReason: string | null;
  updatedAt: string;
};

export type BeginPublicationInput = {
  projectSlug: string;
  runDate: string;
  repository: string;
  action?: PublicationAction;
  query?: string | null;
  intent?: string | null;
  targetUrl?: string | null;
  previousSha?: string | null;
  metadata?: Record<string, unknown>;
};

export type FinishPublicationInput = Partial<
  Pick<
    Publication,
    | "action"
    | "query"
    | "intent"
    | "targetUrl"
    | "commitSha"
    | "previousSha"
    | "model"
    | "inputTokens"
    | "outputTokens"
    | "imageSource"
    | "estimatedCostUsd"
    | "reason"
    | "metadata"
  >
>;

type PublicationRow = {
  id: string;
  project_slug: string;
  run_date: Date | string;
  status: PublicationStatus;
  action: PublicationAction;
  query: string | null;
  intent: string | null;
  target_url: string | null;
  repository: string;
  commit_sha: string | null;
  previous_sha: string | null;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  image_source: string | null;
  estimated_cost_usd: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
  finished_at: Date | string | null;
};

type ProjectStateRow = {
  project_slug: string;
  enabled: boolean;
  paused_reason: string | null;
  updated_at: Date | string;
};

const g = globalThis as unknown as { hubPool?: Pool; hubSchema?: Promise<unknown> };

export function dbOn(): boolean {
  return !!process.env.DATABASE_URL;
}

function pool(): Pool {
  if (!g.hubPool) g.hubPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return g.hubPool;
}

function ensure(): Promise<unknown> {
  if (!g.hubSchema)
    g.hubSchema = pool().query(`
      CREATE TABLE IF NOT EXISTS hub_tasks (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        projeto TEXT,
        due DATE,
        weekday INT CHECK (weekday BETWEEN 0 AND 7),
        criado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS hub_done (
        key TEXT NOT NULL,
        occurrence DATE NOT NULL,
        done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (key, occurrence)
      );
      ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS descricao TEXT;
      -- weekday=7 (diária) em tabela criada com o CHECK antigo 0-6: troca idempotente
      ALTER TABLE hub_tasks DROP CONSTRAINT IF EXISTS hub_tasks_weekday_check;
      ALTER TABLE hub_tasks ADD CONSTRAINT hub_tasks_weekday_check CHECK (weekday BETWEEN 0 AND 7);
      -- NULL = a agenda deriva o balde do título (lib/agenda.mjs tipoDe). Preenchido só
      -- quando a heurística erra. Sem CHECK de propósito: a lista de tipos vive no .mjs,
      -- e duplicá-la aqui daria uma migração a cada rótulo novo — a validação é na action.
      ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS tipo TEXT;
      -- NULL = sem dono, tarefa visível pros dois. Mesma lógica de tipo: a lista de
      -- responsáveis vive no .mjs, sem CHECK aqui — validação é na action.
      ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS responsavel TEXT;
      CREATE TABLE IF NOT EXISTS seo_publications (
        id BIGSERIAL PRIMARY KEY,
        project_slug TEXT NOT NULL,
        run_date DATE NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running','published','updated','blocked','failed','reverted')),
        action TEXT NOT NULL CHECK (action IN ('new','update','block')),
        query TEXT,
        intent TEXT,
        target_url TEXT,
        repository TEXT NOT NULL,
        commit_sha TEXT,
        previous_sha TEXT,
        model TEXT,
        input_tokens INT NOT NULL DEFAULT 0,
        output_tokens INT NOT NULL DEFAULT 0,
        image_source TEXT,
        estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
        reason TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        UNIQUE (project_slug, run_date)
      );
      CREATE TABLE IF NOT EXISTS seo_projects (
        project_slug TEXT PRIMARY KEY,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        paused_reason TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS crm_leads (
        id BIGSERIAL PRIMARY KEY,
        external_id TEXT UNIQUE,
        pipeline TEXT NOT NULL,
        etapa TEXT NOT NULL,
        nome TEXT NOT NULL,
        email TEXT,
        telefone TEXT,
        origem TEXT NOT NULL,
        valor NUMERIC(12,2),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        criado TIMESTAMPTZ NOT NULL DEFAULT now(),
        atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS crm_eventos (
        id BIGSERIAL PRIMARY KEY,
        lead_id BIGINT NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
        de TEXT, para TEXT NOT NULL, nota TEXT,
        quando TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      -- Uma linha por corrida noturna. run_date é PK de propósito: o Actions pode repetir o
      -- dia, e sobrescrever é o certo — o diff sempre compara com o DIA ANTERIOR, nunca com
      -- a linha que a própria corrida acabou de gravar.
      CREATE TABLE IF NOT EXISTS hub_estado (
        run_date DATE PRIMARY KEY,
        mapa JSONB NOT NULL,
        criado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO seo_projects (project_slug, enabled, paused_reason)
      VALUES
        ('*', FALSE, 'Aguardando canários'),
        ${PROJECTS.map(({ slug }) => `('${slug}', FALSE, 'Aguardando ativação')`).join(",\n        ")}
      ON CONFLICT (project_slug) DO NOTHING;
    `);
  return g.hubSchema;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function publication(row: PublicationRow): Publication {
  return {
    id: Number(row.id),
    projectSlug: row.project_slug,
    runDate: iso(row.run_date).slice(0, 10),
    status: row.status,
    action: row.action,
    query: row.query,
    intent: row.intent,
    targetUrl: row.target_url,
    repository: row.repository,
    commitSha: row.commit_sha,
    previousSha: row.previous_sha,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    imageSource: row.image_source,
    estimatedCostUsd: Number(row.estimated_cost_usd),
    reason: row.reason,
    metadata: row.metadata,
    createdAt: iso(row.created_at),
    finishedAt: row.finished_at ? iso(row.finished_at) : null,
  };
}

async function publicationByRun(projectSlug: string, runDate: string): Promise<Publication | null> {
  const result = await pool().query<PublicationRow>(
    `SELECT * FROM seo_publications WHERE project_slug = $1 AND run_date = $2`,
    [projectSlug, runDate]
  );
  return result.rows[0] ? publication(result.rows[0]) : null;
}

export async function beginPublication(
  input: BeginPublicationInput
): Promise<{ publication: Publication; created: boolean }> {
  await ensure();
  const result = await pool().query<PublicationRow>(
    `INSERT INTO seo_publications
       (project_slug, run_date, status, action, query, intent, target_url, repository, previous_sha, metadata)
     VALUES ($1, $2, 'running', $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      input.projectSlug,
      input.runDate,
      input.action ?? "block",
      input.query ?? null,
      input.intent ?? null,
      input.targetUrl ?? null,
      input.repository,
      input.previousSha ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
  if (result.rows[0]) return { publication: publication(result.rows[0]), created: true };
  const existing = await publicationByRun(input.projectSlug, input.runDate);
  if (!existing) throw new Error("publication-conflict-without-row");
  return { publication: existing, created: false };
}

export async function getPublication(id: number): Promise<Publication | null> {
  await ensure();
  const result = await pool().query<PublicationRow>(`SELECT * FROM seo_publications WHERE id = $1`, [id]);
  return result.rows[0] ? publication(result.rows[0]) : null;
}

export async function listPublications(limit = 50): Promise<Publication[]> {
  await ensure();
  const safeLimit = Math.min(200, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 50));
  const result = await pool().query<PublicationRow>(
    `SELECT * FROM seo_publications ORDER BY created_at DESC, id DESC LIMIT $1`,
    [safeLimit]
  );
  return result.rows.map(publication);
}

export async function finishPublication(
  id: number,
  status: Exclude<PublicationStatus, "running">,
  updates: FinishPublicationInput = {}
): Promise<Publication> {
  await ensure();
  const current = await getPublication(id);
  if (!current || !validTransition(current.status, status)) throw new Error("invalid-publication-transition");
  const value = <K extends keyof FinishPublicationInput>(key: K): FinishPublicationInput[K] =>
    updates[key] === undefined ? current[key] : updates[key];
  const result = await pool().query<PublicationRow>(
    `UPDATE seo_publications SET
       status = $2,
       action = $3,
       query = $4,
       intent = $5,
       target_url = $6,
       commit_sha = $7,
       previous_sha = $8,
       model = $9,
       input_tokens = $10,
       output_tokens = $11,
       image_source = $12,
       estimated_cost_usd = $13,
       reason = $14,
       metadata = metadata || $15::jsonb,
       finished_at = now()
     WHERE id = $1 AND status = $16
     RETURNING *`,
    [
      id,
      status,
      value("action"),
      value("query"),
      value("intent"),
      value("targetUrl"),
      value("commitSha"),
      value("previousSha"),
      value("model"),
      value("inputTokens"),
      value("outputTokens"),
      value("imageSource"),
      value("estimatedCostUsd"),
      value("reason"),
      JSON.stringify(updates.metadata ?? {}),
      current.status,
    ]
  );
  if (!result.rows[0]) throw new Error("publication-transition-race");
  return publication(result.rows[0]);
}

export async function updatePublicationMetadata(
  id: number,
  verification: Record<string, unknown>
): Promise<Publication> {
  await ensure();
  const result = await pool().query<PublicationRow>(
    `UPDATE seo_publications SET metadata = metadata || $2::jsonb WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(verification)]
  );
  if (!result.rows[0]) throw new Error("publication-not-found");
  return publication(result.rows[0]);
}

export async function projectEnabled(slug: string): Promise<boolean> {
  await ensure();
  const result = await pool().query<{ enabled: boolean }>(
    `SELECT enabled FROM seo_projects WHERE project_slug = $1`,
    [slug]
  );
  return result.rows[0]?.enabled === true;
}

export async function listProjectStates(): Promise<ProjectState[]> {
  await ensure();
  const result = await pool().query<ProjectStateRow>(
    `SELECT project_slug, enabled, paused_reason, updated_at
     FROM seo_projects
     ORDER BY CASE WHEN project_slug = '*' THEN 0 ELSE 1 END, project_slug`
  );
  return result.rows.map((row) => ({
    projectSlug: row.project_slug,
    enabled: row.enabled,
    pausedReason: row.paused_reason,
    updatedAt: iso(row.updated_at),
  }));
}

export async function setProjectEnabled(slug: string, enabled: boolean, reason: string | null): Promise<void> {
  await ensure();
  const result = await pool().query(
    `UPDATE seo_projects
     SET enabled = $2, paused_reason = $3, updated_at = now()
     WHERE project_slug = $1`,
    [slug, enabled, reason]
  );
  if (!result.rowCount) throw new Error("project-not-found");
}

// ===== CRM (tabelas crm_*) =====

export type Lead = {
  id: number;
  externalId: string | null;
  pipeline: string;
  etapa: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  valor: number | null;
  metadata: Record<string, unknown>;
  criado: string;
  atualizado: string;
  /** Quando o lead entrou na etapa atual — responde "está em proposta há quanto tempo?". */
  desde: string;
};

type LeadRow = {
  id: string;
  external_id: string | null;
  pipeline: string;
  etapa: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  valor: string | null;
  metadata: Record<string, unknown>;
  criado: Date | string;
  atualizado: Date | string;
  desde: Date | string;
};

function lead(row: LeadRow): Lead {
  return {
    id: Number(row.id),
    externalId: row.external_id,
    pipeline: row.pipeline,
    etapa: row.etapa,
    nome: row.nome,
    email: row.email,
    telefone: row.telefone,
    origem: row.origem,
    valor: row.valor === null ? null : Number(row.valor),
    metadata: row.metadata,
    criado: iso(row.criado),
    atualizado: iso(row.atualizado),
    desde: iso(row.desde),
  };
}

export type NewLead = {
  externalId: string;
  pipeline: string;
  etapa: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  valor: number | null;
  metadata: Record<string, unknown>;
};

/** `created: false` = reenvio do mesmo external_id. Não duplica e não sobrescreve. */
export async function insertLead(input: NewLead): Promise<{ id: number | null; created: boolean }> {
  await ensure();
  const r = await pool().query<{ id: string }>(
    `INSERT INTO crm_leads (external_id, pipeline, etapa, nome, email, telefone, origem, valor, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (external_id) DO NOTHING
     RETURNING id`,
    [
      input.externalId,
      input.pipeline,
      input.etapa,
      input.nome,
      input.email,
      input.telefone,
      input.origem,
      input.valor,
      JSON.stringify(input.metadata),
    ]
  );
  if (!r.rows[0]) return { id: null, created: false };
  const id = Number(r.rows[0].id);
  await pool().query(`INSERT INTO crm_eventos (lead_id, de, para, nota) VALUES ($1, NULL, $2, $3)`, [
    id,
    input.etapa,
    `entrada via ${input.origem}`,
  ]);
  return { id, created: true };
}

/** ponytail: busca tudo — 1 usuário, e um CRM que precise de paginação já pede kanban. */
export async function listLeads(): Promise<Lead[]> {
  await ensure();
  const r = await pool().query<LeadRow>(
    `SELECT l.*, COALESCE(
       (SELECT max(e.quando) FROM crm_eventos e WHERE e.lead_id = l.id AND e.para = l.etapa),
       l.criado
     ) AS desde
     FROM crm_leads l
     ORDER BY l.atualizado DESC, l.id DESC`
  );
  return r.rows.map(lead);
}

/** Move de etapa e grava o evento. Sem evento, "há quanto tempo?" não tem resposta. */
export async function moveLead(id: number, etapa: string, nota: string | null): Promise<void> {
  await ensure();
  // Duas queries porque o Postgres não dá o valor ANTIGO no RETURNING (só a
  // partir do PG18), e o `de` do evento é justamente esse valor.
  const atual = await pool().query<{ etapa: string }>(`SELECT etapa FROM crm_leads WHERE id = $1`, [id]);
  const de = atual.rows[0]?.etapa;
  if (de === undefined || de === etapa) return; // id inexistente, ou já está lá
  await pool().query(`UPDATE crm_leads SET etapa = $2, atualizado = now() WHERE id = $1`, [id, etapa]);
  await pool().query(`INSERT INTO crm_eventos (lead_id, de, para, nota) VALUES ($1, $2, $3, $4)`, [
    id,
    de,
    etapa,
    nota,
  ]);
}

export async function listTasks(): Promise<Task[]> {
  await ensure();
  const r = await pool().query(
    `SELECT id, titulo, descricao, projeto, to_char(due, 'YYYY-MM-DD') AS due, weekday, tipo, responsavel
     FROM hub_tasks ORDER BY due NULLS LAST, id`
  );
  return r.rows;
}

/**
 * Dias que um check de AÇÃO DO RANKING vale antes de voltar a pendente.
 *
 * A chave da ação carrega o hash do texto (`acao:<slug>:<hash8>`), então o único reset
 * previsto era "alguém reescreveu a ação no projects.json" — e sem reescrita o check
 * valia para sempre. Medido em 29/08: isso escondia os 18 PRIMEIROS do ranking inteiro
 * dentro do "Feitas" recolhido, o foco do dia (#1 Atma, score 72) junto, por checks de
 * 11 a 17/08. Ação não tem data própria; sem prazo o hub esquece o topo do próprio
 * ranking. 10 dias é a mesma régua de "velho" de decayFromHealth (lib/score.mjs) e do
 * /insights. Tarefa do banco NÃO expira: ela tem data e só some quando é apagada.
 */
export const ACAO_DONE_DIAS = 10;

/** Set de "key@occurrence" feitos. ponytail: busca tudo — 1 usuário, tabela minúscula. */
export async function listDone(): Promise<Set<string>> {
  await ensure();
  const r = await pool().query(
    `SELECT key, to_char(occurrence, 'YYYY-MM-DD') AS occurrence FROM hub_done
     WHERE key NOT LIKE 'acao:%' OR done_at > now() - ($1 || ' days')::interval`,
    [ACAO_DONE_DIAS]
  );
  return new Set(r.rows.map((x: { key: string; occurrence: string }) => `${x.key}@${x.occurrence}`));
}

export async function insertTask(t: Omit<Task, "id">): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_tasks (titulo, descricao, projeto, due, weekday, tipo, responsavel) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [t.titulo, t.descricao, t.projeto, t.due, t.weekday, t.tipo, t.responsavel]
  );
}

export async function updateTask(id: number, t: Omit<Task, "id">): Promise<void> {
  await ensure();
  await pool().query(
    `UPDATE hub_tasks SET titulo = $2, descricao = $3, projeto = $4, due = $5, weekday = $6, tipo = $7, responsavel = $8 WHERE id = $1`,
    [id, t.titulo, t.descricao, t.projeto, t.due, t.weekday, t.tipo, t.responsavel]
  );
}

export async function setDone(key: string, occurrence: string, done: boolean): Promise<void> {
  await ensure();
  // DO UPDATE, não DO NOTHING: a linha da ação expirada continua na tabela, e sem
  // renovar done_at o card voltava a pendente e não aceitava mais ser marcado.
  if (done)
    await pool().query(
      `INSERT INTO hub_done (key, occurrence) VALUES ($1, $2)
       ON CONFLICT (key, occurrence) DO UPDATE SET done_at = now()`,
      [key, occurrence]
    );
  else await pool().query(`DELETE FROM hub_done WHERE key = $1 AND occurrence = $2`, [key, occurrence]);
}

export async function removeTask(id: number): Promise<void> {
  await ensure();
  await pool().query(`DELETE FROM hub_done WHERE key = $1`, [`task:${id}`]);
  await pool().query(`DELETE FROM hub_tasks WHERE id = $1`, [id]);
}

/**
 * Mapa da última corrida ANTERIOR a `runDate` — nunca a do próprio dia. Rodar duas vezes no
 * mesmo dia tem que dar o mesmo diff; comparar com a linha de hoje daria "zero mudança" na
 * segunda corrida e esconderia o achado da primeira.
 */
export async function estadoAnterior(runDate: string): Promise<Record<string, string> | null> {
  await ensure();
  const r = await pool().query(
    `SELECT mapa FROM hub_estado WHERE run_date < $1 ORDER BY run_date DESC LIMIT 1`,
    [runDate]
  );
  return r.rows[0]?.mapa ?? null;
}

/**
 * A linha mais recente — é contra ELA que o diff de amanhã roda. Só leitura, para a aba
 * /automacao mostrar o que a corrida noturna deixou gravado; `estadoAnterior` continua sendo
 * quem a corrida usa, e ele exclui o próprio dia de propósito.
 */
export async function estadoUltimo(): Promise<{ runDate: string; mapa: Record<string, string>; criado: Date } | null> {
  await ensure();
  const r = await pool().query(
    `SELECT to_char(run_date, 'YYYY-MM-DD') AS "runDate", mapa, criado FROM hub_estado ORDER BY run_date DESC LIMIT 1`
  );
  return r.rows[0] ?? null;
}

export async function gravarEstado(runDate: string, mapa: Record<string, string>): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_estado (run_date, mapa) VALUES ($1, $2)
     ON CONFLICT (run_date) DO UPDATE SET mapa = EXCLUDED.mapa, criado = now()`,
    [runDate, JSON.stringify(mapa)]
  );
}
