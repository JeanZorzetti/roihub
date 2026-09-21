# Handoff — 043 · Index Health medido no board (indexação, rejeição, profundidade)

**Data:** 21/09/2026 · **Estado:** conferido no dev server; produção conferida depois do push.

## O que mudou

As três folhas do ramo POSIÇÃO MÉDIA › `2. KPIs de Rastreabilidade e Saúde do Índice (Index
Health)` abrem com leitura própria. Agora são 18 folhas `-medido` no mapa. **Zero requisição nova:**
a indexação sai da corrida diária de `/api/indexacao` (022) e a profundidade da corrida de página
(024).

| Onde | Mudança |
|---|---|
| `lib/indexacao-corrida.mjs` | `taxasDeIndexacao()` nova e pura. A divisão vivia em `agregar()` e em `/okr/[slug]/aquisicao`; o mapa seria a 3ª cópia. |
| `app/gsc/mapa/page.tsx` | `lerIndexacao` subiu para fora do bloco do schema; bloco 043 com os três nós. |
| `app/okr/[slug]/aquisicao/page.tsx` | Usa `taxasDeIndexacao`. Saída idêntica. |
| `lib/gsc-delta.mjs` | `rejeicaoRastreio`: `semColetor` → `recusa`, e entra em `MEDIDO_POR`. `indexacaoLimpa` credita a função que abre o nó. |
| `test/` | +1 teste (1.196 no total); trava de "sem coletor" atualizada (3 → 2 folhas). |

## O número (Atma, 21/09/2026)

| Folha | Leitura | Meta do board |
|---|---|---|
| Indexação limpa | **72%** · 18 de 25 URLs do sitemap no índice | ≥ 95% |
| Rejeição de rastreio | **28%** · 7 de 25 em "Descoberta, mas não indexada", 0 "Rastreada" | < 5% |
| Profundidade de clique | **96,7%** · 29 de 30 páginas a ≤ 3 cliques · 0 órfãs | 100% (transacionais e pilares) |

As 7 fora do índice (inspeção manual de 21/09, a apuração só grava contagem): `/pacientes/precos`,
`/contato`, `/ortodontistas`, `/blog`, `/blog/1`, `/blog/2`, `/blog/sorriso-perfeito-15-dicas`. A
única página a 4 cliques é `/blog/3` (paginação). A página de preço está a 1 clique e **mesmo assim
não foi rastreada**: profundidade não explica o buraco.

## Achados

1. **A URL Inspection alterna** entre `Discovered - currently not indexed` e `URL is unknown to
   Google` na mesma URL em chamadas seguidas. `classificar()` põe "unknown" em `outras`, então a
   rejeição oscila entre 16% e 28% sem o site mudar. O total fora do índice (7) é estável. A nota do nó diz isso.
2. **`rejeicaoRastreio` era "sem coletor"** com a razão calculada desde a 022. É o erro de 19/09
   (profundidade e links internos) repetido na folha vizinha.
3. **A corrida de página de 14/09 não serve de série:** 35 órfãs de 35 por causa do host declarado
   velho (consertado em `hostDaTravessia`, 18/09). A de 21/09 foi **disparada à mão** (workflow
   `paginas.yml`, 12:28 UTC) porque o cron de segunda (09:17 UTC) ainda não tinha rodado. O de hoje
   vai regravar o mesmo dia, o que não tem problema porque a gravação é idempotente por `(projeto, dia)`.

## Pendências (humanas, no site, não no hub)

- Solicitar indexação no GSC de `/pacientes/precos`, `/contato`, `/ortodontistas`, `/blog`, porque a API não
  tem "solicitar indexação".
- As 5 páginas linkadas fora do sitemap (`/quiz` e 4 posts) não são submetidas nem inspecionadas.
- `/blog/1`, `/blog/2` e `/blog/3` estão no sitemap e são paginação do catch-all.
