# Handoff — corrigir os 3 artigos publicados e ligar os 7 projetos restantes

**Criado: 2026-07-25.** Duas tarefas independentes; a 1 não bloqueia a 2.
Nome do arquivo não é `handoff.md` porque esse já existe no roihub (histórico do hub inteiro).

Leia antes: `handoff-autopublish.md` (como o robô funciona) e `handoff-polimento-editorial.md` (o que foi
corrigido no código em 25/07 — commit `698c6e8`).

**A correção de 25/07 vale só para artigo NOVO.** O renderizador não reescreve o que já está no repo, então
os 3 artigos dos canários continuam exatamente como saíram. É a tarefa 1.

Tudo abaixo foi verificado hoje contra o repo e a prod — cada afirmação vem com o comando que a produziu.

---

## 0. Bloqueador que atravessa as duas tarefas: o `verify` está tentando reverter

**Não ligue mais projeto nem mexa no `http-500` do verify sem ler isto.**

```bash
gh api repos/JeanZorzetti/roilabs/commits/e3065e0/status --jq .state   # pending
gh api repos/JeanZorzetti/tape/commits/0bb1e08/status --jq .state      # pending
gh api repos/JeanZorzetti/context-keeper/commits/41fab23/status --jq .state  # pending
```

Os três repos **não têm commit status nenhum** (EasyPanel não publica status no GitHub). A API devolve
`pending` para sempre. E `verifyPublication` faz:

1. tentativas 1–4 com `pending` → espera;
2. tentativa 5 → `deployment !== "success"` → **`revertPublication`**, motivo `verification:deployment-timeout`.

Ou seja: o robô tentou reverter os 3 artigos. Não reverteu só porque a rota estourou em 500 antes —
nenhum repo tem commit "Revert automated publication":

```bash
gh api "repos/JeanZorzetti/tape/commits?per_page=10" --jq '[.[].commit.message | split("\n")[0]]'
```

**Consequência:** quem "consertar o 500" sem mexer no gate de deployment vai fazer o robô **reverter todo
artigo que publicar**, em todos os projetos ligados. O fix certo é em `lib/autopublish.ts`, `verifyPublication`:
`status = pending` **sem nenhum status registrado** significa "esse repo não tem sinal de deploy", não
"deploy falhou" — nesse caso a verificação real (HTTP 200 + canonical + JSON-LD + sitemap, que já existe
logo abaixo) deve decidir sozinha. Reverter só com `failure`/`error` explícito.

Prioridade: **antes da tarefa 2**. Com 3 projetos um revert indevido é chato; com 10 são 10 artigos por dia.

---

## 1. Corrigir os 3 artigos fora do padrão

Não dá para reprocessar pelo robô: o draft não é persistido (`seo_publications.metadata` guarda só título,
slug, path, fontes e imagem) e o alvo do `update` é decidido pelo modelo a partir do GSC, não é endereçável.
**A correção é edição à mão nos 3 repos**, mirando o que o renderizador novo produziria.

Ordem: goiânia → tapepro → context (impacto decrescente).

> Depois de corrigir, se um dia o robô decidir `update` nessa mesma intenção, ele regenera o arquivo (já com
> as regras novas de prompt) e o polimento manual some. É aceitável — o que não pode sumir é a entrada em
> `guias.ts`, e essa o robô agora escreve sozinho.

### 1.1 `goiania` — pior dos três, é página órfã

`JeanZorzetti/roilabs` → `site-goiania/src/pages/guia/como-escolher-fita-adesiva-para-embalagem.astro`

