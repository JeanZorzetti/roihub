import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  benchmark,
  BENCHMARK,
  FAIXAS,
  faixaDaPosicao,
  porFaixaDePosicao,
  ctr,
  consultasUnicas,
  noTop20,
  impressoesNoTop3,
  urlsComImpressao,
  strikingDistance,
  ctrPorConsulta,
  conformidadeDeCtr,
  paginaNomeada,
  cliquesNaoCapturados,
  LIMIAR_PAGINAS_DECIDIDAS,
  termoPrincipal,
  canibalizacao,
  kpisPorTermo,
  kpisPorPagina,
  activeIndexRatio,
  queryToPageRatio,
  totalImpressoes,
} from "../lib/kpis-busca.mjs";
import { descoberta } from "../lib/janelas.mjs";
import { vereditoContraFaixa } from "../lib/intervalo.mjs";

const JANELA = descoberta(Date.parse("2026-09-20T12:00:00Z"));

const l = (query, page, impressoes, cliques, posicao) => ({ query, page, impressoes, cliques, posicao });
// 032 — a linha da OUTRA leitura. Campo `pagina`, sem `query`: é o que torna as duas famílias
// disjuntas para o compilador no chamador tipado.
const pg = (pagina, impressoes, cliques, posicao) => ({ pagina, impressoes, cliques, posicao });

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
// 033 — o módulo deixou de ser "zero imports": importa lib/intervalo.mjs, que é FOLHA (zero
// imports por sua vez), então continua sem process.env/pg/fetch/google-auth-library na árvore.
// A trava passa a permitir EXATAMENTE este import, e reprova qualquer outro.
test("módulo é puro: sem process.env, sem Date.now(), e o único import é a folha lib/intervalo.mjs", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/kpis-busca.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  assert.doesNotMatch(src, /Date\.now\(\)/, "módulo puro não pode ler relógio");
  const imports = [...src.matchAll(/^import .*$/gm)];
  assert.equal(imports.length, 1, "exatamente um import — a folha de intervalo.mjs");
  assert.match(imports[0][0], /from ["']\.\/intervalo\.mjs["']/, "o único import permitido é a folha lib/intervalo.mjs");
});

// ── benchmark: CADA borda de faixa, uma a uma ───────────────────────────────────────────────
test("as bordas das faixas de benchmark caem do lado certo", () => {
  // A posição do GSC é uma MÉDIA: 3,9 e 4,0 existem os dois e vão para faixas diferentes.
  assert.equal(benchmark(1.0), 0.25);
  assert.equal(benchmark(1.9), 0.25);
  assert.equal(benchmark(2.0), 0.13);
  assert.equal(benchmark(2.9), 0.13);
  assert.equal(benchmark(3.0), 0.08);
  assert.equal(benchmark(3.9), 0.08);
  assert.equal(benchmark(4.0), 0.045);
  assert.equal(benchmark(6.9), 0.045);
  assert.equal(benchmark(7.0), 0.02);
  assert.equal(benchmark(10.9), 0.02);
});

test("acima de 10,9 não há benchmark — devolve null, nunca um piso inventado", () => {
  // Um piso arbitrário aqui faria a cauda longa inteira aparecer reprovada, e o CTR Gap
  // passaria a medir o palpite em vez do site.
  assert.equal(benchmark(11.0), null);
  assert.equal(benchmark(45), null);
});

test("posição inválida não recebe benchmark", () => {
  assert.equal(benchmark(0), null);
  assert.equal(benchmark(NaN), null);
  assert.equal(benchmark(undefined), null);
});

test("as faixas não têm buraco nem sobreposição entre 1,0 e 10,9", () => {
  for (let p = 1.0; p < 11; p = Math.round((p + 0.1) * 10) / 10) {
    assert.notEqual(benchmark(p), null, `posição ${p} ficou sem faixa`);
  }
});

// ── ctr ─────────────────────────────────────────────────────────────────────────────────────
test("CTR sem impressão é null, NUNCA 0", () => {
  // 0% diria "essa página tem desempenho ruim"; a verdade é que ninguém a viu.
  assert.equal(ctr(0, 0), null);
  assert.notEqual(ctr(0, 0), 0);
  assert.equal(ctr(5, 100), 0.05);
});

// ── strikingDistance ────────────────────────────────────────────────────────────────────────
test("striking distance pega 4,0 a 10,9 e exclui as bordas de fora", () => {
  const linhas = [
    l("a", "/a", 100, 1, 3.9),
    l("b", "/b", 100, 1, 4.0),
    l("c", "/c", 100, 1, 10.9),
    l("d", "/d", 100, 1, 11.0),
  ];
  assert.deepEqual(
    strikingDistance(linhas).lista.map((x) => x.query),
    ["b", "c"]
  );
});

test("striking distance ordena por impressões, não por posição", () => {
  const linhas = [l("pouca", "/a", 10, 0, 4.1), l("muita", "/b", 900, 2, 9.8)];
  assert.equal(strikingDistance(linhas).lista[0].query, "muita");
});

test("striking distance sem candidata devolve lista vazia (a tela precisa distinguir do erro)", () => {
  assert.deepEqual(strikingDistance([l("a", "/a", 100, 1, 2.0)]).lista, []);
});

// 027 — A FILA DE TRABALHO NÃO MANDA TRABALHAR A PRÓPRIA MARCA.
//
// Medido na atma em 18/09, propriedade nova de usealigner.com: a ÚNICA linha da faixa 4,0–10,9 era
// "atma aligner" (posição 4,2, 6 impressões), encabeçando uma lista que se apresenta como "a que
// rende mais". A guarda já existia em canibalizacao() desde a 025 e não tinha sido dada à irmã.
test("striking distance tira a MARCA da fila e conta quantas saíram", () => {
  const r = strikingDistance(marcadas, ehMarca);
  // A fila é por query+page — a mesma consulta em duas URLs são DUAS linhas de trabalho, ao
  // contrário de canibalizacao(), que agrupa por consulta. Das 3 linhas na faixa, uma é marca.
  assert.equal(r.lista.length, 2);
  assert.ok(
    r.lista.every((c) => !ehMarca(c.query)),
    "só as genéricas sobram: reforço de conteúdo não move o próprio nome",
  );
  assert.equal(r.removidas, 1);
});

test("striking distance sem `ehMarca` fica INTACTA e removidas é null", () => {
  const r = strikingDistance(marcadas);
  assert.equal(r.lista.length, 3, "as 3 linhas da faixa, marca inclusa");
  assert.equal(r.removidas, null, "null é não-declarada, e não declarada-e-nada-casou");
});

// O caso REAL da atma: a faixa inteira era marca, e a lista esvazia. A tela precisa poder dizer
// "eram todas de marca" em vez de "o site não tem posição nenhuma" — dois diagnósticos opostos.
test("faixa que era SÓ marca esvazia a lista com removidas > 0, não com removidas 0", () => {
  const soMarca = [l("atma aligner", "/", 6, 0, 4.2)];
  const r = strikingDistance(soMarca, ehMarca);
  assert.deepEqual(r.lista, []);
  assert.equal(r.removidas, 1, "0 aqui diria 'nenhuma na faixa', que é outra causa");
});

// ── ctrPorConsulta ──────────────────────────────────────────────────────────────────────────
test("posição 2 com CTR 5% fica marcada como abaixo do benchmark", () => {
  const [r] = ctrPorConsulta([l("a", "/a", 100, 5, 2.0)]);
  assert.equal(r.benchmark, 0.13);
  assert.equal(r.atinge, false);
});

test("posição 8 com CTR 3% atinge o benchmark", () => {
  const [r] = ctrPorConsulta([l("a", "/a", 100, 3, 8.0)]);
  assert.equal(r.atinge, true);
});

test("linha sem benchmark tem atinge null — 'não medido' não é 'reprovado'", () => {
  const [r] = ctrPorConsulta([l("a", "/a", 100, 0, 40)]);
  assert.equal(r.benchmark, null);
  assert.equal(r.atinge, null);
  assert.notEqual(r.atinge, false);
});

// ── 033 — conformidadeDeCtr(): o veredito por intervalo substitui o piso fixo de impressões ───
test("conformidadeDeCtr exclui do denominador as URLs sem régua, e as indecisas não entram nem no numerador nem no denominador", () => {
  // /a: 30/100 na posição 2 (régua 13%) — amostra decide e ATINGE.
  // /b: posição 40 — sem régua, fora dos dois eixos.
  const c = conformidadeDeCtr([pg("/a", 100, 30, 2.0), pg("/b", 100, 0, 40)], JANELA);
  assert.equal(c.semRegua, 1, "a URL sem benchmark não entra no denominador");
  assert.equal(c.porPagina.decididas, 1);
  assert.equal(c.porPagina.fracao, 1);
});

test("conformidadeDeCtr com lista vazia: todos os contadores em zero, frações null", () => {
  const c = conformidadeDeCtr([], JANELA);
  assert.equal(c.porPagina.fracao, null);
  assert.equal(c.porTrafego.fracao, null);
  assert.equal(c.indecisas, 0);
  assert.equal(c.semRegua, 0);
  assert.equal(c.semImpressao, 0);
  assert.equal(c.nomeada, null, "FR-013 — zero página decidida não publica nomeada");
});

// SC-001/SC-002 — o caso que abriu a spec: 0/21 na Posição 1 DECIDE contra 25% (abaixo), e 3/105
// nas Posições 4 a 6 NÃO decide contra 4,5% (indecisa) — o piso fixo tratava os dois igual.
test("SC-001/SC-002 — 0/21 na posição 1 decide (abaixo); 3/105 nas posições 4 a 6 não decide", () => {
  const c = conformidadeDeCtr([pg("/pos1", 21, 0, 1.0), pg("/pos456", 105, 3, 5.0)], JANELA);
  assert.equal(c.porPagina.decididas, 1, "só a posição 1 decide — a outra é indecisa");
  assert.equal(c.indecisas, 1);
});

// 032 — O CASO QUE ABRIU A SPEC. A home da Atma sai na posição 11,82 pela leitura por TERMO (fora
// da faixa do balizador, que acaba em 10,9) e na 6,93 pela leitura por PÁGINA, com 22,49% de CTR.
test("conformidadeDeCtr: a página em 6,93 com 22,49% entra no denominador e atinge a régua", () => {
  const c = conformidadeDeCtr([pg("/", 578, 130, 6.93), pg("/precos", 448, 13, 11.82)], JANELA);
  assert.equal(c.semRegua, 1, "a de 11,82 está fora da faixa do balizador e não entra");
  assert.equal(c.porPagina.decididas, 1);
  assert.equal(c.porPagina.fracao, 1, "a de 6,93 atinge a régua de 4,5% da faixa dela");
  assert.deepEqual(c.abaixo, [], "fora da faixa NÃO é reprovada: 'não medido' e 'abaixo' pedem trabalho oposto");
});

// 032/D3 — NENHUMA agregação aqui. Cada linha JÁ é uma URL; recalcular `posição × impressões ÷
// impressões` reintroduziria a deriva de ponto flutuante que a 031 removeu. E a faixa acaba em
// 10,9: um `11,000000000000002` cai fora dela e a página some do denominador sem nada ter mudado.
test("conformidadeDeCtr não re-agrega: a posição sai como entrou, sem deriva de ponto flutuante", () => {
  // impressões altas o bastante para o intervalo decidir contra a régua de 3,9 (4,5%)
  const c = conformidadeDeCtr([pg("/p", 1146, 0, 3.9)], JANELA);
  assert.equal(c.abaixo[0].posicao, 3.9, "3.8999999999999995 é a deriva que a 031 removeu");
  assert.equal(c.abaixo[0].url, "/p", "o campo de saída continua url — é o nome que a lista 'abaixo' já renderiza");
  assert.equal(conformidadeDeCtr([pg("/borda", 5000, 0, 10.9)], JANELA).semRegua, 0, "10,9 é o último ponto da faixa e tem de entrar");
});

// ── paginaNomeada — FR-012 ──────────────────────────────────────────────────────────────────
test("paginaNomeada escolhe a MAIOR impressão entre as decididas, não a pior", () => {
  const decididas = [
    { url: "/pequena", cliques: 0, impressoes: 100, posicao: 2.0, ctr: 0, regua: 0.13, veredito: "abaixo" },
    { url: "/grande", cliques: 200, impressoes: 1000, posicao: 2.0, ctr: 0.2, regua: 0.13, veredito: "atinge" },
  ];
  const n = paginaNomeada(decididas, 1100);
  assert.equal(n.url, "/grande");
  assert.equal(n.veredito, "atinge", "se a maior atinge, a frase diz isso — não vira 'a pior'");
  assert.equal(n.participacao, 1000 / 1100);
});

test("paginaNomeada: empate de impressões resolve pela URL alfabeticamente menor", () => {
  const decididas = [
    { url: "zebra", cliques: 0, impressoes: 100, posicao: 2.0, ctr: 0, regua: 0.13, veredito: "abaixo" },
    { url: "abelha", cliques: 0, impressoes: 100, posicao: 2.0, ctr: 0, regua: 0.13, veredito: "abaixo" },
  ];
  assert.equal(paginaNomeada(decididas, 200).url, "abelha");
});

test("paginaNomeada: decididas vazio devolve null (FR-013)", () => {
  assert.equal(paginaNomeada([], 0), null);
});

// SC-009 — a página nomeada real da Atma em 20/09/2026.
test("paginaNomeada — SC-009: /blog/quanto-custa-alinhador-invisivel, 94% do tráfego decidível, 155 cliques faltantes", () => {
  const decididas = [{ url: "/blog/quanto-custa-alinhador-invisivel", cliques: 275, impressoes: 21500, posicao: 7.343047498187092, ctr: 275 / 21500, regua: 0.02, veredito: "abaixo" }];
  const n = paginaNomeada(decididas, 22899);
  assert.ok(Math.abs(n.participacao - 0.939) < 0.001);
  assert.equal(n.cliquesFaltantes, 155);
});

// ── cliquesNaoCapturados — migrada de lib/gsc-delta.mjs (T016) ─────────────────────────────
test("cliques não capturados: aritmética de um degrau, e null quando já cobre", () => {
  assert.equal(cliquesNaoCapturados({ impressoes: 1240, ctr: 0.05, benchmark: 0.13 }), 1240 * 0.08);
  assert.equal(cliquesNaoCapturados({ impressoes: 1000, ctr: 0.2, benchmark: 0.13 }), null);
  assert.equal(cliquesNaoCapturados({ impressoes: 0, ctr: 0.05, benchmark: 0.13 }), null);
  assert.equal(cliquesNaoCapturados(null), null);
  // SC-009: 21.500 × 2,00% = 430 esperados − 275 medidos = 155 faltantes.
  assert.equal(cliquesNaoCapturados({ impressoes: 21500, ctr: 275 / 21500, benchmark: 0.02 }), 155);
});

// ── LIMIAR_PAGINAS_DECIDIDAS — derivado, não escolhido (FR-012) ────────────────────────────
test("LIMIAR_PAGINAS_DECIDIDAS: 1/n não atravessa os 5 pontos da faixa, e 1/(n-1) atravessaria", () => {
  // No limiar exato uma página só alcança a BORDA da faixa (75% a 80%), nunca a atravessa —
  // por isso <=, não <; um n menor (n-1) já atravessaria (>=).
  assert.ok(1 / LIMIAR_PAGINAS_DECIDIDAS <= 0.05);
  assert.ok(1 / (LIMIAR_PAGINAS_DECIDIDAS - 1) >= 0.05);
});

// ── FAIXAS/faixaDaPosicao — derivadas de BENCHMARK, nunca uma segunda lista (US2) ──────────
test("FAIXAS: cada degrau de BENCHMARK tem uma faixa correspondente (de/ate/regua), nos dois sentidos", () => {
  for (let i = 0; i < BENCHMARK.length; i++) {
    const de = i === 0 ? 1 : BENCHMARK[i - 1].ate;
    const f = FAIXAS[i];
    assert.equal(f.de, de, `FAIXAS[${i}].de diverge do degrau anterior de BENCHMARK`);
    assert.equal(f.ate, BENCHMARK[i].ate, `FAIXAS[${i}].ate diverge de BENCHMARK[${i}].ate`);
    assert.equal(f.regua, BENCHMARK[i].ctr, `FAIXAS[${i}].regua diverge de BENCHMARK[${i}].ctr`);
  }
  // sentido inverso: toda FAIXA com regua não-null tem que existir em BENCHMARK
  for (const f of FAIXAS) {
    if (f.regua === null) continue;
    assert.ok(BENCHMARK.some((b) => b.ctr === f.regua), `FAIXAS regua=${f.regua} não existe em BENCHMARK`);
  }
});

test("FAIXAS: a sexta é declarada (Página 2), sem fonte em BENCHMARK, e o rótulo nomeia a própria faixa", () => {
  assert.equal(FAIXAS.length, 6);
  const pagina2 = FAIXAS[5];
  assert.equal(pagina2.regua, null);
  assert.match(pagina2.rotulo, /11/);
  assert.match(pagina2.rotulo, /20/);
  // rótulo é autoral: cada rótulo nomeia de/ate-1, e não é derivável de BENCHMARK
  for (const f of FAIXAS.slice(0, 5)) {
    if (f.ate - 1 > f.de) assert.match(f.rotulo, new RegExp(String(f.ate - 1)), `${f.rotulo} não nomeia o fim da própria faixa`);
  }
});

test("faixaDaPosicao: fronteira exclusiva, nunca re-agregação — 11,000000000000002 cai na página 2", () => {
  assert.equal(faixaDaPosicao(11.000000000000002).rotulo, "Página 2 (11 a 20)");
  assert.equal(faixaDaPosicao(1.0).rotulo, "Posição 1");
  assert.equal(faixaDaPosicao(6.999999999).rotulo, "Posições 4 a 6");
  assert.equal(faixaDaPosicao(7.0).rotulo, "Posições 7 a 10");
});

test("faixaDaPosicao: acima de 20,0 é null — as seis faixas do board não vão além da página 2", () => {
  assert.equal(faixaDaPosicao(20.5), null);
  assert.equal(faixaDaPosicao(45), null);
  assert.equal(faixaDaPosicao(0), null);
  assert.equal(faixaDaPosicao(NaN), null);
});

test("porFaixaDePosicao devolve SEMPRE as seis, mesmo sem impressão, com janela em cada uma", () => {
  const r = porFaixaDePosicao([pg("/a", 100, 30, 2.0)], JANELA);
  assert.equal(r.length, 6);
  assert.ok(r.every((f) => f.janela === JANELA));
  const posicao1 = r.find((f) => f.rotulo === "Posição 1");
  assert.equal(posicao1.paginas, 0);
  assert.equal(posicao1.intervalo, null, "sem impressão não há intervalo");
  assert.equal(posicao1.veredito, null);
  const posicao2 = r.find((f) => f.rotulo === "Posição 2");
  assert.equal(posicao2.paginas, 1);
  assert.equal(posicao2.veredito, "atinge");
});

test("porFaixaDePosicao: nenhuma página em duas faixas, e a soma bate com o total de URLs com impressão", () => {
  const paginas = [pg("/a", 100, 30, 2.0), pg("/b", 50, 0, 15.0), pg("/c", 30, 0, 25.0)];
  const r = porFaixaDePosicao(paginas, JANELA);
  const somaDentro = r.reduce((a, f) => a + f.paginas, 0);
  // /c está em 25,0 — acima de 20,0, fora das seis faixas.
  assert.equal(somaDentro, 2);
  const pagina2 = r.find((f) => f.rotulo === "Página 2 (11 a 20)");
  assert.equal(pagina2.regua, null);
  assert.equal(pagina2.veredito, null, "sem régua não há veredito, nunca 'indecisa'");
  assert.ok(pagina2.amostra.impressoes > 0, "o CTR real continua visível mesmo sem régua");
});

// 032/SC-001 — as 29 páginas da Atma na janela medida (2026-08-20 → 2026-09-16), como `gscPaginas`
// as devolve depois da soma dos hosts declarados: 24.664 impressões e 434 cliques, o site inteiro.
// A tela publicava 0% com 6 avaliadas, porque a leitura por termo via 42,1% disso.
const PAGINAS_ATMA_JANELA = [
  pg("/blog/quanto-custa-alinhador-invisivel", 22064, 282, 7.343047498187092),
  pg("/blog/alinhadores-vs-aparelho-fixo", 820, 0, 9.636585365853659),
  pg("/", 578, 130, 6.92560553633218),
  pg("/pacientes/precos", 448, 13, 17.129464285714285),
  pg("/blog/invisalign-vs-alinhadores-nacionais", 442, 5, 7.552036199095022),
  pg("/pacientes/agendar", 148, 0, 7.668918918918919),
  pg("/pacientes/enviar-exames", 65, 1, 6.676923076923077),
  pg("/pacientes/antes-depois", 13, 1, 20.923076923076923),
  pg("/ortodontistas/qualidade-alemao", 13, 0, 4.076923076923077),
  pg("/pacientes", 11, 1, 3.909090909090909),
  pg("/blog/quanto-custa-o-alinhador-invisivel", 11, 0, 1.1818181818181819),
  pg("/pacientes/tratamento", 9, 0, 31.88888888888889),
  pg("/tecnologia", 9, 1, 4.111111111111111),
  pg("/sobre", 5, 0, 6.2),
  pg("/blog/bruxismo-causas-sintomas-tratamento", 4, 0, 57.75),
  pg("/blog/ortodontia-invisivel-adultos", 4, 0, 39.25),
  pg("/ortodontistas/vantagens", 4, 0, 6.5),
  pg("/ortodontistas/modelos-parceria", 3, 0, 4.333333333333334),
  pg("/blog/alinhador-invisivel-funciona", 2, 0, 2),
  pg("/ortodontistas/tecnologia", 2, 0, 1),
  pg("/blog/3", 1, 0, 2),
  pg("/blog/dor-cabeca-ma-oclusao", 1, 0, 4),
  pg("/pacientes/faq", 1, 0, 5),
  pg("/blog/atma-invisalign-clearcorrect-preco", 1, 0, 1),
  pg("/blog/invisalign-vs-alinhadores-nacionais/", 1, 0, 1),
  pg("/blog/produto/quanto-custa-alinhador-invisivel", 1, 0, 1),
  pg("/blog/quanto-custa-a-alinha-invisivel", 1, 0, 1),
  pg("/blog/quanto-custa-a-alinhador-invisivel", 1, 0, 1),
  pg("/blog/quanto-custam-alinhadores-invisiveis-2026", 1, 0, 1),
];

test("conformidadeDeCtr sobre as páginas da janela medida: o site inteiro entra, não os 10.395 da leitura por termo", () => {
  assert.equal(totalImpressoes(PAGINAS_ATMA_JANELA), 24664, "a base é o site inteiro, não os 10.395 da leitura por termo");
  const c = conformidadeDeCtr(PAGINAS_ATMA_JANELA, JANELA);
  const home = PAGINAS_ATMA_JANELA.find((p) => p.pagina === "/");
  assert.ok(
    ctr(home.cliques, home.impressoes) >= benchmark(home.posicao),
    "a home é avaliada e ATINGE — pela leitura por termo ela saía em 11,82 e nem entrava no denominador",
  );
  assert.equal(c.abaixo.some((u) => u.url === "/"), false);
});

// 033/SC-003/SC-007/SC-009/SC-010 — o caso de referência da Atma em 20/09/2026, reconstruído com
// os mesmos números que `research.md`/`data-model.md` publicam: 4 decididas (1 atinge, 3 abaixo,
// entre elas a página nomeada), 20 indecisas, 5 sem régua, 0 sem impressão — 29 URLs no total.
const ATMA_20_09 = [
  pg("/blog/quanto-custa-alinhador-invisivel", 21500, 275, 7.343047498187092), // nomeada, abaixo
  pg("/pacientes/precos", 583, 20, 8.0), // atinge
  pg("/a-abaixo-1", 400, 0, 1.5), // abaixo, decisivo
  pg("/a-abaixo-2", 416, 0, 1.8), // abaixo, decisivo
  ...Array.from({ length: 20 }, (_, i) => pg(`/indecisa-${i}`, 1, 0, 5.0)), // n=1: nunca decide
  ...Array.from({ length: 5 }, (_, i) => pg(`/cauda-longa-${i}`, 50, 0, 15.0)), // posição > 10,9: sem régua
];

test("conformidadeDeCtr — caso de referência da Atma (20/09/2026): porPagina 25% (1 de 4), porTrafego 2,5% (583 de 22.899), 20 indecisas, 5 sem régua", () => {
  const c = conformidadeDeCtr(ATMA_20_09, JANELA);
  assert.equal(ATMA_20_09.length, 29);
  assert.equal(c.porPagina.decididas, 4);
  assert.equal(c.porPagina.atingem, 1);
  assert.equal(c.porPagina.fracao, 0.25);
  assert.deepEqual(c.porPagina.meta, [0.75, 0.8]);
  assert.equal(c.porTrafego.impressoesQueAtingem, 583);
  assert.equal(c.porTrafego.impressoesDecididas, 22899);
  assert.ok(Math.abs(c.porTrafego.fracao - 0.025) < 0.001);
  assert.equal(c.porTrafego.meta, null, "FR-010 — o board nunca definiu meta para a leitura por tráfego");
  assert.equal(c.indecisas, 20);
  assert.equal(c.semRegua, 5);
  assert.equal(c.semImpressao, 0);
  // Invariante da FR-011/data-model §4: as quatro contagens somam o total de páginas.
  assert.equal(c.porPagina.decididas + c.indecisas + c.semRegua + c.semImpressao, ATMA_20_09.length);
  assert.ok(c.porPagina.atingem <= c.porPagina.decididas);
  assert.equal(c.nomeada.url, "/blog/quanto-custa-alinhador-invisivel");
  assert.equal(c.nomeada.cliquesFaltantes, 155);
  assert.ok(Math.abs(c.nomeada.participacao - 0.939) < 0.001);
});

// ── contagens ───────────────────────────────────────────────────────────────────────────────
test("consultas únicas vem SEMPRE marcada como piso", () => {
  // A dimensão `query` do GSC omite as raras: 5 contra 33 medidos no tapepro.
  const c = consultasUnicas([l("a", "/a", 10, 0, 5), l("a", "/b", 10, 0, 6), l("b", "/a", 10, 0, 7)]);
  assert.equal(c.valor, 2);
  assert.equal(c.piso, true);
});

test("Top 20 conta consultas distintas dentro de 1,0-20,0", () => {
  assert.equal(noTop20([l("a", "/a", 10, 0, 20.0), l("b", "/b", 10, 0, 20.1)]), 1);
});

test("% de impressões no Top 3 usa 1,0-3,9, e devolve fracao/noTop3/total", () => {
  const r = impressoesNoTop3([l("a", "/a", 75, 0, 3.9), l("b", "/b", 25, 0, 4.0)]);
  assert.equal(r.fracao, 0.75);
  assert.equal(r.noTop3, 75);
  assert.equal(r.total, 100);
});

test("% de impressões no Top 3 sem impressão devolve null, não NaN", () => {
  assert.equal(impressoesNoTop3([]), null);
  assert.equal(impressoesNoTop3([l("a", "/a", 0, 0, 2)]), null);
});

// 033/US3/AS-1 — o piso fixo de impressões sai também daqui: quem decide se a amostra exclui os
// 40% a 50% do board é `vereditoContraFaixa()`, aplicado sobre {noTop3, total}.
test("Top 3 — a amostra da Atma (3% em 22.899 impressões) DECIDE e exclui 40% com folga", () => {
  const linhas = [l("a", "/a", 686, 0, 2.0), l("b", "/b", 22213, 0, 15.0)];
  const top3 = impressoesNoTop3(linhas);
  assert.ok(Math.abs(top3.fracao - 0.03) < 0.001);
  assert.equal(vereditoContraFaixa(top3.noTop3, top3.total, [0.4, 0.5]), "abaixo");
});

test("Top 3 — amostra pequena NÃO decide: o número sai com a base e sem veredito (AS-1)", () => {
  const linhas = [l("a", "/a", 2, 0, 2.0), l("b", "/b", 3, 0, 15.0)];
  const top3 = impressoesNoTop3(linhas);
  assert.equal(vereditoContraFaixa(top3.noTop3, top3.total, [0.4, 0.5]), "indecisa");
});

test("URLs com impressão é CONTAGEM — o denominador de indexadas não existe", () => {
  assert.equal(urlsComImpressao([pg("/x", 10, 0, 5), pg("/y", 0, 0, 8)]), 1, "/y tem 0 impressões e não conta");
});

// ── canibalização ───────────────────────────────────────────────────────────────────────────
test("consulta em 2+ URLs aparece na canibalização", () => {
  const { lista, removidas } = canibalizacao([l("preco", "/a", 100, 1, 6.0), l("preco", "/b", 50, 0, 14.0)]);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].consulta, "preco");
  assert.equal(lista[0].urls.length, 2);
  assert.equal(lista[0].urls[0].url, "/a", "a URL com mais impressões vem primeiro");
  assert.equal(removidas, null, "sem lista de marca declarada, `removidas` é null e nunca 0");
});

