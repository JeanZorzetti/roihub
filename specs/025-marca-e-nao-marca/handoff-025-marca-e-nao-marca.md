# Handoff 025 — Marca e não-marca

**Fechada em** 08/09/2026 · **Spec**: [spec.md](./spec.md) · **Plano**: [plan.md](./plan.md)

---

## O número, que é o produto mais duradouro desta feature

A spec abriu com uma pergunta que nenhuma documentação do Search Console responde: **filtrar por
consulta faz o resultado perder as consultas raras, como perde quando se PEDE a dimensão `query`?**

Não perde. Primeira corrida da atma, 08/09/2026, corte `bra`, janela de 480 dias:

```json
{ "atma": { "impressoesPais": 177431, "impressoesMarca": 9964,
            "impressoesNaoMarca": 167467, "residuo": 0, "veredito": "fecha" } }
```

Lido na ordem que a `quickstart.md` §4 manda:

| olhado | resultado |
|---|---|
| `impressoesMarca > 0` — **primeiro** | **9.964**. A perna de marca mediu de verdade; o `includingRegex` NÃO exige casamento da consulta inteira, e o veredito abaixo pode ser lido |
| `veredito` | **`fecha`**, resíduo **0**. As duas medidas são **completas**, não pisos — a `fracao` da FR-007 não se aplica |
| `marca.atma.semLinhaDeTotal` | **242** (esperado ~239): a janela de marca pede 481 dias e a série do total só existe desde 11/01/2026. Sai contada, não engolida |
| Idempotência (FR-015) | Duas corridas às **13:54 UTC**, longe da meia-noite: `conferencia` e `marca` byte a byte iguais |

**A consequência é maior que a feature.** Filtrar por `query` sem pedir a dimensão `query` preserva
as raras. Registrado no `CLAUDE.md` ao lado do fato antigo (*"5 contra 33 no tapepro"*), porque é a
distinção entre os dois que a próxima spec precisa e que esta pagou para descobrir.

---

## O que mudou

**Recusar a subtração é a decisão que carrega tudo (D1).** O
`handoff-os-28-do-board-o-que-falta.md` receitava duas colunas e não-marca por subtração. O total
vem sem dimensão de consulta e **inclui** as anonimizadas; a fatia de marca vem com filtro e as
**exclui** — a subtração devolveria não-marca **mais** o resto anonimizado, inflando exatamente o
KPI que se quer ver crescer. Aquele handoff foi corrigido no mesmo commit: é a primeira leitura de
quem chega, e deixá-lo intacto guardaria no repo a receita que esta feature existe para recusar.

