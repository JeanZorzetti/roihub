import test from "node:test";
import assert from "node:assert/strict";
import { apurado, naoApurado, ehApurado } from "../lib/funil.mjs";
import { PERFIS, FAMILIAS, familiaDe, montarFicha, posicaoDeAtaque, resumirPortfolio, POSICOES } from "../lib/okr.mjs";

/** Atalho: a ficha de um projeto com o que os três coletores do hub devolveram. */
const ficha = (perfil, coletado) => montarFicha({ slug: "x", perfil, coletado });
const veredito = (perfil, coletado) => posicaoDeAtaque(ficha(perfil, coletado));

test("cada perfil tem a cadeia do template, não uma cadeia genérica", () => {
  assert.deepEqual(Object.keys(PERFIS).sort(), ["A", "B", "C", "D"]);
  // Perfil D tem 6 marcos porque no-show é etapa PRÓPRIA: agendar e não comparecer é um
  // vazamento inteiro que some quando as duas viram uma só.
  assert.equal(PERFIS.D.marcos.length, 6);
  assert.equal(PERFIS.A.marcos.length, 5);
  // Cadeia de SaaS não é cadeia de clínica.
  assert.notDeepEqual(
    PERFIS.A.marcos.map((m) => m.chave),
    PERFIS.D.marcos.map((m) => m.chave)
  );
});

