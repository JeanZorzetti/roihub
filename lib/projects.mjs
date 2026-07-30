// A chave de um projeto é a URL DO SITE, não o nome do repo: um repo pode hospedar vários
// sites (o monorepo `roilabs` serve roilabs.com.br e goiania; o tapepro tem repo próprio,
// `tape` — conferido em 30/07) e todo o resto do hub
// — health check, GSC, crawl stats, autopublishing — só sabe trabalhar com domínio de produção.
// O GitHub entra como fonte da LISTA (todo repo com homepage vira projeto) e como atributo
// (repo, último push) dos projetos que já existem.

/**
 * Curadoria que a API do GitHub não tem como saber. Repo novo entra com tudo zerado.
 * Função, não constante: espalhar um objeto literal daria a MESMA blockersLista a todos os
 * projetos novos, e o evaluate() concatena flags do insights nela.
 */
export const uncurated = () => ({
  receita: 0,
  receitaNota: "",
  blockers: 0,
  blockersLista: [],
  seoSeed: 0,
  decay: 0,
  decayNota: "",
  acaoDesc: "",
});

/**
 * Homepage do GitHub vira URL de projeto só se der pra bater no host: o health check faz
 * fetch e o GSC faz `new URL(u).hostname`. Campo livre digitado à mão → valida na entrada.
 * @param {string|null|undefined} raw
 * @returns {string|null} URL https normalizada com barra final, ou null se inservível
 */
export function normalizeSite(raw) {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null; // "localhost", "meu-app" → não é site
    return url.origin + (url.pathname === "/" ? "/" : url.pathname);
  } catch {
    return null;
  }
}

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** Qual repo uma entrada curada reivindica: o campo `repo` explícito, senão o próprio slug. */
const claimOf = (p) => p.repo ?? p.slug;

/**
 * Lista final do hub = curadoria manual + todo repo vivo com homepage que ninguém curou.
 * Curado sempre vence: a URL, o nome e as notas vêm do projects.json, o GitHub só anexa
 * repo/último push. Repo sem homepage não vira projeto — não há site pra medir.
 * @param {any[]} curated data/projects.json
 * @param {{name:string,homepage:string|null,url:string,pushedAt:string|null,archived:boolean,description:string|null}[]} repos
 * @returns {any[]}
 */
export function mergeProjects(curated, repos) {
  const byName = new Map(repos.map((r) => [r.name, r]));
  const claimed = new Set(curated.map(claimOf));
  const hosts = new Set(curated.map((p) => hostOf(p.url)).filter(Boolean));

  const out = curated.map((p) => {
    const repo = byName.get(claimOf(p)) ?? null;
    return {
      ...p,
      curated: true,
      repo: repo?.name ?? null,
      repoUrl: repo?.url ?? null,
      pushedAt: repo?.pushedAt ?? null,
    };
  });

  for (const r of repos) {
    if (r.archived || claimed.has(r.name)) continue;
    const url = normalizeSite(r.homepage);
    const host = url && hostOf(url);
    if (!url || !host || hosts.has(host)) continue; // mesmo site já curado sob outro slug
    hosts.add(host);
    out.push({
      ...uncurated(),
      slug: r.name,
      nome: r.description?.trim() || r.name,
      url,
      acao: `Curar ${r.name} — sem receita, blockers nem ação em data/projects.json`,
      curated: false,
      repo: r.name,
      repoUrl: r.url,
      pushedAt: r.pushedAt,
    });
  }
  return out;
}

/**
 * Repos que nunca terão site público: a `homepage` vazia é decisão, não pendência, então eles
 * não entram na lista de "repos ainda sem site". `roihub` é 100% admin; `repo-de-teste` é
 * descartável. Arquivar o repo tem o mesmo efeito e é o caminho preferido para APOSENTAR um
 * projeto — esta lista é só para os que seguem vivos de propósito sem site.
 */
const semSitePorDecisao = new Set(["roihub", "repo-de-teste"]);

/**
 * Repos vivos que ainda não têm site: ficam de fora do ranking (não há o que medir) e viram
 * a lista de pendências de "todo projeto terá site".
 * @returns {{name:string,url:string,pushedAt:string|null}[]}
 */
export function reposSemSite(curated, repos) {
  const claimed = new Set(curated.map(claimOf));
  return repos
    .filter(
      (r) =>
        !r.archived &&
        !claimed.has(r.name) &&
        !semSitePorDecisao.has(r.name) &&
        !normalizeSite(r.homepage),
    )
    .map((r) => ({ name: r.name, url: r.url, pushedAt: r.pushedAt }));
}
