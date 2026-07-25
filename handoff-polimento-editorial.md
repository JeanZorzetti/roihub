# Handoff — Polimento editorial do autopublishing

**Criado: 2026-07-25, 12:30 BRT. Atualizado: 2026-07-25, sessão do polimento.**
Trata de **qualidade do artigo**, não de encanamento.

Leia antes: `handoff-autopublish.md` (como o robô funciona, guardrails, operação da UI).

---

## 1. Onde paramos

O robô publica de ponta a ponta. Gate dos canários **3/3 fechado em 25/07**:

| Projeto | id | Status | Arquivo | Commit | No ar |
|---|---|---|---|---|---|
| `context` | 8 | updated | `apps/web/content/blog/windsurf-memories-explained.mdx` | `41fab23` | 200 |
| `goiania` | 9 | published | `site-goiania/src/pages/guia/como-escolher-fita-adesiva-para-embalagem.astro` | `e3065e0` | 200 |
| `tapepro` | 10 | published | `src/content/blog/fita-hot-melt-ou-fita-acrilica.mdx` | `0bb1e08` | 200 |

Run: <https://github.com/JeanZorzetti/roihub/actions/runs/30157273741> · modelo `claude-cli:sonnet` nos três.

**Kill switch global ATIVO e os 3 canários ligados.** O cron roda às **08:17 BRT** (mudou de 08:00 porque
na hora cheia o `schedule` do Actions não criou o run).

**Os 18 itens abaixo estão corrigidos em código** (`npm test` = 114 verdes, `tsc --noEmit` limpo). Os itens
1–11 e 3b são determinísticos e valem já no próximo run. Os 12–18 e a imagem dependem do modelo obedecer ao
prompt: **só o run de 26/07 diz se pegou**.

---

## 2. O problema (medição original)

Os artigos novos não seguiam o padrão dos escritos à mão. Comparação um a um:

| Projeto | Novo | Referência antiga |
|---|---|---|
| `context` | `windsurf-memories-explained.mdx` | `ai-agent-memory-short-term-vs-long-term.mdx` |
| `goiania` | `como-escolher-fita-adesiva-para-embalagem.astro` | `porcelanato-ou-ceramica.astro` |
| `tapepro` | `fita-hot-melt-ou-fita-acrilica.mdx` | `fita-gomada-ou-fita-bopp.mdx` |

Medindo `context` novo × antigo: **1120 palavras vs 1467 · 0 negritos vs 56 · 0 tabelas vs 6 · 8 itens de
lista vs 29 · 0 H3 vs 5**. Prosa corrida sem hierarquia nem elemento escaneável.

---

## 3. Divergências de renderizador — CORRIGIDAS

Tudo em `lib/autopublish-render.mjs`, salvo indicação.

| # | Sintoma | Fix |
|---|---|---|
| 1 | `<h2>Sources</h2>` e `<h2>Frequently asked questions</h2>` em site pt-BR | `LABELS` por `project.language`, aplicado em `markdownBody` e `htmlBody` — pegava markdown, mdx e astro de uma vez (o roilabs e o polarisia, pt-BR, tinham o mesmo bug e ninguém tinha notado) |
| 2 | Zero structured data no guia do goiânia | `guideJsonLd()` emite Article + FAQPage + BreadcrumbList em `jsonLdNodes`, que o `Base.astro` funde no `@graph`. O guia também passa a declarar `ogImage` |
| 3 | `descricao` cortada no meio da frase | `clamp()` corta na última palavra inteira e fecha com reticências, sempre ≤ 160 |
| 4 | `readingTime: 7` fixo | `readingMinutes(draft)` |
| 5 | `tempoLeituraMin` subestimado | mesmo `readingMinutes`, agora contando FAQ e fontes |
| 6 | `keywords` com slug de artigo | `unique([primaryKeyword, clusterLabel])` — `relatedSlugs` saiu |
| 7 | `cluster` virou slug (`ai-agent-memory`) | `clusterLabel()` normaliza slug → título. `clusterId` do catálogo nimblabs continua cru (é id, não rótulo) |
| 8 | `heroImage.searchTerm` = keyword | passa a ser `imageScene` |
| 9 | `resumo` repetido como 1º parágrafo | o bluf saiu do corpo do tapepro — o layout já imprime `resumo` acima |
| 10 | `produtosRelacionados`/`segmentosRelacionados` vazios | `mentioned()` casa o texto do artigo com a taxonomia declarada em `autopublish-projects.mjs`; sem menção, entra o catálogo inteiro |
| 11 | `cenaImagem` não gravado | escrito quando o draft traz `imageScene` |

### 3b. Registro do guia — CORRIGIDO

`goiania` ganhou `registryPath: "site-goiania/src/data/guias.ts"` e `guiaUpsert()` insere/atualiza a entrada
`{ slug, titulo, descricao }`. Sem isso o guia ficava **fora do sitemap, do llms.txt, do índice `/guia`, do
OG dinâmico e de todo link interno** — pior do que o handoff original supunha: `sitemap.xml.ts` também sai
de `guias.ts`, então nem o sitemap tinha o artigo.

