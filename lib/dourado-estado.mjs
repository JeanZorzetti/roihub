// As 8 perguntas de camada `estado` do `data/dourado.json` são as únicas cuja resposta certa
// existe FORA do corpus: elas perguntam quantos projetos o hub tem hoje, onde está o gate do
// sirius, o que está travado. A resposta muda sozinha, sem ninguém editar nada — e o corpus só
// sabe o que alguém escreveu da última vez. Em D-66 ele guardava QUATRO contagens defasadas do
// mesmo número (37, 39, 40, 39).
//
// Enquanto o dourado for texto, o juiz mede concordância com a última prosa escrita: corpus
// errado → dourado repete o erro → resposta errada aprovada com nota máxima. Aqui a resposta é
// APURADA na hora da medição, com a data de apuração junto.
//
// ⚠️ Não gere isto para dentro do dourado.json. JSON escrito ontem apodrece igual a prosa escrita
// ontem; o ponto é a apuração acontecer no instante da medição.
//
// FALHA FECHADA: sem rede, ou com a fonte fora do ar, a apuração devolve `nao_apurado` com o
// motivo — NUNCA um valor velho. `nao_apurado` não é aprovação, é "não olhei" (a mesma régua do
// `n/a` do conformidade.mjs).
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mergeProjects } from "./projects.mjs";
import { MEMORIA_PADRAO } from "./corpus.mjs";
import { afirmacoesDePresente } from "./validade.mjs";
import { vivosDoRepo, vivosDaMemoria } from "./validade-vivos.mjs";
import { inventariarRepo } from "./gateways-repo.mjs";
import { inventariarServido } from "./gateways-servido.mjs";
import { CHECKS, buscar as buscarHttpReal, rodarProjeto } from "./conformidade.mjs";
import { resumoCrawl } from "./crawl-exports.mjs";
import { inspecionarIndexacao, estaIndexada } from "./indexacao.mjs";

export const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// Data, não timestamp: o aceite desta frente é "duas execuções no mesmo dia batem", e o relógio
// faria dois apurados idênticos parecerem diferentes.
// Em BRT porque todo handoff, memória e card desta base datam em BRT: carimbar 01/08 numa
// apuração feita às 21h de 31/07 criaria uma defasagem de um dia que não existe.
// ⚠️ A janela do GSC continua deslizando na meia-noite UTC — o mesmo fim de tarde devolveu 33 e
// depois 42 impressões para o tapepro por isso, não por instabilidade da fonte.
const hoje = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

// `ressalva` é campo próprio porque limitação de medição escrita DENTRO do fato vira afirmação:
// o "piso: query anonimizada" embutido na resposta de D-68 fez o detector de defasagem ler
// discordância onde havia acordo perfeito (documento dizia "hoje 2", apurado era 2) — 1 dos 3
// falsos positivos da primeira corrida. O fato é o número; como ele foi medido é outra frase.
const apurado = (resposta, fonte, agora, ressalva = "") => ({
  resposta,
  fonte,
  apurado_em: hoje(agora),
  nao_apurado: "",
  ressalva,
});

// `resposta` pode vir preenchida junto com `nao_apurado`: a parte computável fica visível, mas o
// item inteiro sai de circulação como gabarito. Meia apuração usada como dourado é pior que
// nenhuma — ela carrega a autoridade do número e a fragilidade da prosa.
const naoApurado = (motivo, resposta = "", agora) => ({
  resposta,
  fonte: "",
  apurado_em: hoje(agora),
  nao_apurado: motivo,
  ressalva: "",
});

const ler = (raiz, rel) => readFileSync(join(raiz, rel), "utf8");
const lerProjetos = (raiz) => JSON.parse(ler(raiz, "data/projects.json"));

