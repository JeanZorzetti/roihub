import test from "node:test";
import assert from "node:assert/strict";
import { citacoes, montarPromptResposta, responder, RECUSA, trechosPara } from "../lib/resposta.mjs";

const docs = [
  { tipo: "protocolo", titulo: "A", trecho: "texto a" },
  { tipo: "memoria", titulo: "B", trecho: "texto b" },
];

test("prompt numera os trechos a partir de 1, casando com a lista da aba", () => {
  const p = montarPromptResposta("por que", docs);
  assert.ok(p.includes("[1] (protocolo) A"));
  assert.ok(p.includes("[2] (memoria) B"));
  assert.ok(!p.includes("[0]"));
  assert.ok(p.includes("por que"));
  assert.ok(p.includes(RECUSA));
});

test("citacoes lê os índices na ordem, sem repetir", () => {
  assert.deepEqual(citacoes("Sim [2], porque X [1] e Y [2].", 2), [2, 1]);
  assert.deepEqual(citacoes("sem citação nenhuma", 2), []);
  assert.deepEqual(citacoes("", 2), []);
});

// O modelo cita [11] com 10 trechos: renderizar isso mostraria uma citação que não aponta para
// card nenhum — parece conferível e não é.
test("citacoes descarta índice fora da faixa", () => {
  assert.deepEqual(citacoes("[0] [3] [1]", 2), [1]);
});

test("resposta citada passa com as fontes", async () => {
  const r = await responder("q", docs, { run: async () => "É assim [1]. E também [2]." });
  assert.deepEqual(r.fontes, [1, 2]);
  assert.equal(r.erro, "");
  assert.ok(r.texto.includes("É assim"));
});

// Falha fechada: prosa fluente sem procedência tem a autoridade da resposta e nenhuma da fonte.
test("resposta sem citação é suprimida e vira aviso", async () => {
  const r = await responder("q", docs, { run: async () => "Com certeza é assim, pode confiar." });
  assert.equal(r.texto, "");
  assert.deepEqual(r.fontes, []);
  assert.equal(r.erro, "resposta-sem-citacao");
});

// Recusa é o componente funcionando: some da tela sem virar aviso de erro.
test("recusa devolve vazio sem erro, com ou sem acento", async () => {
  for (const t of [RECUSA, "nao esta no corpus", `${RECUSA}\n`]) {
    const r = await responder("q", docs, { run: async () => t });
    assert.deepEqual(r, { texto: "", fontes: [], erro: "" });
  }
});

// Procurar a frase em qualquer lugar do texto apagou 5 das 78 respostas do dourado: eram
// completas e citadas, e só abriam com a ressalva. Quem decide é a citação.
test("recusa PARCIAL com citação continua sendo resposta", async () => {
  const r = await responder("q", docs, {
    run: async () => `${RECUSA} quanto à data, mas sobre a prática a regra é X [2].`,
  });
  assert.deepEqual(r.fontes, [2]);
  assert.equal(r.erro, "");
  assert.ok(r.texto.startsWith(RECUSA));
});

// O código do erro é renomeado porque `rodarClaude` é compartilhado: "rerank-output" no rodapé
// da resposta mandaria a próxima sessão debugar o componente errado.
test("falha do CLI não lança: devolve vazio com o código do erro renomeado", async () => {
  const r = await responder("q", docs, {
    run: async () => {
      throw new Error("rerank-timeout");
    },
  });
  assert.deepEqual(r, { texto: "", fontes: [], erro: "resposta-timeout" });
});

test("sem pergunta ou sem docs não gasta chamada", async () => {
  const run = async () => assert.fail("não devia chamar o claude-cli");
  assert.deepEqual(await responder("  ", docs, { run }), { texto: "", fontes: [], erro: "" });
  assert.deepEqual(await responder("q", [], { run }), { texto: "", fontes: [], erro: "" });
});

// O orçamento da síntese é maior que o do reranker (2400 contra 900): responder por cima de um
// recorte que cortou a frase que sustentava a afirmação é o modo de falhar que importa aqui.
test("trechosPara recorta com folga e preserva tipo e título", () => {
  const [t] = trechosPara([{ tipo: "handoff", titulo: "H", texto: "x ".repeat(4000) + "agulha" }], ["agulha"]);
  assert.equal(t.tipo, "handoff");
  assert.equal(t.titulo, "H");
  assert.ok(t.trecho.length <= 2400 + 8, `trecho de ${t.trecho.length} chars`);
  assert.ok(t.trecho.includes("agulha"));
});
