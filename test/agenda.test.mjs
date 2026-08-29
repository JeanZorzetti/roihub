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
