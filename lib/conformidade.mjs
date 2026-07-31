// Executa a norma em vez de consultá-la. Os 97 protocolos de `data/protocolos/` têm um campo
// `verificacao.como` que é comando de shell — nunca rodado uma vez. Aqui os 10 que decidem se
// uma entrega pode fechar (`falha_significa: bloqueia`) viram função, e o cruzamento
// `protocolo.aplica_se_a × projeto` deixa de ser matriz teórica.
//
// Só entram checks que rodam contra a URL de produção. Os que exigem o repo do projeto na mão
// (grep em src/, next build) ficaram de fora de propósito: só o roihub está clonado aqui, então
// eles rodariam contra 1 de 35 e não produziriam informação nova sobre o mundo real.
//
// O contexto (stack, infra) é DETECTADO da resposta HTTP, não declarado: `projects.json` não tem
// esses campos, e um campo manual descreveria o que o projeto era quando alguém digitou. O
// header diz o que ele é agora.
import tls from "node:tls";

const UA = "roihub-conformidade/1 (+https://hub.roilabs.com.br)";
const TIMEOUT_MS = 15_000;

/**
 * O cruzamento do handoff: `*` casa com tudo, senão precisa de interseção nos três eixos.
 * @param {{stack:string[],infra:string[],superficie:string[]}} aplica
 * @param {{stack:string[],infra:string[],superficie:string[]}} ctx
 */
export function aplicaSe(aplica, ctx) {
  const casa = (lista, valores) => lista.includes("*") || lista.some((v) => valores.includes(v));
  return casa(aplica.stack, ctx.stack) && casa(aplica.infra, ctx.infra) && casa(aplica.superficie, ctx.superficie);
}

