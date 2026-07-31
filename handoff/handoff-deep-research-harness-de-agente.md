# Handoff — próximo passo: deep-research de harness de agente para o roihub (31/07/2026, 10h45 BRT)

Estado anterior: [`handoff-resumo-entregue-e-as-26-decisoes.md`](handoff-resumo-entregue-e-as-26-decisoes.md)
(aba `/resumo` no ar). Índice: [`../handoff.md`](../handoff.md).

**Tarefa:** deep-research sobre qual **harness de agente** o roihub deve adotar.

---

## ⚠️ Leia isto antes de pesquisar: o harness já existe

A pergunta **não** é "qual harness instalar do zero". Medido no repo em 31/07:

| Peça | Onde | O que é hoje |
|---|---|---|
| Motor | `Dockerfile:19` | `npm install -g @anthropic-ai/claude-code` dentro da imagem Alpine |
| Auth | `lib/autopublish-clients.ts:169` | `CLAUDE_CODE_OAUTH_TOKEN**S**` — **plural**, pool de tokens de assinatura (`claude setup-token`) |
| Invocação | `lib/autopublish-clients.ts:176` | `spawn(process.env.CLAUDE_BIN \|\| "claude", …)` cru, modelo `sonnet`, timeout 600s |
| Gatilho | `.github/workflows/seo-autopublish.yml` | cron `13 3 * * *` (00:13 BRT) → `HUB_URL` → `/api/seo/autopublish` |
| Anti-rate-limit | `scripts/run-autopublish.mjs:22` | fila girada 1 passo/dia + retry trocando de token |

Ou seja: **o harness de execução está resolvido e roda em produção todo dia.** O que não existe é
outra coisa — e é o que a pesquisa tem que decidir.

🚨 **O roihub não tem `.claude/`.** Nem `CLAUDE.md`, nem skill, nem hook, nem subagent, nem
`settings.json`. Toda sessão nova redescobre as convenções da casa do zero — **eu fiz exatamente
isso hoje**, gastando ~8 chamadas de ferramenta para achar `listProjects()`, o padrão de teste
(`node --test`, sem framework), os tokens de CSS e o fato de o deploy ser Docker/EasyPanel e não
Vercel. Isso é custo recorrente e é o buraco real.

O único resíduo de harness no repo é `.superpowers/sdd/`, de uma feature de 24/07 — não é
infraestrutura viva, é histórico de uma entrega.

---

## As quatro perguntas da pesquisa

### A. Claude Agent SDK vs `spawn("claude")` — a decisiva

O `spawn` cru funciona mas é frágil: parsing de JSON no texto (`autopublish-clients.ts:291`
documenta que "claude-cli não tem json_schema strict"), retry à mão, zero streaming, zero tool-use
estruturado.

**A pergunta que decide tudo:** o Claude Agent SDK autentica com **token de assinatura**
(`CLAUDE_CODE_OAUTH_TOKEN`) ou exige **API key paga**? Se exigir API key, o SDK está fora por
[[budget_claude_cli_only]] e a resposta é "melhora o spawn", não "troca por SDK".
⚠️ **Não responder isso de memória** — checar na doc atual (`/claude-api` skill ou docs.anthropic.com).

### B. O que colocar em `.claude/` — provavelmente o maior ganho

Escopo: `CLAUDE.md` do projeto, skills, hooks, subagents, `settings.json` de permissões.
Candidatos óbvios pelo que este repo repete: o contrato `listProjects()` (nenhuma página importa
`data/projects.json` direto), "teste é `node --test` sem framework", "deploy é Docker no EasyPanel,
`vercel project ls` não prova nada", a janela de não-push 00:00–01:00.

▶️ **Rodar `/claude-automation-recommender` ANTES de pesquisar na web.** Ele analisa este codebase e
recomenda hooks/skills/subagents — é grátis, é local e é grounded no repo. A web só entra para o
que ele não cobrir.

### C. Alternativas de harness — filtro duro de ToS

Comparar `claude-loop-runner` (já é da casa, roda `claude --print` em loop e o contexto nunca
cresce), OpenCode, Codex, Aider, `nanocodex`.

🚨 **Filtro que elimina a maioria antes de comparar feature:** token de assinatura em cliente de
terceiro = risco de ban ([[claude_subscription_agents_official_vs_thirdparty]]). CLI oficial +
`setup-token` é o único caminho seguro. Harness que peça o token para um binário não-Anthropic
**sai da lista na triagem**, por melhor que seja.

### D. Agente dentro de container

O motor roda em `node:22-alpine` no EasyPanel. Pesquisar o que quebra: dependência glibc, `git`
e `ripgrep` (já instalados no `Dockerfile:18`), limite de memória, e o corte de **~300s do proxy do
EasyPanel** — que já apareceu como `request-failed` falso nos runs do `polarisia` e do
`reviewshield`, contra um timeout de 600s no código.

---

## Restrições que a pesquisa não pode ignorar

- **Sem API paga.** Único LLM = assinatura Claude via CLI ([[budget_claude_cli_only]]). Qualquer
  recomendação que peça `ANTHROPIC_API_KEY` é resposta errada para este repo.
- **Gargalo é rate limit, não modelo** — a solução da casa é somar contas
  ([[polaris_teams_use_claude_cli]]), e o pool plural já está implementado aqui.
- **Windows:** `spawn("claude")` quebra ([[roihub_autopublishing_gotchas]]). Em produção é Linux,
  mas dev é Windows/OneDrive.
- **Não-push 00:00–01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel**, `output: standalone` — não Vercel
  ([[vercel_project_ls_is_not_proof_of_offline]]).

---

## O que fecha a entrega

Uma **recomendação com decisão**, não um catálogo. Formato:

1. A/B/C/D respondidas, com fonte citada e data (doc de LLM envelhece rápido).
2. Uma tabela **adotar / não adotar / adiar**, com o porquê em uma linha.
3. Se a recomendação for `.claude/`: os arquivos escritos e commitados na mesma sessão — é barato
   e o ganho é imediato.
4. Se for trocar o `spawn` pelo SDK: **não implementar na mesma sessão.** É o caminho crítico do
   autopublishing, que publica todo dia às 00:13; quebrar ali é 10 projetos sem artigo.

⚠️ **Deep-research e `/code-review ultra` são disparados pelo usuário, não pelo agente.** Se a
pesquisa profunda for para valer, o Jean precisa acionar — senão a sessão faz busca comum
(`WebSearch`/`WebFetch`), que também serve, só é mais lenta.

**Fechar = `npm test` verde + push** (o hub não tem card de agenda para isto).

---

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Ainda só o Jean pode fazer

Bing Webmaster Tools no `goiania` (5 min, maior score acionável), as 4 chaves do Stripe do
`compass`, `GOOGLE_CLIENT_ID` do `reviewshield`, os 2 Request Indexing do `fabrica` e — o mais
antigo e perigoso — **rotacionar os segredos vazados** ([[secrets_to_rotate]]).
