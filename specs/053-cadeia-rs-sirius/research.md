# Research — 053 A cadeia do Sirius até o dinheiro

Tudo aqui foi medido ou lido em 22/09/2026, no banco de produção do Sirius e no código do hub.

## D1 — Onde mora a coleta

**Decisão.** A regra fica em `lib/saas.mjs` (puro, testável sem subir o Next — Princípio III). A rede fica
na borda, em dois lugares:

- `lib/okr-coleta.ts` ganha a leitura do banco do Sirius, no mesmo formato de `FONTES_PROPRIAS` da Atma
  (`env` + `sql`, uma conexão, falha fechada que devolve `{erro}`, nunca `0`).
- `lib/stripe-leitura.ts` (novo, `.ts` porque faz rede) lê o Stripe por `fetch` na API REST, sem SDK.

**Por quê.** A Atma já prova o padrão "fonte própria por env, ler onde o dado já cai" (R4). Um SDK do Stripe
seria dependência nova para 2 GETs.

**Alternativas.** Reusar `FONTES_PROPRIAS` direto: o formato dela é o da Atma (`patient_leads` →
`celulaDeLeads`), e forçar o Sirius nele misturaria duas regras numa função. Um cron gravando no banco do
hub: cópia pior da tabela que já existe (R4), e atraso de um dia que a leitura ao vivo não tem.

## D2 — A cadeia do Sirius sem mexer nos outros 8 projetos do perfil A

**Fato.** O perfil A é usado por 9 projetos (sirius, polarisia, estetiacrm, reviewshield, context,
seo-forecaster, cannibal_scan, compass, vertice). Pôr `coletor` nos marcos do perfil mudaria a ficha dos 9:
"sem coletor — consultar …" viraria "coletor não rodou", e a SC-005 proíbe isso.

**Decisão.** Um ajuste por projeto em `lib/okr.mjs`, ao lado de `PERFIS`:

```js
export const CADEIAS_DO_PROJETO = {
  sirius: {
    coletores: { signup: "signups", ativado: "ativados" },
    omite: { trial: "todo cadastro ganha 7 dias de PRO automaticamente: degrau de 100%, não filtra ninguém" },
  },
};
```

`montarFicha()` e `cadeiaLigada()` passam a receber o `slug` e aplicam o ajuste. O marco `cobranca` já tem o
coletor `vendas`: no Sirius a célula `vendas` passa a vir de D5, e não do campo `vendas` do card.

**Por quê.** A 052/D3 decidiu que "cadeia ligada" se lê do perfil, não de um campo no card. O ajuste mora no
mesmo arquivo do perfil, pelo mesmo motivo de `fatores` morar lá (research 011/D4): tabela paralela em outro
arquivo diverge na primeira etapa renomeada.

**Alternativas.** Um perfil "A-sirius" novo: duplicaria os marcos, e as duas cópias divergiriam. Remover
`trial` do perfil A para todos: o trial pode ser pago em outro SaaS, e a SC-005 proíbe.

## D3 — A taxa clique → cadastro é recusada

**Fato.** O bloco "Descoberta" da ficha só renderiza quando `marcos[0]` é `visitante` (perfis A e B). Então o
visitante fica na cadeia. Mas `montarFicha()` calcula `razao()` entre marcos vizinhos, e no Sirius os dois
lados passam a ter número: cliques em 28 dias fechando em D-3, cadastros na época (desde 17/03).

**Decisão.** Quando o projeto declara `epoca`, a taxa `visitante → próximo` sai como `não apurado` com o motivo
"janelas diferentes: clique em 28 dias, cadastro desde a época", e nenhuma divisão acontece. A regra vale para
qualquer projeto A/B com `epoca`, não só o Sirius.

