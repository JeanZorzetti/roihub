import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { apurado, naoApurado as naoApuradoF, ehApurado } from "../lib/funil.mjs";
import { PERFIS, montarFicha, posicaoDeAtaque } from "../lib/okr.mjs";
import { projetar } from "../lib/projecao.mjs";
import { mergeProjects } from "../lib/projects.mjs";
import {
  estadoDeApurado,
  declarada,
  naoApurada,
  inferida,
  combinar,
  avaliarN2,
  montarN4,
  montarN4Nivel,
  mapearCanaisGa4,
  GRUPOS_GA4,
  escolherFamilia,
  montarN5,
  validarKrs,
  montarNiveis,
  segmentosDoFunil,
  CANAIS,
  MEDIDORES,
} from "../lib/ficha.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A cadeia real da atma: 535 cliques → 39 leads, os três degraus do meio sem coletor, 0 tratamentos. */
const fichaAtma = () =>
  montarFicha({ slug: "atma", perfil: "D", coletado: { cliques: apurado(535), leads: apurado(39), vendas: apurado(0) } });

const entradaBase = (overrides = {}) => ({
  slug: "atma",
  ficha: fichaAtma(),
  meta: { valor: 50000, ticket: 4000, prazo: "2026-12-31", declaradaEm: "2026-09-01" },
  hoje: "2026-09-01",
  itensAgenda: [],
  erroAgenda: null,
  datasDono: new Map(),
  disponiveisN5: {},
  janela: { inicio: "2026-08-04", fim: "2026-08-29" },
  ...overrides,
});

const projecaoDe = (ficha, meta) => projetar({ ficha, meta, hoje: "2026-09-01" });
const vereditoDe = (ficha) => posicaoDeAtaque(ficha);

function fichaCompleta(overrides = {}) {
  const ficha = overrides.ficha ?? fichaAtma();
  const meta = "meta" in overrides ? overrides.meta : { valor: 50000, ticket: 4000, prazo: "2026-12-31", declaradaEm: "2026-09-01" };
  return entradaBase({
    ...overrides,
    ficha,
    meta,
    veredito: vereditoDe(ficha),
    projecao: projecaoDe(ficha, meta),
  });
}

// ── G1 — sempre 7 níveis, na ordem, para qualquer entrada ───────────────────

test("G1 — 7 níveis N0-N6 na ordem, para qualquer entrada", () => {
  const niveis = montarNiveis(fichaCompleta());
  assert.deepEqual(niveis.map((n) => n.id), ["N0", "N1", "N2", "N3", "N4", "N5", "N6"]);
  for (const n of niveis) assert.ok(n.celulas.length >= 1 || n.itens?.length >= 0, `${n.id} sem célula`);
});

test("G1 — projeto sem perfil, sem meta e sem ficha continua com 7 níveis", () => {
  const semPerfil = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const niveis = montarNiveis(
    entradaBase({
      ficha: semPerfil,
      meta: null,
      veredito: posicaoDeAtaque(semPerfil),
      projecao: projetar({ ficha: semPerfil, meta: null, hoje: "2026-09-01" }),
      declarada: null,
    }),
  );
  assert.deepEqual(niveis.map((n) => n.id), ["N0", "N1", "N2", "N3", "N4", "N5", "N6"]);
});

// ── G2 — nenhuma célula fora dos três estados, nenhuma incompleta ───────────

function todasAsCelulas(niveis) {
  const out = [];
  for (const n of niveis) {
    out.push(...n.celulas);
    for (const kr of n.krs ?? []) if (kr.celulaAlvo) out.push(kr.celulaAlvo);
    for (const item of n.itens ?? []) out.push(item.data);
  }
  return out;
}

test("G2 — toda CelulaFicha respeita o envelope de três estados", () => {
  const niveis = montarNiveis(
    fichaCompleta({
      declarada: { declaradaEm: "2026-09-01", objetivo: "objetivo sem número", krs: [{ kpi: "leads", baseline: 39, meta: 120, prazo: "2026-12-31", dono: "jean", celula: "n3:lead" }] },
      itensAgenda: [{ key: "acao:atma:aaaa1111", occ: "1970-01-01", titulo: "fazer X", projeto: "atma", meta: "#1 · score 10", desc: null, tipo: "execucao", rank: 0, seguranca: false, responsavel: "jean" }],
      datasDono: new Map([["acao:atma:aaaa1111", "2026-08-20"]]),
    }),
  );
  for (const c of todasAsCelulas(niveis)) {
    assert.ok(["apurado", "declarado", "nao-apurado"].includes(c.estado), `estado inválido: ${c.estado}`);
    if (c.estado === "apurado") assert.ok(c.fonte, "apurado sem fonte");
    if (c.estado === "declarado") assert.ok(c.declaradoEm, "declarado sem declaradoEm");
    if (c.estado === "nao-apurado") {
      assert.ok(c.motivo, "não apurado sem motivo");
      assert.ok(c.consultar, "não apurado sem consultar");
      assert.equal(c.valor, undefined, "não apurado com valor");
    }
  }
});

// ── G3 — herança: insumo declarado contamina o produto ──────────────────────

