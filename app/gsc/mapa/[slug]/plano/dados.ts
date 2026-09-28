import DEMANDAS from "@/data/demanda-estimada.json";
import {
  dbOn,
  lerCrawlDePagina,
  lerDisparos,
  lerIndexacaoPorUrl,
  listMarcas,
  listMetas,
  listNucleo,
  listPlanos,
  listTarefas,
  type DisparoGravado,
  type EdicaoDeTarefa,
  type MarcaDoMapa,
  type MetaDecidida,
  type Plano,
  type SemLeituraGravada,
} from "@/lib/db";
import type { GscPaginas } from "@/lib/gsc";
import { projectBySlug } from "@/lib/autopublish-projects.mjs";
import { ALAVANCAS } from "@/lib/proxima-acao.mjs";
import { aplicarNucleo, backlogDoPlano, cobrir, ESFORCO_PADRAO, estadoDaPagina, lerDemanda, linhaDoOkr, montar, nomeDe, PREMISSAS_PADRAO, propor, segundaDe, SEMANAS } from "@/lib/plano.mjs";
import { dadosDaFicha } from "@/lib/ficha-dados";
import { todaySP } from "@/lib/agenda.mjs";

type Partida = { top20?: number | null; tamBusca?: number | null; pagina1?: number | null } | null;
export type Proposta = ReturnType<typeof propor>[number];
export type Montado = ReturnType<typeof montar>;
/** The map's fired cards, as the map writes them to `hub_mapa_disparo` (research D3). */
export type DisparosDoMapa = { disparos: DisparoGravado[]; semLeitura: SemLeituraGravada[] };

const erro = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 80);

/**
 * Everything the plan needs, read once: the frozen demand (JSON), the latest crawl (coverage), the
 * versions, decisions, the core, the owner's task edits and the 055 marks (Postgres). No DataForSEO
 * request here, ever (SC-005). Both the plan route and the map's plan block go through this function,
 * so the two screens cannot build different backlogs.
 *
 * 058: the whole pipeline, in the order research D7–D9 fix: coverage → the owner's core → the backlog
 * (the plan's own tasks and the map's cards, merged, with impact, edits, order and schedule) → the metas
 * from the scheduled page weeks → the calendar.
 *
 * `partida` is the GSC starting point the map already read (D15); the plan route passes `null`.
 * `soAtivo` builds the ACTIVE version (the map compares against it), not the draft.
 * `paginas` is the caller's page-dimension Search Console read (D13): it decides each page's state.
 * `disparos` is the map's in-memory cards; without it, the last snapshot the map wrote is read.
 * `comOkr` (the plan route only: the map does not pay ~3.3 s) fetches the `/okr` goal tree when the
 * project declares a meta in `listProjects()` (Principle I), in parallel with the DB reads (D14).
 */
