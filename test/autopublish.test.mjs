import { test } from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, projectBySlug } from "../lib/autopublish-projects.mjs";
import { authorized, rankCandidates, validateDraft, estimateCost, validTransition } from "../lib/autopublish-core.mjs";
import { extractInventory, renderDraft, catalogUpsert } from "../lib/autopublish-render.mjs";
import { gscQueryPages, inspectUrl, mergeGscWindows } from "../lib/gsc.ts";
import {
  commitFiles,
  deploymentState,
  githubTreeFiles,
  pickImage,
  readRepository,
  researchAndDraft,
  responseText,
  revertCommit,
} from "../lib/autopublish-clients.ts";
import { publishProject, verifyPublication } from "../lib/autopublish.ts";

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

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

async function withEnv(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await operation();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function fakeDb({
  existing = null,
  enabled = true,
  onBegin,
  onFinish,
  onGet,
  onUpdate,
  onEnabled,
} = {}) {
  let row = existing ? { metadata: {}, ...existing } : null;
  return {
    async begin(input) {
      onBegin?.(input);
      if (row) return { publication: row, created: false };
      row = {
        id: 1,
        status: "running",
        action: input.action ?? "block",
        metadata: {},
        ...input,
      };
      return { publication: row, created: true };
    },
    async finish(id, status, updates = {}) {
      onFinish?.(id, status, updates);
      row = {
        ...row,
        ...updates,
        id,
        status,
        metadata: { ...row?.metadata, ...(updates.metadata ?? {}) },
      };
      return row;
    },
    async get(id) {
      onGet?.(id);
      return row?.id === id ? row : null;
    },
    async update(id, metadata) {
      onUpdate?.(id, metadata);
      row = { ...row, id, metadata: { ...row?.metadata, ...metadata } };
      return row;
    },
    async enabled(slug) {
      onEnabled?.(slug);
      return typeof enabled === "object" ? enabled[slug] === true : enabled;
    },
  };
}

const validContextDraft = () => ({
  action: "new",
  targetPath: null,
  overlap: "none",
  reason: "No existing entry covers this intent.",
  draft: {
    slug: "context-guide",
    title: "Context Guide",
    description: "A sourced guide to preserving context across engineering sessions.",
    primaryKeyword: "context guide",
    cluster: "engineering-workflows",
    bluf: "Preserve decisions, constraints, and current state in one concise handoff so the next engineering session can continue without repeating discovery or losing important implementation context.",
    sections: [{ heading: "What to preserve", paragraphs: ["Record decisions, constraints, and the next concrete action."] }],
    faqs: [],
    relatedSlugs: [],
    sources: [{ url: "https://example.org/context", title: "Context source", publisher: "Example", publishedAt: "2026-01-01" }],
    publishedAt: "2026-07-24",
  },
  usage: { inputTokens: 10, outputTokens: 20, webSearchCalls: 1, generatedImage: false },
});

const githubTransport = (project, handler) => async (url, init = {}) => {
  const parsed = new URL(url);
  const repositoryPath = `/repos/${project.repository}`;
  assert.equal(parsed.origin, "https://api.github.com");
  assert.ok(parsed.pathname.startsWith(`${repositoryPath}/`), `unexpected repository URL: ${parsed.pathname}`);
  assert.equal(init.headers.authorization, "Bearer test-github-token");
  const route = `${init.method ?? "GET"} ${parsed.pathname.slice(repositoryPath.length)}${parsed.search}`;
  return handler(route, init);
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
  assert.ok(validateDraft({
    ...base,
    slug: "lip-filler-swelling",
    title: "Swelling after lip fillers",
    description: "How to reduce swelling after lip fillers with a cold compress.",
    primaryKeyword: "lip filler swelling",
    cluster: "lip-filler-aftercare",
    bluf: "Apply a cold compress after lip fillers to reduce swelling.",
    sections: [{
      heading: "Cold compress",
      paragraphs: ["Use a cold compress for swelling after lip fillers."],
    }],
    faqs: [{
      q: "How long does swelling last?",
      a: "Continue using a cold compress while the swelling improves.",
    }],
  }, projectBySlug("aftercare")).includes("ymyl"));
  assert.ok(validateDraft({
    ...base,
    title: "Modern spa interior design",
    description: "A visual tour of modern spa interior design.",
    primaryKeyword: "spa interior design",
  }, projectBySlug("aftercare")).includes("ymyl"));
  assert.ok(validateDraft({
    ...base,
    slug: "post-procedure-aftercare-workflow",
    title: "Post-procedure aftercare workflow",
    description: "A post-procedure aftercare workflow for clinics.",
    primaryKeyword: "post-procedure aftercare workflow",
    cluster: "aftercare-workflow",
    bluf: "Patients should avoid alcohol, sun exposure, and exercise after a procedure.",
    sections: [{
      heading: "What patients should avoid",
      paragraphs: [
        "Avoid alcohol after the procedure.",
        "Stay out of the sun and do not exercise.",
      ],
    }],
    faqs: [{
      q: "Can I exercise after the procedure?",
      a: "Avoid exercise until the recovery period ends.",
    }],
  }, projectBySlug("aftercare")).includes("ymyl"));
  assert.ok(validateDraft({
    ...base,
    bluf: "Support the immune system with plenty of rest.",
    sections: [{
      heading: "Immune system support",
      paragraphs: ["Support the immune system with plenty of rest."],
    }],
  }, projectBySlug("aftercare")).includes("ymyl"));
  assert.deepEqual(validateDraft({
    ...base,
    sources: [{
      url: "https://example.org/botox-dosage-treatment",
      title: "Botox dosage and treatment",
      publisher: "Example",
      publishedAt: "2026-01-01",
    }],
  }, projectBySlug("aftercare")), []);
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

test("mergeGscWindows une query+page e preserva janela ausente", () => {
  const current = [
    { keys: ["crm", "https://x.test/blog/crm"], clicks: 2, impressions: 20, position: 8, ctr: 0.1 },
    { keys: ["pipeline", "https://x.test/blog/pipeline"], clicks: 3, impressions: 30, position: 7 },
  ];
  const previous = [
    { keys: ["crm", "https://x.test/blog/crm"], clicks: 1, impressions: 10, position: 12, extra: "ignored" },
  ];
  assert.deepEqual(mergeGscWindows(current, previous), [
    {
      query: "crm",
      page: "https://x.test/blog/crm",
      current: { clicks: 2, impressions: 20, position: 8 },
      previous: { clicks: 1, impressions: 10, position: 12 },
    },
    {
      query: "pipeline",
      page: "https://x.test/blog/pipeline",
      current: { clicks: 3, impressions: 30, position: 7 },
      previous: null,
    },
  ]);
});

test("responseText lê o formato aninhado atual de Responses", () => {
  const response = {
    id: "resp_123",
    object: "response",
    status: "completed",
    output: [{
      id: "msg_123",
      type: "message",
      status: "completed",
      role: "assistant",
      content: [{
        type: "output_text",
        annotations: [],
        logprobs: [],
        text: "{\"title\":\"CRM\"}",
      }],
    }],
  };
  assert.equal(responseText(response), "{\"title\":\"CRM\"}");
});

test("responseText ignora itens e contents malformados", () => {
  assert.equal(responseText({
    output: [
      null,
      7,
      { content: null },
      { content: [null, "invalid", { type: "output_text", text: "safe" }] },
    ],
  }), "safe");
  assert.equal(responseText({ output: [null, { content: [null, 1] }] }), null);
});

test("researchAndDraft converte Responses malformada em openai-output sanitizado", async () => {
  await withEnv({ OPENAI_API_KEY: "test-openai-key" }, async () => {
    await assert.rejects(
      () => researchAndDraft({}, async () => jsonResponse({
        body: "secret response body",
        output: [null, { content: null }, { content: [null, 1] }],
      })),
      (error) => error instanceof Error
        && error.message === "openai-output"
        && !error.message.includes("secret response body")
    );
  });
});

test("GitHub tree aceita apenas blobs do contentPath", () => {
  const tree = [
    { type: "blob", path: "content/blog/a.mdx", sha: "1" },
    { type: "tree", path: "content/blog/nested", sha: "2" },
    { type: "blob", path: ".env", sha: "3" },
  ];
  assert.deepEqual(githubTreeFiles(tree, projectBySlug("aftercare")), [
    { path: "content/blog/a.mdx", sha: "1" },
  ]);
});

test("GSC consulta as janelas exatas e reduz URL Inspection", async () => {
  const requests = [];
  const client = {
    request: async (request) => {
      requests.push(request);
      if (request.url.endsWith("/webmasters/v3/sites")) {
        return { data: { siteEntry: [{ siteUrl: "sc-domain:x.test", permissionLevel: "siteOwner" }] } };
      }
      if (request.url.endsWith("/urlInspection/index:inspect")) {
        return {
          data: {
            inspectionResult: {
              indexStatusResult: {
                verdict: "PASS",
                coverageState: "Submitted and indexed",
                robotsTxtState: "ALLOWED",
                indexingState: "INDEXING_ALLOWED",
                lastCrawlTime: "2026-07-23T12:00:00Z",
                crawledAs: "DESKTOP",
              },
            },
          },
        };
      }
      const current = request.data.startDate === "2026-06-23";
      return {
        data: {
          rows: [{
            keys: ["crm", "https://x.test/blog/crm"],
            clicks: current ? 2 : 1,
            impressions: current ? 20 : 10,
            position: current ? 8 : 12,
          }],
        },
      };
    },
  };

  const rows = await gscQueryPages("https://x.test", {
    client,
    now: new Date("2026-07-24T12:00:00Z"),
  });
  assert.deepEqual(rows[0], {
    query: "crm",
    page: "https://x.test/blog/crm",
    current: { clicks: 2, impressions: 20, position: 8 },
    previous: { clicks: 1, impressions: 10, position: 12 },
  });
  assert.deepEqual(
    requests.slice(1, 3).map(({ data }) => data),
    [
      {
        startDate: "2026-06-23",
        endDate: "2026-07-21",
        dimensions: ["query", "page"],
        rowLimit: 25000,
        dimensionFilterGroups: [{
          filters: [{
            dimension: "page",
            operator: "contains",
            expression: "https://x.test/",
          }],
        }],
      },
      {
        startDate: "2026-05-26",
        endDate: "2026-06-22",
        dimensions: ["query", "page"],
        rowLimit: 25000,
        dimensionFilterGroups: [{
          filters: [{
            dimension: "page",
            operator: "contains",
            expression: "https://x.test/",
          }],
        }],
      },
    ]
  );

  assert.deepEqual(
    await inspectUrl("https://x.test", "https://x.test/blog/crm", { client }),
    {
      verdict: "PASS",
      coverageState: "Submitted and indexed",
      robotsTxtState: "ALLOWED",
      indexingState: "INDEXING_ALLOWED",
      lastCrawlTime: "2026-07-23T12:00:00Z",
    }
  );
  assert.deepEqual(requests.at(-1).data, {
    inspectionUrl: "https://x.test/blog/crm",
    siteUrl: "sc-domain:x.test",
  });
});

test("OpenAI pesquisa e decide update sem copiar a heurística do candidato", async () => {
  const { image, ...normalizedDraft } = draft;
  const targetPath = "apps/web/content/blog/daily-guide.mdx";
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return calls.length === 1
      ? jsonResponse({
        output: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "Research with cited evidence.", annotations: [] }],
        }],
        usage: { input_tokens: 3, output_tokens: 4 },
      })
      : jsonResponse({
        output_text: JSON.stringify({
          decision: {
            action: "update",
            targetPath,
            overlap: "same",
            reason: "The inventory already covers the same search intent.",
          },
          draft: normalizedDraft,
        }),
        usage: { input_tokens: 5, output_tokens: 6 },
      });
  };

  const result = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () => researchAndDraft({
    project: projectBySlug("context"),
    candidate: { action: "new", targetPath: null, query: "daily guide" },
    inventory: [{
      slug: "daily-guide",
      title: "Daily Guide",
      primaryKeyword: "daily guide",
      path: targetPath,
      headings: ["How it works"],
    }],
    runDate: "2026-07-24",
  }, fetchImpl));

  assert.deepEqual(result, {
    action: "update",
    targetPath,
    overlap: "same",
    reason: "The inventory already covers the same search intent.",
    draft: normalizedDraft,
    usage: { inputTokens: 8, outputTokens: 10, webSearchCalls: 1, generatedImage: false },
  });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ url, init, body }) =>
    url === "https://api.openai.com/v1/responses"
    && init.method === "POST"
    && body.model === "gpt-5.6-terra"
    && body.reasoning.effort === "medium"
    && body.store === false
  ));
  assert.deepEqual(calls[0].body.tools, [{ type: "web_search" }]);
  assert.equal("tools" in calls[1].body, false);
  assert.equal(calls[1].body.text.format.type, "json_schema");
  assert.equal(calls[1].body.text.format.strict, true);
  assert.deepEqual(calls[1].body.text.format.schema.properties.decision.required, [
    "action",
    "targetPath",
    "overlap",
    "reason",
  ]);
  assert.equal(
    JSON.parse(calls[1].body.input[1].content).context.inventory[0].path,
    targetPath
  );
});

