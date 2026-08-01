// Mede o DETECTOR DE DEFASAGEM, não o corpus. Sem isto, nenhum percentual de defasagem sai —
// inclusive o 16,7% que já circulou: a primeira corrida deu 8 `desmente` e ler os 8 baixou para 5,
// o que dá 62,5% de precisão nos próprios flags. Um detector com 62,5% rodado sobre 272 documentos
// produz uma lista em que um terço é ruído, e lista com ruído não é lida duas vezes.
//
//   node --env-file=.env scripts/defasagem-calibrar.mjs          # os dois portões
//   node --env-file=.env scripts/defasagem-calibrar.mjs --ver     # com o meu motivo em cada divergência
//
// Dois portões, e eles pegam o detector em direções OPOSTAS:
//   holdout      >= 85%  — 20 pares rotulados à mão ANTES de rodar; pega o que ACUSA demais
//   adversarial  >= 9/10 — 10 documentos corrompidos de propósito; pega o que ABSOLVE tudo
//
// Os dois fixtures são CONGELADOS (`data/defasagem-*.json`): apurado e trecho vêm inlinados, com
// o mesmo orçamento de recorte da produção (2400). Regenerá-los depois de ler o veredito é a
// contaminação que o portão existe para impedir — a mesma regra do `veredito_original` do juiz.
//
// O holdout é de propósito NÃO-monocultura: o material real tem 5 dos 5 achados na família
// `(hoje N)`, e calibrar contra isso mediria uma regex, não um detector. Entram à força o passado
// datado (não é `desmente`), o documento de outro projeto (não é), o número certo com ressalva de
// medição (não é), a citação entre crases (não é), o número errado no presente (é) e a negação do
// que a fonte viva mostra (é). Dois adversariais são o ESPELHO de dois casos do holdout — a mesma
// frase com a data arrancada e a citação tirada das crases —, senão um detector que absolve por
// atacado passaria nos dois portões.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { montarPromptDefasagem, parseDefasagem } from "../lib/defasagem.mjs";
import { rodarClaude, rodarCacheado, falhasDeConta, MAX_CONTA_SEGUIDAS } from "../lib/reranker.mjs";

