const normalizedPath = (value) => String(value).replaceAll("\\", "/").replace(/^\.\/+/, "");
const jsonSource = (value, space) => JSON.stringify(value, null, space).replace(/<(?=\/?script\b)/gi, "\\u003c");
const quoted = (value) => jsonSource(String(value ?? "").replaceAll("\r\n", "\n"));
const safeMarkdown = (value) => String(value ?? "")
  .replaceAll("\r\n", "\n")
  .replace(/<script\b/gi, "&lt;script")
  .replace(/<\/script/gi, "&lt;/script");
const safeHtml = (value) => String(value ?? "")
  .replaceAll("\r\n", "\n")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const safeUrl = (value) => /^(https?:\/\/|\/)/i.test(String(value ?? "")) ? String(value) : "#";
const templateLiteral = (value) => String(value).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
const unique = (values) => [...new Set(values.filter(Boolean))];

function publicImagePath(path) {
  const normalized = normalizedPath(path);
  const marker = normalized.indexOf("/public/");
  if (marker >= 0) return `/${normalized.slice(marker + 8)}`;
  return normalized.startsWith("public/") ? `/${normalized.slice(7)}` : `/${normalized}`;
}

function imageDetails(draft, project) {
  const filePath = `${normalizedPath(project.imagePath)}/${draft.slug}.webp`;
  const generated = Boolean(draft.image?.base64);
  return {
    src: generated ? publicImagePath(filePath) : safeUrl(draft.image?.src),
    file: generated ? { path: filePath, base64: draft.image.base64 } : null,
  };
}

function markdownBody(draft, imageSrc) {
  const lines = [
    `![${safeMarkdown(draft.image?.alt)}](${imageSrc})`,
    draft.image?.credit ? `*${safeMarkdown(draft.image.credit)}*` : "",
    safeMarkdown(draft.bluf),
  ];
  for (const section of draft.sections ?? []) {
    lines.push(`## ${safeMarkdown(section.heading)}`, ...(section.paragraphs ?? []).map(safeMarkdown));
  }
  if (draft.faqs?.length) {
    lines.push("## Frequently asked questions");
    for (const faq of draft.faqs) lines.push(`### ${safeMarkdown(faq.q)}`, safeMarkdown(faq.a));
  }
  if (draft.sources?.length) {
    lines.push("## Sources");
    for (const source of draft.sources) {
      lines.push(`- [${safeMarkdown(source.title)}](${safeUrl(source.url)}) — ${safeMarkdown(source.publisher)}, ${safeMarkdown(source.publishedAt)}`);
    }
  }
  if (draft.relatedSlugs?.length) {
    lines.push("## Related guides", ...draft.relatedSlugs.map((slug) => `- [${safeMarkdown(slug)}](/blog/${encodeURIComponent(slug)})`));
  }
  return `${lines.filter(Boolean).join("\n\n")}\n`;
}

function yamlFaq(faqs, key = "faq") {
  const lines = [`${key}:`];
  for (const item of faqs ?? []) lines.push(`  - q: ${quoted(item.q)}`, `    a: ${quoted(item.a)}`);
  return lines.join("\n");
}

