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
