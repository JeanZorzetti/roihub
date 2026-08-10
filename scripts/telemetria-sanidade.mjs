// Dois checks de sanidade da série de IA contra o Postgres de PRODUÇÃO (specs/002-observabilidade-ia).
// Fora do `npm test` pelo mesmo motivo do `conformidade.mjs`: teste não abre conexão com produção.
//
//   node --env-file=.env scripts/telemetria-sanidade.mjs
//
// (a) SC-007 — nenhuma coluna da série guarda texto livre. Se precisar de regex nova para
//     passar, o schema mudou e a garantia da FR-004 vazou.
// (b) SC-008 — `empregado = 'sonda'` por dia não passa do número de contas do pool: a
//     observabilidade não pode ter virado consumidora do pool que ela mede.
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

const contasDoPool = String(process.env.CLAUDE_CODE_OAUTH_TOKENS ?? "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean).length;

let falhou = false;

const { rows: [textoLivre] } = await pool.query(
  `SELECT count(*)::int AS n FROM ia_chamadas
   WHERE prompt_hash !~ '^[0-9a-f]{40}$' OR length(desfecho) > 40`,
);
if (textoLivre.n > 0) {
  falhou = true;
  console.log(`🚨 SC-007: ${textoLivre.n} linha(s) com prompt_hash malformado ou desfecho longo — texto livre vazou.`);
} else {
  console.log("✓ SC-007: nenhuma coluna guarda texto livre (0 linhas fora do formato).");
}

const { rows: sondasPorDia } = await pool.query(
  `SELECT (inicio AT TIME ZONE 'America/Sao_Paulo')::date AS dia, count(*)::int AS n
   FROM ia_chamadas WHERE empregado = 'sonda' GROUP BY 1 ORDER BY 1`,
);
const acimaDoPool = sondasPorDia.filter((d) => d.n > contasDoPool);
if (acimaDoPool.length) {
  falhou = true;
  console.log(`🚨 SC-008: ${acimaDoPool.length} dia(s) com mais sondas que contas do pool (${contasDoPool}):`);
  for (const d of acimaDoPool) console.log(`   ${d.dia}  ${d.n} sonda(s)`);
} else {
  console.log(`✓ SC-008: nenhum dia com sonda acima do número de contas do pool (${contasDoPool}).`);
}

await pool.end();
process.exit(falhou ? 1 : 0);
