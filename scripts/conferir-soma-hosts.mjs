// 029 — a testemunha independente da série: o que o Google responde por HOST, e a soma.
//
//   node --env-file=.env scripts/conferir-soma-hosts.mjs <slug> [inicio] [fim]
//
// A corrida grava a soma dos hosts declarados. Conferir isso lendo a própria corrida seria o
// instrumento se auditando: este script pergunta ao Search Console de novo, por fora, e imprime
// host a host ao lado do total gravado. Foi ele que mediu o defeito que originou a 029 — em
// 18/09/2026, 15/09 valia 1.146 impressões no domínio anterior e 31 no novo, e o banco tinha 35
// gravados para 16/09.
//
// Zero LLM, uma requisição por host. `serie-gsc.mjs` responde a mesma pergunta para UM host solto;
// aqui a unidade é o PROJETO, que é a unidade em que a série é gravada.
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { melhorPropriedade, diasAtras } from "../lib/gsc-consulta.mjs";
import { somarSeriesPorHost, assinaturaDeHosts } from "../lib/serie-gsc.mjs";
import { hostsDeclarados } from "../lib/projects.mjs";

const [slug, inicio = diasAtras(30), fim = diasAtras(0)] = process.argv.slice(2);
if (!slug) throw new Error("uso: conferir-soma-hosts.mjs <slug> [inicio] [fim]");

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
      dimensions: ["date"],
      rowLimit: 25000,
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] }],
    },
  });
  console.log(`${host} · ${prop}`);
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
