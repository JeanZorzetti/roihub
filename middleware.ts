import { NextResponse, type NextRequest } from "next/server.js";
import { authorized } from "./lib/autopublish-core.mjs";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/seo/autopublish") {
    return authorized(req.headers.get("authorization"), process.env.CRON_SECRET ?? "")
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Ingestão de leads: mesmo padrão do autopublish, segredo PRÓPRIO. Reusar o
  // CRON_SECRET daria a quem publica artigo o direito de gravar lead.
  if (req.nextUrl.pathname === "/api/crm/leads") {
    return authorized(req.headers.get("authorization"), process.env.CRM_INGEST_SECRET ?? "")
      ? NextResponse.next()
      : NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pass = process.env.HUB_PASS;
  if (!pass) {
    // Fail closed em produção: hub lista blockers e notas internas de todos os projetos.
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("HUB_PASS não configurado", { status: 503 });
    }
    return NextResponse.next();
  }
  const expected = "Basic " + btoa(`${process.env.HUB_USER ?? "roi"}:${pass}`);
  if (req.headers.get("authorization") === expected) return NextResponse.next();
  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="roihub"' },
  });
}

export const config = { matcher: ["/((?!_next|favicon.ico).*)"] };
