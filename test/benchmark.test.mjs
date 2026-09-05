import test from "node:test";
import assert from "node:assert/strict";

import { REGUA, ROTULOS, leituraDoDegrau, distanciaDoMercado, formatarRazao } from "../lib/benchmark.mjs";
import { PERFIS, montarFicha } from "../lib/okr.mjs";
import { apurado, naoApurado } from "../lib/funil.mjs";

// A ficha do `atma`: 535 cliques → 39 leads → 0 tratamentos, janela 01/08→29/08/2026. Os degraus
// do meio nunca foram medidos, e é justamente isso que a régua tem de saber dizer sem estimar.
const fichaAtma = () =>
  montarFicha({
    slug: "atma",
    perfil: "D",
    coletado: { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) },
  });

const degrauDe = (ficha, chave) => distanciaDoMercado(ficha).leituras.find((l) => l.degrau === chave);

// ---------------------------------------------------------------------------
// TRAVA Nº 1 — a R6 como asserção. É a razão de este arquivo existir.
//
// Nenhuma outra trava precisa de teste: `sem régua` e `sem par apurado` o próprio código impede.
// Compor duas faixas, não — quem escrever `a.razao * b.razao` produz código que compila e que
// reproduz exatamente a projeção de €1,8M com barra de erro de 56×. A suíte é o único lugar onde
// isso quebra antes do deploy.
// ---------------------------------------------------------------------------

test("trava 1: uma leitura carrega UMA faixa só, nunca um produto de faixas", () => {
  for (const leitura of distanciaDoMercado(fichaAtma()).leituras) {
    if (!leitura.faixa) continue;
    assert.deepEqual(
      Object.keys(leitura.faixa).sort(),
      ["elite", "media"],
      `${leitura.degrau}: faixa deveria ter exatamente media+elite de UM degrau`,
    );
    assert.equal(leitura.faixa.media.length, 2, "faixa é [min,max], não uma cadeia acumulada");
  }
});

test("trava 1: a saída de uma leitura NÃO é aceita como entrada de outra", () => {
  const ficha = fichaAtma();
  const primeira = degrauDe(ficha, "visitante→lead");
  assert.equal(primeira.rotulo, "acima da média");

  // Tentar realimentar a régua com o resultado dela mesma — o gesto exato que gerou a projeção
  // que a R6 recusa. Uma leitura não tem `celula`, então `ehApurado` recusa e a régua cala.
  const realimentada = leituraDoDegrau("D", { de: "x", para: "y", celula: primeira, numerador: primeira, denominador: primeira }, "visitante→lead");
  assert.equal(realimentada.rotulo, "sem par apurado", "compor leitura com leitura DEVE calar");
  assert.equal(realimentada.razao, undefined);
});

test("trava 1: o buraco vem de UMA multiplicação, contra denominador apurado", () => {
  // 535 visitantes apurados × 2% (piso do mercado) = ~11 esperados. Se o cálculo passasse por
  // outra faixa, o resultado mudaria — e seria a pesquisa de volta.
  const taxa = { de: "visitante", para: "lead", celula: apurado(0), numerador: apurado(0), denominador: apurado(535) };
  const l = leituraDoDegrau("D", taxa, "visitante→lead");
  assert.equal(l.buraco.esperado, 11);
  assert.equal(l.buraco.base, 0.02, "a base do buraco é o piso da média DESTE degrau, e só");
  assert.equal(l.buraco.faltam, 11);
});

// ---------------------------------------------------------------------------
// A tabela casa com os marcos, nos dois sentidos
// ---------------------------------------------------------------------------

test("toda linha da REGUA aponta para um par de marcos que existe em PERFIS", () => {
  for (const [perfil, linhas] of Object.entries(REGUA)) {
    const marcos = PERFIS[perfil]?.marcos;
    assert.ok(marcos, `perfil ${perfil} não existe em PERFIS`);
    const pares = new Set(marcos.slice(1).map((m, i) => `${marcos[i].chave}→${m.chave}`));
    for (const chave of Object.keys(linhas)) {
      assert.ok(pares.has(chave), `${perfil}: régua aponta para degrau inexistente \`${chave}\``);
    }
  }
});

test("toda linha tem fonte citável e faixa, nunca ponto solto (R8 + trava 3)", () => {
  for (const [perfil, linhas] of Object.entries(REGUA)) {
    for (const [chave, linha] of Object.entries(linhas)) {
      const onde = `${perfil}/${chave}`;
      assert.ok(linha.fonte?.length > 10, `${onde}: sem fonte citável`);
      for (const f of ["media", "elite"]) {
        assert.equal(linha[f].length, 2, `${onde}: ${f} deve ser [min,max]`);
        assert.ok(linha[f][0] <= linha[f][1], `${onde}: ${f} invertida`);
        assert.ok(linha[f][0] > 0 && linha[f][1] <= 1, `${onde}: ${f} fora de 0..1`);
      }
      assert.ok(linha.elite[0] >= linha.media[0], `${onde}: elite abaixo da média`);
    }
  }
});

test("cobertura declarada: 9 linhas em 16 degraus (SC-002, atualizado na 017)", () => {
  // Era 10/17 antes da 017: `aceito` saiu de PERFIS.D (deixou de ser degrau) e
  // REGUA.D["orcamento→aceito"] saiu junto (não sobrevive linha sem par — ver o teste de
  // contiguidade acima). -1 degrau, -1 linha.
  const degraus = Object.values(PERFIS).reduce((n, p) => n + p.marcos.length - 1, 0);
  const linhas = Object.values(REGUA).reduce((n, l) => n + Object.keys(l).length, 0);
  assert.equal(degraus, 16);
  assert.equal(linhas, 9);
});

