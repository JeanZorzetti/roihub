# Tasks: Crescimento Não-Marca medido no board

**Feature**: `specs/036-crescimento-nao-marca-medido` | **Date**: 2026-09-20
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [data-model.md](./data-model.md) · [research.md](./research.md)

`[P]` = paralelizável (arquivo diferente, sem dependência). Sem marca = sequencial.

## Phase 1 — A medida pura (US2 antes da US1, de propósito)

A US1 é a entrega visível, mas ela **consome** o contrato da US2. Ligar a folha primeiro obrigaria
a escrever a frase de ausência duas vezes — que é o defeito que esta feature existe para não repetir.

- [x] **T001** `lib/marca.mjs`: `crescimentoNaoMarca()` passa a devolver estado nomeado em vez de
  `null`. Ordem de decisão da `data-model.md` §1: `nao-declarada` → `poucos-meses` →
  `nao-consecutivos` → `base-zero` → `medido`. Campos de `medido` **inalterados**.
  (FR-006)

- [x] **T002** `lib/marca.mjs`: comentário de cabeçalho da função explicando por que são cinco
  estados e não `null`, com o fato medido — 33 dos 34 projetos com série caem em `nao-declarada` e
  hoje leem "menos de dois meses fechados". Mesmo idioma de `completude()`, citado no corpo.

- [x] **T003** [P] `lib/marca.mjs`: `variacao(f)` sobe de `app/okr/[slug]/aquisicao/page.tsx:729`,
  auto-contida. Comentário mantém o fato da 025 (`4195%` → `"4.195%"` em pt-BR inverte o veredito
  ao lado de "5% a 10%"). (FR-004)

- [x] **T004** `lib/marca.mjs`: `linhaDeCrescimento(medida)` — a linha de topo dos seis casos da
  tabela de `data-model.md` §2. Com `baseInterrompida: true` a linha abre pelos **absolutos**; sem
  ela, abre pela razão. Glifo `∅ não apurado` nas ausências, nunca `0`. (FR-002, FR-003, FR-003b,
  FR-009)

- [x] **T005** `test/marca.test.mjs`: os casos da medida (arquivo **já registrado** em
  `package.json` — nenhuma edição lá).
  - cinco estados, cada um com a sua entrada mínima
  - `nao-declarada` ≠ `poucos-meses`: série de 238 dias sem `impressoesNaoMarca` **não** devolve
    `poucos-meses`
  - `nao-consecutivos` nomeia os dois meses · `base-zero` traz `paraImpressoes`
  - `linhaDeCrescimento` com `baseInterrompida: true` **não** começa pela razão (FR-014/SC-006)
  - `variacao(41.95) === "43×"` · `variacao(0.072) === "7,2%"` · `variacao(-0.54)` com sinal
  - nenhum estado produz a string `0%` nem `4.195%`

## Phase 2 — A folha no mapa (US1 + US3)

- [x] **T006** `app/gsc/mapa/page.tsx`: leitura da série da Atma por `lerDiasGsc("atma")`, atrás de
  `dbOn()`, dentro de `try/catch` que trunca o erro em 60 caracteres. **Zero** requisição nova ao
  Search Console. (FR-005, Princípio V)

- [x] **T007** `app/gsc/mapa/page.tsx`: `noteDoCrescimento()`, ao lado de `noteDoStriking()`. Ordem
  da `data-model.md` §5: janela em meses fechados → por que a faixa não se aplica → forma da série
  (de `ritmoDoSegmentoAtual`, o **mesmo** objeto da aba) → a razão, quando não abriu a linha.
  (FR-009, FR-010, FR-013)

- [x] **T008** `app/gsc/mapa/page.tsx`: o nó `crescimentoNaoMarca-medido` como **primeiro** filho da
  folha, com os seis estados de tela, reusando o `decl` de `marcaDeclarada(atma)` já em escopo
  (page.tsx:290). Sem glifo de veredito. (FR-001, FR-008, FR-011)

## Phase 3 — O chamador antigo passa a ler a causa certa (US2)

- [x] **T009** `app/okr/[slug]/aquisicao/page.tsx`: o bloco de crescimento consome `estado` em vez
  de `crescimento === null`, e publica a causa nomeada. O parágrafo de `marcaDeclarada()` que
  envolve o bloco **fica como está** — ele separa três motivos que a série sozinha não distingue.
  (FR-007)

- [x] **T010** `app/okr/[slug]/aquisicao/page.tsx`: `const variacao = …` local sai; entra o import
  de `lib/marca.mjs`. `pct` local **permanece** — serve outras medidas fora do assunto marca.
  (FR-004)

## Phase 4 — Verificação

- [x] **T011** `npm test` verde (suíte inteira, 854 + os casos novos) · `npx tsc --noEmit` limpo ·
  `npm run build` sem erro · `npm run validade -- --repo` em 0.

- [x] **T012** Roteiro da [quickstart.md](./quickstart.md) §2 e §3: a medida contra o banco real, o
  nó nas duas telas, o teste de leitura da linha sozinha, a passagem sem JavaScript, e as três
  linhas que precisam bater entre `/gsc/mapa` e `/okr/atma/aquisicao` (SC-005).

- [x] **T013** Commit + push em `main` **fora** das janelas do Princípio IV (23:30–01:00 e
  08:00–08:45 BRT). Conferir a tela no ar duas vezes, com intervalo — o container serve a versão
  antiga até terminar de trocar.

- [x] **T014** `handoff-036-crescimento-nao-marca-medido.md`: o que mudou, o que ficou fora, e o
  **número** — incluindo a virada esperada de 04/10, quando setembro fechar e a comparação passar a
  ser ago→set com base íntegra.

