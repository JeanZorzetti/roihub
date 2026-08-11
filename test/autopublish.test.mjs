import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { PROJECTS, projectBySlug } from "../lib/autopublish-projects.mjs";
import { authorized, missingEnv, rankCandidates, validateDraft, estimateCost, validTransition } from "../lib/autopublish-core.mjs";
import { extractInventory, renderDraft, catalogUpsert, guiaUpsert, registryUpsert } from "../lib/autopublish-render.mjs";
import { gscQueryPages, inspectUrl, mergeGscWindows } from "../lib/gsc.ts";
import {
  claudeError,
  claudeRun,
  claudeTokens,
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
import { parseProjectStateFields } from "../app/automacao/action-fields.mjs";

const draft = {
  slug: "daily-guide",
  title: "Daily Guide",
  description: "A sourced daily guide for a specific search intent.",
  primaryKeyword: "daily guide",
  cluster: "operations",
  bluf: "This concise answer explains the decision, summarizes the evidence behind it, identifies the practical next action, clarifies who owns each step, and defines the metrics needed to verify results. It gives readers enough context to act while leaving detailed examples and implementation guidance for the sections that follow.",
  sections: [{ heading: "How it works", paragraphs: ["Use the existing workflow.", "Measure the result."] }],
  faqs: [{ q: "Does it work?", a: "Yes, when the stated preconditions are met." }],
  relatedSlugs: ["existing-guide"],
  sources: [{ url: "https://example.org", title: "Example", publisher: "Example", publishedAt: "2026-01-01" }],
  image: { src: "https://images.unsplash.com/photo-x", alt: "Team reviewing a workflow", credit: "Photo by A on Unsplash" },
  publishedAt: "2026-07-24",
};

const catalogFixture = Object.freeze({
  slug: "catalog-fixture",
  repository: "JeanZorzetti/fixture",
  branch: "main",
  siteUrl: "https://fixture.example",
  contentPath: "lib/blog.ts",
  imagePath: "public/blog",
  renderer: "typescript-catalog",
  schema: "nimblabs",
  language: "en-US",
  author: "fixture editorial",
  conversionUrl: "https://fixture.example/",
  risk: "standard",
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

async function withEnv(values, operation) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
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
    bluf: "Preserve decisions, constraints, current state, and the next concrete action in one concise handoff. This lets the next engineering session continue without repeating discovery, losing implementation context, or reopening settled tradeoffs. Include ownership, verification evidence, known blockers, and the exact files or systems that the next step must change.",
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

test("cron auth falha fechado", () => {
  assert.equal(authorized("Bearer secret", ""), false);
  assert.equal(authorized("Bearer ", ""), false);
  assert.equal(authorized("", ""), false);
  assert.equal(authorized("Bearer secret ", "secret"), false);
  assert.equal(authorized(`Bearer ${"x".repeat(500)}`, "secret"), false);
  assert.equal(authorized(`Bearer ${"x".repeat(500)}`, "x".repeat(500)), false);
});

test("produção lista somente nomes das envs ausentes em ordem estável", () => {
  assert.deepEqual(
    missingEnv({
      CRON_SECRET: " \t",
      DATABASE_URL: "x",
      GITHUB_TOKEN: 7,
      GOOGLE_SERVICE_ACCOUNT_JSON: "x",
      CLAUDE_CODE_OAUTH_TOKEN: "",
      UNSPLASH_ACCESS_KEY: undefined,
    }),
    ["CLAUDE_CODE_OAUTH_TOKENS", "CRON_SECRET", "GITHUB_TOKEN", "UNSPLASH_ACCESS_KEY"]
  );
});

// O teste de fallback abaixo passava verde enquanto produção devolvia 500 em TODA rota:
// deletar globais em Node não reproduz o Edge Runtime, que PROÍBE a API mesmo sob `?.`.
// Este check olha o código-fonte, que é o que o bundler do Next enxerga.
test("módulo importado pelo middleware não referencia API Node proibida no Edge", () => {
  const source = readFileSync(new URL("../lib/autopublish-core.mjs", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  for (const forbidden of ["getBuiltinModule", "node:crypto", "node:fs", "require("]) {
    assert.ok(
      !source.includes(forbidden),
      `${forbidden} em autopublish-core.mjs derruba o middleware inteiro no Edge Runtime`
    );
  }
});

test("cron auth compara no fallback Edge sem node:crypto ou Buffer", () => {
  const edge = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    globalThis.Buffer = undefined;
    process.getBuiltinModule = undefined;
    const { authorized } = await import("./lib/autopublish-core.mjs");
    assert.equal(authorized("Bearer secret", "secret"), true);
    assert.equal(authorized("Bearer wrong", "secret"), false);
  `], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(edge.status, 0, edge.stderr);
});

test("route usa Node e limite de quinze minutos", async () => {
  const route = await import("../app/api/seo/autopublish/route.ts");
  assert.equal(route.runtime, "nodejs");
  // 240s medidos em produção por publicação, mais o classificador YMYL.
  assert.equal(route.maxDuration, 900);
  assert.equal(typeof route.POST, "function");
});

test("route rejeita Bearer inválido sem expor a requisição", async () => {
  const { POST } = await import("../app/api/seo/autopublish/route.ts");
  await withEnv({ CRON_SECRET: "route-secret" }, async () => {
    for (const authorization of [null, "Basic route-secret", "Bearer  route-secret", `Bearer ${"x".repeat(500)}`]) {
      const headers = authorization ? { authorization } : {};
      const response = await POST(new Request("http://localhost/api/seo/autopublish", {
        method: "POST",
        headers,
        body: '{"secretBody":"must-not-leak"}',
      }));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "unauthorized" });
    }
  });
});

test("route rejeita JSON e unions fora do formato exato", async () => {
  const { POST } = await import("../app/api/seo/autopublish/route.ts");
  const bodies = [
    "{",
    "null",
    "[]",
    JSON.stringify({ phase: "unknown" }),
    JSON.stringify({ phase: "publish", project: "missing", runDate: "2026-07-24" }),
    JSON.stringify({ phase: "publish", project: "context", runDate: "2026-02-30" }),
    JSON.stringify({ phase: "publish", project: "context", runDate: "2026-07-24", dryRun: "true" }),
    JSON.stringify({ phase: "publish", project: "context", runDate: "2026-07-24", extra: true }),
    JSON.stringify({ phase: "verify", publicationId: 0 }),
    JSON.stringify({ phase: "verify", publicationId: 1.5 }),
    JSON.stringify({ phase: "verify", publicationId: 1, extra: true }),
  ];
  await withEnv({ CRON_SECRET: "route-secret" }, async () => {
    for (const body of bodies) {
      const response = await POST(new Request("http://localhost/api/seo/autopublish", {
        method: "POST",
        headers: { authorization: "Bearer route-secret" },
        body,
      }));
      assert.equal(response.status, 400, body);
      assert.deepEqual(await response.json(), { error: "invalid-request" }, body);
    }
  });
});

test("route lista somente envs ausentes antes de publicar", async () => {
  const { POST } = await import("../app/api/seo/autopublish/route.ts");
  await withEnv({
    CRON_SECRET: "route-secret",
    DATABASE_URL: undefined,
    GITHUB_TOKEN: undefined,
    GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
    CLAUDE_CODE_OAUTH_TOKEN: undefined,
    UNSPLASH_ACCESS_KEY: undefined,
  }, async () => {
    const response = await POST(new Request("http://localhost/api/seo/autopublish", {
      method: "POST",
      headers: { authorization: "Bearer route-secret" },
      body: JSON.stringify({
        phase: "publish",
        project: "context",
        runDate: "2026-07-24",
        dryRun: true,
      }),
    }));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "missing-env",
      fields: [
        "CLAUDE_CODE_OAUTH_TOKENS",
        "DATABASE_URL",
        "GITHUB_TOKEN",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
        "UNSPLASH_ACCESS_KEY",
      ],
    });
  });
});

test("handler HTTP retorna 200 estável para publish e verify", async () => {
  const { handleAutopublish } = await import("../app/api/seo/autopublish/handler.ts");
  const env = {
    CRON_SECRET: "route-secret",
    DATABASE_URL: "postgres://db",
    GITHUB_TOKEN: "github",
    GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
    CLAUDE_CODE_OAUTH_TOKEN: "claude",
    UNSPLASH_ACCESS_KEY: "unsplash",
  };
  let publishArgs;
  const dependencies = {
    env,
    publishProject: async (...args) => {
      publishArgs = args;
      return { id: 7, status: "published", reason: null };
    },
    verifyPublication: async (id) => ({ id, status: "pending", attempt: 1, deployment: "pending" }),
  };
  const request = (body) => new Request("http://localhost/api/seo/autopublish", {
    method: "POST",
    headers: { authorization: "Bearer route-secret" },
    body: JSON.stringify(body),
  });

  const published = await handleAutopublish(request({
    phase: "publish",
    project: "context",
    runDate: "2026-07-24",
    dryRun: true,
  }), dependencies);
  assert.equal(published.status, 200);
  assert.deepEqual(await published.json(), { id: 7, status: "published", reason: null });
  assert.deepEqual(publishArgs, ["context", "2026-07-24", { dryRun: true }]);

  const verified = await handleAutopublish(request({
    phase: "verify",
    publicationId: 7,
  }), dependencies);
  assert.equal(verified.status, 200);
  assert.deepEqual(await verified.json(), {
    id: 7,
    status: "pending",
    attempt: 1,
    deployment: "pending",
  });
});

test("handler HTTP converte github-conflict em 409 estável", async () => {
  const { handleAutopublish } = await import("../app/api/seo/autopublish/handler.ts");
  const response = await handleAutopublish(new Request("http://localhost/api/seo/autopublish", {
    method: "POST",
    headers: { authorization: "Bearer route-secret" },
    body: JSON.stringify({
      phase: "publish",
      project: "context",
      runDate: "2026-07-24",
    }),
  }), {
    env: {
      CRON_SECRET: "route-secret",
      DATABASE_URL: "postgres://db",
      GITHUB_TOKEN: "github",
      GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
      CLAUDE_CODE_OAUTH_TOKEN: "claude",
      UNSPLASH_ACCESS_KEY: "unsplash",
    },
    publishProject: async () => ({ status: "blocked", reason: "github-conflict" }),
    verifyPublication: async () => {
      throw new Error("unexpected-verify");
    },
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "github-conflict" });
});

test("handler HTTP preserva 409 quando verify encontra conflito no rollback", async () => {
  const { handleAutopublish } = await import("../app/api/seo/autopublish/handler.ts");
  const db = fakeDb({
    existing: {
      id: 43,
      projectSlug: "context",
      status: "published",
      targetUrl: "https://context.nimblabs.com/blog/context-guide",
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide" },
    },
  });
  const response = await handleAutopublish(new Request("http://localhost/api/seo/autopublish", {
    method: "POST",
    headers: { authorization: "Bearer route-secret" },
    body: JSON.stringify({ phase: "verify", publicationId: 43 }),
  }), {
    env: {
      CRON_SECRET: "route-secret",
      DATABASE_URL: "postgres://db",
      GITHUB_TOKEN: "github",
      GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
      CLAUDE_CODE_OAUTH_TOKEN: "claude",
      UNSPLASH_ACCESS_KEY: "unsplash",
    },
    publishProject: async () => {
      throw new Error("unexpected-publish");
    },
    verifyPublication: (id) => verifyPublication(id, {
      db,
      deploymentState: async () => "failure",
      revertCommit: async () => {
        throw new Error("github-conflict");
      },
      fetch: async () => {
        throw new Error("unexpected-fetch");
      },
    }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "github-conflict" });
});

test("handler HTTP retorna 503 para env ausente e banco indisponível", async () => {
  const { handleAutopublish } = await import("../app/api/seo/autopublish/handler.ts");
  const request = () => new Request("http://localhost/api/seo/autopublish", {
    method: "POST",
    headers: { authorization: "Bearer route-secret" },
    body: JSON.stringify({
      phase: "publish",
      project: "context",
      runDate: "2026-07-24",
    }),
  });
  const unavailable = {
    publishProject: async () => {
      throw new Error("database");
    },
    verifyPublication: async () => {
      throw new Error("unexpected-verify");
    },
  };

  const missing = await handleAutopublish(request(), {
    ...unavailable,
    env: { CRON_SECRET: "route-secret" },
  });
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), {
    error: "missing-env",
    fields: [
      "CLAUDE_CODE_OAUTH_TOKENS",
      "DATABASE_URL",
      "GITHUB_TOKEN",
      "GOOGLE_SERVICE_ACCOUNT_JSON",
      "UNSPLASH_ACCESS_KEY",
    ],
  });

  const database = await handleAutopublish(request(), {
    ...unavailable,
    env: {
      CRON_SECRET: "route-secret",
      DATABASE_URL: "postgres://db",
      GITHUB_TOKEN: "github",
      GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
      CLAUDE_CODE_OAUTH_TOKEN: "claude",
      UNSPLASH_ACCESS_KEY: "unsplash",
    },
  });
  assert.equal(database.status, 503);
  assert.deepEqual(await database.json(), { error: "database-unavailable" });
});

test("handler HTTP expõe só nomes de envs ausentes, nunca valores", async () => {
  const { handleAutopublish } = await import("../app/api/seo/autopublish/handler.ts");
  const response = await handleAutopublish(new Request("http://localhost/api/seo/autopublish", {
    method: "POST",
    headers: { authorization: "Bearer route-secret" },
    body: JSON.stringify({
      phase: "publish",
      project: "context",
      runDate: "2026-07-24",
    }),
  }), {
    env: {
      CRON_SECRET: "route-secret",
      DATABASE_URL: "postgres://must-not-leak",
      GITHUB_TOKEN: " ",
      GOOGLE_SERVICE_ACCOUNT_JSON: "{}",
      CLAUDE_CODE_OAUTH_TOKEN: "",
      UNSPLASH_ACCESS_KEY: "unsplash-must-not-leak",
    },
    publishProject: async () => {
      throw new Error("unexpected-publish");
    },
    verifyPublication: async () => {
      throw new Error("unexpected-verify");
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "missing-env",
    fields: ["CLAUDE_CODE_OAUTH_TOKENS", "GITHUB_TOKEN"],
  });
});

test("middleware isola Bearer do cron sem enfraquecer Basic Auth", async () => {
  const [{ middleware }, { NextRequest }] = await Promise.all([
    import("../middleware.ts"),
    import("next/server.js"),
  ]);
  await withEnv({
    CRON_SECRET: "route-secret",
    HUB_USER: "roi",
    HUB_PASS: "hub-pass",
  }, async () => {
    const cron = (authorization) => middleware(new NextRequest(
      "http://localhost/api/seo/autopublish",
      { headers: { authorization } }
    ));
    assert.equal(cron("Bearer route-secret").headers.get("x-middleware-next"), "1");
    assert.equal(cron(`Basic ${Buffer.from("roi:hub-pass").toString("base64")}`).status, 401);
    const rejected = cron("Bearer wrong");
    assert.equal(rejected.status, 401);
    assert.deepEqual(await rejected.json(), { error: "unauthorized" });

    const page = middleware(new NextRequest("http://localhost/seo", {
      headers: {
        authorization: `Basic ${Buffer.from("roi:hub-pass").toString("base64")}`,
      },
    }));
    assert.equal(page.headers.get("x-middleware-next"), "1");
    const pageRejected = middleware(new NextRequest("http://localhost/seo", {
      headers: { authorization: "Bearer route-secret" },
    }));
    assert.equal(pageRejected.status, 401);
    assert.equal(pageRejected.headers.get("www-authenticate"), 'Basic realm="roihub"');
  });
});

test("workflow agenda a meia-noite BRT fora da hora cheia, com dispatch dry-run seguro", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/seo-autopublish.yml", import.meta.url),
    "utf8"
  ).replaceAll("\r\n", "\n");
  // Comparar o arquivo inteiro quebrava a cada comentário; o que precisa valer é isto.
  const [minute, hour] = String(workflow.match(/- cron: "([^"]+)"/)?.[1]).split(" ");
  assert.equal(hour, "3", "3 UTC = meia-noite em São Paulo");
  // Na hora cheia o schedule do Actions atrasa e chega a não criar o run (25/07).
  assert.notEqual(minute, "0");
  assert.match(workflow, /dry_run:\n {8}type: boolean\n {8}default: true/);
  assert.match(workflow, /DRY_RUN: \$\{\{ inputs\.dry_run \|\| 'false' \}\}/);
  assert.match(workflow, /- run: node scripts\/run-autopublish\.mjs/);
});

test("runner exporta os dez slugs e calcula a data de São Paulo", async () => {
  const runner = await import("../scripts/run-autopublish.mjs");
  assert.deepEqual(runner.PROJECT_SLUGS, [
    "goiania",
    "tapepro",
    "sirius",
    "fabrica",
    "roilabs",
    "polarisia",
    "estetiacrm",
    "reviewshield",
    "context",
    "aftercare",
  ]);
  assert.equal(typeof runner.runAutopublish, "function");
  assert.equal(runner.runDateInSaoPaulo(new Date("2026-07-24T02:59:59.000Z")), "2026-07-23");
  assert.equal(runner.runDateInSaoPaulo(new Date("2026-07-24T03:00:00.000Z")), "2026-07-24");
});

test("a fila gira um projeto por dia e continua sendo os mesmos dez", async () => {
  const { PROJECT_SLUGS, projectQueue } = await import("../scripts/run-autopublish.mjs");
  const dia1 = projectQueue("2026-07-25");
  const dia2 = projectQueue("2026-07-26");

  assert.deepEqual([...dia1].sort(), [...PROJECT_SLUGS].sort());
  assert.notDeepEqual(dia1, dia2);
  assert.equal(dia2[0], dia1[1]);
  assert.equal(dia2.at(-1), dia1[0]);
  // Em dez dias todo projeto passa por todas as dez posições — ninguém é sempre o último.
  const ultimos = new Set(
    Array.from({ length: 10 }, (_, i) => projectQueue(`2026-07-${String(10 + i).padStart(2, "0")}`).at(-1))
  );
  assert.equal(ultimos.size, PROJECT_SLUGS.length);
  assert.deepEqual(projectQueue("nao-e-data"), PROJECT_SLUGS);
});

test("runner rejeita configuração ausente ou DRY_RUN inválido sem chamar nem registrar", async () => {
  const { runAutopublish } = await import("../scripts/run-autopublish.mjs");
  for (const env of [
    { HUB_URL: " ", HUB_CRON_SECRET: "secret", DRY_RUN: "true" },
    { HUB_URL: "https://hub.example", HUB_CRON_SECRET: "\t", DRY_RUN: "true" },
    { HUB_URL: "https://hub.example", HUB_CRON_SECRET: "secret", DRY_RUN: "yes" },
    { HUB_URL: "https://hub.example", HUB_CRON_SECRET: "secret" },
  ]) {
    let called = false;
    let logged = false;
    const exitCode = await runAutopublish({
      env,
      fetchImpl: async () => {
        called = true;
        throw new Error("unexpected-fetch");
      },
      log: () => {
        logged = true;
      },
    });
    assert.equal(exitCode, 1);
    assert.equal(called, false);
    assert.equal(logged, false);
  }
});

test("runner dry-run publica dez resumos sem verificar nem esperar", async () => {
  const { PROJECT_SLUGS, runAutopublish } = await import("../scripts/run-autopublish.mjs");
  const requests = [];
  const sleeps = [];
  const logs = [];
  const exitCode = await runAutopublish({
    env: {
      HUB_URL: "https://hub.example",
      HUB_CRON_SECRET: "runner-secret",
      DRY_RUN: "true",
    },
    now: new Date("2026-07-24T02:59:59.000Z"),
    fetchImpl: async (url, init) => {
      requests.push({ url, init, body: JSON.parse(init.body) });
      return jsonResponse({
        status: "dry-run",
        action: "new",
        reason: "arbitrary response must not be logged",
      });
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    log: (line) => logs.push(line),
  });

  assert.equal(exitCode, 0);
  const { projectQueue } = await import("../scripts/run-autopublish.mjs");
  assert.equal(requests.length, PROJECT_SLUGS.length);
  assert.deepEqual(requests.map(({ body }) => body.project), projectQueue("2026-07-23"));
  for (const { url, init, body } of requests) {
    assert.equal(url, "https://hub.example/api/seo/autopublish");
    assert.equal(init.method, "POST");
    assert.equal(init.headers.authorization, "Bearer runner-secret");
    assert.equal(body.phase, "publish");
    assert.equal(body.runDate, "2026-07-23");
    assert.equal(body.dryRun, true);
  }
  assert.deepEqual(sleeps, []);
  assert.equal(logs.length, PROJECT_SLUGS.length);
  assert.ok(logs.every((line) => /^slug=[a-z0-9-]+ status=dry-run$/.test(line)));
  assert.ok(logs.every((line) => !line.includes("runner-secret") && !line.includes("arbitrary")));
});

test("runner real verifica commits em no máximo cinco rounds", async () => {
  const { PROJECT_SLUGS, runAutopublish } = await import("../scripts/run-autopublish.mjs");
  const requests = [];
  const sleeps = [];
  const logs = [];
  const attempts = new Map();
  const exitCode = await runAutopublish({
    env: {
      HUB_URL: "https://hub.example",
      HUB_CRON_SECRET: "runner-secret",
      DRY_RUN: "false",
    },
    now: new Date("2026-07-24T12:00:00.000Z"),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (body.phase === "publish") {
        if (body.project === "goiania") return jsonResponse({ id: 1, status: "published" });
        if (body.project === "sirius") return jsonResponse({ id: 2, status: "updated" });
        return jsonResponse({ id: 100, status: "blocked", reason: "global-disabled" });
      }
      const attempt = (attempts.get(body.publicationId) ?? 0) + 1;
      attempts.set(body.publicationId, attempt);
      if (body.publicationId === 2) {
        return jsonResponse({ id: 2, status: "reverted", reason: "verification:http" });
      }
      return jsonResponse(attempt < 5
        ? { id: 1, status: "pending", reason: "arbitrary response must not be logged" }
        : { id: 1, status: "published" });
    },
    sleep: async (milliseconds) => sleeps.push(milliseconds),
    log: (line) => logs.push(line),
  });

  assert.equal(exitCode, 1);
  assert.equal(requests.filter(({ phase }) => phase === "publish").length, PROJECT_SLUGS.length);
  const verifies = requests.filter(({ phase }) => phase === "verify");
  assert.equal(verifies.length, 6);
  assert.equal(verifies.filter(({ publicationId }) => publicationId === 1).length, 5);
  assert.equal(verifies.filter(({ publicationId }) => publicationId === 2).length, 1);
  assert.ok(verifies.every((body) => Object.keys(body).sort().join(",") === "phase,publicationId"));
  assert.deepEqual(sleeps, [90_000, 60_000, 60_000, 60_000, 60_000]);
  assert.ok(logs.every((line) => !line.includes("runner-secret") && !line.includes("arbitrary")));
});

test("runner trata blocked como resultado editorial", async () => {
  const { runAutopublish } = await import("../scripts/run-autopublish.mjs");
  let verifies = 0;
  let sleeps = 0;
  const exitCode = await runAutopublish({
    env: {
      HUB_URL: "https://hub.example",
      HUB_CRON_SECRET: "runner-secret",
      DRY_RUN: "false",
    },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.phase === "verify") verifies += 1;
      return jsonResponse({ id: 1, status: "blocked", reason: "project-disabled" });
    },
    sleep: async () => {
      sleeps += 1;
    },
    log: () => {},
  });
  assert.equal(exitCode, 0);
  assert.equal(verifies, 0);
  assert.equal(sleeps, 0);
});

test("runner retorna não-zero para publish failed", async () => {
  const { runAutopublish } = await import("../scripts/run-autopublish.mjs");
  const exitCode = await runAutopublish({
    env: {
      HUB_URL: "https://hub.example",
      HUB_CRON_SECRET: "runner-secret",
      DRY_RUN: "false",
    },
    fetchImpl: async (_url, init) => {
      const { project } = JSON.parse(init.body);
      return jsonResponse(project === "context"
        ? { status: "failed", reason: "llm-output" }
        : { status: "blocked", reason: "project-disabled" });
    },
    sleep: async () => {
      throw new Error("unexpected-sleep");
    },
    log: () => {},
  });
  assert.equal(exitCode, 1);
});

test("runner falha fechado para resultados incompatíveis com a fase", async () => {
  const { runAutopublish } = await import("../scripts/run-autopublish.mjs");
  const env = {
    HUB_URL: "https://hub.example",
    HUB_CRON_SECRET: "runner-secret",
    DRY_RUN: "false",
  };
  const logs = [];
  const missingId = await runAutopublish({
    env,
    fetchImpl: async () => jsonResponse({ status: "published" }),
    sleep: async () => {
      throw new Error("unexpected-sleep");
    },
    log: (line) => logs.push(line),
  });
  assert.equal(missingId, 1);

  const wrongVerifyStatus = await runAutopublish({
    env,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.phase === "verify") return jsonResponse({ id: 1, status: "dry-run" });
      return jsonResponse(body.project === "context"
        ? { id: 1, status: "published" }
        : { status: "blocked", reason: "project-disabled" });
    },
    sleep: async () => {},
    log: (line) => logs.push(line),
  });
  assert.equal(wrongVerifyStatus, 1);
  assert.ok(logs.some((line) => line.endsWith("status=failed reason=invalid-result")));
});

test("runner executado diretamente propaga exit code sem vazar env", () => {
  const child = spawnSync(process.execPath, ["scripts/run-autopublish.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      HUB_URL: ":",
      HUB_CRON_SECRET: "entry-secret",
      DRY_RUN: "false",
    },
    encoding: "utf8",
  });
  assert.equal(child.status, 1);
  assert.ok(!`${child.stdout}${child.stderr}`.includes("entry-secret"));
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
    bluf: "Clinic operations software can standardize administrative workflows, automate reminders, track response time, centralize communication, and measure completion rates. Teams can configure responsibilities, review dashboard metrics, document business processes, and improve scheduling follow up while keeping the platform limited to operational coordination instead of professional health guidance.",
    sections: [{ heading: "What to measure", paragraphs: ["Track response time and completion rate."] }],
    faqs: [],
    relatedSlugs: [],
    sources: [{ url: "https://example.org/source", title: "Source", publisher: "Example", publishedAt: "2026-01-01" }],
  };
  assert.deepEqual(validateDraft(base, projectBySlug("aftercare"), "operational"), []);
  const disguisedClinical = {
    ...base,
    title: "Clinic workflow preparation",
    description: "A clinic workflow software guide for preparation.",
    primaryKeyword: "clinic workflow preparation",
    bluf: "Clinic workflow software should tell people to fast before surgery.",
    sections: [{
      heading: "Workflow automation",
      paragraphs: ["Use the clinic workflow software to tell people to fast before surgery."],
    }],
  };
  assert.ok(validateDraft(
    disguisedClinical,
    projectBySlug("aftercare"),
    "operational"
  ).includes("ymyl"));
  assert.ok(validateDraft(
    base,
    projectBySlug("aftercare"),
    "uncertain"
  ).includes("ymyl"));
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
  }, projectBySlug("aftercare"), "operational"), []);
  assert.ok(validateDraft({ ...base, sources: [] }, projectBySlug("aftercare")).includes("sources"));
  assert.ok(validateDraft({
    ...base,
    sources: [
      base.sources[0],
      { url: "http://example.org/other", title: "Other", publisher: "", publishedAt: "not-a-date" },
    ],
  }, projectBySlug("aftercare"), "operational").includes("sources"));
  assert.ok(validateDraft({
    ...base,
    bluf: "Too short for a useful answer.",
  }, projectBySlug("aftercare"), "operational").includes("bluf"));
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

test("registry TypeScript rejeita aliases orfaos, duplicados e bindings colidentes", () => {
  const malformed = [
    `import { post as existingPost } from './posts/existing-guide'
export const blogPosts: BlogPost[] = []`,
    `import { post as existingPost } from './posts/existing-guide'
export const blogPosts: BlogPost[] = [existingPost, missingPost]`,
    `import { post as existingPost } from './posts/existing-guide'
import { post as existingPost } from './posts/existing-guide'
export const blogPosts: BlogPost[] = [existingPost]`,
    `import { post as existingPost } from './posts/existing-guide'
const autoContextGuidePost = 1
export const blogPosts: BlogPost[] = [existingPost]`,
  ];
  for (const source of malformed) {
    assert.throws(() => registryUpsert(source, "context-guide"), /registry-format/);
  }
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
    extractInventory([{ path: "lib/blog.ts", content: catalog }], catalogFixture).map(({ slug, title, primaryKeyword }) => ({ slug, title, primaryKeyword })),
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

  const catalog = renderDraft(hostile, catalogFixture, "export const posts = [];");
  assert.ok(!catalog.content.includes("<script"));
});

// A lista de seed era hardcoded e ficou dessincronizada de PROJECTS quando o tapepro
// entrou: sem linha em seo_projects, db.enabled() devolve false e o projeto fica
// "project-disabled" para sempre, sem erro nenhum.
// A UI iterava data/projects.json (lista da agenda) em vez de PROJECTS: o tapepro ficou
// ativo e sem controle de pausa na tela, e o nimblabs removido continuou aparecendo.
test("controles da UI cobrem exatamente os projetos do autopublishing", () => {
  const source = readFileSync(new URL("../app/automacao/publications.tsx", import.meta.url), "utf8");
  assert.match(source, /PROJECTS\.map\(/, "os controles precisam derivar de PROJECTS");
  assert.doesNotMatch(
    source,
    /\{projects\.map\(/,
    "iterar data/projects.json deixa projeto do autopublishing sem controle"
  );
});

test("seed de seo_projects cobre todo projeto configurado", () => {
  const source = readFileSync(new URL("../lib/db.ts", import.meta.url), "utf8");
  assert.match(source, /PROJECTS\.map\(/, "o seed precisa derivar de PROJECTS, não de uma lista fixa");
  for (const { slug } of PROJECTS) {
    assert.ok(!new RegExp(`\\('${slug}', FALSE`).test(source), `${slug} hardcoded no seed`);
  }
});

test("Tapepro gera frontmatter pt-BR válido com imagem como asset local relativo", () => {
  const project = projectBySlug("tapepro");
  const withBytes = { ...draft, image: { ...draft.image, base64: "d2VicA==" } };
  const rendered = renderDraft(withBytes, project, null);

  assert.equal(rendered.path, "src/content/blog/daily-guide.mdx");
  // O MDX está em src/content/blog e o asset em src/assets/conteudo: dois níveis acima.
  assert.match(rendered.content, /^imagem: "\.\.\/\.\.\/assets\/conteudo\/daily-guide\.jpg"$/m);
  assert.deepEqual(rendered.imageFile, {
    path: "src/assets/conteudo/daily-guide.jpg",
    base64: "d2VicA==",
  });

  // Todo campo obrigatório do zod em src/content.config.ts precisa existir.
  for (const field of [
    "titulo", "h1", "descricao", "intencao", "resumo",
    "publicadoEm", "tempoLeituraMin", "imagem", "imagemAlt",
  ]) {
    assert.match(rendered.content, new RegExp(`^${field}:`, "m"), `faltou ${field}`);
  }

  const frontmatter = rendered.content.split("---")[1];
  const descricao = frontmatter.match(/^descricao: "(.*)"$/m)[1];
  assert.ok(descricao.length <= 160, `descricao passou de 160: ${descricao.length}`);
  assert.match(frontmatter, /^publicadoEm: 2026-07-24$/m);
  assert.match(frontmatter, /^tempoLeituraMin: [1-9]\d*$/m);
  assert.ok(rendered.content.includes("## Fontes"));
  assert.ok(rendered.content.includes("Photo by A on Unsplash"));
});

test("corpo mdx não repete o que o layout do projeto já renderiza do frontmatter", () => {
  // context/aftercare renderizam capa, FAQ e related; polarisia não renderiza nenhum dos três.
  const context = renderDraft(draft, projectBySlug("context"), null).content;
  const [, contextFrontmatter, ...contextBody] = context.split("---");
  const corpo = contextBody.join("---");

  assert.match(contextFrontmatter, /^heroImage:$/m, "o frontmatter continua levando a capa");
  assert.match(contextFrontmatter, /^faq:$/m);
  assert.ok(!corpo.includes("!["), "capa duplicada no corpo");
  assert.ok(!/^## Frequently asked questions$/m.test(corpo), "FAQ duplicada no corpo");
  assert.ok(!/^## Related guides$/m.test(corpo), "related duplicado no corpo");
  assert.ok(corpo.includes("## Sources"), "fontes só existem no corpo");

  const polarisia = renderDraft(draft, projectBySlug("polarisia"), null).content;
  assert.ok(polarisia.includes("!["), "polarisia não renderiza capa no layout: ela fica no corpo");
  assert.ok(/^## Perguntas frequentes$/m.test(polarisia));

  // roilabs (markdown): o Article.astro imprime o bloco de FAQ do frontmatter, a capa não.
  const roilabs = renderDraft(draft, projectBySlug("roilabs"), null).content;
  const corpoRoilabs = roilabs.replace(/^---\n[\s\S]*?\n---\n/, "");
  assert.match(roilabs, /^faq:$/m);
  assert.ok(!/^## Perguntas frequentes$/m.test(corpoRoilabs), "FAQ duplicada no corpo do roilabs");
  assert.ok(corpoRoilabs.includes("!["), "capa do roilabs sai no corpo");
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

test("researchAndDraft leva o editorialFocus do projeto pro prompt", async () => {
  // Sem essa linha o modelo escolhe a pauta pela impressão do GSC, que é justamente o
  // cluster errado nos projetos com dois públicos (aftercare: paciente vs clínica).
  const prompts = [];
  const capture = async (prompt) => {
    prompts.push(prompt);
    return { output_text: "no json here" };
  };
  await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "claude" }, async () => {
    for (const slug of ["aftercare", "context"]) {
      await assert.rejects(() => researchAndDraft({ project: projectBySlug(slug) }, capture), /llm-output/);
    }
  });
  assert.match(prompts[0], /EDITORIAL FOCUS for this project: B2B clinic operations/);
  // `context` não tem foco declarado: nada de linha vazia no prompt.
  assert.doesNotMatch(prompts[1], /EDITORIAL FOCUS/);
});

test("researchAndDraft converte saída malformada em llm-output sanitizado", async () => {
  await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "claude" }, async () => {
    for (const response of [
      { body: "secret prompt echo", output: [null, { content: null }, { content: [null, 1] }] },
      { output_text: "secret prompt echo, no JSON here" },
      { output_text: "{ not json at all }" },
      { output_text: JSON.stringify(["array", "not", "object"]) },
      { output_text: "```json\n{\"decision\":{\"action\":\"new\"}}\n```" },
    ]) {
      await assert.rejects(
        () => researchAndDraft({}, async () => response),
        (error) => error instanceof Error
          && error.message === "llm-output"
          && !error.message.includes("secret prompt echo")
      );
    }
  });
});

test("GitHub tree aceita apenas blobs do contentPath e registry configurado", () => {
  const tree = [
    { type: "blob", path: "lib/blog/posts/a.ts", sha: "1" },
    { type: "blob", path: "lib/blog/index.ts", sha: "2" },
    { type: "tree", path: "lib/blog/posts/nested", sha: "3" },
    { type: "blob", path: ".env", sha: "4" },
  ];
  assert.deepEqual(githubTreeFiles(tree, {
    contentPath: "lib/blog/posts",
    registryPath: "lib/blog/index.ts",
  }), [
    { path: "lib/blog/posts/a.ts", sha: "1" },
    { path: "lib/blog/index.ts", sha: "2" },
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

test("GSC estrito tenta tres vezes e falha fechado", async () => {
  let requests = 0;
  const delays = [];
  const client = {
    request: async () => {
      requests += 1;
      throw new Error("network details");
    },
  };
  await assert.rejects(
    () => gscQueryPages("https://x.test", {
      client,
      strict: true,
      sleep: async (delay) => delays.push(delay),
    }),
    /gsc-unavailable/
  );
  assert.equal(requests, 3);
  assert.deepEqual(delays, [250, 500]);
});

test("claude-cli pesquisa e decide update sem copiar a heurística do candidato", async () => {
  const { image, ...normalizedDraft } = draft;
  const targetPath = "apps/web/content/blog/daily-guide.mdx";
  const calls = [];
  const run = async (prompt, options) => {
    calls.push({ prompt, options });
    return {
      output_text: "```json\n" + JSON.stringify({
        decision: {
          action: "update",
          targetPath,
          overlap: "same",
          reason: "The inventory already covers the same search intent.",
        },
        draft: normalizedDraft,
      }) + "\n```",
      usage: { input_tokens: 8, output_tokens: 10 },
    };
  };

  const result = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () => researchAndDraft({
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
  }, run));

  assert.deepEqual(result, {
    action: "update",
    targetPath,
    overlap: "same",
    reason: "The inventory already covers the same search intent.",
    draft: normalizedDraft,
    usage: { inputTokens: 8, outputTokens: 10, webSearchCalls: 1, generatedImage: false },
  });
  // Uma chamada só: pesquisa e decisão no mesmo turno cabem no maxDuration da rota.
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.webSearch, true);
  assert.match(calls[0].prompt, /Do not copy the candidate heuristic/);
  assert.match(calls[0].prompt, /between 40 and 60 words/);
  assert.ok(calls[0].prompt.includes(targetPath));
  assert.ok(calls[0].prompt.includes('"required":["action","targetPath","overlap","reason"]'));
});

test("claude-cli classifica Aftercare em chamada independente sem WebSearch", async () => {
  const { image, ...normalizedDraft } = draft;
  const calls = [];
  const run = async (prompt, options) => {
    calls.push({ prompt, options });
    return calls.length === 1
      ? {
        output_text: JSON.stringify({
          decision: {
            action: "new",
            targetPath: null,
            overlap: "none",
            reason: "New operational intent.",
          },
          draft: normalizedDraft,
        }),
        usage: { input_tokens: 3, output_tokens: 4 },
      }
      : {
        output_text: JSON.stringify({ classification: "clinical" }),
        usage: { input_tokens: 5, output_tokens: 6 },
      };
  };

  const result = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
    researchAndDraft({
      project: projectBySlug("aftercare"),
      candidate: { action: "new", targetPath: null, query: "clinic workflow" },
      inventory: [],
      runDate: "2026-07-24",
    }, run)
  );

  assert.equal(result.riskClassification, "clinical");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options, undefined);
  assert.match(calls[1].prompt, /Classify the draft independently/);
  assert.ok(calls[1].prompt.includes('"operational","clinical","uncertain"'));
  assert.deepEqual(result.usage, {
    inputTokens: 8,
    outputTokens: 10,
    webSearchCalls: 1,
    generatedImage: false,
  });
});

test("claude-cli extrai o JSON mesmo com prosa e chaves antes do objeto", async () => {
  const { image, ...normalizedDraft } = draft;
  const payload = {
    decision: { action: "new", targetPath: null, overlap: "none", reason: "New intent." },
    draft: normalizedDraft,
  };
  const context = {
    project: projectBySlug("context"),
    candidate: { action: "new", targetPath: null, query: "daily guide" },
    inventory: [],
    runDate: "2026-07-24",
  };

  // Caso real de produção: o modelo explica antes de responder, e a explicação cita
  // um objeto — o recorte ingênuo do 1o "{" ao último "}" morria exatamente aqui.
  for (const wrapper of [
    `Não consegui ler as datas via WebFetch. Segue a decisão.\n\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``,
    `O schema pede {slug} e {title} preenchidos. Resultado:\n${JSON.stringify(payload)}`,
    `\`\`\`\n${JSON.stringify(payload)}\n\`\`\`\nEspero que ajude.`,
    JSON.stringify(payload),
  ]) {
    const result = await withEnv({ CLAUDE_CODE_OAUTH_TOKENS: "test-token" }, () =>
      researchAndDraft(context, async () => ({
        output_text: wrapper,
        usage: { input_tokens: 1, output_tokens: 1 },
      }))
    );
    assert.equal(result.action, "new");
    assert.equal(result.draft.title, normalizedDraft.title);
  }
});

test("claude-cli falha fechado para decisão semântica incerta ou malformada", async () => {
  const { image, ...normalizedDraft } = draft;
  const context = {
    project: projectBySlug("context"),
    candidate: { action: "new", targetPath: null, query: "daily guide" },
    inventory: [],
    runDate: "2026-07-24",
  };
  const responses = (decision) => async () => ({
    output_text: JSON.stringify({ decision, draft: normalizedDraft }),
    usage: { input_tokens: 1, output_tokens: 1 },
  });

  const uncertain = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
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

  const sameAsNew = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
    researchAndDraft(context, responses({
      action: "new",
      targetPath: null,
      overlap: "same",
      reason: "The intent is the same as an inventory entry.",
    }))
  );
  assert.equal(sameAsNew.action, "block");
  assert.equal(sameAsNew.reason, "semantic:same");

  const missingUpdateTarget = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
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
  const updateWithoutSameOverlap = await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
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

  await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
    assert.rejects(
      () => researchAndDraft(context, responses({
        action: "publish",
        targetPath: null,
        overlap: "none",
        reason: "Invalid action.",
      })),
      /llm-output/
    )
  );

  // Texto sem bloco JSON nenhum também precisa falhar fechado.
  await withEnv({ CLAUDE_CODE_OAUTH_TOKEN: "test-token" }, () =>
    assert.rejects(
      () => researchAndDraft(context, async () => ({ output_text: "I could not comply." })),
      /llm-output/
    )
  );
});

