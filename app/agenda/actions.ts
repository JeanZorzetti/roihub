"use server";

import { revalidatePath } from "next/cache";
import { dbOn, insertTask, removeTask, setDone } from "@/lib/db";
import projects from "@/data/projects.json";

const SLUGS = new Set(projects.map((p) => p.slug));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function addTask(fd: FormData): Promise<void> {
  if (!dbOn()) return;
  const titulo = String(fd.get("titulo") ?? "").trim().slice(0, 200);
  if (!titulo) return;
  const wdRaw = String(fd.get("weekday") ?? "");
  const weekday = /^[0-6]$/.test(wdRaw) ? Number(wdRaw) : null;
  const dueRaw = String(fd.get("due") ?? "");
  const due = weekday === null && ISO_DATE.test(dueRaw) ? dueRaw : null; // recorrente ignora data
  const projRaw = String(fd.get("projeto") ?? "");
  const projeto = SLUGS.has(projRaw) ? projRaw : null;
  await insertTask({ titulo, projeto, due, weekday });
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
