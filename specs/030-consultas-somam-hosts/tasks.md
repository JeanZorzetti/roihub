---
description: "Task list — 030 · a leitura por página do Search Console soma os hosts declarados"
---

# Tasks: A leitura por página do Search Console soma os hosts declarados

**Input**: `specs/030-consultas-somam-hosts/` — [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/leitura-por-pagina.md](contracts/leitura-por-pagina.md), [quickstart.md](quickstart.md)

**Tests**: SIM, obrigatórios. Não por escolha de estilo: o Princípio II da constituição é
não-negociável e o plano nomeia `test/gsc-hosts.test.mjs` como arquivo novo. Teste fora da lista de
`package.json` nunca roda — e `test/validade.test.mjs` reprova a divergência nos dois sentidos.

**Organização**: por história, na ordem da spec. A Fase 2 é bloqueante — ela é o que a FR-007
cobra, não scaffolding.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1, US2, US3 — só nas fases de história
- Caminho de arquivo exato em toda tarefa

## Path Conventions

Monolito Next (App Router) na raiz do repo. Lógica pura em `lib/*.mjs`, borda do Google em
`lib/gsc.ts`, testes em `test/*.test.mjs`. **Nenhum diretório novo** — ver plan.md, *Structure
Decision*.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: abrir o portão de teste antes de escrever a primeira linha de lógica. Duas tarefas,
porque um teste que não está na lista é verde à mão e inexistente no CI.

- [X] T001 Criar `test/gsc-hosts.test.mjs` (cabeçalho + um `test()` trivial) e registrá-lo na lista `scripts.test` de `package.json`, no MESMO commit — a lista é explícita e escrita à mão (Princípio II)
- [X] T002 Rodar `node --test test/validade.test.mjs` e confirmar verde: ele compara a lista de `package.json` com o diretório `test/` nos dois sentidos

**Checkpoint**: o arquivo novo roda no CI. Nada de comportamento mudou.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a mescla e o caminho único de leitura. Esta é a "ordem 0" do plano: sem ela, a US1
seria o **quarto** conserto pelo chamador dentro de `lib/gsc.ts` —
`guarda_no_chamador_volta_pela_porta_seguinte`, sexta ocorrência no repo.

**⚠️ CRÍTICO**: nenhuma história começa antes desta fase fechar.

**Contrato de saída da fase**: as três leituras já passam pelo mesmo caminho interno, ainda com
**um** host cada, e a tela é byte a byte a de hoje. Zero mudança visível é o resultado esperado —
é a FR-006 sendo cobrada antes de a soma existir.

- [X] T003 [P] Escrever em `test/gsc-hosts.test.mjs` os 9 cenários da mescla (quickstart §2): mesma página em dois hosts vira uma linha; 22.059@7,3 + 5@21 dá posição ≈7,3 e nunca ≈14; linha de 0 impressões não vota na posição; sem impressão `posicao === null` e nunca `0`; um host só devolve `page` byte a byte igual; `/x` ≠ `/x/`; `?p=2` é linha própria; URL que não parseia é descartada; página só no host antigo sai com `page` no host de `url` e `hosts` com um item. **Devem FALHAR** antes da T004
- [X] T004 Implementar `mesclarPorCaminho(respostas, hosts)` em `lib/gsc-hosts.mjs` (arquivo NOVO, módulo puro — zero imports, sem `process.env`, sem rede), cumprindo C3.1–C3.9: chave `pathname + search` (mais `query` quando a dimensão existir), soma de cliques e impressões, posição `Σ(pos × imp) / Σ(imp)` com `null` em `Σ imp = 0`, `page` reconstruída como `https://${hosts[0]}${caminho}`
- [X] T005 Declarar em `lib/gsc.ts` os tipos `RespostaPorHost` (E3: `host`, `propriedade`, `rows`, `truncado`) e `LeituraSomada` (E5: `{linhas, hosts, encerrados, truncado} | {erro} | null`)
- [X] T006 Criar em `lib/gsc.ts` o caminho único **exportado** `lerPorHosts(hosts, {janela, dimensions, rowLimit, client?})` — uma requisição por host **em série**, `resolveProperty` por host, filtro `page contains "https://${host}/"`, `truncado` comparado contra o `rowLimit` DESTA requisição (D6), host sem propriedade vai para `encerrados`, host que falha aborta a leitura com `{erro: "<host>: <msg>"}` truncado em 60 caracteres (C5, D5). Exportado pelo mesmo motivo que `queryPageWindow` já é: para ser testável sem subir o Next
- [X] T007 Reescrever `queryPageWindow` e o corpo inline de `gscPaginas` em `lib/gsc.ts` sobre `lerPorHosts`, eliminando as três cópias de `resolveProperty` + `dimensionFilterGroups` + teto. As assinaturas públicas continuam recebendo `siteUrl` nesta tarefa; internamente passam `[new URL(siteUrl).hostname]`
- [X] T008 Escrever em `test/gsc-hosts.test.mjs`, com client falso, as 5 linhas da tabela C5: env ausente → `null`; `hosts` vazio → `null`; todos sem propriedade → `null` + `encerrados` cheio; **um** sem propriedade → leitura dos vivos + host em `encerrados`; **um** falhando → `{erro}` começando pelo host e **nenhum número publicado**
- [X] T009 Rodar `npm test` (suíte inteira) e `npm run dev`, conferindo que a aba de aquisição da Atma está idêntica à de antes da fase

