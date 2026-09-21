import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProjects, normalizeSite, reposSemSite, hostsDeclarados, separarPorHost, deBusca } from "../lib/projects.mjs";

const repo = (name, extra = {}) => ({
  name,
  homepage: null,
  url: `https://github.com/JeanZorzetti/${name}`,
  pushedAt: "2026-07-28T00:00:00Z",
  archived: false,
  description: null,
  ...extra,
});

const cur = (slug, url, extra = {}) => ({
  slug,
  nome: slug.toUpperCase(),
  url,
  receita: 9,
  blockersLista: [],
  acao: "ação curada",
  ...extra,
});

test("normalizeSite aceita host cru e recusa o que não dá pra medir", () => {
  assert.equal(normalizeSite("siriuscrm.com.br"), "https://siriuscrm.com.br/");
  assert.equal(normalizeSite(" https://a.com/blog "), "https://a.com/blog");
  assert.equal(normalizeSite(""), null);
  assert.equal(normalizeSite(null), null);
  assert.equal(normalizeSite("localhost:3000"), null);
  assert.equal(normalizeSite("ftp://a.com"), null);
});

test("curadoria vence a homepage do GitHub e ganha o repo anexado", () => {
  const [p] = mergeProjects(
    [cur("sirius", "https://siriuscrm.com.br/", { repo: "sirius" })],
    [repo("sirius", { homepage: "https://sirius-ebon.vercel.app" })]
  );
  assert.equal(p.url, "https://siriuscrm.com.br/"); // NÃO a vercel.app
  assert.equal(p.repo, "sirius");
  assert.equal(p.curated, true);
  assert.equal(p.receita, 9);
  assert.equal(p.pushedAt, "2026-07-28T00:00:00Z");
});

test("dois sites no mesmo repo continuam sendo dois projetos", () => {
  const out = mergeProjects(
    [
      cur("goiania", "https://goiania.roilabs.com.br/", { repo: "roilabs" }),
      cur("roilabs", "https://roilabs.com.br/", { repo: "roilabs" }),
    ],
    [repo("roilabs", { homepage: "https://roilabs.com.br" })]
  );
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((p) => p.repo), ["roilabs", "roilabs"]);
});

test("repo com homepage e sem curadoria entra zerado e com ação de curar", () => {
  const out = mergeProjects([], [repo("qprime", { homepage: "qprime.com.br", description: "  Q Prime  " })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].slug, "qprime");
  assert.equal(out[0].nome, "Q Prime");
  assert.equal(out[0].url, "https://qprime.com.br/");
  assert.equal(out[0].curated, false);
  assert.equal(out[0].receita, 0);
  assert.equal(out[0].seoSeed, 0);
  assert.match(out[0].acao, /Curar qprime/);
  assert.deepEqual(out[0].blockersLista, []); // default não pode ser compartilhado por referência
});

test("repo sem homepage, arquivado, ou repetindo host curado não vira projeto", () => {
  const out = mergeProjects(
    [cur("sirius", "https://siriuscrm.com.br/", { repo: "sirius" })],
    [
      repo("sirius", { homepage: "https://sirius-ebon.vercel.app" }),
      repo("sem-site"),
      repo("velho", { homepage: "https://velho.com", archived: true }),
      repo("clone", { homepage: "https://www.siriuscrm.com.br" }),
    ]
  );
  assert.deepEqual(out.map((p) => p.slug), ["sirius"]);
});

test("UNCURATED não vaza entre projetos", () => {
  const out = mergeProjects([], [repo("a", { homepage: "a.com" }), repo("b", { homepage: "b.com" })]);
  out[0].blockersLista.push("x");
  assert.deepEqual(out[1].blockersLista, []);
});

test("reposSemSite lista só repo vivo, não curado e sem homepage", () => {
  const out = reposSemSite(
    [cur("fabrica", "https://estetia.estetiacrm.com.br/", { repo: "estetia-demo" })],
    [
      repo("estetia-demo"),
      repo("qprime"),
      repo("morto", { archived: true }),
      repo("tem-site", { homepage: "x.com" }),
      repo("roihub"),
      repo("repo-de-teste"),
    ]
  );
  assert.deepEqual(out.map((r) => r.name), ["qprime"]);
});

