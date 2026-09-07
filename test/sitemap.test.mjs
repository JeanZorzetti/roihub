import test from "node:test";
import assert from "node:assert/strict";
import { locs, ehIndice, lerSitemap } from "../lib/sitemap.mjs";

const xml = (corpo) => `<?xml version="1.0" encoding="UTF-8"?>${corpo}`;
const paginas = (...urls) =>
  xml(`<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}</urlset>`);
const indice = (...filhos) =>
  xml(`<sitemapindex>${filhos.map((f) => `<sitemap><loc>${f}</loc></sitemap>`).join("")}</sitemapindex>`);

/** `buscar` injetada: um mapa de url → resposta. Chave ausente é falha de rede. */
const stub = (mapa) => async (u) => (u in mapa ? { corpo: mapa[u] } : { erro: "ENOTFOUND" });

test("locs pega todas as <loc> na ordem do arquivo, sem deduplicar", () => {
  assert.deepEqual(locs(paginas("https://a/1", "https://a/2", "https://a/1")), [
    "https://a/1",
    "https://a/2",
    "https://a/1",
  ]);
  assert.deepEqual(locs("<urlset></urlset>"), []);
});

test("ehIndice separa sitemapindex de urlset", () => {
  assert.equal(ehIndice(indice("https://a/s1.xml")), true);
  assert.equal(ehIndice(paginas("https://a/1")), false);
});

test("sitemap simples devolve as URLs e nenhum filho", async () => {
  const r = await lerSitemap("https://a/sitemap.xml", stub({ "https://a/sitemap.xml": paginas("https://a/1", "https://a/2") }));
  assert.deepEqual(r.urls, ["https://a/1", "https://a/2"]);
  assert.equal(r.motivo, null);
  assert.equal(r.filhos, 0);
  assert.equal(r.profundidadeExcedida, false);
});

// FR-002 — o achado que motivou o módulo: `VER-04` descia num filho só, e um índice de 3 arquivos
// entregava 1/3 do inventário. Denominador pequeno demais faz a taxa parecer melhor do que é.
test("sitemapindex soma TODOS os filhos, não o primeiro", async () => {
  const r = await lerSitemap(
    "https://a/sitemap-index.xml",
    stub({
      "https://a/sitemap-index.xml": indice("https://a/s1.xml", "https://a/s2.xml", "https://a/s3.xml"),
      "https://a/s1.xml": paginas("https://a/1", "https://a/2"),
      "https://a/s2.xml": paginas("https://a/3"),
      "https://a/s3.xml": paginas("https://a/4", "https://a/5"),
    }),
  );
  assert.equal(r.urls.length, 5, "somou só o primeiro filho — o site está subcontado");
  assert.deepEqual(r.urls, ["https://a/1", "https://a/2", "https://a/3", "https://a/4", "https://a/5"]);
  assert.equal(r.filhos, 3);
  assert.equal(r.filhosLidos, 3);
});

test("<loc> repetida entre filhos conta uma vez, e a PRIMEIRA ocorrência manda na ordem", async () => {
  const r = await lerSitemap(
    "https://a/i.xml",
    stub({
      "https://a/i.xml": indice("https://a/s1.xml", "https://a/s2.xml"),
      "https://a/s1.xml": paginas("https://a/1", "https://a/2"),
      "https://a/s2.xml": paginas("https://a/2", "https://a/3"),
    }),
  );
  // A ordem importa porque a amostra da corrida é o PREFIXO desta lista (SC-004): reordenar aqui
  // moveria a amostra entre corridas e a fração pareceria movimento do site.
  assert.deepEqual(r.urls, ["https://a/1", "https://a/2", "https://a/3"]);
});

test("filho inalcançável encolhe o inventário mas NÃO zera o pai — e aparece em filhosLidos", async () => {
  const r = await lerSitemap(
    "https://a/i.xml",
    stub({
      "https://a/i.xml": indice("https://a/s1.xml", "https://a/morto.xml"),
      "https://a/s1.xml": paginas("https://a/1"),
    }),
  );
  assert.deepEqual(r.urls, ["https://a/1"]);
  assert.equal(r.filhos, 2);
  assert.equal(r.filhosLidos, 1, "filho perdido tem que ser visível: buraco silencioso vira inventário falso");
  assert.equal(r.motivo, null);
});

// FR-003 / D5 — os três estados que NÃO podem virar o mesmo "0% indexado".
test("catch-all servindo HTML é sem_sitemap, não sitemap vazio", async () => {
  const r = await lerSitemap("https://a/sitemap.xml", stub({ "https://a/sitemap.xml": "<!doctype html><html>404</html>" }));
  assert.equal(r.motivo, "sem_sitemap");
  assert.deepEqual(r.urls, []);
});

test("XML válido com zero <loc> é sitemap_vazio", async () => {
  const r = await lerSitemap("https://a/sitemap.xml", stub({ "https://a/sitemap.xml": paginas() }));
  assert.equal(r.motivo, "sitemap_vazio");
});

test("falha de rede é erro, nunca motivo — não perguntei não é não existe", async () => {
  const r = await lerSitemap("https://a/sitemap.xml", stub({}));
  assert.equal(r.erro, "ENOTFOUND");
  assert.equal(r.motivo, null, "rede caída gravada como sem_sitemap inverte o sinal do inventário");
});

test("índice dentro de índice devolve o que achou e marca profundidadeExcedida", async () => {
  const r = await lerSitemap(
    "https://a/i.xml",
    stub({
      "https://a/i.xml": indice("https://a/s1.xml", "https://a/i2.xml"),
      "https://a/s1.xml": paginas("https://a/1"),
      "https://a/i2.xml": indice("https://a/s9.xml"),
      "https://a/s9.xml": paginas("https://a/9"),
    }),
  );
  assert.equal(r.profundidadeExcedida, true);
  // As <loc> de um índice são SITEMAPS, não páginas: empilhá-las inflaria o denominador com arquivos.
  assert.deepEqual(r.urls, ["https://a/1"]);
});