const ler = (nome) => JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${nome}`, import.meta.url)), "utf8"));
const ver = process.argv.includes("--ver");
const holdout = ler("defasagem-calibracao.json");
const adver = ler("defasagem-adversarial.json");
const pct = (n, d) => `${d ? ((n / d) * 100).toFixed(1) : "0.0"}%`;

console.log(`${holdout.casos.length} holdout (congelado em ${holdout.congelado_em}) + ${adver.casos.length} adversariais = ${holdout.casos.length + adver.casos.length} chamadas`);
console.log(`recorte: ${holdout.orcamento} chars, o MESMO de scripts/corpus-defasado.mjs\n`);

// ⚠️ A PRIMEIRA CORRIDA DESTE CHECK MEDIU O CHECK, como nas quatro anteriores desta base. Eu
// rotulei 20 pares lendo uma janela do documento que escolhi à mão, mas o fixture congelou a
// janela que a PRODUÇÃO recorta (`trechoRelevante`, 2400 chars) — e em 6 dos 20 a frase que meu
// rótulo cita simplesmente não estava no que o detector recebeu. Rótulo assim não mede detector
// nenhum: mede a minha leitura de um texto que ele nunca viu.
//
// A regra é MECÂNICA de propósito, e checável sem olhar veredito nenhum: cada caso declara a
// `ancora` — a frase literal de que o rótulo depende. Se o trecho congelado não a contém, o caso
// sai, e sai antes de qualquer chamada. Excluir por âncora ausente é conserto de CONSTRUÇÃO;
// excluir porque o detector discordou seria ajustar o gabarito depois da prova, que é o erro que
// custou 3 horas em 30/07.
const invalidos = holdout.casos.filter((c) => c.ancora && !c.doc.trecho.includes(c.ancora));
const casos = holdout.casos.filter((c) => !invalidos.includes(c));
if (invalidos.length) {
  console.log(`🚩 ${invalidos.length} caso(s) INVÁLIDOS POR CONSTRUÇÃO — o rótulo cita texto que o detector não recebeu:`);
  for (const c of invalidos) console.log(`   ${c.id} × ${c.doc.id.padEnd(42)} âncora ausente: "${c.ancora}"`);
  console.log(`   o portão roda nos ${casos.length} restantes.\n`);
}

let seguidas = 0;
async function julgar(caso) {
  const prompt = montarPromptDefasagem(caso.pergunta, caso.apurado, caso.doc);
  try {
    return parseDefasagem(await rodarCacheado(prompt, (p) => rodarClaude(p, { effort: "medium" }), true));
  } catch (err) {
    return { veredito: "", trecho: "", motivo: "", erro: err.message.replace(/^rerank-/, "defasagem-") };
  }
}

// ── Portão 1: holdout cego
const linhas = [];
for (const c of casos) {
  const j = await julgar(c);
  linhas.push({ c, j });
  seguidas = falhasDeConta(seguidas, [j.erro]);
  if (seguidas >= MAX_CONTA_SEGUIDAS) break;
}

const validas = linhas.filter((l) => !l.j.erro);
const acertos = validas.filter((l) => l.j.veredito === l.c.veredito);
const erros = linhas.filter((l) => l.j.erro);

console.log(`── portão 1: holdout cego — ${casos.length} pares rotulados antes de o detector vê-los`);
console.log(`acerto  ${pct(acertos.length, validas.length).padStart(7)}  (${acertos.length}/${validas.length})   ← portão: >= 85%`);
if (erros.length) console.log(`⚠️  ${erros.length} sem veredito parseável: ${erros.map((l) => `${l.c.doc.id}=${l.j.erro}`).join(", ")}`);

// A matriz importa mais que o agregado. Um detector que troca `bate` por `nao-fala` é utilizável —
// os dois significam "não há nada a consertar aqui". Um que devolve `desmente` onde o rótulo é
// `bate` fabrica tarefa, e um que devolve `bate` onde o rótulo é `desmente` esconde corpus podre.
const matriz = {};
for (const l of validas) {
  const k = `${l.c.veredito} → ${l.j.veredito}`;
  matriz[k] = (matriz[k] ?? 0) + 1;
}
for (const [k, n] of Object.entries(matriz).sort((a, b) => b[1] - a[1])) {
  const [rot, det] = k.split(" → ");
  console.log(`  ${k.padEnd(26)} ${n}${rot === det ? "" : rot === "desmente" ? "   ✗ ESCONDE" : det === "desmente" ? "   ✗ FABRICA" : "   ✗"}`);
}
for (const l of validas.filter((x) => x.j.veredito !== x.c.veredito)) {
  console.log(`\n  ${l.c.id} × ${l.c.doc.id}  [${l.c.categoria}]`);
  console.log(`    rótulo=${l.c.veredito}  detector=${l.j.veredito}`);
  console.log(`    detector: ${l.j.motivo}`);
  if (ver) console.log(`    eu:       ${l.c.motivo}`);
}

// ── Portão 2: adversarial
console.log(`\n── portão 2: ${adver.casos.length} documentos corrompidos de propósito`);
const advs = [];
for (const c of adver.casos) {
  const j = await julgar(c);
  advs.push({ c, j, pegou: !j.erro && j.veredito === "desmente" });
  seguidas = falhasDeConta(seguidas, [j.erro]);
  if (seguidas >= MAX_CONTA_SEGUIDAS) break;
}
const pegou = advs.filter((a) => a.pegou);
console.log(`pegou   ${String(pegou.length).padStart(2)}/${adver.casos.length}   ← portão: >= 9/10`);
for (const a of advs) {
  console.log(`  ${a.pegou ? "ok" : "❌"} ${a.c.id} ${a.c.doc.id.padEnd(42)} ${a.c.corrupcao.padEnd(44)} → ${a.j.veredito || a.j.erro}`);
  if (ver || !a.pegou) console.log(`       ${a.j.motivo}`);
}

// Pool morto não publica número: número plausível com o instrumento quebrado é pior que número
// nenhum. Mesma regra de scripts/corpus-defasado.mjs e scripts/avaliar-resposta.mjs.
if (seguidas >= MAX_CONTA_SEGUIDAS) {
  console.log(`\n🚨 corrida ABORTADA: ${MAX_CONTA_SEGUIDAS} falhas de conta seguidas — pool esgotado, nenhum número desta corrida vale.`);
  process.exit(1);
}

const p1 = validas.length === casos.length && acertos.length / validas.length >= 0.85;
const p2 = pegou.length >= 9;
console.log(`\n${p1 ? "✅" : "🚩"} portão 1 (holdout cego >= 85%)   ${p1 ? "passou" : "REPROVOU"}  ${pct(acertos.length, validas.length)}`);
console.log(`${p2 ? "✅" : "🚩"} portão 2 (adversarial >= 9/10)   ${p2 ? "passou" : "REPROVOU"}  ${pegou.length}/${adver.casos.length}`);
if (!p1 || !p2) {
  console.log("\nPare aqui. O problema é o PROMPT do detector, e nenhum percentual de defasagem medido depois vale — inclusive o 16,7%.");
  process.exitCode = 1;
} else {
  console.log("\nOs dois portões passaram: `scripts/corpus-defasado.mjs` pode publicar percentual, com estes dois números impressos ao lado.");
}
