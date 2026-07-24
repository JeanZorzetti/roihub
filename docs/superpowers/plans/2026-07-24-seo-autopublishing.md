# SEO Autopublishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar, validar, publicar e acompanhar automaticamente uma ação editorial diária para cada um dos dez projetos do ROI Hub.

**Architecture:** O ROI Hub consulta GSC e inventário GitHub, decide entre artigo novo, atualização ou bloqueio, usa OpenAI e Unsplash para gerar conteúdo e capa, renderiza no formato nativo e cria um commit atômico. Um workflow diário chama a API protegida em duas fases curtas (`publish` e `verify`), enquanto o Postgres existente mantém idempotência, histórico e pausas.

**Tech Stack:** Next.js 16 App Router, Node.js 22 (`fetch`, `node:test`, `crypto`), PostgreSQL/`pg`, Google Search Console API, OpenAI Responses/Image APIs, Unsplash API e GitHub Git Data API.

## Global Constraints

- Meta: uma ação editorial por projeto por dia às 08:00 BRT; nunca mais de uma por `project_slug + run_date`.
- Regra editorial: `1 intenção → 1 URL canônica`; duplicação gera atualização ou bloqueio.
- Modelo de texto: `gpt-5.6-terra`, `reasoning.effort: "medium"`, via Responses API com `web_search`.
- Imagem: Unsplash primeiro; `gpt-image-2`, `1536x1024`, qualidade `low`, WebP como fallback.
- Sem CMS, fila externa, banco vetorial ou dependência npm nova.
- Sem publicação YMYL sem autoria especialista real; AftercareGen fica restrito a operação e software.
- Toda escrita GitHub usa commit atômico e SHA esperado; nenhum force push.
- O kill switch global nasce desligado e só é ativado depois dos quatro canários.
- Segredos nunca entram em logs, banco, fixtures ou commits.

---

## File Map

| Arquivo | Responsabilidade |
|---|---|
| `lib/autopublish-projects.mjs` | Configuração fechada dos dez projetos. |
| `lib/autopublish-core.mjs` | Seleção de pauta, guardrails, custo e autorização pura. |
| `lib/autopublish-render.mjs` | Extração de inventário e quatro renderizadores. |
| `lib/autopublish-clients.ts` | OpenAI, Unsplash e GitHub por `fetch`. |
| `lib/autopublish.ts` | Orquestração `publish`/`verify`. |
| `lib/gsc.ts` | Query/page windows e URL Inspection. |
| `lib/db.ts` | Schema e CRUD de publicações/pausas. |
| `app/api/seo/autopublish/route.ts` | Contrato HTTP do cron. |
| `app/seo/actions.ts` | Pausa por projeto e kill switch. |
| `app/seo/publications.tsx` | Histórico operacional. |
| `app/seo/page.tsx` | Inclusão do painel no `/seo`. |
| `middleware.ts` | Bearer exclusivo para cron, Basic Auth no restante. |
| `.github/workflows/seo-autopublish.yml` | Cron e verificação sequencial. |
| `test/autopublish.test.mjs` | Check executável do núcleo e renderizadores. |
| `.env.example`, `README.md` | Contrato operacional e secrets exigidos. |

---

### Task 1: Configuração dos projetos, decisão editorial e guardrails

**Files:**
- Create: `lib/autopublish-projects.mjs`
- Create: `lib/autopublish-core.mjs`
- Create: `test/autopublish.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `PROJECTS`, `projectBySlug(slug)`, `rankCandidates(rows, inventory)`, `validateDraft(draft, project)`, `authorized(header, secret)`, `estimateCost(usage)`.
- Consumes: nenhum módulo novo.

- [ ] **Step 1: Write the failing tests for configuration, idempotent auth, ranking and YMYL**

Add `test/autopublish.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, projectBySlug } from "../lib/autopublish-projects.mjs";
import { authorized, rankCandidates, validateDraft, estimateCost } from "../lib/autopublish-core.mjs";

test("configura exatamente os dez projetos e remotes", () => {
  assert.equal(PROJECTS.length, 10);
  assert.equal(projectBySlug("goiania").repository, "JeanZorzetti/roilabs");
  assert.equal(projectBySlug("reviewshield").conversionUrl, "https://reviewshield.nimblabs.com/checker");
  assert.equal(projectBySlug("missing"), null);
});

test("Bearer exige igualdade integral", () => {
  assert.equal(authorized("Bearer secret", "secret"), true);
  assert.equal(authorized("Basic secret", "secret"), false);
  assert.equal(authorized("Bearer secre", "secret"), false);
  assert.equal(authorized(null, "secret"), false);
});

