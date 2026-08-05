"use server";

import { revalidatePath } from "next/cache";
import pipelines from "@/data/pipelines.json";
import { etapasDe } from "@/lib/crm.mjs";
import { dbOn, moveLead } from "@/lib/db";

/** `<select>` de etapa + submit. ponytail: kanban com drag-and-drop quando
 * houver lead demais para uma lista — hoje não há. */
export async function mover(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;

  const pipeline = String(fd.get("pipeline") ?? "");
  const etapa = String(fd.get("etapa") ?? "");
  // Mesma regra da ingestão: etapa vale contra o pipelines.json, não contra o
  // que o form mandou. Form é entrada de usuário como qualquer outra.
  if (!etapasDe(pipelines, pipeline).includes(etapa)) return;

  await moveLead(id, etapa, String(fd.get("nota") ?? "").trim().slice(0, 300) || null);
  revalidatePath("/crm");
}
