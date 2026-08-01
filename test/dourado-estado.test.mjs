import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apurarEstado, parseGate, cronParaBrt, naoBranded } from "../lib/dourado-estado.mjs";

// Repo de mentira: o teste do dourado apurado não pode depender do estado real do repo, senão
// ele mede o dia de hoje em vez de medir a apuração.
function repoFalso({ projetos = [], testes = ["a.test.mjs"], listados = ["a.test.mjs"], cron = "13 3 * * *", protocolos = {}, exports: exps = {} } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "roihub-estado-"));
  mkdirSync(join(raiz, "data"));
  mkdirSync(join(raiz, "data/protocolos"));
  mkdirSync(join(raiz, "test"));
  for (const [nome, corpo] of Object.entries(protocolos)) {
    writeFileSync(join(raiz, `data/protocolos/${nome}.json`), JSON.stringify(corpo));
  }
  // Export de crawl stats: pasta com o nome que a UI do GSC gera, com os CSVs dentro.
  for (const [pasta, arquivos] of Object.entries(exps)) {
    mkdirSync(join(raiz, "docs", pasta), { recursive: true });
    for (const [arq, txt] of Object.entries(arquivos)) writeFileSync(join(raiz, "docs", pasta, arq), txt);
  }
  mkdirSync(join(raiz, ".github/workflows"), { recursive: true });
  writeFileSync(join(raiz, "data/projects.json"), JSON.stringify(projetos));
  writeFileSync(join(raiz, "package.json"), JSON.stringify({ scripts: { test: `node --test ${listados.map((t) => `test/${t}`).join(" ")}` } }));
  for (const t of testes) writeFileSync(join(raiz, "test", t), "");
  writeFileSync(join(raiz, "next.config.mjs"), 'export default { output: "standalone" };');
  writeFileSync(join(raiz, "Dockerfile"), "FROM node:22-alpine");
  writeFileSync(join(raiz, ".github/workflows/seo-autopublish.yml"), `on:\n  schedule:\n    - cron: "${cron}"\n`);
  return raiz;
}

