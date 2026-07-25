# Handoff — correção dos 3 artigos e rollout dos 10 projetos

**Criado 2026-07-25. Executado no mesmo dia** — este arquivo agora registra o que foi feito e o que
sobrou. Nome não é `handoff.md` porque esse já existe no roihub (histórico do hub inteiro).

Leia antes: `handoff-autopublish.md` (como o robô funciona) e `handoff-polimento-editorial.md`.

| | |
|---|---|
| Seção 0 (verify revertendo) | ✅ resolvido — `ad10da1` |
| Tarefa 1 (3 artigos) | ✅ os três no padrão, no ar e verificados em produção |
| Tarefa 2 (rollout) | 🟡 **dia 1 de 4 feito** — `sirius` e `roilabs` ligados; faltam 5 projetos |

---

## 0. O verify não reverte mais por falta de sinal de deploy — RESOLVIDO

`lib/autopublish.ts`, `verifyPublication`. Nenhum repo alvo publica commit status (o EasyPanel não
integra com o GitHub), então `GET /commits/{sha}/status` devolve `pending` para sempre — e o gate lia
isso como "deploy falhou", chamando `revertPublication` na 5ª tentativa. Os 3 canários só não foram
revertidos porque a rota estourava em 500 antes (era esse o `http-500` da seção 6 do handoff de
polimento: sintoma, não causa).

Agora **só `failure`/`error` explícito reverte**. Sem sinal de deploy, quem decide é a verificação real
que já existia logo abaixo: HTTP 200 + canonical + JSON-LD + a URL no sitemap. As 4 esperas continuam
(é o tempo de build do site); a diferença é o que acontece na quinta.

Dois testes cobrem: repo sem status com a página no ar **mantém** publicado; página fora do ar na
quinta ainda reverte, agora com razão `verification:http`.

⚠️ **Consequência prática:** a verificação real é exigente com o `metadata.title` gravado no banco —
ela procura esse título no `<title>` e num `<h1>`. Se você **editar o título de um artigo à mão**,
atualize a linha antes de qualquer novo verify daquele mesmo `run_date`:

```sql
update seo_publications
   set metadata = jsonb_set(metadata, '{title}', to_jsonb('Título novo'::text))
 where id = 10;
```

Foi exatamente o caso do tapepro hoje (id 10). Runs de dias seguintes criam linha nova e não correm
esse risco — o verify só roda dentro do run que publicou.

---

## 1. Os 3 artigos — FEITO

Verificado em produção depois do deploy:

| Projeto | Commit | Estado |
|---|---|---|
| `goiania` | `28be435` (roilabs) | registrado, sitemap 1/1, rótulos pt-BR, tabela, JSON-LD completo |
| `tapepro` | `861f992` (tape) | h1 novo no ar, frontmatter completo, `npm test` 59 verdes |
| `context` | `ff67d18` (context-keeper) | cluster correto, sem duplicação, `next build` verde |

### 1.1 `goiania` — era página órfã

Entrada criada em `site-goiania/src/data/guias.ts`; isso destravou sitemap, `llms.txt`, hub `/guia/`,
OG dinâmico e link interno de uma vez. A página foi reescrita no padrão dos guias à mão: hero com
resposta direta, tabela BOPP × kraft gomada × dupla face, seções com `<strong>` e `<h3>`, `Fontes` e
`Perguntas frequentes` em pt-BR, `jsonLdNodes` com Article + FAQPage + BreadcrumbList, alt em
português e links para os 3 SKUs reais de `/fitas/`.

As 3 fontes que apontavam para concorrentes que vendem fita saíram. Entraram ASTM D3330 (norma de
adesão), Henkel (fabricante de adesivo, insumo) e ISTA (associação de ensaio de transporte).

**Bug achado no caminho — o `guiaUpsert` derrubaria o site inteiro.** O hub `/guia/index.astro`
fazia `throw` quando um guia do registro não estava classificado numa etapa da jornada. Como o robô
agora escreve em `guias.ts` sozinho, **todo guia novo quebraria o build do site inteiro**, não só a
própria página. Guia sem etapa agora cai numa etapa de sobra ("Publicados recentemente"). Slug
inexistente ou duplicado continua quebrando, que é erro humano.

> Lição para os outros repos: onde o robô escreve num registro à mão, procure o guard que valida esse
> registro. `registryUpsert` (sirius/fabrica/estetiacrm) é o próximo candidato a ter um desses.

### 1.2 `tapepro`

Título com keyword (`Fita hot melt ou fita acrílica: qual usar em cada caixa`), descrição inteira,
`tempoLeituraMin` real, `cenaImagem`/`produtosRelacionados`/`segmentosRelacionados` preenchidos, 1º H2
sem repetir o título, parágrafo que duplicava o `resumo` removido (o layout já o imprime),
tabela + negrito + H3, e fontes trocadas pelas mesmas três técnicas do goiânia.

⚠️ **Capa: pendência real.** A imagem publicada era um **print de tabela de porções alimentares** —
pior que "foto de comida". O arquivo foi apagado e a capa hoje reusa `fita-comando.jpg` (foto real de
fita BOPP impressa). O `cenaImagem` certo já está no frontmatter; quando quiser a capa própria:

```bash
cd "ROI Labs/Tapepro"
node scripts/prompt-imagem-post.mjs fita-hot-melt-ou-fita-acrilica
node scripts/normalizar-imagem-post.mjs <origem> src/assets/conteudo/fita-hot-melt-ou-fita-acrilica.jpg
# e trocar o campo `imagem:` do mdx de volta
```