⚠️ **`produtos`/`segmentos` do tapepro são cópia do repo** (`src/lib/produtos.ts` é enum fechado no zod:
valor inventado quebra o build inteiro). Catálogo mudou lá? Atualizar `autopublish-projects.mjs` junto.

---

## 4. Divergências de prompt — CORRIGIDAS, resultado a verificar

Prompt em `lib/autopublish-clients.ts`, `researchAndDraft`. Regras novas:

| # | Sintoma | Regra adicionada |
|---|---|---|
| 12 | Título sem a keyword (`"Duas colas, um mesmo filme"`) | título contém a keyword literal e diz o que o leitor ganha; nada de frase poética |
| 13 | 1º H2 repete o título | nenhum heading pode repetir o título |
| 14 | Nenhum negrito | `**negrito**` no termo decisivo, 1–2 por parágrafo |
| 15 | Nenhuma tabela comparativa | artigo que compara duas opções **precisa** de uma tabela markdown (GFM) |
| 16 | Sem H3 dentro de H2 | parágrafo começando com `### ` vira sub-heading |
| 17 | Seções rasas | 4–6 seções H2, 4–6 parágrafos cada |
| 18 | Fonte dofollow para concorrente | proibido citar concorrente direto; citar norma, fabricante de insumo, imprensa setorial, pesquisa |

**Como isso chega no HTML:** metade dos projetos é `.md`/`.mdx` (markdown nativo, todos com GFM), mas
`goiania`, `sirius`, `fabrica` e `estetiacrm` renderizam HTML. `htmlBlock()` converte negrito, `### `, lista
e tabela markdown em `<strong>`, `<h3>`, `<ul>` e `<table>` — senão o asterisco e o cano apareceriam na tela.

---

## 5. Imagem — CORRIGIDA, resultado a verificar

- `imageAlt` entrou no schema do draft: o modelo escreve o alt **no idioma do artigo**, e `pickImage` só cai
  no `alt_description` do Unsplash se ele faltar. Acabou o `"person holding cardboard box on table"` em
  site pt-BR.
- `imageScene` ganhou regra de especificidade: proibido termo contável genérico — foi o `"two different
  types…"` que trouxe **foto de comida** para o tapepro.

---

## 6. Bugs abertos que NÃO são polimento (continuam abertos)

1. ~~**`verify` fecha em `http-500`.**~~ **RESOLVIDO 25/07 (`ad10da1`).** A causa não era o 500: o gate lia
   `pending` eterno (nenhum repo publica commit status) como deploy falhado e chamava `revertPublication`;
   o 500 era o revert estourando. Agora só `failure`/`error` reverte. Ver `handoff-correcao-e-rollout.md`.
2. **O proxy corta o cliente em ~300s.** O `context` levou 362s: o runner recebeu `request-failed` e reportou
   falha, **enquanto o hub terminou e commitou normalmente**. A rota é `maxDuration = 900` e o spawn é 600s,
   mas o proxy do EasyPanel não acompanha. Efeito: linha fica `running` órfã e o log do Actions mente.
3. **`llm-output` foi dividido** em `llm-cli` / `llm-parse` / `llm-timeout` / `llm-output`. Nenhum apareceu
   ainda em produção.
4. **NOVO 25/07 — o renderizador `mdx` duplica hero image, FAQ e "Related guides"** nos projetos cujo layout
   já renderiza esses três a partir do frontmatter (foi o caso do `context`). Corrigido no artigo, não no
   renderizador: conferir o layout de `polarisia`, `reviewshield` e `aftercare` antes de ligá-los.

---

## 7. O que fazer no próximo run (26/07, 08:17 BRT)

Sem intervenção, saem 3 artigos com todas as mudanças acima. **Verificar, nessa ordem:**

1. `guias.ts` do roilabs recebeu a entrada do guia novo (é o fix de maior impacto e o único que mexe em
   arquivo de outro repo — se `guiaUpsert` falhar, a linha do banco fecha em `render:catalog-format`).
2. O artigo tem tabela, negrito e H3, e o título contém a keyword. Se o modelo ignorar, mexer **num item de
   cada vez** (cada mudança custa ~4 min por projeto e o resultado varia entre execuções).
3. A capa faz sentido e o alt está em português.
4. Só então voltar aos bugs da seção 6.

---

## 8. Como testar sem esperar o cron

```bash
# 1. o dia já tem linha? ela BLOQUEIA o retry (beginPublication faz ON CONFLICT DO NOTHING
#    e autopublish.ts devolve a linha existente sem reprocessar)
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
- Idioma dos rótulos, JSON-LD do guia, registro em `guias.ts`, frontmatter (itens 1–11) — cobertos por teste
  em `test/autopublish.test.mjs` ("Polimento editorial").
