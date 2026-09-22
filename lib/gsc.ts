import { GoogleAuth } from "google-auth-library";
import { mesclarPorCaminho, mesclarPorTermo, motivoDaFalha } from "./gsc-hosts.mjs";
import { somarSeriesPorHost } from "./serie-gsc.mjs";

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
type Janela = { inicio: string; fim: string };

/** O que UM host devolveu, antes da soma (030, E3). `host` é o declarado no card, e não a
 *  propriedade: `sc-domain:` cobre o domínio inteiro, e `propriedade` só serve de diagnóstico. */
export type RespostaPorHost = { host: string; propriedade: string; rows: GscPageRow[]; truncado: boolean };
type LinhaSomada = ReturnType<typeof mesclarPorCaminho>[number];
/** O que `lerPorHosts` devolve (030, E5) — um dos três, nunca uma mistura. `null` é ausência
 *  estrutural; `{erro}` é falha de agora e COMEÇA pelo host que falhou. */
export type LeituraSomada =
  | { linhas: LinhaSomada[]; hosts: string[]; encerrados: string[]; truncado: boolean }
  | { erro: string }
  | null;

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

/** 033/T071 — a credencial do Search Console existe neste ambiente? É o PREDICADO de `getClient()`,
 *  exportado para a tela não inventar o próprio: `null` das leituras é "env desligada OU host fora
 *  de toda propriedade", e só este booleano separa as duas. Devolve booleano e nunca o valor. */
export const gscLigado = () => Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

function getClient(): Promise<Client> | null {
  if (!gscLigado()) return null;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON!;
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
  client: RequestClient,
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
  client: RequestClient,
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
//
// 030: `dimensions` e `rowLimit` viraram parâmetros para a leitura de páginas (`["page"]`, 1.000)
// usar a MESMA requisição em vez de uma cópia inline — eram três cópias do mesmo filtro de host.
export async function queryPageWindow(
  client: RequestClient,
  property: string,
  host: string,
  startDate: string,
  endDate: string,
  dimensions: string[] = ["query", "page"],
  rowLimit: number = TETO_LINHAS
): Promise<GscPageRow[]> {
  const res = await client.request<{ rows?: GscPageRow[] }>({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      property
    )}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate,
      endDate,
      dimensions,
      rowLimit,
      dimensionFilterGroups: [
        { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
      ],
    },
  });
  return res.data.rows ?? [];
}

/** O que `lerHosts` devolve (031, C2) — um dos três, nunca uma mistura. `dados` é o que `buscar`
 *  devolveu para AQUELE host: o laço não sabe se é página, consulta ou série. */
export type LeituraPorHosts<T> =
  | { respostas: { host: string; propriedade: string; dados: T }[]; encerrados: string[] }
  | { erro: string }
  | null;

/**
 * 031 — o laço ÚNICO de hosts do Search Console, extraído de `lerPorHosts` (030). Eram três
 * leituras (página, série, tendência) e cada uma ia escrever à mão o mesmo contrato de falha que a
 * 030 acabou de consolidar: a "sétima ocorrência" de `guarda_no_chamador_volta_pela_porta_seguinte`.
 * Aqui mora a regra; quem chama só diz o que buscar em cada host e como somar.
 *
 * Em SÉRIE, não em paralelo: mesma credencial e mesmo endpoint, e disparar os dois de uma vez é o
 * caminho curto para um 429. Exportada pelo mesmo motivo de `queryPageWindow`: testável sem o Next.
 *
 * Os dois estados de ausência NÃO colapsam, porque pedem conserto diferente:
 * - host sem propriedade, com outro vivo → a leitura segue com os vivos e o host sai em
 *   `encerrados`. Nenhum vivo (ou env desligada, ou lista vazia) → `null`: conserto é domínio.
 * - host que FALHA → `{erro}` e nada é publicado. Soma parcial lê como queda de tráfego (a guarda
 *   da 029 salvou o histórico e entregou 3% do número); a mensagem COMEÇA pelo host, porque um
 *   `{erro}` de uma leitura de dois hosts sem ele não diz onde ir.
 *
 * `getClient()` fica FORA do `try` de propósito: o `JSON.parse` da env cita um trecho da service
 * account na mensagem de erro, e dentro do `try` ela iria parar no `{erro}` — que a tela publica.
 * Env malformada sobe como exceção, como sempre subiu (Princípio V).
 */
