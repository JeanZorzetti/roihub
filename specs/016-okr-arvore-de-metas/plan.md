# Implementation Plan: Árvore de metas

**Branch**: `016-okr-arvore-de-metas` · **Spec**: `spec.md` · **Base**: 010 (`lib/projecao.mjs`), 015 (`lib/benchmark.mjs`)

## Resumo

`lib/arvore-metas.mjs` nasce com uma função pura, `montarArvore()`, que recebe a `ficha` da 009, a
`projecao` da 010 e a `REGUA` da 015 — e **desce**. Ela não mede nada e não reimplementa nada: a
divisão é `exigencia()` de `lib/funil.mjs`, o mesmo que a 010 já usa; a taxa é `razao()`, que já
recusa `0/0`, ponta não apurada e numerador > denominador.

O que é novo é a **escolha do divisor** (apurado → ponte → faixa) e a **propagação da banda**. Tudo
o mais já existe no repo.

## Constitution Check

| Princípio | Como esta feature atende |
|---|---|
| **I. Contrato único de dados** | Não toca `listProjects()`. A árvore consome ficha e projeção, não projeto. |
| **II. `node --test`, registrado à mão** | `test/arvore-metas.test.mjs` entra no `package.json` **no mesmo commit**. |
| **III. `.mjs` puro, `.ts` só na borda** | Descida inteira em `.mjs`, testável sem subir o Next. `lib/gsc.ts` só ganha a dimensão `page`; `page.tsx` só renderiza. |
| **IV. Push é deploy** | Um push, fora de 23:30-01:00 e 08:00-08:45 BRT. |
| **V. Ambiente explícito** | Sem env var nova — o teto de demanda (DataForSEO) ficou fora por decisão de 03/09 (FR-017). |

## Decisões de projeto

### D1 — A árvore desce por `ficha.marcos`, não por `ficha.taxas`

`taxas[]` só pareia degraus **consecutivos**, e a ponte por definição pula degraus. Descer pelos
marcos permite achar o próximo apurado acima do buraco. `razao()` continua sendo quem calcula —
a árvore só escolhe os dois lados.

### D2 — ⚠️ A `REGUA` não cobre o span que a `atma` precisa (BLOQUEIA a US1 na `atma`)

Descida real da `atma`, marco a marco:

```
tratamento(0) ← precisa CR(?→tratamento)
   apurado consecutivo: aceito é NÃO APURADO          ✗
   ponte orcamento→tratamento: 0/5 = 0%               ✗ (FR-003, divisão por zero)
   faixa de mercado para `orcamento→tratamento`:      ✗ NÃO EXISTE em REGUA.D
```

`REGUA.D` tem `orcamento→aceito` (25-35%) e **não** tem `aceito→tratamento` — a 015 deixou esse
degrau `sem régua` de propósito. Pelas regras da spec como estão escritas, **a árvore para na
primeira camada** e a `atma` não ganha árvore nenhuma.

O que a própria pesquisa da 015 registrou sobre esse degrau:

> `aceito → tratamento iniciado` — ⚠️ **sem régua** — *confundido com aceite na literatura*

Ou seja: a literatura de `case acceptance` **não separa** "aceitou no papel" de "começou o
tratamento". Se ela não separa, o número publicado de 25-35% está medindo o span inteiro
`orçamento apresentado → tratamento iniciado`, e é ele que a árvore precisa.

**Isto é uma decisão de DADO, não de código, e vai para o Jean** (registrada em
`research.md`): acrescentar a `REGUA.D` a linha `orcamento→tratamento` com `media [0.25, 0.35]`,
citando a mesma fonte e declarando na `nota` que o span é o conflado da literatura. A linha
`orcamento→aceito` permanece para a leitura da 015 — spans que se sobrepõem são legítimos, porque
a trava proíbe **compor duas faixas**, não tê-las na tabela.

**Enquanto a decisão não sai, o motor é entregue e testado com faixa injetada**; a árvore da
`atma` em produção para na primeira camada, com o motivo correto na tela. Nenhuma tarefa abaixo
depende dessa linha, exceto o SC-002.

### D3 — Divisor `0` é recusado antes da ponte, não depois

A ordem da FR-002 (apurado → ponte → mercado) e a recusa da FR-003 se cruzam: a ponte
`orcamento→tratamento` da `atma` **é** uma taxa apurada e **é** zero. A recusa vale para as três
origens: qualquer divisor que chegue em `0` cai para a origem seguinte. Sem isso, a árvore
dividiria por zero e devolveria `Infinity` com cara de meta.

### D4 — A banda nasce degenerada e só abre uma vez

Toda camada carrega `{min, max}` desde a primeira. Antes da faixa, `min === max`. Isso faz a
trava da FR-004 ser uma checagem trivial (`bandaAberta` já é `true`?) em vez de um contador
paralelo, e faz a renderização não ter dois caminhos.

### D5 — A camada de impressões é degrau da árvore; a de entrega, não

`clique ← impressão` é uma divisão por taxa (CTR) igual a todas as outras, e entra no mesmo laço.
`impressão ← páginas` é divisão por uma **média**, não por taxa, e a média tem regra própria
(mínimo de 3 páginas, FR-010). Misturar as duas no mesmo laço faria a guarda de amostra vazar
para degraus onde ela não se aplica.

### D6 — Impressões por página numa chamada nova, não na série

`gscSeries()` devolve série diária e é consumida por meia dúzia de lugares. Adicionar dimensão
`page` mudaria a forma do retorno para todos eles. Função nova, `gscPaginas()`, no mesmo módulo e
com a mesma autenticação — e ela entra no `Promise.all` que `coletarDoProjeto()` já tem, sem somar
latência.

### D7 — A alavanca de posição (US4) fica fora da conta

Ela usa uma segunda faixa (curva CTR × posição). Se entrasse como divisor, seria a composição que
a trava nº 1 proíbe. Entra como **leitura paralela**, do mesmo jeito que a régua da 015 é paralela
à §7: responde "e se eu não publicar nada?" sem alterar nenhuma camada.

## Estrutura

| Arquivo | O quê |
|---|---|
| `lib/arvore-metas.mjs` | **novo** — `divisorDe()`, `montarArvore()`, `camadaDeEntrega()`, `alavancaDePosicao()` |
| `test/arvore-metas.test.mjs` | **novo** — ordem do divisor, recusa do zero, trava de faixa única, propagação da banda, caso `atma`, parada com motivo |
| `package.json` | registro do teste (Princípio II) |
| `lib/benchmark.mjs` | `faixaDoSpan(perfil, chaveDe, chavePara)` + `CTR_POR_POSICAO` (US4). Linha `orcamento→tratamento` **pendente de D2** |
| `lib/gsc.ts` | **novo** `gscPaginas()` — dimensão `page` na janela |
| `lib/okr-coleta.ts` | `gscPaginas()` no `Promise.all` existente; devolve `paginas` |
| `app/okr/[slug]/page.tsx` | bloco novo "Árvore de metas", entre `Quanto falta` e `N0` |
| `lib/okr.mjs` · `lib/projecao.mjs` | **intocados** (FR-014) |

## Ordem de entrega

1. **US1 + US2 juntas** — o motor e as travas nascem no mesmo commit; entregar a descida sem a parada é entregar a projeção de €1,8M.
2. **US3** — `gscPaginas()` e a camada de entrega.
3. **US4** — a alavanca de posição.

D2 é paralelo e não bloqueia nenhum dos três: bloqueia só o SC-002 em produção.