Verificado hoje:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://goiania.roilabs.com.br/guia/como-escolher-fita-adesiva-para-embalagem/   # 200
gh api "repos/JeanZorzetti/roilabs/contents/site-goiania/src/data/guias.ts?ref=main" -H "Accept: application/vnd.github.raw" | grep -c fita-adesiva  # 0
curl -s https://goiania.roilabs.com.br/sitemap.xml | grep -c como-escolher-fita-adesiva  # 0
```

**Está no ar e não existe para crawler nenhum.** Nem no sitemap, porque `sitemap.xml.ts` também sai de
`guias.ts`. Todo dia parado é crawl perdido.

| # | O que fazer | Onde |
|---|---|---|
| 1 | **Registrar o guia** (destrava sitemap, llms.txt, índice `/guia`, OG dinâmico e link interno) | `site-goiania/src/data/guias.ts` |
| 2 | `<h2>Sources</h2>` → `<h2>Fontes</h2>` e `<h2>Frequently asked questions</h2>` → `<h2>Perguntas frequentes</h2>` | o `.astro` |
| 3 | Adicionar `jsonLdNodes` (Article + FAQPage + BreadcrumbList) e passar para o `<Base>` | o `.astro` |
| 4 | `ogImage={"/open-graph/guia/como-escolher-fita-adesiva-para-embalagem.png"}` — **só existe depois do item 1** | o `.astro` |
| 5 | `alt="person holding cardboard box on table"` → alt em português | o `.astro` |
| 6 | Trocar as 3 fontes: `mnplast`, `supplypack` e `sotiautomacao` **vendem fita e embalagem** — é link dofollow para concorrente direto. Usar norma técnica (ABNT/ASTM D3330), fabricante de insumo ou imprensa de logística | o `.astro` |
| 7 | Editorial: 5 H2 com 1–3 parágrafos cada. Aprofundar para 4–6, marcar o termo decisivo em `<strong>`, quebrar com `<h3>` e **incluir a tabela comparativa BOPP × gomada × dupla face** — hoje a comparação está só em prosa | o `.astro` |

Entrada para o item 1 (o `guiaUpsert` do robô geraria exatamente isto):

```ts
  {
    slug: 'como-escolher-fita-adesiva-para-embalagem',
    titulo: 'Como escolher a fita adesiva certa para cada tipo de embalagem',
    descricao:
      'BOPP, kraft gomada ou dupla face? Espessura, adesivo e fita personalizada para cada tipo de embalagem — e os erros que fazem a caixa abrir no transporte.',
  },
```

Bloco do item 3 (mesma forma que `guideJsonLd()` emite hoje — conferir contra `porcelanato-ou-ceramica.astro`,
que é o padrão da casa):

```ts
const SITE = 'https://goiania.roilabs.com.br';
const canonical = `${SITE}/guia/como-escolher-fita-adesiva-para-embalagem/`;
const jsonLdNodes = [
  { '@type': 'Article', headline: /* título */, description: /* description */, image: /* src da capa */,
    datePublished: '2026-07-25', dateModified: '2026-07-25', inLanguage: 'pt-BR',
    author: { '@type': 'Organization', name: 'Equipe ROI Labs' }, mainEntityOfPage: canonical },
  { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
  { '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
    { '@type': 'ListItem', position: 2, name: 'Guias de decisão', item: `${SITE}/guia/` },
    { '@type': 'ListItem', position: 3, name: /* título */, item: canonical },
  ] },
];
```

Verificar depois do push: `curl -s .../sitemap.xml | grep -c fita-adesiva` = 1, a URL aparece em
`https://goiania.roilabs.com.br/guia/`, e o Rich Results Test aceita FAQPage e BreadcrumbList.

### 1.2 `tapepro` — título invisível na busca e capa errada

`JeanZorzetti/tape` → `src/content/blog/fita-hot-melt-ou-fita-acrilica.mdx`

| # | Está assim | Deve ficar |
|---|---|---|
| 1 | `titulo`/`h1`: **"Duas colas, um mesmo filme"** — bonito e sem keyword | `"Fita hot melt ou fita acrílica: qual usar em cada caixa"` (padrão do `fita-gomada-ou-fita-bopp.mdx`) |
| 2 | `descricao` cortada no meio: `"…Veja como escolher a cola certa "` | frase inteira, ≤ 160 |
| 3 | `imagemAlt`: `"a table with two different types of food"` | **a capa é foto de comida** — regerar (abaixo) e escrever alt em pt-BR |
| 4 | `tempoLeituraMin: 3` para ~941 palavras | ~5 |
| 5 | sem `cenaImagem`, `produtosRelacionados`, `segmentosRelacionados` | preencher — sem eles o post não linka produto nem segmento |
| 6 | 1º H2 repete o título | renomear (ex.: "O filme é o mesmo; a cola não") |
| 7 | 1º parágrafo do corpo repete o `resumo` literal | apagar o parágrafo — o layout já imprime `resumo` acima (`src/pages/blog/[slug].astro:76`) |
| 8 | comparação em prosa, sem negrito e sem H3 | tabela acrílica × hot melt + `**negrito**` no termo decisivo + `###` por seção |

Capa (pipeline do próprio repo, é manual de propósito):

