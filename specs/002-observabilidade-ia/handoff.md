# Handoff — Observabilidade dos recursos de IA e saúde dos empregados (spec 002) — 10/08/2026

**Estado**: **código completo (36 de 41 tasks), `npm test` verde (327/327), `tsc --noEmit`
limpo, `next build` ok.** T041 rodou: commit `e5b2f29`, pushado em `main`.

Faltam as 5 validações de ponta a ponta do [quickstart.md](./quickstart.md) — mas **a razão real
é mais estreita** do que a primeira versão deste handoff dizia. Correção: este ambiente **tinha**
`.env` local com `DATABASE_URL` e `CLAUDE_CODE_OAUTH_TOKENS` reais (confirmado depois, conectando
no Postgres de produção) — eu não tinha checado a existência do arquivo antes de escrever a
primeira versão desta seção, o que violou a norma da casa de ler `.env` antes de qualquer
diagnóstico. Refeita a conta, as 5 validações se dividem em dois grupos:

- **T019 e T035 não dependiam de deploy nenhum** — são scripts standalone que rodam contra o
  mesmo Postgres de produção. Deveriam ter rodado nesta sessão e não rodaram, por esse mesmo
  motivo (não checar o `.env`).
- **T014, T024 e T030 dependem do app DEPLOYADO** (`/busca`, `/ia`, `POST /api/estado` na URL de
  produção) — essas sim ficam bloqueadas até o container do EasyPanel subir este commit. O push
  foi só pro GitHub; não confirmei se há auto-deploy configurado.

---

## O que foi entregue

### Novo
- `lib/telemetria.mjs` — puro: `hashConta`, `ambiente`, `codigo`, `montarRegistro`, `resumirDia`,
  `estadoDoEmpregado`, `transicaoPool`, `celulasIA`. 25 casos em `test/telemetria.test.mjs`.
- `lib/telemetria-db.mjs` — dono de `ia_chamadas`/`ia_resumo`/`ia_pool`: `ensure`, `registrar`
  (best-effort, nunca lança), `consolidar`, `expirar`, `atualizarPool`, `poolDatado`, `janela`,
  `ultimaSonda`, `porEmpregado`, `orcamento`.
- `app/ia/page.tsx` — a aba, 5 blocos (consumo, falhas por código, pool datado, estado por
  empregado, banner de lacuna).
- `scripts/orcamento.mjs`, `scripts/telemetria-sanidade.mjs` — CLIs novos.
- `test/telemetria.test.mjs` (25 casos), 2 casos novos em `test/reranker.test.mjs`, 5 casos novos
  em `test/estado-noturno.test.mjs`.

### Instrumentado
- `lib/reranker.mjs` — `spawnClaude` resolve o payload inteiro; `rodarClaude` gera `pedido` e
  registra por tentativa (sem `await` no caminho de busca); `rodarCacheado` registra acerto de
  cache; `rerank`/`sondar` declaram `empregado`. **Ganho de teste**: `rodarClaude` agora aceita
  `spawnImpl`/`registrar` injetáveis (opcionais, default = produção) — sem isso T013 não dava
  para testar sem tocar num `claude` de verdade.
- `lib/autopublish-clients.ts` — `claudeRun` registra por tentativa, `empregado` derivado de
  `webSearch` (`autopublish-draft`/`autopublish-ymyl`).
- `lib/resposta.mjs`, `lib/juiz.mjs`, `scripts/corpus-defasado.mjs` — declaram `empregado`.
- `lib/estado-noturno.mjs` — `diffEstado` ganhou a guarda de domínio novo (D10); `coletarPool`
  rechaveado por hash da conta, lendo de `poolDatado()`, rótulo com a data.
- `app/api/estado/route.ts` — 5º coletor (`IA`, serial); `POOL` agora grava em `ia_pool` via
  `atualizarPool` antes de ler `coletarPool`; `consolidar(ontem)` + `expirar(90)` depois do
  diff/card; resposta ganhou `resumo`/`expiradas`/`telemetria`.
- `scripts/avaliar.mjs`, `scripts/avaliar-resposta.mjs`, `scripts/corpus-defasado.mjs` — definem
  `HUB_CORRIDA` no início; gravam linha sentinela `<empregado>-corrida-incompleta` no aborto por
  `MAX_CONTA_SEGUIDAS`.
- `scripts/probe-pool.mjs` — `--gravar` passa a escrever em `ia_pool` (não mais em
  `data/pool-sondagens.json`, que fica no repo como registro datado das leituras de antes de
  10/08).
- `.env.example`, `CLAUDE.md` (seção nova), `package.json` (`test/telemetria.test.mjs` na lista).

---

## Decisões tomadas nesta sessão que não estavam 100% fechadas pelos contratos

