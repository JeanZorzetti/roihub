// Mede a recuperação contra data/dourado.json. Sem isto, qualquer ganho de vetor, reranker ou
// grafo é opinião (camada 6 do doc de arquitetura).
//
//   node scripts/avaliar.mjs                      # os três motores
//   node scripts/avaliar.mjs --motor bm25         # só o BM25 (não precisa de Ollama)
//   node scripts/avaliar.mjs --motor hibrido --min 0.85   # exit 1 se recall@10 cair
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { carregarCorpus, MEMORIA_PADRAO } from "../lib/corpus.mjs";
import { indexar, buscar } from "../lib/bm25.mjs";
import { indexarDenso, buscarDenso, MODELO } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";

const KS = [1, 3, 5, 10, 20, 50];
const K_MAX = Math.max(...KS);

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const min = opt("--min", null) && Number(opt("--min"));
const piores = Number(opt("--piores", 10));
const quais = opt("--motor", "todos");

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"));
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
const escolhidos = quais === "todos" ? Object.keys(motores) : [quais];

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
  const { resultados, ms } = await avaliar(motores[nome]);
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

const principal = relatorios[escolhidos.at(-1)];
const ruins = principal.filter((r) => r.recall[10] !== null).sort((a, b) => a.recall[10] - b.recall[10]).slice(0, piores);
console.log(`\npiores ${piores} em recall@10 (${escolhidos.at(-1)}):`);
for (const r of ruins) {
  const top = new Set(r.achados.slice(0, 10));
  console.log(`  ${r.id} ${pct(r.recall[10]).padStart(6)}  perdeu: ${r.alvos.filter((f) => !top.has(f)).join(", ") || "—"}`);
  if (r.recall[10] === 0) console.log(`      "${r.pergunta.slice(0, 90)}"  →  ${r.achados.slice(0, 3).join(", ")}`);
}

if (min) {
  const m = media(principal, 10);
  if (m < min) {
    console.error(`\n✗ recall@10 ${pct(m)} abaixo do piso ${pct(min)}`);
    process.exit(1);
  }
  console.log(`\n✓ recall@10 ${pct(m)} ≥ piso ${pct(min)}`);
}
