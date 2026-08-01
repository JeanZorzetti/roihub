// Varre os documentos VIVOS procurando afirmação de presente com número — o defeito que produziu
// os 5 achados reais da primeira corrida do detector de defasagem, todos da mesma família.
//
//   node scripts/validade.mjs            # protocolos + cards + memórias
//   node scripts/validade.mjs --repo     # só o que está no repo (é o que roda no npm test)
//
// Zero LLM, zero rede, segundos. Sai 1 quando acha, para poder virar portão.
import { afirmacoesDePresente } from "../lib/validade.mjs";
import { vivosDoRepo, vivosDaMemoria } from "../lib/validade-vivos.mjs";

const arquivos = process.argv.includes("--repo") ? vivosDoRepo() : [...vivosDoRepo(), ...vivosDaMemoria()];

let total = 0;
for (const a of arquivos) {
  for (const v of afirmacoesDePresente(a.texto)) {
    total += 1;
    console.log(`${a.rel}:${v.linha}  [${v.padrao}]  ${v.trecho}`);
  }
}

console.log(`\n── ${total} afirmação(ões) de presente com número em ${arquivos.length} documentos vivos`);
if (total) {
  console.log("Conserto: apure o número (scripts/dourado-estado.mjs) ou date-o. Alvo e prazo do gate são");
  console.log("curadoria e ficam escritos; o número de HOJE não se escreve, se apura.");
}
// ⚠️ A primeira corrida deste check mede o CHECK, não os documentos. Leia os achados um a um antes
// de tratar qualquer um como defeito: das 46 primeiras violações do conformidade.mjs, 5 eram o
// check errado, e 3 dos 8 primeiros `desmente` do detector de defasagem também eram.
process.exit(total ? 1 : 0);