export async function dadosDoPlano(
  slug: string,
  partida: Partida,
  {
    soAtivo = false,
    paginas = null,
    disparos = null,
    comOkr = null,
  }: { soAtivo?: boolean; paginas?: GscPaginas; disparos?: DisparosDoMapa | null; comOkr?: { temMeta: boolean } | null } = {},
) {
  const hoje = todaySP();
  const ficha = comOkr?.temMeta ? dadosDaFicha(slug).catch((e: unknown) => ({ falhou: erro(e) })) : null;
  const demanda = lerDemanda((DEMANDAS as Record<string, { procedencia?: Record<string, unknown>; termos?: Record<string, number> }>)[slug], projectBySlug(slug));

  let crawl: Awaited<ReturnType<typeof lerCrawlDePagina>> = null;
  let planos: Plano[] = [];
  let decisoes: MetaDecidida[] = [];
  let marcas: MarcaDoMapa[] = [];
  let classes: Awaited<ReturnType<typeof lerIndexacaoPorUrl>> = null;
  let nucleo: Awaited<ReturnType<typeof listNucleo>> = { decisoes: [], itens: [] };
  let edicoes = new Map<string, EdicaoDeTarefa>();
  const falhas: string[] = [];
  if (dbOn()) {
    try {
      [crawl, planos, marcas, classes, nucleo, edicoes] = await Promise.all([
        lerCrawlDePagina(slug),
        listPlanos(slug),
        listMarcas(slug),
        lerIndexacaoPorUrl(slug),
        listNucleo(slug),
        listTarefas(slug),
      ]);
    } catch (e) {
      falhas.push(`banco do hub: ${erro(e)}`);
    }
  } else falhas.push("sem banco configurado para o hub: versões e decisões não são lidas nem gravadas");

  // D3: the map's cards. A failed read builds the rest anyway and says what it costs.
  let snapshot: (DisparosDoMapa & { lidoEm: string | null }) | null = disparos ? { ...disparos, lidoEm: null } : null;
  let snapshotFalhou: string | null = null;
  if (!snapshot && dbOn()) {
    try {
      snapshot = await lerDisparos(slug);
    } catch (e) {
      snapshotFalhou = erro(e);
    }
  }

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
    ? {
        capacidade: atual.capacidade,
        semanasAteIndexar: atual.semanasAteIndexar,
        semanasAteEstabilizar: atual.semanasAteEstabilizar,
        pisoApoio: atual.pisoApoio,
        esforco: { ...ESFORCO_PADRAO, ...atual.esforco },
      }
    : PREMISSAS_PADRAO;
  const inicio = atual?.inicio ?? segundaDe(hoje)!;
  const semanaAtual = Math.floor((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / (7 * 864e5)) + 1;
  const estados = Object.fromEntries((crawl?.paginas ?? []).map((pg) => [pg.url, estadoDaPagina(pg.url, { classes, impressoes: paginas })]));
  // 058/D11: the owner's core decisions go in before the schedule, so a pointed page stops the planned one.
  const clusters = demanda ? aplicarNucleo(cobrir(demanda.clusters, crawl?.paginas ?? null, { estados }), { ...nucleo, estados, ano: Number(hoje.slice(0, 4)) }) : [];
  const semCluster = demanda?.semCluster ?? [];
  const b = demanda
    ? backlogDoPlano(clusters, { premissas, inicio, hoje, semanaAtual, marcas, responsavel: atual?.criadoPor ?? "jean", snapshot, edicoes })
    : null;
  // The ruled leaves' metas do not depend on demand; without frozen demand only the demand metas go.
  const propostas: Proposta[] = propor(clusters, { premissas, inicio, semCluster, partida, marcas, semanaDaPagina: b?.semanaDaPagina }).filter(
    (m) => demanda || m.origem !== "demanda",
  );

  // Decided metas drive the calendar; while the draft is open, undecided ones preview at the proposal.
  const decidida = new Map(decisoes.map((d) => [`${d.chave}@${d.prazo}`, d]));
  const paraMontar = propostas
    .filter((m) => m.valor !== null)
    .flatMap((m) => {
      const d = decidida.get(`${m.chave}@${m.prazo}`);
      if (d?.estado === "recusada") return [];
      return [{ chave: m.chave, prazo: m.prazo, valor: (d?.valor ?? m.valor) as number }];
    });
  // D14: the plan's side is the 180-day clicks meta as decided — approved or edited, the proposal while
  // undecided — and a refused one has nothing to compare (analyze A1).
  let okr: ReturnType<typeof linhaDoOkr> | { falhou: string } | null = null;
  if (comOkr) {
    const m = propostas.find((x) => x.chave === "cliques" && x.prazo === 180);
    const dec = m ? decidida.get("cliques@180") : undefined;
    const lida = ficha ? await ficha : null;
    okr =
      lida && "falhou" in lida
        ? { falhou: lida.falhou }
        : linhaDoOkr(lida?.arvore ?? null, (dec?.valor ?? m?.valor ?? 0) as number, { temMeta: comOkr.temMeta && lida !== null, recusada: dec?.estado === "recusada" });
  }
  const montado = b ? montar({ inicio, ...premissas, clusters, semCluster, metas: paraMontar, marcas, tarefas: b.backlog, semanaDaPagina: b.semanaDaPagina }) : null;

  // What is missing from the map's cards, as its consequence for the plan (research D3, analyze U3):
  // one line per lever, its unread leaves grouped by reason, so eight leaves do not bury the plan.
  const avisosDoBacklog = !demanda
    ? []
    : snapshotFalhou
      ? [`As tarefas que o mapa dispara não entraram: ${snapshotFalhou}.`]
      : !snapshot
        ? ["As tarefas que o mapa dispara ainda não foram lidas: abra o mapa uma vez."]
        : [];
  const faltas = [...Map.groupBy(b?.faltas ?? [], (f) => f.alavanca)].map(([alavanca, fs]) => ({
    alavanca: ALAVANCAS[alavanca as keyof typeof ALAVANCAS].curta,
    folhas: [...Map.groupBy(fs, (f) => f.motivo)].map(([motivo, xs]) => `${xs.map((f) => nomeDe(f.folha)).join(", ")} (${motivo})`).join("; "),
  }));

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
    backlog: b?.backlog ?? [],
    disparosLidosEm: snapshot?.lidoEm ?? null,
    avisosDoBacklog,
    faltas,
    okr,
    semanaAtual,
    semanas: SEMANAS,
  };
}
