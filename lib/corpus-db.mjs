// Onde o corpus e seus vetores moram em produção. Duas razões, uma por tabela:
//
// - `hub_embeddings`: calcular custa ~35 min de CPU, então o container não pode refazer isso ao
//   subir, e 13 MB de float não entram no repositório.
// - `hub_corpus`: as 123 memórias vivem em ~/.claude, FORA do repo — sem isto o container tem os
//   vetores delas e não tem o texto, e a aba devolveria id que não sabe renderizar. São 72 das
//   160 fontes do dourado: metade do valor da busca.
//
// Postgres já existe (DATABASE_URL) — nenhuma infra nova. Dono único das duas tabelas: este
// arquivo. É .mjs de propósito, para o script de indexação (node) e a aba (Next) importarem o
// mesmo código — schema duplicado em dois lugares diverge em silêncio.
import pg from "pg";

let pool;
function conectar() {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return pool;
}

let schema;
function ensure() {
  if (!schema)
    schema = conectar().query(`
      CREATE TABLE IF NOT EXISTS hub_embeddings (
        modelo TEXT NOT NULL,
        doc_id TEXT NOT NULL,
        chunk INT NOT NULL,
        tipo TEXT NOT NULL,
        vetor REAL[] NOT NULL,
        PRIMARY KEY (modelo, doc_id, chunk)
      );
      CREATE TABLE IF NOT EXISTS hub_corpus (
        id TEXT PRIMARY KEY,
        tipo TEXT NOT NULL,
        titulo TEXT NOT NULL,
        texto TEXT NOT NULL,
        atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  return schema;
}

export async function lerCorpus() {
  await ensure();
  const { rows } = await conectar().query("SELECT id, tipo, titulo, texto FROM hub_corpus");
  return rows;
}

export async function salvarCorpus(docs) {
  await ensure();
  const c = await conectar().connect();
  try {
    await c.query("BEGIN");
    // Doc que saiu do corpus não pode sobreviver no banco: ele continuaria sendo devolvido.
    await c.query("DELETE FROM hub_corpus");
    for (let i = 0; i < docs.length; i += 50) {
      const fatia = docs.slice(i, i + 50);
      const linhas = fatia.map((_, j) => `($${j * 4 + 1}, $${j * 4 + 2}, $${j * 4 + 3}, $${j * 4 + 4})`);
      await c.query(
        `INSERT INTO hub_corpus (id, tipo, titulo, texto) VALUES ${linhas.join(",")}`,
        fatia.flatMap((d) => [d.id, d.tipo, d.titulo, d.texto]),
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
  }
  return docs.length;
}

// Devolve no formato que buscarDenso() já consome — {chunks, vetores} — para a aba não ter uma
// segunda implementação de busca densa.
export async function lerVetores(modelo) {
  await ensure();
  const { rows } = await conectar().query(
    "SELECT doc_id, tipo, vetor FROM hub_embeddings WHERE modelo = $1 ORDER BY doc_id, chunk",
    [modelo],
  );
  return { chunks: rows.map((r) => ({ id: r.doc_id, tipo: r.tipo })), vetores: rows.map((r) => r.vetor) };
}

export async function salvarVetores(modelo, chunks, vetores) {
  await ensure();
  const c = await conectar().connect();
  try {
    await c.query("BEGIN");
    // Troca completa: chunk que sumiu do corpus não pode continuar aparecendo na busca.
    await c.query("DELETE FROM hub_embeddings WHERE modelo = $1", [modelo]);
    for (let i = 0; i < chunks.length; i += 100) {
      const fatia = chunks.slice(i, i + 100);
      const linhas = fatia.map((_, j) => `($1, $${j * 4 + 2}, $${j * 4 + 3}, $${j * 4 + 4}, $${j * 4 + 5})`);
      await c.query(
        `INSERT INTO hub_embeddings (modelo, doc_id, chunk, tipo, vetor) VALUES ${linhas.join(",")}`,
        [modelo, ...fatia.flatMap((ch, j) => [ch.id, ch.i, ch.tipo, vetores[i + j]])],
      );
    }
    await c.query("COMMIT");
  } catch (err) {
    await c.query("ROLLBACK");
    throw err;
  } finally {
    c.release();
  }
  return chunks.length;
}
