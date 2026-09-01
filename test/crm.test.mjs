import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseLead, etapasDe } from "../lib/crm.mjs";

const pipelines = JSON.parse(readFileSync(new URL("../data/pipelines.json", import.meta.url), "utf8"));

const base = {
  external_id: "orion-contato-abc123",
  pipeline: "orion",
  nome: "Fulano",
  origem: "orion:contato",
};

test("pipelines.json: todo slug tem etapas e nome", () => {
  assert.ok(pipelines.length > 0);
  for (const p of pipelines) {
    assert.ok(p.slug && p.nome, `pipeline sem slug/nome: ${JSON.stringify(p)}`);
    assert.ok(Array.isArray(p.etapas) && p.etapas.length > 0, `${p.slug} sem etapas`);
  }
});

test("etapasDe devolve [] para slug inexistente", () => {
  assert.deepEqual(etapasDe(pipelines, "nao-existe"), []);
  assert.ok(etapasDe(pipelines, "orion").includes("proposta"));
});

test("etapa omitida cai na primeira da pipeline", () => {
  const r = parseLead(base, pipelines);
  assert.ok(r.ok);
  assert.equal(r.lead.etapa, etapasDe(pipelines, "orion")[0]);
});

test("etapa que não existe no JSON é rejeitada — sem FK, a validação é aqui", () => {
  const r = parseLead({ ...base, etapa: "quase-fechando" }, pipelines);
  assert.equal(r.ok, false);
  assert.match(r.erro, /etapa desconhecida/);
});

test("pipeline desconhecida é rejeitada", () => {
  // Slug inventado, e não o de um projeto real: este teste usava "sirius" e virou falso
  // vermelho no dia em que o sirius ganhou pipeline. Exemplo de ausência não se escreve com
  // nome de algo que pode passar a existir.
  assert.equal(parseLead({ ...base, pipeline: "pipeline-que-nunca-vai-existir" }, pipelines).ok, false);
  assert.equal(parseLead({ ...base, pipeline: "" }, pipelines).ok, false);
});

test("pipeline polaris: aceita etapa válida, rejeita etapa fora da lista", () => {
  const r = parseLead(
    { ...base, pipeline: "polaris", origem: "polaris:contato", etapa: "proposta" },
    pipelines,
  );
  assert.ok(r.ok);
  assert.equal(r.lead.etapa, "proposta");

  const invalida = parseLead(
    { ...base, pipeline: "polaris", origem: "polaris:contato", etapa: "quase-fechando" },
    pipelines,
  );
  assert.equal(invalida.ok, false);
  assert.match(invalida.erro, /etapa desconhecida/);
});

test("obrigatórios: nome, origem e external_id", () => {
  for (const campo of ["nome", "origem", "external_id"]) {
    const body = { ...base, [campo]: "" };
    const r = parseLead(body, pipelines);
    assert.equal(r.ok, false, `${campo} vazio deveria falhar`);
  }
  assert.equal(parseLead(null, pipelines).ok, false);
});

test("valor inválido vira null em vez de quebrar o INSERT", () => {
  assert.equal(parseLead({ ...base, valor: "abacaxi" }, pipelines).lead.valor, null);
  assert.equal(parseLead({ ...base, valor: -5 }, pipelines).lead.valor, null);
  assert.equal(parseLead({ ...base, valor: "1200.50" }, pipelines).lead.valor, 1200.5);
});

test("metadata só aceita objeto — array/string viram {}", () => {
  assert.deepEqual(parseLead({ ...base, metadata: ["a"] }, pipelines).lead.metadata, {});
  assert.deepEqual(parseLead({ ...base, metadata: "x" }, pipelines).lead.metadata, {});
  assert.deepEqual(parseLead({ ...base, metadata: { empresa: "ACME" } }, pipelines).lead.metadata, {
    empresa: "ACME",
  });
});

test("campos de texto são aparados e truncados", () => {
  const r = parseLead({ ...base, nome: "  " + "x".repeat(300) + "  " }, pipelines);
  assert.equal(r.lead.nome.length, 200);
});
