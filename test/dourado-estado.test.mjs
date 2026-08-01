import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apurarEstado, parseGate, cronParaBrt, naoBranded } from "../lib/dourado-estado.mjs";

// Repo de mentira: o teste do dourado apurado não pode depender do estado real do repo, senão
// ele mede o dia de hoje em vez de medir a apuração.
function repoFalso({ projetos = [], testes = ["a.test.mjs"], listados = ["a.test.mjs"], cron = "13 3 * * *" } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "roihub-estado-"));
  mkdirSync(join(raiz, "data"));
  mkdirSync(join(raiz, "test"));
  mkdirSync(join(raiz, ".github/workflows"), { recursive: true });
  writeFileSync(join(raiz, "data/projects.json"), JSON.stringify(projetos));
  writeFileSync(join(raiz, "package.json"), JSON.stringify({ scripts: { test: `node --test ${listados.map((t) => `test/${t}`).join(" ")}` } }));
  for (const t of testes) writeFileSync(join(raiz, "test", t), "");
  writeFileSync(join(raiz, "next.config.mjs"), 'export default { output: "standalone" };');
  writeFileSync(join(raiz, "Dockerfile"), "FROM node:22-alpine");
  writeFileSync(join(raiz, ".github/workflows/seo-autopublish.yml"), `on:\n  schedule:\n    - cron: "${cron}"\n`);
  return raiz;
}

const apurar = (raiz, extra = {}) => apurarEstado({ raiz, agora: new Date("2026-07-31T12:00:00Z"), ...extra });

test("D-73 acusa teste de disco que não está na lista do npm test", async () => {
  const r = await apurar(repoFalso({ testes: ["a.test.mjs", "novo.test.mjs"], listados: ["a.test.mjs"] }));
  assert.equal(r["D-73"].nao_apurado, "");
  assert.match(r["D-73"].resposta, /1 arquivo\(s\) de teste fora da lista: novo\.test\.mjs/);
});

test("D-73 não acusa nada quando a lista cobre o disco", async () => {
  const r = await apurar(repoFalso({ testes: ["a.test.mjs"], listados: ["a.test.mjs"] }));
  assert.match(r["D-73"].resposta, /Hoje 0 arquivo/);
});

// O cron é a única defesa contra publicar em cima do autopublishing; se ele mudar no YAML, a
// resposta tem que mudar junto — é o ponto inteiro de apurar em vez de escrever.
test("D-72 converte o cron do workflow para BRT", async () => {
  const r = await apurar(repoFalso({ cron: "13 3 * * *" }));
  assert.match(r["D-72"].resposta, /00:13 BRT/);
  assert.match(r["D-72"].resposta, /Não é Vercel/);
  const outro = await apurar(repoFalso({ cron: "30 12 * * *" }));
  assert.match(outro["D-72"].resposta, /09:30 BRT/);
});

test("cronParaBrt tira as 3 horas e vira o dia", () => {
  assert.equal(cronParaBrt("13 3 * * *"), "00:13");
  assert.equal(cronParaBrt("0 1 * * *"), "22:00");
  assert.equal(cronParaBrt("5 23 * * *"), "20:05");
});

// `nao_apurado` é o resultado honesto quando a fonte não existe: dizer "1 projeto" a partir da
// prosa de `receitaNota` seria reconstruir o dourado com o mesmo material que ele deveria checar.
test("D-67 e D-71 saem não-apuradas enquanto o campo estruturado não existir", async () => {
  const raiz = repoFalso({ projetos: [{ slug: "x", receita: 9, receitaNota: "3 vendas orgânicas", blockersLista: ["texto solto"] }] });
  const r = await apurar(raiz);
  assert.match(r["D-67"].nao_apurado, /não tem campo de venda/);
  assert.equal(r["D-67"].resposta, "");
  assert.match(r["D-71"].nao_apurado, /texto livre/);
});

test("D-67 conta venda com data e ignora venda sem data", async () => {
  const raiz = repoFalso({
    projetos: [
      { slug: "com", vendas: [{ data: "2026-06-12", valor: 97 }, { valor: 97 }] },
      { slug: "sem", vendas: [{ valor: 500 }] },
      { slug: "vazio" },
    ],
  });
  const r = await apurar(raiz);
  assert.equal(r["D-67"].nao_apurado, "");
  assert.match(r["D-67"].resposta, /1 de 3 têm venda com data registrada: com \(1\)/);
});

test("D-71 lista bloqueio marcado como humano", async () => {
  const raiz = repoFalso({
    projetos: [{ slug: "compass", blockersLista: [{ texto: "4 chaves do Stripe", humano: true }, { texto: "código", humano: false }] }],
  });
  const r = await apurar(raiz);
  assert.equal(r["D-71"].nao_apurado, "");
  assert.match(r["D-71"].resposta, /1 bloqueios humanos: compass: 4 chaves do Stripe/);
});

