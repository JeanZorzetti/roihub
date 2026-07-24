type JsonRecord = Record<string, unknown>;

export function responseText(response: unknown): string | null {
  const value = response as JsonRecord | null;
  if (typeof value?.output_text === "string") return value.output_text;
  if (!Array.isArray(value?.output)) return null;
  for (const rawItem of value.output) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const item = rawItem as JsonRecord;
    for (const rawContent of Array.isArray(item.content) ? item.content : [item]) {
      if (!rawContent || typeof rawContent !== "object") continue;
      const content = rawContent as JsonRecord;
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

export function githubTreeFiles(tree: unknown[], project: { contentPath: string; registryPath?: string }) {
  const root = project.contentPath.replaceAll("\\", "/").replace(/^\.\/+|\/+$/g, "");
  const registry = project.registryPath?.replaceAll("\\", "/").replace(/^\.\/+|\/+$/g, "");
  return tree.flatMap((item) => {
    const entry = item as { type?: unknown; path?: unknown; sha?: unknown };
    const path = typeof entry.path === "string" ? entry.path.replaceAll("\\", "/").replace(/^\.\/+/, "") : "";
    return entry.type === "blob"
      && typeof entry.sha === "string"
      && (path === root || path.startsWith(`${root}/`) || path === registry)
      ? [{ path, sha: entry.sha }]
      : [];
  });
}

type FetchImpl = typeof fetch;
type Project = {
  repository: string;
  branch: string;
  contentPath: string;
  registryPath?: string;
  [key: string]: unknown;
};

const OPENAI_URL = "https://api.openai.com/v1";
const GITHUB_URL = "https://api.github.com";

const EDITORIAL_DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    primaryKeyword: { type: "string" },
    cluster: { type: "string" },
    bluf: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          heading: { type: "string" },
          paragraphs: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "paragraphs"],
      },
    },
    faqs: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { q: { type: "string" }, a: { type: "string" } },
        required: ["q", "a"],
      },
    },
    relatedSlugs: { type: "array", items: { type: "string" } },
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          url: { type: "string" },
          title: { type: "string" },
          publisher: { type: "string" },
          publishedAt: { type: "string" },
        },
        required: ["url", "title", "publisher", "publishedAt"],
      },
    },
    publishedAt: { type: "string" },
  },
  required: [
    "slug",
    "title",
    "description",
    "primaryKeyword",
    "cluster",
    "bluf",
    "sections",
    "faqs",
    "relatedSlugs",
    "sources",
    "publishedAt",
  ],
} as const;

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { type: "string", enum: ["new", "update", "block"] },
        targetPath: { type: ["string", "null"] },
        overlap: { type: "string", enum: ["none", "same", "uncertain"] },
        reason: { type: "string" },
      },
      required: ["action", "targetPath", "overlap", "reason"],
    },
    draft: EDITORIAL_DRAFT_SCHEMA,
  },
  required: ["decision", "draft"],
} as const;

function openaiError(status: number) {
  if (status === 401 || status === 403) return new Error("openai-auth");
  if (status === 429) return new Error("openai-rate");
  return new Error("openai-output");
}