test("query com URL existente vira update; lacuna vira new", () => {
  const rows = [
    { query: "crm para vendas", page: "https://siriuscrm.com.br/blog/crm", current: { impressions: 90, clicks: 3, position: 8 }, previous: { impressions: 30, clicks: 1, position: 11 } },
    { query: "crm para distribuidores", page: "https://siriuscrm.com.br/", current: { impressions: 60, clicks: 0, position: 16 }, previous: { impressions: 10, clicks: 0, position: 31 } },
  ];
  const inventory = [{ slug: "crm", title: "CRM para vendas", primaryKeyword: "crm para vendas", path: "lib/blog/posts/crm.ts" }];
  const ranked = rankCandidates(rows, inventory);
  assert.equal(ranked[0].action, "update");
  assert.equal(ranked[0].targetPath, "lib/blog/posts/crm.ts");
  assert.equal(ranked[1].action, "new");
});

test("guardrail bloqueia fonte ausente, placeholder e YMYL clínico", () => {
  const base = {
    slug: "clinic-ops",
    title: "Clinic operations",
    description: "A practical clinic operations guide with sourced recommendations.",
    primaryKeyword: "clinic operations",
    cluster: "clinic-operations",
    bluf: "This guide explains how clinics can standardize non-clinical operations, reduce administrative work, and measure follow-up quality without providing medical advice or replacing a qualified clinician.",
    sections: [{ heading: "What to measure", paragraphs: ["Track response time and completion rate."] }],
    faqs: [],
    relatedSlugs: [],
    sources: [{ url: "https://example.org/source", title: "Source", publisher: "Example", publishedAt: "2026-01-01" }],
  };
  assert.deepEqual(validateDraft(base, projectBySlug("aftercare")), []);
  assert.ok(validateDraft({ ...base, title: "FILL_ME" }, projectBySlug("aftercare")).includes("placeholder"));
  assert.ok(validateDraft({ ...base, title: "Botox dosage guide" }, projectBySlug("aftercare")).includes("ymyl"));
  assert.ok(validateDraft({ ...base, sources: [] }, projectBySlug("aftercare")).includes("sources"));
});

test("estimativa inclui tokens, busca e imagem", () => {
  assert.equal(
    estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000, webSearchCalls: 1, generatedImage: true }),
    17.515
  );
});
```

- [ ] **Step 2: Run the new test and confirm failure**

Run:

```powershell
node --test test/autopublish.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/autopublish-projects.mjs`.

- [ ] **Step 3: Add the closed project configuration**

Create `lib/autopublish-projects.mjs` with the exact ten entries:

```js
export const PROJECTS = [
  { slug: "goiania", repository: "JeanZorzetti/roilabs", branch: "main", siteUrl: "https://goiania.roilabs.com.br", contentPath: "site-goiania/src/pages/guia", imagePath: "site-goiania/public/blog", renderer: "astro", schema: "goiania", language: "pt-BR", author: "Equipe ROI Labs", conversionUrl: "https://goiania.roilabs.com.br/orcamento/", risk: "standard" },
  { slug: "sirius", repository: "JeanZorzetti/sirius", branch: "main", siteUrl: "https://siriuscrm.com.br", contentPath: "lib/blog/posts", imagePath: "public/images/blog", renderer: "typescript-post", schema: "sirius", language: "pt-BR", author: "Equipe Sirius CRM", conversionUrl: "https://siriuscrm.com.br/", risk: "standard" },
  { slug: "fabrica", repository: "JeanZorzetti/estetia-demo", branch: "main", siteUrl: "https://estetia.estetiacrm.com.br", contentPath: "src/lib/blog/posts", imagePath: "public/blog", renderer: "typescript-post", schema: "fabrica", language: "pt-BR", author: "Equipe Estetia", conversionUrl: "https://estetia.estetiacrm.com.br/", risk: "non-clinical" },
  { slug: "roilabs", repository: "JeanZorzetti/roilabs", branch: "main", siteUrl: "https://roilabs.com.br", contentPath: "site/src/content/blog", imagePath: "site/public/blog", renderer: "markdown", schema: "roilabs", language: "pt-BR", author: "Equipe ROI Labs", conversionUrl: "https://roilabs.com.br/#candidatar", risk: "standard" },
  { slug: "polarisia", repository: "JeanZorzetti/sofia-ia", branch: "main", siteUrl: "https://polarisia.com.br", contentPath: "content/blog", imagePath: "public/blog", renderer: "mdx", schema: "polarisia", language: "pt-BR", author: "Equipe Polaris IA", conversionUrl: "https://polarisia.com.br/", risk: "standard" },
  { slug: "estetiacrm", repository: "JeanZorzetti/estetia", branch: "main", siteUrl: "https://estetiacrm.com.br", contentPath: "lib/blog/posts", imagePath: "public/images/blog", renderer: "typescript-post", schema: "estetiacrm", language: "pt-BR", author: "Equipe Estetia", conversionUrl: "https://estetiacrm.com.br/", risk: "non-clinical" },
  { slug: "reviewshield", repository: "JeanZorzetti/review-dispute", branch: "main", siteUrl: "https://reviewshield.nimblabs.com", contentPath: "content/blog", imagePath: "public/blog", renderer: "mdx", schema: "reviewshield", language: "en-US", author: "marcus-reyes", conversionUrl: "https://reviewshield.nimblabs.com/checker", risk: "legal-safe" },
  { slug: "context", repository: "JeanZorzetti/context-keeper", branch: "main", siteUrl: "https://context.nimblabs.com", contentPath: "apps/web/content/blog", imagePath: "apps/web/public/blog", renderer: "mdx", schema: "context", language: "en-US", author: "Context Keeper Team", conversionUrl: "https://context.nimblabs.com/", risk: "standard" },
  { slug: "aftercare", repository: "JeanZorzetti/aftercare-nimblabs", branch: "main", siteUrl: "https://aftercare.nimblabs.com", contentPath: "content/blog", imagePath: "public/blog", renderer: "mdx", schema: "aftercare", language: "en-US", author: "AftercareGen Editorial", conversionUrl: "https://aftercare.nimblabs.com/pricing", risk: "ymyl-restricted" },
  { slug: "nimblabs", repository: "JeanZorzetti/nimblabs", branch: "main", siteUrl: "https://nimblabs.com", contentPath: "lib/blog.ts", imagePath: "public/blog", renderer: "typescript-catalog", schema: "nimblabs", language: "en-US", author: "nimblabs editorial", conversionUrl: "https://nimblabs.com/", risk: "standard" },
];

