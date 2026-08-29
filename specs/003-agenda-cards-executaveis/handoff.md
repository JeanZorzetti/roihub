# Handoff — agenda separada em Conferência / Execução / Decisão (spec 003) — 29/08/2026

**Estado**: **entrega completa, verificada no navegador com o banco de produção.** `npm test` 341/341, `tsc --noEmit` limpo, `next build` exit 0, console do navegador sem erro nem warning.

---

## O que mudou na tela

`/agenda` deixou de ser agrupada por data e passou a ser agrupada pelo **trabalho que o card exige**. Em 29/08, com os dados reais:

| Balde | Cards | Atrasados |
|---|---|---|
| 🔍 Conferência | 23 | 14 |
| 🔨 Execução | 20 | 0 |
| 🧭 Decisão | 4 | 0 |

O eixo de data **não sumiu** — virou ordenação dentro de cada balde (atrasadas → hoje → 7 dias → mais tarde → sem data), com a data do card atrasado marcada com `⚠` e o cabeçalho do balde dizendo "· 14 atrasadas".

---

## Arquivos

- **`lib/agenda.mjs`** — `TIPOS`, `TIPO_IDS`, `tipoDe(titulo)` e `ORDEM_BUCKET`. Lógica pura em `.mjs` de propósito (padrão do repo: importável pelo Next e pelo `node --test` sem transpilar).
- **`lib/db.ts`** — `Task.tipo`, migração idempotente `ALTER TABLE hub_tasks ADD COLUMN IF NOT EXISTS tipo TEXT`, e a coluna entrando em `listTasks`/`insertTask`/`updateTask`.
- **`app/agenda/page.tsx`** — reescrito. `itemFromTask` agora devolve um item só (com `bucket` e `tipo` dentro) em vez de um par; `porUrgencia` ordena; o componente `Section` virou `Balde`.
- **`app/agenda/edit-task.tsx`** e **`app/agenda/actions.ts`** — seletor de balde + validação contra `TIPO_IDS`.
- **`app/api/estado/route.ts`** — o card noturno nasce com `tipo: "conferencia"`.
- **`app/globals.css`** — `.ag-atraso`, `.ag-h-atraso`, `.ag-vazio`, `.sr-only`.
- **`test/agenda.test.mjs`** — 5 casos novos. Ficaram **neste** arquivo, que já estava registrado no `package.json` — arquivo de teste novo teria que ser adicionado à mão lá, e teste que não roda não reprova nada (armadilha nº2 do CLAUDE.md).

---

## Decisões que custaram análise

**1. Heurística de texto em vez de campo curado — e por quê.**
A alternativa óbvia era uma coluna `tipo` preenchida à mão em todo card. Não serve: **as ações do ranking não têm linha no banco** — vêm do `data/projects.json` via `evaluateAll()`. Uma coluna cobriria só as tarefas do Postgres, e em 29/08 as ações eram 17 dos 45 cards. A derivação por texto é o único mecanismo que cobre as duas fontes com um diff só. O override existe para a exceção, não para o caso comum: hoje, **0 de 38 tarefas** têm balde fixado.

**2. Classificar pelo título, nunca pela descrição.**
A `descricao` destes cards é um diário de bordo ("✅ EXECUTADO 31/07…", "medido em 30/07…"). Usá-la classificaria o card pelo que **já foi feito**. Três armadilhas reais que isso evita, e que estão travadas em teste:
- `"stub em 302, medido em 30/07"` → Execução (particípio, não é pedido de medição);
- `"sair da zona de risco do kill-gate"` → Execução (`kill-gate` não é `Gate <data>`);
- `"dados escolhem o ciclo 15"` → Conferência (`escolhem` não é `escolher se`).

**3. Decisão vence Conferência.** Decisão pendente trava a medição; o inverso não. `"Gate 31/08: decidir se religa"` vai para Decisão.

**4. Sem `CHECK` no banco.** A lista de baldes vive no `.mjs`; duplicá-la em constraint daria uma migração a cada rótulo novo. A validação está na server action (`TIPO_IDS`), que é o trust boundary real.

---

## Como foi verificado

Dev server contra o Postgres de produção (`roihub_db`), sem `HUB_PASS` (o middleware libera fora de produção — não foi preciso passar senha ao browser):

1. Render dos três baldes com os números acima, via Playwright.
2. **Insert com override**: card com título `"…publicar 1 artigo…"` (que a heurística manda para Execução) criado com balde Decisão → caiu em Decisão (5), com o selo `BALDE FIXADO`.
3. **Update devolvendo ao automático**: mesmo card → migrou para Execução (21), selo sumiu, Decisão voltou a 4.
4. **Delete**: card de teste apagado. Banco reconferido por SQL: `0` cards de teste, `38` tarefas, `0` com balde fixado.

---

## O que ficou de fora (deliberado)

- **A segunda página da tese de 11/08 foi descartada, não adiada.** Ver a seção "Por que a tese de 11/08 foi substituída" no spec.
- **Nenhum card foi reclassificado à mão.** Dois cards ficam discutivelmente no balde errado hoje e foram deixados assim de propósito, para que o primeiro uso do override seja do usuário e não meu:
  - `claudeloop` ("Se a tese é audiência de dev, aplicar o playbook GEO/AEO") → caiu em Execução; é execução **condicionada a uma decisão** de tese.
  - `cannibal_scan` ("Lembrar que push não publica…") → caiu em Execução; é um lembrete de processo, não uma tarefa.
- **Os 13 cards `Estado` acumulados não foram tocados.** Agora estão todos visíveis juntos no topo de Conferência, que é exatamente onde a decisão sobre eles fica óbvia — 10 dos ~30 sinais que eles carregam são ruído conhecido (`POOL:*` e `IA:empregado:sonda` entram e saem sozinhos). Consolidar o card noturno ou parar de emitir card para sinal oscilante é uma decisão do usuário, e virou item do relatório de 29/08.
- **A poluição visual das descrições longas** (um card do sirius ocupa uma tela inteira) é anterior a esta mudança e não foi mexida — `ag-desc` sempre renderizou completo.