test("G3 — 0 tratamentos × R$ 4.000 declarados é DECLARADO, nunca apurado", () => {
  const c = combinar(
    [estadoDeApurado(apurado(0), "extrato do gateway"), declarada(4000, { em: "2026-09-01", oQue: "meta.ticket" })],
    ([qtd, ticket]) => qtd * ticket,
  );
  assert.equal(c.estado, "declarado");
  assert.equal(c.valor, 0);
});

test("G3 — N1 da atma sai declarado em R$, mesmo com a contagem apurada", () => {
  const niveis = montarNiveis(fichaCompleta());
  const n1 = niveis.find((n) => n.id === "N1");
  const [contagem, reais] = n1.celulas;
  assert.equal(contagem.estado, "apurado");
  assert.equal(contagem.valor, 0); // tratamento = 0 na atma
  assert.equal(reais.estado, "declarado");
  assert.equal(reais.valor, 0);
});

// ── G4 — fator de cadeia: um degrau não apurado no trecho basta ─────────────

test("G4 — fator de cadeia com um degrau não apurado sai nao-apurado mesmo com os outros do trecho apurados", () => {
  const marcos = [
    { chave: "a", nome: "a", celula: apurado(10), fonte: "fa" },
    { chave: "b", nome: "b", celula: naoApuradoF("sem coletor b"), fonte: "fb" },
    { chave: "c", nome: "c", celula: apurado(5), fonte: "fc" },
  ];
  const fatores = [{ nome: "F(a→c)", tipo: "cadeia", cobertura: ["a", "b", "c"] }];
  const { fatores: out } = avaliarN2(fatores, marcos, [], {});
  assert.equal(out[0].estado, "nao-apurado");
});

// ── G5 — buraco/sobreposição vira erro; degraus acima do 1º fator não ───────

test("G5 — cobertura da atma (perfil D real) é contígua e não produz erro", () => {
  const ficha = fichaAtma();
  const { erroDeDefinicao } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  assert.equal(erroDeDefinicao, null);
});

test("G5 — buraco no meio da cobertura vira erro de definição", () => {
  const marcos = [
    { chave: "a", nome: "a", celula: apurado(10), fonte: "fa" },
    { chave: "b", nome: "b", celula: apurado(8), fonte: "fb" },
    { chave: "c", nome: "c", celula: apurado(5), fonte: "fc" },
  ];
  // cobertura pula "b": buraco entre "a" e "c".
  const fatores = [{ nome: "F1", tipo: "cadeia", cobertura: ["a"] }, { nome: "F2", tipo: "cadeia", cobertura: ["c"] }];
  const { erroDeDefinicao } = avaliarN2(fatores, marcos, [], {});
  assert.match(erroDeDefinicao, /buraco ou sobreposição/);
});

test("G5 — degraus acima do primeiro fator (a entrada) não produzem erro", () => {
  const marcos = [
    { chave: "visitante", nome: "visitante", celula: apurado(535), fonte: "gsc" },
    { chave: "lead", nome: "lead", celula: apurado(39), fonte: "crm" },
    { chave: "venda", nome: "venda", celula: apurado(0), fonte: "gateway" },
  ];
  // cobertura só cobre lead→venda; "visitante" fica de fora — é a entrada (N4).
  const fatores = [{ nome: "F", tipo: "cadeia", cobertura: ["lead", "venda"] }];
  const { erroDeDefinicao } = avaliarN2(fatores, marcos, [], {});
  assert.equal(erroDeDefinicao, null);
});

// ── G6 — veredito de N2 nunca "fecha" derivado de ausência ──────────────────

test("G6 — veredito nao-apurado nomeia os fatores faltando, nunca finge fechar", () => {
  const ficha = fichaAtma(); // contatado sem coletor, aceito sem regra de aceite declarada
  const { veredito } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  assert.equal(veredito.estado, "nao-apurado");
  assert.match(veredito.motivo, /CR\(lead→orçamento\)/);
});

// ── G7 — N4 sem total, diferença nao-apurado, perfil C marca organico sem elo ─

test("G7 — N4 nunca soma; a diferença sai nao-apurado", () => {
  const marcos = [{ chave: "visitante", nome: "visitante", celula: apurado(535) }];
  const canais = montarN4(CANAIS, apurado(535), marcos);
  const organico = canais.find((c) => c.id === "organico");
  assert.equal(organico.celula.estado, "apurado");
  for (const c of canais.filter((c) => c.id !== "organico")) assert.equal(c.celula.estado, "nao-apurado");
});

test("G7 — perfil C (cadeia começa em contato) marca organico como sem elo", () => {
  const marcos = [{ chave: "contato", nome: "contato", celula: apurado(10) }];
  const canais = montarN4(CANAIS, apurado(10), marcos);
  assert.equal(canais.find((c) => c.id === "organico").semElo, true);
});

test("G7 — perfil D (cadeia começa em visitante) organico TEM elo", () => {
  const marcos = [{ chave: "visitante", nome: "visitante", celula: apurado(535) }];
  const canais = montarN4(CANAIS, apurado(535), marcos);
  assert.equal(canais.find((c) => c.id === "organico").semElo, false);
});

// ── 013 — N4 por canal, GA4 somado ao GSC ────────────────────────────────────

const JANELA = { inicio: "2026-08-04", fim: "2026-08-29" };
const MARCOS_VISITANTE = [{ chave: "visitante", nome: "visitante", celula: apurado(535) }];