// Sem rede as caras dizem "não apurado" — nunca um valor velho. Valor velho servido como
// apurado é o defeito que esta frente existe para matar.
test("modo offline não chama rede e marca as caras como não apuradas", async () => {
  const r = await apurar(repoFalso(), {
    fetchImpl: () => assert.fail("offline não pode bater no GitHub"),
    gsc: () => assert.fail("offline não pode bater no GSC"),
  });
  for (const id of ["D-66", "D-68", "D-69"]) {
    assert.match(r[id].nao_apurado, /rode com --estado tudo/);
    assert.equal(r[id].resposta, "");
  }
});

test("fonte que falha vira não-apurado, nunca valor velho", async () => {
  process.env.GITHUB_TOKEN ??= "token-de-teste"; // sem token a falha seria outra, antes do fetch
  const r = await apurar(repoFalso({ projetos: [{ slug: "sirius", url: "https://siriuscrm.com.br/", acao: "Gate 31/08: ≥ 5 cliques não-branded/28d (hoje 2)" }] }), {
    modo: "tudo",
    fetchImpl: async () => { throw new Error("ENOTFOUND"); },
    gsc: async () => { throw new Error("gsc fora do ar"); },
  });
  assert.match(r["D-66"].nao_apurado, /falhou ao apurar: ENOTFOUND/);
  assert.match(r["D-68"].nao_apurado, /gsc fora do ar/);
  assert.equal(r["D-68"].resposta, "");
});

// O ALVO e a DATA são curadoria; o número de hoje é apurado. A defasagem entre os dois é a
// comparação "o que o corpus afirma × o que a fonte viva devolve", de graça e sem LLM.
test("D-68 apura o clique não-branded e denuncia a curadoria defasada", async () => {
  const raiz = repoFalso({ projetos: [{ slug: "sirius", url: "https://siriuscrm.com.br/", acao: "Gate 31/08: ≥ 5 cliques não-branded/28d (hoje 2)" }] });
  const linhas = [
    { keys: ["sirius crm", "https://siriuscrm.com.br/", "bra"], clicks: 9, impressions: 40, position: 1 },
    { keys: ["crm solar", "https://siriuscrm.com.br/solar", "bra"], clicks: 3, impressions: 58, position: 39.2 },
    { keys: ["agaas", "https://siriuscrm.com.br/agaas", "bra"], clicks: 1, impressions: 85, position: 8.1 },
  ];
  const r = await apurar(raiz, { modo: "tudo", gsc: async () => linhas });
  assert.match(r["D-68"].resposta, /Hoje: 4/, "branded não pode entrar na conta do gate");
  assert.match(r["D-68"].resposta, /defasada em 2/);
  assert.doesNotMatch(r["D-68"].resposta, /sirius crm/);
});

// Impressão é o total do site: somar as linhas de query devolve um piso porque o GSC omite a
// query rara. Medido no tapepro — 5 somando queries contra 33 no total.
test("D-69 usa o total do site para impressão, não a soma das queries", async () => {
  const raiz = repoFalso({ projetos: [{ slug: "tapepro", url: "https://tapepro.roilabs.com.br/", acao: "Gate 19/10: ≥ 300 imp/28d (hoje 21)" }] });
  const gsc = async (host, dims) =>
    dims && dims.length === 0
      ? [{ keys: [], clicks: 0, impressions: 33, position: 40 }]
      : [{ keys: ["cliche flexo", "https://tapepro.roilabs.com.br/", "bra"], clicks: 0, impressions: 5, position: 74 }];
  const r = await apurar(raiz, { modo: "tudo", gsc });
  assert.match(r["D-69"].resposta, /Hoje: 33 \(total do site\)/);
  assert.match(r["D-69"].resposta, /defasada em 12/);
});

test("parseGate lê os dois formatos da casa e recusa o resto", () => {
  assert.deepEqual(parseGate("Gate 31/08: ≥ 5 cliques não-branded/28d (hoje 2)"), {
    ate: "31/08", alvo: 5, metrica: "cliques nao-branded", curadoria: 2,
  });
  assert.deepEqual(parseGate("Gate 19/10: ≥ 300 imp/28d (hoje 21)"), {
    ate: "19/10", alvo: 300, metrica: "impressoes", curadoria: 21,
  });
  assert.equal(parseGate("Gate 3 (1º fornecedor) destrava o marketplace"), null);
  assert.equal(parseGate(undefined), null);
});

test("naoBranded corta a marca inclusive escrita com espaço", () => {
  const linhas = [["sirius crm"], ["siriuscrm login"], ["crm solar"]].map((keys) => ({ keys }));
  assert.deepEqual(naoBranded(linhas, "sirius").map((l) => l.keys[0]), ["crm solar"]);
});
