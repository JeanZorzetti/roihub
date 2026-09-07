# Data Model — 020, a régua de mercado da Atma

Duas entidades mudam e uma nasce. Nenhuma célula apurada é tocada (FR-018).

---

## 1. `Linha` — a faixa de mercado de um degrau (existente, estendida)

Vive em `REGUA[perfil][chaveDe→chavePara]`, em `lib/benchmark.mjs`.

### Hoje

```js
{ media: [number, number], elite: [number, number], fonte: string,
  nota?: string, condicional?: string }
```

### Depois

```js
{ media: [number, number], elite: [number, number],
  fonte: string,          // nome do veículo, como hoje
  url: string,            // NOVO — obrigatório em linha nova (FR-002)
  acessadoEm: string,     // NOVO — "2026-09-06", obrigatório em linha nova (FR-003)
  recorte: string,        // NOVO — o que a fonte mede (FR-003)
  nota?: string, condicional?: string }
```

**Regras**

| regra | vale para | por quê |
|---|---|---|
| `url` obrigatória | linha **nova** (perfil D) | FR-002 |
| `url` opcional | as **7 linhas legadas** de A/B/C | FR-002a — não são tocadas por esta spec |
| `acessadoEm` no formato `AAAA-MM-DD` | linha nova | régua envelhece; a data é o que deixa isso visível |
| `recorte` não vazio | linha nova | fonte que mede degrau vizinho não é fonte deste degrau (FR-004) |

**As 7 linhas legadas, nomeadas** — a dívida da FR-002a, para que a spec futura não tenha de
procurá-las: `A: visitante→signup`, `A: trial→cobranca`, `B: produto→carrinho`,
`B: carrinho→checkout`, `B: checkout→pago`, `C: conversa→proposta`, `C: proposta→contrato`.

---

## 2. `Recusa` — entidade nova, mora na **mesma tabela** que a `Linha`

O ponto inteiro da FR-001a: um degrau recusado deixa de ser *ausência de chave* e passa a ser
*entrada com motivo*.

```js
{ recusa: {
    motivo: string,        // por que ESTE degrau não tem régua — específico, nunca genérico
    descartadas?: [ { fonte: string, url?: string, numero: string, porQue: string } ]
  } }
```

`Linha` e `Recusa` são **mutuamente exclusivas** na mesma chave: quem tem `recusa` não tem `media`.

**Por que na mesma tabela e não num documento**: a recusa precisa chegar à tela (FR-001b). Recusa que
vive só no `research.md` apodrece fora do código, e a próxima pessoa refaz a busca que já foi feita —
foi assim que as citações órfãs da 017/018 viraram comentário que ninguém lê.

### Distinção que o modelo tem que preservar — três ausências diferentes

| estado | significa | quem manda |
|---|---|---|
| `sem régua` **com** `recusa.motivo` | o mercado não publica **este** degrau, e o motivo é este | a régua (novo) |
| `sem régua` **com** `condicional` | existe fonte, mas falta o projeto declarar algo | a régua (já existe) |
| `sem par apurado` | buraco de **medição**, não de referência | a §7.2, `apurar antes de comparar` |

Colapsar as três numa frase só é o defeito que a FR-001a corrige.

---

## 3. Conteúdo do perfil D depois desta spec

Os seis vereditos da pesquisa (`research.md`), traduzidos em dados.

### Na cadeia de Conversão — exibida pela 020

| chave | tipo | motivo / faixa |
|---|---|---|
| `lead→respondeu` | `Recusa` | ninguém publica taxa de resposta de lead de saúde; o que existe é B2B SaaS (MQL→SQL 13%, SAL→SQL 52,7%) e outbound frio (reply 1–5%) — outro ato, outra vertical. **2 fontes descartadas.** |
| `respondeu→orcamento` | `Recusa` | *quote-to-close* mede o degrau **seguinte**; a triagem entre responder e receber preço não é padronizada. **1 fonte descartada.** |
| `orcamento→tratamento` | `Recusa` | as fontes medem aceite **pós-consulta presencial**; a Atma não tem consulta. **2 fontes descartadas, com número e link** — Henry Schein One 45%/75%, Gaidge/Planet DDS 64–68%/80%+ |

### Fora da cadeia — pesquisada, **não** exibida pela 020 (D2)

Não entra em `REGUA.D` — não há marcos para essas chaves, e criar marco fantasma é o defeito que a
017 matou. Fica em `research.md`, datada e pronta para a 022:

