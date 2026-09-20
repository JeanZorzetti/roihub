// O INVENTÁRIO DE TERMOS MONITORADOS (034).
//
// A fórmula do board para a penetração no Top 3 é `(termos com posição ≤ 3) ÷ (total monitorado)`.
// O numerador sempre existiu no Search Console; o denominador não existia em lugar nenhum, e foi
// por isso que `MEDIDO_POR.penetracaoTop3` ficou vazio desde 19/09/2026. Este módulo é o
// denominador.
//
// ⚠️ A LISTA É CONGELADA, NÃO DERIVADA NA LEITURA, e a diferença é o KPI inteiro. Uma lista que se
// recalcula a cada corrida ("todo termo com ≥ 20 impressões nos últimos 8 meses") anda sozinha: o
// termo que perde tráfego SAI do inventário, o denominador encolhe, e a penetração sobe sem que
// nada tenha melhorado. Medido em 20/09/2026 na Atma: o mesmo inventário dá 49,0% em março e 10,1%
// hoje — um denominador móvel esconderia a queda inteira.
//
// A validação mora aqui e não só no gerador (`scripts/derivar-inventario.mjs`) porque o arquivo é
// editável à mão e o gerador não roda a cada deploy. Quem acrescentar um termo de marca com o
// editor descobre no `npm test`, não em produção.
//
// `.mjs` puro pela constituição (III): nenhuma leitura de disco, nenhum `process.env`. Quem chama
// entrega o objeto já parseado — a borda (`app/gsc/mapa/page.tsx`) importa o JSON, o teste injeta
// o dele.

import { regexDeMarca } from "./marca.mjs";

/** @typedef {{inicio: string, fim: string}} Janela */
/** @typedef {{congeladoEm: string, janela: Janela, piso: number, dimensao?: string,
 *             propriedades?: string[], hosts?: string[], excluiMarca: string[], porque?: string}} Procedencia */
/** @typedef {{termos: string[], procedencia: Procedencia, total: number}} Inventario */

const OBRIGATORIOS = ["congeladoEm", "janela", "piso", "excluiMarca"];

/**
 * Valida uma entrada do arquivo e devolve o inventário pronto para medir.
 *
 * LANÇA em tudo que é erro de curadoria. Não devolve `null` para nenhum deles de propósito:
 * `null` é a resposta para "este projeto não tem inventário", que é o estado correto de 34 dos 35
 * projetos e imprime "não apurado" na tela. Colapsar os dois faria arquivo quebrado parecer com
 * projeto não curado, e os consertos são opostos.
 *
 * @param {string} slug
 * @param {{termos?: unknown, procedencia?: Partial<Procedencia>}} entrada
 * @returns {Inventario}
 */
export function validarInventario(slug, entrada) {
  const p = entrada?.procedencia;
  if (!p) throw new Error(`inventário de ${slug}: sem procedencia`);
  for (const campo of OBRIGATORIOS) {
    if (p[campo] === undefined || p[campo] === null) {
      throw new Error(`inventário de ${slug}: procedencia sem ${campo}`);
    }
  }
  // A janela é o campo que permite refazer a lista e conferir que daria a mesma coisa. Meia janela
  // não permite: um início sem fim não delimita nada.
  if (!p.janela.inicio || !p.janela.fim) throw new Error(`inventário de ${slug}: janela incompleta`);
  if (!Array.isArray(p.excluiMarca)) throw new Error(`inventário de ${slug}: excluiMarca não é lista`);

  const termos = entrada.termos;
  if (!Array.isArray(termos) || termos.length === 0) {
    throw new Error(`inventário de ${slug}: lista de termos vazia`);
  }
  const vistos = new Set();
  for (const t of termos) {
    if (typeof t !== "string" || t.trim() === "") throw new Error(`inventário de ${slug}: termo vazio na lista`);
    if (vistos.has(t)) throw new Error(`inventário de ${slug}: termo duplicado — "${t}"`);
    vistos.add(t);
  }
  // `regexDeMarca` e não um `includes`: é a MESMA função que separa marca de não-marca na série
  // (025), com `\b` nas duas pontas. Sem ela, "atma" reprovaria "atmosfera de consultorio", e uma
  // segunda régua de marca aqui divergiria da primeira na primeira variante nova.
  if (p.excluiMarca.length > 0) {
    const re = new RegExp(regexDeMarca(p.excluiMarca), "i");
    const intruso = termos.find((t) => re.test(t));
    if (intruso) throw new Error(`inventário de ${slug}: termo de marca na lista — "${intruso}"`);
  }
  return { termos, procedencia: /** @type {Procedencia} */ (p), total: termos.length };
}

/**
 * O inventário de um projeto, ou `null` quando ele não tem um.
 *
 * @param {string} slug
 * @param {Record<string, {termos?: unknown, procedencia?: Partial<Procedencia>}>|null|undefined} arquivo
 * @returns {Inventario|null}
 */
export function lerInventario(slug, arquivo) {
  const entrada = arquivo?.[slug];
  if (!entrada) return null;
  return validarInventario(slug, entrada);
}
