import test from "node:test";
import assert from "node:assert/strict";
import { EVIDENCIAS, textoDoMain, frasesAlheias, numerosDoMapa } from "../lib/mapa-projeto.mjs";

// ── 052/T003 — as testemunhas puras da SC-002 (numeros) e SC-005 (alheio), research D12 ────────

test("frasesAlheias: as duas EVIDENCIAS de research D5 não reprovam — citam a Atma como medição", () => {
  const dimensao =
    "Leitura por PÁGINA (dimensão `page` do Search Console), somados os hosts declarados: é a dimensão que mede URL, e a fronteira que a 032 cobrou do compilador. A leitura por consulta×página omite as consultas raras — 42,1% das impressões da Atma — e com ela este índice publicava 0% sobre 6 URLs.";
  const testemunha =
    "A testemunha `scripts/conferir-soma-hosts.mjs atma <ini> <fim> --pagina` aplica o piso FIXO (CTR ≥ régua, sem exigir que a amostra decida) e imprimia 12,50% sobre 24 avaliadas em 20/09/2026, na mesma janela e sobre as mesmas linhas: é a regra anterior à 033, não uma divergência de leitura — as duas contam a mesma coisa e só uma exige significância.";
  assert.deepEqual(frasesAlheias(dimensao, "Atma", EVIDENCIAS), []);
  assert.deepEqual(frasesAlheias(testemunha, "Atma", EVIDENCIAS), []);
});

test("frasesAlheias: frase que AFIRMA algo sobre o projeto medido reprova", () => {
  const texto = "Tudo bem por aqui. O card da Atma não declara marca. Resto do texto.";
  assert.deepEqual(frasesAlheias(texto, "Atma", EVIDENCIAS), ["O card da Atma não declara marca."]);
});

test("frasesAlheias: não diferencia maiúsculas", () => {
  const texto = "Frase citando ATMA em caixa alta. Outra citando atma em minúscula.";
  assert.equal(frasesAlheias(texto, "Atma", EVIDENCIAS).length, 2);
});

test("numerosDoMapa: números pt-BR em ordem de aparição", () => {
  const texto = "… 1.234 impressões, 12,5% e posição 4,4 …";
  assert.deepEqual(numerosDoMapa(texto), ["1.234", "12,5%", "4,4"]);
});

test("numerosDoMapa: ignora os números do carimbo 'Apurado ao abrir a página, em …'", () => {
  const texto = "6 URLs medidas. Apurado ao abrir a página, em 21/09/2026, 14:32. Mais 1,5% adiante.";
  assert.deepEqual(numerosDoMapa(texto), ["6", "1,5%"]);
});

test("textoDoMain: só o texto visível de <main> — script, style e title ficam fora, a nota do <li> fica", () => {
  const html =
    '<html><head><title>Board GSC — Sirius</title><style>.x{color:red}</style></head>' +
    '<body><script>{"foo":"chunk-123"}</script>' +
    '<main><h1>Sirius CRM</h1><ul><li>Nota da folha X</li></ul><script>var x=1;</script></main>' +
    "<script>window.x=2</script></body></html>";
  const t = textoDoMain(html);
  assert.match(t, /Nota da folha X/);
  assert.doesNotMatch(t, /Board GSC/);
  assert.doesNotMatch(t, /color:red/);
  assert.doesNotMatch(t, /chunk-123/);
  assert.doesNotMatch(t, /var x=1/);
});

test("frasesAlheias: não parte a frase em 1.234 nem em .mjs", () => {
  const texto = "O total chegou a 1.234 impressões da Atma, medido por scripts/conferir.mjs em 20/09/2026.";
  const frases = frasesAlheias(texto, "Atma", []);
  assert.equal(frases.length, 1);
  assert.match(frases[0], /1\.234 impressões da Atma/);
  assert.match(frases[0], /conferir\.mjs/);
});
