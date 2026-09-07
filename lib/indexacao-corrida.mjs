// Orçamento, fila, amostra e classificação da corrida de indexação (022).
//
// Módulo PURO: zero rede, zero banco, zero process.env. É deliberado e é o que torna as duas
// regras mais caras desta feature testáveis SEM GASTAR UMA INSPEÇÃO — descobri-las com um dia
// inteiro de dados contaminados é o custo que a alternativa cobra.
//
// As duas regras:
//   1. a quota da URL Inspection API é ~2000/dia POR PROPRIEDADE, e 21 dos 35 projetos resolvem
//      para `sc-domain:roilabs.com.br`. Eles DIVIDEM uma quota, não têm 2000 cada. Um teto por
//      projeto multiplicaria a quota real por 21 e as últimas inspeções voltariam 429.
//   2. um 429 gravado como "não indexada" inverte o sinal: quanto mais o sistema falha, pior o
//      site parece. Por isso `falha` é uma quinta classe, fora do numerador E do denominador.
import { estaIndexada } from "./indexacao.mjs";

/** @typedef {{slug: string, propriedade: string|null, declaradas: number, ultimaApuracao: string|null}} Candidato */
/** @typedef {{slug: string, cota: number, motivo: string|null}} Fatia */

/**
 * A fila do dia: última apuração mais antiga primeiro, nunca apurado antes de tudo.
 *
 * Desempate por `slug` porque uma ordenação não-determinística faria a mesma corrida produzir
 * cotas diferentes a cada execução — e aí a fração se moveria por ordem de fila, não por mudança
 * no site. `dia % n` foi rejeitado pelo motivo de sempre: encolher a lista de projetos
 * reembaralharia todo mundo.
 * @param {Candidato[]} candidatos
 */
export function filaDoDia(candidatos) {
  return [...candidatos].sort((a, b) => {
    // "" ordena antes de qualquer "YYYY-MM-DD": nunca apurado é o mais atrasado que existe.
    const x = a.ultimaApuracao ?? "";
    const y = b.ultimaApuracao ?? "";
    if (x !== y) return x < y ? -1 : 1;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}

/**
 * Distribui as inspeções: cada projeto recebe `min(declaradas, saldo da propriedade, saldo da
 * corrida)`, e o saldo é decrementado POR PROPRIEDADE.
 *
 * O teto da corrida é para o TEMPO, não para a quota: 400 inspeções em série a ~300 ms dão ~2 min,
 * e gastar as 2000 da propriedade numa única requisição HTTP encostaria no proxy do EasyPanel. A
 * quota sobrante não se perde — o rodízio a consome nos dias seguintes.
 *
 * `sem_propriedade` sai daqui com cota 0 e sem consumir saldo: host fora de toda propriedade do
 * GSC não é "não indexado", é "não há onde olhar". Projeto sem URL declarada (`declaradas: 0`) sai
 * com motivo `null` — quem sabe se foi `sem_sitemap` ou `sitemap_vazio` é o inventário, não o
 * orçamento, e adivinhar aqui somaria dois estados que a tela precisa separar.
 * @param {Candidato[]} fila @returns {Fatia[]}
 */
export function repartir(fila, tetoPorPropriedade, tetoDaCorrida) {
  const saldo = new Map();
  let corrida = tetoDaCorrida;
  const fatias = [];
  for (const c of fila) {
    if (!c.propriedade) {
      fatias.push({ slug: c.slug, cota: 0, motivo: "sem_propriedade" });
      continue;
    }
    if (!saldo.has(c.propriedade)) saldo.set(c.propriedade, tetoPorPropriedade);
    const cota = Math.max(0, Math.min(c.declaradas, saldo.get(c.propriedade), corrida));
    saldo.set(c.propriedade, saldo.get(c.propriedade) - cota);
    corrida -= cota;
    // FR-015: pulado por esgotamento é ESTADO PRÓPRIO, distinguível de "apurei e deu zero". Sem
    // isso, "não perguntei" e "perguntei e não achei nada" viram o mesmo número na tela.
    fatias.push({ slug: c.slug, cota, motivo: cota === 0 && c.declaradas > 0 ? "sem_orcamento" : null });
  }
  return fatias;
}

/**
 * A amostra é o PREFIXO do sitemap, na ordem em que o arquivo declara. Sem embaralhar, sem semente.
 *
 * Estável entre corridas por construção — duas corridas seguidas sobre o mesmo inventário amostram
 * o mesmo conjunto, e um sitemap que ganha URLs no fim não move a amostra. Amostra aleatória
 * oscilaria e a fração pareceria movimento do site.
 *
 * O viés é real e ACEITO: o número não é estimativa não-enviesada da taxa do site, é a taxa das N
 * primeiras URLs que o site declara como prioritárias. Por isso a tela é obrigada a dizer "200 de
 * 1200" na mesma frase.
 */
export const amostra = (urls, cota) => urls.slice(0, cota);

/**
 * Uma linha de `inspecionarIndexacao` em exatamente uma das cinco classes.
 *
 * A ORDEM dos testes é a regra, não detalhe de implementação: `erro` vem PRIMEIRO porque uma
 * resposta de erro tem `verdict: ""` e `coverage: ""` e cairia em "outra" se fosse checada depois —
 * ou seja, todo 429 de quota viraria uma não-indexação silenciosa.
 */
export function classificar(linha) {
  if (linha.erro) return "falha";
  if (estaIndexada(linha)) return "indexada";
  // As duas classes NUNCA somam num balde único: "rastreada e recusada" significa que o Googlebot
  // leu o conteúdo e disse não — nenhum conserto técnico move isso, é trabalho editorial.
  // "descoberta e não lida" é o oposto: ele nem chegou lá, e aí é link interno e crawl.
  if (/^Crawled - currently not indexed/i.test(linha.coverage)) return "rastreada_nao_indexada";
  if (/^Discovered - currently not indexed/i.test(linha.coverage)) return "descoberta_nao_indexada";
  return "outra";
}

const CAMPO = {
  indexada: "indexadas",
  rastreada_nao_indexada: "rastreadasNaoIndexadas",
  descoberta_nao_indexada: "descobertasNaoIndexadas",
  outra: "outras",
  falha: "falhas",
};

/**
 * As cinco contagens mais as duas taxas.
 *
 * `taxa = indexadas ÷ (inspecionadas − falhas)`: a falha sai do denominador junto com o numerador,
 * senão uma corrida que bateu na quota reportaria o site como desindexado. Denominador 0 devolve
 * `null` — "não apurado", nunca 0%.
 *
 * Invariante: `inspecionadas = indexadas + rastreadas + descobertas + outras + falhas`. Se ela
 * quebrar, uma URL caiu em dois baldes ou em nenhum, e é assim que uma taxa começa a mentir.
 */
export function agregar(linhas) {
  const c = { indexadas: 0, rastreadasNaoIndexadas: 0, descobertasNaoIndexadas: 0, outras: 0, falhas: 0 };
  for (const l of linhas) c[CAMPO[classificar(l)]]++;
  const denominador = linhas.length - c.falhas;
  return {
    ...c,
    inspecionadas: linhas.length,
    taxa: denominador > 0 ? c.indexadas / denominador : null,
    rejeicao: denominador > 0 ? (c.rastreadasNaoIndexadas + c.descobertasNaoIndexadas) / denominador : null,
  };
}
