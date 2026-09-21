// Estado de indexação no Search Console — a ÚNICA fonte que diz se uma página está no índice.
// Status 200 não prova nada ([[site_200_is_not_indexed_url_inspection]]): o atma ficou meses
// respondendo 200 e fora do índice, e o sinal que denunciou não foi o site, foi impressão caindo
// com posição MELHORANDO.
//
// Mora em `lib/` porque tem dois consumidores: `scripts/inspect-url.mjs` (uma URL pedida à mão) e
// o apurador de `D-84` em `lib/dourado-estado.mjs`. A API é SOMENTE LEITURA — não existe
// "Solicitar indexação" programático, esse passo é manual na UI.
import { GoogleAuth } from "google-auth-library";
import { melhorPropriedade } from "./gsc-consulta.mjs";

const API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
const SITES = "https://searchconsole.googleapis.com/webmasters/v3/sites";

export async function clienteGsc() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("sem GOOGLE_SERVICE_ACCOUNT_JSON");
  return new GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }).getClient();
}

/** Propriedades verificadas. `siteUnverifiedUser` não responde inspeção — some antes de virar erro. */
export async function propriedades(client) {
  const res = await client.request({ url: SITES });
  return (res.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");
}

/**
 * Uma inspeção. Devolve o `indexStatusResult` cru: quem interpreta é quem chamou.
 *
 * `rich` é o `richResultsResult` da MESMA resposta, aninhado em vez de espalhado — ele tem
 * `verdict` próprio, e espalhar sobrescreveria o verdict de indexação por um que fala de outra
 * coisa. Vinha sendo descartado desde a 022: é a fonte que o board cita por nome para o KPI de
 * Dados Estruturados ("0 erros críticos no relatório de Resultados Enriquecidos"), e ela chega de
 * graça na requisição que a corrida diária já paga.
 *
 * ⚠️ `rich` AUSENTE não é "0 resultados enriquecidos": o Google só reporta o que viu no
 * ÚLTIMO rastreamento, então URL fora do índice não tem relatório nenhum. Quem conta precisa
 * separar "nenhum detectado" de "não há onde olhar" — `classificarRich()` faz isso.
 */
export async function inspecionarUrl(client, inspectionUrl, siteUrl) {
  const { data } = await client.request({ url: API, method: "POST", data: { inspectionUrl, siteUrl } });
  return { ...(data.inspectionResult?.indexStatusResult ?? {}), rich: data.inspectionResult?.richResultsResult ?? null };
}

/**
 * Inspeciona uma lista de URLs, cada uma na melhor propriedade que a contém.
 *
 * ⚠️ `sem-propriedade` NÃO é "fora do índice": é "não olhei, e não há onde olhar". Host de
 * fornecedor (`*.vercel.app`) fica FORA de toda propriedade sua — `URL unknown to Google` ali não
 * é sinal de SEO, é sinal de que falta o passo de domínio próprio
 * ([[vendor_domain_hides_project_from_gsc]]). Somar os dois estados esconderia justamente a
 * diferença entre um site desindexado e um site que o Search Console nunca viu.
 *
 * @returns {Promise<{url:string, propriedade:string|null, verdict:string, coverage:string,
 *   ultimoCrawl:string, erro:string}[]>}
 */
export async function inspecionarIndexacao(urls, { client } = {}) {
  const c = client ?? (await clienteGsc());
  const sites = await propriedades(c);
  const saida = [];
  for (const url of urls) {
    const prop = melhorPropriedade(new URL(url).hostname, sites);
    if (!prop) {
      saida.push({ url, propriedade: null, verdict: "", coverage: "", ultimoCrawl: "", erro: "sem propriedade no GSC" });
      continue;
    }
    try {
      const r = await inspecionarUrl(c, url, prop);
      saida.push({
        url,
        propriedade: prop,
        verdict: r.verdict ?? "",
        coverage: r.coverageState ?? "",
        ultimoCrawl: r.lastCrawlTime ?? "",
        // Cru e sem interpretar: quem conta é `classificarRich()`, que é pura e mora ao lado de
        // `classificar()` — esta função faz rede, e o que faz rede não é reprovável em
        // milissegundos.
        rich: r.rich ?? null,
        erro: "",
      });
    } catch (e) {
      // Falha de uma URL não pode derrubar as outras — mas também não pode virar "não indexado".
      saida.push({
        url,
        propriedade: prop,
        verdict: "",
        coverage: "",
        ultimoCrawl: "",
        erro: `${e.response?.status ?? "?"} ${e.response?.data?.error?.message ?? e.message}`,
      });
    }
  }
  return saida;
}

/** `PASS` + coverage de indexado é o único par que significa "está no índice". */
export const estaIndexada = (l) => l.verdict === "PASS" && /Submitted and indexed|Indexed, not submitted|URL is on Google/i.test(l.coverage);
