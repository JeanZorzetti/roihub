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
// `null` é fato real (env desligada ou host fora de toda propriedade — D1, conserto é domínio).
// `{erro}` é falha transitória (timeout, credencial) — mesmo padrão de `LeituraGa4` em lib/ga4.ts.
// Não colapsar os dois em `null`: um dá "sem propriedade no GSC", o outro mudava de resposta a
// cada release (design-review de 03/09 — duas leituras da mesma URL, 15 min de diferença).
export type GscSeries = { property: string; days: GscDay[] } | { erro: string } | null;

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
      // 2000 e não 500 desde a 021: o backfill da série pede os 16 meses que o GSC guarda
      // (~487 linhas, uma por dia) e 500 deixava 13 de folga. Um teto que quase encosta trunca
      // sem erro — a série nasceria curta e ninguém veria.
      rowLimit: 2000,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: r.position,
  }));
}

// Teto de linhas por requisição da API. Constante nomeada desde a 021 porque `gscConsultas`
// precisa COMPARAR contra ele para saber se o resultado veio cortado: um `25000` repetido em dois
// lugares sairia de sincronia no dia em que um deles mudasse, e o sintoma seria um `truncado`
// que nunca dispara.
const TETO_LINHAS = 25000;

// Exportada desde a 021: aquela feature precisa de UMA janela — a de `descoberta()` — e não do
// par que `gscQueryPages` monta. Chamar `gscQueryPages` ali traria a janela hardcoded em D-31
// (contra D-30 da descoberta) e uma segunda requisição para a janela anterior, que nenhum dos
// KPIs de busca usa: um dia de divergência entre o total de cima da aba e a lista de baixo,
// pago em rede dobrada.
export async function queryPageWindow(
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
type GscStrictOptions = GscClientOptions & {
  strict?: boolean;
  sleep?: (ms: number) => Promise<unknown>;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function gscConnection(siteUrl: string, clientOverride?: RequestClient) {
  const clientP = clientOverride ? Promise.resolve(clientOverride) : getClient();
  if (!clientP) return null;
  const client = await clientP;
  const host = new URL(siteUrl).hostname;
  const property = resolveProperty(host, await listSites(client));
  return property ? { client, host, property } : null;
}

// strict: pro autopublishing, GSC indisponível NÃO pode virar [] — sem linhas toda pauta
// vira "new" e o robô duplica URL já ranqueada. 3 tentativas e falha fechado.
// Janelas em série: na falha a segunda chamada não é gasta.
export async function gscQueryPages(siteUrl: string, options: GscStrictOptions = {}) {
  const { strict = false, sleep = wait } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      const connection = await gscConnection(siteUrl, options.client);
      if (!connection) return [];
      const now = options.now?.getTime() ?? Date.now();
      const { client, host, property } = connection;
      const current = await queryPageWindow(client, property, host, isoDaysAgo(31, now), isoDaysAgo(3, now));
      const previous = await queryPageWindow(client, property, host, isoDaysAgo(59, now), isoDaysAgo(32, now));
      return mergeGscWindows(current, previous);
    } catch {
      if (!strict) return [];
      if (attempt === 2) throw new Error("gsc-unavailable");
      await sleep(250 * 2 ** attempt);
    }
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
//
// 019/FR-025: `inicio`/`fim` entraram como parâmetros OPCIONAIS, com o default byte a byte o de
// sempre — é ele que alimenta o portfólio inteiro, e trocá-lo moveria a célula `visitante` dos 17
// projetos (SC-007). Um segundo `gscSerieLonga()` duplicaria autenticação, `resolveProperty` e
// tratamento de erro só para trocar duas datas; `/okr/[slug]/aquisicao` passa a janela de 8 meses
// aqui. `totals28()` continua fatiando 28 dias e não é tocada.
export async function gscSeries(
  siteUrl: string,
  inicio: string = isoDaysAgo(86),
  fim: string = isoDaysAgo(3),
): Promise<GscSeries> {
  const clientP = getClient();
  if (!clientP) return null; // env desligada — fato real, sem tentar rede
  try {
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null; // host fora de toda propriedade — fato real (D1)
    return { property, days: await queryTimeseries(client, property, host, inicio, fim) };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/** O corte de consulta de uma perna da 025. Ausente = a perna do TOTAL do país. */
export type CorteDeConsulta = { modo: "inclui" | "exclui"; padrao: string };

/**
 * 025 — a série diária com corte de PAÍS e filtro de consulta opcional. As três pernas de
 * marca/não-marca saem daqui, todas na mesma corrida e na mesma janela (D13).
 *
 * Função nova em vez de mais dois parâmetros em `gscSeries()`: aquela alimenta o portfólio inteiro
 * (a célula `visitante` dos 17 projetos), e um parâmetro a mais numa função com dois defaults
 * posicionais é o tipo de mudança que move números de outra feature sem ninguém pedir.
 *
 * O corte de país vale para as TRÊS pernas (D2). Com o total sem corte a soma jamais fecharia, e a
 * diferença mediria o próprio corte em vez da anonimização — que é o que se quer saber.
 *
 * Mesmo contrato de erro da 021, e não colapsar os dois: `null` é ausência estrutural (env
 * desligada ou host fora de toda propriedade, conserto é domínio) e `{erro}` é falha transitória.
 */
export async function gscSerieFiltrada(
  siteUrl: string,
  pais: string,
  janela: { inicio: string; fim: string },
  corte?: CorteDeConsulta,
): Promise<GscSeries> {
  const clientP = getClient();
  if (!clientP) return null;
  try {
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null;
    const filters: { dimension: string; operator: string; expression: string }[] = [
      { dimension: "page", operator: "contains", expression: `https://${host}/` },
      { dimension: "country", operator: "equals", expression: pais },
    ];
    // `(?i)` prefixado aqui e não gravado no padrão: o RE2 do Search Console não aceita flags
    // externas, e a tela precisa do mesmo padrão SEM elas para o `new RegExp(padrao, "i")` da D3.
    if (corte)
      filters.push({
        dimension: "query",
        operator: corte.modo === "inclui" ? "includingRegex" : "excludingRegex",
        expression: `(?i)${corte.padrao}`,
      });
    const res = await client.request<{
      rows?: { keys: string[]; clicks: number; impressions: number; position: number }[];
    }>({
      url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      method: "POST",
      data: {
        startDate: janela.inicio,
        endDate: janela.fim,
        dimensions: ["date"],
        dimensionFilterGroups: [{ filters }],
        // 2000 pelo mesmo motivo da `queryTimeseries`: a janela de marca pede os 480 dias que o
        // GSC guarda, e um teto que quase encosta trunca sem erro — a perna nasceria curta e a
        // conferência acusaria um resíduo que é do teto, não da anonimização.
        rowLimit: 2000,
      },
    });
    return {
      property,
      days: (res.data.rows ?? []).map((r) => ({
        date: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        position: r.position,
      })),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
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

export type GscPaginas =
  | { paginas: { pagina: string; impressoes: number; cliques: number; posicao: number }[] }
  | { erro: string }
  | null;

/**
 * Impressões por PÁGINA na janela — a base da camada de entrega da 016 (`páginas necessárias =
 * impressões que faltam ÷ média por página`).
 *
 * Função nova em vez de dimensão extra em `gscSeries()` (016, D6): aquela devolve série diária e é
 * consumida por meia dúzia de lugares; trocar a forma do retorno mexeria em todos eles para servir
 * um consumidor só. Mesma autenticação, mesmo filtro de host, mesma janela declarada (R7).
 *
 * `null` é "não há onde olhar" (env desligada ou host fora de toda propriedade) e `{erro}` é falha
 * transitória — a mesma distinção que `gscSeries()` faz, e pelo mesmo motivo: colapsar as duas faz
 * "sem propriedade" mentir quando era só timeout.
 */
export async function gscPaginas(siteUrl: string, janela: { inicio: string; fim: string }): Promise<GscPaginas> {
  const clientP = getClient();
  if (!clientP) return null;
  try {
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null;
    const res = await client.request<{
      rows?: { keys: string[]; clicks: number; impressions: number; position: number }[];
    }>({
      url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      method: "POST",
      data: {
        startDate: janela.inicio,
        endDate: janela.fim,
        dimensions: ["page"],
        dimensionFilterGroups: [
          { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
        ],
        rowLimit: 1000,
      },
    });
    return {
      paginas: (res.data.rows ?? []).map((r) => ({
        pagina: r.keys[0],
        impressoes: r.impressions,
        cliques: r.clicks,
        posicao: r.position,
      })),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/** Uma linha de `query`+`page` da janela, com os nomes do domínio em vez de `keys[0]`/`keys[1]`. */
export type LinhaBusca = { query: string; page: string; cliques: number; impressoes: number; posicao: number };
export type GscConsultas = { linhas: LinhaBusca[]; truncado: boolean } | { erro: string } | null;

/**
 * As consultas da janela, para os KPIs de busca da 021.
 *
 * UMA chamada, com a janela que o chamador passa — `descoberta()`, no caso da aba de aquisição.
 * `gscQueryPages` não serve aqui: a janela dela é fixa em D-31→D-3 (um dia mais larga que a
 * descoberta, o que faria a lista não fechar com o total exibido acima dela) e ela gasta uma
 * segunda requisição na janela anterior, que nenhum KPI desta feature lê.
 *
 * `truncado` existe porque `TETO_LINHAS` é um corte silencioso da API: sem o sinal, um projeto
 * grande exibiria o teto como se fosse o fim dos dados (FR-011).
 *
 * `null` = não há onde olhar (env desligada ou host fora de toda propriedade); `{erro}` = falha
 * transitória. Mesma distinção de `gscSeries()` e `gscPaginas()`, e pelo mesmo motivo.
 */
export async function gscConsultas(
  siteUrl: string,
  janela: { inicio: string; fim: string },
  options: GscClientOptions = {},
): Promise<GscConsultas> {
  const clientP = options.client ? Promise.resolve(options.client) : getClient();
  if (!clientP) return null;
  try {
    const client = await clientP;
    const host = new URL(siteUrl).hostname;
    const property = resolveProperty(host, await listSites(client));
    if (!property) return null;
    const rows = await queryPageWindow(client, property, host, janela.inicio, janela.fim);
    // `query` ou `page` vazio não é linha de busca — mesma guarda de `mergeGscWindows`.
    const linhas = rows
      .filter((r) => r.keys[0] && r.keys[1])
      .map((r) => ({
        query: r.keys[0],
        page: r.keys[1],
        cliques: r.clicks,
        impressoes: r.impressions,
        posicao: r.position,
      }));
    return { linhas, truncado: rows.length >= TETO_LINHAS };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}