**Checkpoint**: um caminho, três leituras, comportamento inalterado. É daqui que as três histórias partem em paralelo.

---

## Phase 3: User Story 1 - O ramo CLIQUE volta a enxergar o site (Priority: P1) 🎯 MVP

**Goal**: a aba de aquisição lê as consultas dos dois hosts, mescladas por caminho, e os sete KPIs
do ramo CLIQUE voltam a ter denominador. Hoje o veredito não sai errado — ele **não sai**.

**Independent Test**: abrir `/okr/atma/aquisicao` e conferir que o total de impressões do bloco de
consultas fecha com a soma das duas propriedades consultadas à mão no mesmo dia, diferença zero.

### Tests for User Story 1 ⚠️

> Escrever primeiro, ver falhar, só então implementar.

- [X] T010 [P] [US1] Escrever em `test/gsc-hosts.test.mjs`, com client falso, os testes de `gscConsultas` com dois hosts: total somado, página duplicada mesclada uma vez, `hosts` devolvido com quem respondeu, `encerrados` separado da falha, `truncado` verdadeiro quando QUALQUER propriedade bate o teto, e um host só produzindo exatamente o retorno de hoje (FR-006)

### Implementation for User Story 1

- [X] T011 [US1] Trocar a assinatura de `gscConsultas` para `(hosts: string[], janela, options?)` em `lib/gsc.ts`, montando o retorno sobre `lerPorHosts` + `mesclarPorCaminho`; `LinhaBusca` ganha `hosts` e **nenhum campo é removido** (C4.1)
- [X] T012 [US1] Passar `hostsDeclarados(p)` no lugar de `p.url` na chamada de `gscConsultas` em `app/okr/[slug]/aquisicao/page.tsx:541` — `hostsDeclarados` já está importado no arquivo (linha 4), nenhuma lista nova (FR-001)
- [X] T013 [US1] Publicar no bloco de consultas de `app/okr/[slug]/aquisicao/page.tsx` **quais hosts compuseram os números** — silencioso com um host, nomeado com dois ou mais (FR-008, C6)
- [X] T014 [US1] Nomear o host nas frases de ausência do bloco em `app/okr/[slug]/aquisicao/page.tsx:1744` — `{erro}` já começa pelo host; `sem propriedade no GSC para ${p.url}` passa a nomear os `encerrados`, mantendo estrutural e transitório separados (D5)
- [X] T015 [US1] Ajustar a ressalva de truncamento no `<dt>piso, não total</dt>` de `app/okr/[slug]/aquisicao/page.tsx:2046-2057`: o teto é **por propriedade**. O selo `piso, não total` **continua** — somar hosts não conserta a omissão das consultas raras (D9)
- [X] T016 [US1] Estender `scripts/conferir-soma-hosts.mjs` com dimensão de página (flag `--pagina`, `dimensions: ["page"]` na linha 50), reusando `hostsDeclarados` e `melhorPropriedade` que o script já importa — script novo está proibido pela FR-001

### Validação da US1