async function openaiJson(
  path: string,
  body: JsonRecord,
  fetchImpl: FetchImpl
): Promise<JsonRecord> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("openai-auth");
  let response: Response;
  try {
    response = await fetchImpl(`${OPENAI_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("openai-output");
  }
  if (!response.ok) throw openaiError(response.status);
  try {
    return await response.json() as JsonRecord;
  } catch {
    throw new Error("openai-output");
  }
}

const usageOf = (response: JsonRecord) => {
  const usage = response.usage as JsonRecord | undefined;
  return {
    inputTokens: Number(usage?.input_tokens) || 0,
    outputTokens: Number(usage?.output_tokens) || 0,
  };
};

export async function researchAndDraft(
  context: {
    candidate?: { action?: string; targetPath?: string | null };
    [key: string]: unknown;
  },
  fetchImpl: FetchImpl = fetch
) {
  const base = {
    model: "gpt-5.6-terra",
    reasoning: { effort: "medium" },
    store: false,
  };
  const research = await openaiJson("/responses", {
    ...base,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: "Research the search intent with current primary sources. Return concise evidence with source URLs.",
      },
      { role: "user", content: JSON.stringify(context) },
    ],
  }, fetchImpl);
  const researchText = responseText(research);
  if (!researchText) throw new Error("openai-output");

  const drafted = await openaiJson("/responses", {
    ...base,
    input: [
      {
        role: "system",
        content: "Use the complete inventory to decide whether the intent is new, the same as an existing entry to update, or uncertain and therefore blocked. A same intent must never be new, an update must target an inventory path, and uncertainty must block. Return the decision and normalized editorial draft. Do not invent sources.",
      },
      {
        role: "user",
        content: JSON.stringify({ context, research: researchText }),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "normalized_draft",
        strict: true,
        schema: DRAFT_SCHEMA,
      },
    },
  }, fetchImpl);
  const draftedText = responseText(drafted);
  if (!draftedText) throw new Error("openai-output");

  let output: JsonRecord;
  try {
    output = JSON.parse(draftedText) as JsonRecord;
    if (!output || typeof output !== "object" || Array.isArray(output)) throw new Error();
  } catch {
    throw new Error("openai-output");
  }
  const decision = output.decision as JsonRecord | null;
  const draft = output.draft as JsonRecord | null;
  const action = decision?.action;
  const targetPath = decision?.targetPath;
  const overlap = decision?.overlap;
  const reason = decision?.reason;
  if (!decision
    || typeof decision !== "object"
    || Array.isArray(decision)
    || !["new", "update", "block"].includes(String(action))
    || !(targetPath === null || typeof targetPath === "string")
    || !["none", "same", "uncertain"].includes(String(overlap))
    || typeof reason !== "string"
    || !reason.trim()
    || !draft
    || typeof draft !== "object"
    || Array.isArray(draft)) {
    throw new Error("openai-output");
  }

  const normalizePath = (value: unknown) => String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\/+|\/+$/g, "");
  const inventoryPaths = new Map(
    (Array.isArray(context.inventory) ? context.inventory : [])
      .flatMap((entry) => {
        const path = (entry as JsonRecord | null)?.path;
        return typeof path === "string" && normalizePath(path)
          ? [[normalizePath(path), path] as const]
          : [];
      })
  );
  const matchingTarget = typeof targetPath === "string"
    ? inventoryPaths.get(normalizePath(targetPath)) ?? null
    : null;
  let safeAction = action as "new" | "update" | "block";
  let safeTarget = targetPath as string | null;
  let safeReason = reason.trim();
  if (overlap === "uncertain") {
    safeAction = "block";
    safeTarget = null;
    safeReason = "semantic:uncertain";
  } else if (overlap === "same" && action === "new") {
    safeAction = "block";
    safeTarget = null;
    safeReason = "semantic:same";
  } else if (action === "update" && overlap !== "same") {
    safeAction = "block";
    safeTarget = null;
    safeReason = "semantic:update-overlap";
  } else if (action === "update" && !matchingTarget) {
    safeAction = "block";
    safeTarget = null;
    safeReason = "semantic:update-target";
  } else if (action === "update") {
    safeTarget = matchingTarget;
  } else if (action === "new" && targetPath !== null) {
    safeAction = "block";
    safeTarget = null;
    safeReason = "semantic:new-target";
  } else if (action === "block") {
    safeTarget = null;
  }

  const researchUsage = usageOf(research);
  const draftUsage = usageOf(drafted);
  return {
    action: safeAction,
    targetPath: safeTarget,
    overlap,
    reason: safeReason,
    draft,
    usage: {
      inputTokens: researchUsage.inputTokens + draftUsage.inputTokens,
      outputTokens: researchUsage.outputTokens + draftUsage.outputTokens,
      webSearchCalls: 1,
      generatedImage: false,
    },
  };
}

const normalizeIntent = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function imageIntent(value: unknown) {
  if (typeof value === "string") return value.trim();
  const record = value as JsonRecord | null;
  return String(record?.primaryKeyword ?? record?.title ?? "").trim();
}

async function unsplashJson(url: string, fetchImpl: FetchImpl) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) throw new Error("unsplash-auth");
  const response = await fetchImpl(url, {
    headers: {
      authorization: `Client-ID ${key}`,
      "accept-version": "v1",
    },
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("unsplash-auth");
    if (response.status === 429) throw new Error("unsplash-rate");
    throw new Error("unsplash-output");
  }
  try {
    return await response.json() as JsonRecord;
  } catch {
    throw new Error("unsplash-output");
  }
}

export async function pickImage(intentValue: unknown, fetchImpl: FetchImpl = fetch) {
  const intent = imageIntent(intentValue);
  const searchUrl = new URL("https://api.unsplash.com/search/photos");
  searchUrl.searchParams.set("query", intent);
  searchUrl.searchParams.set("orientation", "landscape");
  searchUrl.searchParams.set("content_filter", "high");
  searchUrl.searchParams.set("per_page", "10");
  const search = await unsplashJson(searchUrl.toString(), fetchImpl);
  const tokens = normalizeIntent(intent).split(" ").filter(Boolean);
  const match = (Array.isArray(search.results) ? search.results : []).find((value) => {
    const photo = value as JsonRecord;
    const words = new Set(normalizeIntent(`${photo.description ?? ""} ${photo.alt_description ?? ""}`).split(" "));
    return tokens.some((token) => words.has(token));
  }) as JsonRecord | undefined;

  if (match) {
    const links = match.links as JsonRecord | undefined;
    const downloadUrl = links?.download_location;
    const urls = match.urls as JsonRecord | undefined;
    const user = match.user as JsonRecord | undefined;
    if (typeof downloadUrl !== "string" || typeof urls?.regular !== "string") {
      throw new Error("unsplash-output");
    }
    const downloaded = await fetchImpl(downloadUrl, {
      headers: {
        authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        "accept-version": "v1",
      },
    });
    if (!downloaded.ok) throw new Error("unsplash-output");
    return {
      src: urls.regular,
      alt: String(match.alt_description ?? match.description ?? intent),
      credit: `Photo by ${String(user?.name ?? "Unsplash contributor")} on Unsplash`,
    };
  }

  const generated = await openaiJson("/images/generations", {
    model: "gpt-image-2",
    size: "1536x1024",
    quality: "low",
    output_format: "webp",
    output_compression: 75,
    n: 1,
    prompt: `Editorial landscape image for ${intent}. No text or logos.`,
  }, fetchImpl);
  const first = Array.isArray(generated.data) ? generated.data[0] as JsonRecord | undefined : undefined;
  if (typeof first?.b64_json !== "string") throw new Error("openai-output");
  return {
    src: "generated",
    alt: intent,
    credit: "Generated by OpenAI",
    base64: first.b64_json,
  };
}

const encodedRepo = (project: Project) => project.repository
  .split("/")
  .map(encodeURIComponent)
  .join("/");

async function githubJson(
  project: Project,
  path: string,
  init: RequestInit,
  fetchImpl: FetchImpl
): Promise<JsonRecord> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("github-auth");
  const response = await fetchImpl(`${GITHUB_URL}/repos/${encodedRepo(project)}${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...init.headers,
    },
  });
  if (!response.ok) {
    if (init.method === "PATCH" && path.startsWith("/git/refs/heads/") && [409, 422].includes(response.status)) {
      throw new Error("github-conflict");
    }
    if (response.status === 401 || response.status === 403) throw new Error("github-auth");
    if (response.status === 429) throw new Error("github-rate");
    throw new Error("github-output");
  }
  try {
    return await response.json() as JsonRecord;
  } catch {
    throw new Error("github-output");
  }
}

