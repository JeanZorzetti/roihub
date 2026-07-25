import { spawn } from "node:child_process";

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
    imageScene: { type: "string" },
    imageAlt: { type: "string" },
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
    "imageScene",
    "imageAlt",
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

const RISK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    classification: {
      type: "string",
      enum: ["operational", "clinical", "uncertain"],
    },
  },
  required: ["classification"],
} as const;

// Classifica pela mensagem, nunca a repassa: o corpo pode conter o prompt inteiro.
// O status do CLI (api_error_status) manda, porque a mensagem varia: uma conta com
// Claude Code desabilitado pela organização responde 403 sem nenhuma palavra de auth.
export function claudeError(message: string, status?: unknown) {
  const code = Number(status);
  if (code === 429) return new Error("llm-rate");
  if (code === 401 || code === 403) return new Error("llm-auth");
  const text = message.toLowerCase();
  if (/usage limit|rate limit|too many requests|429/.test(text)) return new Error("llm-rate");
  if (/unauthor|authentication|not logged in|invalid token|oauth|forbidden|subscription access|disabled/.test(text)) {
    return new Error("llm-auth");
  }
  // O CLI é instalado sem pin, então uma imagem antiga rejeita flag nova e o erro
  // vinha indistinguível de "o modelo escreveu bobagem". A mensagem nunca é repassada:
  // só o código, que basta para saber que o problema é a linha de comando.
  if (/unknown option|unrecognized option|invalid option|unknown argument|command not found|enoent/.test(text)) {
    return new Error("llm-cli");
  }
  return new Error("llm-output");
}

// Contas somadas: o limite do autopublishing é rate limit de assinatura, não crédito.
// Aceita o singular para não quebrar quem já configurou uma conta só.
export function claudeTokens(env: NodeJS.ProcessEnv = process.env) {
  return String(env.CLAUDE_CODE_OAUTH_TOKENS ?? env.CLAUDE_CODE_OAUTH_TOKEN ?? "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

// Prompt vai por stdin: o inventário de um monorepo estoura o limite de argv.
function spawnClaude(prompt: string, args: string[], timeoutMs: number, token: string) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.env.CLAUDE_BIN || "claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      // No Windows o binário é um shim .cmd e só é encontrado via shell. Os args são
      // fixos e o prompt vai por stdin, então nada do modelo chega à linha de comando.
      shell: process.platform === "win32",
      // Só o token da vez chega ao filho: o plural nunca vaza para o CLI.
      env: { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: token, CLAUDE_CODE_OAUTH_TOKENS: "" },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("llm-timeout"));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", () => {
      clearTimeout(timer);
      reject(new Error("llm-cli"));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(claudeError(stderr || stdout));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

export type ClaudeRun = (
  prompt: string,
  options?: {
    webSearch?: boolean;
    timeoutMs?: number;
    spawnImpl?: (prompt: string, args: string[], timeoutMs: number, token: string) => Promise<string>;
  }
) => Promise<JsonRecord>;

// Formato de retorno idêntico ao da Responses API para manter responseText/usageOf.
// Knob real: pesquisa + artigo completo varia muito com a quantidade de buscas.
// Medido em produção: context 240s, goiania 366s (monorepo, inventário maior), e 166s
// local. A dispersão é grande, então o teto acompanha o pior caso visto com folga —
// timeout aqui não economiza nada, só descarta um artigo que estava quase pronto.
const DEFAULT_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS) || 600_000;

// Sem --model o CLI usa o default da conta, que difere entre as 3 e muda quando o CLI
// atualiza. O gargalo aqui é rate limit, não custo: sonnet cabe em mais artigos por dia
// que opus, e escrever artigo com pesquisa não é coding agêntico de horizonte longo.
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "sonnet";

