// 033 — o veredito sai do intervalo de confiança da própria amostra, não de um piso fixo de
// impressões (100, da 026) que tratava toda amostra acima dele como igualmente confiável e toda
// amostra abaixo como sem veredito nenhum — dois erros: 0/21 é suficiente para excluir 25%
// (research.md §R1) e 3/105 não é suficiente para excluir 4,5%, e o piso de impressões não
// distingue os dois casos.
//
// Módulo FOLHA: zero imports, sem process.env, sem pg, sem fetch, sem Date.now() — mesmo contrato
// de lib/janelas.mjs, para scripts/ e node --test importarem sem arrastar google-auth-library.
// Princípio III: toda a aritmética desta feature mora aqui. Nenhuma conta em .tsx.

/** O nível de confiança desta família de vereditos. Mudá-lo é decisão do dono e muda quantas
 *  páginas ficam indecisas — por isso é constante em commit, não seletor de tela. */
export const CONFIANCA = 0.95;

/** z de 97,5% (bicaudal a 95%). Valor cheio, não 1,96: o arredondado move o teto de 0/21 em 0,1
 *  ponto, e é esse teto que decide a Posição 1 contra uma régua de 25%. */
export const Z_95 = 1.959963984540054;

/** @typedef {{inferior:number, superior:number, confianca:number, metodo:"wilson"}} Intervalo */

/**
 * Intervalo de confiança de Wilson (score interval) para uma proporção `cliques/impressoes`.
 *
 * `impressoes <= 0` ou não finita → `null`: não há intervalo de uma amostra que não existe, e
 * `[0,0]` "decidiria" tudo. `cliques < 0` ou `cliques > impressoes` → lança: é bug de chamador, a
 * fonte nunca devolve mais clique que impressão.
 *
 * O clamp `[0, 1]` na saída não é defensivo, é aritmética medida: a forma fechada devolve
 * `-1,1731740316366828e-17` para `wilson(0, 21)` (o sinal vira com `n`, `+2,16e-19` em
 * `wilson(0, 1000)`). Sem ele `inferior >= 0` é falso e a varredura da FR-003 fica vermelha no
 * primeiro caso — por um motivo que não é o método.
 *
 * @param {number} cliques
 * @param {number} impressoes
 * @param {number} [z]
 * @returns {Intervalo | null}
 */
export function wilson(cliques, impressoes, z = Z_95) {
  if (!Number.isFinite(impressoes) || impressoes <= 0) return null;
  if (cliques < 0 || cliques > impressoes) throw new RangeError(`wilson: cliques=${cliques} fora de [0, impressoes=${impressoes}]`);
  const n = impressoes;
  const p = cliques / n;
  const z2 = z * z;
  const d = 1 + z2 / n;
  const centro = (p + z2 / (2 * n)) / d;
  const meia = (z / d) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    inferior: Math.max(0, centro - meia),
    superior: Math.min(1, centro + meia),
    confianca: CONFIANCA,
    metodo: "wilson",
  };
}

/**
 * Veredito da amostra contra uma régua ESCALAR (CTR mínimo esperado).
 *
 * As três condições são exaustivas e mutuamente exclusivas: não existe amostra sem veredito nem
 * com dois. A assimetria `<` contra `>=` é deliberada — a régua é um piso, e empate exato com o
 * piso é `"atinge"`; `inferior > regua` deixaria o empate em `"indecisa"`, o que é falso.
 *
 * @param {number} cliques
 * @param {number} impressoes
 * @param {number | null} regua
 * @param {number} [z]
 * @returns {"atinge" | "abaixo" | "indecisa" | null}
 */
export function vereditoContraRegua(cliques, impressoes, regua, z = Z_95) {
  if (regua == null || !Number.isFinite(impressoes) || impressoes <= 0) return null;
  const { inferior, superior } = wilson(cliques, impressoes, z);
  if (superior < regua) return "abaixo";
  if (inferior >= regua) return "atinge";
  return "indecisa";
}

/**
 * Veredito da amostra contra uma FAIXA `[piso, teto]` do board (US3) — não é a mesma regra com o
 * piso: qualquer sobreposição com a faixa é indecisão, porque a amostra não distingue "dentro da
 * faixa" de "fora dela". Aplicar `vereditoContraRegua(…, piso)` emitiria "atinge" para uma amostra
 * que não exclui o teto — precisão inventada.
 *
 * @param {number} cliques
 * @param {number} impressoes
 * @param {[number, number] | null} faixa
 * @param {number} [z]
 * @returns {"atinge" | "abaixo" | "indecisa" | null}
 */
export function vereditoContraFaixa(cliques, impressoes, faixa, z = Z_95) {
  if (faixa == null || !Number.isFinite(impressoes) || impressoes <= 0) return null;
  const [piso, teto] = faixa;
  if (piso > teto) throw new RangeError(`vereditoContraFaixa: faixa invertida [${piso}, ${teto}]`);
  const { inferior, superior } = wilson(cliques, impressoes, z);
  if (superior < piso) return "abaixo";
  if (inferior >= teto) return "atinge";
  return "indecisa";
}
