import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, basename } from "node:path";

const DIR = fileURLToPath(new URL("../data/protocolos/", import.meta.url));

// As 18 áreas da camada 0 (13 com lastro + 5 lacunas declaradas).
// Trocar esta lista custa reindexação — ver docs/protocolos-areas.md.
const AREAS = new Set([
  "DEP", "SEO", "UI", "VER", "AGT", "INT", "DNS", "SEC", "DAT", "PRF", "CNT", "PRT", "GEO",
  "BKP", "CST", "OBS", "PRV", "A11Y",
]);

const CAMPOS = ["id", "area", "titulo", "norma", "motivo", "verificacao", "aplica_se_a", "excecoes", "origem", "valid_from", "valid_to"];
const TIPOS = new Set(["automatica", "semiautomatica", "manual"]);
const FALHA = new Set(["bloqueia", "alerta"]);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

const arquivos = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

const registros = arquivos.map((arquivo) => {
  const bruto = readFileSync(join(DIR, arquivo), "utf8");
  let parsed;
  try {
    parsed = JSON.parse(bruto);
  } catch (err) {
    assert.fail(`${arquivo} não parseia: ${err.message}`);
  }
  return { arquivo, p: parsed };
});

test("existe protocolo tipado para carregar", () => {
  assert.ok(registros.length > 0, "data/protocolos/ vazio");
});

test("todo registro tem os campos obrigatórios preenchidos", () => {
  for (const { arquivo, p } of registros) {
    for (const campo of CAMPOS) {
      assert.ok(campo in p, `${arquivo}: falta ${campo}`);
    }
    for (const campo of ["titulo", "norma", "motivo"]) {
      assert.ok(typeof p[campo] === "string" && p[campo].trim(), `${arquivo}: ${campo} vazio`);
    }
    assert.ok(DATA.test(p.valid_from), `${arquivo}: valid_from não é YYYY-MM-DD`);
  }
});

test("verificacao.como é o campo que separa protocolo de anotação", () => {
  for (const { arquivo, p } of registros) {
    assert.ok(p.verificacao && typeof p.verificacao === "object", `${arquivo}: verificacao ausente`);
    assert.ok(typeof p.verificacao.como === "string" && p.verificacao.como.trim(), `${arquivo}: verificacao.como vazio`);
    assert.ok(TIPOS.has(p.verificacao.tipo), `${arquivo}: verificacao.tipo inválido (${p.verificacao.tipo})`);
    assert.ok(FALHA.has(p.verificacao.falha_significa), `${arquivo}: falha_significa inválido (${p.verificacao.falha_significa})`);
    assert.ok(typeof p.verificacao.frequencia === "string" && p.verificacao.frequencia.trim(), `${arquivo}: frequencia vazia`);
  }
});

test("area é uma das 18 e bate com o prefixo do id", () => {
  for (const { arquivo, p } of registros) {
    assert.ok(AREAS.has(p.area), `${arquivo}: area desconhecida (${p.area})`);
    assert.equal(p.id.split("-").slice(0, -1).join("-"), p.area, `${arquivo}: id não começa pela área`);
  }
});

test("id bate com o nome do arquivo e não se repete", () => {
  const vistos = new Set();
  for (const { arquivo, p } of registros) {
    assert.equal(p.id, basename(arquivo, ".json"), `${arquivo}: id diferente do nome do arquivo`);
    assert.ok(!vistos.has(p.id), `${p.id} duplicado`);
    vistos.add(p.id);
  }
});

test("origem é obrigatória: resposta sem procedência o agente re-deriva", () => {
  for (const { arquivo, p } of registros) {
    assert.ok(Array.isArray(p.origem) && p.origem.length, `${arquivo}: origem vazia`);
    assert.ok(p.origem.every((o) => typeof o === "string" && o.trim()), `${arquivo}: origem com entrada vazia`);
  }
});

test("aplica_se_a tem os três eixos com pelo menos um valor", () => {
  for (const { arquivo, p } of registros) {
    for (const eixo of ["stack", "infra", "superficie"]) {
      assert.ok(Array.isArray(p.aplica_se_a?.[eixo]) && p.aplica_se_a[eixo].length, `${arquivo}: aplica_se_a.${eixo} vazio`);
    }
    assert.ok(Array.isArray(p.excecoes), `${arquivo}: excecoes precisa ser lista (vazia é válido)`);
  }
});

test("protocolo revogado sai de circulação apontando para o substituto", () => {
  const ids = new Set(registros.map(({ p }) => p.id));
  for (const { arquivo, p } of registros) {
    if (p.valid_to === null || p.valid_to === undefined) continue;
    assert.ok(DATA.test(p.valid_to), `${arquivo}: valid_to não é YYYY-MM-DD`);
    assert.ok(p.supersede, `${arquivo}: valid_to preenchido exige supersede`);
    assert.ok(ids.has(p.supersede), `${arquivo}: supersede aponta para ${p.supersede}, que não existe`);
  }
});
