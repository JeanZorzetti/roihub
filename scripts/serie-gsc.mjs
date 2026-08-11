// Série DIÁRIA de impressões/cliques de um host, para decidir se um projeto reagiu a um conserto.
//
//   node --env-file=.env scripts/serie-gsc.mjs <host> [inicio] [fim]
//
// Existe porque `decayNota` manda "reavaliar quando a série diária reagir": a janela de 28 dias
// do `lib/gsc.ts` responde "quanto" e nunca "a partir de que DIA", que é o que data a causa. No
// atma o corte apareceu no dia exato da reindexação (30/07 = 30 imp, 31/07 = 827).
//
// ⚠️ Os ~3 últimos dias saem BAIXOS porque o GSC ainda não os fechou, não porque caíram — daí o
// bloco final cortar em D-3. Ler o dia de ontem como queda é inventar regressão.
import { GoogleAuth } from "google-auth-library";
import { melhorPropriedade, diasAtras } from "../lib/gsc-consulta.mjs";

const [host, inicio = diasAtras(90), fim = diasAtras(0)] = process.argv.slice(2);
if (!host) throw new Error("uso: serie-gsc.mjs <host> [inicio] [fim]");

const client = await new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
}).getClient();

const sites = await client.request({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
const prop = melhorPropriedade(host, (sites.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser"));
if (!prop) throw new Error(`sem propriedade no GSC para ${host}`);

const res = await client.request({
  url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
  method: "POST",
  data: {
    startDate: inicio,
    endDate: fim,
    // `date` sozinho: com `query` junto o GSC omite as raras e o total vira piso (5 contra 33 no tapepro).
    dimensions: ["date"],
    rowLimit: 25000,
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] }],
  },
});

const linhas = (res.data.rows ?? []).map((r) => ({ dia: r.keys[0], imp: r.impressions, cli: r.clicks }));
console.log(`${host} · ${prop} · ${inicio} → ${fim}\n`);
for (const l of linhas) console.log(l.dia, String(l.imp).padStart(6), String(l.cli).padStart(5));

const fechado = diasAtras(3);
const completos = linhas.filter((l) => l.dia <= fechado);
const [imp, cli] = completos.reduce((a, l) => [a[0] + l.imp, a[1] + l.cli], [0, 0]);
console.log(
  `\n${completos.length} dias FECHADOS (até ${fechado}): ${imp} imp / ${cli} cli` +
    (completos.length ? ` · ${(imp / completos.length).toFixed(1)} imp/dia` : "") +
    (linhas.length > completos.length ? ` · ${linhas.length - completos.length} dia(s) recentes fora, o GSC não fechou` : ""),
);
