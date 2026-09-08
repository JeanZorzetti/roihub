import test from "node:test";
import assert from "node:assert/strict";
import {
  canonizar,
  ehInterna,
  navegacao,
  profundidades,
  densidades,
  dedupPorUrl,
  fronteira,
  agregar,
  taxaIntegridadeDoTitulo,
  taxaAlinhamento,
  taxaCobertura,
  cadencia,
  ordemDaPeriferia,
  FRACAO_NAVEGACAO,
  MIN_PAGINAS_NAVEGACAO,
} from "../lib/grafo.mjs";

const BASE = "https://x.com/";

// ── D3: uma chave de página, não duas ───────────────────────────────────────

test("/precos e /precos/ canonizam para a MESMA chave", () => {
  assert.equal(canonizar("/precos", BASE), canonizar("/precos/", BASE));
  assert.equal(canonizar("/precos/", BASE), "https://x.com/precos");
});

test("a raiz mantém a barra, o host vira minúsculo e o fragmento some", () => {
  assert.equal(canonizar("/", BASE), "https://x.com/");
  assert.equal(canonizar("https://X.COM/A", BASE), "https://x.com/A");
  assert.equal(canonizar("/precos#tabela", BASE), "https://x.com/precos");
});

test("a query é PRESERVADA — ?p=2 costuma ser outra página de verdade", () => {
  assert.equal(canonizar("/blog?p=2", BASE), "https://x.com/blog?p=2");
});

test("mailto, tel, javascript e âncora pura não são arestas", () => {
  for (const h of ["mailto:a@b.com", "tel:+5562", "javascript:void(0)", "#topo", "", "   "]) {
    assert.equal(canonizar(h, BASE), null, `${h} virou aresta`);
  }
});

test("subdomínio NÃO é interno", () => {
  assert.equal(ehInterna("https://x.com/a", "x.com"), true);
  assert.equal(ehInterna("https://blog.x.com/a", "x.com"), false, "contar subdomínio infla a densidade");
  assert.equal(ehInterna("https://outro.com/a", "x.com"), false);
});

// ── SC-003: o menu está fora da conta, POR CONSTRUÇÃO ───────────────────────

/** O mesmo conjunto de 4 páginas, com um menu de N links em todas e um link editorial só. */
const conjunto = (linksDeMenu) => {
  const paginas = ["https://x.com/", "https://x.com/a", "https://x.com/b", "https://x.com/c"];
  const arestas = [];
  for (const de of paginas) {
    for (let i = 0; i < linksDeMenu; i++) {
      arestas.push({ de, para: `https://x.com/menu${i}`, ancora: `Menu ${i}` });
    }
  }
  // O único link CONTEXTUAL: a home cita /a no meio de um parágrafo.
  arestas.push({ de: "https://x.com/", para: "https://x.com/a", ancora: "nossos preços" });
  return { arestas, total: paginas.length };
};

test("SC-003 — menu de 5 e menu de 15 produzem EXATAMENTE as mesmas densidades", () => {
  const conta = (n) => {
    const { arestas, total } = conjunto(n);
    return [...densidades(arestas, navegacao(arestas, total))].sort();
  };
  assert.deepEqual(conta(5), conta(15), "o menu que cresce está entrando na densidade contextual");
  assert.deepEqual(conta(5), [["https://x.com/a", 1]], "só o link editorial conta");
});

test("o piso de 3 páginas segura o site pequeno: 2 de 3 não é navegação", () => {
  const arestas = [
    { de: "https://x.com/", para: "https://x.com/a", ancora: "A" },
    { de: "https://x.com/b", para: "https://x.com/a", ancora: "A" },
  ];
  assert.equal(navegacao(arestas, 3).size, 0, `2 páginas < MIN_PAGINAS_NAVEGACAO (${MIN_PAGINAS_NAVEGACAO})`);
  assert.equal(FRACAO_NAVEGACAO, 0.5);
});

test("a âncora faz parte da chave: mesmo destino com texto diferente não é o mesmo link", () => {
  const arestas = [
    { de: "https://x.com/1", para: "https://x.com/p", ancora: "Preços" },
    { de: "https://x.com/2", para: "https://x.com/p", ancora: "Preços" },
    { de: "https://x.com/3", para: "https://x.com/p", ancora: "Preços" },
    { de: "https://x.com/4", para: "https://x.com/p", ancora: "veja quanto custa" },
  ];
  const nav = navegacao(arestas, 4);
  assert.equal(nav.size, 1);
  assert.deepEqual([...densidades(arestas, nav)], [["https://x.com/p", 1]], "o link editorial foi junto com o menu");
});

