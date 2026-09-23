"use server";

import { revalidatePath } from "next/cache";
import { dbOn, delMarca, setMarca } from "@/lib/db";
import { SLUGS_DE_BUSCA } from "@/lib/projects";
import { todaySP } from "@/lib/agenda.mjs";
import { ALAVANCAS, lerMarca } from "@/lib/proxima-acao.mjs";

/**
 * Os dois writes do mapa (055): marcar uma alavanca como feita e desfazer. Toda a validação mora
 * em `lerMarca()`, que é pura e testada; entrada fora do contrato não grava, como na agenda.
 */
export async function marcar(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const m = lerMarca(Object.fromEntries(fd), { slugs: SLUGS_DE_BUSCA, hoje: todaySP() });
  if (!m) return;
  await setMarca(m);
  revalidatePath(`/gsc/mapa/${m.projeto}`);
}

export async function desmarcar(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const projeto = String(fd.get("projeto") ?? "");
  const alavanca = String(fd.get("alavanca") ?? "");
  if (!SLUGS_DE_BUSCA.includes(projeto) || !Object.hasOwn(ALAVANCAS, alavanca)) return;
  await delMarca(projeto, alavanca);
  revalidatePath(`/gsc/mapa/${projeto}`);
}
