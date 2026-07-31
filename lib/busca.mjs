// Reciprocal Rank Fusion: junta rankings sem precisar que os scores sejam comparáveis — BM25
// devolve dezenas, cosseno devolve 0..1. Normalizar score é onde a fusão costuma quebrar.
// c=10, não o 60 da literatura: medido no dourado, 60 achata o topo e a fusão fica ABAIXO do
// BM25 sozinho (81,0% contra 82,3% em recall@10); com 10 vai a 83,0%, e a camada estado sobe de
// 21,9% para 42,7%. Com dois rankings curtos o c alto joga fora a informação de posição.
export function rrf(rankings, { k = 10, c = 10 } = {}) {
  const soma = new Map();
  for (const ranking of rankings) {
    ranking.forEach((r, i) => {
      const atual = soma.get(r.id) ?? { id: r.id, tipo: r.tipo, score: 0 };
      atual.score += 1 / (c + i + 1);
      soma.set(r.id, atual);
    });
  }
  return [...soma.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, k);
}
