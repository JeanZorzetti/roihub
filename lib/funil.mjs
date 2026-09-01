// O funil por projeto, e a única coisa que ele existe para fazer: NUNCA escrever 0 onde a
// resposta é "não olhei". `lib/score.mjs` prioriza, `lib/seo-score.mjs` ordena o SEO — este aqui
// não ordena nada, ele mede até ONDE cada projeto é mensurável.
//
// A pesquisa `docs/deep-research/Funil Matemático SEO SaaS B2B.md` monta `ARR = Tráfego × CR₁ ×
// CR₂ × … × ACV` e projeta receita a partir de benchmarks de terceiros. O subprojeto
// `handoff/funil-seo/` (comece pelo `00-LEIA-PRIMEIRO.md`) mostra por que aquele número não vale:
// é MULTIPLICAÇÃO, e um fator não medido não é 0 — é indefinido. Somar "0 leads" de um projeto
// sem instrumentação com "0 leads" de um projeto instrumentado produz uma taxa de conversão com
// cara de apurada em cima de um denominador que ninguém olhou.
//
// Por isso toda célula aqui é `{valor}` OU `{naoApurado: motivo}`. É a mesma regra do
// `nao_apurado` de `lib/dourado-estado.mjs` e da falha fechada por coletor do estado noturno:
// fonte que não respondeu SAI da conta em vez de cair para um valor que dá notícia boa.
//
// JS puro com JSDoc, igual score.mjs/series.mjs — node:test sem tooling.

/** @typedef {{valor:number}|{naoApurado:string}} Celula */

/** @param {number} valor @returns {Celula} */
export const apurado = (valor) => ({ valor });

/** @param {string} motivo @returns {Celula} */
export const naoApurado = (motivo) => ({ naoApurado: motivo });

/** @param {Celula} c */
export const ehApurado = (c) => c != null && typeof c.valor === "number";

/**
 * Razão entre duas células. Três coisas viram `não apurado`, e as três de propósito:
 *
 * - qualquer ponta não apurada — razão com metade medida é chute com casa decimal;
 * - denominador 0 — `0/0` NÃO é 0%. É a diferença entre "ninguém que chegou virou lead" e
 *   "ninguém chegou", e ela é a leitura inteira: a primeira é problema de conversão, a segunda
 *   é problema de tráfego (ou de demanda, o Nível 0 que a pesquisa nem tem);
 * - numerador > denominador — lead sem clique no GSC não é conversão acima de 100%, é sinal de
 *   que as duas pontas não medem a mesma coisa (lead veio de outro canal, ou a propriedade do
 *   GSC não cobre o host). Devolver 250% seria publicar o defeito como resultado.
 *
 * @param {Celula} numerador @param {Celula} denominador @returns {Celula} fração 0..1
 */
export function razao(numerador, denominador) {
  if (!ehApurado(denominador)) return naoApurado(`denominador: ${denominador?.naoApurado ?? "ausente"}`);
  if (!ehApurado(numerador)) return naoApurado(`numerador: ${numerador?.naoApurado ?? "ausente"}`);
  if (denominador.valor === 0) return naoApurado("denominador 0 — 0/0 não é 0%");
  if (numerador.valor > denominador.valor)
    return naoApurado(`numerador (${numerador.valor}) > denominador (${denominador.valor}) — pontas não casam`);
  return apurado(numerador.valor / denominador.valor);
}

/**
 * A segunda divisão do repo, e ela mora AQUI, colada em `razao()`, porque a diferença entre as
 * duas só é legível se estiverem uma embaixo da outra.
 *
 * `razao()` confronta duas MEDIÇÕES: numerador > denominador significa que as pontas não medem a
 * mesma coisa, e devolver 250% publicaria o defeito como resultado. `exigencia()` confronta uma
 * EXIGÊNCIA DECLARADA com uma medição: acima de 1 é resultado legítimo — é a prova de que a meta
 * não cabe no volume atual, e é o único achado desta feature que economiza um trimestre.
 *
 * @param {Celula} necessario @param {Celula} ancora @returns {Celula} fração, PODE exceder 1
 */
export function exigencia(necessario, ancora) {
  if (!ehApurado(ancora)) return naoApurado(`âncora: ${ancora?.naoApurado ?? "ausente"}`);
  if (!ehApurado(necessario)) return naoApurado(`necessário: ${necessario?.naoApurado ?? "ausente"}`);
  if (ancora.valor === 0) return naoApurado("âncora zerada — meta não se divide por volume nenhum");
  return apurado(necessario.valor / ancora.valor);
}

