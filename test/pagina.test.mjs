import test from "node:test";
import assert from "node:assert/strict";
import {
  semScriptNemStyle,
  contarPalavras,
  titulo,
  larguraDoTitulo,
  METODO_LARGURA,
  modificadoresDeIntencao,
  posicaoDoTermo,
  blocosJsonLd,
  dataDeclarada,
  linksDe,
  estadoDoConteudo,
  extrair,
} from "../lib/pagina.mjs";

// ── SC-005: o regex guloso, reprovado ───────────────────────────────────────
//
// 🚩 O defeito MEDIDO em `D-84` (07/08): `sed 's/<script[^>]*>.*<\/script>//g'` devolveu 0 palavras
// para `orcaobra` e `vertice`, que têm `<h1>`. HTML minificado é uma linha só e o `.*` guloso apaga
// do primeiro `<script>` até o último fechamento — o body inteiro. Este é o teste que decide se
// qualquer número desta feature vale alguma coisa.
const MINIFICADO =
  '<html><head><script>var a=1;</script><title>x</title></head><body>' +
  "<h1>Alinhador invisível em Goiânia</h1><p>texto</p><script>var b=2;</script></body></html>";

test("SC-005 — dois <script> numa linha só não apagam o <h1> entre eles", () => {
  const palavras = contarPalavras(MINIFICADO);
  assert.notEqual(palavras, 0, "0 palavras numa página com <h1> é a contradição do D-84: regex guloso");
  // "Alinhador invisível em Goiânia" (4) + "texto" (1) + "x" do <title> (1).
  assert.equal(palavras, 6);
  assert.ok(!semScriptNemStyle(MINIFICADO).includes("var b=2"), "o segundo script sobreviveu");
  assert.ok(semScriptNemStyle(MINIFICADO).includes("Goiânia"), "o body foi apagado junto com os scripts");
});

test("<style> sai junto, e comentário HTML não conta palavra", () => {
  const html = "<style>body{color:red}</style><!-- nota interna --><p>uma duas tres</p>";
  assert.equal(contarPalavras(html), 3);
});

test("página sem texto nenhum conta 0 — e aí 0 é medição, não defeito", () => {
  assert.equal(contarPalavras('<html><body><div id="root"></div></body></html>'), 0);
});

// ── SC-004: pixel não é caractere ───────────────────────────────────────────

test("SC-004 — mesmo comprimento, larguras diferentes, e o método sempre presente", () => {
  const estreito = larguraDoTitulo("iiiiiiiiii");
  const largo = larguraDoTitulo("WWWWWWWWWW");
  assert.equal("iiiiiiiiii".length, "WWWWWWWWWW".length);
  assert.notEqual(estreito.px, largo.px, "contar caractere é exatamente a armadilha da D4");
  assert.ok(largo.px > estreito.px);
  assert.equal(estreito.metodo, METODO_LARGURA);
  assert.equal(largo.metodo, METODO_LARGURA, "número de pixels sem método é lido como medição");
});

test("acentuado usa a largura da letra base, e o desconhecido cai no fallback", () => {
  assert.equal(larguraDoTitulo("a").px, larguraDoTitulo("á").px);
  assert.equal(larguraDoTitulo("").px, 0);
  assert.equal(larguraDoTitulo(null).px, null, "sem título não há largura — e null não é 0 px");
  assert.equal(larguraDoTitulo(null).metodo, METODO_LARGURA);
});

test("título ausente é null; título vazio é string vazia — são coisas diferentes", () => {
  assert.equal(titulo("<html><head></head></html>"), null);
  assert.equal(titulo("<html><head><title></title></head></html>"), "");
  assert.equal(titulo("<title>Preços &amp; planos</title>"), "Preços & planos");
});

// ── Intenção: o ano é parâmetro (D9) ────────────────────────────────────────

test("informacional + comercial no mesmo título é `ambos`", () => {
  assert.equal(modificadoresDeIntencao("Guia de preços do alinhador", 2026), "ambos");
  assert.equal(modificadoresDeIntencao("Passo a passo do tratamento", 2026), "informacional");
  assert.equal(modificadoresDeIntencao("Comparativo de planos", 2026), "comercial");
  assert.equal(modificadoresDeIntencao("Alinhador invisível", 2026), "ausente");
  assert.equal(modificadoresDeIntencao(null, 2026), "ausente");
});

test("o ano vigente conta como modificador comercial — e só o ano PASSADO como parâmetro", () => {
  assert.equal(modificadoresDeIntencao("Alinhador invisível em 2026", 2026), "comercial");
  assert.equal(
    modificadoresDeIntencao("Alinhador invisível em 2026", 2027),
    "ausente",
    "ano fixo no código apodrece em janeiro e passa a reprovar todo mundo",
  );
});

test("acento e caixa não separam o modificador do título", () => {
  assert.equal(modificadoresDeIntencao("PREÇO do alinhador", 2026), "comercial");
});

// ── FR-006: posição do termo ────────────────────────────────────────────────

