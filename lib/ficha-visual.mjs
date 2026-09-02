// Derivações SÓ de apresentação para a ficha de OKR (app/okr/[slug]/page.tsx).
// Não coleta, não decide estado, não toca no contrato de lib/ficha.mjs — apenas reagrupa células
// que `montarNiveis()` JÁ produziu. Toda regra de "o que é apurado" continua sendo de `Cel`.

/** Os rótulos que `montarN4()` grava nas células dos CANAIS (lib/ficha.mjs:98 e :298).
 *  `organico` é o único cujo rótulo não é o id — sai acentuado, de `estadoDeApurado(..., "orgânico")`. */
export const ROTULOS_CANAL = ["orgânico", "direto", "pago", "indicacao", "outbound", "social"];

/**
 * Os canais do N4, na ordem em que devem aparecer: apurados por magnitude decrescente, depois os
 * sem fonte. Devolve a PRÓPRIA célula, não o valor — quem imprime continua sendo `Cel` (FR-009),
 * e `fracao` é só a largura do trilho ao lado.
 *
 * A lista plana de `montarN4Nivel()` traz, DEPOIS dos canais, três células derivadas deles —
 * `fora do catálogo`, `total composto` e `diferença`. Trilho para qualquer uma contaria o mesmo
 * tráfego duas vezes e faria o total parecer um canal, então o corte é por allowlist de rótulo,
 * nunca por "toda célula apurada do nível".
 *
 * Canal não apurado vem com `fracao: null`, nunca 0: trilho vazio ao lado de "sem fonte" leria
 * como "medimos e deu zero" — 0 na janela não é 0 no mundo.
 *
 * @param {{estado:string, rotulo:string, valor?:number|string}[]} celulas células do N4
 * @returns {{canais:{celula:object, fracao:number|null}[], resto:object[]}}
 */
export function canaisDoN4(celulas) {
  const lista = celulas ?? [];
  const doCanal = lista.filter((c) => ROTULOS_CANAL.includes(c.rotulo));
  const resto = lista.filter((c) => !ROTULOS_CANAL.includes(c.rotulo));
  const ehBarra = (c) => c.estado === "apurado" && typeof c.valor === "number";
  const max = doCanal.filter(ehBarra).reduce((m, c) => Math.max(m, c.valor), 0);
  const canais = [
    ...doCanal.filter(ehBarra).sort((a, b) => b.valor - a.valor).map((c) => ({ celula: c, fracao: max > 0 ? c.valor / max : 0 })),
    ...doCanal.filter((c) => !ehBarra(c)).map((c) => ({ celula: c, fracao: null })),
  ];
  return { canais, resto };
}

/**
 * O medidor de um KR do N0: quanto do caminho até a meta já foi andado.
 *
 * Só para célula APURADA e numérica. Célula declarada tem valor que ninguém mediu, e desenhar
 * barra para ela apresentaria declaração como apuração — a mesma linha que `Cel` separa. Célula
 * de taxa do N3 traz `valor` string ("6,67% (35/525)"), por isso o typeof e não só o estado.
 *
 * @param {{estado:string, valor?:number|string}|null} celula `celulaAlvo` do KR validado
 * @param {number|null|undefined} meta `kr.meta`
 * @returns {{valor:number, meta:number, fracao:number}|null} null = sem medidor, mantém só o texto
 */
export function razaoDoKr(celula, meta) {
  if (!celula || celula.estado !== "apurado" || typeof celula.valor !== "number") return null;
  if (typeof meta !== "number" || !Number.isFinite(meta) || meta <= 0) return null;
  // Ultrapassar a meta enche a barra e para: 140% de trilho vazaria o card, e o número ao lado
  // já diz o valor real.
  const fracao = Math.min(1, Math.max(0, celula.valor / meta));
  return { valor: celula.valor, meta, fracao };
}