test("T006 — mapearCanaisGa4() sempre traz as quatro chaves, 0 quando o grupo não veio", () => {
  const { porCanal } = mapearCanaisGa4([{ grupo: "Direct", sessoes: 10 }]);
  assert.deepEqual(Object.keys(porCanal).sort(), ["direto", "indicacao", "pago", "social"].sort());
  assert.equal(porCanal.direto, 10);
  assert.equal(porCanal.pago, 0);
  assert.equal(porCanal.indicacao, 0);
  assert.equal(porCanal.social, 0);
});

test("T006 — Organic Search nunca entra em porCanal, vai para organicoIgnorado", () => {
  const { porCanal, organicoIgnorado } = mapearCanaisGa4([{ grupo: "Organic Search", sessoes: 300 }]);
  assert.equal(Object.values(porCanal).every((v) => v === 0), true);
  assert.equal(organicoIgnorado, 300);
});

test("T006 — grupo fora do mapa vai inteiro para foraDoCatalogo, nome preservado, nunca somado a canal existente", () => {
  const { porCanal, foraDoCatalogo } = mapearCanaisGa4([{ grupo: "Email", sessoes: 12 }]);
  assert.deepEqual(foraDoCatalogo, [{ grupo: "Email", sessoes: 12 }]);
  assert.equal(Object.values(porCanal).every((v) => v === 0), true);
});

test("T006 — sessoes não numérico ou negativo é grupo desconhecido, não 0", () => {
  const { porCanal, foraDoCatalogo } = mapearCanaisGa4([
    { grupo: "Direct", sessoes: -5 },
    { grupo: "Referral", sessoes: "3" },
  ]);
  assert.equal(porCanal.direto, 0);
  assert.equal(porCanal.indicacao, 0);
  assert.equal(foraDoCatalogo.length, 2);
});

test("T006 — [] é função total: quatro chaves em 0, organicoIgnorado 0, foraDoCatalogo []", () => {
  const r = mapearCanaisGa4([]);
  assert.deepEqual(r, { porCanal: { direto: 0, pago: 0, indicacao: 0, social: 0 }, organicoIgnorado: 0, foraDoCatalogo: [] });
});

test("T006 — mapa GRUPOS_GA4 não contém outbound, de propósito", () => {
  assert.equal(Object.values(GRUPOS_GA4).includes("outbound"), false);
});

test("T007/SC-008 — organico é idêntico nas cinco situações de ga4, e nenhuma lê linha do GA4", () => {
  const situacoes = [
    undefined,
    null,
    { erro: "403" },
    { linhas: [], janela: JANELA, propriedade: "properties/1" },
    { linhas: [{ grupo: "Organic Search", sessoes: 999 }], janela: JANELA, propriedade: "properties/1" },
  ];
  for (const ga4 of situacoes) {
    const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
    const organico = canais.find((c) => c.id === "organico");
    assert.equal(organico.celula.estado, "apurado");
    assert.equal(organico.celula.valor, 535);
    assert.equal(organico.celula.fonte, "Search Console");
  }
});

test("T007 — outbound é sempre não apurado nomeando que a fonte não distingue, em qualquer situação de ga4", () => {
  for (const ga4 of [undefined, { erro: "x" }, { linhas: [{ grupo: "Direct", sessoes: 1 }], janela: JANELA, propriedade: "properties/1" }]) {
    const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
    const outbound = canais.find((c) => c.id === "outbound");
    assert.equal(outbound.celula.estado, "nao-apurado");
    assert.match(outbound.celula.motivo, /não distingue prospecção ativa/);
  }
});

test("T007 — ga4 null/undefined: os quatro canais do GA4 saem não apurado nomeando ausência de propriedade", () => {
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, undefined, JANELA);
  for (const id of ["direto", "pago", "indicacao", "social"]) {
    const c = canais.find((x) => x.id === id);
    assert.equal(c.celula.estado, "nao-apurado");
    assert.match(c.celula.motivo, /sem propriedade GA4 configurada/);
  }
});

test("T007 — ga4 {erro}: os quatro canais saem não apurado nomeando o erro, nunca 0", () => {
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, { erro: "ECONNRESET" }, JANELA);
  for (const id of ["direto", "pago", "indicacao", "social"]) {
    const c = canais.find((x) => x.id === id);
    assert.equal(c.celula.estado, "nao-apurado");
    assert.match(c.celula.motivo, /fonte GA4 indisponível \(ECONNRESET\)/);
  }
});

test("T007 — ga4 {linhas: []}: os quatro canais saem 0 APURADO, porque a fonte respondeu", () => {
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, { linhas: [], janela: JANELA, propriedade: "properties/1" }, JANELA);
  for (const id of ["direto", "pago", "indicacao", "social"]) {
    const c = canais.find((x) => x.id === id);
    assert.equal(c.celula.estado, "apurado");
    assert.equal(c.celula.valor, 0);
    assert.match(c.celula.fonte, /GA4/);
  }
});

