import test from "node:test";
import assert from "node:assert/strict";
import { apurado, naoApurado } from "../lib/funil.mjs";
import { divisorDe, montarArvore, camadaDeEntrega, alavancaDePosicao } from "../lib/arvore-metas.mjs";
import { PERFIS } from "../lib/okr.mjs";

/** Marcos do perfil D com as células injetadas por chave — a cadeia real (018: lead → respondeu →
 *  orcamento → tratamento), os números do teste. */
const marcosD = (valores) =>
  PERFIS.D.marcos.map((m) => ({
    chave: m.chave,
    nome: m.nome,
    celula: valores[m.chave] === undefined ? naoApurado(`sem coletor — ${m.chave}`) : apurado(valores[m.chave]),
  }));

const arvore = (valores, n1Janela, extra = {}) =>
  montarArvore({
    ficha: { perfil: extra.perfil ?? "D", marcos: extra.marcos ?? marcosD(valores) },
    projecao: { n1Janela: apurado(n1Janela) },
    ...extra,
  });

test("apurado consecutivo vence ponte e mercado", () => {
  const marcos = marcosD({ lead: 1000, respondeu: 50 });
  const d = divisorDe(marcos, 1, "D", false);
  assert.equal(d.origem, "apurado");
  assert.equal(d.de, 0);
  assert.equal(d.lo, 0.05);
});

test("ponte atravessa o buraco e NOMEIA os degraus atravessados", () => {
  // 018: lead 532 e orçamento 5 apurados, `respondeu` sem coletor no meio.
  const marcos = marcosD({ lead: 532, orcamento: 5 });
  const d = divisorDe(marcos, 2, "D", false);
  assert.equal(d.origem, "ponte");
  assert.equal(d.de, 0);
  assert.deepEqual(d.atravessa, ["respondeu"]);
  assert.equal(d.lo.toFixed(4), (5 / 532).toFixed(4));
  assert.match(d.fonte, /respondeu/);
});

test("divisor apurado em 0 é recusado — nas três origens", () => {
  // `orcamento→tratamento` é 0/5: apurado, e imprestável como divisor. Índice 3: lead(0),
  // respondeu(1), orcamento(2), tratamento(3) — a cadeia D de 4 marcos pós-018.
  const marcos = marcosD({ lead: 532, orcamento: 5, tratamento: 0 });
  const d = divisorDe(marcos, 3, "D", false);
  assert.equal(d.origem, null, "0/5 não pode virar divisor");
  assert.ok(
    d.recusas.some((r) => /em 0 — não divide/.test(r)),
    `a recusa do zero precisa estar nomeada: ${JSON.stringify(d.recusas)}`
  );
});

// As duas travas de mercado abaixo (faixa entra, segunda faixa para) usam o perfil B, não D: a
// 018 esvaziou REGUA.D (`visitante→lead` e `lead→contatado` saíram — nenhum marco novo da cadeia
// D tem benchmark publicado). REGUA.B tem duas linhas ADJACENTES (`produto→carrinho`,
// `carrinho→checkout`) — é isso, não o perfil, que a trava nº 1 do benchmark.mjs precisa exercitar.

test("faixa de mercado entra só quando apurado e ponte falham, e ABRE a banda", () => {
  const marcos = [
    { chave: "produto", nome: "produto", celula: apurado(1000) },
    { chave: "carrinho", nome: "carrinho", celula: naoApurado("sem coletor — carrinho") },
  ];
  const r = arvore(null, 10, { marcos, perfil: "B" });
  assert.equal(r.bandaAberta, true);
  const produto = r.camadas.at(-1);
  assert.equal(produto.divisor.origem, "mercado");
  // `produto→carrinho` é 6–7,5%: dividir por 7,5% dá o piso, por 6% dá o teto.
  assert.equal(Math.round(produto.necessario.min), 133);
  assert.equal(Math.round(produto.necessario.max), 167);
});

test("TRAVA R6 — a segunda faixa de mercado PARA a árvore, nunca compõe", () => {
  const marcos = [
    { chave: "produto", nome: "produto", celula: apurado(1000) },
    { chave: "carrinho", nome: "carrinho", celula: naoApurado("sem coletor — carrinho") },
    { chave: "checkout", nome: "checkout", celula: naoApurado("sem coletor — checkout") },
  ];
  const r = arvore(null, 10, { marcos, perfil: "B" });
  assert.ok(r.parou, "a árvore tinha que parar");
  assert.equal(r.parou.chave, "carrinho");
  assert.match(r.parou.motivo, /segunda faixa de mercado/);
  // O que já foi montado continua visível (FR-016).
  assert.equal(r.camadas.length, 2);
});

test("banda degenerada antes da faixa: min === max em toda camada", () => {
  const r = arvore({ lead: 1000, respondeu: 50, orcamento: 20, tratamento: 4 }, 8);
  assert.equal(r.bandaAberta, false);
  for (const c of r.camadas) assert.equal(c.necessario.min, c.necessario.max, `${c.chave} abriu banda sem faixa`);
});

