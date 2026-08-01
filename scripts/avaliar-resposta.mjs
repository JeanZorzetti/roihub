// Mede a SÍNTESE, não a recuperação. `scripts/avaliar.mjs` responde "o doc certo está entre os
// 10?"; este responde "a resposta escrita aponta para o doc certo?".
//
//   node --env-file=.env scripts/avaliar-resposta.mjs --limite 5   # itera barato antes das 78
//   node --env-file=.env scripts/avaliar-resposta.mjs
//
// O QUE ISTO NÃO MEDE: verdade. Uma resposta pode citar a fonte certa e resumi-la errado, e
// ancoragem 100% sobre um corpus com afirmação errada é acesso rápido à resposta errada — o
// problema que o handoff de 31/07 lista como o 3º e o único sem métrica. Julgar o conteúdo
// exigiria um juiz LLM (mais 78 chamadas por corrida) e um juiz que não vê a realidade só
// mediria concordância com o dourado. O que dá para medir de graça, e é o que este script mede:
// a resposta existe, ela cita, e a citação aponta para uma fonte que o dourado reconhece.
//
// Custo: 1 chamada de claude-cli por pergunta ALÉM do rerank. Com `.cache/rerank.json` morno o
// rerank sai de graça e só a síntese gasta pool. Corrida morta retoma de onde parou.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { carregarCorpus, MEMORIA_PADRAO } from "../lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "../lib/bm25.mjs";
import { indexarDenso, buscarDenso } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";
import { rerank, trechoRelevante, falhasDeConta, MAX_CONTA_SEGUIDAS } from "../lib/reranker.mjs";
import { responder, trechosPara } from "../lib/resposta.mjs";
import { julgarConcordancia, julgarFidelidade, MODELO_JUIZ } from "../lib/juiz.mjs";

const opt = (nome, padrao) => {
  const i = process.argv.indexOf(nome);
  return i === -1 ? padrao : process.argv[i + 1];
};
const limite = Number(opt("--limite", 0));
// `--limite N` pega as N primeiras, que são todas de camada `protocolo` — serve para iterar
// barato, não para recortar amostra. `--ids D-66,D-74` existe porque toda inspeção que importa é
// de um subconjunto escolhido (as 8 de `estado`, os casos que o juiz marcou `contradiz`).
const ids = String(opt("--ids", "")).split(",").map((s) => s.trim()).filter(Boolean);
// Fora do default de propósito: sem juiz o script custa 1 chamada por pergunta, com juiz custa 3.
// Ancoragem é determinística e barata e roda toda entrega; o juiz roda quando se mexe na síntese.
const juiz = process.argv.includes("--juiz");
const K = 10;
const CANDIDATOS = 50;

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"))
  .filter((q) => !ids.length || ids.includes(q.id))
  .slice(0, limite || undefined);
const docs = carregarCorpus();
const porId = new Map(docs.map((d) => [d.id, d]));
const tipos = docs.reduce((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});
console.log(`corpus: ${docs.length} docs (${Object.entries(tipos).map(([t, n]) => `${n} ${t}`).join(", ")})`);
if (!tipos.memoria) console.log(`⚠️  sem memórias (${MEMORIA_PADRAO} não existe) — metade do corpus está fora`);

const ixBM25 = indexar(docs);
const ixDenso = await indexarDenso(docs);
console.log(
  juiz
    ? `síntese + juiz (${MODELO_JUIZ}): 3 chamadas por pergunta (${dourado.length}), além do rerank\n`
    : `síntese: 1 chamada de claude-cli por pergunta (${dourado.length}), além do rerank\n`,
);

// O MESMO caminho da aba: fusão → rerank → top-10 → síntese. Medir a síntese sobre uma lista
// montada de outro jeito não diria nada sobre o que está no ar.
async function top10(pergunta) {
  const base = rrf(
    [buscar(ixBM25, pergunta, CANDIDATOS), await buscarDenso(ixDenso, pergunta, CANDIDATOS, { cache: true })],
    { k: CANDIDATOS },
  );
  const termos = tokenizar(pergunta);
  const candidatos = base
    .filter((r) => porId.has(r.id))
    .map((r) => {
      const d = porId.get(r.id);
      return { id: r.id, tipo: d.tipo, titulo: d.titulo, trecho: trechoRelevante(d.texto, termos) };
    });
  const { itens } = await rerank(pergunta, candidatos, { cache: true });
  return { ids: itens.slice(0, K).map((c) => c.id), termos };
}

