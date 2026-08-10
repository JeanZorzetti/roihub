import test from "node:test";
import assert from "node:assert/strict";
import { montarPrompt, parseOrdem, reordenar, rerank, rodarClaude, trechoRelevante, trocaDeConta, classificarConta, falhasDeConta, MAX_CONTA_SEGUIDAS, chave } from "../lib/reranker.mjs";

const candidatos = [
  { id: "a", tipo: "protocolo", titulo: "A", trecho: "texto a" },
  { id: "b", tipo: "memoria", titulo: "B", trecho: "texto b" },
  { id: "c", tipo: "handoff", titulo: "C", trecho: "texto c" },
];
const ids = (itens) => itens.map((c) => c.id).join(",");

test("prompt leva todos os candidatos, indexados e com tipo", () => {
  const p = montarPrompt("por que", candidatos);
  for (const [i, c] of candidatos.entries()) {
    assert.ok(p.includes(`[${i}] (${c.tipo}) ${c.titulo}`), `faltou o candidato ${i}`);
    assert.ok(p.includes(c.trecho));
  }
  assert.ok(p.includes("por que"));
});

test("parseOrdem lê array cru, em fence e no meio de prosa", () => {
  assert.deepEqual(parseOrdem("[2, 0, 1]", 3), [2, 0, 1]);
  assert.deepEqual(parseOrdem("```json\n[1, 2]\n```", 3), [1, 2]);
  assert.deepEqual(parseOrdem("Analisei os docs. Resposta: [0, 2]", 3), [0, 2]);
});

// O modelo escreve lista markdown antes do array; recortar do 1o "[" ao último "]" pegaria
// "[1] (protocolo) ... [0, 2]" e não parsearia. Mesma armadilha do parseJsonBlock com "{".
test("parseOrdem ignora colchetes de prosa antes do array", () => {
  assert.deepEqual(parseOrdem("O melhor é o [1] pelo motivo X.\nOrdem: [1, 0]", 3), [1, 0]);
});

test("parseOrdem descarta índice fora da faixa e repetido", () => {
  assert.deepEqual(parseOrdem("[0, 99, 1, 0, -1]", 3), [0, 1]);
});

test("parseOrdem devolve vazio quando não há array de números", () => {
  assert.deepEqual(parseOrdem("não consegui ordenar", 3), []);
  assert.deepEqual(parseOrdem("", 3), []);
  assert.deepEqual(parseOrdem('["a","b"]', 3), []);
});

// A garantia que impede o reranker de PERDER documento que a fusão já achou.
test("reordenar mantém os não citados no fim, na ordem original", () => {
  assert.equal(ids(reordenar(candidatos, [2])), "c,a,b");
  assert.equal(ids(reordenar(candidatos, [1, 0, 2])), "b,a,c");
  assert.equal(reordenar(candidatos, [2]).length, candidatos.length);
});

// Funde, não obedece: obedecer foi medido duas vezes e perdeu (@10 76,7% contra 82,4% da
// fusão). O que o modelo escolhe sobe, mas o topo da fusão não é descartado.
test("rerank promove o escolhido do modelo sem descartar o topo da fusão", async () => {
  const cinco = "abcde".split("").map((id) => ({ id, tipo: "protocolo", titulo: id, trecho: id }));
  // O modelo diz que o ÚLTIMO da fusão é o melhor e ignora todos os outros.
  const r = await rerank("q", cinco, { run: async () => "[4]" });
  const pos = (id) => r.itens.findIndex((c) => c.id === id);
  assert.ok(pos("e") < pos("c"), "o escolhido tinha que subir acima do meio da fusão");
  assert.ok(pos("a") <= 1, "o topo da fusão não pode ser jogado fora por um palpite do modelo");
  assert.equal(r.itens.length, cinco.length, "fundir não pode perder candidato");
  assert.equal(r.ok, true);
});

test("rerank preserva o conjunto inteiro, na ordem fundida", async () => {
  const r = await rerank("q", candidatos, { run: async () => "[2, 1, 0]" });
  assert.deepEqual([...r.itens.map((c) => c.id)].sort(), ["a", "b", "c"]);
  assert.equal(r.ok, true);
});

