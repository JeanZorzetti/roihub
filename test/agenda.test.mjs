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
  seguranca,
  TIPOS,
  ORDEM_BUCKET,
  NO_DATE,
  SEM_RANK,
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

// ── sub-balde segurança (predicado ortogonal a tipoDe) ──────────────────────

test("seguranca: casa os positivos reais", () => {
  for (const t of [
    "Rotacionar o token de produção do MercadoPago",
    "CORS fixo no checkout do app",
    "CVE-2026-1234 no next",
    "credencial exposta no repo público",
  ])
    assert.equal(seguranca(t), true, t);
});

test("seguranca: nem 'author' nem auth dentro de URL — falso-positivo real medido em 31/08", () => {
  assert.equal(seguranca("Definir o author do post"), false);
  assert.equal(
    seguranca("Configurar GitHub OAuth (callback …/api/auth/callback/github) e Resend"),
    false,
  );
  // mas auth isolado, fora de caminho de URL, continua pegando
  assert.equal(seguranca("Rota /admin sem auth"), true);
  assert.equal(seguranca("auth quebrada na Atma"), true);
});

test("seguranca é ortogonal a tipoDe — card de segurança não sai da Execução", () => {
  const t = "Rotacionar o token de produção do MercadoPago";
  assert.equal(tipoDe(t), "execucao");
  assert.equal(seguranca(t), true);
});

test("seguranca(null|undefined) não estoura — mesmo contrato de tipoDe", () => {
  assert.equal(seguranca(null), false);
  assert.equal(seguranca(undefined), false);
});

test("ORDEM_BUCKET: atrasada primeiro, sem data por último", () => {
  const b = ["semdata", "hoje", "depois", "atrasadas", "semana"];
  b.sort((x, y) => ORDEM_BUCKET[x] - ORDEM_BUCKET[y]);
  assert.deepEqual(b, ["atrasadas", "hoje", "semana", "depois", "semdata"]);
});

// ── filtro e ordem da lista ────────────────────────────────────────────────

const CARDS = [
  { titulo: "Conferir LCP", projeto: "goiania", desc: null, bucket: "hoje", tipo: "conferencia", taskId: 1, occ: "2026-07-11" },
  { titulo: "Publicar artigo", projeto: "atma", desc: "sobre preço", bucket: "atrasadas", tipo: "execucao", taskId: 2, occ: "2026-07-09" },
  { titulo: "Decidir cobrança", projeto: null, desc: null, bucket: "semdata", tipo: "decisao", taskId: null, occ: "1970-01-01" },
];

test("lerFiltros descarta valor desconhecido — filtro que não casa com nada esconde a lista", () => {
  const f = lerFiltros(
    { urgencia: "amanha", ordem: "score", projeto: "inexistente", origem: "x", responsavel: "ninguem" },
    ["atma"]
  );
  assert.deepEqual(f, {
    q: "", projeto: "", tipo: "", urgencia: "", origem: "", responsavel: "", ordem: "urgencia",
  });
  assert.deepEqual(filtrosAtivos(f), []);
  // e aceita o que existe
  const ok = lerFiltros(
    { urgencia: "hoje", ordem: "titulo", projeto: "atma", tipo: "decisao", origem: "acao", responsavel: "jean", q: "  lcp  " },
    ["atma"]
  );
  assert.deepEqual(ok, {
    q: "lcp", projeto: "atma", tipo: "decisao", urgencia: "hoje", origem: "acao", responsavel: "jean", ordem: "titulo",
  });
  assert.deepEqual(filtrosAtivos(ok), ["q", "projeto", "tipo", "urgencia", "origem", "responsavel"]);
  // balde inventado na URL não vira filtro que não casa com nada
  assert.equal(lerFiltros({ tipo: "urgente" }, []).tipo, "");
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
  assert.deepEqual(so({ tipo: "conferencia" }), ["Conferir LCP"]);
  assert.deepEqual(so({ tipo: "decisao" }), ["Decidir cobrança"]);
  assert.deepEqual(so({ tipo: "execucao", projeto: "goiania" }), []); // E, também com o balde
});

test("ordenar: ação do ranking primeiro, urgência depois; sem projeto vai para o fim", () => {
  // "Decidir cobrança" é ação do ranking (taskId null): vem antes da tarefa atrasada.
  assert.deepEqual(ordenar(CARDS, "urgencia").map((c) => c.bucket), ["semdata", "atrasadas", "hoje"]);
  assert.deepEqual(ordenar(CARDS, "projeto").map((c) => c.projeto), ["atma", "goiania", null]);
  assert.deepEqual(ordenar(CARDS, "titulo").map((c) => c.titulo), ["Conferir LCP", "Decidir cobrança", "Publicar artigo"]);
  assert.notEqual(ordenar(CARDS, "urgencia"), CARDS); // ordena uma cópia
});