test("consulta com URL única NÃO aparece na canibalização", () => {
  assert.deepEqual(canibalizacao([l("preco", "/a", 100, 1, 6.0)]).lista, []);
});

test("a mesma URL repetida na mesma consulta não é canibalização", () => {
  assert.deepEqual(canibalizacao([l("preco", "/a", 100, 1, 6.0), l("preco", "/a", 20, 0, 7.0)]).lista, []);
});

// ── os dois agregadores ─────────────────────────────────────────────────────────────────────
test("lista vazia não estoura em nenhum KPI", () => {
  const k = kpisPorTermo([]);
  assert.equal(k.consultasUnicas.valor, 0);
  assert.equal(k.noTop20, 0);
  assert.equal(k.impressoesNoTop3, null);
  assert.deepEqual(k.strikingDistance.lista, []);
  assert.equal(k.strikingDistance.removidas, null);
  assert.deepEqual(k.canibalizacao.lista, []);
  const kp = kpisPorPagina([], null, JANELA);
  assert.equal(kp.urlsComImpressao, 0);
  assert.equal(kp.conformidade.porPagina.fracao, null);
  assert.equal(kp.conformidade.nomeada, null);
  assert.equal(kp.faixas.length, 6);
  assert.equal(kp.activeIndexRatio, null);
});