test("claude-cli soma contas e reporta a env oficial quando falta", () => {
  assert.deepEqual(claudeTokens({ CLAUDE_CODE_OAUTH_TOKENS: " a , b ,, c " }), ["a", "b", "c"]);
  assert.deepEqual(claudeTokens({ CLAUDE_CODE_OAUTH_TOKEN: "single" }), ["single"]);
  assert.deepEqual(claudeTokens({ CLAUDE_CODE_OAUTH_TOKENS: " , " }), []);
  assert.deepEqual(claudeTokens({}), []);

  // O singular sozinho continua satisfazendo o contrato de ambiente.
  const base = {
    CRON_SECRET: "x",
    DATABASE_URL: "x",
    GITHUB_TOKEN: "x",
    GOOGLE_SERVICE_ACCOUNT_JSON: "x",
    UNSPLASH_ACCESS_KEY: "x",
  };
  assert.deepEqual(missingEnv({ ...base, CLAUDE_CODE_OAUTH_TOKEN: "single" }), []);
  assert.deepEqual(missingEnv({ ...base, CLAUDE_CODE_OAUTH_TOKENS: "a,b" }), []);
  assert.deepEqual(missingEnv(base), ["CLAUDE_CODE_OAUTH_TOKENS"]);
});

test("claude-cli fixa modelo e effort em vez de herdar o default da conta", async () => {
  await withEnv({ CLAUDE_CODE_OAUTH_TOKENS: "a" }, async () => {
    const seen = [];
    const spawnImpl = async (_prompt, args) => {
      seen.push(args);
      return JSON.stringify({ result: "ok", usage: {} });
    };
    await claudeRun("prompt", { spawnImpl, webSearch: true });
    await claudeRun("prompt", { spawnImpl });

    const flag = (args, name) => args[args.indexOf(name) + 1];
    // Draft pesquisa e escreve; o classificador YMYL só devolve 1 de 3 valores.
    assert.equal(flag(seen[0], "--model"), "sonnet");
    assert.equal(flag(seen[0], "--effort"), "high");
    assert.equal(flag(seen[0], "--max-turns"), "12");
    assert.equal(flag(seen[1], "--model"), "sonnet");
    assert.equal(flag(seen[1], "--effort"), "low");
    assert.equal(flag(seen[1], "--max-turns"), "1");
  });
});