// `memoriaDir` aponta para uma pasta que não existe: as memórias moram em ~/.claude e o teste
// mediria a máquina de quem roda, não a apuração.
const apurar = (raiz, extra = {}) =>
  apurarEstado({ raiz, memoriaDir: join(raiz, "sem-memoria"), agora: new Date("2026-07-31T12:00:00Z"), ...extra });

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
// A quinta ('produto') veio da derivação cega da fase C: o defeito é ANTERIOR à cobrança, e os 4
// estavam espalhados por três famílias diferentes dizendo a mesma coisa.
test("D-70 conta travado por família e o estado de todos", async () => {
  const b = [{ texto: "x", humano: false }];
  const raiz = repoFalso({
    projetos: [
      { slug: "a", familia: "cobranca", estado: "no-ar", blockersLista: b },
      { slug: "b", familia: "cobranca", estado: "no-ar-inutilizavel", blockersLista: b },
      { slug: "c", familia: "nao-vende", estado: "prototipo", blockersLista: b },
      { slug: "d", familia: "trafego", estado: "no-ar" },
      { slug: "e", familia: "produto", estado: "no-ar", blockersLista: b },
    ],
  });
  const r = await apurar(raiz);
  assert.equal(r["D-70"].nao_apurado, "");
  assert.match(r["D-70"].resposta, /4 de 5 têm blocker registrado/, "sem blocker não é travado");
  assert.match(r["D-70"].resposta, /não tem como cobrar: 2 \(a, b\)/);
  assert.match(r["D-70"].resposta, /não tenta faturar por decisão: 1 \(c\)/);
  assert.match(r["D-70"].resposta, /o produto não funciona: 1 \(e\)/);
  // O estado conta os 4, não só os travados: 'd' está no ar e sem blocker, e continua existindo.
  assert.match(r["D-70"].resposta, /Estado: 3 no-ar, 1 no-ar-inutilizavel, 1 prototipo/);
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

// ── As 7 fontes que já rodavam e não estavam ligadas à camada `estado` (01/08) ───────────────

// A norma do validade.mjs vira FATO: a contagem de hoje diz se a defasagem parou de NASCER.
test("D-79 conta e NOMEIA a afirmação de presente com número, e absolve a datada", async () => {
  const raiz = repoFalso({
    protocolos: {
      "PRT-03": { id: "PRT-03", norma: "gate ate 19/10/2026 (hoje 21)" },
      "PRT-09": { id: "PRT-09", norma: "quantos projetos (hoje 35, se apura em dourado-estado)" },
      "VER-99": { id: "VER-99", valid_to: "2026-01-01", norma: "revogado (hoje 99)" },
    },
  });
  const r = await apurar(raiz);
  assert.equal(r["D-79"].nao_apurado, "");
  // O revogado não é documento vivo e o "se apura" absolve — sobra o do gate.
  assert.match(r["D-79"].resposta, /^1 afirmação\(ões\) de presente com número sem data/);
  assert.match(r["D-79"].resposta, /PRT-03\.json:1 \[\(hoje N\)\]/);
  assert.match(r["D-79"].ressalva, /memórias NÃO estavam neste ambiente/);
});

// Fetch falso com a forma da API do GitHub: metadados → árvore → conteúdo em base64.
function githubFalso(arquivos, arvores = { n: 0 }) {
  return async (url) => {
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    const repo = /api\.github\.com\/repos\/([^/]+\/[^/]+)/.exec(url)?.[1];
    const doRepo = repo && arquivos[repo];
    if (!doRepo) return { ok: false, status: 404, json: async () => null };
    if (/\/git\/trees\//.test(url)) {
      arvores.n += 1;
      return json({ tree: Object.keys(doRepo).map((path) => ({ type: "blob", path })) });
    }
    if (/\/contents\//.test(url)) {
      const caminho = decodeURI(url.split("/contents/")[1]);
      return json({ content: Buffer.from(doRepo[caminho] ?? "").toString("base64") });
    }
    return json({ default_branch: "main" });
  };
}

const REPOS = {
  "JeanZorzetti/comsdk": { "package.json": JSON.stringify({ dependencies: { mercadopago: "^2" } }) },
  "JeanZorzetti/soenv": { ".env.example": "STRIPE_SECRET_KEY=x\n# ASAAS_API_KEY=comentada" },
  "JeanZorzetti/nada": { "package.json": JSON.stringify({ dependencies: { next: "^16" } }) },
};

const PROJETOS_GATEWAY = [
  { slug: "comsdk", repo: "comsdk", url: "https://comsdk.test/", vendas: [{ data: "2026-06-01", valor: 97 }] },
  { slug: "soenv", repo: "soenv", url: "https://soenv.test/" },
  { slug: "nada", repo: "nada", url: "https://nada.test/" },
  { slug: "semrepo", url: "https://semrepo.test/" },
];

// Só o balde muda a leitura: SDK declarado ≠ env var ≠ nada. Linha comentada não é chave.
test("D-80 separa SDK declarado de env var e de nada no código", async () => {
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), {
    modo: "caro",
    fetchImpl: githubFalso(REPOS),
    buscarHttp: async () => ({ status: 200, corpo: "<html></html>", erro: "" }),
  });
  assert.equal(r["D-80"].nao_apurado, "");
  assert.match(r["D-80"].resposta, /1 de 4 projetos têm SDK de pagamento DECLARADO.*comsdk \(mercadopago\)/);
  assert.match(r["D-80"].resposta, /Só variável de ambiente[^.]*soenv \(stripe\)/, "comentada não conta, stripe sim");
  assert.match(r["D-80"].resposta, /Nada no código: 1/);
  assert.match(r["D-80"].resposta, /Repo ausente ou ilegível: semrepo/);
  assert.match(r["D-80"].ressalva, /"não achei", NUNCA "não cobra"/);
});

// O balde do meio (preço servido, gateway nenhum) é o que muda a priorização — e página de preço
// não é gateway. Casar contra a URL do host, nunca contra a palavra no corpo.
test("D-82 separa gateway servido de página de preço", async () => {
  const buscarHttp = async (url) => {
    if (/rota-que-nao-existe/.test(url)) return { status: 404, corpo: "", erro: "" };
    if (url === "https://comsdk.test/") return { status: 200, corpo: '<a href="https://checkout.stripe.com/x">', erro: "" };
    if (url === "https://soenv.test/precos") return { status: 200, corpo: "R$ 97 por mês", erro: "" };
    if (/^https:\/\/nada\.test/.test(url) && url !== "https://nada.test/") return { status: 404, corpo: "", erro: "" };
    if (url === "https://semrepo.test/") return { status: 0, corpo: "", erro: "ENOTFOUND" };
    return { status: url.endsWith("/") ? 200 : 404, corpo: "<html>fala de plano no corpo</html>", erro: "" };
  };
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), { modo: "caro", fetchImpl: githubFalso(REPOS), buscarHttp });
  assert.equal(r["D-82"].nao_apurado, "");
  assert.match(r["D-82"].resposta, /1 com gateway LIGADO e régua lendo \(comsdk\)/, "`vendas` no card manda no balde");
  assert.match(r["D-82"].resposta, /1 servindo preço sem gateway \(soenv\)/);
  assert.match(r["D-82"].resposta, /Não olhei \(home fora do ar\): semrepo/, "home fora do ar não é ausência de gateway");
});