// ---------------------------------------------------------------------------
// O caso `atma` (SC-001) e os estados que calam
// ---------------------------------------------------------------------------

test("atma: visitante→lead é 7,29% e lê `acima da média`, 2,0× o piso", () => {
  const l = degrauDe(fichaAtma(), "visitante→lead");
  assert.equal(l.rotulo, "acima da média");
  assert.equal(formatarRazao(l.razao), "3,6×"); // 7,29% / 2% (piso da média)
  assert.ok(l.apurado > 0.072 && l.apurado < 0.073);
  assert.match(l.fonte, /Runner Agency/);
  assert.equal(l.buraco, null, "acima do piso não tem buraco");
});

test("atma: o destaque é o degrau apurado, não um dos não apurados", () => {
  const { destaque } = distanciaDoMercado(fichaAtma());
  assert.equal(destaque.degrau, "visitante→lead");
  assert.ok(ROTULOS.includes(destaque.rotulo));
});

test("ponta não apurada devolve `sem par apurado` e aponta para a §7.2", () => {
  const l = degrauDe(fichaAtma(), "lead→contatado");
  assert.equal(l.rotulo, "sem par apurado");
  assert.match(l.motivo, /§7\.2/);
  assert.equal(l.apurado, undefined, "sem número onde não há medição");
  assert.equal(l.faixa, undefined);
});

test("degrau sem linha devolve `sem régua` MESMO com os dois lados apurados", () => {
  const taxa = { de: "contato feito", para: "orçamento", celula: apurado(0.5), numerador: apurado(5), denominador: apurado(10) };
  const l = leituraDoDegrau("D", taxa, "contatado→orcamento");
  assert.equal(l.rotulo, "sem régua");
  assert.equal(l.razao, undefined, "sem régua não produz razão");
});

test("perfil A: trial→cobrança cala enquanto o modelo de trial não for declarado", () => {
  const taxa = { de: "trial pago", para: "cobrança", celula: apurado(0.2), numerador: apurado(2), denominador: apurado(10) };
  const l = leituraDoDegrau("A", taxa, "trial→cobranca");
  assert.equal(l.rotulo, "sem régua");
  assert.match(l.motivo, /modelo de trial/);
});

test("zero apurado com denominador > 0 é `abaixo do piso` COM buraco, não ausência", () => {
  const taxa = { de: "visitante", para: "lead", celula: apurado(0), numerador: apurado(0), denominador: apurado(535) };
  const l = leituraDoDegrau("D", taxa, "visitante→lead");
  assert.equal(l.rotulo, "abaixo do piso");
  assert.equal(l.razao, 0);
  assert.equal(l.buraco.faltam, 11); // 535 × 2%
});

test("denominador 0 cala: `0/0` não é 0% (razao() já recusa)", () => {
  const ficha = montarFicha({ slug: "vazio", perfil: "D", coletado: { cliques: apurado(0), leads: apurado(0) } });
  const l = degrauDe(ficha, "visitante→lead");
  assert.equal(l.rotulo, "sem par apurado");
});

test("sem perfil declarado, a régua não inventa perfil", () => {
  const ficha = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const r = distanciaDoMercado(ficha);
  assert.equal(r.destaque, null);
  assert.deepEqual(r.leituras, []);
  assert.match(r.motivo, /sem perfil/);
});

test("nenhuma saída é prescritiva: só razão e faixa, nunca `meta` ou `alvo` (trava 5)", () => {
  for (const l of distanciaDoMercado(fichaAtma()).leituras) {
    for (const k of Object.keys(l)) {
      assert.ok(!/meta|alvo|target|objetivo/i.test(k), `campo \`${k}\` soa prescritivo`);
    }
  }
});

test("linha marcada como não apurada por coletor ausente não vira 0", () => {
  const l = degrauDe(fichaAtma(), "lead→contatado");
  assert.equal(l.rotulo, "sem par apurado");
  assert.ok(!("apurado" in l) || l.apurado === undefined);
});

test("FR-012 (015) só valia até a 017: D perdeu o marco `aceito`, de propósito", () => {
  // O guard original dizia "PERFIS não foi tocado por esta feature — D segue com 6 marcos". A
  // 017 tocou de propósito: `aceito` não tinha NENHUMA fonte de escrita (`orcamentos.status` só
  // conheceu `enviado` em 5 semanas) e a cadeia canônica da Atma não tem esse degrau. O resto do
  // perfil D é o mesmo de antes — só o marco morto saiu.
  assert.equal(PERFIS.D.marcos.length, 5);
  assert.equal(PERFIS.D.marcos.at(-1).chave, "tratamento");
  assert.ok(!PERFIS.D.marcos.some((m) => m.chave === "aceito"));
});

test("celula ausente é tratada como não apurada, não como zero", () => {
  const l = leituraDoDegrau("D", { de: "a", para: "b", celula: naoApurado("coletor não rodou"), numerador: naoApurado("x"), denominador: apurado(10) }, "visitante→lead");
  assert.equal(l.rotulo, "sem par apurado");
  assert.match(l.motivo, /coletor não rodou/);
});
