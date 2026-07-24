"use server";

import { revalidatePath } from "next/cache";
import projects from "@/data/projects.json";
import { dbOn, setProjectEnabled } from "@/lib/db";
import { parseProjectStateFields } from "./action-fields.mjs";

const PROJECT_SLUGS = new Set(projects.map((project) => project.slug));

export async function updatePublishingState(form: FormData): Promise<void> {
  const fields = parseProjectStateFields(form, PROJECT_SLUGS);
  if (!fields) return;
  if (dbOn()) await setProjectEnabled(fields.slug, fields.enabled, fields.reason);
  revalidatePath("/seo");
}
