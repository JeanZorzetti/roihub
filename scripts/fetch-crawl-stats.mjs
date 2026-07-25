// Abastece a aba /infra: baixa o export de "Estatísticas de rastreamento" de cada propriedade do
// Search Console e commita em docs/. Crawl stats NÃO tem API (lib/crawl.mjs:2) — a UI é a única
// fonte, então isso é um browser clicando no mesmo botão que o humano clicava.
//
// Uso:
//   node scripts/fetch-crawl-stats.mjs --login   uma vez, pro Jean logar no Google
//   node scripts/fetch-crawl-stats.mjs           semanal (Task Scheduler, domingo 10:00 BRT)
//
// O Google RECUSA login em browser automatizado ("Não foi possível fazer o login / este navegador
// pode não ser seguro") — por isso o Chrome é aberto como processo normal, sem Playwright, e o robô
// só se CONECTA nele por CDP depois. Sessão já autenticada o Google não derruba; o que ele barra é
// o fluxo de login dentro de um browser com flags de automação.
//
// Depois dos exports, roda o ml/analyze.py no mesmo processo: o /insights lê os mesmos CSVs de
// docs/, então só faz sentido recalcular depois que o dado novo entrou. Python via ROIHUB_PYTHON
// (default: o venv em C:/venvs — FORA do OneDrive, que corrompe venv igual node_modules).
//
// Handoff: handoff-crawl-stats-semanal.md, handoff-insights-automatico.md

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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
const CHROME = process.env.CHROME_PATH ?? [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
].find((p) => existsSync(p));
const NAV_TIMEOUT = 60_000;
const PYTHON = process.env.ROIHUB_PYTHON ?? "C:/venvs/roihub-ml/Scripts/python.exe";

/**
 * Chrome de verdade, iniciado por spawn — não por Playwright. Sem `--enable-automation`, sem
 * `--no-sandbox`: é isso que faz o Google aceitar o login (e continuar aceitando a sessão depois).
 * Porta 0 + DevToolsActivePort em vez de porta fixa: duas execuções nunca colidem.
 */
