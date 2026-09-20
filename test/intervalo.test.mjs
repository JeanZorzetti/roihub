import test from "node:test";
import assert from "node:assert/strict";
import { wilson, vereditoContraRegua, vereditoContraFaixa, CONFIANCA, Z_95 } from "../lib/intervalo.mjs";

// ── Wilson — os casos de referência de research.md §R1 ──────────────────────────────────────────
test("wilson(0, 21) — Posição 1: inferior === 0 (clamp), superior ≈ 15,5%", () => {
  const { inferior, superior, confianca, metodo } = wilson(0, 21);
  assert.equal(inferior, 0, "a forma fechada devolve -1,17e-17; sem o clamp isto reprova");
  assert.ok(Math.abs(superior - 0.1546) < 0.0002, `superior=${superior}`);
  assert.equal(confianca, CONFIANCA);
  assert.equal(metodo, "wilson");
});

test("wilson(3, 105) — Posições 4 a 6: [1,0% ; 8,1%]", () => {
  const { inferior, superior } = wilson(3, 105);
  assert.ok(Math.abs(inferior - 0.0098) < 0.0002, `inferior=${inferior}`);
  assert.ok(Math.abs(superior - 0.0807) < 0.0002, `superior=${superior}`);
});

test("wilson(0, 1) — URL de 1 impressão: inferior === 0, superior ≈ 0,793", () => {
  const { inferior, superior } = wilson(0, 1);
  assert.equal(inferior, 0);
  assert.ok(Math.abs(superior - 0.793) < 0.001, `superior=${superior}`);
});

test("wilson(275, 21500) — página nomeada: [0,011 ; 0,014]", () => {
  const { inferior, superior } = wilson(275, 21500);
  assert.ok(inferior >= 0.011 && inferior <= 0.012, `inferior=${inferior}`);
  assert.ok(superior >= 0.014 && superior <= 0.0145, `superior=${superior}`);
});

test("wilson(k, 0) → null: não há intervalo de amostra que não existe", () => {
  assert.equal(wilson(0, 0), null);
  assert.equal(wilson(5, 0), null);
});

test("wilson(n, n) → superior === 1, nunca mais", () => {
  assert.equal(wilson(21, 21).superior, 1);
  assert.equal(wilson(1, 1).superior, 1);
});

test("wilson — cliques fora do domínio lança", () => {
  assert.throws(() => wilson(-1, 10));
  assert.throws(() => wilson(11, 10));
});

test("wilson — impressões não finitas ou negativas devolvem null", () => {
  assert.equal(wilson(0, -1), null);
  assert.equal(wilson(0, NaN), null);
  assert.equal(wilson(0, Infinity), null);
});

// ── FR-003 como invariante — varredura, não três exemplos ───────────────────────────────────────
test("FR-003 — varredura n=1..500, k=0..n: 0 <= inferior <= superior <= 1 sempre", () => {
  for (let n = 1; n <= 500; n++) {
    for (let k = 0; k <= n; k++) {
      const { inferior, superior } = wilson(k, n);
      assert.ok(inferior >= 0, `wilson(${k},${n}).inferior=${inferior} < 0`);
      assert.ok(superior <= 1, `wilson(${k},${n}).superior=${superior} > 1`);
      assert.ok(inferior <= superior, `wilson(${k},${n}): inferior > superior`);
    }
  }
});

// ── vereditoContraRegua — os casos de referência ─────────────────────────────────────────────────
test("vereditoContraRegua(0, 21, 0.25) === 'abaixo' — SC-001", () => {
  assert.equal(vereditoContraRegua(0, 21, 0.25), "abaixo");
});

test("vereditoContraRegua(3, 105, 0.045) === 'indecisa' — SC-002", () => {
  assert.equal(vereditoContraRegua(3, 105, 0.045), "indecisa");
});

test("vereditoContraRegua(0, 1, 0.13) === 'indecisa'", () => {
  assert.equal(vereditoContraRegua(0, 1, 0.13), "indecisa");
});

test("vereditoContraRegua(4, 900, null) === null, nunca 'indecisa'", () => {
  assert.equal(vereditoContraRegua(4, 900, null), null);
});

test("vereditoContraRegua(25, 100, 0.25) === 'indecisa'", () => {
  assert.equal(vereditoContraRegua(25, 100, 0.25), "indecisa");
});

test("vereditoContraRegua — empate exato no piso (inferior === regua) é 'atinge', não 'indecisa'", () => {
  // regua construída como o próprio `inferior` da amostra: testa a fronteira >= sem depender de
  // ponto flutuante feliz — inferior >= regua é verdadeiro por construção.
  const { inferior } = wilson(900000, 1000000);
  assert.equal(vereditoContraRegua(900000, 1000000, inferior), "atinge");
});

test("vereditoContraRegua — contagem de cliques não entra: 0/21 contra 25% é 'abaixo', não 'indecisa'", () => {
  assert.equal(vereditoContraRegua(0, 21, 0.25), "abaixo");
});

test("vereditoContraRegua — impressoes <= 0 devolve null", () => {
  assert.equal(vereditoContraRegua(0, 0, 0.25), null);
});

// ── vereditoContraFaixa — US3 ─────────────────────────────────────────────────────────────────────
test("vereditoContraFaixa — 'atinge' só quando inferior >= 0.50 contra [0.40, 0.50]", () => {
  assert.equal(vereditoContraFaixa(0, 22899 * 0.03, [0.4, 0.5]), "abaixo");
  // amostra grande e fração bem acima do teto: intervalo inteiro à direita de 0.50
  assert.equal(vereditoContraFaixa(900000, 1000000, [0.4, 0.5]), "atinge");
  // fração pequena, amostra grande: intervalo inteiro à esquerda de 0.40
  assert.equal(vereditoContraFaixa(30000, 1000000, [0.4, 0.5]), "abaixo");
  // amostra pequena demais para excluir a faixa inteira
  assert.equal(vereditoContraFaixa(1, 3, [0.4, 0.5]), "indecisa");
});

test("vereditoContraFaixa — piso > teto lança", () => {
  assert.throws(() => vereditoContraFaixa(1, 10, [0.5, 0.4]));
});

test("vereditoContraFaixa — faixa null ou impressoes <= 0 devolve null", () => {
  assert.equal(vereditoContraFaixa(1, 10, null), null);
  assert.equal(vereditoContraFaixa(0, 0, [0.4, 0.5]), null);
});

// ── Pureza — mesma entrada, mesma saída ──────────────────────────────────────────────────────────
test("wilson é puro: mesma entrada, mesma saída", () => {
  assert.deepEqual(wilson(3, 105), wilson(3, 105));
});