test("o gap é IDÊNTICO em todas as camadas quando nenhuma taxa muda", () => {
  // 8 tratamentos exigidos com 4 apurados = 2×; e 2× tem que se propagar inteiro para cima.
  const r = arvore({ lead: 1000, respondeu: 50, orcamento: 20, tratamento: 4 }, 8);
  const gaps = r.camadas.filter((c) => c.gap).map((c) => Number(c.gap.max.toFixed(6)));
  assert.equal(gaps.length, 4);
  assert.deepEqual([...new Set(gaps)], [2]);
});

test("a camada de impressões só existe quando a cadeia começa em `visitante` (018/FR-007) — perfil D não tem mais", () => {
  const r = arvore({ lead: 1000, respondeu: 50, orcamento: 20, tratamento: 4 }, 8, {
    ctr: { valor: 0.02, impressoes: apurado(50000) },
  });
  assert.ok(!r.camadas.some((c) => c.chave === "impressao"), "cadeia D não começa em `visitante` desde a 018 — sem camada de impressões");
});

test("a camada de impressões usa o CTR e fecha a descida (perfil B, que ainda começa em `visitante`)", () => {
  const marcos = [
    { chave: "visitante", nome: "visitante", celula: apurado(1000) },
    { chave: "produto", nome: "produto", celula: apurado(50) },
    { chave: "carrinho", nome: "carrinho", celula: apurado(20) },
    { chave: "checkout", nome: "checkout", celula: apurado(4) },
  ];
  const r = arvore(null, 8, { marcos, perfil: "B", ctr: { valor: 0.02, impressoes: apurado(50000) } });
  const imp = r.camadas.at(-1);
  assert.equal(imp.chave, "impressao");
  assert.equal(Math.round(imp.necessario.max), 100000); // 2000 cliques ÷ 2%
  assert.equal(imp.gap.max, 2);
});

test("sem meta declarada a árvore herda o motivo da 010 e não monta camada", () => {
  const r = montarArvore({
    ficha: { perfil: "D", marcos: marcosD({ lead: 1000 }) },
    projecao: { n1Janela: naoApurado("sem ticket declarado"), motivo: "sem ticket declarado" },
  });
  assert.deepEqual(r.camadas, []);
  assert.equal(r.parou.motivo, "sem ticket declarado");
});

test("`atma` de hoje: a árvore para no primeiro degrau — a REGUA não cobre o span", () => {
  // Registro executável do D2 do plano. Quando a linha `orcamento→tratamento` entrar na REGUA,
  // este teste falha — e falhar é o sinal de que a decisão foi tomada, não um defeito.
  const r = arvore({ lead: 31, orcamento: 5, tratamento: 0 }, 2.94);
  assert.equal(r.parou.chave, "tratamento");
  assert.equal(r.camadas.length, 1);
});

test("camada de entrega recusa amostra de menos de 3 páginas", () => {
  const r = camadaDeEntrega({ min: 50000, max: 80000 }, [{ impressoes: 900 }, { impressoes: 100 }], 33671, 119);
  assert.match(r.celula.naoApurado, /amostra mínima é 3/);
});

test("camada de entrega: páginas necessárias e ritmo semanal", () => {
  const paginas = [{ impressoes: 300 }, { impressoes: 200 }, { impressoes: 100 }]; // média 200
  const r = camadaDeEntrega({ min: 50000, max: 80000 }, paginas, 30000, 70);
  assert.equal(r.amostra, 3);
  assert.equal(r.mediaPorPagina, 200);
  assert.equal(r.paginasNecessarias.min, 100); // (50000-30000)/200
  assert.equal(r.paginasNecessarias.max, 250); // (80000-30000)/200
  assert.equal(r.porSemana.max, 25); // 250 ÷ 10 semanas
});

test("alavanca de posição é leitura paralela, e devolve o CTR alvo", () => {
  assert.equal(alavancaDePosicao({ min: 500, max: 1000 }, 50000).valor, 0.02);
  assert.ok(alavancaDePosicao(null, 50000).naoApurado);
});

// ── T011/US1-AC5/FR-007 — a camada de impressões só existe quando a cadeia TEM `visitante` ──────

test("T011 — cadeia que NÃO começa em `visitante` (perfil D novo, sem `visitante`) NÃO ganha camada de impressões, mesmo com ctr apurado", () => {
  const marcos = [
    { chave: "lead", nome: "lead", celula: apurado(51) },
    { chave: "respondeu", nome: "respondeu", celula: apurado(21) },
  ];
  const r = montarArvore({
    ficha: { perfil: "D", marcos },
    projecao: { n1Janela: apurado(10) },
    ctr: { valor: 0.02, impressoes: apurado(50000) },
  });
  assert.ok(!r.camadas.some((c) => c.chave === "impressao"), "cadeia sem `visitante` cruzaria Descoberta com Conversão");
});

test("T011 — cadeia que COMEÇA em `visitante` continua ganhando a camada de impressões (comportamento de hoje)", () => {
  const marcos = [
    { chave: "visitante", nome: "visitante", celula: apurado(1000) },
    { chave: "lead", nome: "lead", celula: apurado(50) },
  ];
  const r = montarArvore({
    ficha: { perfil: "D", marcos },
    projecao: { n1Janela: apurado(8) },
    ctr: { valor: 0.02, impressoes: apurado(50000) },
  });
  assert.ok(r.camadas.some((c) => c.chave === "impressao"), "cadeia com `visitante` não pode perder a camada de hoje");
});
