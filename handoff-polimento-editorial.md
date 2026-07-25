# Handoff — Polimento editorial do autopublishing

**Criado: 2026-07-25, 12:30 BRT.** Sessão anterior fechou o gate dos canários; esta trata de **qualidade do
artigo**, não de encanamento.

Leia antes: `handoff-autopublish.md` (como o robô funciona, guardrails, operação da UI).

---

## 1. Onde paramos

O robô publica de ponta a ponta. Gate dos canários **3/3 fechado hoje**:

| Projeto | id | Status | Arquivo | Commit | No ar |
|---|---|---|---|---|---|
| `context` | 8 | updated | `apps/web/content/blog/windsurf-memories-explained.mdx` | `41fab23` | 200 |
| `goiania` | 9 | published | `site-goiania/src/pages/guia/como-escolher-fita-adesiva-para-embalagem.astro` | `e3065e0` | 200 |
| `tapepro` | 10 | published | `src/content/blog/fita-hot-melt-ou-fita-acrilica.mdx` | `0bb1e08` | 200 |

Run: <https://github.com/JeanZorzetti/roihub/actions/runs/30157273741> · modelo `claude-cli:sonnet` nos três.

**Kill switch global ATIVO e os 3 canários ligados.** O cron roda de novo amanhã às **08:17 BRT** (mudou de
08:00 porque na hora cheia o `schedule` do Actions não criou o run). Ou seja: **sem intervenção, amanhã
saem mais 3 artigos no padrão atual.** Decidir logo se pausa até o polimento sair.

---

## 2. O problema

Os artigos novos não seguem o padrão dos antigos escritos à mão. Comparei um a um contra o artigo mais
parecido de cada repo:

| Projeto | Novo | Referência antiga |
|---|---|---|
| `context` | `windsurf-memories-explained.mdx` | `ai-agent-memory-short-term-vs-long-term.mdx` |
| `goiania` | `como-escolher-fita-adesiva-para-embalagem.astro` | `porcelanato-ou-ceramica.astro` |
| `tapepro` | `fita-hot-melt-ou-fita-acrilica.mdx` | `fita-gomada-ou-fita-bopp.mdx` |

Medindo `context` novo × antigo: **1120 palavras vs 1467 · 0 negritos vs 56 · 0 tabelas vs 6 · 8 itens de
lista vs 29 · 0 H3 vs 5**. Não é opinião de estilo: o artigo novo é prosa corrida sem hierarquia nem
elemento escaneável.

---

## 3. Divergências — causa no renderizador (fix determinístico)

Todas em `lib/autopublish-render.mjs`. São as mais baratas e as que mais pesam.

| # | Sintoma | Evidência | Onde |
|---|---|---|---|
| 1 | **Seção em inglês num site pt-BR**: `<h2>Sources</h2>` e `<h2>Frequently asked questions</h2>` no guia do goiânia | grep no arquivo publicado | `:213` e `:242` — string fixa, ignora `project.language` (o caminho mdx pt-BR usa "Fontes"/"Perguntas frequentes" em `:196`/`:199`) |
| 2 | **Zero structured data** no guia novo | antigo monta `jsonLdNodes` com Article + FAQPage + Breadcrumb; novo não emite nada | renderizador `astro` |
| 3 | **`descricao` cortada no meio da frase** ("…Veja como escolher a cola certa ") | frontmatter do tapepro | `:181` — `slice(0, 160)` cru, sem cortar em palavra |
| 4 | **`readingTime: 7` fixo** em todo artigo mdx | `:151` | literal hardcoded |
| 5 | **`tempoLeituraMin` subestimado** (3 min para 941 palavras) | tapepro | `:174` — conta só `bluf` + seções, ignora FAQ e fontes |
| 6 | **`keywords` poluído com slug de artigo** (`cursor-vs-windsurf`, `best-ai-coding-agents-2026`) | frontmatter do context; o antigo só tem frases de busca | `:114` e `:147` — `unique([primaryKeyword, ...relatedSlugs])` |
| 7 | **`cluster` virou slug** (`ai-agent-memory`) onde o antigo tem título (`Context Rot & AI Agent Memory`) | context | valor vem do modelo, normalizar no render |
| 8 | **`heroImage.searchTerm` = keyword** | context | `:158` — deveria ser o `imageScene` novo |
| 9 | **`resumo` repetido literalmente como 1º parágrafo** do corpo | tapepro | `:183` (frontmatter) + `:190` (corpo) emitem o mesmo `bluf` |
| 10 | **`produtosRelacionados` e `segmentosRelacionados` ausentes** → artigo sem link para produto nem segmento | tapepro antigo tem os dois | `:170-172` assume enum fechado e desiste |
| 11 | **`cenaImagem` não é gravado** no frontmatter do tapepro | o antigo tem, com descrição visual longa | o campo `imageScene` já existe no draft desde hoje, só não é escrito |

### 3b. Integração — o guia novo é uma página órfã

`site-goiania/src/data/guias.ts` **não tem entrada** para `como-escolher-fita-adesiva-para-embalagem`
(`grep -c fita-adesiva` = 0). Consequência: não aparece no índice do guia, não recebe link interno e não
entra no breadcrumb. O renderizador `astro` não mexe em registry — só `typescript-post` tem `registryPath`.
Sem isso o artigo nasce sem nenhuma entrada de crawl a não ser o sitemap.

---

## 4. Divergências — causa no prompt (fix de instrução)