export async function lerHosts<T>(
  hosts: string[],
  buscar: (client: RequestClient, propriedade: string, host: string) => Promise<T>,
  client?: RequestClient,
): Promise<LeituraPorHosts<T>> {
  if (hosts.length === 0) return null;
  const clientP = client ? Promise.resolve(client) : getClient();
  if (!clientP) return null;
  const respostas: { host: string; propriedade: string; dados: T }[] = [];
  const encerrados: string[] = [];
  // Falha em `listSites()` é da leitura inteira e não de um host: nomeia todos.
  let alvo = hosts.join(", ");
  try {
    const conectado = await clientP;
    const sites = await listSites(conectado);
    for (const host of hosts) {
      alvo = host;
      const propriedade = resolveProperty(host, sites);
      if (!propriedade) {
        encerrados.push(host);
        continue;
      }
      respostas.push({ host, propriedade, dados: await buscar(conectado, propriedade, host) });
    }
  } catch (e) {
    return { erro: `${alvo}: ${motivoDaFalha(e)}` };
  }
  if (respostas.length === 0) return null;
  return { respostas, encerrados };
}

/**
 * 030 — o caminho ÚNICO das leituras por página do Search Console: uma requisição por host
 * declarado e a soma por caminho. Eram três cópias de `resolveProperty` + filtro de host + teto
 * (`gscQueryPages`, `gscConsultas`, `gscPaginas`), e consertar a que foi reportada deixava as
 * outras duas contando o site pela metade — medido na Atma em 19/09/2026, a aba de aquisição
 * decidia os KPIs de clique sobre 98 das 24.664 impressões do site (0,4%).
 *
 * O contrato de falha e de ausência é o de `lerHosts`. O que é DESTA leitura é o `truncado`, que
 * compara cada resposta contra o `rowLimit` DESTA requisição, e nunca o total somado: com dois
 * hosts o total passa de 25.000 sem que nenhuma propriedade tenha sido cortada, e contra o total a
 * flag dispararia sem motivo — ou, contra o teto errado, nunca.
 */
