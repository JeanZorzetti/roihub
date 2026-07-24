// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
import { handleAutopublish } from "./handler.ts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  return handleAutopublish(request);
}
