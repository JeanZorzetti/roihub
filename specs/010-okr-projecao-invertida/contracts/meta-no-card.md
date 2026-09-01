# Contrato — o campo `meta` no card

`data/projects.json` é curadoria manual, lida **exclusivamente** por `lib/projects.*`
(Princípio I). Este contrato descreve o campo novo e como ele atravessa `mergeProjects()` até a
tela.

## Forma

```json
{
  "slug": "atma",
  "perfil": "D",
  "meta": { "valor": 50000, "ticket": 4000, "prazo": "2026-12-31", "declaradaEm": "2026-09-01" }
}
```

| Campo | Unidade | Ausente significa |
|---|---|---|
| `valor` | R$ — **o que falta a partir da declaração** | não há meta a inverter |
| `ticket` | R$ por unidade de N1 do perfil | R$ não vira contagem — `não apurado` com motivo |
| `prazo` | data `YYYY-MM-DD` | não há janela pela qual normalizar |
| `declaradaEm` | data `YYYY-MM-DD` | a defasagem de `valor` fica invisível — só isso; a meta continua válida |

**`valor` não se atualiza sozinho.** A tela nunca lê o realizado para descontar (seria
acompanhamento, proibido pela spec), então quem reescreve `valor` conforme o período avança é a
curadoria. `declaradaEm` existe para essa defasagem aparecer na tela em vez de apodrecer calada, e
**nunca** invalida a meta: um limiar de "velha demais" seria um número escolhido, que é o que a R6
proíbe.

`meta` **ausente** é o estado esperado de 39 dos 40 cards (FR-013). Não existe valor padrão, nem
herança de outro projeto, nem inferência a partir de histórico ou benchmark (FR-001, FR-012).

## Tipo (`lib/projects.ts`)

```ts
/** Meta DECLARADA pelo humano, nunca apurada e nunca inferida (FR-001/FR-002). `ticket` paga a
 *  lacuna que a 009 deixou aberta de propósito — mas rotulado como declaração, não medição.
 *  `valor` é o que FALTA a partir de `declaradaEm`: a tela não desconta o realizado (seria
 *  acompanhamento), então o desconto é curadoria e a data existe para ele não apodrecer calado. */
meta?: { valor?: number; ticket?: number; prazo?: string; declaradaEm?: string };
```

O campo sobrevive ao spread de `mergeProjects()` pelo mesmo caminho de `vendas` e `perfil`; não há
mudança em `lib/projects.mjs`. Repos vindos da API do GitHub (não curados) simplesmente não têm
`meta`, e caem em `sem meta declarada`.

## Não faz parte deste contrato

- **Meta em contagem direta** (sem ticket). Dois formatos para o mesmo número seriam duas regras
  divergindo na primeira correção — ver Assumptions da spec.
- **Meta por período com sazonalidade ou rampa.** A distribuição é linear; qualquer curva é
  escolha de quem projeta, que é a previsão que a R6 proíbe.
- **Edição pela tela.** A `/okr` continua sendo leitura pura; meta se edita no card, que é onde a
  curadoria entra no git com diff.
