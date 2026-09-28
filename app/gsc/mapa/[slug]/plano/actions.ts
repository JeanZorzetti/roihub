"use server";

import { revalidatePath } from "next/cache";
import DEMANDAS from "@/data/demanda-estimada.json";
import {
  ativarPlano,
  criarPlano,
  dbOn,
  decidirItem as gravarItem,
  decidirMeta as gravarDecisao,
  editarTarefa as gravarTarefa,
  listMetas,
  listPlanos,
  setIntencao,
  setPaginaResponsavel,
  setPremissas,
  type MetaDecidida,
} from "@/lib/db";
import { projetosDeBusca, SLUGS_DE_BUSCA } from "@/lib/projects";
import { hostsDeclarados } from "@/lib/projects.mjs";
import { projectBySlug } from "@/lib/autopublish-projects.mjs";
import { todaySP } from "@/lib/agenda.mjs";
import { lerDecisao, lerDemanda, lerItem, lerNucleo, lerPlano, lerTarefa, metasExigidas } from "@/lib/plano.mjs";

/**
 * The four writes of the plan (057). Validation lives in the pure `lerPlano`/`lerDecisao`; input outside
 * the contract writes nothing, like the map's marks (055). An active version never changes: the SQL
 * itself only touches `rascunho` rows (FR-017), so a stale form cannot rewrite an approved meta.
 */
const revalidar = (projeto: string) => {
  revalidatePath(`/gsc/mapa/${projeto}`);
  revalidatePath(`/gsc/mapa/${projeto}/plano`);
};
const versaoDe = (fd: FormData) => Number(fd.get("versao"));

export async function criarVersao(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const p = lerPlano(Object.fromEntries(fd), { slugs: SLUGS_DE_BUSCA });
  if (!p) return;
  // One draft at a time: a second draft would split the decisions between two versions.
  const [ultimo] = await listPlanos(p.projeto);
  if (ultimo?.estado === "rascunho") return;
  await criarPlano({ ...p, criado: todaySP() });
  revalidar(p.projeto);
}

export async function salvarPremissas(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const p = lerPlano(Object.fromEntries(fd), { slugs: SLUGS_DE_BUSCA });
  const versao = versaoDe(fd);
  if (!p || !Number.isInteger(versao)) return;
  const { projeto, ...premissas } = p;
  await setPremissas(projeto, versao, premissas);
  revalidar(projeto);
}

export async function decidirMeta(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const m = lerDecisao(Object.fromEntries(fd), { slugs: SLUGS_DE_BUSCA });
  if (!m) return;
  // `estado` is one of the three: `lerDecisao` returns null for anything else.
  await gravarDecisao(m as MetaDecidida);
  revalidar(m.projeto);
}

export async function ativar(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const projeto = String(fd.get("projeto") ?? "");
  const versao = versaoDe(fd);
  if (!SLUGS_DE_BUSCA.includes(projeto) || !Number.isInteger(versao)) return;
  // Refused while any meta has no decision: an active plan with an undecided meta has no milestone for it.
  const decididas = new Set((await listMetas(projeto, versao)).map((m) => `${m.chave}@${m.prazo}`));
  if (metasExigidas().some((m) => !decididas.has(`${m.chave}@${m.prazo}`))) return;
  await ativarPlano(projeto, versao);
  revalidar(projeto);
}

/**
 * 058/D11: the core's forms validate against the same seeds and hosts the page shows: the cluster
 * seeds of the frozen demand, and the project's declared hosts.
 */
async function contextoDoNucleo(fd: FormData) {
  const projeto = String(fd.get("projeto") ?? "");
  const p = SLUGS_DE_BUSCA.includes(projeto) ? (await projetosDeBusca()).find((x) => x.slug === projeto) : undefined;
  const demanda = lerDemanda((DEMANDAS as Record<string, { procedencia?: Record<string, unknown>; termos?: Record<string, number> }>)[projeto], projectBySlug(projeto));
  return { slugs: SLUGS_DE_BUSCA, sementes: demanda?.clusters.map((c) => c.semente) ?? [], hosts: p ? hostsDeclarados(p) : [] };
}

export async function decidirIntencao(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const n = lerNucleo(Object.fromEntries(fd), await contextoDoNucleo(fd));
  if (!n || n.intencao === undefined) return;
  await setIntencao(n.projeto, n.semente, n.intencao, n.por);
  revalidar(n.projeto);
}

export async function apontarPagina(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const n = lerNucleo(Object.fromEntries(fd), await contextoDoNucleo(fd));
  if (!n || n.pagina === undefined) return;
  await setPaginaResponsavel(n.projeto, n.semente, n.pagina, n.por);
  revalidar(n.projeto);
}

export async function decidirItem(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const i = lerItem(Object.fromEntries(fd), await contextoDoNucleo(fd));
  if (!i) return;
  await gravarItem(i);
  revalidar(i.projeto);
}

/** 058/D13: the owner's edit of one backlog task, kept by lever and target across versions. */
export async function editarTarefa(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const t = lerTarefa(Object.fromEntries(fd), { slugs: SLUGS_DE_BUSCA, hoje: todaySP() });
  if (!t) return;
  await gravarTarefa(t);
  revalidar(t.projeto);
}

/**
 * Approves every still-undecided proposal in one submit, as one person: the same `lerDecisao` per meta,
 * and a meta outside the contract is skipped, never written. Refusing or editing stays one by one.
 */
export async function aprovarPropostas(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  let metas: unknown;
  try {
    metas = JSON.parse(String(fd.get("metas") ?? "[]"));
  } catch {
    return;
  }
  if (!Array.isArray(metas) || metas.length > 64) return;
  const comum = { projeto: fd.get("projeto"), versao: fd.get("versao"), responsavel: fd.get("responsavel"), estado: "aprovada" };
  let projeto: string | null = null;
  for (const m of metas) {
    const d = lerDecisao({ ...(m as Record<string, unknown>), ...comum }, { slugs: SLUGS_DE_BUSCA });
    if (!d) continue;
    await gravarDecisao(d as MetaDecidida);
    projeto = d.projeto;
  }
  if (projeto) revalidar(projeto);
}
