// 030 — a mescla por CAMINHO das leituras por página do Search Console.
//
// Módulo PURO: zero imports, sem process.env, sem fetch. A borda (`lib/gsc.ts`) busca uma resposta
// por host e chama daqui — o que permite testar cada borda da mescla sem subir o Next e sem gastar
// uma requisição no Search Console. É a função irmã de `somarSeriesPorHost` (`lib/serie-gsc.mjs`):
// aquela soma por DIA, esta por CAMINHO.

/**
 * @typedef {{keys: string[], clicks?: number, impressions?: number, position?: number|null}} LinhaBruta
 * @typedef {{host: string, rows: LinhaBruta[]}} RespostaDoHost
 * @typedef {{query?: string, page: string, caminho: string, cliques: number, impressoes: number,
 *            posicao: number|null, hosts: string[]}} PaginaMesclada
 */

/**
 * Junta as linhas de vários hosts numa linha por caminho.
 *
 * POR QUE por caminho e não pela URL crua: medido na Atma em 19/09/2026, cinco páginas existem nos
 * dois hosts. Empilhar as respostas faria a campeã aparecer com 22.059 impressões na posição 7,3 e,
 * ao lado, com 5 na posição 21 — e o balizador reprovaria a segunda por ruído.
 *
 * A posição é a média PONDERADA por impressões, nunca a simples: (7,3 × 22.059 + 21 × 5) ÷ 22.064
 * dá 7,3, enquanto a média simples daria 14,15 — uma posição que nenhum dos dois domínios mediu e
 * que jogaria a página para fora da faixa do balizador (≤ 10,9).
 *
 * `keys` é [página] ou [consulta, página] conforme as `dimensions` pedidas; a página é sempre a
 * última. A chave preserva barra final e querystring: `/x` e `/x/` são páginas diferentes no Google
 * e no sitemap, e normalizar aqui inventaria uma fusão que o Search Console não fez.
 *
 * @param {RespostaDoHost[]} respostas uma por host consultado
 * @param {string[]} hosts declarados, em ordem — `hosts[0]` (o de `url`) assina a URL de saída
 * @returns {PaginaMesclada[]} na ordem em que cada caminho apareceu
 */
export function mesclarPorCaminho(respostas, hosts) {
  const porChave = new Map();
  for (const { host, rows } of respostas ?? []) {
    for (const { keys, clicks, impressions, position } of rows ?? []) {
      const url = keys?.at(-1);
      const query = keys?.length > 1 ? keys[0] : undefined;
      // `query` ou `page` vazio não é linha de busca — a mesma guarda de `mergeGscWindows`.
      if (!url || query === "") continue;
      let caminho;
      try {
        const { pathname, search } = new URL(url);
        caminho = pathname + search;
      } catch {
        continue; // nunca vira chave crua: duas grafias da mesma página não se fundiriam
      }
      const chave = `${query ?? ""}\0${caminho}`;
      const acc = porChave.get(chave) ?? { query, caminho, cliques: 0, impressoes: 0, votos: [], contribuintes: new Set() };
      const imp = impressions ?? 0;
      acc.cliques += clicks ?? 0;
      acc.impressoes += imp;
      // Linha sem impressão não vota: a posição dela não descreve nenhuma exibição.
      if (typeof position === "number" && Number.isFinite(position) && imp > 0) acc.votos.push([position, imp]);
      acc.contribuintes.add(host);
      porChave.set(chave, acc);
    }
  }
  return [...porChave.values()].map(({ query, caminho, cliques, impressoes, votos, contribuintes }) => {
    const peso = votos.reduce((t, [, i]) => t + i, 0);
    return {
      ...(query !== undefined && { query }),
      page: `https://${hosts[0]}${caminho}`,
      caminho,
      cliques,
      impressoes,
      // Voto único devolve a posição do Google como veio: (3,9 × 1.146) ÷ 1.146 dá
      // 3,8999999999999995 em ponto flutuante, e um projeto de UM host não pode ter o número
      // alterado só por passar pela mescla. `null` e nunca 0 sem impressão: posição 0 não existe
      // no Google, e gravá-la faria "não medido" ler como a melhor posição possível.
      posicao: votos.length === 1 ? votos[0][0] : peso > 0 ? votos.reduce((t, [p, i]) => t + p * i, 0) / peso : null,
      hosts: [...contribuintes].sort((a, b) => hosts.indexOf(a) - hosts.indexOf(b)),
    };
  });
}

