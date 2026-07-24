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

// Array = nomes alternativos aceitos; reporta sempre o primeiro, que é o oficial.
const REQUIRED_ENV = [
  ["CLAUDE_CODE_OAUTH_TOKENS", "CLAUDE_CODE_OAUTH_TOKEN"],
  "CRON_SECRET",
  "DATABASE_URL",
  "GITHUB_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "UNSPLASH_ACCESS_KEY",
];

export function missingEnv(env) {
  return REQUIRED_ENV
    .filter((entry) => ![entry].flat().some((name) => typeof env?.[name] === "string" && env[name].trim()))
    .map((entry) => [entry].flat()[0]);
}

export function validTransition(from, to) {
  return TRANSITIONS[from]?.has(to) ?? false;
}

const normalizeIntent = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const encoder = new TextEncoder();
const nativeTimingSafeEqual = globalThis.process
  ?.getBuiltinModule?.("node:crypto")
  ?.timingSafeEqual;

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  if (nativeTimingSafeEqual) return nativeTimingSafeEqual(left, right);
  // ponytail: Edge has no synchronous native comparator; fixed-length XOR is the fallback.
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function authorized(header, secret) {
  if (typeof header !== "string"
    || typeof secret !== "string"
    || !header
    || !secret
    || header.length > 256
    || secret.length > 249) return false;
  return constantTimeEqual(encoder.encode(`Bearer ${secret}`), encoder.encode(header));
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

const validSource = (source) => {
  if (!source || typeof source !== "object") return false;
  try {
    const url = new URL(source.url);
    const published = new Date(`${source.publishedAt}T00:00:00.000Z`);
    return url.protocol === "https:"
      && Boolean(String(source.title ?? "").trim())
      && Boolean(String(source.publisher ?? "").trim())
      && /^\d{4}-\d{2}-\d{2}$/.test(String(source.publishedAt ?? ""))
      && !Number.isNaN(published.getTime())
      && published.toISOString().slice(0, 10) === source.publishedAt;
  } catch {
    return false;
  }
};

const operationalScope = /\b(?:operations?|operational|software|platform|workflow|automation|scheduling|scheduler|appointments?|booking|intake|forms?|crm|practice management|clinic management|administrative|administration|front desk|communication|messages?|reminders?|follow up|billing|payments?|invoicing|inventory|staff|team|reviews?|reputation|marketing|lead management|analytics|reporting|retention|no shows?|customer service|client management|business process(?:es)?|metrics?|kpis?|measur(?:e|es|ed|ing|ement|ements)|tracking|response time|completion rate|data|dashboard|database|integration|api)\b/;
const clinicalGuidance = /\b(?:botox|fillers?|inject(?:ion|able|ed|ing)?|dosage|dose|diagnos(?:is|e)|prescri(?:be|ption)|medications?|medicine|treat(?:ment|ed|ing)?|cure|symptoms?|contraindications?|side effects?|swelling|swollen|bruis(?:e|ing)|cold compress(?:es)?|ice packs?|infections?|allergic|anaphylaxis|bleeding|wounds?|fever|pain|antibiotics?|ibuprofen|paracetamol|acetaminophen|aspirin|pregnan(?:t|cy)|emergency|alcohol|sun(?:light| exposure)?|exercis(?:e|es|ed|ing)|physical activity|fast(?:ing)?|surger(?:y|ies)|pre-?op(?:erative)?|post-?op(?:erative)?|aftercare instructions?|recovery instructions?|patients? (?:should|must|need to|can|cannot|may|do not))\b/;

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

export function validateDraft(draft, project, riskClassification) {
  const invalid = new Set();
  if (hasPlaceholder(draft)) invalid.add("placeholder");
  if (!Array.isArray(draft?.sources) || !draft.sources.length || draft.sources.some((source) => !validSource(source))) invalid.add("sources");
  const blufWords = typeof draft?.bluf === "string"
    ? draft.bluf.trim().split(/\s+/).filter(Boolean).length
    : 0;
  if (blufWords < 40 || blufWords > 60) invalid.add("bluf");
  if (Array.isArray(draft?.existingIntents) && draft.existingIntents.some((intent) => normalizeIntent(intent) === normalizeIntent(draft.primaryKeyword))) invalid.add("duplicate-intent");
  if (project?.risk === "ymyl-restricted") {
    const { intent, narrative } = scopedEditorialBlocks(draft);
    if (riskClassification !== "operational"
      || !operationalScope.test(intent)
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
