import test from "node:test";
import assert from "node:assert/strict";
import {
  aplicaSe,
  detectarStack,
  julgarCert,
  julgarGptbot,
  julgarHeaders,
  julgarRobots,
  julgarSameAs,
  julgarRotaPainel,
  julgarSitemap,
  primeiraPaginaInterna,
  temPainel,
  urlDoSitemap,
} from "../lib/conformidade.mjs";

test("aplicaSe casa por interseção e * casa com tudo", () => {
  const ctx = { stack: ["next"], infra: ["vercel"], superficie: ["site"] };
  assert.equal(aplicaSe({ stack: ["*"], infra: ["*"], superficie: ["site"] }, ctx), true);
  assert.equal(aplicaSe({ stack: ["next"], infra: ["vercel"], superficie: ["site", "app"] }, ctx), true);
  assert.equal(aplicaSe({ stack: ["astro"], infra: ["*"], superficie: ["site"] }, ctx), false);
  assert.equal(aplicaSe({ stack: ["*"], infra: ["*"], superficie: ["app"] }, ctx), false);
});

test("detectarStack lê o servidor, não o repo", () => {
  assert.deepEqual(detectarStack({ "x-powered-by": "Next.js" }, ""), ["next"]);
  assert.deepEqual(detectarStack({}, '<link href="/_next/static/x.css">'), ["next"]);
  assert.deepEqual(detectarStack({}, '<meta name="generator" content="Astro v5">'), ["astro"]);
  assert.deepEqual(detectarStack({}, "<html></html>"), ["outro"]);
});

// O modo de falha do VER-02: catch-all devolve index.html com 200 e o status mente.
test("julgarSitemap recusa HTML servido com 200", () => {
  assert.equal(julgarSitemap('<?xml version="1.0"?><urlset/>').ok, true);
  assert.equal(julgarSitemap("<!doctype html><html>").ok, false);
  assert.equal(julgarSitemap("").ok, false);
});

// O defeito que este teste existe para segurar: o check antigo era `/GPTBot/i.test(corpo)`, e o
// `orion` passava servindo `User-Agent: GPTBot` seguido de `Disallow: /` — site inteiro fora do
// ChatGPT, lido como conformidade. Grep mede a palavra, não a permissão.
test("julgarGptbot separa ausente, barrado e permitido", () => {
  const barrado = "User-Agent: *\nAllow: /\n\nUser-Agent: GPTBot\nDisallow: /\n\nSitemap: https://x/s.xml";
  assert.equal(julgarGptbot(barrado), "barrado");

  // Grupo com vários User-agent seguidos é UM grupo: as regras valem para todos.
  const junto = "User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nUser-agent: CCBot\nAllow: /\nDisallow: /admin/\n";
  assert.equal(julgarGptbot(junto), "permitido");

  assert.equal(julgarGptbot("User-agent: *\nAllow: /\n"), "ausente");
  assert.equal(julgarGptbot(""), "ausente");

  // Política PARCIAL não é bloqueio: o reviewshield libera /blog e /llms.txt e barra o resto de
  // propósito. Check que reprovasse isso estaria opinando sobre escopo, não medindo a norma.
  assert.equal(julgarGptbot("User-Agent: GPTBot\nAllow: /blog\nAllow: /llms.txt\nDisallow: /\n"), "permitido");

  // Comentário não pode virar regra, e `Disallow:` vazio é o "libera tudo" do padrão.
  assert.equal(julgarGptbot("User-agent: GPTBot # da OpenAI\nDisallow:\n"), "permitido");
});

// A exceção declarada no próprio protocolo: robots antigo passa em "começa com User-agent".
test("julgarRobots exige Sitemap: apontando para o host atual", () => {
  assert.equal(julgarRobots("User-agent: *\nSitemap: https://novo.com/sitemap.xml", "novo.com").ok, true);
  assert.equal(julgarRobots("User-agent: *\nSitemap: https://antigo.com/sitemap.xml", "novo.com").ok, false);
  assert.equal(julgarRobots("User-agent: *\nAllow: /", "novo.com").ok, false);
});

