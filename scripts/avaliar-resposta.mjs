// Mede a SÍNTESE, não a recuperação. `scripts/avaliar.mjs` responde "o doc certo está entre os
// 10?"; este responde "a resposta escrita aponta para o doc certo?".
//
//   node --env-file=.env scripts/avaliar-resposta.mjs --limite 5   # itera barato antes das 78
//   node --env-file=.env scripts/avaliar-resposta.mjs
//
// O QUE ISTO NÃO MEDE: verdade. Uma resposta pode citar a fonte certa e resumi-la errado, e
// ancoragem 100% sobre um corpus com afirmação errada é acesso rápido à resposta errada — o
// problema que o handoff de 31/07 lista como o 3º e o único sem métrica. Julgar o conteúdo
// exigiria um juiz LLM (mais 78 chamadas por corrida) e um juiz que não vê a realidade só
// mediria concordância com o dourado. O que dá para medir de graça, e é o que este script mede:
// a resposta existe, ela cita, e a citação aponta para uma fonte que o dourado reconhece.
//
// Custo: 1 chamada de claude-cli por pergunta ALÉM do rerank. Com `.cache/rerank.json` morno o
// rerank sai de graça e só a síntese gasta pool. Corrida morta retoma de onde parou.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { carregarCorpus, MEMORIA_PADRAO } from "../lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "../lib/bm25.mjs";
import { indexarDenso, buscarDenso } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";
import { rerank, trechoRelevante } from "../lib/reranker.mjs";
import { responder, trechosPara } from "../lib/resposta.mjs";

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const limite = Number(opt("--limite", 0));
const K = 10;
const CANDIDATOS = 50;

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"))
  .slice(0, limite || undefined);
const docs = carregarCorpus();
const porId = new Map(docs.map((d) => [d.id, d]));
const tipos = docs.reduce((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});
console.log(`corpus: ${docs.length} docs (${Object.entries(tipos).map(([t, n]) => `${n} ${t}`).join(", ")})`);
if (!tipos.memoria) console.log(`⚠️  sem memórias (${MEMORIA_PADRAO} não existe) — metade do corpus está fora`);

const ixBM25 = indexar(docs);
const ixDenso = await indexarDenso(docs);
console.log(`síntese: 1 chamada de claude-cli por pergunta (${dourado.length}), além do rerank\n`);

// O MESMO caminho da aba: fusão → rerank → top-10 → síntese. Medir a síntese sobre uma lista
// montada de outro jeito não diria nada sobre o que está no ar.
async function top10(pergunta) {
  const base = rrf(
    [buscar(ixBM25, pergunta, CANDIDATOS), await buscarDenso(ixDenso, pergunta, CANDIDATOS, { cache: true })],
    { k: CANDIDATOS },
  );
  const termos = tokenizar(pergunta);
  const candidatos = base
    .filter((r) => porId.has(r.id))
    .map((r) => {
      const d = porId.get(r.id);
      return { id: r.id, tipo: d.tipo, titulo: d.titulo, trecho: trechoRelevante(d.texto, termos) };
    });
  const { itens } = await rerank(pergunta, candidatos, { cache: true });
  return { ids: itens.slice(0, K).map((c) => c.id), termos };
}

const linhas = [];
for (const q of dourado) {
  const { ids, termos } = await top10(q.pergunta);
  const r = await responder(q.pergunta, trechosPara(ids.map((id) => porId.get(id)), termos), { cache: true });
  const alvos = new Set(q.fontes.filter((f) => porId.has(f)));
  // Teto honesto: se nenhuma fonte do dourado entrou no top-10, não havia o que citar certo —
  // sem separar isso, falha de RECUPERAÇÃO seria contada como falha de SÍNTESE.
  const tinha = ids.some((id) => alvos.has(id));
  const citadas = r.fontes.map((n) => ids[n - 1]);
  linhas.push({ q, r, tinha, ancorada: citadas.some((id) => alvos.has(id)), citadas, ids });
  // Número não pega resposta FLUENTE e errada — ancoragem 100% com o resumo trocado marca certo.
  // Ler as respostas é a única checagem que pega isso, e sem `--ver` ela custaria outro script.
  if (process.argv.includes("--ver")) {
    console.log(`\n${q.id} ${q.pergunta}\n  → ${r.texto || `(vazio${r.erro ? `: ${r.erro}` : ": recusou"})`}`);
    console.log(`  citou: ${citadas.join(", ") || "—"}   esperado: ${q.fontes.join(", ")}`);
  }
}

const pct = (n, d) => `${d ? ((n / d) * 100).toFixed(1) : "0.0"}%`;
const respondidas = linhas.filter((l) => l.r.texto);
const recusas = linhas.filter((l) => !l.r.texto && !l.r.erro);
const falhas = linhas.filter((l) => l.r.erro);
const comMaterial = linhas.filter((l) => l.tinha);

console.log(`── síntese — ${linhas.length} perguntas`);
console.log(`respondeu       ${pct(respondidas.length, linhas.length).padStart(7)}  (${respondidas.length})`);
console.log(`recusou         ${pct(recusas.length, linhas.length).padStart(7)}  (${recusas.length})`);
console.log(`suprimida/erro  ${pct(falhas.length, linhas.length).padStart(7)}  (${falhas.length})`);
console.log(`\ntop-10 tinha fonte do dourado  ${pct(comMaterial.length, linhas.length).padStart(7)}   ← teto da síntese`);
console.log(`citação ancorada (respondidas) ${pct(respondidas.filter((l) => l.ancorada).length, respondidas.length).padStart(7)}`);
console.log(
  `citação ancorada (com material) ${pct(
    comMaterial.filter((l) => l.r.texto && l.ancorada).length,
    comMaterial.length,
  ).padStart(6)}   ← o número que mede a síntese`,
);

// Respondeu citando SÓ doc que o dourado não reconhece, tendo a fonte certa na mão: é a falha
// cara, porque a resposta sai fluente e conferível-parecendo. Listada com nome para inspeção.
const desancoradas = comMaterial.filter((l) => l.r.texto && !l.ancorada);
if (desancoradas.length) {
  console.log(`\ntinha a fonte no top-10 e citou outra coisa (${desancoradas.length}):`);
  for (const l of desancoradas) {
    console.log(`  ${l.q.id}  citou: ${l.citadas.join(", ") || "—"}`);
    console.log(`      esperado: ${l.q.fontes.join(", ")}`);
  }
}
const recusouComMaterial = comMaterial.filter((l) => !l.r.texto && !l.r.erro);
if (recusouComMaterial.length) {
  console.log(`\nrecusou com a fonte no top-10 (${recusouComMaterial.length}): ${recusouComMaterial.map((l) => l.q.id).join(", ")}`);
}
if (falhas.length) {
  const conta = falhas.reduce((a, l) => ({ ...a, [l.r.erro]: (a[l.r.erro] ?? 0) + 1 }), {});
  console.log(`\n⚠️  ${falhas.length} respostas suprimidas: ${JSON.stringify(conta)}`);
}