## Ordem e paralelismo

```
T001 → T002 → T004 → T005 ──┐
         T003 [P] ──────────┤
                            ├→ T006 → T007 → T008 ─┐
                            └→ T009 → T010 ────────┤
                                                   └→ T011 → T012 → T013 → T014
```

T003 é o único `[P]` real: toca o mesmo arquivo da T001 mas em símbolo independente, e nada antes
dela depende do resultado.

## Fora destas tasks, por decisão registrada

- A folha gêmea `buscasDeMarca` (vira 037 se valer).
- Mudar `marca.termos` da Atma para incluir `usealigner` (exige recorrer o backfill).
- Consertar `ritmoNaoMarca` chamando `semanasNaoMarca` sem os hosts declarados (hoje inerte).
- Qualquer mecanismo genérico "folha com coletor → nó medido" para as outras 23.

## Notas de execução (20/09/2026)

O que a implementação fez **diferente do escrito acima**, e por quê:

- **T004 — uma função a mais em `lib/marca.mjs`: `causaDaAusencia(medida)`.** A frase de cada ausência
  precisava existir uma vez só para as duas telas a lerem (FR-007); `linhaDeCrescimento` a prefixa com
  `∅ não apurado ·` e `/okr/[slug]/aquisicao` a põe depois do rótulo da leitura. Sem ela, a aba teria
  que escrever quatro frases próprias — a divergência que a feature existe para não repetir.
- **T006 — a leitura usa `descobertaLonga()`, não `lerDiasGsc("atma")` sem janela.** É a MESMA janela
  (8 meses fechando em D-3) que a aba de aquisição passa a `lerDiasGsc`. Sem janela o mapa leria desde
  11/01 e a aba desde 17/01: recortes diferentes da mesma série, e a SC-005 (mesmos meses, mesmos
  absolutos, mesmo pico) passaria a valer por coincidência em vez de por construção.
- **T008 — `decl` subiu para o escopo da função** (estava dentro de `if (sdNode)`), para as duas folhas
  lerem a mesma declaração de marca. Nenhuma linha de lógica do striking distance mudou.
- **T009 — havia um SEGUNDO consumidor de `crescimento === null` em `aquisicao/page.tsx`**: o
  `<details>` "Por que ainda não há crescimento apurável", que explicava a regra do calendário para
  qualquer ausência. Quem achou foi o `tsc` (o `grep` por `crescimentoNaoMarca` não o pega — ele lê a
  variável, não a função). Agora a regra do calendário só sai em `poucos-meses`; nas outras causas o
  `<details>` remete à frase de `causaDaAusencia`, sem prosa nova.
- **T005 — dois testes antigos mudaram de contrato**, não de intenção: o de "um só mês fechado" e o de
  "meses não consecutivos" afirmavam `=== null` e passaram a afirmar o estado nomeado.
- **Sexto estado de tela ≠ sétimo:** "banco indisponível" cobre tanto o `{erro}` do `try/catch` quanto
  `dbOn() === false`, cada um com o seu motivo entre parênteses.
- **`nao-declarada` com `decl.motivo === null`** (o card DECLARA e a série ainda não traz a separação)
  ganhou topic próprio no mapa: dizer "marca não declarada" ali mandaria editar o card, e o conserto é
  esperar a corrida das 05:17. Não é um estado novo da função pura.

### Verificação (T011/T012) — o que foi medido

- `npm test`: 1180 verdes, 0 falhas · `npx tsc --noEmit`: limpo · `npm run build`: sem erro ·
  `npm run validade -- --repo`: 0.
- Contra `hub_gsc_dia` real: `342 → 14.689`, 27 de 31 dias em zero, semana 07→13/09 com 1.492 contra o
  pico 06→12/04 com 17.020 (8,8%) — idêntico à `research.md`.
- Build de produção servido em porta própria, Chrome headless: `/gsc/mapa` sem overflow em 360/768/1440,
  console limpo, 12 requisições todas locais; o nó no canvas abre o painel com a nota; sem JavaScript a
  lista aninhada traz a mesma linha e a mesma nota; `4.195%` em lugar nenhum; nenhum glifo de veredito
  no nó. `/okr/atma/aquisicao` mostra `43×` com `342 → 14.689` e o selo "a faixa do board não se
  aplica"; `/okr/sirius/aquisicao` publica "Marca não declarada" e **não** "ainda não há dois meses
  fechados". Com `DATABASE_URL` vazia o nó diz "banco indisponível", e não "marca não declarada".
- ⚠️ Não verificado: leitor de tela real, dispositivo real, e a tela **no ar** (T013, depois do push).

### No ar (T013) — duas leituras, 20/09/2026

Push às 15:49 BRT (`f6d57ef`), fora das duas janelas do Princípio IV. A tela em
`hub.roilabs.com.br/gsc/mapa` foi lida às **15:50** e às **15:55–15:56** (esta com três consultas
seguidas), procurando `base interrompida (27 de 31 dias em zero)` — string que só existe na versão
nova. As duas leituras deram o mesmo resultado: a linha de topo pelos absolutos, a nota com a janela
em meses fechados e "8,8% do pico", zero `4.195%`. `/okr/atma/aquisicao` publica `43×` com
`342 → 14.689` e `/okr/sirius/aquisicao` publica "Marca não declarada", sem "faltam dois meses".
O deploy levou **~1 minuto**, bem abaixo dos ~15 min que o `CLAUDE.md` cita: a segunda leitura existe
para pegar o container alternando entre a imagem velha e a nova, e não alternou.