test("claude-cli rotaciona conta esgotada e desiste quando todas falham", async () => {
  await withEnv({ CLAUDE_CODE_OAUTH_TOKENS: "a,b,c" }, async () => {
    const used = [];
    const ok = await claudeRun("prompt", {
      spawnImpl: async (_prompt, _args, _timeout, token) => {
        used.push(token);
        if (token === "a") throw new Error("llm-rate");
        if (token === "b") throw new Error("llm-auth");
        return JSON.stringify({ result: "done", usage: { input_tokens: 1, output_tokens: 2 } });
      },
    });
    assert.deepEqual(used, ["a", "b", "c"]);
    assert.equal(ok.output_text, "done");

    // is_error com mensagem de limite também troca de conta.
    const usedOnPayload = [];
    const recovered = await claudeRun("prompt", {
      spawnImpl: async (_prompt, _args, _timeout, token) => {
        usedOnPayload.push(token);
        return token === "a"
          ? JSON.stringify({ is_error: true, result: "Claude usage limit reached" })
          : JSON.stringify({ result: "second", usage: { input_tokens: 0, output_tokens: 0 } });
      },
    });
    assert.deepEqual(usedOnPayload, ["a", "b"]);
    assert.equal(recovered.output_text, "second");

    // Todas esgotadas: falha fechado com o último código.
    await assert.rejects(
      () => claudeRun("prompt", {
        spawnImpl: async () => { throw new Error("llm-rate"); },
      }),
      /llm-rate/
    );

    // llm-output é da resposta, não da conta: não desperdiça as outras contas.
    const usedOnOutput = [];
    await assert.rejects(
      () => claudeRun("prompt", {
        spawnImpl: async (_prompt, _args, _timeout, token) => {
          usedOnOutput.push(token);
          throw new Error("llm-output");
        },
      }),
      /llm-output/
    );
    assert.deepEqual(usedOnOutput, ["a"]);
  });
});

