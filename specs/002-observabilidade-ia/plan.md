# Implementation Plan: Observabilidade dos recursos de IA e saúde dos empregados nas automações

**Branch**: `002-observabilidade-ia` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-observabilidade-ia/spec.md`

## Summary

A telemetria que a feature precisa **já chega e é jogada fora**: `--output-format json` do claude-cli
devolve `usage`, `duration_ms`, `num_turns` e `session_id` em toda chamada, e os dois `spawn` do repo
resolvem só `payload.result`. A entrega, então, não é construir coleta — é **parar de descartar** e
dar um lugar para o dado morar.

Abordagem técnica: **um registro por tentativa, emitido nos DOIS caminhos compartilhados de
invocação** (`rodarClaude` em `lib/reranker.mjs`, que serve rerank/resposta/juiz/defasagem/sonda, e
`claudeRun` em `lib/autopublish-clients.ts`, que serve os dois empregados do autopublishing), gravado
best-effort no Postgres que já existe. Nenhuma dependência nova, nenhum cron novo, nenhum segredo
novo: a consolidação diária, a expiração de 90 dias e o quinto coletor de card penduram no
`POST /api/estado` das 23:37 BRT, que já roda, já autentica com `CRON_SECRET` e já sonda o pool.

O par `lib/telemetria.mjs` (puro, testável por `node --test`) + `lib/telemetria-db.mjs` (`pg`, dono
único das tabelas) copia o par `corpus.mjs`/`corpus-db.mjs` que já existe — `.mjs` porque os scripts
de medição em node puro e a aba do Next precisam rodar o **mesmo** caminho, que é a mesma razão pela
qual `reranker.mjs` não é `.ts`.

## Technical Context

**Language/Version**: TypeScript 5.9 (Next 16.2, App Router) + ESM `.mjs` puro; Node 22. A divisão
`.mjs`/`.ts` é deliberada e esta feature respeita: lógica testável em `.mjs`, só o que toca React em `.ts`.

**Primary Dependencies**: nenhuma nova. `pg` 8.22 (já é dependência direta, já importado de `.mjs` em
`lib/corpus-db.mjs`), `node:crypto` para o hash da conta. **Sem SDK/collector de OpenTelemetry** —
adota-se o vocabulário na nomeação das colunas, não a dependência (`pesquisa.md` §3.2).

**Storage**: o mesmo Postgres do resto do estado (`DATABASE_URL`). Três tabelas novas, `ia_chamadas`
(detalhe, 90 dias), `ia_resumo` (agregado permanente), `ia_pool` (transições de estado das contas,
permanente). Dono único: `lib/telemetria-db.mjs`, com `CREATE TABLE IF NOT EXISTS` idempotente no
molde do `ensure()` de `lib/db.ts` — os scripts locais gravam no mesmo banco e podem chegar antes de
a aba ter subido.

**Testing**: `node --test`, sem framework. Arquivo novo (`test/telemetria.test.mjs`) **tem que entrar
na lista explícita do `package.json`**, senão nunca roda — e `test/validade.test.mjs` compara a lista
nos dois sentidos, então o esquecimento reprova.

**Target Platform**: produção é Docker/EasyPanel com `output: "standalone"` (Linux/Alpine); dev é
Windows/OneDrive rodando os mesmos `.mjs` via `node --env-file=.env`. O tracing do standalone copia o
que é importado, então os dois módulos novos entram sozinhos — nada a acrescentar em
`outputFileTracingIncludes`.

**Project Type**: aplicação web já existente (Next.js App Router) + scripts de medição em node puro,
no mesmo repositório.

**Performance Goals**: a gravação não pode ser sentida no caminho de trabalho — um `INSERT` por
tentativa, sem `await` bloqueante no retorno da busca. Volume esperado: ~2 linhas por busca, ~20-40
por ciclo de autopublishing, 3 por noite da sonda, e picos de ~85-255 numa corrida de régua. Isso é
milhares de linhas por trimestre, não milhões: nenhum índice além do óbvio (`inicio`, `empregado`).

**Constraints**:
- **FR-007 (best-effort com lacuna visível)**: falha de escrita nunca derruba busca ou publicação, mas
  a janela resultante tem que aparecer como *lacuna*, jamais como *zero falhas*. É a assimetria que a
  spec 001 não tinha — aqui o dado ausente produz a leitura mais otimista possível.
- **FR-004 (nada de texto)**: nem prompt, nem resultado, nem stderr. Só hash e tamanho. O corpo do
  erro do claude-cli pode conter o prompt inteiro, e o prompt do reranker carrega 50 trechos do corpus.
- **SC-008 (o observador é barato)**: no máximo 1 chamada por conta por dia — a sonda que já existe.
  Todo o resto sai de payload que já vem nas chamadas de trabalho.
- **O caminho de escrita precisa funcionar de `.mjs`** (scripts locais e `reranker.mjs`), logo não
  pode morar em `lib/db.ts`.
- **Janela de push proibida**: 23:30–01:00 BRT (dois crons). Deploy desta feature fora dela.

**Scale/Scope**: 6 empregados, 3 contas de pool, 2 caminhos de `spawn` instrumentados, 3 tabelas
novas, 1 aba nova (`/ia`), 1 coletor novo no estado noturno, 1 script de orçamento. Zero mudança de
contrato para quem já chama `rodarClaude`/`claudeRun`.

## Constitution Check

`.specify/memory/constitution.md` continua sendo o template não preenchido (`/speckit-constitution`
nunca rodou neste projeto) — não há princípios ratificados a checar. Gate **N/A por ausência de
constituição**; nenhuma violação a justificar.

As normas de fato deste repo (`CLAUDE.md`) foram tratadas como gates e todas passam:

| Norma da casa | Como o plano atende |
|---|---|
| Falha FECHADA por coletor | O coletor `IA` estoura e sai do diff em vez de devolver zero chave; lacuna de telemetria é célula própria. |
| A entrega é o DIFF, nunca placar | Só transição categórica vira card; latência e volume ficam na aba. |
| 1ª corrida não gera card | Reusa `primeiraCorrida`/`estadoAnterior`, que já fazem isso. |
| `node --test` sem framework | 1 arquivo novo, lógica pura, registrado no `package.json`. |
| Sem dependência nova | `pg` + `node:crypto`. |
| Reusar segredo em vez de criar | `CRON_SECRET` do `POST /api/estado`; nenhum segredo novo. |
| Erro é código estável, nunca a mensagem | `desfecho` é o conjunto validado; texto do modelo não entra em coluna nenhuma. |

## Project Structure

### Documentation (this feature)

```text
specs/002-observabilidade-ia/
├── spec.md              # entrada
├── pesquisa.md          # estado da arte + as 6 decisões (pré-existente)
├── plan.md              # este arquivo
├── research.md          # Phase 0: as 9 decisões técnicas
├── data-model.md        # Phase 1: as 3 tabelas + as entidades derivadas
├── contracts/
│   ├── telemetria.md    # contrato do módulo: registro, códigos, agregações
│   └── estado-noturno-ia.md  # células do coletor IA, card e delta do POST /api/estado
├── quickstart.md        # Phase 1: como validar ponta a ponta
└── tasks.md             # Phase 2 (/speckit-tasks — ainda não existe)
```

### Source Code (repository root)

```text
roihub/
├── lib/
│   ├── telemetria.mjs            # NOVO (puro): montar registro, hash da conta, código por
│   │                             #   empregado, células do coletor, resumo diário, lacuna
│   ├── telemetria-db.mjs         # NOVO (pg): dono único de ia_chamadas/ia_resumo/ia_pool;
│   │                             #   registrar(), consolidar(), expirar(), leituras da aba
│   ├── reranker.mjs              # spawnClaude passa a resolver o PAYLOAD (não só o result);
│   │                             #   rodarClaude e rodarCacheado registram; `empregado` vira opção
│   ├── resposta.mjs              # declara empregado: "resposta"
│   ├── juiz.mjs                  # declara empregado: "juiz"
│   ├── autopublish-clients.ts    # claudeRun registra por tentativa (draft e ymyl)
│   └── estado-noturno.mjs        # coletarIA(): células categóricas; coletarPool re-chaveado por hash
├── app/
│   ├── ia/page.tsx               # NOVO: a aba
│   ├── tabs.tsx                  # + "ia" na união e no nav
│   └── api/estado/route.ts       # + coletor IA, + consolidação de ontem, + expiração de 90 dias
├── scripts/
│   ├── orcamento.mjs             # NOVO: contas vivas + consumo da janela + custo previsto
│   ├── corpus-defasado.mjs       # declara empregado: "defasagem"
│   └── probe-pool.mjs            # declara empregado: "sonda"
├── test/telemetria.test.mjs      # NOVO
└── package.json                  # + test/telemetria.test.mjs na lista explícita
```

**Structure Decision**: instrumentar os **dois caminhos compartilhados** já existentes em vez de criar
um wrapper que cada chamador precise lembrar de usar (FR-006) — empregado novo passa a ser observado
sem ninguém instrumentá-lo, e o modo de falha "entrou no repo e não deixa rastro" fica impossível por
construção. A duplicação `reranker.mjs`/`autopublish-clients.ts` é deliberada e continua (a medição em
node puro e a aba têm que rodar o mesmo caminho); unificá-las está fora do escopo, então a
instrumentação cobre as duas. O par puro/`-db` copia `corpus.mjs`/`corpus-db.mjs`, que existe pela
mesma razão: schema duplicado em dois lugares diverge em silêncio.

## Complexity Tracking

*Sem violações de constituição a justificar (ver Constitution Check acima).*

Três decisões que **adicionam** algo e por isso ficam registradas com o motivo:

| Adição | Por que é necessária | Alternativa mais simples, e por que foi rejeitada |
|---|---|---|
| 3ª tabela (`ia_pool`) | US2 exige "desde quando" com precisão de 24 h e **permanente**, além dos 90 dias do detalhe. | Derivar do histórico de `hub_estado` (1 linha/dia, já permanente): rejeitado porque `mesclarEstado` carrega os valores de ontem quando um coletor falha — dia não medido ficaria indistinguível de dia medido igual, esticando o "desde quando" em silêncio. É exatamente a classe de defeito que a regra do `nao_apurado` existe para barrar. |
| `lib/telemetria-db.mjs` separado de `lib/db.ts` | `reranker.mjs` é `.mjs` e não pode importar `.ts`; a gravação tem que funcionar do script local. | Pôr as tabelas no `ensure()` de `lib/db.ts`: rejeitado, deixaria o caminho de escrita inacessível de onde ele mais precisa acontecer. |
| Coletor `IA` no estado noturno | FR-018/FR-020 pedem card por transição categórica e coletor caído com falha fechada. | Reaproveitar só o domínio `POOL`: rejeitado, "empregado passou a falhar" e "lacuna de telemetria" não são estado de conta e precisam de chave própria. |
