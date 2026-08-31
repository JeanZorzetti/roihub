"use server";

import { revalidatePath } from "next/cache";
import { dbOn, setDone, setDono } from "@/lib/db";
import { RESPONSAVEL_IDS } from "@/lib/agenda.mjs";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Os DOIS writes da agenda, e nada além de dois: marcar a ação (`toggle`) e dizer de quem ela
 * é (`atribuir`).
 *
 * A aba não cria, não edita e não apaga tarefa — ela é a projeção do `data/projects.json`, e
 * esses dois são o estado que ela guarda por cima. `key` vem do form, então é validada nas
 * duas: sem o prefixo `acao:` estes endpoints escreveriam sobre qualquer linha do banco,
 * inclusive as das tarefas que a agenda não renderiza mais.
 */
export async function toggle(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const key = String(fd.get("key") ?? "");
  const occurrence = String(fd.get("occurrence") ?? "");
  if (!key.startsWith("acao:") || !ISO_DATE.test(occurrence)) return;
  await setDone(key, occurrence, String(fd.get("to")) === "1");
  revalidatePath("/agenda");
}

/**
 * Atribui (ou tira) o responsável de uma ação do ranking.
 *
 * Responsável desconhecido vira `null` em vez de erro, como a agenda já faz com projeto
 * desconhecido na querystring: formulário é entrada de usuário e o valor volta para a tela.
 * O botão do responsável já ativo manda `""` — é assim que se desatribui com um clique só.
 */
export async function atribuir(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const key = String(fd.get("key") ?? "");
  if (!key.startsWith("acao:")) return;
  const resp = String(fd.get("responsavel") ?? "");
  await setDono(key, (RESPONSAVEL_IDS as string[]).includes(resp) ? resp : null);
  revalidatePath("/agenda");
}