// ── D-66 — quantos projetos o hub tem hoje e de onde vem a lista ────────────────────────────
// ponytail: `lib/github.ts` faz o mesmo fetch com cache de 10 min, mas é .ts e não importa daqui.
// Duplicar 12 linhas de HTTP é mais barato que mover o módulo e arriscar a aba; se aparecer um
// terceiro consumidor, aí sim extraia para .mjs.
export async function reposDoGithub(fetchImpl = fetch, token = process.env.GITHUB_TOKEN) {
  if (!token) throw new Error("sem GITHUB_TOKEN");
  const todos = [];
  for (let page = 1; page <= 3; page++) {
    const res = await fetchImpl(
      `https://api.github.com/user/repos?affiliation=owner&per_page=100&sort=pushed&page=${page}`,
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
          "user-agent": "roihub",
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const lote = await res.json();
    todos.push(...lote);
    if (lote.length < 100) break;
  }
  return todos.map((r) => ({
    name: r.name,
    homepage: r.homepage,
    url: r.html_url,
    pushedAt: r.pushed_at,
    archived: r.archived,
    description: r.description,
  }));
}

// Separado do `d66` só para poder ser medido sem rede: o VALOR de hoje vem do GitHub, mas a
// largura da âncora — que é o que decide o custo da corrida — se testa contra o corpus offline.
export const CITACOES_D66 = {
  ranking: {
    nome: "projetos no ranking",
    re: /(\d+)\s+projetos?\s+(?:no\s+ranking|no\s+hub|do\s+hub|no\s+portf[óo]lio|curados)|ranking[:\s-]+(\d+)\s+projetos?|\bhub\s+tem\s+(\d+)\s+projetos?/gi,
  },
  reposAtivos: { nome: "repos ativos", re: /(\d+)\s+repos?\s+ativos/gi },
};

async function d66({ raiz, fetchImpl, agora }) {
  const curados = lerProjetos(raiz);
  const repos = await reposDoGithub(fetchImpl);
  // O MESMO merge que `listProjects()` usa. Contar `data/projects.json` direto daria outro
  // número — é a armadilha declarada da própria pergunta.
  const lista = mergeProjects(curados, repos);
  const vivos = repos.filter((r) => !r.archived);
  const semSite = vivos.filter((r) => !r.homepage?.trim()).map((r) => r.name);
  return {
    ...apurado(
      `${lista.length} projetos: ${curados.length} curados em data/projects.json + ${lista.length - curados.length} vindos do GitHub sem curadoria. ` +
        `A lista sai de listProjects() — curadoria + todo repo vivo com homepage — e a chave é a URL do site, não o repo. ` +
        `Hoje ${vivos.length} repos ativos, ${vivos.length - semSite.length} com homepage; sem homepage: ${semSite.join(", ") || "nenhum"}.`,
      "API do GitHub (/user/repos) + data/projects.json via mergeProjects()",
      agora,
    ),
    // A 2ª VIA DE SELEÇÃO do detector de defasagem (`docsQueCitam`, lib/defasagem.mjs): documento
    // que cita esta quantidade com outro número, mesmo falando de outro assunto. É o único jeito
    // de alcançar o defeito que a busca por tema não recupera.
    //
    // AS ÂNCORAS SÃO ESTREITAS, e isso foi MEDIDO em 01/08: `(\d+) projetos` solto seleciona 43
    // documentos do corpus e a grande maioria é QUANTIDADE HOMÔNIMA — "10 projetos" é o
    // autopublishing, "21 projetos" são os apagados da Vercel, "19 no ar" é outra conta. Cada um
    // custaria uma chamada do pool para o modelo responder `nao-fala`, quase dobrando a corrida.
    // Com as duas âncoras abaixo são 8 documentos: exatamente o conjunto que a mineração daquele
    // dia encontrou lendo os candidatos um a um.
    //
    // Só D-66 tem âncora, e a ausência das outras 7 é deliberada. `D-68`/`D-69` são gates, onde o
    // ALVO ("≥ 5 cliques") é curadoria correta para sempre e casaria como se fosse o valor de hoje
    // — foi um dos 5 defeitos do check daquela mineração. As demais não são quantidade citável em
    // prosa. Âncora nova só entra depois de medida contra o corpus, senão ela seleciona homônimo.
    citacoes: [
      { ...CITACOES_D66.ranking, valor: lista.length },
      { ...CITACOES_D66.reposAtivos, valor: vivos.length },
    ],
  };
}

// ── D-67 — quantos têm receita provada ──────────────────────────────────────────────────────
// A regra da casa é "dinheiro sem data é R$ 0". Ela só vira apuração quando a venda tiver data
// no card; `receita` é nota 0-10 de PRIORIDADE, não faturamento, e somá-la seria inventar.
//
// ⚠️ `vendas` ausente e `vendas: []` são coisas DIFERENTES, e trocá-las é o mesmo erro de tratar
// `n/a` como aprovação: ausente é "nenhum gateway foi ligado neste projeto", `[]` é "o gateway foi
// consultado e não pagou nada". O denominador honesto é o dos checados, e o resto vai na ressalva.
function d67({ raiz, agora }) {
  const projetos = lerProjetos(raiz);
  const checados = projetos.filter((p) => Array.isArray(p.vendas));
  if (!checados.length) {
    return naoApurado(
      "nenhum card foi checado contra um sistema de pagamento: `receita` é nota 0-10 de prioridade e " +
        "`receitaNota` é prosa. `node --env-file=.env scripts/vendas-mercadopago.mjs --escrever` liga a " +
        "primeira fonte — e a regra da casa (dinheiro sem data é R$ 0) passa a rodar em vez de ser citada.",
      "",
      agora,
    );
  }
  const provados = checados.filter((p) => p.vendas.some((v) => v?.data));
  const receitaProvada = checados.reduce(
    (a, p) => a + p.vendas.filter((v) => v?.data).reduce((s, v) => s + Number(v.valor ?? 0), 0),
    0,
  );
  const semFonte = projetos.filter((p) => !Array.isArray(p.vendas)).map((p) => p.slug);
  return apurado(
    `${provados.length} de ${checados.length} projeto(s) checado(s) contra um sistema de pagamento têm venda com data: ` +
      `${provados.map((p) => `${p.slug} (${p.vendas.filter((v) => v?.data).length})`).join(", ") || "nenhum"}. ` +
      `Receita provada: R$ ${receitaProvada.toFixed(2)}. Venda sem data não conta — dinheiro sem data é R$ 0.`,
    "data/projects.json (campo `vendas`, derivado do gateway por scripts/vendas-mercadopago.mjs)",
    agora,
    `${semFonte.length} dos ${projetos.length} cards não têm fonte de pagamento ligada e ficam FORA da conta: ` +
      `ausência de \`vendas\` é "não olhei", nunca "não vendeu". Sem gateway: ${semFonte.join(", ") || "nenhum"}.`,
  );
}

// ── D-68 / D-69 — os gates do sirius e do tapepro ───────────────────────────────────────────
// O ALVO e a DATA são curadoria (viram do `acao` do card, formato fixo da casa); o número de
// HOJE é apurado no GSC. É a divisão que importa: a meta é decisão humana, o placar não.
export function parseGate(texto) {
  const m = /Gate (\d{2}\/\d{2}): ≥ ?([\d.]+) (cliques não-branded|imp)\/28d(?: \(hoje (\d+)\))?/.exec(texto ?? "");
  if (!m) return null;
  return {
    ate: m[1],
    alvo: Number(m[2]),
    metrica: m[3] === "imp" ? "impressoes" : "cliques nao-branded",
    curadoria: m[4] === undefined ? null : Number(m[4]),
  };
}

const cardDe = (raiz, slug) => lerProjetos(raiz).find((p) => p.slug === slug);

// Branded = a query cita a marca. Quebrar por país é obrigatório em MÉDIA de posição (homônimo
// estrangeiro afunda a branded), mas para CLIQUE a soma é a soma; o que muda o número aqui é
// separar branded de não-branded, e é isso que o gate mede.
export const naoBranded = (linhas, marca) =>
  linhas.filter((l) => !l.keys[0].toLowerCase().replace(/\s+/g, "").includes(marca));

async function gate(slug, marca, { raiz, gsc, agora }) {
  const card = cardDe(raiz, slug);
  const g = parseGate(card?.acao) ?? parseGate(card?.acaoDesc);
  if (!g) return naoApurado(`sem gate no formato da casa no card de ${slug} (acao/acaoDesc)`, "", agora);
  const host = new URL(card.url).hostname;
  const linhas = await gsc(host);
  // Impressão é do SITE, não a soma das linhas de query: o GSC anonimiza query rara, e somar
  // query × page × country devolve um piso, não o total. Medido aqui: o tapepro deu 5 somando
  // as queries nomeadas contra 33 no total do site — um "gate despencou" que era artefato da
  // dimensão. Clique não-branded continua exigindo a dimensão query (é o que o gate define),
  // e por isso ele é declarado como piso.
  const totais = g.metrica === "impressoes" ? await gsc(host, []) : null;
  const alvoHoje = totais
    ? (totais[0]?.impressions ?? 0)
    : naoBranded(linhas, marca).reduce((s, l) => s + l.clicks, 0);
  const top = naoBranded(linhas, marca)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 3)
    .map((l) => `"${l.keys[0]}" (${l.impressions} imp, pos ${l.position.toFixed(1)})`);
  // A defasagem da curadoria sai no mesmo texto de propósito: é a comparação B (o que o corpus
  // afirma × o que a fonte viva devolve) de graça, sem LLM nenhum.
  const defasagem =
    g.curadoria === null || g.curadoria === alvoHoje
      ? ""
      : ` ⚠️ a curadoria do card ainda diz "hoje ${g.curadoria}" — defasada em ${Math.abs(alvoHoje - g.curadoria)}.`;
  return apurado(
    `Gate ${g.ate}: ≥ ${g.alvo} ${g.metrica}/28d. Hoje: ${alvoHoje}${alvoHoje >= g.alvo ? " (PASSOU)" : ""}` +
      `${totais ? " (total do site)" : ""}. ` +
      `Top não-branded: ${top.join("; ") || "nenhuma"}.${defasagem}`,
    `GSC searchAnalytics 28d (query × page × country) em ${host} + alvo/data do card`,
    agora,
    totais
      ? "o número é o total do site (dimensions: []); somar as linhas de query devolveria um piso."
      : "é PISO: clique de query anonimizada pelo GSC não entra na soma, então o real pode ser maior.",
  );
}

