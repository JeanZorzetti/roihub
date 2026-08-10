import test from "node:test";
import assert from "node:assert/strict";
import {
  hashConta,
  codigo,
  montarRegistro,
  resumirDia,
  estadoDoEmpregado,
  transicaoPool,
  celulasIA,
} from "../lib/telemetria.mjs";

test("hashConta: sentinela sem token, estável para o mesmo token, distinto entre tokens", () => {
  assert.equal(hashConta(""), "cli-ambiente");
  assert.equal(hashConta(null), "cli-ambiente");
  assert.equal(hashConta(undefined), "cli-ambiente");
  assert.equal(hashConta("token-a"), hashConta("token-a"));
  assert.notEqual(hashConta("token-a"), hashConta("token-b"));
  assert.equal(hashConta("token-a").length, 8);
});

test("codigo: troca o prefixo preservando o sufixo de classe", () => {
  assert.equal(codigo("juiz", new Error("rerank-conta")), "juiz-conta");
  assert.equal(codigo("resposta", new Error("rerank-timeout")), "resposta-timeout");
  assert.equal(codigo("autopublish-draft", new Error("llm-rate")), "autopublish-draft-rate");
  assert.equal(codigo("rerank", null), "ok");
});

// Classe fora do conjunto validado (auth|rate|cli|output|parse|timeout|conta|corrida-incompleta)
// nunca passa adiante como texto livre: cai no default `-output`, o mesmo que os
// consumidores já usam hoje.
test("codigo: sufixo fora do conjunto validado vira -output, nunca texto livre", () => {
  assert.equal(codigo("rerank", new Error("algo-bizarro")), "rerank-output");
  assert.equal(codigo("rerank", new Error("mensagem sem hífen no fim")), "rerank-output");
});

test("montarRegistro nunca deixa prompt, result ou stderr vazarem para o registro", () => {
  const segredo = "PROMPT SENSÍVEL: não pode aparecer em campo nenhum";
  const inicio = new Date("2026-08-10T10:00:00Z");
  const fim = new Date("2026-08-10T10:00:01.234Z");
  const r = montarRegistro({
    empregado: "rerank",
    modelo: "sonnet",
    effort: "low",
    token: "token-x",
    tentativa: 1,
    pedido: "p1",
    inicio,
    fim,
    payload: { usage: { input_tokens: 10, output_tokens: 20 }, num_turns: 1, result: segredo },
    erro: null,
    prompt: segredo,
  });
  for (const valor of Object.values(r)) {
    assert.ok(!String(valor).includes("PROMPT SENSÍVEL"), `campo vazou texto: ${valor}`);
  }
  assert.match(r.prompt_hash, /^[0-9a-f]{40}$/);
  assert.equal(r.prompt_chars, segredo.length);
  assert.equal(r.duracao_ms, 1234);
  assert.equal(r.tokens_entrada, 10);
  assert.equal(r.tokens_saida, 20);
  assert.equal(r.desfecho, "ok");
  assert.equal(r.conta.length, 8);
  assert.equal(r.ambiente, "dev");
});

test("montarRegistro: cache é sentinela com duração e tokens zerados, e não chama rodarClaude (contrato do chamador)", () => {
  const inicio = new Date("2026-08-10T10:00:00Z");
  const r = montarRegistro({
    empregado: "rerank", modelo: "sonnet", effort: "low", token: "token-x",
    tentativa: 1, pedido: "p1", inicio, fim: inicio, payload: null, erro: null,
    prompt: "qualquer", cache: true,
  });
  assert.equal(r.conta, "cache");
  assert.equal(r.duracao_ms, 0);
  assert.equal(r.tokens_entrada, 0);
  assert.equal(r.tokens_saida, 0);
});

test("montarRegistro: sem token cai no sentinela cli-ambiente", () => {
  const inicio = new Date();
  const r = montarRegistro({
    empregado: "sonda", modelo: "sonnet", effort: "low", token: null,
    tentativa: 1, pedido: "p1", inicio, fim: inicio, payload: {}, erro: null, prompt: "x",
  });
  assert.equal(r.conta, "cli-ambiente");
});

