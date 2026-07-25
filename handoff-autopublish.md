# Handoff — SEO Autopublishing (1 artigo/dia por projeto)

**Atualizado: 2026-07-25.** Gate dos canários **fechado, 3/3**. A pauta agora é qualidade do artigo:
ver `handoff-polimento-editorial.md`.

O robô **funciona de ponta a ponta e já publicou 1 artigo real em produção**. O gate dos canários está
1/3. O que falta não é código — é rate limit e validação.

---

## 1. Estado em uma tela

| | |
|---|---|
| Repo | `roihub` · deploy automático a cada push em `main` (EasyPanel) |
| Hub | `hub.roilabs.com.br` no ar, Basic Auth |
| Verificação | `npm test` 109/109 · `npx tsc --noEmit` 0 · `npm run build` 0 |
| **Artigos no ar** | **3** — `context` (`41fab23`), `goiania` (`e3065e0`), `tapepro` (`0bb1e08`), todos HTTP 200 |
| Kill switch global | **ATIVO** |
| Projetos ligados | `goiania`, `tapepro`, `context` (os canários) |
| Projetos pausados | `aftercare`, `estetiacrm`, `fabrica`, `nimblabs`*, `polarisia`, `reviewshield`, `roilabs`, `sirius` |

\* `nimblabs` saiu do código; a linha órfã no banco é inofensiva.

**Com o global ativo, o cron das 08:17 BRT tenta os 3 canários sozinho, todo dia.** O gate já fechou, então
a pergunta agora é outra: enquanto o polimento editorial não sair, cada dia gera 3 artigos no padrão atual.
Pausar ou aceitar é decisão do Jean.

⚠️ O horário era 08:00 e **não rodou em 25/07**: na hora cheia o `schedule` do Actions nem chega a criar o
run. Nunca volte para o minuto `:00`.

---

## 2. Como funciona

`.github/workflows/seo-autopublish.yml` (cron 08:00 BRT) → `scripts/run-autopublish.mjs` → POST
`hub.roilabs.com.br/api/seo/autopublish` com Bearer → `publishProject` faz tudo:

GSC (strict) → lê o repo → inventário → **claude-cli com WebSearch** → guardrails → renderiza → Unsplash →
commit atômico no repo do projeto. Depois uma fase `verify` confere o deploy.

**Motor = claude-cli**, instalado na imagem Docker do hub, autenticado por `CLAUDE_CODE_OAUTH_TOKENS`.
Custo marginal por artigo: zero. Não há OpenAI em lugar nenhum.

### Modelo e effort (decidido 24/07)

```
claude -p --output-format json --model sonnet --effort high  --max-turns 12 --allowedTools WebSearch
claude -p --output-format json --model sonnet --effort low   --max-turns 1     # classificador YMYL
```

**Sonnet 5, effort `high` no draft e `low` no classificador.** O critério não foi custo (com assinatura o
gasto marginal é zero) e sim **cota**: o gargalo é rate limit, e sonnet cabe em mais artigos por dia que
opus. Escrever artigo com pesquisa não é coding agêntico de horizonte longo — `high` basta; `xhigh`/`max`
só queimariam cota. Trocar é uma env var: `CLAUDE_MODEL=opus` (default do código = `sonnet`).

Sem `--model` o CLI usava o default da conta (num teste, `claude-opus-4-8`), que difere entre as 3 contas e
muda quando o CLI atualiza. Agora o banco grava `claude-cli:sonnet` em vez do genérico `claude-cli`.

**Se a qualidade do artigo cair nos canários, subir para `CLAUDE_MODEL=opus` antes de mexer em prompt** —
e nesse caso calibrar tamanho no prompt, porque o Opus 5 escreve deliverables mais longos por padrão.

---

## 3. O que trava: rate limit

Este é o gargalo real, não o código.

Estado medido em 24/07 às ~21h: conta 1 em `429` (reseta 21:40), conta 2 OK (foi desbloqueada durante o
dia), conta 3 OK. A rotação pula conta esgotada (`429`) ou inválida (`401/403`) e só desiste quando todas
falham.

Uma execução dos 10 projetos consome quase toda a capacidade do dia. No dry-run completo, as contas
esgotaram no **9º projeto**. A ordem em `PROJECTS` é fixa, então **são sempre os mesmos que perdem** — hoje
`aftercare` é o último.

Opções: somar mais contas, reduzir a cadência, ou rotacionar a ordem da fila por dia. Nenhuma implementada.

---

## 4. Próximos passos

1. **Fechar o gate dos canários.** Deixar o cron rodar amanhã com as contas descansadas, ou disparar
   manualmente `goiania` e `tapepro`. Validar em cada site: build, HTTP 200, canonical, schema, sitemap,
   atribuição da imagem.
2. **Só depois** ativar os outros 7 pela UI (`/seo` → Sala de Controle Editorial).
3. **Rotacionar os secrets** — `CRON_SECRET`, `GITHUB_TOKEN`, `UNSPLASH_ACCESS_KEY` e os 3
   `CLAUDE_CODE_OAUTH_TOKENS` foram colados em conversa. Ver [[secrets_to_rotate]].

### Disparo manual

```bash
curl -s -X POST -H "authorization: Bearer $CRON_SECRET" -H "content-type: application/json" \
  -d '{"phase":"publish","project":"tapepro","runDate":"2026-07-25","dryRun":true}' \
  --max-time 900 https://hub.roilabs.com.br/api/seo/autopublish
```

