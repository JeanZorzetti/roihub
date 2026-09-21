import test from "node:test";
import assert from "node:assert/strict";
import { filaDoDia, repartir, amostra, classificar, classificarRich, agregar, taxasDeIndexacao } from "../lib/indexacao-corrida.mjs";

const linha = (extra) => ({ url: "https://a/1", propriedade: "sc-domain:a", verdict: "", coverage: "", ultimoCrawl: "", erro: "", ...extra });
const indexada = (n = 1) => Array.from({ length: n }, () => linha({ verdict: "PASS", coverage: "Submitted and indexed" }));
const falha = (n = 1) => Array.from({ length: n }, () => linha({ erro: "429 Quota exceeded" }));

test("a fila é a última apuração mais antiga primeiro, e nunca apurado vem antes de tudo", () => {
  const fila = filaDoDia([
    { slug: "b", ultimaApuracao: "2026-09-01" },
    { slug: "a", ultimaApuracao: null },
    { slug: "c", ultimaApuracao: "2026-08-20" },
  ]);
  assert.deepEqual(fila.map((f) => f.slug), ["a", "c", "b"]);
});

test("empate de data desempata por slug — fila não-determinística move a fração sem o site mudar", () => {
  const mesma = "2026-09-01";
  const fila = filaDoDia([
    { slug: "zeta", ultimaApuracao: mesma },
    { slug: "alfa", ultimaApuracao: mesma },
  ]);
  assert.deepEqual(fila.map((f) => f.slug), ["alfa", "zeta"]);
});

// SC-003, o modo de falha que a spec nomeia como o PIOR: 21 projetos que resolvem para a mesma
// propriedade dividem UMA quota. Teto por projeto daria 21.000 e as últimas inspeções voltariam
// 429 — que, sem a quinta classe, viraria "não indexada".
test("21 projetos na mesma propriedade somam 2.000, não 21.000", () => {
  const fila = Array.from({ length: 21 }, (_, i) => ({
    slug: `sub${i}`,
    propriedade: "sc-domain:roilabs.com.br",
    declaradas: 1000,
    ultimaApuracao: null,
  }));
  const fatias = repartir(fila, 2000, 100000);
  assert.equal(fatias.reduce((a, f) => a + f.cota, 0), 2000);
  // E o corte cai na FILA, não em rateio igualitário: quem está na frente inspeciona de verdade.
  assert.deepEqual(fatias.slice(0, 3).map((f) => f.cota), [1000, 1000, 0]);
});

test("propriedades diferentes têm saldos independentes", () => {
  const fatias = repartir(
    [
      { slug: "a", propriedade: "sc-domain:x", declaradas: 5000, ultimaApuracao: null },
      { slug: "b", propriedade: "sc-domain:y", declaradas: 300, ultimaApuracao: null },
    ],
    2000,
    100000,
  );
  assert.deepEqual(fatias.map((f) => f.cota), [2000, 300]);
});

test("o teto da corrida corta antes do da propriedade — ele existe para o TEMPO", () => {
  const fatias = repartir(
    [
      { slug: "a", propriedade: "sc-domain:x", declaradas: 1000, ultimaApuracao: null },
      { slug: "b", propriedade: "sc-domain:y", declaradas: 1000, ultimaApuracao: null },
    ],
    2000,
    400,
  );
  assert.deepEqual(fatias.map((f) => f.cota), [400, 0]);
});

// FR-015: "não perguntei" e "perguntei e deu zero" não podem virar o mesmo número.
test("cota zero com sitemap cheio é sem_orcamento; sitemap vazio não inventa motivo", () => {
  const fatias = repartir(
    [
      { slug: "a", propriedade: "sc-domain:x", declaradas: 2000, ultimaApuracao: null },
      { slug: "b", propriedade: "sc-domain:x", declaradas: 340, ultimaApuracao: null },
      { slug: "c", propriedade: "sc-domain:x", declaradas: 0, ultimaApuracao: null },
    ],
    2000,
    100000,
  );
  assert.deepEqual(fatias.map((f) => f.motivo), [null, "sem_orcamento", null]);
});

test("host fora de toda propriedade não consome saldo e sai como sem_propriedade", () => {
  const fatias = repartir(
    [
      { slug: "vendor", propriedade: null, declaradas: 900, ultimaApuracao: null },
      { slug: "a", propriedade: "sc-domain:x", declaradas: 2000, ultimaApuracao: null },
    ],
    2000,
    100000,
  );
  assert.deepEqual(fatias, [
    { slug: "vendor", cota: 0, motivo: "sem_propriedade" },
    { slug: "a", cota: 2000, motivo: null },
  ]);
});

// SC-004: a fração não pode se mexer por troca de amostra.
test("a amostra é o prefixo e não se move entre corridas, nem quando o sitemap cresce no fim", () => {
  const urls = Array.from({ length: 1200 }, (_, i) => `https://a/${i}`);
  assert.deepEqual(amostra(urls, 200), amostra(urls, 200));
  const cresceu = [...urls, "https://a/novo-1", "https://a/novo-2"];
  assert.deepEqual(amostra(cresceu, 200), amostra(urls, 200));
  assert.equal(amostra(urls, 200).length, 200);
  // Cota maior que o inventário devolve o inventário, não erro.
  assert.equal(amostra(["https://a/1"], 200).length, 1);
});