// ── 026: hosts declarados e a separação do que é medido junto sem ser do site ────────────────

test("hostsDeclarados junta url e dominioAnterior, sem www e sem repetir", () => {
  assert.deepEqual(
    hostsDeclarados({ url: "https://usealigner.com/", dominioAnterior: { url: "https://www.atma.roilabs.com.br/" } }),
    ["usealigner.com", "atma.roilabs.com.br"],
  );
  assert.deepEqual(hostsDeclarados({ url: "https://so-um.com/" }), ["so-um.com"]);
  // Mesmo host nos dois campos não vira dois.
  assert.deepEqual(hostsDeclarados({ url: "https://a.com/", dominioAnterior: { url: "https://www.a.com/x" } }), ["a.com"]);
  // Card sem URL utilizável: lista vazia, e quem chama não filtra nada.
  assert.deepEqual(hostsDeclarados({ url: "nao-e-url" }), []);
  assert.deepEqual(hostsDeclarados(null), []);
});

test("separarPorHost soma por grupo e devolve o que ficou de FORA nomeado", () => {
  // O caso real de 18/09: dois hosts do site, o painel admin e o localhost na mesma propriedade.
  const linhas = [
    { grupo: "Organic Search", host: "atma.roilabs.com.br", sessoes: 4940 },
    { grupo: "Organic Search", host: "usealigner.com", sessoes: 48 },
    { grupo: "Organic Search", host: "atmaadmin.roilabs.com.br", sessoes: 430 },
    { grupo: "Direct", host: "localhost", sessoes: 63 },
    { grupo: "Direct", host: "usealigner.com", sessoes: 140 },
  ];
  const out = separarPorHost(linhas, ["usealigner.com", "atma.roilabs.com.br"]);
  assert.deepEqual(out.linhas, [{ grupo: "Organic Search", sessoes: 4988 }, { grupo: "Direct", sessoes: 140 }]);
  // `fora` ordenado por peso: é a lista que a tela publica.
  assert.deepEqual(out.fora, [{ host: "atmaadmin.roilabs.com.br", sessoes: 430 }, { host: "localhost", sessoes: 63 }]);
});

test("separarPorHost normaliza www dos DOIS lados", () => {
  const out = separarPorHost([{ grupo: "Direct", host: "www.a.com", sessoes: 10 }], ["a.com"]);
  assert.deepEqual(out.linhas, [{ grupo: "Direct", sessoes: 10 }]);
  assert.deepEqual(out.fora, []);
});

// ── 052/T005 — deBusca(projetos, slugs): a mesma lista decide quem tem corrida e quem tem mapa ──

test("deBusca devolve na ORDEM de slugs, não na da lista", () => {
  const sirius = cur("sirius", "https://siriuscrm.com.br/", { curated: true });
  const atma = cur("atma", "https://usealigner.com/", { curated: true });
  assert.deepEqual(deBusca([sirius, atma], ["atma", "sirius"]).map((p) => p.slug), ["atma", "sirius"]);
});

test("deBusca: repo sem card (curated:false) fica fora — FR-003", () => {
  const semCard = { slug: "sirius", nome: "SIRIUS", url: "https://sirius-ebon.vercel.app/", curated: false };
  assert.deepEqual(deBusca([semCard], ["sirius"]), []);
});

test("deBusca: card curado sem `url` fica fora", () => {
  const semUrl = cur("sirius", "https://siriuscrm.com.br/", { curated: true, url: undefined });
  assert.deepEqual(deBusca([semUrl], ["sirius"]), []);
});

test("deBusca: slug fora da lista fica fora", () => {
  const atma = cur("atma", "https://usealigner.com/", { curated: true });
  assert.deepEqual(deBusca([atma], ["sirius"]), []);
});

test("separarPorHost com lista vazia não esconde o site inteiro", () => {
  // Card sem URL: filtrar por lista vazia deixaria a tela em branco fingindo zero sessões.
  const out = separarPorHost([{ grupo: "Direct", host: "qualquer.com", sessoes: 7 }], []);
  assert.deepEqual(out.linhas, [{ grupo: "Direct", sessoes: 7 }]);
  assert.deepEqual(out.fora, []);
});