test("OpenAI falha fechado para decisão semântica incerta ou malformada", async () => {
  const { image, ...normalizedDraft } = draft;
  const context = {
    project: projectBySlug("context"),
    candidate: { action: "new", targetPath: null, query: "daily guide" },
    inventory: [],
    runDate: "2026-07-24",
  };
  const responses = (decision) => {
    let call = 0;
    return async () => {
      call += 1;
      return call === 1
        ? jsonResponse({ output_text: "Research with cited evidence." })
        : jsonResponse({ output_text: JSON.stringify({ decision, draft: normalizedDraft }) });
    };
  };

  const uncertain = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () =>
    researchAndDraft(context, responses({
      action: "new",
      targetPath: null,
      overlap: "uncertain",
      reason: "The inventory is not conclusive.",
    }))
  );
  assert.equal(uncertain.action, "block");
  assert.equal(uncertain.overlap, "uncertain");
  assert.equal(uncertain.reason, "semantic:uncertain");

  const sameAsNew = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () =>
    researchAndDraft(context, responses({
      action: "new",
      targetPath: null,
      overlap: "same",
      reason: "The intent is the same as an inventory entry.",
    }))
  );
  assert.equal(sameAsNew.action, "block");
  assert.equal(sameAsNew.reason, "semantic:same");

  const missingUpdateTarget = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () =>
    researchAndDraft(context, responses({
      action: "update",
      targetPath: "apps/web/content/blog/missing.mdx",
      overlap: "same",
      reason: "The intent should update an existing entry.",
    }))
  );
  assert.equal(missingUpdateTarget.action, "block");
  assert.equal(missingUpdateTarget.reason, "semantic:update-target");

  const existingPath = "apps/web/content/blog/daily-guide.mdx";
  const updateWithoutSameOverlap = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () =>
    researchAndDraft({
      ...context,
      inventory: [{ path: existingPath }],
    }, responses({
      action: "update",
      targetPath: existingPath,
      overlap: "none",
      reason: "Refresh the existing entry despite no overlap.",
    }))
  );
  assert.equal(updateWithoutSameOverlap.action, "block");
  assert.equal(updateWithoutSameOverlap.reason, "semantic:update-overlap");

  await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () =>
    assert.rejects(
      () => researchAndDraft(context, responses({
        action: "publish",
        targetPath: null,
        overlap: "none",
        reason: "Invalid action.",
      })),
      /openai-output/
    )
  );
});

