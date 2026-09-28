# Contract — screens

Final copy is written at implementation time with `ux-writing`. This fixes structure and states only.

## `/gsc/mapa/[slug]/plano` (new, server component, basic auth like the rest of the hub)

The route returns 404 when the slug is not in `SLUGS_DE_BUSCA`, like the map.

Blocks, top to bottom:

1. **Aviso de primeira linha**, shown only when it applies (FR-018): capacity 0, a deadline that does
   not fit the capacity, or no frozen demand ("rode `consultar-demanda.mjs <slug> --consultar
   --gravar`").
2. **Demanda**: consultation date, region, cost, total volume. Clusters, one row each:
   - seed;
   - number of terms;
   - volume;
   - covering page, or "sem página";
   - segments.

   Then the `semCluster` list and the exclusions with their reasons. Read-only, and the block names the
   `--mover` and `--excluir` command.
3. **Metas**: one row per leaf × horizon, grouped under the 18 KPIs (4 clique, 5 CTR, 4 posição,
   5 impressões). Each row shows:
   - proposed value;
   - origin seal;
   - the arithmetic (`conta`);
   - state;
   - a form to approve, edit (number input) or refuse, with `responsavel`.

   The two headline projections (impressões, cliques) come first. Relative leaves on a zero base show
   the "base zero" note.
4. **Premissas**: capacity and the two maturation premises, with the seal "◇ política do dono, sem
   fonte" and an edit form.
5. **Calendário**: one row per week. Each row shows:
   - week number and date;
   - tasks (alavanca, targets, KPIs moved, responsible, 055 marca);
   - milestones for the demand leaves.

   The current week is highlighted by text as well as style.
6. **Versões**: previous versions with their state, readable, not editable.

Server actions (`app/gsc/mapa/[slug]/plano/actions.ts`): `criarVersao`, `decidirMeta`,
`salvarPremissas`, `ativar`. Each one validates with the pure `lerDecisao` or `lerPlano`, returns
without writing on bad input, and calls `revalidatePath` on both routes.

## `/gsc/mapa/[slug]` (existing): one new block

**Plano · semana N de M**, placed after "O que fazer primeiro". It appears only when an `ativo` plan
exists, and it links to `/plano`. It shows:
- this week's tasks, with their 055 marca;
- for `top20`, `strikingDistance`, `tamBusca` and the headline clicks, the milestone against the
  reading and one of the 5 states, in glyph and text, never color alone (FR-015, FR-020);
- for REGRAS-based leaves, a single line pointing to "O que fazer primeiro", where the same rule
  already fires.

The block makes no new external request (SC-005).
