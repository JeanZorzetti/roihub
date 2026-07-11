import { Pool } from "pg";

// Postgres da agenda (tabelas hub_*). Sem DATABASE_URL → aba mostra estado de setup.

export type Task = {
  id: number;
  titulo: string;
  projeto: string | null;
  due: string | null; // YYYY-MM-DD
  weekday: number | null; // 0-6 = recorrente semanal (domingo=0)
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
        weekday INT CHECK (weekday BETWEEN 0 AND 6),
        criado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS hub_done (
        key TEXT NOT NULL,
        occurrence DATE NOT NULL,
        done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (key, occurrence)
      );
    `);
  return g.hubSchema;
}

export async function listTasks(): Promise<Task[]> {
  await ensure();
  const r = await pool().query(
    `SELECT id, titulo, projeto, to_char(due, 'YYYY-MM-DD') AS due, weekday
     FROM hub_tasks ORDER BY due NULLS LAST, id`
  );
  return r.rows;
}

/** Set de "key@occurrence" feitos. ponytail: busca tudo — 1 usuário, tabela minúscula. */
export async function listDone(): Promise<Set<string>> {
  await ensure();
  const r = await pool().query(`SELECT key, to_char(occurrence, 'YYYY-MM-DD') AS occurrence FROM hub_done`);
  return new Set(r.rows.map((x: { key: string; occurrence: string }) => `${x.key}@${x.occurrence}`));
}

export async function insertTask(t: Omit<Task, "id">): Promise<void> {
  await ensure();
  await pool().query(`INSERT INTO hub_tasks (titulo, projeto, due, weekday) VALUES ($1, $2, $3, $4)`, [
    t.titulo,
    t.projeto,
    t.due,
    t.weekday,
  ]);
}

export async function setDone(key: string, occurrence: string, done: boolean): Promise<void> {
  await ensure();
  if (done)
    await pool().query(`INSERT INTO hub_done (key, occurrence) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [key, occurrence]);
  else await pool().query(`DELETE FROM hub_done WHERE key = $1 AND occurrence = $2`, [key, occurrence]);
}

export async function removeTask(id: number): Promise<void> {
  await ensure();
  await pool().query(`DELETE FROM hub_done WHERE key = $1`, [`task:${id}`]);
  await pool().query(`DELETE FROM hub_tasks WHERE id = $1`, [id]);
}
