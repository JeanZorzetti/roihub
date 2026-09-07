// O inventário INTEIRO do que um site declara no sitemap (022) — o denominador que faltava aos
// quatro KPIs de indexação do board.
//
// `primeiraPaginaInterna()` de `conformidade.mjs` (VER-04) já desce num <sitemapindex>, mas para
// UM item só: suficiente para "existe uma página interna?", insuficiente para "quantas páginas o
// site declara?". Um índice com 4 filhos entregava 1/4 do inventário, e um denominador pequeno
// demais faz a taxa de indexação parecer melhor do que é.
//
// Módulo PURO (Princípio III): `buscar` é INJETADA, sem process.env e sem pg. Ler sitemap não
// custa quota do Search Console — custa rede, e é a rede fora do módulo que permite testar índice
// aninhado, filho quebrado e catch-all sem um servidor.
import { julgarSitemap } from "./conformidade.mjs";

/** @typedef {{urls: string[], motivo: string|null, filhos: number, filhosLidos: number,
 *    profundidadeExcedida: boolean, erro: string}} Inventario */

/** Todas as <loc>, na ORDEM do arquivo e sem deduplicar. A ordem é a prioridade que o próprio
 *  site declara, e é ela que a amostra da corrida usa como prefixo — reordenar aqui moveria a
 *  amostra entre corridas e quebraria a estabilidade que a SC-004 exige. */
export function locs(corpo) {
  return [...corpo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/** Índice de sitemaps (lista arquivos) ou sitemap de páginas (lista URLs). As <loc> dos dois são
 *  idênticas na forma — só a raiz do documento os separa. */
export function ehIndice(corpo) {
  return /<sitemapindex/i.test(corpo);
}

const inventario = (extra) => ({
  urls: [],
  motivo: null,
  filhos: 0,
  filhosLidos: 0,
  profundidadeExcedida: false,
  erro: "",
  ...extra,
});

/**
 * A lista completa de URLs declaradas, descendo em TODOS os filhos quando a raiz é um índice.
 *
 * Três estados de ausência, nunca colapsados num "0%" (D5):
 * - `erro`   — não deu para perguntar (rede). NÃO é motivo: a corrida trata como falha do projeto,
 *              porque "não perguntei" gravado como "não há sitemap" é a inversão de sinal que a
 *              FR-008 proíbe no lado da inspeção e que valeria igual aqui.
 * - `sem_sitemap`   — respondeu, mas não é sitemap (catch-all servindo index.html, 404 em HTML,
 *              corpo vazio). É a AUSÊNCIA de sitemap, não um sitemap vazio.
 * - `sitemap_vazio` — XML válido, zero <loc>. O site declara que não tem nada a declarar.
 *
 * @param {string} url @param {(u:string)=>Promise<{corpo?:string,erro?:string}>} buscar
 * @returns {Promise<Inventario>}
 */
export async function lerSitemap(url, buscar) {
  const raiz = await buscar(url);
  if (raiz.erro) return inventario({ erro: raiz.erro });
  if (!julgarSitemap(raiz.corpo).ok) return inventario({ motivo: "sem_sitemap" });

  if (!ehIndice(raiz.corpo)) return fechar(locs(raiz.corpo), { filhos: 0, filhosLidos: 0 });

  const filhos = locs(raiz.corpo);
  const todas = [];
  let filhosLidos = 0;
  let profundidadeExcedida = false;
  for (const filho of filhos) {
    const r = await buscar(filho);
    // Filho inalcançável não zera o pai: o inventário fica menor e `filhosLidos < filhos` DENUNCIA
    // isso na resposta da corrida. Sem esse par de números o buraco seria silencioso, e um sitemap
    // parcialmente lido se apresentaria como o inventário completo do site.
    if (r.erro || !julgarSitemap(r.corpo).ok) continue;
    filhosLidos++;
    // Índice dentro de índice: as <loc> daqui são SITEMAPS, não páginas. Empilhá-las inflaria o
    // denominador com arquivos. Devolve o que achou e marca — nenhum dos 35 tem dois níveis hoje,
    // e marcar é o custo honesto de não tratar o caso hipotético.
    if (ehIndice(r.corpo)) {
      profundidadeExcedida = true;
      continue;
    }
    todas.push(...locs(r.corpo));
  }
  return fechar(todas, { filhos: filhos.length, filhosLidos, profundidadeExcedida });
}

/** Dedupe preservando a PRIMEIRA ocorrência (`Set` mantém a ordem de inserção). Um índice que
 *  lista o mesmo sitemap duas vezes dobraria o denominador em silêncio. */
function fechar(todas, extra) {
  const urls = [...new Set(todas)];
  return inventario({ ...extra, urls, motivo: urls.length ? null : "sitemap_vazio" });
}
