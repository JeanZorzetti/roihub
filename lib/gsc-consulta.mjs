// Consulta ao Search Console em node puro. `lib/gsc.ts` faz o mesmo para a aba, mas é .ts e não
// importa de script .mjs — a mesma razão que faz a lógica da busca morar em .mjs para ser servida
// pelo Next e medida pelo `node --test` sem transpilar.
import { GoogleAuth } from "google-auth-library";

// Melhor propriedade para o host: sc-domain exato > sc-domain de domínio-pai > URL-prefix.
export function melhorPropriedade(host, sites) {
  const nomes = new Set(sites.map((s) => s.siteUrl));
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const cand = "sc-domain:" + labels.slice(i).join(".");
    if (nomes.has(cand)) return cand;
  }
  return [...nomes].find((n) => n.startsWith(`https://${host}/`)) ?? null;
}

export const diasAtras = (n, agora = Date.now()) => new Date(agora - n * 864e5).toISOString().slice(0, 10);

/**
 * Janela de 28 dias terminando 3 dias atrás: o GSC fecha o dia com atraso, e incluir os últimos
 * 3 faria o mesmo gate cair sozinho a cada execução. É a janela do `lib/gsc.ts`.
 *
 * `dimensions: []` devolve o total do site. Com a dimensão `query` o GSC OMITE as raras, então
 * somar linhas de query dá um piso, não o total — 5 contra 33 no tapepro, medido em 31/07.
 */
// Cliente e lista de propriedades memoizados por processo — o `lib/gsc.ts` já faz isso
// (`clientPromise ??=` + `sitesCache`) e aqui não fazia: cada chamada assinava um JWT novo e
// repuxava a lista de sites. Custava 2 requisições desperdiçadas por host, e quem varre os 35
// pagava 70. Um script só roda minutos, então não há TTL: propriedade adicionada no Search
// Console aparece na próxima execução, que é o mesmo contrato de todo script desta pasta.
let clienteP;
let sitesP;
async function conectar() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("sem GOOGLE_SERVICE_ACCOUNT_JSON");
  clienteP ??= new GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }).getClient();
  const client = await clienteP;
  sitesP ??= client.request({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
  const sites = await sitesP;
  return { client, sites: (sites.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser") };
}

export async function consultarGsc(host, dimensions = ["query", "page", "country"]) {
  const { client, sites } = await conectar();
  const prop = melhorPropriedade(host, sites);
  if (!prop) throw new Error(`sem propriedade no GSC para ${host}`);
  const res = await client.request({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate: diasAtras(31),
      endDate: diasAtras(3),
      dimensions,
      rowLimit: 25000,
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
      ],
    },
  });
  return res.data.rows ?? [];
}
