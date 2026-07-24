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

test("OpenAI pesquisa e gera draft estruturado com payloads estáveis", async () => {
  const { image, ...normalizedDraft } = draft;
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
        output_text: JSON.stringify(normalizedDraft),
        usage: { input_tokens: 5, output_tokens: 6 },
      });
  };

  const result = await withEnv({ OPENAI_API_KEY: "test-openai-key" }, () => researchAndDraft({
    project: projectBySlug("context"),
    candidate: { action: "new", targetPath: null, query: "daily guide" },
    inventory: [],
    runDate: "2026-07-24",
  }, fetchImpl));

  assert.deepEqual(result, {
    action: "new",
    targetPath: null,
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
