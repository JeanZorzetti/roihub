// A TAXA DE ERRO DO CORPUS — o número que a frente do dourado com lastro externo existe para
// produzir. Para cada pergunta de `estado` com apuração de verdade, pega os documentos que a
// busca recupera e pergunta, um a um: o que este documento afirma ainda bate com a fonte viva?
//
//   node --env-file=.env scripts/corpus-defasado.mjs            # todas as apuráveis
//   node --env-file=.env scripts/corpus-defasado.mjs --ids D-66  # recorte
//   node --env-file=.env scripts/corpus-defasado.mjs --k 5       # menos documentos por pergunta
//
// SÃO DUAS VIAS DE SELEÇÃO desde 01/08, e a segunda existe porque a primeira sozinha é o gargalo
// do produto: a busca recupera por SEMELHANÇA DE TEMA, então número defasado citado de passagem
// num documento sobre outro assunto nunca chega ao detector. A 2ª via (`docsQueCitam`) traz quem
// CITA a quantidade com outro número — zero LLM, zero rede, e o custo é 1 chamada por documento
// novo (medido: 8 documentos, contra 43 se a âncora fosse `(\d+) projetos` solto).
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
import { montarPromptDefasagem, parseDefasagem, docsQueCitam } from "../lib/defasagem.mjs";

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

// `trechoRelevante` procura os termos no texto sem acento e em minúscula (`reranker.mjs:41`).
// Mandar o casamento como termo é o que faz a janela do recorte cair EM CIMA da citação em vez do
// começo do documento — num handoff de 9 mil chars a citação ficaria fora do orçamento, o modelo
// não teria o que copiar e o achado cairia como `defasagem-citacao`.
const comoTermo = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A 2ª via: documentos que CITAM o número do fato com valor diferente, mesmo falando de outro
// assunto. Só os que a busca não trouxe — documento já no top-K não é julgado duas vezes.
function porCitacao(apurado, jaVistos) {
  return docsQueCitam(docs.filter((d) => !jaVistos.has(d.id)), apurado.citacoes).map(({ doc, casamentos }) => ({
    id: doc.id,
    tipo: doc.tipo,
    titulo: doc.titulo,
    trecho: trechoRelevante(doc.texto, casamentos.map(comoTermo), ORCAMENTO),
    via: "citacao",
  }));
}

const linhas = [];
let seguidas = 0;
for (const [id, apurado] of alvos) {
  const pergunta = porPergunta.get(id).pergunta;
  console.log(`${id} ${pergunta}`);
  const daBusca = (await topK(pergunta)).map((d) => ({ ...d, via: "busca" }));
  const daCitacao = porCitacao(apurado, new Set(daBusca.map((d) => d.id)));
  if (daCitacao.length) console.log(`  + ${daCitacao.length} pela 2ª via (citam o número e a busca não trouxe)`);
  for (const doc of [...daBusca, ...daCitacao]) {
    const prompt = montarPromptDefasagem(pergunta, apurado, doc);
    let v;
    try {
      v = parseDefasagem(await rodarCacheado(prompt, rodarClaude, true, { effort: "medium" }), doc.trecho);
    } catch (err) {
      v = { veredito: "", trecho: "", motivo: "", erro: err.message.replace(/^rerank-/, "defasagem-") };
    }
    linhas.push({ id, pergunta, doc: doc.id, tipo: doc.tipo, titulo: doc.titulo, via: doc.via, apurado: apurado.resposta, ...v });
    console.log(`  ${(v.veredito || v.erro).padEnd(9)} ${doc.id}${doc.via === "citacao" ? "  (2ª via)" : ""}`);
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

// O PERCENTUAL SAI SÓ DA BUSCA, e isto é o que impede a 2ª via de estragar a única régua que
// aponta para fora do texto. A 2ª via seleciona documento cujo número JÁ diverge do apurado: ela
// é amostra procurada, não recuperada. Somá-la ao denominador publicaria uma "taxa de erro do
// corpus" que sobe sozinha toda vez que a busca de citação melhorar — o número mediria a consulta,
// não o corpus. A lista nominal, essa sim, junta as duas: lá cada linha é uma edição, e de onde o
// documento veio não muda o trabalho que ele dá.
const daBusca = linhas.filter((l) => l.via === "busca");
const daCitacao = linhas.filter((l) => l.via === "citacao");
const desmentem = linhas.filter((l) => l.veredito === "desmente");
const falam = daBusca.filter((l) => l.veredito === "bate" || l.veredito === "desmente");
const desmentemBusca = daBusca.filter((l) => l.veredito === "desmente");
const erros = linhas.filter((l) => l.erro);

console.log(`\n── ${linhas.length} documentos julgados em ${alvos.length} perguntas de estado (${daBusca.length} pela busca, ${daCitacao.length} pela 2ª via)`);
console.log(`falam do assunto        ${String(falam.length).padStart(3)}   (só os da busca)`);
console.log(`DESMENTEM a fonte viva  ${String(desmentemBusca.length).padStart(3)}   ${falam.length ? ((desmentemBusca.length / falam.length) * 100).toFixed(1) : "0.0"}% dos que falam   ← a taxa de erro do corpus`);
if (daCitacao.length) {
  const d2 = daCitacao.filter((l) => l.veredito === "desmente").length;
  console.log(`2ª via (citação)        ${String(daCitacao.length).padStart(3)}   ${d2} desmentem — FORA do percentual: seleção procurada não é amostra`);
}
if (erros.length) console.log(`sem veredito            ${String(erros.length).padStart(3)}   ${JSON.stringify(erros.reduce((a, l) => ({ ...a, [l.erro]: (a[l.erro] ?? 0) + 1 }), {}))}`);

// Cada linha daqui é uma edição de memória ou handoff. LEIA antes de publicar percentual: das 46
// violações da primeira corrida do conformidade, 5 eram o check errado, não o projeto.
if (desmentem.length) {
  console.log(`\n🚨 documentos que afirmam algo desmentido pela fonte viva (${desmentem.length}) — LEIA um a um:`);
  for (const l of desmentem) {
    console.log(`\n  ${l.doc}  [${l.tipo}]  (${l.id})${l.via === "citacao" ? "  ← 2ª via: a busca não trouxe este documento" : ""}`);
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