`dryRun: true` gera o artigo e **para antes** da imagem e do commit — não escreve nada. Repetir o mesmo
`project + runDate` devolve a linha existente sem reprocessar; para forçar, use outra data ou apague a linha.

---

## 5. Qualidade — capa fora de contexto (corrigido, falta validar em produção)

**O que aconteceu:** o artigo publicado é sobre o IDE Windsurf/Devin e a capa é *"yellow and white sail
boat on sea"* — o Unsplash entendeu windsurf como o esporte. Causa: a busca usava a keyword, e keyword não
é descrição visual.

**Correção:** o draft agora tem um campo `imageScene` obrigatório (cena fotografável, 3–6 palavras em
inglês, sem nome de produto), e é ele que vai para o Unsplash. A keyword só é usada se o modelo não
devolver a cena. O fallback progressivo da seção 6 continua igual, degradando a partir da cena.

**Falta:** conferir na próxima publicação real se a capa combina com o artigo. A capa do `context` já no ar
segue errada — trocar à mão se incomodar.

---

## 6. Gotchas que custaram tempo (não repita)

- **Middleware Edge + API Node = 500 em TODA rota.** `process.getBuiltinModule` sob optional chaining
  **não** protege: o Edge proíbe a API, o erro é na avaliação do módulo, e o middleware roda em todo path.
  Derrubou o hub inteiro. `npm run build` passa e teste em Node passa. Reproduzir só com
  `node .next/standalone/server.js`, nunca `next start`.
- **Fine-grained token: `permissions.push: true` no `GET /repos` NÃO diz que o token escreve** — é a
  permissão do *usuário*. Teste honesto: `POST /git/blobs` (cria objeto solto, não toca em branch).
  Repo fora do escopo devolve **404**, não 403 — daí o código `github-missing`.
- **Unsplash devolve zero para termo long-tail** ("windsurf ai explained"). A busca degrada
  intenção → cluster → 2 primeiras palavras → genérico, senão os artigos de nicho nunca publicam.
- **O modelo escreve prosa antes do JSON** e essa prosa pode ter chave. Recortar do 1º `{` ao último `}`
  quebra; o parser tenta fence primeiro, depois cada `{` como início candidato.
- **GSC devolvendo `[]` fazia toda pauta virar "new"** e duplicaria URL ranqueada. Modo strict: 3
  tentativas e falha fechada.
- **Auto-deploy por push derruba execução em andamento** (`http-502` nos projetos em voo). Não pushe
  entre 08:00 e 08:45 BRT.
- **Quatro listas de projetos já divergiram**: `PROJECTS` (fonte de verdade), o seed do `db.ts`, a UI e
  `data/projects.json`. As três primeiras agora derivam de `PROJECTS` — com testes que falham se alguém
  voltar a hardcodar. `data/projects.json` segue separado (é a agenda) e entra só pelo nome amigável.
- **Tempo por artigo varia muito**: 166s local, 240s (`context`), 366s (`goiania`). Spawn em 600s,
  rota em `maxDuration = 900` — o proxy do EasyPanel precisa acompanhar.

---

## 7. Guardrails (funcionando, não "quebrado")

Bloqueio não é bug. Os observados:

| Código | Significado |
|---|---|
| `decision:uncertain` | o modelo não soube dizer se duplica conteúdo existente e preferiu não publicar (foi o caso do `sirius`) |
| `ymyl` | conteúdo clínico barrado no `aftercare`, que é `ymyl-restricted` e só aceita pauta operacional |
| `decision:duplicate` | a intenção já tem URL canônica |
| `github-conflict` | o SHA mudou durante a escrita; nenhum force push |

Ressalva: se `sirius` e `aftercare` bloquearem todo dia, esses projetos nunca publicam. Vale observar
alguns dias antes de mexer nos guardrails.

---

## 8. Arquivos

| Arquivo | Papel |
|---|---|
| `lib/autopublish-projects.mjs` | **fonte de verdade** dos projetos |
| `lib/autopublish-core.mjs` | guardrails, auth, custo, `missingEnv`. **Importado pelo middleware → é código Edge** |
| `lib/autopublish-clients.ts` | claude-cli, Unsplash, GitHub |
| `lib/autopublish-render.mjs` | os 6 renderizadores |
| `lib/autopublish.ts` | orquestração `publish`/`verify` |
| `app/seo/publications.tsx` | Sala de Controle Editorial |
| `docs/superpowers/plans/2026-07-24-seo-autopublishing.md` | plano original (Tasks 1–8) |

### Renderizadores

`astro` (goiania) · `astro-content-ptbr` (tapepro) · `mdx` (polarisia, reviewshield, context, aftercare) ·
`markdown` (roilabs) · `typescript-post` (sirius, fabrica, estetiacrm) · `typescript-catalog` (órfão desde
que o nimblabs saiu; código e teste unitário mantidos).

**Tapepro é o único que baixa a imagem** em vez de hotlinkar: o schema dele valida `imagem` pelo helper
`image()` do Astro, que não aceita URL externa.

---

## 9. Como operar a UI (`/seo`)

- **Kill switch global** manda em tudo: pausado, nada publica. É o freio de emergência.
- Chave por projeto só vale com o global ativo — a regra é `global E projeto`.
- O botão mostra **a ação**, não o estado: `ATIVO` + "Pausar" desliga.
- O campo **Motivo** só é gravado ao pausar; ao ativar é limpo.
- `enabled` é relido **imediatamente antes** do commit, então pausar durante uma execução ainda pega: o
  artigo é descartado antes de escrever.