// SC-005 / FR-008 — a ordem dos testes de `classificar` é a regra: uma resposta de erro tem
// verdict e coverage vazios e cairia em "outra" se o erro fosse checado depois.
test("erro é falha ANTES de qualquer veredito", () => {
  assert.equal(classificar(linha({ erro: "429 Quota exceeded" })), "falha");
  assert.equal(classificar(linha({ erro: "sem propriedade no GSC" })), "falha");
  // Erro junto de veredito bom continua sendo falha: a resposta não é confiável.
  assert.equal(classificar(linha({ erro: "ETIMEDOUT", verdict: "PASS", coverage: "Submitted and indexed" })), "falha");
});

// US2 — as duas classes de rastreio têm PROGNÓSTICOS INCOMPATÍVEIS e nunca somam num balde único:
// "rastreada e recusada" é o Googlebot lendo e dizendo não (trabalho editorial, nenhum conserto
// técnico move), "descoberta e não lida" é ele nem ter chegado lá (link interno e crawl).
test("as duas classes de não-indexação ficam separadas", () => {
  assert.equal(classificar(linha({ coverage: "Crawled - currently not indexed" })), "rastreada_nao_indexada");
  assert.equal(classificar(linha({ coverage: "Discovered - currently not indexed" })), "descoberta_nao_indexada");
});

test("indexada é PASS mais coverage de indexado, e nada mais cai lá", () => {
  assert.equal(classificar(linha({ verdict: "PASS", coverage: "Submitted and indexed" })), "indexada");
  assert.equal(classificar(linha({ verdict: "PASS", coverage: "Indexed, not submitted in sitemap" })), "indexada");
  // Veredito bom com coverage que não é de índice NÃO é indexada — o par é que significa.
  assert.equal(classificar(linha({ verdict: "PASS", coverage: "Page with redirect" })), "outra");
});

test("coverageState desconhecido cai em outra, não em um dos baldes de rastreio", () => {
  assert.equal(classificar(linha({ coverage: "Excluded by noindex tag" })), "outra");
  assert.equal(classificar(linha({ coverage: "Duplicate without user-selected canonical" })), "outra");
  assert.equal(classificar(linha({ coverage: "" })), "outra");
});

test("a rejeição de rastreio soma as duas classes sobre o mesmo denominador da taxa", () => {
  const r = agregar([
    ...indexada(6),
    linha({ coverage: "Crawled - currently not indexed" }),
    linha({ coverage: "Discovered - currently not indexed" }),
    ...falha(2),
  ]);
  assert.equal(r.rastreadasNaoIndexadas, 1);
  assert.equal(r.descobertasNaoIndexadas, 1);
  assert.equal(r.rejeicao, 2 / 8, "a rejeição tem que dividir pelo mesmo denominador da taxa, sem as falhas");
});

test("agregar tira a falha do numerador E do denominador", () => {
  const r = agregar([...indexada(4), ...falha(3), linha({ coverage: "Crawled - currently not indexed" }), linha({ coverage: "Discovered - currently not indexed" }), linha({ coverage: "Page with redirect" })]);
  assert.equal(r.inspecionadas, 10);
  assert.equal(r.falhas, 3);
  assert.equal(r.indexadas, 4);
  assert.equal(r.taxa, 4 / 7, "a taxa dividiu por 10: erro de quota está sendo contado como não-indexação");
});

test("tudo falhou é não apurado (null), nunca 0%", () => {
  const r = agregar(falha(10));
  assert.equal(r.taxa, null, "0% aqui reportaria como desindexado um site que ninguém perguntou");
  assert.equal(r.rejeicao, null);
  assert.equal(agregar([]).taxa, null);
});

// 043 — a tela lê as CONTAGENS gravadas e refaz a divisão. Se a leitura do banco der outro número
// que a corrida, as duas telas que abrem este KPI discordam sobre o mesmo dia.
test("as razões refeitas das contagens gravadas são as da corrida", () => {
  const r = agregar([
    ...indexada(18),
    ...Array.from({ length: 7 }, () => linha({ coverage: "Discovered - currently not indexed" })),
    linha({ coverage: "URL is unknown to Google" }),
    ...falha(2),
  ]);
  const t = taxasDeIndexacao(r);
  assert.equal(t.taxa, r.taxa);
  assert.equal(t.rejeicao, r.rejeicao);
  assert.equal(t.base, 26, "a falha sai do denominador; o 'unknown' fica nele, em outras");
  assert.deepEqual(taxasDeIndexacao({ inspecionadas: 3, falhas: 3, indexadas: 0, rastreadasNaoIndexadas: 0, descobertasNaoIndexadas: 0 }), { base: 0, taxa: null, rejeicao: null });
});

