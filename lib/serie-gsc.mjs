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
 * @param {{date: string, clicks?: number, impressions?: number, position?: number|null}[]} days
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

/**
 * 029 — soma as séries de vários hosts num dia só.
 *
 * POR QUE somar, e não emendar dois segmentos: medido na Atma em 18/09/2026, quatro dias depois da
 * troca de domínio, `atma.roilabs.com.br` ainda valia 1.146 impressões em 15/09 contra 31 de
 * `usealigner.com`. O 301 transfere sinal em SEMANAS, e durante esse período os dois domínios
 * servem o mesmo negócio. Emendar os segmentos desenharia uma queda de 1.146 para 35 que é inteira
 * do instrumento — foi exatamente o que a corrida gravou em 16/09 antes desta função existir.
 *
 * Dia presente num host e ausente no outro entra com o que existe: o Search Console não devolve
 * linha para o dia sem impressão, e tratar ausência de linha como "dia não medido" apagaria o dia
 * inteiro por causa do host que ainda não tinha tráfego.
 *
 * @param {{host?: string, days?: {date: string, clicks?: number, impressions?: number, position?: number}[]}[]} series
 * @returns {{date: string, clicks: number, impressions: number, position: number|null}[]} em ordem
 */
export function somarSeriesPorHost(series) {
  const porDia = new Map();
  for (const s of series ?? []) {
    for (const d of s?.days ?? []) {
      if (!d?.date) continue;
      const acc = porDia.get(d.date) ?? { date: d.date, clicks: 0, impressions: 0, somaPos: 0, impPos: 0 };
      const imp = d.impressions ?? 0;
      acc.clicks += d.clicks ?? 0;
      acc.impressions += imp;
      // Posição PONDERADA por impressão, nunca média de médias: em 15/09 a média simples daria o
      // mesmo peso a 1.146 impressões na posição 2,8 e a 31 na 8,3, e devolveria uma posição que
      // nenhum dos dois domínios mediu. O próprio GSC já entrega a posição do dia ponderada assim.
      if (typeof d.position === "number" && imp > 0) {
        acc.somaPos += d.position * imp;
        acc.impPos += imp;
      }
      porDia.set(d.date, acc);
    }
  }
  return [...porDia.values()]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ somaPos, impPos, ...d }) => ({
      ...d,
      // `null` e nunca 0, pelo mesmo motivo de `diasParaGravar`: posição 0 não existe no Google, e
      // gravá-la faria "não medido" ler como a melhor posição possível.
      position: impPos > 0 ? somaPos / impPos : null,
    }));
}

/**
 * 029 — a assinatura de um conjunto de hosts: normalizado, sem repetição, ordenado, unido por `+`.
 *
 * Ordenar antes de unir é o que faz a assinatura ser do CONJUNTO e não da ordem em que a corrida
 * consultou — senão a mesma soma geraria duas assinaturas e a guarda de `gravarDiasGsc` recusaria
 * a regravação do próprio dia que acabou de escrever.
 *
 * @param {string[]} hosts
 * @returns {string|null} `null` para lista vazia
 */
export function assinaturaDeHosts(hosts) {
  const limpos = [...new Set((hosts ?? []).map((h) => String(h ?? "").trim().replace(/^www\./, "")).filter(Boolean))];
  return limpos.length ? limpos.sort().join("+") : null;
}

/**
 * A série diária agregada por MÊS CALENDÁRIO, para dar FORMA aos oito meses de Descoberta.
 *
 * Só o mês inteiramente **coberto pela janela RECEBIDA** recebe valor; os das duas pontas saem
 * `coberto: false`. Desenhar a ponta pelo que ela mediu encolheria a coluna por calendário e
 * pintaria uma queda que não existe — o mesmo motivo pelo qual `semanasNaoMarca` devolve
 * `completa: false` nas pontas (`lib/marca.mjs`).
 *
 * ⚠️ RECEBIDA, e não pedida: medido em goiania.roilabs.com.br em 18/09, a propriedade só existe
 * desde 28/06 e a janela pedida (15/01 → 15/09) cobre junho inteiro. Contra a janela pedida,
 * junho saía `coberto` com os 7 impressões dos seus 3 dias medidos e desenhava uma barra de 1px
 * ao lado dos 292 de julho — exatamente a leitura de queda que esta função existe para impedir,
 * entrando pela porta do denominador.
 *
 * ⚠️ `diasComLinha < dias do mês` NÃO torna o mês parcial: o Search Console simplesmente não
 * devolve linha para o dia sem impressão nenhuma. Tratar isso como "sem dado" esconderia o mês
 * de tráfego baixo, que é justamente o que a série precisa mostrar. O que decide é a JANELA.
 *
 * `inicio` e `fim` saem CORTADOS pela janela (é o que o eixo do gráfico rotula nas pontas):
 * um mês de ponta rotulado `2026-09-30` prometeria dado até o fim de setembro numa série que
 * fecha em 15/09.
 *
 * @param {{date: string, clicks?: number, impressions?: number}[]} days
 * @param {{inicio: string, fim: string}} janela a janela RECEBIDA (a que a fonte devolveu)
 * @returns {{mes: string, inicio: string, fim: string, impressoes: number, cliques: number, diasComLinha: number, coberto: boolean}[]}
 */
export function mesesDaSerie(days, janela) {
  const porMes = new Map();
  for (const d of days ?? []) {
    if (!d?.date) continue;
    const mes = d.date.slice(0, 7);
    const acc = porMes.get(mes) ?? { impressoes: 0, cliques: 0, diasComLinha: 0 };
    acc.impressoes += d.impressions ?? 0;
    acc.cliques += d.clicks ?? 0;
    acc.diasComLinha += 1;
    porMes.set(mes, acc);
  }
  return [...porMes.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([mes, acc]) => {
      const [ano, m] = mes.split("-").map(Number);
      // `Date.UTC(ano, m, 0)` = último dia do mês `m` (o dia 0 do mês seguinte). Puro, sem tabela
      // de bissexto à mão.
      const ultimo = `${mes}-${String(new Date(Date.UTC(ano, m, 0)).getUTCDate()).padStart(2, "0")}`;
      const coberto = janela.inicio <= `${mes}-01` && janela.fim >= ultimo;
      return {
        mes,
        inicio: janela.inicio > `${mes}-01` ? janela.inicio : `${mes}-01`,
        fim: janela.fim < ultimo ? janela.fim : ultimo,
        ...acc,
        coberto,
      };
    });
}
