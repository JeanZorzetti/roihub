"use server";

import { revalidatePath } from "next/cache";
import { PROJECTS } from "@/lib/autopublish-projects.mjs";
import { dbOn, setProjectEnabled } from "@/lib/db";
import { parseProjectStateFields } from "./action-fields.mjs";

// Valida contra PROJECTS (o que o painel de controle de fato renderiza), não contra a lista
// do hub: o tapepro é projeto de autopublishing sem entrada em data/projects.json e o botão
// dele era rejeitado em silêncio.
const PROJECT_SLUGS = new Set<string>(PROJECTS.map(({ slug }: { slug: string }) => slug));

export async function updatePublishingState(form: FormData): Promise<void> {
  const fields = parseProjectStateFields(form, PROJECT_SLUGS);
  if (!fields) return;
  if (dbOn()) await setProjectEnabled(fields.slug, fields.enabled, fields.reason);
  revalidatePath("/seo");
}
