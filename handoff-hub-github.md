# Handoff — roihub vira o hub de TODOS os repositórios do GitHub

Data: 2026-07-28
Status: **implementado, testado e buildado localmente**. Falta `GITHUB_TOKEN` no ambiente de
produção (EasyPanel) e a limpeza de `homepage` no GitHub (seção "Pendências").

---

## O que mudou

Antes: a lista de projetos do hub era `data/projects.json`, 10 entradas escritas à mão,
importadas estaticamente por 10 arquivos.

Agora: a lista vem **do GitHub ao vivo** — todo repo vivo com `homepage` preenchida é um
projeto do hub. `data/projects.json` continua existindo, mas só como **curadoria**: receita,
blockers, notas, `acao`/`acaoDesc` e a URL de produção.

Resultado medido no dev server com token real: **67 repos lidos → 37 projetos** (10 curados +
27 repos com homepage) e **31 repos sem site** listados como pendência.

### A decisão que estrutura tudo: a chave é a URL do site, não o repo

Foi verificado antes de escrever código, e contraria a premissa inicial de "1 repo = 1 projeto":

- **Um repo serve vários sites.** O monorepo `JeanZorzetti/roilabs` serve `roilabs.com.br`,
  `goiania.roilabs.com.br` e `tapepro.roilabs.com.br`. Chavear por repo colapsaria goiania e
  roilabs numa linha só.
- **Health check, GSC, crawl stats e autopublishing só sabem trabalhar com domínio de
  produção.** `gsc.ts` faz `new URL(p.url).hostname` e resolve a propriedade do Search Console
  por host.
- **A `homepage` que já estava no GitHub está errada para o hub.** Os 24 repos que tinham o
  campo preenchido apontavam todos para `*.vercel.app` (`sirius` → `sirius-ebon.vercel.app`,
  não `siriuscrm.com.br`). Ler o campo cru teria quebrado os 10 projetos que funcionavam.

Por isso: **URL curada sempre vence a `homepage`**, e cada entrada de `projects.json` ganhou um
campo `repo` apontando o repositório dela.

| slug | repo |
|---|---|
| goiania | roilabs |
| sirius | sirius |
| fabrica | estetia-demo |
| roilabs | roilabs |
| polarisia | sofia-ia |
| estetiacrm | estetia |
| reviewshield | review-dispute |
| context | context-keeper |
| aftercare | aftercare-nimblabs |
| nimblabs | nimblabs |

---

## Arquivos

**Novos**

- `lib/projects.mjs` — lógica pura, testada: `mergeProjects()`, `reposSemSite()`,
  `normalizeSite()`. Sem IO, no padrão dos outros `.mjs` da casa.
- `lib/github.ts` — `listRepos()` (`/user/repos?affiliation=owner`, paginado, cache de 10 min
  em memória) e `githubStatus()` para o rodapé. Falha nunca derruba o hub: sem token ou com a
  API fora devolve `[]`/cache vencido e a lista cai só na curadoria.
- `lib/projects.ts` — `listProjects()`, ponto único de entrada. **Nenhum outro arquivo importa
  `data/projects.json` direto** — era assim que abas divergiam do ranking.
- `test/projects.test.mjs` — 7 casos, incluído no `npm test`.

**Alterados**

`lib/evaluate.ts`, `app/page.tsx`, `app/tabs.tsx`, `app/seo/page.tsx`, `app/seo/actions.ts`,
`app/seo/publications.tsx`, `app/agenda/page.tsx`, `app/agenda/actions.ts`,
`app/agenda/edit-task.tsx`, `app/infra/page.tsx`, `app/insights/page.tsx`, `app/globals.css`,
`data/projects.json`, `package.json`.

---

## Regras de comportamento

- **Repo sem curadoria** entra com todos os critérios em 0, pill `SEM CURADORIA` no ranking e
  ação `"Curar <repo> — sem receita, blockers nem ação em data/projects.json"`. Empate de score
  desempata a favor do curado: repo novo nunca rouba o foco do dia.
