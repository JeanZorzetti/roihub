// A TAXA DE ERRO DO CORPUS — o número que a frente do dourado com lastro externo existe para
// produzir. Para cada pergunta de `estado` com apuração de verdade, pega os documentos que a
// busca recupera e pergunta, um a um: o que este documento afirma ainda bate com a fonte viva?
//
//   node --env-file=.env scripts/corpus-defasado.mjs            # todas as apuráveis
//   node --env-file=.env scripts/corpus-defasado.mjs --ids D-66  # recorte
//   node --env-file=.env scripts/corpus-defasado.mjs --k 5       # menos documentos por pergunta
//
// Custo: 1 chamada por DOCUMENTO (~10 por pergunta), fora o rerank. Cache morno retoma corrida
// morta. É caro e é o único jeito de sair do anedótico: hoje há duas provas de corpus defasado
// achadas por acidente e nenhuma medida.
//
// A saída é uma LISTA NOMINAL, não um percentual: cada linha é uma edição de memória ou handoff.
// Se o percentual vier alto, a conclusão NÃO é "melhorar o prompt da síntese" — é que a memória
// institucional precisa de data de validade.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarCorpus } from "../lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "../lib/bm25.mjs";
import { indexarDenso, buscarDenso } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";
import { rerank, trechoRelevante, rodarClaude, rodarCacheado, falhasDeConta, MAX_CONTA_SEGUIDAS } from "../lib/reranker.mjs";
import { apurarEstado } from "../lib/dourado-estado.mjs";
import { consultarGsc } from "../lib/gsc-consulta.mjs";
import { montarPromptDefasagem, parseDefasagem } from "../lib/defasagem.mjs";

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const ids = String(opt("--ids", "")).split(",").map((s) => s.trim()).filter(Boolean);
const K = Number(opt("--k", 10));
const CANDIDATOS = 50;
// Orçamento por documento maior que o do reranker (900): aqui a pergunta é se o documento
// AFIRMA algo, e recorte curto num handoff de 9 mil chars esconde a afirmação — o mesmo viés
// contra doc longo que derrubou o `fonte@10` de handoff para 28,3% na fase do reranker.
const ORCAMENTO = 2400;

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"));
const porPergunta = new Map(dourado.map((q) => [q.id, q]));

const apurados = await apurarEstado({ modo: "tudo", gsc: consultarGsc });
// Só pergunta com apuração de verdade entra. `nao_apurado` não é reprovação nem aprovação: é
// "não há fonte viva contra o que comparar", e comparar documento com prosa seria a régua velha.
const alvos = Object.entries(apurados).filter(([id, a]) => !a.nao_apurado && (!ids.length || ids.includes(id)));
const fora = Object.entries(apurados).filter(([, a]) => a.nao_apurado);

console.log(`apuradas: ${alvos.map(([id]) => id).join(", ") || "nenhuma"}`);
console.log(`fora da comparação (sem fonte viva): ${fora.map(([id]) => id).join(", ") || "nenhuma"}`);
if (!alvos.length) {
  console.log("\nNada a comparar. Sem apuração não há comparação B — só a prosa concordando com prosa de sempre.");
  process.exit(1);
}

const docs = carregarCorpus();
const porId = new Map(docs.map((d) => [d.id, d]));
console.log(`corpus: ${docs.length} docs · ${alvos.length} perguntas × ${K} documentos = ~${alvos.length * K} chamadas\n`);
const ixBM25 = indexar(docs);
const ixDenso = await indexarDenso(docs);

// O MESMO caminho da aba: comparar o corpus que OUTRA busca recuperaria não diria nada sobre o
// que a aba serve.
async function topK(pergunta) {
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
  return itens.slice(0, K).map((c) => ({ ...c, trecho: trechoRelevante(porId.get(c.id).texto, termos, ORCAMENTO) }));
}

const linhas = [];
let seguidas = 0;
for (const [id, apurado] of alvos) {
  const pergunta = porPergunta.get(id).pergunta;
  console.log(`${id} ${pergunta}`);
  for (const doc of await topK(pergunta)) {
    const prompt = montarPromptDefasagem(pergunta, apurado, doc);
    let v;
    try {
      v = parseDefasagem(await rodarCacheado(prompt, (p) => rodarClaude(p, { effort: "medium" }), true), doc.trecho);
    } catch (err) {
      v = { veredito: "", trecho: "", motivo: "", erro: err.message.replace(/^rerank-/, "defasagem-") };
    }
    linhas.push({ id, pergunta, doc: doc.id, tipo: doc.tipo, titulo: doc.titulo, apurado: apurado.resposta, ...v });
    console.log(`  ${(v.veredito || v.erro).padEnd(9)} ${doc.id}`);
    seguidas = falhasDeConta(seguidas, [v.erro]);
    if (seguidas >= MAX_CONTA_SEGUIDAS) break;
  }
  if (seguidas >= MAX_CONTA_SEGUIDAS) break;
}

// Corrida que perde o pool não publica percentual: número plausível com o instrumento quebrado é
// pior que número nenhum. Mesma regra do `scripts/avaliar-resposta.mjs`.
if (seguidas >= MAX_CONTA_SEGUIDAS) {
  console.log(`\n🚨 corrida ABORTADA: ${MAX_CONTA_SEGUIDAS} falhas de conta seguidas — pool esgotado, nenhum número desta corrida vale.`);
  console.log("   Renove os tokens e rode de novo: o cache morno retoma de onde parou.");
  process.exit(1);
}

const desmentem = linhas.filter((l) => l.veredito === "desmente");
const falam = linhas.filter((l) => l.veredito === "bate" || l.veredito === "desmente");
const erros = linhas.filter((l) => l.erro);

console.log(`\n── ${linhas.length} documentos julgados em ${alvos.length} perguntas de estado`);
console.log(`falam do assunto        ${String(falam.length).padStart(3)}`);
console.log(`DESMENTEM a fonte viva  ${String(desmentem.length).padStart(3)}   ${falam.length ? ((desmentem.length / falam.length) * 100).toFixed(1) : "0.0"}% dos que falam   ← a taxa de erro do corpus`);
if (erros.length) console.log(`sem veredito            ${String(erros.length).padStart(3)}   ${JSON.stringify(erros.reduce((a, l) => ({ ...a, [l.erro]: (a[l.erro] ?? 0) + 1 }), {}))}`);

// Cada linha daqui é uma edição de memória ou handoff. LEIA antes de publicar percentual: das 46
// violações da primeira corrida do conformidade, 5 eram o check errado, não o projeto.
if (desmentem.length) {
  console.log(`\n🚨 documentos que afirmam algo desmentido pela fonte viva (${desmentem.length}) — LEIA um a um:`);
  for (const l of desmentem) {
    console.log(`\n  ${l.doc}  [${l.tipo}]  (${l.id})`);
    console.log(`    diz:     ${l.trecho}`);
    console.log(`    apurado: ${l.apurado}`);
    console.log(`    motivo:  ${l.motivo}`);
  }
}

const agora = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const arq = fileURLToPath(new URL(`../data/corpus-defasado/${agora}.json`, import.meta.url));
mkdirSync(dirname(arq), { recursive: true });
writeFileSync(arq, JSON.stringify({ quando: new Date().toISOString(), apurados, linhas }, null, 2) + "\n");
console.log(`\ngravado em data/corpus-defasado/${agora}.json`);
