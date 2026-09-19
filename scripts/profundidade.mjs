// A distribuição de PROFUNDIDADE da última corrida de crawl — o dado que decide a divergência
// board × código (3 contra 4 cliques), registrada em `handoff/gsc-balizador-estudo.md` §0.1.
//
// LÊ, nunca crawleia: `hub_pagina` já tem a corrida de segunda gravada, e um crawl novo só para
// contar profundidade varreria o site do cliente de novo pela informação que já está no banco.
//
// Por que um script e não uma tela: a pergunta é de DECISÃO, feita uma vez. Tela é para o que se
// lê toda semana, e um bloco a mais em `/okr/[slug]/aquisicao` custaria altura permanente numa
// página que passou seis corridas encolhendo.
//
// Uso:  node scripts/profundidade.mjs [slug]        (padrão: atma)

import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.loadEnvFile(path.join(REPO, ".env"));

const slug = process.argv[2] ?? "atma";
const br = (n) => Number(n).toLocaleString("pt-BR");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente no .env — sem banco não há corrida gravada para ler.");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();

try {
  const { rows: corrida } = await cliente.query(
    `SELECT to_char(dia, 'YYYY-MM-DD') AS dia, declaradas, visitadas, orfas, links_navegacao, motivo
       FROM hub_pagina_corrida WHERE projeto = $1 ORDER BY dia DESC LIMIT 1`,
    [slug]
  );
  const c = corrida[0];
  if (!c) {
    console.log(`Nenhuma corrida de crawl gravada para "${slug}".`);
    process.exit(0);
  }
  if (c.motivo) {
    console.log(`A corrida de ${c.dia} não apurou: ${c.motivo}.`);
    process.exit(0);
  }

  console.log(`\n${slug} · corrida de ${c.dia}`);
  console.log(`${br(c.visitadas)} página(s) visitadas de ${br(c.declaradas)} declaradas no sitemap`);

  // Crawl que não extraiu link nenhum não mediu um site sem links: toda profundidade sai órfã por
  // construção, e a distribuição abaixo seria sobre o defeito, não sobre o site.
  if (c.links_navegacao === 0 && c.orfas === c.visitadas) {
    console.log(`\n⚠️  Esta corrida não extraiu UM link interno (${br(c.orfas)} órfãs de ${br(c.visitadas)}).`);
    console.log(`    A profundidade desta corrida não mede o site — espere a próxima de segunda.`);
    process.exit(0);
  }

  const { rows } = await cliente.query(
    `SELECT profundidade, count(*)::int AS n
       FROM hub_pagina WHERE projeto = $1 AND dia = $2::date
      GROUP BY profundidade ORDER BY (profundidade IS NULL), profundidade`,
    [slug, c.dia]
  );
  const total = rows.reduce((a, r) => a + r.n, 0);
  const pct = (n) => `${((n / total) * 100).toFixed(1).replace(".", ",")}%`;

  console.log(`\nprofundidade   páginas        barra`);
  for (const r of rows) {
    const rotulo = r.profundidade === null ? "órfã" : r.profundidade === 0 ? "0 (home)" : String(r.profundidade);
    const barra = "█".repeat(Math.max(1, Math.round((r.n / total) * 40)));
    console.log(`${rotulo.padEnd(14)} ${String(r.n).padStart(4)} ${pct(r.n).padStart(7)}  ${barra}`);
  }

  // A pergunta da decisão, respondida direto: quantas páginas o limiar 3 acusa e o 4 não.
  const emQuatro = rows.filter((r) => r.profundidade === 4).reduce((a, r) => a + r.n, 0);
  const acimaDeQuatro = rows.filter((r) => r.profundidade !== null && r.profundidade > 4).reduce((a, r) => a + r.n, 0);
  const orfas = rows.filter((r) => r.profundidade === null).reduce((a, r) => a + r.n, 0);

  console.log(`\n── a decisão ─────────────────────────────────────────────`);
  console.log(`limiar 3 acusa a mais que o limiar 4: ${br(emQuatro)} página(s) (${pct(emQuatro)})`);
  console.log(`os dois limiares acusam igual:        ${br(acimaDeQuatro)} em profundidade 5+`);
  console.log(`fora dos dois (sem link apontando):   ${br(orfas)} órfã(s)`);
  console.log(
    emQuatro === 0
      ? `\n→ Nada em profundidade 4. O limiar 3 é GRÁTIS: não acusa nada a mais hoje, e protege de amanhã.`
      : emQuatro / total > 0.3
        ? `\n→ ${pct(emQuatro)} do site está em 4. Com limiar 3 a métrica vira ruído — quase tudo fica vermelho.`
        : `\n→ ${pct(emQuatro)} em profundidade 4: o limiar 3 gera trabalho real e finito. Dá para ser exigente.`
  );

  // Alimenta a decisão 2 (piso e teto de links por quantidade de palavras): sem a distribuição
  // real, qualquer faixa escrita é chute sobre o site de outra pessoa.
  const { rows: dens } = await cliente.query(
    `SELECT palavras, links_contextuais AS links
       FROM hub_pagina
      WHERE projeto = $1 AND dia = $2::date AND palavras IS NOT NULL AND palavras > 0
      ORDER BY palavras`,
    [slug, c.dia]
  );
  if (dens.length) {
    const por1000 = dens.map((d) => (d.links / d.palavras) * 1000).sort((a, b) => a - b);
    const q = (p) => por1000[Math.min(por1000.length - 1, Math.floor(p * por1000.length))];
    const n1 = (x) => x.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    console.log(`\n── links contextuais por 1.000 palavras (${dens.length} página(s) com texto) ──`);
    console.log(`p25 ${n1(q(0.25))} · mediana ${n1(q(0.5))} · p75 ${n1(q(0.75))} · máx ${n1(por1000[por1000.length - 1])}`);
    console.log(`páginas com ZERO link contextual: ${br(dens.filter((d) => d.links === 0).length)}`);
  }
  console.log("");
} finally {
  await cliente.end();
}