| degrau | veredito | conteúdo |
|---|---|---|
| `impressão→clique` | condicional | fonte: AWR Google Organic CTR tool. Condição: posição média não declarada |
| `clique→form_start` | recusa estrutural | numerador GA4 × denominador GSC — FR-009 / FR-029 da 019 |
| `form_start→lead` | linha | média [66%, 68%] · Zuko + FormAssembly · 🚩 falta elite verificado |

> ⚠️ **A régua da cadeia de Conversão fica com 3 recusas e 0 linhas.** É o resultado da pesquisa, não
> uma falha da implementação. O que a tela ganha é o **motivo específico** de cada uma, no lugar de
> uma frase genérica repetida três vezes.

---

## 4. `market_benchmarks` (base da Atma) — o que a tabela passa a conter

**Estado hoje (medido 06/09/2026)**: 12 linhas, 12/12 com `source = "A definir - aguardando pesquisa
de mercado"`, valores redondos inventados. Lida por `GET /api/market-benchmarks` e por **duas** telas
do admin da Atma:

1. `/admin/benchmark-mercado` — gera comparações contra o funil real;
2. `/admin/configuracoes` — monta `<BenchmarkEditor />` (`page.tsx:1244`), que lê, edita e faz
   `bulk-update`.

⚠️ A segunda só apareceu no inventário de consumidores rodado imediatamente antes da migration
(07/09). Até ali, esta seção dizia "a tela", no singular.

**Decisão** — a D1 mandou *substituir*, e a pesquisa devolveu **um** número publicável. Não existem 12
linhas certas para pôr no lugar de 12 erradas. A tabela passa a guardar **os seis vereditos**, não
doze métricas:

| `metric_key` | `metric_value` | `source` | destino |
|---|---|---|---|
| `form_start_to_lead` | `66.00` | Zuko Analytics + URL + data | ✅ linha real |
| `impressao_to_click` | `NULL` → ver nota | AWR tool + URL + data | ⏳ condicional |
| `lead_to_respondeu` | `NULL` → ver nota | — | 🚫 recusa |
| `respondeu_to_orcamento` | `NULL` → ver nota | — | 🚫 recusa |
| `orcamento_to_tratamento` | `NULL` → ver nota | HSO + Gaidge, com o porquê da recusa | 🚫 recusa |
| `click_to_form_start` | `NULL` → ver nota | — | 🚫 recusa estrutural |
| os outros 7 `metric_key` atuais | — | — | **removidos** (FR-014) |

🔒 **Restrição de schema — confirmada no `information_schema` em 06/09/2026**: `metric_value` é
`numeric NOT NULL`. Uma recusa não cabe na coluna como está.

**Decisão**: uma migration no app da Atma faz
`ALTER TABLE market_benchmarks ALTER COLUMN metric_value DROP NOT NULL`, e a recusa vira `NULL` com o
motivo em `description`.

*Recusado*: valor sentinela (`-1`, `0`, `999`). Sentinela é lido como medida pelo próximo consumidor —
e "número que não é medida sendo tratado como medida" é literalmente o defeito que esta spec apaga.
Um `ALTER` de uma coluna é menor e mais honesto que um sentinela que sobrevive para sempre.

Colunas e nulidade conferidas: `category`, `metric_key`, `metric_name` e `metric_value` são `NOT
NULL`; `metric_unit` (default `'%'`), `description`, `source`, `last_updated` e `created_at` aceitam
nulo.

**Regra que a tabela ganha (FR-015a)**: `source` não verificável é **recusado na escrita**
(`PUT /:id` e `POST /bulk-update`). Sem isso a próxima pessoa reabastece com "A definir" e esta spec
vira um `DELETE` que durou uma semana.

**Reversibilidade (FR-015)**: as 12 linhas atuais estão transcritas na íntegra em
`contracts/market-benchmarks-antes.md` antes de qualquer escrita — elas são o registro de um erro que
esta família de specs cita.

---

## 5. O que NÃO muda

- Marcos de `PERFIS`, cadeia canônica, janelas por fonte, coletores — nada (FR-018).
- `distanciaDoMercado()` continua percorrendo **só** `ficha.taxas` (cadeia de Conversão).
- `faixaDoSpan()` continua com lookup exato; **uma `Recusa` devolve `null`**, igual a chave ausente —
  a árvore de metas (016) não pode confundir recusa com faixa.
- As 5 travas da R6 seguem valendo, e a trava nº 1 (nunca compor duas faixas) segue sendo teste.
- As 7 linhas legadas de A/B/C: intactas (FR-002a).
