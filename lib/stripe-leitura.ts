// 053/research D7 — o extrato do Stripe do Sirius, por `fetch` na API REST (sem SDK: são 2 GETs). A regra
// (descarte, união, janela) mora em lib/saas.mjs; aqui só a rede e a normalização.
//
// A chave é RESTRITA e só de leitura (`rk_…`). A secreta LIVE do Sirius vazou em 07/07/2026, e `sk_` é
// recusada aqui mesmo que alguém a cole no ambiente: nunca em log, nunca em resposta (Princípio V).

const API = "https://api.stripe.com/v1";
const PAGINAS_MAX = 20;

type Sessao = { id: string; livemode: boolean; pago: boolean; valor: number; conta: string | null; data: string; reembolsada: boolean };
export type LeituraStripe = { sessoes: Sessao[]; assinaturasAtivas: { conta: string }[] } | { erro: string };

async function listar(chave: string, caminho: string, params: string) {
  const itens: Record<string, unknown>[] = [];
  let depois = "";
  for (let i = 0; i < PAGINAS_MAX; i++) {
    const r = await fetch(`${API}/${caminho}?limit=100&${params}${depois ? `&starting_after=${depois}` : ""}`, {
      headers: { Authorization: `Bearer ${chave}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`Stripe HTTP ${r.status}`);
    const corpo = (await r.json()) as { data: Record<string, unknown>[]; has_more: boolean };
    itens.push(...corpo.data);
    if (!corpo.has_more || !corpo.data.length) return itens;
    depois = String(corpo.data.at(-1)!.id);
  }
  return itens;
}

const contaDe = (o: Record<string, unknown>) =>
  ((o.metadata as Record<string, string> | undefined)?.organization_id || (o.client_reference_id as string | undefined)) ?? null;

export async function lerStripeSirius(): Promise<LeituraStripe> {
  const chave = process.env.SIRIUS_STRIPE_KEY?.trim();
  if (!chave) return { erro: "SIRIUS_STRIPE_KEY ausente" };
  if (!chave.startsWith("rk_")) return { erro: "SIRIUS_STRIPE_KEY não é chave restrita (rk_)" };
  try {
    const [sessoes, assinaturas] = await Promise.all([
      listar(chave, "checkout/sessions", "status=complete&expand[]=data.payment_intent.latest_charge"),
      listar(chave, "subscriptions", "status=active"),
    ]);
    return {
      sessoes: sessoes.map((s) => ({
        id: String(s.id),
        livemode: s.livemode === true,
        // `no_payment_required` é cupom de 100% ou trial: não é cobrança.
        pago: s.payment_status === "paid",
        // Centavos. Medido em 22/09/2026: a conta Stripe é COMPARTILHADA com outros produtos, e a única
        // sessão paga era um trial de outro produto com valor 0 — "paid" não quer dizer que entrou dinheiro.
        valor: Number(s.amount_total ?? 0),
        conta: contaDe(s),
        data: new Date(Number(s.created) * 1000).toISOString().slice(0, 10),
        // ponytail: só o reembolso de checkout avulso (payment_intent) é visto; o da 1ª fatura de assinatura
        // não, porque o campo varia com a versão da API. Ler /v1/refunds e casar pela cobrança quando houver o primeiro.
        reembolsada: ((s.payment_intent as { latest_charge?: { refunded?: boolean } } | null)?.latest_charge?.refunded ?? false) === true,
      })),
      assinaturasAtivas: assinaturas.map(contaDe).filter((c): c is string => !!c).map((conta) => ({ conta })),
    };
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : "Stripe indisponível" };
  }
}
