# Implementation Plan: Marcar a alavanca como feita e ver todos os degraus no mapa de GSC

**Branch**: `055-feito-aguardando-mapa` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

## Summary

O bloco "O que fazer primeiro" (054) passa a desenhar os cinco degraus sempre, o vazio com a contagem
das folhas dele por estado, e ganha uma marca por projeto e alavanca: quem fez, quando, e quando
reler. A marca só muda ordem e aparência do painel. `plano()` continua sendo a única função que monta
o painel e ganha dois argumentos (as marcas e o dia de hoje); a gravação é uma server action no molde
da agenda (`app/agenda/actions.ts`), sem JS no cliente.

## Technical Context

**Language/Version**: TypeScript na borda (página, action, `lib/db.ts`), `.mjs` para a lógica (Node 22)
**Primary Dependencies**: Next.js 16 App Router (server component + server action), `pg`
**Storage**: Postgres do hub, tabela nova `hub_mapa_marca` criada no `ensure()` de `lib/db.ts`
**Testing**: `node --test`, `test/proxima-acao.test.mjs` (já registrado no `package.json`)
**Target Platform**: container do EasyPanel; página atrás do basic auth do hub
**Project Type**: web (painel interno)
**Performance Goals**: uma consulta a mais por abertura do mapa, no banco da casa; zero requisição externa
**Constraints**: nenhuma leitura nova de fonte externa (054/SC-005); `force-dynamic` já vigente
**Scale/Scope**: 2 projetos com mapa × 13 alavancas = no máximo 26 linhas

## Constitution Check

| Princípio | Como esta feature cumpre |
|---|---|
| I. Contrato único de dados | A action valida o slug contra `SLUGS_DE_BUSCA`; nenhum import de `data/projects.json`. |
| II. `node --test`, registrado | Testes novos entram em `test/proxima-acao.test.mjs`, que já está na lista. Nenhum arquivo de teste novo. |
| III. `.mjs` para lógica pura | Estados do degrau, da entrada, ordem, destaque, validação da marca e texto do degrau vazio: tudo em `lib/proxima-acao.mjs`; datas reusam `todaySP()` e `addDaysISO()` de `lib/agenda.mjs`. `.ts` só grava, lê e desenha. |
| IV. Push é deploy | Push fora de 23:30–01:00 e 08:00–08:45 BRT. |
| V. Ambiente explícito | A action sai sem gravar quando `dbOn()` é falso, como a agenda. Nenhum segredo tocado. |

Sem violação. Complexity Tracking vazio.

## Project Structure

### Documentation (this feature)

```text
specs/055-feito-aguardando-mapa/
├── spec.md
├── plan.md            # este arquivo
├── research.md        # decisões D1–D6
├── data-model.md      # tabela, estados, transições
├── contracts/marca.md # a server action e o retorno de plano()
├── quickstart.md      # como provar em produção
├── checklists/requirements.md
└── tasks.md           # speckit-tasks
```

### Source Code (repository root)

```text
lib/proxima-acao.mjs              # plano(disparos, {marcas, hoje}), lerMarca(), textoDoDegrauVazio()
lib/db.ts                         # hub_mapa_marca: listMarcas(), setMarca(), delMarca()
app/gsc/mapa/[slug]/actions.ts    # NOVO: marcar(), desmarcar()
app/gsc/mapa/[slug]/page.tsx      # o bloco "O que fazer primeiro"
app/globals.css                   # [data-info="gsc"] .mapa-acao-aguardando, .mapa-degrau-vazio, .mapa-marca
test/proxima-acao.test.mjs        # os testes novos
```

**Structure Decision**: um arquivo novo só, o `actions.ts` da rota, porque server action com
`"use server"` no topo precisa de arquivo próprio e a agenda já faz assim. O resto é edição.

## Post-design Constitution Check

Refeito depois do data-model e do contrato: continua sem violação. A validação da entrada do form
(`lerMarca`) é pura e testada, e a action só a chama.