```bash
cd "ROI Labs/Tapepro"
# 1. escreva cenaImagem no frontmatter, depois:
node scripts/prompt-imagem-post.mjs fita-hot-melt-ou-fita-acrilica   # imprime o prompt do Gemini
# 2. gere no Gemini, salve, e normalize (corte o watermark ✦ na mão):
node scripts/normalizar-imagem-post.mjs <origem> src/assets/conteudo/fita-hot-melt-ou-fita-acrilica.jpg
```

Cena boa é substantivo concreto + contexto, sem termo contável genérico — foi o `"two different types…"`
que trouxe a comida. Ver `cenaImagem` do `fita-gomada-ou-fita-bopp.mdx` como modelo.

Ao terminar, `atualizadoEm: 2026-07-XX` no frontmatter e `pnpm build` (ou o build do EasyPanel) para provar
que o zod aceitou os campos novos.

### 1.3 `context` — frontmatter poluído

`JeanZorzetti/context-keeper` → `apps/web/content/blog/windsurf-memories-explained.mdx`

| # | Está assim | Deve ficar |
|---|---|---|
| 1 | `keywords` com 5 **slugs de artigo** (`cursor-vs-windsurf`, `best-ai-coding-agents-2026`…) | 3–5 frases de busca reais, como no `ai-agent-memory-short-term-vs-long-term.mdx` |
| 2 | `cluster: "ai-agent-memory"` (slug) | `"Context Rot & AI Agent Memory"` (o cluster que já existe no repo) |
| 3 | `readingTime: 7` fixo | real (~6 para 1120 palavras) |
| 4 | `searchTerm: "windsurf memory"` | `"laptop and coffee cup on desk"` — a cena que de fato buscou a foto (está na URL da capa) |
| 5 | corpo: 0 negrito, 0 tabela, 0 H3, 8 itens de lista contra 29 do artigo de referência | aprofundar seções, negrito no termo-chave, tabela comparando Windsurf Memories × Devin Local × CLAUDE.md/AGENTS.md, `###` dentro dos H2 |

O `alt` em inglês aqui **está certo** (site en-US) — não mexer.

---

## 2. Ligar os 7 projetos restantes

Hoje ligados: `goiania`, `tapepro`, `context`. Pausados: `sirius`, `fabrica`, `roilabs`, `polarisia`,
`estetiacrm`, `reviewshield`, `aftercare`.

### 2.1 Pré-voo — já rodado hoje, contra os repos reais

| projeto | renderizador | contentPath | registry | veredicto |
|---|---|---|---|---|
| `sirius` | typescript-post | 47 arquivos | existe · `registryUpsert` OK | pronto |
| `fabrica` | typescript-post | 22 | existe · `registryUpsert` OK | pronto |
| `estetiacrm` | typescript-post | 42 | existe · `registryUpsert` OK | pronto |
| `roilabs` | markdown | 10 | — | pronto |
| `polarisia` | mdx | 92 | — | pronto, mas é o mais lento |
| `reviewshield` | mdx | 77 | — | pronto, mas é lento |
| `aftercare` | mdx | 69 | — | pronto no encanamento, **gate YMYL** na frente |

O `registryUpsert` é exigente (só aceita `import { post as X } from './posts/slug'` + `export const
blogPosts: BlogPost[] = [...]` com aliases batendo 1:1) e falha fechado em `render:registry-format` antes de
qualquer pesquisa — por isso foi testado contra o arquivo real dos 3. Se alguém mexer no `index.ts` desses
repos, rodar o pré-voo de novo.

### 2.2 O que de fato limita

1. **Rate limit é o teto, não o código.** No dry-run completo dos 10, as 3 contas esgotaram **no 9º
   projeto**. A ordem em `PROJECTS` é fixa → são sempre os mesmos que perdem, e hoje `aftercare` é o último.
   Ligar tudo de uma vez = os últimos da fila falham com `llm-rate` todo dia.
2. **`aftercare` é `ymyl-restricted`.** O gate exige classificação `operational` **e** que todo bloco do
   texto passe no escopo operacional **e** nenhuma palavra clínica. Espere `draft:ymyl` com frequência —
   não é bug.
3. **Inventário grande = run lento.** `polarisia` (92), `reviewshield` (77) e `aftercare` (69) mandam um
   inventário maior no prompt e fazem uma chamada de blob por arquivo na leitura do repo. São os mais
   propensos a bater no corte de ~300s do proxy (bug 2 do `handoff-polimento-editorial.md`): o Actions
   reporta `request-failed` **enquanto o hub termina e commita normalmente**. Confira o repo antes de
   acreditar no log.
