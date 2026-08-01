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

// O bug que reprovou os dois portões em 01/08 e que NENHUMA redação de regra consertaria: o
// formato obrigava o modelo a cravar o veredito antes de escrever o raciocínio. Três vezes saiu
// `VEREDITO: bate` com um `MOTIVO` que terminava em "— desmente". Se alguém reordenar o prompt
// "para ficar igual ao do juiz", este teste é o que explica por que não.
test("o VEREDITO é a ÚLTIMA linha pedida, depois do trecho e do motivo", () => {
  const p = montarPromptDefasagem("quantos projetos?", apurado, doc);
  assert.ok(p.lastIndexOf("TRECHO:") < p.lastIndexOf("MOTIVO:"), "o trecho vem antes do motivo");
  assert.ok(p.lastIndexOf("MOTIVO:") < p.lastIndexOf("VEREDITO:"), "o veredito é derivado, então vem por último");
  assert.ok(p.trimEnd().endsWith("bate|desmente|nao-fala"), "nada depois do veredito");
});

// `desmente` é o único veredito que vira TAREFA. Sem citação ele é uma acusação sem prova, e uma
// lista nominal cheia dessas não é lida duas vezes — o mesmo motivo do `resposta-sem-citacao`.
test("desmente sem trecho é incoerente, não é achado", () => {
  for (const t of ["TRECHO: -\nMOTIVO: x\nVEREDITO: desmente", "MOTIVO: x\nVEREDITO: desmente"]) {
    assert.equal(parseDefasagem(t, "o hub tem 39 projetos").erro, "defasagem-incoerente");
  }
  // `bate` e `nao-fala` sem trecho continuam válidos: não afirmam achado nenhum.
  assert.equal(parseDefasagem("TRECHO: -\nMOTIVO: x\nVEREDITO: nao-fala", "qualquer coisa").erro, "");
});

test("trecho que não está no documento é alucinação de citação, com código próprio", () => {
  const doc39 = "o hub tem 39 projetos hoje";
  assert.equal(parseDefasagem("TRECHO: o hub tem 41 projetos\nMOTIVO: x\nVEREDITO: desmente", doc39).erro, "defasagem-citacao");
  // Quebra de linha do recorte e caixa não são alucinação: reprovar por isso seria trocar
  // fabricação de citação por diagramação.
  assert.equal(parseDefasagem("TRECHO: O Hub  tem 39\nMOTIVO: x\nVEREDITO: desmente", "o hub\ntem 39 projetos").erro, "");
  // Markdown largado na citação foi a causa das 8 reprovações da primeira corrida invertida, e
  // nenhuma delas era fabricada. O corpus é markdown; o modelo cita o texto que lê.
  const md = "- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).";
  assert.equal(parseDefasagem(`TRECHO: 19/10 — gate do tapepro: ≥ 300 imp/28d (hoje 21).\nMOTIVO: x\nVEREDITO: desmente`, md).erro, "");
  // …e o número trocado continua caindo, que é a única coisa que este check precisa pegar.
  assert.equal(parseDefasagem(`TRECHO: 19/10 — gate do tapepro: ≥ 300 imp/28d (hoje 42).\nMOTIVO: x\nVEREDITO: desmente`, md).erro, "defasagem-citacao");
  // O caso REAL de citação inválida que a corrida achou: o modelo escreveu o veredito no campo
  // do trecho. Sem este check ele teria entrado na conta como um `nao-fala` normal.
  assert.equal(parseDefasagem("TRECHO: nao-fala\nMOTIVO: x\nVEREDITO: nao-fala", md).erro, "defasagem-citacao");
  // Elipse é elisão legítima do meio da frase — cada pedaço tem que estar lá.
  assert.equal(parseDefasagem("TRECHO: o hub … 39 projetos\nMOTIVO: x\nVEREDITO: desmente", doc39).erro, "");
  assert.equal(parseDefasagem("TRECHO: o hub … 41 projetos\nMOTIVO: x\nVEREDITO: desmente", doc39).erro, "defasagem-citacao");
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