// ── D-70 — o que está travado e em quê ──────────────────────────────────────────────────────
// `familia` e `estado` são CURADORIA, como o alvo e a data do gate: julgamento de negócio que não
// se lê de fonte viva. O que se apura é a DISTRIBUIÇÃO — e ela deixa de ser prosa concordando com
// prosa no instante em que vira contagem de campo.
//
// AS DEFINIÇÕES SÃO TESTES, NÃO ADJETIVOS. "não tem como cobrar" é opinião; "não existe caminho
// de pagamento no repo NEM gateway ligado" se checa. Foi a falta disso que produziu 77,1% de
// concordância entre duas leituras independentes dos mesmos 35 cards — e 6 das 8 divergências
// eram a DEFINIÇÃO, não o rótulo (`docs/curadoria-familia-concordancia.md`).
//
// A quarta família não estava na spec, e a derivação cega a REINVENTOU sozinha com outro nome
// (`nao-comercial`) — é a prova de que ela não é invenção de quem curou. A quinta veio da
// derivação cega e o Jean aprovou em 31/07: `produto` quebra ANTES da cobrança, e espalhar esses
// quatro entre `cobranca`/`trafego`/`nao-vende` fazia o hub propor a ação errada nos três.
// O rótulo aqui é curto de propósito: ele sai dentro da resposta de D-70, e resposta longa vira
// documento do corpus. O TESTE de cada família mora em `docs/curadoria-familia-concordancia.md`,
// que é onde ele se lê antes de curar — não no meio de uma contagem.
export const FAMILIAS = {
  cobranca: "não tem como cobrar",
  venda: "não tem quem venda",
  trafego: "não tem tráfego",
  "nao-vende": "não tenta faturar por decisão",
  produto: "não há o que cobrar: o produto não funciona",
};
// `no-ar-inutilizavel` = o CAMINHO PRINCIPAL não completa de ponta a ponta (formulário que não
// envia, login que não loga, API que não responde). Teste decidido pelo Jean em 31/07 depois de a
// derivação cega discordar em 3 cards — o critério anterior ("só se não abre") deixava passar o
// matchfios, cujo único caminho de conversão não vai a lugar nenhum.
export const ESTADOS = ["no-ar", "no-ar-inutilizavel", "prototipo"];

