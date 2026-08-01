import test from "node:test";
import assert from "node:assert/strict";
import { afirmacoesDePresente } from "../lib/validade.mjs";
import { vivosDoRepo } from "../lib/validade-vivos.mjs";

const trechos = (t) => afirmacoesDePresente(t).map((v) => v.trecho);

// O achado que originou a norma: `PRT-03` dizia "(hoje 21)" e a fonte viva devolvia 42. A data
// que está na linha é o PRAZO do gate, não a data do número — absolver por ela mataria o check no
// único caso para o qual ele existe.
test("data de prazo na linha não absolve o número de hoje", () => {
  const t = "tapepro com >=300 impressoes/28d ate 19/10/2026 (hoje 21)";
  assert.deepEqual(trechos(t), ["(hoje 21)"]);
});

test("data ou apuração colada no número absolve", () => {
  assert.deepEqual(trechos("são 36 repos ativos (hoje 36, medido em 30/07)"), []);
  assert.deepEqual(trechos("(hoje 35, apurado por dourado-estado.mjs)"), []);
  // Sem dígito não há placar que apodreça: isso é regra, não número.
  assert.deepEqual(trechos("(hoje o deploy é Docker no EasyPanel)"), []);
});

test("pega as duas formas e ignora o passado explicitamente datado", () => {
  assert.deepEqual(trechos("hoje são 35 projetos no hub."), ["hoje são 35 projetos no hub"]);
  assert.deepEqual(trechos("Em 30/07 eram 36 repos ativos, 34 com site."), []);
});

// O segundo padrão para na pontuação: sem isso ele engole o parágrafo e uma data três frases
// adiante absolveria a afirmação — que é como um check vira enfeite sem ninguém perceber.
test("a forma sem parênteses não atravessa a frase", () => {
  const [t] = trechos("hoje são 0 cliques. Medido em 28/07 pelo /insights.");
  assert.equal(t, "hoje são 0 cliques");
});

// Um check que reprova o documento que ENSINA a norma não sobrevive a duas semanas: a memória do
// corpus quebrou o check 20 minutos depois de ele passar limpo, citando "`(hoje 21)`" como exemplo.
test("citação entre crases é literal, não afirmação", () => {
  assert.deepEqual(trechos("na linha, `até 19/10/2026 (hoje 21)` seria absolvido"), []);
  assert.deepEqual(trechos("na linha, até 19/10/2026 (hoje 21) seria absolvido"), ["(hoje 21)"]);
});

// Bloco cercado é a mesma classe da crase, e faltava: saída de script colada em ``` é eco de
// terminal, não afirmação de quem escreveu. A linha do achado seguinte não pode andar por causa
// da máscara — é ela que manda alguém abrir o arquivo no lugar certo.
test("bloco cercado é literal, e mascará-lo não desloca as linhas", () => {
  assert.deepEqual(trechos("saída:\n```\nhoje são 35 projetos\n```\n"), []);
  const achados = afirmacoesDePresente("```\nhoje são 35 projetos\n```\ngate X (hoje 21)");
  assert.deepEqual(achados.map((a) => [a.linha, a.trecho]), [[4, "(hoje 21)"]]);
});

test("reporta a linha, não só o arquivo", () => {
  const achados = afirmacoesDePresente("linha um\nlinha dois\ngate X (hoje 21)");
  assert.equal(achados.length, 1);
  assert.equal(achados[0].linha, 3);
  assert.equal(achados[0].padrao, "(hoje N)");
});

// Este é o check de verdade rodando, não uma fixture: protocolos e cards são documentos vivos e
// estão no repo. Sem esta linha o `npm test` cobriria a regex e deixaria o corpus livre — que é a
// diferença entre norma que roda e norma que está escrita.
test("os documentos vivos do repo não afirmam presente com número", () => {
  const achados = vivosDoRepo().flatMap((a) =>
    afirmacoesDePresente(a.texto).map((v) => `${a.rel}:${v.linha}  ${v.trecho}`),
  );
  assert.deepEqual(achados, [], "apure o número ou date-o — ver scripts/validade.mjs");
});