test("OpenAI não vaza body em erros de auth ou rate limit", async () => {
  await withEnv({ OPENAI_API_KEY: "test-openai-key" }, async () => {
    for (const [status, code] of [[401, "openai-auth"], [429, "openai-rate"]]) {
      await assert.rejects(
        () => researchAndDraft({}, async () => new Response("secret response body", { status })),
        (error) => error instanceof Error
          && error.message === code
          && !error.message.includes("secret response body")
      );
    }
    await assert.rejects(
      () => researchAndDraft({}, async () => {
        throw new Error("secret network details");
      }),
      (error) => error instanceof Error
        && error.message === "openai-output"
        && !error.message.includes("secret network details")
    );
  });
});

test("imagem usa hotlink Unsplash com crédito e recorre ao GPT Image 2", async () => {
  await withEnv({
    UNSPLASH_ACCESS_KEY: "test-unsplash-key",
    OPENAI_API_KEY: "test-openai-key",
  }, async () => {
    const calls = [];
    const unsplashFetch = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      if (calls.length === 1) {
        return jsonResponse({
          results: [
            {
              description: "Mountain",
              alt_description: "Mountain landscape",
              urls: { regular: "https://images.unsplash.com/unrelated" },
              links: { download_location: "https://api.unsplash.com/photos/unrelated/download" },
              user: { name: "Unrelated" },
            },
            {
              description: "Sales operations",
              alt_description: "AI dashboard",
              urls: { regular: "https://images.unsplash.com/crm" },
              links: { download_location: "https://api.unsplash.com/photos/crm/download" },
              user: { name: "Ana Silva" },
            },
          ],
        });
      }
      return new Response(null, { status: 200 });
    };
    assert.deepEqual(await pickImage("ai", unsplashFetch), {
      src: "https://images.unsplash.com/crm",
      alt: "AI dashboard",
      credit: "Photo by Ana Silva on Unsplash",
    });
    const searchUrl = new URL(calls[0].url);
    assert.equal(searchUrl.searchParams.get("query"), "ai");
    assert.equal(searchUrl.searchParams.get("orientation"), "landscape");
    assert.equal(searchUrl.searchParams.get("content_filter"), "high");
    assert.equal(searchUrl.searchParams.get("per_page"), "10");
    assert.equal(calls[1].url, "https://api.unsplash.com/photos/crm/download");

    const fallbackCalls = [];
    const fallbackFetch = async (url, init = {}) => {
      fallbackCalls.push({ url: String(url), init });
      return fallbackCalls.length === 1
        ? jsonResponse({ results: [] })
        : jsonResponse({ data: [{ b64_json: "d2VicA==" }] });
    };
    assert.deepEqual(await pickImage("workflow automation", fallbackFetch), {
      src: "generated",
      alt: "workflow automation",
      credit: "Generated by OpenAI",
      base64: "d2VicA==",
    });
    assert.equal(fallbackCalls[1].url, "https://api.openai.com/v1/images/generations");
    assert.deepEqual(JSON.parse(fallbackCalls[1].init.body), {
      model: "gpt-image-2",
      size: "1536x1024",
      quality: "low",
      output_format: "webp",
      output_compression: 75,
      n: 1,
      prompt: "Editorial landscape image for workflow automation. No text or logos.",
    });
  });
});

