import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coletarConformidade,
  coletarGateways,
  coletarPool,
  coletarRepo,
  diffEstado,
  mesclarEstado,
  montarCard,
  primeiraCorrida,
} from "../lib/estado-noturno.mjs";

test("conformidade só coleta violação — ok:true e ok:null ficam fora", async () => {
  const projetos = [{ slug: "a", url: "https://a" }, { slug: "b", url: "https://b" }];
  const rodar = async (p) => ({
    slug: p.slug,
    linhas: [
      { id: "GEO-01", ok: false, detalhe: "llms.txt 404" },
      { id: "VER-01", ok: true },
      { id: "SEC-01", ok: null, detalhe: "não é next" },
    ],
  });
  const mapa = await coletarConformidade(projetos, rodar);
  assert.deepEqual(Object.keys(mapa).sort(), ["CONF:a:GEO-01", "CONF:b:GEO-01"]);
  assert.equal(mapa["CONF:a:GEO-01"], "llms.txt 404");
});

test("conformidade ignora projeto sem url e passa os irmãos (VER-04 depende disso)", async () => {
  const projetos = [{ slug: "a", url: "https://a" }, { slug: "sem", url: "" }];
  let irmaosVistos = null;
  const rodar = async (p, irmaos) => {
    irmaosVistos = irmaos;
    return { slug: p.slug, linhas: [] };
  };
  await coletarConformidade(projetos, rodar);
  assert.deepEqual(irmaosVistos.map((p) => p.slug), ["a"]);
});

test("conformidade não perde projeto na fan-out concorrente", async () => {
  const projetos = Array.from({ length: 20 }, (_, i) => ({ slug: `p${i}`, url: "https://x" }));
  const rodar = async (p) => ({ slug: p.slug, linhas: [{ id: "X", ok: false }] });
  const mapa = await coletarConformidade(projetos, rodar, 6);
  assert.equal(Object.keys(mapa).length, 20);
});

test("o balde é a chave: mudar de balde troca as duas pontas do diff", () => {
  const antes = coletarGateways([{ slug: "sirius", balde: "sem-gateway", motivo: "nenhum caminho" }]);
  const agora = coletarGateways([{ slug: "sirius", balde: "ligado", motivo: "mercadopago" }]);
  const { novos, sumidos } = diffEstado(antes, agora);
  assert.deepEqual(novos.map((n) => n.chave), ["GTW:sirius:ligado"]);
  assert.deepEqual(sumidos.map((s) => s.chave), ["GTW:sirius:sem-gateway"]);
});

// Os estados são os de `classificarConta`: viva | rate-limit | desabilitada | auth | outro.
// `rate-limit` (429) recarrega esperando, `desabilitada` (403) NÃO — e é essa transição que
// nenhuma sondagem colada na anterior conseguiu datar.
test("pool: a transição rate-limit → desabilitada aparece nos dois lados (é o que data o 403)", () => {
  const antes = coletarPool([{ estado: "viva" }, { estado: "rate-limit" }]);
  const agora = coletarPool([{ estado: "viva" }, { estado: "desabilitada", detalhe: "403" }]);
  const { novos, sumidos } = diffEstado(antes, agora);
  assert.deepEqual(novos, [{ chave: "POOL:2:desabilitada", rotulo: "403" }]);
  assert.deepEqual(sumidos.map((s) => s.chave), ["POOL:2:rate-limit"]);
});

test("pool sem detalhe usa o próprio estado como rótulo", () => {
  assert.deepEqual(coletarPool([{ estado: "viva" }]), { "POOL:1:viva": "viva" });
});

// Sem env var não é "nenhuma conta com problema": é não ter olhado. Se passasse como sucesso,
// o domínio entraria no diff com zero chave e as contas de ontem sairiam como resolvidas.
test("pool vazio ESTOURA em vez de virar sucesso com zero chave", () => {
  assert.throws(() => coletarPool([]), /pool vazio/);
});

test("repo mantém sem_repo — 404 em massa é o formato de um check quebrado", () => {
  const mapa = coletarRepo([{ slug: "a", balde: "sem_repo", repo: "Jean/a" }]);
  assert.deepEqual(mapa, { "REPO:a:sem_repo": "Jean/a" });
});

