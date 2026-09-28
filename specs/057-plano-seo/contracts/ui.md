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

   Added by the clarification of 2026-09-28 (research D13, D14):
   - The covering page carries its state, in text and never by color alone:
     - `ativa`;
     - `indexada, sem impressão`;
     - `fora do índice`;
     - `sem leitura`, with the reason (no indexing run for the URL, a failed or truncated Search
       Console reading).
   - For each page, the terms it covers by title or H1 and their volume.
   - The cluster terms that no page covers, with the ones at or above `pisoApoio` marked as
     support-page candidates.
   - "H1 não lido nesta corrida" when the latest crawl has no `h1`.
3. **Metas**: one row per leaf × horizon, grouped under the 18 KPIs (4 clique, 5 CTR, 4 posição,
   5 impressões). Each row shows:
   - proposed value;
   - origin seal;
   - the arithmetic (`conta`);
   - state;
   - for demand metas, the starting point read by `gscTermos` and the distance to the meta (US4 AC1),
     plus the "já atingida" aviso when an edited meta is below it;
   - a form to approve, edit (number input) or refuse, with `responsavel`.

   The three headline projections (impressões, cliques, `pagina1`) come first. Relative leaves on a zero
   base show the "base zero" note. A deadline that no new page reaches under the premises shows "nenhuma
   página nova amadurece antes deste prazo com estas premissas". REGRAS leaves link to the map for their
   starting point.
4. **Premissas**: capacity, the two maturation premises and `pisoApoio` (D14), each with the seal
   "◇ política do dono, sem fonte" and an edit form.
5. **Calendário**: one row per week. Each row shows:
   - week number and date;
   - tasks (alavanca, targets, KPIs moved, responsible, 055 marca);
   - milestones for the demand leaves.

   The current week is highlighted by text as well as style.

   Week 1 carries the `indexacao` and posição tasks for existing pages that are not `ativa` (D15).
   The current week's row ends with a line pointing to the map's "Plano · semana N" block, where the
   map's cards join the week (D16). No week reads "nada a fazer".
6. **Versões**: previous versions with their state, readable, not editable.

Server actions (`app/gsc/mapa/[slug]/plano/actions.ts`): `criarVersao`, `decidirMeta`,
`salvarPremissas`, `ativar`. Each one validates with the pure `lerDecisao` or `lerPlano`, returns
without writing on bad input, and calls `revalidatePath` on both routes.

## `/gsc/mapa/[slug]` (existing): one new block

**Plano · semana N de M**, placed after "O que fazer primeiro". It appears only when an `ativo` plan
exists, and it links to `/plano`. It shows:
- this week's tasks, with their 055 marca, **merged with the map's cards** through `semanaComCards`
  (FR-011a, D16):
  - a lever that is in both becomes one task, carrying the targets and KPIs of both;
  - a card-only lever says where it came from ("disparada pelo mapa");
  - a card with a vigente marca stays out until `reler`, and comes back as "ainda dispara";
- for `top20`, `tamBusca` and the headlines (cliques, `pagina1`), the milestone against the
  reading and one of the 5 states, in glyph and text, never color alone (FR-015, FR-020);
- for REGRAS-based leaves, a single line pointing to "O que fazer primeiro", where the same rule
  already fires;
- when a demand leaf was `abaixo` last week too, the suggestion to redo that meta's proposal (US3 AC3).

The block makes no DataForSEO request (SC-005). It adds one `gscTermos` read over the window shifted 7
days back, for last week's comparison, and writes nothing (research D11).
