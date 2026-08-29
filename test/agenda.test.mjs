import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todaySP,
  addDaysISO,
  weekdayOf,
  nextOccurrence,
  hash8,
  brShort,
  tipoDe,
  TIPOS,
  ORDEM_BUCKET,
  lerFiltros,
  filtrosAtivos,
  comFiltro,
  filtrar,
  ordenar,
} from "../lib/agenda.mjs";

test("todaySP resolve o fuso de São Paulo na virada do dia UTC", () => {
  // 01:00 UTC = 22:00 do dia anterior em SP
  assert.equal(todaySP(new Date("2026-07-11T01:00:00Z")), "2026-07-10");
  assert.equal(todaySP(new Date("2026-07-11T12:00:00Z")), "2026-07-11");
});

test("addDaysISO cruza mês e ano", () => {
  assert.equal(addDaysISO("2026-07-30", 3), "2026-08-02");
  assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysISO("2026-07-11", -1), "2026-07-10");
});

test("nextOccurrence: hoje conta; senão avança até o weekday", () => {
  // 2026-07-11 é sábado (6)
  assert.equal(weekdayOf("2026-07-11"), 6);
  assert.equal(nextOccurrence(6, "2026-07-11"), "2026-07-11"); // sábado hoje
  assert.equal(nextOccurrence(1, "2026-07-11"), "2026-07-13"); // segunda que vem
  assert.equal(nextOccurrence(5, "2026-07-11"), "2026-07-17"); // sexta que vem
  assert.equal(nextOccurrence(7, "2026-07-11"), "2026-07-11"); // 7 = diária: sempre hoje
  assert.equal(nextOccurrence(7, "2026-07-12"), "2026-07-12");
});

test("hash8 estável e sensível ao texto", () => {
  assert.equal(hash8("abc"), hash8("abc"));
  assert.notEqual(hash8("abc"), hash8("abd"));
  assert.equal(hash8("qualquer").length, 8);
});

test("brShort", () => {
  assert.equal(brShort("2026-07-15"), "15/07");
});

// ── baldes por tipo ────────────────────────────────────────────────────────
// Os casos abaixo são TÍTULOS REAIS de cards que estavam na agenda em 29/08 —
// as três últimas linhas de cada bloco são as armadilhas que a heurística
// ingênua erra ("medido", "kill-gate", "escolhem").

test("tipoDe: conferência = medir/olhar um número", () => {
  for (const t of [
    "Estado 2026-08-12: 2 novo(s) · 3 resolvido(s)",
    "Conferir rank tracking pós-cron (segunda 09:00 UTC)",
    "Gate 28/07: medir posição branded 'sirius crm' no GSC",
    "Remedir cliques não-branded ~14/08 (CTR do 'agaas')",
    "Verificar goiania.roilabs.com.br no Bing Webmaster Tools",
    "Esperar o crawl — descoberto e nunca rastreado",
    "Checkpoint da malha — GSC miner + dados escolhem o ciclo 15",
    "Medir em ~7 dias se o coverageState saiu de 'unknown to Google'",
    "Nada urgente: o schema segue limpo. Próxima checagem só faz sentido depois",
    "Sem blocker técnico: produto funciona ponta a ponta. Falta tração",
  ])
    assert.equal(tipoDe(t), "conferencia", t);
});

test("tipoDe: execução = escrever, publicar, deployar", () => {
  for (const t of [
    "Publicar 1 artigo novo no blog",
    "Implementar spec 012 home V4 (T001–T017) no sofia-next",
    "Setar GOOGLE_CLIENT_ID no EasyPanel e rodar disputa E2E",
    "Consertar o IndexNow (403) — o recrawl da malha está mudo",
    "Rotina de sexta: export crawl stats → ml/analyze.py → commit+push",
    "Opção C: parar o dashboard de mentir (Math.random -> estado vazio honesto)",
    // "medido" é particípio: conta o passado do card, não o que falta fazer
    "Repo: meridian — deixar /admin funcional (stub em 302, medido em 30/07)",
    // "kill-gate" não é "Gate <data>"
    "On-page + links internos pro /checker — sair da zona de risco do kill-gate",
  ])
    assert.equal(tipoDe(t), "execucao", t);
});

test("tipoDe: decisão vence conferência — decidir trava a medição", () => {
  for (const t of [
    "MANUAL (Jean): decidir se religa o autopublish e se afrouxa o gate ymyl",
    "DECISÃO DO JEAN: o que o cyberspace vai ser?",
    "Decidir se vira produto cobrável ou fica como infra do Sirius",
    "Decidir se a QPrime vai para domínio próprio",
  ])
    assert.equal(tipoDe(t), "decisao", t);
  // o card do aftercare tem "gate ymyl" (conferência) E "decidir" — decisão ganha
  assert.equal(tipoDe("Gate 31/08: decidir se religa"), "decisao");
});

