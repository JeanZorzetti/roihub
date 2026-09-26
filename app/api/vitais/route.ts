import { NextResponse } from "next/server.js";
import { dbOn, gravarVital } from "@/lib/db";
import { slugDeCampoDoHost } from "@/lib/projects";
import { CORPO_MAX, lerMedida } from "@/lib/rum.mjs";

// 056 — the field beacon of our own sites (RUM). OPEN on purpose: the caller is a visitor's browser,
// which has no secret to send. The middleware exempts this path from the hub's Basic auth. Every
// answer is an empty 204 (contract): `sendBeacon` never reads it, and a prober must not learn which
// filter caught a request.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One page load sends at most 4 beacons, so 20 a minute covers 5 loads from the same address. The
// address lives only in this Map and never reaches the database or a log (FR-004).
// ponytail: per-replica counter; move it to the database if the hub ever runs more than one.
const POR_MINUTO = 20;
let minuto = 0;
const envios = new Map<string, number>();
function excedeu(fonte: string): boolean {
  const agora = Math.floor(Date.now() / 60_000);
  if (agora !== minuto) {
    minuto = agora;
    envios.clear();
  }
  const n = (envios.get(fonte) ?? 0) + 1;
  envios.set(fonte, n);
  return n > POR_MINUTO;
}

const nada = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  if (!dbOn()) return NextResponse.json({ faltando: ["DATABASE_URL"] }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > CORPO_MAX) return nada();
  if (excedeu(request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "")) return nada();

  const corpo = await request.text().catch(() => "");
  const medida = lerMedida(
    corpo,
    { origem: request.headers.get("origin") ?? "", agente: request.headers.get("user-agent") ?? "" },
    slugDeCampoDoHost,
  );
  if (medida) {
    await gravarVital(medida).catch((e: unknown) => {
      console.error(`[vitais] gravar falhou: ${e instanceof Error ? e.message.slice(0, 80) : "erro"}`);
    });
  }
  return nada();
}