function renderMarkdown(draft, project, image) {
  const frontmatter = [
    "---",
    `title: ${quoted(draft.title)}`,
    `description: ${quoted(draft.description)}`,
    `eyebrow: ${quoted(draft.cluster)}`,
    `pubDate: ${quoted(draft.publishedAt)}`,
    `author: ${quoted(project.author)}`,
    yamlFaq(draft.faqs),
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${markdownBody(draft, image.src)}`;
}

function mdxFrontmatter(draft, project, image) {
  const common = [
    `title: ${quoted(draft.title)}`,
    `slug: ${quoted(draft.slug)}`,
    `description: ${quoted(draft.description)}`,
  ];
  if (project.schema === "polarisia") {
    return [...common,
      `date: ${quoted(draft.publishedAt)}`,
      `author: ${quoted(project.author)}`,
      `tags: ${jsonSource(unique([draft.primaryKeyword, draft.cluster]))}`,
      `readTime: ${quoted("7 min")}`,
    ];
  }
  if (project.schema === "reviewshield") {
    return [...common,
      `keywords: ${jsonSource(unique([draft.primaryKeyword, ...(draft.relatedSlugs ?? [])]))}`,
      `datePublished: ${quoted(draft.publishedAt)}`,
      `author: ${quoted(project.author)}`,
      `cluster: ${quoted(draft.cluster)}`,
      "pillar: false",
      `heroImage: ${quoted(image.src)}`,
      `heroAlt: ${quoted(draft.image?.alt)}`,
      `internalLinks: ${jsonSource(draft.relatedSlugs ?? [])}`,
      `takeaways: [${quoted(draft.bluf)}]`,
      yamlFaq(draft.faqs, "faqs"),
    ];
  }
  if (project.schema === "aftercare") {
    return [...common,
      `keywords: ${jsonSource(unique([draft.primaryKeyword, draft.cluster]))}`,
      `publishedAt: ${quoted(draft.publishedAt)}`,
      `category: ${quoted(draft.cluster)}`,
      "author:",
      `  name: ${quoted(project.author)}`,
      `  role: ${quoted("Editorial team")}`,
      `  credentials: ${quoted("Reviewed editorial guidance")}`,
      `  url: ${quoted(`${project.siteUrl}/blog`)}`,
      "heroImage:",
      `  src: ${quoted(image.src)}`,
      `  alt: ${quoted(draft.image?.alt)}`,
      "  width: 1200",
      "  height: 630",
      yamlFaq(draft.faqs),
      `relatedProcedures: ${jsonSource(draft.relatedSlugs ?? [])}`,
    ];
  }
  return [...common,
    `cluster: ${quoted(draft.cluster)}`,
    `keywords: ${jsonSource(unique([draft.primaryKeyword, ...(draft.relatedSlugs ?? [])]))}`,
    `primaryKeyword: ${quoted(draft.primaryKeyword)}`,
    `author: ${quoted(project.author)}`,
    `datePublished: ${quoted(draft.publishedAt)}`,
    "readingTime: 7",
    "heroImage:",
    `  src: ${quoted(image.src)}`,
    `  alt: ${quoted(draft.image?.alt)}`,
    "  width: 1200",
    "  height: 630",
    `  credit: ${quoted(draft.image?.credit)}`,
    `  searchTerm: ${quoted(draft.primaryKeyword)}`,
    yamlFaq(draft.faqs),
    `relatedSlugs: ${jsonSource(draft.relatedSlugs ?? [])}`,
    "draft: false",
  ];
}

function renderMdx(draft, project, image) {
  return `---\n${mdxFrontmatter(draft, project, image).join("\n")}\n---\n\n${markdownBody(draft, image.src)}`;
}

function htmlBody(draft) {
  const blocks = [`<p>${safeHtml(draft.bluf)}</p>`];
  for (const section of draft.sections ?? []) {
    blocks.push(`<section><h2>${safeHtml(section.heading)}</h2>${(section.paragraphs ?? []).map((p) => `<p>${safeHtml(p)}</p>`).join("")}</section>`);
  }
  if (draft.sources?.length) {
    blocks.push(`<section><h2>Sources</h2><ul>${draft.sources.map((source) =>
      `<li><a href="${safeHtml(safeUrl(source.url))}">${safeHtml(source.title)}</a> — ${safeHtml(source.publisher)}, ${safeHtml(source.publishedAt)}</li>`
    ).join("")}</ul></section>`);
  }
  return blocks.join("\n");
}

function renderAstro(draft, project, image) {
  const faq = jsonSource((draft.faqs ?? []).map(({ q, a }) => ({ q: safeHtml(q), a: safeHtml(a) })), 2);
  const title = quoted(draft.title);
  const description = quoted(draft.description);
  const content = `---
import Base from '../../layouts/Base.astro';
import Header from '../../components/Header.astro';
import Footer from '../../components/Footer.astro';
import Faq from '../../components/Faq.astro';
import WhatsappCta from '../../components/WhatsappCta.astro';

const faq = ${faq};
const whatsapp = import.meta.env.PUBLIC_WHATSAPP ?? '';
---

<Base title={${title}} description={${description}}>
  <Header />
  <main>
    <article>
      <h1>${safeHtml(draft.title)}</h1>
      <img src="${safeHtml(image.src)}" alt="${safeHtml(draft.image?.alt)}" width="1200" height="630" />
      ${htmlBody(draft)}
      <section><h2>Frequently asked questions</h2><Faq items={faq} /></section>
      <WhatsappCta termoAlvo={${quoted(draft.primaryKeyword)}} numero={whatsapp} />
    </article>
  </main>
  <Footer />
</Base>
`;
  return content;
}

function postSchema(project) {
  if (project.schema === "fabrica") return { importLine: 'import { BlogPost } from "../types";', imageAlt: true, faqs: true };
  return {
    importLine: "import { BlogPost } from '../../blog-types'",
    imageAlt: project.schema === "estetiacrm",
    faqs: false,
  };
}

function renderTypescriptPost(draft, project, image) {
  const schema = postSchema(project);
  const fields = [
    `  slug: ${quoted(draft.slug)},`,
    `  title: ${quoted(draft.title)},`,
    `  excerpt: ${quoted(draft.description)},`,
  ];
  if (project.schema === "fabrica") fields.push(`  aiDescription: ${quoted(draft.bluf)},`);
  fields.push(
    `  date: ${quoted(draft.publishedAt)},`,
    `  lastModified: ${quoted(draft.publishedAt)},`,
    `  category: ${quoted(draft.cluster)},`,
    `  image: ${quoted(image.src)},`,
  );
  if (schema.imageAlt) fields.push(`  imageAlt: ${quoted(draft.image?.alt)},`);
  fields.push(
    `  author: ${quoted(project.author)},`,
    `  relatedSlugs: ${jsonSource(draft.relatedSlugs ?? [])},`,
  );
  if (schema.faqs) {
    fields.push(`  faqs: ${jsonSource((draft.faqs ?? []).map(({ q, a }) => ({ question: q, answer: a })), 2).replaceAll("\n", "\n  ")},`);
  }
  fields.push(`  content: \`\n${templateLiteral(htmlBody(draft))}\n\`,`);
  return `${schema.importLine}\n\nexport const post: BlogPost = {\n${fields.join("\n")}\n};\n`;
}

