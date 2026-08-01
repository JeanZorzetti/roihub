// O INVENTÁRIO DE COBRANÇA PELO REPO — a outra metade de `scripts/gateways.mjs`, e ela existe
// porque aquele mede uma coisa que não é a que se quer saber.
//
//   node --env-file=.env scripts/gateways-repo.mjs         # os 35
//   node --env-file=.env scripts/gateways-repo.mjs --ver   # com o arquivo e a linha de cada achado
//
// `gateways.mjs` olha o HTML SERVIDO. Ele não vê gateway montado por JS depois de um clique, não
// vê chave num `.env` e não vê SDK num `package.json` — por isso o balde `sem-gateway` dele é
// "não achei caminho de cobrança servido", NUNCA "não cobra". Trinta projetos caíram nesse balde
// e a diferença entre as duas leituras é a diferença entre um portfólio que não cobra e um que
// cobra sem ninguém medir.
//
// Este lê o CÓDIGO, pela API do GitHub: dependência de SDK de pagamento em qualquer
// `package.json` da árvore, e nome de variável de ambiente de gateway em `.env.example` e afins.
// Zero LLM e zero pool, como o irmão. Fora do `npm test`: são centenas de requisições à API.
//
// ⚠️ VER-08, sétima vez nesta base: A PRIMEIRA CORRIDA DE UM CHECK NOVO MEDE O CHECK. A saída é
// LISTA NOMINAL de propósito. Não publique percentual daqui antes de ler as linhas uma a uma —
// as duas primeiras corridas do `gateways.mjs` acharam dois defeitos de check e zero de projeto.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ver = process.argv.includes("--ver");
const projetos = JSON.parse(readFileSync(fileURLToPath(new URL("../data/projects.json", import.meta.url)), "utf8"));
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error("GITHUB_TOKEN ausente. Rode com --env-file=.env.");
  process.exit(1);
}

// Dependência de SDK, não menção. `stripe` como dependência é intenção de cobrar; a palavra
// "Stripe" numa página de marketing é o falso positivo que custou a segunda corrida do irmão —
// o catálogo de integrações do `estetiacrm` cita três gateways que o CRM integra PARA OS CLIENTES
// DELE. Casar contra o NOME DO PACOTE é o equivalente, aqui, de casar contra a URL lá.
const PACOTES = [
  ["mercadopago", /^(mercadopago|@mercadopago\/)/i],
  ["stripe", /^(stripe|@stripe\/)/i],
  ["asaas", /^(asaas|@asaas\/)/i],
  ["pagseguro", /^(pagseguro|@pagseguro\/)/i],
  ["pagarme", /^(pagarme|@pagarme\/)/i],
  ["paypal", /^(@paypal\/|paypal-rest-sdk)/i],
  ["iugu", /^(iugu|@iugu\/)/i],
  ["kiwify", /^(kiwify|@kiwify\/)/i],
  ["abacatepay", /^(abacatepay|@abacatepay\/)/i],
  ["efi", /^(sdk-node-apis-efi|gerencianet)/i],
  ["paddle", /^(@paddle\/|paddle-sdk)/i],
  ["lemonsqueezy", /^(@lemonsqueezy\/|lemonsqueezy)/i],
];

// Env var é sinal mais fraco que dependência: `.env.example` viaja em fork e boilerplate. Entra
// como balde SEPARADO justamente por isso — somar os dois inventaria cobrança onde há template.
const ENVS = [
  ["mercadopago", /MERCADOPAGO|MERCADO_PAGO|MP_ACCESS_TOKEN/],
  ["stripe", /STRIPE_(SECRET|PUBLISHABLE|WEBHOOK|PRICE)/],
  ["asaas", /ASAAS_(API|TOKEN|KEY)/],
  ["pagseguro", /PAGSEGURO_/],
  ["pagarme", /PAGARME_/],
  ["iugu", /IUGU_/],
  ["kiwify", /KIWIFY_/],
  ["abacatepay", /ABACATEPAY_/],
];

// `repo` em `data/projects.json` é o NOME do repositório, sem o dono — a primeira corrida deste
// check pediu `/repos/roilabs` e levou 404 em 35 de 35, que é o formato que "todo projeto está
// quebrado" tem quando o quebrado é o check. Sétima vez nesta base (VER-08).
const DONO = "JeanZorzetti";
const nomeCompleto = (repo) => (repo.includes("/") ? repo : `${DONO}/${repo}`);

const cabecalho = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "roihub-gateways-repo" };

async function api(url) {
  const r = await fetch(url, { headers: cabecalho });
  if (r.status === 404) return null;
  if (r.status === 403 || r.status === 429) throw new Error(`rate limit da API do GitHub (${r.status})`);
  if (!r.ok) throw new Error(`${r.status} em ${url}`);
  return r.json();
}

// Um GET da árvore inteira por repo, não um por arquivo: o repo do sirius tem ~3 mil arquivos e
// pedir um a um estouraria o rate limit antes do décimo projeto.
async function arvore(repo) {
  const meta = await api(`https://api.github.com/repos/${repo}`);
  if (!meta) return null;
  const t = await api(`https://api.github.com/repos/${repo}/git/trees/${meta.default_branch}?recursive=1`);
  return t?.tree ?? null;
}

