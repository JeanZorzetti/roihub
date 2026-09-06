# Contrato — `valorEmRisco()` e a coluna que falta

**Módulo**: `lib/okr.mjs` (puro) · **Borda**: `lib/okr-coleta.ts` ·
**Testes**: `test/okr.test.mjs` (já registrado) ·
**FRs**: FR-013, FR-013a, FR-014, FR-015, FR-015a, FR-015b, FR-016, FR-017

---

## Passo 0 (bloqueante) — confirmar a chave primária de `patient_leads`

O SELECT de hoje (`lib/okr-coleta.ts:55`) **não pede `id`**. Sem ele,
`orcamentos.paciente_lead_id` não tem contraparte e "vivo" é indecidível.

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'patient_leads' ORDER BY ordinal_position;
```

Rodar **antes** de escrever qualquer código. Se a PK não se chamar `id`, o nome real entra no
SELECT e neste contrato. Nunca se assume o nome — precedente:
`tela_nao_le_nao_e_buraco_de_medicao`, quatro design-reviews perdidos por não abrir o
`information_schema` primeiro.

SELECT novo:

```sql
SELECT id, nome, email, status, motivo, to_char(created_at,'YYYY-MM-DD') AS criado
FROM patient_leads ORDER BY created_at
```

---

## Assinatura

```js
/**
 * O pipeline somado: quanto saiu de orçamento, quanto virou tratamento, quanto ainda está vivo.
 *
 * "Fechado" NÃO sai de `orcamentos.status` (FR-013a): 9 de 9 linhas estão em `enviado` e a coluna
 * nunca conheceu outro valor em cinco semanas — mesmo achado que matou o marco `orçamento ACEITO`
 * na 017. Fechado vem do degrau `tratamento`.
 *
 * @param {{criado:string, status:string, paciente_lead_id:string|number|null, preco?:number|string|null, desconto_vista?:number|string|null}[]|null} linhasOrc
 * @param {Map<string, {motivo: string|null}>} leadsPorId
 * @param {{inicio:string, fim:string}} janela          janela CONVERSAO
 * @param {string[]|null} motivosDePerda                do card; null = taxonomia não declarada
 * @param {import("./funil.mjs").Celula} tratamento     o degrau final da cadeia
 * @returns {ValorEmRisco|null}                         null = sem fonte ou sem orçamento na janela
 */
export function valorEmRisco(linhasOrc, leadsPorId, janela, motivosDePerda, tratamento)
```

## Regras

1. **Janela**: só linhas com `criado` entre `janela.inicio` e `janela.fim` (comparação de string
   `YYYY-MM-DD`, como `celulasDeOrcamento()` já faz).
2. **Dinheiro**: `Number(preco) * (1 - (Number.isFinite(Number(desconto_vista)) ? Number(desconto_vista) : 0))`.
   `pg` devolve `numeric` como **string** — `Number()`, nunca `typeof === "number"`. Linha sem
   `preco` numérico fica **fora**, nunca vira `0`.
3. **`enviados`**: soma dessas linhas + a contagem de **documentos**.
4. **`fechados`**: célula do degrau `tratamento`, repassada. Nunca `status`.
5. **`vivos` / `perdidos`**: por **pessoa** (`paciente_lead_id` deduplicado). Perdido = o lead tem
   `motivo` ∈ `motivosDePerda`. Vivo = todo o resto, **incluindo `motivo === null`**.
6. **`motivosDePerda === null`** → `vivos` e `perdidos` saem `null`, e a tela nomeia o que falta
   declarar (FR-015b). Nunca se assume taxonomia por default.
7. **`paciente_lead_id == null`** → entra em `enviados`, fica fora de vivos e perdidos, sai em
   `semLead` para ser nomeado à parte (FR-015a). `orcamentosSemLead` já é coletado
   (`lib/okr-coleta.ts:232`) e hoje descartado.
8. **Sem linhas na janela** → `null`. O bloco **não renderiza** (FR-017): `R$ 0,00 enviados` lê
   como fato apurado sobre um projeto que não tem a fonte.
9. **`status` do lead não entra em nada.** O id 44 está em `exames_enviados` com motivo
   `sem_interesse`; manda o `motivo`, que é o campo que o operador de fato preenche. Esta spec,
   como a 018, não modela contradição.

## Testes obrigatórios (`test/okr.test.mjs`)

Todos com linhas **sintéticas**. **Nenhuma constante de contagem real** (FR-016, SC-004): um teste
contra `9 orçamentos` reprovaria hoje mesmo — o handoff de ontem registrava 7.

| # | Dado | Espera |
|---|---|---|
| 1 | 2 orçamentos do mesmo lead | `enviados.n === 2` (documentos), `vivos.pessoas === 1` (pessoa) |
| 2 | lead com `motivo: "sem_resposta"` na lista de perda | perdido, não vivo |
| 3 | lead com `motivo: null` | **vivo** |
| 4 | lead com `motivo: "contato_futuro"` fora da lista | vivo |
| 5 | orçamento com `paciente_lead_id: null` | entra em `enviados`, sai em `semLead`, fora de vivos e perdidos |
| 6 | `motivosDePerda === null` | `vivos === null` e `perdidos === null`; `enviados` continua |
| 7 | `preco` chegando como string `"6355.93"` com `desconto_vista: "0.1"` | soma correta |
| 8 | `preco: null` | linha fora da soma, **não** vira `0` |
| 9 | nenhuma linha na janela | `null` |
| 10 | linha fora da janela | ignorada |

## Renderização (`app/okr/[slug]/risco.tsx`)

Formato: `R$ <enviados> enviados · R$ <fechados> fechados · <n> ainda vivos (R$ <valor>)`, mais,
quando houver, `1 orçamento sem lead vinculado — R$ X`.

- Dinheiro por `toLocaleString("pt-BR", { style: "currency", currency: "BRL" })` — o `reais()` que
  já existe em `app/okr/projecao.tsx`. **Nunca** `toLocaleString` cru: o default é até 3 casas e
  foi assim que a tela publicou `R$ 4.932,337` (018, corrigido em `64bb0a7`; FR-035).
- A lista de motivos de perda usada aparece **no bloco**, textualmente — o leitor tem que ver de
  que taxonomia se está falando (FR-015).
- **Proibido** na tela e no módulo: qualquer razão `enviados ÷ meta`, barra de progresso, ou frase
  do tipo "75% da meta" (FR-014). R$ 37.465 é 75% de R$ 50.000, e escrever isso como avanço é a
  projeção pra frente que a R6 proíbe.