function catalogEntry(draft, image) {
  const entry = {
    slug: draft.slug,
    clusterId: draft.cluster,
    title: draft.title,
    description: draft.description,
    keyword: draft.primaryKeyword,
    datePublished: draft.publishedAt,
    dateModified: draft.publishedAt,
    readingMinutes: 7,
    hero: { src: image.src, alt: draft.image?.alt, ...(draft.image?.credit ? { credit: draft.image.credit } : {}) },
    takeaways: [draft.bluf],
    sections: (draft.sections ?? []).map(({ heading, paragraphs }) => ({ heading, body: paragraphs ?? [] })),
    faqs: draft.faqs ?? [],
    relatedSlugs: draft.relatedSlugs ?? [],
  };
  const json = jsonSource(entry, 2);
  return json.replace(/^(\s*)"([^"]+)":/gm, "$1$2:");
}

function matchingBracket(source, start, open, close) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close && --depth === 0) return i;
  }
  return -1;
}

function topLevelObjects(source, arrayStart, arrayEnd) {
  const ranges = [];
  let quote = null;
  let escaped = false;
  let squareDepth = 1;
  for (let i = arrayStart + 1; i < arrayEnd; i += 1) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") squareDepth += 1;
    else if (char === "]") squareDepth -= 1;
    else if (char === "{" && squareDepth === 1) {
      const end = matchingBracket(source, i, "{", "}");
      if (end < 0 || end > arrayEnd) throw new Error("catalog-format");
      ranges.push({ start: i, end: end + 1 });
      i = end;
    }
  }
  if (quote || squareDepth !== 1) throw new Error("catalog-format");
  return ranges;
}