// 032/SC-004 — A TRAVA. Nenhuma medida por termo pode mudar de valor com esta feature. Os números
// abaixo são os de antes da migração, escritos à mão: comparar contra a própria função provaria só
// que o agregador a chama, e é justamente a função que a migração poderia ter trocado de leitura.
test("kpisPorTermo devolve os MESMOS valores de antes da 032", () => {
  const linhas = [
    l("alinhador preco", "/a", 100, 10, 2.0),
    l("alinhador preco", "/b", 50, 1, 6.0),
    l("alinhador invisivel", "/a", 40, 0, 5.0),
    l("atma aligner", "/a", 10, 5, 1.5),
    l("cauda longa", "/c", 5, 0, 30.0),
  ];
  const k = kpisPorTermo(linhas);
  assert.equal(k.consultasUnicas.valor, 4);
  assert.equal(k.consultasUnicas.piso, true);
  assert.equal(k.noTop20, 3, "a de posição 30 fica fora");
  assert.equal(k.impressoesNoTop3.fracao, 110 / 205);
  assert.equal(k.strikingDistance.lista.length, 2, "as de 6,0 e 5,0");
  assert.equal(k.strikingDistance.lista[0].page, "/b", "ordenadas por impressões");
  assert.equal(k.canibalizacao.lista.length, 1, "alinhador preco em /a e /b");
  assert.equal(k.canibalizacao.lista[0].impressoes, 150);
  // A fronteira em forma de teste: estas duas foram para a família por URL e não podem voltar.
  assert.equal("conformidade" in k, false, "a conformidade é por URL — contá-la na leitura por termo É o defeito da 032");
  assert.equal("urlsComImpressao" in k, false, "idem: a leitura por termo omite as raras e some com metade das URLs");
});