/** Stack pelo que o servidor entrega, não pelo que o repo promete. */
export function detectarStack(headers, html = "") {
  const stack = [];
  if (headers["x-powered-by"]?.includes("Next.js") || /\/_next\//.test(html)) stack.push("next");
  if (/name="generator" content="Astro/i.test(html)) stack.push("astro");
  if (/<script type="module" crossorigin src="\/assets\//.test(html)) stack.push("vite-spa");
  return stack.length ? stack : ["outro"];
}

/** Infra pelo header de borda: é ela que decide qual protocolo de deploy se aplica. */
export function detectarInfra(headers) {
  if (headers["x-vercel-id"] || headers["server"] === "Vercel") return ["vercel"];
  if (headers["x-powered-by"]?.includes("Express")) return ["easypanel", "vps", "docker"];
  return ["easypanel", "vps", "docker"];
}

// VER-02: em SPA e em qualquer app com catch-all, path desconhecido devolve index.html com 200.
export function julgarSitemap(corpo) {
  const cabeca = corpo.slice(0, 5);
  if (cabeca === "<?xml") return { ok: true };
  if (/^\s*<!doctype html/i.test(corpo)) return { ok: false, detalhe: "catch-all devolveu HTML (index.html com 200)" };
  if (!corpo.trim()) return { ok: false, detalhe: "corpo vazio" };
  return { ok: false, detalhe: `corpo começa com ${JSON.stringify(cabeca)}, não <?xml` };
}

// A exceção declarada no próprio VER-02: robots.txt pré-existente no repo passa em "começa com
// User-agent" e aponta Sitemap: para o host antigo.
export function julgarRobots(corpo, host) {
  const linha = corpo.split(/\r?\n/).find((l) => /^\s*sitemap:/i.test(l));
  if (!linha) return { ok: false, detalhe: "sem linha Sitemap:" };
  if (!linha.includes(host)) return { ok: false, detalhe: `Sitemap: aponta para outro host — ${linha.trim()}` };
  return { ok: true };
}

/**
 * Onde o sitemap realmente mora, segundo o robots. Adivinhar `/sitemap.xml` reprovou o tapepro,
 * que serve `sitemap-index.xml` (o padrão do @astrojs/sitemap) e anuncia isso corretamente no
 * robots — o check estava medindo a convenção do Next, não a norma.
 */
export function urlDoSitemap(robots, base) {
  const linha = (robots ?? "").split(/\r?\n/).find((l) => /^\s*sitemap:/i.test(l));
  const url = linha?.replace(/^\s*sitemap:\s*/i, "").trim();
  return url && /^https?:\/\//.test(url) ? url : `${base}/sitemap.xml`;
}

// GEO-02: os perfis que existem e os que já queimaram. `roilabs` (deletada), `roi-labs` (outra
// empresa) e `sirius-crm` (produto homônimo) apontam para páginas de terceiros.
//
// A norma vale para a IDENTIDADE ROI LABS, não para toda URL de rede social: rodar a primeira
// versão contra o atma acusou facebook/instagram/linkedin do Atma Aligner, que são a marca do
// projeto e não estão sob esta norma. O que é verificável por máquina é mais estreito — perfil
// da lista negra, ou perfil que se apresenta como ROI Labs sem ser um dos quatro canônicos.
const SAMEAS_CANONICOS = [
  "linkedin.com/company/roi-labs-curadoria",
  "instagram.com/roilabs.curadoria",
  "linkedin.com/in/jean-zorzetti-772742239",
  "github.com/jeanzorzetti",
];
const SAMEAS_PROIBIDOS = [
  "linkedin.com/company/roilabs",
  "linkedin.com/company/roi-labs",
  "linkedin.com/company/sirius-crm",
  "twitter.com/roilabs",
  "x.com/roilabs",
  "github.com/roilabs",
];
// Comparação por perfil inteiro, nunca por substring: `roi-labs-curadoria` (canônico) CONTÉM
// `roi-labs` (proibido), então `includes` reprovaria justamente o perfil certo.
const perfil = (u) => u.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

export function julgarSameAs(html) {
  const bloco = html.match(/"sameAs"\s*:\s*\[[^\]]*\]/);
  if (!bloco) return { ok: null, detalhe: "sem sameAs no HTML" };
  const urls = [...bloco[0].matchAll(/https?:\/\/[^"\s,\]]+/g)].map((m) => m[0]);
  const errados = urls.filter((u) => {
    const p = perfil(u);
    if (SAMEAS_CANONICOS.includes(p)) return false;
    return SAMEAS_PROIBIDOS.includes(p) || /roi[-.]?labs/.test(p);
  });
  return errados.length ? { ok: false, detalhe: `perfil não canônico da ROI Labs: ${errados.join(" ")}` } : { ok: true };
}

// DEP-08: os três headers saem do next.config. Vazio = sem headers OU config duplicado (o .js
// vence e o .mjs é ignorado sem warning) — o check não separa os dois, `ls next.config.*` separa.
const HEADERS_CONFIG = ["x-frame-options", "x-content-type-options", "referrer-policy"];

export function julgarHeaders(headers) {
  const faltando = HEADERS_CONFIG.filter((h) => !headers[h]);
  if (faltando.length === HEADERS_CONFIG.length) return { ok: false, detalhe: "nenhum dos três headers do next.config" };
  return faltando.length ? { ok: false, detalhe: `faltam ${faltando.join(", ")}` } : { ok: true };
}

// VER-01. `rejectUnauthorized: false` aqui é o OPOSTO do `-k` que o protocolo proíbe: o flag
// proibido ESCONDE a recusa, este lê o motivo dela. Sem ele um cert auto-assinado derruba a
// conexão antes do callback e some justamente o campo (issuer) que diz que ele é auto-assinado.
export function pegarCert(host) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS },
      () => {
        const cert = socket.getPeerCertificate();
        resolve({ authorized: socket.authorized, authorizationError: socket.authorizationError?.message ?? socket.authorizationError, issuer: cert.issuer, validTo: cert.valid_to });
        socket.destroy();
      }
    );
    socket.on("error", (e) => resolve({ erro: e.code || e.message }));
    socket.on("timeout", () => { resolve({ erro: "timeout" }); socket.destroy(); });
  });
}

