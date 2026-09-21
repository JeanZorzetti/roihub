# Handoff — 046 · Footprint de Consultas Únicas medido no board

**Data:** 21/09/2026 · **Estado:** conferido no dev server (canvas a 1440px, nó + contador, console limpo);
produção a conferir depois do push (~1 a 15 min, ler a TELA duas vezes).

## O que mudou

A folha IMPRESSÕES › `1. KPI de Amplitude: Footprint de Consultas Únicas (Total Queries)` abre com o nó
`consultasUnicas-medido`. É a primeira folha do ramo IMPRESSÕES com leitura própria, e o mapa passa de 22 para
23 folhas `-medido`.

| Onde | Mudança |
|---|---|
| `app/gsc/mapa/page.tsx` | Leitura `gscConsultas` da janela 13 semanas antes (disparada em paralelo à atual) + bloco 046 no fim das folhas. |
| `lib/` | Nada. `consultasUnicas` e `MEDIDO_POR.consultasUnicas` já existiam e já eram o que a aba de aquisição usa. |

## O número (Atma, janela 22/08 → 18/09)

**887 consultas com ≥ 1 impressão (piso) · 922 na mesma janela 13 semanas antes (−3,8%).** Meta do board: +10%
a +20% por trimestre, sem régua (`balizador: recusa`), então sem glifo de veredito.

Série de janelas de 28 dias (medida à parte, fora do nó):

| fecha em | consultas |
|---|---:|
| 06/02 | 809 |
| 06/03 | 1.118 |
| 03/04 | 1.741 |
| **01/05** | **1.882** (pico) |
| 29/05 | 1.348 |
| 26/06 | 732 |
| 24/07 | 6 (desindexação) |
| 21/08 | 915 |
| 18/09 | 887 |

## Achados

1. **O footprint voltou ao patamar de fevereiro e parou:** 47% do pico. A volta da desindexação terminou em
   agosto (915), e setembro não cresce (887).
2. **O footprint ainda mora no domínio antigo:** 872 das 887 consultas aparecem por `atma.roilabs.com.br`,
   e só 41 por `usealigner.com`. A troca de domínio de 11/09 ainda não transferiu a amplitude.
3. **Piso, não total:** as consultas nomeadas somam 9.788 das 23.372 impressões do site (41,9%). O resto é
   consulta omitida por privacidade. 352 das 887 tiveram uma única impressão.

## Decisões

- **Topo pelos absolutos, razão na nota.** A base de 13 semanas atravessa a desindexação de junho. Em ~3
  semanas ela cai na janela de 6 consultas, e a razão publicaria +14.000%. A regra de base interrompida da
  036 (1/3 dos dias em zero) **não** pega esse caso, porque a janela morta teve só 2 dias em zero. A nota traz as
  impressões do site nas duas janelas (`hub_gsc_dia`), que é o que denuncia a base derrubada.
- **Consulta×página, não `termosGsc`.** Mesma leitura da aba de aquisição, então as duas publicam 887 por
  construção. `consultasUnicas` sobre `termosGsc.linhas` devolve **1**, porque as linhas trazem `termo`, não
  `query`.

## Pendente

- ⏳ **Do começo de outubro a 23/11** a janela-base (fecha em hoje − 94 dias) atravessa a desindexação. Em
  **26/10** ela é exatamente 27/06 → 24/07 e o nó mostra "6 na mesma janela 13 semanas antes". **Não é
  defeito**, é o motivo de o topo abrir pelos absolutos. A razão na nota vai ficar absurda nesse período, e a
  frase sobre as impressões do site explica o motivo. A partir de 23/11 a base é 25/07 → 21/08 (915) e a
  razão volta a significar amplitude.
- Irmãs do ramo IMPRESSÕES sem leitura: Top 20, Query-to-Page, Active Index Ratio, TAM (sem coletor).