test("kpisPorPagina: sem denominador apurado, activeIndexRatio é null e a contagem fica", () => {
  const paginas = [pg("/a", 10, 1, 5), pg("/b", 0, 0, 8), pg("/c", 3, 0, 9)];
  const k = kpisPorPagina(paginas, null, JANELA);
  assert.equal(k.activeIndexRatio, null, "sem denominador apurado a tela volta à contagem, não inventa razão");
  assert.equal(k.urlsComImpressao, 2, "/b tem 0 impressões e não conta");
  assert.equal(k.conformidade.semImpressao, 1, "/b tem 0 impressões — nem indecisa, nem sem régua");
  assert.equal(k.conformidade.indecisas, 2, "amostras de 10 e 3 não excluem a régua da própria posição");
  assert.equal(kpisPorPagina(paginas, 4, JANELA).activeIndexRatio, 2 / 4);
});

// ── 022: as duas razões que estavam capadas por falta de denominador ─────────────────────────
test("activeIndexRatio é URLs com impressão ÷ indexadas", () => {
  assert.equal(activeIndexRatio([pg("/1", 15, 1, 5), pg("/2", 3, 0, 9)], 4), 2 / 4);
});

// FR-011: sem denominador a tela volta à CONTAGEM com o motivo. Uma razão com denominador chutado
// é falha, não detalhe — foi por isso que a 021 deixou este KPI como contagem.
test("sem denominador, as duas razões são null e nunca um número inventado", () => {
  // Cada uma com a leitura da SUA família (032/FR-001): a razão de índice ativo é por URL, e a de
  // consultas por URL indexada tem `consultasUnicas` no numerador, então continua por termo.
  for (const d of [0, null, undefined, -3, NaN]) {
    assert.equal(activeIndexRatio([pg("/1", 10, 1, 5)], d), null, `activeIndexRatio inventou razão com indexadas=${d}`);
    assert.equal(queryToPageRatio([l("a", "/1", 10, 1, 5)], d), null, `queryToPageRatio inventou razão com indexadas=${d}`);
  }
});