test("GitHub lê somente blobs do contentPath pelas URLs codificadas", async () => {
  const project = { ...projectBySlug("aftercare"), branch: "release/v1" };
  await withEnv({ GITHUB_TOKEN: "test-github-token" }, async () => {
    const fetchImpl = githubTransport(project, (route) => {
      if (route === "GET /git/ref/heads/release%2Fv1") {
        return jsonResponse({ object: { sha: "head0" } });
      }
      if (route === "GET /git/trees/head0?recursive=1") {
        return jsonResponse({
          tree: [
            { type: "blob", path: "content/blog/a.mdx", sha: "blob0" },
            { type: "blob", path: ".env", sha: "secret0" },
          ],
        });
      }
      if (route === "GET /git/blobs/blob0") {
        return jsonResponse({ content: Buffer.from("old").toString("base64"), encoding: "base64" });
      }
      assert.fail(`unexpected GitHub route: ${route}`);
    });

    assert.deepEqual(await readRepository(project, fetchImpl), {
      headSha: "head0",
      files: [{ path: "content/blog/a.mdx", sha: "blob0", content: "old" }],
    });
  });
});

test("GitHub valida blobs texto/base64, árvore, commit e ref sem force", async () => {
  const project = { ...projectBySlug("aftercare"), branch: "release/v1" };
  await withEnv({ GITHUB_TOKEN: "test-github-token" }, async () => {
    let invalidPathCalls = 0;
    await assert.rejects(
      () => commitFiles(project, "head0", [{ path: "../.env", content: "secret" }], "Invalid", async () => {
        invalidPathCalls += 1;
        return jsonResponse({ sha: "unused" });
      }),
      /github-path/
    );
    assert.equal(invalidPathCalls, 0);

    const blobBodies = [];
    const fetchImpl = githubTransport(project, (route, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (route === "POST /git/blobs") {
        blobBodies.push(body);
        return jsonResponse({ sha: `blob${blobBodies.length}` });
      }
      if (route === "POST /git/trees") {
        assert.deepEqual(body, {
          base_tree: "head0",
          tree: [
            { path: "content/blog/a.mdx", mode: "100644", type: "blob", sha: "blob1" },
            { path: "public/blog/a.webp", mode: "100644", type: "blob", sha: "blob2" },
          ],
        });
        return jsonResponse({ sha: "tree1" });
      }
      if (route === "POST /git/commits") {
        assert.deepEqual(body, { message: "Publish guide", tree: "tree1", parents: ["head0"] });
        return jsonResponse({ sha: "commit1" });
      }
      if (route === "GET /git/ref/heads/release%2Fv1") {
        assert.equal(body, null);
        return jsonResponse({ object: { sha: "head0" } });
      }
      if (route === "PATCH /git/refs/heads/release%2Fv1") {
        assert.deepEqual(body, { sha: "commit1", force: false });
        return jsonResponse({ object: { sha: "commit1" } });
      }
      assert.fail(`unexpected GitHub route: ${route}`);
    });

    assert.deepEqual(await commitFiles(project, "head0", [
      { path: "content/blog/a.mdx", content: "new" },
      { path: "public/blog/a.webp", base64: "d2VicA==" },
    ], "Publish guide", fetchImpl), { sha: "commit1", previousSha: "head0" });
    assert.deepEqual(blobBodies, [
      { content: "new", encoding: "utf-8" },
      { content: "d2VicA==", encoding: "base64" },
    ]);
  });
});

