<!--
SYNC IMPACT REPORT
==================
Version change: TEMPLATE (unfilled) -> 1.0.0
Bump rationale: primeira ratificacao. Template com placeholders substituido por principios
concretos derivados de CLAUDE.md, README.md e package.json.

Principios definidos (todos novos):
- [PRINCIPLE_1_NAME] -> I. Contrato unico de dados
- [PRINCIPLE_2_NAME] -> II. Teste e `node --test`, registrado a mao (NAO-NEGOCIAVEL)
- [PRINCIPLE_3_NAME] -> III. `.mjs` para logica pura, `.ts` so na borda
- [PRINCIPLE_4_NAME] -> IV. Push e deploy - a janela noturna e intocavel
- [PRINCIPLE_5_NAME] -> V. Ambiente explicito, segredo nunca em log

Secoes renomeadas:
- [SECTION_2_NAME] -> Restricoes Tecnicas
- [SECTION_3_NAME] -> Fluxo de Desenvolvimento e Portoes de Qualidade

Adicionadas: nenhuma alem das acima.
Removidas: nenhuma.

Templates verificados:
- .specify/templates/plan-template.md OK (Constitution Check e generico - "Gates determined
  based on constitution file"; os gates concretos entram no plan de cada feature)
- .specify/templates/spec-template.md OK (sem secao obrigatoria adicionada ou removida)
- .specify/templates/tasks-template.md OK (categorias ja cobrem teste e polish; registro no
  package.json e gate do Principio II, cobrado no plan/tasks da feature)
- .claude/skills/speckit-*/SKILL.md OK (sem referencias agent-specific desatualizadas)
- README.md OK / CLAUDE.md OK (fonte dos principios; sem contradicao introduzida)

Follow-up TODOs: nenhum. Sem placeholders remanescentes.
-->

# ROI Hub Constitution

## Core Principles

### I. Contrato único de dados

`lib/projects.ts` (`listProjects()`) é o **único** ponto de leitura dos projetos. Nenhuma
página, rota ou componente PODE importar `data/projects.json` diretamente. `listProjects()`
mescla a curadoria manual do JSON com os repositórios vindos da API do GitHub; importar o
JSON direto entrega uma lista sem os repos e quebra a aba silenciosamente — o erro não
aparece em build nem em teste, só em produção.

Qualquer nova fonte de dados de projeto DEVE ser incorporada dentro desse contrato, não ao
lado dele.

### II. Teste é `node --test`, registrado à mão (NÃO-NEGOCIÁVEL)

O projeto NÃO usa jest, vitest ou qualquer framework de teste. Testes são arquivos
`test/*.test.mjs` usando `node:test` e `assert/strict`. Instalar um framework de teste é
proibido.

`npm test` roda a **lista explícita** declarada em `package.json`. Todo arquivo de teste novo
DEVE ser adicionado a essa lista no mesmo commit que o cria — teste fora da lista nunca roda
e portanto não reprova nada. `test/validade.test.mjs` compara a lista com o diretório nos
dois sentidos e falha quando divergem; ele mora num arquivo já registrado de propósito.

A suíte inteira roda em ~1,6 s. Não há desculpa para entregar com ela vermelha.

### III. `.mjs` para lógica pura, `.ts` só na borda

A separação de extensões é deliberada, não histórica. Lógica pura e testável mora em `.mjs`
(`lib/score.mjs`, `lib/projects.mjs`, `lib/crawl.mjs`, `lib/estado-noturno.mjs`,
`lib/telemetria.mjs`...) para ser importada tanto pelo Next quanto pelo `node --test` sem
passo de transpilação. Somente código que toca o Next (rotas, componentes, server actions)
ou o driver de banco é `.ts`.

Regra prática: se a função pode ser testada sem subir o Next, ela DEVE nascer em `.mjs`.
Mover lógica testável para `.ts` é regressão — ela deixa de ser coberta.

### IV. Push é deploy — a janela noturna é intocável

`main` faz auto-deploy por push no EasyPanel (Docker, `output: "standalone"`). Não é Vercel;
qualquer diagnóstico baseado em Vercel é ruído.

Um push reinicia o container e mata o que estiver rodando. Portanto NÃO se dá push nestas
janelas:

- **23:30-01:00 BRT** — estado noturno às 23:37 BRT (`37 2 * * *` UTC, até ~10 min) e
  autopublishing às 00:13 BRT (`13 3 * * *` UTC). A ordem entre os dois é deliberada.
- **08:00-08:45 BRT** — janela do cron diário do autopublishing.

Uma execução de autopublishing percorre os dez projetos em série (~40 min). Um deploy no meio
devolve `http-502` aos projetos em andamento. Mudança que altere `maxDuration` da rota exige
o ajuste correspondente no proxy do EasyPanel, senão o cron recebe `http-504` antes do fim.

### V. Ambiente explícito, segredo nunca em log

Rota que depende de ambiente DEVE validar as variáveis na entrada e interromper com `503`
quando qualquer uma estiver ausente, vazia ou só com espaços. A resposta contém **apenas os
nomes** das variáveis faltantes — nunca valores, nunca prefixos, nunca comprimentos.

`CRON_SECRET`, `HUB_CRON_SECRET` e os tokens do pool `CLAUDE_CODE_OAUTH_TOKENS` NUNCA são
registrados em log, mensagem de erro ou resposta HTTP. Somente o token da vez entra no
ambiente do processo filho.

Ao depurar erro de API, deploy ou banco: ler os `.env` **antes** de olhar o código. Valores
reais nunca entram em `.env.example`.

## Restrições Técnicas

**Stack fixa**: Next.js 16 (App Router) + React 19 + TypeScript, Node 22. Postgres via `pg`
para a agenda. `google-auth-library` para o Google Search Console. Camada de ML em Python em
`ml/`. Deploy por Docker.

**Motor editorial é o `claude-cli`**, não uma API paga: a imagem instala
`@anthropic-ai/claude-code` e autentica por `CLAUDE_CODE_OAUTH_TOKENS`. O custo marginal por
artigo é zero; o limite é rate limit de assinatura, não crédito. O pool aceita várias contas
separadas por vírgula e rotaciona em `429`/`401`/`403`. Falha de conteúdo (`llm-output`)
**não** rotaciona — o problema é da resposta, não da conta.

**Dev é Windows, produção é Linux/Alpine.** `spawn("claude")` no Windows só acha o binário
com `shell: true` (o CLI é um shim `.cmd`). Esse tratamento já existe no código e NÃO PODE
ser "simplificado".

**Sem linter e sem formatter configurados.** Siga o estilo do arquivo vizinho. Adicionar um
formatter reescreveria o repo inteiro e não está autorizado por esta constituição.

**Comentário explica o porquê**, com o fato medido que motivou a linha (estilo de referência:
`autopublish-clients.ts`). Comentário que narra o que a linha faz é ruído e DEVE ser removido.

## Fluxo de Desenvolvimento e Portões de Qualidade

**Definição de entrega fechada**: `npm test` verde + commit + push, sem perguntar — respeitada
a janela do Princípio IV.

**Portões antes de qualquer merge em `main`**:

1. `npm test` verde (suíte inteira, não só o arquivo tocado).
2. Todo arquivo de teste novo registrado em `package.json` (Princípio II).
3. Nenhum import direto de `data/projects.json` fora de `lib/projects.*` (Princípio I).
4. Nenhum segredo em log, resposta ou mensagem de erro (Princípio V).

**Rollout de mudança no autopublishing** segue a ordem documentada no README: `dry_run=true`
primeiro (dez resumos transitórios, sem linha em `seo_publications`, sem imagem, sem escrita
no GitHub), depois os quatro canários — `goiania` (Astro), `tapepro` (Astro content
collection pt-BR), `sirius` (TypeScript post), `context` (MDX) — validando build, HTTP 200,
canonical, schema, sitemap e atribuição de imagem em cada um. Só então os demais projetos e o
kill switch global ligado. O kill switch global (`*`) permanece **desligado por padrão**.

**Cards da agenda**: vivem em `data/projects.json`, escritos à mão. Sempre valide a premissa
(o campo `Repo:` do card) antes de executar o que ele pede.

## Governance

Esta constituição prevalece sobre qualquer outra prática do repositório. Onde CLAUDE.md,
README.md ou um `plan.md` de feature conflitarem com ela, a constituição vence e o outro
documento DEVE ser corrigido.

**Emenda**: exige (a) edição deste arquivo, (b) bump de versão segundo a política abaixo,
(c) Sync Impact Report atualizado no topo, e (d) propagação para os templates em
`.specify/templates/` afetados, no mesmo commit.

**Versionamento**:

- **MAJOR** — remoção ou redefinição incompatível de princípio ou regra de governança.
- **MINOR** — novo princípio ou seção, ou expansão material de orientação existente.
- **PATCH** — esclarecimento, reformulação ou correção sem mudança semântica.

**Conformidade**: todo `plan.md` de feature preenche o Constitution Check antes da Fase 0 e
o revalida após a Fase 1. Violação justificada vai para a tabela de Complexity Tracking do
plano, com a alternativa mais simples e o motivo da rejeição — nunca omitida. Violação de um
MUST sem justificativa registrada é bloqueante.

Orientação de desenvolvimento em tempo de execução: `CLAUDE.md` (mapa do sistema e fatos
medidos) e `README.md` (operação do autopublishing).

**Version**: 1.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