test("posição 0 é o MELHOR caso e nunca se confunde com ausência", () => {
  assert.equal(posicaoDoTermo("Alinhador invisível em Goiânia", "alinhador"), 0);
  assert.equal(posicaoDoTermo("Clínica de alinhador", "ALINHADOR"), 11);
  assert.equal(posicaoDoTermo("Preços do tratamento", "preco"), 0, "acento não pode separar o termo do título");
  assert.equal(posicaoDoTermo("Clínica em Goiânia", "alinhador"), -1, "termo fora do título é -1, não null");
  assert.equal(posicaoDoTermo(null, "alinhador"), null);
  assert.equal(posicaoDoTermo("Clínica", null), null, "sem termo apurado no GSC não é posição 0");
});

// ── D11: ausente ≠ inválido ─────────────────────────────────────────────────

const ld = (corpo) => `<script type="application/ld+json">${corpo}</script>`;

test("@graph com três tipos é lido como TRÊS tipos", () => {
  const r = blocosJsonLd(
    ld('{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"WebSite"},{"@type":["WebPage","MedicalWebPage"]}]}'),
  );
  assert.equal(r.estado, "valido");
  assert.deepEqual(r.tipos, ["Organization", "WebSite", "WebPage", "MedicalWebPage"]);
});

test("JSON malformado é `invalido`, NUNCA `ausente` — os consertos são opostos", () => {
  const r = blocosJsonLd(ld('{"@type":"Organization",}'));
  assert.equal(r.estado, "invalido", "escrever schema × achar a vírgula são trabalhos diferentes");
});

test("zero blocos é `ausente` com tipos vazios", () => {
  const r = blocosJsonLd("<html><body><p>nada</p></body></html>");
  assert.equal(r.estado, "ausente");
    assert.deepEqual(r.tipos, []);
});

test("um bloco válido ao lado de um quebrado deixa a página INVÁLIDA", () => {
  const r = blocosJsonLd(ld('{"@type":"Organization"}') + ld("{quebrado"));
  assert.equal(r.estado, "invalido", "o board mede 0 erros críticos: um erro não é apagado por um acerto ao lado");
  assert.deepEqual(r.tipos, ["Organization"]);
});

// ── A ordem das fontes de data É a regra ────────────────────────────────────

test("dateModified do JSON-LD vence article:modified_time, que vence <time>", () => {
  const html =
    ld('{"@type":"Article","dateModified":"2026-03-01T10:00:00Z"}') +
    '<meta property="article:modified_time" content="2025-02-02">' +
    '<time datetime="2024-01-01">antes</time>';
  assert.equal(dataDeclarada(html), "2026-03-01");
  assert.equal(
    dataDeclarada('<meta property="article:modified_time" content="2025-02-02"><time datetime="2024-01-01">x</time>'),
    "2025-02-02",
  );
  assert.equal(
    dataDeclarada('<time datetime="2024-01-01">x</time>'),
    "2024-01-01",
    "<time> por último: pode ser a data de um comentário",
  );
});

test("nenhuma das três fontes é null — nunca hoje, nunca zero", () => {
  assert.equal(dataDeclarada("<html><body><p>sem data</p></body></html>"), null);
});

// ── Links ───────────────────────────────────────────────────────────────────

test("linksDe devolve href e âncora limpa, inclusive com tag dentro da âncora", () => {
  const html = '<a href="/precos"> <span>Ver</span>  preços </a><a href=\'/blog\'>Blog</a><a href=/x>X</a>';
  assert.deepEqual(linksDe(html), [
    { href: "/precos", ancora: "Ver preços" },
    { href: "/blog", ancora: "Blog" },
    { href: "/x", ancora: "X" },
  ]);
});

// ── D12: vazia ≠ dependente de JS ───────────────────────────────────────────

test("com texto é com-conteudo; casca de SPA é js-dependente; nada é sem-conteudo", () => {
  const comTexto = "<p>uma duas tres quatro cinco seis sete oito nove dez onze</p>";
  assert.equal(estadoDoConteudo(comTexto, 11), "com-conteudo");
  assert.equal(
    estadoDoConteudo('<html><body><div id="root"></div><script src="/assets/x.js"></script></body></html>', 0),
    "js-dependente",
    "SPA vazia ATRASA a indexação; colapsar com sem-conteudo troca o diagnóstico",
  );
  assert.equal(estadoDoConteudo("<html><body></body></html>", 0), "sem-conteudo");
});

// ── extrair(): a contradição do D-84 como invariante ────────────────────────

test("extrair NÃO devolve palavras: 0 numa página que tem <h1>", () => {
  const r = extrair(MINIFICADO, 2026);
  assert.ok(r.palavras > 0, "a contradição interna que denunciou o D-84 é a asserção");
  assert.equal(r.titulo, "x");
  assert.equal(r.metodo, METODO_LARGURA);
  assert.equal(r.schema.estado, "ausente");
  assert.equal(r.dataDeclarada, null);
  assert.equal(r.conteudo, "sem-conteudo");
  assert.deepEqual(r.links, []);
});

test("extrair preenche as 17 colunas sem inventar zero para campo ausente", () => {
  const r = extrair("<html><head></head><body><a href=\"/a\">A</a></body></html>", 2026);
  assert.equal(r.titulo, null, "titulo ausente é null, não string vazia");
  assert.equal(r.larguraPx, null, "sem título não há largura — 0 px seria um título que cabe");
  assert.equal(r.intencao, "ausente");
  assert.equal(r.dataDeclarada, null);
  assert.equal(r.links.length, 1);
});
