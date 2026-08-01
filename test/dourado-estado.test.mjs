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
  assert.match(r["D-67"].nao_apurado, /nenhum card foi checado contra um sistema de pagamento/);
  assert.equal(r["D-67"].resposta, "");
  assert.match(r["D-71"].nao_apurado, /texto livre/);
});

test("D-67 conta venda com data, ignora venda sem data e soma a receita provada", async () => {
  const raiz = repoFalso({
    projetos: [
      { slug: "com", vendas: [{ data: "2026-06-12", valor: 97 }, { valor: 97 }] },
      { slug: "sem", vendas: [{ valor: 500 }] },
      { slug: "vazio" },
    ],
  });
  const r = await apurar(raiz);
  assert.equal(r["D-67"].nao_apurado, "");
  assert.match(r["D-67"].resposta, /1 de 2 projeto\(s\) checado\(s\).*: com \(1\)/);
  // A venda sem data do "sem" e a de 97 sem data do "com" não entram na soma.
  assert.match(r["D-67"].resposta, /Receita provada: R\$ 97\.00/);
});

// `vendas` ausente e `vendas: []` são coisas diferentes, e confundi-las é tratar "não olhei" como
// "não vendeu" — a mesma régua do `n/a` do conformidade. O denominador é o dos checados; quem não
// tem gateway ligado sai NOMEADO na ressalva.
test("D-67 tira da conta quem não tem gateway ligado e nomeia na ressalva", async () => {
  const raiz = repoFalso({ projetos: [{ slug: "checado", vendas: [] }, { slug: "nunca-olhado" }] });
  const r = await apurar(raiz);
  assert.match(r["D-67"].resposta, /0 de 1 projeto\(s\) checado\(s\)/);
  assert.match(r["D-67"].ressalva, /1 dos 2 cards não têm fonte de pagamento ligada/);
  assert.match(r["D-67"].ressalva, /nunca-olhado/);
  assert.doesNotMatch(r["D-67"].ressalva, /checado,/);
});

// Meia apuração é pior que nenhuma: ela carrega a autoridade do número. Um card sem `familia`
// tira a pergunta inteira de circulação em vez de sair uma contagem com cara de completa.
test("D-70 falha fechada e nomeia os cards sem familia ou estado", async () => {
  const raiz = repoFalso({
    projetos: [
      { slug: "ok", familia: "trafego", estado: "no-ar", blockersLista: [{ texto: "x", humano: false }] },
      { slug: "sem-familia", estado: "no-ar" },
      { slug: "familia-inventada", familia: "marketing", estado: "no-ar" },
      { slug: "estado-invalido", familia: "venda", estado: "meio-no-ar" },
    ],
  });
  const r = await apurar(raiz);
  assert.match(r["D-70"].nao_apurado, /3 de 4 card\(s\) sem/);
  assert.match(r["D-70"].nao_apurado, /sem-familia, familia-inventada, estado-invalido/);
  assert.equal(r["D-70"].resposta, "");
});

// A quarta família ('nao-vende') nasceu da leitura dos 35: CV, demo, pesquisa e vitrine não estão
// travados, não tentam faturar por decisão. Empurrá-los para uma das três inventaria travamento.
test("D-70 conta travado por família e o estado de todos", async () => {
  const b = [{ texto: "x", humano: false }];
  const raiz = repoFalso({
    projetos: [
      { slug: "a", familia: "cobranca", estado: "no-ar", blockersLista: b },
      { slug: "b", familia: "cobranca", estado: "no-ar-inutilizavel", blockersLista: b },
      { slug: "c", familia: "nao-vende", estado: "prototipo", blockersLista: b },
      { slug: "d", familia: "trafego", estado: "no-ar" },
    ],
  });
  const r = await apurar(raiz);
  assert.equal(r["D-70"].nao_apurado, "");
  assert.match(r["D-70"].resposta, /3 de 4 têm blocker registrado/, "sem blocker não é travado");
  assert.match(r["D-70"].resposta, /não tem como cobrar: 2 \(a, b\)/);
  assert.match(r["D-70"].resposta, /não tenta faturar por decisão: 1 \(c\)/);
  // O estado conta os 4, não só os travados: 'd' está no ar e sem blocker, e continua existindo.
  assert.match(r["D-70"].resposta, /Estado: 2 no-ar, 1 no-ar-inutilizavel, 1 prototipo/);
  assert.match(r["D-70"].ressalva, /julgamento humano/);
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
  // O caso do handoff-deep-research-harness: a ressalva dentro do fato fez o detector ler
  // discordância entre "hoje 2" e um apurado de 2. Fora do fato, resta o número para comparar.
  assert.doesNotMatch(r["D-68"].resposta, /piso|anonimizada/i);
  assert.match(r["D-68"].ressalva, /PISO/);
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
  assert.match(r["D-69"].ressalva, /total do site/);
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
