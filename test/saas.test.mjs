import test from "node:test";
import assert from "node:assert/strict";
import { apurado, ehApurado } from "../lib/funil.mjs";
import { celulasDaConta, classificarSessoesStripe, pagantes } from "../lib/saas.mjs";

const epoca = { inicio: "2026-03-17", fim: "2026-09-22" };

// A forma da query de research D4, com os casos que decidem.
const linhas = [
  { id: "cartopel", criado: "2026-03-17", teste: false, tier: "PRO", ativado: "2026-03-18" },
  { id: "boxer", criado: "2026-04-29", teste: false, tier: "PRO", ativado: "2026-04-29" },
  { id: "voe", criado: "2026-03-31", teste: false, tier: "FREE", ativado: "2026-04-02" },
  { id: "so-exemplo", criado: "2026-08-10", teste: false, tier: "FREE", ativado: null },
  { id: "teste", criado: "2026-05-01", teste: true, tier: "BUSINESS", ativado: "2026-05-01" },
  { id: "antes", criado: "2026-02-02", teste: false, tier: "FREE", ativado: "2026-02-03" },
];
const contasPorId = new Map(linhas.map((l) => [l.id, l]));

test("053 — cadastro conta as contas reais criadas na janela; ativado só as com contato próprio", () => {
  const { signups, ativados } = celulasDaConta(linhas, epoca);
  assert.deepEqual(signups, apurado(4), "a de teste e a de antes da época ficam fora");
  assert.deepEqual(ativados, apurado(3), "a conta só com contatos de exemplo não ativou");
});

const sessao = (o) => ({ id: "cs_1", livemode: true, pago: true, conta: "cartopel", data: "2026-10-01", reembolsada: false, ...o });

test("053 — sessões do Stripe: os cinco descartes são nominais, e o resto vira cobrança", () => {
  const { cobrancas, descartes } = classificarSessoesStripe(
    [
      sessao({ id: "ok" }),
      sessao({ id: "t", livemode: false }),
      sessao({ id: "np", pago: false }),
      sessao({ id: "sc", conta: null }),
      sessao({ id: "ct", conta: "teste" }),
      sessao({ id: "rb", reembolsada: true }),
      sessao({ id: "nf", conta: "sumiu" }),
    ],
    contasPorId,
  );
  assert.deepEqual(cobrancas.map((c) => c.id), ["ok"]);
  assert.deepEqual(
    descartes.map((d) => `${d.id}:${d.motivo}`),
    ["t:modo de teste", "np:não paga", "sc:sem conta do Sirius", "ct:conta de teste", "rb:reembolsada", "nf:conta não encontrada no banco"],
  );
});

const declarados = {
  declaradoEm: "2026-09-22",
  contas: [
    { nome: "Cliente A", conta: "cartopel", pagaHoje: true },
    { nome: "Cliente F", conta: "boxer", pagaHoje: false },
    { nome: "Cliente D", conta: "voe", pagaHoje: false },
  ],
};

test("053 — já pagou é a união por conta: declarada + Stripe na mesma conta conta uma vez, com as duas fontes", () => {
  const stripe = { cobrancas: [{ id: "cs", conta: "cartopel", data: "2026-10-01" }], assinaturasAtivas: [{ conta: "cartopel" }] };
  const r = pagantes({ declarados, stripe, contasPorId, janela: { ...epoca, fim: "2026-10-31" } });
  assert.deepEqual(r.vendas, apurado(3));
  const cartopel = r.contas.find((c) => c.conta === "cartopel");
  assert.equal(cartopel.fontes.length, 2);
  assert.deepEqual(r.pagaHoje, apurado(1));
});

test("053 — cobrança nova no Stripe, fora da declaração, entra só se a data está na janela", () => {
  const stripe = { cobrancas: [{ id: "cs", conta: "so-exemplo", data: "2026-10-05" }], assinaturasAtivas: [] };
  assert.deepEqual(pagantes({ declarados, stripe, contasPorId, janela: epoca }).vendas, apurado(3));
  assert.deepEqual(pagantes({ declarados, stripe, contasPorId, janela: { ...epoca, fim: "2026-10-31" } }).vendas, apurado(4));
});

test("053 — sem o Stripe, as declaradas contam, e a célula diz que é parcial (nunca 0, nunca total)", () => {
  const r = pagantes({ declarados, stripe: { erro: "chave do Stripe ausente" }, contasPorId, janela: epoca });
  assert.ok(ehApurado(r.vendas));
  assert.equal(r.vendas.valor, 3);
  assert.match(r.vendas.parcial, /chave do Stripe ausente/);
  assert.equal(r.pagaHoje.valor, 1);
  assert.match(r.pagaHoje.parcial, /chave do Stripe ausente/);
});

test("053 — plano pago sem pagamento ativo vira divergência; declarada no FREE não é divergência", () => {
  const stripe = { cobrancas: [], assinaturasAtivas: [] };
  const r = pagantes({ declarados, stripe, contasPorId, janela: epoca });
  assert.deepEqual(r.divergencias.map((d) => `${d.conta}:${d.tipo}`), ["boxer:plano PRO sem pagamento ativo"]);
});

test("053 — pagante que não passou por 'ativado' aparece nomeada (a taxa não é subconjunto exato)", () => {
  const semAtivar = new Map([...contasPorId, ["london", { id: "london", criado: "2026-04-14", teste: false, tier: "FREE", ativado: null }]]);
  const r = pagantes({
    declarados: { declaradoEm: "2026-09-22", contas: [...declarados.contas, { nome: "Cliente E", conta: "london", pagaHoje: false }] },
    stripe: { cobrancas: [], assinaturasAtivas: [] },
    contasPorId: semAtivar,
    janela: epoca,
  });
  assert.deepEqual(r.pagaramSemAtivar, ["Cliente E"]);
});

test("053 — conta declarada que não existe no banco não conta, e aparece nomeada", () => {
  const r = pagantes({
    declarados: { declaradoEm: "2026-09-22", contas: [{ nome: "Fantasma", conta: "nao-existe", pagaHoje: false }] },
    stripe: { cobrancas: [], assinaturasAtivas: [] },
    contasPorId,
    janela: epoca,
  });
  assert.deepEqual(r.vendas, apurado(0));
  assert.deepEqual(r.naoEncontradas, ["Fantasma"]);
});

test("053 — o nome da pagante sai do banco do produto; o card guarda só o id (o repo do hub é público)", () => {
  const comNome = new Map([...contasPorId].map(([id, l]) => [id, { ...l, nome: `Empresa ${id}` }]));
  const r = pagantes({
    declarados: { declaradoEm: "2026-09-22", contas: [{ conta: "cartopel", pagaHoje: true }, { conta: "boxer", pagaHoje: false }] },
    stripe: { cobrancas: [], assinaturasAtivas: [] },
    contasPorId: comNome,
    janela: epoca,
  });
  assert.deepEqual(r.contas.map((c) => c.nome), ["Empresa cartopel", "Empresa boxer"]);
  assert.equal(r.divergencias[0].nome, "Empresa boxer");
});
