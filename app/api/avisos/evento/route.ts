import { NextResponse } from "next/server.js";
import { avisoDeEvento, enviarTelegram, faltandoTelegram, parseAvisoEvento } from "@/lib/avisos.mjs";

// A autenticação é do middleware: Bearer CRM_INGEST_SECRET, como na rota de ticket (spec 027, R2).

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

  const parsed = parseAvisoEvento(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.erro }, { status: 400 });

  // Aguardado pelo mesmo motivo da rota de ticket: a origem já chama solta, e o 200/502 é a prova do
  // quickstart.
  const r = await enviarTelegram(avisoDeEvento(parsed.aviso), process.env);
  if (!r.ok) {
    console.error(`[avisos] evento ${parsed.aviso.projeto}: ${r.erro}`);
    return NextResponse.json({ error: r.erro }, { status: 502 });
  }
  return NextResponse.json({ enviado: true });
}
