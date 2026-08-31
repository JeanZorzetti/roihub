"use server";

import { revalidatePath } from "next/cache";
import { dbOn, setDone } from "@/lib/db";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O único write da agenda: marcar/desmarcar uma ação do ranking.
 *
 * A aba não cria, não edita e não apaga nada — ela é a projeção do `data/projects.json`, e o
 * check é o único estado que ela tem. `key` vem do form, então é validada aqui: sem o prefixo
 * `acao:` este endpoint marcaria qualquer linha de `hub_done`, inclusive as das tarefas que a
 * agenda não renderiza mais.
 */
export async function toggle(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const key = String(fd.get("key") ?? "");
  const occurrence = String(fd.get("occurrence") ?? "");
  if (!key.startsWith("acao:") || !ISO_DATE.test(occurrence)) return;
  await setDone(key, occurrence, String(fd.get("to")) === "1");
  revalidatePath("/agenda");
}
