# Research: Indexação do sitemap

**Feature**: `022-indexacao-do-sitemap` | **Date**: 2026-09-07

Nenhum `NEEDS CLARIFICATION` sobreviveu à spec. As decisões abaixo são as que a Technical
Context do [plan.md](./plan.md) referencia.

---

## D1 — Orçamento por PROPRIEDADE, não por projeto

**Decisão**: a corrida resolve a propriedade do GSC de cada projeto **antes** de gastar
qualquer inspeção, agrupa os projetos por propriedade e distribui um teto único entre eles.
Teto configurável por env (`INSPECOES_POR_PROPRIEDADE`, padrão 2000), nunca constante literal.

**Rationale**: 21 dos 35 projetos são subdomínios de `roilabs.com.br` e resolvem para a mesma
`sc-domain:roilabs.com.br`. Um teto por projeto multiplicaria a quota real por 21 e as últimas
inspeções voltariam `429` — que, sem a FR-008, viraria "não indexada". `melhorPropriedade()`
(`lib/gsc-consulta.mjs:7`) já faz essa resolução e já é o que `inspecionarIndexacao` usa por
URL; a mudança é chamá-la **uma vez por projeto**, no planejamento, e não só por URL, na
execução.

**Alternativas rejeitadas**:
- *Teto por projeto*: estoura a propriedade compartilhada. É o modo de falha nomeado na spec.
- *Contar `429` e parar quando aparecer*: a primeira corrida gravaria um dia inteiro de dados
  contaminados até descobrir o limite. `first_run_measures_the_check` — a primeira corrida mede
  o check, não o mundo.

---

## D2 — Rodízio derivado da própria tabela, sem cursor

**Decisão**: a fila do dia é `projetos ordenados pela data da última apuração, mais antiga
primeiro; nunca apurado vem antes de tudo`. Sem tabela de cursor, sem coluna de ponteiro.

**Rationale**: a tabela de apuração já guarda a data por projeto — o "quem foi o último" é
consequência dela, não um estado à parte. Um cursor separado pode divergir do que foi de fato
gravado (corrida que morre no meio deixa o cursor adiantado e pula um projeto para sempre).
Ordenar pelo dado é auto-corretivo: um projeto que falhou continua sendo o mais antigo e é o
primeiro da próxima corrida.

**Alternativas rejeitadas**:
- *`dia % n` como índice da fila*: encolher ou crescer a lista de projetos reembaralha tudo —
  a armadilha de `constante_acoplada_ao_tamanho_da_lista`.
- *Tabela `hub_indexacao_cursor`*: estado a mais que pode mentir sobre o estado que já existe.

---

## D3 — A amostra é o PREFIXO do sitemap, na ordem do arquivo

**Decisão**: quando o inventário excede o orçamento do projeto, inspeciona-se as `N` primeiras
`<loc>` na ordem em que o sitemap as declara (índice de sitemaps percorrido em ordem, filho a
filho). Sem embaralhar, sem semente.

**Rationale**: a SC-004 exige que duas corridas seguidas amostrem o mesmo conjunto. Prefixo é
estável por construção e não precisa de semente guardada. E a ordem do sitemap é a prioridade
que o próprio site declara — a amostra fica enviesada **para o que o site considera importante**,
que é o viés certo para um número que serve de alarme.

**Custo aceito e declarado**: o número **não** é uma estimativa não-enviesada da taxa do site.
Por isso a FR-007 obriga a tela a dizer "200 de 1.200" na mesma frase — a fração vale para a
amostra. É exatamente a lição de `amostra_procurada_fora_do_percentual`.

**Alternativas rejeitadas**:
- *Amostra aleatória com semente fixa por projeto*: estável também, mas o conjunto muda quando o
  sitemap cresce (o hash de posição desloca), e ninguém consegue conferir a olho qual URL entrou.
- *Amostra aleatória sem semente*: viola a SC-004 diretamente. A fração oscilaria por troca de
  amostra e pareceria movimento do site.

---

## D4 — `falha` é uma quinta classe, fora do numerador e do denominador

**Decisão**: cada URL inspecionada cai em exatamente uma classe:
`indexada` · `rastreada_nao_indexada` · `descoberta_nao_indexada` · `outra` · `falha`.
A taxa de indexação é `indexada ÷ (inspecionadas − falha)`.

**Rationale**: FR-008 e SC-005. `inspecionarIndexacao` **já** separa `erro` de veredito
(`lib/indexacao.mjs:66`) e já distingue "sem propriedade" de "não indexada" — o que falta é não
desfazer essa distinção na hora de contar. Erro de quota contado como não-indexação inverte o
sinal: quanto mais o sistema falha, pior o site parece.

**Consequência**: um projeto cujas inspeções falharam todas tem denominador 0 e a taxa é
`null` — "não apurado", nunca 0%.

---