| # | Sintoma | Evidência |
|---|---|---|
| 12 | **Título sem a keyword.** `titulo: "Duas colas, um mesmo filme"` — bonito e invisível na busca. O padrão da casa é `"Fita gomada ou fita BOPP: qual usar em cada caixa"` | tapepro |
| 13 | **1º H2 repete o título** (`## Duas colas, um mesmo filme` logo abaixo do h1 idêntico) | tapepro |
| 14 | **Nenhum negrito** em nenhum dos três. Os antigos marcam o termo-chave de cada parágrafo | os 3 |
| 15 | **Nenhuma tabela comparativa.** Em artigo "X ou Y" o antigo sempre tem uma; o novo escreve a comparação em prosa ("Acrílica: cola à base de água, custo menor, …") | tapepro, goiania |
| 16 | **Sem H3 dentro de H2** (só no bloco de FAQ). O antigo aninha `### BOPP: velocidade e custo` sob o H2 | os 3 |
| 17 | **Seções rasas**: 2 parágrafos por H2, contra 4–6 dos antigos | os 3 |
| 18 | **Links externos dofollow para concorrente direto** na seção de fontes (mnplast, supplypack — vendem fita) | goiania |

O prompt está em `lib/autopublish-clients.ts`, função `researchAndDraft`. Hoje ele exige BLUF de 40–60
palavras e fontes reais, e não diz **nada** sobre título, tabela, ênfase, profundidade de seção ou hierarquia.

---

## 5. Imagem — parcialmente resolvido hoje

O campo `imageScene` entrou hoje e **funcionou no `context`**: a busca deixou de ser a keyword ("windsurf"
→ veleiro) e virou `laptop and coffee cup on desk` → foto de mesa com notebook. Mas:

- **`tapepro` recebeu foto de comida** — alt `"a table with two different types of food"`. A cena gerada
  provavelmente foi genérica demais ("two different types…"), e o 1º resultado do Unsplash ganhou.
- **O `alt` é o alt do Unsplash, em inglês, em site pt-BR** ("person holding cardboard box on table" no
  goiânia). Os artigos antigos têm alt descritivo em português escrito pelo autor.
  Fica em `lib/autopublish-clients.ts`, `pickImage` → `alt: match.alt_description`.

Saída provável: o modelo passar a gerar também o **alt em pt-BR**, e o `imageScene` ganhar regra de
especificidade (substantivo concreto + contexto, proibido termo abstrato ou contável genérico).

---

## 6. Bugs abertos que NÃO são polimento

1. **`verify` fecha em `http-500`.** No run de hoje as três publicações passaram 4 rodadas em `pending` e
   a 5ª voltou `http-500` — com os três artigos **no ar respondendo 200**. O `publish` está certo e o
   `verify` está mentindo. Investigar `phase: "verify"` em `lib/autopublish.ts` e `deploymentState`.
2. **O proxy corta o cliente em ~300s.** O `context` levou 362s (11:43:40 → 11:49:42): o runner recebeu
   `request-failed` e reportou falha, **enquanto o hub terminou e commitou normalmente**. A rota é
   `maxDuration = 900` e o spawn é 600s, mas o proxy do EasyPanel não acompanha. Efeito colateral: linha
   fica `running` órfã por alguns minutos e o log do Actions mente sobre o resultado.
3. **`llm-output` foi dividido hoje** em `llm-cli` / `llm-parse` / `llm-timeout` / `llm-output` — se algo
   falhar de novo, a linha do banco diz qual dos quatro. Nenhum deles apareceu ainda em produção.

---

## 7. Ordem sugerida

1. **Idioma + JSON-LD + registro no `guias.ts`** (itens 1, 2, 3b). O guia do goiânia hoje é uma página
   órfã, sem schema e com título de seção em inglês — é o pior dos três e o de fix mais mecânico.
2. **Frontmatter** (itens 3–11). Tudo string, tudo testável por unidade, sem depender do modelo.
3. **Prompt** (itens 12–18). Mexer por último e num item de cada vez: cada mudança custa um run de ~4 min
   por projeto e o resultado varia entre execuções.
4. **Imagem** (seção 5).

---

## 8. Como testar sem esperar o cron

```bash
# 1. o dia já tem linha? ela BLOQUEIA o retry (beginPublication faz ON CONFLICT DO NOTHING
#    e autopublish.ts:215 devolve a linha existente sem reprocessar)
#    apague SÓ linha sem commit_sha — com sha significa que já escreveu no repo do projeto
delete from seo_publications where run_date='2026-07-25' and commit_sha is null;

# 2. dispara (o input dry_run tem default true; sem -f não publica de verdade)
gh workflow run "SEO autopublish" --ref main -f dry_run=false
gh run watch <id> --exit-status
```

- `dryRun: true` gera o artigo e **para antes** da imagem e do commit — é o modo certo para iterar prompt.
- **Não pushe no roihub durante uma execução**: o auto-deploy derruba o hub no meio e os projetos em voo
  voltam `http-502`.
- Rodar tudo consome quase toda a cota do dia das 3 contas; com os 7 pausados, sobra folga.

---

## 9. O que já está resolvido (não reabrir)

- Modelo e effort fixos: `--model sonnet --effort high` no draft, `--effort low` no classificador YMYL.
  Troca por env var `CLAUDE_MODEL`. A linha do banco grava `claude-cli:sonnet`.
- Busca de capa por `imageScene` em vez da keyword.
- Cron às 08:17 BRT (não use minuto :00 — o Actions engole o run).
- Os quatro códigos de falha do claude-cli.
