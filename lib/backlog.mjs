// THE PLAN'S BACKLOG (058 US3).
//
// One list of every future task of a project, whatever made it: a planned page, an existing page that
// is not ativa (057 D15), a question of the core, a card the map fires. A task is a 054 lever applied
// to one target (research D4), so the same work from two origins is one task, and the owner's edits
// survive by that key (D13).
//
// This module is the scheduling problem only: cards, merging, order (D7), weeks (D8) and edits. It
// never reads clusters or metas; `plano.mjs` builds the plan's own tasks, attaches impact, and hands
// them here. It imports only `proxima-acao.mjs`, so the 055 mark rule is reused, never copied.
//
// Pure `.mjs` (constitution III): no disk, no network, no `process.env`, no `Date.now()`.

import { ALAVANCAS, DEGRAUS, plano } from "./proxima-acao.mjs";

const ORDEM_DAS_ALAVANCAS = Object.keys(ALAVANCAS);
const ORDEM_DOS_DEGRAUS = DEGRAUS.map((g) => g.id);
/** 054 order: step, then lever declaration. */
export const ordem054 = (a, b) =>
  ORDEM_DOS_DEGRAUS.indexOf(ALAVANCAS[a].degrau) - ORDEM_DOS_DEGRAUS.indexOf(ALAVANCAS[b].degrau) || ORDEM_DAS_ALAVANCAS.indexOf(a) - ORDEM_DAS_ALAVANCAS.indexOf(b);
const porChave = (a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0);
const uniao = (a = [], b = []) => [...new Set([...a, ...b])];

/**
 * @typedef {{tipo: "url"|"planejada"|"termo"|"*", valor: string, rotulo: string}} Alvo
 * @typedef {{intencao: string|null, perguntas: string[], entidades: {nome: string, tipo: string|null}[]}} Briefing
 * @typedef {{chave: string, alavanca: string, alvo: Alvo, origens: string[], kpis: string[], briefing: Briefing|null,
 *            perguntas: string[], paginaNova: boolean, depende: string[], espera: number, prazoFixo?: string|null,
 *            impacto?: {cliques: number, conta: string}|{naoCalculavel: string}, esforco?: {minutos: number, editado: boolean},
 *            responsavel?: {id: string, editado: boolean}}} Tarefa
 */

/** Decoded path without the trailing slash, from a path or a full URL: the one normalizer of `url:` keys. */
export function caminhoNormal(s) {
  let p = String(s);
  try {
    p = new URL(p).pathname;
  } catch {}
  try {
    p = decodeURIComponent(p);
  } catch {}
  return p.replace(/\/+$/, "") || "/";
}

/** A card's target as the map prints it: `«termo»`, or a path with an optional " (…)" annotation. */
export function alvoDoCard(s) {
  const t = String(s).trim();
  if (t.startsWith("«")) return { tipo: "termo", valor: t, rotulo: t };
  return { tipo: "url", valor: caminhoNormal(t.replace(/\s+\(.*\)$/, "")), rotulo: t };
}

/** @param {string} alavanca @param {{tipo: string, valor: string}} alvo */
export const chaveDe = (alavanca, alvo) => `${alavanca}|${alvo.tipo === "*" ? "*" : `${alvo.tipo}:${alvo.valor}`}`;

/**
 * A task with every field present, so merging and ordering never meet `undefined`.
 * @param {string} alavanca @param {Alvo} alvo @param {Partial<Tarefa> & {voltou?: boolean}} [extra] @returns {Tarefa & {voltou?: boolean}}
 */
export function novaTarefa(alavanca, alvo, extra = {}) {
  return { chave: chaveDe(alavanca, alvo), alavanca, alvo, origens: [], kpis: [], briefing: null, perguntas: [], paginaNova: false, depende: [], espera: 0, ...extra };
}

