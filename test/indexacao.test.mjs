import test from "node:test";
import assert from "node:assert/strict";
import { inspecionarIndexacao, INSPECOES_SIMULTANEAS } from "../lib/indexacao.mjs";

// Cliente falso: a API de sites devolve uma propriedade, e a de inspeção responde com atraso
// DECRESCENTE — a primeira URL volta por último. Se a saída seguisse a ordem de chegada, o teste
// de ordem pegaria.
function clienteFalso({ falhaEm = null } = {}) {
  const estado = { abertas: 0, pico: 0 };
  let n = 0;
  const client = {
    async request({ url, data }) {
      if (!data) return { data: { siteEntry: [{ siteUrl: "sc-domain:x.com", permissionLevel: "siteOwner" }] } };
      const atraso = 40 - (n++ % 10) * 4;
      estado.abertas++;
      estado.pico = Math.max(estado.pico, estado.abertas);
      await new Promise((r) => setTimeout(r, atraso));
      estado.abertas--;
      if (data.inspectionUrl === falhaEm) throw Object.assign(new Error("boom"), { response: { status: 429 } });
      return { data: { inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: `ok ${data.inspectionUrl}` } } } };
    },
  };
  return { client, estado };
}

const urls = Array.from({ length: 10 }, (_, i) => `https://x.com/p${i}`);

test("inspecionarIndexacao devolve as linhas na ordem de entrada, não na de chegada", async () => {
  const { client } = clienteFalso();
  const linhas = await inspecionarIndexacao(urls, { client });
  assert.deepEqual(linhas.map((l) => l.url), urls);
  assert.deepEqual(linhas.map((l) => l.coverage), urls.map((u) => `ok ${u}`));
});

test("inspecionarIndexacao abre mais de uma inspeção por vez, e nunca mais que o teto", async () => {
  const { client, estado } = clienteFalso();
  await inspecionarIndexacao(urls, { client });
  assert.ok(estado.pico > 1, `pico ${estado.pico}: a corrida continua em série`);
  assert.ok(estado.pico <= INSPECOES_SIMULTANEAS, `pico ${estado.pico} passou do teto ${INSPECOES_SIMULTANEAS}`);
});

test("a falha de uma URL vira erro nela, e as vizinhas do mesmo lote seguem apuradas", async () => {
  const { client } = clienteFalso({ falhaEm: "https://x.com/p1" });
  const linhas = await inspecionarIndexacao(urls, { client });
  assert.equal(linhas[1].erro, "429 boom");
  assert.equal(linhas[1].verdict, "");
  assert.ok(linhas.filter((_, i) => i !== 1).every((l) => l.erro === "" && l.verdict === "PASS"));
});

test("URL fora de toda propriedade sai como sem-propriedade, sem gastar inspeção", async () => {
  const { client, estado } = clienteFalso();
  const [l] = await inspecionarIndexacao(["https://outro.com/"], { client });
  assert.equal(l.propriedade, null);
  assert.equal(l.erro, "sem propriedade no GSC");
  assert.equal(estado.pico, 0);
});