test("rerank devolve a ordem da fusão quando o LLM falha", async () => {
  const r = await rerank("q", candidatos, {
    run: async () => { throw new Error("rerank-timeout"); },
  });
  assert.equal(ids(r.itens), "a,b,c");
  assert.equal(r.ok, false);
  assert.equal(r.erro, "rerank-timeout");
});

test("rerank devolve a ordem da fusão quando a resposta não tem array", async () => {
  const r = await rerank("q", candidatos, { run: async () => "desculpe, não sei" });
  assert.equal(ids(r.itens), "a,b,c");
  assert.equal(r.ok, false);
  assert.equal(r.erro, "rerank-output");
});

test("rerank não chama o LLM para 0 ou 1 candidato", async () => {
  let chamou = false;
  const run = async () => { chamou = true; return "[0]"; };
  assert.deepEqual((await rerank("q", [], { run })).itens, []);
  assert.equal(ids((await rerank("q", [candidatos[0]], { run })).itens), "a");
  assert.equal(chamou, false);
});

// O cache existe porque uma corrida de 78 perguntas foi morta no meio e o pool virou pó.
// Se ele não evitar a 2a chamada, não serve para nada.
test("cache evita a segunda chamada para o mesmo prompt", async () => {
  let chamadas = 0;
  const run = async () => { chamadas += 1; return "[2, 0, 1]"; };
  // Pergunta única por execução: o cache é um arquivo real e compartilhado, então reusar um
  // texto fixo faria o teste passar pela entrada gravada na rodada ANTERIOR, medindo nada.
  const pergunta = `pergunta cacheada ${Date.now()}`;
  const a = await rerank(pergunta, candidatos, { run, cache: true });
  const b = await rerank(pergunta, candidatos, { run, cache: true });
  assert.equal(chamadas, 1, "a segunda chamada deveria vir do disco");
  assert.equal(ids(a.itens), ids(b.itens));
});

test("pergunta diferente não colide no cache", async () => {
  let chamadas = 0;
  const run = async () => { chamadas += 1; return "[0]"; };
  await rerank(`outra ${Date.now()}`, candidatos, { run, cache: true });
  await rerank(`outra ainda ${Date.now()}`, candidatos, { run, cache: true });
  assert.equal(chamadas, 2);
});

// Julgar relevância pelo começo do doc confunde "menciona" com "responde": o começo é
// frontmatter e título em praticamente todo doc do corpus.
test("trechoRelevante recorta em volta do termo, não do começo", () => {
  const texto = "cabecalho ".repeat(40) + "OLLAMA exposto sem auth " + "rodape ".repeat(40);
  const t = trechoRelevante(texto, ["ollama"], 120);
  assert.ok(t.includes("OLLAMA exposto"), t);
  assert.ok(t.startsWith("…"), "recorte no meio do doc começa com reticências");
});

test("trechoRelevante cai no começo quando nenhum termo aparece", () => {
  const t = trechoRelevante("primeiro segundo terceiro", ["inexistente"], 120);
  assert.equal(t, "primeiro segundo terceiro");
});

// O defeito que derrubou o reranker na 1a medição: doc curto recortado parece completo e doc
// longo recortado parece menção. Doc que cabe no orçamento tem que chegar inteiro.
test("trechoRelevante devolve o doc inteiro quando ele cabe no orçamento", () => {
  const curto = "protocolo curto que responde a pergunta toda";
  assert.equal(trechoRelevante(curto, ["pergunta"], 900), curto);
});

test("trechoRelevante junta várias janelas em doc longo", () => {
  const enche = (p) => `${p} `.repeat(60);
  const texto = enche("aaa") + "PRIMEIRO alvo " + enche("bbb") + "SEGUNDO alvo " + enche("ccc");
  const t = trechoRelevante(texto, ["primeiro", "segundo"], 300);
  assert.ok(t.includes("PRIMEIRO alvo"), t);
  assert.ok(t.includes("SEGUNDO alvo"), t);
  assert.ok(t.includes(" … "), "janelas separadas devem ser visíveis como corte");
});