export async function lerPorHosts(
  hosts: string[],
  { janela, dimensions, rowLimit, client }: { janela: Janela; dimensions: string[]; rowLimit: number; client?: RequestClient },
): Promise<LeituraSomada> {
  const lida = await lerHosts(
    hosts,
    async (conectado, propriedade, host) => {
      const rows = await queryPageWindow(conectado, propriedade, host, janela.inicio, janela.fim, dimensions, rowLimit);
      return { rows, truncado: rows.length >= rowLimit };
    },
    client,
  );
  if (!lida || "erro" in lida) return lida;
  const respostas: RespostaPorHost[] = lida.respostas.map(({ host, propriedade, dados }) => ({ host, propriedade, ...dados }));
  return {
    linhas: mesclarPorCaminho(respostas, hosts),
    hosts: respostas.map((r) => r.host),
    encerrados: lida.encerrados,
    truncado: respostas.some((r) => r.truncado),
  };
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
//
// 030: recebe os hosts declarados. A ORDEM importa — soma os hosts DENTRO de cada janela e só
// depois compara as janelas: com as respostas cruas, a mesma página nos dois hosts entraria duas
// vezes no par `current`/`previous` e a pauta leria a mesma URL como duas.
export async function gscQueryPages(hosts: string[], options: GscStrictOptions = {}) {
  const { strict = false, sleep = wait } = options;
  // Lista vazia em `strict` é erro e nunca `[]`: um card sem URL utilizável não é um site sem
  // histórico, e `[]` faz toda pauta virar "new" — o defeito que o `strict` existe para impedir.
  if (strict && hosts.length === 0) throw new Error("gsc-unavailable");
  const janela = async (de: number, ate: number, now: number): Promise<GscPageRow[] | null> => {
    const lida = await lerPorHosts(hosts, {
      janela: { inicio: isoDaysAgo(de, now), fim: isoDaysAgo(ate, now) },
      dimensions: ["query", "page"],
      rowLimit: TETO_LINHAS,
      client: options.client,
    });
    if (!lida) return null;
    if ("erro" in lida) throw new Error(lida.erro);
    // Linha sem impressão não existe na resposta do Google; o filtro só estreita o tipo.
    return lida.linhas.flatMap((l) =>
      l.posicao === null ? [] : [{ keys: [l.query!, l.page], clicks: l.cliques, impressions: l.impressoes, position: l.posicao }],
    );
  };
  for (let attempt = 0; ; attempt++) {
    try {
      const now = options.now?.getTime() ?? Date.now();
      const current = await janela(31, 3, now);
      if (!current) return [];
      const previous = (await janela(59, 32, now)) ?? [];
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

/** O que `gscSeries` devolve (031, E4) — a soma dos hosts declarados. `hosts` são os que
 *  responderam e `encerrados` os declarados sem propriedade; a régua da janela recebida deriva de
 *  `days`. `{erro}` COMEÇA pelo host que falhou e nunca carrega dia nenhum. */
export type GscSerieSomada =
  | { property: string; days: GscDay[]; hosts: string[]; encerrados: string[] }
  | { erro: string }
  | null;

/**
 * Série diária dos últimos 84 dias (12 semanas fechando em D-3, GSC atrasa), SOMADA nos hosts
 * declarados.
 *
 * 031: recebia UM host, o de `url`. Medido na Atma em 19/09/2026, a aba de aquisição publicava 127
 * das 370.559 impressões da janela (0,03%; 7 de 244 dias) sob uma frase que dizia "hosts somados"
 * com 10.098 — a soma por dia da 029 e a lista de hosts existiam e nenhuma leitura ao vivo as
 * chamava. O tipo do primeiro parâmetro mudou de propósito (`string` → `string[]`): o próximo
 * `gscSeries(p.url)` deixa de compilar, em vez de a porta errada ficar fechada por convenção.
 *
 * A soma é `somarSeriesPorHost`, e não há segunda implementação: ela já divergiu uma vez neste repo.
 * O contrato de falha e de ausência é o de `lerHosts`. `property` é a do primeiro host vivo.
 *
 * 019/FR-025: `janela` é OPCIONAL, com o default byte a byte o de sempre — é ele que alimenta o
 * portfólio inteiro, e trocá-lo moveria a célula `visitante` dos 17 projetos (SC-007).
 * `/okr/[slug]/aquisicao` passa a janela de 8 meses aqui. As datas do default nascem UMA vez, fora
 * do laço: dentro dele, dois hosts somariam janelas de um dia de diferença ao cruzar a meia-noite UTC.
 * `totals28()` continua fatiando 28 dias e não é tocada.
 */
export async function gscSeries(
  hosts: string[],
  janela: Janela = { inicio: isoDaysAgo(86), fim: isoDaysAgo(3) },
  options: { client?: RequestClient } = {},
): Promise<GscSerieSomada> {
  const lida = await lerHosts(
    hosts,
    (client, propriedade, host) => queryTimeseries(client, propriedade, host, janela.inicio, janela.fim),
    options.client,
  );
  if (!lida || "erro" in lida) return lida;
  return {
    property: lida.respostas[0].propriedade,
    // `lerHosts` devolve `dados` e a soma lê `days`: passar `respostas` cru COMPILA (o tipo do JSDoc
    // tem tudo opcional) e devolve [] — série vazia, sem erro.
    //
    // Dia sem impressão FICA, com o `position: 0` que o Google mandou. O Google DEVOLVE essas linhas
    // (medido em 19/09/2026: 2 de 244 dias em atma.roilabs.com.br, 3 de 7 em usealigner.com), e
    // descartá-las — o `flatMap` que a 030 usa nas leituras por página — encurtaria "dias com dado" e
    // deslocaria a borda da janela recebida de um projeto de UM host (FR-006). O 0 não vira posição:
    // as médias são ponderadas por impressão, e aqui o peso é zero.
    days: somarSeriesPorHost(lida.respostas.map((r) => ({ host: r.host, days: r.dados }))).map((d) => ({
      ...d,
      position: d.position ?? 0,
    })),
    hosts: lida.respostas.map((r) => r.host),
    encerrados: lida.encerrados,
  };
}

// A primitiva de UM host — era o `gscSeries`. Só a corrida que grava (`app/api/gsc-serie/route.ts`)
// a usa, porque ela mesma faz o laço de hosts e soma. Leitura ao vivo chamando isto é a porta
// errada reaberta: ler um host só é exatamente o defeito que a 031 fechou.
export async function gscSerieDeUmHost(
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
    return { erro: motivoDaFalha(e) };
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
    return { erro: motivoDaFalha(e) };
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
// Qualquer falha (env ausente ou malformada, nenhum host com propriedade, quota, host que lança) →
// null e o hub usa o seoSeed.
//
// 031: soma os cliques dos hosts declarados, por janela. Lia só o host de `url` e, na Atma, dava a
// home 9 cliques onde o site tinha 449 (medido em 19/09/2026, D-31→D-3: 9 no host novo, 449 no
// total) — a tendência lia como colapso um projeto que só trocou de domínio. Host sem propriedade não é falha: soma os vivos.
// Host que FALHA é `null`, e não a soma do que respondeu: `GscTrend` não tem campo de erro (e
// ampliá-lo reescreveria home e agenda por uma frase que ninguém exibe), então nomear o host é
// impossível aqui — mas a metade que importa da FR-004, não publicar total parcial, se cumpre.
//
// As duas janelas de UM host ficam no `Promise.all` de sempre; o que roda em série são os HOSTS
// (`lerHosts`). O teto em voo continua 2 requisições, nunca 2×N. As quatro datas nascem UMA vez, fora
// do laço: dentro dele, dois hosts somariam janelas de um dia de diferença ao cruzar a meia-noite UTC.
export async function gscTrend(hosts: string[], options: { client?: RequestClient } = {}): Promise<GscTrend> {
  try {
    const [inicioAtual, fimAtual, inicioAnterior, fimAnterior] = [isoDaysAgo(31), isoDaysAgo(3), isoDaysAgo(59), isoDaysAgo(32)];
    const lida = await lerHosts(
      hosts,
      async (client, propriedade, host) => {
        const [current, previous] = await Promise.all([
          queryClicks(client, propriedade, host, inicioAtual, fimAtual),
          queryClicks(client, propriedade, host, inicioAnterior, fimAnterior),
        ]);
        return { current, previous };
      },
      options.client,
    );
    if (!lida || "erro" in lida) return null;
    return {
      current: lida.respostas.reduce((t, r) => t + r.dados.current, 0),
      previous: lida.respostas.reduce((t, r) => t + r.dados.previous, 0),
      property: lida.respostas[0].propriedade,
    };
  } catch {
    return null;
  }
}

export type GscPaginas =
  | {
      paginas: { pagina: string; impressoes: number; cliques: number; posicao: number; hosts: string[] }[];
      hosts: string[];
      encerrados: string[];
      truncado: boolean;
    }
  | { erro: string }
  | null;

/**
 * Impressões por PÁGINA na janela — a base da camada de entrega da 016 (`páginas necessárias =
 * impressões que faltam ÷ média por página`).
 *
 * Função nova em vez de dimensão extra em `gscSeries()` (016, D6): aquela devolve série diária e é
 * consumida por meia dúzia de lugares; trocar a forma do retorno mexeria em todos eles para servir
 * um consumidor só.
 *
 * 030: soma os hosts declarados. Medido na Atma em 19/09/2026, a página que carrega 90% do
 * movimento (22.059 impressões) vive no domínio antigo, e a lista lida só do host novo a mostrava
 * com 5 — a média por página, e com ela as "páginas necessárias", saía de uma fatia de 0,4%.
 * O teto é o desta requisição (1.000), e não o das consultas: comparar contra 25.000 faria o
 * `truncado` nunca disparar aqui.
 *
 * `null` é "não há onde olhar" (env desligada ou nenhum host com propriedade) e `{erro}` é falha
 * transitória — a mesma distinção que `gscSeries()` faz, e pelo mesmo motivo: colapsar as duas faz
 * "sem propriedade" mentir quando era só timeout.
 */
export async function gscPaginas(hosts: string[], janela: Janela, options: GscClientOptions = {}): Promise<GscPaginas> {
  const lida = await lerPorHosts(hosts, { janela, dimensions: ["page"], rowLimit: 1000, client: options.client });
  if (!lida || "erro" in lida) return lida;
  const { linhas, ...resto } = lida;
  return {
    ...resto,
    // Linha sem impressão não existe na resposta do Google; o `flatMap` só estreita o tipo.
    paginas: linhas.flatMap((l) =>
      l.posicao === null
        ? []
        : [{ pagina: l.page, impressoes: l.impressoes, cliques: l.cliques, posicao: l.posicao, hosts: l.hosts }],
    ),
  };
}

/** Uma linha da leitura na dimensão `query` sozinha — a agregação por TERMO do próprio Google.
 *  `posicao` é `null` quando nenhuma linha do termo teve impressão (034). */
export type LinhaTermo = { termo: string; cliques: number; impressoes: number; posicao: number | null; hosts: string[] };
export type GscTermos =
  | { linhas: LinhaTermo[]; hosts: string[]; encerrados: string[]; truncado: boolean }
  | { erro: string }
  | null;

/**
 * 034 — a leitura por TERMO, que é a dimensão que a penetração no Top 3 mede.
 *
 * Não é `gscConsultas()` com uma dimensão a menos: aquela lê `["query", "page"]` e devolve o mesmo
 * termo uma vez por página em que ele ranqueia. Contar termos ali exigiria somar as linhas de
 * volta, que é a `porUrl()` deletada na 032 — a agregação do Google por `query` não é a soma das
 * linhas de `query`+`page`, e é a dele que a fórmula do board pede.
 *
 * Não passa por `lerPorHosts()` de propósito: a mescla de lá chama `new URL(keys.at(-1))` para
 * reduzir a página ao caminho, e aqui a última chave é o termo. Toda linha cairia no `catch` e a
 * leitura voltaria VAZIA sem erro. Daí `lerHosts()` (a genérica) + `mesclarPorTermo()`.
 *
 * `truncado` compara cada resposta contra o teto DESTA requisição e nunca o total somado — mesma
 * regra de `lerPorHosts`, pelo mesmo motivo: com dois hosts o total passa do teto sem que nenhuma
 * propriedade tenha sido cortada.
 *
 * Contrato de ausência igual ao das vizinhas: `null` = não há onde olhar, `{erro}` = falha
 * transitória.
 */
export async function gscTermos(hosts: string[], janela: Janela, options: GscClientOptions = {}): Promise<GscTermos> {
  const lida = await lerHosts(
    hosts,
    async (conectado, propriedade, host) => {
      const rows = await queryPageWindow(conectado, propriedade, host, janela.inicio, janela.fim, ["query"], TETO_LINHAS);
      return { rows, truncado: rows.length >= TETO_LINHAS };
    },
    options.client,
  );
  if (!lida || "erro" in lida) return lida;
  const respostas = lida.respostas.map(({ host, dados }) => ({ host, rows: dados.rows }));
  return {
    linhas: mesclarPorTermo(respostas),
    hosts: lida.respostas.map((r) => r.host),
    encerrados: lida.encerrados,
    truncado: lida.respostas.some((r) => r.dados.truncado),
  };
}

/** Uma linha de `query`+`page` da janela, com os nomes do domínio em vez de `keys[0]`/`keys[1]`.
 *  `hosts` (030) é quem contribuiu com a linha — a página mesclada de dois hosts nomeia os dois. */
export type LinhaBusca = { query: string; page: string; cliques: number; impressoes: number; posicao: number; hosts: string[] };
export type GscConsultas =
  | { linhas: LinhaBusca[]; hosts: string[]; encerrados: string[]; truncado: boolean }
  | { erro: string }
  | null;

/**
 * As consultas da janela, para os KPIs de busca da 021.
 *
 * UMA janela, a que o chamador passa — `descoberta()`, no caso da aba de aquisição.
 * `gscQueryPages` não serve aqui: a janela dela é fixa em D-31→D-3 (um dia mais larga que a
 * descoberta, o que faria a lista não fechar com o total exibido acima dela) e ela gasta uma
 * segunda requisição na janela anterior, que nenhum KPI desta feature lê.
 *
 * 030: soma os hosts declarados. Desde a troca de domínio da Atma (11/09), a aba decidia os sete
 * KPIs do ramo CLIQUE sobre 98 das 24.664 impressões do site — o Índice de Conformidade saía sem
 * denominador, e um painel mudo é indistinguível de um painel que ninguém apurou.
 *
 * `truncado` existe porque `TETO_LINHAS` é um corte silencioso da API: sem o sinal, um projeto
 * grande exibiria o teto como se fosse o fim dos dados (FR-011). Vale por propriedade.
 *
 * `null` = não há onde olhar (env desligada ou nenhum host com propriedade); `{erro}` = falha
 * transitória. Mesma distinção de `gscSeries()` e `gscPaginas()`, e pelo mesmo motivo.
 */
export async function gscConsultas(
  hosts: string[],
  janela: Janela,
  options: GscClientOptions = {},
): Promise<GscConsultas> {
  const lida = await lerPorHosts(hosts, { janela, dimensions: ["query", "page"], rowLimit: TETO_LINHAS, client: options.client });
  if (!lida || "erro" in lida) return lida;
  return {
    ...lida,
    // Linha sem impressão não existe na resposta do Google; o `flatMap` só estreita o tipo.
    linhas: lida.linhas.flatMap((l) =>
      l.posicao === null
        ? []
        : [{ query: l.query!, page: l.page, cliques: l.cliques, impressoes: l.impressoes, posicao: l.posicao, hosts: l.hosts }],
    ),
  };
}
