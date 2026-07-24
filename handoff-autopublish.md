# Handoff — SEO Autopublishing (1 artigo/dia × 10 projetos)

Última atualização: 2026-07-24. Código **completo, verde e no `main`**. Rollout **bloqueado por secrets**.

## Estado

| | |
|---|---|
| Plano | `docs/superpowers/plans/2026-07-24-seo-autopublishing.md` (Tasks 1–8, todas completas) |
| Ledger | `.superpowers/sdd/2026-07-24-seo-autopublishing/progress.md` |
| Último commit | ver `git log` |
| Verificação local | `npm test` 106/106 · `npx tsc --noEmit` 0 · `npm run build` 0 · `git diff --check` limpo |
| No ar? | **Não.** Nenhum artigo foi publicado, nenhum `workflow_dispatch` rodou, nenhum commit foi escrito em repo de projeto. |

## O que mudou depois do Codex

O Codex parou no *final review* com o trabalho não-commitado e um teste vermelho. Fechado em `12db0f7`,
mais duas mudanças de escopo:

1. **`12db0f7`** — correções do final review: classificador YMYL independente, validação de toda fonte
   (URL https + data ISO) e BLUF de 40–60 palavras, origens Unsplash confiáveis, estado
   `prepared`/`committed` com revert se o banco cair depois do commit, kill switch relido imediatamente
   antes da escrita, e **GSC estrito**: 3 tentativas e falha fechada, porque GSC fora do ar devolvia `[]`
   e isso fazia toda pauta virar `new` — o robô duplicaria URL já ranqueada.
2. **`74fd238`** — motor editorial trocado de **OpenAI → claude-cli** (decisão do Jean: sem verba de API
   paga). Detalhes abaixo.
3. **`4d02a66`** — timeouts dimensionados a partir de uma execução real.

## Motor editorial: claude-cli

O hub instala `@anthropic-ai/claude-code` na própria imagem (ver `Dockerfile`) e autentica por
`CLAUDE_CODE_OAUTH_TOKEN`, gerado com `claude setup-token`. Custo marginal por artigo: **zero** — o
limite é o rate limit da assinatura.

- Pesquisa e decisão viraram **uma chamada só** com `--allowedTools WebSearch`; duas não cabiam no tempo.
- Projetos `ymyl-restricted` (aftercare) levam uma segunda chamada, sem tools, só para classificar risco.
- Sem `json_schema` strict: o schema vai no prompt e o JSON é extraído do texto. Qualquer coisa não
  parseável falha fechado (`llm-output`).
- Códigos de erro `openai-*` viraram `llm-*`. A mensagem é **classificada, nunca repassada** (pode conter
  o prompt inteiro).
- Sem gpt-image-2: a capa vem só do Unsplash, com o 1º resultado como último recurso. Busca vazia bloqueia
  a publicação em vez de publicar sem capa.

### Execução real medida (2026-07-24)

`researchAndDraft` contra o claude-cli de verdade, projeto `context`:

```
elapsed_s 166.6
action new | overlap none
bluf_words 51
sources 2 URLs reais e verificáveis
validateDraft -> []   (passou todos os guardrails)
```

Daí `maxDuration = 600` na rota e timeout de spawn de 240s (`CLAUDE_TIMEOUT_MS`).
**Os dez projetos rodam em série: ~30 min por execução.**

## O que falta para publicar — tudo depende de você

### 1. Secrets do hub (EasyPanel)

| Env | Situação |
|---|---|
| `DATABASE_URL` | já existe em produção |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | já existe em produção (GSC conectado) |
| `CRON_SECRET` | **colar** o valor que já gravei no GitHub Actions como `HUB_CRON_SECRET` |
| `CLAUDE_CODE_OAUTH_TOKENS` | uma ou mais contas separadas por vírgula (`claude setup-token`) |
| `GITHUB_TOKEN` | criar fine-grained token, **Contents: read and write**, só nos 9 repos listados no README |
| `UNSPLASH_ACCESS_KEY` | criar app em unsplash.com/developers (free) |

Faltando qualquer uma, a rota responde `503 missing-env` com **só os nomes**.

### 2. Timeout do proxy

O proxy do EasyPanel precisa aceitar **≥ 600s**. Se cortar antes, o cron recebe `http-504` e nenhuma
publicação fecha — sem erro no código.

### 3. GitHub Actions

`HUB_URL` e `HUB_CRON_SECRET` **já gravados** no repo `JeanZorzetti/roihub`.

### 4. Sequência de rollout (não pule)

1. `workflow_dispatch` com `dry_run=true` → esperado: 10 resumos transitórios, **zero** linha em
   `seo_publications`, zero escrita no GitHub.
