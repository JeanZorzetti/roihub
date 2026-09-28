/**
 * Consulta o volume de busca do nicho de um projeto e congela a demanda (057).
 *
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro                       # saldo e custo, não gasta
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro --consultar           # gasta 1 tarefa, não grava
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro --consultar --gravar  # gasta e grava os dois JSON
 *
 * Opções: --sementes "a,b" (padrão: `produtos` do projeto em lib/autopublish-projects.mjs),
 * --regiao "Brazil" (padrão: do idioma do projeto), --marca "a,b" (termos de marca além do slug),
 * --mover "termo=semente" e --excluir "termo:motivo", repetíveis.
 *
 * O volume vem do Google Ads pela DataForSEO (`keywords_for_keywords/live`): sementes entram, termos
 * relacionados com volume mensal saem. A chave mora só na máquina de quem roda: produção não recebe
 * credencial paga que não usa (research D3). Abrir o plano ou o mapa nunca consulta (SC-005).
 *
 * SEM `--gravar` nada é escrito. Trocar o denominador de um KPI não pode ser efeito colateral de olhar
 * um número — a mesma regra de `derivar-inventario.mjs` e `estimar-demanda.mjs`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { projectBySlug } from "../lib/autopublish-projects.mjs";
import { validarInventario } from "../lib/inventario.mjs";
import { regexDeMarca } from "../lib/marca.mjs";
import { PISO_VOLUME, agrupar, normalizar } from "../lib/plano.mjs";

const API = "https://api.dataforseo.com/v3";
const FONTE = "dataforseo google_ads keywords_for_keywords";
const INVENTARIO = new URL("../data/inventario-de-termos.json", import.meta.url);
const DEMANDA = new URL("../data/demanda-estimada.json", import.meta.url);
const REGIAO_DO_IDIOMA = { "pt-BR": "Brazil", "en-US": "United States" };
const MAX_SEMENTES = 20; // limite da API por tarefa

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const repetida = (nome) => args.flatMap((a, i) => (a === nome && args[i + 1] !== undefined ? [args[i + 1]] : []));
const COM_VALOR = new Set(["--sementes", "--regiao", "--marca", "--mover", "--excluir"]);
const slug = args.find((a, i) => !a.startsWith("--") && !COM_VALOR.has(args[i - 1]));
const consultar = args.includes("--consultar");
const gravar = args.includes("--gravar");
const sair = (codigo, msg) => {
  console.error(msg);
  process.exit(codigo);
};

if (!slug) sair(2, 'uso: node --env-file=.env scripts/consultar-demanda.mjs <slug> [--sementes "a,b"] [--regiao Brazil] [--marca "a,b"] [--consultar] [--gravar] [--mover "termo=semente"]... [--excluir "termo:motivo"]...');
// Princípio V: o nome da variável, nunca o valor.
const chave = process.env.DATAFORSEO_API_KEY?.trim();
if (!chave) sair(2, "DATAFORSEO_API_KEY ausente no ambiente");
if (gravar && !consultar) sair(2, "--gravar exige --consultar: não há o que gravar sem consulta");

// research D11: a consulta paga não sobrescreve demanda de outra fonte (o piso do GSC da 050 ou o
// inventário da 034). Trocar esse denominador mudaria folhas que já têm leitura. Checado ANTES de
// qualquer requisição paga.
const lerJson = (url) => JSON.parse(readFileSync(url, "utf8"));
if (gravar) {
  for (const [nome, url] of [["data/inventario-de-termos.json", INVENTARIO], ["data/demanda-estimada.json", DEMANDA]]) {
    const entrada = lerJson(url)[slug];
    if (entrada && !String(entrada.procedencia?.fonte ?? "").startsWith("dataforseo"))
      sair(1, `${nome} já tem a entrada "${slug}" com outra fonte (${entrada.procedencia?.fonte ?? "piso do Search Console, 034/050"}): a consulta paga não a sobrescreve`);
  }
}

const projeto = projectBySlug(slug);
if (!projeto) sair(1, `${slug} não está em lib/autopublish-projects.mjs: sem sementes declaradas`);
const lista = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const produtos = opcao("--sementes") ? lista(opcao("--sementes")) : (projeto.produtos ?? []);
const segmentos = projeto.segmentos ?? [];
if (!produtos.length) sair(1, `${slug} não declara produtos: passe --sementes "a,b"`);
if (produtos.length > MAX_SEMENTES) sair(1, `${produtos.length} sementes: a API aceita até ${MAX_SEMENTES} por tarefa`);
const sementes = produtos.map((p) => p.replaceAll("-", " "));
const regiao = opcao("--regiao") ?? REGIAO_DO_IDIOMA[projeto.language];
if (!regiao) sair(1, `sem região para o idioma ${projeto.language}: passe --regiao`);
const idioma = String(projeto.language).slice(0, 2);
const host = new URL(projeto.siteUrl).hostname;
const marca = [...new Set([slug, ...lista(opcao("--marca"))])];

async function api(caminho, corpo) {
  const r = await fetch(`${API}${caminho}`, {
    method: corpo ? "POST" : "GET",
    headers: { Authorization: `Basic ${chave}`, "Content-Type": "application/json" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.status_code !== 20000) sair(1, `DataForSEO ${caminho}: HTTP ${r.status} · ${j?.status_code ?? "?"} ${j?.status_message ?? "resposta ilegível"}`);
  const t = j.tasks?.[0];
  if (!t || t.status_code !== 20000) sair(1, `DataForSEO ${caminho}: tarefa ${t?.status_code ?? "ausente"} ${t?.status_message ?? ""}`);
  return t;
}

const usd = (v) => `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const dados = (await api("/appendix/user_data")).result?.[0];
const saldo = dados?.money?.balance;
const estimado = dados?.price?.keywords_data?.google_ads?.keywords_for_keywords?.live?.priority_normal?.[0]?.cost;
if (typeof saldo !== "number" || typeof estimado !== "number") sair(1, "DataForSEO não devolveu saldo ou preço em /appendix/user_data");

console.log(`projeto: ${slug} (${host})`);
console.log(`sementes (${sementes.length}): ${sementes.join(", ")}`);
console.log(`segmentos (marcadores, não sementes): ${segmentos.join(", ") || "nenhum"}`);
console.log(`região: ${regiao} · idioma: ${idioma}${opcao("--regiao") ? "" : ` (do idioma ${projeto.language} do projeto; --regiao troca)`}`);
console.log(`saldo: ${usd(saldo)} · custo estimado: ${usd(estimado)} por tarefa (1 tarefa, até 1.000 termos)`);
if (saldo < estimado) sair(1, `saldo insuficiente: faltam ${usd(estimado - saldo)} (FR-003a)`);
if (!consultar) {
  console.log("nada foi gasto. --consultar faz a consulta.");
  process.exit(0);
}

const tarefa = await api("/keywords_data/google_ads/keywords_for_keywords/live", [
  { keywords: sementes, location_name: regiao, language_code: idioma, sort_by: "search_volume" },
]);
if (!Array.isArray(tarefa.result)) sair(1, "DataForSEO devolveu tarefa sem resultado: nada foi gravado");
const custo = tarefa.cost;
const consultadoEm = new Date().toISOString();
const hoje = consultadoEm.slice(0, 10);

// Um termo por palavra-chave, pelo maior volume se vier repetido.
const porTermo = new Map();
for (const r of tarefa.result) {
  const termo = String(r.keyword ?? "").trim().toLowerCase();
  if (!termo) continue;
  const v = typeof r.search_volume === "number" ? r.search_volume : null;
  if (!porTermo.has(termo) || (v ?? -1) > (porTermo.get(termo) ?? -1)) porTermo.set(termo, v);
}
// A semente sem volume fica, marcada "abaixo do mínimo reportado", e não soma (edge case da spec).
for (const s of sementes) if (!porTermo.has(s)) porTermo.set(s, null);

const reMarca = new RegExp(regexDeMarca(marca), "i");
const ehSemente = new Set(sementes.map(normalizar));
const quedas = { marca: 0, piso: 0, semVolume: 0 };
const excluir = Object.fromEntries(
  repetida("--excluir").map((e) => {
    const i = e.indexOf(":");
    if (i <= 0) sair(2, `--excluir "${e}": use "termo:motivo"`);
    return [e.slice(0, i).trim().toLowerCase(), e.slice(i + 1).trim()];
  }),
);
const movidos = Object.fromEntries(
  repetida("--mover").map((m) => {
    const [termo, semente] = m.split("=").map((x) => x.trim());
    if (!termo || !produtos.includes(semente)) sair(2, `--mover "${m}": a semente tem de ser uma de ${produtos.join(", ")}`);
    return [termo.toLowerCase(), semente];
  }),
);
const excluidos = {};
const termos = [];
for (const [termo, volume] of porTermo) {
  if (reMarca.test(termo)) quedas.marca++;
  else if (Object.hasOwn(excluir, termo)) excluidos[termo] = excluir[termo];
  else if (volume === null && !ehSemente.has(normalizar(termo))) quedas.semVolume++;
  else if (volume !== null && volume < PISO_VOLUME) quedas.piso++;
  else termos.push({ termo, volume });
}
for (const t of Object.keys(excluir)) if (!Object.hasOwn(excluidos, t)) console.warn(`aviso: --excluir "${t}" não está na resposta`);
for (const t of Object.keys(movidos)) if (!termos.some((x) => x.termo === t)) console.warn(`aviso: --mover "${t}" não está entre os termos mantidos`);

const { clusters, semCluster } = agrupar(termos, { produtos, segmentos, movidos });
const br = (n) => n.toLocaleString("pt-BR");
const comVolume = termos.filter((t) => typeof t.volume === "number");
console.log(`\ncusto real: ${usd(custo)} · ${br(porTermo.size)} termos devolvidos`);
console.log(`mantidos: ${br(termos.length)} · fora: ${quedas.marca} de marca, ${quedas.piso} abaixo de ${PISO_VOLUME}/mês, ${quedas.semVolume} sem volume, ${Object.keys(excluidos).length} excluídos à mão`);
console.log(`volume total: ${br(comVolume.reduce((a, t) => a + t.volume, 0))} buscas/mês em ${regiao}\n`);
for (const c of clusters) {
  const segs = Object.entries(c.segmentos).map(([s, v]) => `${s} ${br(v)}`).join(", ");
  console.log(`● ${c.semente} · ${c.termos.length} termos · ${br(c.volume)} buscas/mês${segs ? ` · segmentos: ${segs}` : ""}`);
  // Every term: curation happens on this list, and a second paid run just to see the tail costs money.
  for (const t of c.termos) console.log(`    ${t.volume === null ? "abaixo do mínimo reportado" : br(t.volume).padStart(7)}  ${t.termo}${t.segmento ? ` [${t.segmento}]` : ""}`);
}
console.log(`\n○ sem cluster · ${semCluster.length} termos (--mover "termo=semente" leva, --excluir "termo:motivo" tira)`);
for (const t of semCluster) console.log(`    ${br(t.volume ?? 0).padStart(7)}  ${t.termo}`);
for (const [t, m] of Object.entries(excluidos)) console.log(`✕ ${t} — ${m}`);

if (!gravar) {
  console.log("\nnada foi gravado. --gravar congela esta lista.");
  process.exit(0);
}

const semVolume = termos.filter((t) => t.volume === null).map((t) => t.termo);
const procedencia = { fonte: FONTE, congeladoEm: hoje, consultadoEm };
const inventario = {
  procedencia: {
    ...procedencia,
    janela: { inicio: hoje, fim: hoje },
    piso: PISO_VOLUME,
    dimensao: "volume Google Ads (DataForSEO keywords_for_keywords)",
    hosts: [host],
    excluiMarca: marca,
    excluidos,
    porque: `termos do nicho com volume ≥ ${PISO_VOLUME}/mês em ${regiao}, a partir das sementes ${sementes.join(", ")}`,
  },
  termos: comVolume.map((t) => t.termo),
};
// Valida ANTES de tocar o disco: lista vazia, duplicado ou marca dentro reprova aqui, não no deploy.
validarInventario(slug, inventario);
const demanda = {
  procedencia: { ...procedencia, inventarioCongeladoEm: hoje, regiao, idioma, custoUsd: custo, sementes: produtos, segmentos, movidos, excluidos, semVolume },
  termos: Object.fromEntries(comVolume.map((t) => [t.termo, t.volume])),
};
for (const [url, entrada] of [[INVENTARIO, inventario], [DEMANDA, demanda]]) {
  const arquivo = lerJson(url);
  arquivo[slug] = entrada;
  writeFileSync(url, JSON.stringify(arquivo, null, 2) + "\n");
  console.log(`gravado: ${url.pathname.split("/").slice(-2).join("/")} → ${slug}`);
}
