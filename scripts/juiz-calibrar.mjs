// Mede o JUIZ, não a busca. Um juiz LLM não calibrado é só mais um número não-verificado, que é
// o pecado que esta base já cometeu duas vezes e documentou as duas.
//
//   node --env-file=.env scripts/juiz-calibrar.mjs          # os dois portões
//   node --env-file=.env scripts/juiz-calibrar.mjs --ver     # com o motivo de cada divergência
//
// Três portões. Os dois que DECIDEM pegam o juiz em direções opostas, e nenhum deles vale sozinho:
//   holdout      >= 85%  — 8 rotulados ANTES de o juiz vê-los; pega o juiz que REPROVA demais
//   adversarial  >= 9/10 — 10 sabidamente erradas;              pega o juiz que APROVA demais
//   regressão      —      — os 20, com 4 rótulos revisados DEPOIS de ler os motivos do juiz.
//                          Contaminado por construção: serve para comparar prompts, nunca para
//                          provar que o juiz é bom. Ele é impresso, não decide.
// Falhou um dos dois que decidem? O problema é o JUIZ, e nenhum número medido depois vale — não
// rode as 78.
//
// Custo: 38 chamadas, contra ~156 da corrida completa. É de propósito: a calibração custa 1/4 da
// medição e decide se vale gastá-la.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { julgarConcordancia, MODELO_JUIZ } from "../lib/juiz.mjs";

const ler = (nome) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${nome}`, import.meta.url)), "utf8"));
const ver = process.argv.includes("--ver");
const dourado = new Map(ler("dourado.json").map((q) => [q.id, q]));
const calib = ler("juiz-calibracao.json");
const adver = ler("juiz-adversarial.json");
const pct = (n, d) => `${d ? ((n / d) * 100).toFixed(1) : "0.0"}%`;

const total = calib.holdout.length + calib.rotulos.length + adver.casos.length;
console.log(`juiz: ${MODELO_JUIZ}   (a síntese roda em ${process.env.RERANK_MODEL || "sonnet"} — julgar com o mesmo modelo que gerou teria viés de auto-preferência)`);
console.log(`${calib.holdout.length} holdout + ${calib.rotulos.length} regressão + ${adver.casos.length} adversariais = ${total} chamadas\n`);

async function concordar(casos, titulo, decide) {
  const linhas = [];
  for (const r of casos) {
    const j = await julgarConcordancia(r.pergunta, r.resposta_gerada, dourado.get(r.id), { cache: true });
    linhas.push({ r, j });
  }
  const erros = linhas.filter((l) => l.j.erro);
  const validas = linhas.filter((l) => !l.j.erro);
  const bate = validas.filter((l) => l.j.veredito === l.r.veredito);
  const bateArm = validas.filter((l) => l.j.armadilha === l.r.armadilha);

  console.log(`── ${titulo}`);
  console.log(`veredito   ${pct(bate.length, validas.length).padStart(7)}  (${bate.length}/${validas.length})${decide ? "   ← portão: >= 85%" : "   (não decide: contaminado)"}`);
  console.log(`armadilha  ${pct(bateArm.length, validas.length).padStart(7)}  (${bateArm.length}/${validas.length})`);
  if (erros.length) console.log(`⚠️  ${erros.length} sem veredito parseável: ${erros.map((l) => `${l.r.id}=${l.j.erro}`).join(", ")}`);

  // A matriz importa mais que o agregado: um juiz que erra só entre `correta` e `incompleta` é
  // utilizável; um que confunde `contradiz` com `correta` é o que este projeto existe para evitar.
  const matriz = {};
  for (const l of validas) {
    const k = `${l.r.veredito} → ${l.j.veredito}`;
    matriz[k] = (matriz[k] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(matriz).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(24)} ${n}${k.split(" → ")[0] === k.split(" → ")[1] ? "" : "   ✗"}`);
  }
  for (const l of validas.filter((x) => x.j.veredito !== x.r.veredito)) {
    console.log(`\n  ${l.r.id} [${l.r.camada}] rótulo=${l.r.veredito} juiz=${l.j.veredito}`);
    console.log(`    juiz:   ${l.j.motivo}`);
    if (ver) console.log(`    rótulo: ${l.r.motivo}`);
  }
  return validas.length ? bate.length / validas.length : 0;
}

// ── Portão 1: o número limpo. Rotulado antes de o juiz ver os casos.
const limpo = await concordar(calib.holdout, `portão 1: holdout cego — ${calib.holdout.length} rotulados antes de o juiz vê-los`, true);
console.log();
await concordar(calib.rotulos, `regressão: os ${calib.rotulos.length} rótulos (4 revisados depois da 1ª corrida)`, false);

// ── Portão 2: adversarial
console.log(`\n── portão 2: ${adver.casos.length} respostas sabidamente erradas`);
const advs = [];
for (const c of adver.casos) {
  const q = dourado.get(c.id);
  const j = await julgarConcordancia(q.pergunta, c.resposta_corrompida, q, { cache: true });
  // Reprovar é qualquer um dos dois eixos: as corrupções atacam veredito OU armadilha.
  advs.push({ c, j, reprovou: !j.erro && (j.veredito !== "correta" || j.armadilha === "caiu") });
}
const reprovadas = advs.filter((a) => a.reprovou);
console.log(`reprovou   ${String(reprovadas.length).padStart(2)}/${adver.casos.length}   ← portão: >= 9/10`);
for (const a of advs) {
  const marca = a.reprovou ? "ok" : "❌";
  console.log(`  ${marca} ${a.c.id.padEnd(6)} ${a.c.corrupcao.padEnd(38)} juiz=${a.j.veredito || a.j.erro}/${a.j.armadilha || "—"}`);
  if (ver || !a.reprovou) console.log(`       ${a.j.motivo}`);
}

const p1 = limpo >= 0.85;
const p2 = reprovadas.length >= 9;
console.log(`\n${p1 ? "✅" : "🚩"} portão 1 (holdout cego >= 85%)   ${p1 ? "passou" : "REPROVOU"}  ${pct(limpo, 1)}`);
console.log(`${p2 ? "✅" : "🚩"} portão 2 (adversarial >= 9/10)   ${p2 ? "passou" : "REPROVOU"}`);
if (!p1 || !p2) {
  console.log("\nPare aqui. O problema é o prompt do juiz, e nenhum número medido depois disso vale.");
  process.exitCode = 1;
}
