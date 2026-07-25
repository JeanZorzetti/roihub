// Abastece a aba /infra: baixa o export de "Estatísticas de rastreamento" de cada propriedade do
// Search Console e commita em docs/. Crawl stats NÃO tem API (lib/crawl.mjs:2) — a UI é a única
// fonte, então isso é um browser clicando no mesmo botão que o humano clicava.
//
// Uso:
//   node scripts/fetch-crawl-stats.mjs --login   uma vez, visível, pro Jean logar no Google
//   node scripts/fetch-crawl-stats.mjs           semanal (Task Scheduler, domingo 10:00 BRT)
//
// Handoff: handoff-crawl-stats-semanal.md

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";
// playwright-core, não playwright: o postinstall do segundo baixa browsers e roda no `npm ci`
// do Dockerfile (alpine) — usamos o Chrome do sistema via channel, então não há o que baixar.
import { chromium } from "playwright-core";
import { destDirFor, validateExport } from "../lib/crawl-fetch.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// O Task Scheduler inicia em System32: nada aqui pode depender do cwd.
process.loadEnvFile(path.join(REPO, ".env"));

const LOGIN = process.argv.includes("--login");
// Sessão do Google: fora do repo, sempre. Não é storageState em secret de CI de propósito —
// cookie do Google aberto de IP de datacenter vira challenge (handoff §4).
const PROFILE = path.join(process.env.LOCALAPPDATA ?? tmpdir(), "roihub-gsc-profile");
const NAV_TIMEOUT = 60_000;

/** Propriedades direto do GSC: lista nova entra sozinha, e o mapa nunca mente. */
async function properties() {
  const client = await new GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  }).getClient();
  const res = await client.request({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
  return (res.data.siteEntry ?? [])
    .filter((s) => s.permissionLevel !== "siteUnverifiedUser")
    .map((s) => s.siteUrl)
    .sort();
}

/** ponytail: Expand-Archive é o mesmo "Extrair aqui" que gerou as pastas atuais; Windows-only
 *  por decisão (o robô roda na máquina do Jean). Em Linux, trocar por bsdtar -xf. */
function unzip(zip, dir) {
  mkdirSync(dir, { recursive: true });
  execFileSync("powershell", [
    "-NoProfile", "-NonInteractive", "-Command",
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${dir}' -Force`,
  ], { stdio: "pipe" });
}

async function download(page, property, tmp) {
  // hl=en trava o texto do botão independente do idioma da conta; os CSVs de dentro podem seguir
  // em pt-BR (o readCsv da aba casa os dois).
  const url = `https://search.google.com/search-console/settings/crawl-stats?resource_id=${encodeURIComponent(property)}&hl=en`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  if (/accounts\.google\.com/.test(page.url())) throw new Error("sessão expirou — rode com --login");

  const [file] = await Promise.all([
    page.waitForEvent("download", { timeout: NAV_TIMEOUT }),
    (async () => {
      await page.getByRole("button", { name: /export/i }).first().click({ timeout: NAV_TIMEOUT });
      await page.getByRole("menuitem", { name: /csv/i }).first().click();
    })(),
  ]);

  const dest = destDirFor(file.suggestedFilename(), REPO);
  if (!dest) throw new Error(`nome fora do padrão: ${file.suggestedFilename()} — a UI mudou`);
  const zip = path.join(tmp, file.suggestedFilename());
  await file.saveAs(zip);
  unzip(zip, dest.dir);

  const check = validateExport(dest.dir);
  if (!check.ok) {
    rmSync(dest.dir, { recursive: true, force: true });
    throw new Error(check.reason);
  }
  return { ...dest, days: check.days };
}

const git = (...args) => execFileSync("git", args, { cwd: REPO, encoding: "utf8" });

async function main() {
  const props = await properties();
  console.log(`${props.length} propriedades no Search Console`);

  const tmp = mkdtempSync(path.join(tmpdir(), "crawl-"));
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: !LOGIN,
    acceptDownloads: true,
    channel: "chrome",
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());

  if (LOGIN) {
    await page.goto("https://search.google.com/search-console", { timeout: NAV_TIMEOUT });
    console.log("Faça login na janela aberta e feche o navegador quando terminar.");
    await page.waitForEvent("close", { timeout: 0 });
    await ctx.close();
    return 0;
  }

  const ok = [];
  const failed = [];
  for (const property of props) {
    try {
      const got = await download(page, property, tmp);
      ok.push(got);
      console.log(`  ok   ${got.host} — ${got.exportDate}, ${got.days} dias`);
    } catch (e) {
      failed.push({ property, message: e.message });
      console.error(`  FALHA ${property}: ${e.message}`);
      // Screenshot separa "sessão expirou" de "seletor mudou" — o tratamento é oposto.
      await page.screenshot({ path: path.join(tmp, `${property.replace(/\W+/g, "-")}.png`) }).catch(() => {});
    }
  }
  await ctx.close();
  // Só limpa quando deu tudo certo: com falha, o tmp é onde os screenshots ficaram.
  if (failed.length === 0) rmSync(tmp, { recursive: true, force: true, maxRetries: 2 });

  if (ok.length === 0) {
    console.error("nenhum export válido — nada commitado");
    return 1;
  }

  git("add", "docs/Crawl-stats");
  if (git("status", "--short", "docs/Crawl-stats").trim() === "") {
    console.log("exports idênticos aos do repo — nada a commitar");
  } else {
    git("commit", "-m", `chore: crawl stats ${ok[0].exportDate} (${ok.length} propriedades)`);
    git("push", "origin", "main");
    console.log(`commitado e pushado: ${ok.length} exports`);
  }

  // Silêncio aqui vira dado velho de novo: quem falhou tem que aparecer no exit code.
  if (failed.length > 0) {
    console.error(`${failed.length} propriedade(s) falharam; screenshots em ${tmp}`);
    return 1;
  }
  return 0;
}

process.exitCode = await main();