// O CRUZAMENTO é a leitura, e nenhuma metade sozinha a produz. `memo` garante que as duas
// varreduras rodem UMA vez por execução — sem isso o custo declarado no `rede` seria mentira.
test("D-81 cruza SDK escrito × servido × venda com data, e varre uma vez só", async () => {
  const arvores = { n: 0 };
  const buscarHttp = async (url) =>
    /rota-que-nao-existe/.test(url)
      ? { status: 404, corpo: "", erro: "" }
      : { status: url === "https://soenv.test/precos" ? 200 : url.endsWith("/") ? 200 : 404, corpo: "R$ 97", erro: "" };
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), {
    modo: "caro",
    fetchImpl: githubFalso(REPOS, arvores),
    buscarHttp,
  });
  assert.equal(r["D-81"].nao_apurado, "");
  assert.match(r["D-81"].resposta, /1 projetos têm SDK de pagamento escrito e 1 faturou\(aram\) com data: comsdk/);
  // A decomposição fecha: os 5 subgrupos somam o total com SDK. Na 1ª corrida ela somava 9 de 10
  // porque o balde `ligado` não estava no texto.
  const soma = /Desses 1: (\d+) com gateway ligado[^,]*, (\d+) já servem preço[^,]*, (\d+) servem gateway[^,]*, (\d+) estão mais longe[^,]*e (\d+) não foram olhados/.exec(r["D-81"].resposta);
  assert.ok(soma, "a decomposição precisa estar no texto");
  assert.equal(soma.slice(1).reduce((a, n) => a + Number(n), 0), 1, "os subgrupos somam o total com SDK");
  // Uma árvore por repo com `repo` no card (3 dos 4), e não duas: D-80 e D-81 leem a MESMA
  // varredura. Sem o cache seriam 6, e o custo declarado no campo `rede` seria mentira.
  assert.equal(arvores.n, 3, "D-80 e D-81 leem a MESMA varredura do GitHub");
});

// `n/a` não é aprovação: o placar imprime os três estados de propósito.
test("D-83 conta violação por check e imprime quantas células saíram n/a", async () => {
  const conformidade = async (p) => ({
    slug: p.slug,
    host: p.slug,
    stack: [],
    linhas: [
      { id: "VER-02", ok: p.slug === "soenv" ? false : true, detalhe: "" },
      { id: "SEC-01", ok: null, detalhe: "" },
    ],
  });
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), { modo: "caro", conformidade, fetchImpl: githubFalso(REPOS), buscarHttp: async () => ({ status: 404, corpo: "", erro: "" }) });
  assert.equal(r["D-83"].nao_apurado, "");
  assert.match(r["D-83"].resposta, /1 violação\(ões\) em 1 projeto\(s\)/);
  assert.match(r["D-83"].resposta, /VER-02: 1 \(soenv\)/);
  assert.match(r["D-83"].resposta, /4 de 8 células saíram n\/a/);
  assert.match(r["D-83"].ressalva, /`n\/a` NÃO é aprovação/);
});

// "Sem propriedade" e "fora do índice" prescrevem ações opostas: uma é falta de domínio próprio,
// a outra é problema de SEO. Somar os dois esconderia justamente a diferença.
test("D-84 separa indexada, fora do índice e host sem propriedade no GSC", async () => {
  const inspecionar = async (urls) =>
    urls.map((url) => {
      if (url === "https://comsdk.test/") return { url, propriedade: "sc-domain:comsdk.test", verdict: "PASS", coverage: "Submitted and indexed", ultimoCrawl: "2026-07-30", erro: "" };
      if (url === "https://soenv.test/") return { url, propriedade: "sc-domain:soenv.test", verdict: "NEUTRAL", coverage: "Crawled - currently not indexed", ultimoCrawl: "", erro: "" };
      if (url === "https://nada.test/") return { url, propriedade: null, verdict: "", coverage: "", ultimoCrawl: "", erro: "sem propriedade no GSC" };
      return { url, propriedade: "sc-domain:semrepo.test", verdict: "", coverage: "", ultimoCrawl: "", erro: "429 quota" };
    });
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), { modo: "tudo", inspecionar, fetchImpl: async () => { throw new Error("sem rede"); } });
  assert.equal(r["D-84"].nao_apurado, "");
  assert.match(r["D-84"].resposta, /^1 de 2 home\(s\) inspecionável\(is\) estão no índice/);
  assert.match(r["D-84"].resposta, /FORA do índice: soenv \(Crawled - currently not indexed\)/);
  assert.match(r["D-84"].resposta, /Sem propriedade no GSC[^:]*: nada/);
  assert.match(r["D-84"].resposta, /Falhou a inspeção: semrepo — 429 quota/);
});