const linhas = [];
// Corrida que perde o pool tem que PARAR. A de 31/07 continuou até o fim e imprimiu agregado com
// casa decimal por cima de 15 perguntas que ninguém respondeu — número plausível com o
// instrumento quebrado é pior que número nenhum, e é o modo de falha que este projeto existe
// para eliminar. Contado por `-conta`, nunca por "deu erro": erro de prompt é resultado.
let seguidas = 0;
for (const q of dourado) {
  const { ids, termos } = await top10(q.pergunta);
  const trechos = trechosPara(ids.map((id) => porId.get(id)), termos);
  const r = await responder(q.pergunta, trechos, { cache: true });
  const alvos = new Set(q.fontes.filter((f) => porId.has(f)));
  // Teto honesto: se nenhuma fonte do dourado entrou no top-10, não havia o que citar certo —
  // sem separar isso, falha de RECUPERAÇÃO seria contada como falha de SÍNTESE.
  const tinha = ids.some((id) => alvos.has(id));
  const citadas = r.fontes.map((n) => ids[n - 1]);
  const linha = { q, r, tinha, ancorada: citadas.some((id) => alvos.has(id)), citadas, ids };
  if (juiz && r.erro) {
    // Resposta SUPRIMIDA não é recusa: julgá-la creditaria como `recusou` — que é o sistema
    // acertando — o que na verdade é o componente quebrado. As três causas de texto vazio ficam
    // separadas em `responder()` e têm que continuar separadas aqui.
    linha.b = { veredito: "", armadilha: "", motivo: "", erro: r.erro };
  } else if (juiz) {
    // Só os trechos CITADOS vão para a passada A, com a numeração que o texto usa. As duas
    // passadas são chamadas separadas de propósito: juntar economiza uma e destrói a célula
    // `fiel + discorda`, que é o único sinal deste sistema que aponta para dentro do corpus.
    const citados = r.fontes.map((n) => ({ n, ...trechos[n - 1] }));
    linha.b = await julgarConcordancia(q.pergunta, r.texto, q, { cache: true });
    linha.a = await julgarFidelidade(q.pergunta, r.texto, citados, { cache: true });
  }
  linhas.push(linha);
  // Número não pega resposta FLUENTE e errada — ancoragem 100% com o resumo trocado marca certo.
  // Ler as respostas é a única checagem que pega isso, e sem `--ver` ela custaria outro script.
  if (process.argv.includes("--ver")) {
    console.log(`\n${q.id} ${q.pergunta}\n  → ${r.texto || `(vazio${r.erro ? `: ${r.erro}` : ": recusou"})`}`);
    console.log(`  citou: ${citadas.join(", ") || "—"}   esperado: ${q.fontes.join(", ")}`);
    if (juiz) console.log(`  juiz: ${linha.b.veredito}/${linha.b.armadilha} · ${linha.a.fiel === null ? "—" : linha.a.fiel ? "fiel" : "infiel"} · ${linha.b.motivo}`);
  }
  seguidas = falhasDeConta(seguidas, [linha.r.erro, linha.b?.erro, linha.a?.erro]);
  if (seguidas >= MAX_CONTA_SEGUIDAS) break;
}
const abortada = seguidas >= MAX_CONTA_SEGUIDAS;

