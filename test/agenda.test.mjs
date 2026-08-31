import { test } from "node:test";
import assert from "node:assert/strict";
import {
  todaySP,
  addDaysISO,
  hash8,
  acoesDoRanking,
  brShort,
  tipoDe,
  seguranca,
  TIPOS,
  NO_DATE,
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

// ── filtro e ordem da lista ────────────────────────────────────────────────

const CARDS = [
  { titulo: "Conferir LCP", projeto: "goiania", desc: null, tipo: "conferencia", rank: 0, occ: NO_DATE },
  { titulo: "Publicar artigo", projeto: "atma", desc: "sobre preço", tipo: "execucao", rank: 1, occ: NO_DATE },
  { titulo: "Decidir cobrança", projeto: "sirius", desc: null, tipo: "decisao", rank: 2, occ: NO_DATE },
];

test("lerFiltros descarta valor desconhecido — filtro que não casa com nada esconde a lista", () => {
  const f = lerFiltros({ ordem: "score", projeto: "inexistente", urgencia: "hoje" }, ["atma"]);
  assert.deepEqual(f, { q: "", projeto: "", tipo: "", ordem: "ranking" });
  assert.deepEqual(filtrosAtivos(f), []);
  // e aceita o que existe
  const ok = lerFiltros({ ordem: "titulo", projeto: "atma", tipo: "decisao", q: "  lcp  " }, ["atma"]);
  assert.deepEqual(ok, { q: "lcp", projeto: "atma", tipo: "decisao", ordem: "titulo" });
  assert.deepEqual(filtrosAtivos(ok), ["q", "projeto", "tipo"]);
  // balde inventado na URL não vira filtro que não casa com nada
  assert.equal(lerFiltros({ tipo: "urgente" }, []).tipo, "");
  // urgência, origem e responsável saíram com as tarefas do banco: não voltam pela querystring
  assert.deepEqual(Object.keys(lerFiltros({ origem: "tarefa", responsavel: "jean" }, [])).sort(), [
    "ordem", "projeto", "q", "tipo",
  ]);
});

test("filtrar: texto ignora acento e varre título, projeto e descrição", () => {
  const so = (sp) => filtrar(CARDS, lerFiltros(sp, ["atma", "goiania"])).map((c) => c.titulo);
  assert.deepEqual(so({ q: "cobranca" }), ["Decidir cobrança"]); // acento na tarefa, não na busca
  assert.deepEqual(so({ q: "PREÇO" }), ["Publicar artigo"]); // casa pela descrição
  assert.deepEqual(so({ q: "goiania" }), ["Conferir LCP"]); // casa pelo projeto
  assert.deepEqual(so({ projeto: "atma" }), ["Publicar artigo"]);
  assert.deepEqual(so({ projeto: "atma", tipo: "decisao" }), []); // filtros são E, não OU
  assert.deepEqual(so({ tipo: "conferencia" }), ["Conferir LCP"]);
  assert.deepEqual(so({ tipo: "decisao" }), ["Decidir cobrança"]);
  assert.deepEqual(so({ tipo: "execucao", projeto: "goiania" }), []); // E, também com o balde
});

test("ordenar: a ordem padrão é a do ranking, não a de chegada", () => {
  assert.deepEqual(ordenar([CARDS[2], CARDS[0], CARDS[1]], "ranking").map((c) => c.rank), [0, 1, 2]);
  assert.deepEqual(ordenar(CARDS, "projeto").map((c) => c.projeto), ["atma", "goiania", "sirius"]);
  assert.deepEqual(ordenar(CARDS, "titulo").map((c) => c.titulo), ["Conferir LCP", "Decidir cobrança", "Publicar artigo"]);
  assert.notEqual(ordenar(CARDS, "ranking"), CARDS); // ordena uma cópia
});

test("ordenar: a linha sobe pelo rank, não pela estabilidade do sort", () => {
  const acao = (n, rank) => ({ titulo: `acao ${n}`, projeto: `p${n}`, tipo: "execucao", rank, occ: NO_DATE });
  // entregues fora de ordem de propósito: se o rank não fosse chave, sairia 3, 1, 2
  const fora = ordenar([acao(3, 2), acao(1, 0), acao(2, 1)], "ranking").map((c) => c.titulo);
  assert.deepEqual(fora, ["acao 1", "acao 2", "acao 3"]);
});

test("ordenar: empate em projeto ou título é desempatado pelo ranking", () => {
  const c = (rank) => ({ titulo: "mesma coisa", projeto: "p", tipo: "execucao", rank, occ: NO_DATE });
  assert.deepEqual(ordenar([c(7), c(2)], "projeto").map((x) => x.rank), [2, 7]);
  assert.deepEqual(ordenar([c(7), c(2)], "titulo").map((x) => x.rank), [2, 7]);
});

test("partição de segurança: dentro do grupo, ordenar() continua valendo pelo rank", () => {
  const t = (n, rank, seg) => ({ titulo: n, projeto: n, tipo: "execucao", rank, occ: NO_DATE, seguranca: seg });
  const items = [t("comum rank 2", 1, false), t("seguranca rank 20", 19, true)];
  const seg = items.filter((i) => i.seguranca);
  const resto = seg.length ? items.filter((i) => !i.seguranca) : items;
  assert.deepEqual(ordenar(seg, "ranking").map((c) => c.titulo), ["seguranca rank 20"]);
  assert.deepEqual(ordenar(resto, "ranking").map((c) => c.titulo), ["comum rank 2"]);
  // dentro do próprio grupo de segurança, o rank do projeto continua desempatando
  const doisDeSeg = [t("seg rank 5", 4, true), t("seg rank 1", 0, true)];
  assert.deepEqual(
    ordenar(doisDeSeg.filter((i) => i.seguranca), "ranking").map((c) => c.titulo),
    ["seg rank 1", "seg rank 5"],
  );
});

test("comFiltro: remover um chip preserva os outros e omite a ordem padrão", () => {
  const f = lerFiltros({ q: "lcp", projeto: "atma", tipo: "decisao", ordem: "titulo" }, ["atma"]);
  assert.equal(comFiltro(f, "projeto", ""), "?q=lcp&tipo=decisao&ordem=titulo");
  assert.equal(comFiltro({ ...f, q: "", projeto: "", tipo: "" }, "ordem", "ranking"), "?");
});

test("acoesDoRanking: card sem `acao` não vira linha, e o #N continua sendo a posição no ranking", () => {
  const curados = [
    { slug: "atma", acao: "medir o checkout", score: 9 },
    { slug: "lumina", acao: "", acaoDesc: "demonstração — não abrir tarefa de SEO neste card", score: 5 },
    { slug: "portfolio", acao: "   ", score: 4 }, // só espaço é tão vazio quanto ""
    { slug: "sirius", acao: "ligar a cobrança", score: 3 },
  ];
  const acoes = acoesDoRanking(curados);
  // os 3 cards fantasma de 31/08: `acao` vazia caía no fallback "execucao" com título em branco
  assert.deepEqual(acoes.map((a) => a.projeto), ["atma", "sirius"]);
  assert.ok(acoes.every((a) => a.titulo.trim()));
  // numerar DEPOIS de filtrar traria de volta o bug de 29/08 — sirius é o #4 do ranking, não o #2
  assert.deepEqual(acoes.map((a) => a.meta), ["#1 · score 9", "#4 · score 3"]);
  assert.deepEqual(acoes.map((a) => a.rank), [0, 3]);
  // `acao` ausente não pode estourar: card novo entra no JSON sem o campo
  assert.deepEqual(acoesDoRanking([{ slug: "novo", score: 1 }]), []);
});