test("queryToPageRatio carrega o piso — o GSC omite as consultas raras", () => {
  const linhas = [l("a", "/1", 10, 1, 5), l("b", "/1", 5, 0, 8), l("a", "/2", 2, 0, 9)];
  const r = queryToPageRatio(linhas, 4);
  assert.equal(r.valor, 2 / 4);
  assert.equal(r.piso, true, "sem a flag a tela publica o piso como se fosse a razão real");
});

// 032 — a razão que passa de 1 é um denominador que não cobre o numerador, não um site excelente.
// Medido na Atma em 20/09/2026, depois de a família por URL migrar para a leitura por página:
// 29 URLs com impressão ÷ 18 indexadas = 161,1%, publicado ao lado de "meta do board: ≥ 70%".
test("activeIndexRatio devolve null quando há mais URLs com impressão do que indexadas", () => {
  const paginas = [pg("/1", 10, 1, 5), pg("/2", 3, 0, 9), pg("/3", 2, 0, 7)];
  assert.equal(activeIndexRatio(paginas, 2), null, "3 ÷ 2 = 150% leria como meta folgada");
  assert.equal(activeIndexRatio(paginas, 3), 1, "cobrir exatamente o numerador é razão válida");
  assert.equal(kpisPorPagina(paginas, 2, JANELA).urlsComImpressao, 3, "a contagem fica — é ela que volta à tela");
});

