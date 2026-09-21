// 052 — a testemunha independente das SC-002 e SC-005: lê HTML já baixado (o `curl` do
// quickstart), passa pelo texto visível de `<main>` (research D12) e compara ou reprova.
//
//   node scripts/conferir-mapa.mjs numeros <antes.html> <depois.html>
//   node scripts/conferir-mapa.mjs alheio <html> <Nome>
//
// Sem rede, sem `.env`: os dois modos só leem arquivo. `numeros` confere a SC-002 (todo número da
// Atma igual antes e depois, na mesma posição); `alheio` confere a SC-005 (nenhuma frase que
// afirma algo sobre o projeto medido nomeia outro projeto, fora de EVIDENCIAS).
import { readFileSync } from "node:fs";
import { EVIDENCIAS, textoDoMain, frasesAlheias, numerosDoMapa } from "../lib/mapa-projeto.mjs";

const [modo, ...resto] = process.argv.slice(2);

if (modo === "numeros") {
  const [antesPath, depoisPath] = resto;
  if (!antesPath || !depoisPath) throw new Error("uso: conferir-mapa.mjs numeros <antes.html> <depois.html>");
  const antes = numerosDoMapa(textoDoMain(readFileSync(antesPath, "utf8")));
  const depois = numerosDoMapa(textoDoMain(readFileSync(depoisPath, "utf8")));
  const divergeEm = antes.findIndex((n, i) => n !== depois[i]);
  if (divergeEm === -1 && antes.length === depois.length) {
    console.log(`iguais: ${antes.length} números`);
    process.exit(0);
  }
  const i = divergeEm === -1 ? Math.min(antes.length, depois.length) : divergeEm;
  console.log(`diverge na posição ${i}: antes=${antes[i] ?? "‹fim›"} depois=${depois[i] ?? "‹fim›"}`);
  console.log(`total: antes=${antes.length} depois=${depois.length}`);
  process.exit(1);
}

if (modo === "alheio") {
  const [htmlPath, nome] = resto;
  if (!htmlPath || !nome) throw new Error("uso: conferir-mapa.mjs alheio <html> <Nome>");
  const texto = textoDoMain(readFileSync(htmlPath, "utf8"));
  const frases = frasesAlheias(texto, nome, EVIDENCIAS);
  for (const f of frases) console.log(f);
  process.exit(frases.length ? 1 : 0);
}

throw new Error("uso: conferir-mapa.mjs numeros <antes.html> <depois.html> | conferir-mapa.mjs alheio <html> <Nome>");
