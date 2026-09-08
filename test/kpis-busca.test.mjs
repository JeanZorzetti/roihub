import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  benchmark,
  ctr,
  porUrl,
  consultasUnicas,
  noTop20,
  impressoesNoTop3,
  urlsComImpressao,
  strikingDistance,
  ctrPorConsulta,
  ctrGap,
  termoPrincipal,
  canibalizacao,
  kpisDeBusca,
  activeIndexRatio,
  queryToPageRatio,
} from "../lib/kpis-busca.mjs";

const l = (query, page, impressoes, cliques, posicao) => ({ query, page, impressoes, cliques, posicao });

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
    strikingDistance(linhas).map((x) => x.query),
    ["b", "c"]
  );
});

test("striking distance ordena por impressões, não por posição", () => {
  const linhas = [l("pouca", "/a", 10, 0, 4.1), l("muita", "/b", 900, 2, 9.8)];
  assert.equal(strikingDistance(linhas)[0].query, "muita");
});

test("striking distance sem candidata devolve lista vazia (a tela precisa distinguir do erro)", () => {
  assert.deepEqual(strikingDistance([l("a", "/a", 100, 1, 2.0)]), []);
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
  // Duas URLs: uma no Top 3 que atinge, outra na posição 40 que nem tem régua.
  const g = ctrGap([l("a", "/a", 100, 30, 2.0), l("b", "/b", 100, 0, 40)]);
  assert.equal(g.avaliadas, 1, "a URL sem benchmark não entra no denominador");
  assert.equal(g.fracao, 1);
});

test("CTR Gap sem nenhuma URL avaliável devolve null, não 0%", () => {
  assert.equal(ctrGap([]), null);
  assert.equal(ctrGap([l("a", "/a", 100, 0, 40)]), null, "só URL sem benchmark = sem denominador");
});

test("CTR Gap agrega por URL, somando as consultas dela", () => {
  // Uma URL com duas consultas: 50+50 impressões e 10+10 cliques = 20% de CTR na posição ~2.
  const g = ctrGap([l("a", "/p", 50, 10, 2.0), l("b", "/p", 50, 10, 2.0)]);
  assert.equal(g.avaliadas, 1, "duas consultas da mesma URL são UMA URL");
  assert.equal(g.fracao, 1);
});

test("a posição da URL é ponderada por impressões, não média simples", () => {
  // Uma consulta rara na posição 90 não pode arrastar uma página que vive no Top 3.
  const [u] = porUrl([l("forte", "/p", 1000, 250, 1.5), l("rara", "/p", 1, 0, 90)]);
  assert.ok(u.posicao < 2, `posição ponderada deveria ficar perto de 1,5, veio ${u.posicao}`);
  assert.equal(u.benchmark, 0.25);
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
  const linhas = [l("a", "/x", 10, 0, 5), l("b", "/x", 10, 0, 6), l("c", "/y", 0, 0, 8)];
  assert.equal(urlsComImpressao(linhas), 1, "/y tem 0 impressões e não conta");
});

// ── canibalização ───────────────────────────────────────────────────────────────────────────
test("consulta em 2+ URLs aparece na canibalização", () => {
  const c = canibalizacao([l("preco", "/a", 100, 1, 6.0), l("preco", "/b", 50, 0, 14.0)]);
  assert.equal(c.length, 1);
  assert.equal(c[0].consulta, "preco");
  assert.equal(c[0].urls.length, 2);
  assert.equal(c[0].urls[0].url, "/a", "a URL com mais impressões vem primeiro");
});

test("consulta com URL única NÃO aparece na canibalização", () => {
  assert.deepEqual(canibalizacao([l("preco", "/a", 100, 1, 6.0)]), []);
});

test("a mesma URL repetida na mesma consulta não é canibalização", () => {
  assert.deepEqual(canibalizacao([l("preco", "/a", 100, 1, 6.0), l("preco", "/a", 20, 0, 7.0)]), []);
});

// ── agregador ───────────────────────────────────────────────────────────────────────────────
test("lista vazia não estoura em nenhum KPI", () => {
  const k = kpisDeBusca([]);
  assert.equal(k.consultasUnicas.valor, 0);
  assert.equal(k.noTop20, 0);
  assert.equal(k.impressoesNoTop3, null);
  assert.equal(k.urlsComImpressao, 0);
  assert.deepEqual(k.strikingDistance, []);
  assert.equal(k.ctrGap, null);
  assert.deepEqual(k.canibalizacao, []);
});

// ── 022: as duas razões que estavam capadas por falta de denominador ─────────────────────────
test("activeIndexRatio é URLs com impressão ÷ indexadas", () => {
  const linhas = [l("a", "/1", 10, 1, 5), l("b", "/1", 5, 0, 8), l("c", "/2", 3, 0, 9)];
  assert.equal(activeIndexRatio(linhas, 4), 2 / 4);
});

// FR-011: sem denominador a tela volta à CONTAGEM com o motivo. Uma razão com denominador chutado
// é falha, não detalhe — foi por isso que a 021 deixou este KPI como contagem.
test("sem denominador, as duas razões são null e nunca um número inventado", () => {
  const linhas = [l("a", "/1", 10, 1, 5)];
  for (const d of [0, null, undefined, -3, NaN]) {
    assert.equal(activeIndexRatio(linhas, d), null, `activeIndexRatio inventou razão com indexadas=${d}`);
    assert.equal(queryToPageRatio(linhas, d), null, `queryToPageRatio inventou razão com indexadas=${d}`);
  }
});

test("queryToPageRatio carrega o piso — o GSC omite as consultas raras", () => {
  const linhas = [l("a", "/1", 10, 1, 5), l("b", "/1", 5, 0, 8), l("a", "/2", 2, 0, 9)];
  const r = queryToPageRatio(linhas, 4);
  assert.equal(r.valor, 2 / 4);
  assert.equal(r.piso, true, "sem a flag a tela publica o piso como se fosse a razão real");
});

test("lista de linhas vazia com denominador válido é zero, não null — nada foi visto, mas foi medido", () => {
  assert.equal(activeIndexRatio([], 10), 0);
  assert.equal(queryToPageRatio([], 10).valor, 0);
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
