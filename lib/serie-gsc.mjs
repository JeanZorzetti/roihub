// Decisão de janela e mapeamento da corrida que grava a série do GSC (021).
//
// Módulo PURO: zero imports, sem process.env, sem pg, sem fetch. A rota traz os dias e chama
// daqui — o que permite testar a regra que decide "backfill ou incremento" sem subir o Next e
// sem gastar uma requisição no Search Console.

/** O GSC guarda ~16 meses. 480 dias fica logo abaixo desse teto: pedir mais devolve o mesmo, e
 *  pedir menos joga fora histórico que está ali de graça e não volta. */
export const DIAS_BACKFILL = 480;

const diasAtras = (n, agora) => new Date(agora - n * 864e5).toISOString().slice(0, 10);

/**
 * A janela que a corrida pede para um projeto.
 *
 * Sem linha gravada → backfill dos 16 meses. Com linha → **do último dia gravado** até hoje, e
 * o último entra de novo de propósito: ele pode ter sido gravado dentro da janela de D-3, quando
 * o GSC ainda não tinha fechado a contagem. Começar em `ultimoDia + 1` congelaria o valor
 * provisório para sempre.
 *
 * `fim` é D-0 e não D-3: pedir até hoje não inventa dado nenhum — o GSC simplesmente não devolve
 * linha para o dia que não tem, e quando devolver um valor parcial a corrida seguinte o corrige.
 *
 * @param {string|null} ultimoDia `YYYY-MM-DD` já gravado, ou null
 * @param {number} [agora]
 * @returns {{inicio: string, fim: string, backfill: boolean}}
 */
export function janelaDaCorrida(ultimoDia, agora = Date.now()) {
  const fim = diasAtras(0, agora);
  if (!ultimoDia) return { inicio: diasAtras(DIAS_BACKFILL, agora), fim, backfill: true };
  // Um `ultimoDia` no futuro (relógio torto, fuso do banco) encolheria a janela para nada e a
  // série pararia de crescer em silêncio. Prender no fim mantém a corrida grafando o dia de hoje.
  return { inicio: ultimoDia > fim ? fim : ultimoDia, fim, backfill: false };
}

/**
 * Converte os dias como `gscSeries` os devolve para a forma que a tabela guarda.
 *
 * `position` ausente vira `null`, nunca 0: posição 0 não existe no Google, e gravá-la faria a
 * melhor posição possível representar "não medido" — a mesma inversão que `nao_apurado` existe
 * para impedir em toda a casa.
 *
 * @param {{date: string, clicks: number, impressions: number, position?: number}[]} days
 */
export function diasParaGravar(days) {
  return days
    .filter((d) => d.date)
    .map((d) => ({
      dia: d.date,
      impressoes: d.impressions ?? 0,
      cliques: d.clicks ?? 0,
      posicao: typeof d.position === "number" ? d.position : null,
    }));
}
