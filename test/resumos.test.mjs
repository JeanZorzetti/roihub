import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Trava o contrato entre data/projects.json e data/resumos.json: sem isto, um rename de slug
// esvazia a aba /resumo em silêncio (a página cai no estado vazio e ninguém percebe).

const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url), "utf8"));
const projects = read("projects.json");
const resumos = read("resumos.json");

const ESTADOS = ["no-ar", "no-ar-inutilizavel", "prototipo", "parado", "morto"];
const CAMPOS = ["oQueE", "paraQuem", "estado", "dinheiro", "oQueTrava", "proximaDecisao"];

test("todo projeto curado tem resumo, e todo resumo tem projeto", () => {
  const slugs = projects.map((p) => p.slug);
  assert.deepEqual(
    slugs.filter((s) => !(s in resumos)),
    [],
    "projeto sem entrada em resumos.json"
  );
  assert.deepEqual(
    Object.keys(resumos).filter((s) => !slugs.includes(s)),
    [],
    "resumo órfão — slug não existe em projects.json"
  );
});

test("os seis campos existem e o estado está no enum", () => {
  for (const [slug, r] of Object.entries(resumos)) {
    assert.deepEqual(Object.keys(r).sort(), [...CAMPOS].sort(), `${slug}: campos fora do contrato`);
    assert.ok(ESTADOS.includes(r.estado), `${slug}: estado "${r.estado}" fora do enum`);
    // proximaDecisao é o único que aceita null — o resto é texto obrigatório.
    for (const c of CAMPOS.filter((c) => c !== "proximaDecisao")) {
      assert.ok(typeof r[c] === "string" && r[c].trim().length > 0, `${slug}: ${c} vazio`);
    }
    assert.ok(r.proximaDecisao === null || typeof r.proximaDecisao === "string", `${slug}: proximaDecisao inválida`);
  }
});
