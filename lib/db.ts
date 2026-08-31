import { Pool } from "pg";
import { validTransition } from "./autopublish-core.mjs";
import { PROJECTS } from "./autopublish-projects.mjs";
import { COLUNAS_INICIAIS } from "./pauta.mjs";

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
  gerador?: string | null; // null = digitada à mão; valor = robô que a criou ("estado")
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
      -- Quem criou a linha. NULL = humano digitou. Existe para o robô poder recolher o que
      -- ele mesmo despejou (dropPendentesGeradas) sem casar por TÍTULO: o texto do card é
      -- rótulo de exibição, e rótulo nunca é chave — "Estado 2026-08-29: …" digitado à mão
      -- viraria alvo de DELETE. Backfill abaixo adota, UMA vez, os cards noturnos que já
      -- estavam na tabela antes da coluna existir. Classe [0-9] e não a abreviação \d de
      -- sempre: isto aqui é um template literal do JS, onde \d colapsa para d e o UPDATE
      -- casaria zero linhas sem erro nenhum.
      ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS gerador TEXT;
      UPDATE hub_tasks SET gerador = 'estado'
        WHERE gerador IS NULL AND titulo ~ '^Estado [0-9]{4}-[0-9]{2}-[0-9]{2}: ';
      -- Dono da AÇÃO DO RANKING. Tabela própria, e não uma coluna em hub_tasks: aquela coluna
      -- é dono de tarefa do banco, e a agenda não renderiza mais hub_tasks desde 31/08 —
      -- reaproveitá-la exigiria criar uma tarefa por ação, que é o caminho 'promote' removido
      -- naquela mesma refatoração. A chave é a do check (acao:<slug>:<hash8>), então
      -- reescrever a ação no projects.json zera o dono: ação nova é decisão nova de alocação,
      -- e a aba passa a ter UMA regra de identidade em vez de duas.
      -- responsavel NOT NULL de propósito: "sem dono" é a AUSÊNCIA de linha, nunca uma linha
      -- com NULL. Desatribuir é DELETE — um estado, uma representação.
      -- Sem CHECK, pela mesma razão já escrita para hub_tasks.responsavel: a lista de
      -- responsáveis vive em lib/agenda.mjs e duplicá-la aqui daria migração a cada rótulo
      -- novo. A validação é na server action, contra RESPONSAVEL_IDS.
      -- (Sem crase nestes comentários: isto é um template literal do JS, e uma crase aqui
      -- FECHA a string — o parser reclama de sintaxe TS a 100 linhas de distância.)
      CREATE TABLE IF NOT EXISTS hub_acao_dono (
        key TEXT PRIMARY KEY,
        responsavel TEXT NOT NULL,
        atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
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
      -- Quadros de Marketing e Ideias. Nada aqui atravessa para hub_tasks ou para o ranking:
      -- o isolamento é o requisito central da feature, não um efeito colateral do desenho.
      -- Coluna é TABELA e não enum no .mjs (ao contrário de tipo/canal): FR-012 exige que o
      -- usuário mude o fluxo sem publicar versão nova, e enum em código pediria deploy a cada
      -- ajuste — exatamente o atrito que o quadro existe para eliminar.
      CREATE TABLE IF NOT EXISTS hub_pauta_coluna (
        id SERIAL PRIMARY KEY,
        quadro TEXT NOT NULL,
        nome TEXT NOT NULL,
        icone TEXT,
        ordem INT NOT NULL DEFAULT 0,
        criado TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (quadro, nome)
      );
      CREATE TABLE IF NOT EXISTS hub_pauta (
        id SERIAL PRIMARY KEY,
        quadro TEXT NOT NULL,
        coluna_id INT REFERENCES hub_pauta_coluna(id),
        tipo TEXT NOT NULL DEFAULT 'card',
        titulo TEXT NOT NULL,
        descricao TEXT,
        projeto TEXT,
        responsavel TEXT,
        canal TEXT,
        data DATE,
        url TEXT,
        arquivado_em TIMESTAMPTZ,
        criado TIMESTAMPTZ NOT NULL DEFAULT now(),
        atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS hub_pauta_quadro ON hub_pauta (quadro, coluna_id);
      -- bytes é anulável POR DESENHO: é o que a retenção esvazia. A linha fica para sempre
      -- (nome, formato, tamanho e ordem), só o conteúdo visual é temporário.
      CREATE TABLE IF NOT EXISTS hub_pauta_anexo (
        id SERIAL PRIMARY KEY,
        pauta_id INT NOT NULL REFERENCES hub_pauta(id) ON DELETE CASCADE,
        ordem INT NOT NULL DEFAULT 0,
        nome TEXT NOT NULL,
        mime TEXT NOT NULL,
        tamanho INT NOT NULL,
        bytes BYTEA,
        liberado_em TIMESTAMPTZ,
        criado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      -- Índice PARCIAL: só a linha que ainda tem bytes interessa à varredura. Liberada, ela
      -- sai do índice — então o índice encolhe com o tempo em vez de crescer com o histórico.
      CREATE INDEX IF NOT EXISTS hub_pauta_anexo_vivo
        ON hub_pauta_anexo (pauta_id) WHERE bytes IS NOT NULL;
      -- Semeadura idempotente (FR-016): quadro utilizável no primeiro acesso, sem sobrescrever
      -- o que o usuário já renomeou ou reordenou.
      INSERT INTO hub_pauta_coluna (quadro, nome, icone, ordem)
      VALUES
        ${Object.entries(COLUNAS_INICIAIS)
          .flatMap(([quadro, cols]) =>
            (cols as { nome: string; icone: string; ordem: number }[]).map(
              (c) => `('${quadro}', '${c.nome}', '${c.icone}', ${c.ordem})`
            )
          )
          .join(",\n        ")}
      ON CONFLICT (quadro, nome) DO NOTHING;
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

/**
 * Mapa "key da ação" → responsável. ponytail: busca tudo, igual `listDone` — 35 projetos.
 *
 * Sem corte por validade de propósito: `ACAO_DONE_DIAS` existe para o CHECK não sumir com o
 * topo do ranking, e dono que expirasse só produziria ação sem ninguém — que é exatamente o
 * estado que esta tabela existe para eliminar.
 */
export async function listDonos(): Promise<Map<string, string>> {
  await ensure();
  const r = await pool().query(`SELECT key, responsavel FROM hub_acao_dono`);
  return new Map(r.rows.map((x: { key: string; responsavel: string }) => [x.key, x.responsavel]));
}

/** `null` desatribui: a ausência de dono é a ausência de linha, não uma linha com NULL. */
export async function setDono(key: string, responsavel: string | null): Promise<void> {
  await ensure();
  if (responsavel === null) {
    await pool().query(`DELETE FROM hub_acao_dono WHERE key = $1`, [key]);
    return;
  }
  await pool().query(
    `INSERT INTO hub_acao_dono (key, responsavel) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET responsavel = $2, atualizado = now()`,
    [key, responsavel]
  );
}

export async function insertTask(t: Omit<Task, "id">): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_tasks (titulo, descricao, projeto, due, weekday, tipo, responsavel, gerador)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [t.titulo, t.descricao, t.projeto, t.due, t.weekday, t.tipo, t.responsavel, t.gerador ?? null]
  );
}

/**
 * Apaga as tarefas PENDENTES de um gerador — o robô recolhe o card de ontem antes de pôr o
 * de hoje. Medido em 29/08: o card noturno entrava um por dia, sem projeto e com data já
 * vencida, e 14 deles se empilharam desde 12/08 no balde Conferência, todos por conferir.
 * Card de diff é notícia do dia: 14 avisos não lidos não são 14 avisos, são zero.
 *
 * Pendente só: card já marcado fica onde está, senão a corrida da noite apagaria o histórico
 * de "Feitas". O mapa de estado vive em `hub_estado` — nada do que foi apurado se perde aqui.
 */
export async function dropPendentesGeradas(gerador: string): Promise<void> {
  await ensure();
  await pool().query(
    `DELETE FROM hub_tasks t
      WHERE t.gerador = $1
        AND NOT EXISTS (SELECT 1 FROM hub_done d WHERE d.key = 'task:' || t.id)`,
    [gerador]
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

// ── Quadros de Marketing e Ideias (hub_pauta*) ──────────────────────────────
// Nenhuma função aqui escreve em hub_tasks, seo_* ou crm_*. FR-009/FR-010 são verificáveis
// por leitura: se aparecer um insertTask nesta seção, a entrega está errada.

export type PautaColuna = {
  id: number;
  quadro: string;
  nome: string;
  icone: string | null;
  ordem: number;
};

export type PautaCard = {
  id: number;
  quadro: string;
  coluna_id: number | null;
  tipo: string; // "card" | "doc"
  titulo: string;
  descricao: string | null;
  projeto: string | null;
  responsavel: string | null;
  canal: string | null;
  data: string | null; // YYYY-MM-DD
  url: string | null;
  arquivado_em: string | null;
};

/** Sem `bytes`: a lista é para a tela e para o contador de espaço, não para servir imagem. */
export type PautaAnexo = {
  id: number;
  pauta_id: number;
  ordem: number;
  nome: string;
  mime: string;
  tamanho: number;
  liberado_em: string | null;
};

export type NovoPautaCard = Omit<PautaCard, "id" | "arquivado_em">;

export async function listColunas(quadro: string): Promise<PautaColuna[]> {
  await ensure();
  const r = await pool().query(
    `SELECT id, quadro, nome, icone, ordem FROM hub_pauta_coluna
     WHERE quadro = $1 ORDER BY ordem, id`,
    [quadro]
  );
  return r.rows;
}

/** Busca o quadro inteiro. ponytail: 2 usuários e dezenas de cards — paginar seria adivinhar. */
export async function listCards(quadro: string): Promise<PautaCard[]> {
  await ensure();
  const r = await pool().query(
    `SELECT id, quadro, coluna_id, tipo, titulo, descricao, projeto, responsavel, canal,
            to_char(data, 'YYYY-MM-DD') AS data, url, arquivado_em
     FROM hub_pauta WHERE quadro = $1 ORDER BY coluna_id, id`,
    [quadro]
  );
  return r.rows;
}

export async function listAnexos(pautaIds: number[]): Promise<PautaAnexo[]> {
  await ensure();
  if (!pautaIds.length) return [];
  const r = await pool().query(
    `SELECT id, pauta_id, ordem, nome, mime, tamanho, liberado_em FROM hub_pauta_anexo
     WHERE pauta_id = ANY($1::int[]) ORDER BY pauta_id, ordem, id`,
    [pautaIds]
  );
  return r.rows;
}

/** Contador permanente de espaço da aba (FR-036) — a soma sai do banco, não de um map em memória. */
export async function resumoAnexos(): Promise<{ ativos: number; bytes: number; liberados: number }> {
  await ensure();
  const r = await pool().query(
    `SELECT COUNT(*) FILTER (WHERE bytes IS NOT NULL) AS ativos,
            COALESCE(SUM(tamanho) FILTER (WHERE bytes IS NOT NULL), 0) AS bytes,
            COUNT(*) FILTER (WHERE bytes IS NULL) AS liberados
     FROM hub_pauta_anexo`
  );
  const row = r.rows[0] ?? {};
  return {
    ativos: Number(row.ativos ?? 0),
    bytes: Number(row.bytes ?? 0),
    liberados: Number(row.liberados ?? 0),
  };
}

export async function insertPauta(c: NovoPautaCard): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_pauta (quadro, coluna_id, tipo, titulo, descricao, projeto, responsavel, canal, data, url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [c.quadro, c.coluna_id, c.tipo, c.titulo, c.descricao, c.projeto, c.responsavel, c.canal, c.data, c.url]
  );
}

export async function updatePauta(id: number, c: NovoPautaCard): Promise<void> {
  await ensure();
  await pool().query(
    `UPDATE hub_pauta SET coluna_id = $2, tipo = $3, titulo = $4, descricao = $5, projeto = $6,
            responsavel = $7, canal = $8, data = $9, url = $10, atualizado = now()
      WHERE id = $1 AND quadro = $11`,
    [id, c.coluna_id, c.tipo, c.titulo, c.descricao, c.projeto, c.responsavel, c.canal, c.data, c.url, c.quadro]
  );
}

/**
 * Grava SÓ a anotação. Existe separada de updatePauta porque o editor inline da vista de
 * documentação manda um campo só: passar pelo update completo faria os campos que o formulário
 * não tem (projeto, responsável, canal, data) voltarem para NULL — perda silenciosa numa tela
 * cujo contrato declarado é justamente nunca perder o que foi escrito.
 */
export async function updatePautaDescricao(
  id: number,
  quadro: string,
  descricao: string | null
): Promise<void> {
  await ensure();
  await pool().query(
    `UPDATE hub_pauta SET descricao = $3, atualizado = now() WHERE id = $1 AND quadro = $2`,
    [id, quadro, descricao]
  );
}

/**
 * O EXISTS é o que impede um card de Marketing cair no quadro de Ideias por id trocado na URL:
 * a coluna de destino tem que ser do MESMO quadro do card.
 */
export async function movePauta(id: number, colunaId: number): Promise<void> {
  await ensure();
  await pool().query(
    `UPDATE hub_pauta p SET coluna_id = $2, atualizado = now()
      WHERE p.id = $1
        AND EXISTS (SELECT 1 FROM hub_pauta_coluna c WHERE c.id = $2 AND c.quadro = p.quadro)`,
    [id, colunaId]
  );
}

/**
 * Anexos vão junto pelo ON DELETE CASCADE — sem depender de alguém lembrar de limpar.
 *
 * O `AND` é a trava de documento (vista `docs`): `tipo = 'doc'` só sai do banco depois de
 * arquivado. A vista de documentação é o lugar onde a casa guarda anotação que ninguém pretende
 * excluir, e um "×" ao lado do "📥" apaga texto de meses num clique errado. A trava mora no
 * WHERE e não na tela porque esconder o botão não é garantia: id trocado na requisição passaria.
 */
export async function removePauta(id: number): Promise<void> {
  await ensure();
  await pool().query(
    `DELETE FROM hub_pauta WHERE id = $1 AND (tipo <> 'doc' OR arquivado_em IS NOT NULL)`,
    [id]
  );
}

export async function arquivarPauta(id: number): Promise<void> {
  await ensure();
  await pool().query(`UPDATE hub_pauta SET arquivado_em = now(), atualizado = now() WHERE id = $1`, [id]);
}

/** Restaurar ZERA a carência: arquivar de novo recomeça os 30 dias (FR-034/FR-035). */
export async function restaurarPauta(id: number): Promise<void> {
  await ensure();
  await pool().query(`UPDATE hub_pauta SET arquivado_em = NULL, atualizado = now() WHERE id = $1`, [id]);
}

export async function insertColuna(quadro: string, nome: string, icone: string | null): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_pauta_coluna (quadro, nome, icone, ordem)
     VALUES ($1, $2, $3, COALESCE((SELECT MAX(ordem) + 1 FROM hub_pauta_coluna WHERE quadro = $1), 0))
     ON CONFLICT (quadro, nome) DO NOTHING`,
    [quadro, nome, icone]
  );
}

/** Só nome e ícone. FR-015 é garantido pela ESTRUTURA (o card aponta para id), não por cuidado aqui. */
export async function renameColuna(id: number, nome: string, icone: string | null): Promise<void> {
  await ensure();
  await pool().query(`UPDATE hub_pauta_coluna SET nome = $2, icone = $3 WHERE id = $1`, [id, nome, icone]);
}

/** Troca a ordem com a vizinha numa transação: metade da troca deixaria duas colunas empatadas. */
export async function swapColunaOrdem(id: number, dir: number): Promise<void> {
  await ensure();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const atual = await client.query(`SELECT quadro, ordem FROM hub_pauta_coluna WHERE id = $1`, [id]);
    if (atual.rows[0]) {
      const { quadro, ordem } = atual.rows[0];
      const vizinha = await client.query(
        dir < 0
          ? `SELECT id, ordem FROM hub_pauta_coluna WHERE quadro = $1 AND ordem < $2 ORDER BY ordem DESC LIMIT 1`
          : `SELECT id, ordem FROM hub_pauta_coluna WHERE quadro = $1 AND ordem > $2 ORDER BY ordem ASC LIMIT 1`,
        [quadro, ordem]
      );
      if (vizinha.rows[0]) {
        await client.query(`UPDATE hub_pauta_coluna SET ordem = $2 WHERE id = $1`, [id, vizinha.rows[0].ordem]);
        await client.query(`UPDATE hub_pauta_coluna SET ordem = $2 WHERE id = $1`, [vizinha.rows[0].id, ordem]);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Cards em qualquer estado, arquivados inclusive: card arquivado ainda aponta para a coluna. */
export async function contarCardsDaColuna(id: number): Promise<number> {
  await ensure();
  const r = await pool().query(`SELECT COUNT(*)::int AS n FROM hub_pauta WHERE coluna_id = $1`, [id]);
  return r.rows[0]?.n ?? 0;
}

export async function contarColunas(quadro: string): Promise<number> {
  await ensure();
  const r = await pool().query(`SELECT COUNT(*)::int AS n FROM hub_pauta_coluna WHERE quadro = $1`, [quadro]);
  return r.rows[0]?.n ?? 0;
}

export async function removeColuna(id: number): Promise<void> {
  await ensure();
  await pool().query(`DELETE FROM hub_pauta_coluna WHERE id = $1`, [id]);
}

export async function cardExiste(id: number): Promise<{ quadro: string } | null> {
  await ensure();
  const r = await pool().query(`SELECT quadro FROM hub_pauta WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function contarAnexos(pautaId: number): Promise<number> {
  await ensure();
  const r = await pool().query(`SELECT COUNT(*)::int AS n FROM hub_pauta_anexo WHERE pauta_id = $1`, [pautaId]);
  return r.rows[0]?.n ?? 0;
}

export async function insertAnexo(a: {
  pauta_id: number;
  nome: string;
  mime: string;
  tamanho: number;
  bytes: Buffer;
}): Promise<void> {
  await ensure();
  await pool().query(
    `INSERT INTO hub_pauta_anexo (pauta_id, ordem, nome, mime, tamanho, bytes)
     VALUES ($1, COALESCE((SELECT MAX(ordem) + 1 FROM hub_pauta_anexo WHERE pauta_id = $1), 0), $2, $3, $4, $5)`,
    [a.pauta_id, a.nome, a.mime, a.tamanho, a.bytes]
  );
}

/** `null` = id inexistente. `bytes: null` = liberado — a rota traduz isso em 410, não em 404. */
export async function getAnexoBytes(
  id: number
): Promise<{ mime: string; tamanho: number; bytes: Buffer | null } | null> {
  await ensure();
  const r = await pool().query(`SELECT mime, tamanho, bytes FROM hub_pauta_anexo WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function anexoDoCard(id: number): Promise<{ pauta_id: number; quadro: string } | null> {
  await ensure();
  const r = await pool().query(
    `SELECT a.pauta_id, p.quadro FROM hub_pauta_anexo a JOIN hub_pauta p ON p.id = a.pauta_id WHERE a.id = $1`,
    [id]
  );
  return r.rows[0] ?? null;
}

export async function removeAnexo(id: number): Promise<void> {
  await ensure();
  await pool().query(`DELETE FROM hub_pauta_anexo WHERE id = $1`, [id]);
}

/** Buraco na sequência de ordem é irrelevante: a exibição ordena por `ordem`, não por contiguidade. */
export async function swapAnexoOrdem(id: number, dir: number): Promise<void> {
  await ensure();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const atual = await client.query(`SELECT pauta_id, ordem FROM hub_pauta_anexo WHERE id = $1`, [id]);
    if (atual.rows[0]) {
      const { pauta_id, ordem } = atual.rows[0];
      const vizinho = await client.query(
        dir < 0
          ? `SELECT id, ordem FROM hub_pauta_anexo WHERE pauta_id = $1 AND ordem < $2 ORDER BY ordem DESC LIMIT 1`
          : `SELECT id, ordem FROM hub_pauta_anexo WHERE pauta_id = $1 AND ordem > $2 ORDER BY ordem ASC LIMIT 1`,
        [pauta_id, ordem]
      );
      if (vizinho.rows[0]) {
        await client.query(`UPDATE hub_pauta_anexo SET ordem = $2 WHERE id = $1`, [id, vizinho.rows[0].ordem]);
        await client.query(`UPDATE hub_pauta_anexo SET ordem = $2 WHERE id = $1`, [vizinho.rows[0].id, ordem]);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Varredura de liberação. Idempotente por construção — `WHERE bytes IS NOT NULL` faz a segunda
 * passada não achar linha — e por isso é segura de chamar em toda renderização de quadro, que é
 * onde ela roda (R-005). Cron novo não: já há dois na janela da madrugada, o hub cai nela, e com
 * carência de 30 dias um atraso de horas é irrelevante.
 */
export async function liberarAnexosVencidos(dias: number): Promise<void> {
  await ensure();
  await pool().query(
    `UPDATE hub_pauta_anexo a
        SET bytes = NULL, liberado_em = now()
       FROM hub_pauta p
      WHERE a.pauta_id = p.id
        AND a.bytes IS NOT NULL
        AND p.arquivado_em IS NOT NULL
        AND p.arquivado_em < now() - ($1 || ' days')::interval`,
    [dias]
  );
}
