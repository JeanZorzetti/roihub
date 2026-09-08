import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  VITAIS,
  SLUGS_DE_CAMPO,
  CAP_URLS_PASS_RATE,
  dataCrux,
  medirRecord,
  formatarValor,
  rodape,
  celulasDeVitais,
  passRate,
} from "../lib/crux.mjs";
import { MEDIDORES } from "../lib/ficha.mjs";

const ORIGEM = { tipo: "origem", valor: "https://www.atma.com.br" };
const URL_BLOG = { tipo: "url", valor: "https://www.atma.com.br/blog/quanto-custa-alinhador-invisivel" };

const PERIODO = { firstDate: { year: 2026, month: 8, day: 10 }, lastDate: { year: 2026, month: 9, day: 6 } };

/** Um record da CrUX com os p75 pedidos, pela chave curta do vital. */
const record = (p75PorId, collectionPeriod = PERIODO) => ({
  collectionPeriod,
  metrics: Object.fromEntries(
    Object.entries(p75PorId).map(([id, p75]) => [VITAIS.find((v) => v.id === id).chaveCrux, { percentiles: { p75 } }]),
  ),
});

const bom = { lcp: 1800, inp: 120, cls: 0.05, ttfb: 210 };

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
test("módulo é puro: sem process.env, sem relógio, sem fetch", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/crux.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  assert.doesNotMatch(src, /Date\.now\(\)|new Date\(/, "módulo puro não pode ler relógio");
  assert.doesNotMatch(src, /fetch\(/, "módulo puro não fala com a rede");
  assert.doesNotMatch(src, /^import /m, "módulo puro não importa nada");
});

// ── T004: as duas listas amarradas ──────────────────────────────────────────────────────────
test("todo vital tem onde aparecer na ficha: VITAIS ⊂ MEDIDORES.D2", () => {
  // Um `id` fora do catálogo da ficha não teria onde ser exibido, e a divergência não apareceria
  // em build nenhum.
  for (const v of VITAIS) assert.ok(MEDIDORES.D2.includes(v.id), `${v.id} não está em MEDIDORES.D2`);
  assert.deepEqual(SLUGS_DE_CAMPO, ["atma"]);
  assert.equal(typeof CAP_URLS_PASS_RATE, "number");
});

// ── T005: a data da fonte, 1-based ──────────────────────────────────────────────────────────
test("dataCrux converte o mês 1-based da fonte, e devolve null no inválido", () => {
  assert.equal(dataCrux({ year: 2026, month: 9, day: 6 }), "2026-09-06");
  // Setembro é 9 na CrUX e 8 no `Date` do JS — o erro de um mês que ninguém vê olhando a tela.
  assert.equal(dataCrux({ year: 2026, month: 1, day: 31 }), "2026-01-31");
  assert.equal(dataCrux({ year: 2026, day: 6 }), null);
  assert.equal(dataCrux(undefined), null);
});

// ── T006 / T016: as medidas e o veredito ────────────────────────────────────────────────────
test("medirRecord extrai só o que o record contém", () => {
  const m = medirRecord(record(bom));
  assert.equal(m.size, 4);
  const lcp = m.get("largest_contentful_paint");
  assert.equal(lcp.p75, 1800);
  assert.deepEqual(lcp.janela, { inicio: "2026-08-10", fim: "2026-09-06" });
  assert.equal(lcp.dispositivo, "todos");
  assert.equal(lcp.experimental, false);
  assert.equal(m.get("experimental_time_to_first_byte").experimental, true);
});

test("sem o TTFB experimental, os outros três saem intactos (FR-008)", () => {
  const m = medirRecord(record({ lcp: 1800, inp: 120, cls: 0.05 }));
  assert.equal(m.size, 3);
  assert.equal(m.get("largest_contentful_paint").p75, 1800);
  assert.equal(m.get("experimental_time_to_first_byte"), undefined);
});

test("p75 string normaliza; p75 inválido não cria entrada (FR-004)", () => {
  const m = medirRecord(record({ cls: "0.08", lcp: null, inp: "abc", ttfb: undefined }));
  assert.equal(m.get("cumulative_layout_shift").p75, 0.08);
  assert.equal(m.size, 1, "só o CLS tem p75 finito");
});

test("janela incompleta some, não vira NaN", () => {
  const m = medirRecord(record({ lcp: 1800 }, { firstDate: { year: 2026, month: 8, day: 10 } }));
  assert.equal(m.get("largest_contentful_paint").janela, null);
});

test("o limite do board é inclusivo: 2500 é dentro, 2501 é fora (FR-006)", () => {
  assert.equal(medirRecord(record({ lcp: 2500 })).get("largest_contentful_paint").veredito, "dentro");
  assert.equal(medirRecord(record({ lcp: 2501 })).get("largest_contentful_paint").veredito, "fora");
  assert.equal(medirRecord(record({ inp: 200 })).get("interaction_to_next_paint").veredito, "dentro");
  assert.equal(medirRecord(record({ cls: 0.1 })).get("cumulative_layout_shift").veredito, "dentro");
  assert.equal(medirRecord(record({ ttfb: 600 })).get("experimental_time_to_first_byte").veredito, "dentro");
  assert.equal(medirRecord(record({ ttfb: 601 })).get("experimental_time_to_first_byte").veredito, "fora");
});

// ── T010: cada unidade na sua ───────────────────────────────────────────────────────────────
test("formatarValor: segundos, milissegundos e o CLS adimensional (FR-013)", () => {
  const v = (id) => VITAIS.find((x) => x.id === id);
  assert.equal(formatarValor(v("lcp"), 2437), "2,4 s");
  assert.equal(formatarValor(v("inp"), 187.4), "187 ms");
  assert.equal(formatarValor(v("ttfb"), 210), "210 ms");
  const cls = formatarValor(v("cls"), 0.083);
  assert.equal(cls, "0,08");
  assert.doesNotMatch(cls, /s/, "CLS é índice: formatá-lo com unidade de tempo seria errado");
});

// ── T011 / T017: o rodapé ───────────────────────────────────────────────────────────────────
test("rodapé declara p75, alvo, janela, dispositivo e meta (FR-005, FR-006, FR-010)", () => {
  const m = medirRecord(record(bom));
  const r = rodape(m.get("largest_contentful_paint"), ORIGEM);
  assert.match(r, /^p75 de campo · origem https:\/\/www\.atma\.com\.br · CrUX 2026-08-10→2026-09-06 · todos os dispositivos · meta ≤ 2,5 s: dentro$/);
});

test("o TTFB mostra os DOIS limites e o rótulo de experimental (FR-007, FR-008)", () => {
  const m = medirRecord(record(bom));
  const r = rodape(m.get("experimental_time_to_first_byte"), ORIGEM);
  assert.match(r, /meta ≤ 600 ms \(ideal < 300 ms\): dentro/);
  assert.match(r, /experimental na fonte$/);
});

test("sem janela, o trecho SOME — nunca datas inventadas", () => {
  const m = medirRecord(record({ lcp: 4000 }, {}));
  const r = rodape(m.get("largest_contentful_paint"), URL_BLOG);
  assert.doesNotMatch(r, /CrUX \d/);
  assert.match(r, /URL https:\/\/www\.atma\.com\.br\/blog/);
  assert.match(r, /: fora$/);
});

// ── T013: os quatro estados, um por invariante ──────────────────────────────────────────────
test("os quatro estados produzem textos DIFERENTES (FR-003)", () => {
  const textos = [
    celulasDeVitais({ estado: "record", record: record({}) }, ORIGEM),
    celulasDeVitais({ estado: "sem-amostra" }, ORIGEM),
    celulasDeVitais({ estado: "falhou", erro: "HTTP 429" }, ORIGEM),
    celulasDeVitais({ estado: "sem-chave" }, ORIGEM),
  ].map((c) => c.lcp.naoApurado);
  assert.equal(new Set(textos).size, 4, "colapsar dois estados é o defeito que a spec proíbe");
});

test("só a falha tem rotuloBuraco — ausência de observação não é falha", () => {
  assert.equal(celulasDeVitais({ estado: "falhou", erro: "HTTP 500" }, ORIGEM).cls.rotuloBuraco, "falhou-agora");
  assert.equal(celulasDeVitais({ estado: "sem-amostra" }, ORIGEM).cls.rotuloBuraco, undefined);
  assert.equal(celulasDeVitais({ estado: "sem-chave" }, ORIGEM).cls.rotuloBuraco, undefined);
});

test("sem chave, a célula nomeia SÓ a variável (FR-011)", () => {
  const c = celulasDeVitais({ estado: "sem-chave" }, ORIGEM);
  for (const v of VITAIS) assert.equal(c[v.id].naoApurado, "CRUX_API_KEY ausente");
});

test("record sem nenhuma métrica conhecida vira quatro ausências, não erro", () => {
  const c = celulasDeVitais({ estado: "record", record: { metrics: { alguma_outra: {} } } }, ORIGEM);
  assert.equal(Object.keys(c).length, 4);
  for (const v of VITAIS) assert.match(c[v.id].naoApurado, /sem amostra suficiente na fonte para/);
});

test("toda célula ausente carrega `fonte` — senão a R4 quebra em silêncio em montarN5()", () => {
  for (const leitura of [{ estado: "sem-amostra" }, { estado: "falhou", erro: "x" }, { estado: "sem-chave" }, { estado: "record", record: {} }]) {
    for (const v of VITAIS) {
      const cel = celulasDeVitais(leitura, ORIGEM)[v.id];
      assert.ok(cel.fonte, `${leitura.estado}/${v.id} sem fonte a consultar`);
    }
  }
});

test("nenhum caminho produz valor 0, dentro ou fora sem medida (FR-004, SC-004)", () => {
  for (const leitura of [{ estado: "sem-amostra" }, { estado: "falhou", erro: "x" }, { estado: "sem-chave" }, { estado: "record", record: record({ lcp: 1800 }) }]) {
    for (const v of VITAIS) {
      const cel = celulasDeVitais(leitura, ORIGEM)[v.id];
      if (cel.naoApurado === undefined) continue;
      assert.equal(cel.valor, undefined);
      assert.doesNotMatch(cel.fonte, /: (dentro|fora)/, "célula ausente não pode ser classificada");
    }
  }
  const so4 = celulasDeVitais({ estado: "record", record: record({ lcp: 1800 }) }, ORIGEM);
  assert.equal(so4.lcp.valor, "1,8 s");
  assert.equal(so4.inp.valor, undefined);
});

// ── T020: o Pass Rate, e o 100% que ele não pode produzir ───────────────────────────────────
const leituras = (...p75s) => new Map(p75s.map((p, i) => [`u${i}`, p === null ? { estado: "sem-amostra" } : { estado: "record", record: record(p) }]));

test("comDado 0 devolve motivo, nunca fração", () => {
  const r = passRate(leituras(null, null), 2);
  assert.equal(r.fracao, null);
  assert.match(r.motivo, /das 2 URLs consultadas, 0 têm dado de campo/);
});

test("comDado 1 devolve MOTIVO, nunca 1 (US3-AC2)", () => {
  const r = passRate(leituras(bom, null), 2);
  assert.equal(r.comDado, 1);
  assert.equal(r.fracao, null);
  assert.match(r.motivo, /1 tem dado de campo/);
  assert.match(r.motivo, /das 2 URLs consultadas/);
});

test("comDado >= 2 devolve a fração e cala o motivo", () => {
  const r = passRate(leituras(bom, { lcp: 4000, inp: 120, cls: 0.05 }, bom), 3);
  assert.equal(r.comDado, 3);
  assert.equal(r.passam, 2);
  assert.equal(r.fracao, 2 / 3);
  assert.equal(r.motivo, null);
});

test("XOR: fração e motivo nunca ambos, nunca nenhum", () => {
  for (const r of [passRate(leituras(), 0), passRate(leituras(bom), 1), passRate(leituras(bom, bom), 2)]) {
    assert.equal((r.fracao === null) !== (r.motivo === null), true, "exatamente um dos dois");
  }
});

test("URL com só TTFB não conta como comDado — o TTFB não define Bom", () => {
  const r = passRate(leituras({ ttfb: 210 }, { ttfb: 210 }), 2);
  assert.equal(r.comDado, 0);
  assert.equal(r.fracao, null);
});
