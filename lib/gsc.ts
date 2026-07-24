import { GoogleAuth } from "google-auth-library";

export type GscTrend = { current: number; previous: number; property: string } | null;

type Site = { siteUrl: string; permissionLevel: string };
type Client = Awaited<ReturnType<GoogleAuth["getClient"]>>;
type RequestClient = Pick<Client, "request">;
type GscPageRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  position: number;
};
type GscPageMetrics = { clicks: number; impressions: number; position: number };

export function mergeGscWindows(current: GscPageRow[], previous: GscPageRow[]) {
  const keyed = new Map<string, { query: string; page: string; current: GscPageMetrics | null; previous: GscPageMetrics | null }>();
  for (const [window, rows] of [["current", current], ["previous", previous]] as const) {
    for (const { keys: [query, page], clicks, impressions, position } of rows) {
      if (!query || !page) continue;
      const key = `${query}\0${page}`;
      const entry = keyed.get(key) ?? { query, page, current: null, previous: null };
      entry[window] = { clicks, impressions, position };
      keyed.set(key, entry);
    }
  }
  return [...keyed.values()];
}

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
async function listSites(client: RequestClient): Promise<Site[]> {
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

export function isoDaysAgo(n: number, now = Date.now()): string {
  return new Date(now - n * 864e5).toISOString().slice(0, 10);
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

export type GscDay = { date: string; clicks: number; impressions: number; position: number };
export type GscSeries = { property: string; days: GscDay[] } | null;

// Mesmo endpoint do queryClicks, só acrescenta dimensions:["date"] → série diária.
async function queryTimeseries(
  client: Client,
  property: string,
  host: string,
  startDate: string,
  endDate: string
): Promise<GscDay[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property
  )}/searchAnalytics/query`;
  const res = await client.request<{
    rows?: { keys: string[]; clicks: number; impressions: number; position: number }[];
  }>({
    url,
    method: "POST",
    data: {
      startDate,
      endDate,
      dimensions: ["date"],
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
      ],
      rowLimit: 500,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
  }));
}

async function queryPageWindow(
  client: RequestClient,
  property: string,
  host: string,
  startDate: string,
  endDate: string
): Promise<GscPageRow[]> {
  const res = await client.request<{ rows?: GscPageRow[] }>({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      property
    )}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate,
      endDate,
      dimensions: ["query", "page"],
      rowLimit: 25000,
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
      ],
    },
  });
  return res.data.rows ?? [];
}

type GscClientOptions = { client?: RequestClient; now?: Date };

async function gscConnection(siteUrl: string, clientOverride?: RequestClient) {
  const clientP = clientOverride ? Promise.resolve(clientOverride) : getClient();
  if (!clientP) return null;
  const client = await clientP;
  const host = new URL(siteUrl).hostname;
  const property = resolveProperty(host, await listSites(client));
  return property ? { client, host, property } : null;
}

export async function gscQueryPages(siteUrl: string, options: GscClientOptions = {}) {
  try {
    const connection = await gscConnection(siteUrl, options.client);
    if (!connection) return [];
    const now = options.now?.getTime() ?? Date.now();
    const { client, host, property } = connection;
    const [current, previous] = await Promise.all([
      queryPageWindow(client, property, host, isoDaysAgo(31, now), isoDaysAgo(3, now)),
      queryPageWindow(client, property, host, isoDaysAgo(59, now), isoDaysAgo(32, now)),
    ]);
    return mergeGscWindows(current, previous);
  } catch {
    return [];
  }
}

export async function inspectUrl(
  siteUrl: string,
  inspectedUrl: string,
  options: GscClientOptions = {}
) {
  try {
    const connection = await gscConnection(siteUrl, options.client);
    if (!connection) return null;
    const res = await connection.client.request<{
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          robotsTxtState?: string;
          indexingState?: string;
          lastCrawlTime?: string;
        };
      };
    }>({
      url: "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
      method: "POST",
      data: { inspectionUrl: inspectedUrl, siteUrl: connection.property },
    });
    const result = res.data.inspectionResult?.indexStatusResult;
    if (!result) return null;
    const { verdict, coverageState, robotsTxtState, indexingState, lastCrawlTime } = result;
    return { verdict, coverageState, robotsTxtState, indexingState, lastCrawlTime };
  } catch {
    return null;
  }
}

// Série diária dos últimos 84 dias (12 semanas fechando em D-3, GSC atrasa).
// Qualquer falha → null e a aba SEO mostra o estado vazio (SEED).
export async function gscSeries(siteUrl: string): Promise<GscSeries> {
  try {
    const clientP = getClient();
    if (!clientP) return null;
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null;
    return { property, days: await queryTimeseries(client, property, host, isoDaysAgo(86), isoDaysAgo(3)) };
  } catch {
    return null;
  }
}

export type GscStatus =
  | { state: "off" }
  | { state: "error"; message: string }
  | { state: "ok"; properties: string[] };

// Estado da conexão GSC pro rodapé — distingue "env ausente" de "env quebrada",
// senão tudo vira SEED silencioso e o deploy fica impossível de diagnosticar.
export async function gscStatus(): Promise<GscStatus> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) return { state: "off" };
  try {
    // getClient() faz JSON.parse síncrono — precisa estar DENTRO do try:
    // env malformada deve virar state error, nunca derrubar a página.
    const client = await getClient()!;
    const sites = await listSites(client);
    return { state: "ok", properties: sites.map((s) => s.siteUrl) };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message.slice(0, 200) : String(e) };
  }
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
