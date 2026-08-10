// Sonda o ORÇAMENTO do pool antes de gastar (specs/002-observabilidade-ia US5): contas vivas,
// consumo já feito na janela e o previsto, lado a lado — em vez de descobrir no meio de uma
// corrida de régua, com o parcial gravado e nenhum número publicável (o defeito de 31/07 e
// 02/08). Custo: zero chamada de LLM — lê a série (`ia_chamadas`) e o pool datado (`ia_pool`),
// a mesma sonda da noite (SC-008).
//
//   node --env-file=.env scripts/orcamento.mjs --chamadas 85
import { orcamento } from "../lib/telemetria-db.mjs";

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const chamadasPrevistas = Number(opt("--chamadas", 0));
if (!chamadasPrevistas) {
  console.error("uso: node --env-file=.env scripts/orcamento.mjs --chamadas 85");
  process.exit(1);
}

// Números, não adjetivo (contrato): quem lê decide com contas vivas × consumo × previsto na
// mão — "arriscada" sem regra declarada é veredito que ninguém consegue conferir depois.
const r = await orcamento({ chamadasPrevistas });
console.log(`pool: ${r.contasVivas} viva(s) de ${r.contasTotal}`);
console.log(`consumo já feito na janela (24h, inclui dev): ${r.consumoNaJanela} chamada(s)`);
console.log(`previsto para esta corrida: ${r.chamadasPrevistas} chamada(s)`);
if (!r.contasVivas) console.log("\n⚠️  zero conta viva — nenhuma chamada desta corrida vai responder.");
