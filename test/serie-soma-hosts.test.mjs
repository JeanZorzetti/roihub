// 029 — a soma dos hosts declarados, a assinatura do conjunto e a pertinência a ele.
//
// Os números não são inventados: saem da medição de 18/09/2026 nas duas propriedades da Atma, a
// mesma que está no topo de specs/029-serie-atravessa-migracao/spec.md.
import test from "node:test";
import assert from "node:assert/strict";
import { somarSeriesPorHost, assinaturaDeHosts } from "../lib/serie-gsc.mjs";
import { dentroDoDeclarado } from "../lib/marca.mjs";

const ANTIGO = "atma.roilabs.com.br";
const NOVO = "usealigner.com";

// ── somarSeriesPorHost ──────────────────────────────────────────────────────────────────────
test("o dia é a soma dos hosts — 1.146 + 31 = 1.177, e não 1.146 nem 31", () => {
  const dias = somarSeriesPorHost([
    { host: ANTIGO, days: [{ date: "2026-09-15", impressions: 1146, clicks: 14, position: 2.8 }] },
    { host: NOVO, days: [{ date: "2026-09-15", impressions: 31, clicks: 2, position: 8.3 }] },
  ]);
  assert.equal(dias.length, 1);
  assert.equal(dias[0].impressions, 1177);
  assert.equal(dias[0].clicks, 16);
});

test("dia presente num host e ausente no outro entra com o que existe", () => {
  // 13/09: o domínio novo ainda não tinha impressão nenhuma e o GSC não devolve linha para ele.
  const dias = somarSeriesPorHost([
    { host: ANTIGO, days: [{ date: "2026-09-13", impressions: 557, clicks: 8, position: 3.1 }] },
    { host: NOVO, days: [] },
  ]);
  assert.equal(dias.length, 1, "o dia não pode sumir porque um host não tinha tráfego");
  assert.equal(dias[0].impressions, 557);
});

test("a posição é ponderada por impressão, nunca média de médias", () => {
  const [dia] = somarSeriesPorHost([
    { host: ANTIGO, days: [{ date: "2026-09-15", impressions: 1146, position: 2.8 }] },
    { host: NOVO, days: [{ date: "2026-09-15", impressions: 31, position: 8.3 }] },
  ]);
  const esperado = (2.8 * 1146 + 8.3 * 31) / 1177;
  assert.ok(Math.abs(dia.position - esperado) < 1e-9);
  assert.ok(dia.position < 3, "média simples daria 5,55 — uma posição que nenhum dos dois mediu");
});

test("dia sem impressão em host nenhum tem posição null, nunca 0", () => {
  const [dia] = somarSeriesPorHost([
    { host: ANTIGO, days: [{ date: "2026-07-10", impressions: 0, clicks: 0 }] },
  ]);
  assert.equal(dia.impressions, 0, "zero medido continua zero medido");
  assert.equal(dia.position, null, "posição 0 não existe no Google");
});

test("um host só devolve os dias daquele host, sem alterar nada", () => {
  const days = [
    { date: "2026-09-01", impressions: 786, clicks: 16, position: 4.2 },
    { date: "2026-09-02", impressions: 696, clicks: 7, position: 4.4 },
  ];
  const dias = somarSeriesPorHost([{ host: "goiania.roilabs.com.br", days }]);
  assert.deepEqual(
    dias,
    days.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, position: d.position }))
  );
});

// 031 — o voto único. (3,9 × 1146) ÷ 1146 dá 3,8999999999999995 em ponto flutuante, e a leitura ao
// vivo passa a somar TODO projeto, inclusive os 34 de um host só: sem devolver a posição como veio,
// a FR-006 ("byte a byte igual") dependeria de sorte. Medido em 20.000 casos: 1.574 saíam alterados.
test("voto único devolve a posição do Google exatamente como veio", () => {
  assert.equal(somarSeriesPorHost([{ host: NOVO, days: [{ date: "2026-09-01", impressions: 1146, position: 3.9 }] }])[0].position, 3.9);
  const alteradas = [];
  for (let i = 10; i <= 500; i++) {
    for (const imp of [1, 7, 31, 786, 1146, 24566]) {
      const position = i / 10;
      const [dia] = somarSeriesPorHost([{ host: NOVO, days: [{ date: "2026-09-01", impressions: imp, position }] }]);
      if (dia.position !== position) alteradas.push(`${position} × ${imp} → ${dia.position}`);
    }
  }
  assert.deepEqual(alteradas, [], "a posição de um host só não pode mudar na 16ª casa");
});