// ── O grafo do quickstart §2 ────────────────────────────────────────────────

const HOME = "https://x.com/";
const A = "https://x.com/a";
const B = "https://x.com/b";
const C = "https://x.com/c"; // só no sitemap — órfã
const D = "https://x.com/d"; // falhou na busca

test("órfã não é raiz, e falha de rede não é órfã", () => {
  const arestas = [
    { de: HOME, para: A, ancora: "A" },
    { de: HOME, para: B, ancora: "B" },
  ];
  const { mapa, tetoAtingido } = profundidades(arestas, HOME, 100);
  assert.equal(mapa.get(HOME), 0);
  assert.equal(mapa.get(A), 1);
  assert.equal(mapa.has(C), false, "ausente do mapa = inalcançável, jamais 0");
  assert.equal(tetoAtingido, false);

  const paginas = [
    { url: HOME, noSitemap: true, profundidade: 0, erro: null },
    { url: A, noSitemap: true, profundidade: 1, erro: null },
    { url: B, noSitemap: true, profundidade: 1, erro: null },
    { url: C, noSitemap: true, profundidade: null, erro: null },
    { url: D, noSitemap: true, profundidade: null, erro: "ETIMEDOUT" },
  ];
  const a = agregar(paginas, { declaradas: 5, linksNavegacao: 0 });
  assert.equal(a.orfas, 1, "somar a página que falhou transforma erro de rede em achado de arquitetura");
  assert.equal(a.falhas, 1);
  assert.equal(a.visitadas, 5);
  assert.equal(a.profundidadeMaxima, 1);
});

test("ciclo termina, e o teto se declara", () => {
  const ciclo = [
    { de: A, para: B, ancora: "B" },
    { de: B, para: A, ancora: "A" },
    { de: HOME, para: A, ancora: "A" },
  ];
  assert.equal(profundidades(ciclo, HOME, 100).tetoAtingido, false);
  const cinco = [
    { de: HOME, para: A, ancora: "a" },
    { de: A, para: B, ancora: "b" },
    { de: B, para: C, ancora: "c" },
    { de: C, para: D, ancora: "d" },
  ];
  assert.equal(profundidades(cinco, HOME, 2).tetoAtingido, true, "teto que corta e não avisa publica número incompleto");
});

test("autolink não conta densidade", () => {
  const arestas = [{ de: A, para: A, ancora: "eu mesmo" }];
  assert.equal(densidades(arestas, new Set()).size, 0);
});

// ── A fronteira, que uma vez não fechou ─────────────────────────────────────

test("URL que REDIRECIONA sai da fronteira pela origem, não só pelo destino", () => {
  const arestas = [{ de: HOME, para: "https://x.com/quiz", ancora: "Quiz" }];
  // `/quiz` foi pedida e caiu em `/quiz-alinhador`: as duas entram em `vistas`.
  const vistas = new Set([HOME, "https://x.com/quiz", "https://x.com/quiz-alinhador"]);
  assert.deepEqual(fronteira(arestas, vistas), [], "a origem redirecionada voltou à fronteira: travessia infinita");
  assert.deepEqual(fronteira(arestas, new Set([HOME])), ["https://x.com/quiz"]);
});

// ── A PK que a corrida não pode estourar ────────────────────────────────────

test("duas URLs do sitemap que redirecionam para o mesmo destino viram UMA linha", () => {
  const r = dedupPorUrl([
    { url: A, noSitemap: true, profundidade: 1 },
    { url: A, noSitemap: false, profundidade: null },
  ]);
  assert.equal(r.length, 1, "PK (projeto, dia, url) estoura no INSERT multi-linha e a corrida inteira cai");
  assert.equal(r[0].noSitemap, true, "declarada por qualquer das colididas mantém a linha declarada");
});

test("colisão largura × colheita mantém no_sitemap quando a segunda é a declarada", () => {
  const r = dedupPorUrl([
    { url: B, noSitemap: false, profundidade: 2 },
    { url: B, noSitemap: true, profundidade: null },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].noSitemap, true);
  assert.equal(r[0].profundidade, 2, "a linha da fase largura é a que sabe a profundidade");
});

// ── As quatro taxas ─────────────────────────────────────────────────────────

const pag = (extra) => ({
  url: `https://x.com/${extra.n ?? 1}`,
  noSitemap: true,
  profundidade: 1,
  linksContextuais: 6,
  titulo: "Um título",
  tituloPx: 540,
  intencao: "comercial",
  schemaEstado: "valido",
  dataDeclarada: null,
  conteudoEstado: "com-conteudo",
  erro: null,
  ...extra,
});

