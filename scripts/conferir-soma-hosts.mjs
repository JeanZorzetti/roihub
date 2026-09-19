// 029 — a testemunha independente da série: o que o Google responde por HOST, e a soma.
//
//   node --env-file=.env scripts/conferir-soma-hosts.mjs <slug> [inicio] [fim] [--pagina | --consulta]
//
// A corrida grava a soma dos hosts declarados. Conferir isso lendo a própria corrida seria o
// instrumento se auditando: este script pergunta ao Search Console de novo, por fora, e imprime
// host a host ao lado do total gravado. Foi ele que mediu o defeito que originou a 029 — em
// 18/09/2026, 15/09 valia 1.146 impressões no domínio anterior e 31 no novo, e o banco tinha 35
// gravados para 16/09.
//
// Zero LLM, uma requisição por host. `serie-gsc.mjs` responde a mesma pergunta para UM host solto;
// aqui a unidade é o PROJETO, que é a unidade em que a série é gravada.
//
// 030 — sem flag a dimensão é `date` (a série). `--pagina` confere a leitura da FICHA (`gscPaginas`,
// dimensão `page`) e `--consulta` a do bloco de consultas da aba de aquisição (`gscConsultas`,
// `query`+`page`). Compare SEMPRE na dimensão da tela: `query`+`page` devolve 42% do total do site
// na Atma (o Search Console omite as consultas raras), e cotejá-la com a dimensão `page` acusaria
// um buraco que é da API e não da soma. Neste modo NADA passa por `mesclarPorCaminho` — o total
// por host vem da resposta do Google e as chaves em comum saem de um Set, porque a testemunha não
// pode ser o código que ela confere.
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { melhorPropriedade, diasAtras } from "../lib/gsc-consulta.mjs";
import { somarSeriesPorHost, assinaturaDeHosts } from "../lib/serie-gsc.mjs";
import { hostsDeclarados } from "../lib/projects.mjs";

const args = process.argv.slice(2);
const dimensions = args.includes("--consulta") ? ["query", "page"] : args.includes("--pagina") ? ["page"] : ["date"];
const [slug, inicio = diasAtras(30), fim = diasAtras(0)] = args.filter((a) => !a.startsWith("--"));
if (!slug) throw new Error("uso: conferir-soma-hosts.mjs <slug> [inicio] [fim] [--pagina | --consulta]");

const projetos = JSON.parse(readFileSync(new URL("../data/projects.json", import.meta.url), "utf8"));
const p = (Array.isArray(projetos) ? projetos : Object.values(projetos).flat()).find((x) => x?.slug === slug);
if (!p) throw new Error(`projeto ${slug} não está em data/projects.json`);

const hosts = hostsDeclarados(p);
if (!hosts.length) throw new Error(`${slug} não declara host nenhum`);

const client = await new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
}).getClient();
const sites = await client.request({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
const verificadas = (sites.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");

const series = [];
const porHostPagina = [];
for (const host of hosts) {
  const prop = melhorPropriedade(host, verificadas);
  if (!prop) {
    console.log(`⚠️  ${host} · sem propriedade no GSC — a corrida trata como ENCERRADO e segue`);
    continue;
  }
  const res = await client.request({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate: inicio,
      endDate: fim,
      // `date` sozinho: com `query` junto o GSC omite as raras e o total vira piso.
      dimensions,
      rowLimit: 25000,
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] }],
    },
  });
  console.log(`${host} · ${prop}`);
  if (dimensions[0] !== "date") {
    porHostPagina.push({ host, rows: res.data.rows ?? [] });
    continue;
  }
  series.push({
    host,
    days: (res.data.rows ?? []).map((r) => ({
      date: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
    })),
  });
}

if (dimensions[0] !== "date") {
  const chave = (keys) => {
    try {
      const u = new URL(keys.at(-1));
      return `${keys.length > 1 ? keys[0] : ""}\0${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  };
  const soma = (rows, campo) => rows.reduce((t, r) => t + r[campo], 0);
  const num = (n) => n.toLocaleString("pt-BR");
  console.log(`\n${dimensions.join("+")} · ${inicio} → ${fim}`);
  console.log("host".padEnd(24), "linhas".padStart(8), "impressões".padStart(12), "cliques".padStart(9));
  for (const { host, rows } of porHostPagina) {
    console.log(host.padEnd(24), num(rows.length).padStart(8), num(soma(rows, "impressions")).padStart(12), num(soma(rows, "clicks")).padStart(9));
  }
  const todas = porHostPagina.flatMap((h) => h.rows);
  console.log("TOTAL".padEnd(24), num(todas.length).padStart(8), num(soma(todas, "impressions")).padStart(12), num(soma(todas, "clicks")).padStart(9));
  const conjuntos = porHostPagina.map((h) => new Set(h.rows.map((r) => chave(r.keys)).filter(Boolean)));
  const uniao = new Set(conjuntos.flatMap((c) => [...c]));
  const emComum = [...uniao].filter((k) => conjuntos.filter((c) => c.has(k)).length > 1).length;
  console.log(`\nchaves distintas (a linha que a tela deve mostrar): ${num(uniao.size)} · presentes em mais de um host: ${num(emComum)}`);
  console.log("Sem a mescla, cada chave em comum apareceria uma vez por host — é a diferença entre `linhas` e as chaves distintas.");
  const truncou = porHostPagina.filter((h) => h.rows.length >= 25000).map((h) => h.host);
  if (truncou.length) console.log(`⚠️  bateu o teto de 25.000 linhas: ${truncou.join(", ")} — o total é piso`);
  process.exit(0);
}

const porHost = new Map(series.map((s) => [s.host, new Map(s.days.map((d) => [d.date, d]))]));
const soma = somarSeriesPorHost(series);

console.log(`\nassinatura esperada: ${assinaturaDeHosts(series.map((s) => s.host))}`);
console.log(`\ndia         ${series.map((s) => s.host.slice(0, 14).padStart(15)).join("")}            soma`);
for (const d of soma) {
  const colunas = series.map((s) => String(porHost.get(s.host).get(d.date)?.impressions ?? 0).padStart(15)).join("");
  console.log(d.date, colunas, String(d.impressions).padStart(15));
}

const total = soma.reduce((a, d) => a + d.impressions, 0);
console.log(`\n${soma.length} dia(s) · ${total} impressões somadas · ${inicio} → ${fim}`);
console.log("Os ~3 últimos dias saem baixos porque o GSC não os fechou — não são queda.");
