# Contract: screens and forms

Final copy is written at implementation time with `ux-writing`. The backlog table goes through
`information-design`, every new form through `accessibility`, and the result through `ui-verification`
at three widths. This contract fixes the structure, the states and the validation. The words come
later.

## `/gsc/mapa/[slug]/plano` (future only)

The rule for every block: no reading of the present, no mark, no author, no date of a decision, no
past week (FR-001). The only dates shown are:
- future weeks;
- the demand's consultation date;
- "cards do mapa lidos em DD/MM HH:mm" (the provenance of inputs, FR-008, research D3).

Blocks, top to bottom:

1. **Header**:
   - "versão N ativa" and/or "versão M em rascunho";
   - otherwise "prévia com as premissas padrão".
2. **Avisos**, only when they change the plan, and always phrased as consequence:
   - no hours declared;
   - no frozen demand;
   - no map snapshot;
   - "nenhuma página existente conta nas metas até a próxima leitura de impressões";
   - `naoCabe`;
   - tasks past 26 weeks.
3. **Esta semana**: the tasks scheduled in the current week, in backlog order, with responsible and
   hours. Shows "Nada mais planejado para esta semana" plus the next week that has a task. Or, before
   the start, "O plano começa em DD/MM".
4. **Backlog**: one row per task, in D7 order. The columns:
   - task (lever action + target label);
   - impact (clicks per month, or "não calculável: motivo");
   - effort (h);
   - responsible;
   - due (week start DD/MM, or the fixed date);
   - state (agendada / a fazer / bloqueada) with the reason.

   The state is in words; a glyph can be added, color alone never. The row's `conta`, origins and
   briefing sit in a disclosure (`<details>`). The edit form sits in the same disclosure (see Forms).
   At phone width the table becomes one card per task, with no horizontal scroll.
5. **Núcleo**: one block per cluster, by volume. Each block shows:
   - intent (the decided one, or the proposal with its volume basis, or "sem proposta");
   - answering page;
   - questions (accepted and proposed, each with its answering page), or "nenhuma declarada";
   - entities, or "nenhuma declarada";
   - next task and its week, or "nada planejado".

   Forms per cluster (see Forms).
6. **Metas**: as 057, grouped under the 18 KPIs, minus "Hoje / distância" (moved to the map) and minus
   the author and date. The 180-day clicks row carries the **OKR line** (research D14):
   - "o OKR exige X–Y cliques por 28 dias; o plano projeta Z por mês aos 180 dias: cobre A–B%" with a
     link to `/okr/{slug}`;
   - or "o OKR de {projeto} não exige cliques ainda: {motivo}";
   - or "o OKR não respondeu: {motivo}".
7. **Calendário**: the weeks from the current one to week 26. Quiet weeks collapse as in 057. Each week
   shows its tasks and the hours used per person out of their capacity ("Jean 5,5 de 6 h").
8. **Demanda**: 057's block minus page state (moved to the map). The terms covered per page and the
   uncovered terms stay: they are the input of the future pages.
9. **Premissas**:
   - start date;
   - hours per week per person;
   - default effort per lever plus `pergunta`;
   - weeks to index;
   - weeks to stabilize;
   - support-page floor.

   All carry "◇ política do dono, sem fonte". The same form creates a version, or saves the draft.

The "Versões" block is removed.

## Plan block on `/gsc/mapa/[slug]` (research D15)

It renders whenever the project has frozen demand, and holds what left the plan:
- **Ponto de partida**: per demand meta of the current version (or the preview), the meta and
  deadline, "hoje X (janela, Search Console)" and the distance. It is 057's line, moved here.
- **Páginas dos clusters**: each covering page with its state in words (`ESTADO_PAGINA`) and reason.
- **Esta semana**: the scheduled tasks, with their lever's 055 mark state ("feito em DD/MM por X",
  "ainda dispara", "sem marca de feito"). Marking stays in "O que fazer primeiro", as today.
- **Marcos**: the 057 comparison, unchanged, only with an active version.

It links to the plan.

## Forms (server actions in `app/gsc/mapa/[slug]/plano/actions.ts`)

Each action validates the form with a pure `ler*` in `.mjs`. Input outside the contract writes nothing
(the 055 and 057 pattern). Each action revalidates both routes.

| Action | Validator | Writes | Contract |
|---|---|---|---|
| `criarVersao`, `salvarPremissas` | `lerPlano` (changed) | `hub_plano` | adds `horas.{id}` and `esforco.{chave}`; removes `capacidade` |
| `decidirIntencao` | `lerNucleo` | `hub_nucleo` | `projeto`, `semente` (must be a cluster seed of the frozen demand), `intencao` ∈ informacional\|comercial\|ambos, `responsavel` |
| `apontarPagina` | `lerNucleo` | `hub_nucleo` | `pagina`: an absolute URL on one of the project's hosts, or empty (back to the default) |
| `decidirItem` | `lerItem` | `hub_nucleo_item` | `tipo` ∈ pergunta\|entidade; `texto` 1–200 chars; `estado` ∈ aceita\|removida\|respondida (respondida only for pergunta); `detalhe`: entity kind from the fixed list, or the answering page URL on the project's hosts |
| `editarTarefa` | `lerTarefa` | `hub_plano_tarefa` | `chave` ≤ 600 chars with a known lever prefix; `responsavel` ∈ RESPONSAVEL_IDS or empty; `esforco` 0.25–80 or empty; `prazo`: a date, snapped to its Monday, or empty |

`decidirMeta`, `aprovarPropostas` and `ativar` are unchanged.

## Map snapshot write (in `app/gsc/mapa/[slug]/page.tsx`)

After `const disparos = avaliar(leituras)`, the map upserts `{projeto, lido_em: now, disparos: fired
only}` without `await` blocking the render. The write's failure is swallowed.