## D5 — Sitemap ausente, sitemap vazio e host fora do GSC são três estados diferentes

**Decisão**: `null` para cada um, com motivo próprio gravado:
`sem_sitemap` · `sitemap_vazio` · `sem_propriedade`.

**Rationale**: os cenários 3 e 4 da US1 pedem frases diferentes na tela e apontam para passos
diferentes. `sem_propriedade` aponta domínio próprio (`vendor_domain_hides_project_from_gsc`),
`sem_sitemap` aponta o build do site. Somar os três num "0%" é a inversão que
`zero_na_janela_nao_e_zero_no_mundo` já custou uma vez.

`julgarSitemap()` (`lib/conformidade.mjs:45`) já separa "HTML servido por catch-all" de "corpo
vazio" de "XML válido" — reusado, não reescrito.

---

## D6 — Ler TODOS os filhos do `<sitemapindex>`, com teto de profundidade 1

**Decisão**: `lerSitemap()` novo em `lib/sitemap.mjs`. Se o corpo é `<sitemapindex>`, busca cada
`<loc>` filho e concatena as `<loc>` de todos. Um nível só: um índice dentro de um índice
devolve o que achou e marca `profundidade_excedida`.

**Rationale**: FR-002. `VER-04` desce um nível **para um item só** — suficiente para "existe uma
página interna?", insuficiente para "quantas páginas o site declara?". Índice aninhado em dois
níveis não existe em nenhum dos 35 hoje; tratar é o caso hipotético, marcar é o custo honesto.

**Deduplicação**: `<loc>` repetida entre filhos conta uma vez. Um índice que lista o mesmo
sitemap duas vezes dobraria o denominador em silêncio.

---

## D7 — Corrida própria, cron às 05:47 BRT

**Decisão**: `POST /api/indexacao`, workflow `.github/workflows/indexacao.yml`, cron
`47 8 * * *` UTC. Mesmo padrão da 021: Actions só dispara, o trabalho é server-side, retry só em
falha de conexão.

**Rationale**: Princípio IV — 05:47 BRT está fora de 23:30-01:00 e de 08:00-08:45. Trinta minutos
depois da série da 021 (05:17) para as duas não dividirem o container nem a quota do Google no
mesmo instante. Rota própria porque uma falha do GSC não pode derrubar o card noturno, e porque
`maxDuration` desta é dela.

**Duração**: inspeção em série a ~300 ms cada. `INSPECOES_POR_CORRIDA` (padrão 400) existe para o
**tempo**, não para a quota: 400 × 300 ms ≈ 2 min, folgado dentro de `maxDuration = 800`. Gastar
as 2000 da propriedade numa requisição HTTP encostaria no proxy do EasyPanel. A quota sobrante não
se perde — o rodízio da D2 a consome nos dias seguintes.

---

## D8 — Cadência semanal por projeto, sem coluna de cadência

**Decisão**: a corrida roda todo dia e pega os projetos mais antigos até esgotar o orçamento da
corrida. A cadência semanal é **consequência** do rodízio com 35 projetos e ~400 inspeções/dia,
não uma regra codificada.

**Rationale**: a Assumption da spec pede semanal; codificar "só reapure após 7 dias" adiciona uma
regra que pode conflitar com o orçamento (projeto grande sozinho consome dias). Deixar a fila
decidir dá a mesma cadência sem a regra. Se a cadência real divergir, o número aparece na saída da
corrida e vira ajuste de `INSPECOES_POR_CORRIDA` — não mudança de código.

---

## D9 — A tela lê o gravado, nunca inspeciona

**Decisão**: `/okr/[slug]/aquisicao` lê a última apuração do banco. Zero chamada à URL Inspection
API no render.

**Rationale**: a página tem `revalidate = 3600` e a quota é diária e compartilhada — uma tela que
inspeciona ao carregar transforma cada visita em consumo de quota que a corrida precisava. E a
FR-014 exige a data da apuração na tela: um número que vem do banco **tem** data; um número
buscado ao vivo finge ser de hoje. `revalidate_morto_por_no_store_no_grafo` — nada de `no-store`
nesta árvore.

---

## D10 — O `~2000/dia` é hipótese a confirmar, não constante de fé

**Decisão**: `INSPECOES_POR_PROPRIEDADE` é lido do ambiente com 2000 de padrão, e a saída da
corrida devolve, por propriedade, `orcamento`, `gastas` e `falhasDeQuota` (HTTP 429).

**Rationale**: a própria spec manda tratar o teto como configurável. Se a primeira corrida
devolver `429` **antes** de gastar 2000, o número real é menor e ajusta-se por env — sem deploy.
Se gastar 2000 sem nenhum `429`, o teto pode ser maior e o rodízio pode acelerar. A corrida é o
instrumento que mede o próprio teto, e por isso ele precisa aparecer na resposta.