// Sem histórico, "melhorou?" não tem resposta: esta base já mediu 83,0% e 82,4% no mesmo corpus
// sem uma linha de código mudar, porque reescrever handoff e memória mexe em vetor e IDF.
// `incompleto` é gravado no arquivo, e não só impresso, porque quem compara corridas lê o JSON
// meses depois: parcial sem carimbo vira, na próxima sessão, uma queda de qualidade inventada.
function gravarCorrida(incompleto) {
  const agora = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const arq = fileURLToPath(new URL(`../data/juiz-corridas/${agora}.json`, import.meta.url));
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(
    arq,
    JSON.stringify(
      {
        quando: new Date().toISOString(),
        incompleto,
        modelo_juiz: MODELO_JUIZ,
        modelo_sintese: process.env.RERANK_MODEL || "sonnet",
        perguntas: linhas.length,
        de: dourado.length,
        casos: linhas.map((l) => ({
          id: l.q.id,
          camada: l.q.camada,
          resposta: l.r.texto,
          erro: l.r.erro,
          citadas: l.citadas,
          ancorada: l.ancorada,
          veredito: l.b?.veredito ?? "",
          armadilha: l.b?.armadilha ?? "",
          motivo_b: l.b?.motivo ?? "",
          fiel: l.a?.fiel ?? null,
          motivo_a: l.a?.motivo ?? "",
          erro_juiz: l.b?.erro || l.a?.erro || "",
        })),
      },
      null,
      2,
    ) + "\n",
  );
  return agora;
}

// Agregado de corrida abortada não é impresso NUNCA — nem com aviso. O relatório de 31/07 trazia
// o aviso das 15 suprimidas e mesmo assim publicou 19,2% de recusa: aviso ao lado de percentual
// perde para o percentual. O que sobra é o parcial em disco, marcado, para ser retomado.
if (abortada) {
  console.log(`\n🚨 corrida ABORTADA em ${linhas.length}/${dourado.length}: ${MAX_CONTA_SEGUIDAS} falhas de conta seguidas.`);
  console.log("   O pool esgotou (401/403/429 em toda conta) — nenhum número desta corrida vale.");
  console.log("   Renove os tokens e rode de novo: o cache morno retoma de onde parou.");
  if (juiz) console.log(`   parcial marcado incompleto em data/juiz-corridas/${gravarCorrida(true)}.json`);
  process.exit(1);
}

const pct = (n, d) => `${d ? ((n / d) * 100).toFixed(1) : "0.0"}%`;
const respondidas = linhas.filter((l) => l.r.texto);
const recusas = linhas.filter((l) => !l.r.texto && !l.r.erro);
const falhas = linhas.filter((l) => l.r.erro);
const comMaterial = linhas.filter((l) => l.tinha);

console.log(`── síntese — ${linhas.length} perguntas`);
console.log(`respondeu       ${pct(respondidas.length, linhas.length).padStart(7)}  (${respondidas.length})`);
console.log(`recusou         ${pct(recusas.length, linhas.length).padStart(7)}  (${recusas.length})`);
console.log(`suprimida/erro  ${pct(falhas.length, linhas.length).padStart(7)}  (${falhas.length})`);
console.log(`\ntop-10 tinha fonte do dourado  ${pct(comMaterial.length, linhas.length).padStart(7)}   ← teto da síntese`);
console.log(`citação ancorada (respondidas) ${pct(respondidas.filter((l) => l.ancorada).length, respondidas.length).padStart(7)}`);
console.log(
  `citação ancorada (com material) ${pct(
    comMaterial.filter((l) => l.r.texto && l.ancorada).length,
    comMaterial.length,
  ).padStart(6)}   ← o número que mede a síntese`,
);

// Respondeu citando SÓ doc que o dourado não reconhece, tendo a fonte certa na mão: é a falha
// cara, porque a resposta sai fluente e conferível-parecendo. Listada com nome para inspeção.
const desancoradas = comMaterial.filter((l) => l.r.texto && !l.ancorada);
if (desancoradas.length) {
  console.log(`\ntinha a fonte no top-10 e citou outra coisa (${desancoradas.length}):`);
  for (const l of desancoradas) {
    console.log(`  ${l.q.id}  citou: ${l.citadas.join(", ") || "—"}`);
    console.log(`      esperado: ${l.q.fontes.join(", ")}`);
  }
}
const recusouComMaterial = comMaterial.filter((l) => !l.r.texto && !l.r.erro);
if (recusouComMaterial.length) {
  console.log(`\nrecusou com a fonte no top-10 (${recusouComMaterial.length}): ${recusouComMaterial.map((l) => l.q.id).join(", ")}`);
}
if (falhas.length) {
  const conta = falhas.reduce((a, l) => ({ ...a, [l.r.erro]: (a[l.r.erro] ?? 0) + 1 }), {});
  console.log(`\n⚠️  ${falhas.length} respostas suprimidas: ${JSON.stringify(conta)}`);
}

