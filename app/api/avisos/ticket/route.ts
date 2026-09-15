import { NextResponse } from "next/server.js";
import pipelines from "@/data/pipelines.json";
import { avisoDeTicket, enviarTelegram, faltandoTelegram, parseAvisoTicket } from "@/lib/avisos.mjs";

// A autenticação é do middleware: Bearer CRM_INGEST_SECRET, o mesmo da ingestão de lead (spec 026).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const fields = faltandoTelegram(process.env);
  if (fields.length) return NextResponse.json({ error: "missing-env", fields }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseAvisoTicket(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.erro }, { status: 400 });

  // Aguardado, e não em after(): o produto já chama em after(), então esperar não atrasa o cliente
  // e o 200/502 é a prova do quickstart.
  const r = await enviarTelegram(avisoDeTicket(parsed.aviso, pipelines), process.env);
  if (!r.ok) {
    console.error(`[avisos] ticket ${parsed.aviso.produto}/${parsed.aviso.ticketId}: ${r.erro}`);
    return NextResponse.json({ error: r.erro }, { status: 502 });
  }
  return NextResponse.json({ enviado: true });
}