test("ordenar: entre ações o empate preserva a ordem do ranking, e tarefa sem data não sobe junto", () => {
  const acao = (n) => ({ titulo: `acao ${n}`, projeto: `p${n}`, bucket: "semdata", taskId: null, occ: NO_DATE });
  const lista = [
    { titulo: "tarefa sem data", projeto: "z", bucket: "semdata", taskId: 9, occ: NO_DATE },
    { titulo: "tarefa atrasada", projeto: "y", bucket: "atrasadas", taskId: 8, occ: "2026-07-09" },
    acao(1),
    acao(2),
    acao(3),
  ];
  const fora = ordenar(lista, "urgencia").map((c) => c.titulo);
  // as três ações no topo, na ordem em que o ranking as entregou (#1, #2, #3)
  assert.deepEqual(fora.slice(0, 3), ["acao 1", "acao 2", "acao 3"]);
  // e a tarefa sem data continua depois da atrasada — só a ação foi promovida
  assert.deepEqual(fora.slice(3), ["tarefa atrasada", "tarefa sem data"]);
});

test("ordenar: dentro do mesmo balde de data quem manda é o ranking do projeto", () => {
  const t = (n, rank, occ) => ({ titulo: n, projeto: n, bucket: "atrasadas", tipo: "execucao", taskId: 1, rank, occ });
  // a do #20 venceu por 20 dias de atraso; a do #1 é que tem que aparecer primeiro
  const lista = [t("projeto 20", 19, "2026-07-01"), t("projeto 1", 0, "2026-07-21")];
  assert.deepEqual(ordenar(lista, "urgencia").map((c) => c.titulo), ["projeto 1", "projeto 20"]);
  // empatado no rank, a data volta a desempatar
  const par = [t("b", 3, "2026-07-21"), t("a", 3, "2026-07-01")];
  assert.deepEqual(ordenar(par, "urgencia").map((c) => c.titulo), ["a", "b"]);
});

test("ordenar: rank ausente não vira NaN — a linha vai para o fim do balde", () => {
  const t = (n, rank) => ({ titulo: n, projeto: n, bucket: "hoje", tipo: "execucao", taskId: 1, rank, occ: "2026-07-11" });
  const lista = [t("sem projeto", undefined), t("curado", 5), t("fora do curado", SEM_RANK)];
  assert.deepEqual(ordenar(lista, "urgencia").map((c) => c.titulo), [
    "curado",
    "sem projeto",
    "fora do curado",
  ]);
  assert.ok(Number.isFinite(SEM_RANK), "SEM_RANK infinito faria Infinity - Infinity = NaN");
});

test("ordenar: a ação do ranking sobe pelo rank, não pela estabilidade do sort", () => {
  const acao = (n, rank) => ({ titulo: `acao ${n}`, projeto: `p${n}`, bucket: "semdata", tipo: "execucao", taskId: null, rank, occ: NO_DATE });
  // entregues fora de ordem de propósito: se o rank não fosse chave, sairia 3, 1, 2
  const fora = ordenar([acao(3, 2), acao(1, 0), acao(2, 1)], "urgencia").map((c) => c.titulo);
  assert.deepEqual(fora, ["acao 1", "acao 2", "acao 3"]);
});

test("partição de segurança: dentro do grupo, ordenar() continua valendo pelo rank", () => {
  const t = (n, rank, seg) => ({
    titulo: n, projeto: n, bucket: "atrasadas", tipo: "execucao", taskId: 1, rank, occ: "2026-07-01", seguranca: seg,
  });
  const items = [t("comum rank 2", 1, false), t("seguranca rank 20", 19, true)];
  const seg = items.filter((i) => i.seguranca);
  const resto = seg.length ? items.filter((i) => !i.seguranca) : items;
  assert.deepEqual(ordenar(seg, "urgencia").map((c) => c.titulo), ["seguranca rank 20"]);
  assert.deepEqual(ordenar(resto, "urgencia").map((c) => c.titulo), ["comum rank 2"]);
  // dentro do próprio grupo de segurança, o rank do projeto continua desempatando
  const doisDeSeg = [t("seg rank 5", 4, true), t("seg rank 1", 0, true)];
  assert.deepEqual(
    ordenar(doisDeSeg.filter((i) => i.seguranca), "urgencia").map((c) => c.titulo),
    ["seg rank 1", "seg rank 5"],
  );
});

test("comFiltro: remover um chip preserva os outros e omite a ordem padrão", () => {
  const f = lerFiltros({ q: "lcp", projeto: "atma", urgencia: "hoje", ordem: "titulo" }, ["atma"]);
  assert.equal(comFiltro(f, "projeto", ""), "?q=lcp&urgencia=hoje&ordem=titulo");
  assert.equal(comFiltro({ ...f, q: "", projeto: "", urgencia: "" }, "ordem", "urgencia"), "?");
});