export function julgarCert(cert, agora = Date.now()) {
  if (cert.erro) return { ok: false, detalhe: `handshake falhou: ${cert.erro}` };
  if (!cert.authorized) return { ok: false, detalhe: `navegador recusaria: ${cert.authorizationError} (issuer ${cert.issuer?.O ?? "?"})` };
  const dias = Math.floor((Date.parse(cert.validTo) - agora) / 86_400_000);
  if (dias < 0) return { ok: false, detalhe: `expirado há ${-dias} dias` };
  if (dias < 10) return { ok: false, detalhe: `expira em ${dias} dias` };
  return { ok: true, detalhe: `${dias} dias` };
}

// SEC-01: painel publicado sem login. A primeira versão deste check perguntava
// /api/auth/session e tratou 404 como "não existe login" — deu 3 falsos positivos de uma vez, e
// o mais claro foi o context.nimblabs.com, que protege /dashboard com Auth0 (307 para
// /api/auth/login) e não tem rota do next-auth nenhuma. A norma não fala de biblioteca: ela
// manda "iterar TODAS as rotas sem sessão contando quantas devolvem 200". É isso que se mede —
// 200 numa rota de painel sem cookie é a violação, qualquer que seja o provedor.
export const ROTAS_PAINEL = ["/dashboard", "/admin", "/painel", "/app"];

export function temPainel(html) {
  return /href="[^"]*\/(login|entrar|sign-?in|dashboard|painel|admin)\b/i.test(html);
}

// 404 e 3xx são as duas respostas certas: rota inexistente ou porta fechada. 200 é a violação.
export function julgarRotaPainel(status) {
  return status === 200 ? "aberta" : "fechada";
}

/**
 * Primeira `<loc>` que não é a home e termina com barra, devolvida SEM a barra — é essa forma
 * que o SEO-01 testa. Sitemap que não é XML devolve null e o check vira n/a.
 */
export function primeiraPaginaInterna(sitemap, base) {
  for (const m of sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = m[1];
    if (!url.startsWith(base) || !url.endsWith("/")) continue;
    const semBarra = url.replace(/\/+$/, "");
    if (semBarra !== base) return semBarra;
  }
  return null;
}

