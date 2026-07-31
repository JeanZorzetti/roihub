// Lado denso da recuperação: embedding local via Ollama (custo zero de token, restrição do doc
// de arquitetura). Só a paráfrase justifica isto — o BM25 já resolve termo literal.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const MODELO = process.env.EMBED_MODEL ?? "nomic-embed-text";

// Cada família de embedding tem o seu par de prefixos, e trocar os dois derruba a similaridade
// sem erro nenhum: nomic separa documento de consulta por prefixo literal; qwen3 embeda o
// documento cru e põe a instrução só na consulta.
const PREFIXOS = MODELO.startsWith("qwen3")
  ? { doc: "", consulta: "Instruct: Dada uma pergunta, recupere os documentos que a respondem\nQuery: " }
  : { doc: "search_document: ", consulta: "search_query: " };
// Cache por modelo: misturar vetores de modelos diferentes no mesmo arquivo é lixo silencioso.
// join(dirname(...)) e não new URL("../.cache/…", import.meta.url): sob o Turbopack o segundo
// devolve um objeto que o fileURLToPath recusa, e a aba /busca cai em 500 já na importação —
// mesmo sem usar o cache, porque a constante é avaliada no carregamento do módulo.
const CACHE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".cache",
  `embeddings-${MODELO.replace(/\W/g, "_")}.json`,
);

// Handoff mediano tem 9 mil caracteres e o maior tem 23 mil: embedar o doc inteiro dilui o
// trecho que responde. Protocolo (780) cabe num pedaço só e não é cortado.
const MAX = 900;

export function chunkar(doc) {
  const partes = [];
  let atual = "";
  for (const par of doc.texto.split(/\n{2,}/)) {
    if (atual && atual.length + par.length > MAX) {
      partes.push(atual);
      atual = "";
    }
    atual = atual ? `${atual}\n\n${par}` : par;
    while (atual.length > MAX * 2) {
      partes.push(atual.slice(0, MAX));
      atual = atual.slice(MAX);
    }
  }
  if (atual.trim()) partes.push(atual);
  // O título vai em todo pedaço: sem ele o chunk do meio de um handoff perde de que projeto fala.
  return partes.map((texto, i) => ({ id: doc.id, tipo: doc.tipo, i, texto: `${doc.titulo}\n${texto}` }));
}

const chave = (texto) => createHash("sha1").update(`${MODELO}\n${texto}`).digest("hex");

// timeout explícito: sem ele o fetch do Node só desiste em 300s (headersTimeout do undici), e uma
// busca da aba ficaria cinco minutos pendurada num Ollama fora do ar em vez de cair para o BM25.
async function ollamaEmbed(entradas, timeoutMs = 180_000) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, input: entradas }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`ollama ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).embeddings;
}

function lerCache() {
  if (!existsSync(CACHE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE, "utf8"));
  } catch {
    return {}; // cache corrompido se refaz sozinho; não vale derrubar a avaliação por isso
  }
}

// Embeda o que faltar e grava. Lote 8 porque o fetch do Node desiste em 300s (headersTimeout do
// undici) e o qwen3-embedding na VPS leva segundos por chunk: lote grande estoura o teto.
export async function embedar(textos, { prefixo = PREFIXOS.doc, lote = 8 } = {}) {
  const cache = lerCache();
  const faltando = [...new Set(textos.map((t) => prefixo + t))].filter((t) => !cache[chave(t)]);
  if (faltando.length) mkdirSync(dirname(CACHE), { recursive: true });
  for (let i = 0; i < faltando.length; i += lote) {
    const fatia = faltando.slice(i, i + lote);
    const vs = await ollamaEmbed(fatia);
    fatia.forEach((t, j) => (cache[chave(t)] = vs[j]));
    // Grava a cada lote: o corpus inteiro leva ~40 min de CPU, e salvar só no fim faz qualquer
    // interrupção jogar tudo fora.
    writeFileSync(CACHE, JSON.stringify(cache));
    if (process.env.EMBED_VERBOSE) console.error(`embedando ${Math.min(i + lote, faltando.length)}/${faltando.length}`);
  }
  return textos.map((t) => cache[chave(prefixo + t)]);
}

// Cosseno com as normas na conta: nem todo modelo devolve vetor normalizado, e produto interno
// sobre vetor não normalizado ranqueia por tamanho do vetor — erra em silêncio.
const cosseno = (a, b) => {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
};

export async function indexarDenso(docs) {
  const chunks = docs.flatMap(chunkar);
  const vetores = await embedar(chunks.map((c) => c.texto));
  return { chunks, vetores };
}

// A consulta não passa pelo cache em produção: gravar 13 MB de disco a cada busca da aba seria
// pagar o custo da indexação inteira por pergunta. A avaliação liga o cache porque repete as
// mesmas 78 perguntas a cada rodada.
export async function embedarConsulta(consulta, { cache = false, timeoutMs = 10_000 } = {}) {
  if (cache) return (await embedar([consulta], { prefixo: PREFIXOS.consulta }))[0];
  return (await ollamaEmbed([PREFIXOS.consulta + consulta], timeoutMs))[0];
}

export async function buscarDenso(indice, consulta, k = 10, opcoes = {}) {
  const q = await embedarConsulta(consulta, opcoes);
  const melhor = new Map();
  indice.chunks.forEach((c, i) => {
    const s = cosseno(q, indice.vetores[i]);
    // Doc pontua pelo melhor pedaço: um handoff de 20 chunks não pode ganhar por média.
    if (s > (melhor.get(c.id)?.score ?? -1)) melhor.set(c.id, { id: c.id, tipo: c.tipo, score: s });
  });
  return [...melhor.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
}