test("lista de linhas vazia com denominador válido é zero, não null — nada foi visto, mas foi medido", () => {
  assert.equal(activeIndexRatio([], 10), 0);
  assert.equal(queryToPageRatio([], 10).valor, 0);
});

// 032/FR-004 — o selo de piso NÃO sai das medidas por termo. Esta spec para de aplicar a ressalva
// onde ela não precisava existir; onde precisa, ela fica.
test("queryToPageRatio continua por termo e continua carregando o piso", () => {
  assert.equal(queryToPageRatio([l("a", "/1", 10, 1, 5), l("b", "/1", 5, 0, 8)], 4).piso, true);
});

// ── 024/D10: o termo principal da URL ───────────────────────────────────────

test("o termo é a consulta de maior IMPRESSÃO, não a de mais cliques nem a primeira da lista", () => {
  const linhas = [
    l("alinhador goiania", "/precos", 10, 9, 3),
    l("preco alinhador", "/precos", 900, 2, 8),
    l("clinica", "/precos", 50, 0, 12),
  ];
  assert.equal(termoPrincipal(linhas, "/precos"), "preco alinhador");
});

test("URL sem impressão devolve null — 'sem termo apurado', nunca 'termo ausente do título'", () => {
  const linhas = [l("a", "/precos", 10, 1, 5), l("b", "/blog", 0, 0, 40)];
  assert.equal(termoPrincipal(linhas, "/blog"), null, "impressão 0 não é termo");
  assert.equal(termoPrincipal(linhas, "/nao-existe"), null);
  assert.equal(termoPrincipal([], "/precos"), null);
});

