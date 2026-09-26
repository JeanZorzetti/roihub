# Implementation Plan: Vitais de campo próprios (RUM) para quem a CrUX não mede

**Branch**: `056-vitais-rum-proprio` | **Date**: 2026-09-26 | **Spec**: [spec.md](./spec.md)

## Summary

As páginas públicas do Sirius passam a mandar LCP, INP, CLS e TTFB de cada visita para
`POST /api/vitais` do hub, com `sendBeacon` e o `useReportWebVitals` que o Next já traz. O hub
resolve o projeto pelo `Origin`, filtra, e grava em `hub_vitais`. No mapa, quando a CrUX não tem
amostra de um vital e o projeto tem coletor, a folha lê o RUM: p75 de 28 dias, n, e veredito pelo
intervalo de Wilson da 033 contra 25% de visitas acima do limite. A folha "URLs boas" troca, URL a
URL, o `sem-amostra` da CrUX pelo veredito do RUM.

## Technical Context

**Language/Version**: TypeScript na borda (rota, página, `lib/db.ts`, `lib/projects.ts`), `.mjs` para a lógica (Node 22). No Sirius, um componente cliente TSX.
**Primary Dependencies**: Next.js 16 (`next/web-vitals` no Sirius), `pg` no hub. Nenhuma dependência nova.
**Storage**: Postgres do hub, tabela nova `hub_vitais` no `ensure()` de `lib/db.ts`
**Testing**: `node --test`, arquivo novo `test/rum.test.mjs` registrado no `package.json`
**Target Platform**: hub no EasyPanel (rota aberta + página atrás do basic auth); Sirius no EasyPanel
**Project Type**: web, dois repositórios (roihub e sirius)
**Performance Goals**: coletor ≤ 3 KB comprimido e fora do caminho de renderização; mapa com uma consulta a mais no banco da casa e zero requisição externa a mais
**Constraints**: laboratório proibido (023/SC-003); CrUX com amostra nunca é substituída (FR-007); nada que identifique o visitante (FR-004)
**Scale/Scope**: 56 cliques de busca em 28 dias no Sirius, então centenas a poucos milhares de linhas por janela

## Constitution Check

| Princípio | Como esta feature cumpre |
|---|---|
| I. Contrato único de dados | O projeto do `Origin` sai de um helper novo em `lib/projects.ts`, que lê a curadoria como `dominioAnteriorDoSlug()`. A rota não importa `data/projects.json`. |
| II. `node --test`, registrado | `test/rum.test.mjs` novo, adicionado à lista do `package.json` no mesmo commit. |
| III. `.mjs` para lógica pura | Validação da medida, filtro de agente, p75, veredito e Pass Rate misto em `lib/rum.mjs`, que reusa `lib/intervalo.mjs` e `VITAIS` de `lib/crux.mjs`. `.ts` só recebe, grava, lê e desenha. |
| IV. Push é deploy | Push fora de 23:30–01:00 e 08:00–08:45 BRT. Hub primeiro, Sirius depois: beacon sem rota no ar tomaria 401 do basic auth. |
| V. Ambiente explícito | Sem `DATABASE_URL`, a rota devolve 503 com o nome da variável. Nenhum segredo novo. O IP fica só na memória do limite e nunca vai para log nem banco. |

Sem violação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/056-vitais-rum-proprio/
├── spec.md
├── plan.md                  # este arquivo
├── research.md              # D1–D10
├── data-model.md
├── contracts/recebimento.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
# roihub
lib/rum.mjs                        # NOVO: lerMedida, agenteRecusado, leituraRum, passRateMisto
lib/db.ts                          # hub_vitais: gravarVital(), lerRum()
lib/projects.ts                    # slugDeCampoDoHost()
app/api/vitais/route.ts            # NOVO: POST aberto
middleware.ts                      # isenção de /api/vitais
app/gsc/mapa/[slug]/page.tsx       # fallback nos 4 vitais e nas URLs boas
test/rum.test.mjs                  # NOVO
package.json                       # registra o teste

# sirius (C:\dev\sirius)
components/marketing/vitais-de-campo.tsx   # NOVO: cliente, useReportWebVitals + sendBeacon
app/[locale]/(marketing)/layout.tsx        # monta o coletor
```

**Structure Decision**: três arquivos novos no hub (o módulo puro, a rota e o teste) e um no Sirius.
A rota precisa de arquivo próprio, e o módulo puro existe para o `node --test`.

## Post-design Constitution Check

Refeito depois do data-model e do contrato: continua sem violação. A rota aberta é a primeira do hub
sem segredo. Ela só escreve numa tabela que nada além do mapa lê, e o filtro da D6 com o n visível
(FR-009) é a defesa proporcional ao que está em jogo.