export const claudeRun: ClaudeRun = async (prompt, {
  webSearch = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  spawnImpl = spawnClaude,
} = {}) => {
  const tokens = claudeTokens();
  if (!tokens.length) throw new Error("llm-auth");
  const args = [
    "-p",
    "--output-format",
    "json",
    "--model",
    CLAUDE_MODEL,
    // O draft pesquisa e escreve; o classificador YMYL devolve 1 de 3 valores.
    "--effort",
    webSearch ? "high" : "low",
    "--max-turns",
    webSearch ? "12" : "1",
  ];
  if (webSearch) args.push("--allowedTools", "WebSearch");

  let lastError = new Error("llm-auth");
  for (const token of tokens) {
    let raw: string;
    try {
      raw = await spawnImpl(prompt, args, timeoutMs, token);
    } catch (error) {
      lastError = error as Error;
      // Conta esgotada ou expirada: tenta a próxima. llm-output é da resposta,
      // não da conta, então trocar de token não ajudaria.
      if (["llm-rate", "llm-auth"].includes(lastError.message)) continue;
      throw lastError;
    }
    let payload: JsonRecord;
    try {
      payload = JSON.parse(raw) as JsonRecord;
    } catch {
      // stdout do CLI não é JSON: falha do processo, não do modelo.
      throw new Error("llm-parse");
    }
    if (payload?.is_error || typeof payload?.result !== "string") {
      lastError = claudeError(
        typeof payload?.result === "string" ? payload.result : "",
        payload?.api_error_status
      );
      if (["llm-rate", "llm-auth"].includes(lastError.message)) continue;
      throw lastError;
    }
    const usage = payload.usage as JsonRecord | undefined;
    return {
      output_text: payload.result,
      usage: {
        input_tokens: Number(usage?.input_tokens) || 0,
        output_tokens: Number(usage?.output_tokens) || 0,
      },
    };
  }
  throw lastError;
};

// claude-cli não tem json_schema strict: o JSON vem no texto. Observado em produção,
// o modelo escreve prosa antes do objeto ("não consegui ler as datas, segue a decisão"),
// e essa prosa pode conter chaves — então recortar do 1o "{" ao último "}" quebra.
// Ordem: bloco cercado por fence, depois cada "{" como início candidato.
function parseJsonBlock(text: string | null): JsonRecord {
  if (!text) throw new Error("llm-output");
  const candidates: string[] = [];
  for (const match of text.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)) {
    candidates.push(match[1]);
  }
  const end = text.lastIndexOf("}");
  for (let start = text.indexOf("{"); start >= 0 && start < end; start = text.indexOf("{", start + 1)) {
    candidates.push(text.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as JsonRecord;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // candidato inválido: tenta o próximo início.
    }
  }
  throw new Error("llm-output");
}