test("empate de impressões resolve de forma determinística", () => {
  const linhas = [l("zebra", "/x", 10, 0, 5), l("abelha", "/x", 10, 0, 5)];
  assert.equal(termoPrincipal(linhas, "/x"), "abelha");
  assert.equal(termoPrincipal([...linhas].reverse(), "/x"), "abelha", "a ordem da lista mudou o termo");
});

// ── 025: a canibalização para de acusar a própria marca ─────────────────────────────────────
// Medido na atma em 07/09: `atma aligner` lista 8 URLs e NÃO é canibalização — busca de marca traz
// o site inteiro por construção. Sem o filtro, a lista de trabalho aponta para um trabalho que não
// existe; sem a CONTAGEM do que saiu, sumir em silêncio é indistinguível de filtro largo demais.
const marcadas = [
  l("atma aligner", "/a", 100, 5, 2.0),
  l("atma aligner", "/b", 80, 1, 6.0),
  l("alinhador invisivel preco", "/x", 60, 2, 5.0),
  l("alinhador invisivel preco", "/y", 40, 0, 9.0),
];
const ehMarca = (q) => /\b(atma aligner|atma)\b/i.test(q);

test("sem `ehMarca`, a lista fica INTACTA e removidas é null (FR-013)", () => {
  const r = canibalizacao(marcadas);
  assert.equal(r.lista.length, 2);
  assert.equal(r.removidas, null, "null é nao-declarada, e nao declarada-e-nada-casou");
});

