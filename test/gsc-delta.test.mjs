import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CATALOGO,
  MEDIDO_POR,
  RESSALVA_DO_COLETOR,
  EDITORIAIS,
  cliquesNaoCapturados,
  seloDaMedida,
  regua,
  exigePiso,
  linha,
  ordenar,
  resumo,
  PISO_IMPRESSOES_VEREDITO,
} from "../lib/gsc-delta.mjs";
import { PISO_IMPRESSOES_VEREDITO as PISO_NA_FONTE } from "../lib/kpis-busca.mjs";
import * as grafo from "../lib/grafo.mjs";
import * as crux from "../lib/crux.mjs";
import { apurado, naoApurado } from "../lib/funil.mjs";

// As 32 folhas do board `okr-Saw2eoSKZDPLJAk6xeDBuS`, escritas por extenso.
// Literal e não `Object.keys(CATALOGO).length`: contar o próprio objeto passaria verde se alguém
// apagasse uma folha e acrescentasse outra. O board é a fonte, e ele não muda sozinho.
const FOLHAS = [
  "ctrPorPosicao", "penetracaoTop3", "strikingDistance", "crescimentoNaoMarca", "checklistGsc",
  "impressoesTop3", "ctrGap", "conformidadeUrls", "schema", "larguraTitulo", "reescritaTitulo",
  "termoNoTitulo", "intencao",
  "lcp", "inp", "cls", "urlsBoas", "ttfb", "indexacaoLimpa", "rejeicaoRastreio",
  "profundidadeClique", "coberturaSemantica", "frescor", "canibalizacao", "linksInternos",
  "referringDomains", "buscasDeMarca",
  "consultasUnicas", "top20", "queryToPage", "activeIndexRatio", "tamBusca",
];

// Os cinco selos da 028 (`app/okr/[slug]/aquisicao/page.tsx`). Literal aqui de propósito: este
// arquivo NÃO pode inventar um sexto. A primeira versão inventou oito, antes de ler a tela.
const SELOS = ["dado", "fim", "piso", "sem", "cega"];

test("nenhuma folha do board fica de fora do catálogo", () => {
  for (const f of FOLHAS) assert.ok(CATALOGO[f], `folha ausente do catálogo: ${f}`);
  assert.deepEqual(Object.keys(CATALOGO).sort(), [...FOLHAS].sort());
  // O total, travado. O levantamento em markdown escreveu "26 folhas" à mão e errou — o board
  // decompõe em 32. Prosa não tem como reclamar; este assert tem.
  assert.equal(FOLHAS.length, 32);
});

