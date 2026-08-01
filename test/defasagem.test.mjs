import test from "node:test";
import assert from "node:assert/strict";
import { montarPromptDefasagem, parseDefasagem } from "../lib/defasagem.mjs";
import { montarPromptJuiz, parseVeredito } from "../lib/juiz.mjs";

const apurado = { resposta: "35 projetos", fonte: "API do GitHub", apurado_em: "2026-07-31" };
const doc = { tipo: "handoff", titulo: "H", trecho: "o hub tem 39 projetos" };

test("o prompt leva o fato apurado, a fonte e a data — não só o número", () => {
  const p = montarPromptDefasagem("quantos projetos?", apurado, doc);
  assert.ok(p.includes("35 projetos"));
  assert.ok(p.includes("API do GitHub"));
  assert.ok(p.includes("2026-07-31"), "sem a data da apuração, 'documento datado do passado' não tem contra o que ser julgado");
  assert.ok(p.includes(doc.trecho));
});

// O falso positivo do handoff-deep-research-harness: o fato dizia "Hoje: 2 — piso: query
// anonimizada…" e o documento dizia "hoje 2". O modelo leu a ressalva como parte da afirmação e
// devolveu `desmente` sobre acordo perfeito. Separada, ela é rotulada como medição, não como fato.
test("a ressalva sai do fato e entra rotulada como limitação da medição", () => {
  const comRessalva = { ...apurado, resposta: "Hoje: 2 cliques", ressalva: "é PISO: query anonimizada não entra." };
  const p = montarPromptDefasagem("qual o gate?", comRessalva, doc);
  const BLOCO = "LIMITAÇÃO DA MEDIÇÃO (como o fato foi medido";
  const fato = p.slice(p.indexOf("FATO APURADO"), p.indexOf(BLOCO));
  assert.ok(!fato.includes("PISO"), "a ressalva não pode voltar para dentro do bloco do fato");
  assert.ok(p.includes("é PISO: query anonimizada não entra."));
  // Sem ressalva o prompt não ganha um bloco vazio — cabeçalho sem conteúdo é ruído que o modelo
  // preenche sozinho. (A regra que cita a limitação continua lá; é o BLOCO que não nasce.)
  assert.ok(!montarPromptDefasagem("q", apurado, doc).includes(BLOCO));
});

test("parseDefasagem lê os três campos e preserva o trecho literal", () => {
  const v = parseDefasagem("VEREDITO: desmente\nTRECHO: O hub tem 39 Projetos\nMOTIVO: 39 contra 35 apurados");
  assert.equal(v.veredito, "desmente");
  // Minúscula no trecho tiraria dele a única serventia: ser procurável no arquivo de origem.
  assert.equal(v.trecho, "O hub tem 39 Projetos");
  assert.equal(v.erro, "");
});

// Falha FECHADA: veredito fora do vocabulário vira erro, nunca `nao-fala`. Tolerância aqui
// esconderia documento defasado atrás de "o modelo não respondeu direito" — e o número que este
// script existe para produzir é exatamente a contagem dos defasados.
test("veredito fora do vocabulário é erro, nunca nao-fala", () => {
  for (const t of ["VEREDITO: talvez", "sem formato nenhum", "", "MOTIVO: só isso"]) {
    const v = parseDefasagem(t);
    assert.equal(v.veredito, "");
    assert.equal(v.erro, "defasagem-output");
  }
});

// `campo` virou compartilhado com o juiz; o default tem que continuar em minúscula, senão
// "Correta" deixaria de casar com o vocabulário e a régua do juiz mudaria de valor em silêncio.
test("o parse do juiz continua caso-insensível depois de compartilhar o campo", () => {
  const v = parseVeredito("VEREDITO: Correta\nARMADILHA: Evitou\nMOTIVO: X");
  assert.equal(v.veredito, "correta");
  assert.equal(v.armadilha, "evitou");
  assert.ok(montarPromptJuiz("q", "g", { resposta: "r", armadilha: "a" }).includes("VEREDITO"));
});
