// BM25 puro, sem dependência e sem índice externo: o corpus tipado tem ~260 docs, e indexar
// tudo do zero leva milissegundos. tsvector/pgvector entram quando o número medido no dourado
// mostrar que este piso não basta — antes disso seriam infra sem evidência.

const ACENTO = /[̀-ͯ]/g;

export function tokenizar(texto) {
  const t = texto.normalize("NFD").replace(ACENTO, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  // Token de 1 letra não separa nada e infla o comprimento do doc, que é o denominador do BM25.
  return t.filter((x) => x.length > 1);
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