test("toda régua declara fonte, url, acessadoEm e recorte (trava 4)", () => {
  for (const [chave, { balizador: b }] of Object.entries(CATALOGO)) {
    if (b.tipo !== "regua") continue;
    for (const campo of ["fonte", "url", "acessadoEm", "recorte"]) {
      assert.ok(b[campo], `${chave}: régua sem \`${campo}\` — a trava 4 é obrigatória`);
    }
    assert.match(b.acessadoEm, /^\d{4}-\d{2}-\d{2}$/, `${chave}: acessadoEm fora do formato AAAA-MM-DD`);
    assert.match(b.url, /^https:\/\//, `${chave}: url não verificável`);
  }
});

test("quem não é régua carrega motivo próprio, e nenhum motivo se repete", () => {
  const motivos = [];
  for (const [chave, { balizador: b }] of Object.entries(CATALOGO)) {
    if (b.tipo === "regua" || b.tipo === "procedimento") continue;
    assert.ok(b.motivo?.length > 20, `${chave}: motivo ausente ou curto demais para explicar na tela`);
    motivos.push(b.motivo);
  }
  // O defeito que `benchmark.mjs` documentou: três degraus devolvendo a MESMA frase por três razões
  // diferentes. Motivo repetido é motivo copiado, e motivo copiado esconde a razão verdadeira.
  assert.equal(new Set(motivos).size, motivos.length, "há motivos repetidos entre folhas sem régua");
});

test("cliques não capturados: aritmética de um degrau, e null quando já cobre", () => {
  assert.equal(cliquesNaoCapturados({ impressoes: 1240, ctr: 0.05, benchmark: 0.13 }), 1240 * 0.08);
  assert.equal(cliquesNaoCapturados({ impressoes: 1000, ctr: 0.2, benchmark: 0.13 }), null);
  assert.equal(cliquesNaoCapturados({ impressoes: 0, ctr: 0.05, benchmark: 0.13 }), null);
  assert.equal(cliquesNaoCapturados(null), null);
});

// ---------- o selo é da 028, e só dela ----------

// ⚠️ TRAVA DE TAXONOMIA. Este módulo não pode ganhar um sexto selo nem ressuscitar os oito estados
// que a primeira versão inventou antes de ler a tela. Comentário pedindo boa-fé é o que a R6 já
// tentou e não segurou; isto fica vermelho no `npm test` do commit que criar o selo novo.
test("nenhum selo fora dos cinco da 028", () => {
  const fonte = readFileSync(new URL("../lib/gsc-delta.mjs", import.meta.url), "utf8");
  for (const proibido of ["abaixoDoPiso", "naoApurado", "semRegua", '"cobre"', '"abaixo"']) {
    assert.doesNotMatch(fonte, new RegExp(`selo:\\s*"?${proibido.replace(/"/g, "")}"?`), `selo inventado: ${proibido}`);
  }
  const emitidos = [...fonte.matchAll(/selo:\s*"(\w+)"/g)].map((m) => m[1]);
  for (const s of emitidos) assert.ok(SELOS.includes(s), `selo fora da taxonomia da 028: ${s}`);
});

test("medida ausente é `sem`, medida boa é `dado`", () => {
  assert.equal(seloDaMedida(naoApurado("sem propriedade no GSC")).selo, "sem");
  assert.equal(seloDaMedida(apurado(0.12)).selo, "dado");
});

test("instrumento quebrado é `cega`, e carrega o motivo na palavra", () => {
  const s = seloDaMedida(apurado(1), { falha: "crawl cego" });
  assert.equal(s.selo, "cega");
  assert.equal(s.palavra, "crawl cego");
});

// `cega` é o único vermelho da tela. Coletor inexistente é decisão de produto, não defeito de
// instrumento, e sai pelo eixo da régua — nunca pintando a linha de vermelho.
test("coletor inexistente não vira `cega`", () => {
  const l = linha("referringDomains", naoApurado("sem fonte de backlink"));
  assert.equal(l.selo, "sem");
  assert.equal(l.regua.natureza, "semColetor");
});

// ---------- piso de amostra (026) ----------

// O 100 não é redeclarado aqui nem lá: `gsc-delta` reexporta o binding de `kpis-busca`. Este teste
// existe para que uma cópia futura do número fique vermelha no mesmo commit em que nascer.
test("o piso é o mesmo objeto da fonte, nunca uma cópia", () => {
  assert.equal(PISO_IMPRESSOES_VEREDITO, PISO_NA_FONTE);
});

test("abaixo do piso vira selo `piso` e mantém a base à vista", () => {
  // as 26 impressões de `usealigner.com` em 18/09 — o caso que a 026 documentou
  const l = linha("ctrGap", apurado(0.04), { delta: 99, moeda: "cliques", base: 26 });
  assert.equal(l.selo, "piso");
  assert.match(l.palavra, /26/, "a base explica por que o número está sem veredito");
  assert.equal(l.delta, null, "amostra rasa não emite distância");
  assert.ok(l.real, "o número continua na tela: o que sai é a régua");
});

test("exatamente no piso já emite veredito", () => {
  const l = linha("ctrGap", apurado(0.04), { delta: 99, moeda: "cliques", base: PISO_IMPRESSOES_VEREDITO });
  assert.equal(l.selo, "dado");
  assert.equal(l.delta, 99);
});

test("régua com piso exige a base — esquecer não passa batido", () => {
  assert.throws(() => linha("ctrGap", apurado(0.04), { delta: 9, moeda: "cliques" }), /exige `base`/);
  assert.equal(exigePiso("ctrGap"), true);
  assert.equal(exigePiso("lcp"), false, "CrUX tem amostra própria: o piso do GSC não se aplica");
  assert.equal(exigePiso("larguraTitulo"), false, "medição direta do HTML não tem amostra");
});

// ---------- o eixo da régua ----------

test("régua e medida são eixos independentes", () => {
  // medida excelente + balizador inexistente: a linha existe, tem selo `dado`, e não tem distância
  const l = linha("linksInternos", apurado(7));
  assert.equal(l.selo, "dado", "a medida está boa");
  assert.equal(l.regua.tem, false, "a régua é que não existe");
  assert.equal(l.delta, null, "sem régua não há distância, por melhor que seja a medida");
  assert.match(l.regua.motivo, /diversidade de âncora/i);
});

test("meta sai no formato que <Leitura> já aceita", () => {
  // par vira faixa na trilha, número vira tique — a 028 já sabe desenhar os dois
  assert.equal(regua("lcp").meta, 2500);
  assert.equal(regua("larguraTitulo").meta, 580);
  assert.equal(regua("penetracaoTop3").tem, false);
});

test("as quatro naturezas de ausência de régua são distinguíveis", () => {
  assert.equal(regua("penetracaoTop3").natureza, "recusa");
  assert.equal(regua("referringDomains").natureza, "semColetor");
  assert.equal(regua("canibalizacao").natureza, "norma");
  assert.equal(regua("checklistGsc").natureza, "procedimento");
  // medido por `grafo.mjs` desde sempre: falta régua, não falta coletor
  assert.equal(regua("profundidadeClique").natureza, "recusa");
  assert.equal(regua("linksInternos").natureza, "recusa");
});

// ---------- coletor: o erro de 19/09 não pode voltar ----------

// ⚠ TRAVA DE INVENTÁRIO. O levantamento marcou `profundidadeClique` e `linksInternos` como "sem
// coletor" por não ter lido `grafo.mjs`. Uma folha não pode alegar ausência de coletor e ao mesmo
// tempo declarar onde é medida — quem for ligar a fonte descobre aqui que ela já existe.
test("nenhuma folha é `semColetor` e medida ao mesmo tempo", () => {
  for (const [chave, { balizador: b }] of Object.entries(CATALOGO)) {
    if (b.tipo !== "semColetor") continue;
    assert.ok(!MEDIDO_POR[chave], `${chave}: marcada sem coletor, mas é medida por ${MEDIDO_POR[chave]}`);
  }
});

test("as três folhas sem coletor são exatamente as que ninguém mede", () => {
  const semColetor = Object.entries(CATALOGO)
    .filter(([, { balizador: b }]) => b.tipo === "semColetor")
    .map(([k]) => k)
    .sort();
  assert.deepEqual(semColetor, ["referringDomains", "rejeicaoRastreio", "tamBusca"]);
});

// 032 — `activeIndexRatio` conta URLs e passou a contar sobre a leitura por PÁGINA, que é
// completa: a omissão das consultas raras não o alcança mais. Um mapa que continuasse citando a
// dimensão `query` aqui mandaria o próximo consertar um piso que não existe — e a tela publica
// esta frase ao lado do "Medido em", então ela é afirmação, não comentário.
test("a ressalva de activeIndexRatio é só a janela — não cita mais a dimensão query", () => {
  assert.doesNotMatch(RESSALVA_DO_COLETOR.activeIndexRatio, /query/);
  assert.match(RESSALVA_DO_COLETOR.activeIndexRatio, /janela de 28 dias/);
  // A 032 não REMOVE a ressalva: ela para de aplicá-la onde não precisa existir. Onde precisa, fica.
  for (const k of ["consultasUnicas", "queryToPage", "top20"]) {
    assert.match(RESSALVA_DO_COLETOR[k], /query/, k + " perdeu a ressalva da dimensão query");
  }
});

// 032/D4 — o teste abaixo confere que a CHAVE é folha do board; ele passaria verde com o valor
// apontando para um símbolo deletado. `porUrl` foi deletada nesta feature, e mapa que descreve o
// coletor errado manda ligar coletor que já está ligado.
test("MEDIDO_POR não aponta para porUrl, deletada na 032", () => {
  for (const [chave, alvo] of Object.entries(MEDIDO_POR)) {
    assert.doesNotMatch(alvo, /porUrl/, chave + " aponta para porUrl, que não existe mais em kpis-busca.mjs");
  }
});

test("todo destino de MEDIDO_POR aponta para folha existente", () => {
  for (const chave of Object.keys(MEDIDO_POR)) {
    assert.ok(CATALOGO[chave], `MEDIDO_POR aponta para folha fora do board: ${chave}`);
  }
});

// Os números editoriais precisam existir de verdade no módulo que dizem morar. Se alguém renomear
// ou apagar uma constante, a lista de "sem origem" vira ficção silenciosa.
test("as constantes editoriais de grafo.mjs existem e valem o que está escrito", () => {
  assert.equal(grafo.TITULO_PX_MIN, 500);
  assert.equal(grafo.TITULO_PX_MAX, 580);
  assert.equal(grafo.TERMO_ATE, 35);
  assert.equal(grafo.LINKS_CONTEXTUAIS_MIN, 5);
  assert.equal(grafo.PROFUNDIDADE_MAX, 4);
  assert.equal(grafo.CADENCIA_MESES, 12);
  assert.equal(grafo.LINKS_POR_MIL_MIN, 3);
  assert.equal(grafo.LINKS_POR_MIL_MAX, 10);
  assert.equal(grafo.LINKS_MINIMO_ABSOLUTO, 1);
  for (const k of Object.keys(EDITORIAIS)) assert.ok(EDITORIAIS[k].length > 20, `${k}: sem explicação`);
});

// ---------- decisões do dono de 19/09/2026 ----------

// A faixa por palavras e a política de cadência são EDITORIAIS. Elas podem mudar; o que não pode
// mudar em silêncio é o rótulo — no dia em que uma delas sair da lista, a tela passa a exibi-la
// com a mesma tipografia de `LCP ≤ 2,5s`, que tem URL do Google atrás.
test("os números das decisões 2 e 3 estão declarados como editoriais", () => {
  for (const k of [
    "lib/grafo.mjs#LINKS_POR_MIL_MIN",
    "lib/grafo.mjs#LINKS_POR_MIL_MAX",
    "lib/grafo.mjs#LINKS_MINIMO_ABSOLUTO",
    "lib/grafo.mjs#CADENCIA_POR_INTENCAO",
  ]) {
    assert.ok(EDITORIAIS[k], `${k}: número editorial fora da lista — vai aparecer como régua na tela`);
  }
});

test("densidade contextual: escasso, dentro e excessivo pelo tamanho do texto", () => {
  // guia longo com 5 links passava no limiar antigo e está mudo: 1,25 por mil contra piso de 3
  assert.equal(grafo.densidadeContextual(5, 4000).estado, "escasso");
  assert.equal(grafo.densidadeContextual(20, 4000).estado, "dentro");
  assert.equal(grafo.densidadeContextual(60, 4000).estado, "excessivo");
  // página curta: 5 links em 200 palavras é menu disfarçado, e o limiar antigo aprovava
  assert.equal(grafo.densidadeContextual(5, 200).estado, "excessivo");
});

test("o mínimo absoluto salva a página curta da densidade fracionária", () => {
  // 250 × 3/mil = 0,75 link: sem o piso de 1, zero link passaria como "dentro"
  assert.equal(grafo.densidadeContextual(0, 250).estado, "escasso");
  assert.equal(grafo.densidadeContextual(1, 250).estado, "dentro");
});

test("sem texto não há veredito de densidade — nunca `escasso`", () => {
  // página renderizada no cliente não é página pobre em links: consertos opostos
  assert.equal(grafo.densidadeContextual(0, null), null);
  assert.equal(grafo.densidadeContextual(0, 3), null, "abaixo do PISO_PALAVRAS");
  assert.equal(grafo.densidadeContextual(null, 1000), null);
});

test("variedade de âncora conta VARIAÇÕES, não links", () => {
  const nav = new Set();
  const arestas = [
    { de: "/a", para: "/x", ancora: "clique aqui" },
    { de: "/b", para: "/x", ancora: "Clique Aqui" }, // mesma âncora, caixa diferente
    { de: "/c", para: "/x", ancora: "  clique   aqui " }, // mesma, espaço diferente
    { de: "/d", para: "/x", ancora: "alinhador transparente" },
  ];
  // quatro links, DUAS variações — e `densidades()` contaria 4 nos dois casos
  assert.equal(grafo.variedadeDeAncora(arestas, nav).get("/x"), 2);
});

test("variedade de âncora: acento conta, vazio e autolink não", () => {
  const nav = new Set();
  const arestas = [
    { de: "/a", para: "/x", ancora: "preço" },
    { de: "/b", para: "/x", ancora: "preco" }, // texto diferente na SERP: conta
    { de: "/c", para: "/x", ancora: "   " }, // imagem sem alt: não é variação de texto
    { de: "/x", para: "/x", ancora: "topo" }, // página não vota em si mesma
  ];
  assert.equal(grafo.variedadeDeAncora(arestas, nav).get("/x"), 2);
});

// A correlação da Zyppy é declarada pelos próprios autores como incerta. Virar limiar aqui seria o
// salto que a R6 recusa — e a defesa é teste, não comentário.
test("variedade de âncora conta e NÃO julga: nenhum limiar no módulo", () => {
  const fonte = readFileSync(new URL("../lib/grafo.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /ANCORAS?_(MIN|MAX)|VARIEDADE_(MIN|MAX)/i);
  const m = grafo.variedadeDeAncora([{ de: "/a", para: "/x", ancora: "t" }], new Set());
  assert.equal(typeof m.get("/x"), "number", "devolve contagem, nunca veredito");
});

test("cadência: 6 meses para comercial, 12 para informacional", () => {
  assert.equal(grafo.cadenciaDe("comercial"), 6);
  assert.equal(grafo.cadenciaDe("ambos"), 6, "mistura carrega a parte que apodrece");
  assert.equal(grafo.cadenciaDe("informacional"), 12);
  assert.equal(grafo.cadenciaDe("ausente"), 12);
  assert.equal(grafo.cadenciaDe(null), 12, "crawl anterior à coluna cai no conservador");
});

test("a mesma data vence numa página comercial e não vence numa informacional", () => {
  const p = (url, intencao) => ({
    url,
    intencao,
    dataDeclarada: "2026-01-15", // 8 meses antes de 19/09/2026
    erro: null,
    redirecionada: false,
    conteudoEstado: "ok",
  });
  const r = grafo.cadencia([p("/precos", "comercial"), p("/o-que-e", "informacional")], "2026-09-19");
  assert.equal(r.avaliadas, 2);
  assert.deepEqual(r.vencidas.map((x) => x.url), ["/precos"], "só a comercial passou de 6 meses");
  // Os dois prazos viajam até a tela: "1 vencida" sem o prazo esconde por qual régua ela venceu.
  assert.deepEqual(Object.keys(r.prazos).sort(), ["12", "6"]);
});

// 19/09/2026 — o dono decidiu 800ms. O limiar do código e o do catálogo têm de ser o MESMO número:
// divergir aqui faria a tela julgar por um valor e declarar a fonte de outro, que é pior do que
// não citar fonte nenhuma.
test("o TTFB do crux é o mesmo limiar que o catálogo declara", () => {
  const noCodigo = crux.VITAIS.find((v) => v.id === "ttfb");
  const r = regua("ttfb");
  assert.equal(r.tem, true, "TTFB tem fonte oficial desde 19/09/2026");
  assert.equal(noCodigo.limite, 800);
  assert.equal(r.meta, noCodigo.limite);
  assert.match(r.fonte.url, /web\.dev\/articles\/ttfb/);
  // A própria fonte recusa a classificação de Core Web Vital, e o recorte tem de dizer isso —
  // senão a tela empresta ao TTFB a autoridade de LCP/INP/CLS, que o Google não dá.
  assert.match(r.fonte.recorte, /NÃO é Core Web Vital/);
  assert.notEqual(r.fonte.url, regua("lcp").fonte.url, "páginas diferentes, limiares diferentes");
});

// O `ideal` continua sem fonte. Ele não emite veredito (aparece ao lado do limite, FR-007), mas
// precisa seguir listado: um alvo sem origem que some da lista volta a parecer régua.
test("o ideal de 300ms segue registrado como editorial", () => {
  const noCodigo = crux.VITAIS.find((v) => v.id === "ttfb");
  assert.equal(noCodigo.ideal, 300);
  assert.ok(EDITORIAIS["lib/crux.mjs#VITAIS.ttfb.ideal"], "o ideal saiu da lista de editoriais");
});

// O board pede 3 cliques, `grafo.mjs` usa 4. Nenhum dos dois tem fonte, e a divergência não foi
// decidida por ninguém — fica registrada aqui para não ser "corrigida" por engano em qualquer direção.
test("a divergência board × código em profundidade está declarada, não escondida", () => {
  assert.match(regua("profundidadeClique").motivo, /grafo\.mjs` usa 4/);
  assert.match(EDITORIAIS["lib/grafo.mjs#PROFUNDIDADE_MAX"], /board disse 3/);
});

test("KPI fora do board é erro, não linha silenciosa", () => {
  assert.throws(() => linha("inventado", apurado(1)), /fora do catálogo/);
  assert.throws(() => regua("inventado"), /fora do catálogo/);
});

// ---------- fila de trabalho ----------

test("delta sem moeda é recusado — a fronteira A/B nunca fica implícita", () => {
  assert.throws(() => linha("ctrGap", apurado(0.05), { delta: 99, base: 1240 }), /fronteira A\/B/);
  assert.equal(linha("ctrGap", apurado(0.05), { delta: 99, moeda: "cliques", base: 1240 }).moeda, "cliques");
});

test("ordenar separa por moeda e nunca mistura pp com cliques", () => {
  const ls = [
    linha("ctrGap", apurado(0.05), { delta: 99, moeda: "cliques", base: 1240 }),
    linha("lcp", apurado(3200), { delta: 700, moeda: "ms" }),
    linha("larguraTitulo", apurado(640), { delta: 60, moeda: "px" }),
    linha("schema", apurado(1)),
  ];
  const { porMoeda, semDelta } = ordenar(ls);
  assert.deepEqual([...porMoeda.keys()].sort(), ["cliques", "ms", "px"]);
  assert.equal(semDelta.length, 1);
  for (const [, bloco] of porMoeda) assert.ok(bloco.every((l) => l.moeda === bloco[0].moeda));
});

test("ordena por tamanho do delta dentro da moeda", () => {
  const ls = [
    linha("ctrGap", apurado(0.05), { delta: 12, moeda: "cliques", base: 1240 }),
    linha("ctrPorPosicao", apurado(0.03), { delta: 340, moeda: "cliques", base: 5300 }),
  ];
  assert.deepEqual(ordenar(ls).porMoeda.get("cliques").map((l) => l.delta), [340, 12]);
});

// ⚠️ TRAVA 1, executável. Os degraus de busca não são independentes: corrigir CTR muda posição, que
// muda impressões, que muda o denominador do KPI seguinte. Somar os deltas conta o mesmo clique
// duas vezes; multiplicar é a barra de erro de 56× da R6.
test("o módulo não expõe soma, total ou projeção de deltas", () => {
  const fonte = readFileSync(new URL("../lib/gsc-delta.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /export (async )?(function|const) (somar|total|projetar|prever)/i);
});

test("resumo conta os dois eixos separados", () => {
  const ls = [
    linha("lcp", apurado(2100), { delta: null }),
    linha("linksInternos", apurado(7)),
    linha("referringDomains", naoApurado("sem fonte")),
  ];
  const r = resumo(ls);
  assert.equal(r.porSelo.dado, 2);
  assert.equal(r.porSelo.sem, 1);
  assert.equal(r.porRegua.comRegua, 1);
  assert.equal(r.porRegua.recusa, 1);
  assert.equal(r.porRegua.semColetor, 1);
});