test("com `ehMarca`, a consulta de marca sai da lista e vira CONTAGEM", () => {
  const r = canibalizacao(marcadas, ehMarca);
  assert.deepEqual(
    r.lista.map((c) => c.consulta),
    ["alinhador invisivel preco"],
  );
  assert.equal(r.removidas, 1);
});

// A consulta genérica com duas URLs é a linha que IMPORTA — se o filtro a levasse junto, a feature
// teria trocado uma ressalva por um apagamento.
test("consulta genérica com duas URLs CONTINUA na lista", () => {
  const r = canibalizacao(marcadas, ehMarca);
  assert.ok(r.lista.some((c) => c.consulta === "alinhador invisivel preco"));
  assert.equal(r.lista[0].urls.length, 2);
});

// `0` e `null` dizem coisas opostas: um é "curei a lista e nada casou", o outro é "ninguém curou".
test("removidas 0 (declarada, nada casou) NÃO é removidas null (não declarada)", () => {
  const semMarcaNaLista = [l("preco", "/a", 100, 1, 6.0), l("preco", "/b", 50, 0, 14.0)];
  assert.equal(canibalizacao(semMarcaNaLista, ehMarca).removidas, 0);
  assert.equal(canibalizacao(semMarcaNaLista).removidas, null);
  assert.notEqual(canibalizacao(semMarcaNaLista, ehMarca).removidas, canibalizacao(semMarcaNaLista).removidas);
});

test("a ordenação por impressões não muda com o filtro ligado", () => {
  const linhas = [
    l("b", "/1", 10, 0, 5),
    l("b", "/2", 10, 0, 6),
    l("a", "/3", 500, 0, 5),
    l("a", "/4", 500, 0, 6),
  ];
  assert.deepEqual(
    canibalizacao(linhas, ehMarca).lista.map((c) => c.consulta),
    ["a", "b"],
  );
});

test("kpisPorTermo repassa o `ehMarca` em vez de filtrar por conta própria", () => {
  const k = kpisPorTermo(marcadas, ehMarca);
  assert.equal(k.canibalizacao.removidas, 1);
  assert.equal(k.canibalizacao.lista.length, 1);
  assert.equal(kpisPorTermo(marcadas).canibalizacao.removidas, null);
});

// 027 — o repasse tem que alcançar as DUAS listas de trabalho. Dar o filtro a uma só foi como a
// marca voltou a encabeçar o Striking distance depois de já ter sido tirada da vizinha.
test("kpisPorTermo repassa `ehMarca` para as DUAS listas, não só para canibalizacao", () => {
  const k = kpisPorTermo(marcadas, ehMarca);
  assert.equal(k.strikingDistance.removidas, 1, "a fila também é lista de trabalho");
  assert.equal(k.canibalizacao.removidas, 1);
  assert.ok(
    k.strikingDistance.lista.every((c) => !ehMarca(c.query)),
    "nenhuma consulta de marca pode sobrar na fila",
  );
});

// 033/FR-009 — o piso fixo de impressões do veredito do Top 3 (026) SAIU do repositório inteiro:
// a suficiência de amostra passou a ser decidida pelo intervalo de Wilson, testado em
// `test/intervalo.test.mjs` (`vereditoContraFaixa`) e usado pela tela via `impressoesNoTop3()`
// acima — não há mais constante nem teste próprios aqui.

test("totalImpressoes é o denominador que acompanha a fração", () => {
  const linhas = [
    { query: "a", page: "/x", cliques: 1, impressoes: 20, posicao: 2 },
    { query: "b", page: "/y", cliques: 0, impressoes: 6, posicao: 9 },
  ];
  assert.equal(totalImpressoes(linhas), 26);
  assert.equal(totalImpressoes([]), 0);
  assert.equal(totalImpressoes(null), 0);
  // A fração do Top 3 lida contra ESSE total: 20 de 26.
  assert.equal(impressoesNoTop3(linhas).fracao, 20 / 26);
});
