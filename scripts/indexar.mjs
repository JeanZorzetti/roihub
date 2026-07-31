// Calcula os vetores do corpus e grava no Postgres, de onde a aba /busca lê.
// Roda de máquina com Ollama, NUNCA no container: são ~35 min de CPU.
//
//   node --env-file=.env scripts/indexar.mjs
//
// O cache em .cache/ faz a segunda rodada custar só os chunks novos.
import { carregarCorpus } from "../lib/corpus.mjs";
import { indexarDenso, MODELO } from "../lib/denso.mjs";
import { salvarCorpus, salvarVetores } from "../lib/corpus-db.mjs";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL ausente — rode com --env-file=.env");
  process.exit(1);
}

const docs = carregarCorpus();
const tipos = docs.reduce((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});
console.log(`corpus: ${docs.length} docs (${Object.entries(tipos).map(([t, n]) => `${n} ${t}`).join(", ")})`);
// A aba lê o que este script gravar. Indexar sem as memórias apaga 123 documentos do índice em
// produção sem nenhum erro aparecer — por isso é bloqueio, não aviso.
if (!tipos.memoria) {
  console.error("sem memórias no corpus: MEMORIA_DIR não aponta para a pasta de memórias");
  process.exit(1);
}

const t0 = Date.now();
const { chunks, vetores } = await indexarDenso(docs);
console.log(`${chunks.length} chunks embedados com ${MODELO} em ${Math.round((Date.now() - t0) / 1000)}s`);

const n = await salvarVetores(MODELO, chunks, vetores);
console.log(`✓ ${n} vetores gravados em hub_embeddings (modelo ${MODELO})`);

// O texto vai junto: o container não tem a pasta de memórias, e vetor sem texto devolve id que
// a aba não sabe renderizar.
console.log(`✓ ${await salvarCorpus(docs)} documentos gravados em hub_corpus`);
process.exit(0);
