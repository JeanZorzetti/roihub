# Data Model — 053

Nenhuma tabela nova no banco do hub. Tudo é lido ao vivo de duas fontes e de um campo do card.

## Conta do Sirius (linha da query de research D4)

| Campo | Tipo | Regra |
|---|---|---|
| `id` | string | id da organização |
| `criado` | `YYYY-MM-DD` | data do cadastro, filtra a janela |
| `teste` | boolean | `true` sai de toda contagem |
| `tier` | `FREE`/`STARTER`/`PRO`/`BUSINESS` | só serve para a divergência (D10), nunca como prova de pagamento |
| `tem_stripe`, `tem_mp` | boolean | prova extra ao lado da declaração |
| `ativado` | `YYYY-MM-DD` ou `null` | 1º contato criado 5 min ou mais depois da conta |

## Pagante declarada (card do Sirius, `pagantesDeclarados`)

| Campo | Regra |
|---|---|
| `declaradoEm` | data da declaração, obrigatória |
| `fonte` | texto que a tela mostra ao lado |
| `contas[].nome` | o nome que o dono disse |
| `contas[].conta` | id completo da organização. **Validação:** existe no banco e não é de teste; se não existir, a tela diz "conta declarada não encontrada" |
| `contas[].pagaHoje` | boolean |

## Cobrança do Stripe (research D7)

| Campo | Origem |
|---|---|
| `conta` | `metadata.organization_id` ou `client_reference_id` |
| `data` | criação da sessão |
| `aprovada` | `payment_status = "paid"` |
| `reembolsada` | `payment_intent.latest_charge.refunded` |
| `livemode` | da sessão |

**Descarte** = `{ id, motivo }`, com motivo em: `modo de teste`, `sem conta do Sirius`, `conta de teste`,
`reembolsada`, `não paga`.

## Células da cadeia (o formato que `montarFicha()` já lê)

| Chave em `coletado` | Marco | Valor |
|---|---|---|
| `cliques` | visitante | inalterado (GSC, 28 dias) |
| `signups` | signup | contas reais criadas na época |
| `ativados` | ativado | das de cima, as com `ativado` |
| `vendas` | primeira cobrança aprovada | união declaradas ∪ Stripe, por conta |

Estados: `{valor}` apurado, `{naoApurado, rotulo?}` com motivo. Nunca `0` sobre ausência.

Fora da cadeia, na mesma ficha: **paga hoje** (`{valor, fontes}`), **divergências** (`[{conta, nome, tipo}]`) e
**descartes do Stripe** (`[{id, motivo}]`).

## Transições

Uma conta anda: cadastro → ativada → já pagou → (paga hoje | cancelou). "Cancelou" só existe pela
declaração (`pagaHoje: false`) ou por assinatura Stripe que deixou de estar `active`. A cadeia conta o
degrau alcançado, não o estado atual.
