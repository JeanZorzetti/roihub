// 029 — o que NÃO pode mudar.
//
// A feature só alcança projeto que declara `dominioAnterior` (hoje, a Atma). Os outros 34 têm de
// sair byte a byte iguais, e a guarda da 026 — que impediu 248 dias de serem reescritos com
// números de outro site — tem de continuar barrando o caso que a criou.
import test from "node:test";
import assert from "node:assert/strict";
import { somarSeriesPorHost, assinaturaDeHosts } from "../lib/serie-gsc.mjs";
import { hostsDeclarados } from "../lib/projects.mjs";
import { segmentosPorHost, semanasNaoMarca, ritmoDoSegmentoAtual, dentroDoDeclarado } from "../lib/marca.mjs";

const ANTIGO = "atma.roilabs.com.br";
const NOVO = "usealigner.com";

// Uma série de 3 semanas cheias no host antigo e 2 no novo, atravessando a troca.
const serie = (() => {
  const dias = [];
  const t0 = Date.parse("2026-08-24T00:00:00Z"); // uma segunda-feira
  for (let i = 0; i < 35; i++) {
    const dia = new Date(t0 + i * 864e5).toISOString().slice(0, 10);
    // A troca é declarada em 11/09; a partir dela a corrida soma os dois hosts.
    const host = dia >= "2026-09-11" ? `${ANTIGO}+${NOVO}` : ANTIGO;
    dias.push({ dia, host, impressoes: 500, impressoesNaoMarca: 400, cliquesNaoMarca: 8, posicao: 5 });
  }
  return dias;
})();

// ── projeto sem dominioAnterior: nada muda ──────────────────────────────────────────────────
test("projeto sem dominioAnterior declara um host só", () => {
  assert.deepEqual(hostsDeclarados({ url: "https://goiania.roilabs.com.br/" }), ["goiania.roilabs.com.br"]);
});

test("um host declarado produz a assinatura de sempre e a soma de sempre", () => {
  const days = [{ date: "2026-09-01", impressions: 786, clicks: 16, position: 4.2 }];
  assert.equal(assinaturaDeHosts(["goiania.roilabs.com.br"]), "goiania.roilabs.com.br");
  assert.deepEqual(somarSeriesPorHost([{ host: "goiania.roilabs.com.br", days }]), [
    { date: "2026-09-01", impressions: 786, clicks: 16, position: 4.2 },
  ]);
});

test("sem declarados, a leitura é a da 026: a troca de host corta a série em dois", () => {
  // É o comportamento que protege quem trocou a `url` sem declarar (FR-015).
  const segs = segmentosPorHost(serie);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].host, ANTIGO);
  assert.equal(segs[1].host, `${ANTIGO}+${NOVO}`);
});

// ── com declarados: a série é uma só ────────────────────────────────────────────────────────
test("com os hosts declarados, a mesma série é UM segmento", () => {
  const segs = segmentosPorHost(serie, [NOVO, ANTIGO]);
  assert.equal(segs.length, 1, "a assinatura mudou DENTRO do declarado — não é outro site");
  assert.equal(segs[0].dias.length, 35);
});

test("host fora do declarado continua abrindo segmento novo", () => {
  const intruso = [...serie, { dia: "2026-09-28", host: "tapepro.roilabs.com.br", impressoes: 9, impressoesNaoMarca: 9 }];
  const segs = segmentosPorHost(intruso, [NOVO, ANTIGO]);
  assert.equal(segs.length, 2, "a guarda da 026 viva: site estranho não entra na série");
  assert.equal(segs[1].host, "tapepro.roilabs.com.br");
});

test("a semana que cruza a troca volta a ter valor", () => {
  const semanaDaTroca = semanasNaoMarca(serie, [NOVO, ANTIGO]).find((w) => w.inicio === "2026-09-07");
  assert.equal(semanaDaTroca.dias, 7);
  assert.equal(semanaDaTroca.completa, true);
  assert.notEqual(semanaDaTroca.host, null, "host null é o que a tela desenha como coluna vazia");
  assert.equal(semanaDaTroca.impressoesNaoMarca, 2800);
});

test("sem declarados, a MESMA semana continua sem valor (a 026 intacta)", () => {
  const semanaDaTroca = semanasNaoMarca(serie).find((w) => w.inicio === "2026-09-07");
  assert.equal(semanaDaTroca.host, null, "4 dias de uma assinatura e 3 de outra");
});

test("o veredito passa a sair da série inteira, sem segmento posterior", () => {
  const leitura = ritmoDoSegmentoAtual(serie, [NOVO, ANTIGO]);
  assert.equal(leitura.posteriores.length, 0, "sem isto a tela diz que a série está encerrada");
  assert.equal(leitura.segmento.dias.length, 35);
});

// ── a guarda ────────────────────────────────────────────────────────────────────────────────
test("a guarda barra o site estranho e libera a regravação dentro da declaração", () => {
  assert.equal(dentroDoDeclarado(ANTIGO, [NOVO, ANTIGO]), true);
  assert.equal(dentroDoDeclarado(`${ANTIGO}+${NOVO}`, [NOVO, ANTIGO]), true);
  assert.equal(dentroDoDeclarado("tapepro.roilabs.com.br", [NOVO, ANTIGO]), false);
});