test("claude-cli exige token e classifica a falha sem repassar a mensagem", async () => {
  await assert.rejects(
    () => withEnv({ CLAUDE_CODE_OAUTH_TOKENS: "   " }, () => claudeRun("prompt")),
    /llm-auth/
  );

  for (const [message, code] of [
    ["Claude usage limit reached, resets at 5pm", "llm-rate"],
    ["429 Too Many Requests", "llm-rate"],
    ["Unauthorized: run claude setup-token", "llm-auth"],
    ["Invalid token for secret-account@example.com", "llm-auth"],
    // Problema de linha de comando, não do modelo: imagem com CLI velho rejeitando
    // flag nova era indistinguível de "o modelo escreveu bobagem".
    ["ENOENT spawn claude at /secret/path", "llm-cli"],
    ["error: unknown option '--effort'", "llm-cli"],
    // Conta real: organização com Claude Code desabilitado, sem palavra de auth.
    ["Your organization has disabled Claude subscription access for Claude Code", "llm-auth"],
  ]) {
    const error = claudeError(message);
    assert.equal(error.message, code);
    assert.ok(!error.message.includes("secret"));
  }

  // stdout que não é JSON é falha do processo, não da resposta do modelo.
  await withEnv({ CLAUDE_CODE_OAUTH_TOKENS: "a" }, async () => {
    await assert.rejects(
      () => claudeRun("prompt", { spawnImpl: async () => "not json at all" }),
      /llm-parse/
    );
  });

  // O status do CLI decide sozinho, mesmo com mensagem irreconhecível.
  assert.equal(claudeError("whatever", 403).message, "llm-auth");
  assert.equal(claudeError("whatever", 401).message, "llm-auth");
  assert.equal(claudeError("whatever", 429).message, "llm-rate");
  assert.equal(claudeError("whatever", 500).message, "llm-output");
  assert.equal(claudeError("whatever", null).message, "llm-output");
});

