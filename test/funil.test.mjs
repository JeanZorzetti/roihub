import test from "node:test";
import assert from "node:assert/strict";
import { apurado, naoApurado, ehApurado, razao, exigencia, montarLinha, resumir, pct, DEGRAUS, ehLeadDeTeste } from "../lib/funil.mjs";

test("célula não apurada nunca se confunde com zero", () => {
  assert.equal(ehApurado(apurado(0)), true);
  assert.equal(ehApurado(naoApurado("sem pipeline")), false);
  // O caso que este módulo existe para impedir: 0 e "não olhei" no mesmo lugar.
  assert.notDeepEqual(apurado(0), naoApurado("sem pipeline"));
});

test("razão só sai apurada com as DUAS pontas apuradas", () => {
  assert.deepEqual(razao(apurado(3), apurado(1200)), { valor: 3 / 1200 });
  assert.equal(ehApurado(razao(naoApurado("sem pipeline"), apurado(1200))), false);
  assert.equal(ehApurado(razao(apurado(3), naoApurado("sem propriedade"))), false);
});

test("0/0 NÃO é 0% — é a diferença entre problema de conversão e problema de tráfego", () => {
  const r = razao(apurado(0), apurado(0));
  assert.equal(ehApurado(r), false);
  assert.match(r.naoApurado, /denominador 0/);
  // Mas 0 lead sobre 1.240 cliques é uma taxa REAL de 0% e tem que sair apurada.
  assert.deepEqual(razao(apurado(0), apurado(1240)), { valor: 0 });
});

test("numerador maior que denominador vira não apurado, nunca taxa acima de 100%", () => {
  const r = razao(apurado(5), apurado(2));
  assert.equal(ehApurado(r), false);
  assert.match(r.naoApurado, /pontas não casam/);
});

test("exigência é fração normal com as duas pontas apuradas", () => {
  assert.deepEqual(exigencia(apurado(2.89), apurado(39)), { valor: 2.89 / 39 });
});

test("exigência, ao contrário de razão, sai APURADA acima de 1 — é a prova de meta impossível", () => {
  const e = exigencia(apurado(100), apurado(39));
  assert.equal(ehApurado(e), true);
  assert.ok(e.valor > 1);
  assert.equal(e.valor, 100 / 39);
});

test("exigência com âncora zerada nunca divide por zero", () => {
  const e = exigencia(apurado(2.89), apurado(0));
  assert.equal(ehApurado(e), false);
  assert.match(e.naoApurado, /âncora zerada/);
});

test("exigência com cada ponta não apurada nomeia o lado certo no motivo", () => {
  const semAncora = exigencia(apurado(2.89), naoApurado("sem âncora"));
  assert.equal(ehApurado(semAncora), false);
  assert.match(semAncora.naoApurado, /^âncora: /);

  const semNecessario = exigencia(naoApurado("sem meta"), apurado(39));
  assert.equal(ehApurado(semNecessario), false);
  assert.match(semNecessario.naoApurado, /^necessário: /);
});

test("profundidade conta degraus CONTÍGUOS a partir do topo", () => {
  const semNada = montarLinha({ slug: "a", cliques: naoApurado("x"), leads: apurado(2), vendas: apurado(0) });
  // 2 células apuradas, mas a cadeia quebra no primeiro degrau: profundidade 0, não 2.
  assert.equal(semNada.profundidade, 0);

  const soCliques = montarLinha({ slug: "b", cliques: apurado(10), leads: naoApurado("x"), vendas: apurado(0) });
  assert.equal(soCliques.profundidade, 1);

  const completo = montarLinha({ slug: "c", cliques: apurado(10), leads: apurado(1), vendas: apurado(0) });
  assert.equal(completo.profundidade, DEGRAUS.length);
});

test("resumo não é acumulado: as casas somam o total", () => {
  const linhas = [
    montarLinha({ slug: "a", cliques: naoApurado("x"), leads: naoApurado("x"), vendas: naoApurado("x") }),
    montarLinha({ slug: "b", cliques: apurado(100), leads: naoApurado("x"), vendas: naoApurado("x") }),
    montarLinha({ slug: "c", cliques: apurado(100), leads: apurado(2), vendas: apurado(0) }),
  ];
  const r = resumir(linhas);
  assert.equal(r.porDegrau.reduce((a, n) => a + n, 0), r.total);
  assert.deepEqual(r.porDegrau, [1, 1, 0, 1]);
  assert.deepEqual(r.completos, ["c"]);
  assert.deepEqual(r.comTaxa, ["c"]);
});

test("percentual com 2 casas — arredondar mata o sinal de um funil raso", () => {
  assert.equal(pct(3 / 1240), "0,24%");
  assert.equal(pct(0), "0,00%");
});

test("lead que nós mesmos criamos não conta como demanda", () => {
  // Os 5 que o crm_leads tinha na vida inteira em 01/09/2026 — e de onde saía o único
  // CR(clique→lead) do portfólio. Se estes contarem, o critério do subprojeto fecha com um curl.
  for (const l of [
    { nome: "Teste", email: "teste@teste.com.br" },
    { nome: "TESTE E2E Spec012", email: "teste-spec012@roilabs.com.br" },
    { nome: "Teste", email: "flow.controlx@gmail.com" },
  ])
    assert.equal(ehLeadDeTeste(l), true, l.email);

  // Escotilha para o teste com e-mail plausível, que a heurística não pega sozinha.
  assert.equal(ehLeadDeTeste({ nome: "Ana Souza", email: "ana@gmail.com", metadata: { teste: true } }), true);

  // E o que NÃO pode virar teste: gente de verdade. Nomes reais do patient_leads da Atma.
  for (const l of [
    { nome: "Alicia Oliveira Silva", email: "aliciaoliveira087@gmail.com" },
    { nome: "Marcelo Tizzi", email: "marcelotizzi@gmail.com" },
    { nome: "Estela Prado", email: "estela@clinica.com.br" }, // começa com "este", não com "teste"
  ])
    assert.equal(ehLeadDeTeste(l), false, l.email);
});