const contar = (itens, chave) =>
  Object.entries(
    itens.reduce((acc, i) => ({ ...acc, [chave(i)]: (acc[chave(i)] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

function d70({ raiz, agora }) {
  const projetos = lerProjetos(raiz);
  // Falha FECHADA: card sem o campo tira a pergunta inteira de circulação em vez de sair uma
  // contagem parcial com cara de completa. Meia apuração carrega a autoridade do número.
  const sem = projetos.filter((p) => !FAMILIAS[p.familia] || !ESTADOS.includes(p.estado));
  if (sem.length) {
    return naoApurado(
      `${sem.length} de ${projetos.length} card(s) sem \`familia\` (${Object.keys(FAMILIAS).join("|")}) ou ` +
        `\`estado\` (${ESTADOS.join("|")}) em data/projects.json: ${sem.map((p) => p.slug).join(", ")}.`,
      "",
      agora,
    );
  }
  const travados = projetos.filter((p) => (p.blockersLista ?? []).length);
  const porFamilia = contar(travados, (p) => p.familia)
    .map(([f, n]) => `${FAMILIAS[f]}: ${n} (${travados.filter((p) => p.familia === f).map((p) => p.slug).join(", ")})`)
    .join(" · ");
  return apurado(
    `${travados.length} de ${projetos.length} têm blocker registrado. Por família — ${porFamilia}. ` +
      `Estado: ${contar(projetos, (p) => p.estado).map(([e, n]) => `${n} ${e}`).join(", ")}.`,
    "data/projects.json (familia + estado + blockersLista), curadoria confirmada pelo Jean",
    agora,
    "família e estado são julgamento humano no card; o que se apura aqui é a distribuição, não o julgamento.",
  );
}

// ── D-71 — o que está bloqueado esperando o Jean ────────────────────────────────────────────
function d71({ raiz, agora }) {
  const projetos = lerProjetos(raiz);
  const humanos = projetos.flatMap((p) =>
    (p.blockersLista ?? []).filter((b) => b && typeof b === "object" && b.humano).map((b) => `${p.slug}: ${b.texto}`),
  );
  if (!projetos.some((p) => (p.blockersLista ?? []).some((b) => b && typeof b === "object"))) {
    return naoApurado(
      "blockersLista é texto livre: não há marca que separe 'depende do Jean' (painel de terceiro, login manual) de " +
        'tarefa de agente. Trocar a string por `{ "texto": "…", "humano": true }` torna esta pergunta apurável — ' +
        "grep por 'manual|jean' na prosa devolve 18 cards contra os 5 reais, ou seja, mede o texto, não o bloqueio.",
      "",
      agora,
    );
  }
  return apurado(
    `${humanos.length} bloqueios humanos: ${humanos.join(" · ") || "nenhum"}.`,
    "data/projects.json (blockersLista com humano: true)",
    agora,
  );
}

// ── D-72 — onde o roihub roda e como se publica ─────────────────────────────────────────────
// BRT é UTC-3 fixo (o Brasil não tem mais horário de verão) — é o que permite converter o cron
// do workflow sem tabela de fuso.
export function cronParaBrt(cron) {
  const [minuto, hora] = String(cron).split(/\s+/);
  const h = (Number(hora) + 24 - 3) % 24;
  return `${String(h).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
}

function d72({ raiz, agora }) {
  const conf = readdirSync(raiz).find((f) => /^next\.config\./.test(f));
  const standalone = conf && /output:\s*["']standalone["']/.test(ler(raiz, conf));
  const docker = existsSync(join(raiz, "Dockerfile"));
  const vercel = existsSync(join(raiz, "vercel.json")) || existsSync(join(raiz, ".vercel"));
  const wf = join(raiz, ".github/workflows");
  const crons = existsSync(wf)
    ? readdirSync(wf).flatMap((f) => {
        const m = /-\s*cron:\s*["']([^"']+)["']/.exec(ler(raiz, `.github/workflows/${f}`));
        return m ? [{ arquivo: f, brt: cronParaBrt(m[1]), cron: m[1] }] : [];
      })
    : [];
  const janela = crons.map((c) => `${c.brt} BRT (${c.arquivo}, "${c.cron}" UTC)`).join("; ");
  return apurado(
    `Docker: ${docker ? "Dockerfile na raiz" : "SEM Dockerfile"}, Next com output "standalone" ${standalone ? "confirmado" : "AUSENTE"} em ${conf}. ` +
      `${vercel ? "⚠️ há config da Vercel no repo" : "Não é Vercel: não há vercel.json nem .vercel"} — o build da imagem é disparado pelo push em main no EasyPanel. ` +
      `Janela proibida de push: ${janela || "nenhum cron"} — deploy no meio derruba a publicação do dia.`,
    // O gatilho do EasyPanel é config de painel: o repo prova o que NÃO é (Vercel) e prova o cron.
    "Dockerfile + next.config + .github/workflows (o gatilho do EasyPanel é painel, não verificável aqui)",
    agora,
  );
}

// ── D-73 — teste novo está no CI? ───────────────────────────────────────────────────────────
function d73({ raiz, agora }) {
  const pkg = JSON.parse(ler(raiz, "package.json"));
  const cmd = pkg.scripts?.test ?? "";
  const arquivos = readdirSync(join(raiz, "test")).filter((f) => f.endsWith(".test.mjs"));
  const fora = arquivos.filter((f) => !cmd.includes(`test/${f}`));
  const framework = ["jest", "vitest", "mocha"].filter((d) => pkg.devDependencies?.[d] || pkg.dependencies?.[d]);
  return apurado(
    `Não: npm test roda uma lista explícita no package.json (${arquivos.length - fora.length} arquivos). ` +
      `Hoje ${fora.length} arquivo(s) de teste fora da lista${fora.length ? `: ${fora.join(", ")}` : ""} — arquivo novo só roda depois de entrar lá à mão. ` +
      `Motor: node --test com assert/strict, sem framework (${framework.length ? `⚠️ ${framework.join(", ")} instalado` : "jest/vitest/mocha não instalados"}).`,
    "package.json (scripts.test) × test/*.test.mjs no disco",
    agora,
  );
}

// ── D-79 — o corpus tem afirmação de presente com número que não se apura? ──────────────────
// A norma do `scripts/validade.mjs` vira FATO: o que ela varre é o mesmo material que o detector
// de defasagem julga, e a contagem de hoje diz se a defasagem está NASCENDO ou parou de nascer.
// Aqui não há LLM nem rede — é a apuração mais barata da camada, e por isso ela roda em toda régua.
function d79({ raiz, memoriaDir, agora }) {
  const doRepo = vivosDoRepo(raiz);
  // Memória mora em ~/.claude e não existe na imagem Docker: contar sem dizer de onde faria o
  // mesmo número significar duas coisas diferentes conforme a máquina. Os dois saem separados.
  const daMemoria = vivosDaMemoria(memoriaDir);
  const achados = [...doRepo, ...daMemoria].flatMap((a) =>
    afirmacoesDePresente(a.texto).map((v) => `${a.rel}:${v.linha} [${v.padrao}]`),
  );
  return apurado(
    `${achados.length} afirmação(ões) de presente com número sem data em ${doRepo.length + daMemoria.length} documentos vivos ` +
      `(${doRepo.length} no repo, ${daMemoria.length} nas memórias). ` +
      `${achados.length ? `Onde: ${achados.join("; ")}.` : "Nenhuma — `npm run validade` passa limpo."} ` +
      `Handoff não entra na varredura: é registro datado.`,
    "scripts/validade.mjs sobre protocolos vivos + data/projects.json + memórias (zero LLM, zero rede)",
    agora,
    daMemoria.length
      ? "conta só documento VIVO: handoff datado fica de fora de propósito, e citação entre crases ou bloco cercado não é afirmação."
      : "as memórias NÃO estavam neste ambiente (moram em ~/.claude, fora do repo): o número cobre só o repo.",
  );
}

// ── D-80 / D-81 / D-82 — o inventário de cobrança, e o CRUZAMENTO que é a leitura ────────────
// As duas metades são CARAS de jeitos diferentes (centenas de chamadas à API do GitHub / ~250
// requisições contra produção) e as três perguntas leem as mesmas duas varreduras. `memo` faz a
// varredura acontecer UMA vez por execução de `apurarEstado`: sem isso, `--estado caro` dispararia
// o mesmo inventário três vezes e o custo declarado no `rede` seria mentira.
// AS ÂNCORAS DA 2ª VIA, e as quatro foram MEDIDAS contra o corpus (298 documentos) antes de
// entrarem — a largura entre parênteses é o número de documentos que cada uma seleciona. Âncora
// larga não é "mais alcance": é uma chamada do pool por documento para o modelo dizer `nao-fala`.
//
// As duas REJEITADAS ficam escritas porque a medição é o que impede a próxima sessão de repetir:
//   · `(\d+) protocolos?` solto → 13 documentos, e a maioria é HOMÔNIMO (97 protocolos no total,
//     85 tipados, 29 candidatos, 11…). Com `× N projetos` junto são 3, e os 3 são o fato certo.
//   · `(\d+) com gateway ligado` → casa também o DENOMINADOR ("1 de 35 com gateway LIGADO"
//     devolve 35). Quantidade citada com o total ao lado precisa da preposição na regex.
//
// D-79, D-84 e D-85 não têm âncora, e a ausência é deliberada: nenhum dos três é quantidade que a
// casa cite em prosa, e "10 propriedades GSC" (project_roihub) NÃO é o mesmo fato que "10
// propriedades com export no repo" — casar os dois seria fabricar acusação em cima de sinônimo.
export const CITACOES = {
  "D-80": [{ nome: "projetos com SDK de pagamento escrito", re: /(\d+)\s+(?:projetos?\s+)?com\s+SDK(?:\s+(?:de\s+pagamento\s+)?escrito)?/gi }],
  "D-81": [{ nome: "servem preço e só falta ligar", re: /(\d+)\s+(?:j[áa]\s+)?servem\s+pre[çc]o/gi }],
  "D-82": [{ nome: "sem caminho de cobrança servido", re: /(\d+)\s+sem\s+caminho\s+de\s+cobran[çc]a/gi }],
  "D-83": [{ nome: "protocolos que rodam", re: /(\d+)\s+protocolos?\s+(?:×|x)\s+\d+\s+projetos?|(\d+)\s+protocolos?\s+que\s+rodam/gi }],
};
const citar = (id, valor) => CITACOES[id].map((c) => ({ ...c, valor }));

const memo = (ctx, chave, fn) => {
  if (!ctx.cache.has(chave)) ctx.cache.set(chave, fn());
  return ctx.cache.get(chave);
};
const inventarioRepo = (ctx) =>
  memo(ctx, "gateways-repo", () => inventariarRepo(lerProjetos(ctx.raiz), { fetchImpl: ctx.fetchImpl }));
const inventarioServido = (ctx) =>
  memo(ctx, "gateways-servido", () =>
    inventariarServido(lerProjetos(ctx.raiz).filter((p) => p.url), { buscarImpl: ctx.buscarHttp }),
  );

async function d80(ctx) {
  const linhas = await inventarioRepo(ctx);
  const balde = (b) => linhas.filter((l) => l.balde === b);
  const nomear = (b) => balde(b).map((l) => `${l.slug}${l.gateways.length ? ` (${l.gateways.join("+")})` : ""}`);
  const fato = apurado(
    `${balde("sdk").length} de ${linhas.length} projetos têm SDK de pagamento DECLARADO no package.json: ${nomear("sdk").join(", ") || "nenhum"}. ` +
      `Só variável de ambiente (sinal mais fraco): ${nomear("env").join(", ") || "nenhum"}. ` +
      `Nada no código: ${balde("nada").length}. Repo ausente ou ilegível: ${nomear("sem_repo").join(", ") || "nenhum"}.`,
    "API do GitHub (árvore + package.json e .env* de cada repo de data/projects.json)",
    ctx.agora,
    `"nada no código" é "não achei", NUNCA "não cobra": cobrança pode morar em serviço fora do repo (o sirius fatura ` +
      `por tier no próprio banco), em repo privado que o token não alcança, ou além dos 40 primeiros arquivos que o ` +
      `check abre. Linha comentada (\`# STRIPE_SECRET_KEY\`) não conta como env var declarada.`,
  );
  return { ...fato, citacoes: citar("D-80", balde("sdk").length) };
}

async function d82(ctx) {
  const linhas = await inventarioServido(ctx);
  const balde = (b) => linhas.filter((l) => l.balde === b);
  const nomear = (b) => balde(b).map((l) => l.slug).join(", ") || "nenhum";
  const fato = apurado(
    `Dos ${linhas.length} sites, ${balde("ligado").length} com gateway LIGADO e régua lendo (${nomear("ligado")}), ` +
      `${balde("gateway-nao-ligado").length} com gateway servido e nenhuma régua consultando (${nomear("gateway-nao-ligado")}), ` +
      `${balde("so-preco").length} servindo preço sem gateway (${nomear("so-preco")}) e ` +
      `${balde("sem-gateway").length} sem nenhum caminho de cobrança servido. ` +
      `Não olhei (home fora do ar): ${nomear("nao_apurado")}.`,
    "HTTP contra os 35 sites de produção (home + 9 caminhos de cobrança), casando só contra URL de host de gateway",
    ctx.agora,
    `só o HTML SERVIDO: gateway montado por JS depois de um clique não aparece, e cobrança que não passa pelo site ` +
      `também não. \`sem-gateway\` é "não achei caminho servido", nunca "não cobra".`,
  );
  return { ...fato, citacoes: citar("D-82", balde("sem-gateway").length) };
}

// O CRUZAMENTO é a leitura, e nenhuma das duas metades sozinha a produz: pelo HTML eram 30 sem
// caminho de cobrança, pelo código são 10 com integração escrita e nunca ligada. A segunda leitura
// é a cara, e é a que muda a priorização da casa.
async function d81(ctx) {
  const [repo, servido] = await Promise.all([inventarioRepo(ctx), inventarioServido(ctx)]);
  const porSlug = new Map(servido.map((l) => [l.slug, l]));
  const projetos = lerProjetos(ctx.raiz);
  const faturou = new Set(projetos.filter((p) => (p.vendas ?? []).some((v) => v?.data)).map((p) => p.slug));
  const comSdk = repo.filter((l) => l.balde === "sdk");
  const escrito = (b) => comSdk.filter((l) => porSlug.get(l.slug)?.balde === b).map((l) => l.slug);
  // O inverso: cobra por link externo, que não deixa dependência no package.json (o caso do
  // orcaobra/Kiwify). Sem esta linha o inventário do código pareceria completo.
  const semSdkComGateway = servido
    .filter((l) => ["ligado", "gateway-nao-ligado"].includes(l.balde))
    .filter((l) => repo.find((r) => r.slug === l.slug)?.balde !== "sdk")
    .map((l) => l.slug);
  const fato = apurado(
    `${comSdk.length} projetos têm SDK de pagamento escrito e ${comSdk.filter((l) => faturou.has(l.slug)).length} faturou(aram) com data: ` +
      `${comSdk.filter((l) => faturou.has(l.slug)).map((l) => l.slug).join(", ") || "nenhum"}. ` +
      // A DECOMPOSIÇÃO TEM QUE FECHAR: na 1ª corrida ela saía 6+0+3 de 10 e o balde `ligado` (o
      // atma) sumia do texto — leitor nenhum acha o que a apuração não nomeia, e "10 com SDK" com
      // três subgrupos que somam 9 é o formato de uma conta errada.
      `Desses ${comSdk.length}: ${escrito("ligado").length} com gateway ligado e régua lendo (${escrito("ligado").join(", ") || "nenhum"}), ` +
      `${escrito("so-preco").length} já servem preço e só falta LIGAR (${escrito("so-preco").join(", ") || "nenhum"}), ` +
      `${escrito("gateway-nao-ligado").length} servem gateway sem régua lendo (${escrito("gateway-nao-ligado").join(", ") || "nenhum"}), ` +
      `${escrito("sem-gateway").length} estão mais longe (${escrito("sem-gateway").join(", ") || "nenhum"}) e ` +
      `${escrito("nao_apurado").length} não foram olhados (home fora do ar). ` +
      `Servem gateway SEM SDK no repo (cobrança por link externo): ${semSdkComGateway.join(", ") || "nenhum"}.`,
    "cruzamento de scripts/gateways-repo.mjs (API do GitHub) com scripts/gateways.mjs (HTTP em produção) + `vendas` do card",
    ctx.agora,
    `card ≠ repositório: dois cards podem apontar para o MESMO repo (goiania e roilabs são vertical dentro de ` +
      `monorepo), e aí somar os dois infla o lado do código.`,
  );
  return { ...fato, citacoes: citar("D-81", escrito("so-preco").length) };
}

// ── D-83 — quantos projetos violam os protocolos que rodam ──────────────────────────────────
async function d83(ctx) {
  const todos = lerProjetos(ctx.raiz).filter((p) => p.url);
  const resultados = await memo(ctx, "conformidade", () =>
    Promise.all(todos.map((p) => ctx.conformidade(p, todos))),
  );
  const linhas = resultados.flatMap((r) => r.linhas.map((l) => ({ ...l, slug: r.slug })));
  const falhas = linhas.filter((l) => l.ok === false);
  const porCheck = CHECKS.map((c) => {
    const f = falhas.filter((l) => l.id === c.id);
    return f.length ? `${c.id}: ${f.length} (${f.map((l) => l.slug).join(", ")})` : "";
  }).filter(Boolean);
  const projetosComFalha = new Set(falhas.map((l) => l.slug));
  const fato = apurado(
    `${CHECKS.length} protocolos rodam contra ${todos.length} projetos: ${falhas.length} violação(ões) em ` +
      `${projetosComFalha.size} projeto(s). Por check — ${porCheck.join(" · ") || "nenhuma violação"}. ` +
      `${linhas.filter((l) => l.ok === null).length} de ${linhas.length} células saíram n/a.`,
    `scripts/conformidade.mjs — ${CHECKS.map((c) => c.id).join(" ")} por HTTP contra produção (zero LLM)`,
    ctx.agora,
    `\`n/a\` NÃO é aprovação, é "não olhei" (check que não se aplica àquela stack, ou página que não respondeu). ` +
      `E a primeira corrida de um check novo mede o CHECK: 5 das 46 violações iniciais eram o check errado.`,
  );
  return { ...fato, citacoes: citar("D-83", CHECKS.length) };
}

// ── D-84 — os sites estão no índice do Google? ──────────────────────────────────────────────
// Status 200 não prova nada: o atma respondia 200 e estava FORA do índice. Só a URL Inspection
// decide, e ela é a única fonte que separa "não indexado" de "o Google nunca viu este host".
async function d84(ctx) {
  const projetos = lerProjetos(ctx.raiz).filter((p) => p.url);
  const linhas = await ctx.inspecionar(projetos.map((p) => p.url));
  const slugDe = (url) => projetos.find((p) => p.url === url)?.slug ?? url;
  const indexadas = linhas.filter(estaIndexada);
  const semPropriedade = linhas.filter((l) => !l.propriedade);
  const falhou = linhas.filter((l) => l.erro && l.propriedade);
  const fora = linhas.filter((l) => l.propriedade && !l.erro && !estaIndexada(l));
  return apurado(
    `${indexadas.length} de ${linhas.length - semPropriedade.length - falhou.length} home(s) inspecionável(is) estão no índice. ` +
      `FORA do índice: ${fora.map((l) => `${slugDe(l.url)} (${l.coverage || l.verdict || "sem veredito"})`).join(", ") || "nenhuma"}. ` +
      `Sem propriedade no GSC (o Search Console não alcança o host): ${semPropriedade.map((l) => slugDe(l.url)).join(", ") || "nenhuma"}. ` +
      `Falhou a inspeção: ${falhou.map((l) => `${slugDe(l.url)} — ${l.erro}`).join("; ") || "nenhuma"}.`,
    "Search Console URL Inspection API (index:inspect) na home de cada projeto com url",
    ctx.agora,
    `"sem propriedade" NÃO é "fora do índice": é "não há onde olhar" — host de fornecedor (*.vercel.app) fica fora de ` +
      `toda propriedade, e \`URL unknown to Google\` ali é falta de domínio próprio, não sinal de SEO. Só a home é ` +
      `inspecionada: página interna desindexada não aparece aqui.`,
  );
}

// ── D-85 — quanto o Googlebot rastreia, e de quando é esse dado ─────────────────────────────
function d85({ raiz, agora }) {
  const props = resumoCrawl(raiz);
  if (!props.length) {
    return naoApurado(
      "nenhum export de crawl stats em docs/: a API do GSC NÃO expõe crawl stats, a UI é a única fonte " +
        "(`node scripts/fetch-crawl-stats.mjs`) e o que não foi exportado não existe para este fato.",
      "",
      agora,
    );
  }
  const pct = (r) => (r === null ? "n/a" : `${(r * 100).toFixed(1).replace(".", ",")}%`);
  const maisVelho = props.map((p) => p.ultimoExport).sort()[0];
  const problemas = props.flatMap((p) => p.hostsComProblema.map((h) => `${p.host} → ${h}`));
  const passado = props.flatMap((p) => p.hostsProblemaPassado);
  return apurado(
    `${props.length} propriedades com export no repo. Requisições em 28 dias e OK% por host — ` +
      `${props.map((p) => `${p.host}: ${p.requests28} req, OK ${pct(p.okRatio)}${p.erro5xx ? `, 5xx ${pct(p.erro5xx)}` : ""}`).join(" · ")}. ` +
      `Hosts com problema AGORA: ${problemas.join("; ") || "nenhum"}` +
      `${passado.length ? ` — outros ${passado.length} host(s) marcados "problemas no passado", que é histórico da janela de 90 dias e não falha de hoje` : ""}.`,
    `docs/Crawl-stats — exports da UI do Search Console commitados no repo (o mais antigo é de ${maisVelho})`,
    agora,
    `o número é do EXPORT, não de hoje: cada export cobre 90 dias e o mais antigo aqui é de ${maisVelho}. Falha que ` +
      `aparece no gráfico pode ser de dois meses atrás — date antes de caçar bug. Sem export novo, o dado envelhece ` +
      `sozinho e nada no repo avisa.`,
  );
}

// `rede` declara o CUSTO de cada uma, e `caro` é o degrau acima: varredura de centenas de
// requisições contra produção ou contra a API do GitHub. A separação existe porque
// `corpus-defasado.mjs` e `avaliar-resposta.mjs` chamam com `modo: "tudo"` — pendurar o inventário
// de gateways ali dentro faria TODA corrida de régua disparar ~250 requisições contra os sites,
// que é o mesmo motivo pelo qual o conformidade está fora do `npm test`. Fonte cara tem modo
// próprio (`--estado caro`), nunca só mais uma entrada aqui.
export const APURADORES = {
  "D-66": { rede: "github", apurar: d66 },
  "D-67": { rede: "", apurar: d67 },
  "D-68": { rede: "gsc", apurar: (ctx) => gate("sirius", "sirius", ctx) },
  "D-69": { rede: "gsc", apurar: (ctx) => gate("tapepro", "tapepro", ctx) },
  "D-70": { rede: "", apurar: d70 },
  "D-71": { rede: "", apurar: d71 },
  "D-72": { rede: "", apurar: d72 },
  "D-73": { rede: "", apurar: d73 },
  "D-79": { rede: "", apurar: d79 },
  "D-80": { rede: "github", caro: true, apurar: d80 },
  "D-81": { rede: "github + produção", caro: true, apurar: d81 },
  "D-82": { rede: "produção", caro: true, apurar: d82 },
  "D-83": { rede: "produção", caro: true, apurar: d83 },
  "D-84": { rede: "gsc", apurar: d84 },
  "D-85": { rede: "", apurar: d85 },
};

// offline < tudo < caro. `caro` roda tudo; `tudo` roda rede normal; `offline` só o que sai do repo.
const NIVEL = { offline: 0, tudo: 1, caro: 2 };
const nivelDe = (a) => (a.caro ? 2 : a.rede ? 1 : 0);

/**
 * Apura a camada `estado`. `modo: "offline"` roda só as que saem de arquivo do repo, `"tudo"`
 * inclui GitHub e GSC, `"caro"` inclui as varreduras de centenas de requisições.
 * @returns {Promise<Record<string, {resposta:string, fonte:string, apurado_em:string, nao_apurado:string, ressalva:string}>>}
 */
export async function apurarEstado({
  modo = "offline",
  raiz = RAIZ,
  fetchImpl = fetch,
  gsc = null,
  // As fontes vivas entram por parâmetro, uma costura por fonte: é o que permite ao teste medir a
  // apuração sem tocar em rede — e o que impede a apuração de cair para um valor de arquivo
  // quando a fonte não responde.
  inspecionar = (urls) => inspecionarIndexacao(urls),
  buscarHttp = buscarHttpReal,
  conformidade = rodarProjeto,
  memoriaDir = MEMORIA_PADRAO,
  agora,
} = {}) {
  const saida = {};
  // Uma varredura por execução, compartilhada entre as perguntas que a leem (D-80/D-81/D-82).
  const cache = new Map();
  for (const [id, a] of Object.entries(APURADORES)) {
    if (nivelDe(a) > (NIVEL[modo] ?? 0)) {
      saida[id] = naoApurado(`precisa de ${a.rede} — rode com --estado ${a.caro ? "caro" : "tudo"}`, "", agora);
      continue;
    }
    try {
      saida[id] = await a.apurar({ raiz, fetchImpl, gsc, inspecionar, buscarHttp, conformidade, memoriaDir, cache, agora });
    } catch (e) {
      // Fonte fora do ar devolve `nao_apurado`, nunca o valor da execução anterior: valor velho
      // servido como apurado é exatamente o defeito que esta frente existe para matar.
      saida[id] = naoApurado(`falhou ao apurar: ${e.message}`, "", agora);
    }
  }
  return saida;
}