4. **Cada projeto novo é canário do próprio renderizador.** Só três foram provados em produção: `mdx`
   (context), `astro` (goiania) e `astro-content-ptbr` (tapepro). Faltam provar `typescript-post` (3
   projetos), `markdown` (roilabs) e os schemas `polarisia`/`reviewshield`/`aftercare` do mdx. Se o
   frontmatter não satisfizer o schema do repo alvo, **o build do site quebra** — e a rede de proteção é
   justamente o `verify`, que hoje está quebrado (seção 0).
5. **GSC é barato de testar.** `gscQueryPages(..., {strict:true})` roda em paralelo com a leitura do repo e
   **antes** da chamada ao modelo: projeto sem propriedade acessível falha em `gsc-unavailable` sem gastar
   cota nenhuma. Não precisa auditar GSC antes — ligar já é o teste.

### 2.3 Rollout sugerido: 2 por dia, na ordem do risco

Pré-requisito: seção 0 resolvida.

| dia | ligar | por quê nessa ordem |
|---|---|---|
| 1 | `sirius`, `roilabs` | estreiam `typescript-post` e `markdown`, os dois renderizadores nunca rodados em prod; repos pequenos, run rápido |
| 2 | `estetiacrm`, `fabrica` | mesmo renderizador do sirius já validado no dia 1 |
| 3 | `polarisia`, `reviewshield` | inventário grande: quer a fila com folga |
| 4 | `aftercare` | YMYL; é o último da fila e o primeiro a perder cota |

A cada dia, no dia seguinte ao ligar: `/seo` → status da linha do projeto + build do site alvo verde + URL
respondendo 200. Se der `llm-rate` em algum, pare de ligar e resolva a cota antes (somar conta ou baixar a
cadência) — **não adianta ligar mais projeto do que cabe no limite das 3 contas.**

Melhoria barata que vale considerar junto: **rotacionar a ordem de `PROJECT_SLUGS` por `runDate`**
(`scripts/run-autopublish.mjs`) para o mesmo projeto não ser sempre o que fica sem cota. Hoje o prejuízo é
sempre do `aftercare`.

### 2.4 Como ligar

UI (preferido): `hub.roilabs.com.br/seo` → **Sala de Controle Editorial**. O botão mostra **a ação**, não o
estado (`ATIVO` + "Pausar" = está ligado). O **Motivo** só grava ao pausar. O kill switch global manda em
tudo — `global E projeto`.

SQL, se a UI estiver fora:

```sql
update seo_projects set enabled = true, paused_reason = null where project_slug = 'sirius';
select project_slug, enabled, paused_reason from seo_projects order by 1;
```

`enabled` é relido **imediatamente antes do commit**, então pausar no meio de uma execução ainda pega: o
artigo é descartado antes de escrever no repo.

---

## 3. Como testar sem esperar o cron

```bash
# linha do dia BLOQUEIA o retry (ON CONFLICT DO NOTHING). Apague SÓ linha sem commit_sha —
# com sha significa que já escreveu no repo do projeto.
delete from seo_publications where run_date='2026-07-25' and commit_sha is null;

gh workflow run "SEO autopublish" --ref main -f dry_run=false
gh run watch <id> --exit-status
```

- `dryRun: true` gera o artigo e para antes da imagem e do commit — modo certo para iterar prompt.
- **Não pushe no roihub durante uma execução**: o auto-deploy derruba o hub no meio e os projetos em voo
  voltam `http-502`.
- Disparo de um projeto só, sem mexer no workflow:

```bash
curl -s -X POST -H "authorization: Bearer $CRON_SECRET" -H "content-type: application/json" \
  -d '{"phase":"publish","project":"sirius","runDate":"2026-07-26","dryRun":true}' \
  --max-time 900 https://hub.roilabs.com.br/api/seo/autopublish
```

---

## 4. Fechamento

- Tarefa 1 fecha quando os 3 artigos estiverem no padrão **e** o guia do goiânia aparecer no sitemap.
- Tarefa 2 fecha quando os 10 estiverem ligados e um run inteiro terminar sem `llm-rate` — ou, se não
  couber na cota, com a decisão explícita de quantos por dia cabem.
- Atualizar o card do roihub em `data/projects.json` ao fechar cada uma (o card é texto à mão; quem fecha
  entrega atualiza).
