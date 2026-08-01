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

export const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// Data, não timestamp: o aceite desta frente é "duas execuções no mesmo dia batem", e o relógio
// faria dois apurados idênticos parecerem diferentes.
// Em BRT porque todo handoff, memória e card desta base datam em BRT: carimbar 01/08 numa
// apuração feita às 21h de 31/07 criaria uma defasagem de um dia que não existe.
// ⚠️ A janela do GSC continua deslizando na meia-noite UTC — o mesmo fim de tarde devolveu 33 e
// depois 42 impressões para o tapepro por isso, não por instabilidade da fonte.
const hoje = (agora = new Date()) => new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 10);

const apurado = (resposta, fonte, agora) => ({ resposta, fonte, apurado_em: hoje(agora), nao_apurado: "" });

// `resposta` pode vir preenchida junto com `nao_apurado`: a parte computável fica visível, mas o
// item inteiro sai de circulação como gabarito. Meia apuração usada como dourado é pior que
// nenhuma — ela carrega a autoridade do número e a fragilidade da prosa.
const naoApurado = (motivo, resposta = "", agora) => ({
  resposta,
  fonte: "",
  apurado_em: hoje(agora),
  nao_apurado: motivo,
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

async function d66({ raiz, fetchImpl, agora }) {
  const curados = lerProjetos(raiz);
  const repos = await reposDoGithub(fetchImpl);
  // O MESMO merge que `listProjects()` usa. Contar `data/projects.json` direto daria outro
  // número — é a armadilha declarada da própria pergunta.
  const lista = mergeProjects(curados, repos);
  const vivos = repos.filter((r) => !r.archived);
  const semSite = vivos.filter((r) => !r.homepage?.trim()).map((r) => r.name);
  return apurado(
    `${lista.length} projetos: ${curados.length} curados em data/projects.json + ${lista.length - curados.length} vindos do GitHub sem curadoria. ` +
      `A lista sai de listProjects() — curadoria + todo repo vivo com homepage — e a chave é a URL do site, não o repo. ` +
      `Hoje ${vivos.length} repos ativos, ${vivos.length - semSite.length} com homepage; sem homepage: ${semSite.join(", ") || "nenhum"}.`,
    "API do GitHub (/user/repos) + data/projects.json via mergeProjects()",
    agora,
  );
}

// ── D-67 — quantos têm receita provada ──────────────────────────────────────────────────────
// A regra da casa é "dinheiro sem data é R$ 0". Ela só vira apuração quando a venda tiver data
// no card; `receita` é nota 0-10 de PRIORIDADE, não faturamento, e somá-la seria inventar.
function d67({ raiz, agora }) {
  const projetos = lerProjetos(raiz);
  const comCampo = projetos.filter((p) => Array.isArray(p.vendas));
  if (!comCampo.length) {
    return naoApurado(
      "data/projects.json não tem campo de venda: `receita` é nota 0-10 de prioridade e `receitaNota` é prosa. " +
        'Encher `vendas: [{ "data": "2026-06-12", "valor": 97 }]` no card de quem faturou torna esta pergunta apurável — ' +
        "e a regra da casa (dinheiro sem data é R$ 0) passa a rodar em vez de ser citada.",
      "",
      agora,
    );
  }
  const provados = comCampo.filter((p) => p.vendas.some((v) => v?.data));
  return apurado(
    `${provados.length} de ${projetos.length} têm venda com data registrada: ${provados.map((p) => `${p.slug} (${p.vendas.filter((v) => v?.data).length})`).join(", ") || "nenhum"}. ` +
      "Venda sem data não conta — dinheiro sem data é R$ 0.",
    "data/projects.json (campo `vendas`)",
    agora,
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
      `${totais ? " (total do site)" : " — piso: query anonimizada pelo GSC não aparece"}. ` +
      `Top não-branded: ${top.join("; ") || "nenhuma"}.${defasagem}`,
    `GSC searchAnalytics 28d (query × page × country) em ${host} + alvo/data do card`,
    agora,
  );
}

// ── D-70 — o que está travado e em quê ──────────────────────────────────────────────────────
function d70({ raiz, agora }) {
  const projetos = lerProjetos(raiz);
  const travados = projetos.filter((p) => (p.blockersLista ?? []).length);
  return naoApurado(
    "as três famílias de travamento ('não tem como cobrar', 'não tem quem venda', 'não tem tráfego') e o estado " +
      "(no-ar / no-ar-inutilizavel / protótipo) não existem como campo em data/projects.json — são prosa em acaoDesc. " +
      "Um campo `familia` e um `estado` no card tornam esta pergunta apurável; sem eles a resposta continua sendo prosa concordando com prosa.",
    `${travados.length} de ${projetos.length} têm blocker registrado em blockersLista: ${travados.map((p) => p.slug).join(", ")}.`,
    agora,
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

// `rede` declara o CUSTO de cada uma: três dependem do GSC (rede e cota) e uma do GitHub. Sem
// isso a medição barata não poderia rodar, e uma frente que só roda cara não roda.
export const APURADORES = {
  "D-66": { rede: "github", apurar: d66 },
  "D-67": { rede: "", apurar: d67 },
  "D-68": { rede: "gsc", apurar: (ctx) => gate("sirius", "sirius", ctx) },
  "D-69": { rede: "gsc", apurar: (ctx) => gate("tapepro", "tapepro", ctx) },
  "D-70": { rede: "", apurar: d70 },
  "D-71": { rede: "", apurar: d71 },
  "D-72": { rede: "", apurar: d72 },
  "D-73": { rede: "", apurar: d73 },
};

/**
 * Apura as 8 de `estado`. `modo: "offline"` roda só as que saem de arquivo do repo.
 * @returns {Promise<Record<string, {resposta:string, fonte:string, apurado_em:string, nao_apurado:string}>>}
 */
export async function apurarEstado({ modo = "offline", raiz = RAIZ, fetchImpl = fetch, gsc = null, agora } = {}) {
  const saida = {};
  for (const [id, a] of Object.entries(APURADORES)) {
    if (a.rede && modo !== "tudo") {
      saida[id] = naoApurado(`precisa de ${a.rede} — rode com --estado tudo`, "", agora);
      continue;
    }
    try {
      saida[id] = await a.apurar({ raiz, fetchImpl, gsc, agora });
    } catch (e) {
      // Fonte fora do ar devolve `nao_apurado`, nunca o valor da execução anterior: valor velho
      // servido como apurado é exatamente o defeito que esta frente existe para matar.
      saida[id] = naoApurado(`falhou ao apurar: ${e.message}`, "", agora);
    }
  }
  return saida;
}