test("GitHub preserva conflito do ref GET e do PATCH concorrente sem vazar body", async () => {
  const project = { ...projectBySlug("aftercare"), branch: "release/v1" };
  await withEnv({ GITHUB_TOKEN: "test-github-token" }, async () => {
    const commitRoute = (patchStatus, refSha = "head0") => githubTransport(project, (route, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (route === "POST /git/blobs") return jsonResponse({ sha: "blob1" });
      if (route === "POST /git/trees") {
        assert.equal(body.base_tree, "head0");
        return jsonResponse({ sha: "tree1" });
      }
      if (route === "POST /git/commits") {
        assert.deepEqual(body.parents, ["head0"]);
        return jsonResponse({ sha: "commit1" });
      }
      if (route === "GET /git/ref/heads/release%2Fv1") {
        return jsonResponse({ object: { sha: refSha } });
      }
      if (route === "PATCH /git/refs/heads/release%2Fv1") {
        assert.deepEqual(body, { sha: "commit1", force: false });
        return new Response("secret concurrent body", { status: patchStatus });
      }
      assert.fail(`unexpected GitHub route: ${route}`);
    });

    await assert.rejects(
      () => commitFiles(project, "head0", [{ path: "content/blog/a.mdx", content: "new" }], "Publish", commitRoute(200, "other-head")),
      (error) => error instanceof Error && error.message === "github-conflict"
    );
    for (const status of [409, 422]) {
      await assert.rejects(
        () => commitFiles(project, "head0", [{ path: "content/blog/a.mdx", content: "new" }], "Publish", commitRoute(status)),
        (error) => error instanceof Error
          && error.message === "github-conflict"
          && !error.message.includes("secret concurrent body")
      );
    }
  });
});

