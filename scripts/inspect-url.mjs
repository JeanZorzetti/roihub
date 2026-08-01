/**
 * Lê o estado de indexação de URLs no Search Console — a única forma de saber se uma página está
 * no índice ([[site_200_is_not_indexed_url_inspection]]; status 200 não prova nada).
 *
 *   node --env-file=.env scripts/inspect-url.mjs https://atma.roilabs.com.br/ [...]
 *
 * A lógica mora em `lib/indexacao.mjs` desde 01/08 (o apurador de D-84 lê a mesma). A propriedade
 * sai da lista real do GSC, não de um palpite sobre o host: URL fora de toda propriedade não é
 * "não indexada", é "não há onde olhar". A API é SOMENTE LEITURA — não existe "Solicitar
 * indexação" programático, esse passo é manual na UI.
 */
import { pathToFileURL } from "node:url";
import { clienteGsc, inspecionarUrl, propriedades } from "../lib/indexacao.mjs";
import { melhorPropriedade } from "../lib/gsc-consulta.mjs";

async function main(urls) {
  if (!urls.length) {
    console.error("uso: node --env-file=.env scripts/inspect-url.mjs <url> [...]");
    return 2;
  }
  const client = await clienteGsc();
  const sites = await propriedades(client);

  let failed = 0;
  for (const inspectionUrl of urls) {
    const siteUrl = melhorPropriedade(new URL(inspectionUrl).hostname, sites);
    if (!siteUrl) {
      // Host de fornecedor (`*.vercel.app`) fica FORA de toda propriedade — não é erro de
      // permissão nem sinal de SEO, é a falta do passo de domínio próprio.
      console.log(`FORA DE TODA PROPRIEDADE ${inspectionUrl}\n      nenhuma propriedade do GSC contém esse host`);
      failed++;
      continue;
    }
    try {
      const r = await inspecionarUrl(client, inspectionUrl, siteUrl);
      console.log(
        [
          inspectionUrl,
          `  propriedade:  ${siteUrl}`,
          `  verdict:      ${r.verdict ?? "-"}`,
          `  coverage:     ${r.coverageState ?? "-"}`,
          `  lastCrawl:    ${r.lastCrawlTime ?? "-"}`,
          `  robotsTxt:    ${r.robotsTxtState ?? "-"}`,
          `  indexing:     ${r.indexingState ?? "-"}`,
          // Em `Duplicate, Google chose different canonical` a URL escolhida é o diagnóstico
          // inteiro: sem ela o coverage diz que houve escolha e esconde QUAL.
          `  canonicalUsr: ${r.userCanonical ?? "-"}`,
          `  canonicalGgl: ${r.googleCanonical ?? "-"}`,
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
