# Quickstart — 018 · Nenhum número da `/okr/atma` está errado

Guia de **validação**, não de implementação. Roda de `roihub/`.

## Pré-requisitos

| item | como conferir |
|---|---|
| Node 22 | `node -v` |
| `.env` local com `ATMA_DATABASE_URL`, `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON` | `node -e "for (const k of ['ATMA_DATABASE_URL','DATABASE_URL','GOOGLE_SERVICE_ACCOUNT_JSON']) console.log(k, !!process.env[k])" --env-file=.env` — imprime o **nome** e um booleano, nunca o valor (Princípio V) |
| Sem dependência nova | `git diff package.json` não pode tocar `dependencies` |

**Constituição, Princípio IV**: nada de push entre **23:30–01:00** e **08:00–08:45 BRT** — push é
deploy e mata o estado noturno / o autopublishing no meio.

---

## Passo 0 — a linha de base, ANTES de qualquer edição (SC-000)

> Medir depois do conserto mede o conserto. A primeira corrida tem que ser a linha de base.

Contar as células `nao-apurado` da ficha da `atma` **no código de hoje** e gravar o número, com a
data, numa seção nova de
`handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md`.

Corrida manual e única — **sem script permanente** (seria scaffolding pelo mesmo argumento da
FR-031). Basta importar `montarNiveis()` com a coleta real e contar
`celulas.filter(c => c.estado === "nao-apurado")` nos sete níveis.

Sem esse número, a **SC-005** ("a lista encolheu") não tem contra o quê comparar.

---

## Passo 1 — reproduzir os números no banco (fonte da verdade)

Todas as queries com `ATMA_DATABASE_URL` do `.env` local.

```sql
-- cadeia de conversão (37 dias, a partir da época de 31/07/2026)
SELECT count(*) FROM patient_leads;                                  -- 51

SELECT min(created_at) FROM patient_leads;                           -- 2026-07-31T06:14Z

SELECT CASE WHEN motivo = 'sem_resposta' THEN 'nao respondeu'
            WHEN motivo IS NULL          THEN 'sem motivo'
            ELSE 'respondeu' END AS grupo, count(*)
  FROM patient_leads GROUP BY 1;                                     -- 29 / 1 / 21

SELECT count(*), sum(preco), avg(preco),
       avg(preco * (1 - coalesce(desconto_vista, 0)))
  FROM orcamentos;                        -- 7 · 37465,43 · 5352,20 · 4932,34

-- por que `contatado` sai da cadeia: o log subconta o degrau que o operador afirma
SELECT count(DISTINCT registro_id) FROM status_historico
  WHERE para = 'contatado';                                          -- 17, contra 51 declarados

SELECT status, count(*) FROM patient_leads GROUP BY 1;
-- cancelado 37 · contatado 6 · pre_orcamento 5 · exames_enviados 3 · novo ZERO → 100%
```

GSC — `POST` em `searchAnalytics/query` na propriedade `sc-domain:roilabs.com.br` com
`dimensionFilterGroups: page contains atma.roilabs.com.br`.

GA4 — `POST` em `analyticsdata.googleapis.com/v1beta/properties/504053080:runReport`, dimensão
`eventName`/`yearMonth`, métrica `eventCount`/`sessions`. Autenticação por
`GOOGLE_SERVICE_ACCOUNT_JSON` via `google-auth-library` — **não há `googleapis` instalado**.

---

## Passo 2 — a suíte

```bash
npm test
```

Verde, suíte inteira, ~1,6 s (SC-008). Todo arquivo de teste novo **registrado em
`package.json` no mesmo commit** — `test/validade.test.mjs` compara a lista com o diretório nos dois
sentidos e reprova quando divergem (Princípio II).

Cobertura por critério:

| SC | teste | o que reprova |
|---|---|---|
| SC-001 | `test/okr.test.mjs` | `lead 51`, `respondeu 21`, `orçamento 4` (pacientes distintos — 7 linhas cruas, dedup do Túlio/017), `tratamento 0` |
| SC-002 | `test/projecao.test.mjs` | a projeção de R$ 50.000 dizer 12,5 em vez de **10,1** |
| SC-003 | `test/okr.test.mjs` + `test/benchmark.test.mjs` | `contatado` como marco; linha da `REGUA` apontando para degrau fora da cadeia |
| SC-004 | `test/okr.test.mjs` + `test/arvore-metas.test.mjs` | numerador e denominador de janelas diferentes; `signup`/`produto` ganhando coletor |
| SC-005 | `test/ficha.test.mjs` | célula `tela-nao-le` sobrevivendo na lista de buracos |
| SC-006 | `test/ficha.test.mjs` | `form_submit` em qualquer catálogo de medidores |
| SC-007 | `test/janelas.test.mjs` | projeto **sem** `epoca` mudando de janela |

