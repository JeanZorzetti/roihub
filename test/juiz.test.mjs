import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  julgarConcordancia,
  julgarFidelidade,
  montarPromptFidelidade,
  montarPromptJuiz,
  parseFidelidade,
  parseVeredito,
} from "../lib/juiz.mjs";

const ler = (n) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${n}`, import.meta.url)), "utf8"));
const dourado = { resposta: "Não. Inspecionar as 26 URLs antes.", armadilha: "Tratar errors: 1 como bloqueio." };
const ok = "VEREDITO: contradiz\nARMADILHA: caiu\nMOTIVO: inverteu a conclusão.";

test("prompt do juiz mostra o dourado E a armadilha", () => {
  const p = montarPromptJuiz("resubmeto?", "Sim, resubmeta [1].", dourado);
  assert.ok(p.includes("resubmeto?"));
  assert.ok(p.includes("Sim, resubmeta [1]."));
  assert.ok(p.includes(dourado.resposta));
  assert.ok(p.includes(dourado.armadilha));
});

// A passada A é cega de propósito: ver o dourado a faria medir concordância de novo, e ver a
// lista de fontes esperada a faria medir recuperação, que já tem régua determinística e grátis.
test("prompt de fidelidade não vaza o dourado nem a lista de fontes esperada", () => {
  const p = montarPromptFidelidade("resubmeto?", "Não [3].", [
    { n: 3, tipo: "protocolo", titulo: "SEO-04", trecho: "inspecione antes" },
  ]);
  assert.ok(!p.includes(dourado.resposta));
  assert.ok(!p.includes("VER-06"));
  assert.ok(p.includes("[3] (protocolo) SEO-04"));
});

// Renumerar os trechos quebraria o casamento com as marcas [n] do texto julgado, e o juiz passaria
// a conferir a citação contra o documento errado.
test("fidelidade preserva a numeração original e só mostra o que foi citado", () => {
  const p = montarPromptFidelidade("q", "a [2] e b [7].", [
    { n: 2, tipo: "memoria", titulo: "M2", trecho: "trecho dois" },
    { n: 7, tipo: "handoff", titulo: "H7", trecho: "trecho sete" },
  ]);
  assert.ok(p.includes("[2] (memoria) M2"));
  assert.ok(p.includes("[7] (handoff) H7"));
  assert.ok(!p.includes("[1]"));
});

test("parseVeredito lê as três linhas", () => {
  assert.deepEqual(parseVeredito(ok), { veredito: "contradiz", armadilha: "caiu", motivo: "inverteu a conclusão." });
});

test("parseVeredito aceita caixa e prosa em volta", () => {
  const t = "Analisando:\n\nveredito: Incompleta\n  Armadilha : Evitou\nMOTIVO: falta o passo que decide\n";
  assert.deepEqual(parseVeredito(t), { veredito: "incompleta", armadilha: "evitou", motivo: "falta o passo que decide" });
});

// Falha FECHADA: um parse que devolvesse "correta" no default transformaria juiz quebrado em nota
// alta, que é o pior resultado possível de uma régua.
test("parseVeredito devolve vazio no que não casa com o vocabulário", () => {
  for (const t of ["", "achei boa", "VEREDITO: ótima\nARMADILHA: talvez", "VEREDITO: recusou\nARMADILHA: evitou"]) {
    assert.equal(parseVeredito(t).veredito, "", `parseou "${t}"`);
  }
});

test("parseFidelidade entende sim/não e falha fechada", () => {
  assert.equal(parseFidelidade("FIEL: sim\nMOTIVO: ok").fiel, true);
  assert.equal(parseFidelidade("FIEL: nao\nMOTIVO: x").fiel, false);
  assert.equal(parseFidelidade("FIEL: não\nMOTIVO: x").fiel, false);
  assert.equal(parseFidelidade("FIEL: mais ou menos").fiel, null);
  assert.equal(parseFidelidade("sem nada").fiel, null);
});

test("veredito só com um dos dois eixos vira erro, não meio-veredito", async () => {
  const r = await julgarConcordancia("q", "resposta", dourado, { run: async () => "VEREDITO: correta" });
  assert.equal(r.erro, "juiz-output");
});

// Recusa não é erro: em D-66 o corpus guardava quatro contagens defasadas do mesmo número e
// recusar era o certo. Contar isso como falha puniria o sistema por acertar — e julgar com LLM
// gastaria uma chamada para redescobrir o que o contrato de `responder()` já diz.
test("recusa é curto-circuito e não gasta chamada", async () => {
  const run = async () => assert.fail("não devia chamar o claude-cli");
  assert.deepEqual(await julgarConcordancia("q", "", dourado, { run }), {
    veredito: "recusou",
    armadilha: "",
    motivo: "",
    erro: "",
  });
  assert.deepEqual(await julgarFidelidade("q", "", [], { run }), { fiel: null, motivo: "", erro: "" });
});

// As três causas de texto vazio em `responder()` são distintas e têm que continuar distintas: só
// a primeira é o sistema funcionando. Quem chama o juiz com uma resposta suprimida transforma
// componente quebrado em acerto — por isso o curto-circuito só vale para recusa de verdade.
test("recusa e resposta suprimida não podem virar o mesmo veredito", async () => {
  const recusa = await julgarConcordancia("q", "", dourado, { run: async () => assert.fail("sem chamada") });
  assert.equal(recusa.veredito, "recusou");
  assert.equal(recusa.erro, "");
});

test("sem citação não há fidelidade a auditar e não gasta chamada", async () => {
  const run = async () => assert.fail("não devia chamar o claude-cli");
  assert.equal((await julgarFidelidade("q", "texto sem citação", [], { run })).fiel, null);
});

// `rodarClaude` é compartilhado com o reranker: "rerank-timeout" no relatório do juiz mandaria a
// próxima sessão debugar o componente errado.
test("erro do CLI não lança e sai com o código renomeado", async () => {
  const run = async () => {
    throw new Error("rerank-timeout");
  };
  assert.equal((await julgarConcordancia("q", "r", dourado, { run })).erro, "juiz-timeout");
  assert.equal((await julgarFidelidade("q", "r", [{ n: 1, tipo: "t", titulo: "T", trecho: "x" }], { run })).erro, "juiz-timeout");
});

// Os dois arquivos de dados são a fundação da medição: um id trocado passaria despercebido na
// corrida (o caso simplesmente não seria medido) e o portão sairia com denominador errado.
test("calibração e adversarial apontam para perguntas que existem no dourado", () => {
  const ids = new Set(ler("dourado.json").map((q) => q.id));
  const calib = ler("juiz-calibracao.json");
  const adver = ler("juiz-adversarial.json");
  assert.equal(calib.rotulos.length, 20);
  assert.equal(calib.holdout.length, 8);
  assert.equal(adver.casos.length, 10);
  for (const r of [...calib.rotulos, ...calib.holdout]) {
    assert.ok(ids.has(r.id), `${r.id} não existe no dourado`);
    assert.ok(["correta", "incompleta", "contradiz", "recusou"].includes(r.veredito), `${r.id}: ${r.veredito}`);
    assert.ok(["evitou", "caiu"].includes(r.armadilha), `${r.id}: ${r.armadilha}`);
    assert.ok(r.resposta_gerada && r.motivo, `${r.id} sem resposta congelada ou sem motivo`);
  }
  for (const c of adver.casos) {
    assert.ok(ids.has(c.id), `${c.id} não existe no dourado`);
    assert.ok(c.resposta_corrompida.includes("["), `${c.id} perdeu a citação na corrupção`);
  }
});

// Os dois juízes degenerados: o que aprova tudo e o que reprova tudo. Cada conjunto pega um, e
// esta asserção existe porque a garantia se perde em silêncio — basta alguém rotular mais alguns
// casos `correta` e o portão de 85% passa a ser alcançável sem julgar nada.
test("os conjuntos pegam juiz degenerado nas duas direções", () => {
  const { rotulos, holdout } = ler("juiz-calibracao.json");
  const boas = (arr) => arr.filter((r) => r.veredito === "correta").length;
  assert.ok(boas(rotulos) / rotulos.length < 0.85, "juiz que responde sempre `correta` alcançaria os 85%");
  assert.ok(boas(holdout) / holdout.length >= 0.75, "holdout sem respostas boas o bastante para pegar juiz que reprova tudo");
  for (const camada of ["protocolo", "estado", "episodio"]) {
    assert.ok(rotulos.some((r) => r.camada === camada), `sem nenhum caso de ${camada}`);
  }
});

// Rótulo revisado depois de ler o juiz é contaminado por construção. Ele continua útil como
// regressão, mas some do número limpo — e some em silêncio se ninguém guardar o original.
test("todo rótulo revisado guarda o veredito original e o motivo da revisão", () => {
  for (const r of ler("juiz-calibracao.json").rotulos) {
    if (r.veredito_original) assert.ok(r.revisao?.length > 40, `${r.id} revisado sem justificativa`);
  }
  for (const r of ler("juiz-calibracao.json").holdout) {
    assert.ok(!r.veredito_original, `${r.id} do holdout foi revisado — ele deixa de ser cego`);
  }
});
