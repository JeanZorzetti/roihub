// A LISTA NOMINAL do inventário de cobrança pelo HTML SERVIDO. A lógica mora em
// `lib/gateways-servido.mjs` desde 01/08 (o apurador de D-81/D-82 lê a mesma); aqui é a impressão.
//
//   node scripts/gateways.mjs          # os 35
//   node scripts/gateways.mjs --ver    # com a evidência de cada balde
//
// Zero LLM e zero pool, como o `conformidade.mjs`: é HTTP contra os sites de produção. Fora do
// `npm test` pelo mesmo motivo — teste não faz 250 requisições contra produção.
//
// ⚠️ A PRIMEIRA CORRIDA DE UM CHECK NOVO MEDE O CHECK (VER-08, quinta vez nesta base). A saída é
// LISTA NOMINAL de propósito; percentual só na segunda corrida, depois de alguém ler as linhas.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BALDES, CAMINHOS, inventariarServido } from "../lib/gateways-servido.mjs";

const ver = process.argv.includes("--ver");
const projetos = JSON.parse(readFileSync(fileURLToPath(new URL("../data/projects.json", import.meta.url)), "utf8"));

console.log(`${projetos.length} projetos × (home + ${CAMINHOS.length} caminhos) — zero LLM, HTTP contra produção\n`);
const linhas = await inventariarServido(projetos);

for (const [balde, titulo, teste] of BALDES) {
  const g = linhas.filter((l) => l.balde === balde);
  console.log(`── ${titulo}  (${g.length})`);
  console.log(`   teste: ${teste}`);
  for (const l of g) {
    console.log(`   ${l.slug.padEnd(14)} ${l.motivo}`);
    if (ver) for (const e of l.evidencia) console.log(`   ${"".padEnd(14)}   · ${e}`);
  }
  console.log();
}

// O balde do meio é o número que muda a priorização, e é por isso que ele sai sozinho no fim.
const meio = linhas.filter((l) => l.balde === "gateway-nao-ligado");
const ligado = linhas.filter((l) => l.balde === "ligado");
console.log(`${ligado.length} ligado(s), ${meio.length} com gateway no ar e nenhuma régua lendo.`);
console.log("LISTA NOMINAL, não percentual: as duas primeiras corridas deste check mediram o CHECK.");
console.log("");
console.log("⚠️ O QUE ISTO NÃO VÊ, e muda a leitura de cada linha:");
console.log("   · Só o HTML SERVIDO. Gateway montado por JS depois de um clique não aparece.");
console.log("   · Cobrança que não passa pelo site — o `sirius` fatura por tier de organização no");
console.log("     próprio banco, e nenhuma página dele precisaria carregar gateway nenhum.");
console.log("   · Conta de gateway que existe e não está publicada (chave no .env, SDK no");
console.log("     package.json de um repo não clonado aqui).");
console.log("   Por isso `sem-gateway` significa 'não achei caminho de cobrança servido', nunca");
console.log("   'não cobra'. `n/a` não é aprovação nem reprovação.");