### 1.3 `context`

`keywords` viraram frases de busca (eram slugs de artigo), `cluster` virou `"Context Rot & AI Agent
Memory"`, `readingTime` real, `searchTerm` = a cena que de fato buscou a foto. O corpo foi ao padrão
do artigo de referência: `<Tldr>`, 31 negritos, 3 H3, tabela Memories × Devin Local × CLAUDE.md,
`## Key Takeaways` e linha `Related:`.

**Bug de renderizador achado aqui (aberto):** o renderizador `mdx` emite hero image, bloco de FAQ e
lista de "Related guides" **no corpo**, e o layout do context-keeper já renderiza os três a partir do
frontmatter — o artigo saiu com tudo duplicado. Foi corrigido no arquivo, não no renderizador. Antes
de ligar `polarisia`, `reviewshield` e `aftercare` (todos `mdx`), confira o layout de cada um: se ele
também renderiza FAQ/hero do frontmatter, o mesmo artigo duplicado vai sair lá.

---

## 2. Rollout — dia 1 de 4

Ligados hoje: **`sirius` e `roilabs`** (SQL direto, `enabled=true`, `paused_reason=null`).
Estado atual: `goiania`, `tapepro`, `context`, `sirius`, `roilabs` ligados; kill switch global ativo.

| dia | ligar | por quê nessa ordem | estado |
|---|---|---|---|
| 1 | `sirius`, `roilabs` | estreiam `typescript-post` e `markdown`, nunca rodados em prod; repos pequenos | ✅ 25/07 |
| 2 | `estetiacrm`, `fabrica` | mesmo renderizador do sirius, já validado no dia 1 | pendente |
| 3 | `polarisia`, `reviewshield` | inventário grande (92 e 77 arquivos): quer fila com folga | pendente |
| 4 | `aftercare` | YMYL; espere `draft:ymyl` com frequência, não é bug | pendente |

**Antes de ligar a dupla do dia seguinte**, no run das 08:17 BRT: linha do projeto em `/seo`, build do
site alvo verde e URL respondendo 200. Se aparecer `llm-rate`, **pare de ligar** e resolva cota antes
(somar conta ou baixar cadência) — não adianta ligar mais projeto do que cabe nas 3 contas.

### 2.1 Fila rotativa — implementado hoje

`scripts/run-autopublish.mjs` ganhou `projectQueue(runDate)`: a fila gira um projeto por dia, então em
10 dias cada projeto passa por todas as posições. Antes a ordem era fixa e **o último da lista perdia
a cota todo dia** — era sempre o `aftercare`.

### 2.2 O que de fato limita (inalterado)

1. **Rate limit é o teto, não o código.** No dry-run dos 10, as contas esgotaram no 9º projeto.
2. **`aftercare` é `ymyl-restricted`** — `draft:ymyl` é guardrail funcionando.
3. **Inventário grande = run lento** — `polarisia` (92), `reviewshield` (77), `aftercare` (69) são os
   mais propensos ao corte de ~300s do proxy: o Actions reporta `request-failed` **enquanto o hub
   termina e commita**. Confira o repo antes de acreditar no log.
4. **Cada projeto novo é canário do próprio renderizador.** Provados em prod: `mdx` (context),
   `astro` (goiania), `astro-content-ptbr` (tapepro). `typescript-post` e `markdown` estreiam amanhã.
5. **GSC é barato de testar** — `gsc-unavailable` falha antes de gastar cota. Ligar já é o teste.

### 2.3 Como ligar

UI (preferido): `hub.roilabs.com.br/seo` → Sala de Controle Editorial. O botão mostra **a ação**, não o
estado. O **Motivo** só grava ao pausar. Vale `global E projeto`.

```sql
update seo_projects set enabled = true, paused_reason = null where project_slug = 'estetiacrm';
select project_slug, enabled, paused_reason from seo_projects order by 1;
```

`enabled` é relido imediatamente antes do commit: pausar no meio de uma execução ainda descarta o
artigo antes de escrever no repo.

---

## 3. Como testar sem esperar o cron

```bash
# linha do dia BLOQUEIA o retry (ON CONFLICT DO NOTHING). Apague SÓ linha sem commit_sha.
delete from seo_publications where run_date='2026-07-26' and commit_sha is null;

gh workflow run "SEO autopublish" --ref main -f dry_run=false
gh run watch <id> --exit-status
```

- `dryRun: true` gera o artigo e para antes da imagem e do commit — modo certo para iterar prompt.
- **Não pushe no roihub durante uma execução**: o auto-deploy derruba o hub e os projetos em voo
  voltam `http-502`.
- Disparo de um projeto só:

```bash
curl -s -X POST -H "authorization: Bearer $CRON_SECRET" -H "content-type: application/json" \
  -d '{"phase":"publish","project":"sirius","runDate":"2026-07-26","dryRun":true}' \
  --max-time 900 https://hub.roilabs.com.br/api/seo/autopublish
```

---

## 4. O que sobrou

1. **Rollout dias 2–4** (5 projetos) — um par por dia, com a checagem do dia seguinte.
2. **Capa própria do post do tapepro** (pipeline Gemini, seção 1.2).
3. **Renderizador `mdx` duplica hero/FAQ/related** quando o layout do projeto já os renderiza
   (seção 1.3) — corrigir antes de ligar os outros três projetos `mdx`.
4. **Fechar a tarefa 2** só quando os 10 estiverem ligados e um run inteiro terminar sem `llm-rate` —
   ou com a decisão explícita de quantos por dia cabem na cota.
