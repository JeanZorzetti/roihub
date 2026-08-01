// Imprime as perguntas de camada `estado` do dourado APURADAS na fonte viva, com a fonte de
// cada número. É o gabarito que não apodrece: `data/dourado.json` guarda as 70 de protocolo e
// episódio (regra não muda sozinha) e estas são avaliadas na hora da medição.
//
//   node --env-file=.env scripts/dourado-estado.mjs                 # só o que sai de arquivo
//   node --env-file=.env scripts/dourado-estado.mjs --estado tudo   # inclui GitHub e GSC
//   node --env-file=.env scripts/dourado-estado.mjs --estado caro   # + inventários de 35 sites/repos
//   node --env-file=.env scripts/dourado-estado.mjs --diff          # apurado × dourado escrito
//
// Zero LLM: é rede e leitura de arquivo, como o conformidade.mjs. Não divide pool com a busca.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { apurarEstado, APURADORES } from "../lib/dourado-estado.mjs";
import { consultarGsc } from "../lib/gsc-consulta.mjs";

const modo = process.argv.includes("--estado") ? process.argv[process.argv.indexOf("--estado") + 1] : "offline";

const apurados = await apurarEstado({ modo, gsc: consultarGsc });

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"));
const porId = new Map(dourado.map((q) => [q.id, q]));

let ok = 0;
let faltando = 0;
for (const [id, a] of Object.entries(apurados)) {
  const q = porId.get(id);
  const custo = APURADORES[id].rede ? ` (${APURADORES[id].rede})` : "";
  console.log(`\n${id}${custo}  ${q?.pergunta ?? ""}`);
  if (a.nao_apurado) {
    faltando += 1;
    console.log(`  ⃠ NÃO APURADO — ${a.nao_apurado}`);
    if (a.resposta) console.log(`  parcial: ${a.resposta}`);
  } else {
    ok += 1;
    console.log(`  ✓ ${a.resposta}`);
    if (a.ressalva) console.log(`  ressalva da medição: ${a.ressalva}`);
    console.log(`  fonte: ${a.fonte}  ·  apurado em ${a.apurado_em}`);
  }
  // O dourado escrito ao lado do apurado é a comparação B em miniatura: o que a casa afirma
  // contra o que a fonte viva devolve. Sem LLM e sem custo — ler os dois é o trabalho.
  if (process.argv.includes("--diff") && q) console.log(`  dourado escrito: ${q.resposta}`);
}

console.log(`\n── ${ok} apuradas, ${faltando} não apuradas (modo ${modo})`);
console.log("⃠ não é reprovação: é 'não olhei' ou 'não há onde olhar'. Nenhuma delas vale como gabarito.");
