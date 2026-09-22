# Contrato — 053

## Ambiente do serviço `roihub` (EasyPanel e `.env` local)

| Variável | Conteúdo | Ausente |
|---|---|---|
| `SIRIUS_DATABASE_URL` | conexão do usuário `roihub_leitura` (research D8) | cadastro e ativação: `não apurado · SIRIUS_DATABASE_URL ausente` |
| `SIRIUS_STRIPE_KEY` | chave restrita `rk_live_…` só de leitura | lado Stripe: `não apurado · chave do Stripe ausente`; as declaradas continuam contando |

Princípio V: a tela e o log mostram o NOME da variável, nunca o valor.

## Card do Sirius (`data/projects.json`)

- `epoca`: `{ "data": "2026-03-17", "porque": "primeira conta real do produto" }`
- `pagantesDeclarados`: formato em data-model.md.
- `receitaNota`: reescrita com o número medido, a data e a fonte (FR-011).

## `lib/okr.mjs`

- `CADEIAS_DO_PROJETO[slug] = { coletores, omite }` (research D2).
- `montarFicha({ slug, perfil, coletado, declaracoes, epoca })`: aplica o ajuste do slug; omite o marco
  listado em `omite` e expõe `{ chave, motivo }` em `omitidos`; recusa a taxa `visitante → próximo` quando há
  `epoca` (research D3).
- `cadeiaLigada(perfil, slug)`: lê o perfil com o ajuste.

## `lib/saas.mjs` (puro)

- `celulasDaConta(contas, janela)` → `{ signups, ativados }`.
- `classificarSessoesStripe(sessoes, contasPorId)` → `{ cobrancas, descartes }`.
- `pagantes(declarados, cobrancas, assinaturasAtivas, contasPorId, janela)` → `{ vendas, pagaHoje, divergencias }`.

Nenhuma delas faz rede. Os testes injetam as linhas.

## Telas

- `/okr/sirius`: a cadeia visitante → signup → ativado → primeira cobrança aprovada, o trial como degrau
  omitido com o motivo, "paga hoje" ao lado, e as divergências e os descartes listados.
- `/gsc/mapa/sirius`: o painel "Depois do clique" com os mesmos números, pela mesma `dadosDaFicha()`.
- Os outros 8 projetos do perfil A: a ficha idêntica (SC-005).
