export function parseProjectStateFields(form, projectSlugs) {
  const slug = String(form.get("slug") ?? "");
  const rawEnabled = form.get("enabled");
  if ((slug !== "*" && !projectSlugs.has(slug)) || (rawEnabled !== "true" && rawEnabled !== "false")) return null;

  const enabled = rawEnabled === "true";
  const reason = String(form.get("reason") ?? "").trim().slice(0, 300) || null;
  return { slug, enabled, reason: enabled ? null : reason };
}