2. Kill switch global segue **desligado**. Habilitar só os 4 canários em `/seo`, um por renderizador:
   `goiania` (Astro) · `sirius` (TypeScript post) · `context` (MDX) · `nimblabs` (TypeScript catalog).
3. Ligar o global temporariamente, `dry_run=false`, desligar ao terminar.
4. Para cada canário validar: build, HTTP 200, canonical, schema, sitemap, atribuição da imagem.
5. Só depois habilitar os 10 e deixar o global ligado para o cron diário (08:00 BRT).

## Dry-run dos 10 em produção — 2026-07-24 (run 30122666183)

**6 de 10 passaram.** O dry-run corta depois do `renderDraft` e antes do Unsplash e do commit, então
ele exercita GSC, leitura do repo, inventário, claude-cli, guardrails **e a renderização** — mas não a
imagem nem a escrita.

| Projeto | Resultado | Leitura |
|---|---|---|
| fabrica, roilabs, polarisia, estetiacrm, reviewshield, context | `dry-run` | pipeline completo OK |
| goiania | `dry-run` (reteste) | Astro OK, `validation: []`, **366s** |
| sirius | `block decision:unsafe` (reteste) | guardrail funcionando: o modelo ficou incerto sobre duplicar intenção existente e preferiu não publicar. Não é falha de infra — mas se repetir todo dia, o sirius nunca publica |
| aftercare | `llm-rate` | **as contas Claude esgotaram no 9º projeto.** Duas contas úteis não cobrem 10 artigos/dia |
| nimblabs | `github-missing` | repo fora do escopo do token |

Os `http-502` de goiania e sirius no run original **foram auto-inflingidos**: um push durante a execução
disparou o auto-deploy do EasyPanel, o container reiniciou e derrubou os dois primeiros da fila. Ambos
passaram no reteste com o container estável.

**Renderizadores validados:** Astro (goiania) e MDX (context). `typescript-post` bloqueou antes de
renderizar e `typescript-catalog` nem leu o repo — os dois seguem sem validação.

## ⚠️ Bloqueios abertos em 2026-07-24

1. **`hub.roilabs.com.br` está devolvendo 500 em toda rota.** Causa achada e corrigida em `5c5811d`
   (middleware importava módulo que referenciava `process.getBuiltinModule`, proibido no Edge Runtime —
   ver `nextjs_middleware_edge_forbidden_node_api` na memória). **Falta redeployar o EasyPanel**: o hub
   segue 500 até o rebuild. Como o `Dockerfile` mudou (instala `@anthropic-ai/claude-code`), tem que ser
   **rebuild de imagem**, não só restart.
2. **`JeanZorzetti/nimblabs` está fora do escopo do `GITHUB_TOKEN`** (a API devolve 404; o repo existe).
   Ele é um dos 4 canários. Editar o fine-grained token e incluir o repo. Os outros 8 responderam 200 com
   `push: true`.
3. **1 das 3 contas Claude não serve:** o 2º token responde `403` com *"Your organization has disabled
   Claude subscription access for Claude Code"*. A rotação pula a conta automaticamente, então o robô roda
   com 2 contas — mas o rate limit somado é menor do que você planejou.
4. **Rotacionar os secrets** depois do rollout: os valores foram colados em conversa.
5. **Rate limit é o gargalo real, não o custo.** Com 2 contas úteis o run esgotou no 9º projeto. Ou some
   uma 3ª conta que funcione, ou reduza a cadência (ex.: 5 projetos/dia alternando), ou aceite que os
   últimos da fila falham. A ordem da fila é fixa em `PROJECTS`, então são **sempre os mesmos** que
   perdem — `aftercare` e `nimblabs` no fim. Vale rotacionar a ordem por dia.
6. **Auto-deploy por push derruba o run em andamento.** Confirmado: o EasyPanel redeploya a cada push em
   `main` e os projetos em voo tomam `http-502`. Não faça deploy entre 08:00 e 08:45 BRT.

## Pendências conhecidas

- **`estimateCost` grava custo nominal.** Com claude-cli o custo real é zero, mas o painel ainda mostra o
  número calculado sobre preços de token da OpenAI. Decidir se zera ou remove a coluna.
- **O spawn do claude-cli não tem teste automatizado.** `claudeError` e o caminho sem token têm; o processo
  em si foi validado só pela execução manual acima. O dry-run em produção é o próximo ponto de prova.
- **`cache_creation` de ~33k tokens por chamada** (system prompt do Claude Code). Irrelevante em custo,
  mas conta para o rate limit: 10 chamadas/dia ≈ 330k tokens/dia só de overhead.
- **Reading time é fixo** nos metadados (ledger da Task 2) — decidir se calcula.
