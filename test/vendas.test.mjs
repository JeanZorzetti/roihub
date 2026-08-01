import test from "node:test";
import assert from "node:assert/strict";
import { classificarPagamento, classificarPagamentos, somar } from "../lib/vendas.mjs";

// Molde do que o Mercado Pago devolveu de verdade em 31/07, com os campos que decidem.
const pagamento = (extra = {}) => ({
  id: 1,
  status: "approved",
  live_mode: true,
  transaction_amount: 47,
  transaction_amount_refunded: 0,
  date_approved: "2025-11-30T14:08:01.000-04:00",
  payer: { email: "cliente@exemplo.com", identification: { number: "52998224725" } },
  ...extra,
});

test("pagamento aprovado de comprador real vira venda com data em BRT", () => {
  const { venda } = classificarPagamento(pagamento());
  assert.deepEqual(venda, { data: "2025-11-30", valor: 47, fonte: "mercadopago", id: "1" });
});

// O achado que motivou o arquivo inteiro: os 20 pagamentos do atma são `approved` E `live_mode:
// true`, e somá-los teria publicado R$ 940 de receita que não existe. Só o payer separa.
test("usuário de teste do gateway é descartado mesmo com approved + live_mode true", () => {
  const { venda, motivo } = classificarPagamento(
    pagamento({ payer: { email: "test_user_2927837303830081825@testuser.com", identification: { number: "11111111111" } } }),
  );
  assert.equal(venda, null);
  assert.match(motivo, /usuário de teste/);
});

test("CPF de teste é descartado mesmo com e-mail de gente", () => {
  const { venda, motivo } = classificarPagamento(
    pagamento({ payer: { email: "jean@roilabs.com.br", identification: { number: "11111111111" } } }),
  );
  assert.equal(venda, null);
  assert.match(motivo, /documento de teste/);
});

test("sandbox, pendente e estorno integral não são venda", () => {
  assert.match(classificarPagamento(pagamento({ live_mode: false })).motivo, /sandbox/);
  assert.match(classificarPagamento(pagamento({ status: "pending" })).motivo, /status pending/);
  assert.match(classificarPagamento(pagamento({ transaction_amount_refunded: 47 })).motivo, /estornada por inteiro/);
});

// Estorno parcial abate em vez de apagar: metade devolvida é meia venda, e descartar a linha
// esconderia dinheiro que de fato entrou.
test("estorno parcial abate do valor e a venda continua contando", () => {
  const { venda } = classificarPagamento(pagamento({ transaction_amount_refunded: 20 }));
  assert.equal(venda.valor, 27);
});

// "Dinheiro sem data é R$ 0" é regra da casa, e ela precisa valer também quando o gateway é que
// omite a data — não só quando quem preenche o card esquece.
test("aprovada sem data nenhuma não vira venda", () => {
  const p = pagamento();
  delete p.date_approved;
  delete p.date_created;
  assert.match(classificarPagamento(p).motivo, /aprovada sem data/);
});

test("a corrida devolve venda e descarte lado a lado, ordenada por data", () => {
  const { vendas, descartadas } = classificarPagamentos([
    pagamento({ id: 2, date_approved: "2026-01-05T10:00:00.000-03:00" }),
    pagamento({ id: 3, payer: { email: "test_user_1@testuser.com" } }),
    pagamento({ id: 4, date_approved: "2025-12-01T10:00:00.000-03:00", transaction_amount: 100 }),
  ]);
  assert.deepEqual(vendas.map((v) => v.id), ["4", "2"]);
  assert.equal(descartadas.length, 1);
  assert.equal(somar(vendas), 147);
});

test("somar ignora venda sem data", () => {
  assert.equal(somar([{ data: "2026-01-01", valor: 10 }, { valor: 999 }]), 10);
});