const BY_SLUG = new Map(PROJECTS.map((project) => [project.slug, Object.freeze(project)]));
export const projectBySlug = (slug) => BY_SLUG.get(slug) ?? null;
```

- [ ] **Step 4: Implement the minimal pure decision and guardrail functions**

Create `lib/autopublish-core.mjs`. Use `node:crypto.timingSafeEqual` in `authorized`; normalize diacritics and punctuation in `normalizeIntent`; score candidates by impression growth, current impressions and positions 4–20. `validateDraft` must return stable codes from this closed list:

```js
["placeholder", "sources", "bluf", "duplicate-intent", "ymyl", "structure", "unsafe-markup"]
```

Use these exact pricing constants:

```js
const PRICE = {
  inputPerToken: 2.5 / 1_000_000,
  outputPerToken: 15 / 1_000_000,
  webSearchCall: 10 / 1_000,
  imageLowLandscape: 0.005,
};
```

`rankCandidates` returns every GSC row once, ordered by score, and assigns `update` only when normalized query equals a normalized title or primary keyword. It never uses fuzzy similarity; semantic equivalence remains the researched model's responsibility.

- [ ] **Step 5: Add the test to the package script and run it**

Modify `package.json`:

```json
"test": "node --test test/score.test.mjs test/series.test.mjs test/crawl.test.mjs test/agenda.test.mjs test/autopublish.test.mjs"
```

Run:

```powershell
npm test
```

Expected: all existing tests and the five autopublish tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add package.json lib/autopublish-projects.mjs lib/autopublish-core.mjs test/autopublish.test.mjs
git commit -m "feat: add autopublishing rules"
```

---

### Task 2: Inventário e renderizadores nativos

**Files:**
- Create: `lib/autopublish-render.mjs`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Consumes: project objects from `projectBySlug`.
- Produces: `extractInventory(files, project)`, `renderDraft(draft, project, currentContent)`, `catalogUpsert(source, entry, slug)`.

- [ ] **Step 1: Add failing renderer tests**

Append tests that build one normalized draft and assert:

```js
import { extractInventory, renderDraft, catalogUpsert } from "../lib/autopublish-render.mjs";

const draft = {
  slug: "daily-guide",
  title: "Daily Guide",
  description: "A sourced daily guide for a specific search intent.",
  primaryKeyword: "daily guide",
  cluster: "operations",
  bluf: "This concise answer explains the decision, the evidence behind it, and the next practical action without repeating the rest of the article.",
  sections: [{ heading: "How it works", paragraphs: ["Use the existing workflow.", "Measure the result."] }],
  faqs: [{ q: "Does it work?", a: "Yes, when the stated preconditions are met." }],
  relatedSlugs: ["existing-guide"],
  sources: [{ url: "https://example.org", title: "Example", publisher: "Example", publishedAt: "2026-01-01" }],
  image: { src: "https://images.unsplash.com/photo-x", alt: "Team reviewing a workflow", credit: "Photo by A on Unsplash" },
  publishedAt: "2026-07-24",
};

test("renderiza Markdown, MDX, Astro e post TypeScript sem script/import gerado", () => {
  for (const slug of ["roilabs", "context", "goiania", "sirius"]) {
    const rendered = renderDraft(draft, projectBySlug(slug), null);
    assert.ok(rendered.path.includes("daily-guide"));
    assert.ok(rendered.content.includes("Daily Guide"));
    assert.ok(!rendered.content.includes("<script"));
    assert.ok(!rendered.content.includes("import Daily"));
  }
});

test("catálogo insere e substitui um slug preservando exports", () => {
  const source = 'export const posts = [{ slug: "old", title: "Old" }];\\nexport function getAllPosts() {}';
  const inserted = catalogUpsert(source, '{ slug: "new", title: "New" }', "new");
  assert.match(inserted, /slug: "new"/);
  const replaced = catalogUpsert(inserted, '{ slug: "new", title: "Updated" }', "new");
  assert.equal((replaced.match(/slug: "new"/g) ?? []).length, 1);
  assert.match(replaced, /title: "Updated"/);
  assert.match(replaced, /export function getAllPosts/);
});
```

- [ ] **Step 2: Run and confirm module failure**

```powershell
node --test test/autopublish.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/autopublish-render.mjs`.

- [ ] **Step 3: Implement inventory extraction**

`extractInventory(files, project)` receives `{path, content}[]`, ignores files outside `project.contentPath`, and returns:

```js
{ slug, title, primaryKeyword, headings, path, canonical }[]
```

Use regex-only extraction for frontmatter, TypeScript object fields and Astro `<h1>`. Read no more than the supplied content and skip entries without both slug and title. Normalize CRLF before parsing.

- [ ] **Step 4: Implement the four renderers**

`renderDraft` returns:

```js
{ path: string, content: string, imageFile: null | { path: string, base64: string } }
```

Rules:

- `markdown`: YAML frontmatter plus Markdown body; insert the hero as the first body image.
- `mdx`: project-schema frontmatter plus plain Markdown body; no generated MDX component or import.
- `astro`: self-contained page importing existing `Base`, `Header`, `Footer`, `Faq` and `WhatsappCta`; hero uses a regular `<img>`.
- `typescript-post`: one exported `BlogPost`, escaped template literal HTML, schema-specific import path and image fields.
- `typescript-catalog`: render one `Post` object and pass it through `catalogUpsert`.

Escape backticks, `${`, `</script`, YAML delimiters and raw `<script` before rendering. For a generated image use `project.imagePath/<slug>.webp`; for Unsplash keep the hotlinked URL.

- [ ] **Step 5: Implement bracket-aware catalog replacement**

`catalogUpsert` must:

1. locate `export const posts`;
2. find the array boundaries with a scanner that tracks string quotes, escapes and bracket depth;
3. locate an existing object whose top-level `slug` matches;
4. replace that object or append before the closing array bracket;
5. throw `catalog-format` when boundaries cannot be proved.

Do not add a parser dependency.

- [ ] **Step 6: Run tests and commit**

```powershell
npm test
git add lib/autopublish-render.mjs test/autopublish.test.mjs
git commit -m "feat: render native blog formats"
```

Expected: all tests PASS.

---

### Task 3: Persistência idempotente e controles de pausa

**Files:**
- Modify: `lib/db.ts`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Produces: `Publication`, `beginPublication`, `finishPublication`, `updatePublicationMetadata`, `getPublication`, `listPublications`, `projectEnabled`, `setProjectEnabled`.
- Consumes: `DATABASE_URL` and the existing global pool.

- [ ] **Step 1: Add a pure transition test**

Expose `validTransition(from, to)` from `lib/autopublish-core.mjs` and test:

```js
test("status só avança por transições permitidas", () => {
  assert.equal(validTransition("running", "published"), true);
  assert.equal(validTransition("running", "blocked"), true);
  assert.equal(validTransition("published", "reverted"), true);
  assert.equal(validTransition("blocked", "published"), false);
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
node --test test/autopublish.test.mjs
```

Expected: FAIL because `validTransition` is not exported.

- [ ] **Step 3: Add the state machine**

Use this closed map:

```js
const TRANSITIONS = {
  running: new Set(["published", "updated", "blocked", "failed"]),
  published: new Set(["reverted"]),
  updated: new Set(["reverted"]),
  blocked: new Set(),
  failed: new Set(),
  reverted: new Set(),
};
```