if (juiz) {
  const CAMADAS = ["protocolo", "estado", "episodio"];
  const VER = ["correta", "incompleta", "contradiz", "recusou"];
  const julgadas = linhas.filter((l) => l.b && !l.b.erro);
  const erroJuiz = linhas.filter((l) => l.b?.erro);

  console.log(`\n── juiz (${MODELO_JUIZ}) — ${julgadas.length} de ${linhas.length} julgadas`);
  console.log("O QUE ISTO MEDE: se o que o sistema escreveu bate com o que a instituição sabe.");
  console.log("O QUE NÃO MEDE: se o que a instituição sabe é verdade — o dourado saiu do mesmo corpus.\n");

  // O agregado é dominado por `protocolo` (65 das 78) e esconde justamente o que interessa:
  // `estado` apodrece por construção e `episodio` é onde a síntese tem mais espaço para inventar
  // causa. Foi a quebra por camada que impediu o vetor de ser descartado na fase 3.
  console.log(`${"".padEnd(11)}${VER.map((v) => v.padStart(11)).join("")}${"armadilha".padStart(12)}`);
  for (const camada of [...CAMADAS, "TOTAL"]) {
    const g = camada === "TOTAL" ? julgadas : julgadas.filter((l) => l.q.camada === camada);
    if (!g.length) continue;
    const cels = VER.map((v) => `${pct(g.filter((l) => l.b.veredito === v).length, g.length)}`.padStart(11));
    const caiu = g.filter((l) => l.b.armadilha === "caiu").length;
    console.log(`${`${camada} ${g.length}`.padEnd(11)}${cels.join("")}${`caiu ${caiu}`.padStart(12)}`);
  }

  // A tabela cruzada é o motivo de existirem duas passadas. `fiel + discorda` não é falha da
  // síntese: é uma resposta derivada corretamente das fontes que contradiz o que a instituição
  // julga saber — ou seja, contradição entre dois documentos do corpus.
  const comA = julgadas.filter((l) => l.a && l.a.fiel !== null);
  const concorda = (l) => l.b.veredito === "correta";
  const cruz = (fiel, ok) => comA.filter((l) => l.a.fiel === fiel && concorda(l) === ok);
  console.log(`\nfidelidade × concordância (${comA.length} com as duas passadas)`);
  console.log(`  fiel   + concorda   ${String(cruz(true, true).length).padStart(3)}   resposta boa`);
  console.log(`  infiel + discorda   ${String(cruz(false, false).length).padStart(3)}   a síntese errou — bug de prompt/recorte`);
  console.log(`  infiel + concorda   ${String(cruz(false, true).length).padStart(3)}   acertou por sorte; o corpus não sustenta o que ela disse`);
  console.log(`  fiel   + discorda   ${String(cruz(true, false).length).padStart(3)}   🚨 ou o dourado está errado, ou o corpus está errado`);

  // Estes três blocos existem para serem LIDOS. `contradiz` manda a próxima sessão fazer a coisa
  // errada com confiança, e `fiel + discorda` é o retorno mais alto da frente inteira — nenhum
  // dos dois vira número publicável sem passar por olho humano.
  const listar = (titulo, ls, extra = () => "") => {
    if (!ls.length) return;
    console.log(`\n${titulo} (${ls.length}) — LEIA um a um antes de publicar número:`);
    for (const l of ls) console.log(`  ${l.q.id} [${l.q.camada}] ${l.b.motivo}${extra(l)}`);
  };
  listar("contradiz", julgadas.filter((l) => l.b.veredito === "contradiz"));
  listar("caiu na armadilha", julgadas.filter((l) => l.b.armadilha === "caiu"));
  listar("fiel + discorda — candidatos a erro no corpus ou no dourado", cruz(true, false), (l) => `\n      fidelidade: ${l.a.motivo}`);
  if (erroJuiz.length) console.log(`\n⚠️  ${erroJuiz.length} sem veredito: ${erroJuiz.map((l) => `${l.q.id}=${l.b.erro}`).join(", ")}`);

  console.log(`\ngravado em data/juiz-corridas/${gravarCorrida(false)}.json`);
}
