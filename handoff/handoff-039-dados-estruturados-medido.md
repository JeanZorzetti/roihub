# Handoff — 039 · Cobertura de Dados Estruturados medida no board

**Data:** 20/09/2026 · **Commits:** `40c5e34` (medida) + `48ad092` (crédito do coletor) · **Estado:**
no ar e **conferido em produção duas vezes** (22:35 e 22:47 BRT, mesma leitura, console limpo).

## O que mudou

A folha `3. Taxa de Cobertura de Dados Estruturados (Rich Snippets Elegíveis)` de `/gsc/mapa` ganhou o
nó `Medido:` como primeiro filho. Sexta folha `-medido` do mapa.

| Onde | Mudança |
|---|---|
| `lib/indexacao.mjs` | `inspecionarUrl()` devolve `rich` (o `richResultsResult` da MESMA resposta), aninhado — ele tem `verdict` próprio e espalhar sobrescreveria o da indexação. `inspecionarIndexacao()` propaga cru. |
| `lib/indexacao-corrida.mjs` | `classificarRich()` (5 estados), `coberturaRich()`, `tiposRich()`, `tiposDoBoard()`. `agregar()` devolve mais 6 campos. |
| `lib/db.ts` | 5 colunas nuláveis em `hub_indexacao` (`rich_com`, `rich_erro`, `rich_nenhum`, `rich_sem_relatorio`, `rich_tipos`), gravação e leitura. |
| `app/api/indexacao/route.ts` | Os novos contadores saem na resposta da corrida. |
| `app/gsc/mapa/page.tsx` | `topicDoSchema()` + `noteDoSchema()` e os **cinco** estados de ausência. |
| `lib/gsc-delta.mjs` | `MEDIDO_POR.schema` credita os DOIS coletores. |
| `test/indexacao-corrida.test.mjs` | +6 testes (1.186 no total, verde). |

**Zero requisição nova.** `richResultsResult` chega na mesma resposta da URL Inspection que a corrida
diária já paga por URL, e vinha sendo descartada desde a 022.

## O número (Atma, 25 URLs do sitemap, corrida de 20/09 às 22:30 BRT)

```
Medido: 94,4% · 17 de 18 URLs no índice · 0 erro crítico
· nenhum tipo do board · só Breadcrumbs e Review snippets
```

- **17 com resultado enriquecido · 1 sem (a home, zero MEDIDO) · 7 fora do índice** (sem relatório, fora
  do denominador) · 0 erro crítico.
- **Pela sintaxe a mesma folha dá 100%** (35 de 35, crawl de 14/09) — e esse 100% conta o **mesmo bloco
  JSON-LD global servido em 35 rotas** (ressalva da 024). É o número que a folha teria publicado sem
  esta entrega.
- **Contra os tipos que a meta nomeia, a leitura é 0.** 13 `Article` e 10 `FAQPage` declarados, nenhum
  reconhecido. O único `Product` é `/pacientes/precos` — e está `Discovered - currently not indexed`.

## Pendências que a medição encontrou e NÃO consertou

1. **`/pacientes/precos` fora do índice.** A página de preço declara `Product`+`FAQPage` e o Google
   nunca leu. É a única URL do site com `Product`.
2. **O sitemap encolheu de 35 (14/09) para 25 URLs.** Três páginas **indexadas** ficaram de fora
   (`/ortodontistas/vantagens`, `/ortodontistas/tecnologia`, `/ortodontistas/modelos-parceria`).
3. **Os "Review snippets" (9 URLs) são retrato de versão anterior.** Toda URL rastreada até 14/09 os
   tem; nenhuma rastreada de 16/09 em diante. Não há `aggregateRating` no HTML nem nos bundles de hoje
   — a contagem deve cair sozinha conforme o Google rerrastreia. **Se ela cair, não é regressão.**
4. **O crawl de página está velho (14/09) e cego para links** (`orfas: 35` de 35 visitadas). A folha de
   sintaxe lê dali.

## Gotchas

- A corrida grava `dia` em **UTC**. Disparada às 22:20 BRT, gravou `2026-09-21` — a nota da folha diz
  "apuração de 2026-09-21" enquanto no Brasil ainda era 20/09. Pré-existente, vale para a tabela
  inteira; a corrida normal (05:47 BRT) não cruza a virada.
- As colunas `rich_*` são **NULAS para todo dia anterior a 20/09/2026** e não são recuperáveis: o
  relatório é o estado do índice no dia em que se pergunta. A folha tem estado próprio para isso.
- Disparo manual: `curl -X POST $HUB_URL/api/indexacao -H "authorization: Bearer $CRON_SECRET"`.