const refPath = (project: Project) => `/git/ref/heads/${encodeURIComponent(project.branch)}`;

async function repositoryHead(project: Project, fetchImpl: FetchImpl) {
  const ref = await githubJson(project, refPath(project), { method: "GET" }, fetchImpl);
  const sha = (ref.object as JsonRecord | undefined)?.sha;
  if (typeof sha !== "string") throw new Error("github-output");
  return sha;
}

export async function readRepository(project: Project, fetchImpl: FetchImpl = fetch) {
  const headSha = await repositoryHead(project, fetchImpl);
  const treeResponse = await githubJson(
    project,
    `/git/trees/${encodeURIComponent(headSha)}?recursive=1`,
    { method: "GET" },
    fetchImpl
  );
  const entries = githubTreeFiles(Array.isArray(treeResponse.tree) ? treeResponse.tree : [], project);
  const files = [];
  for (const entry of entries) {
    const blob = await githubJson(
      project,
      `/git/blobs/${encodeURIComponent(entry.sha)}`,
      { method: "GET" },
      fetchImpl
    );
    if (typeof blob.content !== "string") throw new Error("github-output");
    const content = blob.encoding === "base64"
      ? Buffer.from(blob.content.replace(/\s/g, ""), "base64").toString("utf8")
      : blob.content;
    files.push({ ...entry, content });
  }
  return { headSha, files };
}

