import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProjects, normalizeSite, reposSemSite } from "../lib/projects.mjs";

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
    ]
  );
  assert.deepEqual(out.map((r) => r.name), ["qprime"]);
});
