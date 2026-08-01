// A LISTA NOMINAL do inventário de cobrança pelo REPO. A lógica mora em `lib/gateways-repo.mjs`
// desde 01/08 (o apurador de D-80/D-81 lê a mesma); aqui é só a impressão.
//
//   node --env-file=.env scripts/gateways-repo.mjs         # os 35
//   node --env-file=.env scripts/gateways-repo.mjs --ver   # com o arquivo e a linha de cada achado
//
// Zero LLM e zero pool. Fora do `npm test`: são centenas de requisições à API do GitHub.
//
// ⚠️ VER-08, sétima vez nesta base: A PRIMEIRA CORRIDA DE UM CHECK NOVO MEDE O CHECK. A saída é
// LISTA NOMINAL de propósito. Não publique percentual daqui antes de ler as linhas uma a uma —
// as duas primeiras corridas do `gateways.mjs` acharam dois defeitos de check e zero de projeto.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inventariarRepo } from "../lib/gateways-repo.mjs";

const ver = process.argv.includes("--ver");
const projetos = JSON.parse(readFileSync(fileURLToPath(new URL("../data/projects.json", import.meta.url)), "utf8"));
if (!process.env.GITHUB_TOKEN) {
  console.error("GITHUB_TOKEN ausente. Rode com --env-file=.env.");
  process.exit(1);
}

const linhas = await inventariarRepo(projetos, {
  onProjeto: (l) => {
    if (l.balde === "sem_repo" && l.motivo) console.error(`  ⚠️  ${l.slug}: ${l.motivo}`);
    console.log(`  ${(l.balde === "sdk" ? "SDK" : l.balde === "env" ? "env" : "—").padEnd(4)} ${l.slug}`);
  },
});

const balde = (b) => linhas.filter((l) => l.balde === b);
const nomear = (b) => balde(b).map((l) => `${l.slug}${l.gateways.length ? ` (${l.gateways.join("+")})` : ""}`);

console.log(`\n── inventário pelo REPO (${projetos.length} projetos, ${new Date().toISOString().slice(0, 10)})`);
console.log(`SDK de pagamento no package.json   ${String(balde("sdk").length).padStart(3)}   ${nomear("sdk").join(", ") || "—"}`);
console.log(`só variável de ambiente            ${String(balde("env").length).padStart(3)}   ${nomear("env").join(", ") || "—"}`);
console.log(`nada no código                     ${String(balde("nada").length).padStart(3)}`);
console.log(`repo ausente ou ilegível           ${String(balde("sem_repo").length).padStart(3)}   ${nomear("sem_repo").join(", ") || "—"}`);

if (ver) {
  console.log(`\n── a prova de cada achado`);
  for (const l of linhas.filter((x) => x.achadosSdk.length || x.achadosEnv.length)) {
    console.log(`\n  ${l.slug}  (${l.repo})`);
    for (const a of l.achadosSdk) console.log(`    SDK  ${a.gateway.padEnd(12)} ${a.arquivo} → ${a.prova}`);
    for (const a of l.achadosEnv) console.log(`    env  ${a.gateway.padEnd(12)} ${a.arquivo} → ${a.prova}`);
  }
}

// `nada no código` é "não achei SDK nem env var nos arquivos que a API entrega", nunca "não
// cobra" — exatamente a mesma ressalva do irmão, e pela mesma razão: cobrança pode morar num
// serviço fora do repo (o `sirius` fatura por tier de organização no próprio banco), num repo
// privado que o token não alcança, ou num arquivo além dos 40 primeiros que este check abre.
console.log(`\n⚠️  "nada no código" é "não achei", nunca "não cobra". Cruze com scripts/gateways.mjs:`);
console.log(`   gateway SERVIDO sem SDK no repo = cobrança por link externo (o caso do orcaobra/Kiwify).`);
console.log(`   SDK no repo sem gateway servido = integração escrita e nunca ligada — é a lacuna cara.`);
