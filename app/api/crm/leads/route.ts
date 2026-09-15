import { NextResponse, after } from "next/server.js";
import pipelines from "@/data/pipelines.json";
import { avisoDeLead, enviarTelegram } from "@/lib/avisos.mjs";
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

  // Aviso só de lead NOVO: o reenvio volta created=false pelo UNIQUE(external_id), e esse é o dedupe
  // da spec 026. Sem 503 por falta do bot e fora da resposta — o dever desta rota é gravar o lead.
  const aviso = created ? avisoDeLead(parsed.lead, pipelines) : null;
  if (aviso) {
    after(async () => {
      const r = await enviarTelegram(aviso, process.env);
      if (!r.ok) console.error(`[avisos] lead ${id}: ${r.erro}`);
    });
  }

  // 200 no reenvio, não 409: quem chama trata erro como "tentar de novo", e
  // tentar de novo é exatamente o que já deu certo.
  return NextResponse.json({ id, created }, { status: created ? 201 : 200 });
}
