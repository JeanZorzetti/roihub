// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
import { handleAutopublish } from "./handler.ts";

export const runtime = "nodejs";
// Medido em produção: 240s por projeto, e o YMYL soma uma 2a chamada ao classificador.
// O proxy do EasyPanel precisa acompanhar, senão o cron recebe 504 antes do fim.
export const maxDuration = 900;

export async function POST(request: Request) {
  return handleAutopublish(request);
}
