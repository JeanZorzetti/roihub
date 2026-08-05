// Lógica pura do CRM: validação do payload de ingestão contra data/pipelines.json.
// .mjs porque o `node --test` importa isto sem transpilar (ver CLAUDE.md §5).

/** Etapas de uma pipeline, ou [] se o slug não existe no JSON. */
export function etapasDe(pipelines, slug) {
  return pipelines.find((p) => p.slug === slug)?.etapas ?? [];
}

const texto = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * @typedef {{
 *   externalId: string, pipeline: string, etapa: string, nome: string,
 *   email: string | null, telefone: string | null, origem: string,
 *   valor: number | null, metadata: Record<string, unknown>
 * }} Lead
 */

/**
 * Normaliza e valida o corpo de `POST /api/crm/leads`.
 *
 * `etapa` é validada aqui, contra o JSON — sem FK e sem tabela de etapas. Etapa
 * que não existe na pipeline é 400: o card cair num balde inexistente some da
 * tela sem erro, que é pior que a requisição falhar.
 *
 * @returns {{ ok: true, lead: Lead } | { ok: false, erro: string }}
 */
export function parseLead(body, pipelines) {
  if (!body || typeof body !== "object") return { ok: false, erro: "corpo inválido" };

  const pipeline = texto(body.pipeline, 60);
  const etapas = etapasDe(pipelines, pipeline);
  if (!etapas.length) return { ok: false, erro: `pipeline desconhecida: ${pipeline || "(vazia)"}` };

  const etapa = texto(body.etapa, 60) || etapas[0];
  if (!etapas.includes(etapa)) return { ok: false, erro: `etapa desconhecida: ${etapa}` };

  const nome = texto(body.nome, 200);
  if (!nome) return { ok: false, erro: "nome é obrigatório" };

  const origem = texto(body.origem, 80);
  if (!origem) return { ok: false, erro: "origem é obrigatória" };

  // external_id é a chave de dedupe do reenvio. Sem ele o mesmo POST repetido
  // grava dois cards; o ON CONFLICT precisa de algo para conflitar.
  const externalId = texto(body.external_id, 120);
  if (!externalId) return { ok: false, erro: "external_id é obrigatório" };

  const valorNum = Number(body.valor);
  const valor = Number.isFinite(valorNum) && valorNum >= 0 ? valorNum : null;

  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  return {
    ok: true,
    lead: {
      externalId,
      pipeline,
      etapa,
      nome,
      email: texto(body.email, 200) || null,
      telefone: texto(body.telefone, 40) || null,
      origem,
      valor,
      metadata,
    },
  };
}
