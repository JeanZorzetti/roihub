// Mede a recuperação contra data/dourado.json. Sem isto, qualquer ganho de vetor, reranker ou
// grafo é opinião (camada 6 do doc de arquitetura).
//
//   node scripts/avaliar.mjs                      # os três motores
//   node scripts/avaliar.mjs --motor bm25         # só o BM25 (não precisa de Ollama)
//   node scripts/avaliar.mjs --motor hibrido --min bm25   # exit 1 se o vetor não pagar o custo
//   node scripts/avaliar.mjs --motor hibrido --min 0.85   # piso absoluto (decai: veja o § no fim)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { carregarCorpus, MEMORIA_PADRAO } from "../lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "../lib/bm25.mjs";
import { indexarDenso, buscarDenso, MODELO } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";
import { rerank, trechoRelevante, MODELO_RERANK, falhasDeConta, MAX_CONTA_SEGUIDAS } from "../lib/reranker.mjs";

const KS = [1, 3, 5, 10, 20, 50];
const K_MAX = Math.max(...KS);

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const minArg = opt("--min", null);
const piores = Number(opt("--piores", 10));
const quais = opt("--motor", "todos");
// O rerank gasta 1 chamada de claude-cli por pergunta: 78 perguntas são ~15 min de pool. Poder
// medir 5 antes de gastar as 78 é a diferença entre iterar e esperar.
const limite = Number(opt("--limite", 0));

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"))
  .slice(0, limite || undefined);
const docs = carregarCorpus();
const ids = new Set(docs.map((d) => d.id));
const tipoDe = new Map(docs.map((d) => [d.id, d.tipo]));

const tipos = docs.reduce((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});
console.log(`corpus: ${docs.length} docs (${Object.entries(tipos).map(([t, n]) => `${n} ${t}`).join(", ")})`);
if (!tipos.memoria) console.log(`⚠️  sem memórias (${MEMORIA_PADRAO} não existe) — o recall abaixo mede meio corpus`);

const ixBM25 = indexar(docs);
const motores = { bm25: async (q) => buscar(ixBM25, q, K_MAX) };
if (quais !== "bm25") {
  const ixDenso = await indexarDenso(docs);
  console.log(`denso: ${ixDenso.chunks.length} chunks, ${MODELO}`);
  motores.denso = (q) => buscarDenso(ixDenso, q, K_MAX, { cache: true });
  motores.hibrido = async (q) =>
    rrf([buscar(ixBM25, q, K_MAX), await buscarDenso(ixDenso, q, K_MAX, { cache: true })], { k: K_MAX });
}
// O rerank custa 1 chamada de claude-cli por pergunta, então NUNCA entra no "todos" — entrar por
// acidente queimaria o pool que o autopublishing divide. Quando pedido, roda junto com bm25 e
// híbrido: comparar reranker com um baseline medido noutro dia não vale nada (o número absoluto
// não reproduz entre sessões — ver o piso mais abaixo).
const falhasRerank = [];
// Este script era o ÚNICO consumidor do pool sem o aborto que `avaliar-resposta.mjs`,
// `defasagem-calibrar.mjs` e `corpus-defasado.mjs` já tinham — e o preço saiu medido duas vezes:
// em 02/08 a corrida do portão imprimiu 77,7% com 42/85 reranks caídos na fusão e em 02/08 à noite
// 77,4% com 59/85, os dois números uma MISTURA de reranqueado com híbrido puro que não se compara
// com nada. O aviso ficava ao lado do percentual, e aviso perde para percentual.
let seguidasConta = 0;
if (quais === "rerank") {
  const porId = new Map(docs.map((d) => [d.id, d]));
  motores.rerank = async (consulta) => {
    const base = await motores.hibrido(consulta);
    const termos = tokenizar(consulta);
    const candidatos = base.slice(0, 50).map((r) => {
      const d = porId.get(r.id);
      return { id: r.id, tipo: d.tipo, titulo: d.titulo, trecho: trechoRelevante(d.texto, termos) };
    });
    const { itens, ok, erro } = await rerank(consulta, candidatos, { cache: true });
    if (!ok) falhasRerank.push(erro);
    // Zera em qualquer sucesso: conta que morre e volta é rotação normal do pool (`falhasDeConta`).
    seguidasConta = falhasDeConta(seguidasConta, [ok ? null : erro]);
    // A cauda além de 50 fica onde estava: o reranker só reordena o que recebeu.
    return [...itens, ...base.slice(50)];
  };
  console.log(`rerank: claude-cli ${MODELO_RERANK}, 1 chamada por pergunta (${dourado.length})`);
}
const escolhidos = quais === "todos" ? Object.keys(motores) : quais === "rerank" ? ["bm25", "hibrido", "rerank"] : [quais];

async function avaliar(buscarFn) {
  const t0 = Date.now();
  const resultados = [];
  for (const q of dourado) {
    const achados = (await buscarFn(q.pergunta)).map((r) => r.id);
    // Fonte fora do corpus não é falha de recuperação, é doc não carregado: contar como miss
    // faria o número mentir para baixo.
    const alvos = q.fontes.filter((f) => ids.has(f));
    const recall = Object.fromEntries(
      KS.map((k) => {
        const top = new Set(achados.slice(0, k));
        return [k, alvos.length ? alvos.filter((f) => top.has(f)).length / alvos.length : null];
      }),
    );
    resultados.push({ ...q, achados, alvos, fora: q.fontes.filter((f) => !ids.has(f)), recall });
    if (seguidasConta >= MAX_CONTA_SEGUIDAS) return { resultados, ms: Date.now() - t0, abortada: true };
  }
  return { resultados, ms: Date.now() - t0 };
}

