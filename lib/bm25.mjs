// BM25 puro, sem dependência e sem índice externo: o corpus tipado tem ~260 docs, e indexar
// tudo do zero leva milissegundos. tsvector/pgvector entram quando o número medido no dourado
// mostrar que este piso não basta — antes disso seriam infra sem evidência.

const ACENTO = /[̀-ͯ]/g;

// A GRAMÁTICA DA PERGUNTA vira o termo mais raro da consulta, e com isso um detector de handoff.
// Medido em 03/08 nas 85 do dourado: `posso` aparece em 9 perguntas com idf 5.5 e existe em UM
// handoff e em ZERO protocolo — sozinho, ele dá a um doc arbitrário um pico que nenhum termo de
// conteúdo alcança. `quantos` (7 perguntas, idf 2.7) está em 29% dos handoffs e 0% dos protocolos;
// `onde` em 70% contra 8%; `ele` em 91% contra 9%. O BM25 estava certo — premia quem tem as
// palavras raras da consulta —, só que as palavras raras eram o registro conversacional, não o
// assunto: por isso a camada `estado` (perguntas em língua natural) saía com 0,0% em @1 enquanto
// `protocolo` (perguntas em jargão) fazia 89,5% em @10.
// Fora da lista de propósito: `nao` (a casa escreve norma como negação e o idf dele é 0,1, então
// não paga o risco), `diz`, `novo` e `proprio` — verbo e adjetivo carregam assunto.
const VAZIOS = new Set(
  ("que qual quais quem quando onde como quanto quanta quantos quantas porque " +
    "os as um uma uns umas ao aos do da dos das no na nos nas pelo pela pelos pelas num numa " +
    "de em por para pra com sem sob sobre entre ate mas ou se nem tambem ja pois entao porem " +
    "ele ela eles elas isso isto aquilo esse essa esses essas este esta estes estas meu minha " +
    "seu sua eu voce me te lhe " +
    "ser estar estao sou sao era eram foi foram seja sendo ter tem temos tinha ha havia " +
    "vai vao vou ir pode podem posso deve devem fazer faz fiz fez " +
    "preciso quero tenho escrevi rodo rodei pergunto terminei devo").split(" "),
);

export function tokenizar(texto) {
  const t = texto.normalize("NFD").replace(ACENTO, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  // Token de 1 letra não separa nada e infla o comprimento do doc, que é o denominador do BM25.
  return t.filter((x) => x.length > 1 && !VAZIOS.has(x));
}

export function indexar(docs) {
  const df = new Map();
  const corpo = [];
  for (const d of docs) {
    const toks = tokenizar(d.texto);
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    corpo.push({ id: d.id, tipo: d.tipo, tf, len: toks.length });
  }
  const avgdl = corpo.length ? corpo.reduce((a, d) => a + d.len, 0) / corpo.length : 0;
  return { N: corpo.length, avgdl, df, corpo };
}

const K1 = 1.5;
const B = 0.75;

export function buscar(indice, consulta, k = 10) {
  const termos = new Set(tokenizar(consulta));
  const idf = new Map();
  for (const t of termos) {
    const n = indice.df.get(t) ?? 0;
    idf.set(t, Math.log(1 + (indice.N - n + 0.5) / (n + 0.5)));
  }
  const achados = [];
  for (const d of indice.corpo) {
    let score = 0;
    for (const t of termos) {
      const f = d.tf.get(t);
      if (!f) continue;
      score += idf.get(t) * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / (indice.avgdl || 1))));
    }
    if (score > 0) achados.push({ id: d.id, tipo: d.tipo, score });
  }
  // Desempate por id: avaliação que muda de número entre runs não mede nada.
  achados.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return achados.slice(0, k);
}