test("imagem usa hotlink Unsplash com crédito e cai no 1o resultado sem match", async () => {
  await withEnv({ UNSPLASH_ACCESS_KEY: "test-unsplash-key" }, async () => {
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

    // Sem GPT Image: nenhum resultado casou por token, então vale o 1o da busca.
    const fallbackCalls = [];
    const fallbackFetch = async (url, init = {}) => {
      fallbackCalls.push({ url: String(url), init });
      return fallbackCalls.length === 1
        ? jsonResponse({
          results: [{
            description: "Desk",
            alt_description: "Desk with laptop",
            urls: { regular: "https://images.unsplash.com/desk" },
            links: { download_location: "https://api.unsplash.com/photos/desk/download" },
            user: { name: "Bruno Lima" },
          }],
        })
        : new Response(null, { status: 200 });
    };
    assert.deepEqual(await pickImage("workflow automation", fallbackFetch), {
      src: "https://images.unsplash.com/desk",
      alt: "Desk with laptop",
      credit: "Photo by Bruno Lima on Unsplash",
    });
    assert.equal(fallbackCalls[1].url, "https://api.unsplash.com/photos/desk/download");

    // Caso real: "windsurf ai explained" devolve zero no Unsplash e travava a publicação.
    // A busca degrada até um termo genérico antes de desistir.
    const queried = [];
    const degrading = async (url) => {
      const query = new URL(String(url)).searchParams.get("query");
      if (query === null) return new Response(null, { status: 200 });
      queried.push(query);
      return jsonResponse({
        results: query === "workspace desk"
          ? [{
            description: "Desk",
            alt_description: "Desk",
            urls: { regular: "https://images.unsplash.com/fallback" },
            links: { download_location: "https://api.unsplash.com/photos/fallback/download" },
            user: { name: "Carla" },
          }]
          : [],
      });
    };
    const rescued = await pickImage(
      { primaryKeyword: "windsurf ai explained", cluster: "engineering-workflows" },
      degrading
    );
    assert.equal(rescued.src, "https://images.unsplash.com/fallback");
    assert.deepEqual(queried, [
      "windsurf ai explained",
      "engineering workflows",
      "windsurf ai",
      "workspace desk",
    ]);

    // Com cena visual, a keyword homônima nem chega a ser buscada.
    const scened = [];
    const withScene = async (url) => {
      const query = new URL(String(url)).searchParams.get("query");
      if (query === null) return new Response(null, { status: 200 });
      scened.push(query);
      return jsonResponse({
        results: [{
          description: "Laptop",
          alt_description: "Laptop on a desk",
          urls: { regular: "https://images.unsplash.com/laptop" },
          links: { download_location: "https://api.unsplash.com/photos/laptop/download" },
          user: { name: "Dora" },
        }],
      });
    };
    const scene = await pickImage(
      {
        primaryKeyword: "windsurf ai explained",
        imageScene: "laptop screen with code editor",
        cluster: "engineering-workflows",
      },
      withScene
    );
    assert.equal(scene.src, "https://images.unsplash.com/laptop");
    assert.deepEqual(scened, ["laptop screen with code editor"]);

    // O alt do banco vem em inglês: em site pt-BR quem manda é o alt do artigo.
    const alt = await pickImage(
      {
        primaryKeyword: "fita adesiva",
        imageScene: "cardboard boxes on a workbench",
        imageAlt: "Caixas de papelão lacradas sobre uma bancada de expedição",
      },
      withScene
    );
    assert.equal(alt.alt, "Caixas de papelão lacradas sobre uma bancada de expedição");

    // Se nem o termo genérico devolver nada, aí sim falha fechado.
    await assert.rejects(
      () => pickImage("nothing", async () => jsonResponse({ results: [] })),
      /unsplash-output/
    );
  });
});

