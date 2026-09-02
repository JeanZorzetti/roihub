---

description: "Task list for N3 — Funil Visual"
---

# Tasks: N3 — Funil Visual

**Input**: `specs/012-n3-funil-visual/` — [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/funil-n3.md](./contracts/funil-n3.md), [quickstart.md](./quickstart.md)

**Tests**: obrigatórios — não por preferência, por constituição. O Princípio II é NÃO-NEGOCIÁVEL e o
Portão 1 de merge é `npm test` verde. As asserções entram em `test/ficha.test.mjs`, que **já está**
na lista de `npm test`: nenhum arquivo de teste novo, nenhuma linha nova no `package.json`.

**Organização**: por user story, para que US1 (a forma) e US2 (a não-regressão) sejam verificáveis
uma sem a outra.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: paralelizável — arquivo diferente, sem dependência de tarefa incompleta
- **[Story]**: US1 ou US2 (fases de user story apenas)

## Path Conventions

Aplicação web Next.js na raiz do repo. Quatro arquivos existentes são tocados; nenhum diretório
novo: `lib/ficha.mjs`, `app/okr/[slug]/page.tsx`, `app/globals.css`, `test/ficha.test.mjs`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: capturar a linha de base que a SC-004 mede — ela só existe se for medida **antes**.

- [X] T001 Rodar `npm test` e registrar a suíte verde; abrir `/okr/atma` no host do EasyPanel e anotar o total de JS transferido (DevTools → Network, filtro JS) como linha de base da SC-004, em `specs/012-n3-funil-visual/quickstart.md` §4

**Checkpoint**: suíte verde e número de JS anotado — sem eles, "não aumentou" é opinião.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: a derivação pura e o campo `funil` no nível N3. Bloqueia US1 e US2 — sem o dado, não há
nem forma para desenhar nem regressão para conferir.

**⚠️ CRITICAL**: nenhuma tarefa de user story começa antes deste checkpoint.

- [X] T002 Implementar `segmentosDoFunil(ficha, celulasN3)` exportada em `lib/ficha.mjs`, com a regra de altura de [data-model.md](./data-model.md) §1 (`base` = maior valor entre marcos apurados; `valor === 0` → `0`; `base <= 0` → `0`; caso geral `max(PISO, valor / base)`), `PISO` como constante nomeada no módulo e comentário dizendo por que ele nunca se aplica a zero (R1). A guarda `base <= 0` cobre **dois** casos de propósito: cadeia toda zerada e cadeia sem marco apurado nenhum, onde `Math.max()` de conjunto vazio é `-Infinity` (C8)
- [X] T003 Ligar a derivação em `montarNiveis()` de `lib/ficha.mjs`: guardar o retorno de `montarN3(ficha)` numa const, passar **essa mesma lista** para `segmentosDoFunil()` e anexar `funil` ao objeto do nível N3; o ramo sem perfil recebe `funil: []` (FR-005). Nenhuma segunda chamada de `montarN3()`
- [X] T004 [P] Estender o tipo local de `niveis` em `app/okr/[slug]/page.tsx` com `funil?: { estado: string; entrada?: number; saida?: number }[]`, sem tocar em `CelulaFicha`

**Checkpoint**: `n3.funil` existe e é `[]` para projeto sem perfil.

---

## Phase 3: User Story 1 — Reconhecer o formato da cadeia num relance (Priority: P1) 🎯 MVP

**Goal**: quem abre a ficha vê, antes de ler qualquer linha, quantos degraus a cadeia tem e em qual
deles o dado para de existir.

**Independent Test**: abrir `/okr/atma` (perfil D, 5 taxas, 1 apurada) e a ficha de um projeto de
perfil A/B/C (4 taxas) lado a lado; contar os segmentos e distinguir o apurado do vazio **sem ler
texto**.

### Testes (mesmo arquivo — sequenciais entre si por conflito de edição)

