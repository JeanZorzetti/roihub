// As três janelas nomeadas da 018 — DESCOBERTA/COMPORTAMENTO/CONVERSAO — e SÓ elas: hoje há DUAS
// definições de janela no repo (lib/okr-coleta.ts:26-30 avaliada no import, scripts/funil.mjs:28-29
// como cópia local) e as duas divergiriam na primeira spec que mexer numa delas. Nenhuma outra
// definição de janela PODE existir depois desta feature (FR-001).
//
// Módulo PURO: zero imports, sem process.env, sem pg, sem fetch, sem Date.now() fora de default de
// parâmetro — é a folha da árvore de dependências, para scripts/funil.mjs importar sem arrastar
// `pg` nem `google-auth-library`. Mesmo padrão de `lib/gsc-consulta.mjs:17`
// (`diasAtras(n, agora = Date.now())`): convenção que já existe no repo, aplicada onde faltava.

const DIA_MS = 864e5;

const diasAtras = (n, agora) => new Date(agora - n * DIA_MS).toISOString().slice(0, 10);

/** @typedef {{nome:string, inicio:string, fim:string, porque:string}} Janela */

/** 28 dias fechando em D-3 — o Search Console. Não muda nesta spec (FR-003): esticar trocaria a
 *  célula `visitante` dos 17 projetos e o ranking do portfólio inteiro. As janelas longas são a 019.
 *  @param {number} [agora] @returns {Janela} */
export function descoberta(agora = Date.now()) {
  return { nome: "DESCOBERTA", inicio: diasAtras(30, agora), fim: diasAtras(3, agora), porque: "o Search Console fecha o dia com ~3 dias de atraso" };
}

/** Mesma janela da Descoberta até a 019. @param {number} [agora] @returns {Janela} */
export function comportamento(agora = Date.now()) {
  return { nome: "COMPORTAMENTO", inicio: diasAtras(30, agora), fim: diasAtras(3, agora), porque: "mesma janela da Descoberta até a 019" };
}

/** A única que troca de tamanho nesta spec (FR-003), e só para o projeto que declara `epoca` no
 *  card. `epoca.data → hoje`, nunca uma janela rolante: rolante jogaria fora exatamente os leads
 *  que a época existe para preservar (FR-005). Isto não contradiz a FR-002 — a época é uma data
 *  escrita no card, não o que a fonte devolveu.
 *  @param {number} [agora] @param {{data:string, porque:string}|null} [epoca] @returns {Janela} */
export function conversao(agora = Date.now(), epoca = null) {
  if (epoca) return { nome: "CONVERSAO", inicio: epoca.data, fim: hoje(agora), porque: epoca.porque };
  return { nome: "CONVERSAO", inicio: diasAtras(30, agora), fim: diasAtras(3, agora), porque: "sem época declarada no card" };
}

/** `YYYY-MM-DD` de D-0 — o prazo da meta é compromisso de CALENDÁRIO, não da fonte (o atraso de 3
 *  dias do GSC é defeito dela, não do calendário). @param {number} [agora] @returns {string} */
export function hoje(agora = Date.now()) {
  return new Date(agora).toISOString().slice(0, 10);
}

/** Recua `meses` de CALENDÁRIO a partir de um `YYYY-MM-DD`. Mês, não "×30 dias": a tela promete
 *  "8 meses" e 240 dias não são 8 meses em nenhum ano — rotular um pelo outro é a mesma mentira de
 *  janela que a FR-027 proíbe, uma casa acima. `Date.UTC` normaliza 31/03 − 1 mês para 03/03, e
 *  isso é preferível a um dia inventado: a janela erra por dias, nunca por mês. */
const mesesAntes = (iso, meses) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - meses, d.getUTCDate())).toISOString().slice(0, 10);
};

// ── 019/FR-023 — as janelas LONGAS. Vivem SÓ em `/okr/[slug]/aquisicao`, nunca na ficha nem no
// ranking (FR-024/FR-024a): Descoberta e Comportamento têm relógio de TRIMESTRE, e a tela que se lê
// na segunda-feira não pode carregar número que só muda de trimestre em trimestre. As curtas acima
// NÃO mudam — esticá-las trocaria a célula `visitante` dos 17 projetos e o placar do portfólio
// (SC-007). Fechar em D-3 é o mesmo atraso do Search Console de sempre.

/** 8 meses fechando em D-3 — o Search Console em janela de leitura trimestral (FR-023).
 *  @param {number} [agora] @returns {Janela} */
export function descobertaLonga(agora = Date.now()) {
  const fim = diasAtras(3, agora);
  return { nome: "DESCOBERTA_LONGA", inicio: mesesAntes(fim, 8), fim, porque: "leitura trimestral: 8 meses de Search Console, fechando no mesmo D-3 do atraso da fonte" };
}

/** 12 meses fechando em D-3 — o GA4 em janela de leitura trimestral (FR-023).
 *  @param {number} [agora] @returns {Janela} */
export function comportamentoLongo(agora = Date.now()) {
  const fim = diasAtras(3, agora);
  return { nome: "COMPORTAMENTO_LONGO", inicio: mesesAntes(fim, 12), fim, porque: "leitura trimestral: 12 meses de GA4, fechando no mesmo D-3 da Descoberta para as duas janelas serem comparáveis" };
}
