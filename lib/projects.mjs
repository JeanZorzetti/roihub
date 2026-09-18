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

// ── Hosts declarados e a separação do que é medido junto sem ser do site ──────────────────────
//
// 026 (information-design, 18/09) — a propriedade de analytics é chaveada por PROPRIEDADE, não
// por site. A mesma propriedade GA4 da atma (`properties/504053080`) conta, nos 12 meses medidos
// em 18/09: o site público (atma.roilabs.com.br 6.518 + usealigner.com 201), o PAINEL ADMIN
// (atmaadmin.roilabs.com.br 1.072), o `localhost` do desenvolvimento (63) e dois previews da
// Vercel (26). São 1.162 das 7.933 sessões — 14,6% do total e 52,1% do canal Referral — exibidas
// como "sessões do projeto" numa tela que pergunta quem ENCONTRA a Atma.
//
// A regra é dado DECLARADO, e é a mesma de `scripts/backfill-host-gsc.mjs`: só o que o card
// escreve conta como sendo o site — `url` e, quando houve migração, `dominioAnterior.url`. Host
// que ninguém declarou NUNCA é excluído em silêncio: sai nomeado na tela, com o peso, porque um
// total que encolhe sem explicação lê como queda de tráfego.

/**
 * Os hosts que o card declara como sendo o site deste projeto, sem `www.` e sem repetição.
 * Vazio quando o card não declara URL utilizável — e aí quem chama não filtra nada, porque
 * filtrar por lista vazia esconderia o site inteiro.
 * @param {{url?:string, dominioAnterior?:{url?:string}}|null|undefined} projeto
 * @returns {string[]}
 */
export function hostsDeclarados(projeto) {
  const hosts = [hostOf(projeto?.url ?? ""), hostOf(projeto?.dominioAnterior?.url ?? "")];
  return [...new Set(hosts.filter(Boolean))];
}

/**
 * Separa linhas `{grupo, host, sessoes}` entre os hosts declarados e o resto, somando por grupo.
 *
 * `fora` é o produto principal desta função, não um resto: é ele que a tela nomeia. Devolver só
 * o filtrado faria a exclusão desaparecer, que é exatamente o defeito — o número encolhe e nada
 * na tela diz por quê.
 *
 * `www.` é normalizado dos DOIS lados: o GA4 grava `hostName` como o navegador mandou, e
 * `www.exemplo.com` e `exemplo.com` são o mesmo site em toda parte deste hub.
 *
 * @param {{grupo:string, host:string, sessoes:number}[]} linhas
 * @param {string[]} hosts declarados; lista vazia ⇒ nada é separado (tudo vira `linhas`)
 * @returns {{linhas:{grupo:string,sessoes:number}[], fora:{host:string,sessoes:number}[]}}
 */
export function separarPorHost(linhas, hosts) {
  const declarados = new Set((hosts ?? []).map((h) => String(h).replace(/^www\./, "")));
  const porGrupo = new Map();
  const porHost = new Map();
  for (const l of linhas ?? []) {
    const host = String(l.host ?? "").replace(/^www\./, "");
    // G5 — sem `|| 0`: um valor que não chega como número é quebra de contrato da borda, e
    // zerá-lo aqui subtrairia sessões em silêncio. A borda (`lib/ga4.ts`) já faz `Number()`, o
    // mesmo que o caminho sem host sempre fez.
    const sessoes = Number(l.sessoes);
    if (declarados.size === 0 || declarados.has(host)) {
      porGrupo.set(l.grupo, (porGrupo.get(l.grupo) ?? 0) + sessoes);
    } else {
      porHost.set(host, (porHost.get(host) ?? 0) + sessoes);
    }
  }
  return {
    linhas: [...porGrupo].map(([grupo, sessoes]) => ({ grupo, sessoes })),
    fora: [...porHost].map(([host, sessoes]) => ({ host, sessoes })).sort((a, b) => b.sessoes - a.sessoes),
  };
}
