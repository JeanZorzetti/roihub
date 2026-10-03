/**
 * Consulta o volume de busca do nicho de um projeto e congela a demanda (057).
 *
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro                       # saldo e custo, não gasta
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro --consultar           # gasta 1 tarefa, não grava
 *   node --env-file=.env scripts/consultar-demanda.mjs tapepro --consultar --gravar  # gasta e grava os dois JSON
 *   node scripts/consultar-demanda.mjs tapepro --de docs/demanda/<arquivo>.json [--gravar]  # recura a consulta salva, sem gastar
 *
 * Opções: --sementes "a,b" (padrão: `produtos` do projeto em lib/autopublish-projects.mjs),
 * --regiao "Brazil" (padrão: do idioma do projeto), --marca "a,b" (termos de marca além do slug e da
 * marca do card), --mover "termo=semente" e --excluir "termo:motivo", repetíveis, ou --curadoria arquivo.json
 * com {excluir: {termo: motivo}, mover: {termo: semente}} quando a lista não cabe na linha de comando.
 *
 * Projeto sem autopublishing (agência, institucional) não está em lib/autopublish-projects.mjs: o card
 * de data/projects.json dá o host e a marca, e --sementes e --idioma "pt-BR" passam a ser obrigatórios.
 *
 * Toda consulta paga grava a resposta inteira em docs/demanda/ antes de qualquer curadoria (regra do
 * dono, 30/09/2026: gasto no DataForSEO é sempre salvo). Curar é rodar de novo com --de: sementes e
 * idioma vêm do arquivo, e só --mover, --excluir, --marca e --piso mudam o resultado.
 *
 * --de é repetível: negócio local tem demanda em dois recortes (o termo genérico buscado DA cidade e o
 * termo com a cidade no texto, buscado do país), e cada recorte é uma consulta. O mesmo termo em duas
 * regiões diferentes reprova: escolher o maior misturaria os recortes em silêncio.
 *
 * --piso N sobe o volume mínimo (padrão 10). Em recorte de cidade, 10 é o menor balde que o Google Ads
 * reporta: na Procura (Goiânia, 01/10/2026) 819 dos 860 termos estavam nele.
 *
 * O volume vem do Google Ads pela DataForSEO (`keywords_for_keywords/live`): sementes entram, termos
 * relacionados com volume mensal saem. A chave mora só na máquina de quem roda: produção não recebe
 * credencial paga que não usa (research D3). Abrir o plano ou o mapa nunca consulta (SC-005).
 *
 * SEM `--gravar` nada é escrito. Trocar o denominador de um KPI não pode ser efeito colateral de olhar
 * um número — a mesma regra de `derivar-inventario.mjs` e `estimar-demanda.mjs`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { projectBySlug } from "../lib/autopublish-projects.mjs";
import { motivoForaDoCatalogo, validarInventario } from "../lib/inventario.mjs";
import { regexDeMarca } from "../lib/marca.mjs";
import { PISO_VOLUME, agrupar, normalizar } from "../lib/plano.mjs";

const API = "https://api.dataforseo.com/v3";
const FONTE = "dataforseo google_ads keywords_for_keywords";
const INVENTARIO = new URL("../data/inventario-de-termos.json", import.meta.url);
const DEMANDA = new URL("../data/demanda-estimada.json", import.meta.url);
const PROJETOS = new URL("../data/projects.json", import.meta.url);
const BRUTA = new URL("../docs/demanda/", import.meta.url);
const REGIAO_DO_IDIOMA = { "pt-BR": "Brazil", "en-US": "United States" };
const MAX_SEMENTES = 20; // limite da API por tarefa

const args = process.argv.slice(2);
const opcao = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const repetida = (nome) => args.flatMap((a, i) => (a === nome && args[i + 1] !== undefined ? [args[i + 1]] : []));
const COM_VALOR = new Set(["--sementes", "--regiao", "--idioma", "--marca", "--mover", "--excluir", "--curadoria", "--de", "--piso"]);
const slug = args.find((a, i) => !a.startsWith("--") && !COM_VALOR.has(args[i - 1]));
const consultar = args.includes("--consultar");
const gravar = args.includes("--gravar");
const de = repetida("--de");
const piso = Number(opcao("--piso") ?? PISO_VOLUME);
const sair = (codigo, msg) => {
  console.error(msg);
  process.exit(codigo);
};

if (!slug) sair(2, 'uso: node --env-file=.env scripts/consultar-demanda.mjs <slug> [--sementes "a,b"] [--regiao Brazil] [--idioma pt-BR] [--marca "a,b"] [--piso 10] [--consultar | --de arquivo...] [--gravar] [--mover "termo=semente"]... [--excluir "termo:motivo"]...');
// Princípio V: o nome da variável, nunca o valor.
const chave = process.env.DATAFORSEO_API_KEY?.trim();
if (!chave && !de.length) sair(2, "DATAFORSEO_API_KEY ausente no ambiente");
if (de.length && consultar) sair(2, "--de relê uma consulta salva e --consultar faz uma nova: use um dos dois");
if (de.length && (opcao("--sementes") || opcao("--regiao") || opcao("--idioma"))) sair(2, "--de usa as sementes, a região e o idioma da consulta salva: outra semente é outra consulta");
if (gravar && !consultar && !de.length) sair(2, "--gravar exige --consultar ou --de: não há o que gravar sem consulta");
if (!Number.isInteger(piso) || piso < PISO_VOLUME) sair(2, `--piso tem de ser inteiro ≥ ${PISO_VOLUME}`);

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

const card = lerJson(PROJETOS).find((p) => p.slug === slug);
const projeto = projectBySlug(slug) ?? (card?.url ? { siteUrl: card.url } : null);
if (!projeto) sair(1, `${slug} não está em lib/autopublish-projects.mjs nem tem card com url em data/projects.json`);
const salvas = de.map((arquivo) => ({ arquivo, ...lerJson(pathToFileURL(resolve(arquivo))) }));
for (const s of salvas) {
  const p = s.procedencia;
  if (p?.projeto !== slug) sair(1, `${s.arquivo} é a consulta de "${p?.projeto}", não de ${slug}`);
  if (!Array.isArray(s.resultado) || typeof p.custoUsd !== "number" || !p.consultadoEm || !p.regiao) sair(1, `${s.arquivo} não é uma consulta salva por este script`);
}
// As sementes agrupam os clusters: valem as da primeira consulta salva que as declara.
const salva = salvas.find((s) => s.procedencia.sementes?.length) ?? salvas[0] ?? null;
const lista = (s) => String(s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const produtos = salva?.procedencia.sementes ?? (opcao("--sementes") ? lista(opcao("--sementes")) : (projeto.produtos ?? []));
const segmentos = projeto.segmentos ?? [];
if (!produtos.length) sair(1, `${slug} não declara produtos: passe --sementes "a,b"`);
if (produtos.length > MAX_SEMENTES) sair(1, `${produtos.length} sementes: a API aceita até ${MAX_SEMENTES} por tarefa`);
const sementes = produtos.map((p) => p.replaceAll("-", " "));
const lingua = opcao("--idioma") ?? projeto.language;
if (!lingua && !salva) sair(1, `${slug} não tem autopublishing que declare o idioma: passe --idioma (ex.: pt-BR)`);
const regiao = salvas.length ? [...new Set(salvas.map((s) => s.procedencia.regiao))].join(" + ") : (opcao("--regiao") ?? REGIAO_DO_IDIOMA[lingua]);
if (!regiao) sair(1, `sem região para o idioma ${lingua}: passe --regiao`);
const idioma = salva?.procedencia.idioma ?? String(lingua).slice(0, 2);
const host = new URL(projeto.siteUrl).hostname;
const marca = [...new Set([slug, ...(card?.marca?.termos ?? []), ...lista(opcao("--marca"))])];
const foraDoCatalogo = projeto.foraDoCatalogo ?? {};

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
console.log(`projeto: ${slug} (${host})`);
console.log(`sementes (${sementes.length}): ${sementes.join(", ")}`);
console.log(`segmentos (marcadores, não sementes): ${segmentos.join(", ") || "nenhum"}`);
console.log(`região: ${regiao} · idioma: ${idioma}${salva || opcao("--regiao") ? "" : ` (do idioma ${lingua} do projeto; --regiao troca)`}`);

let resultado, custo, consultadoEm;
// What was bought, per consult: the frozen entry names each file, its region, date and cost.
let consultas = null;
if (salvas.length) {
  const regiaoDe = new Map();
  for (const s of salvas) {
    for (const r of s.resultado) {
      const t = String(r.keyword ?? "").trim().toLowerCase();
      if (regiaoDe.has(t) && regiaoDe.get(t) !== s.procedencia.regiao) sair(1, `«${t}» veio em duas regiões (${regiaoDe.get(t)} e ${s.procedencia.regiao}): os recortes não se misturam`);
      regiaoDe.set(t, s.procedencia.regiao);
    }
  }
  resultado = salvas.flatMap((s) => s.resultado);
  custo = Number(salvas.reduce((a, s) => a + s.procedencia.custoUsd, 0).toFixed(4));
  consultadoEm = salvas.map((s) => s.procedencia.consultadoEm).sort().at(-1);
  consultas = salvas.map(({ arquivo, procedencia: p }) => ({ arquivo: arquivo.replaceAll("\\", "/"), fonte: p.fonte, regiao: p.regiao, consultadoEm: p.consultadoEm, custoUsd: p.custoUsd, ...(p.objetivo ? { objetivo: p.objetivo } : {}) }));
  for (const c of consultas) console.log(`consulta salva: ${c.arquivo} · ${c.regiao} · ${c.consultadoEm.slice(0, 10)} · ${usd(c.custoUsd)}`);
  console.log("nada é gasto de novo");
} else {
  const dados = (await api("/appendix/user_data")).result?.[0];
  const saldo = dados?.money?.balance;
  const estimado = dados?.price?.keywords_data?.google_ads?.keywords_for_keywords?.live?.priority_normal?.[0]?.cost;
  if (typeof saldo !== "number" || typeof estimado !== "number") sair(1, "DataForSEO não devolveu saldo ou preço em /appendix/user_data");
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
  resultado = tarefa.result;
  custo = tarefa.cost;
  consultadoEm = new Date().toISOString();
  // A resposta paga vai para o disco ANTES da curadoria: em 30/09/2026 uma consulta só para olhar
  // (Estetia, US$ 0,09) ficou no terminal e se perdeu com a sessão.
  mkdirSync(BRUTA, { recursive: true });
  const bruta = new URL(`dataforseo-${slug}-${consultadoEm.slice(0, 19).replaceAll(":", "")}.json`, BRUTA);
  writeFileSync(bruta, JSON.stringify({ procedencia: { fonte: FONTE, projeto: slug, consultadoEm, regiao, idioma, sementes: produtos, custoUsd: custo }, resultado }) + "\n");
  console.log(`resposta salva: docs/demanda/${bruta.pathname.split("/").pop()} (--de <arquivo> recura sem gastar)`);
}
// Congelar é hoje; a janela é o dia da consulta, que com --de pode ser anterior.
const hoje = new Date().toISOString().slice(0, 10);
const diaDaConsulta = consultadoEm.slice(0, 10);

// Um termo por palavra-chave, pelo maior volume se vier repetido.
const porTermo = new Map();
for (const r of resultado) {
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
// --curadoria arquivo.json ({excluir: {termo: motivo}, mover: {termo: semente}}): hundreds of
// --excluir with their reasons overflow the Windows command line (32k chars, nimblabs 03/10/2026).
const curadoria = opcao("--curadoria") ? lerJson(pathToFileURL(resolve(opcao("--curadoria")))) : {};
const excluir = Object.fromEntries([
  ...Object.entries(curadoria.excluir ?? {}),
  ...repetida("--excluir").map((e) => {
    const i = e.indexOf(":");
    if (i <= 0) sair(2, `--excluir "${e}": use "termo:motivo"`);
    return [e.slice(0, i), e.slice(i + 1)];
  }),
].map(([t, m]) => [t.trim().toLowerCase(), m.trim()]));
const movidos = Object.fromEntries(
  [...Object.entries(curadoria.mover ?? {}), ...repetida("--mover").map((m) => m.split("="))].map(([t, s]) => {
    const [termo, semente] = [t, s].map((x) => String(x ?? "").trim());
    if (!termo || !produtos.includes(semente)) sair(2, `mover "${t}=${s}": a semente tem de ser uma de ${produtos.join(", ")}`);
    return [termo.toLowerCase(), semente];
  }),
);
const excluidos = {};
const termos = [];
for (const [termo, volume] of porTermo) {
  const motivo = motivoForaDoCatalogo(termo, foraDoCatalogo);
  if (reMarca.test(termo)) quedas.marca++;
  else if (motivo) excluidos[termo] = motivo;
  else if (Object.hasOwn(excluir, termo)) excluidos[termo] = excluir[termo];
  else if (volume === null && !ehSemente.has(normalizar(termo))) quedas.semVolume++;
  else if (volume !== null && volume < piso) quedas.piso++;
  else termos.push({ termo, volume });
}
for (const t of Object.keys(excluir)) if (!Object.hasOwn(excluidos, t)) console.warn(`aviso: --excluir "${t}" não está na resposta`);
for (const t of Object.keys(movidos)) if (!termos.some((x) => x.termo === t)) console.warn(`aviso: --mover "${t}" não está entre os termos mantidos`);

const { clusters, semCluster } = agrupar(termos, { produtos, segmentos, movidos });
const br = (n) => n.toLocaleString("pt-BR");
const comVolume = termos.filter((t) => typeof t.volume === "number");
console.log(`\ncusto real: ${usd(custo)} · ${br(porTermo.size)} termos devolvidos`);
console.log(`mantidos: ${br(termos.length)} · fora: ${quedas.marca} de marca, ${quedas.piso} abaixo de ${piso}/mês, ${quedas.semVolume} sem volume, ${Object.keys(excluidos).length} excluídos (catálogo do projeto ou --excluir)`);
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
const procedencia = { fonte: FONTE, congeladoEm: hoje, consultadoEm, ...(consultas ? { consultas } : {}) };
const inventario = {
  procedencia: {
    ...procedencia,
    janela: { inicio: diaDaConsulta, fim: diaDaConsulta },
    piso,
    dimensao: "volume Google Ads (DataForSEO keywords_for_keywords)",
    hosts: [host],
    excluiMarca: marca,
    foraDoCatalogo,
    excluidos,
    porque: `termos do nicho com volume ≥ ${piso}/mês em ${regiao}, a partir das sementes ${sementes.join(", ")}`,
  },
  termos: comVolume.map((t) => t.termo),
};
// Valida ANTES de tocar o disco: lista vazia, duplicado ou marca dentro reprova aqui, não no deploy.
validarInventario(slug, inventario);
const demanda = {
  procedencia: { ...procedencia, inventarioCongeladoEm: hoje, regiao, idioma, custoUsd: custo, piso, sementes: produtos, segmentos, movidos, foraDoCatalogo, excluidos, semVolume },
  termos: Object.fromEntries(comVolume.map((t) => [t.termo, t.volume])),
};
for (const [url, entrada] of [[INVENTARIO, inventario], [DEMANDA, demanda]]) {
  const arquivo = lerJson(url);
  arquivo[slug] = entrada;
  writeFileSync(url, JSON.stringify(arquivo, null, 2) + "\n");
  console.log(`gravado: ${url.pathname.split("/").slice(-2).join("/")} → ${slug}`);
}
