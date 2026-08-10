# Handoff — Observabilidade dos recursos de IA e saúde dos empregados (spec 002) — 10/08/2026

**Estado**: **código completo (35 de 41 tasks), `npm test` verde (327/327), `tsc --noEmit` limpo.**
As 5 validações de ponta a ponta do [quickstart.md](./quickstart.md) (T014, T019, T024, T030,
T035) **ficaram pendentes** — exigem produção de verdade (Postgres real, pool de contas, um
deploy) e este ambiente de implementação não tinha `DATABASE_URL` nem `CLAUDE_CODE_OAUTH_TOKENS`.
T041 (commit + push) também não rodou ainda — ver "Próximo passo" abaixo.

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

Nenhum dos 5 cenários do [quickstart.md](./quickstart.md) rodou contra produção nesta sessão —
este ambiente não tinha `DATABASE_URL` nem `CLAUDE_CODE_OAUTH_TOKENS`. Especificamente faltam:

- **T014 (US1)**: confirmar que uma busca real grava 2 linhas (`rerank`+`resposta`) e que o
  controle negativo (`?rerank=0&resposta=0`) não grava nada.
- **T019 (US2)**: `probe-pool.mjs --gravar` de verdade contra `ia_pool`; confirmar que sondar duas
  vezes sem mudança não duplica linha.
- **T024 (US3)**: abrir `/ia` depois de um ciclo noturno completo e bater os números contra o SQL
  cru; derrubar a escrita de propósito e confirmar as duas metades da FR-007 ao mesmo tempo.
- **T030 (US4)**: rodar `POST /api/estado` duas vezes seguidas e confirmar card silencioso na
  segunda. **Esperado no PRIMEIRO deploy, nomeado aqui como o quickstart pede**: a corrida logo
  após o deploy vai emitir um card com **3 "novos" + 3 "resolvidos" no domínio `POOL`** — a chave
  trocou de índice posicional para hash da conta. Não é achado, é ruído de uma noite só (D10,
  risco de migração conhecido).
- **T035 (US5)**: `scripts/orcamento.mjs --chamadas 85` com 2 de 3 contas fora, confirmando que a
  leitura evidencia que a corrida não cabe.

`npm test` (327/327) e `npx tsc --noEmit` (limpo) rodaram e passam — cobrem toda a lógica pura e
os contratos de tipo, mas **não substituem** os 5 cenários acima, que só existem contra Postgres e
pool reais.

---

## Próximo passo

1. Rodar os 5 cenários pendentes contra produção (ou um ambiente de staging com
   `DATABASE_URL`/`CLAUDE_CODE_OAUTH_TOKENS` reais) — T014/T019/T024/T030/T035.
2. **T041**: `git commit` + `git push`, fora da janela 23:30–01:00 BRT (estado noturno 23:37,
   autopublishing 00:13). Depois do primeiro ciclo noturno pós-deploy, ler as primeiras linhas de
   `ia_chamadas` uma a uma antes de olhar qualquer agregado — regra da casa, confirmada quatro
   vezes nesta base (`pesquisa.md` §3.6).

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
