import { timingSafeEqual } from "node:crypto";

const PRICE = {
  inputPerToken: 2.5 / 1_000_000,
  outputPerToken: 15 / 1_000_000,
  webSearchCall: 10 / 1_000,
  imageLowLandscape: 0.005,
};

const TRANSITIONS = {
  running: new Set(["published", "updated", "blocked", "failed"]),
  published: new Set(["reverted"]),
  updated: new Set(["reverted"]),
  blocked: new Set(),
  failed: new Set(),
  reverted: new Set(),
};

export function validTransition(from, to) {
  return TRANSITIONS[from]?.has(to) ?? false;
}

const normalizeIntent = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

export function authorized(header, secret) {
  if (typeof header !== "string" || typeof secret !== "string") return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function rankCandidates(rows, inventory) {
  const intents = new Map();
  for (const entry of inventory) {
    for (const value of [entry.title, entry.primaryKeyword]) {
      const intent = normalizeIntent(value);
      if (intent) intents.set(intent, entry);
    }
  }

  return rows.map((row, index) => {
    const current = row.current ?? {};
    const previous = row.previous ?? {};
    const position = Number(current.position) || 0;
    const entry = intents.get(normalizeIntent(row.query));
    const score = (Number(current.impressions) || 0) - (Number(previous.impressions) || 0)
      + (Number(current.impressions) || 0)
      + (position >= 4 && position <= 20 ? 20 - position : 0);
    return {
      ...row,
      action: entry ? "update" : "new",
      ...(entry ? { targetPath: entry.path } : {}),
      score,
      index,
    };
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ index, ...candidate }) => candidate);
}

const hasPlaceholder = (value) => {
  if (typeof value === "string") return /\b(?:fill[_ -]?me|todo|tbd|placeholder)\b|{{|}}/i.test(value);
  if (Array.isArray(value)) return value.some(hasPlaceholder);
  return value && typeof value === "object" && Object.values(value).some(hasPlaceholder);
};

const hasUnsafeMarkup = (value) => {
  if (typeof value === "string") return /<(?:script|style|iframe|object|embed|form)\b|\bon\w+\s*=/i.test(value);
  if (Array.isArray(value)) return value.some(hasUnsafeMarkup);
  return value && typeof value === "object" && Object.values(value).some(hasUnsafeMarkup);
};

export function validateDraft(draft, project) {
  const content = JSON.stringify(draft ?? {});
  const source = draft?.sources?.[0];
  const invalid = new Set();
  if (hasPlaceholder(draft)) invalid.add("placeholder");
  if (!Array.isArray(draft?.sources) || !draft.sources.length || !source?.url || !source?.title) invalid.add("sources");
  if (typeof draft?.bluf !== "string" || !draft.bluf.trim()) invalid.add("bluf");
  if (Array.isArray(draft?.existingIntents) && draft.existingIntents.some((intent) => normalizeIntent(intent) === normalizeIntent(draft.primaryKeyword))) invalid.add("duplicate-intent");
  if (project?.risk === "ymyl-restricted" && /\b(?:botox|dosage|dose|diagnos(?:is|e)|prescri(?:be|ption)|treat(?:ment)?|cure)\b/i.test(content)) invalid.add("ymyl");
  if (!draft?.title || !draft?.description || !draft?.primaryKeyword || !draft?.cluster || !Array.isArray(draft?.sections) || !draft.sections.length || draft.sections.some((section) => !section?.heading || !Array.isArray(section.paragraphs) || !section.paragraphs.length)) invalid.add("structure");
  if (hasUnsafeMarkup(draft)) invalid.add("unsafe-markup");
  return ["placeholder", "sources", "bluf", "duplicate-intent", "ymyl", "structure", "unsafe-markup"].filter((code) => invalid.has(code));
}

export function estimateCost(usage = {}) {
  return (usage.inputTokens || 0) * PRICE.inputPerToken
    + (usage.outputTokens || 0) * PRICE.outputPerToken
    + (usage.webSearchCalls || 0) * PRICE.webSearchCall
    + (usage.generatedImage ? PRICE.imageLowLandscape : 0);
}
