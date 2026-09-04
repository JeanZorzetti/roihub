# Implementation Plan: A cadeia da `atma` é a que o app da Atma escreve

**Branch**: `017-cadeia-real-atma` · **Spec**: `spec.md` · **Base**: 009 (`lib/okr.mjs`), 015 (`lib/benchmark.mjs`), 016 (`lib/arvore-metas.mjs`)

## Resumo

A mudança é de **dados declarados**, não de motor. `PERFIS.D.marcos` passa a espelhar o `ETAPAS` do
repo da Atma; `contatado` ganha um coletor que sai da query que já roda; `STATUS_ACEITE` e o marco
`aceito` morrem; a `REGUA.D` é re-chaveada. O motor da 016 (`montarArvore`, `divisorDe`) **não
muda uma linha** — ele já faz a coisa certa, só estava descendo por uma cadeia falsa.

A US4 (CTR × posição) é a única adição de código de verdade, e é aditiva: uma tabela nova em
`lib/benchmark.mjs` e um retorno a mais em `alavancaDePosicao()`.

## Constitution Check

| Princípio | Como esta feature atende |
|---|---|
| **I. Contrato único de dados** | Não toca `listProjects()`. Muda `PERFIS`, que já é o contrato de cadeia. |
| **II. `node --test`, registrado à mão** | `test/cadeia-atma.test.mjs` entra no `package.json` no mesmo commit. Os testes existentes de `okr`, `benchmark` e `arvore-metas` são atualizados, não substituídos. |
| **III. `.mjs` puro, `.ts` só na borda** | Cadeia, régua e alavanca em `.mjs`. `lib/okr-coleta.ts` só ganha a coluna `status` na query que já existe. |
| **IV. Push é deploy** | Um push, fora de 23:30-01:00 e 08:00-08:45 BRT. |
| **V. Ambiente explícito** | Sem env var nova. `ATMA_DATABASE_URL` já existe e já está no EasyPanel. |

## Decisões de projeto

### D1 — A fonte da cadeia é o `funil.ts` da Atma, copiado, não importado

O hub não pode importar de outro repo. A cópia é declarada como cópia: a `fonte` de cada marco
aponta para `Atma/Site/admin/src/lib/funil.ts` pelo caminho. Um teste compara as duas listas por
slug — mas só roda se o repo da Atma estiver ao lado, e **pula** (não falha) se não estiver, porque
o CI do hub não clona o repo do cliente.

Alternativa recusada: gerar a cadeia por query no `atma_db` (`SELECT DISTINCT status`). O banco só
conhece os status que **já aconteceram** — hoje 3 de 6 — e uma cadeia que encolhe quando ninguém
avança é pior que uma cadeia declarada.

### D2 — `contatado` é cumulativo por regra declarada, não por histórico

`status_historico` existe, tem 50 linhas e **zero transições reais** (`de IS NULL` em todas). Como
log de evento ele vale nada. A regra do Jean (`todo cancelado foi contatado`) mais o `default 'novo'`
dão a mesma resposta sem tabela nova:

```sql
contatado_cumulativo = COUNT(*) FILTER (WHERE status <> 'novo')
```

O comentário de `lib/okr.mjs:193` — "`status` é posição ATUAL, não evento, e quem cancelou depois
de atendido já não conta como contatado" — estava **certo na mecânica e errado na conclusão**: a
regra declarada resolve exatamente o caso que o comentário teme.

Essa regra vale **só para `contatado`**. Ela não se propaga para `pre_orcamento` nem para
`exames_enviados`: nada garante que todo cancelado tenha chegado até lá.

### D3 — `pre_orcamento` conta pela tabela `orcamentos`, e a ficha declara as órfãs

Duas populações disponíveis, nenhuma perfeita:

| fonte | valor | defeito |
|---|---|---|
| `patient_leads.status IN (pre_orcamento, exames_enviados, convertido)` | 7 | apaga quem passou e cancelou |
| `orcamentos` (linhas) | 7 | 2 linhas sem `paciente_lead_id` |

Escolho `orcamentos`: é log de **evento**, e evento não some quando o lead muda de coluna. As 2
órfãs viram nota na tela (FR-006), não silêncio. Coincidência de as duas darem 7 hoje não é razão
para tratar como equivalentes.

### D4 — Re-chaveamento da `REGUA.D`

| chave hoje | vira | justificativa |
|---|---|---|
| `visitante→lead` | `visitante→novo` | mesmo degrau, nome do produto |
| `lead→contatado` | `novo→contatado` | idem |
| `orcamento→aceito` | `exames_enviados→convertido` | *case acceptance* é "mandou o preço e o paciente fechou". Na Atma o orçamento **definitivo** sai junto com os exames, e fechar é `convertido`. A faixa 25-35% / 70-90% e a fonte não mudam — muda o nome do span que ela cobre. |
| — | `contatado→pre_orcamento` | **sem linha.** Ninguém publica esse degrau isolado. Fica sem régua, como a 015 já fazia com `contatado→orcamento`. |
| — | `pre_orcamento→exames_enviados` | **sem linha, de propósito.** É o gargalo apurado (0 de 7). Cobrir com benchmark seria trocar o achado por uma estimativa. |

### D5 — A árvore vai parar, e parar é o resultado

Descida da `atma` depois da correção:

```
convertido(meta) ← CR(exames_enviados→convertido)
   apurado consecutivo: 0/0 → razao() recusa 0/0      ✗ (não apurado, não zero)
   ponte: todo trecho que termina em convertido = 0   ✗
   faixa de mercado: exames_enviados→convertido       ✓ 25-35% — GASTA A ÚNICA FAIXA
exames_enviados ← CR(pre_orcamento→exames_enviados)
   apurado consecutivo: 0/7 = 0%                      ✗ FR-003, divisão por zero
   ponte: mesma coisa                                 ✗
   faixa: segunda faixa                               ✗ trava nº 1
   → PARA AQUI, nomeando o degrau
```

A tela ganha uma camada (`exames enviados` necessários, em banda) e um motivo de parada que aponta
para uma ação real: **destravar `pré-orçamento → exames enviados`**. Isso é o entregável — não é
falha da árvore.

### D6 — `CTR_POR_POSICAO` é leitura paralela, e o teste prova isso

A D7 da 016 foi revogada pelo Jean. A trava que sobrevive é aritmética: nenhuma camada da árvore
pode ter `CTR_POR_POSICAO` como divisor. O teste da 016 que garante isso é mantido e reforçado —
`alavancaDePosicao()` continua sendo chamada pela `page.tsx`, nunca por `montarArvore()`.

A tabela é faixa por linha (posição 1 = 25-32%, e assim por baixo), com fonte por linha, e a
tradução CTR → posição devolve **faixa de posições**, nunca "posição 5,3".

## Arquivos

| arquivo | mudança |
|---|---|
| `lib/okr.mjs` | `PERFIS.D.marcos` reescritos; `STATUS_ACEITE` e `celulasDeOrcamento().aceitos` removidos; `fatores` re-cobertos |
| `lib/okr-coleta.ts` | `status` na query de `patient_leads`; devolve `contatados` |
| `lib/benchmark.mjs` | `REGUA.D` re-chaveada; `CTR_POR_POSICAO` nova |
| `lib/arvore-metas.mjs` | `alavancaDePosicao()` devolve faixa de posição |
| `app/okr/[slug]/page.tsx` | nota das órfãs; faixa de posição na alavanca |
| `test/cadeia-atma.test.mjs` | novo |
| `lib/projecao.mjs` | **intocado** (FR-010) |