- [ ] **Step 4: Extend `ensure()` with both tables**

Append idempotent SQL to the existing schema query:

```sql
CREATE TABLE IF NOT EXISTS seo_publications (
  id BIGSERIAL PRIMARY KEY,
  project_slug TEXT NOT NULL,
  run_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','published','updated','blocked','failed','reverted')),
  action TEXT NOT NULL CHECK (action IN ('new','update','block')),
  query TEXT,
  intent TEXT,
  target_url TEXT,
  repository TEXT NOT NULL,
  commit_sha TEXT,
  previous_sha TEXT,
  model TEXT,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  image_source TEXT,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  UNIQUE (project_slug, run_date)
);
CREATE TABLE IF NOT EXISTS seo_projects (
  project_slug TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paused_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO seo_projects (project_slug, enabled, paused_reason)
VALUES
  ('*', FALSE, 'Aguardando canários'),
  ('goiania', FALSE, 'Aguardando ativação'),
  ('sirius', FALSE, 'Aguardando ativação'),
  ('fabrica', FALSE, 'Aguardando ativação'),
  ('roilabs', FALSE, 'Aguardando ativação'),
  ('polarisia', FALSE, 'Aguardando ativação'),
  ('estetiacrm', FALSE, 'Aguardando ativação'),
  ('reviewshield', FALSE, 'Aguardando ativação'),
  ('context', FALSE, 'Aguardando ativação'),
  ('aftercare', FALSE, 'Aguardando ativação'),
  ('nimblabs', FALSE, 'Aguardando ativação')
ON CONFLICT (project_slug) DO NOTHING;
```

Add explicit TypeScript types and parameterized queries. `beginPublication` returns `{ publication, created }`: it uses `INSERT ... ON CONFLICT DO NOTHING RETURNING *`; when no row is returned, it loads the existing row and returns `created: false`. `updatePublicationMetadata` only merges verification fields and never changes status.

- [ ] **Step 5: Run type/build checks**

```powershell
npm test
npm run build
```

Expected: tests PASS and Next build completes without TypeScript errors.

- [ ] **Step 6: Commit**

```powershell
git add lib/db.ts lib/autopublish-core.mjs test/autopublish.test.mjs
git commit -m "feat: persist autopublishing runs"
```

---

### Task 4: GSC, OpenAI, Unsplash e GitHub clients

**Files:**
- Modify: `lib/gsc.ts`
- Create: `lib/autopublish-clients.ts`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Produces: `gscQueryPages(siteUrl)`, `inspectUrl(siteUrl, inspectedUrl)`, `researchAndDraft`, `pickImage`, `readRepository`, `commitFiles`, `revertCommit`, `deploymentState`.
- Consumes: `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `GITHUB_TOKEN`, project config.

- [ ] **Step 1: Add failing API normalization tests**

Add pure exports `mergeGscWindows`, `responseText`, `githubTreeFiles`, and test with recorded JSON objects:

```js
test("mergeGscWindows une query+page e preserva janela ausente", () => {
  const current = [{ keys: ["crm", "https://x.test/blog/crm"], clicks: 2, impressions: 20, position: 8 }];
  const previous = [{ keys: ["crm", "https://x.test/blog/crm"], clicks: 1, impressions: 10, position: 12 }];
  assert.deepEqual(mergeGscWindows(current, previous), [{
    query: "crm",
    page: "https://x.test/blog/crm",
    current: { clicks: 2, impressions: 20, position: 8 },
    previous: { clicks: 1, impressions: 10, position: 12 },
  }]);
});

test("GitHub tree aceita apenas blobs do contentPath", () => {
  const tree = [{ type: "blob", path: "content/blog/a.mdx", sha: "1" }, { type: "blob", path: ".env", sha: "2" }];
  assert.deepEqual(githubTreeFiles(tree, projectBySlug("aftercare")), [{ path: "content/blog/a.mdx", sha: "1" }]);
});
```

- [ ] **Step 2: Run and verify missing exports**

```powershell
node --test test/autopublish.test.mjs
```

Expected: FAIL on missing client/GSC helpers.

- [ ] **Step 3: Extend GSC**

Reuse `getClient`, `listSites` and `resolveProperty`. Add a window query with:

```ts
dimensions: ["query", "page"],
rowLimit: 25000,
dimensionFilterGroups: [
  { filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] },
],
```

Fetch current D-31..D-3 and previous D-59..D-32, then merge. `inspectUrl` calls the URL Inspection endpoint and returns only `verdict`, `coverageState`, `robotsTxtState`, `indexingState` and `lastCrawlTime`.

- [ ] **Step 4: Implement OpenAI with native `fetch`**

`researchAndDraft` makes two `POST https://api.openai.com/v1/responses` calls:

- research: `model: "gpt-5.6-terra"`, `reasoning: { effort: "medium" }`, `tools: [{ type: "web_search" }]`;
- draft: same model, no web tool, Structured Output JSON schema for the normalized draft.

Both calls set `store: false`. Accept `fetchImpl = fetch` for tests. Throw stable errors `openai-auth`, `openai-rate`, `openai-output` without logging response bodies.

- [ ] **Step 5: Implement image selection**

`pickImage` calls `GET https://api.unsplash.com/search/photos` with `orientation=landscape`, `content_filter=high`, `per_page=10`. Select the first item whose description/alt matches at least one normalized intent token, call its `links.download_location`, and return URL/alt/credit.

When none matches, call `POST https://api.openai.com/v1/images/generations` with:

```json
{
  "model": "gpt-image-2",
  "size": "1536x1024",
  "quality": "low",
  "output_format": "webp",
  "output_compression": 75,
  "n": 1
}
```

- [ ] **Step 6: Implement GitHub Git Data API**

Use only these endpoints:

- `GET /repos/{repo}/git/ref/heads/{branch}`
- `GET /repos/{repo}/git/trees/{sha}?recursive=1`
- `GET /repos/{repo}/git/blobs/{sha}`
- `POST /repos/{repo}/git/blobs`
- `POST /repos/{repo}/git/trees`
- `POST /repos/{repo}/git/commits`
- `PATCH /repos/{repo}/git/refs/heads/{branch}` with `force: false`
- `GET /repos/{repo}/commits/{sha}/status`

`commitFiles` re-reads the ref immediately before the PATCH and throws `github-conflict` when it differs from `expectedSha`. `revertCommit` creates a new tree from `previousSha`; it never rewrites history.

- [ ] **Step 7: Run tests/build and commit**

```powershell
npm test
npm run build
git add lib/gsc.ts lib/autopublish-clients.ts test/autopublish.test.mjs
git commit -m "feat: connect publishing services"
```

Expected: tests and build PASS.

---

### Task 5: Orquestração de publicação e verificação

**Files:**
- Create: `lib/autopublish.ts`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Produces: `publishProject(slug, runDate, { dryRun?, ...deps }?)`, `verifyPublication(id, deps?)`.
- Consumes: project config, core, renderers, clients, GSC and DB functions.

- [ ] **Step 1: Add an orchestration test with injected fakes**

Use fakes for every side effect and assert:

```js
test("publishProject bloqueia antes do GitHub quando draft falha", async () => {
  let committed = false;
  const result = await publishProject("aftercare", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "a", files: [] }),
    researchAndDraft: async () => ({ action: "new", draft: { title: "Botox dosage guide", sources: [] }, usage: {} }),
    pickImage: async () => null,
    commitFiles: async () => { committed = true; },
  });
  assert.equal(result.status, "blocked");
  assert.equal(committed, false);
});

test("segunda execução devolve o registro sem nova chamada externa", async () => {
  let reads = 0;
  const db = fakeDb({ existing: { id: 7, status: "published" } });
  const result = await publishProject("context", "2026-07-24", {
    db,
    readRepository: async () => { reads++; },
  });
  assert.equal(result.id, 7);
  assert.equal(reads, 0);
});

test("dry-run não consome idempotência nem escreve no GitHub", async () => {
  let began = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    dryRun: true,
    db: fakeDb({ enabled: false, onBegin: () => { began = true; } }),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "a", files: [] }),
    researchAndDraft: async () => validContextDraft(),
    commitFiles: async () => { committed = true; },
  });
  assert.equal(result.status, "dry-run");
  assert.equal(began, false);
  assert.equal(committed, false);
});
```

The test file defines `fakeDb` with in-memory `begin`, `finish`, `get`, and `enabled` methods, plus the smallest valid Context Keeper draft fixture.

- [ ] **Step 2: Run and verify missing orchestration module**