test("diff sem mudança é vazio dos dois lados", () => {
  const m = { "CONF:a:X": "d" };
  assert.deepEqual(diffEstado(m, { ...m }), { novos: [], sumidos: [] });
});

test("anterior ausente ou vazio é primeira corrida, não 100% de novidade", () => {
  assert.equal(primeiraCorrida(null), true);
  assert.equal(primeiraCorrida({}), true);
  assert.equal(primeiraCorrida({ "CONF:a:X": "d" }), false);
  // sem anterior o diff ainda descreve tudo como novo — quem segura é o caller, via primeiraCorrida
  assert.equal(diffEstado(null, { "CONF:a:X": "d" }).novos.length, 1);
});

test("noite sem mudança não vira card", () => {
  assert.equal(montarCard({ novos: [], sumidos: [] }, "2026-08-09"), null);
});

// O defeito que o `dominiosOk` existe para impedir: coletor morto não devolve chave, e sem o
// filtro a ausência viraria "resolvido" — notícia boa fabricada por falha de token.
test("coletor fora do ar NÃO vira violação resolvida", () => {
  const antes = { "CONF:a:GEO-01": "llms.txt 404", "REPO:a:sdk": "Jean/a" };
  const atual = { "CONF:a:GEO-01": "llms.txt 404" }; // REPO estourou: zero chave
  const cego = diffEstado(antes, atual);
  assert.deepEqual(cego.sumidos.map((s) => s.chave), ["REPO:a:sdk"], "sem o filtro, fabrica");
  const certo = diffEstado(antes, atual, ["CONF"]);
  assert.deepEqual(certo, { novos: [], sumidos: [] });
});

test("mesclarEstado carrega o domínio que falhou — senão amanhã ele volta como novidade", () => {
  const antes = { "CONF:a:GEO-01": "404", "REPO:a:sdk": "Jean/a" };
  const atual = { "CONF:a:GEO-01": "404" };
  const gravado = mesclarEstado(antes, atual, ["CONF"]);
  assert.deepEqual(gravado, { "REPO:a:sdk": "Jean/a", "CONF:a:GEO-01": "404" });
  // prova do encadeamento: amanhã, com REPO de volta e igual, o diff é vazio
  assert.deepEqual(diffEstado(gravado, antes, ["CONF", "REPO"]), { novos: [], sumidos: [] });
});

test("domínio que rodou tem a célula REMOVIDA do gravado (conserto persiste)", () => {
  const antes = { "CONF:a:GEO-01": "404" };
  const gravado = mesclarEstado(antes, {}, ["CONF"]);
  assert.deepEqual(gravado, {}, "CONF rodou e não achou nada: a violação saiu de vez");
});

test("coletor fora vira card mesmo sem diff — silêncio com coletor morto é 'não olhei'", () => {
  const card = montarCard({ novos: [], sumidos: [] }, "2026-08-09", [
    { dominio: "REPO", erro: "sem GITHUB_TOKEN" },
  ]);
  assert.equal(card.titulo, "Estado 2026-08-09: 1 coletor(es) fora");
  assert.match(card.descricao, /NÃO APURADO .*não é aprovação/);
  assert.match(card.descricao, /REPO — sem GITHUB_TOKEN/);
});

test("card nomeia cada célula e não publica percentual", () => {
  const card = montarCard(
    {
      novos: [{ chave: "CONF:orion:GEO-01", rotulo: "GPTBot barrado" }],
      sumidos: [{ chave: "GTW:sirius:sem-gateway", rotulo: "nenhum caminho" }],
    },
    "2026-08-09"
  );
  assert.equal(card.titulo, "Estado 2026-08-09: 1 novo(s) · 1 resolvido(s)");
  assert.equal(card.due, "2026-08-09");
  assert.match(card.descricao, /CONF:orion:GEO-01 — GPTBot barrado/);
  assert.match(card.descricao, /GTW:sirius:sem-gateway — nenhum caminho/);
  assert.match(card.descricao, /LISTA NOMINAL/);
  assert.doesNotMatch(card.descricao, /\d+%/);
});

test("card só com resolvidos ainda sai (conserto também é notícia)", () => {
  const card = montarCard({ novos: [], sumidos: [{ chave: "CONF:a:X", rotulo: "d" }] }, "2026-08-09");
  assert.equal(card.titulo, "Estado 2026-08-09: 1 resolvido(s)");
});
