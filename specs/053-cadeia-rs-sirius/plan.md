# Implementation Plan: A cadeia do Sirius até o dinheiro — banco no retroativo, Stripe nos novos

**Branch**: `053-cadeia-rs-sirius` (trabalho em `main`, como 034–052) | **Date**: 2026-09-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/053-cadeia-rs-sirius/spec.md`

## Summary

A ficha já sabe montar uma cadeia por perfil. O Sirius é perfil A, e os degraus do meio saem "sem coletor"
porque ninguém os ligou. O plano liga os degraus só para o Sirius, com duas fontes:

1. **Banco do Sirius, só leitura (FR-001, research D8).** Um usuário `roihub_leitura` com grant por coluna
   (conta e data, nada de dado pessoal). Uma query dá cadastro e ativação (research D4).
2. **Ajuste por projeto (research D2).** `CADEIAS_DO_PROJETO.sirius` em `lib/okr.mjs` liga `signup` e `ativado`
   e omite `trial` com o motivo. Os outros 8 projetos do perfil A não mudam (SC-005).
3. **Pagantes (research D5, D6).** `pagantesDeclarados` no card (as 6 que o dono declarou, com `pagaHoje`) unido,
   por conta, à 1ª cobrança aprovada no Stripe. "Paga hoje" fica ao lado da cadeia.
4. **Stripe (research D7).** `fetch` na API REST com chave restrita só de leitura. Sem a chave, o lado Stripe é
   `não apurado`, e as declaradas seguem contando.
5. **Janelas (research D3).** A taxa clique → cadastro é recusada quando o projeto declara `epoca`.
6. **Texto (research D11).** A `receitaNota` e o resumo do Sirius trocam "3 vendas" pelo número medido.

## Technical Context

**Language/Version**: TypeScript 5 (Next.js 16 App Router, React 19) + `.mjs` puro, Node 22

**Primary Dependencies**: as instaladas (`pg`). Nenhuma nova: o Stripe entra por `fetch`, sem SDK.

**Storage**: nenhuma tabela no hub. Leitura ao vivo do banco do Sirius (`SIRIUS_DATABASE_URL`) e do Stripe
(`SIRIUS_STRIPE_KEY`). Dado declarado no card: `epoca`, `pagantesDeclarados`, `receitaNota`.

**Testing**: `node --test`. Entra **um** arquivo, `test/saas.test.mjs` (registrado em `package.json` no mesmo
commit). Cresce `test/okr.test.mjs` (`montarFicha` com ajuste, omissão, taxa recusada; `cadeiaLigada` com slug;
os outros 8 perfis A idênticos).

**Target Platform**: container Linux no EasyPanel; dev no Windows.

**Project Type**: aplicação web única (App Router + `lib/`).

**Performance Goals**: a ficha do Sirius ganha uma query (~0,6 s medidos da máquina de dev) e 1 a 2 GETs no
Stripe, em paralelo com o GSC e o GA4 que já saem juntos.

**Constraints**: nenhum `0` sobre ausência; nenhuma taxa entre janelas diferentes; nenhum dado pessoal lido;
senha e chave nunca em log, commit ou resposta (Princípio V). Push fora de 23:30–01:00, 08:00–08:45 e
05:15–06:40 BRT (Princípio IV e as corridas da 052).

**Scale/Scope**: 1 projeto, 108 contas reais, 6 pagantes declaradas, 0 cobranças no Stripe hoje.

## Constitution Check

*GATE: revisto antes da Fase 0 e depois da Fase 1 — sem violação.*

| Princípio | Como o plano cumpre |
|---|---|
| I. Contrato único de dados | O card continua lido por `listProjects()`. Nenhuma página importa `data/projects.json`. |
| II. `node --test`, lista explícita | `test/saas.test.mjs` entra na lista no mesmo commit. `test/validade.test.mjs` confere. |
| III. `.mjs` puro, `.ts` na borda | A regra (células, classificação, união) em `lib/saas.mjs`. Rede em `lib/okr-coleta.ts` e `lib/stripe-leitura.ts`. |
| IV. Push é deploy | Nenhuma `maxDuration` muda, então o proxy não muda. Janelas de push respeitadas. |
| V. Ambiente explícito, segredo nunca em log | Falta de env vira `não apurado` com o NOME da variável. A senha do usuário só de leitura é gerada por script e vai direto para o `.env`; o dono copia para o EasyPanel. |

## Project Structure

### Documentation (this feature)

```text
specs/053-cadeia-rs-sirius/
├── spec.md
├── plan.md            # este arquivo
├── research.md        # D1–D12
├── data-model.md
├── quickstart.md
├── contracts/cadeia-saas.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
lib/saas.mjs                 # NOVO — regra pura: células, classificação do Stripe, união de pagantes
lib/stripe-leitura.ts        # NOVO — fetch na API do Stripe (sessões completas, assinaturas ativas)
lib/okr.mjs                  # CADEIAS_DO_PROJETO; montarFicha e cadeiaLigada com slug; taxa recusada por janela
lib/okr-coleta.ts            # leitura do banco do Sirius; células signups/ativados/vendas do Sirius
lib/ficha-dados.ts           # passa slug e epoca a montarFicha; paga hoje, divergências e descartes
app/okr/[slug]/page.tsx      # mostra o degrau omitido, paga hoje, divergências e descartes
app/gsc/mapa/[slug]/page.tsx # cadeiaLigada(perfil, slug)
data/projects.json           # sirius: epoca, pagantesDeclarados, receitaNota
data/resumos.json            # resumo do Sirius sem "3 vendas"
scripts/sirius-usuario-leitura.mjs  # NOVO — cria roihub_leitura e grava SIRIUS_DATABASE_URL no .env, sem imprimir a senha
test/saas.test.mjs           # NOVO
test/okr.test.mjs            # cresce
```

**Structure Decision**: a mesma separação da casa. A regra é pura e testada, a rede fica na borda, e o dado
declarado mora no card.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples rejeitada porque |
|---|---|---|
| Um campo declarado (`pagantesDeclarados`) ao lado de `vendas` | o retroativo não tem extrato: o dono é a fonte | pôr as 6 em `vendas` faria uma declaração parecer extrato de gateway, o que o próprio script da Atma proíbe |
| Um ajuste por projeto (`CADEIAS_DO_PROJETO`) | 9 projetos usam o perfil A, e só o Sirius tem fonte | ligar os coletores no perfil mudaria a ficha dos outros 8 (SC-005) |

## Dependências do dono

- **Chave restrita do Stripe** (`SIRIUS_STRIPE_KEY`). Pode chegar depois: sem ela, o lado Stripe é `não apurado`.
- **Copiar `SIRIUS_DATABASE_URL`** do `.env` local para o ambiente do serviço `roihub` no EasyPanel, depois que o
  script criar o usuário. Sem isso a produção mostra "SIRIUS_DATABASE_URL ausente".
