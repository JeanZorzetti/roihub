// `node --env-file=.env scripts/vendas-mercadopago.mjs [--projeto atma] [--escrever]`
//
// Puxa os pagamentos do Mercado Pago, descarta teste e estorno, e escreve `vendas` no card. Zero
// LLM. É a primeira régua desta casa que toca DINHEIRO: até 31/07 `receita` era nota 0-10 de
// prioridade e `receitaNota` era prosa — o hub dizia ao Jean o que fazer hoje usando um palpite
// sobre faturamento.
//
// ⚠️ `vendas` NÃO se cura à mão. O valor deste campo é ser derivado do gateway; preenchido por
// alguém, ele volta a ser a frase que já estava em `receitaNota`, só que com aparência de fato.
// Por isso a escrita é deste script e o default é só imprimir.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { classificarPagamentos, pagamentosDoMercadoPago, somar } from "../lib/vendas.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const CAMINHO = join(RAIZ, "data/projects.json");

const args = process.argv.slice(2);
const iProjeto = args.indexOf("--projeto");
const slug = iProjeto === -1 ? "atma" : args[iProjeto + 1];
const escrever = args.includes("--escrever");

const pagamentos = await pagamentosDoMercadoPago();
const { vendas, descartadas } = classificarPagamentos(pagamentos);

console.log(`\n${pagamentos.length} pagamento(s) na conta do Mercado Pago.\n`);

// Lista NOMINAL com motivo, nunca "N descartados". Foi ler as linhas uma a uma que pegou 5 dos 46
// achados de conformidade e 3 dos 8 `desmente` — e é o que separa "0 vendas" de "0 vendas porque
// os 20 pagamentos são o Jean testando o checkout".
const porMotivo = descartadas.reduce((a, d) => ({ ...a, [d.motivo]: (a[d.motivo] ?? 0) + 1 }), {});
for (const [motivo, n] of Object.entries(porMotivo)) console.log(`  ⃠ ${n} descartado(s): ${motivo}`);
for (const v of vendas) console.log(`  ✓ ${v.data}  R$ ${v.valor.toFixed(2)}  (${v.fonte} #${v.id})`);

const projetos = JSON.parse(readFileSync(CAMINHO, "utf8"));
const card = projetos.find((p) => p.slug === slug);
if (!card) {
  console.error(`\nprojeto ${slug} não está em data/projects.json`);
  process.exit(1);
}

// O aceite da frente: o que o card AFIRMAVA lado a lado com o que o gateway pagou. Sem esta linha
// o script troca uma afirmação por outra em silêncio e ninguém vê que a casa estava errada.
console.log(`\n${slug} — o card afirma:`);
console.log(`  receita ${card.receita}/10 · ${card.receitaNota}`);
console.log(`${slug} — o gateway pagou:`);
console.log(`  ${vendas.length} venda(s), R$ ${somar(vendas).toFixed(2)} — apurado em ${new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10)}`);

if (!escrever) {
  console.log("\n(--escrever para gravar `vendas` no card)");
  process.exit(0);
}

card.vendas = vendas;
// Round-trip com 2 espaços preserva o arquivo byte a byte (conferido em 31/07). `data/projects.json`
// é UTF-8 e o `Get-Content` do PowerShell mostra mojibake — editar a partir do que o terminal
// imprime corrompe o arquivo.
writeFileSync(CAMINHO, JSON.stringify(projetos, null, 2) + "\n", "utf8");
console.log(`\n✓ data/projects.json: ${slug}.vendas = ${vendas.length} venda(s)`);