async function conteudo(repo, caminho) {
  const c = await api(`https://api.github.com/repos/${repo}/contents/${encodeURI(caminho)}`);
  if (!c?.content) return "";
  return Buffer.from(c.content, "base64").toString("utf8");
}

const baldes = { sdk: [], env: [], nada: [], sem_repo: [] };
const detalhe = [];

for (const p of projetos) {
  if (!p.repo) {
    baldes.sem_repo.push(p.slug);
    continue;
  }
  let tree;
  try {
    tree = await arvore(nomeCompleto(p.repo));
  } catch (err) {
    console.error(`  ⚠️  ${p.slug}: ${err.message}`);
    baldes.sem_repo.push(p.slug);
    continue;
  }
  if (!tree) {
    baldes.sem_repo.push(p.slug);
    continue;
  }

  // `node_modules` e `dist` fora: dependência transitiva de terceiro não é intenção de cobrar, e
  // é ela que transformaria este check num detector de árvore de dependências.
  const relevantes = tree.filter((f) =>
    f.type === "blob" &&
    !/(^|\/)(node_modules|dist|build|\.next|vendor)\//.test(f.path) &&
    (/(^|\/)package\.json$/.test(f.path) || /(^|\/)\.env(\.|$)/.test(f.path)));

  const achadosSdk = [];
  const achadosEnv = [];
  for (const f of relevantes.slice(0, 40)) {
    const txt = await conteudo(nomeCompleto(p.repo), f.path);
    if (!txt) continue;
    if (/package\.json$/.test(f.path)) {
      let pkg;
      try {
        pkg = JSON.parse(txt);
      } catch {
        continue; // package.json quebrado é problema de outro check
      }
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
      for (const [nome, re] of PACOTES) {
        const casou = deps.filter((d) => re.test(d));
        if (casou.length) achadosSdk.push({ gateway: nome, arquivo: f.path, prova: casou.join(", ") });
      }
    } else {
      for (const [nome, re] of ENVS) {
        // Linha COMENTADA não é variável declarada, e isto é o mesmo defeito que o irmão levou na
        // segunda corrida com "palavra ≠ URL". A primeira corrida daqui marcou `orion` com stripe
        // por `# STRIPE_SECRET_KEY`, `goiania` com asaas por `# Asaas (cobrança de success fee…)`
        // e `sirius` por `# STRIPE_WEBHOOK_SECRET vem do endpoint…`. Comentário que ENSINA a
        // configurar a chave é o oposto de chave configurada: exige `NOME=` no começo da linha.
        const linha = txt.split("\n").find((l) => {
          const s = l.trim();
          return !s.startsWith("#") && /^[A-Z0-9_]+\s*=/.test(s) && re.test(s.split("=")[0]);
        });
        if (linha) achadosEnv.push({ gateway: nome, arquivo: f.path, prova: linha.split("=")[0].trim() });
      }
    }
  }

  const g = (as) => [...new Set(as.map((a) => a.gateway))];
  if (achadosSdk.length) baldes.sdk.push(`${p.slug} (${g(achadosSdk).join("+")})`);
  else if (achadosEnv.length) baldes.env.push(`${p.slug} (${g(achadosEnv).join("+")})`);
  else baldes.nada.push(p.slug);
  if (achadosSdk.length || achadosEnv.length) detalhe.push({ slug: p.slug, repo: nomeCompleto(p.repo), achadosSdk, achadosEnv });
  console.log(`  ${(achadosSdk.length ? "SDK" : achadosEnv.length ? "env" : "—").padEnd(4)} ${p.slug}`);
}

console.log(`\n── inventário pelo REPO (${projetos.length} projetos, ${new Date().toISOString().slice(0, 10)})`);
console.log(`SDK de pagamento no package.json   ${String(baldes.sdk.length).padStart(3)}   ${baldes.sdk.join(", ") || "—"}`);
console.log(`só variável de ambiente            ${String(baldes.env.length).padStart(3)}   ${baldes.env.join(", ") || "—"}`);
console.log(`nada no código                     ${String(baldes.nada.length).padStart(3)}`);
console.log(`repo ausente ou ilegível           ${String(baldes.sem_repo.length).padStart(3)}   ${baldes.sem_repo.join(", ") || "—"}`);

if (ver && detalhe.length) {
  console.log(`\n── a prova de cada achado`);
  for (const d of detalhe) {
    console.log(`\n  ${d.slug}  (${d.repo})`);
    for (const a of d.achadosSdk) console.log(`    SDK  ${a.gateway.padEnd(12)} ${a.arquivo} → ${a.prova}`);
    for (const a of d.achadosEnv) console.log(`    env  ${a.gateway.padEnd(12)} ${a.arquivo} → ${a.prova}`);
  }
}

// `nada no código` é "não achei SDK nem env var nos arquivos que a API entrega", nunca "não
// cobra" — exatamente a mesma ressalva do irmão, e pela mesma razão: cobrança pode morar num
// serviço fora do repo (o `sirius` fatura por tier de organização no próprio banco), num repo
// privado que o token não alcança, ou num arquivo além dos 40 primeiros que este check abre.
console.log(`\n⚠️  "nada no código" é "não achei", nunca "não cobra". Cruze com scripts/gateways.mjs:`);
console.log(`   gateway SERVIDO sem SDK no repo = cobrança por link externo (o caso do orcaobra/Kiwify).`);
console.log(`   SDK no repo sem gateway servido = integração escrita e nunca ligada — é a lacuna cara.`);
