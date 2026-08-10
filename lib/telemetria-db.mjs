// Dono único das tabelas ia_* (specs/002-observabilidade-ia/data-model.md). Par de
// lib/telemetria.mjs (puro) no molde de corpus.mjs/corpus-db.mjs — `.mjs` porque
// reranker.mjs e os scripts locais gravam daqui, não de lib/db.ts.
import pg from "pg";
import { transicaoPool, resumirDia } from "./telemetria.mjs";

let pool;
function conectar() {
  if (!pool) pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  return pool;
}

let schema;
function ensure() {
  if (!schema)
    schema = conectar().query(`
      CREATE TABLE IF NOT EXISTS ia_chamadas (
        id           BIGSERIAL PRIMARY KEY,
        pedido       UUID NOT NULL,
        corrida      TEXT,
        empregado    TEXT NOT NULL,
        ambiente     TEXT NOT NULL CHECK (ambiente IN ('prod','dev')),
        operacao     TEXT NOT NULL,
        modelo       TEXT NOT NULL,
        effort       TEXT NOT NULL,
        conta        TEXT NOT NULL,
        tentativa    INT  NOT NULL,
        inicio       TIMESTAMPTZ NOT NULL,
        duracao_ms   INT NOT NULL,
        tokens_entrada INT NOT NULL DEFAULT 0,
        tokens_saida   INT NOT NULL DEFAULT 0,
        turnos       INT NOT NULL DEFAULT 0,
        desfecho     TEXT NOT NULL,
        status_api   INT NOT NULL DEFAULT 0,
        prompt_hash  TEXT NOT NULL,
        prompt_chars INT NOT NULL,
        criado       TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ia_chamadas_inicio ON ia_chamadas (inicio DESC);
      CREATE INDEX IF NOT EXISTS ia_chamadas_emp ON ia_chamadas (empregado, inicio DESC);
      CREATE TABLE IF NOT EXISTS ia_resumo (
        dia            DATE NOT NULL,
        ambiente       TEXT NOT NULL,
        empregado      TEXT NOT NULL,
        chamadas       INT NOT NULL,
        pedidos        INT NOT NULL,
        falhas         JSONB NOT NULL,
        tokens_entrada BIGINT NOT NULL,
        tokens_saida   BIGINT NOT NULL,
        p50_ms         INT NOT NULL,
        p95_ms         INT NOT NULL,
        PRIMARY KEY (dia, ambiente, empregado)
      );
      CREATE TABLE IF NOT EXISTS ia_pool (
        conta   TEXT NOT NULL,
        estado  TEXT NOT NULL CHECK (estado IN ('viva','rate-limit','desabilitada','auth','outro')),
        desde   TIMESTAMPTZ NOT NULL,
        visto   TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (conta, desde)
      );
    `);
  return schema;
}