- [X] T017 [US1] Rodar `node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --pagina` e conferir contra a tela: SC-004 é **diferença zero**, comparando bloco contra bloco na MESMA dimensão (quickstart §3)
- [X] T018 [US1] **SUPERADA PELA 032 em 20/09/2026 — os alvos desta tarefa nasceram errados, não foram descumpridos.** Ela pedia "23 páginas, ≈13,04% (3 de 23)" e "impressões do bloco ÷ 24.664 ≥ 99%". Esses números saíram da dimensão `page`, e o bloco desta spec lê `query`+`page` — critério medido com um instrumento e cobrado de outro (`criterio_medido_com_outro_instrumento`). Cumprir a T018 como escrita era impossível: com a leitura por termo o veredito sai 0% com 6 avaliadas, porque a home cai na posição 11,8 e sai do denominador. A 032 trocou a alimentação das medidas por URL e a tela publica agora, conferido em produção duas vezes: **12,5% · 24 avaliadas · 3 atingem**, sem URL repetida, com a base declarada ao lado de cada medida. O que esta tarefa queria provar está provado — pelos números certos. Conferido também pela testemunha independente na MESMA janela da tela (`scripts/conferir-soma-hosts.mjs atma 2026-08-21 2026-09-17 --pagina`): divergência zero
- [X] T019 [US1] Provar a SC-006 retirando o acesso da service account a uma das duas propriedades em `app/okr/[slug]/aquisicao/page.tsx`: **nenhum número do bloco publicado** e o host nomeado. Bloco com total encolhido é reprovação — é o defeito de `guarda_salva_o_historico_e_entrega_a_subcontagem`

**Checkpoint**: US1 fecha sozinha. O board volta a ter veredito e a spec já entregou o que a motivou.

---

## Phase 4: User Story 2 - A ficha conta o site inteiro (Priority: P2)

**Goal**: a lista de páginas da ficha mostra o site inteiro, não a fatia que já migrou.

**Independent Test**: abrir a ficha da Atma e conferir que `/blog/quanto-custa-alinhador-invisivel`
aparece com as ~22.000 impressões, e não com as 5 do domínio novo.

### Tests for User Story 2 ⚠️

- [X] T020 [US2] Escrever em `test/gsc-hosts.test.mjs` os testes de `gscPaginas` com dois hosts: páginas mescladas por caminho e **`truncado` comparado contra 1.000**, não contra `TETO_LINHAS` — comparar contra 25.000 faria a flag nunca disparar na ficha (D6 aplicada ao valor certo)

### Implementation for User Story 2

- [X] T021 [US2] Trocar a assinatura de `gscPaginas` para `(hosts: string[], janela)` em `lib/gsc.ts`; `GscPaginas` ganha `hosts`, `encerrados` e `truncado`, e o campo `paginas` é preservado com o mesmo nome (C4.2)
- [X] T022 [US2] Passar `hostsDeclarados(p)` no lugar de `p.url` na chamada de `gscPaginas` em `lib/okr-coleta.ts:186`
- [X] T023 [US2] Conferir `lib/ficha-dados.ts:170` (`paginas && "paginas" in paginas`) e `camadaDeEntrega()` em `lib/arvore-metas.mjs:241` contra a forma nova — `lib/kpis-busca.mjs` **não é tocado**: com a URL já canônica na entrada, `porUrl` para de duplicar por consequência (D4)

### Validação da US2

- [ ] T024 [US2] Conferir a ficha da Atma em `lib/ficha-dados.ts` renderizada (quickstart §5): a página de maior movimento com as ~22.000 impressões (SC-005), sem aparecer duas vezes, e o número de **páginas necessárias** da camada de entrega mudando junto com as impressões — se só um dos dois mudou, a média ainda está mentindo. ⚠️ **A 031 subiu em 19/09 e NÃO destravou esta tarefa — o motivo registrado aqui estava errado.** Conferido em produção em 20/09/2026: `/okr/atma/metodo` segue dizendo `não apurada — a árvore parou antes da camada de impressões`. A causa nunca foi a série de um host só; é que a árvore de metas da Atma não alcança a camada de impressões, e enquanto ela não alcançar não existe "páginas necessárias" para comparar contra as impressões. Esta tarefa depende da árvore, não de host nenhum — não reabrir esperando que a 031 tenha resolvido

**Checkpoint**: US1 e US2 funcionam independentes.

---

## Phase 5: User Story 3 - O autopublishing para de tratar URL ranqueada como pauta nova (Priority: P3)

**Goal**: o robô de pauta lê o histórico de busca do site inteiro antes de decidir que um assunto é
novo.

**Independent Test**: rodar o autopublishing da Atma em `dry_run` e conferir que as URLs do domínio
antigo aparecem no histórico lido, em vez de virarem pauta marcada como nova.

