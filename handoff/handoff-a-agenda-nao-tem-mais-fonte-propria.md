# A agenda não tem mais fonte própria: toda linha vem do ranking

> **Executado em 31/08/2026.** Pedido: "quero que tudo que exista em /agenda venha de / (ranking)".
> Escolhida a opção mais forte das quatro apresentadas: a aba vira **projeção pura** do
> `data/projects.json`, sem lista paralela.

## BLUF

A `/agenda` misturava **duas fontes** e 43% das linhas não nasciam do ranking: 32 ações do
`projects.json` + 24 tarefas do Postgres (`hub_tasks`), destas 3 sem projeto nenhum. Agora renderiza
**só as 32 ações**, na ordem do score, e o único write da aba é marcar/desmarcar o check.

- **Nenhum dado foi apagado.** As 24 linhas de `hub_tasks` continuam no banco — apenas deixam de
  ser renderizadas na agenda. O card noturno de estado (`gerador = 'estado'`) continua sendo
  inserido pelo cron e já tinha tela própria em `/automacao`, que passa a ser o único lugar dele.
- **Fim do caminho "ação vira tarefa editável"** (`promote`): salvar a ação no banco criava
  exatamente a segunda lista que este pedido veio matar.

## O que saiu da tela

| Saiu | Por quê |
|---|---|
| Formulário "Nova tarefa…" | Criar linha fora do ranking é criar a segunda fonte. |
| Modal de edição (`edit-task.tsx`) | Só existia para tarefa do banco. |
| Botão apagar (`×`) | Ação do ranking não se apaga — se apaga a `acao` no JSON. |
| Filtros **urgência**, **origem**, **responsável** | Toda linha é ação, sem data e sem dono: filtro com uma resposta só. |
| Selo `AÇÃO DO RANKING` | Não distingue mais nada — todas são. |
| Baldes de data (atrasada/hoje/semana) | Ação não tem data própria; a chave de ordem é o rank. |

Sobraram 4 controles: texto, projeto, balde e ordem (**ranking** — o `ordem=urgencia` da URL virou
`ordem=ranking`).

## O que ficou de pé

Os três baldes por esforço, a partição de **Segurança** dentro de Execução, o check com expiração de
10 dias (`ACAO_DONE_DIAS`), o filtro na querystring (visão compartilhável) e o corte de `acao` vazia.

## Decisões de implementação

- **`toggle` agora valida `key.startsWith("acao:")`.** A key vem do form; sem o prefixo, o único
  endpoint de escrita da aba marcaria qualquer linha de `hub_done`, inclusive as `task:N` que a
  agenda não renderiza mais.
- **O select de projeto lista quem TEM ação, não os 35 do ranking.** Projeto sem linha viraria um
  filtro que devolve lista vazia sem explicação.
- **A `acaoDesc` foi recolhida num `<details>` ("contexto").** Consequência medida da mudança: com
  as tarefas curtas fora, sobraram 32 diários de bordo empilhados e cabiam **2 cards** na primeira
  tela. Recolhido, cabem 7. Nativo, sem client component; `summary` em `--ink2` (7,5:1) porque
  `--muted` dá 3,3:1 em 11px, e carrega o slug em `sr-only` — o rótulo se repete 32 vezes.
- **Código morto foi junto**, não ficou para depois: `edit-task.tsx`, quatro server actions
  (`addTask`/`update`/`promote`/`del`), `updateTask`/`removeTask` em `lib/db.ts`, e em
  `lib/agenda.mjs` o `weekdayOf`/`nextOccurrence`/`TIPO_IDS`/`ORDEM_BUCKET`/`SEM_RANK`/`URGENCIAS`/
  `ORIGENS`. `RESPONSAVEIS`, `WD_LABELS`, `todaySP`, `brShort` e `addDaysISO` **ficaram** — os
  quadros (`/marketing`, `/ideias`) e `/api/estado` usam.

## Verificação

`npm test` 386/386 · `tsc --noEmit` limpo · `next build` OK · console do browser sem erro.
Conferido no navegador em 1280px e 390px: 32 ações, baldes 12/7/6 + 7 feitas, filtro
`?tipo=decisao&ordem=titulo` ordenando de fato por título, e o check marcado e desmarcado contra o
Postgres de produção (estado restaurado: `select count(*) from hub_done where key like 'acao:qprime:%'`
= 0, `hub_tasks` = 24).

## Se for preciso reverter

As tarefas estão intactas em `hub_tasks`; reverter é restaurar `app/agenda/page.tsx`,
`app/agenda/actions.ts` e `app/agenda/edit-task.tsx` deste commit. Nenhuma migração foi rodada.