function launchChrome(...args) {
  if (!CHROME) throw new Error("Chrome não encontrado — defina CHROME_PATH");
  const portFile = path.join(PROFILE, "DevToolsActivePort");
  rmSync(portFile, { force: true });
  const proc = spawn(CHROME, [
    `--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", ...args,
  ], { stdio: "ignore" });
  return { proc, portFile };
}

async function devtoolsPort(portFile, proc) {
  for (let i = 0; i < 60; i++) {
    if (existsSync(portFile)) return Number(readFileSync(portFile, "utf8").split("\n")[0]);
    if (proc.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  // Chrome já aberto NESTE perfil delega para a instância existente e o processo novo morre sem
  // escrever a porta. É a falha mais provável aqui, e a mensagem tem que dizer o que fazer.
  throw new Error(`Chrome não abriu porta de debug — feche a janela do perfil ${PROFILE} e rode de novo`);
}

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

/**
 * Espera a caixa do elemento repetir entre duas medições.
 * O "stable" nativo do Playwright olha 2 frames (~33ms) e não pega layout shift discreto: o menu
 * do Export desce ~40px quando o resto da página chega, e o clique acerta o item de cima —
 * "Download Excel", que não baixa nada e não devolve erro nenhum. Foi assim que aftercare e
 * reviewshield falharam 3 runs seguidos enquanto os outros 8 passavam.
 */
async function settled(locator, tries = 20, gap = 250) {
  let prev = null;
  for (let i = 0; i < tries; i++) {
    const box = await locator.boundingBox();
    if (prev && box && box.y === prev.y && box.x === prev.x) return;
    prev = box;
    await locator.page().waitForTimeout(gap);
  }
}

async function download(page, property, tmp) {
  // hl=en trava o texto do botão independente do idioma da conta; os CSVs de dentro podem seguir
  // em pt-BR (o readCsv da aba casa os dois).
  const url = `https://search.google.com/search-console/settings/crawl-stats?resource_id=${encodeURIComponent(property)}&hl=en`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
  if (/accounts\.google\.com/.test(page.url())) throw new Error("sessão expirou — rode com --login");
  // Sem esperar a página assentar, o menu aberto ainda desce junto com o layout e o clique acerta o
  // item de cima ("Download Excel", que não baixa nada aqui): foi o que derrubou aftercare e
  // reviewshield em 25/07 — os dois têm a faixa "Host had problems in the past" empurrando o topo.
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});

  const [file] = await Promise.all([
    page.waitForEvent("download", { timeout: NAV_TIMEOUT }),
    (async () => {
      await page.getByRole("button", { name: /export/i }).first().click({ timeout: NAV_TIMEOUT });
      const csv = page.getByRole("menuitem", { name: /csv/i }).first();
      await csv.waitFor({ state: "visible", timeout: 15_000 });
      await settled(csv);
      // Click de verdade: o item ignora click sintético (dispatchEvent não dispara o download).
      await csv.click({ timeout: 15_000 });
    })(),
  ]);

  // O export abre uma aba, que fica órfã depois do download — sem isso são 10 abas ao fim do run.
  for (const extra of page.context().pages()) if (extra !== page) await extra.close().catch(() => {});

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
  if (LOGIN) {
    // Playwright NÃO entra aqui: é um Chrome comum, e é por isso que o login passa.
    const { proc } = launchChrome("https://search.google.com/search-console");
    console.log(`Chrome aberto no perfil ${PROFILE}.`);
    console.log("Faça login no Google e feche a janela quando o Search Console carregar.");
    await new Promise((resolve) => proc.on("exit", resolve));
    return 0;
  }

  // Argumento solto filtra por substring: re-rodar só quem falhou não precisa repetir os 10.
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const props = (await properties()).filter((p) => only.length === 0 || only.some((s) => p.includes(s)));
  console.log(`${props.length} propriedades no Search Console${only.length ? ` (filtro: ${only.join(", ")})` : ""}`);

  const tmp = mkdtempSync(path.join(tmpdir(), "crawl-"));
  // Janela visível de propósito: headless com sessão Google é o que costuma pedir re-auth, e o
  // robô roda de domingo de manhã na máquina do Jean — a janela por 3 min não incomoda ninguém.
  const { proc, portFile } = launchChrome("--remote-debugging-port=0", "about:blank");
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${await devtoolsPort(portFile, proc)}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.newPage());

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
  // close() sobre CDP só desconecta — quem abriu o Chrome foi o spawn, quem fecha é o kill.
  await browser.close();
  proc.kill();
  // Só limpa quando deu tudo certo: com falha, o tmp é onde os screenshots ficaram.
  if (failed.length === 0) rmSync(tmp, { recursive: true, force: true, maxRetries: 2 });

  if (ok.length === 0) {
    console.error("nenhum export válido — nada commitado");
    return 1;
  }

  // O analyze.py lê docs/: só faz sentido depois que os exports novos entraram.
  let insights = false;
  try {
    execFileSync(PYTHON, [path.join(REPO, "ml", "analyze.py")], { cwd: REPO, stdio: "inherit" });
    insights = true;
  } catch (e) {
    // Insights são derivados; crawl stats são o dado bruto. Falhar aqui não pode custar o commit
    // dos exports (o GSC só guarda 90 dias) — mas tem que aparecer no exit code.
    failed.push({ property: "ml/analyze.py", message: e.message });
    console.error(`  FALHA ml/analyze.py: ${e.message}`);
  }

  git("add", "docs/Crawl-stats", "data/insights.json");
  if (git("status", "--short", "docs/Crawl-stats", "data/insights.json").trim() === "") {
    console.log("exports idênticos aos do repo — nada a commitar");
  } else {
    const what = insights ? "crawl stats + insights" : "crawl stats";
    git("commit", "-m", `chore: ${what} ${ok[0].exportDate} (${ok.length} propriedades)`);
    git("push", "origin", "main");
    console.log(`commitado e pushado: ${ok.length} exports`);
  }

  // Silêncio aqui vira dado velho de novo: quem falhou tem que aparecer no exit code.
  if (failed.length > 0) {
    console.error(`${failed.length} falha(s): ${failed.map((f) => f.property).join(", ")} — screenshots em ${tmp}`);
    return 1;
  }
  return 0;
}

process.exitCode = await main();