**Nota de escopo**: nenhum dos 10 projetos do autopublishing declara `dominioAnterior` hoje
(`grep -c atma lib/autopublish-projects.mjs` = 0). A mudança é estruturalmente invisível — e é
exatamente por isso que a FR-006 é o que se cobra aqui.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] Acrescentar dois testes a `test/autopublish.test.mjs`: `hosts` vazio com `strict: true` **lança** e nunca devolve `[]`; com dois hosts, as URLs dos dois entram no histórico antes de a pauta ser classificada. As asserções de pauta existentes ficam intactas — mudança nelas é achado, não ajuste

### Implementation for User Story 3

- [X] T026 [P] [US3] Criar `dominioAnteriorDoSlug(slug)` em `lib/projects.ts`, lendo `curated` direto e sem rede — mesmo argumento que já autoriza `listFichas()`: o campo só existe na curadoria (C2, D2). Acrescentar `dominioAnterior` a `lib/autopublish-projects.mjs` está **proibido** pela FR-001
- [X] T027 [US3] Trocar a assinatura de `gscQueryPages` para `(hosts: string[], options?)` em `lib/gsc.ts`, mantendo `strict`, `sleep` e as 3 tentativas: **soma os hosts primeiro, compara as janelas depois** — inverter a ordem põe a mesma página duas vezes no par `current`/`previous` (C4.3). `hosts` vazio em `strict` lança, nunca devolve `[]`
- [X] T028 [US3] Montar os hosts em `lib/autopublish.ts:221` com `hostsDeclarados({ url: project.siteUrl, dominioAnterior: dominioAnteriorDoSlug(project.slug) })`; `project.siteUrl` continua sendo o host canônico de `targetUrl`, `origin` e sitemap no resto do arquivo

### Rollout da US3 (constituição, *Fluxo de Desenvolvimento*)

- [X] T029 [US3] Rodar `node --test test/autopublish.test.mjs` e a suíte inteira antes de qualquer corrida real
- [ ] T030 [US3] Corrida `dry_run=true` via `POST /api/autopublish` (`app/api/autopublish/route.ts`): dez resumos transitórios, **nenhuma** linha em `seo_publications`, nenhuma imagem, nenhuma escrita no GitHub (quickstart §6)
- [ ] T031 [US3] Rollout nos quatro canários — `goiania`, `tapepro`, `sirius`, `context` em `lib/autopublish-projects.mjs` — validando build, HTTP 200, canonical, schema, sitemap e atribuição de imagem. Só então os demais; kill switch global (`*`) permanece desligado

**Checkpoint**: as três histórias funcionam de forma independente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T032 [P] Portão FR-001 sobre `lib/` e `app/`: `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx app lib scripts` não devolve linha fora de `lib/projects.ts` e `lib/projects.mjs`
- [X] T033 [P] Portão Princípio I: `grep -rn "data/projects.json" --include=*.ts --include=*.mjs --include=*.tsx app lib scripts` não devolve import fora de `lib/projects.*`
- [X] T034 [P] Conferir que cada comentário novo em `lib/gsc-hosts.mjs`, `lib/gsc.ts` e `app/okr/[slug]/aquisicao/page.tsx` traz o **fato medido** que motivou a linha (0,4% das impressões; 22.059@7,3 + 5@21 ⇒ média simples daria ≈14 e reprovaria no balizador ≤10,9) — comentário que narra o que a linha faz é ruído e sai
- [X] T035 [P] Ler o diff inteiro procurando segredo em log, resposta ou mensagem de erro: o `{erro}` de `lib/gsc.ts` carrega o **host** (dado público do card) e nada mais (Princípio V)
- [X] T036 Rodar `npm test` — suíte inteira verde, ~1,6 s, não só os arquivos tocados
- [X] T037 Commit e push do diff inteiro (`lib/gsc-hosts.mjs`, `lib/gsc.ts`, `lib/projects.ts`, `lib/okr-coleta.ts`, `lib/autopublish.ts`, `app/okr/[slug]/aquisicao/page.tsx`, `scripts/conferir-soma-hosts.mjs`, `test/`, `package.json`) em `main` **fora** de 23:30–01:00 e 08:00–08:45 BRT (Princípio IV)
- [X] T038 Conferir `https://hub.roilabs.com.br/okr/atma/aquisicao` no ar **duas vezes**, ~15 min após o push — uma checagem cedo "prova" que não subiu

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependência
- **Foundational (Fase 2)**: depende da Fase 1 — **BLOQUEIA as três histórias**
- **US1 (Fase 3)**: depende da Fase 2. Independente de US2 e US3
- **US2 (Fase 4)**: depende da Fase 2. Independente de US1 e US3
- **US3 (Fase 5)**: depende da Fase 2. Independente de US1 e US2
- **Polish (Fase 6)**: depende das histórias que forem entregues