/**
 * The map's fired cards as tasks (research D3–D5). The snapshot goes through 054's own `plano()`, so a
 * lever with a vigente 055 mark is "aguardando" and gives no task, and past `reler` it is back. The
 * targets are the first reason's list IN FULL (`plano()` cuts it to 3 for the panel); a card with no
 * list is one `*` task. A leaf that had no reading when the map was read is a `falta`: the plan says
 * its tasks may be missing instead of passing the gap for "nothing to do" (analyze U3).
 *
 * @param {{disparos?: {chave: string, alavanca: string, estado: string, alvos: string[], nAlvos: number}[],
 *          semLeitura?: {chave: string, alavanca: string, motivo: string}[]}|null} snapshot
 * @param {{marcas?: object[], hoje?: string|null}} [ctx]
 */
export function deCards(snapshot, { marcas = [], hoje = null } = {}) {
  const disparos = Object.fromEntries([
    ...(snapshot?.semLeitura ?? []).map((d) => [d.chave, { ...d, estado: "sem-leitura", alvos: [], nAlvos: 0, piso: false }]),
    ...(snapshot?.disparos ?? []).map((d) => [d.chave, { ...d, motivo: null, piso: false }]),
  ]);
  /** @type {Tarefa[]} */
  const tarefas = [];
  for (const e of plano(disparos, { marcas, hoje }).degraus.flatMap((g) => g.entradas)) {
    if (e.apresentacao !== "ativa" && e.apresentacao !== "voltou") continue;
    const disparadas = e.motivos.filter((m) => m.estado === "dispara" || m.estado === "critica");
    const kpis = [...new Set(disparadas.map((m) => m.chave))];
    const alvos = e.motivos.find((m) => m.alvos.length)?.alvos ?? [];
    const n = Math.max(0, ...disparadas.map((m) => m.nAlvos ?? 0));
    const lista = alvos.length ? alvos.map(alvoDoCard) : [{ tipo: "*", valor: "*", rotulo: n ? `${n} ${n === 1 ? "alvo" : "alvos"}` : "o site inteiro" }];
    for (const alvo of lista) tarefas.push(novaTarefa(e.alavanca, alvo, { origens: ["mapa"], kpis, voltou: e.apresentacao === "voltou" }));
  }
  const faltas = (snapshot?.semLeitura ?? []).map((d) => ({ alavanca: d.alavanca, folha: d.chave, motivo: d.motivo }));
  return { tarefas, faltas };
}

/**
 * The same key from several origins is one task with the origins, leaves and dependencies summed
 * (FR-021). A `*` task is dropped when a concrete task of its lever exists: it is the same work,
 * named better. The input is not mutated.
 *
 * @template {Tarefa} T @param {T[]} tarefas @returns {T[]}
 */
export function juntar(tarefas) {
  /** @type {Map<string, T>} */
  const m = new Map();
  for (const t of tarefas) {
    const x = m.get(t.chave);
    m.set(
      t.chave,
      x
        ? {
            ...x,
            origens: uniao(x.origens, t.origens),
            kpis: uniao(x.kpis, t.kpis),
            depende: uniao(x.depende, t.depende),
            perguntas: uniao(x.perguntas, t.perguntas),
            briefing: x.briefing ?? t.briefing,
            paginaNova: x.paginaNova || t.paginaNova,
            espera: Math.max(x.espera ?? 0, t.espera ?? 0),
          }
        : { ...t },
    );
  }
  const r = [...m.values()];
  const concretas = new Set(r.filter((t) => t.alvo.tipo !== "*").map((t) => t.alavanca));
  return r.filter((t) => t.alvo.tipo !== "*" || !concretas.has(t.alavanca));
}

const razao = (t) => (t.impacto && "cliques" in t.impacto ? t.impacto.cliques / t.esforco.minutos : null);
/** Inside one target: the new page is born first, then 054's steps (índice → … → snippet). */
const dentroDoAlvo = (a, b) => Number(b.paginaNova) - Number(a.paginaNova) || ordem054(a.alavanca, b.alavanca);