// Nunca lança (FR-007): busca e publicação não podem falhar porque o registro falhou.
// ponytail: erro engolido de propósito (best-effort, sem retry nem fila) — quem torna a
// falha visível é a AUSÊNCIA das linhas de `sonda` na janela (D9), nunca um log.
export async function registrar(registro) {
  if (!process.env.DATABASE_URL) return;
  try {
    await ensure();
    await conectar().query(
      `INSERT INTO ia_chamadas
         (pedido, corrida, empregado, ambiente, operacao, modelo, effort, conta, tentativa,
          inicio, duracao_ms, tokens_entrada, tokens_saida, turnos, desfecho, status_api,
          prompt_hash, prompt_chars)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        registro.pedido, registro.corrida, registro.empregado, registro.ambiente,
        registro.operacao, registro.modelo, registro.effort, registro.conta, registro.tentativa,
        registro.inicio, registro.duracao_ms, registro.tokens_entrada, registro.tokens_saida,
        registro.turnos, registro.desfecho, registro.status_api, registro.prompt_hash,
        registro.prompt_chars,
      ],
    );
  } catch {
    // silencioso, de propósito — ver comentário acima.
  }
}

// Upsert idempotente do dia ANTERIOR em ia_resumo. Reusa `resumirDia` (puro): o resumo
// consolidado é literalmente o mesmo cálculo que o teste roda sobre o detalhe (FR-023).
/** @param {string} dia YYYY-MM-DD, BRT */
export async function consolidar(dia) {
  await ensure();
  const { rows } = await conectar().query(
    `SELECT pedido, empregado, ambiente, desfecho, tokens_entrada, tokens_saida, duracao_ms
     FROM ia_chamadas WHERE (inicio AT TIME ZONE 'America/Sao_Paulo')::date = $1::date`,
    [dia],
  );
  // resumirDia deriva o `dia` de `l.inicio`: força o dia BRT do filtro, não o timestamp UTC bruto.
  const resumos = resumirDia(rows.map((r) => ({ ...r, inicio: dia })));
  const c = conectar();
  for (const r of resumos) {
    await c.query(
      `INSERT INTO ia_resumo (dia, ambiente, empregado, chamadas, pedidos, falhas, tokens_entrada, tokens_saida, p50_ms, p95_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (dia, ambiente, empregado) DO UPDATE SET
         chamadas = EXCLUDED.chamadas, pedidos = EXCLUDED.pedidos, falhas = EXCLUDED.falhas,
         tokens_entrada = EXCLUDED.tokens_entrada, tokens_saida = EXCLUDED.tokens_saida,
         p50_ms = EXCLUDED.p50_ms, p95_ms = EXCLUDED.p95_ms`,
      [r.dia, r.ambiente, r.empregado, r.chamadas, r.pedidos, JSON.stringify(r.falhas),
        r.tokens_entrada, r.tokens_saida, r.p50_ms, r.p95_ms],
    );
  }
  return resumos.length;
}

// Roda DEPOIS de `consolidar`, sempre — a ordem inversa perderia o último dia.
export async function expirar(dias = 90) {
  await ensure();
  const { rowCount } = await conectar().query(
    `DELETE FROM ia_chamadas WHERE inicio < now() - ($1 || ' days')::interval`,
    [dias],
  );
  return rowCount;
}

// Grava só quando o estado MUDA (transicaoPool). Lista vazia estoura, no molde exato de
// `coletarPool` — env var ausente é "não olhei", nunca "nenhuma conta com problema".
/** @param {{conta: string, estado: string}[]} contas @param {Date} [agora] */
export async function atualizarPool(contas, agora = new Date()) {
  if (!contas.length) throw new Error("pool vazio: CLAUDE_CODE_OAUTH_TOKENS ausente");
  await ensure();
  const c = conectar();
  for (const leitura of contas) {
    const { rows } = await c.query(
      "SELECT conta, estado, desde, visto FROM ia_pool WHERE conta = $1 ORDER BY desde DESC LIMIT 1",
      [leitura.conta],
    );
    const { inserir, tocar } = transicaoPool(rows[0] ?? null, leitura, agora);
    if (inserir) {
      await c.query(
        "INSERT INTO ia_pool (conta, estado, desde, visto) VALUES ($1,$2,$3,$4)",
        [inserir.conta, inserir.estado, inserir.desde, inserir.visto],
      );
    } else {
      await c.query("UPDATE ia_pool SET visto = $1 WHERE conta = $2 AND desde = $3", [tocar.visto, tocar.conta, tocar.desde]);
    }
  }
}

/** @param {{desde: Date, ate?: Date, ambiente?: string}} args */
export async function janela({ desde, ate = new Date(), ambiente = "prod" }) {
  await ensure();
  const { rows } = await conectar().query(
    "SELECT * FROM ia_chamadas WHERE inicio >= $1 AND inicio < $2 AND ambiente = $3 ORDER BY inicio",
    [desde, ate, ambiente],
  );
  return rows;
}

// Relógio do batimento de coração — o max(inicio), nunca uma contagem dentro do recorte
// (D7): é o que distingue "não houve chamada" de "não houve registro".
export async function ultimaSonda() {
  await ensure();
  const { rows } = await conectar().query("SELECT max(inicio) AS m FROM ia_chamadas WHERE empregado = 'sonda'");
  return rows[0]?.m ?? null;
}

// Por conta, o estado mais recente com `desde`/`visto` — a leitura de `poolDatado` que
// data o "desde quando" (SC-003).
export async function poolDatado() {
  await ensure();
  const { rows } = await conectar().query(
    "SELECT DISTINCT ON (conta) conta, estado, desde, visto FROM ia_pool ORDER BY conta, desde DESC",
  );
  return rows;
}

// `ambiente = 'dev' sai por default (FR-009); passar `ambiente` explícito inclui só ele.
/** @param {{desde: Date, ate?: Date, ambiente?: string|null}} args */
export async function porEmpregado({ desde, ate = new Date(), ambiente = null }) {
  await ensure();
  const filtroAmbiente = ambiente ? "= $3" : "!= 'dev'";
  const params = ambiente ? [desde, ate, ambiente] : [desde, ate];
  const cutoff = new Date(Date.now() - 90 * 86_400_000);

  // A janela pedida começa fora da retenção do detalhe: cai para o resumo permanente.
  // p50/p95 não sobrevivem à agregação diária — ficam null, e é isso, não um número
  // inventado, que a aba deve mostrar para um dia já expirado.
  if (desde < cutoff) {
    const { rows } = await conectar().query(
      `SELECT dia, empregado, chamadas, pedidos, falhas, tokens_entrada, tokens_saida
       FROM ia_resumo WHERE dia >= $1 AND dia < $2 AND ambiente ${filtroAmbiente}`,
      params,
    );
    const porEmp = new Map();
    for (const r of rows) {
      const acc = porEmp.get(r.empregado) ?? {
        empregado: r.empregado, chamadas: 0, pedidos: 0, falhas: {},
        tokens_entrada: 0, tokens_saida: 0, p50_ms: null, p95_ms: null,
      };
      acc.chamadas += Number(r.chamadas);
      acc.pedidos += Number(r.pedidos);
      acc.tokens_entrada += Number(r.tokens_entrada);
      acc.tokens_saida += Number(r.tokens_saida);
      for (const [k, v] of Object.entries(r.falhas ?? {})) acc.falhas[k] = (acc.falhas[k] ?? 0) + Number(v);
      porEmp.set(r.empregado, acc);
    }
    return [...porEmp.values()];
  }

  const [{ rows }, { rows: falhas }] = await Promise.all([
    conectar().query(
      `SELECT empregado, count(*) chamadas, count(DISTINCT pedido) pedidos,
              sum(tokens_entrada) tokens_entrada, sum(tokens_saida) tokens_saida,
              percentile_disc(0.5) WITHIN GROUP (ORDER BY duracao_ms) p50_ms,
              percentile_disc(0.95) WITHIN GROUP (ORDER BY duracao_ms) p95_ms
       FROM ia_chamadas WHERE inicio >= $1 AND inicio < $2 AND ambiente ${filtroAmbiente}
       GROUP BY empregado`,
      params,
    ),
    conectar().query(
      `SELECT empregado, desfecho, count(*) n FROM ia_chamadas
       WHERE inicio >= $1 AND inicio < $2 AND ambiente ${filtroAmbiente} AND desfecho != 'ok'
       GROUP BY empregado, desfecho`,
      params,
    ),
  ]);
  const falhasPorEmp = new Map();
  for (const f of falhas) {
    const m = falhasPorEmp.get(f.empregado) ?? {};
    m[f.desfecho] = Number(f.n);
    falhasPorEmp.set(f.empregado, m);
  }
  return rows.map((r) => ({
    empregado: r.empregado,
    chamadas: Number(r.chamadas),
    pedidos: Number(r.pedidos),
    falhas: falhasPorEmp.get(r.empregado) ?? {},
    tokens_entrada: Number(r.tokens_entrada),
    tokens_saida: Number(r.tokens_saida),
    p50_ms: Number(r.p50_ms),
    p95_ms: Number(r.p95_ms),
  }));
}

// Números, não adjetivo (contrato): "arriscada" sem regra é veredito que ninguém confere
// depois. Consumo do pool INCLUI `dev` de propósito — o pool é o mesmo pool.
export async function orcamento({ chamadasPrevistas, janelaHoras = 24 } = {}) {
  await ensure();
  const desde = new Date(Date.now() - janelaHoras * 3_600_000);
  const [{ rows: pool }, { rows: consumo }] = await Promise.all([
    conectar().query("SELECT DISTINCT ON (conta) conta, estado FROM ia_pool ORDER BY conta, desde DESC"),
    conectar().query(
      "SELECT count(*) n FROM ia_chamadas WHERE inicio >= $1 AND conta NOT IN ('cache','cli-ambiente')",
      [desde],
    ),
  ]);
  return {
    contasVivas: pool.filter((p) => p.estado === "viva").length,
    contasTotal: pool.length,
    consumoNaJanela: Number(consumo[0]?.n ?? 0),
    chamadasPrevistas,
  };
}