// Adivinhar /sitemap.xml reprovou o tapepro, que serve sitemap-index.xml e anuncia certo.
test("urlDoSitemap segue o ponteiro do robots antes de adivinhar", () => {
  const robots = "User-agent: *\nSitemap: https://x.com/sitemap-index.xml";
  assert.equal(urlDoSitemap(robots, "https://x.com"), "https://x.com/sitemap-index.xml");
  assert.equal(urlDoSitemap("User-agent: *", "https://x.com"), "https://x.com/sitemap.xml");
  assert.equal(urlDoSitemap(undefined, "https://x.com"), "https://x.com/sitemap.xml");
});

test("julgarSameAs pega o perfil que se diz ROI Labs sem ser", () => {
  const bom = '{"sameAs":["https://linkedin.com/company/roi-labs-curadoria/","https://github.com/JeanZorzetti"]}';
  const ruim = '{"sameAs":["https://linkedin.com/company/roilabs","https://twitter.com/roilabs"]}';
  assert.equal(julgarSameAs(bom).ok, true);
  assert.equal(julgarSameAs(ruim).ok, false);
  assert.equal(julgarSameAs("<html>sem json-ld</html>").ok, null);
  // Marca própria do projeto não está sob esta norma — foi o falso positivo do atma.
  assert.equal(julgarSameAs('{"sameAs":["https://www.instagram.com/atma.aligner/"]}').ok, true);
  // `roi-labs-curadoria` contém `roi-labs`: comparar por substring reprovaria o perfil certo.
  assert.equal(julgarSameAs('{"sameAs":["https://www.linkedin.com/company/roi-labs-curadoria/"]}').ok, true);
});

test("julgarHeaders acusa os três headers do next.config faltando", () => {
  assert.equal(julgarHeaders({ "x-frame-options": "DENY", "x-content-type-options": "nosniff", "referrer-policy": "origin" }).ok, true);
  assert.equal(julgarHeaders({ "x-frame-options": "DENY" }).ok, false);
  assert.equal(julgarHeaders({}).detalhe, "nenhum dos três headers do next.config");
});

// O caso real do atmaadmin: Traefik servindo cert auto-assinado com o site respondendo 200.
test("julgarCert reprova o que o navegador reprovaria", () => {
  const daqui = Date.parse("2026-07-31");
  const bom = { authorized: true, validTo: "Oct 30 00:00:00 2026 GMT" };
  assert.equal(julgarCert(bom, daqui).ok, true);
  assert.equal(julgarCert({ authorized: false, authorizationError: "SELF_SIGNED_CERT_IN_CHAIN", issuer: { O: "Easypanel" } }, daqui).ok, false);
  assert.equal(julgarCert({ authorized: true, validTo: "Jul 01 00:00:00 2026 GMT" }, daqui).ok, false);
  assert.equal(julgarCert({ erro: "ENOTFOUND" }, daqui).ok, false);
});

test("primeiraPaginaInterna pula a home e devolve sem a barra", () => {
  const sitemap = "<urlset><url><loc>https://x.com/</loc></url><url><loc>https://x.com/guia/</loc></url></urlset>";
  assert.equal(primeiraPaginaInterna(sitemap, "https://x.com"), "https://x.com/guia");
  assert.equal(primeiraPaginaInterna("<!doctype html>", "https://x.com"), null);
  // Sem barra final não há redirect a testar: o modo de falha do SEO-01 nem existe.
  assert.equal(primeiraPaginaInterna("<loc>https://x.com/guia</loc>", "https://x.com"), null);
});

// O falso positivo que matou a 1a versão: o context protege /dashboard com Auth0 e não tem
// rota do next-auth. A norma conta rota que devolve 200 SEM sessão, não biblioteca instalada.
test("julgarRotaPainel só acusa 200 sem sessão", () => {
  assert.equal(julgarRotaPainel(200), "aberta");
  assert.equal(julgarRotaPainel(307), "fechada");
  assert.equal(julgarRotaPainel(404), "fechada");
  assert.equal(julgarRotaPainel(401), "fechada");
});

test("temPainel separa landing de app com porta de entrada", () => {
  assert.equal(temPainel('<a href="/login">Entrar</a>'), true);
  assert.equal(temPainel('<a href="https://app.x.com/dashboard">Painel</a>'), true);
  assert.equal(temPainel('<a href="/precos">Preços</a>'), false);
});