/**
 * D7: impact ÷ effort, descending; an impact that cannot be computed goes after every number, in 054
 * order, then by key. Then the tasks of each target are reassigned to the positions they already hold,
 * in dependency order: the global ranking stays and SC-006 holds without a topological sort.
 *
 * @template {Tarefa} T @param {T[]} tarefas @returns {T[]}
 */
export function ordenar(tarefas) {
  const global = [...tarefas].sort((a, b) => {
    const ra = razao(a);
    const rb = razao(b);
    if (ra !== null && rb !== null) return rb - ra || porChave(a, b);
    if (ra !== null || rb !== null) return ra !== null ? -1 : 1;
    return ordem054(a.alavanca, b.alavanca) || porChave(a, b);
  });
  /** @type {Map<string, number[]>} */
  const posicoes = new Map();
  global.forEach((t, i) => {
    if (t.alvo.tipo === "*") return;
    const k = `${t.alvo.tipo}:${t.alvo.valor}`;
    posicoes.set(k, [...(posicoes.get(k) ?? []), i]);
  });
  const r = [...global];
  for (const ps of posicoes.values()) {
    const ts = ps.map((i) => global[i]).sort(dentroDoAlvo);
    ps.forEach((p, j) => (r[p] = ts[j]));
  }
  return r;
}

/**
 * D8: a greedy, deterministic schedule from the current week. Only a new page takes capacity
 * (`capacidade` per week, clarify C); every other task goes to the first week its dependencies allow
 * (`espera` weeks after them: a planned page's indexing waits `semanasAteIndexar`). Pages with a fixed
 * date go first (FR-028). A fixed date already past reads as this week and says so, never the date
 * (FR-005). Only a new page is ever "a-fazer"; a task whose dependency has no week is "bloqueada",
 * naming it (FR-027).
 *
 * @template {Tarefa} T
 * @param {T[]} tarefas in D7 order
 * @param {{capacidade: number, semanaAtual: number, semanas: number, inicio: string}} p
 * @returns {(T & {semana: number|null, estado: "agendada"|"a-fazer"|"bloqueada", motivo: string|null, naoAntes: number|null})[]}
 */
