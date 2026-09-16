import { test } from "node:test";
import assert from "node:assert/strict";
import { checar, passo, textoDoAviso } from "../lib/vigia.mjs";

const ALVO = "https://atmaapi.roilabs.com.br/api/system/health";
const MIN = 60 * 1000;
// 16/09/2026 14:32 em BRT (17:32 UTC).
const T0 = Date.UTC(2026, 8, 16, 17, 32);

const resposta = (status, corpo) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => JSON.parse(corpo),
});
const fetchQue = (r) => async () => (r instanceof Error ? Promise.reject(r) : r);

test("checar: só 2xx com status OK no corpo é no ar", async () => {
  assert.deepEqual(await checar(ALVO, fetchQue(resposta(200, '{"status":"OK","uptime":1}'))), { ok: true });
  assert.deepEqual(await checar(ALVO, fetchQue(new Error("timeout"))), { ok: false, motivo: "sem resposta" });
  assert.deepEqual(await checar(ALVO, fetchQue(resposta(502, "Bad Gateway"))), { ok: false, motivo: "erro 502" });
  // Página de erro do proxy com 200.
  assert.deepEqual(await checar(ALVO, fetchQue(resposta(200, "<html>"))), { ok: false, motivo: "resposta inesperada" });
  // O /health responde 200 sem banco, de propósito, e diz o estado no corpo.
  assert.deepEqual(await checar(ALVO, fetchQue(resposta(200, '{"status":"ERROR"}'))), { ok: false, motivo: "sem banco de dados" });
});

test("checar: pede a URL com limite de tempo", async () => {
  let chamada;
  await checar(ALVO, async (url, init) => ((chamada = { url, init }), resposta(200, '{"status":"OK"}')));
  assert.equal(chamada.url, ALVO);
  assert.ok(chamada.init.signal instanceof AbortSignal);
});

const ok = { ok: true };
const ruim = { ok: false, motivo: "sem resposta" };
const fora = { foraDesde: T0, motivo: "sem resposta", avisado: false };

test("passo: no ar e checagem boa não muda nada", () => {
  assert.deepEqual(passo(null, ok, T0), { estado: null, aviso: null, mudou: false });
});

test("passo: a 1ª checagem ruim registra a queda sem avisar", () => {
  assert.deepEqual(passo(null, ruim, T0), { estado: fora, aviso: null, mudou: true });
});

test("passo: queda com menos de 10 min não avisa nem grava", () => {
  assert.deepEqual(passo(fora, { ok: false, motivo: "erro 502" }, T0 + 10 * MIN - 1), { estado: fora, aviso: null, mudou: false });
});

test("passo: aos 10 min avisa a queda com o motivo da 1ª checagem ruim", () => {
  assert.deepEqual(passo(fora, { ok: false, motivo: "erro 502" }, T0 + 10 * MIN), {
    estado: { ...fora, avisado: true },
    aviso: { tipo: "queda", foraDesde: T0, motivo: "sem resposta" },
    mudou: true,
  });
});

test("passo: queda já avisada não avisa de novo", () => {
  const avisado = { ...fora, avisado: true };
  assert.deepEqual(passo(avisado, ruim, T0 + 90 * MIN), { estado: avisado, aviso: null, mudou: false });
});

test("passo: oscilação curta some em silêncio", () => {
  assert.deepEqual(passo(fora, ok, T0 + 4 * MIN), { estado: null, aviso: null, mudou: true });
});

test("passo: volta de queda avisada avisa com início e fim", () => {
  assert.deepEqual(passo({ ...fora, avisado: true }, ok, T0 + 23 * MIN), {
    estado: null,
    aviso: { tipo: "volta", foraDesde: T0, ate: T0 + 23 * MIN },
    mudou: true,
  });
});

const link = `<a href="${ALVO}">Abrir a checagem</a>`;

test("textoDoAviso: queda com o motivo em português e a hora em BRT", () => {
  assert.equal(
    textoDoAviso({ tipo: "queda", foraDesde: T0, motivo: "sem resposta" }, ALVO),
    ["🔴 <b>Fora do ar · Atma</b>", "Backend sem resposta desde 14:32 de 16/09", link].join("\n"),
  );
  const motivo = (m) => textoDoAviso({ tipo: "queda", foraDesde: T0, motivo: m }, ALVO).split("\n")[1];
  assert.equal(motivo("erro 502"), "Backend com erro 502 desde 14:32 de 16/09");
  assert.equal(motivo("sem banco de dados"), "Backend sem banco de dados desde 14:32 de 16/09");
  assert.equal(motivo("resposta inesperada"), "Backend com resposta inesperada desde 14:32 de 16/09");
});

test("textoDoAviso: volta com a duração em min e em h", () => {
  assert.equal(
    textoDoAviso({ tipo: "volta", foraDesde: T0, ate: T0 + 23 * MIN }, ALVO),
    ["✅ <b>De volta · Atma</b>", "Backend ficou fora por 23 min, das 14:32 às 14:55", link].join("\n"),
  );
  assert.equal(
    textoDoAviso({ tipo: "volta", foraDesde: T0, ate: T0 + 125 * MIN }, ALVO).split("\n")[1],
    "Backend ficou fora por 2 h 05 min, das 14:32 às 16:37",
  );
});

test("textoDoAviso: queda que atravessa a meia-noite de BRT leva a data nos dois horários", () => {
  const t = Date.UTC(2026, 8, 17, 2, 50); // 23:50 de 16/09 em BRT
  assert.equal(
    textoDoAviso({ tipo: "volta", foraDesde: t, ate: t + 30 * MIN }, ALVO).split("\n")[1],
    "Backend ficou fora por 30 min, das 23:50 de 16/09 às 00:20 de 17/09",
  );
});

test("textoDoAviso: a URL do alvo entra escapada", () => {
  assert.match(textoDoAviso({ tipo: "queda", foraDesde: T0, motivo: "sem resposta" }, "https://x/?a=1&b=2"), /\?a=1&amp;b=2/);
});