test("T007 — ga4 {linhas:[...]}: canal apurado com o valor somado e a fonte GA4 · propriedade", () => {
  const ga4 = {
    linhas: [
      { grupo: "Direct", sessoes: 40 },
      { grupo: "Paid Search", sessoes: 5 },
      { grupo: "Paid Social", sessoes: 3 },
    ],
    janela: JANELA,
    propriedade: "properties/123",
  };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
  const direto = canais.find((c) => c.id === "direto");
  const pago = canais.find((c) => c.id === "pago");
  assert.equal(direto.celula.estado, "apurado");
  assert.equal(direto.celula.valor, 40);
  assert.equal(direto.celula.fonte, "GA4 · properties/123");
  assert.equal(pago.celula.valor, 8);
});

test("T008 — montarN4() chamado com três argumentos (compatibilidade) continua produzindo o resultado de hoje", () => {
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE);
  const organico = canais.find((c) => c.id === "organico");
  assert.equal(organico.celula.estado, "apurado");
  assert.equal(organico.celula.valor, 535);
  for (const c of canais.filter((c) => c.id !== "organico")) {
    assert.equal(c.celula.estado, "nao-apurado");
  }
});

test("T014/FR-006 — janela do GA4 diferente da janela da cadeia: canais do GA4 não apurado, organico intacto", () => {
  const ga4 = { linhas: [{ grupo: "Direct", sessoes: 10 }], janela: { inicio: "2026-07-01", fim: "2026-07-28" }, propriedade: "properties/1" };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
  const direto = canais.find((c) => c.id === "direto");
  assert.equal(direto.celula.estado, "nao-apurado");
  assert.match(direto.celula.motivo, /janela do GA4 \(2026-07-01→2026-07-28\) difere da janela da cadeia \(2026-08-04→2026-08-29\)/);
  const organico = canais.find((c) => c.id === "organico");
  assert.equal(organico.celula.estado, "apurado");
  assert.equal(organico.celula.valor, 535);
});

test("T015 — montarN4Nivel(): total composto soma só apurados, rótulo declara cobertura, fonte é a junção", () => {
  const ga4 = { linhas: [{ grupo: "Direct", sessoes: 40 }], janela: JANELA, propriedade: "properties/1" };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
  const { celulas } = montarN4Nivel(canais, {});
  const total = celulas.find((c) => c.rotulo?.startsWith("total composto"));
  assert.equal(total.estado, "apurado");
  assert.equal(total.valor, 535 + 40); // organico + direto; pago/indicacao/social apurados em 0 somam 0
  assert.match(total.rotulo, /orgânico \+ \d+ canais/);
  assert.match(total.fonte, /Search Console/);
  assert.match(total.fonte, /GA4/);
});

test("T015 — total composto sai não apurado quando nenhum canal é apurado", () => {
  const canais = montarN4(CANAIS, { naoApurado: "sem coletor" }, MARCOS_VISITANTE, undefined, JANELA);
  const { celulas } = montarN4Nivel(canais, {});
  const total = celulas.find((c) => c.rotulo?.startsWith("total composto"));
  assert.equal(total.estado, "nao-apurado");
});

test("T015 — diferença permanece não apurado nomeando os canais sem fonte enquanto houver algum", () => {
  const ga4 = { linhas: [{ grupo: "Direct", sessoes: 40 }], janela: JANELA, propriedade: "properties/1" };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
  const { celulas } = montarN4Nivel(canais, {});
  const diferenca = celulas.find((c) => c.rotulo === "diferença");
  assert.equal(diferenca.estado, "nao-apurado");
  assert.match(diferenca.motivo, /outbound/);
});

test("T015 — fora do catálogo só aparece com volume, lista grupo e valor, e não entra no total", () => {
  const extras = { foraDoCatalogo: [{ grupo: "Email", sessoes: 12 }], propriedade: "properties/1", organicoIgnorado: 0 };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, { linhas: [], janela: JANELA, propriedade: "properties/1" }, JANELA);
  const { celulas } = montarN4Nivel(canais, extras);
  const fora = celulas.find((c) => c.rotulo?.startsWith("fora do catálogo"));
  assert.ok(fora, "célula fora do catálogo ausente com volume presente");
  assert.equal(fora.estado, "apurado");
  assert.equal(fora.valor, 12);
  assert.match(fora.rotulo, /Email 12/);
  const total = celulas.find((c) => c.rotulo?.startsWith("total composto"));
  assert.equal(total.valor, 535); // não inclui os 12 do fora do catálogo
});

test("T015 — fora do catálogo ausente quando não há volume", () => {
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, { linhas: [], janela: JANELA, propriedade: "properties/1" }, JANELA);
  const { celulas } = montarN4Nivel(canais, {});
  assert.equal(celulas.some((c) => c.rotulo?.startsWith("fora do catálogo")), false);
});

test("T021 — inferida() devolve o envelope certo e lança sem `de` ou `divida`", () => {
  const c = inferida(2, { de: "orçamento sem lead vinculado", divida: "instrumentar a origem" });
  assert.deepEqual(c, { estado: "inferido", valor: 2, rotulo: "", de: "orçamento sem lead vinculado", divida: "instrumentar a origem" });
  assert.throws(() => inferida(2, { de: "", divida: "x" }));
  assert.throws(() => inferida(2, { de: "x", divida: "" }));
});

