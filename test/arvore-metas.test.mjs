import test from "node:test";
import assert from "node:assert/strict";
import { apurado, naoApurado } from "../lib/funil.mjs";
import { divisorDe, montarArvore, camadaDeEntrega, alavancaDePosicao } from "../lib/arvore-metas.mjs";
import { PERFIS } from "../lib/okr.mjs";

/** Marcos do perfil D com as células injetadas por chave — a cadeia real, os números do teste. */
const marcosD = (valores) =>
  PERFIS.D.marcos.map((m) => ({
    chave: m.chave,
    nome: m.nome,
    celula: valores[m.chave] === undefined ? naoApurado(`sem coletor — ${m.chave}`) : apurado(valores[m.chave]),
  }));

const arvore = (valores, n1Janela, extra = {}) =>
  montarArvore({
    ficha: { perfil: "D", marcos: extra.marcos ?? marcosD(valores) },
    projecao: { n1Janela: apurado(n1Janela) },
    ...extra,
  });

test("apurado consecutivo vence ponte e mercado", () => {
  const marcos = marcosD({ visitante: 1000, lead: 50 });
  const d = divisorDe(marcos, 1, "D", false);
  assert.equal(d.origem, "apurado");
  assert.equal(d.de, 0);
  assert.equal(d.lo, 0.05);
});

test("ponte atravessa o buraco e NOMEIA os degraus atravessados", () => {
  // O caso `atma`: lead 31 e orçamento 5 apurados, `contato feito` sem coletor no meio.
  const marcos = marcosD({ visitante: 532, lead: 31, orcamento: 5 });
  const d = divisorDe(marcos, 3, "D", false);
  assert.equal(d.origem, "ponte");
  assert.equal(d.de, 1);
  assert.deepEqual(d.atravessa, ["contato feito"]);
  assert.equal(d.lo.toFixed(4), (5 / 31).toFixed(4));
  assert.match(d.fonte, /contato feito/);
});

test("divisor apurado em 0 é recusado — nas três origens", () => {
  // `orcamento→tratamento` da `atma` é 0/5: apurado, e imprestável como divisor.
  const marcos = marcosD({ visitante: 532, lead: 31, orcamento: 5, tratamento: 0 });
  const d = divisorDe(marcos, 5, "D", false);
  assert.equal(d.origem, null, "0/5 não pode virar divisor");
  assert.ok(
    d.recusas.some((r) => /em 0 — não divide/.test(r)),
    `a recusa do zero precisa estar nomeada: ${JSON.stringify(d.recusas)}`
  );
});

test("faixa de mercado entra só quando apurado e ponte falham, e ABRE a banda", () => {
  const r = arvore({ visitante: 1000 }, 10, { marcos: marcosD({ visitante: 1000 }).slice(0, 2) });
  assert.equal(r.bandaAberta, true);
  const visitante = r.camadas.at(-1);
  assert.equal(visitante.divisor.origem, "mercado");
  // `visitante→lead` é 2–5%: dividir por 5% dá o piso, por 2% dá o teto.
  assert.equal(Math.round(visitante.necessario.min), 200);
  assert.equal(Math.round(visitante.necessario.max), 500);
});

test("TRAVA R6 — a segunda faixa de mercado PARA a árvore, nunca compõe", () => {
  const marcos = marcosD({ visitante: 1000 }).slice(0, 3); // visitante, lead(NA), contatado(NA)
  const r = arvore({}, 10, { marcos });
  assert.ok(r.parou, "a árvore tinha que parar");
  assert.equal(r.parou.chave, "lead");
  assert.match(r.parou.motivo, /segunda faixa de mercado/);
  // O que já foi montado continua visível (FR-016).
  assert.equal(r.camadas.length, 2);
});

test("banda degenerada antes da faixa: min === max em toda camada", () => {
  const r = arvore({ visitante: 1000, lead: 50, orcamento: 20, tratamento: 4 }, 8);
  assert.equal(r.bandaAberta, false);
  for (const c of r.camadas) assert.equal(c.necessario.min, c.necessario.max, `${c.chave} abriu banda sem faixa`);
});

test("o gap é IDÊNTICO em todas as camadas quando nenhuma taxa muda", () => {
  // 8 tratamentos exigidos com 4 apurados = 2×; e 2× tem que se propagar inteiro para cima.
  const r = arvore({ visitante: 1000, lead: 50, orcamento: 20, tratamento: 4 }, 8);
  const gaps = r.camadas.filter((c) => c.gap).map((c) => Number(c.gap.max.toFixed(6)));
  assert.equal(gaps.length, 4);
  assert.deepEqual([...new Set(gaps)], [2]);
});

test("a camada de impressões usa o CTR e fecha a descida", () => {
  const r = arvore({ visitante: 1000, lead: 50, orcamento: 20, tratamento: 4 }, 8, {
    ctr: { valor: 0.02, impressoes: apurado(50000) },
  });
  const imp = r.camadas.at(-1);
  assert.equal(imp.chave, "impressao");
  assert.equal(Math.round(imp.necessario.max), 100000); // 2000 cliques ÷ 2%
  assert.equal(imp.gap.max, 2);
});

test("sem meta declarada a árvore herda o motivo da 010 e não monta camada", () => {
  const r = montarArvore({
    ficha: { perfil: "D", marcos: marcosD({ visitante: 1000 }) },
    projecao: { n1Janela: naoApurado("sem ticket declarado"), motivo: "sem ticket declarado" },
  });
  assert.deepEqual(r.camadas, []);
  assert.equal(r.parou.motivo, "sem ticket declarado");
});

test("`atma` de hoje: a árvore para no primeiro degrau — a REGUA não cobre o span", () => {
  // Registro executável do D2 do plano. Quando a linha `orcamento→tratamento` entrar na REGUA,
  // este teste falha — e falhar é o sinal de que a decisão foi tomada, não um defeito.
  const r = arvore({ visitante: 532, lead: 31, orcamento: 5, tratamento: 0 }, 2.94);
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
