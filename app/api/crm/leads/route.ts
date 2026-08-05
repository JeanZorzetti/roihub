import { NextResponse } from "next/server.js";
import pipelines from "@/data/pipelines.json";
import { parseLead } from "@/lib/crm.mjs";
import { dbOn, insertLead } from "@/lib/db";

// A autenticação é do middleware (Bearer CRM_INGEST_SECRET) — sem isenção lá,
// esta rota toma o Basic auth do hub e a Orion recebe 401.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!dbOn()) return NextResponse.json({ error: "DATABASE_URL ausente" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseLead(body, pipelines);
  if (!parsed.ok) return NextResponse.json({ error: parsed.erro }, { status: 400 });

  const { id, created } = await insertLead(parsed.lead);
  // 200 no reenvio, não 409: quem chama trata erro como "tentar de novo", e
  // tentar de novo é exatamente o que já deu certo.
  return NextResponse.json({ id, created }, { status: created ? 201 : 200 });
}