**Por quê.** É a FR-008 desta spec e a regra da 051 ("dividir um pelo outro seria dividir períodos
diferentes"). O perfil D resolveu tirando o visitante da cadeia (018), o que aqui apagaria o bloco Descoberta.

## D4 — Cadastro e ativação, numa query

```sql
SELECT o.id,
       to_char(o."createdAt", 'YYYY-MM-DD') AS criado,
       o."isTestAccount" AS teste,
       o.tier,
       o."stripeSubscriptionId" IS NOT NULL AS tem_stripe,
       o."mercadoPagoSubscriptionId" IS NOT NULL AS tem_mp,
       to_char((SELECT min(d."createdAt") FROM "Deal" d
                WHERE d."organizationId" = o.id
                  AND d."createdAt" >= o."createdAt" + interval '5 minutes'), 'YYYY-MM-DD') AS ativado
FROM "Organization" o
```

- **Cadastro** = contas com `teste = false` e `criado` na janela.
- **Ativado** = das mesmas, as com `ativado` não nulo (1º DEAL próprio 5 min ou mais depois da conta; fechado
  pelo dono em 22/09 depois de duas revisões, ver Clarifications da spec). A
  data de ativação é a do contato; a janela filtra pela data do cadastro, como a Atma filtra o orçamento pelo
  lead de origem.
- Medido em 22/09: 108 cadastros e 26 ativadas na época (32 por contato, 34 por contato OU deal), com 0
  ativações em junho, julho e agosto. Uma pagante não tem deal próprio e fica fora do degrau.

**Por que 5 minutos.** Os contatos e deals de exemplo nascem no mesmo minuto da conta. 68 contas têm deal; com o
corte, 26.

## D5 — Quem pagou: a declaração e o Stripe, cada conta uma vez

**Decisão.** O card do Sirius ganha `pagantesDeclarados`:

```json
"pagantesDeclarados": {
  "declaradoEm": "2026-09-22",
  "fonte": "declaração do dono (Jean) em 22/09/2026, sem extrato",
  "contas": [
    { "conta": "<id completo>", "pagaHoje": true },
    { "conta": "<id>", "pagaHoje": false }
    // … as 6
  ]
}
```

**O card guarda só o id, nunca o nome (corrigido em 22/09/2026).** O repo do hub é PÚBLICO: a lista de quem
pagou e de quem cancelou é dado do cliente do Sirius. O nome da empresa é lido ao vivo do banco do produto
(grant na coluna `name`, research D8), e a ficha fica atrás da autenticação do hub. A primeira versão desta
spec, com os nomes, chegou ao GitHub nos commits `127f18e` e `0282598`.


A célula `vendas` do Sirius ("primeira cobrança aprovada") é a UNIÃO, por id de conta, das declaradas e das
contas com a 1ª cobrança aprovada no Stripe. Uma conta nas duas conta uma vez, com as duas fontes.

**Por que não o campo `vendas`.** O script da Atma diz: *"`vendas` NÃO se cura à mão. O valor deste campo é ser
derivado do gateway"*. A declaração é outra coisa, e a tela a mostra como declaração.

**Janela.** As 6 declaradas não têm data de cobrança. Todas foram criadas depois de 17/03, então contam na
janela da época, e a tela diz que a data não foi declarada. Não entram em cortes mensais.

## D6 — "Paga hoje", o N1 do perfil

`pagaHoje = true` na declaração (hoje só a Cliente A) ∪ contas com assinatura `active` no Stripe e
`organization_id` de conta real. A ficha mostra "já pagou" e "paga hoje" lado a lado, cada um com a fonte.

## D7 — O Stripe

- **Chave:** `SIRIUS_STRIPE_KEY`, uma chave restrita `rk_live_…` só de leitura (Checkout Sessions, Charges,
  Invoices e Subscriptions). A chave secreta LIVE do Sirius vazou em 07/07/2026 e não entra no hub.
- **Primeira cobrança:** `GET /v1/checkout/sessions?status=complete&expand[]=data.payment_intent.latest_charge`,
  paginado. Conta = `metadata.organization_id`, ou `client_reference_id` se não houver (é o que o webhook do
  Sirius já faz). Aprovada = `payment_status = "paid"`. A data é a da sessão.
- **Descartes, nominais (FR-006):** `livemode = false` (modo de teste) · não paga · **valor zero** · sem id de
  conta · conta de teste no banco · cobrança reembolsada.
- **A conta Stripe é COMPARTILHADA (medido em 22/09/2026).** A única sessão paga da conta era um trial de outro
  produto do portfólio, em dólar e com valor 0,00, com `metadata.userId` e sem `organization_id`. Por isso
  "valor zero" é descarte próprio (`paid` não quer dizer que entrou dinheiro), e o descarte sem conta avisa que
  pode ser outro produto. Assinaturas ativas: 0.
- **Paga hoje:** `GET /v1/subscriptions?status=active`, com `metadata.organization_id` (o checkout repassa a
  metadata para a assinatura).
- **Sem chave, ou erro:** `não apurado` com o motivo ("chave do Stripe ausente" / "Stripe indisponível"), e
  as 6 declaradas continuam contando. O retroativo não depende do Stripe.
- **Medido em 22/09:** zero conta com `stripeSubscriptionId`. A primeira leitura deve voltar vazia, e vazia
  apurada é `0` real, diferente de não apurado.

## D8 — Usuário só de leitura no banco do Sirius (FR-001)

**Autorizado pelo dono em 22/09/2026.** O usuário da aplicação é superusuário, e o hub não deve usá-lo.

```sql
CREATE ROLE roihub_leitura LOGIN PASSWORD '<32 bytes aleatórios>' CONNECTION LIMIT 2;
GRANT CONNECT ON DATABASE siriusdb TO roihub_leitura;
GRANT USAGE ON SCHEMA public TO roihub_leitura;
GRANT SELECT (id, name, "createdAt", "isTestAccount", tier, "stripeSubscriptionId", "mercadoPagoSubscriptionId")
  ON "Organization" TO roihub_leitura;
GRANT SELECT ("organizationId", "createdAt") ON "Deal" TO roihub_leitura;
-- a tabela de contatos NÃO entra: o grant dela foi revogado quando a ativação passou a ler só deal (22/09).
```

Grant **por coluna**: as tabelas do produto guardam nome, telefone e e-mail dos clientes dos clientes (dado
pessoal, LGPD), e o deal guarda título e valor. O hub só precisa de conta, data e o nome da EMPRESA (que não é
dado pessoal). A senha nunca aparece em log, commit nem chat
(Princípio V): ela é gerada no script, gravada no `.env` local do hub como `SIRIUS_DATABASE_URL` e copiada
pelo dono para o ambiente do serviço `roihub` no EasyPanel.

## D9 — Latência

A query de D4 roda em uma conexão (`max: 1`), em paralelo com o GSC e o GA4 que `coletarDoProjeto()` já
dispara. O Stripe entra no mesmo `Promise.all`. Sem cron e sem cache novo: a ficha é `force-dynamic`, e uma
venda nova aparece na próxima abertura (SC-004).

## D10 — Divergências do produto (FR-013)

A ficha lista, sem somar na cadeia:

- **Plano pago sem pagamento ativo:** conta com `tier` pago que não paga hoje (em 22/09: a Cliente F, PRO).
- **Pagante declarada no plano FREE:** informação, não erro (as 4 que cancelaram).

## D11 — As frases "3 vendas"

Mudam: a `receitaNota` do card do Sirius em `data/projects.json` e o resumo do Sirius em
`data/resumos.json`, que chegam à tela.

Não mudam: `data/defasagem-*.json`, `data/juiz-*.json` e os docs de 01/08. Eles guardam afirmações VELHAS de
propósito, porque são o corpus que mede defasagem e o juiz. Reescrever apagaria o gabarito.

## D12 — O mapa lê a mesma conta (FR-007)

Com o ajuste de D2, `cadeiaLigada("A", "sirius")` fica `ligada`, e o painel "Depois do clique" de
`/gsc/mapa/sirius` chama `dadosDaFicha("sirius")`, a mesma composição de `/okr/sirius`. Não existe segunda
conta.
