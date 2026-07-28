export type Repo = {
  name: string;
  homepage: string | null;
  url: string;
  pushedAt: string | null;
  archived: boolean;
  private: boolean;
  description: string | null;
  openIssues: number;
};

export type GithubStatus =
  | { state: "off" }
  | { state: "error"; message: string }
  | { state: "ok"; total: number };

type ApiRepo = {
  name: string;
  homepage: string | null;
  html_url: string;
  pushed_at: string | null;
  archived: boolean;
  private: boolean;
  description: string | null;
  open_issues_count: number;
};

// TTL 10 min (mesma régua do listSites do GSC): repo criado ou homepage corrigida no GitHub
// aparece sem redeploy, e as páginas force-dynamic não gastam 1 request de API por load.
let cache: { at: number; repos: Repo[] } | null = null;
let lastError: string | null = null;

export function githubOn(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

async function fetchPage(page: number): Promise<ApiRepo[]> {
  const res = await fetch(
    `https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=pushed&page=${page}`,
    {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "roihub",
      },
    }
  );
  if (!res.ok) throw new Error(`GitHub ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

/**
 * Repos do dono da conta. Falha NUNCA derruba o hub: sem token ou com API fora, devolve []
 * e a lista cai na curadoria do projects.json — o motivo aparece no rodapé via githubStatus().
 */
export async function listRepos(): Promise<Repo[]> {
  if (!githubOn()) return [];
  if (cache && Date.now() - cache.at < 600_000) return cache.repos;
  try {
    const all: ApiRepo[] = [];
    // ponytail: para na 1ª página curta; 3 páginas = 300 repos, sobe o teto se passar disso
    for (let page = 1; page <= 3; page++) {
      const batch = await fetchPage(page);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    const repos = all.map((r) => ({
      name: r.name,
      homepage: r.homepage,
      url: r.html_url,
      pushedAt: r.pushed_at,
      archived: r.archived,
      private: r.private,
      description: r.description,
      openIssues: r.open_issues_count,
    }));
    cache = { at: Date.now(), repos };
    lastError = null;
    return repos;
  } catch (e) {
    lastError = e instanceof Error ? e.message.slice(0, 200) : String(e);
    return cache?.repos ?? []; // cache vencido ainda vale mais que lista vazia
  }
}

export async function githubStatus(): Promise<GithubStatus> {
  if (!githubOn()) return { state: "off" };
  const repos = await listRepos();
  if (lastError) return { state: "error", message: lastError };
  return { state: "ok", total: repos.length };
}