function repositoryPath(value: string) {
  const path = value.replaceAll("\\", "/").replace(/^\.\/+/, "");
  if (!path || path.startsWith("/") || path.split("/").includes("..")) throw new Error("github-path");
  return path;
}

export async function commitFiles(
  project: Project,
  expectedSha: string,
  files: { path: string; content?: string; base64?: string }[],
  message: string,
  fetchImpl: FetchImpl = fetch
) {
  const safeFiles = files.map((file) => ({ ...file, path: repositoryPath(file.path) }));
  const tree = [];
  for (const file of safeFiles) {
    const blob = await githubJson(project, "/git/blobs", {
      method: "POST",
      body: JSON.stringify(file.base64
        ? { content: file.base64, encoding: "base64" }
        : { content: String(file.content ?? ""), encoding: "utf-8" }),
    }, fetchImpl);
    if (typeof blob.sha !== "string") throw new Error("github-output");
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const createdTree = await githubJson(project, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: expectedSha, tree }),
  }, fetchImpl);
  if (typeof createdTree.sha !== "string") throw new Error("github-output");
  const commit = await githubJson(project, "/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: createdTree.sha, parents: [expectedSha] }),
  }, fetchImpl);
  if (typeof commit.sha !== "string") throw new Error("github-output");

  if (await repositoryHead(project, fetchImpl) !== expectedSha) throw new Error("github-conflict");
  await githubJson(project, `/git/refs/heads/${encodeURIComponent(project.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  }, fetchImpl);
  return { sha: commit.sha, previousSha: expectedSha };
}

export async function revertCommit(
  project: Project,
  currentSha: string,
  previousSha: string,
  fetchImpl: FetchImpl = fetch
) {
  const tree = await githubJson(project, "/git/trees", {
    method: "POST",
    body: JSON.stringify({ base_tree: previousSha, tree: [] }),
  }, fetchImpl);
  if (typeof tree.sha !== "string") throw new Error("github-output");
  const commit = await githubJson(project, "/git/commits", {
    method: "POST",
    body: JSON.stringify({
      message: "Revert automated publication",
      tree: tree.sha,
      parents: [currentSha],
    }),
  }, fetchImpl);
  if (typeof commit.sha !== "string") throw new Error("github-output");
  if (await repositoryHead(project, fetchImpl) !== currentSha) throw new Error("github-conflict");
  await githubJson(project, `/git/refs/heads/${encodeURIComponent(project.branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  }, fetchImpl);
  return commit.sha;
}

export async function deploymentState(
  project: Project,
  sha: string,
  fetchImpl: FetchImpl = fetch
) {
  const status = await githubJson(
    project,
    `/commits/${encodeURIComponent(sha)}/status`,
    { method: "GET" },
    fetchImpl
  );
  if (typeof status.state !== "string") throw new Error("github-output");
  return status.state;
}
