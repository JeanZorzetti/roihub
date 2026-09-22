// 053 — a cadeia de um SaaS até o dinheiro, em regra pura: cadastro, ativação e quem pagou. Sem rede:
// a borda (`lib/okr-coleta.ts`, `lib/stripe-leitura.ts`) lê o banco do produto e o Stripe e entrega
// as linhas prontas. Hoje só o Sirius usa (`CADEIAS_DO_PROJETO` em lib/okr.mjs).
import { apurado } from "./funil.mjs";

const naJanela = (data, { inicio, fim }) => data != null && data >= inicio && data <= fim;

/**
 * Cadastro e ativação, na janela da cadeia. `ativado` já vem da query (research D4): a data do 1º
 * contato criado 5 min ou mais depois da conta. Os contatos e deals de exemplo nascem no mesmo minuto
 * da conta (medido em 22/09/2026: 72 contas com contato, 32 depois do corte).
 * @param {{id:string, criado:string, teste:boolean, ativado:string|null}[]} linhas
 * @param {{inicio:string, fim:string}} janela
 */
export function celulasDaConta(linhas, janela) {
  const reais = linhas.filter((l) => !l.teste && naJanela(l.criado, janela));
  return { signups: apurado(reais.length), ativados: apurado(reais.filter((l) => l.ativado != null).length) };
}

/**
 * Sessões de checkout do Stripe já normalizadas pela borda, em cobrança ou descarte NOMINAL (FR-006).
 * A ordem dos testes é da causa mais barata de conferir para a que precisa do banco.
 * @param {{id:string, livemode:boolean, pago:boolean, conta:string|null, data:string, reembolsada:boolean}[]} sessoes
 * @param {Map<string, {teste:boolean}>} contasPorId
 */
export function classificarSessoesStripe(sessoes, contasPorId) {
  const cobrancas = [];
  const descartes = [];
  for (const s of sessoes) {
    const conta = s.conta ? contasPorId.get(s.conta) : null;
    const motivo = !s.livemode
      ? "modo de teste"
      : !s.pago
        ? "não paga"
        : !s.conta
          ? "sem conta do Sirius"
          : !conta
            ? "conta não encontrada no banco"
            : conta.teste
              ? "conta de teste"
              : s.reembolsada
                ? "reembolsada"
                : null;
    if (motivo) descartes.push({ id: s.id, motivo });
    // `String()` só estreita o tipo: aqui `s.conta` já passou pelo "sem conta do Sirius".
    else cobrancas.push({ id: s.id, conta: String(s.conta), data: s.data });
  }
  return { cobrancas, descartes };
}

/**
 * Quem já pagou e quem paga hoje: a declaração do dono (o retroativo, sem extrato) unida por conta à
 * 1ª cobrança aprovada no Stripe (os novos). Cada conta conta uma vez, com todas as fontes ao lado.
 *
 * As declaradas não têm data de cobrança e contam na janela da época (research D5). Sem o Stripe elas
 * continuam contando, mas a célula leva `parcial`: é "no mínimo", nunca o total, e nunca `0`.
 *
 * O `tier` do banco NÃO é fonte (ele mudou durante a medição de 22/09). Ele só aparece como divergência:
 * plano pago numa conta que não paga hoje.
 * @param {{
 *   declarados?: {declaradoEm:string, contas:{nome?:string, conta:string, pagaHoje:boolean}[]},
 *   stripe: {cobrancas:{id:string, conta:string, data:string}[], assinaturasAtivas:{conta:string}[]} | {erro:string},
 *   contasPorId: Map<string, {tier:string, teste:boolean, ativado?:string|null, nome?:string|null}>,
 *   janela: {inicio:string, fim:string},
 * }} entrada
 */
export function pagantes({ declarados, stripe, contasPorId, janela }) {
  // O nome é o da EMPRESA no banco do produto: o card guarda só o id, porque o repo do hub é público e a
  // lista de quem pagou e cancelou é dado do cliente do cliente.
  const nomeDe = (conta, fallback = null) => contasPorId.get(conta)?.nome ?? fallback;
  const porConta = new Map();
  const naoEncontradas = [];
  const hoje = new Set();
  const entra = (conta, nome, fonte) => {
    const c = porConta.get(conta) ?? { conta, nome, fontes: [], pagaHoje: false };
    c.fontes.push(fonte);
    porConta.set(conta, c);
    return c;
  };

  for (const d of declarados?.contas ?? []) {
    const conta = contasPorId.get(d.conta);
    if (!conta || conta.teste) {
      naoEncontradas.push(d.nome ?? d.conta.slice(0, 8));
      continue;
    }
    entra(d.conta, nomeDe(d.conta, d.nome ?? null), `declarada pelo dono em ${declarados.declaradoEm}`);
    if (d.pagaHoje) hoje.add(d.conta);
  }

  const semStripe = "erro" in stripe ? stripe.erro : null;
  if (!semStripe) {
    const primeira = new Map();
    for (const c of stripe.cobrancas) if (!primeira.has(c.conta) || c.data < primeira.get(c.conta).data) primeira.set(c.conta, c);
    for (const c of primeira.values()) if (naJanela(c.data, janela)) entra(c.conta, nomeDe(c.conta), `1ª cobrança aprovada no Stripe em ${c.data}`);
    for (const a of stripe.assinaturasAtivas) if (contasPorId.get(a.conta) && !contasPorId.get(a.conta).teste) hoje.add(a.conta);
  }

  for (const c of porConta.values()) c.pagaHoje = hoje.has(c.conta);
  const comRessalva = (valor) => (semStripe ? { valor, parcial: `sem o Stripe (${semStripe}): conta só as declaradas` } : apurado(valor));

  const divergencias = [];
  for (const [conta, l] of contasPorId) {
    if (!l.teste && l.tier !== "FREE" && !hoje.has(conta)) divergencias.push({ conta, nome: nomeDe(conta), tipo: `plano ${l.tier} sem pagamento ativo` });
  }

  // A cadeia divide pagantes por ativadas como se uma estivesse dentro da outra. Medido em 22/09/2026: a
  // Cliente E pagou com 33 deals e nenhum contato próprio, e fica fora de "ativado". Nomear o furo
  // é o que impede a taxa de parecer subconjunto exato.
  const pagaramSemAtivar = [...porConta.values()].filter((c) => contasPorId.get(c.conta)?.ativado == null).map((c) => c.nome ?? c.conta.slice(0, 8));

  return { vendas: comRessalva(porConta.size), pagaHoje: comRessalva(hoje.size), contas: [...porConta.values()], divergencias, naoEncontradas, pagaramSemAtivar };
}