test("US2 — página sem termo apurado não move nem o numerador nem o denominador", () => {
  const paginas = [pag({ n: 1 }), pag({ n: 2 }), pag({ n: 3, tituloPx: 200 })];
  const termos = new Map([
    ["https://x.com/1", 0],
    ["https://x.com/3", 0],
  ]);
  const r = taxaIntegridadeDoTitulo(paginas, termos);
  assert.equal(r.avaliadas, 2, "a URL sem consulta com impressão entrou no denominador");
  assert.equal(r.fracao, 0.5);
  assert.equal(r.semTermo, 1);
  assert.equal(r.fora[0].url, "https://x.com/3", "quem reprovou é a de 200 px, não a sem termo");
});

test("US2 — termo fora do título (-1) reprova; termo depois de 35 caracteres também", () => {
  const paginas = [pag({ n: 1 }), pag({ n: 2 })];
  const r = taxaIntegridadeDoTitulo(paginas, new Map([["https://x.com/1", -1], ["https://x.com/2", 40]]));
  assert.equal(r.fracao, 0);
  assert.equal(r.avaliadas, 2);
});

test("US2 — alinhamento de intenção conta só quem tem título", () => {
  const r = taxaAlinhamento([pag({ n: 1 }), pag({ n: 2, intencao: "ausente" }), pag({ n: 3, titulo: null })]);
  assert.equal(r.avaliadas, 2);
  assert.equal(r.fracao, 0.5);
  assert.equal(r.ausentes[0].url, "https://x.com/2");
});

test("US3 — 1 válida + 1 inválida + 1 ausente é 1/3, com os dois estados de falha SEPARADOS", () => {
  const r = taxaCobertura([
    pag({ n: 1 }),
    pag({ n: 2, schemaEstado: "invalido" }),
    pag({ n: 3, schemaEstado: "ausente" }),
  ]);
  assert.equal(r.fracao, 1 / 3);
  assert.equal(r.invalidas.length, 1);
  assert.equal(r.ausentes.length, 1, "somar inválido com ausente junta dois consertos diferentes num número só");
});

test("US4 — 2 com data (1 vencida) + 3 sem data dão denominador 2, não 5", () => {
  const r = cadencia(
    [
      pag({ n: 1, dataDeclarada: "2026-08-01" }),
      pag({ n: 2, dataDeclarada: "2024-01-01" }),
      pag({ n: 3 }),
      pag({ n: 4 }),
      pag({ n: 5 }),
    ],
    "2026-09-08",
  );
  assert.equal(r.avaliadas, 2, "sem data declarada virou desatualizada");
  assert.equal(r.vencidas.length, 1);
  assert.equal(r.fracao, 0.5);
  assert.equal(r.semData.length, 3);
});

test("US4 — nenhuma página declara data: fração null, nunca 0%", () => {
  const r = cadencia([pag({ n: 1 }), pag({ n: 2 })], "2026-09-08");
  assert.equal(r.fracao, null);
  assert.equal(r.avaliadas, 0);
});

test("falha de rede fica fora das quatro taxas", () => {
  const caida = pag({ n: 9, erro: "ETIMEDOUT", titulo: null, schemaEstado: "ausente" });
  assert.equal(taxaCobertura([pag({ n: 1 }), caida]).avaliadas, 1);
  assert.equal(taxaAlinhamento([pag({ n: 1 }), caida]).avaliadas, 1);
});

// ── SC-006: a periferia primeiro ────────────────────────────────────────────

test("órfã primeiro, depois funda, depois pouco linkada — e a que falhou por último", () => {
  const ordenada = ordemDaPeriferia([
    pag({ n: "ok", profundidade: 2, linksContextuais: 9 }),
    pag({ n: "erro", erro: "HTTP 404", profundidade: null }),
    pag({ n: "pouca", linksContextuais: 2 }),
    pag({ n: "funda", profundidade: 5 }),
    pag({ n: "orfa", profundidade: null }),
  ]);
  assert.deepEqual(
    ordenada.map((p) => p.url.split("/").pop()),
    ["orfa", "funda", "pouca", "ok", "erro"],
  );
});

test("empate entre pouco linkadas desfaz por impressões — o trabalho que rende mais primeiro", () => {
  const ordenada = ordemDaPeriferia(
    [pag({ n: "fria", linksContextuais: 1 }), pag({ n: "quente", linksContextuais: 1 })],
    new Map([["https://x.com/quente", 900], ["https://x.com/fria", 3]]),
  );
  assert.deepEqual(ordenada.map((p) => p.url.split("/").pop()), ["quente", "fria"]);
});