test("linha de 0 impressões não vota: sobra um voto, e a posição sai crua", () => {
  const [dia] = somarSeriesPorHost([
    { host: NOVO, days: [{ date: "2026-09-15", impressions: 0, clicks: 0, position: 90 }] },
    { host: ANTIGO, days: [{ date: "2026-09-15", impressions: 1146, clicks: 14, position: 3.9 }] },
  ]);
  assert.equal(dia.position, 3.9);
  assert.equal(dia.impressions, 1146);
});

test("um, dois e nenhum voto na MESMA série: crua, ponderada e null", () => {
  const dias = somarSeriesPorHost([
    { host: ANTIGO, days: [
      { date: "2026-09-13", impressions: 557, position: 3.1 },
      { date: "2026-09-15", impressions: 1146, position: 2.8 },
      { date: "2026-09-16", impressions: 0, position: 12 },
    ] },
    { host: NOVO, days: [{ date: "2026-09-15", impressions: 31, position: 8.3 }] },
  ]);
  assert.equal(dias[0].position, 3.1, "13/09: só o antigo votou");
  assert.ok(Math.abs(dias[1].position - (2.8 * 1146 + 8.3 * 31) / 1177) < 1e-9, "15/09: dois votos, ponderada");
  assert.equal(dias[2].position, null, "16/09: sem impressão, `null` e nunca 0");
});

test("lista vazia devolve lista vazia, e os dias saem em ordem", () => {
  assert.deepEqual(somarSeriesPorHost([]), []);
  assert.deepEqual(somarSeriesPorHost(undefined), []);
  const dias = somarSeriesPorHost([
    { host: NOVO, days: [{ date: "2026-09-15", impressions: 31 }] },
    { host: ANTIGO, days: [{ date: "2026-09-14", impressions: 687 }] },
  ]);
  assert.deepEqual(dias.map((d) => d.date), ["2026-09-14", "2026-09-15"]);
});

// ── assinaturaDeHosts ───────────────────────────────────────────────────────────────────────
test("a assinatura é do conjunto, não da ordem da consulta", () => {
  assert.equal(assinaturaDeHosts([NOVO, ANTIGO]), `${ANTIGO}+${NOVO}`);
  assert.equal(assinaturaDeHosts([ANTIGO, NOVO]), `${ANTIGO}+${NOVO}`);
});

test("www e repetição não dobram a assinatura", () => {
  assert.equal(assinaturaDeHosts([NOVO, `www.${NOVO}`, NOVO]), NOVO);
});

test("um host é uma assinatura válida, e lista vazia é null", () => {
  assert.equal(assinaturaDeHosts([ANTIGO]), ANTIGO);
  assert.equal(assinaturaDeHosts([]), null);
  assert.equal(assinaturaDeHosts(undefined), null);
});

// ── dentroDoDeclarado ───────────────────────────────────────────────────────────────────────
test("assinatura com hosts declarados passa; com host de fora, não", () => {
  const declarados = [NOVO, ANTIGO];
  assert.equal(dentroDoDeclarado(ANTIGO, declarados), true, "os 248 dias antigos seguem regraváveis");
  assert.equal(dentroDoDeclarado(`${ANTIGO}+${NOVO}`, declarados), true);
  assert.equal(dentroDoDeclarado("tapepro.roilabs.com.br", declarados), false, "a guarda da 026 viva");
  assert.equal(dentroDoDeclarado(`${ANTIGO}+outro.com`, declarados), false, "um host de fora basta");
});

test("assinatura ausente passa: ignorância sobre o site não é evidência de outro", () => {
  assert.equal(dentroDoDeclarado(null, [NOVO]), true);
  assert.equal(dentroDoDeclarado(undefined, [NOVO]), true);
});

test("sem declaração nenhuma, assinatura preenchida NÃO passa", () => {
  // Afrouxar por omissão é como esta guarda morreria em silêncio.
  assert.equal(dentroDoDeclarado(ANTIGO, []), false);
  assert.equal(dentroDoDeclarado(ANTIGO, undefined), false);
});