### Within Each Story

- Teste escrito e **falhando** antes da implementação
- Mescla (puro) antes da borda (`.ts`), borda antes do chamador, chamador antes da tela
- Validação de tela por último, e só ela fecha a história

### Parallel Opportunities

- T003 e T008 são do mesmo arquivo de teste: **não** rodam juntas. T003 é `[P]` contra T005–T007 (arquivos diferentes)
- T010, T020 e T025 são das três histórias e tocam dois arquivos de teste — T010 e T020 disputam `test/gsc-hosts.test.mjs`; T025 é de `test/autopublish.test.mjs` e roda junto com qualquer uma
- T026 (`lib/projects.ts`) não toca nada das outras histórias — pode rodar a qualquer momento depois da Fase 2
- Com as três histórias abertas ao mesmo tempo, T011, T021 e T027 disputam `lib/gsc.ts`: uma de cada vez
- Fase 6: T032–T035 são leituras independentes, todas em paralelo

## Parallel Example: depois da Fase 2

```bash
# Três frentes, três arquivos de entrada diferentes:
Task: "T010 [US1] testes de gscConsultas em test/gsc-hosts.test.mjs"
Task: "T025 [US3] dois testes novos em test/autopublish.test.mjs"
Task: "T026 [US3] dominioAnteriorDoSlug em lib/projects.ts"
```

---

## Implementation Strategy

### MVP (só a US1)

1. Fase 1 (T001–T002)
2. Fase 2 (T003–T009) — **crítica**, e é o que a FR-007 cobra
3. Fase 3 (T010–T019)
4. **PARAR e VALIDAR**: SC-001, SC-002, SC-003, SC-004, SC-006
5. Entregar — o ramo CLIQUE do board já volta a ter veredito

### Entrega incremental

1. Fase 1 + Fase 2 → um caminho, três leituras, tela inalterada
2. + US1 → o board enxerga o site (MVP)
3. + US2 → a ficha conta o site inteiro
4. + US3 → o robô de pauta lê os dois hosts, por `dry_run` e quatro canários

---

## Notes

- **`gscSeries(p.url, ...)` tem o mesmo defeito e está FORA do escopo**, por decisão da spec
  (Assumptions) e registrado em research.md D8. Vira spec própria. Escrito aqui para não ser
  redescoberto daqui a um mês — `migracao_tratada_em_uma_fonte_so`
- `resolveProperty` em `lib/gsc.ts` e `melhorPropriedade` em `lib/gsc-consulta.mjs` respondem a
  mesma pergunta em dois arquivos. Esta spec **não** os unifica: a FR-007 fala da resolução de
  HOSTS, não de propriedade, e ampliar aqui seria escopo que ninguém pediu
- Soma parcial é proibida em qualquer ponto: um total que encolhe sem explicação lê como queda de
  tráfego. Falha de qualquer host declarado impede a publicação do bloco inteiro
- Nenhuma dependência nova, nenhuma tabela, nenhuma migração, nenhuma variável de ambiente —
  a feature **remove** duas cópias de um caminho que hoje existe três vezes
- Commit por tarefa ou por grupo lógico; parar em qualquer checkpoint para validar a história

---

## Execução — 19/09/2026

O que a implementação encontrou e não estava escrito. Tudo medido, nada estimado.