test("trechoRelevante respeita o orçamento em doc longo", () => {
  const texto = "palavra ".repeat(3000) + "alvo";
  assert.ok(trechoRelevante(texto, ["alvo"], 300).length <= 320, "orçamento estourado");
});

// 31/07: a busca inteira estava morta em produção porque tokens[0] tinha estourado o limite
// mensal e rodarClaude nunca chegava ao token[1], que respondia. As duas mensagens que
// aparecem no pool não têm palavra de rate limit nem de auth — só o status separa "a conta
// acabou" de "o modelo escreveu bobagem", que é o erro que NÃO deve gastar a próxima conta.
test("trocaDeConta lê o status, não a mensagem", () => {
  const limite = { is_error: true, api_error_status: 429, result: "You've hit your monthly spend limit" };
  const desabilitado = { is_error: true, api_error_status: 403, result: "Your organization has disabled Claude subscription access" };
  assert.equal(trocaDeConta(limite), true);
  assert.equal(trocaDeConta(desabilitado), true);
  assert.equal(trocaDeConta({ is_error: true, result: "não é JSON de ordem" }), false);
  assert.equal(trocaDeConta({ is_error: true, api_error_status: 500 }), false);
});

// `trocaDeConta` responde "troco de conta?" e diz true para os três status — é o que a busca
// precisa. A SONDA precisa do contrário: separar quem volta de quem não volta. O handoff de
// 02/08 leu o pool como bloco ("as 3 esgotadas") e daí saiu "o teto são 3 contas"; com 429 e 403
// separados, o teto pode ser 2 e "somar conta" vira reposição.
test("classificarConta separa 429 (recarrega) de 403 (não recarrega)", () => {
  assert.equal(classificarConta(null).estado, "viva");
  assert.equal(classificarConta(Object.assign(new Error("rerank-conta"), { status: 429 })).estado, "rate-limit");
  assert.equal(classificarConta(Object.assign(new Error("rerank-conta"), { status: 403 })).estado, "desabilitada");
  assert.equal(classificarConta(Object.assign(new Error("rerank-conta"), { status: 401 })).estado, "auth");
  // Timeout e CLI quebrado não são veredito sobre a conta: chamar isso de "esgotada" mandaria
  // repor conta viva.
  assert.equal(classificarConta(new Error("rerank-timeout")).estado, "outro");
});

// A corrida das 78 de 31/07 morreu no meio e produziu números mesmo assim: 15 perguntas seguidas
// saíram por pool esgotado e o relatório as contou como `recusou`, imprimindo 19,2% de recusa
// fantasma. A regra que `scripts/avaliar-resposta.mjs` usa para parar mora aqui para ser testada:
// N falhas de conta SEGUIDAS abortam.
test("3 falhas de conta seguidas abortam a corrida", () => {
  let n = 0;
  for (const erro of ["resposta-conta", "juiz-conta", "resposta-conta"]) n = falhasDeConta(n, [erro]);
  assert.equal(n, MAX_CONTA_SEGUIDAS, "a corrida devia parar na terceira");
});

// Conta que morre e volta é rotação normal do pool — abortar aí desperdiçaria uma corrida boa.
test("resposta no meio zera o contador de falhas de conta", () => {
  let n = 0;
  for (const erro of ["resposta-conta", "resposta-conta", "", "resposta-conta"]) n = falhasDeConta(n, [erro]);
  assert.equal(n, 1);
});

// O corte é por conta, não por "deu erro": modelo escrevendo bobagem é RESULTADO da medição, e
// abortar nele esconderia justamente o defeito que a corrida existe para achar.
test("erro que não é de conta não aborta", () => {
  let n = 0;
  for (const erro of ["resposta-output", "resposta-sem-citacao", "juiz-output", "resposta-timeout"]) {
    n = falhasDeConta(n, [erro]);
  }
  assert.equal(n, 0);
  // Uma das três chamadas da pergunta basta: o juiz gasta pool igual à síntese.
  assert.equal(falhasDeConta(0, ["", undefined, "juiz-conta"]), 1);
});

