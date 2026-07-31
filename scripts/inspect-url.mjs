/**
 * Lê o estado de indexação de URLs no Search Console — a única forma de saber se uma página está
 * no índice ([[site_200_is_not_indexed_url_inspection]]; status 200 não prova nada).
 *
 *   node --env-file=.env scripts/inspect-url.mjs https://atma.roilabs.com.br/ [...]
 *
 * A propriedade sai do host, igual ao submit-sitemap. A API é SOMENTE LEITURA: não existe
 * "Solicitar indexação" programático — esse passo é manual, na UI.
 */
import { pathToFileURL } from "node:url";
import { GoogleAuth } from "google-auth-library";
import { propertyOf } from "./submit-sitemap.mjs";

const API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";

async function main(urls) {
  if (!urls.length) {
    console.error("uso: node --env-file=.env scripts/inspect-url.mjs <url> [...]");
    return 2;
  }
  const client = await new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }).getClient();

  let failed = 0;
  for (const inspectionUrl of urls) {
    const siteUrl = propertyOf(inspectionUrl);
    try {
      const { data } = await client.request({
        url: API,
        method: "POST",
        data: { inspectionUrl, siteUrl },
      });
      const r = data.inspectionResult?.indexStatusResult ?? {};
      console.log(
        [
          inspectionUrl,
          `  verdict:      ${r.verdict ?? "-"}`,
          `  coverage:     ${r.coverageState ?? "-"}`,
          `  lastCrawl:    ${r.lastCrawlTime ?? "-"}`,
          `  robotsTxt:    ${r.robotsTxtState ?? "-"}`,
          `  indexing:     ${r.indexingState ?? "-"}`,
        ].join("\n")
      );
    } catch (e) {
      console.log(
        `FALHA ${inspectionUrl}\n      ${e.response?.status ?? "?"} ${e.response?.data?.error?.message ?? e.message}`
      );
      failed++;
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