// A invariante do data-model: se quebrar, uma URL caiu em dois baldes ou em nenhum.
test("inspecionadas = indexadas + rastreadas + descobertas + outras + falhas", () => {
  const amostras = [
    [],
    indexada(3),
    falha(2),
    [...indexada(2), ...falha(1), linha({ coverage: "Crawled - currently not indexed" })],
    [linha({ verdict: "NEUTRAL", coverage: "URL is unknown to Google" }), linha({ coverage: "Discovered - currently not indexed" })],
  ];
  for (const linhas of amostras) {
    const r = agregar(linhas);
    assert.equal(
      r.inspecionadas,
      r.indexadas + r.rastreadasNaoIndexadas + r.descobertasNaoIndexadas + r.outras + r.falhas,
      `soma dos baldes não fecha para ${JSON.stringify(linhas)}`,
    );
  }
});

// ── 039: a segunda metade do relatório, que a mesma inspeção já baixa ────────

const rich = (...tipos) => ({ detectedItems: tipos.map((t) => ({ richResultType: t, items: [{ name: "x" }] })) });
const indexadaCom = (r) => linha({ verdict: "PASS", coverage: "Submitted and indexed", rich: r });

test("indexada SEM relatório é zero medido; fora do índice sem relatório é não há onde olhar", () => {
  // Os dois chegam da API do jeito IDÊNTICO — `richResultsResult` omitido. O que os separa é o
  // estado de indexação, e colapsá-los transformaria um problema de indexação numa acusação
  // contra o schema. Medido na Atma em 20/09/2026: a home é o primeiro caso, /pacientes/precos
  // (o único Product do site, "Discovered - currently not indexed") é o segundo.
  assert.equal(classificarRich(indexadaCom(null)), "nenhum");
  assert.equal(classificarRich(linha({ verdict: "NEUTRAL", coverage: "Discovered - currently not indexed" })), "sem_relatorio");
  assert.equal(classificarRich(linha({ verdict: "NEUTRAL", coverage: "URL is unknown to Google" })), "sem_relatorio");
});

test("erro crítico vence item detectado na mesma página", () => {
  const comAmbos = indexadaCom({
    detectedItems: [
      { richResultType: "Breadcrumbs", items: [{ name: "ok" }] },
      { richResultType: "Product", items: [{ name: "x", issues: [{ issueMessage: "missing field price", severity: "ERROR" }] }] },
    ],
  });
  assert.equal(classificarRich(comAmbos), "com_erro", "um erro presente não é apagado por um acerto ao lado — o board mede 0 erros críticos");
  const soAviso = indexadaCom({ detectedItems: [{ richResultType: "Article", items: [{ name: "x", issues: [{ issueMessage: "no image", severity: "WARNING" }] }] }] });
  assert.equal(classificarRich(soAviso), "com_rich", "WARNING não é erro crítico");
});

test("a cobertura divide por quem tem relatório, não por quem foi inspecionado", () => {
  const r = agregar([
    ...Array.from({ length: 3 }, () => indexadaCom(rich("Breadcrumbs"))),
    indexadaCom(null),
    linha({ verdict: "NEUTRAL", coverage: "Discovered - currently not indexed" }),
    linha({ verdict: "NEUTRAL", coverage: "Discovered - currently not indexed" }),
  ]);
  assert.equal(r.inspecionadas, 6);
  assert.equal(r.richJulgadas, 4);
  assert.equal(r.cobertura, 3 / 4, "dividir por 6 mediria o schema com a régua da indexação");
  assert.equal(r.richSemRelatorio, 2);
});

test("falha de inspeção sai das DUAS medidas, e é contada uma vez só", () => {
  const r = agregar([...indexada(2), ...falha(3)]);
  assert.equal(r.falhas, 3, "a falha não pode ser contada de novo no balde de resultado enriquecido");
  assert.equal(r.richJulgadas, 2);
  assert.equal(r.cobertura, 0, "duas indexadas sem relatório são zero MEDIDO, não null");
  assert.equal(agregar(falha(4)).cobertura, null, "sem ninguém julgado é não apurado, nunca 0%");
});

test("os tipos contam URLs, não itens — e nomeiam a cobertura de QUÊ", () => {
  const c = agregar([
    indexadaCom({ detectedItems: [{ richResultType: "Breadcrumbs", items: [{ name: "a" }, { name: "b" }] }] }),
    indexadaCom(rich("Breadcrumbs", "Review snippets")),
    indexadaCom(null),
  ]).richTipos;
  assert.deepEqual(c, { Breadcrumbs: 2, "Review snippets": 1 }, "duas trilhas na mesma página não são duas páginas com trilha");
});

test("inspecionadas = com + erro + nenhum + sem relatório + falhas", () => {
  const amostras = [
    [],
    [...indexada(2), ...falha(1)],
    [indexadaCom(rich("Breadcrumbs")), indexadaCom(null), linha({ coverage: "Crawled - currently not indexed" }), ...falha(2)],
  ];
  for (const linhas of amostras) {
    const r = agregar(linhas);
    assert.equal(
      r.inspecionadas,
      r.richCom + r.richErro + r.richNenhum + r.richSemRelatorio + r.falhas,
      `soma dos baldes de resultado enriquecido não fecha para ${JSON.stringify(linhas)}`,
    );
  }
});
