import DEMANDAS from "@/data/demanda-estimada.json";
import { dbOn, lerCrawlDePagina, listMarcas, listMetas, listPlanos, type MarcaDoMapa, type MetaDecidida, type Plano } from "@/lib/db";
import { projectBySlug } from "@/lib/autopublish-projects.mjs";
import { cobrir, lerDemanda, montar, PREMISSAS_PADRAO, propor, segundaDe, SEMANAS } from "@/lib/plano.mjs";
import { todaySP } from "@/lib/agenda.mjs";

type Partida = { top20?: number | null; tamBusca?: number | null; pagina1?: number | null } | null;
export type Proposta = ReturnType<typeof propor>[number];
export type Montado = ReturnType<typeof montar>;

const erro = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 80);

/**
 * Everything the plan needs, read once: the frozen demand (JSON), the latest crawl (coverage), the
 * versions and decisions (Postgres) and the 055 marks. No DataForSEO request here, ever (SC-005): the
 * only paid call lives in `scripts/consultar-demanda.mjs`. Both the plan route and the map's "Plano ·
 * semana N" block go through this function, so the two screens cannot build different calendars.
 *
 * `partida` is the GSC starting point the caller already read (D11); `null` keeps it absent.
 * `soAtivo` builds the calendar of the ACTIVE version (the map compares against it), not the draft.
 */
export async function dadosDoPlano(slug: string, partida: Partida, { soAtivo = false } = {}) {
  const hoje = todaySP();
  const demanda = lerDemanda((DEMANDAS as Record<string, { procedencia?: Record<string, unknown>; termos?: Record<string, number> }>)[slug], projectBySlug(slug));

  let crawl: Awaited<ReturnType<typeof lerCrawlDePagina>> = null;
  let planos: Plano[] = [];
  let decisoes: MetaDecidida[] = [];
  let marcas: MarcaDoMapa[] = [];
  const falhas: string[] = [];
  if (dbOn()) {
    try {
      [crawl, planos, marcas] = await Promise.all([lerCrawlDePagina(slug), listPlanos(slug), listMarcas(slug)]);
    } catch (e) {
      falhas.push(`banco do hub: ${erro(e)}`);
    }
  } else falhas.push("sem banco configurado para o hub: versões e decisões não são lidas nem gravadas");

  const ativo = planos.find((p) => p.estado === "ativo") ?? null;
  const atual = soAtivo ? ativo : (planos[0] ?? null);
  if (atual && dbOn()) {
    try {
      decisoes = await listMetas(slug, atual.versao);
    } catch (e) {
      falhas.push(`decisões: ${erro(e)}`);
    }
  }
  const premissas = atual
    ? { capacidade: atual.capacidade, semanasAteIndexar: atual.semanasAteIndexar, semanasAteEstabilizar: atual.semanasAteEstabilizar, pisoApoio: atual.pisoApoio }
    : PREMISSAS_PADRAO;
  const inicio = atual?.inicio ?? segundaDe(hoje)!;
  const clusters = demanda ? cobrir(demanda.clusters, crawl?.paginas ?? null) : [];
  const semCluster = demanda?.semCluster ?? [];
  // The ruled leaves' metas do not depend on demand; without frozen demand only the demand metas go.
  const propostas: Proposta[] = propor(clusters, { premissas, inicio, semCluster, partida }).filter((m) => demanda || m.origem !== "demanda");

  // Decided metas drive the calendar; while the draft is open, undecided ones preview at the proposal.
  const decidida = new Map(decisoes.map((d) => [`${d.chave}@${d.prazo}`, d]));
  const paraMontar = propostas
    .filter((m) => m.valor !== null)
    .flatMap((m) => {
      const d = decidida.get(`${m.chave}@${m.prazo}`);
      if (d?.estado === "recusada") return [];
      return [{ chave: m.chave, prazo: m.prazo, valor: (d?.valor ?? m.valor) as number }];
    });
  const montado = demanda ? montar({ inicio, ...premissas, clusters, semCluster, metas: paraMontar, responsavel: atual?.criadoPor ?? "jean" }) : null;
  const semanaAtual = Math.floor((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / (7 * 864e5)) + 1;

  return {
    hoje,
    demanda,
    crawl,
    clusters,
    semCluster,
    planos,
    atual,
    ativo,
    decisoes,
    decidida,
    marcas,
    falhas,
    premissas,
    inicio,
    propostas,
    montado,
    semanaAtual,
    semanas: SEMANAS,
  };
}
