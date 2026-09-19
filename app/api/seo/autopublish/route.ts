// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
import { publishProject } from "../../../../lib/autopublish.ts";
// @ts-expect-error Node's direct TypeScript execution requires the .ts extension.
import { handleAutopublish } from "./handler.ts";

export const runtime = "nodejs";
// Medido em produção: 240s por projeto, e o YMYL soma uma 2a chamada ao classificador.
// O proxy do EasyPanel precisa acompanhar, senão o cron recebe 504 antes do fim.
export const maxDuration = 900;

export async function POST(request: Request) {
  return handleAutopublish(request, {
    publishProject: async (slug, runDate, dependencies) => {
      // 030: o `dominioAnterior` do card entra aqui, e por import DINÂMICO: `lib/projects.ts` usa o
      // alias `@/` e não carrega no Node dos testes, que importam este arquivo. Só uma publicação
      // real chega a esta linha. Sem ele a pauta leria só o host de `siteUrl`.
      const { dominioAnteriorDoSlug } = await import("@/lib/projects");
      return publishProject(slug, runDate, { ...dependencies, dominioAnterior: dominioAnteriorDoSlug });
    },
  });
}