1. **`codigo()` para tentativas que esgotam a conta**: o contrato dava só o exemplo
   `codigo("juiz", Error("rerank-conta")) === "juiz-conta"`, mas `spawnClaude` sempre rejeita com
   a mensagem genérica `"rerank-output"`, diferenciando 429/403/401 só por `.status`/
   `.trocaDeConta`. Decidi: toda tentativa com `erro.trocaDeConta === true` registra desfecho
   `<empregado>-conta` (indiferenciado), e é o `status_api` (429/403/401) quem desambigua depois
   — exatamente a frase do `data-model.md` ("`rerank-conta` não diz se foi 429 ou 403"). Ver
   `lib/reranker.mjs:rodarClaude`, comentário no `catch`.
2. **`celulasIA(linhas, contas, ultimaSonda, agora)`**: o parâmetro `contas` está no contrato mas
   nenhuma tarefa explica pra que serve — não o uso (a célula `POOL` já tem chave própria em
   `lib/estado-noturno.mjs`). Mantive na assinatura por fidelidade ao contrato, comentado como
   reservado.
3. **`EMPREGADOS` da aba `/ia`**: escolhi mostrar 7 dos 8 valores do enum (todos menos `sonda`,
   que é quem PRODUZ o relógio da lacuna — mostrar o próprio estado dela duplicaria o banner).
4. **`telemetria: "ok"|"lacuna"` na resposta do POST**: só é `"ok"` quando o coletor `IA` RODOU
   (não estourou) E não há célula `IA:coletor:telemetria`. Qualquer outra combinação (coletor
   caiu, ou lacuna real) reporta `"lacuna"` — incerto nunca lê como saudável, mesmo critério do
   D7 do resto da feature.
5. **`consolidar`/`expirar` em `try/catch`** no fim da rota: não é best-effort *silencioso* no
   sentido do FR-007 (isso é só para `registrar`), mas uma falha aqui não pode derrubar a resposta
   que já entregou o diff/card de verdade. `resumo`/`expiradas` saem `0` se falhar.

---

## O que NÃO foi validado (e por quê)

### Sem deploy nenhum — dava pra ter rodado, ficou pendente por descuido meu

- **T019 (US2)**: `node --env-file=.env scripts/probe-pool.mjs --gravar` contra `ia_pool` de
  produção; rodar duas vezes seguidas e confirmar que a 2ª não duplica linha, só atualiza `visto`.
  Custo real: **3 chamadas de claude-cli** (1 por conta do pool).
- **T035 (US5)**: `node --env-file=.env scripts/orcamento.mjs --chamadas 85`. Zero chamada de LLM
  — só lê `ia_pool`/`ia_chamadas`.

### Dependem do container redeployado

- **T014 (US1)**: busca real em `hub.roilabs.com.br/busca` grava 2 linhas (`rerank`+`resposta`);
  controle negativo (`?rerank=0&resposta=0`) não grava nada.
- **T024 (US3)**: abrir `/ia` depois de um ciclo noturno completo e bater os números contra o SQL
  cru; derrubar a escrita de propósito e confirmar as duas metades da FR-007 ao mesmo tempo (busca
  continua respondendo **e** a janela aparece como lacuna).
- **T030 (US4)**: `POST /api/estado` duas vezes seguidas → 2ª sai silenciosa. **Esperado no
  PRIMEIRO deploy**: a corrida logo após vai emitir um card com **3 "novos" + 3 "resolvidos" no
  domínio `POOL`** — a chave trocou de índice posicional para hash da conta. Não é achado, é
  ruído de uma noite só (D10, risco de migração conhecido).

`npm test` (327/327) e `npx tsc --noEmit` (limpo) cobrem toda a lógica pura e os contratos de
tipo, mas **não substituem** os 5 cenários acima — só existem contra Postgres, pool e o app
rodando de verdade.

---

## Próximo passo

1. **T019 e T035** podem rodar agora, sem depender de deploy — só precisam de autorização porque
   `probe-pool.mjs --gravar` gasta 3 chamadas reais do pool de produção.
2. Fazer (ou confirmar) o deploy do commit `e5b2f29` no EasyPanel.
3. Rodar T014/T024/T030 contra a URL de produção depois do deploy.
4. Depois do primeiro ciclo noturno pós-deploy, ler as primeiras linhas de `ia_chamadas` uma a
   uma antes de olhar qualquer agregado — regra da casa, confirmada quatro vezes nesta base
   (`pesquisa.md` §3.6). Deploy sempre fora da janela 23:30–01:00 BRT (estado noturno 23:37,
   autopublishing 00:13).

---

## Arquivos alterados

```
.env.example
CLAUDE.md
package.json

lib/telemetria.mjs                     (novo)
lib/telemetria-db.mjs                  (novo)
lib/reranker.mjs
lib/resposta.mjs
lib/juiz.mjs
lib/autopublish-clients.ts
lib/estado-noturno.mjs

app/ia/page.tsx                        (novo)
app/tabs.tsx
app/api/estado/route.ts

scripts/orcamento.mjs                  (novo)
scripts/telemetria-sanidade.mjs        (novo)
scripts/probe-pool.mjs
scripts/avaliar.mjs
scripts/avaliar-resposta.mjs
scripts/corpus-defasado.mjs

test/telemetria.test.mjs               (novo)
test/reranker.test.mjs
test/estado-noturno.test.mjs

specs/002-observabilidade-ia/tasks.md  (checkboxes)
```
