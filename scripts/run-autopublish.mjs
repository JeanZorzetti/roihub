import { PROJECTS } from "../lib/autopublish-projects.mjs";
import { pathToFileURL } from "node:url";

export const PROJECT_SLUGS = Object.freeze(PROJECTS.map(({ slug }) => slug));

export function runDateInSaoPaulo(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now).map(({ type, value }) => [type, value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const KNOWN_STATUSES = new Set([
  "dry-run",
  "published",
  "updated",
  "blocked",
  "failed",
  "reverted",
  "pending",
]);

function stableReason(reason) {
  if (typeof reason !== "string") return null;
  return /^(?:global-disabled|project-disabled|decision:(?:duplicate|unsafe)|draft:[a-z,-]+|openai-(?:auth|rate|output)|unsplash-(?:auth|rate|output)|github-(?:auth|rate|output|conflict)|render:[a-z:-]+|verification:[a-z-]+|request-failed|invalid-response|invalid-result|verification-timeout|http-\d{3}|unexpected)$/.test(reason)
    ? reason
    : null;
}

function normalizedResult(value, body) {
  if (!value || typeof value !== "object" || !KNOWN_STATUSES.has(value.status)) {
    return { status: "failed", reason: "invalid-response" };
  }
  const id = Number.isSafeInteger(value.id) && value.id > 0 ? value.id : null;
  const result = {
    status: value.status,
    ...(id ? { id } : {}),
    ...(stableReason(value.reason) ? { reason: value.reason } : {}),
  };
  const allowed = body.phase === "verify"
    ? ["pending", "published", "updated", "failed", "reverted"]
    : body.dryRun
      ? ["dry-run", "failed", "reverted"]
      : ["published", "updated", "blocked", "failed", "reverted"];
  const invalidId = body.phase === "verify"
    ? result.status !== "failed" && result.id !== body.publicationId
    : ["published", "updated"].includes(result.status) && !result.id;
  return !allowed.includes(result.status)
    || invalidId
    ? { status: "failed", reason: "invalid-result" }
    : result;
}

function writeSummary(log, slug, result) {
  const fields = [`slug=${slug}`, `status=${result.status}`];
  if (result.id) fields.push(`id=${result.id}`);
  if (result.reason) fields.push(`reason=${result.reason}`);
  log(fields.join(" "));
}

async function requestPhase(endpoint, secret, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: "failed", reason: "request-failed" };
  }
  if (!response.ok) return { status: "failed", reason: `http-${response.status}` };
  try {
    return normalizedResult(await response.json(), body);
  } catch {
    return { status: "failed", reason: "invalid-response" };
  }
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function runAutopublish({
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
  sleep = wait,
  log = console.log,
} = {}) {
  const hubUrl = typeof env.HUB_URL === "string" ? env.HUB_URL.trim() : "";
  const secret = typeof env.HUB_CRON_SECRET === "string" ? env.HUB_CRON_SECRET.trim() : "";
  const dryRunValue = typeof env.DRY_RUN === "string" ? env.DRY_RUN.trim().toLowerCase() : "";
  if (!hubUrl || !secret || !["true", "false"].includes(dryRunValue)) return 1;

  let endpoint;
  try {
    endpoint = new URL("/api/seo/autopublish", hubUrl).href;
  } catch {
    return 1;
  }

  const dryRun = dryRunValue === "true";
  const runDate = runDateInSaoPaulo(now);
  const published = [];
  for (const project of PROJECT_SLUGS) {
    const result = await requestPhase(endpoint, secret, {
      phase: "publish",
      project,
      runDate,
      dryRun,
    }, fetchImpl);
    published.push({ project, result });
    writeSummary(log, project, result);
  }

  let failed = published.some(({ result }) => ["failed", "reverted"].includes(result.status));
  if (dryRun) return failed ? 1 : 0;

  let pending = published.flatMap(({ project, result }) =>
    ["published", "updated"].includes(result.status) && result.id
      ? [{ project, id: result.id }]
      : []
  );
  if (!pending.length) return failed ? 1 : 0;

  await sleep(90_000);
  for (let round = 0; round < 5 && pending.length; round += 1) {
    const next = [];
    for (const publication of pending) {
      const result = await requestPhase(endpoint, secret, {
        phase: "verify",
        publicationId: publication.id,
      }, fetchImpl);
      writeSummary(log, publication.project, result);
      if (["failed", "reverted"].includes(result.status)) failed = true;
      if (result.status === "pending") {
        if (round === 4) {
          failed = true;
          writeSummary(log, publication.project, {
            id: publication.id,
            status: "failed",
            reason: "verification-timeout",
          });
        } else {
          next.push(publication);
        }
      }
    }
    pending = next;
    if (pending.length) await sleep(60_000);
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runAutopublish();
}