```powershell
node --test test/autopublish.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `lib/autopublish.ts`.

- [ ] **Step 3: Implement `publishProject` in the exact order**

1. validate slug and ISO date;
2. when `dryRun` is false, require global and project enabled, call `beginPublication`, and return immediately whenever `created` is false, including an existing `running` row;
3. collect GSC and repository inventory;
4. rank candidates and call research;
5. block duplicate/unsafe decisions;
6. generate the draft, run `validateDraft`, and render;
7. when `dryRun` is true, return a transient `{ status: "dry-run", action, targetPath, validation }` without calling `beginPublication`, image APIs or GitHub write APIs;
8. otherwise select the image and create the atomic GitHub commit;
9. finish as `published` or `updated` with usage, metadata and expected URL;
10. convert known failures to stable `blocked`/`failed` reasons.

No catch block may include secret-bearing response bodies.

- [ ] **Step 4: Implement `verifyPublication`**

Reject any row not in `published` or `updated`. Require:

- successful GitHub commit status, or pending while within five workflow attempts;
- HTTP 200;
- expected title/H1 text;
- self canonical;
- no `noindex`;
- JSON-LD parseable;
- URL present in sitemap.

On terminal failure, call `revertCommit` and finish as `reverted`. On success, retain the published/updated status and add verification data through `updatePublicationMetadata`.

- [ ] **Step 5: Run tests/build and commit**

```powershell
npm test
npm run build
git add lib/autopublish.ts test/autopublish.test.mjs
git commit -m "feat: orchestrate daily publishing"
```

Expected: tests and build PASS.

---

### Task 6: API protegida e workflow diário

**Files:**
- Create: `app/api/seo/autopublish/route.ts`
- Create: `.github/workflows/seo-autopublish.yml`
- Create: `scripts/run-autopublish.mjs`
- Modify: `middleware.ts`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Consumes: `publishProject`, `verifyPublication`, `authorized`.
- Produces: `POST /api/seo/autopublish`.

- [ ] **Step 1: Add authorization edge cases**

Test empty secret, oversized header and whitespace:

```js
test("cron auth falha fechado", () => {
  assert.equal(authorized("Bearer secret", ""), false);
  assert.equal(authorized("Bearer secret ", "secret"), false);
  assert.equal(authorized(`Bearer ${"x".repeat(500)}`, "secret"), false);
});
```

- [ ] **Step 2: Implement the route**

The body union is exact:

```ts
type Body =
  | { phase: "publish"; project: string; runDate: string; dryRun?: boolean }
  | { phase: "verify"; publicationId: number };