export function agendar(tarefas, { capacidade, semanaAtual, semanas, inicio }) {
  const primeira = Math.max(1, semanaAtual);
  const semanaDoDia = (dia) => Math.floor((Date.parse(`${dia}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / (7 * 864e5)) + 1;
  const dm = (n) => {
    const d = new Date(Date.parse(`${inicio}T12:00:00Z`) + 7 * (n - 1) * 864e5).toISOString();
    return `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  };
  const paginas = (n) => paginasPorSemana.get(n) ?? 0;
  /** @type {Map<number, number>} */
  const paginasPorSemana = new Map();
  const ocupa = (n) => paginasPorSemana.set(n, paginas(n) + 1);
  const daChave = new Map(tarefas.map((t) => [t.chave, t]));
  /** @type {Map<string, {semana: number|null, estado: string, motivo: string|null, naoAntes: number|null}>} */
  const feito = new Map();
  const novas = (n) => `${n} ${n === 1 ? "página nova" : "páginas novas"}`;

  const calcular = (t, pilha) => {
    const fixa = t.prazoFixo ? semanaDoDia(t.prazoFixo) : null;
    const semanaFixa = fixa === null ? null : Math.max(fixa, primeira);
    const vencida = fixa !== null && fixa < primeira ? "data fixada vencida" : null;
    if (t.paginaNova) {
      if (capacidade <= 0) return { semana: null, estado: "a-fazer", motivo: "capacidade 0: nenhuma página nova entra no plano", naoAntes: null };
      if (semanaFixa !== null) {
        if (semanaFixa > semanas) return { semana: null, estado: "a-fazer", motivo: `a data fixada passa da semana ${semanas}`, naoAntes: null };
        if (paginas(semanaFixa) >= capacidade)
          return { semana: null, estado: "a-fazer", motivo: `a data fixada não cabe: a semana ${dm(semanaFixa)} já tem ${novas(paginas(semanaFixa))}`, naoAntes: null };
        ocupa(semanaFixa);
        return { semana: semanaFixa, estado: "agendada", motivo: vencida, naoAntes: null };
      }
      for (let n = primeira; n <= semanas; n++)
        if (paginas(n) < capacidade) {
          ocupa(n);
          return { semana: n, estado: "agendada", motivo: null, naoAntes: null };
        }
      return { semana: null, estado: "a-fazer", motivo: `não cabe nas ${semanas} semanas com ${novas(capacidade)} por semana`, naoAntes: null };
    }
    let minimo = primeira;
    let espera = null;
    for (const k of t.depende) {
      const dep = daChave.get(k);
      if (!dep) continue;
      const r = resolver(dep, pilha);
      if (r.semana === null) return { semana: null, estado: "bloqueada", motivo: `espera ${dep.alvo.rotulo}, que ainda não tem semana`, naoAntes: null };
      if (r.semana + (t.espera ?? 0) >= minimo) {
        minimo = r.semana + (t.espera ?? 0);
        espera = { dep, semana: r.semana };
      }
    }
    const naoAntes = t.depende.length ? minimo : null;
    if (semanaFixa !== null) {
      if (espera && semanaFixa < minimo) return { semana: null, estado: "bloqueada", motivo: `a data fixada vem antes de ${espera.dep.alvo.rotulo}, na semana ${dm(espera.semana)}`, naoAntes };
      if (semanaFixa > semanas) return { semana: null, estado: "bloqueada", motivo: `a data fixada passa da semana ${semanas}`, naoAntes };
      return { semana: semanaFixa, estado: "agendada", motivo: vencida, naoAntes };
    }
    if (minimo > semanas) return { semana: null, estado: "bloqueada", motivo: `espera ${espera?.dep.alvo.rotulo ?? "outra tarefa"} e cai depois da semana ${semanas}`, naoAntes };
    return { semana: minimo, estado: "agendada", motivo: null, naoAntes };
  };
  const resolver = (t, pilha = new Set()) => {
    if (feito.has(t.chave)) return feito.get(t.chave);
    if (pilha.has(t.chave)) return { semana: null, estado: "bloqueada", motivo: "dependência circular", naoAntes: null };
    const r = calcular(t, new Set([...pilha, t.chave]));
    feito.set(t.chave, r);
    return r;
  };

  for (const t of tarefas) if (t.paginaNova && t.prazoFixo) resolver(t);
  for (const t of tarefas) resolver(t);
  return tarefas.map((t) => ({ ...t, ...feito.get(t.chave) }));
}

/**
 * The owner's edits by key (D13): responsible, minutes and fixed date survive a new version while the
 * task exists. Without an edit, the responsible is the version's, and the effort is the version's
 * minutes for the lever: a new page counts as `cobertura`, a question task as `pergunta` × its questions.
 * An edit whose task no longer exists is ignored. Effort only orders (D10); it never moves a week.
 *
 * @template {Tarefa} T
 * @param {T[]} tarefas @param {Map<string, {responsavel: string|null, esforco: number|null, prazo: string|null}>} edicoes
 * @param {{responsavel: string, esforco: Record<string, number>}} padrao
 * @returns {(T & {responsavel: {id: string, editado: boolean}, esforco: {minutos: number, editado: boolean}, prazoFixo: string|null})[]}
 */
export function aplicarEdicoes(tarefas, edicoes, { responsavel, esforco }) {
  return tarefas.map((t) => {
    const e = edicoes.get(t.chave);
    const minutos = t.paginaNova ? esforco.cobertura : t.perguntas?.length ? esforco.pergunta * t.perguntas.length : esforco[t.alavanca];
    return {
      ...t,
      responsavel: { id: e?.responsavel ?? responsavel, editado: Boolean(e?.responsavel) },
      esforco: { minutos: e?.esforco ?? minutos, editado: e?.esforco !== null && e?.esforco !== undefined },
      prazoFixo: e?.prazo ?? null,
    };
  });
}
