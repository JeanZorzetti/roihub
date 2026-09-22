import type { DadosDaFicha } from "@/lib/ficha-dados";

// 053 — "Quem pagou": o degrau final da cadeia SaaS aberto por conta, cada uma com a fonte ao lado. A
// declaração do dono aparece como declaração, nunca como extrato. Server component, sem interação.

type Saas = NonNullable<DadosDaFicha["saas"]>;

const contas = (n: number) => `${n} ${n === 1 ? "conta" : "contas"}`;
const valorDe = (c: Saas["vendas"]) => ("valor" in c ? (c as { valor: number }).valor : null);

export function Pagantes({ saas }: { saas: Saas }) {
  const jaPagou = valorDe(saas.vendas);
  const pagaHoje = valorDe(saas.pagaHoje);
  const parcial = (saas.vendas as { parcial?: string }).parcial;
  const motivosDescarte = saas.descartes.reduce<Record<string, number>>((a, d) => ({ ...a, [d.motivo]: (a[d.motivo] ?? 0) + 1 }), {});

  return (
    <div className="ficha-bloco">
      <h2 className="ficha-bloco-h">Quem pagou</h2>
      {jaPagou === null ? (
        <p className="foot">Sem número: {(saas.vendas as { naoApurado: string }).naoApurado}.</p>
      ) : (
        <>
          <p>
            {parcial && "No mínimo — "}
            Já pagaram: <strong>{contas(jaPagou)}</strong> · Pagam hoje: <strong>{pagaHoje === null ? "sem número" : contas(pagaHoje)}</strong>
          </p>
          {saas.pagaramSemAtivar.length > 0 && (
            <p className="foot">
              {saas.pagaramSemAtivar.join(", ")} {saas.pagaramSemAtivar.length === 1 ? "pagou" : "pagaram"} sem passar por “ativado”
              (nenhum deal próprio). A taxa ativado → cobrança divide todas as pagantes pelas ativadas, e{" "}
              {saas.pagaramSemAtivar.length === 1 ? "essa conta não está" : "essas contas não estão"} entre as ativadas.
            </p>
          )}
          {parcial && (
            <p className="foot">
              O Stripe não foi lido ({saas.erroStripe}). Os números contam só as contas declaradas. Grave a chave restrita{" "}
              <code>SIRIUS_STRIPE_KEY</code> no EasyPanel para somar as vendas novas.
            </p>
          )}
          <ul className="ficha-krs">
            {saas.contas.map((c) => (
              <li key={c.conta}>
                <strong>{c.nome ?? `Conta ${c.conta.slice(0, 8)}`}</strong> — {c.pagaHoje ? "paga hoje" : "não paga mais"} · {c.fontes.join(" · ")}
              </li>
            ))}
          </ul>
        </>
      )}

      {saas.divergencias.length > 0 && (
        <>
          <h3 className="ficha-bloco-h">Plano pago sem pagamento</h3>
          <ul className="ficha-krs">
            {saas.divergencias.map((d) => (
              <li key={d.conta}>
                <strong>{d.nome ?? `Conta ${d.conta.slice(0, 8)}`}</strong>: {d.tipo}. O produto entrega o plano e a conta não paga. Confira no painel
                do Sirius.
              </li>
            ))}
          </ul>
        </>
      )}

      {saas.naoEncontradas.length > 0 && (
        <p className="foot">
          Declaradas sem conta no banco: {saas.naoEncontradas.join(", ")}. Elas não contam. Confira o id em <code>pagantesDeclarados</code> no card.
        </p>
      )}

      {!saas.erroStripe && (
        <p className="foot">
          {saas.descartes.length === 0
            ? "Stripe lido: nenhuma cobrança descartada."
            : `Cobranças do Stripe que não contam: ${Object.entries(motivosDescarte)
                .map(([m, n]) => `${m} (${n})`)
                .join(", ")}.`}
        </p>
      )}
    </div>
  );
}