```

Return:

- `401` invalid Bearer;
- `400` invalid JSON/body/slug/date;
- `409` GitHub conflict;
- `503` missing required env or database;
- `200` stable JSON result.

Set `export const runtime = "nodejs"` and `export const maxDuration = 300`.

- [ ] **Step 3: Modify middleware without weakening Basic Auth**

At the top of `middleware`, when pathname equals `/api/seo/autopublish`, call `authorized(req.headers.get("authorization"), process.env.CRON_SECRET ?? "")` and return `NextResponse.next()` only on success. All other paths retain the existing Basic behavior.

- [ ] **Step 4: Add the scheduled workflow**

Create a workflow with:

```yaml
on:
  schedule:
    - cron: "0 11 * * *"
  workflow_dispatch:
    inputs:
      dry_run:
        type: boolean
        default: true
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/run-autopublish.mjs
        env:
          HUB_URL: ${{ secrets.HUB_URL }}
          HUB_CRON_SECRET: ${{ secrets.HUB_CRON_SECRET }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
```

Create `scripts/run-autopublish.mjs` in this task. It loops the ten slugs and calls publish. In dry-run mode it prints the ten read-only summaries and stops. Otherwise it waits 90 seconds for committed rows, then tries verify up to five times with 60-second intervals. It exits non-zero if any project is `failed` or `reverted`, but treats `blocked` as an editorial result.

- [ ] **Step 5: Run tests/build and commit**

```powershell
npm test
npm run build
git add app/api/seo/autopublish/route.ts middleware.ts .github/workflows/seo-autopublish.yml scripts/run-autopublish.mjs test/autopublish.test.mjs
git commit -m "feat: schedule protected autopublishing"
```

Expected: tests and build PASS.

---

### Task 7: Histórico, pausas e kill switch em `/seo`

**Files:**
- Create: `app/seo/actions.ts`
- Create: `app/seo/publications.tsx`
- Modify: `app/seo/page.tsx`
- Modify: `app/globals.css`
- Modify: `lib/db.ts`

**Interfaces:**
- Consumes: `listPublications`, `listProjectStates`, `setProjectEnabled`.
- Produces: forms server-side for project/global pause and a compact history table.

- [ ] **Step 1: Add DB functions for the UI**

Implement:

```ts
export async function listPublications(limit = 50): Promise<Publication[]>
export async function listProjectStates(): Promise<ProjectState[]>
export async function setProjectEnabled(slug: string, enabled: boolean, reason: string | null): Promise<void>
```

Clamp `limit` to `1..200`; validate slug in the server action against `projects.json`, with `*` as the only extra value.

- [ ] **Step 2: Add server actions**

`app/seo/actions.ts` parses `slug`, `enabled` and a 300-character reason, writes only when DB is on, and calls `revalidatePath("/seo")`.

- [ ] **Step 3: Build the history component**

`Publications` renders:

- banner when DB is off;
- global switch row;
- ten project rows with enabled/paused state;
- last 50 runs with project, date, action, status, query, target URL, commit link, USD cost and reason.

Use native forms/buttons/details and existing `card`, `pill`, `banner` and table styles. Add only:

```css
.pub-controls { display:grid; gap:8px; margin:16px 0; }
.pub-control { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.pub-status { font-weight:700; }
.pub-status.failed, .pub-status.reverted { color:var(--red); }
.pub-status.published, .pub-status.updated { color:var(--green); }
```

- [ ] **Step 4: Mount below the project cards**

In `app/seo/page.tsx`, fetch publication/state data in the existing top-level `Promise.all` and render `<Publications>` after the SEO grid. If DB is off, pass empty arrays and do not call DB functions.

- [ ] **Step 5: Run accessibility/build smoke checks**

```powershell
npm test
npm run build
```

Expected: tests and build PASS; every form control has an accessible name and every external link has `rel="noreferrer"`.

- [ ] **Step 6: Commit**

```powershell
git add app/seo/actions.ts app/seo/publications.tsx app/seo/page.tsx app/globals.css lib/db.ts
git commit -m "feat: show publishing controls"
```

---

### Task 8: Environment contract, dry-run and rollout gates

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `scripts/run-autopublish.mjs`
- Modify: `test/autopublish.test.mjs`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: fail-closed configuration diagnostics and operator instructions.

- [ ] **Step 1: Add environment validation test**

Export `missingEnv(env)` from `lib/autopublish-core.mjs` and assert:

```js
test("produção lista somente nomes das envs ausentes", () => {
  assert.deepEqual(
    missingEnv({ DATABASE_URL: "x", GOOGLE_SERVICE_ACCOUNT_JSON: "x" }),
    ["CRON_SECRET", "GITHUB_TOKEN", "OPENAI_API_KEY", "UNSPLASH_ACCESS_KEY"]
  );
});
```

- [ ] **Step 2: Implement fail-closed env validation**

Use the exact required list:

```js
[
  "CRON_SECRET",
  "DATABASE_URL",
  "GITHUB_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "OPENAI_API_KEY",
  "UNSPLASH_ACCESS_KEY",
]
```

Return names only. The route responds `503` with `{ error: "missing-env", fields }`.

- [ ] **Step 3: Document local and production configuration**

Append the six variables to `.env.example`. In `README.md`, document:

1. GitHub fine-grained token with Contents read/write only on the ten repos;
2. `HUB_URL` and `HUB_CRON_SECRET` as GitHub Actions secrets;
3. OpenAI organization verification possibly required for GPT Image;
4. Unsplash attribution/hotlink/download rules;
5. global kill switch default off;
6. dry-run command:

```powershell
$env:HUB_URL='https://hub.roilabs.com.br'
$env:HUB_CRON_SECRET='local-secret'
$env:DRY_RUN='true'
node scripts/run-autopublish.mjs
```

- [ ] **Step 4: Run the complete local verification**

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests PASS, build succeeds and diff check returns no output.

- [ ] **Step 5: Commit**

```powershell
git add .env.example README.md lib/autopublish-core.mjs scripts/run-autopublish.mjs test/autopublish.test.mjs
git commit -m "docs: add autopublishing operations"
```

- [ ] **Step 6: Execute production rollout only after secrets exist**

Run `workflow_dispatch` with `dry_run=true`. Expected: ten transient result summaries, no rows in `seo_publications`, no image/GitHub write, and no secret value in logs.

Then enable only these four canaries in `/seo` while the global row remains disabled:

- `goiania` — Astro;
- `sirius` — TypeScript post;
- `context` — MDX;
- `nimblabs` — TypeScript catalog.

Temporarily enable the global row, run `workflow_dispatch` with `dry_run=false`, then disable it after the four canaries complete. Verify build, HTTP 200, canonical, schema, sitemap and image attribution for each. Only after all four pass, enable all projects and leave the global row enabled for the daily cron.

---

## Final Verification

- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `git diff --check` is clean.
- [ ] A second dry-run for the same project/date returns the original row.
- [ ] Unsafe Aftercare clinical content blocks before GitHub.
- [ ] GitHub SHA conflict produces `409` and no write.
- [ ] A failed canary creates a revert commit, not force push.
- [ ] `/seo` shows all statuses and controls with Basic Auth intact.
- [ ] Scheduled workflow remains unable to run while the global kill switch is off.
- [ ] No production rollout begins before all required secrets are configured.
