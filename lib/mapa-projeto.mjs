// 052/research D12 — testemunhas puras (sem fetch, sem processo) que comparam o HTML do mapa
// antes/depois (SC-002, "numeros") e reprovam qualquer frase que nomeie outro projeto fora das
// evidências permitidas (SC-005, "alheio"). `scripts/conferir-mapa.mjs` é quem as chama contra o
// HTML que o `curl` do quickstart baixou.

/** As frases que PODEM nomear a Atma no mapa de outro projeto (research D5, mais o achado da
 *  validação T018/21/09/2026): as duas primeiras citam a Atma como a MEDIÇÃO que justificou uma
 *  regra do compilador, não como o projeto que a tela mede. Qualquer outra menção a "atma" no
 *  HTML de outro projeto reprova a testemunha da SC-005.
 *  @type {RegExp[]} */
export const EVIDENCIAS = [
  // linha 379 de app/gsc/mapa/[slug]/page.tsx (21/09/2026): a leitura por consulta×página omite
  // as consultas raras, que medem 42,1% das impressões da Atma.
  /42,1% das impress(?:oes|ões) da atma/i,
  // linha 382: a testemunha `conferir-soma-hosts.mjs atma …` imprimia 12,50% em 20/09/2026.
  /conferir-soma-hosts\.mjs atma[\s\S]*?12,50%/i,
  // T018 — o nome PRÓPRIO completo ("Atma Aligner") só aparece como rótulo de LINK para as telas
  // dela: no menu global (`Tabs`, `app/tabs.tsx`, presente em toda página do hub — a lista de
  // fichas do OKR) e no seletor de projetos desta feature (US3/FR-011, que precisa listar o outro
  // projeto para trocar de mapa). Nenhuma frase que afirma algo sobre o projeto MEDIDO usa o nome
  // completo — todas dizem "a Atma"/"da Atma" (informal), nunca "Atma Aligner".
  /\bAtma Aligner\b/i,
];

/** O texto visível de `<main>`: tira `<script>` e `<style>` inteiros antes das tags. O HTML do
 *  App Router leva o payload RSC dentro de `<script>` — ele repete o texto da página com ids e
 *  caminhos de chunk que mudam a cada build, e comparado junto reprovaria a SC-002 numa
 *  implementação correta. O `<title>` fica fora por estar fora de `<main>`.
 *  @param {string} html
 *  @returns {string} */
export function textoDoMain(html) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "";
  const semBlocos = main.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  return semBlocos
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide `texto` em frases (corte em `.`, `!` ou `?` seguidos de espaço, para não partir
 *  `1.234` nem `.mjs` — os dois têm o ponto seguido de dígito ou letra, nunca de espaço) e
 *  devolve as que contêm `alheio` (sem diferenciar maiúsculas) e não casam com nenhuma de
 *  `permitidas`.
 *  @param {string} texto @param {string} alheio @param {RegExp[]} permitidas
 *  @returns {string[]} */
export function frasesAlheias(texto, alheio, permitidas) {
  const alvo = alheio.toLowerCase();
  return texto
    .split(/(?<=[.!?])\s+/)
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => f.toLowerCase().includes(alvo) && !permitidas.some((re) => re.test(f)));
}

/** Os números em ordem de aparição, no formato pt-BR (`1.234`, `12,5%`, `4,4`), sem o carimbo
 *  "Apurado ao abrir a página, em …" — ele muda a cada carga da página e desalinharia a
 *  comparação por posição da SC-002.
 *  @param {string} texto
 *  @returns {string[]} */
export function numerosDoMapa(texto) {
  const semCarimbo = texto.replace(/Apurado ao abrir a página, em[^.]*\./g, "");
  return semCarimbo.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?%?/g) ?? [];
}