test("Unsplash rejeita download ou imagem fora das origens confiaveis", async () => {
  await withEnv({ UNSPLASH_ACCESS_KEY: "test-unsplash-key" }, async () => {
    const cases = [
      {
        download: "https://attacker.example/collect",
        image: "https://images.unsplash.com/safe",
      },
      {
        download: "https://api.unsplash.com/photos/safe/download",
        image: "https://attacker.example/tracker",
      },
    ];
    for (const item of cases) {
      const calls = [];
      const fetchImpl = async (url) => {
        calls.push(String(url));
        if (calls.length === 1) {
          return jsonResponse({
            results: [{
              description: "AI operations",
              alt_description: "AI operations",
              urls: { regular: item.image },
              links: { download_location: item.download },
              user: { name: "Contributor" },
            }],
          });
        }
        return new Response(null, { status: 200 });
      };
      await assert.rejects(() => pickImage("ai", fetchImpl), /unsplash-output/);
      assert.equal(calls.length, 1);
    }
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

    // 404 tem código próprio: fine-grained token sem o repo no escopo responde 404,
    // não 403, e sem isso o motivo vira github-output e aponta para o lugar errado.
    for (const [status, code] of [[404, "github-missing"], [403, "github-auth"], [500, "github-output"]]) {
      await assert.rejects(
        () => readRepository(project, async () => new Response("", { status })),
        (error) => error.message === code
      );
    }
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

test("kill switch e pausa sao revalidados imediatamente antes do commit", async () => {
  for (const stopped of ["*", "context"]) {
    const db = fakeDb();
    let checks = 0;
    db.enabled = async (slug) => {
      checks += 1;
      return !(checks > 2 && slug === stopped);
    };
    let committed = false;
    const result = await publishProject("context", "2026-07-24", {
      db,
      gscQueryPages: async () => [],
      readRepository: async () => ({ headSha: "head0", files: [] }),
      researchAndDraft: async () => validContextDraft(),
      pickImage: async () => null,
      commitFiles: async () => {
        committed = true;
        return { sha: "commit1", previousSha: "head0" };
      },
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.reason, stopped === "*" ? "global-disabled" : "project-disabled");
    assert.equal(committed, false);
    assert.equal(checks, stopped === "*" ? 3 : 4);
  }
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

test("falha de banco depois do commit reverte a publicacao imediatamente", async () => {
  const db = fakeDb();
  const finish = db.finish;
  db.finish = async (id, status, updates) => {
    if (status === "published") throw new Error("database unavailable");
    return finish(id, status, updates);
  };
  let reverted;
  await assert.rejects(
    () => publishProject("context", "2026-07-24", {
      db,
      gscQueryPages: async () => [],
      readRepository: async () => ({ headSha: "head0", files: [] }),
      researchAndDraft: async () => validContextDraft(),
      pickImage: async () => null,
      commitFiles: async () => ({ sha: "commit1", previousSha: "head0" }),
      revertCommit: async (...args) => {
        reverted = args;
        return "revert1";
      },
    }),
    /database/
  );

  assert.deepEqual(reverted?.slice(1), ["commit1", "head0"]);
  const recovered = await db.get(1);
  assert.equal(recovered.status, "failed");
  assert.equal(recovered.metadata.commitState, "reverted");
  assert.equal(recovered.metadata.revertCommitSha, "revert1");
});

test("post TypeScript novo atualiza o registry no mesmo commit", async () => {
  const cases = [
    {
      slug: "sirius",
      contentPath: "lib/blog/posts",
      registryPath: "lib/blog/index.ts",
      registry: `import { BlogPost } from '../blog-types'
import { post as existingPost } from './posts/existing-guide'

export const blogPosts: BlogPost[] = [
  existingPost,
]
`,
    },
    {
      slug: "fabrica",
      contentPath: "src/lib/blog/posts",
      registryPath: "src/lib/blog/index.ts",
      registry: `import { BlogPost } from "./types";

import { post as existingPost } from "./posts/existing-guide";

export const blogPosts: BlogPost[] = [
  existingPost,
];
`,
    },
    {
      slug: "estetiacrm",
      contentPath: "lib/blog/posts",
      registryPath: "lib/blog/index.ts",
      registry: `import { BlogPost } from '../blog-types'

import { post as existingPost } from './posts/existing-guide'

export const blogPosts: BlogPost[] = [
  existingPost,
]
`,
    },
  ];

  for (const item of cases) {
    let committed;
    const result = await publishProject(item.slug, "2026-07-24", {
      db: fakeDb(),
      gscQueryPages: async () => [],
      readRepository: async () => ({
        headSha: "head0",
        files: [{ path: item.registryPath, content: item.registry }],
      }),
      researchAndDraft: async () => validContextDraft(),
      pickImage: async () => null,
      commitFiles: async (...args) => {
        committed = args;
        return { sha: "commit1", previousSha: "head0" };
      },
    });

    assert.equal(result.status, "published", item.slug);
    assert.deepEqual(committed[2].map(({ path }) => path), [
      `${item.contentPath}/context-guide.ts`,
      item.registryPath,
    ]);
    assert.match(
      committed[2][1].content,
      /import \{ post as autoContextGuidePost \} from ["']\.\/posts\/context-guide["'];?/
    );
    assert.equal(
      (committed[2][1].content.match(/\bautoContextGuidePost\b/g) ?? []).length,
      2
    );
  }
});

test("post TypeScript bloqueia registry ausente antes de pesquisa, imagem ou commit", async () => {
  const calls = { researched: 0, picked: 0, committed: 0 };
  const result = await publishProject("sirius", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({ headSha: "head0", files: [] }),
    researchAndDraft: async () => {
      calls.researched += 1;
      return validContextDraft();
    },
    pickImage: async () => {
      calls.picked += 1;
      return null;
    },
    commitFiles: async () => {
      calls.committed += 1;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "render:registry-format");
  assert.deepEqual(calls, { researched: 0, picked: 0, committed: 0 });
});

test("update TypeScript ja registrado nao duplica nem reescreve o registry", async () => {
  const targetPath = "lib/blog/posts/context-guide.ts";
  const registry = `import { BlogPost } from '../blog-types'
import { post as manualAlias } from './posts/context-guide'

export const blogPosts: BlogPost[] = [
  manualAlias,
]
`;
  let committed;
  const result = await publishProject("sirius", "2026-07-24", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [
        {
          path: targetPath,
          content: `export const post = {
  slug: "context-guide",
  title: "Context Guide",
  primaryKeyword: "context guide",
}`,
        },
        { path: "lib/blog/index.ts", content: registry },
      ],
    }),
    researchAndDraft: async () => ({
      ...validContextDraft(),
      action: "update",
      targetPath,
      overlap: "same",
      reason: "The target covers the same intent.",
    }),
    pickImage: async () => null,
    commitFiles: async (...args) => {
      committed = args;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "updated");
  assert.deepEqual(committed[2].map(({ path }) => path), [targetPath]);
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

// Os dois testes end-to-end do typescript-catalog saíram junto com o nimblabs: publishProject
// resolve o slug na lista fechada de PROJECTS e o renderizador ficou sem projeto real. A
// cobertura unitária continua acima, via catalogFixture (extractInventory e renderDraft).

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

test("repo sem commit status não reverte: a página no ar decide na quinta tentativa", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  let reverted = false;
  const html = `<head>
    <title>Context Guide</title>
    <link rel="canonical" href="${targetUrl}">
    <script type="application/ld+json">{"@type":"Article"}</script>
  </head><h1>Context Guide</h1>`;
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
    fetch: async (url) => url === targetUrl
      ? new Response(html, { status: 200 })
      : new Response(`<urlset><url><loc>${targetUrl}</loc></url></urlset>`, { status: 200 }),
    revertCommit: async () => {
      reverted = true;
      return "revert1";
    },
  });

  assert.equal(reverted, false);
  assert.equal(result.status, "published");
  assert.equal(result.metadata.verification.ok, true);
  assert.equal(result.metadata.verification.deployment, "pending");
});

test("sem sinal de deploy, página fora do ar na quinta tentativa ainda reverte", async () => {
  const targetUrl = "https://context.nimblabs.com/blog/context-guide";
  const db = fakeDb({
    existing: {
      id: 13,
      projectSlug: "context",
      status: "published",
      targetUrl,
      commitSha: "commit1",
      previousSha: "head0",
      metadata: { title: "Context Guide", verificationAttempts: 4 },
    },
  });
  const result = await verifyPublication(13, {
    db,
    deploymentState: async () => "unavailable",
    fetch: async () => new Response("not found", { status: 404 }),
    revertCommit: async () => "revert1",
  });

  assert.equal(result.status, "reverted");
  assert.equal(result.reason, "verification:http");
});

test("controles SEO aceitam somente slug e estado explícitos", () => {
  const allowed = new Set(["context"]);
  const valid = new FormData();
  valid.set("slug", "context");
  valid.set("enabled", "false");
  valid.set("reason", "  Pausa editorial  ");

  assert.deepEqual(parseProjectStateFields(valid, allowed), {
    slug: "context",
    enabled: false,
    reason: "Pausa editorial",
  });

  for (const [slug, enabled] of [["unknown", "true"], ["context", "1"], ["context", "TRUE"]]) {
    const invalid = new FormData();
    invalid.set("slug", slug);
    invalid.set("enabled", enabled);
    assert.equal(parseProjectStateFields(invalid, allowed), null);
  }
});

test("controles SEO aceitam o kill switch e limitam o motivo", () => {
  const form = new FormData();
  form.set("slug", "*");
  form.set("enabled", "false");
  form.set("reason", "x".repeat(301));

  assert.deepEqual(parseProjectStateFields(form, new Set()), {
    slug: "*",
    enabled: false,
    reason: "x".repeat(300),
  });
});

test("ativar publicação limpa o motivo de pausa", () => {
  const form = new FormData();
  form.set("slug", "context");
  form.set("enabled", "true");
  form.set("reason", "não deve persistir");

  assert.deepEqual(parseProjectStateFields(form, new Set(["context"])), {
    slug: "context",
    enabled: true,
    reason: null,
  });
});

// --- Polimento editorial (handoff-polimento-editorial.md) -------------------

const guiasSource = `export const guias = [
  {
    slug: 'porcelanato-ou-ceramica',
    titulo: 'Porcelanato ou cerâmica: qual escolher?',
    descricao:
      'Absorção, resistência e custo total.',
  },
] as const;

export type Guia = (typeof guias)[number];
`;

const ptDraft = (overrides = {}) => ({
  slug: "fita-hot-melt-ou-acrilica",
  title: "Fita hot melt ou acrílica: qual usar em cada caixa",
  description: "Duas colas diferentes para o mesmo filme de BOPP. Como cada uma segura a aba da caixa, onde cada uma falha no calor e no papelão reciclado, e o critério de escolha por operação.",
  primaryKeyword: "fita hot melt ou acrilica",
  cluster: "fitas-adesivas",
  imageScene: "cardboard boxes sealed on a workbench",
  imageAlt: "Caixas de papelão lacradas com fita transparente sobre uma bancada de expedição",
  bluf: "Hot melt cola mais rápido e segura mais no curto prazo, enquanto a acrílica resiste melhor ao tempo, ao calor e à luz. A escolha depende do tempo que a caixa fica estocada e da temperatura do galpão, não do preço por rolo isolado do resto.",
  sections: [
    {
      heading: "Como cada cola trabalha",
      paragraphs: [
        "A **hot melt** é resina fundida: gruda por pressão e atinge adesão máxima em segundos.",
        "### Onde a acrílica ganha",
        "A acrílica cura devagar e **mantém a adesão** depois de meses de estoque quente.",
        "| Critério | Hot melt | Acrílica |\n| --- | --- | --- |\n| Adesão inicial | Alta | Média |\n| Estoque longo | Perde | Mantém |",
        "- Giro rápido pede hot melt.\n- Estoque longo pede acrílica.",
      ],
    },
  ],
  faqs: [{ q: "Hot melt descola no calor?", a: "Acima de 50 °C a resina amolece e a aba cede." }],
  relatedSlugs: [],
  sources: [{ url: "https://example.org/adesivos", title: "Adesivos sensíveis à pressão", publisher: "Example", publishedAt: "2026-01-01" }],
  image: { src: "https://images.unsplash.com/photo-y", alt: "Caixas lacradas", credit: "Photo by A on Unsplash" },
  publishedAt: "2026-07-25",
  ...overrides,
});

test("guia do goiânia sai em pt-BR, com structured data e registrado em guias.ts", async () => {
  let committed;
  const result = await publishProject("goiania", "2026-07-25", {
    db: fakeDb(),
    gscQueryPages: async () => [],
    readRepository: async () => ({
      headSha: "head0",
      files: [{ path: "site-goiania/src/data/guias.ts", content: guiasSource }],
    }),
    researchAndDraft: async () => ({
      action: "new",
      targetPath: null,
      overlap: "none",
      reason: "Nenhum guia cobre essa intenção.",
      draft: ptDraft(),
      usage: { inputTokens: 10, outputTokens: 20, webSearchCalls: 1, generatedImage: false },
    }),
    pickImage: async () => ptDraft().image,
    commitFiles: async (...args) => {
      committed = args;
      return { sha: "commit1", previousSha: "head0" };
    },
  });

  assert.equal(result.status, "published");
  assert.deepEqual(committed[2].map(({ path }) => path), [
    "site-goiania/src/pages/guia/fita-hot-melt-ou-acrilica.astro",
    "site-goiania/src/data/guias.ts",
  ]);

  const [guia, registro] = committed[2];
  // 1. rótulo de seção no idioma do site
  assert.ok(!guia.content.includes("Frequently asked questions"));
  assert.ok(!guia.content.includes("<h2>Sources</h2>"));
  assert.match(guia.content, /<h2>Fontes<\/h2>/);
  assert.match(guia.content, /<h2>Perguntas frequentes<\/h2>/);
  // 2. structured data da página, além do Organization/WebSite do Base
  assert.match(guia.content, /jsonLdNodes=\{jsonLdNodes\}/);
  // o OG do guia só existe porque a entrada em guias.ts alimenta open-graph/[...route].ts
  assert.match(guia.content, /ogImage=\{"\/open-graph\/guia\/fita-hot-melt-ou-acrilica\.png"\}/);
  for (const type of ["Article", "FAQPage", "BreadcrumbList"]) {
    assert.match(guia.content, new RegExp(`"@type": "${type}"`), `faltou ${type}`);
  }
  // markdown leve do modelo vira HTML de verdade
  assert.match(guia.content, /<strong>hot melt<\/strong>/);
  assert.match(guia.content, /<h3>Onde a acrílica ganha<\/h3>/);
  assert.match(guia.content, /<table><thead><tr><th scope="col">Critério<\/th>/);
  assert.match(guia.content, /<ul><li>Giro rápido pede hot melt\.<\/li>/);
  // 3b. registro preserva o que já existia e não vira página órfã
  assert.match(registro.content, /slug: "fita-hot-melt-ou-acrilica"/);
  assert.match(registro.content, /slug: 'porcelanato-ou-ceramica'/);
  assert.match(registro.content, /\] as const;/);
});

test("guiaUpsert substitui o slug existente sem duplicar", () => {
  const inserido = guiaUpsert(guiasSource, { slug: "novo", title: "Novo", description: "Descrição." });
  const atualizado = guiaUpsert(inserido, { slug: "novo", title: "Novo v2", description: "Descrição." });
  assert.equal((atualizado.match(/slug: "novo"/g) ?? []).length, 1);
  assert.match(atualizado, /titulo: "Novo v2"/);
});

test("frontmatter do tapepro leva cena, taxonomia e descrição cortada em palavra inteira", () => {
  const project = projectBySlug("tapepro");
  const draft = ptDraft({
    image: { ...ptDraft().image, base64: "d2VicA==" },
    sections: [{
      heading: "Fita gomada no e-commerce",
      paragraphs: ["A fita gomada sela a caixa do e-commerce com junta estrutural."],
    }],
  });
  const rendered = renderDraft(draft, project, null);
  const frontmatter = rendered.content.split("---")[1];

  assert.match(frontmatter, /^cenaImagem: "cardboard boxes sealed on a workbench"$/m);
  assert.match(frontmatter, /^imagemAlt: "Caixas lacradas"$/m);
  assert.match(frontmatter, /produtosRelacionados:\n {2}- "fita-gomada"\n/);
  assert.match(frontmatter, /segmentosRelacionados:\n {2}- "e-commerce"\n/);

  const descricao = frontmatter.match(/^descricao: "(.*)"$/m)[1];
  assert.ok(descricao.length <= 160, `descricao passou de 160: ${descricao.length}`);
  assert.ok(descricao.endsWith("…"));
  assert.ok(draft.description.startsWith(descricao.slice(0, -1)), "cortou no meio da palavra");

  // O layout já imprime `resumo` acima do corpo: repetir o bluf duplicava a dobra.
  const body = rendered.content.split(/^---$/m)[2];
  assert.ok(!body.includes(draft.bluf));
  assert.match(rendered.content, /^tempoLeituraMin: [1-9]\d*$/m);
});

test("sem produto mencionado o artigo do tapepro cai no catálogo inteiro", () => {
  const rendered = renderDraft(ptDraft({ image: { ...ptDraft().image, base64: "d2VicA==" } }), projectBySlug("tapepro"), null);
  const produtos = rendered.content.match(/produtosRelacionados:\n((?: {2}- .*\n)+)/)[1];
  assert.equal(produtos.trim().split("\n").length, projectBySlug("tapepro").produtos.length);
});

test("MDX deriva tempo de leitura, keywords e cluster em vez de slug e valor fixo", () => {
  const rendered = renderDraft(
    { ...draft, cluster: "ai-agent-memory", imageScene: "laptop and coffee cup on desk", relatedSlugs: ["cursor-vs-windsurf"] },
    projectBySlug("context"),
    null
  );
  const frontmatter = rendered.content.split("---")[1];

  assert.match(frontmatter, /^cluster: "Ai Agent Memory"$/m);
  assert.ok(!frontmatter.includes("cursor-vs-windsurf") || !/keywords:.*cursor-vs-windsurf/.test(frontmatter));
  assert.doesNotMatch(frontmatter, /keywords: \[[^\]]*cursor-vs-windsurf/);
  assert.match(frontmatter, /^ {2}searchTerm: "laptop and coffee cup on desk"$/m);
  const readingTime = Number(frontmatter.match(/^readingTime: (\d+)$/m)[1]);
  assert.ok(readingTime >= 1 && readingTime <= 3, `readingTime irreal: ${readingTime}`);
});
