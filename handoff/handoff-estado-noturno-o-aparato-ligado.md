# Handoff — o aparato de medição ligado ao cron (09/08/2026)

## O que motivou

Auditoria do fluxo de trabalho, não do repo. Três gargalos declarados: "eu sou o gargalo",
"repito os mesmos pedidos", "uma coisa por vez". **Dois dos três estavam mal diagnosticados**, e o
`history.jsonl` (248 prompts, janela rotacionada) é quem mostra:

- **"Repito os mesmos pedidos" são perguntas de VERIFICAÇÃO.** `commit e push` 6× +
  `fez commit e push?` 4× + `vc atualizou?` 2× = **12 turnos (5%)**, mais
  `está funcionando em produção?` e `eu não notei diferença, era pra eu notar o quê?`. Slash
  command novo não conserta isso; hook conserta. **Entregue fora deste repo**
  (`~/.claude/hooks/git-pendente.mjs`, hook `Stop` global).
- **"Uma coisa por vez" é teto de COTA, não de orquestração.** `/rate-limit-options` aparece
  **47×** — o prompt mais repetido da base. Agente paralelo triplica o consumo do mesmo pool de 3
  contas. A alavanca é **mais horas**, não mais threads.
- **"Eu sou o gargalo" estava certo:** havia **1 workflow** em todo o portfólio.

## 🚩 O primeiro plano estava errado, e o erro é reutilizável

A ideia era soltar um robô com claude-cli nos blockers marcados `humano: false`. **`humano: false`
não é fila de trabalho de robô** — são **46 de 53** (o "8" citado de cabeça é `humano: true`, o
bloqueio humano real). Este `CLAUDE.md` já avisava que *"o `humano` não se deriva do texto"* e a
premissa não foi conferida antes de virar plano.

Classificado por string literal, zero LLM:

| balde | n | robô consegue? |
|---|---|---|
| `✅ RESOLVIDO / MITIGADO / DESMENTIDO` | **12** | já feito — apodrecendo na fila |
| estado do índice GSC | **10** | **não** — o Googlebot leu e recusou; sem alavanca técnica |
| backend NXDOMAIN | 5 | não — DNS + decisão humana |
| sem caminho de cobrança | 4 | não — decisão de produto |
| sobrou | **15** | parcial |

**26% da fila já está feita e 33% não tem alavanca técnica.** Robô soltado ali gastaria o pool
consertando o consertado. E dos 15 que sobraram, o maior grupo coerente **não precisa de LLM
nenhum**: 6 são config da Vercel (`whatsmeow`, `claudeloop`, `swarm`, `compass` com Root Directory
`/` e site em subpasta; `cannibal_scan`, `pathfinder` com o projeto não ligado ao git) — é
`PATCH /v9/projects`. Mais 3 são edição mecânica. 2 são remedição datada, não tarefa.

## O que foi entregue

`POST /api/estado` + `.github/workflows/estado-noturno.yml`, **23:37 BRT**. Detalhe da frente na
seção "Estado noturno" do `CLAUDE.md`. O resumo do porquê:

**Cinco medidores zero-LLM existiam e nenhum rodava sem alguém digitar o comando.** `conformidade`
e `gateways` estão fora do `npm test` de propósito (390 requisições contra produção) — que é a
definição de cron noturno, não motivo para não rodar. É a mesma LIGAÇÃO que a camada `estado` do
dourado já tinha feito uma camada abaixo.

**A entrega é o DIFF, nunca placar.** "41 violações" saiu igual antes e depois do conserto do
`GEO-01`: o agregado não se mexeu e só a LINHA mudou.

**Falha fechada por coletor é a corretude inteira.** Coletor que estoura devolve zero chave, e sem
`dominiosOk` o diff leria a ausência como conserto — "35 violações resolvidas" no dia em que o
token expirar. `mesclarEstado` carrega o domínio que falhou para amanhã não ver as chaves voltando
como achado novo. Pool vazio estoura pelo mesmo motivo.

**A ordem contra o autopublishing é o ponto:** 23:37 mede o pool **em repouso**. Depois das 00:13 a
sonda mediria o pool drenado e chamaria de morta (403) a conta que só está em 429 — a distinção que
a sonda existe para fazer, e que 3 leituras coladas nunca conseguiram datar.

`sondar` saiu de `scripts/probe-pool.mjs` para `lib/reranker.mjs`: segundo consumidor, e o Next só
importa de `lib/`. O script voltou a ser só impressão.

### Como foi conferido

O coletor foi comparado com `scripts/conformidade.mjs` **nos dois sentidos** nos mesmos projetos —
concordar no zero não prova que captura violação. `goiania`: 0 e 0. `orion`: `CONF:orion:DEP-08`
contra `FALHA DEP-08`, texto de detalhe idêntico. 300 testes verdes, `tsc` limpo, `validade` limpo.

⚠️ **A primeira corrida do teste do hook mediu o TESTE**, e vale registrar: caminho git-bash
(`/c/Users/...`) não serve de `cwd` para o Node no Windows — `spawnSync` devolve `ENOENT`,
indistinguível de "não é repo git", e o check ficou MUDO passando por aprovado nos 3 primeiros
casos. Usar `c:/Users/...`.

## O próximo passo

1. **A 1ª corrida real é hoje às 23:37 e NÃO gera card** — por construção. Ela grava a linha de
   base em `hub_estado`; o diff começa amanhã. Conferir de manhã que a linha existe e que
   `falhas` veio vazio (o `POOL` é o candidato a falhar: depende de `CLAUDE_CODE_OAUTH_TOKENS`
   estar no ambiente do container, não só no `.env` local).
2. **Os 12 `✅ RESOLVIDO` saem de `blockersLista`.** Enquanto estiverem lá, qualquer consumidor da
   lista — humano ou robô — trabalha sobre 26% de lixo. É edição de `data/projects.json`.
3. **Os 6 da Vercel são `PATCH /v9/projects`, não claude-cli.** Zero pool. É o trabalho mais barato
   e mais parado do portfólio. ⚠️ Nunca `vercel project rm` em lote — apaga vizinhos.
4. **Só depois disso** um robô com claude-cli tem fila fresca. E a fila dele não é `humano: false`:
   é o que sobrar da triagem acima.

**Decisões tomadas em 09/08 sobre a premissa errada do `humano: false`, a reconfirmar quando o
robô de código existir:** push direto em `main` (não PR) e fila = blockers. O portão que fica de pé
de qualquer jeito é `npm test` do repo antes do push — reprovou, não empurra.