test("resumirDia agrupa por (ambiente, empregado) e recomputa o que ia_resumo guarda (FR-023)", () => {
  const linhas = [
    { inicio: "2026-08-09T10:00:00Z", ambiente: "prod", empregado: "rerank", pedido: "p1", desfecho: "ok", duracao_ms: 100, tokens_entrada: 10, tokens_saida: 5 },
    { inicio: "2026-08-09T10:00:05Z", ambiente: "prod", empregado: "rerank", pedido: "p1", desfecho: "rerank-conta", duracao_ms: 50, tokens_entrada: 0, tokens_saida: 0 },
    { inicio: "2026-08-09T10:00:06Z", ambiente: "prod", empregado: "rerank", pedido: "p2", desfecho: "ok", duracao_ms: 200, tokens_entrada: 20, tokens_saida: 10 },
    { inicio: "2026-08-09T11:00:00Z", ambiente: "dev", empregado: "juiz", pedido: "p3", desfecho: "ok", duracao_ms: 300, tokens_entrada: 30, tokens_saida: 15 },
  ];
  const resumo = resumirDia(linhas);
  const rerankProd = resumo.find((r) => r.empregado === "rerank" && r.ambiente === "prod");
  assert.equal(rerankProd.dia, "2026-08-09");
  assert.equal(rerankProd.chamadas, 3);
  assert.equal(rerankProd.pedidos, 2, "distinct pedido, não tentativas");
  assert.deepEqual(rerankProd.falhas, { "rerank-conta": 1 });
  assert.equal(rerankProd.tokens_entrada, 30);
  assert.equal(rerankProd.tokens_saida, 15);

  const juizDev = resumo.find((r) => r.empregado === "juiz");
  assert.equal(juizDev.ambiente, "dev");
  assert.equal(juizDev.chamadas, 1);
  assert.deepEqual(juizDev.falhas, {});
});

test("resumirDia: p50/p95 saem da distribuição, não da média", () => {
  const linhas = Array.from({ length: 10 }, (_, i) => ({
    inicio: "2026-08-09T10:00:00Z", ambiente: "prod", empregado: "rerank", pedido: `p${i}`,
    desfecho: "ok", duracao_ms: (i + 1) * 100, tokens_entrada: 0, tokens_saida: 0,
  }));
  const [r] = resumirDia(linhas);
  assert.equal(r.p50_ms, 500);
  assert.equal(r.p95_ms, 1000);
});

test("resumirDia de array vazio devolve array vazio", () => {
  assert.deepEqual(resumirDia([]), []);
});

// D7: lacuna vence tudo. Dois casos obrigatórios (research.md D7): 26h não é lacuna, 40h é.
test("estadoDoEmpregado: sonda de 26h atrás NÃO é lacuna", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const ultimaSonda = new Date("2026-08-09T10:00:00Z"); // 26h atrás
  assert.equal(estadoDoEmpregado([], ultimaSonda, agora), "nao-acionado");
});

test("estadoDoEmpregado: sonda de 40h atrás É lacuna", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const ultimaSonda = new Date("2026-08-08T20:00:00Z"); // 40h atrás
  const linhas = [{ desfecho: "ok" }];
  assert.equal(estadoDoEmpregado(linhas, ultimaSonda, agora), "sem-telemetria");
});

test("estadoDoEmpregado: sem sonda nenhuma é lacuna, mesmo com linhas", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  assert.equal(estadoDoEmpregado([{ desfecho: "ok" }], null, agora), "sem-telemetria");
});

test("estadoDoEmpregado: os três estados de FR-016 com sonda recente", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const sondaRecente = new Date("2026-08-10T00:00:00Z");
  assert.equal(estadoDoEmpregado([], sondaRecente, agora), "nao-acionado");
  assert.equal(estadoDoEmpregado([{ desfecho: "ok" }], sondaRecente, agora), "sem-falhas");
  assert.equal(estadoDoEmpregado([{ desfecho: "ok" }, { desfecho: "rerank-conta" }], sondaRecente, agora), "com-falhas");
});