| Onde | O quê |
|---|---|
| `lib/marca.mjs` **(novo, puro)** | `regexDeMarca`, `marcaDeclarada`, `adensarDias`, `completude`, `mesesFechados`, `crescimentoNaoMarca`, `razaoDeMarca`. Zero imports, sem relógio interno |
| `lib/db.ts` | 7 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` em `hub_gsc_dia`, `gravarMarcaGsc()` (`UPDATE`, nunca `INSERT`), `lerDiasGsc()` devolve `DiaSeparado` |
| `lib/gsc.ts` | `gscSerieFiltrada()` — série diária com corte de país e filtro de consulta opcional |
| `lib/kpis-busca.mjs` | `canibalizacao(linhas, ehMarca)` → `{ lista, removidas }` |
| `app/api/gsc-serie/route.ts` | 3 pernas por projeto, `marca` / `conferencia` / `semMarca` na resposta. `maxDuration` **inalterado** em 300 |
| `app/okr/[slug]/aquisicao/page.tsx` | Bloco de marca (2 KPIs + termos + país + rótulo de completude) e canibalização filtrada. Primeiro consumidor de `lerDiasGsc()` desde a 021 |
| `data/projects.json` · `lib/projects.ts` | Campo `marca` no card da atma. **Só a atma** — os outros 34 intactos |
| `CLAUDE.md` · `handoff/handoff-os-28-do-board-o-que-falta.md` | O número acima e a correção da receita errada |

**Nenhuma tabela nova, rota nova, cron novo, segredo novo ou dependência nova.** `npm test`:
**811 → 854 verdes, 0 falhas** (`test/marca.test.mjs` novo com 37 casos — registrado em
`package.json` no mesmo commit —, `test/kpis-busca.test.mjs` de 32 para 38 com 4 asserções
ajustadas pela mudança de forma da D10). `npx tsc --noEmit` limpo, `npm run build` sem erro,
`npm run validade -- --repo` em 0.

---

## Dois achados fora do roteiro

**1. `4.195%` era ilegível e invertia o veredito.** O crescimento julho→agosto da atma é real e
enorme: 342 → 14.689 impressões não-marca, 42×. Em pt-BR o separador de milhar é o **ponto**, então
`pct()` rendia **"4.195%"** ao lado de uma meta de **"5% a 10%"** — que bate o olho como 4,195% e
diz "abaixo da faixa" quando o texto ao lado diz "acima". Acima de 10× a tela agora escreve
**"43×"**. Não estava na spec; é a mesma família de erro que ela existe para impedir.

**2. O `\b` não casa termo terminado em não-palavra.** `c++` ou `3M.` declarados como marca nunca
casariam, e a fatia deles cairia calada em não-marca. O conserto de regex seria lookbehind, que o
RE2 do Search Console não aceita — então fica como teto **nomeado no código**, com a defesa sendo a
lista na tela (FR-012). Nenhum projeto da casa tem nome assim hoje.

---

## O que ficou fora, e por quê

- **A verificação de tela do `removidas === null` (FR-013) não pôde ser feita.** A `quickstart.md`
  §5 mandava conferir no `/okr/sirius/aquisicao` que o parágrafo de ressalva continua lá — mas a
  premissa está errada: o sirius está **fora de `SLUGS_DE_BUSCA` desde a 021**, então o bloco de
  consultas inteiro (canibalização incluída) nunca renderiza para ele, e aquele parágrafo nunca
  esteve naquela tela. Exercitar esse caminho na tela exigiria um projeto **dentro** de
  `SLUGS_DE_BUSCA` e **sem** `marca`, que não existe. O caminho está coberto por teste unitário
  (`removidas: null` ≠ `removidas: 0`) e o ramo do JSX está escrito — mas **não foi visto**.
- **Posição por marca/não-marca**: Out of Scope da spec, sem mudança.
- **A consulta não é persistida**: é a dimensão que omite as raras, e guardá-la traria o piso para
  dentro do banco.
- **Os outros 34 projetos**: entram no dia em que forem para `SLUGS_DE_BUSCA` e ganharem `marca` no
  card. A estrutura já aceita.

---

## SC-001 — o placar do board

As duas medidas saem de ❌ para ✅ na aba de aquisição:

| # | Medida | Antes | Agora |
|---|---|---|---|
| 4 | Crescimento de Impressões Não-Marca | ❌ | ✅ `/okr/atma/aquisicao` |
| 4 | Brand Demand Ratio | ❌ | ✅ `/okr/atma/aquisicao` |

**22 → 24 de 28**, que é o teto realista declarado em 07/09. As 4 ausências restantes já estão
justificadas no `handoff-os-28-do-board-o-que-falta.md` (denominador de termos estratégicos
monitorados, fonte de backlinks paga, e as duas que dependem delas).

⚠️ **O escopo do board é SÓ A ATMA.** Este placar não é do portfólio.

**Esta é a última spec da série do board.**

---

## Armadilhas para a próxima corrida

- **A primeira corrida mede a primeira corrida.** Número estranho? Rode de novo no dia seguinte
  antes de mexer no código — a janela do GSC desliza na meia-noite UTC (33 e depois 42 na mesma
  tarde já aconteceu aqui).
- **`residuo: 0` sozinho não prova que fecha.** Sempre `impressoesMarca > 0` antes.
- **`npm test` verde não prova a corrida.** Os módulos puros não conhecem o Search Console: a suíte
  prova a regra, a corrida prova a fonte.
- **A lista pobre não tem conserto técnico.** É curadoria, e o erro dela é **favorável** — variante
  esquecida cai em não-marca e infla o número. Por isso a lista está na tela.
- **Editar `termos` reclassifica a história inteira** na corrida seguinte (D4). É deliberado e
  preferido ao congelamento: o par (número exibido, lista exibida) é sempre coerente.
