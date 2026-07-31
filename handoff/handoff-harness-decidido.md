# Handoff — harness de agente: decidido (31/07/2026)

Estado anterior: [`handoff-deep-research-harness-de-agente.md`](handoff-deep-research-harness-de-agente.md).
Índice: [`../handoff.md`](../handoff.md).

**Entregue nesta sessão:** `CLAUDE.md` + `.claude/settings.json` (a resposta da pergunta B),
e as quatro perguntas respondidas com fonte e data. Nada do caminho crítico do
autopublishing foi tocado.

---

## Decisão em uma tabela

| | O quê | Por quê (uma linha) |
|---|---|---|
| ✅ **Adotar** | `CLAUDE.md` + `.claude/settings.json` | Custava ~8 chamadas de ferramenta por sessão e agora custa zero; escrito e commitado hoje. |
| ✅ **Adotar** | Continuar no `spawn("claude")` cru | É a forma que a própria Anthropic documenta para quem não usa o SDK, e é a única que aceita token de assinatura. |
| ❌ **Não adotar** | Claude Agent SDK | Só autentica por `ANTHROPIC_API_KEY` (ou Bedrock/Vertex/Foundry). Fora por [[budget_claude_cli_only]]. |
| ❌ **Não adotar** | OpenCode, Aider, Codex, `nanocodex` | Todos exigem entregar credencial a binário não-Anthropic ou pagar API. Saem na triagem. |
| ⏸️ **Adiar** | Corrigir o timeout de 300s do cliente | Diagnóstico fechado, patch escrito abaixo — mas é o caminho crítico das 00:13 e a correlação ainda não foi confirmada em log real. |
| ⏸️ **Adiar** | Hooks, subagents, skills de projeto | Sem linter, sem formatter, 17 arquivos em `lib/`. Nada aqui se paga hoje. |

---

## A. Claude Agent SDK vs `spawn("claude")` — RESOLVIDO: fica o spawn

