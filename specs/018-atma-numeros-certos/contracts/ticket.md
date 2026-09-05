# Contrato: o ticket — apurado líquido vence declarado

**Feature**: `018-atma-numeros-certos` · FR-020 a FR-024, FR-034

Duas funções puras em dois módulos que já existem. **Nenhuma regra nova em `lib/projecao.mjs`**
(FR-034): ele continua recebendo o ticket pronto.

## O defeito medido

`meta.ticket` vale **R$ 4.000 declarado** no card enquanto `orcamentos` grava `preco` e
`desconto_vista` em **7 de 7** linhas:

```
avg(preco)                          = R$  5.352,20   bruto
avg(preco * (1 - desconto_vista))   = R$  4.932,34   líquido, desconto em 7 de 7, 5-10%
sum(preco)                          = R$ 37.465,43   pipeline enviado
```

`R$ 50.000 ÷ 4.932,34 = **10,1 vendas**`, não as **12,5** que `lib/projecao.mjs` calcula hoje com o
declarado. **Apurado vence declarado** — e essa regra não pode valer para leads e não valer para
dinheiro.

## 1. A coleta — `lib/okr-coleta.ts` (borda)

```sql
SELECT to_char(criado_em, 'YYYY-MM-DD') AS criado, status, paciente_lead_id,
       preco, desconto_vista
  FROM orcamentos ORDER BY criado_em
```

As duas colunas **sempre existiram**; a query nunca as pediu (FR-020). Mesma conexão, mesma query —
zero chamada de rede nova.

`coletarDoProjeto()` passa a devolver `ticket: Celula` ao lado de `orcamentos`.

## 2. A apuração — `ticketDeOrcamentos(rows, { inicio, fim })` em `lib/okr.mjs`

```js
// puro; rows são as linhas cruas de `orcamentos`
ticketDeOrcamentos(rows, janelaConversao)
// → { valor: 4932.34 }
```

```
ticket = avg( preco × (1 − coalesce(desconto_vista, 0)) )   sobre a janela CONVERSAO
```

| Situação | Devolve |
|---|---|
| ≥ 1 orçamento na janela com `preco` numérico | `apurado(média líquida)` |
| `rows` é `null` (sem fonte de orçamento) | `naoApurado("sem fonte de orçamento")` |
| tabela existe mas nenhuma linha na janela | `naoApurado("sem orçamento na janela")` |
| `preco` ausente ou não numérico na linha | linha **fora** da média, nunca convertida em `0` |

**Líquido, não bruto**: o desconto foi concedido em 7 de 7 casos (5–10%). Desconto que 100% dos
casos recebe **é** o preço (FR-021). Um `preco` bruto publicaria um ticket que nenhum paciente
pagou.

**Nunca convertido em `0`**: a regra de `lib/funil.mjs` vale para dinheiro igual — linha sem preço
sai da conta, não entra como zero puxando a média para baixo.

## 3. A resolução — `resolverTicket(ticketApurado, meta)` em `lib/ficha.mjs`

**Uma função, um lugar** (FR-022). Chamada em dois pontos que leem o **mesmo** resultado: a página
(antes de `projetar()`) e `montarNiveis()` (para N1 e N2).

```js
resolverTicket(ticket, meta) → CelulaFicha
```

| Entrada | Saída | Rótulo exibido |
|---|---|---|
| `ticket` apurado | `{ estado: "apurado", valor: 4932.34, rotulo: "ticket", fonte: "média de 7 orçamentos da janela CONVERSAO, líquido de desconto" }` | **apurado** |
| sem apuração, `meta.ticket` existe | `declarada(meta.ticket, { em: meta.declaradaEm, oQue: "meta.ticket", rotulo: "ticket" })` | **declarado** |
| sem os dois | `naoApurada("sem ticket declarado", "campo \`meta.ticket\` do card", "ticket")` | — |

**Nunca zero. Nunca média de outra janela** (FR-024).

O rótulo do apurado **não pode** sair como "declarada (D1)" (FR-023) — é o defeito exibido hoje em
`app/okr/projecao.tsx`.

## 4. Os consumidores

### `app/okr/[slug]/page.tsx`

```js
const ticketCel = resolverTicket(ticket, p.meta ?? null);
const projecao = projetar({
  ficha,
  meta: ticketCel.estado === "nao-apurado" ? p.meta : { ...p.meta, ticket: ticketCel.valor },
  hoje: HOJE,
});
```

`projetar()` recebe o número já resolvido e **não ganha regra nova** (FR-034). A guarda nº 4 dele
("sem ticket declarado — R$ não vira contagem sem valor por unidade") continua sendo o caminho
quando não há nem apurado nem declarado.

### `lib/ficha.mjs` — `montarN1()` e `avaliarN2()`

Os dois passam a receber a **célula pronta** em vez de `{ticket, ticketDeclaradoEm}`.

`combinar()` **não muda**: ele só rebaixa o resultado para `declarado` quando algum insumo é
declarado. Com o ticket apurado entrando, a célula `"Tratamentos iniciados na janela em R$"` vira
`apurado` sozinha — sem uma linha nova.

## 5. Fora de escopo

`sum(preco) = R$ 37.465,43` é **pipeline enviado**, não meta e não receita. Exibi-lo como "valor em
risco" (`R$ 37.465 enviados · R$ 0 fechados · 2 ainda vivos`) é a **019** (FR-035).
