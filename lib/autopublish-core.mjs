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

const operationalScope = /\b(?:operations?|operational|software|platform|workflow|automation|scheduling|scheduler|appointments?|booking|intake|forms?|crm|practice management|clinic management|administrative|administration|front desk|communication|messages?|reminders?|follow up|billing|payments?|invoicing|inventory|staff|team|reviews?|reputation|marketing|lead management|analytics|reporting|retention|no shows?|customer service|client management|business process(?:es)?|metrics?|kpis?|measur(?:e|es|ed|ing|ement|ements)|tracking|response time|completion rate|data|dashboard|database|integration|api)\b/;
const clinicalGuidance = /\b(?:botox|fillers?|inject(?:ion|able|ed|ing)?|dosage|dose|diagnos(?:is|e)|prescri(?:be|ption)|medications?|medicine|treat(?:ment|ed|ing)?|cure|symptoms?|contraindications?|side effects?|swelling|swollen|bruis(?:e|ing)|cold compress(?:es)?|ice packs?|infections?|allergic|anaphylaxis|bleeding|wounds?|fever|pain|antibiotics?|ibuprofen|paracetamol|acetaminophen|aspirin|pregnan(?:t|cy)|emergency|alcohol|sun(?:light| exposure)?|exercis(?:e|es|ed|ing)|physical activity|aftercare instructions?|recovery instructions?|patients? (?:should|must|need to|can|cannot|may|do not))\b/;

function scopedEditorialBlocks(draft) {
  const intent = [draft?.title, draft?.description, draft?.primaryKeyword]
    .map(normalizeIntent)
    .filter(Boolean)
    .join(" ");
  const narrative = [
    draft?.bluf,
    ...(Array.isArray(draft?.sections)
      ? draft.sections.flatMap((section) => [
          section?.heading,
          ...(Array.isArray(section?.paragraphs) ? section.paragraphs : []),
        ])
      : []),
    ...(Array.isArray(draft?.faqs)
      ? draft.faqs.flatMap((faq) => [
          faq?.q ?? faq?.question,
          faq?.a ?? faq?.answer,
        ])
      : []),
  ].map(normalizeIntent).filter(Boolean);
  return { intent, narrative };
}

export function validateDraft(draft, project) {
  const source = draft?.sources?.[0];
  const invalid = new Set();
  if (hasPlaceholder(draft)) invalid.add("placeholder");
  if (!Array.isArray(draft?.sources) || !draft.sources.length || !source?.url || !source?.title) invalid.add("sources");
  if (typeof draft?.bluf !== "string" || !draft.bluf.trim()) invalid.add("bluf");
  if (Array.isArray(draft?.existingIntents) && draft.existingIntents.some((intent) => normalizeIntent(intent) === normalizeIntent(draft.primaryKeyword))) invalid.add("duplicate-intent");
  if (project?.risk === "ymyl-restricted") {
    const { intent, narrative } = scopedEditorialBlocks(draft);
    if (!operationalScope.test(intent)
      || narrative.some((block) => !operationalScope.test(block))
      || clinicalGuidance.test([intent, ...narrative].join(" "))) {
      invalid.add("ymyl");
    }
  }
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
