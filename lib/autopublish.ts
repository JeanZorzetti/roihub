import { estimateCost, rankCandidates, validateDraft } from "./autopublish-core.mjs";
import {
  CLAUDE_MODEL,
  commitFiles as commitRepositoryFiles,
  deploymentState as getDeploymentState,
  pickImage as selectImage,
  readRepository as readProjectRepository,
  researchAndDraft as createDraft,
  revertCommit as createRevertCommit,
// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
} from "./autopublish-clients.ts";
import { projectBySlug } from "./autopublish-projects.mjs";
import { extractInventory, registryUpsert, renderDraft } from "./autopublish-render.mjs";
import {
  beginPublication,
  finishPublication,
  getPublication,
  projectEnabled,
  updatePublicationMetadata,
// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
} from "./db.ts";
// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
import { gscQueryPages as queryGscPages } from "./gsc.ts";

type Project = NonNullable<ReturnType<typeof projectBySlug>>;
type PublicationDb = {
  begin: typeof beginPublication;
  finish: typeof finishPublication;
  get: typeof getPublication;
  update: typeof updatePublicationMetadata;
  enabled: typeof projectEnabled;
};
type Dependency = (...args: any[]) => any;
type PublishDependencies = {
  dryRun?: boolean;
  db?: PublicationDb;
  gscQueryPages?: Dependency;
  readRepository?: Dependency;
  researchAndDraft?: Dependency;
  pickImage?: Dependency;
  commitFiles?: Dependency;
  revertCommit?: Dependency;
};
type VerifyDependencies = {
  db?: PublicationDb;
  deploymentState?: Dependency;
  revertCommit?: Dependency;
  fetch?: typeof fetch;
};

const database: PublicationDb = {
  begin: beginPublication,
  finish: finishPublication,
  get: getPublication,
  update: updatePublicationMetadata,
  enabled: projectEnabled,
};

const normalizedPath = (value: unknown) => String(value ?? "")
  .replaceAll("\\", "/")
  .replace(/^\.\/+|\/+$/g, "");
const normalizedIntent = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

function validRunDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function expectedUrl(project: Project, slug: string) {
  const base = project.siteUrl.replace(/\/$/, "");
  return project.renderer === "astro"
    ? `${base}/guia/${encodeURIComponent(slug)}/`
    : `${base}/blog/${encodeURIComponent(slug)}`;
}

function safeContentPath(path: unknown, root: string) {
  const normalized = normalizedPath(path);
  const contentRoot = normalizedPath(root);
  return !normalized.split("/").includes("..")
    && (normalized === contentRoot || normalized.startsWith(`${contentRoot}/`));
}

// researchAndDraft já apura POR QUE bloqueou, mas tudo colapsava em "decision:unsafe" —
// foi o que deixou o bloqueio do sirius indiagnosticável. Só os casos que caíam nesse
// balde genérico ganham o motivo; "duplicate" já era um nome preciso. Os códigos são
// gerados aqui dentro, não pelo modelo, então a lista é fechada e segura de repassar.
const SEMANTIC_BLOCKS = new Set(["uncertain", "update-target", "update-overlap"]);

function unsafeBlock(reason: unknown) {
  const suffix = typeof reason === "string" && reason.startsWith("semantic:")
    ? reason.slice("semantic:".length)
    : "";
  return SEMANTIC_BLOCKS.has(suffix) ? `decision:${suffix}` : "decision:unsafe";
}

function decisionBlock(action: unknown, overlap: unknown, reason: unknown) {
  if (action === "duplicate"
    || (overlap === "same" && (action === "new" || action === "block"))) {
    return "decision:duplicate";
  }
  if (action === "unsafe" || overlap === "uncertain") return unsafeBlock(reason);
  if (action === "update" && overlap !== "same") return unsafeBlock(reason);
  if (!["new", "update", "block"].includes(String(action))
    || !["none", "same"].includes(String(overlap))) {
    return "decision:unsafe";
  }
  if (action !== "block") return null;
  return typeof reason === "string" && reason.toLowerCase().includes("duplicate")
    ? "decision:duplicate"
    : "decision:unsafe";
}

function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "github-conflict") return { status: "blocked" as const, reason: code };
  if (["github-path", "catalog-format", "registry-format", "renderer"].includes(code)) {
    return { status: "blocked" as const, reason: `render:${code}` };
  }
  if ([
    "gsc-unavailable",
    "llm-auth",
    "llm-rate",
    "llm-output",
    "llm-cli",
    "llm-parse",
    "llm-timeout",
    "unsplash-auth",
    "unsplash-rate",
    "unsplash-output",
    "github-auth",
    "github-missing",
    "github-rate",
    "github-output",
  ].includes(code)) {
    return { status: "failed" as const, reason: code };
  }
  return { status: "failed" as const, reason: "unexpected" };
}

