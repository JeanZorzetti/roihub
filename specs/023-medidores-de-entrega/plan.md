# Implementation Plan: Medidores de Entrega — os Core Web Vitals de campo da Atma

**Branch**: `023-medidores-de-entrega` | **Date**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/023-medidores-de-entrega/spec.md`

## Summary

A família **D2 — Entrega** já existe na tela desde a 011 e nunca teve um número: `MEDIDORES.D2`
(`lib/ficha.mjs:153`) lista oito medidores e `montarN5()` devolve
`naoApurada("sem coletor nesta requisição", …)` para todos. Esta feature liga **quatro** deles —
`lcp`, `inp`, `cls`, `ttfb` — ao dado de campo da CrUX.

**A feature é barata porque quase tudo já existe.** `disponiveisN5` é um `Record` que a ficha já
compõe (`lib/ficha-dados.ts:187`); `CelulaFicha.valor` já é `number | string`; `Cel` já imprime
`valor` + `fonte`; `rotuloBuraco: "falhou-agora"` já é o vocabulário da 018 para separar falha de
ausência. O que falta é **uma fonte e uma tradução**.

Três entregas, na ordem em que se destravam:

1. **A leitura** — `lib/crux.ts` fala com a CrUX e traduz a resposta nos **três estados** que a
   FR-003 exige: `record` / `sem-amostra` (HTTP 404) / `falhou`. Um POST por origem devolve os
   quatro vitais.
2. **A tradução** (US1, US2) — `lib/crux.mjs`, puro: p75, unidade por medidor, veredito contra o
   limite do board, rótulo de experimental, período de coleta. Sai como `{valor, fonte}` no
   contrato que `disponiveisN5` já aceita — **sem estado de célula novo**.
3. **O Pass Rate** (US3) — na aba de aquisição, ao lado dos KPIs de board da 021/022, sobre as
   URLs que `porUrl()` já tem em mãos. `comDado < 2` devolve a **explicação**, nunca `100%`.

**A restrição que molda tudo**: dado de campo só existe onde há visitantes. A Atma tem 8 URLs com
impressão em 28 dias e uma concentra 13.262 delas — a expectativa realista é que **a origem tenha
dado e quase nenhuma URL tenha**. A US3 provavelmente entrega uma frase, e isso é o resultado
correto.

**Sem tabela, sem migração, sem rota, sem cron, sem workflow, sem dependência nova.** A spec já
resolveu isso em Assumptions: a fonte serve o próprio histórico, então gravar seria cache
(decisão [D1](./research.md)).

## Technical Context

**Language/Version**: TypeScript + JavaScript (ESM), Node 22

**Primary Dependencies**: Next.js 16 (App Router), React 19. **Nenhuma dependência nova** — a
CrUX é `fetch` e JSON, e nem `google-auth-library` entra (chave de API simples, sem OAuth).

**Storage**: **nenhum.** Não há tabela nova, não há `ensure()`, não há coluna. A leitura vive
dentro da requisição.

**Testing**: `node --test` sobre `test/*.test.mjs`, registrado à mão em `package.json`
(Princípio II). `test/crux.test.mjs` novo.

**Target Platform**: Linux/Alpine em Docker no EasyPanel; dev em Windows.

**Project Type**: Aplicação web única (App Router + `lib/`), sem separação front/back.

**Performance Goals**: 1 POST à CrUX por render da ficha da Atma (`force-dynamic`), e até
`CAP_URLS_PASS_RATE` POSTs por render da aba de aquisição (`revalidate = 3600`, então ~1 rajada
por hora). Timeout explícito por chamada: a ficha não pode ser segurada por uma fonte lenta
(FR-012 violada por lentidão continua sendo FR-012 violada).

**Constraints**: quota da CrUX **a confirmar na primeira corrida** — número de documentação não é
número medido, e a 022 já pagou essa lição com a URL Inspection. Escopo `["atma"]` (FR-014).
Janelas de deploy proibidas do Princípio IV.

**Scale/Scope**: um projeto (`atma`), quatro medidores, uma origem, até um punhado de URLs.

## Constitution Check

*GATE: revisto contra `.specify/memory/constitution.md` antes da Fase 0. Reavaliado após a Fase 1
— sem mudança.*

| Princípio | Como esta feature cumpre |
|---|---|
| **I. Contrato único de dados** | Nenhum import de `data/projects.json`. A ficha já recebe o projeto de `listProjects()` e esta feature só consome `p.slug` e `p.url` do que já chegou. A chave de escopo é o **slug**, nunca o rótulo de exibição. |
| **II. `node --test` registrado à mão** | `test/crux.test.mjs` novo, adicionado à lista de `package.json` **no mesmo commit**. `test/ficha.test.mjs` ganha o caso do `rotuloBuraco` propagado por `montarN5()`. `test/validade.test.mjs` reprova se esquecermos. Nenhum framework de teste instalado. |
| **III. `.mjs` puro, `.ts` só na borda** | Toda a regra cara — parse do p75, formatação por unidade, veredito contra o board, rótulo de experimental, conversão do `collectionPeriod`, Pass Rate, `SLUGS_DE_CAMPO` — nasce em `lib/crux.mjs`, sem `fetch`, sem `process.env`, sem relógio. `lib/crux.ts` só faz a chamada e traduz status HTTP. É o que torna a distinção 404/falha e as bordas de veredito testáveis **sem gastar uma chamada**. |
| **IV. Push é deploy** | **Nenhum cron novo, nenhum workflow novo, nenhuma janela nova** — a decisão D1 elimina a corrida. `maxDuration` de rota nenhuma muda, então o proxy do EasyPanel não muda. O push respeita as duas janelas proibidas, como qualquer outro. |
| **V. Ambiente explícito, segredo nunca em log** | `CRUX_API_KEY` nova, **vazia** no `.env.example`. Ausente, produz célula `CRUX_API_KEY ausente` — **apenas o nome** (FR-011), nunca valor, prefixo ou comprimento. A chave vai na query string da chamada e em lugar nenhum mais; `erro` truncado em 60 caracteres, como em `app/api/gsc-serie/route.ts:60`. |

**Uma nota sobre o Princípio V, registrada e não escondida**: o princípio fala em **rota** validar
ambiente na entrada e responder `503`. Esta feature não tem rota (D1) — a leitura é no render. O
equivalente é a **célula** `CRUX_API_KEY ausente`, e a FR-012 proíbe o contrário: a ficha não pode
virar erro por causa de um medidor. A garantia substantiva do princípio (só nomes, nunca valores)
está cumprida; o mecanismo é o que o contexto permite. Não é violação, é o mesmo princípio numa
superfície que não é rota — mesmo caminho de `lerApuracao()` na aba de aquisição.

**Sem violações.** A tabela de Complexity Tracking fica vazia de propósito.

## Decisões técnicas

Detalhe e alternativas rejeitadas em [research.md](./research.md). Em resumo:

- **Leitura no render, não corrida gravada** (D1). A fonte serve o próprio histórico; uma tabela
  guardaria o que a CrUX já guarda. Evita tabela + `ensure()` + rota + workflow + horário fora das
  janelas — tudo que a 022 precisou e esta não.
- **Um POST por origem resolve os quatro vitais** (D2). `formFactor` omitido = agregado de todos
  os dispositivos, declarado na tela (FR-010).
- **`404` é ausência de amostra; todo o resto é falha** (D3). Não é heurística nossa, é o
  protocolo da fonte — e é a FR-003 inteira. `429` fica do lado da falha: quota estourada é
  transitória por definição.
- **Unidade e veredito viajam em `valor`/`fonte`** (D4). O tipo já aceita `string`, `Cel` já
  imprime os dois. Zero componente novo, zero estado de célula novo, zero mudança em `combinar()`
  ou `validarKrs()`. FR-004 sai **por construção**: `Medida` não existe sem `p75`, então não há
  ramo capaz de classificar uma ausência.
- **"Experimental" vem do prefixo `experimental_` da chave** (D5), não de uma lista nossa — a
  rotulagem para sozinha quando o Google promover a métrica, em vez de congelar.
- **`rotuloBuraco: "falhou-agora"` propagado por `montarN5()`** (D6), três linhas. A alternativa
  era escrever "indisponível" na mensagem só para casar a regex de fallback — acoplamento por
  string num texto que qualquer revisão de UX writing quebra em silêncio.
- **Pass Rate na aba de aquisição, não em `MEDIDORES.D2`** (D7). O catálogo é o espaço de chaves
  de `n5:` que `validarKrs()` casa por igualdade exata; uma chave apontando para uma fração de
  URLs misturaria os dois escopos que a spec proíbe misturar. A aba já tem `revalidate`, já tem a
  lista de URLs e já é onde os KPIs de board vivem.
- **`SLUGS_DE_CAMPO = ["atma"]`, constante local** (D8).

### A premissa da spec que a pesquisa corrigiu

A spec afirma que "as corridas de busca percorrem `projetosDeBusca()`
(`SLUGS_DE_BUSCA = ["atma"]`)". **Essa função não existe.** `grep` no repo inteiro acha duas
ocorrências, ambas dentro da própria `spec.md`; `/api/gsc-serie` e `/api/indexacao` percorrem
`(await listProjects()).filter((p) => p.url)` — **todos** os projetos com URL.

O efeito que a FR-014 pede continua garantido, por um caminho mais barato: como esta feature lê no
render de um projeto por vez, o filtro é um `if` contra uma constante, e **projeto fora da lista
não muda de comportamento nem gasta chamada** — os quatro medidores continuam dizendo "sem coletor
nesta requisição", que é o que dizem hoje e é verdade. Zero diff para os outros 34.

Escrever `projetosDeBusca()` agora seria uma abstração com **um** consumidor. Quando a 021 e a 022
precisarem do mesmo filtro, ela nasce lá, com dois consumidores reais.

## Project Structure

### Documentation (this feature)

```text
specs/023-medidores-de-entrega/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — as 10 decisões
├── data-model.md        # Fase 1 — entidades (nenhuma persistida)
├── quickstart.md        # Fase 1 — validação ponta a ponta
├── contracts/
│   ├── crux-mjs.md      # o módulo puro
│   └── crux-fonte.md    # a borda com a CrUX
├── checklists/
│   └── requirements.md  # já existente
├── spec.md
└── tasks.md             # /speckit-tasks — NÃO criado por /speckit-plan
```

### Source Code (repository root)

```text
lib/
├── crux.mjs                      # NOVO — puro: VITAIS, SLUGS_DE_CAMPO, medirRecord,
│                                 #   formatarValor, rodape, celulasDeVitais, passRate
├── crux.ts                       # NOVO — borda: cruxOn(), lerCampo(), 3 estados
├── ficha.mjs                     # montarN5() propaga `rotuloBuraco` (D6, ~3 linhas);
│                                 #   montarNiveis() exibe D2 quando há medida (D11)
└── ficha-dados.ts                # disponiveisN5 recebe os 4 vitais quando slug ∈ SLUGS_DE_CAMPO

app/okr/[slug]/
├── aquisicao/page.tsx            # Pass Rate (US3), ao lado dos KPIs da 021/022
└── metodo/page.tsx               # renderiza a nota de N5 (D11, 1 linha)

test/
└── crux.test.mjs                 # NOVO — registrado em package.json NO MESMO COMMIT

package.json                      # + test/crux.test.mjs na lista de `npm test`
.env.example                      # + CRUX_API_KEY= (vazia)
```

**Structure Decision**: aplicação web única, exatamente a estrutura que o repo já tem. Dois
arquivos novos em `lib/` (o par `.mjs` puro + `.ts` borda que o Princípio III manda), um teste
novo, e três arquivos existentes tocados de leve. **Nenhum diretório novo, nenhuma camada nova,
nenhuma rota nova.**

## Riscos e o que os contém

| Risco | Contenção |
|---|---|
| **A família D2 nunca é escolhida** — descoberto na análise cruzada, depois deste plano | [D11](./research.md): `montarNiveis()` exibe D2 quando há medida. Sem isso a US1 inteira é código correto que ninguém vê. FR-002a/FR-002b, tarefas T009a/T009b. |
| Exibir D2 sempre poluir as outras 34 fichas | A condição é **haver medida**, não o slug: `MEDIDORES.D2.some(id => id in disponiveis)`. Projeto sem coletor não ganha bloco nenhum — mesmo raciocínio de `medidorCabeNoPerfil()`. |
| A CrUX não serve `experimental_time_to_first_byte` | FR-008: os quatro vitais são lidos com acesso opcional cada. TTFB some, os outros três aparecem. Fixado em teste. |
| O `404` significar outra coisa além de "sem amostra" | Passo 1 do [quickstart](./quickstart.md) mede o corpo real **antes** de a tela existir. Se for outra coisa, muda a tradução em `crux.ts` — o módulo puro não muda. |
| A CrUX normalizar a URL silenciosamente | `urlNormalizationDetails` é lido e conferido no Passo 1. Medir outra página sem dizer seria a confusão de alvo que a spec proíbe. |
| Quota estourar na aba de aquisição | Chamadas de URL **em série** e capadas em `CAP_URLS_PASS_RATE`, com `revalidate = 3600`. `429` cai em "falhou agora", não em "sem dado". |
| Uma CrUX lenta segurar a ficha | Timeout explícito por chamada. FR-012 vale para lentidão, não só para exceção. |
| Alguém "preencher o vazio" com PageSpeed | SC-003 é uma checagem de **ausência** no quickstart, e o motivo está escrito na spec: `lighthouse_local_windows_onedrive_unreliable` (±30% nesta máquina) e `goiania_lcp_root_causes` (uma leitura não decide nada). |

## Complexity Tracking

> Preenchido apenas quando o Constitution Check tem violações a justificar.

**Vazio.** Sem violações — ver a nota sobre o Princípio V acima, que é adequação de superfície
(célula em vez de `503`, porque não há rota), não exceção a princípio.
