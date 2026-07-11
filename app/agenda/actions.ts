"use server";

import { revalidatePath } from "next/cache";
import { dbOn, insertTask, removeTask, setDone, updateTask } from "@/lib/db";
import { NO_DATE } from "@/lib/agenda.mjs";
import projects from "@/data/projects.json";

const SLUGS = new Set(projects.map((p) => p.slug));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function taskFields(fd: FormData) {
  const titulo = String(fd.get("titulo") ?? "").trim().slice(0, 200);
  const descricao = String(fd.get("descricao") ?? "").trim().slice(0, 2000) || null;
  const wdRaw = String(fd.get("weekday") ?? "");
  const weekday = /^[0-6]$/.test(wdRaw) ? Number(wdRaw) : null;
  const dueRaw = String(fd.get("due") ?? "");
  const due = weekday === null && ISO_DATE.test(dueRaw) ? dueRaw : null; // recorrente ignora data
  const projRaw = String(fd.get("projeto") ?? "");
  const projeto = SLUGS.has(projRaw) ? projRaw : null;
  return { titulo, descricao, projeto, due, weekday };
}

export async function addTask(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const t = taskFields(fd);
  if (!t.titulo) return;
  await insertTask(t);
  revalidatePath("/agenda");
}

export async function update(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  const t = taskFields(fd);
  if (!t.titulo) return;
  await updateTask(id, t);
  revalidatePath("/agenda");
}

/** Ação do ranking (projects.json, read-only) vira tarefa do banco; a original é riscada. */
export async function promote(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const key = String(fd.get("key") ?? "");
  if (!key.startsWith("acao:")) return;
  const t = taskFields(fd);
  if (!t.titulo) return;
  await insertTask(t);
  await setDone(key, NO_DATE, true);
  revalidatePath("/agenda");
}

export async function toggle(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const key = String(fd.get("key") ?? "");
  const occurrence = String(fd.get("occurrence") ?? "");
  if (!key || !ISO_DATE.test(occurrence)) return;
  await setDone(key, occurrence, String(fd.get("to")) === "1");
  revalidatePath("/agenda");
}

export async function del(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id)) return;
  await removeTask(id);
  revalidatePath("/agenda");
}