- [X] T005 [US1] Em `test/ficha.test.mjs`: contagem — **laço sobre `Object.keys(PERFIS)`** de `lib/okr.mjs` afirmando `funil.length === PERFIS[k].marcos.length - 1` e `funil.length === n3.celulas.length` para **os quatro** perfis. O laço é o que prova a ausência de branch por perfil; dois casos escritos à mão só provam duas amostras, e perfil novo entra de graça (C1, FR-002, SC-003)
- [X] T006 [US1] Em `test/ficha.test.mjs`: estado — `funil[i].estado === n3.celulas[i].estado` para todo `i`; segmento apurado tem `entrada`/`saida` em `[0,1]` com `saida <= entrada`; segmento não apurado **não** tem `entrada` nem `saida` (C2, C3, C4, SC-002)
- [X] T007 [US1] Em `test/ficha.test.mjs`: escala — marco apurado com `valor: 0` produz altura `0` exata sem piso; cadeia com todos os marcos apurados em `0` produz alturas `0` sem `NaN` nem `Infinity`; a base é o maior marco apurado, não o primeiro (C5, C6, D2 do research)
- [X] T007a [US1] Em `test/ficha.test.mjs`: os dois vazios que não são zero — cadeia com **nenhum** marco apurado dá a contagem certa de segmentos, todos `nao-apurado`, sem `NaN` nem `-Infinity` (C8, Edge Case 1 da spec); taxa `0/0` produz segmento `nao-apurado`, nunca apurado com altura `0` (C9, Edge Case 3, R1)

### Implementação

- [X] T008 [US1] Componente `FunilN3` em `app/okr/[slug]/page.tsx`, ao lado de `Cel` e `Linha`: SVG de [contracts/funil-n3.md](./contracts/funil-n3.md) §2 — `viewBox="0 0 600 96"`, eixo em `y=48`, meia-altura máxima `44`, `<polygon>` para apurado e `<rect fill="url(#n3-hachura)">` para não apurado, com o `<pattern>` diagonal em `<defs>`
- [X] T009 [US1] Renderizar `<FunilN3 />` **acima** das linhas de N3 em `app/okr/[slug]/page.tsx`, somente quando `n.id === "N3" && n.funil?.length`, sem tocar no `n.celulas.map(...)` que já está lá
- [X] T010 [P] [US1] Bloco `.ficha-funil` em `app/globals.css`: `width: 100%`, `height: auto`, `display: block`, preenchido em `var(--seq550)`, trilho e hachura em `var(--grid)`; raio 0, sombra 0, nenhuma `opacity` (direção corte-seco de `.art/log.json`)

**Checkpoint**: US1 entregue e conferível sozinha — o funil aparece, com a contagem certa por perfil.

---

## Phase 4: User Story 2 — Não perder o motivo ao ganhar a forma (Priority: P1)

**Goal**: o funil é reforço. Toda linha de texto que existia continua exatamente onde estava, e
ninguém precisa do SVG para saber *por que* um degrau está vazio.

**Independent Test**: comparar o card N3 antes/depois — mesmas linhas, mesma ordem, mesmo motivo,
mesma fração colada; a única adição é o funil acima delas.

- [X] T011 [US2] Em `test/ficha.test.mjs`: `funil` é `[]` para projeto sem perfil declarado, e nenhum dos níveis N0, N1, N2, N4, N5, N6 ganha o campo `funil` (FR-005, FR-006)
- [X] T012 [US2] Confirmar que os testes de N3 já existentes em `test/ficha.test.mjs` (incluindo `R2 — N3 cola a fração no percentual`) passam **sem edição**; se algum precisou ser reescrito, a FR-004 caiu e a mudança está errada
- [ ] T013 [US2] Verificar em `app/okr/[slug]/page.tsx` que o `<svg>` tem `aria-hidden="true"` e `focusable="false"` e **não** tem `<text>`, `<title>`, `<desc>`, `role` nem `tabindex`; conferir na árvore de acessibilidade que ele não aparece e que `Tab` não para em nenhum segmento (FR-008)
- [ ] T014 [US2] Confirmar orçamento zero em `app/okr/[slug]/page.tsx`: nenhum `'use client'`, `<script>`, hook, estado ou handler de ponteiro no caminho do funil; comparar o JS transferido de `/okr/atma` com a linha de base de T001 — tem de ser idêntico (FR-007, SC-004)