| # | Achado | Evidência | Decisão |
|---|---|---|---|
| 1 | **SC-001 e SC-002 não são atingíveis pela dimensão que o bloco lê.** A spec mediu "≥ 99% das impressões", "23 páginas" e "13,04%" na dimensão `page`; o bloco lê `query`+`page`, onde o Search Console omite as consultas raras. | Testemunha (`scripts/conferir-soma-hosts.mjs`) e tela, janela 20/08→16/09: `query`+`page` = **10.395** de 24.664 impressões (**42,1%**, teto da API), 14 URLs, **6 avaliadas, 0%** atingem o piso. Pela dimensão `page`: 29 páginas, 24 avaliáveis, 3 atingem (12,5%). | Aberta — o dono decide: reescrever os SC contra `query`+`page`, ou alimentar o CTR Gap pela dimensão `page`. O que a spec entrega (o veredito deixa de sair sem denominador: antes `sem base`, agora 0% sobre 6) está feito. |
| 2 | **`gscSeries(p.url)` (D8) contradiz a linha nova na mesma tela.** A série ao vivo lê um host só e alimenta "recebido 6 dos 28 dias", `impressoesV` e `recebidaGsc`. | Tela: "recebido 6 dos 28 dias (2026-09-11 → 2026-09-16) · hosts somados: atma.roilabs.com.br + usealigner.com" na mesma linha. | Fora do escopo por decisão da spec. **Spec própria (031), no ar em 19/09 e conferida em produção.** ⚠️ A previsão de que ela "também decide a T024" **não se confirmou** — ver a linha abaixo. |
| 3 | **T024 não é observável na Atma hoje.** A camada de Entrega está `não apurada — a árvore parou antes da camada de impressões`. Além disso, `impressoesV` (série de um host) e a média por página (agora dois hosts) ficaram em escopos diferentes até a 031. | `/okr/atma/metodo`. | Aberta. ⚠️ **Corrigido em 20/09/2026: NÃO depende da 031.** Ela subiu, a série já soma os dois hosts, e `/okr/atma/metodo` continua `não apurada — a árvore parou antes da camada de impressões`. O bloqueio é a árvore de metas não alcançar a camada de impressões — só o segundo motivo desta linha (escopos diferentes) era da 031, e esse acabou. |
| 4 | **`lib/projects.ts` não carrega no Node** (alias `@/`), e `lib/autopublish.ts` e `app/api/seo/autopublish/route.ts` são carregados pelos testes. Logo `dominioAnteriorDoSlug` não pode ser importado por eles. | 4 testes de rota caíram no primeiro desenho. | `publishProject` recebe `dominioAnterior` por dependência; a rota a injeta por import **dinâmico**. Sem injeção, um host só — o que o robô sempre leu. |
| 5 | **C4.3 do contrato escreve "lança" para strict + todos os hosts sem propriedade; o código de HEAD devolve `[]`.** | `gscConnection` nulo ⇒ `return []` antes do `try`. | Mantido `[]` (FR-006, e lançar pararia projeto sem propriedade). Só lista de hosts vazia lança. Fixado por teste. |
| 6 | C5 linha 3 ("`null` + `encerrados` cheio") não cabe num `null`. | — | `null`; a tela nomeia `hostsDeclarados(p)`. `encerrados` só sai quando algum host está vivo. |
| 7 | O gate literal da T032 (`grep dominioAnterior` vazio fora de `lib/projects.*`) já falhava no baseline: a tela declara a migração e `scripts/backfill-host-gsc.mjs` a lê. | 4 linhas na tela e 4 no backfill, antes desta spec. | Lido pela intenção: nenhuma segunda lista de hosts. As linhas novas só consomem `hostsDeclarados`. |
| 8 | T007 foi absorvida por T011/T021/T027: as assinaturas finais (`hosts: string[]`) entraram direto. | — | A paridade FR-006 foi provada com dado real (abaixo), no lugar do checkpoint de tela. |

**FR-006 com dados reais**: código de HEAD × código novo, `gscQueryPages`, `gscConsultas` e `gscPaginas` nos 10 sites do autopublishing, uma requisição real por leitura — linhas, ordem e posições **idênticas byte a byte** nos 10. Cobre a T030/T031 no que elas protegem (a leitura de busca), mas **não as substitui**: nenhuma corrida `dry_run` nem canário foi executado.

**Produção (T038)**: push em e1a22ed às 20:35 BRT; conferido às 20:38 e às 20:49 — HTTP 200, `hosts somados` e o total 10.395 no HTML servido, estado antigo (`impressões — o piso da régua do board`) ausente. O deploy levou ~2 min desta vez, não os ~15 do costume.

**Rota do autopublishing**: o `import()` dinâmico de `@/lib/projects` só roda numa publicação real, então foi provado à parte — dry-run local com `GITHUB_TOKEN` inválido de propósito devolveu `{"status":"failed","reason":"github-auth"}` (o wrapper resolveu e o `publishProject` rodou), não um 500 de módulo.

**Mutação**: 10 comportamentos quebrados de propósito (teto contra o total, soma parcial, erro sem host, teto de páginas errado, média simples, chave pela URL crua, barra normalizada, `null`→0, lista vazia em strict, autopublishing ignorando o `dominioAnterior`); os 10 são pegos por teste.
