import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  benchmark,
  ctr,
  consultasUnicas,
  noTop20,
  impressoesNoTop3,
  urlsComImpressao,
  strikingDistance,
  ctrPorConsulta,
  ctrGap,
  termoPrincipal,
  canibalizacao,
  kpisPorTermo,
  kpisPorPagina,
  activeIndexRatio,
  queryToPageRatio,
  PISO_IMPRESSOES_VEREDITO,
  totalImpressoes,
} from "../lib/kpis-busca.mjs";

const l = (query, page, impressoes, cliques, posicao) => ({ query, page, impressoes, cliques, posicao });
// 032 — a linha da OUTRA leitura. Campo `pagina`, sem `query`: é o que torna as duas famílias
// disjuntas para o compilador no chamador tipado.
const pg = (pagina, impressoes, cliques, posicao) => ({ pagina, impressoes, cliques, posicao });

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
test("módulo é puro: sem process.env, sem Date.now(), sem import", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/kpis-busca.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  assert.doesNotMatch(src, /Date\.now\(\)/, "módulo puro não pode ler relógio");
  assert.doesNotMatch(src, /^import /m, "módulo puro não importa nada");
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

// ── ctrPorConsulta / ctrGap ─────────────────────────────────────────────────────────────────
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

test("CTR Gap exclui do denominador as URLs sem benchmark", () => {
  // Duas páginas: uma no Top 3 que atinge, outra na posição 40 que nem tem régua.
  const g = ctrGap([pg("/a", 100, 30, 2.0), pg("/b", 100, 0, 40)]);
  assert.equal(g.avaliadas, 1, "a URL sem benchmark não entra no denominador");
  assert.equal(g.fracao, 1);
});

test("CTR Gap sem nenhuma URL avaliável devolve null, não 0%", () => {
  assert.equal(ctrGap([]), null);
  assert.equal(ctrGap([pg("/a", 100, 0, 40)]), null, "só URL sem benchmark = sem denominador");
});

// 032 — O CASO QUE ABRIU A SPEC. A home da Atma sai na posição 11,82 pela leitura por TERMO (fora
// da faixa do balizador, que acaba em 10,9) e na 6,93 pela leitura por PÁGINA, com 22,49% de CTR.
// A leitura incompleta expulsava do denominador justamente a única página que atinge o piso, e o
// veredito publicado virava 0% — pior que a ausência, porque um zero convida a agir no lugar errado.
test("CTR Gap: a página em 6,93 com 22,49% entra no denominador e atinge o piso", () => {
  const g = ctrGap([pg("/", 578, 130, 6.93), pg("/precos", 448, 13, 11.82)]);
  assert.equal(g.avaliadas, 1, "a de 11,82 está fora da faixa do balizador e não entra");
  assert.equal(g.fracao, 1, "a de 6,93 atinge o piso de 4,5% da faixa dela");
  assert.deepEqual(g.abaixo, [], "fora da faixa NÃO é reprovada: 'não medido' e 'abaixo' pedem trabalho oposto");
});

// 032/D3 — NENHUMA agregação aqui. Cada linha JÁ é uma URL; recalcular `posição × impressões ÷
// impressões` reintroduziria a deriva de ponto flutuante que a 031 removeu. E a faixa acaba em
// 10,9: um `11,000000000000002` cai fora dela e a página some do denominador sem nada ter mudado.
test("CTR Gap não re-agrega: a posição sai como entrou, sem deriva de ponto flutuante", () => {
  const g = ctrGap([pg("/p", 1146, 0, 3.9)]);
  assert.equal(g.abaixo[0].posicao, 3.9, "3.8999999999999995 é a deriva que a 031 removeu");
  assert.equal(g.abaixo[0].url, "/p", "o campo de saída continua url — é o nome que a lista 'abaixo' já renderiza");
  assert.equal(ctrGap([pg("/borda", 100, 0, 10.9)]).avaliadas, 1, "10,9 é o último ponto da faixa e tem de entrar");
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

test("CTR Gap sobre as páginas da janela medida: 12,5% com 24 avaliadas, a home entre elas", () => {
  const g = ctrGap(PAGINAS_ATMA_JANELA);
  assert.equal(g.avaliadas, 24, "5 das 29 páginas estão acima de 10,9 e ficam fora do denominador");
  assert.equal(g.fracao, 0.125, "3 das 24 atingem o piso da própria posição — a tela publicava 0% com 6");
  assert.equal(totalImpressoes(PAGINAS_ATMA_JANELA), 24664, "a base é o site inteiro, não os 10.395 da leitura por termo");
  const home = PAGINAS_ATMA_JANELA.find((p) => p.pagina === "/");
  assert.ok(
    ctr(home.cliques, home.impressoes) >= benchmark(home.posicao),
    "a home é avaliada e ATINGE — pela leitura por termo ela saía em 11,82 e nem entrava no denominador",
  );
  assert.equal(g.abaixo.some((u) => u.url === "/"), false);
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

test("% de impressões no Top 3 usa 1,0-3,9", () => {
  assert.equal(impressoesNoTop3([l("a", "/a", 75, 0, 3.9), l("b", "/b", 25, 0, 4.0)]), 0.75);
});

test("% de impressões no Top 3 sem impressão devolve null, não NaN", () => {
  assert.equal(impressoesNoTop3([]), null);
  assert.equal(impressoesNoTop3([l("a", "/a", 0, 0, 2)]), null);
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
  const kp = kpisPorPagina([], null);
  assert.equal(kp.urlsComImpressao, 0);
  assert.equal(kp.ctrGap, null);
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
  assert.equal(k.impressoesNoTop3, 110 / 205);
  assert.equal(k.strikingDistance.lista.length, 2, "as de 6,0 e 5,0");
  assert.equal(k.strikingDistance.lista[0].page, "/b", "ordenadas por impressões");
  assert.equal(k.canibalizacao.lista.length, 1, "alinhador preco em /a e /b");
  assert.equal(k.canibalizacao.lista[0].impressoes, 150);
  // A fronteira em forma de teste: estas duas foram para a família por URL e não podem voltar.
  assert.equal("ctrGap" in k, false, "o CTR Gap é por URL — contá-lo na leitura por termo É o defeito da 032");
  assert.equal("urlsComImpressao" in k, false, "idem: a leitura por termo omite as raras e some com metade das URLs");
});

test("kpisPorPagina: sem denominador apurado, activeIndexRatio é null e a contagem fica", () => {
  const paginas = [pg("/a", 10, 1, 5), pg("/b", 0, 0, 8), pg("/c", 3, 0, 9)];
  const k = kpisPorPagina(paginas, null);
  assert.equal(k.activeIndexRatio, null, "sem denominador apurado a tela volta à contagem, não inventa razão");
  assert.equal(k.urlsComImpressao, 2, "/b tem 0 impressões e não conta");
  assert.equal(k.ctrGap.avaliadas, 2, "as duas com impressão estão dentro da faixa do balizador");
  assert.equal(kpisPorPagina(paginas, 4).activeIndexRatio, 2 / 4);
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
  assert.equal(kpisPorPagina(paginas, 2).urlsComImpressao, 3, "a contagem fica — é ela que volta à tela");
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

// ── 026: o piso de impressões do veredito do Top 3 ──────────────────────────────────────────

test("PISO_IMPRESSOES_VEREDITO é a base em que 1 impressão vale no máximo 1 ponto", () => {
  // A faixa do board tem 10 pontos (40% a 50%). No piso, uma impressão move a fração 1pp — são
  // precisas 10 para atravessar a faixa. É isso que o número significa.
  assert.ok(100 / PISO_IMPRESSOES_VEREDITO <= 1);
  // Abaixo do piso a régua não vale: com as 26 impressões reais de 18/09, 1 impressão vale 3,8pp
  // e TRÊS atravessam a faixa inteira.
  assert.ok(100 / 26 > 1);
  assert.ok(Math.ceil(10 / (100 / 26)) === 3);
});

test("totalImpressoes é o denominador que acompanha a fração", () => {
  const linhas = [
    { query: "a", page: "/x", cliques: 1, impressoes: 20, posicao: 2 },
    { query: "b", page: "/y", cliques: 0, impressoes: 6, posicao: 9 },
  ];
  assert.equal(totalImpressoes(linhas), 26);
  assert.equal(totalImpressoes([]), 0);
  assert.equal(totalImpressoes(null), 0);
  // A fração do Top 3 lida contra ESSE total: 20 de 26.
  assert.equal(impressoesNoTop3(linhas), 20 / 26);
});