// O comentário que pôs o MODELO na chave dizia: servir o veredito de um modelo para o outro
// esconderia a troca que se quer medir. O `effort` ficou de fora e vale o mesmo argumento — com
// ele fora, testar `effort` no detector devolveria o resultado do effort anterior e a leitura
// seria "não mudou nada". A chave sem effort é o formato legado: continua sendo lida (o cache já
// custou ~100 chamadas do pool), nunca escrita.
// specs/002-observabilidade-ia: spawnClaude passou a resolver o PAYLOAD inteiro, não só
// `.result` — `rodarClaude` extrai a string e continua devolvendo string. `spawnImpl` e
// `registrar` são injetáveis só para o teste; nada de banco aqui.
test("rodarClaude continua devolvendo string (payload.result), nenhum consumidor muda de contrato", async () => {
  const antes = process.env.CLAUDE_CODE_OAUTH_TOKENS;
  process.env.CLAUDE_CODE_OAUTH_TOKENS = "tokenX";
  try {
    const texto = await rodarClaude("prompt", {
      spawnImpl: async () => ({ result: "resposta do modelo", usage: { input_tokens: 5, output_tokens: 7 }, num_turns: 1 }),
      registrar: () => {},
    });
    assert.equal(texto, "resposta do modelo");
  } finally {
    process.env.CLAUDE_CODE_OAUTH_TOKENS = antes;
  }
});

// D4: uma linha por TENTATIVA, todas com o mesmo `pedido`. Quando a 1ª conta devolve 429 e
// a 2ª responde, têm que aparecer DUAS tentativas — uma falha e um sucesso —, nunca uma
// linha de sucesso só (esconderia a saturação, o defeito de 31/07).
test("rodarClaude: 1ª conta em 429 produz DUAS tentativas com o mesmo pedido (uma falha, um sucesso)", async () => {
  const antes = process.env.CLAUDE_CODE_OAUTH_TOKENS;
  process.env.CLAUDE_CODE_OAUTH_TOKENS = "tokenA,tokenB";
  const registros = [];
  const spawnImpl = async (_prompt, token) => {
    if (token === "tokenA") {
      const erro = new Error("rerank-output");
      erro.trocaDeConta = true;
      erro.status = 429;
      erro.payload = { api_error_status: 429 };
      throw erro;
    }
    return { result: "ok", usage: { input_tokens: 1, output_tokens: 2 }, num_turns: 1 };
  };
  try {
    const texto = await rodarClaude("prompt", { spawnImpl, registrar: (r) => registros.push(r) });
    assert.equal(texto, "ok");
    assert.equal(registros.length, 2, "duas tentativas: uma falha, um sucesso");
    assert.equal(registros[0].pedido, registros[1].pedido, "mesmo pedido lógico agrupa as tentativas");
    assert.deepEqual([registros[0].tentativa, registros[1].tentativa], [1, 2]);
    assert.equal(registros[0].desfecho, "nao-declarado-conta", "tentativa que esgota a conta é -conta, indiferenciada");
    assert.equal(registros[0].status_api, 429, "status_api é quem separa 429 de 403 no código -conta");
    assert.equal(registros[1].desfecho, "ok");
  } finally {
    process.env.CLAUDE_CODE_OAUTH_TOKENS = antes;
  }
});

test("chave do cache separa por effort, e a chave legada continua estável", () => {
  const p = "prompt qualquer";
  assert.notEqual(chave(p, "sonnet", "low"), chave(p, "sonnet", "medium"), "effort não separa: cache serve resultado de outro effort");
  assert.notEqual(chave(p, "sonnet", "medium"), chave(p, "opus", "medium"), "modelo não separa");
  assert.equal(chave(p, "sonnet", ""), chave(p, "sonnet", undefined), "formato legado tem que ser o mesmo hash de antes do effort");
  assert.notEqual(chave(p, "sonnet", ""), chave(p, "sonnet", "low"), "legado e low são chaves distintas de propósito");
});
