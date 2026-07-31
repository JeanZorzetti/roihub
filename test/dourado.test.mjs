import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, join } from "node:path";

const ARQUIVO = fileURLToPath(new URL("../data/dourado.json", import.meta.url));
const PROTOCOLOS = fileURLToPath(new URL("../data/protocolos/", import.meta.url));
const HANDOFF = fileURLToPath(new URL("../handoff/", import.meta.url));

const CAMADAS = new Set(["protocolo", "estado", "episodio"]);
const ID = /^D-\d{2}$/;
const ID_PROTOCOLO = /^[A-Z0-9]+-\d+$/;

let dourado;
try {
  dourado = JSON.parse(readFileSync(ARQUIVO, "utf8"));
} catch (err) {
  assert.fail(`data/dourado.json não parseia: ${err.message}`);
}

const protocolos = new Set(
  readdirSync(PROTOCOLOS).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json")),
);

test("o conjunto dourado existe e é uma lista", () => {
  assert.ok(Array.isArray(dourado), "data/dourado.json não é uma lista");
  assert.ok(dourado.length >= 50, `dourado com ${dourado.length} perguntas; o piso é 50`);
});

test("toda pergunta tem os quatro campos preenchidos", () => {
  for (const q of dourado) {
    for (const campo of ["id", "pergunta", "resposta", "camada", "fontes", "armadilha"]) {
      assert.ok(campo in q, `${q.id ?? "?"}: falta ${campo}`);
    }
    for (const campo of ["pergunta", "resposta", "armadilha"]) {
      assert.ok(typeof q[campo] === "string" && q[campo].trim(), `${q.id}: ${campo} vazio`);
    }
    // Pergunta sem "?" costuma ser afirmação disfarçada, que não mede recuperação.
    assert.ok(q.pergunta.includes("?"), `${q.id}: pergunta não é pergunta`);
  }
});

test("id no formato D-NN, único", () => {
  const vistos = new Set();
  for (const q of dourado) {
    assert.ok(ID.test(q.id), `${q.id}: id fora do formato D-NN`);
    assert.ok(!vistos.has(q.id), `${q.id} duplicado`);
    vistos.add(q.id);
  }
});

test("camada é uma das três: protocolo, estado ou episódio", () => {
  for (const q of dourado) {
    assert.ok(CAMADAS.has(q.camada), `${q.id}: camada inválida (${q.camada})`);
  }
});

test("fonte no formato de protocolo tem que existir em data/protocolos/", () => {
  for (const q of dourado) {
    assert.ok(Array.isArray(q.fontes) && q.fontes.length, `${q.id}: fontes vazia`);
    for (const fonte of q.fontes) {
      assert.ok(typeof fonte === "string" && fonte.trim(), `${q.id}: fonte vazia`);
      if (!ID_PROTOCOLO.test(fonte)) continue;
      assert.ok(protocolos.has(fonte), `${q.id}: fonte ${fonte} não existe em data/protocolos/`);
    }
  }
});

test("fonte terminada em .md tem que ser um handoff que existe", () => {
  for (const q of dourado) {
    for (const fonte of q.fontes.filter((f) => f.endsWith(".md"))) {
      assert.ok(existsSync(join(HANDOFF, fonte)), `${q.id}: handoff ${fonte} não existe`);
    }
  }
});

// Área sem pergunta é área que a avaliação não mede: o dourado deixaria de detectar
// regressão de recuperação justamente nela.
test("toda área com protocolo tipado aparece em pelo menos uma pergunta", () => {
  const comProtocolo = new Set([...protocolos].map((id) => id.split("-")[0]));
  const cobertas = new Set();
  for (const q of dourado) {
    for (const fonte of q.fontes) {
      if (ID_PROTOCOLO.test(fonte)) cobertas.add(fonte.split("-")[0]);
    }
  }
  for (const area of comProtocolo) {
    assert.ok(cobertas.has(area), `área ${area} tem protocolo mas nenhuma pergunta no dourado`);
  }
});