test("GitHub reverte por novo commit e consulta deployment", async () => {
  const project = { ...projectBySlug("aftercare"), branch: "release/v1" };
  await withEnv({ GITHUB_TOKEN: "test-github-token" }, async () => {
    const fetchImpl = githubTransport(project, (route, init) => {
      const body = init.body ? JSON.parse(init.body) : null;
      if (route === "POST /git/trees") {
        assert.deepEqual(body, { base_tree: "head0", tree: [] });
        return jsonResponse({ sha: "revert-tree" });
      }
      if (route === "POST /git/commits") {
        assert.deepEqual(body, {
          message: "Revert automated publication",
          tree: "revert-tree",
          parents: ["commit1"],
        });
        return jsonResponse({ sha: "revert-commit" });
      }
      if (route === "GET /git/ref/heads/release%2Fv1") {
        return jsonResponse({ object: { sha: "commit1" } });
      }
      if (route === "PATCH /git/refs/heads/release%2Fv1") {
        assert.deepEqual(body, { sha: "revert-commit", force: false });
        return jsonResponse({ object: { sha: "revert-commit" } });
      }
      if (route === "GET /commits/revert-commit/status") {
        return jsonResponse({ state: "success" });
      }
      assert.fail(`unexpected GitHub route: ${route}`);
    });

    assert.equal(await revertCommit(project, "commit1", "head0", fetchImpl), "revert-commit");
    assert.equal(await deploymentState(project, "revert-commit", fetchImpl), "success");
  });
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

test("publishProject bloqueia antes da imagem e do GitHub quando draft falha", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("aftercare", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "a", files: [] }),
    researchAndDraft: async () => ({
      action: "new",
      targetPath: null,
      overlap: "none",
      reason: "No existing entry covers this intent.",
      draft: { title: "Botox dosage guide", sources: [] },
      usage: {},
    }),
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "draft:sources,bluf,ymyl,structure");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("publishProject bloqueia decisão semântica incerta antes da imagem e do GitHub", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "head0", files: [] }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "new",
      overlap: "uncertain",
      reason: "The inventory does not establish whether this intent is new.",
    }),
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:unsafe");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("publishProject classifica same mais new como duplicate", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "head0", files: [] }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "block",
      targetPath: null,
      overlap: "same",
      reason: "semantic:same",
    }),
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:duplicate");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("publishProject bloqueia update sem overlap same antes da imagem e do GitHub", async () => {
  const targetPath = "apps/web/content/blog/context-guide.mdx";
  let picked = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [{
        path: targetPath,
        content: `---
title: "Context Guide"
slug: "context-guide"
primaryKeyword: "context guide"
---
Old content.`,
      }],
    }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "update",
      targetPath,
      overlap: "none",
      reason: "Refresh the entry despite no semantic overlap.",
    }),
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:unsafe");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("publishProject bloqueia intenção duplicada mesmo com outro slug", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [{
        path: "apps/web/content/blog/existing-guide.mdx",
        content: `---
title: "Context Guide"
slug: "existing-guide"
primaryKeyword: "context guide"
---
Existing guide.`,
      }],
    }),
    researchAndDraft: async () => {
      const researched = validContextDraft();
      return { ...researched, draft: { ...researched.draft, slug: "another-context-guide" } };
    },
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:duplicate");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("update bloqueia intenção pertencente a outro post antes da imagem", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [{
      query: "alpha guide",
      current: { impressions: 20, position: 8 },
      previous: { impressions: 10, position: 12 },
    }],
    readRepository: async () => ({
      headSha: "head0",
      files: [
        {
          path: "apps/web/content/blog/guide-a.mdx",
          content: '---\ntitle: "Guide A"\nslug: "guide-a"\nprimaryKeyword: "alpha guide"\n---\nA',
        },
        {
          path: "apps/web/content/blog/guide-b.mdx",
          content: '---\ntitle: "Guide B"\nslug: "guide-b"\nprimaryKeyword: "beta guide"\n---\nB',
        },
      ],
    }),
    researchAndDraft: async () => {
      const researched = validContextDraft();
      return {
        ...researched,
        action: "update",
        targetPath: "apps/web/content/blog/guide-a.mdx",
        overlap: "same",
        reason: "The target covers the same intent.",
        draft: {
          ...researched.draft,
          slug: "guide-a",
          title: "Guide B",
          primaryKeyword: "beta guide",
        },
      };
    },
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:duplicate");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("colisão de idempotência devolve published ou running sem chamada externa", async () => {
  for (const status of ["published", "running"]) {
    let reads = 0;
    const result = await publishProject("context", "2026-07-24", {
      db: fakeDb({ existing: { id: 7, status } }),
      readRepository: async () => {
        reads += 1;
        throw new Error("unexpected-read");
      },
    });
    assert.equal(result.id, 7);
    assert.equal(result.status, status);
    assert.equal(reads, 0);
  }
});

test("dry-run não consulta enablement nem escreve em DB, imagem ou GitHub", async () => {
  const calls = { enabled: 0, began: 0, finished: 0, updated: 0, picked: 0, committed: 0 };
  const result = await publishProject("context", "2026-07-24", {
    dryRun: true,
    db: fakeDb({
      enabled: false,
      onEnabled: () => { calls.enabled += 1; },
      onBegin: () => { calls.began += 1; },
      onFinish: () => { calls.finished += 1; },
      onUpdate: () => { calls.updated += 1; },
    }),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "a", files: [] }),
    researchAndDraft: async () => validContextDraft(),
    pickImage: async () => {
      calls.picked += 1;
      return null;
    },
    commitFiles: async () => {
      calls.committed += 1;
    },
  });

  assert.deepEqual(result, {
    status: "dry-run",
    action: "new",
    targetPath: "apps/web/content/blog/context-guide.mdx",
    validation: [],
  });
  assert.deepEqual(calls, { enabled: 0, began: 0, finished: 0, updated: 0, picked: 0, committed: 0 });
});

test("kill switch global falha fechado antes do projeto e da idempotência", async () => {
  const calls = [];
  let began = false;
  let read = false;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb({
      enabled: { "*": false, context: true },
      onEnabled: (slug) => calls.push(slug),
      onBegin: () => { began = true; },
    }),
    readRepository: async () => {
      read = true;
      throw new Error("unexpected-read");
    },
  });

  assert.deepEqual(result, {
    status: "blocked",
    reason: "global-disabled",
    projectSlug: "context",
    runDate: "2026-07-24",
  });
  assert.deepEqual(calls, ["*"]);
  assert.equal(began, false);
  assert.equal(read, false);
});

