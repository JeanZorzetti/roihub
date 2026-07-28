import curated from "@/data/projects.json";
import { listRepos } from "@/lib/github";
import { mergeProjects, reposSemSite } from "@/lib/projects.mjs";

// Ponto único de entrada da lista de projetos do hub. Todo consumidor (ranking, SEO, infra,
// insights, agenda) passa por aqui — nenhum importa data/projects.json direto, senão a aba
// mostra um conjunto e o ranking outro.

type Curated = (typeof curated)[number] & { repo?: string };

export type Project = {
  slug: string;
  nome: string;
  url: string;
  gscInicio?: string;
  receita: number;
  receitaNota: string;
  blockers: number;
  blockersLista: string[];
  seoSeed: number;
  decay: number;
  decayNota: string;
  acao: string;
  acaoDesc: string;
  /** false = repo do GitHub que ainda não tem receita/blockers/ação definidos à mão. */
  curated: boolean;
  repo: string | null;
  repoUrl: string | null;
  pushedAt: string | null;
};

export async function listProjects(): Promise<Project[]> {
  return mergeProjects(curated as Curated[], await listRepos()) as Project[];
}

/** Repos vivos sem homepage — pendências de "todo projeto terá site". */
export async function listReposSemSite(): Promise<{ name: string; url: string; pushedAt: string | null }[]> {
  return reposSemSite(curated as Curated[], await listRepos());
}