- **Repo sem `homepage`** não vira projeto (não há site pra medir) — vai para o `<details>`
  "N repos ainda sem site" na home, cada um com o `gh repo edit … --homepage …` pronto.
- **Repo arquivado** é ignorado.
- **Homepage repetindo host de projeto curado** não duplica linha (compara host sem `www.`).
- **Agenda**: só ação de projeto curado vira item do dia — 27 "curar X" afogariam a lista.
- **Insights/Infra**: repo sem curadoria e sem insight fica fora (não há o que diagnosticar, e
  repo novo não tem propriedade no GSC pra cobrar export de crawl).

## Bugs corrigidos no caminho

1. **`{...UNCURATED}` compartilhava `blockersLista`** entre todos os repos novos (mesma
   referência de array; `evaluate()` concatena flags do insights nela). Pego pelo teste
   "UNCURATED não vaza"; virou a função `uncurated()`.
2. **Pré-existente — o botão Pausar/Ativar do `tapepro` era rejeitado em silêncio.** Os
   controles de `/seo` renderizam `PROJECTS` (autopublish), mas `app/seo/actions.ts` validava o
   slug contra `projects.json`, que tem `nimblabs` e não tem `tapepro` →
   `parseProjectStateFields` devolvia `null` e a server action retornava sem fazer nada. Agora
   valida contra `PROJECTS`, que é o que o formulário de fato renderiza.

---

## Verificação feita

- `npm test` → **128/128** (7 novos).
- `npx tsc --noEmit` → limpo.
- `npm run build` → OK, as 5 rotas seguem `ƒ` (dynamic); nada de fetch do GitHub em build time.
- Dev server com `GITHUB_TOKEN=$(gh auth token)`: `/` `/seo` `/agenda` `/infra` `/insights`
  todas **200**. Home em 2,2–3,0 s (37 health checks + 74 queries GSC por load, em dev).
  Rodapé: "GitHub: conectado — 67 repositórios lidos".
- Contagem fecha exata: 67 repos = 9 nomes reivindicados pela curadoria + 27 com homepage +
  31 sem homepage.

---

## Pendências (nenhuma é de código)

1. **`GITHUB_TOKEN` no ambiente de produção do roihub (EasyPanel).** A env já existe no
   `.env.example` e é usada pelo autopublishing; confirmar que está no ambiente do *site*, não
   só no do cron. Sem ela o hub roda igual a antes (só os 10 curados) e o rodapé diz
   "GitHub: desligado". Escopo necessário: `repo` (para enxergar os privados).
2. **Os 24 `homepage` que apontam pra `*.vercel.app`.** Não quebram nada hoje (a URL curada
   vence nos 10, e os outros 27 não têm domínio próprio mesmo), mas enquanto apontarem pra
   preview o health check e o GSC medem o host errado. Corrigir com
   `gh repo edit JeanZorzetti/<repo> --homepage https://<domínio-real>/`.
3. **`Atma` e `repo-de-teste` aparecem como projetos reais** — têm `homepage` de preview e não
   estão arquivados no GitHub. `Atma` está aposentado (ver o plano de crawl). Arquivar o repo
   ou limpar a `homepage` tira os dois do ranking sem tocar em código.
4. **`qprime.roilabs.com.br` e `tapepro.roilabs.com.br` estão verificados no GSC mas não são
   projetos do hub.** `qprime` é um repo sem `homepage`; `tapepro` não tem repo próprio (mora
   no monorepo `roilabs`). São dois sites no ar sem medição — `tapepro` precisa de entrada
   própria em `projects.json` com `"repo": "roilabs"`, `qprime` só de uma `homepage`.
5. **Os 31 repos sem site.** A lista com o comando pronto está na home. Cada `homepage`
   preenchida faz o repo entrar no ranking no próximo load (cache de 10 min, sem redeploy).