const schemaInstruction = (schema: unknown) =>
  `Return ONLY a JSON object valid against this JSON Schema. No prose, no code fences.\n${JSON.stringify(schema)}`;

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
  run: ClaudeRun = claudeRun
) {
  // Uma chamada só: o claude-cli pesquisa e devolve a decisão no mesmo turno, e duas
  // chamadas com WebSearch não cabem no maxDuration de 300s da rota.
  const editorialFocus = (context.project as JsonRecord | undefined)?.editorialFocus;
  const drafted = await run([
    "You are the editorial engine of ROI Labs. Research the search intent with web search and current primary sources, then decide.",
    ...(typeof editorialFocus === "string" && editorialFocus.trim()
      ? [`EDITORIAL FOCUS for this project: ${editorialFocus.trim()}`]
      : []),
    "Use the complete inventory to decide whether the intent is new, the same as an existing entry to update, or uncertain and therefore blocked. A same intent must never be new, an update must target an existing inventory path, and uncertainty must block.",
    "Never invent a source: every entry in sources must be a page you actually retrieved, with an https URL and an ISO publication date. The bluf must have between 40 and 60 words. Never cite a direct competitor of the project — a company that sells the same product or service — as a source; cite standards bodies, manufacturers of inputs, trade press, research and public data instead.",
    // O artigo é escrito em prosa corrida e sai sem nenhum elemento escaneável: nada de
    // negrito, tabela, H3 ou seção com profundidade. As regras abaixo são o padrão
    // medido nos artigos escritos à mão de cada repo.
    "Write in the project language. The title must contain the primary keyword literally and say what the reader gets (\"Fita gomada ou fita BOPP: qual usar em cada caixa\"), never a poetic phrase. No section heading may repeat the title.",
    "Structure: 4 to 6 H2 sections, each with 4 to 6 paragraphs. Inside a section, a paragraph that starts with \"### \" becomes a sub-heading — use one or two per section to break it up. Mark the decisive term of a paragraph with **bold**, once or twice per paragraph, never a whole sentence. A paragraph may also be a bullet list, one \"- \" item per line.",
    "When the article compares two options, one paragraph must be a GitHub-flavored markdown table (header row, \"| --- |\" separator, one row per criterion) comparing them side by side. Never write the comparison only as prose.",
    "imageScene is searched verbatim in a stock photo bank, so describe a photographable scene in 3 to 6 English words with concrete objects only: no product or brand names, no jargon, no abstractions, no generic counted nouns (\"two different types\" returned a plate of food). The keyword is not a scene, and reusing it picks the wrong homonym (\"windsurf\" returns sailboats, not an IDE).",
    "imageAlt describes that same photo for a reader who cannot see it, in the project language, in one concrete sentence.",
    "Do not copy the candidate heuristic: decide from the inventory itself.",
    schemaInstruction(DRAFT_SCHEMA),
    `CONTEXT:\n${JSON.stringify(context)}`,
  ].join("\n\n"), { webSearch: true });

  const output = parseJsonBlock(responseText(drafted));
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
    throw new Error("llm-output");
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

  let riskClassification: "operational" | "clinical" | "uncertain" | undefined;
  let classifierUsage = { inputTokens: 0, outputTokens: 0 };
  if ((context.project as JsonRecord | undefined)?.risk === "ymyl-restricted") {
    const classified = await run([
      "Classify the draft independently. Operational means software, administration, scheduling, communication, analytics, billing, marketing, or other non-clinical business workflow only. Clinical includes any instruction, recommendation, diagnosis, treatment, preparation, recovery, patient conduct, symptom, medication, procedure, or health claim. If any part is ambiguous, return uncertain.",
      schemaInstruction(RISK_SCHEMA),
      `DRAFT:\n${JSON.stringify(draft)}`,
    ].join("\n\n"));
    const parsed = parseJsonBlock(responseText(classified));
    if (!["operational", "clinical", "uncertain"].includes(String(parsed.classification))) {
      throw new Error("llm-output");
    }
    riskClassification = parsed.classification as typeof riskClassification;
    classifierUsage = usageOf(classified);
  }

  const draftUsage = usageOf(drafted);
  return {
    action: safeAction,
    targetPath: safeTarget,
    overlap,
    reason: safeReason,
    draft,
    ...(riskClassification ? { riskClassification } : {}),
    usage: {
      inputTokens: draftUsage.inputTokens + classifierUsage.inputTokens,
      outputTokens: draftUsage.outputTokens + classifierUsage.outputTokens,
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

// A keyword não é descrição visual: "windsurf ai explained" trouxe um veleiro para um
// artigo sobre IDE. O modelo devolve a cena; a keyword só sobra como plano B.
function imageIntent(value: unknown) {
  if (typeof value === "string") return value.trim();
  const record = value as JsonRecord | null;
  return String(record?.imageScene ?? record?.primaryKeyword ?? record?.title ?? "").trim();
}

// O alt do Unsplash vem em inglês e ia cru para site pt-BR ("person holding cardboard
// box on table"). O modelo descreve a foto no idioma do artigo; o do banco é plano B.
function imageAlt(value: unknown, fallback: string) {
  const alt = typeof value === "object" && value
    ? String((value as JsonRecord).imageAlt ?? "").trim()
    : "";
  return alt || fallback;
}

// A pauta é long-tail de propósito, e o Unsplash não tem foto para termo de nicho:
// "windsurf ai explained" devolve zero resultados e bloqueava a publicação inteira.
// Degrada até um termo que sempre existe, em vez de desistir na primeira busca.
export function imageQueries(intentValue: unknown) {
  const intent = imageIntent(intentValue);
  const record = typeof intentValue === "object" ? intentValue as JsonRecord | null : null;
  const cluster = String(record?.cluster ?? "").replace(/[-_]+/g, " ").trim();
  const head = intent.split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  return [...new Set([intent, cluster, head, "workspace desk"].map((q) => q.trim()).filter(Boolean))];
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

function trustedHttpsUrl(value: unknown, origin: string) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === origin ? url : null;
  } catch {
    return null;
  }
}

export async function pickImage(
  intentValue: unknown,
  fetchImpl: FetchImpl = fetch,
  { embed = false } = {}
) {
  const intent = imageIntent(intentValue);
  const tokens = normalizeIntent(intent).split(" ").filter(Boolean);
  let match: JsonRecord | undefined;
  for (const query of imageQueries(intentValue)) {
    const searchUrl = new URL("https://api.unsplash.com/search/photos");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("orientation", "landscape");
    searchUrl.searchParams.set("content_filter", "high");
    searchUrl.searchParams.set("per_page", "10");
    const search = await unsplashJson(searchUrl.toString(), fetchImpl);
    const results = (Array.isArray(search.results) ? search.results : []) as JsonRecord[];
    // Sem OpenAI não há geração de fallback: o melhor esforço é o 1º resultado da busca,
    // que já vem filtrado por orientação e content_filter=high.
    match = results.find((photo) => {
      const words = new Set(normalizeIntent(`${photo.description ?? ""} ${photo.alt_description ?? ""}`).split(" "));
      return tokens.some((token) => words.has(token));
    }) ?? results[0];
    if (match) break;
  }

  if (match) {
    const links = match.links as JsonRecord | undefined;
    const downloadUrl = links?.download_location;
    const urls = match.urls as JsonRecord | undefined;
    const user = match.user as JsonRecord | undefined;
    const trustedDownload = trustedHttpsUrl(downloadUrl, "https://api.unsplash.com");
    const trustedImage = trustedHttpsUrl(urls?.regular, "https://images.unsplash.com");
    if (!trustedDownload || !trustedImage) {
      throw new Error("unsplash-output");
    }
    const downloaded = await fetchImpl(trustedDownload, {
      headers: {
        authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        "accept-version": "v1",
      },
    });
    if (!downloaded.ok) throw new Error("unsplash-output");
    const picked = {
      src: trustedImage.href,
      alt: imageAlt(intentValue, String(match.alt_description ?? match.description ?? intent)),
      credit: `Photo by ${String(user?.name ?? "Unsplash contributor")} on Unsplash`,
    };
    // embed: schema que valida a imagem como asset local (Astro image()) não aceita
    // hotlink. O crédito e o trigger de download continuam, como a licença pede.
    if (!embed) return picked;
    const bytes = await fetchImpl(trustedImage.href);
    if (!bytes.ok) throw new Error("unsplash-output");
    return {
      ...picked,
      base64: Buffer.from(await bytes.arrayBuffer()).toString("base64"),
    };
  }

  throw new Error("unsplash-output");
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
    // Fine-grained token sem o repo no escopo devolve 404, não 403 — o GitHub não
    // revela a existência de repo privado. Sem código próprio isso vira "resposta
    // malformada" e manda quem investiga para o lado errado.
    if (response.status === 404) throw new Error("github-missing");
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