test("publica commit atômico no head lido com artigo e imagem renderizados", async () => {
  let committed;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "head0", files: [] }),
    researchAndDraft: async () => validContextDraft(),
    pickImage: async () => ({
      src: "generated",
      alt: "Engineering context handoff",
      credit: "Generated by OpenAI",
      base64: "d2VicA==",
    }),
    commitFiles: async (...args) => {
      committed = args;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(committed[1], "head0");
  assert.equal(committed[2].length, 2);
  assert.deepEqual(committed[2].map(({ path }) => path), [
    "apps/web/content/blog/context-guide.mdx",
    "apps/web/public/blog/context-guide.webp",
  ]);
  assert.match(committed[2][0].content, /\/blog\/context-guide\.webp/);
  assert.equal(committed[2][1].base64, "d2VicA==");
  assert.equal(result.status, "published");
  assert.equal(result.commitSha, "commit1");
  assert.equal(result.previousSha, "head0");
  assert.equal(result.targetUrl, "https://context.nimblabs.com/blog/context-guide");
});

test("update válido exclui apenas o próprio alvo e preserva slug, path e URL", async () => {
  const targetPath = "apps/web/content/blog/context-guide.mdx";
  let committed;
  const result = await publishProject("context", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [{
        path: targetPath,
        content: `---
title: "Context Guide"
slug: "context-guide"
primaryKeyword: "context guide"
---
Old content.`,
      }],
    }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "update",
      targetPath,
      overlap: "same",
      reason: "The inventory entry covers the same intent.",
    }),
    pickImage: async () => null,
    commitFiles: async (...args) => {
      committed = args;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "updated");
  assert.equal(result.targetUrl, "https://context.nimblabs.com/blog/context-guide");
  assert.equal(result.metadata.slug, "context-guide");
  assert.equal(result.metadata.targetPath, targetPath);
  assert.equal(committed[2][0].path, targetPath);
});

test("post novo do nimblabs atualiza o catálogo existente sem falsa duplicação", async () => {
  let committed;
  const result = await publishProject("nimblabs", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [{ path: "lib/blog.ts", content: "export const posts = [];" }],
    }),
    researchAndDraft: async () => validContextDraft(),
    pickImage: async () => ({
      src: "https://images.unsplash.com/context",
      alt: "Engineering context handoff",
      credit: "Photo by A on Unsplash",
    }),
    commitFiles: async (...args) => {
      committed = args;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "published");
  assert.equal(committed[2].length, 1);
  assert.equal(committed[2][0].path, "lib/blog.ts");
  assert.match(committed[2][0].content, /slug: "context-guide"/);
});

test("update no catálogo bloqueia slug diferente do post selecionado", async () => {
  let picked = false;
  let committed = false;
  const result = await publishProject("nimblabs", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [{
      query: "context guide",
      current: { impressions: 20, position: 8 },
      previous: { impressions: 10, position: 12 },
    }],
    readRepository: async () => ({
      headSha: "head0",
      files: [{
        path: "lib/blog.ts",
        content: 'export const posts = [{ slug: "existing-guide", title: "Context Guide", keyword: "context guide" }];',
      }],
    }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "update",
      targetPath: "lib/blog.ts",
      overlap: "same",
      reason: "The catalog entry covers the same intent.",
    }),
    pickImage: async () => {
      picked = true;
      return null;
    },
    commitFiles: async () => {
      committed = true;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "decision:unsafe");
  assert.equal(picked, false);
  assert.equal(committed, false);
});

test("verifyPublication retorna pending antes da quinta tentativa sem buscar a página", async () => {
  let fetched = false;
  let reverted = false;
  const db = fakeDb({
    existing: {
      id: 8,
      projectSlug: "context",
      status: "published",
      targetUrl: "https://context.nimblabs.com/blog/context-guide",
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide", verificationAttempts: 3 },
    },
  });
  const result = await verifyPublication(8, {
    db,
    deploymentState: async () => "pending",
    fetch: async () => {
      fetched = true;
      throw new Error("unexpected-fetch");
    },
    revertCommit: async () => {
      reverted = true;
    },
  });

  assert.deepEqual(result, { id: 8, status: "pending", attempt: 4, deployment: "pending" });
  assert.equal(fetched, false);
  assert.equal(reverted, false);
  assert.equal((await db.get(8)).status, "published");
  assert.equal((await db.get(8)).metadata.verificationAttempts, 4);
});

test("failure de deployment é terminal, reverte imediatamente e preserva metadata", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  let fetched = false;
  let revertArgs;
  const db = fakeDb({
    existing: {
      id: 12,
      projectSlug: "context",
      status: "published",
      targetUrl,
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide", retained: true, verificationAttempts: 1 },
    },
  });
  const result = await verifyPublication(12, {
    db,
    deploymentState: async () => "failure",
    fetch: async () => {
      fetched = true;
      throw new Error("unexpected-fetch");
    },
    revertCommit: async (...args) => {
      revertArgs = args;
      return "revert1";
    },
  });

  assert.equal(fetched, false);
  assert.equal(revertArgs[1], "commit1");
  assert.equal(revertArgs[2], "head0");
  assert.equal(result.status, "reverted");
  assert.equal(result.reason, "verification:deployment-failed");
  assert.equal(result.metadata.title, "Context Guide");
  assert.equal(result.metadata.retained, true);
  assert.equal(result.metadata.verification.deployment, "failure");
  assert.equal(result.metadata.revertCommitSha, "revert1");
});