/**
 * Os degraus do funil, do topo para baixo. A ordem É a semântica: `profundidade` conta quantos
 * degraus CONTÍGUOS a partir do topo estão apurados, e para no primeiro buraco.
 *
 * Contíguo e não "quantos apurados no total" porque o funil é uma cadeia: leads apurados com
 * cliques não apurados não dão taxa nenhuma. Contar os dois como "2 de 3" faria um projeto sem
 * propriedade no GSC parecer mais medido que um projeto medido até a metade.
 */
export const DEGRAUS = ["cliques", "leads", "vendas"];

/**
 * @typedef {{slug:string, cliques:Celula, leads:Celula, vendas:Celula}} Entrada
 * @typedef {Entrada & {crCliqueLead:Celula, crLeadVenda:Celula, profundidade:number}} Linha
 */

/** @param {Entrada} e @returns {Linha} */
export function montarLinha(e) {
  let profundidade = 0;
  for (const d of DEGRAUS) {
    if (!ehApurado(e[d])) break;
    profundidade++;
  }
  return {
    ...e,
    crCliqueLead: razao(e.leads, e.cliques),
    crLeadVenda: razao(e.vendas, e.leads),
    profundidade,
  };
}

/**
 * O número que fecha a discussão da OKR: quantos projetos têm funil mensurável de ponta a ponta.
 *
 * `porDegrau[i]` = quantos projetos PARAM no degrau i (0 = nem cliques). Não é acumulado: somar
 * as casas tem que dar o total, senão a tabela mente sobre onde a perda acontece.
 *
 * @param {Linha[]} linhas
 */
export function resumir(linhas) {
  const porDegrau = Array(DEGRAUS.length + 1).fill(0);
  for (const l of linhas) porDegrau[l.profundidade]++;
  return {
    total: linhas.length,
    porDegrau,
    completos: linhas.filter((l) => l.profundidade === DEGRAUS.length).map((l) => l.slug),
    // Só quem tem taxa de verdade. É esta lista que pode virar meta; o resto é encanamento.
    comTaxa: linhas.filter((l) => ehApurado(l.crCliqueLead)).map((l) => l.slug),
  };
}

/** @param {Celula} c @param {(v:number)=>string} [fmt] */
export const mostrar = (c, fmt = String) => (ehApurado(c) ? fmt(c.valor) : "não apurado");

/** Fração → percentual com 2 casas: 3 leads em 1.240 cliques é 0,24% e arredondar mata o sinal. */
export const pct = (v) => `${(v * 100).toFixed(2).replace(".", ",")}%`;

/**
 * Domínios da casa. Lead vindo daqui é nosso, não é mercado. Sem e-mail pessoal nesta lista de
 * propósito: **este repositório é público** (já vazou senha uma vez).
 */
const DOMINIOS_INTERNOS = ["roilabs.com.br", "roilabs.com", "nimblabs.com", "teste.com.br", "example.com"];

/**
 * Lead que NÓS criamos não é demanda — e contar um fecha o critério deste subprojeto com um curl.
 *
 * Em 01/09/2026 os 5 leads que o `crm_leads` tinha na vida inteira eram os 5 de teste (nome
 * "Teste"/"TESTE E2E Spec012", e-mails nossos) — e era deles que saía o ÚNICO `CR(clique→lead)`
 * do portfólio, `polarisia 6,67% (2/30)`. A taxa existia; a demanda, não.
 *
 * A heurística é o piso, não a garantia: teste com nome e e-mail plausíveis passa por ela. Por
 * isso quem testa manda `metadata.teste = true`, e por isso o `--ver` do script lista os leads
 * contados NOMINALMENTE — conferir nome por nome é a única defesa que não depende de heurística.
 *
 * @param {{nome?:string, email?:string|null, metadata?:Record<string,unknown>}} lead
 */
export function ehLeadDeTeste(lead) {
  if (lead?.metadata?.teste === true) return true;
  const nome = String(lead?.nome ?? "").trim().toLowerCase();
  const email = String(lead?.email ?? "").trim().toLowerCase();
  if (/^teste?\b/.test(nome)) return true;
  if (/^teste?[-.+@]/.test(email)) return true;
  return DOMINIOS_INTERNOS.some((d) => email.endsWith(`@${d}`));
}
