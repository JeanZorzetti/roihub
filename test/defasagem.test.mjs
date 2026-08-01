import test from "node:test";
import assert from "node:assert/strict";
import { montarPromptDefasagem, parseDefasagem, docsQueCitam } from "../lib/defasagem.mjs";
import { CITACOES_D66, CITACOES } from "../lib/dourado-estado.mjs";
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

// ── a 2ª via de seleção ─────────────────────────────────────────────────────────────────────
const docTexto = (id, texto) => ({ id, tipo: "handoff", titulo: id, texto });
const citados = (docs, citacoes) => docsQueCitam(docs, citacoes).map((a) => a.doc.id);
const RANKING = [{ ...CITACOES_D66.ranking, valor: 35 }];

test("seleciona quem cita a quantidade com número diferente, e só", () => {
  const docs = [
    docTexto("velho", "o hub tem 39 projetos hoje"),
    docTexto("certo", "o hub tem 35 projetos hoje"),
    docTexto("outro", "nada sobre isso"),
  ];
  assert.deepEqual(citados(docs, RANKING), ["velho"]);
  // Sem âncora nenhuma (as 10 perguntas de estado que não têm) a 2ª via não seleciona nada — e não
  // pode explodir por `citacoes` ausente, que é como ela chega de `apurado` sem o campo.
  assert.deepEqual(citados(docs, undefined), []);
});

// O defeito nº 3 dos 5 que a mineração de 01/08 encontrou no próprio check: saída de script
// colada em ``` é literal igual à crase, e ali ela absolveu D-70/D-71. Sem esta linha a 2ª via
// gastaria chamada do pool para o modelo julgar o eco de um terminal.
test("bloco cercado e crase são literais, não citação", () => {
  assert.deepEqual(citados([docTexto("script", "saída:\n```\n39 projetos no ranking\n```\n")], RANKING), []);
  assert.deepEqual(citados([docTexto("cita", "a memória dizia `39 projetos no hub` e foi corrigida")], RANKING), []);
});

// A QUANTIDADE HOMÔNIMA foi o defeito mais caro daquela mineração: `(\d+) projetos` solto casa
// 43 documentos do corpus e quase todos são outra conta. Cada um custa uma chamada do pool para
// o modelo responder `nao-fala`. Se alguém alargar a âncora "para achar mais", é aqui que quebra.
test("âncora estreita não confunde quantidade homônima", () => {
  const homonimos = [
    docTexto("autopublish", "o cron publica 1 artigo/dia em 10 projetos"),
    docTexto("vercel", "21 projetos apagados da Vercel"),
    docTexto("no-ar", "19 projetos no ar"),
  ];
  assert.deepEqual(citados(homonimos, RANKING), []);
  assert.deepEqual(citados([docTexto("h", "40 repos ativos, 39 projetos no ranking")], [{ ...CITACOES_D66.reposAtivos, valor: 36 }]), ["h"]);
});

// As 4 âncoras dos fatos ligados em 01/08 (D-80 a D-83). A rejeitada está no teste porque a
// MEDIÇÃO é o que impede a próxima sessão de alargá-la: `(\d+) protocolos?` solto casa 13
// documentos do corpus ("97 protocolos", "85 tipados", "29 candidatos") contra 3 com `× N
// projetos` junto — e cada homônimo é uma chamada do pool para o modelo dizer `nao-fala`.
test("as âncoras do inventário casam o fato e não o homônimo", () => {
  const ancora = (id, valor) => CITACOES[id].map((c) => ({ ...c, valor }));
  const docs = [
    docTexto("cobranca", "10 com SDK escrito, UM faturou; 6 servem preço e só falta LIGAR"),
    docTexto("conformidade", "10 protocolos × 35 projetos, ~40 s, zero LLM"),
    docTexto("servido", "pelo HTML eram 30 sem caminho de cobrança"),
  ];
  assert.deepEqual(citados(docs, ancora("D-80", 11)), ["cobranca"]);
  assert.deepEqual(citados(docs, ancora("D-81", 7)), ["cobranca"]);
  assert.deepEqual(citados(docs, ancora("D-82", 27)), ["servido"]);
  assert.deepEqual(citados(docs, ancora("D-83", 12)), ["conformidade"]);
  // Bater com o apurado NÃO seleciona: a 2ª via só traz documento cujo número já diverge.
  assert.deepEqual(citados(docs, ancora("D-83", 10)), []);
  // O total de protocolos da casa não é o número de protocolos que RODAM.
  assert.deepEqual(citados([docTexto("total", "97 protocolos escritos, 11 protocolos tipados")], ancora("D-83", 10)), []);
});

// `campo` virou compartilhado com o juiz; o default tem que continuar em minúscula, senão
// "Correta" deixaria de casar com o vocabulário e a régua do juiz mudaria de valor em silêncio.
test("o parse do juiz continua caso-insensível depois de compartilhar o campo", () => {
  const v = parseVeredito("VEREDITO: Correta\nARMADILHA: Evitou\nMOTIVO: X");
  assert.equal(v.veredito, "correta");
  assert.equal(v.armadilha, "evitou");
  assert.ok(montarPromptJuiz("q", "g", { resposta: "r", armadilha: "a" }).includes("VEREDITO"));
});