const CSV_RESUMO = "Data,Total,Bytes,ms\n2026-07-20,100,1,200\n2026-07-21,150,1,300\n";
const CSV_RESPOSTAS = "Resposta,Proporcao\nOK (200),0.9\nNao encontrado (404),0.1\n";
// Os três estados que a tabela de hosts do GSC emite, e o arquivo vem localizado.
const CSV_HOSTS = "Host,Solicitacoes,Status\nvivo.test,10,Sem problemas\nvelho.test,5,Problemas no passado\nquebrado.test,3,Alguns problemas\n";

// A 1ª corrida deste fato listou 34 "hosts com problema" e NENHUM era problema de agora: 22
// diziam "No problems" e 12, "Problemas no passado". Grep por "problem" junta os três estados.
test("D-85 separa problema de AGORA de problema no passado e de host sem problema", async () => {
  const raiz = repoFalso({
    exports: {
      "roilabs.com.br-Crawl-stats-2026-07-25": {
        "Grafico de resumo.csv": CSV_RESUMO,
        "Tabela de respostas.csv": CSV_RESPOSTAS,
        "Tabela de hosts.csv": CSV_HOSTS,
      },
    },
  });
  const r = await apurar(raiz);
  assert.match(r["D-85"].resposta, /Hosts com problema AGORA: roilabs\.com\.br → quebrado\.test \(Alguns problemas\)/);
  assert.match(r["D-85"].resposta, /outros 1 host\(s\) marcados "problemas no passado"/);
  assert.doesNotMatch(r["D-85"].resposta, /vivo\.test/, "host sem problema não entra na lista de problemas");
});

test("D-85 resume o crawl do export mais novo e CARIMBA a data dele", async () => {
  const raiz = repoFalso({
    exports: {
      "roilabs.com.br-Crawl-stats-2026-07-25": { "Grafico de resumo.csv": CSV_RESUMO, "Tabela de respostas.csv": CSV_RESPOSTAS },
    },
  });
  const r = await apurar(raiz);
  assert.equal(r["D-85"].nao_apurado, "");
  assert.match(r["D-85"].resposta, /roilabs\.com\.br: 250 req, OK 90,0%/);
  // A data do export dentro da ressalva é o ponto do fato: o número não é de hoje.
  assert.match(r["D-85"].ressalva, /o mais antigo aqui é de 2026-07-25/);
  assert.match(r["D-85"].fonte, /2026-07-25/);
});

// Falha FECHADA: sem export não sai número nenhum, e a saída diz onde ele nasceria.
test("D-85 sem export nenhum é não-apurado, nunca zero", async () => {
  const r = await apurar(repoFalso());
  assert.match(r["D-85"].nao_apurado, /nenhum export de crawl stats/);
  assert.equal(r["D-85"].resposta, "");
});

// Fonte cara tem MODO PRÓPRIO. `corpus-defasado.mjs` e `avaliar-resposta.mjs` chamam com
// `modo: "tudo"`: se o inventário entrasse nesse nível, toda corrida de régua dispararia ~250
// requisições contra produção — o mesmo motivo pelo qual o conformidade está fora do npm test.
test("modo `tudo` NÃO dispara as varreduras caras", async () => {
  const r = await apurar(repoFalso({ projetos: PROJETOS_GATEWAY }), {
    modo: "tudo",
    fetchImpl: async () => { throw new Error("ENOTFOUND"); },
    buscarHttp: () => assert.fail("`tudo` não pode varrer os 35 sites"),
    conformidade: () => assert.fail("`tudo` não pode rodar o conformidade"),
    inspecionar: async () => [],
  });
  for (const id of ["D-80", "D-81", "D-82", "D-83"]) {
    assert.match(r[id].nao_apurado, /rode com --estado caro/);
    assert.equal(r[id].resposta, "");
  }
  // As baratas continuam rodando no mesmo nível de antes.
  assert.equal(r["D-79"].nao_apurado, "");
  assert.equal(r["D-85"].nao_apurado ? "" : "apurou", "");
});

test("naoBranded corta a marca inclusive escrita com espaço", () => {
  const linhas = [["sirius crm"], ["siriuscrm login"], ["crm solar"]].map((keys) => ({ keys }));
  assert.deepEqual(naoBranded(linhas, "sirius").map((l) => l.keys[0]), ["crm solar"]);
});