test("degrau sem coletor é `não apurado` com a fonte a CONSULTAR — nunca 0", () => {
  const f = ficha("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });
  const contatado = f.marcos.find((m) => m.chave === "contatado");
  assert.equal(ehApurado(contatado.celula), false);
  // R4: a mensagem manda consultar a fonte que já existe, não escrever encanamento novo.
  assert.match(contatado.celula.naoApurado, /sem coletor — consultar histórico de status/);
});

test("projeto sem perfil NÃO cai em perfil padrão", () => {
  const f = ficha(null, { cliques: apurado(100) });
  assert.equal(f.perfil, null);
  assert.deepEqual(f.marcos, []);
  assert.equal(posicaoDeAtaque(f).posicao, 0);
  // Cadeia errada é pior que cadeia ausente: ela parece medida.
  const g = ficha("Z", { cliques: apurado(100) });
  assert.equal(g.perfil, null);
});

test("a cadeia da atma reproduz o único caso apurado do portfólio", () => {
  // 535 cliques → 39 leads, janela 01/08→29/08/2026. `7,29% (39/535)`.
  const f = ficha("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });
  const t = f.taxas[0];
  assert.equal(ehApurado(t.celula), true);
  assert.equal(t.celula.valor.toFixed(4), (39 / 535).toFixed(4));
  // O denominador de uma etapa é o numerador da anterior.
  assert.deepEqual(t.denominador, apurado(535));
});

test("§7.1 — fator ZERADO ganha de qualquer outra leitura", () => {
  const v = veredito("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });
  assert.equal(v.posicao, 1);
  assert.match(v.celula, /tratamento/);
  // Curto-circuito: existem buracos de D4 no meio da cadeia da atma, e mesmo assim a posição é 1.
  assert.match(v.motivo, /multiplicação/);
});

test("§7.1 — com entrada zerada, o TOPO ganha: consertar o degrau de baixo não move nada", () => {
  const v = veredito("D", { cliques: apurado(0), leads: apurado(0), vendas: apurado(0) });
  assert.equal(v.posicao, 1);
  assert.match(v.celula, /visitante/);
});

test("§7 — zero na ENTRADA e zero no FIM são doenças opostas e mandam trabalho oposto", () => {
  const entrada = veredito("A", { cliques: apurado(0), leads: apurado(5), vendas: apurado(2) });
  const fim = veredito("D", { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) });

  assert.equal(entrada.posicao, 1);
  assert.equal(fim.posicao, 1);
  // Volume nenhum NÃO se conserta com landing melhor: o texto tem que mandar para descoberta.
  assert.match(entrada.rotulo, /ENTRADA/);
  assert.match(entrada.motivo, /DEMANDA/);
  assert.doesNotMatch(entrada.motivo, /nada em performance, indexação ou copy/);
  // Taxa nenhuma NÃO se conserta com mais tráfego: aí sim o resto é desperdício.
  assert.match(fim.motivo, /nada em performance, indexação ou copy/);
  assert.notEqual(entrada.rotulo, fim.rotulo);
});

test("§7.2 — sem zero, o buraco de encanamento (D4) vem antes de qualquer outro", () => {
  // Cliques sem propriedade no GSC é D1; o lead que nunca chegou é D4. D4 ganha.
  const v = veredito("D", {
    cliques: naoApurado("sem propriedade no GSC para x.vercel.app"),
    leads: naoApurado("pipeline existe e nunca recebeu lead"),
    vendas: apurado(2),
  });
  assert.equal(v.posicao, 2);
  assert.match(v.rotulo, /D4/);
  assert.match(v.celula, /lead/);
});

test("§7.3 — cadeia fechada aponta a MENOR taxa, não a primeira", () => {
  // Perfil A com todos os degraus apurados à mão: 1000 → 500 (50%) → 400 (80%) → 40 (10%) → 20 (50%).
  const f = montarFicha({ slug: "x", perfil: "A", coletado: {} });
  f.marcos.forEach((m, i) => (m.celula = apurado([1000, 500, 400, 40, 20][i])));
  f.taxas = f.marcos.slice(1).map((m, i) => ({
    de: f.marcos[i].nome,
    para: m.nome,
    numerador: m.celula,
    denominador: f.marcos[i].celula,
    celula: apurado(m.celula.valor / f.marcos[i].celula.valor),
  }));
  const v = posicaoDeAtaque(f);
  assert.equal(v.posicao, 3);
  // 10% (ativado → trial) é a menor; 50% é a primeira. É multiplicação: dobrar 10% rende mais.
  assert.match(v.celula, /trial/);
});

test("R3 continua valendo através da árvore — nada de taxa acima de 100%", () => {
  // Lead vindo de outro canal entra no numerador sem entrar no denominador.
  const f = ficha("D", { cliques: apurado(30), leads: apurado(45), vendas: apurado(1) });
  assert.equal(ehApurado(f.taxas[0].celula), false);
  assert.match(f.taxas[0].celula.naoApurado, /pontas não casam/);
});

test("a família do BURACO sobrepõe a do degrau", () => {
  const marco = PERFIS.D.marcos[0]; // visitante, família padrão D1
  assert.equal(familiaDe(marco, apurado(10)), null);
  assert.equal(familiaDe(marco, naoApurado("sem propriedade no GSC para x")), "D1");
  // Mesmo degrau, motivo de encanamento: vira D4. Sem isso a atribuição seria decorativa.
  assert.equal(familiaDe(marco, naoApurado("DATABASE_URL ausente")), "D4");
  assert.ok(Object.keys(FAMILIAS).every((k) => typeof FAMILIAS[k] === "string"));
});

test("todos os leads de teste nossos não viram taxa", () => {
  // O `não apurado` vem do coletor (lib/funil.mjs já filtra por `ehLeadDeTeste`); a árvore só não
  // pode transformá-lo em 0. Foi assim que `polarisia 6,67% (2/30)` — dois testes do Jean —
  // virou a única taxa do portfólio.
  const v = veredito("D", {
    cliques: apurado(30),
    leads: naoApurado("2 lead(s), TODOS de teste nosso — nenhum lead real jamais recebido"),
    vendas: apurado(1),
  });
  assert.equal(v.posicao, 2);
  assert.match(v.motivo, /teste nosso/);
});

test("a soma do resumo bate com o total, faixa `sem perfil` incluída", () => {
  const vereditos = [{ posicao: 1 }, { posicao: 2 }, { posicao: 2 }, { posicao: 0 }, { posicao: 3 }];
  const r = resumirPortfolio(vereditos);
  assert.equal(r.total, 5);
  assert.equal(r.porPosicao.reduce((a, b) => a + b, 0), 5);
  assert.equal(r.porPosicao.length, POSICOES.length);
});
