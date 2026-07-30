/**
 * Submete sitemaps ao Search Console pela API — sem abrir a UI.
 *
 *   node scripts/submit-sitemap.mjs https://links.roilabs.com.br/sitemap.xml [...]
 *
 * A propriedade sai do host do próprio sitemap (`sc-domain:<domínio registrável>`), então promover
 * um projeto novo não exige editar este arquivo. Escopo `webmasters` (não `.readonly`): a service
 * account é `siteFullUser` nas propriedades, e o PUT só passa com o escopo de escrita.
 *
 * Um sitemap só é aceito dentro da propriedade que contém o host. Host de fornecedor
 * (`*.vercel.app`) não pertence a nenhuma propriedade sua — submeter de lá falha, e isso é o
 * sintoma de que falta o passo de domínio próprio, não um erro de permissão.
 */
import { pathToFileURL } from "node:url";
import { GoogleAuth } from "google-auth-library";

const API = "https://searchconsole.googleapis.com/webmasters/v3/sites";

/** Sufixos onde o domínio registrável tem 3 rótulos: `x.com.br` e não `com.br`. */
const COMPOSITE = new Set(["com", "net", "org", "gov", "edu"]);

/** `sem-swarm.nimblabs.com` → `sc-domain:nimblabs.com`; `a.roilabs.com.br` → `sc-domain:roilabs.com.br`. */
export function propertyOf(feedUrl) {
  const parts = new URL(feedUrl).hostname.split(".");
  const labels = COMPOSITE.has(parts.at(-2)) ? 3 : 2;
  return `sc-domain:${parts.slice(-labels).join(".")}`;
}

async function main(feeds) {
  if (!feeds.length) {
    console.error("uso: node scripts/submit-sitemap.mjs <url-do-sitemap> [...]");
    return 2;
  }
  const client = await new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/webmasters"],
  }).getClient();

  const { data } = await client.request({ url: API });
  const perms = new Map((data.siteEntry ?? []).map((s) => [s.siteUrl, s.permissionLevel]));

  let failed = 0;
  for (const feed of feeds) {
    const prop = propertyOf(feed);
    if (!perms.has(prop)) {
      console.log(`SKIP  ${feed}\n      ${prop} não está na conta — confira a propriedade antes`);
      failed++;
      continue;
    }
    const url = `${API}/${encodeURIComponent(prop)}/sitemaps/${encodeURIComponent(feed)}`;
    try {
      await client.request({ url, method: "PUT" });
      console.log(`OK    ${feed}  →  ${prop} (${perms.get(prop)})`);
    } catch (e) {
      console.log(`FALHA ${feed}\n      ${e.response?.status ?? "?"} ${e.response?.data?.error?.message ?? e.message}`);
      failed++;
    }
  }
  return failed ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main(process.argv.slice(2)));
}