test("verifyPublication mantém status e mescla metadata quando HTML e sitemap são válidos", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  let finished = false;
  let reverted = false;
  const db = fakeDb({
    existing: {
      id: 9,
      projectSlug: "context",
      status: "updated",
      targetUrl,
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide" },
    },
    onFinish: () => { finished = true; },
  });
  const html = `<!doctype html>
    <html><head>
      <title>Context Guide | Context Keeper</title>
      <link href="${targetUrl}" rel="canonical">
      <meta content="index,follow" name="robots">
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>
    </head><body><h1>Context Guide</h1></body></html>`;
  const result = await verifyPublication(9, {
    db,
    deploymentState: async () => "success",
    fetch: async (url) => url === targetUrl
      ? new Response(html, { status: 200 })
      : new Response(`<urlset><url><loc>${targetUrl}</loc></url></urlset>`, { status: 200 }),
    revertCommit: async () => {
      reverted = true;
      return "revert1";
    },
  });

  assert.equal(result.status, "updated");
  assert.equal(result.metadata.verification.ok, true);
  assert.equal(result.metadata.verification.deployment, "success");
  assert.equal(finished, false);
  assert.equal(reverted, false);
});

test("verifyPublication reverte noindex por meta none ou X-Robots-Tag", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  const validHead = `
    <title>Context Guide</title>
    <link rel="canonical" href="${targetUrl}">
    <script type="application/ld+json">{"@type":"Article"}</script>`;
  for (const { html, headers } of [
    { html: `<head>${validHead}<meta name="robots" content="none"></head><h1>Context Guide</h1>`, headers: {} },
    { html: `<head>${validHead}</head><h1>Context Guide</h1>`, headers: { "x-robots-tag": "noindex, nofollow" } },
  ]) {
    const db = fakeDb({
      existing: {
        id: 11,
        projectSlug: "context",
        status: "published",
        targetUrl,
        commitSha: "commit1",
        previousSha: "head0",
        metadata: { title: "Context Guide" },
      },
    });
    const result = await verifyPublication(11, {
      db,
      deploymentState: async () => "success",
      fetch: async (url) => url === targetUrl
        ? new Response(html, { status: 200, headers })
        : new Response(`<urlset><url><loc>${targetUrl}</loc></url></urlset>`, { status: 200 }),
      revertCommit: async () => "revert1",
    });

    assert.equal(result.status, "reverted");
    assert.equal(result.reason, "verification:noindex");
  }
});

test("verifyPublication reverte cada falha terminal de página com razão estável", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  const validHtml = `<head>
    <title>Context Guide</title>
    <link rel="canonical" href="${targetUrl}">
    <script type="application/ld+json">{"@type":"Article"}</script>
  </head><h1>Context Guide</h1>`;
  const cases = [
    { reason: "http", status: 503, html: validHtml, sitemap: targetUrl },
    { reason: "content", status: 200, html: validHtml.replace("<h1>Context Guide</h1>", ""), sitemap: targetUrl },
    { reason: "canonical", status: 200, html: validHtml.replace(targetUrl, "https://context.nimblabs.com/blog/other"), sitemap: targetUrl },
    { reason: "jsonld", status: 200, html: validHtml.replace('{"@type":"Article"}', "{invalid"), sitemap: targetUrl },
    { reason: "sitemap", status: 200, html: validHtml, sitemap: "https://context.nimblabs.com/blog/other" },
  ];

  for (const [index, scenario] of cases.entries()) {
    let reverted = false;
    const db = fakeDb({
      existing: {
        id: 20 + index,
        projectSlug: "context",
        status: "published",
        targetUrl,
        commitSha: "commit1",
        previousSha: "head0",
        metadata: { title: "Context Guide" },
      },
    });
    const result = await verifyPublication(20 + index, {
      db,
      deploymentState: async () => "success",
      fetch: async (url) => url === targetUrl
        ? new Response(scenario.html, { status: scenario.status })
        : new Response(`<urlset><url><loc>${scenario.sitemap}</loc></url></urlset>`, { status: 200 }),
      revertCommit: async () => {
        reverted = true;
        return "revert1";
      },
    });

    assert.equal(result.status, "reverted", scenario.reason);
    assert.equal(result.reason, `verification:${scenario.reason}`, scenario.reason);
    assert.equal(reverted, true, scenario.reason);
  }
});

test("quinta tentativa pending reverte por commit novo e marca reverted", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  let revertArgs;
  const db = fakeDb({
    existing: {
      id: 10,
      projectSlug: "context",
      status: "published",
      targetUrl,
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide", verificationAttempts: 4 },
    },
  });
  const result = await verifyPublication(10, {
    db,
    deploymentState: async () => "pending",
    fetch: async () => {
      throw new Error("unexpected-fetch");
    },
    revertCommit: async (...args) => {
      revertArgs = args;
      return "revert1";
    },
  });

  assert.equal(revertArgs[1], "commit1");
  assert.equal(revertArgs[2], "head0");
  assert.equal(result.status, "reverted");
  assert.equal(result.reason, "verification:deployment-timeout");
  assert.equal(result.metadata.revertCommitSha, "revert1");
});
