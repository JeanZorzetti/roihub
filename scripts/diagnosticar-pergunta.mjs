// Por que ESTA pergunta do dourado vai mal? Zero LLM, zero rede, ~1 s.
//
// `avaliar.mjs` dá o percentual e não diz de onde ele vem. Toda vez que uma pergunta zera,
// alguém reescreve à mão a mesma sonda: idf dos tokens, quais o doc-alvo casa, e quem ganhou o
// top-10 no lugar dele. Foi escrita três vezes (01/08, 03/08 manhã, 03/08 tarde) e jogada fora
// três vezes — por isso virou script.
//
//   node scripts/diagnosticar-pergunta.mjs D-73 D-85
//   node scripts/diagnosticar-pergunta.mjs --zeradas     (todas as que não acham nenhuma fonte)
//
// A coluna que decide é `df`, não `idf`: token que está em 30% do corpus não separa nada, e é
// assim que "a pergunta não acha o alvo" pode NÃO ser descasamento de vocabulário — pode ser
// saturação, que tem conserto oposto.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { carregarCorpus } from "../lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "../lib/bm25.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const dourado = JSON.parse(readFileSync(join(RAIZ, "data", "dourado.json"), "utf8"));
const perguntas = dourado.perguntas ?? dourado;

const docs = carregarCorpus();
const indice = indexar(docs);
const porId = new Map(docs.map((d) => [d.id, d]));
const pct = (n) => `${((n / indice.N) * 100).toFixed(0)}%`;

function idf(t) {
  const n = indice.df.get(t) ?? 0;
  return Math.log(1 + (indice.N - n + 0.5) / (n + 0.5));
}

const args = process.argv.slice(2);
const K = 10;
const alvos = args.includes("--zeradas")
  ? perguntas
      .filter((q) => {
        const top = buscar(indice, q.pergunta, K).map((x) => x.id);
        return !q.fontes.some((f) => top.includes(f));
      })
      .map((q) => q.id)
  : args;

if (!alvos.length) {
  console.error("uso: diagnosticar-pergunta.mjs <D-nn> [...] | --zeradas");
  process.exit(1);
}

console.log(`${indice.N} docs · avgdl ${indice.avgdl.toFixed(0)} tokens · ${alvos.length} pergunta(s)`);

for (const q of perguntas.filter((p) => alvos.includes(p.id))) {
  const toks = [...new Set(tokenizar(q.pergunta))];
  console.log(`\n${"=".repeat(78)}\n${q.id} [${q.camada}] ${q.pergunta}`);

  console.log("\n  token          idf    df   % do corpus");
  for (const t of toks.sort((a, b) => idf(b) - idf(a))) {
    const n = indice.df.get(t) ?? 0;
    console.log(`  ${t.padEnd(14)} ${idf(t).toFixed(1).padStart(4)}  ${String(n).padStart(4)}   ${pct(n)}`);
  }

  const top = buscar(indice, q.pergunta, K);
  console.log("\n  alvos do dourado:");
  for (const f of q.fontes) {
    const d = porId.get(f);
    // Fonte que não existe no corpus zera a pergunta sem erro nenhum aparecer — é o primeiro
    // suspeito, e o mais barato de confundir com "o BM25 não achou".
    if (!d) {
      console.log(`    ${f}: 🚩 NÃO EXISTE NO CORPUS`);
      continue;
    }
    const dtok = new Set(tokenizar(d.texto));
    const casa = toks.filter((t) => dtok.has(t));
    const pos = top.findIndex((x) => x.id === f);
    console.log(
      `    ${f}\n      pos=${pos < 0 ? `>${K}` : pos + 1}  casa ${casa.length}/${toks.length}` +
        `  [${casa.map((t) => `${t} ${idf(t).toFixed(1)}`).join(" · ")}]` +
        (casa.length === 0 ? "  🚩 score 0: nenhum ranking alcança" : ""),
    );
  }

  console.log(`\n  top-${K} e o que cada um casa:`);
  for (const [i, x] of top.entries()) {
    const dtok = new Set(tokenizar(porId.get(x.id).texto));
    const casa = toks.filter((t) => dtok.has(t));
    const marca = q.fontes.includes(x.id) ? "✓" : " ";
    console.log(`  ${marca} ${String(i + 1).padStart(2)}. ${x.score.toFixed(2).padStart(6)}  ${x.id}  ← ${casa.join(" ")}`);
  }
}