test("T022 — célula inferida não entra no total composto de montarN4Nivel(), e não é canal", () => {
  const ga4 = { linhas: [{ grupo: "Direct", sessoes: 40 }], janela: JANELA, propriedade: "properties/1" };
  const canais = montarN4(CANAIS, apurado(535), MARCOS_VISITANTE, ga4, JANELA);
  const extras = { inferencias: [{ rotulo: "contato fora do formulário", valor: 999, de: "orçamento sem lead vinculado", divida: "x" }] };
  const { celulas } = montarN4Nivel(canais, extras);
  const total = celulas.find((c) => c.rotulo?.startsWith("total composto"));
  assert.equal(total.valor, 535 + 40); // 999 NÃO entra
  assert.equal(celulas.some((c) => c.id === "inferido"), false); // não é canal
  const inferidaCel = celulas.find((c) => c.estado === "inferido");
  assert.equal(inferidaCel.valor, 999);
});

test("T022 — KR apontando para a célula inferida sai chave-invalida (ela não mora em nenhum espaço n3:/n4:/n5:)", () => {
  const espacos = { "n4:": { organico: { estado: "apurado", valor: 1, fonte: "x" } } };
  const krs = [{ kpi: "x", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n4:inferido" }];
  const [r] = validarKrs(krs, espacos);
  assert.equal(r.marca, "chave-invalida");
});

test("T029/SC-004 — montarNiveis() sem ga4: N4 idêntico ao comportamento de hoje, organico intacto", () => {
  const niveis = montarNiveis(fichaCompleta());
  const n4 = niveis.find((n) => n.id === "N4");
  const organico = n4.celulas[0];
  assert.equal(organico.estado, "apurado");
  assert.equal(organico.valor, 535);
  // células 2-6 seguem a ordem de CANAIS: direto, pago, indicacao, outbound, social
  for (let i = 1; i < 6; i++) assert.equal(n4.celulas[i].estado, "nao-apurado");
});

test("T031/SC-010 — montarNiveis() com ga4 configurado não muda nenhuma taxa de N3", () => {
  const ga4 = { linhas: [{ grupo: "Direct", sessoes: 40 }], janela: JANELA, propriedade: "properties/1" };
  const semGa4 = montarNiveis(fichaCompleta({ janela: JANELA }));
  const comGa4 = montarNiveis(fichaCompleta({ janela: JANELA, ga4 }));
  const n3Sem = semGa4.find((n) => n.id === "N3").celulas;
  const n3Com = comGa4.find((n) => n.id === "N3").celulas;
  assert.deepEqual(n3Sem, n3Com);
});

// ── G8 — N5 devolve uma família só; posição média sempre nao-apurado ────────

test("G8 — N5 devolve só os medidores da família escolhida", () => {
  const medidores = montarN5("D4", {});
  assert.deepEqual(medidores.map((m) => m.id).sort(), [...MEDIDORES.D4].sort());
});

test("G8 — posicao-media-com-corte-pais é sempre nao-apurado, mesmo disponível", () => {
  const medidores = montarN5("D1", { "posicao-media-com-corte-pais": apurado(4.2) });
  const m = medidores.find((x) => x.id === "posicao-media-com-corte-pais");
  assert.equal(m.celula.estado, "nao-apurado");
});

// ── G9 — KR sobre célula apurada x não apurada ───────────────────────────────

test("G9 — KR sobre célula não apurada vira nao-verificavel; sobre apurada, sem marca", () => {
  const espacos = {
    "n3:": { lead: { estado: "apurado", valor: 39, fonte: "crm" }, agendada: { estado: "nao-apurado", motivo: "sem coletor", consultar: "agenda" } },
  };
  const krs = [
    { kpi: "leads", baseline: 39, meta: 120, prazo: "2026-12-31", dono: "jean", celula: "n3:lead" },
    { kpi: "agendadas", baseline: null, meta: 30, prazo: "2026-12-31", dono: "jean", celula: "n3:agendada" },
  ];
  const [comApurada, comNaoApurada] = validarKrs(krs, espacos);
  assert.equal(comApurada.marca, null);
  assert.equal(comNaoApurada.marca, "nao-verificavel");
});

// ── G10 — chave inexistente no espaço do prefixo, zero aproximação ──────────

test("G10 — chave inexistente no nível do prefixo vira chave-invalida, sem busca em outro nível", () => {
  const espacos = { "n3:": { lead: { estado: "apurado", valor: 1, fonte: "x" } }, "n4:": { organico: { estado: "apurado", valor: 1, fonte: "x" } } };
  const [r] = validarKrs([{ kpi: "x", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:organico" }], espacos);
  assert.equal(r.marca, "chave-invalida");
  assert.match(r.texto, /organico/);
});

test("SC-020 — a mesma chave válida em n4: vira erro quando declarada em n5:", () => {
  const espacos = { "n4:": { organico: { estado: "apurado", valor: 1, fonte: "x" } }, "n5:": { "lead-gravado": { estado: "apurado", valor: 1, fonte: "x" } } };
  const [r] = validarKrs([{ kpi: "x", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n5:organico" }], espacos);
  assert.equal(r.marca, "chave-invalida");
});

// ── G11 — KR sem dono visível; 4º KR excedente visível ───────────────────────

test("G11 — KR sem dono fica marcado e VISÍVEL; 4º KR vira excedente e VISÍVEL", () => {
  const espacos = { "n3:": { a: { estado: "apurado", valor: 1, fonte: "x" }, b: { estado: "apurado", valor: 1, fonte: "x" }, c: { estado: "apurado", valor: 1, fonte: "x" }, d: { estado: "apurado", valor: 1, fonte: "x" } } };
  const krs = [
    { kpi: "1", baseline: null, meta: 1, prazo: "2026-12-31", celula: "n3:a" }, // sem dono
    { kpi: "2", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:b" },
    { kpi: "3", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:c" },
    { kpi: "4", baseline: null, meta: 1, prazo: "2026-12-31", dono: "jean", celula: "n3:d" },
  ];
  const out = validarKrs(krs, espacos);
  assert.equal(out.length, 4); // nenhum truncado
  assert.equal(out[0].marca, "sem-dono");
  assert.equal(out[3].marca, "excedente");
});

// ── G12 — sem perfil: N1-N5 nao-apurado, zero números; N0/N6 continuam ──────

test("G12 — sem perfil, N1-N5 saem nao-apurado com zero números; N0 e N6 continuam válidos", () => {
  const semPerfil = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const niveis = montarNiveis(
    entradaBase({
      ficha: semPerfil,
      meta: null,
      veredito: posicaoDeAtaque(semPerfil),
      projecao: projetar({ ficha: semPerfil, meta: null, hoje: "2026-09-01" }),
      declarada: { declaradaEm: "2026-09-01", objetivo: "objetivo", krs: [] },
    }),
  );
  for (const id of ["N1", "N2", "N3", "N4", "N5"]) {
    const n = niveis.find((x) => x.id === id);
    for (const c of n.celulas) {
      assert.equal(c.estado, "nao-apurado", `${id} tem célula que não é nao-apurado`);
      assert.equal(c.valor, undefined);
    }
  }
  const n0 = niveis.find((n) => n.id === "N0");
  assert.equal(n0.celulas[0].estado, "declarado");
  const n6 = niveis.find((n) => n.id === "N6");
  assert.ok(n6.celulas.length || n6.itens.length >= 0);
});

// ── G13 — perfil A/B/C: só N2 cai, os outros seis normais ───────────────────

test("G13 — perfil A (sem `fatores`): N2 inteiro nao-apurado, os outros seis normais", () => {
  const fichaA = montarFicha({ slug: "x", perfil: "A", coletado: { cliques: apurado(100) } });
  const niveis = montarNiveis(
    entradaBase({
      ficha: fichaA,
      meta: null,
      veredito: posicaoDeAtaque(fichaA),
      projecao: projetar({ ficha: fichaA, meta: null, hoje: "2026-09-01" }),
      declarada: null,
    }),
  );
  const n2 = niveis.find((n) => n.id === "N2");
  assert.equal(n2.celulas.length, 1);
  assert.equal(n2.celulas[0].estado, "nao-apurado");
  assert.match(n2.celulas[0].motivo, /fatores do perfil ainda não declarados/);
  // N1 segue a cadeia normalmente — não cai por causa de N2, e o motivo (quando não apurado)
  // é do COLETOR daquele degrau, nunca "sem perfil declarado".
  const n1 = niveis.find((n) => n.id === "N1");
  if (n1.celulas[0].estado === "nao-apurado") assert.doesNotMatch(n1.celulas[0].motivo, /sem perfil declarado/);
});

// ── G14 — N6: banco fora x sem ação, textos diferentes ───────────────────────

test("G14 — N6 com itensAgenda null e erroAgenda vira nao-apurado nomeando o motivo", () => {
  const niveis = montarNiveis(fichaCompleta({ itensAgenda: null, erroAgenda: "ECONNREFUSED" }));
  const n6 = niveis.find((n) => n.id === "N6");
  assert.equal(n6.celulas[0].estado, "nao-apurado");
  assert.match(n6.celulas[0].motivo, /ECONNREFUSED/);
});

test("G14 — N6 com itensAgenda [] vira 'sem ação declarada', texto DIFERENTE do banco fora", () => {
  const niveis = montarNiveis(fichaCompleta({ itensAgenda: [], erroAgenda: null }));
  const n6 = niveis.find((n) => n.id === "N6");
  assert.match(n6.celulas[0].motivo, /sem ação declarada/);
  const semAcao = n6.celulas[0].motivo;
  const bancoFora = montarNiveis(fichaCompleta({ itensAgenda: null, erroAgenda: "x" })).find((n) => n.id === "N6").celulas[0].motivo;
  assert.notEqual(semAcao, bancoFora);
});

// ── G15 — celulaQueMove nunca inferida do texto ──────────────────────────────

test("G15 — celulaQueMove é sempre nao-declarada, mesmo quando o título cita um degrau", () => {
  const niveis = montarNiveis(
    fichaCompleta({
      itensAgenda: [{ key: "acao:atma:x", occ: "1970-01-01", titulo: "consertar o degrau lead da cadeia", projeto: "atma", meta: "#1 · score 10", desc: null, tipo: "execucao", rank: 0, seguranca: false, responsavel: "jean" }],
    }),
  );
  const n6 = niveis.find((n) => n.id === "N6");
  assert.equal(n6.itens[0].celulaQueMove, "nao-declarada");
});

test("N6 — descontinuado vem do campo curado de data/projects.json, não do texto do título", () => {
  const niveis = montarNiveis(
    fichaCompleta({
      itensAgenda: [
        { key: "acao:x:1", occ: "1970-01-01", titulo: "🚫 DESCONTINUADO em teste", projeto: "x", meta: null, desc: null, tipo: "execucao", rank: 0, seguranca: false, responsavel: null, descontinuado: true },
        { key: "acao:x:2", occ: "1970-01-01", titulo: "ação pendente normal", projeto: "x", meta: null, desc: null, tipo: "execucao", rank: 1, seguranca: false, responsavel: null, descontinuado: false },
      ],
    }),
  );
  const n6 = niveis.find((n) => n.id === "N6");
  assert.equal(n6.itens[0].descontinuado, true);
  assert.equal(n6.itens[1].descontinuado, false);
});

// ── R2 — fração SEMPRE colada no percentual, em N2 e N3 ─────────────────────

test("R2 — N3 cola a fração no percentual, nunca devolve o número cru 0..1", () => {
  const niveis = montarNiveis(fichaCompleta());
  const n3 = niveis.find((n) => n.id === "N3");
  const primeira = n3.celulas[0]; // visitante → lead: 39/535
  assert.equal(primeira.estado, "apurado");
  assert.match(String(primeira.valor), /^\d+,\d\d% \(\d+\/\d+\)$/);
});

test("R2 — o 1º fator de cadeia de N2 é VOLUME (não taxa); os seguintes são CR(...) com fração colada", () => {
  const ficha = fichaAtma();
  const { fatores } = avaliarN2(PERFIS.D.fatores, ficha.marcos, ficha.taxas, { ticket: 4000 });
  // "Leads" — 1º fator de cadeia: o count bruto de `lead` (39), não uma razão.
  assert.equal(fatores[0].estado, "apurado");
  assert.equal(fatores[0].valor, 39);
  // "CR(orçamento→tratamento)" — tem que ser a TAXA tratamento/aceito, nunca o valor cru do marco
  // (era o bug: virava "0" em vez de "0,00%").
  const crOrcamentoTratamento = fatores.find((f) => f.rotulo === "CR(orçamento→tratamento)");
  if (crOrcamentoTratamento.estado === "apurado") assert.match(String(crOrcamentoTratamento.valor), /%/);
});

// ── N3 funil visual (spec 012) — segmentosDoFunil() e n3.funil ──────────────

test("T005 — funil.length é o mesmo de n3.celulas.length para os quatro perfis, sem branch por perfil", () => {
  for (const k of Object.keys(PERFIS)) {
    const ficha = montarFicha({ slug: "x", perfil: k, coletado: {} });
    const niveis = montarNiveis(
      entradaBase({ ficha, meta: null, veredito: posicaoDeAtaque(ficha), projecao: projetar({ ficha, meta: null, hoje: "2026-09-01" }), declarada: null }),
    );
    const n3 = niveis.find((n) => n.id === "N3");
    assert.equal(n3.funil.length, PERFIS[k].marcos.length - 1, `perfil ${k}`);
    assert.equal(n3.funil.length, n3.celulas.length, `perfil ${k}`);
  }
});

test("T006 — funil[i].estado copia n3.celulas[i].estado; apurado tem entrada/saida em [0,1] com saida<=entrada; nao-apurado não tem nenhum", () => {
  const niveis = montarNiveis(fichaCompleta()); // atma: 535 cliques → 39 leads, resto sem coletor
  const n3 = niveis.find((n) => n.id === "N3");
  for (let i = 0; i < n3.celulas.length; i++) {
    assert.equal(n3.funil[i].estado, n3.celulas[i].estado, `segmento ${i}`);
    if (n3.funil[i].estado === "apurado") {
      assert.ok(n3.funil[i].entrada >= 0 && n3.funil[i].entrada <= 1);
      assert.ok(n3.funil[i].saida >= 0 && n3.funil[i].saida <= 1);
      assert.ok(n3.funil[i].saida <= n3.funil[i].entrada);
    } else {
      assert.equal(n3.funil[i].entrada, undefined);
      assert.equal(n3.funil[i].saida, undefined);
    }
  }
  // AS-1: o primeiro segmento (535→39) é o único apurado, quase cheio na entrada.
  assert.equal(n3.funil[0].estado, "apurado");
  assert.equal(n3.funil[0].entrada, 1); // 535 é o próprio maior marco apurado da cadeia — base
  for (let i = 1; i < n3.funil.length; i++) assert.equal(n3.funil[i].estado, "nao-apurado");
});

test("T007 — marco apurado com valor 0 produz altura 0 exata, sem piso", () => {
  const ficha = { marcos: [{ celula: apurado(500) }, { celula: apurado(0) }], taxas: [{ numerador: apurado(0), denominador: apurado(500), celula: apurado(0) }] };
  const [segmento] = segmentosDoFunil(ficha, [{ estado: "apurado" }]);
  assert.equal(segmento.entrada, 1);
  assert.equal(segmento.saida, 0);
});

test("T007 — a base é o maior marco APURADO da cadeia, não o primeiro marco", () => {
  const topoNaoApurado = naoApuradoF("sem coletor");
  const meio = apurado(100);
  const fim = apurado(10);
  const ficha = {
    marcos: [{ celula: topoNaoApurado }, { celula: meio }, { celula: fim }],
    taxas: [
      { numerador: meio, denominador: topoNaoApurado, celula: naoApuradoF("sem denominador") },
      { numerador: fim, denominador: meio, celula: apurado(0.1) },
    ],
  };
  const [, segundo] = segmentosDoFunil(ficha, [{ estado: "nao-apurado" }, { estado: "apurado" }]);
  assert.equal(segundo.entrada, 1); // base = 100 (o maior apurado — o topo não conta, está não apurado)
  assert.ok(Math.abs(segundo.saida - 0.1) < 1e-9);
});

test("T007 — cadeia com marcos apurados todos em 0 produz alturas 0, nunca NaN nem Infinity", () => {
  const ficha = { marcos: [{ celula: apurado(0) }, { celula: apurado(0) }], taxas: [{ numerador: apurado(0), denominador: apurado(0), celula: apurado(0) }] };
  const [segmento] = segmentosDoFunil(ficha, [{ estado: "apurado" }]);
  assert.equal(segmento.entrada, 0);
  assert.equal(segmento.saida, 0);
  assert.ok(Number.isFinite(segmento.entrada) && Number.isFinite(segmento.saida));
});

test("T007a — nenhum marco apurado: funil inteiro nao-apurado, contagem certa, sem -Infinity vazando (C8, Edge Case 1)", () => {
  const ficha = montarFicha({ slug: "x", perfil: "D", coletado: {} });
  const niveis = montarNiveis(
    entradaBase({ ficha, meta: null, veredito: posicaoDeAtaque(ficha), projecao: projetar({ ficha, meta: null, hoje: "2026-09-01" }), declarada: null }),
  );
  const n3 = niveis.find((n) => n.id === "N3");
  assert.equal(n3.funil.length, PERFIS.D.marcos.length - 1);
  for (const s of n3.funil) {
    assert.equal(s.estado, "nao-apurado");
    assert.equal(s.entrada, undefined);
    assert.equal(s.saida, undefined);
  }
});

test("T007a — taxa 0/0 (denominador zero) vira segmento nao-apurado, nunca apurado com altura 0 (C9, R1)", () => {
  const ficha = montarFicha({ slug: "x", perfil: "D", coletado: { cliques: apurado(0), leads: apurado(0), vendas: apurado(0) } });
  const niveis = montarNiveis(
    entradaBase({ ficha, meta: null, veredito: posicaoDeAtaque(ficha), projecao: projetar({ ficha, meta: null, hoje: "2026-09-01" }), declarada: null }),
  );
  const n3 = niveis.find((n) => n.id === "N3");
  assert.equal(n3.celulas[0].estado, "nao-apurado"); // visitante→lead: 0/0, denominador 0 não é 0%
  assert.equal(n3.funil[0].estado, "nao-apurado");
  assert.equal(n3.funil[0].entrada, undefined);
});

// ── N3 funil — US2: a forma não pode custar o motivo (spec 012) ─────────────

test("T011 — funil é [] para projeto sem perfil; nenhum outro nível ganha o campo `funil`", () => {
  const semPerfil = montarFicha({ slug: "x", perfil: null, coletado: {} });
  const niveis = montarNiveis(
    entradaBase({ ficha: semPerfil, meta: null, veredito: posicaoDeAtaque(semPerfil), projecao: projetar({ ficha: semPerfil, meta: null, hoje: "2026-09-01" }), declarada: null }),
  );
  const n3 = niveis.find((n) => n.id === "N3");
  assert.deepEqual(n3.funil, []);
  for (const id of ["N0", "N1", "N2", "N4", "N5", "N6"]) {
    assert.equal(niveis.find((n) => n.id === id).funil, undefined, `${id} não deveria ter campo funil`);
  }
});

// ── T010 — invariante: listFichas() ⊆ listProjects() por slug ───────────────

test("invariante — todo projeto com `ficha` curada existe em listProjects()", () => {
  const curated = JSON.parse(readFileSync(join(RAIZ, "data/projects.json"), "utf8"));
  const comFicha = curated.filter((p) => p.ficha).map((p) => p.slug);
  assert.ok(comFicha.length > 0, "nenhum projeto curado com `ficha` — o teste não prova nada");
  const todos = new Set(mergeProjects(curated, []).map((p) => p.slug));
  for (const slug of comFicha) assert.ok(todos.has(slug), `${slug} tem ficha mas não está em listProjects()`);
});

// ── escolherFamilia — zero na ENTRADA e zero no FIM são doenças opostas ─────

test("escolherFamilia — zero no FIM da cadeia não é D1", () => {
  // `atma`: 525 cliques, 35 leads, 0 tratamentos. Descoberta é a única coisa que funciona —
  // devolver D1 aqui manda otimizar indexação num projeto que já é achado.
  const ficha = montarFicha({ slug: "atma", perfil: "D", coletado: { cliques: apurado(525), leads: apurado(35), vendas: apurado(0) } });
  const { familia } = escolherFamilia(posicaoDeAtaque(ficha), ficha);
  assert.equal(familia, "D3");
});

test("escolherFamilia — zero na ENTRADA continua D1", () => {
  const ficha = montarFicha({ slug: "x", perfil: "D", coletado: { cliques: apurado(0), leads: apurado(0), vendas: apurado(0) } });
  const { familia } = escolherFamilia(posicaoDeAtaque(ficha), ficha);
  assert.equal(familia, "D1");
});
