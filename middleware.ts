import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
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