export async function buscar(url, { manual = false } = {}) {
  try {
    const r = await fetch(url, {
      redirect: manual ? "manual" : "follow",
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const headers = Object.fromEntries([...r.headers].map(([k, v]) => [k.toLowerCase(), v]));
    return { status: r.status, headers, corpo: await r.text() };
  } catch (e) {
    // `error.cause.code` antes de culpar a rede: o undici desiste em 300 s por conta própria.
    return { erro: e.cause?.code || e.code || e.message };
  }
}

// Os 10. `alvo` é o que o protocolo chama de `verificacao.como`, já parametrizado pelo projeto.
export const CHECKS = [
  {
    id: "VER-01",
    resumo: "cert que o navegador aceita",
    aplica: { stack: ["*"], infra: ["easypanel", "vercel", "vps"], superficie: ["site", "api", "app"] },
    async rodar(ctx) {
      return julgarCert(await pegarCert(ctx.host));
    },
  },
  {
    id: "DEP-03",
    resumo: "home viva (200 com HTML)",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site"] },
    async rodar(ctx) {
      if (ctx.home.erro) return { ok: false, detalhe: ctx.home.erro };
      if (ctx.home.status >= 400) return { ok: false, detalhe: `HTTP ${ctx.home.status}` };
      if (ctx.home.corpo.length < 500) return { ok: false, detalhe: `corpo de ${ctx.home.corpo.length} bytes` };
      return { ok: true };
    },
  },
  {
    id: "VER-02",
    resumo: "sitemap e robots validados pelo CORPO",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site"] },
    async rodar(ctx) {
      if (ctx.robots.erro) return { ok: false, detalhe: `robots.txt: ${ctx.robots.erro}` };
      const r = julgarRobots(ctx.robots.corpo, ctx.host);
      if (!r.ok) return { ok: false, detalhe: `robots.txt: ${r.detalhe}` };
      if (ctx.sitemap.erro) return { ok: false, detalhe: `${ctx.sitemapUrl}: ${ctx.sitemap.erro}` };
      const s = julgarSitemap(ctx.sitemap.corpo);
      return s.ok ? { ok: true } : { ok: false, detalhe: `${ctx.sitemapUrl}: ${s.detalhe}` };
    },
  },
  {
    id: "DEP-08",
    resumo: "headers do next.config chegam na borda",
    aplica: { stack: ["next"], infra: ["*"], superficie: ["site", "app"] },
    async rodar(ctx) {
      return ctx.home.erro ? { ok: false, detalhe: ctx.home.erro } : julgarHeaders(ctx.home.headers);
    },
  },
  {
    id: "SEO-01",
    resumo: "URL sem barra não cai em http://",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site"] },
    async rodar(ctx) {
      // A URL testada sai do sitemap do próprio projeto: o bug só aparece em página interna
      // servida em formato directory, e a raiz nunca redireciona. Foi assim que 46% do crawl do
      // goiania queimou em redirect sem ninguém ver.
      let corpo = ctx.sitemap.corpo ?? "";
      // sitemapindex lista sitemaps, não páginas: sem descer um nível o check vira n/a justo nos
      // projetos Astro, que são os únicos onde este bug existe.
      if (/<sitemapindex/i.test(corpo)) {
        const primeiro = corpo.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
        if (primeiro) corpo = (await buscar(primeiro)).corpo ?? "";
      }
      const alvo = primeiraPaginaInterna(corpo, ctx.base);
      if (!alvo) return { ok: null, detalhe: "sitemap sem página interna com barra final" };
      const r = await buscar(alvo, { manual: true });
      if (r.erro) return { ok: false, detalhe: r.erro };
      const loc = r.headers?.location ?? "";
      return loc.startsWith("http://") ? { ok: false, detalhe: `${alvo} → Location: ${loc}` } : { ok: true };
    },
  },
  {
    id: "GEO-01",
    resumo: "crawler de IA na whitelist + llms.txt",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site"] },
    async rodar(ctx) {
      const llms = await buscar(`${ctx.base}/llms.txt`);
      const faltas = [];
      if (!ctx.robots.erro && !/GPTBot/i.test(ctx.robots.corpo)) faltas.push("robots.txt sem GPTBot");
      // llms.txt em catch-all volta 200 com index.html: o corpo decide, igual ao VER-02.
      if (llms.erro || llms.status >= 400 || /<!doctype html|<html/i.test(llms.corpo.slice(0, 300))) faltas.push("sem llms.txt");
      return faltas.length ? { ok: false, detalhe: faltas.join(" · ") } : { ok: true };
    },
  },
  {
    id: "GEO-02",
    resumo: "sameAs só com perfil canônico",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site"] },
    async rodar(ctx) {
      return ctx.home.erro ? { ok: null, detalhe: ctx.home.erro } : julgarSameAs(ctx.home.corpo);
    },
  },
  {
    id: "SEC-01",
    resumo: "painel publicado tem sessão de verdade",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["app"] },
    async rodar(ctx) {
      if (ctx.home.erro || !temPainel(ctx.home.corpo)) return { ok: null, detalhe: "home não expõe painel" };
      const respostas = await Promise.all(
        ROTAS_PAINEL.map(async (rota) => ({ rota, ...(await buscar(`${ctx.base}${rota}`, { manual: true })) }))
      );
      const abertas = respostas.filter((r) => !r.erro && julgarRotaPainel(r.status) === "aberta");
      if (!abertas.length) return { ok: true, detalhe: "nenhuma rota de painel responde 200 sem sessão" };
      return { ok: false, detalhe: `200 sem sessão em ${abertas.map((r) => r.rota).join(", ")}` };
    },
  },
  {
    id: "DNS-05",
    resumo: "www do domínio próprio responde",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["dominio", "site"] },
    async rodar(ctx) {
      // Universal SSL da Cloudflare cobre UM label: www.sub.dominio já falha no handshake por
      // construção, então só apex (2 labels) entra no check.
      if (ctx.host.split(".").length > 2) return { ok: null, detalhe: "subdomínio, www não se aplica" };
      const r = await buscar(`https://www.${ctx.host}/`, { manual: true });
      if (r.erro) return { ok: false, detalhe: `www: ${r.erro}` };
      return r.status >= 500 ? { ok: false, detalhe: `www: HTTP ${r.status}` } : { ok: true, detalhe: `www: HTTP ${r.status}` };
    },
  },
  {
    id: "VER-04",
    resumo: "homepage do repo é a URL que o hub usa",
    aplica: { stack: ["*"], infra: ["*"], superficie: ["site", "app"] },
    async rodar(ctx) {
      if (!ctx.projeto.repo || !process.env.GITHUB_TOKEN) return { ok: null, detalhe: "sem repo ou sem GITHUB_TOKEN" };
      const r = await fetch(`https://api.github.com/repos/JeanZorzetti/${ctx.projeto.repo}`, {
        headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, "user-agent": UA },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch((e) => ({ ok: false, status: 0, _erro: e.message }));
      // Token fine-grained sem o repo no escopo devolve 404, não 403 — não é "repo apagado".
      if (!r.ok) return { ok: null, detalhe: `GitHub HTTP ${r.status}` };
      const { homepage } = await r.json();
      if (!homepage) return { ok: false, detalhe: "repo sem homepage (fica fora do hub)" };
      const norm = (u) => u.replace(/^https?:\/\//, "").replace(/\/+$/, "").toLowerCase();
      if (norm(homepage) === norm(ctx.projeto.url)) return { ok: true };
      // Monorepo serve N hosts e `homepage` é um campo só: o `roilabs` aponta para o apex e
      // também publica o goiania. A chave do hub é a URL, não o repo — divergência aqui só é
      // violação quando NENHUM projeto reclama aquela homepage.
      if (ctx.irmaos.some((p) => norm(p.url) === norm(homepage))) {
        return { ok: null, detalhe: `repo compartilhado (homepage=${homepage})` };
      }
      return { ok: false, detalhe: `homepage=${homepage} ≠ url=${ctx.projeto.url}` };
    },
  },
];

/** Contexto de um projeto: um fetch da home serve todos os checks que precisam do HTML. */
export async function contextoDe(projeto, irmaos = []) {
  const base = projeto.url.replace(/\/+$/, "");
  const host = new URL(projeto.url).hostname;
  // Um fetch de cada, compartilhado pelos checks: sitemap serve VER-02 e SEO-01, robots serve
  // VER-02 e GEO-01. O sitemap vem depois porque é o robots que diz onde ele está.
  const [home, robots] = await Promise.all([buscar(`${base}/`), buscar(`${base}/robots.txt`)]);
  const sitemapUrl = urlDoSitemap(robots.corpo, base);
  const sitemap = await buscar(sitemapUrl);
  const html = home.corpo ?? "";
  return {
    projeto,
    irmaos,
    base,
    host,
    home,
    sitemap,
    sitemapUrl,
    robots,
    stack: home.erro ? ["outro"] : detectarStack(home.headers, html),
    infra: home.erro ? ["*"] : detectarInfra(home.headers),
    // Todo projeto do hub serve site; painel só quando a home mostra porta de entrada.
    superficie: temPainel(html) ? ["site", "app", "dominio"] : ["site", "dominio"],
  };
}

export async function rodarProjeto(projeto, irmaos = []) {
  const ctx = await contextoDe(projeto, irmaos);
  const linhas = [];
  for (const check of CHECKS) {
    if (!aplicaSe(check.aplica, ctx)) {
      linhas.push({ id: check.id, ok: null, detalhe: "não se aplica" });
      continue;
    }
    try {
      linhas.push({ id: check.id, ...(await check.rodar(ctx)) });
    } catch (e) {
      linhas.push({ id: check.id, ok: null, detalhe: `check quebrou: ${e.message}` });
    }
  }
  return { slug: projeto.slug, host: ctx.host, stack: ctx.stack, linhas };
}