/**
 * 034 — a MESMA mescla, para a leitura na dimensão `query` sozinha.
 *
 * Não é duplicação de `mesclarPorCaminho`: a chave é outra e a de cima não serve. Ela faz
 * `new URL(keys.at(-1))` para reduzir a página ao caminho, e numa resposta só de `query` a última
 * chave é o termo — `new URL("invisalign")` lança, cai no `catch` e a linha é descartada. A
 * leitura inteira voltaria VAZIA, sem erro nenhum, que é a pior forma de falhar.
 *
 * As regras de voto são as mesmas dela, de propósito: linha sem impressão não vota (a posição de
 * uma linha que ninguém viu não descreve exibição nenhuma), voto único devolve a posição como o
 * Google mandou (ponderar 3,9 por 1.146 devolve 3,8999999999999995, e um projeto de um host só não
 * pode ter o número alterado por passar pela mescla) e `null` nunca vira 0 (posição 0 não existe no
 * Google, e gravá-la faria "não medido" ler como a melhor posição possível).
 *
 * Medido em 20/09/2026: `invisalign` tem 8 impressões na posição 42 no domínio novo e 10.400 na
 * posição 1,1 no antigo. Média simples devolveria 21,6 e tiraria do Top 3 um termo que está em 1,1.
 *
 * @param {{host: string, rows: {keys?: string[], clicks?: number, impressions?: number, position?: number}[]}[]} respostas
 * @returns {{termo: string, cliques: number, impressoes: number, posicao: number|null, hosts: string[]}[]}
 */
export function mesclarPorTermo(respostas) {
  const porTermo = new Map();
  for (const { host, rows } of respostas ?? []) {
    for (const { keys, clicks, impressions, position } of rows ?? []) {
      const termo = keys?.[0];
      if (!termo) continue;
      const acc = porTermo.get(termo) ?? { termo, cliques: 0, impressoes: 0, votos: [], contribuintes: new Set() };
      const imp = impressions ?? 0;
      acc.cliques += clicks ?? 0;
      acc.impressoes += imp;
      if (typeof position === "number" && Number.isFinite(position) && imp > 0) acc.votos.push([position, imp]);
      acc.contribuintes.add(host);
      porTermo.set(termo, acc);
    }
  }
  return [...porTermo.values()].map(({ termo, cliques, impressoes, votos, contribuintes }) => {
    const peso = votos.reduce((t, [, i]) => t + i, 0);
    return {
      termo,
      cliques,
      impressoes,
      posicao: votos.length === 1 ? votos[0][0] : peso > 0 ? votos.reduce((t, [p, i]) => t + p * i, 0) / peso : null,
      hosts: [...contribuintes],
    };
  });
}

/**
 * 033/T071 — a causa de uma leitura ter devolvido `null`, dita pelo nome CERTO. `lerHosts` devolve
 * `null` para três coisas com consertos opostos: lista vazia (declarar o host), env desligada (a
 * credencial não chegou a este ambiente) e host fora de toda propriedade (criar a propriedade). A
 * tela do mapa escolhia a última e a afirmava — e quem lia ia auditar uma permissão correta.
 *
 * A ORDEM é a de `lerHosts` (lista, depois env, depois propriedade): a frase nomeia a PRIMEIRA
 * causa que a leitura encontrou, não a mais provável. Nunca cita o nome da variável nem o valor
 * (Princípio V) — a mensagem chega à tela.
 *
 * @param {{ligado: boolean, hosts: string[]}} o `ligado` sai de `gscLigado()` em `lib/gsc.ts`
 * @returns {string}
 */
export function motivoDeAusencia({ ligado, hosts }) {
  if (!hosts?.length) return "nenhum host declarado para este projeto";
  if (!ligado) return "a credencial do Search Console não está configurada neste ambiente";
  return hosts.length > 1
    ? `nenhum dos hosts declarados tem propriedade no Search Console (${hosts.join(", ")})`
    : `o host declarado não tem propriedade no Search Console (${hosts[0]})`;
}

/**
 * The reason a network read failed, short enough for a node, without dropping the part that says why.
 *
 * node-fetch (under gaxios) writes "request to <URL> failed, reason: <cause>", and the 60-char cut
 * every reader used kept exactly the URL and threw the cause away: on Sirius, 22/09/2026, the chain
 * panel read "request to https://searchconsole.googleapis.com/webmasters/v" and nothing else.
 * Native fetch hides the cause behind "fetch failed" in `e.cause`. Both are unwrapped here, and the
 * system code (ECONNRESET, ETIMEDOUT…) leads when the text does not already carry it.
 *
 * @param {unknown} e
 * @param {number} [max]
 */
export function motivoDaFalha(e, max = 80) {
  const err = /** @type {{message?: string, code?: unknown, cause?: {message?: string, code?: unknown}}} */ (e ?? {});
  let texto = (e instanceof Error ? e.message : String(e)).replace(/^request to \S+ failed, reason: /, "");
  if (texto === "fetch failed" && err.cause) texto = err.cause.message ?? "";
  const codigo = [err.code, err.cause?.code].find((c) => typeof c === "string");
  if (codigo && !texto.includes(codigo)) texto = `${codigo} ${texto}`;
  return texto.trim().slice(0, max) || "falha de rede sem mensagem";
}