async function finish(
  db: PublicationDb,
  id: number,
  status: "published" | "updated" | "blocked" | "failed" | "reverted",
  updates: Parameters<typeof finishPublication>[2]
) {
  try {
    return await db.finish(id, status, updates);
  } catch {
    throw new Error("database");
  }
}

async function update(db: PublicationDb, id: number, metadata: Record<string, unknown>) {
  try {
    return await db.update(id, metadata);
  } catch {
    throw new Error("database");
  }
}

export async function publishProject(
  slug: string,
  runDate: string,
  dependencies: PublishDependencies = {}
) {
  const project = projectBySlug(slug);
  if (!project) throw new Error("project");
  if (!validRunDate(runDate)) throw new Error("run-date");

  const {
    dryRun = false,
    db = database,
    gscQueryPages = queryGscPages,
    readRepository = readProjectRepository,
    researchAndDraft = createDraft,
    pickImage = selectImage,
    commitFiles = commitRepositoryFiles,
    revertCommit = createRevertCommit,
  } = dependencies;

  let publication: Awaited<ReturnType<typeof beginPublication>>["publication"] | null = null;
  if (!dryRun) {
    let globallyEnabled: boolean;
    let locallyEnabled: boolean;
    try {
      globallyEnabled = await db.enabled("*");
      if (!globallyEnabled) {
        return { status: "blocked", reason: "global-disabled", projectSlug: slug, runDate };
      }
      locallyEnabled = await db.enabled(slug);
    } catch {
      throw new Error("database");
    }
    if (!locallyEnabled) {
      return { status: "blocked", reason: "project-disabled", projectSlug: slug, runDate };
    }

    let begun: Awaited<ReturnType<typeof beginPublication>>;
    try {
      begun = await db.begin({
        projectSlug: slug,
        runDate,
        repository: project.repository,
        action: "block",
      });
    } catch {
      throw new Error("database");
    }
    if (!begun.created) return begun.publication;
    publication = begun.publication;
  }

  try {
    const [gscRows, repository] = await Promise.all([
      gscQueryPages(project.siteUrl, { strict: true }),
      readRepository(project),
    ]);
    const registry = project.renderer === "typescript-post"
      ? repository.files.find(
        (file: { path: string }) => normalizedPath(file.path) === normalizedPath(project.registryPath)
      )
      : null;
    if (project.renderer === "typescript-post"
      && (typeof project.registryPath !== "string" || typeof registry?.content !== "string")) {
      throw new Error("registry-format");
    }
    const inventory = extractInventory(repository.files, project);
    const candidate = rankCandidates(gscRows, inventory)[0] ?? {
      action: "new",
      query: null,
      targetPath: null,
    };
    const researched = await researchAndDraft({
      project,
      runDate,
      candidate,
      inventory,
    });

    const blockedDecision = decisionBlock(
      researched?.action,
      researched?.overlap,
      researched?.reason
    );
    if (blockedDecision) {
      if (dryRun) {
        return {
          status: "dry-run",
          action: "block",
          targetPath: null,
          validation: [blockedDecision],
        };
      }
      return finish(db, publication!.id, "blocked", {
        action: "block",
        reason: blockedDecision,
        metadata: { validation: [blockedDecision] },
      });
    }

    const action = researched?.action;
    if (action !== "new" && action !== "update") {
      const reason = "decision:unsafe";
      if (dryRun) {
        return { status: "dry-run", action: "block", targetPath: null, validation: [reason] };
      }
      return finish(db, publication!.id, "blocked", {
        action: "block",
        reason,
        metadata: { validation: [reason] },
      });
    }

    const draft = researched?.draft ?? {};
    const validation = validateDraft(draft, project, researched?.riskClassification);
    if (validation.length) {
      const reason = `draft:${validation.join(",")}`;
      if (dryRun) {
        return { status: "dry-run", action: "block", targetPath: null, validation };
      }
      return finish(db, publication!.id, "blocked", {
        action: "block",
        reason,
        metadata: { validation },
      });
    }

    const draftSlug = String(draft.slug);
    const requestedTarget = typeof researched?.targetPath === "string"
      ? normalizedPath(researched.targetPath)
      : null;
    const existingTarget = action === "update"
      ? repository.files.find((file: { path: string }) => normalizedPath(file.path) === requestedTarget)
      : project.renderer === "typescript-catalog"
        ? repository.files.find((file: { path: string }) => normalizedPath(file.path) === normalizedPath(project.contentPath))
        : null;
    const selectedEntry = action === "update"
      ? inventory.find((entry: { path: string; slug: string; title?: string; primaryKeyword?: string }) =>
        normalizedPath(entry.path) === requestedTarget
        && entry.slug === draftSlug
      )
      : null;
    const competingEntries = selectedEntry
      ? inventory.filter((entry: unknown) => entry !== selectedEntry)
      : inventory;
    const competingIntents = new Set(competingEntries.flatMap(
      (entry: { title?: string; primaryKeyword?: string }) =>
        [entry.title, entry.primaryKeyword].map(normalizedIntent).filter(Boolean)
    ));
    const duplicate = competingEntries.some((entry: { slug: string }) => entry.slug === draftSlug)
      || [draft.title, draft.primaryKeyword].some((value) => competingIntents.has(normalizedIntent(value)));
    const updateTargetMismatch = action === "update"
      && (!selectedEntry || selectedEntry.slug !== draftSlug);
    const unsafe = !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draftSlug)
      || (action === "new" && requestedTarget !== null)
      || (action === "update" && (!requestedTarget || !existingTarget))
      || updateTargetMismatch;
    if (duplicate || unsafe) {
      const reason = unsafe ? "decision:unsafe" : "decision:duplicate";
      if (dryRun) {
        return { status: "dry-run", action: "block", targetPath: requestedTarget, validation: [reason] };
      }
      return finish(db, publication!.id, "blocked", {
        action: "block",
        reason,
        metadata: { validation: [reason] },
      });
    }

    const rendered = renderDraft(draft, project, existingTarget?.content ?? null);
    const renderedPath = normalizedPath(rendered.path);
    const registryContent = project.renderer === "typescript-post"
      ? registryUpsert(registry.content, draftSlug)
      : null;
    const pathDuplicate = action === "new" && project.renderer !== "typescript-catalog"
      && repository.files.some((file: { path: string }) => normalizedPath(file.path) === renderedPath);
    const unsafeRender = !safeContentPath(renderedPath, project.contentPath)
      || (action === "update" && renderedPath !== requestedTarget);
    if (pathDuplicate || unsafeRender) {
      const reason = pathDuplicate ? "decision:duplicate" : "decision:unsafe";
      if (dryRun) {
        return { status: "dry-run", action: "block", targetPath: renderedPath, validation: [reason] };
      }
      return finish(db, publication!.id, "blocked", {
        action: "block",
        reason,
        metadata: { validation: [reason] },
      });
    }

    if (dryRun) {
      return { status: "dry-run", action, targetPath: renderedPath, validation };
    }

    // astro-content-ptbr valida a imagem como asset local, então precisa dos bytes.
    const image = await pickImage(draft, undefined, {
      embed: project.renderer === "astro-content-ptbr",
    });
    const finalDraft = image ? { ...draft, image } : draft;
    const finalRendered = renderDraft(finalDraft, project, existingTarget?.content ?? null);
    const files: { path: string; content?: string; base64?: string }[] = [
      { path: finalRendered.path, content: finalRendered.content },
    ];
    if (registry
      && typeof project.registryPath === "string"
      && typeof registryContent === "string"
      && registryContent !== registry.content) {
      files.push({ path: project.registryPath, content: registryContent });
    }
    if (finalRendered.imageFile) {
      if (!safeContentPath(finalRendered.imageFile.path, project.imagePath)) {
        return finish(db, publication!.id, "blocked", {
          action: "block",
          reason: "decision:unsafe",
        });
      }
      files.push(finalRendered.imageFile);
    }

    let globallyEnabled: boolean;
    let locallyEnabled: boolean;
    try {
      globallyEnabled = await db.enabled("*");
      locallyEnabled = globallyEnabled ? await db.enabled(slug) : false;
    } catch {
      throw new Error("database");
    }
    if (!globallyEnabled || !locallyEnabled) {
      const reason = globallyEnabled ? "project-disabled" : "global-disabled";
      return finish(db, publication!.id, "blocked", { action: "block", reason });
    }

    await update(db, publication!.id, {
      commitState: "prepared",
      previousSha: repository.headSha,
      targetPath: finalRendered.path,
    });
    const committed = await commitFiles(
      project,
      repository.headSha,
      files,
      `${action === "new" ? "Publish" : "Update"} ${draft.title}`
    );
    const usage = {
      ...(researched?.usage ?? {}),
      generatedImage: Boolean(image?.base64),
    };
    const targetUrl = expectedUrl(project, draftSlug);
    const imageMetadata = image
      ? {
          src: image.base64 ? "generated" : image.src,
          alt: image.alt,
          credit: image.credit,
        }
      : null;
    const completed = {
      action,
      query: candidate.query ?? null,
      intent: draft.primaryKeyword,
      targetUrl,
      commitSha: committed.sha,
      previousSha: committed.previousSha,
      // Sobrou da era OpenAI e gravou "gpt-5.6-terra" no 1o artigo publicado de verdade.
      // Agora o modelo é fixo no CLI, então a linha grava qual de fato escreveu.
      model: `claude-cli:${CLAUDE_MODEL}`,
      inputTokens: Number(usage.inputTokens) || 0,
      outputTokens: Number(usage.outputTokens) || 0,
      imageSource: image?.base64 ? "unsplash-embedded" : image?.src ?? null,
      // Custo nominal: com claude-cli o gasto marginal é zero e o limite é rate limit.
      estimatedCostUsd: estimateCost(usage),
      reason: null,
      metadata: {
        title: draft.title,
        slug: draftSlug,
        targetPath: finalRendered.path,
        sources: draft.sources,
        image: imageMetadata,
        validation,
      },
    };
    try {
      await update(db, publication!.id, {
        commitState: "committed",
        commitSha: committed.sha,
        previousSha: committed.previousSha,
      });
      return await finish(
        db,
        publication!.id,
        action === "new" ? "published" : "updated",
        completed
      );
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "database") throw error;
      let revertCommitSha: string;
      try {
        revertCommitSha = await revertCommit(project, committed.sha, committed.previousSha);
      } catch (revertError) {
        throw revertError;
      }
      try {
        await finish(db, publication!.id, "failed", {
          action: "block",
          reason: "database-after-commit",
          metadata: { commitState: "reverted", revertCommitSha },
        });
      } catch {
        // The prepared/committed metadata remains available for recovery when the database returns.
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "database") throw error;
    const result = failure(error);
    if (dryRun) return result;
    return finish(db, publication!.id, result.status, { reason: result.reason });
  }
}

const attribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i"));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const codePoint = (value: string, radix: number) => {
  const number = Number.parseInt(value, radix);
  return number >= 0 && number <= 0x10ffff ? String.fromCodePoint(number) : "";
};

const decodeHtml = (value: string) => value
  .replace(/&#(\d+);/g, (_, number) => codePoint(number, 10))
  .replace(/&#x([\da-f]+);/gi, (_, number) => codePoint(number, 16))
  .replace(/&(amp|quot|apos|lt|gt|#39);/gi, (entity) => ({
    "&amp;": "&",
    "&quot;": '"',
    "&apos;": "'",
    "&lt;": "<",
    "&gt;": ">",
    "&#39;": "'",
  })[entity.toLowerCase()] ?? entity);

const normalizedText = (value: string) => decodeHtml(value.replace(/<[^>]*>/g, " "))
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

function sameUrl(value: string, expected: string) {
  try {
    return new URL(value, expected).href === new URL(expected).href;
  } catch {
    return false;
  }
}

const blocksIndexing = (value: string) =>
  /(?:^|[\s,])(?:noindex|none)(?=$|[\s,])/i.test(value);

function validateHtml(html: string, expectedTitle: string, targetUrl: string) {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => match[1]);
  const expected = normalizedText(expectedTitle);
  if (!expected || !normalizedText(title).includes(expected)
    || !headings.some((heading) => normalizedText(heading).includes(expected))) {
    return "content";
  }

  const canonical = (html.match(/<link\b[^>]*>/gi) ?? []).find((tag) =>
    (attribute(tag, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical")
  );
  if (!canonical || !sameUrl(attribute(canonical, "href") ?? "", targetUrl)) return "canonical";

  const noindex = (html.match(/<meta\b[^>]*>/gi) ?? []).some((tag) => {
    const name = (attribute(tag, "name") ?? "").toLowerCase();
    return ["robots", "googlebot"].includes(name)
      && blocksIndexing(attribute(tag, "content") ?? "");
  });
  if (noindex) return "noindex";

  const jsonLd = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => (attribute(match[1], "type") ?? "").toLowerCase() === "application/ld+json");
  if (!jsonLd.length) return "jsonld";
  try {
    for (const script of jsonLd) JSON.parse(script[2]);
  } catch {
    return "jsonld";
  }
  return null;
}

async function revertPublication(
  db: PublicationDb,
  publication: NonNullable<Awaited<ReturnType<typeof getPublication>>>,
  project: Project,
  reason: string,
  verification: Record<string, unknown>,
  revertCommit: Dependency
) {
  let revertCommitSha: string;
  try {
    revertCommitSha = await revertCommit(project, publication.commitSha, publication.previousSha);
  } catch (error) {
    if (error instanceof Error && error.message === "github-conflict") throw error;
    throw new Error("verification-revert");
  }
  return finish(db, publication.id, "reverted", {
    reason,
    metadata: {
      verification: { ok: false, reason, ...verification },
      verificationAttempts: verification.attempt,
      revertCommitSha,
    },
  });
}

export async function verifyPublication(
  id: number,
  dependencies: VerifyDependencies = {}
) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("publication-id");
  const {
    db = database,
    deploymentState = getDeploymentState,
    revertCommit = createRevertCommit,
    fetch: fetchImpl = fetch,
  } = dependencies;

  let publication: Awaited<ReturnType<typeof getPublication>>;
  try {
    publication = await db.get(id);
  } catch {
    throw new Error("database");
  }
  if (!publication) throw new Error("publication-not-found");
  if (!["published", "updated"].includes(publication.status)) {
    throw new Error("publication-not-verifiable");
  }

  const project = projectBySlug(publication.projectSlug);
  if (!project || !publication.targetUrl || !publication.commitSha || !publication.previousSha) {
    throw new Error("publication-metadata");
  }
  try {
    if (new URL(publication.targetUrl).origin !== new URL(project.siteUrl).origin) {
      throw new Error();
    }
  } catch {
    return revertPublication(
      db,
      publication,
      project,
      "verification:target-url",
      { attempt: 1 },
      revertCommit
    );
  }

  const previousAttempts = Number(publication.metadata.verificationAttempts) || 0;
  const attempt = previousAttempts + 1;
  let deployment: string;
  try {
    deployment = await deploymentState(project, publication.commitSha);
  } catch {
    deployment = "unavailable";
  }
  if (["pending", "unavailable"].includes(deployment) && attempt < 5) {
    await update(db, id, {
      verificationAttempts: attempt,
      verification: { ok: false, pending: true, attempt, deployment },
    });
    return { id, status: "pending", attempt, deployment };
  }
  if (deployment !== "success") {
    const reason = deployment === "pending"
      ? "verification:deployment-timeout"
      : deployment === "unavailable"
        ? "verification:deployment-unavailable"
        : "verification:deployment-failed";
    return revertPublication(db, publication, project, reason, { attempt, deployment }, revertCommit);
  }

  let page: Response;
  let html: string;
  try {
    page = await fetchImpl(publication.targetUrl, { redirect: "manual" });
    html = await page.text();
  } catch {
    return revertPublication(db, publication, project, "verification:http", { attempt, deployment }, revertCommit);
  }
  if (page.status !== 200) {
    return revertPublication(db, publication, project, "verification:http", { attempt, deployment }, revertCommit);
  }

  const htmlFailure = blocksIndexing(page.headers.get("x-robots-tag") ?? "")
    ? "noindex"
    : validateHtml(html, String(publication.metadata.title ?? ""), publication.targetUrl);
  if (htmlFailure) {
    return revertPublication(
      db,
      publication,
      project,
      `verification:${htmlFailure}`,
      { attempt, deployment, httpStatus: page.status },
      revertCommit
    );
  }

  const sitemapUrl = new URL("/sitemap.xml", project.siteUrl).href;
  let sitemap: Response;
  let sitemapXml: string;
  try {
    sitemap = await fetchImpl(sitemapUrl, { redirect: "manual" });
    sitemapXml = await sitemap.text();
  } catch {
    return revertPublication(db, publication, project, "verification:sitemap", { attempt, deployment }, revertCommit);
  }
  const locations = [...sitemapXml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeHtml(match[1].trim()));
  if (sitemap.status !== 200 || !locations.some((location) => sameUrl(location, publication.targetUrl!))) {
    return revertPublication(db, publication, project, "verification:sitemap", { attempt, deployment }, revertCommit);
  }

  return update(db, id, {
    verificationAttempts: attempt,
    verification: {
      ok: true,
      attempt,
      deployment,
      httpStatus: page.status,
      canonical: publication.targetUrl,
      sitemap: sitemapUrl,
    },
  });
}
