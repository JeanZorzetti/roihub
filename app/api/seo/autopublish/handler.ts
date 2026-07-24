import {
  publishProject as publish,
  verifyPublication as verify,
// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
} from "../../../../lib/autopublish.ts";
import { authorized, missingEnv } from "../../../../lib/autopublish-core.mjs";
import { projectBySlug } from "../../../../lib/autopublish-projects.mjs";

type Body =
  | { phase: "publish"; project: string; runDate: string; dryRun?: boolean }
  | { phase: "verify"; publicationId: number };

type Dependencies = {
  env: NodeJS.ProcessEnv;
  publishProject: typeof publish;
  verifyPublication: typeof verify;
};

const jsonError = (error: string, status: number, fields?: string[]) =>
  Response.json({ error, ...(fields ? { fields } : {}) }, { status });

const exactKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));

function validRunDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validBody(value: unknown): value is Body {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  if (body.phase === "publish") {
    return exactKeys(body, ["phase", "project", "runDate", "dryRun"])
      && typeof body.project === "string"
      && projectBySlug(body.project) !== null
      && validRunDate(body.runDate)
      && (!Object.hasOwn(body, "dryRun") || typeof body.dryRun === "boolean");
  }
  if (body.phase === "verify") {
    return exactKeys(body, ["phase", "publicationId"])
      && Number.isSafeInteger(body.publicationId)
      && Number(body.publicationId) > 0;
  }
  return false;
}

export async function handleAutopublish(
  request: Request,
  {
    env = process.env,
    publishProject = publish,
    verifyPublication = verify,
  }: Partial<Dependencies> = {}
) {
  if (!authorized(request.headers.get("authorization"), env.CRON_SECRET ?? "")) {
    return jsonError("unauthorized", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid-request", 400);
  }
  if (!validBody(body)) return jsonError("invalid-request", 400);

  const missing = missingEnv(env);
  if (missing.length) return jsonError("missing-env", 503, missing);

  try {
    const result = body.phase === "publish"
      ? await publishProject(body.project, body.runDate, { dryRun: body.dryRun ?? false })
      : await verifyPublication(body.publicationId);
    if ("reason" in result && result.reason === "github-conflict") {
      return jsonError("github-conflict", 409);
    }
    return Response.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "github-conflict") return jsonError("github-conflict", 409);
    if (code === "database") return jsonError("database-unavailable", 503);
    if (["project", "run-date", "publication-id", "publication-not-found", "publication-not-verifiable"].includes(code)) {
      return jsonError("invalid-request", 400);
    }
    return jsonError("internal-error", 500);
  }
}