test("tipoDe: todo título cai em um dos três baldes, sem exceção", () => {
  const ids = new Set(TIPOS.map((t) => t.id));
  for (const t of ["", "   ", "xyz sem verbo nenhum", null, undefined])
    assert.ok(ids.has(tipoDe(t)), `caiu fora dos baldes: ${JSON.stringify(t)}`);
});

test("ORDEM_BUCKET: atrasada primeiro, sem data por último", () => {
  const b = ["semdata", "hoje", "depois", "atrasadas", "semana"];
  b.sort((x, y) => ORDEM_BUCKET[x] - ORDEM_BUCKET[y]);
  assert.deepEqual(b, ["atrasadas", "hoje", "semana", "depois", "semdata"]);
});

// ── filtro e ordem da lista ────────────────────────────────────────────────

const CARDS = [
  { titulo: "Conferir LCP", projeto: "goiania", desc: null, bucket: "hoje", taskId: 1, occ: "2026-07-11" },
  { titulo: "Publicar artigo", projeto: "atma", desc: "sobre preço", bucket: "atrasadas", taskId: 2, occ: "2026-07-09" },
  { titulo: "Decidir cobrança", projeto: null, desc: null, bucket: "semdata", taskId: null, occ: "1970-01-01" },
];

test("lerFiltros descarta valor desconhecido — filtro que não casa com nada esconde a lista", () => {
  const f = lerFiltros({ urgencia: "amanha", ordem: "score", projeto: "inexistente", origem: "x" }, ["atma"]);
  assert.deepEqual(f, { q: "", projeto: "", urgencia: "", origem: "", ordem: "urgencia" });
  assert.deepEqual(filtrosAtivos(f), []);
  // e aceita o que existe
  const ok = lerFiltros({ urgencia: "hoje", ordem: "titulo", projeto: "atma", origem: "acao", q: "  lcp  " }, ["atma"]);
  assert.deepEqual(ok, { q: "lcp", projeto: "atma", urgencia: "hoje", origem: "acao", ordem: "titulo" });
  assert.deepEqual(filtrosAtivos(ok), ["q", "projeto", "urgencia", "origem"]);
});

test("filtrar: texto ignora acento e varre título, projeto e descrição", () => {
  const so = (sp) => filtrar(CARDS, lerFiltros(sp, ["atma", "goiania"])).map((c) => c.titulo);
  assert.deepEqual(so({ q: "cobranca" }), ["Decidir cobrança"]); // acento na tarefa, não na busca
  assert.deepEqual(so({ q: "PREÇO" }), ["Publicar artigo"]); // casa pela descrição
  assert.deepEqual(so({ q: "goiania" }), ["Conferir LCP"]); // casa pelo projeto
  assert.deepEqual(so({ projeto: "atma" }), ["Publicar artigo"]);
  assert.deepEqual(so({ urgencia: "atrasadas" }), ["Publicar artigo"]);
  assert.deepEqual(so({ origem: "acao" }), ["Decidir cobrança"]); // taskId null = ação do ranking
  assert.deepEqual(so({ origem: "tarefa" }), ["Conferir LCP", "Publicar artigo"]);
  assert.deepEqual(so({ projeto: "atma", urgencia: "hoje" }), []); // filtros são E, não OU
});

test("ordenar: urgência é o padrão e o desempate; sem projeto vai para o fim", () => {
  assert.deepEqual(ordenar(CARDS, "urgencia").map((c) => c.bucket), ["atrasadas", "hoje", "semdata"]);
  assert.deepEqual(ordenar(CARDS, "projeto").map((c) => c.projeto), ["atma", "goiania", null]);
  assert.deepEqual(ordenar(CARDS, "titulo").map((c) => c.titulo), ["Conferir LCP", "Decidir cobrança", "Publicar artigo"]);
  assert.notEqual(ordenar(CARDS, "urgencia"), CARDS); // ordena uma cópia
});

test("comFiltro: remover um chip preserva os outros e omite a ordem padrão", () => {
  const f = lerFiltros({ q: "lcp", projeto: "atma", urgencia: "hoje", ordem: "titulo" }, ["atma"]);
  assert.equal(comFiltro(f, "projeto", ""), "?q=lcp&urgencia=hoje&ordem=titulo");
  assert.equal(comFiltro({ ...f, q: "", projeto: "", urgencia: "" }, "ordem", "urgencia"), "?");
});
