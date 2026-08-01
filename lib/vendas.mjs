// A régua sobre DINHEIRO. Até 31/07 o hub priorizava 35 projetos usando `receita` — nota 0-10 de
// prioridade editorial que ninguém nunca checou contra um sistema de pagamento. `receitaNota` do
// atma afirmava "Venda não confirmada" e a do sirius "3 vendas orgânicas": duas frases sobre
// faturamento, zero apuração. Aqui a venda vem do gateway, com a data que o gateway registrou.
//
// ⚠️ O CLASSIFICADOR É O PONTO, não o fetch. A primeira corrida contra o Mercado Pago devolveu 20
// pagamentos `approved` com `live_mode: true`, R$ 47 cada — R$ 940 de faturamento que não existe.
// Todos os 20 têm payer `test_user_…@testuser.com` e CPF 11111111111: é o Jean validando o
// checkout em 28-30/11/2025. Somar `approved` seria fabricar receita com a autoridade de um
// número apurado, que é exatamente o defeito que esta frente veio consertar.

// `live_mode` NÃO separa teste de venda. Os 20 pagamentos de teste do atma vêm com `live_mode:
// true` porque o usuário de teste do MP transaciona contra a aplicação de produção — medido, não
// suposto. Só o payer separa. Mantido na lista mesmo assim: pagamento com `live_mode: false` é
// sandbox e também não é venda.
const DOCS_DE_TESTE = new Set(["11111111111", "12345678909", "00000000000"]);

// Cada descarte devolve o MOTIVO, não um booleano. Lista nominal com motivo é auditável; um
// contador de "N descartados" só se acredita ou não.
export function classificarPagamento(p) {
  if (p?.status !== "approved") return { venda: null, motivo: `status ${p?.status ?? "ausente"}` };
  if (p.live_mode !== true) return { venda: null, motivo: "sandbox (live_mode false)" };
  const email = p.payer?.email ?? "";
  if (/@testuser\.com$/i.test(email)) return { venda: null, motivo: "usuário de teste do gateway" };
  if (DOCS_DE_TESTE.has(p.payer?.identification?.number ?? "")) return { venda: null, motivo: "documento de teste" };
  // Estorno é venda que não existiu. Parcial abate do valor em vez de descartar: metade devolvida
  // é meia venda, e apagar a linha inteira esconderia dinheiro que de fato entrou.
  const estornado = Number(p.transaction_amount_refunded ?? 0);
  const valor = Number(p.transaction_amount ?? 0) - estornado;
  if (!(valor > 0)) return { venda: null, motivo: "estornada por inteiro" };
  const quando = p.date_approved ?? p.date_created;
  // Sem data o gateway não prova quando — e a regra da casa é "dinheiro sem data é R$ 0".
  if (!quando) return { venda: null, motivo: "aprovada sem data" };
  return {
    venda: { data: emBRT(quando), valor, fonte: "mercadopago", id: String(p.id) },
    motivo: "",
  };
}

// O MP devolve o offset dele (-04:00 nos 20 do atma); todo card, handoff e memória desta casa
// datam em BRT. Fatiar a string crua carimbaria o dia errado nas vendas da madrugada.
const emBRT = (iso) => new Date(new Date(iso).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

export function classificarPagamentos(pagamentos) {
  const vendas = [];
  const descartadas = [];
  for (const p of pagamentos ?? []) {
    const { venda, motivo } = classificarPagamento(p);
    if (venda) vendas.push(venda);
    else descartadas.push({ id: String(p?.id ?? "?"), valor: p?.transaction_amount ?? 0, motivo });
  }
  vendas.sort((a, b) => a.data.localeCompare(b.data));
  return { vendas, descartadas };
}

export const somar = (vendas) => (vendas ?? []).filter((v) => v?.data).reduce((a, v) => a + Number(v.valor ?? 0), 0);

// Falha FECHADA, como o resto de `dourado-estado`: sem token ou com o gateway fora do ar, isto
// joga — nunca devolve lista vazia, que o chamador leria como "não vendeu nada".
export async function pagamentosDoMercadoPago(fetchImpl = fetch, token = process.env.MERCADOPAGO_ACCESS_TOKEN) {
  if (!token) throw new Error("sem MERCADOPAGO_ACCESS_TOKEN");
  const todos = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const res = await fetchImpl(
      `https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc&limit=50&offset=${offset}`,
      { signal: AbortSignal.timeout(15000), headers: { authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`MercadoPago ${res.status}`);
    const lote = await res.json();
    todos.push(...(lote.results ?? []));
    if ((lote.results ?? []).length < 50) break;
  }
  return todos;
}
