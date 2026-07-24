import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, projectBySlug } from "../lib/autopublish-projects.mjs";
import { authorized, rankCandidates, validateDraft, estimateCost, validTransition } from "../lib/autopublish-core.mjs";
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
  assert.ok(validateDraft({ ...base, sections: [{ heading: "Care steps", paragraphs: ["Use this Botox dosage after treatment."] }] }, projectBySlug("aftercare")).includes("ymyl"));
  assert.ok(validateDraft({ ...base, sources: [] }, projectBySlug("aftercare")).includes("sources"));
});

test("estimativa inclui tokens, busca e imagem", () => {
  assert.equal(
    estimateCost({ inputTokens: 1_000_000, outputTokens: 1_000_000, webSearchCalls: 1, generatedImage: true }),
    17.515
  );
});

test("status só avança por transições permitidas", () => {
  assert.equal(validTransition("running", "published"), true);
  assert.equal(validTransition("running", "blocked"), true);
  assert.equal(validTransition("published", "reverted"), true);
  assert.equal(validTransition("blocked", "published"), false);
});

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
  const source = 'export const posts = [{ slug: "old", title: "Old" }];\nexport function getAllPosts() {}';
  const inserted = catalogUpsert(source, '{ slug: "new", title: "New" }', "new");
  assert.match(inserted, /slug: "new"/);
  const replaced = catalogUpsert(inserted, '{ slug: "new", title: "Updated" }', "new");
  assert.equal((replaced.match(/slug: "new"/g) ?? []).length, 1);
  assert.match(replaced, /title: "Updated"/);
  assert.match(replaced, /export function getAllPosts/);
});

test("inventário extrai frontmatter, Astro e múltiplos posts TypeScript no contentPath", () => {
  const markdown = '---\r\ntitle: "Daily Guide"\r\nprimaryKeyword: "daily guide"\r\n---\r\n## First heading\r\n';
  const astro = '<Base title="Astro Guide"><h1>Astro Guide</h1><h2>Details</h2></Base>';
  const catalog = `export const posts = [
    { title: "Title", slug: "title", keyword: "first", sections: [{ heading: "Overview", body: [] }] },
    { slug: "two", title: "Two", keyword: "second", sections: [{ heading: "Details", body: [] }] },
  ];`;
  assert.deepEqual(
    extractInventory([
      { path: "content/blog/daily-guide.mdx", content: markdown },
      { path: "elsewhere/ignored.mdx", content: markdown },
    ], { ...projectBySlug("context"), contentPath: "content/blog" }),
    [{
      slug: "daily-guide",
      title: "Daily Guide",
      primaryKeyword: "daily guide",
      headings: ["First heading"],
      path: "content/blog/daily-guide.mdx",
      canonical: "https://context.nimblabs.com/blog/daily-guide",
    }]
  );
  assert.deepEqual(extractInventory(
    [{ path: "site-goiania/src/pages/guia/astro-guide.astro", content: astro }],
    projectBySlug("goiania")
  )[0].headings, ["Astro Guide", "Details"]);
  assert.deepEqual(
    extractInventory([{ path: "lib/blog.ts", content: catalog }], projectBySlug("nimblabs")).map(({ slug, title, primaryKeyword }) => ({ slug, title, primaryKeyword })),
    [
      { slug: "title", title: "Title", primaryKeyword: "first" },
      { slug: "two", title: "Two", primaryKeyword: "second" },
    ]
  );
});

test("renderizadores preservam schemas nativos, escapam conteúdo e materializam imagem gerada", () => {
  const hostile = {
    ...draft,
    title: "Daily --- `Guide` <script>",
    bluf: "Avoid `code` <script>alert(`${oops}`)</script>.",
    image: { src: "generated", alt: "Generated <script image", credit: "Generated", base64: "d2VicA==" },
  };
  const markdown = renderDraft(hostile, projectBySlug("roilabs"), null);
  assert.equal(markdown.imageFile.path, "site/public/blog/daily-guide.webp");
  assert.match(markdown.content, /!\[Generated &lt;script image\]\(\/blog\/daily-guide\.webp\)/);
  assert.ok(!markdown.content.includes("<script"));

  const astro = renderDraft(hostile, projectBySlug("goiania"), null);
  for (const component of ["Base", "Header", "Footer", "Faq", "WhatsappCta"]) {
    assert.match(astro.content, new RegExp(`import ${component}`));
  }

  const sirius = renderDraft(hostile, projectBySlug("sirius"), null);
  assert.match(sirius.content, /import \{ BlogPost \} from '\.\.\/\.\.\/blog-types'/);
  assert.match(sirius.content, /export const post: BlogPost/);
  assert.match(sirius.content, /\\\$\{oops\}/);

  const fabrica = renderDraft(hostile, projectBySlug("fabrica"), null);
  assert.match(fabrica.content, /import \{ BlogPost \} from "\.\.\/types";/);
  assert.match(fabrica.content, /imageAlt:/);
  assert.match(fabrica.content, /faqs:/);

  const mdx = renderDraft(hostile, projectBySlug("context"), null);
  const mdxBody = mdx.content.replace(/^---\n[\s\S]*?\n---\n/, "");
  assert.ok(!mdx.content.includes("<script"));
  assert.ok(!mdxBody.includes("${"));
  assert.doesNotMatch(mdxBody, /(?<!\\)[{}]/);
  assert.match(mdxBody, /\\`code\\`/);

  const catalog = renderDraft(hostile, projectBySlug("nimblabs"), "export const posts = [];");
  assert.ok(!catalog.content.includes("<script"));
});

test("Aftercare usa apenas a autoria configurada como credencial", () => {
  const aftercare = renderDraft(draft, projectBySlug("aftercare"), null);
  assert.ok(!aftercare.content.includes("Reviewed editorial guidance"));
  assert.match(aftercare.content, /credentials: "AftercareGen Editorial"/);
});

test("catálogo ignora colchetes e slug aninhado em strings e falha sem limites comprovados", () => {
  const source = `export const posts = [
  { slug: "old", title: "Old ] }", sections: [{ body: ["slug: \\"new\\""] }] },
];\nexport const untouched = "yes";`;
  const updated = catalogUpsert(source, '{ slug: "new", title: "New" }', "new");
  assert.match(updated, /title: "Old \] \}"/);
  assert.match(updated, /export const untouched = "yes"/);
  const trailing = catalogUpsert(
    'export const posts = [{ slug: "old", title: "Old" },];\nexport const untouched = true;',
    '{ slug: "new", title: "New" }',
    "new"
  );
  assert.doesNotMatch(trailing, /,\s*,/);
  assert.match(trailing, /title: "Old" \},\s*\{ slug: "new"/);
  assert.throws(() => catalogUpsert("export const posts = [", "{}", "new"), /catalog-format/);
  assert.throws(() => catalogUpsert("const posts = []", "{}", "new"), /catalog-format/);
  assert.throws(() => catalogUpsert("export const posts = makePosts([])", "{}", "new"), /catalog-format/);
});