function topLevelSlug(objectSource) {
  let quote = null;
  let escaped = false;
  let curly = 0;
  let square = 0;
  let paren = 0;
  for (let i = 0; i < objectSource.length; i += 1) {
    const char = objectSource[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") curly += 1;
    else if (char === "}") curly -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "(") paren += 1;
    else if (char === ")") paren -= 1;
    if (curly === 1 && square === 0 && paren === 0) {
      const match = objectSource.slice(i).match(/^slug\s*:\s*(["'])(.*?)\1/s);
      if (match) return match[2];
    }
  }
  return null;
}

export function catalogUpsert(source, entry, slug) {
  const marker = /\bexport\s+const\s+posts\b/.exec(source);
  if (!marker) throw new Error("catalog-format");
  const equals = source.indexOf("=", marker.index + marker[0].length);
  const arrayStart = equals < 0 ? -1 : source.indexOf("[", equals + 1);
  if (arrayStart < 0) throw new Error("catalog-format");
  if (source.slice(equals + 1, arrayStart).trim()) throw new Error("catalog-format");
  const arrayEnd = matchingBracket(source, arrayStart, "[", "]");
  if (arrayEnd < 0) throw new Error("catalog-format");

  const objects = topLevelObjects(source, arrayStart, arrayEnd);
  const existing = objects.find(({ start, end }) => topLevelSlug(source.slice(start, end)) === slug);
  if (existing) return `${source.slice(0, existing.start)}${entry}${source.slice(existing.end)}`;

  const inner = source.slice(arrayStart + 1, arrayEnd);
  const insertion = inner.trim() ? `,\n  ${entry}\n` : `\n  ${entry}\n`;
  return `${source.slice(0, arrayEnd)}${insertion}${source.slice(arrayEnd)}`;
}

function scalar(source, key) {
  const quotedMatch = source.match(new RegExp(`\\b${key}\\s*:\\s*(["'])(.*?)\\1`, "s"));
  if (quotedMatch) return quotedMatch[2].replace(/\\(["'\\])/g, "$1");
  const match = source.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "m"));
  if (!match) return null;
  const value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\(["'\\])/g, "$1");
  }
  return value;
}

function headingsFrom(source) {
  const markdown = [...source.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)].map((match) => match[1].replace(/\s+#+$/, ""));
  const html = [...source.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)]
    .map((match) => match[1].replace(/<[^>]+>/g, "").trim())
    .filter((heading) => heading && !/[{}]/.test(heading));
  const fields = [...source.matchAll(/\bheading\s*:\s*(["'])(.*?)\1/g)].map((match) => match[2]);
  return unique([...markdown, ...html, ...fields]);
}

function canonicalFor(project, slug) {
  const base = String(project.siteUrl).replace(/\/$/, "");
  return project.renderer === "astro" ? `${base}/guia/${slug}/` : `${base}/blog/${slug}`;
}

function withinContentPath(path, contentPath) {
  const file = normalizedPath(path);
  const root = normalizedPath(contentPath).replace(/\/$/, "");
  return file === root || file.startsWith(`${root}/`);
}

export function extractInventory(files, project) {
  const inventory = [];
  for (const file of files) {
    if (!withinContentPath(file.path, project.contentPath)) continue;
    const content = String(file.content ?? "").replaceAll("\r\n", "\n");
    const path = normalizedPath(file.path);
    const frontmatter = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] ?? "";
    const slugMatches = [...content.matchAll(/\bslug\s*:\s*(["'])(.*?)\1/g)];

    if (slugMatches.length && /\.(?:ts|tsx)$/.test(path)) {
      for (let index = 0; index < slugMatches.length; index += 1) {
        const slug = slugMatches[index][2];
        const start = slugMatches[index].index;
        const end = slugMatches[index + 1]?.index ?? content.length;
        const segment = content.slice(start, end);
        const title = scalar(segment, "title");
        if (!slug || !title) continue;
        inventory.push({
          slug,
          title,
          primaryKeyword: scalar(segment, "primaryKeyword") ?? scalar(segment, "keyword"),
          headings: headingsFrom(segment),
          path,
          canonical: canonicalFor(project, slug),
        });
      }
      continue;
    }

    const fileSlug = path.split("/").at(-1)?.replace(/\.(?:md|mdx|astro|ts|tsx)$/, "");
    const slug = scalar(frontmatter, "slug") ?? scalar(content, "slug") ?? fileSlug;
    const astroTitle = headingsFrom(content)[0] ?? null;
    const title = scalar(frontmatter, "title") ?? scalar(content, "title") ?? astroTitle;
    if (!slug || !title) continue;
    inventory.push({
      slug,
      title,
      primaryKeyword: scalar(frontmatter, "primaryKeyword") ?? scalar(content, "primaryKeyword") ?? scalar(content, "keyword"),
      headings: headingsFrom(content),
      path,
      canonical: scalar(frontmatter, "canonical") ?? canonicalFor(project, slug),
    });
  }
  return inventory;
}

export function renderDraft(draft, project, currentContent) {
  const image = imageDetails(draft, project);
  let content;
  let path;
  if (project.renderer === "markdown") {
    path = `${normalizedPath(project.contentPath)}/${draft.slug}.md`;
    content = renderMarkdown(draft, project, image);
  } else if (project.renderer === "mdx") {
    path = `${normalizedPath(project.contentPath)}/${draft.slug}.mdx`;
    content = renderMdx(draft, project, image);
  } else if (project.renderer === "astro") {
    path = `${normalizedPath(project.contentPath)}/${draft.slug}.astro`;
    content = renderAstro(draft, project, image);
  } else if (project.renderer === "typescript-post") {
    path = `${normalizedPath(project.contentPath)}/${draft.slug}.ts`;
    content = renderTypescriptPost(draft, project, image);
  } else if (project.renderer === "typescript-catalog") {
    path = normalizedPath(project.contentPath);
    content = catalogUpsert(String(currentContent ?? ""), catalogEntry(draft, image), draft.slug);
  } else {
    throw new Error("renderer");
  }
  return { path, content, imageFile: image.file };
}