**Fonte:** [Agent SDK Quickstart](https://code.claude.com/docs/en/agent-sdk/quickstart) e
[Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), lidos em 31/07/2026.

O SDK autentica **só** por:

- `ANTHROPIC_API_KEY` (o caminho padrão do Quickstart);
- Amazon Bedrock (`CLAUDE_CODE_USE_BEDROCK=1`), Claude Platform on AWS
  (`CLAUDE_CODE_USE_ANTHROPIC_AWS=1`), Vertex (`CLAUDE_CODE_USE_VERTEX=1`),
  Microsoft Foundry (`CLAUDE_CODE_USE_FOUNDRY=1`).

`CLAUDE_CODE_OAUTH_TOKEN` **não aparece em lugar nenhum da documentação do SDK.** E as duas
páginas trazem a mesma nota, literal:

> "Unless previously approved, Anthropic does not allow third party developers to offer
> claude.ai login or rate limits for their products, including agents built on the Claude
> Agent SDK. Use the API key authentication methods described in the Quickstart instead."

Ou seja: adotar o SDK aqui significa **passar a pagar API**. Isso é resposta errada para
este repo ([[budget_claude_cli_only]]). **O SDK está fora.**

E o achado que fecha a questão pelo outro lado — a mesma página de overview diz, sobre quem
não usa o SDK:

> "To drive the same agent loop from another language, run the CLI as a subprocess with the
> `-p` flag and `--output-format json`."

**É exatamente o que `lib/autopublish-clients.ts` já faz.** O `spawn` cru não é gambiarra:
é o padrão documentado. As fragilidades listadas no handoff anterior (parsing de JSON no
texto, retry à mão, zero streaming) são reais, mas são o preço de não pagar API — e o
`parseJsonBlock` já resolve a pior delas.

⚠️ Uma coisa que o SDK **teria** dado e o spawn não dá: ele carrega `.claude/` (skills,
comandos, memória) automaticamente. Irrelevante aqui — o autopublishing manda o prompt
inteiro por stdin, não depende de contexto de projeto.

## B. O que colocar em `.claude/` — FEITO

Rodei o `/claude-automation-recommender` sobre o repo antes de qualquer busca na web, como
o handoff mandava. Perfil detectado: Next.js 16 App Router + TS, Node 22, Postgres via `pg`,
`node --test` sem framework, Docker/EasyPanel, **zero eslint, zero prettier, zero `.claude/`**.

**Escrito e commitado hoje:**

- **`CLAUDE.md`** — as 5 coisas que toda sessão redescobria (contrato `listProjects()`,
  `node --test` sem framework + a pegadinha da lista explícita no `package.json`, deploy
  Docker/EasyPanel e não Vercel, janela de não-push 00:00–01:00, e por que `.mjs` convive
  com `.ts`), mais a cadeia do autopublishing e as convenções de comentário.
- **`.claude/settings.json`** — `deny` em `Read/Edit/Write(./.env)` (o `.env` real tem o
  pool de tokens, `GITHUB_TOKEN` e `DATABASE_URL`) e `allow` nos comandos read-only +
  `npm test`, para parar de pedir permissão no que sempre é aprovado.

**O que a recomendação sugeria e eu NÃO fiz, de propósito:**

- *Hook de format/lint on save*: não existe prettier nem eslint no repo. O hook clássico
  não tem o que chamar.
- *Hook `PostToolUse` rodando `npm test`*: a suite leva 1,6 s, então caberia — mas rodar
  132 testes a cada edição de um `.tsx` de página é ruído. Se virar dor, o gatilho certo é
  matcher em `lib/**` e `test/**`, não em tudo.
- *Subagent de code-review*: `lib/` tem 17 arquivos. Não há o que paralelizar.
- *MCP de GitHub/Postgres*: o repo já fala com o GitHub por `fetch` cru com token
  fine-grained, e o `gh` CLI já está disponível. MCP aqui é peça a mais sem ganho.

Proteção de `.env` virou **regra declarativa no `settings.json`, não hook** — um `deny`
nativo faz o mesmo que um script `PreToolUse` e não tem shell para dar errado.

## C. Alternativas de harness — todas saem na triagem de ToS

O filtro do handoff anterior ([[claude_subscription_agents_official_vs_thirdparty]]) elimina
a lista inteira antes de comparar feature — e agora tem confirmação escrita da Anthropic
(a nota citada em A vale para "third party developers", não só para o SDK).

| Candidato | Veredito |
|---|---|
| `claude-loop-runner` | **Único aprovado.** Roda `claude --print`, binário oficial da Anthropic, token da assinatura no processo que a Anthropic escreveu. É o que a casa já usa. |
| OpenCode, Aider, `nanocodex` | Fora. Ou pedem chave de API própria (custo), ou receberiam o token de assinatura num binário não-Anthropic (risco de ban). |
| Codex | Fora. É produto da OpenAI: chave de API paga, e nada a ver com a assinatura Claude. |

Não há por que trocar: o roihub já roda o CLI oficial direto, que é um passo mais curto que
o `claude-loop-runner` (o loop-runner serve para sessão longa que não pode crescer contexto
— o autopublishing é one-shot por projeto).

## D. Agente dentro de container — 🚨 o "corte de 300s do EasyPanel" provavelmente não é o EasyPanel

Essa é a descoberta cara da sessão. **Premissa do handoff anterior não sobreviveu.**

Medido no repo hoje:

| Camada | Timeout |
|---|---|
| `spawnClaude` (o CLI) | 600 s (`CLAUDE_TIMEOUT_MS`, `autopublish-clients.ts:224`) |
| Rota Next | 900 s (`maxDuration`, `app/api/seo/autopublish/route.ts:7`) |
| **`fetch()` do cliente no GitHub Actions** | **300 s — e ninguém configurou isso** |

O `scripts/run-autopublish.mjs` roda **no runner do GitHub Actions**, não no EasyPanel, e
chama `HUB_URL/api/seo/autopublish` com o `fetch()` global do Node. O `fetch` do Node é
undici, e o **`headersTimeout` default do undici é 300 000 ms** — ele desiste esperando os
*headers* da resposta e lança `UND_ERR_HEADERS_TIMEOUT`
([nodejs/undici#1989](https://github.com/nodejs/undici/discussions/1989),
[nodejs/node#46706](https://github.com/nodejs/node/issues/46706) — o default caiu para 30 s
no Node 18.14.1 e foi revertido para 300 s).

Esse throw cai direto no `catch` de `requestPhase` (`run-autopublish.mjs:87`), que registra
**`request-failed`** — exatamente o sintoma visto no `polarisia` e no `reviewshield`, os dois
projetos de draft mais demorado. E o comentário do próprio código já registra a medição que
fecha o quadro: *"context 240s, goiania 366s"*. **366 s > 300 s.**

Consequência: o servidor continua trabalhando (tem 900 s), termina o artigo, e o cliente já
foi embora e marcou falha. Não é o proxy, não é o Alpine, não é memória — é a lib HTTP do
cliente. Buscar config de timeout no EasyPanel é caçar bug no lugar errado.

⚠️ **Confiança: alta, mas não confirmada.** Falta o teste que decide: um `request-failed`
cujo run tenha durado ~300 s cravados. Confirmar assim, antes de mexer:

```js
// em requestPhase, no catch — só para diagnosticar:
} catch (error) {
  log(`fetch-error slug=${body.project} code=${error?.cause?.code ?? error?.code} name=${error?.name}`);
  return { status: "failed", reason: "request-failed" };
}
```

Se sair `code=UND_ERR_HEADERS_TIMEOUT`, está provado.

**O patch (NÃO aplicado — caminho crítico das 00:13):**

```js
import { Agent, setGlobalDispatcher } from "undici";
// O draft com WebSearch leva 240–366 s medidos, e o headersTimeout default do undici é
// 300 s: o cliente desistia antes do servidor (maxDuration 900 s) terminar o artigo.
setGlobalDispatcher(new Agent({ headersTimeout: 900_000, bodyTimeout: 900_000 }));
```

`undici` não é dependência do projeto hoje — ou instala, ou usa
`node:http` direto, ou (mais barato) faz o cliente virar **fire-and-forget**: dispara o
`publish`, não espera a resposta, e descobre o resultado pela fase `verify`, que já existe e
já faz polling. Essa terceira opção é a que não adiciona dependência nenhuma.

**O resto de D, que continua verdade e não é problema:** `git` e `ripgrep` estão instalados
(`Dockerfile:18`), `HOME=/home/node` é gravável para o estado do CLI, e não há dependência
de glibc — o CLI roda em Alpine sem musl-hack porque o `npm install -g` traz o pacote Node,
não um binário compilado.

---

## O que fecha a próxima sessão

1. **Confirmar o `UND_ERR_HEADERS_TIMEOUT`** com o log acima num run real (ou no próximo
   `request-failed`), e então aplicar uma das três saídas — **fora da janela 00:00–01:00**.
2. Se `CLAUDE.md` provar valor, considerar promover a janela de não-push a hook de verdade
   (`PreToolUse` em `Bash(git push:*)` checando a hora) — hoje é só uma linha de texto que
   depende do agente ler.

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Ainda só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica` e — o mais antigo e perigoso —
**rotacionar os segredos vazados** ([[secrets_to_rotate]]).
