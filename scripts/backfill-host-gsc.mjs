// 026 — preenche `hub_gsc_dia.host` nas linhas que nasceram antes de a coluna existir.
//
// POR QUE ele precisa existir, em vez de deixar a corrida preencher sozinha: a guarda de
// `gravarDiasGsc` escreve livremente sobre `host IS NULL`, porque é assim que a coluna se
// preenche na primeira corrida sem migração por projeto. Para quem NÃO migrou de domínio isso é
// inofensivo — o host que a corrida grava é o mesmo de onde o dia veio. Para quem migrou, o NULL
// é justamente o buraco por onde o apagamento passa: a corrida leria o site NOVO e carimbaria o
// host novo em 248 dias medidos no ANTIGO.
//
// A REGRA, derivada de dado declarado e não de chute: projeto com `dominioAnterior` teve toda a
// sua série gravada antes da migração ser declarada, logo o host é o ANTERIOR. Sem
// `dominioAnterior`, o host é o da `url` atual.
//
// Medido na Atma em 18/09, o que prova a regra sem precisar acreditar nela: `sc-domain:
// usealigner.com` responde 5 dias e 63 impressões no total, e 15/09 vale 31 lá — contra 1.146
// gravados. Uma série de 248 dias e 371.189 impressões não pode ter vindo de uma propriedade que
// só tem dado desde 11/09.
//
// Idempotente: só toca `host IS NULL`. Rodar duas vezes não muda nada na segunda.
// Uso: node scripts/backfill-host-gsc.mjs [--aplicar]   (sem a flag, só mostra o que faria)

import fs from "node:fs";
import pg from "pg";

const APLICAR = process.argv.includes("--aplicar");

// O .env do jeito que o resto dos scripts do repo o lê: sem dependência de dotenv, e sem partir
// a linha no primeiro `=` de dentro do valor (o JSON da service account tem dezenas deles).
const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const hostDe = (u) => {
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
};

const projetos = JSON.parse(
  fs.readFileSync(new URL("../data/projects.json", import.meta.url), "utf8"),
);
const lista = Array.isArray(projetos) ? projetos : (projetos.projects ?? projetos.projetos ?? []);

const cliente = new pg.Client({ connectionString: env.DATABASE_URL });
await cliente.connect();

// A mesma DDL de `ensure()` em lib/db.ts, e não uma segunda definição: `IF NOT EXISTS` é
// idempotente, e sem ela este script depende de alguém ter aberto o Next antes de rodá-lo — o que
// é exatamente a ordem que não dá para garantir quando a corrida roda às 05:17.
await cliente.query(`ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS host TEXT`);

const { rows: pendentes } = await cliente.query(
  `SELECT projeto, count(*)::int AS dias,
          to_char(min(dia), 'YYYY-MM-DD') AS de,
          to_char(max(dia), 'YYYY-MM-DD') AS ate
     FROM hub_gsc_dia WHERE host IS NULL GROUP BY projeto ORDER BY projeto`,
);

if (!pendentes.length) {
  console.log("nada a fazer: nenhuma linha com host NULL.");
  await cliente.end();
  process.exit(0);
}

let total = 0;
for (const linha of pendentes) {
  const p = lista.find((x) => x.slug === linha.projeto);
  // Projeto que saiu de `projects.json` não tem host derivável de lugar nenhum. Deixar NULL é a
  // resposta certa: inventar um host aqui é exatamente o carimbo errado que este script existe
  // para impedir.
  if (!p) {
    console.log(`  ${linha.projeto.padEnd(18)} ${String(linha.dias).padStart(4)} dias — PULADO (fora de projects.json)`);
    continue;
  }
  const host = p.dominioAnterior ? hostDe(p.dominioAnterior.url) : hostDe(p.url);
  if (!host) {
    console.log(`  ${linha.projeto.padEnd(18)} ${String(linha.dias).padStart(4)} dias — PULADO (url ilegível)`);
    continue;
  }
  const origem = p.dominioAnterior ? "dominioAnterior" : "url";
  console.log(
    `  ${linha.projeto.padEnd(18)} ${String(linha.dias).padStart(4)} dias  ${linha.de}→${linha.ate}  ->  ${host}  (${origem})`,
  );
  if (APLICAR) {
    const r = await cliente.query(
      `UPDATE hub_gsc_dia SET host = $2 WHERE projeto = $1 AND host IS NULL`,
      [linha.projeto, host],
    );
    total += r.rowCount ?? 0;
  }
}

console.log(APLICAR ? `\naplicado: ${total} linha(s).` : "\nensaio — nada foi gravado. Rode com --aplicar.");
await cliente.end();