const media = (lista, k) => {
  const v = lista.map((r) => r.recall[k]).filter((x) => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};
const pct = (x) => `${(x * 100).toFixed(1)}%`;

const relatorios = {};
for (const nome of escolhidos) {
  const { resultados, ms, abortada } = await avaliar(motores[nome]);
  // Nenhum agregado sai daqui, nem com o aviso ao lado: corrida que perde o pool não mede o
  // reranker, mede a fusão com outro nome. O `.cache/rerank.json` guarda o que já respondeu, então
  // retomar com o pool cheio não repaga as chamadas que deram certo.
  if (abortada) {
    console.error(
      `\n🚨 corrida ABORTADA em ${resultados.length}/${dourado.length} (motor ${nome}): ` +
        `${MAX_CONTA_SEGUIDAS} falhas de conta seguidas — pool esgotado, nenhum número desta corrida vale.`,
    );
    process.exit(1);
  }
  relatorios[nome] = resultados;
  const fora = resultados.reduce((a, r) => a + r.fora.length, 0);
  console.log(`\n── ${nome} — ${dourado.length} perguntas, ${ms} ms${fora ? `, ${fora} fontes fora do corpus` : ""}`);
  console.log("recall@k  " + KS.map((k) => `@${k}`.padStart(7)).join(""));
  console.log("todas     " + KS.map((k) => pct(media(resultados, k)).padStart(7)).join(""));
  for (const camada of ["protocolo", "estado", "episodio"]) {
    const lista = resultados.filter((r) => r.camada === camada);
    console.log(camada.padEnd(10) + KS.map((k) => pct(media(lista, k)).padStart(7)).join("") + `   (${lista.length})`);
  }
  // Por tipo de fonte: um motor pode ir bem no agregado e ser cego a uma família inteira de doc.
  const porTipo = ["protocolo", "handoff", "memoria"].map((tipo) => {
    const acertos = resultados
      .map((r) => ({ r, alvos: r.alvos.filter((f) => tipoDe.get(f) === tipo) }))
      .filter(({ alvos }) => alvos.length)
      .map(({ r, alvos }) => {
        const top = new Set(r.achados.slice(0, 10));
        return alvos.filter((f) => top.has(f)).length / alvos.length;
      });
    return `${tipo} ${pct(acertos.reduce((a, b) => a + b, 0) / (acertos.length || 1))}`;
  });
  console.log(`fonte@10  ${porTipo.join("   ")}`);
}

if (falhasRerank.length) {
  // Reranker que falha devolve a ordem da fusão, então o número acima vira uma mistura de
  // "reranqueado" com "híbrido puro" — sem isto impresso, uma queda por falha de CLI passaria
  // por queda de qualidade do reranking.
  const conta = falhasRerank.reduce((a, e) => ({ ...a, [e]: (a[e] ?? 0) + 1 }), {});
  console.log(`\n⚠️  ${falhasRerank.length}/${dourado.length} reranks falharam e caíram para a fusão: ${JSON.stringify(conta)}`);
}

const principal = relatorios[escolhidos.at(-1)];
const ruins = principal.filter((r) => r.recall[10] !== null).sort((a, b) => a.recall[10] - b.recall[10]).slice(0, piores);
console.log(`\npiores ${piores} em recall@10 (${escolhidos.at(-1)}):`);
for (const r of ruins) {
  const top = new Set(r.achados.slice(0, 10));
  console.log(`  ${r.id} ${pct(r.recall[10]).padStart(6)}  perdeu: ${r.alvos.filter((f) => !top.has(f)).join(", ") || "—"}`);
  if (r.recall[10] === 0) console.log(`      "${r.pergunta.slice(0, 90)}"  →  ${r.achados.slice(0, 3).join(", ")}`);
}

if (minArg) {
  const m = media(principal, 10);
  // Piso absoluto não reproduz entre sessões: em 31/07 o híbrido deu 82,4% contra os 83,0% da
  // fase 3 nos MESMOS 259 docs, sem uma linha de código mudar (medido com e sem os 4 docs novos:
  // idêntico, 0 pergunta afetada — não é o corpus crescer, é handoff e memória serem reescritos
  // toda sessão, o que mexe em vetor e IDF). `--min bm25` compara com o BM25 da mesma execução e
  // mesmo corpus: as duas metades sofrem a mesma deriva, então a diferença sobrevive a ela.
  const min =
    minArg === "bm25" ? media(relatorios.bm25 ?? (await avaliar(motores.bm25)).resultados, 10) : Number(minArg);
  if (m < min) {
    console.error(`\n✗ recall@10 ${pct(m)} abaixo do piso ${pct(min)}`);
    process.exit(1);
  }
  console.log(`\n✓ recall@10 ${pct(m)} ≥ piso ${pct(min)}`);
}
