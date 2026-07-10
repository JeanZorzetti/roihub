import { GoogleAuth } from "google-auth-library";

export type GscTrend = { current: number; previous: number; property: string } | null;

type Site = { siteUrl: string; permissionLevel: string };
type Client = Awaited<ReturnType<GoogleAuth["getClient"]>>;

let clientPromise: Promise<Client> | null = null;
let sitesCache: { at: number; sites: Site[] } | null = null;

function getClient(): Promise<Client> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  clientPromise ??= new GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }).getClient();
  return clientPromise;
}

// TTL 10 min: propriedade adicionada no Search Console aparece sem redeploy.
async function listSites(client: Client): Promise<Site[]> {
  if (sitesCache && Date.now() - sitesCache.at < 600_000) return sitesCache.sites;
  const res = await client.request<{ siteEntry?: Site[] }>({
    url: "https://searchconsole.googleapis.com/webmasters/v3/sites",
  });
  const sites = (res.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
  sitesCache = { at: Date.now(), sites };
  return sites;
}

// Melhor propriedade pro host: sc-domain exato > sc-domain de domínio-pai > URL-prefix.
function resolveProperty(host: string, sites: Site[]): string | null {
  const names = new Set(sites.map((s) => s.siteUrl));
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const candidate = "sc-domain:" + labels.slice(i).join(".");
    if (names.has(candidate)) return candidate;
  }
  return [...names].find((n) => n.startsWith(`https://${host}/`)) ?? null;
}

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

async function queryClicks(
  client: Client,
  property: string,
  host: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property
  )}/searchAnalytics/query`;
  const res = await client.request<{ rows?: { clicks: number }[] }>({
    url,
    method: "POST",
    data: {
      startDate,
      endDate,
      // filtro por host isola o projeto quando a propriedade cobre outros subdomínios
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
      ],
    },
  });
  return res.data.rows?.[0]?.clicks ?? 0;
}

// Cliques dos últimos 28d (fechando 3 dias atrás, GSC atrasa) vs os 28d anteriores.
// Qualquer falha (env ausente, sem propriedade, quota) → null e o hub usa o seoSeed.
export async function gscTrend(siteUrl: string): Promise<GscTrend> {
  try {
    const clientP = getClient();
    if (!clientP) return null;
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null;
    const [current, previous] = await Promise.all([
      queryClicks(client, property, host, isoDaysAgo(31), isoDaysAgo(3)),
      queryClicks(client, property, host, isoDaysAgo(59), isoDaysAgo(32)),
    ]);
    return { current, previous, property };
  } catch {
    return null;
  }
}