---

## Passo 3 — a tela

```bash
npm run dev    # http://localhost:3000/okr/atma
```

| # | Conferir | Esperado |
|---|---|---|
| 1 | Degrau `lead` | **51**, não 20 |
| 2 | Degrau `orçamento` | **4** pacientes distintos, não 5 (as 7 linhas cruas viram 4 pelo dedup do Túlio/017 — 22, 44 e 51 pedem preço duas vezes) |
| 3 | Degrau `respondeu` | **21**, presente na cadeia |
| 4 | Taxa `lead→respondeu` | **no mínimo 41,2% (21/51)**, com o 1 indeterminado nomeado |
| 5 | `contatado` | **não** é marco; aparece como nota "100% contatados (declarado pelo operador, 05/09/2026)" |
| 6 | Ticket | **R$ 4.932,34**, rotulado `apurado` — nunca "declarada (D1)" |
| 7 | Projeção da meta | "âncora zerada — meta não se divide por volume nenhum" (achado em implementação: a cadeia fecha inteira em `tratamento = 0`, e `ancoraDe()` — congelado, FR-034 — escolhe o último marco como âncora; **10,1** é a aritmética que o ticket apurado produz em `n1Total`, verificável isolando `projetar()` de `lib/projecao.mjs`, mas não é o que a tela mostra hoje — reformular essa leitura é a 019) |
| 8 | Janela | colada em **cada** número; a época (31/07/2026) exibida com o motivo |
| 9 | Taxa entre `visitante` e `lead` | **não existe** — são cadeias diferentes |
| 10 | Lista de buracos | **encolheu** contra o Passo 0, e nenhum sobrevivente é `tela-nao-le` |
| 11 | `tratamento` | `apurado(0)` com a `fonte` dizendo as duas coisas: zero declarado pelo dono **e** checkout do MercadoPago descontinuado |
| 12 | Medidor `abandono-por-campo` | "não apurado — janela do GA4 (28d/COMPORTAMENTO) não cobre a época inteira (37d)". Achado em implementação: a guarda exige o GA4 COBRIR a época, não caber dentro dela — comparar 28 dias de `form_start` com 37 dias de `lead` dava negativo (mais lead de WhatsApp que form_start no recorte curto). **12 (19,1%)** é `form_start` 64 − `lead` 51 medido nos 37 dias inteiros da época (fora da janela COMPORTAMENTO, que a FR-003 mantém em 28d) — é o resultado esperado quando a 019 esticar o GA4 para cobrir a época, não o que a tela mostra hoje |

---

## Passo 4 — a não-regressão do portfólio (SC-007)

```bash
# http://localhost:3000/okr
```

Os **16 projetos sem `epoca` saem com os mesmos números de antes**. Uma spec de correção da `atma`
não muda o placar de mais ninguém.

Conferir também:

- `/okr` exibe a janela de **cada linha**, não uma no cabeçalho (FR-009);
- a frase de resumo ("N projetos na posição 1") **diz que soma janelas diferentes**.

E o script, que passou a importar `lib/janelas.mjs`:

```bash
node --env-file=.env scripts/funil.mjs --ver
```

⚠️ A primeira corrida de um check novo mede o check. A saída é lista nominal de propósito — leia as
linhas antes de acreditar em qualquer contagem do rodapé.

---

## Fora de escopo (não conferir aqui)

| item | spec |
|---|---|
| primeira dobra, `/okr/atma/metodo`, `/okr/atma/aquisicao` | 019 |
| janelas longas de Descoberta (8 meses) e Comportamento (12 meses) | 019 |
| pipeline como valor em risco (`R$ 37.465 enviados`) | 019 |
| as seis réguas pesquisadas e o `DELETE` de `market_benchmarks` | 020 |
| velocidade, passagem cumulativa e coorte de `status_historico` | backlog em `handoff/` |