**Checkpoint**: a forma foi ganha sem que o motivo fosse perdido.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T015 `npm test` verde na suíte inteira, não só `test/ficha.test.mjs` (Portão 1 de merge, Princípio II)
- [ ] T016 Conferência pelo HTML servido pelo EasyPanel, nunca `next dev` — [quickstart.md](./quickstart.md) §3: `/okr/atma` com 5 segmentos (1 sólido, 4 hachurados), uma ficha de perfil A/B/C com 4, uma ficha sem perfil sem SVG nenhum, e `/okr` intocada
- [ ] T017 [P] Conferir 1440 / 1024 / 390 px no host do EasyPanel: o funil escala junto, sem rolagem horizontal e sem hachura esticada; raio 0, sombra 0, nenhuma camada com `opacity` ([quickstart.md](./quickstart.md) §5)
- [ ] T018 Commit e push, respeitando as janelas do Princípio IV (fora de 23:30-01:00 e 08:00-08:45 BRT)

---

## Dependencies

```text
T001 (linha de base)
  |
  +-> T002 -> T003 --+-> US1:  T005 -> T006 -> T007 -> T007a -> T008 -> T009
      T004 [P] ------+                                  T010 [P]
                     |
                     +-> US2:  T011 -> T012 -> T013 -> T014
                                                        |
                                                        +-> T015 -> T016 -> T017 [P] -> T018
```

- **T002 → T003**: `montarNiveis()` não tem o que anexar antes de a função existir.
- **T003 → tudo**: sem `n3.funil`, nem o teste nem o componente têm entrada.
- **T005 → T006 → T007 → T007a → T011 → T012**: mesmo arquivo (`test/ficha.test.mjs`), sequenciais por
  conflito de edição, não por lógica.
- **T008 → T009**: o componente antes da chamada.
- **US1 e US2 são independentes entre si** depois do Checkpoint da Fase 2 — US2 só precisa de
  `n3.funil` existir e das linhas de texto seguirem intactas; ela reprova mesmo que T008 ainda não
  tenha sido escrito, e é exatamente essa a graça dela.
- **T001 → T014**: comparação exige o número de antes.

## Parallel Execution

A oportunidade real é pequena, e dizer isso é mais honesto que inventar paralelismo: a feature toca
**quatro arquivos**, e três das cinco fases concentram edição em dois deles.

- **T004** (tipo em `page.tsx`) roda em paralelo com **T002/T003** (`lib/ficha.mjs`).
- **T010** (`app/globals.css`) roda em paralelo com **T008/T009** (`page.tsx`).
- **T017** (larguras) roda em paralelo com **T016** (conferência funcional) — mesmo host, olhares
  diferentes.
- **Não paralelize** T005-T007a e T011-T012: todos editam `test/ficha.test.mjs`.

## Implementation Strategy

**MVP = Fase 1 + Fase 2 + Fase 3 (US1)**. Nesse ponto o funil está no ar, com a contagem correta por
perfil e o apurado distinguível do vazio — que é o achado 2 do design-review fechado.

A **Fase 4 (US2) não é incremento, é trava**: ela não acrescenta nada à tela, ela prova que nada foi
perdido. Entregar US1 sem US2 é exatamente o risco que a spec nomeia — "melhorar a tela" e "esconder
o motivo atrás de uma barra bonita" ficam indistinguíveis no diff. Por isso as duas são P1 e as duas
entram no mesmo push.

Ordem sugerida: T001 → T002-T004 → T005-T007a (vermelho) → T008-T010 (verde) → T011-T014 → T015-T018.