test("transicaoPool: estado igual só toca (confirmar não compra janela nova)", () => {
  const anterior = { conta: "a1b2c3d4", estado: "viva", desde: new Date("2026-08-01T00:00:00Z"), visto: new Date("2026-08-01T00:00:00Z") };
  const agora = new Date("2026-08-10T00:00:00Z");
  const r = transicaoPool(anterior, { conta: "a1b2c3d4", estado: "viva" }, agora);
  assert.ok(r.tocar && !r.inserir, "estado igual nunca insere");
  assert.equal(r.tocar.desde, anterior.desde, "desde não muda ao confirmar");
  assert.equal(r.tocar.visto, agora);
});

test("transicaoPool: estado diferente insere uma linha nova, sem sobrescrever a antiga", () => {
  const anterior = { conta: "a1b2c3d4", estado: "rate-limit", desde: new Date("2026-08-01T00:00:00Z"), visto: new Date("2026-08-05T00:00:00Z") };
  const agora = new Date("2026-08-10T00:00:00Z");
  const r = transicaoPool(anterior, { conta: "a1b2c3d4", estado: "desabilitada" }, agora);
  assert.ok(r.inserir && !r.tocar, "estado diferente nunca só toca");
  assert.equal(r.inserir.estado, "desabilitada");
  assert.equal(r.inserir.desde, agora, "a nova linha data a transição na hora da sondagem");
});

test("transicaoPool: conta nova (sem anterior) insere", () => {
  const agora = new Date("2026-08-10T00:00:00Z");
  const r = transicaoPool(null, { conta: "novaconta", estado: "viva" }, agora);
  assert.ok(r.inserir && !r.tocar);
  assert.equal(r.inserir.conta, "novaconta");
});

test("celulasIA: só empregado com falha na janela vira célula, rótulo é o código mais frequente", () => {
  const linhas = [
    { empregado: "rerank", desfecho: "ok" },
    { empregado: "rerank", desfecho: "rerank-conta" },
    { empregado: "rerank", desfecho: "rerank-conta" },
    { empregado: "rerank", desfecho: "rerank-timeout" },
    { empregado: "juiz", desfecho: "ok" },
  ];
  const agora = new Date("2026-08-10T12:00:00Z");
  const sondaRecente = new Date("2026-08-10T00:00:00Z");
  const mapa = celulasIA(linhas, [], sondaRecente, agora);
  assert.deepEqual(mapa, { "IA:empregado:rerank": "rerank-conta" });
});

test("celulasIA: sonda ausente ou velha vira IA:coletor:telemetria", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const velha = new Date("2026-08-08T00:00:00Z"); // > 36h
  const mapa = celulasIA([], [], velha, agora);
  assert.ok(mapa["IA:coletor:telemetria"], "deveria ter célula de lacuna");
  assert.match(mapa["IA:coletor:telemetria"], /sem telemetria desde/);
});

test("celulasIA: sonda recente e nenhuma falha não produz célula nenhuma", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const recente = new Date("2026-08-10T00:00:00Z");
  assert.deepEqual(celulasIA([{ empregado: "rerank", desfecho: "ok" }], [], recente, agora), {});
});

// FR-018/SC-005: latência ou volume mudando de patamar NUNCA produz célula — só
// transição categórica (falha sim/não) entra no diff.
test("celulasIA: latência ou volume mudando de patamar NÃO produz célula", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const recente = new Date("2026-08-10T00:00:00Z");
  const poucoVolumeRapido = Array.from({ length: 2 }, () => ({ empregado: "rerank", desfecho: "ok", duracao_ms: 100 }));
  const muitoVolumeLento = Array.from({ length: 200 }, () => ({ empregado: "rerank", desfecho: "ok", duracao_ms: 9000 }));
  assert.deepEqual(celulasIA(poucoVolumeRapido, [], recente, agora), {});
  assert.deepEqual(celulasIA(muitoVolumeLento, [], recente, agora), {});
});

test("celulasIA: empregado que parou de falhar sai do mapa (o diff resolve sozinho)", () => {
  const agora = new Date("2026-08-10T12:00:00Z");
  const recente = new Date("2026-08-10T00:00:00Z");
  const semFalhas = [{ empregado: "rerank", desfecho: "ok" }, { empregado: "rerank", desfecho: "ok" }];
  assert.deepEqual(celulasIA(semFalhas, [], recente, agora), {});
});
