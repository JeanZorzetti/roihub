const normalizedPath = (value) => String(value).replaceAll("\\", "/").replace(/^\.\/+/, "");
const jsonSource = (value, space) => JSON.stringify(value, null, space).replace(/<(?=\/?script\b)/gi, "\\u003c");
const quoted = (value) => jsonSource(String(value ?? "").replaceAll("\r\n", "\n"));
const safeMarkdown = (value) => String(value ?? "")
  .replaceAll("\r\n", "\n")
  .replace(/<script\b/gi, "&lt;script")
  .replace(/<\/script/gi, "&lt;/script");
const safeMdx = (value) => safeMarkdown(value)
  .replaceAll("\\", "\\\\")
  .replaceAll("`", "\\`")
  .replaceAll("{", "\\{")
  .replaceAll("}", "\\}");
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

// slice() cru cortou a descrição no meio da palavra ("…a cola certa "). Corta na
// última palavra inteira e devolve dentro do limite, com reticências.
const clamp = (value, max) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s.,;:—-]+$/, "")}…`;
};

// Título de seção fixo em inglês publicou "Sources" e "Frequently asked questions"
// em site pt-BR. O rótulo segue project.language, não o renderizador.
const LABELS = {
  "pt-BR": {
    faq: "Perguntas frequentes",
    sources: "Fontes",
    related: "Guias relacionados",
    home: "Início",
    guides: "Guias de decisão",
  },
  "en-US": {
    faq: "Frequently asked questions",
    sources: "Sources",
    related: "Related guides",
    home: "Home",
    guides: "Guides",
  },
};
const labelsFor = (project) => LABELS[project?.language] ?? LABELS["en-US"];

// Contava só bluf + seções e dava 3 min para 941 palavras: FAQ e fontes são metade
// do artigo. 200 palavras/min é a média de leitura em pt-BR e en-US.
function readingMinutes(draft) {
  const words = [
    draft.bluf,
    ...(draft.sections ?? []).flatMap((section) => [section.heading, ...(section.paragraphs ?? [])]),
    ...(draft.faqs ?? []).flatMap(({ q, a }) => [q, a]),
    ...(draft.sources ?? []).map((source) => source.title),
  ].join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

// O modelo ora devolve "ai-agent-memory", ora "Context Rot & AI Agent Memory". O
// cluster aparece como eyebrow, categoria e tag: slug cru vaza para a tela.
const clusterLabel = (value) => {
  const text = String(value ?? "").trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)
    ? text.split("-").map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ")
    : text;
};

function publicImagePath(path) {
  const normalized = normalizedPath(path);
  const marker = normalized.indexOf("/public/");
  if (marker >= 0) return `/${normalized.slice(marker + 8)}`;
  return normalized.startsWith("public/") ? `/${normalized.slice(7)}` : `/${normalized}`;
}

// Caminho relativo do MDX até o asset. O helper image() do Astro resolve import
// relativo e processa o arquivo no build — URL externa não passa no schema.
function relativeAssetPath(fromPath, toPath) {
  const from = normalizedPath(fromPath).split("/").slice(0, -1);
  const to = normalizedPath(toPath).split("/");
  let shared = 0;
  while (shared < from.length && shared < to.length - 1 && from[shared] === to[shared]) shared += 1;
  const up = Array(from.length - shared).fill("..");
  return [...(up.length ? up : ["."]), ...to.slice(shared)].join("/");
}

function imageDetails(draft, project) {
  const embedded = Boolean(draft.image?.base64);
  const extension = project.renderer === "astro-content-ptbr" ? "jpg" : "webp";
  const filePath = `${normalizedPath(project.imagePath)}/${draft.slug}.${extension}`;
  return {
    src: embedded ? publicImagePath(filePath) : safeUrl(draft.image?.src),
    file: embedded ? { path: filePath, base64: draft.image.base64 } : null,
    assetPath: filePath,
  };
}

function markdownBody(draft, project, imageSrc, escapeText = safeMarkdown) {
  const label = labelsFor(project);
  const lines = [
    `![${escapeText(draft.image?.alt)}](${imageSrc})`,
    draft.image?.credit ? `*${escapeText(draft.image.credit)}*` : "",
    escapeText(draft.bluf),
  ];
  for (const section of draft.sections ?? []) {
    lines.push(`## ${escapeText(section.heading)}`, ...(section.paragraphs ?? []).map(escapeText));
  }
  if (draft.faqs?.length) {
    lines.push(`## ${label.faq}`);
    for (const faq of draft.faqs) lines.push(`### ${escapeText(faq.q)}`, escapeText(faq.a));
  }
  if (draft.sources?.length) {
    lines.push(`## ${label.sources}`);
    for (const source of draft.sources) {
      lines.push(`- [${escapeText(source.title)}](${safeUrl(source.url)}) — ${escapeText(source.publisher)}, ${escapeText(source.publishedAt)}`);
    }
  }
  if (draft.relatedSlugs?.length) {
    lines.push(`## ${label.related}`, ...draft.relatedSlugs.map((slug) => `- [${escapeText(slug)}](/blog/${encodeURIComponent(slug)})`));
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
  return `${frontmatter}\n\n${markdownBody(draft, project, image.src)}`;
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
      `tags: ${jsonSource(unique([draft.primaryKeyword, clusterLabel(draft.cluster)]))}`,
      `readTime: ${quoted(`${readingMinutes(draft)} min`)}`,
    ];
  }
  if (project.schema === "reviewshield") {
    return [...common,
      `keywords: ${jsonSource(unique([draft.primaryKeyword, clusterLabel(draft.cluster)]))}`,
      `datePublished: ${quoted(draft.publishedAt)}`,
      `author: ${quoted(project.author)}`,
      `cluster: ${quoted(clusterLabel(draft.cluster))}`,
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
      `keywords: ${jsonSource(unique([draft.primaryKeyword, clusterLabel(draft.cluster)]))}`,
      `publishedAt: ${quoted(draft.publishedAt)}`,
      `category: ${quoted(clusterLabel(draft.cluster))}`,
      "author:",
      `  name: ${quoted(project.author)}`,
      `  role: ${quoted("Editorial team")}`,
      `  credentials: ${quoted(project.author)}`,
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
    `cluster: ${quoted(clusterLabel(draft.cluster))}`,
    // relatedSlugs são slugs de artigo, não frases de busca: entravam como keyword
    // ("cursor-vs-windsurf") e sujavam o único campo que declara a intenção.
    `keywords: ${jsonSource(unique([draft.primaryKeyword, clusterLabel(draft.cluster)]))}`,
    `primaryKeyword: ${quoted(draft.primaryKeyword)}`,
    `author: ${quoted(project.author)}`,
    `datePublished: ${quoted(draft.publishedAt)}`,
    `readingTime: ${readingMinutes(draft)}`,
    "heroImage:",
    `  src: ${quoted(image.src)}`,
    `  alt: ${quoted(draft.image?.alt)}`,
    "  width: 1200",
    "  height: 630",
    `  credit: ${quoted(draft.image?.credit)}`,
    `  searchTerm: ${quoted(draft.imageScene ?? draft.primaryKeyword)}`,
    yamlFaq(draft.faqs),
    `relatedSlugs: ${jsonSource(draft.relatedSlugs ?? [])}`,
    "draft: false",
  ];
}

function renderMdx(draft, project, image) {
  return `---\n${mdxFrontmatter(draft, project, image).join("\n")}\n---\n\n${markdownBody(draft, project, image.src, safeMdx)}`;
}

// Casa o que o artigo de fato menciona com a taxonomia fechada do projeto. Valor
// inventado quebra o build (zod enum), e artigo sem link nenhum de produto nasce
// sem rota de conversão — daí o fallback para o catálogo inteiro.
// ponytail: casamento por palavra do slug; com catálogo grande, mapear à mão.
const draftWords = (draft) => new Set([
  draft.title,
  draft.primaryKeyword,
  draft.bluf,
  ...(draft.sections ?? []).flatMap((section) => [section.heading, ...(section.paragraphs ?? [])]),
  ...(draft.faqs ?? []).flatMap(({ q, a }) => [q, a]),
].join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, " ").trim().split(" "));

function mentioned(slugs, words) {
  return (slugs ?? []).filter((slug) => {
    const parts = String(slug).split("-").filter((part) => part.length > 3);
    return parts.length > 0 && parts.every((part) => words.has(part));
  });
}

const yamlList = (key, values) => (values.length
  ? [`${key}:`, ...values.map((value) => `  - ${quoted(value)}`)].join("\n")
  : `${key}: []`);

// Tapepro: content collection do Astro 5 com frontmatter em português validado por zod.
// Campos obrigatórios: titulo, h1, descricao (<=160), intencao, resumo, publicadoEm,
// tempoLeituraMin, imagem (asset local), imagemAlt.
function renderAstroContentPtBr(draft, project, image, mdxPath) {
  const words = draftWords(draft);
  const produtos = mentioned(project.produtos, words);
  const frontmatter = [
    `titulo: ${quoted(draft.title)}`,
    `h1: ${quoted(draft.title)}`,
    `descricao: ${quoted(clamp(draft.description, 160))}`,
    `intencao: ${quoted(draft.primaryKeyword)}`,
    `resumo: ${quoted(draft.bluf)}`,
    `publicadoEm: ${draft.publishedAt}`,
    `tempoLeituraMin: ${readingMinutes(draft)}`,
    `imagem: ${quoted(relativeAssetPath(mdxPath, image.assetPath))}`,
    `imagemAlt: ${quoted(draft.image?.alt)}`,
    ...(draft.imageScene ? [`cenaImagem: ${quoted(draft.imageScene)}`] : []),
    yamlList("produtosRelacionados", produtos.length ? produtos : project.produtos ?? []),
    yamlList("segmentosRelacionados", mentioned(project.segmentos, words)),
  ];
  // O layout já exibe `resumo` acima do corpo: repetir o bluf como 1º parágrafo
  // publicava o mesmo texto duas vezes na mesma dobra.
  const body = [
    ...(draft.sections ?? []).flatMap((section) => [
      `## ${safeMdx(section.heading)}`,
      ...(section.paragraphs ?? []).map(safeMdx),
    ]),
    ...(draft.faqs?.length
      ? ["## Perguntas frequentes", ...draft.faqs.flatMap(({ q, a }) => [`### ${safeMdx(q)}`, safeMdx(a)])]
      : []),
    ...(draft.sources?.length
      ? ["## Fontes", ...draft.sources.map((source) =>
        `- [${safeMdx(source.title)}](${safeUrl(source.url)}) — ${safeMdx(source.publisher)}, ${safeMdx(source.publishedAt)}`)]
      : []),
    ...(draft.image?.credit ? [`*${safeMdx(draft.image.credit)}*`] : []),
  ].join("\n\n");
  return `---\n${frontmatter.join("\n")}\n---\n\n${body}\n`;
}

// Metade dos projetos é .md/.mdx, então o modelo escreve markdown leve: negrito,
// "### " para sub-seção e tabela de comparação. Nos renderizadores HTML isso saía
// como asterisco e cano na tela. Escapa primeiro; a única marcação é a daqui.
const inlineHtml = (value) => safeHtml(value)
  .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
  .replace(/\[([^\]\n]+)\]\((\/[^)\s]*)\)/g, (_, text, href) => `<a href="${href}">${text}</a>`);

const tableRows = (value) => value.split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("|"))
  .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));

const isTable = (value) => {
  const rows = tableRows(value);
  return rows.length >= 3 && rows[1].every((cell) => /^:?-{2,}:?$/.test(cell));
};

function htmlBlock(text) {
  const value = String(text ?? "").trim();
  if (value.startsWith("### ")) return `<h3>${inlineHtml(value.slice(4))}</h3>`;
  if (isTable(value)) {
    const [head, , ...body] = tableRows(value);
    return `<table><thead><tr>${head.map((cell) => `<th scope="col">${inlineHtml(cell)}</th>`).join("")}</tr></thead>`
      + `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${inlineHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  if (/^[-*] /m.test(value) && value.split("\n").every((line) => /^[-*] /.test(line.trim()) || !line.trim())) {
    return `<ul>${value.split("\n").filter((line) => line.trim()).map((line) =>
      `<li>${inlineHtml(line.trim().slice(2))}</li>`).join("")}</ul>`;
  }
  return `<p>${inlineHtml(value)}</p>`;
}

function htmlBody(draft, project) {
  const label = labelsFor(project);
  const blocks = [`<p>${inlineHtml(draft.bluf)}</p>`];
  for (const section of draft.sections ?? []) {
    blocks.push(`<section><h2>${safeHtml(section.heading)}</h2>${(section.paragraphs ?? []).map(htmlBlock).join("")}</section>`);
  }
  if (draft.sources?.length) {
    blocks.push(`<section><h2>${safeHtml(label.sources)}</h2><ul>${draft.sources.map((source) =>
      `<li><a href="${safeHtml(safeUrl(source.url))}">${safeHtml(source.title)}</a> — ${safeHtml(source.publisher)}, ${safeHtml(source.publishedAt)}</li>`
    ).join("")}</ul></section>`);
  }
  return blocks.join("\n");
}

// O guia gerado nascia sem structured data nenhum, enquanto os escritos à mão montam
// Article + FAQPage + BreadcrumbList. O Base já injeta Organization e WebSite no
// @graph: aqui vão só os nós da página.
function guideJsonLd(draft, project, image) {
  const label = labelsFor(project);
  const base = String(project.siteUrl).replace(/\/$/, "");
  const canonical = canonicalFor(project, draft.slug);
  return [
    {
      "@type": "Article",
      headline: draft.title,
      description: draft.description,
      image: image.src,
      datePublished: draft.publishedAt,
      dateModified: draft.publishedAt,
      inLanguage: project.language,
      author: { "@type": "Organization", name: project.author },
      mainEntityOfPage: canonical,
    },
    ...(draft.faqs?.length
      ? [{
        "@type": "FAQPage",
        mainEntity: draft.faqs.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      }]
      : []),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: label.home, item: `${base}/` },
        { "@type": "ListItem", position: 2, name: label.guides, item: `${base}/guia/` },
        { "@type": "ListItem", position: 3, name: draft.title, item: canonical },
      ],
    },
  ];
}

function renderAstro(draft, project, image) {
  const label = labelsFor(project);
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
const jsonLdNodes = ${jsonSource(guideJsonLd(draft, project, image), 2)};
const whatsapp = import.meta.env.PUBLIC_WHATSAPP ?? '';
---

<Base title={${title}} description={${description}} ogImage={${quoted(`/open-graph/guia/${draft.slug}.png`)}} jsonLdNodes={jsonLdNodes}>
  <Header />
  <main>
    <article>
      <h1>${safeHtml(draft.title)}</h1>
      <img src="${safeHtml(image.src)}" alt="${safeHtml(draft.image?.alt)}" width="1200" height="630" />
      ${htmlBody(draft, project)}${draft.faqs?.length
    ? `\n      <section><h2>${safeHtml(label.faq)}</h2><Faq items={faq} /></section>`
    : ""}
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
    `  category: ${quoted(clusterLabel(draft.cluster))},`,
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
  fields.push(`  content: \`\n${templateLiteral(htmlBody(draft, project))}\n\`,`);
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
    readingMinutes: readingMinutes(draft),
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

function objectsWithTopLevelSlug(source) {
  const objects = [];
  let quote = null;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
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
    if (char !== "{") continue;
    const end = matchingBracket(source, i, "{", "}");
    if (end < 0) break;
    const objectSource = source.slice(i, end + 1);
    const slug = topLevelSlug(objectSource);
    if (!slug) continue;
    objects.push({ slug, source: objectSource });
    i = end;
  }
  return objects;
}

export function catalogUpsert(source, entry, slug, exportName = "posts") {
  const marker = new RegExp(`\\bexport\\s+const\\s+${exportName}\\b`).exec(source);
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
  const insertion = inner.trim() ? `${/,\s*$/.test(inner) ? "" : ","}\n  ${entry}\n` : `\n  ${entry}\n`;
  return `${source.slice(0, arrayEnd)}${insertion}${source.slice(arrayEnd)}`;
}

// Sem entrada em src/data/guias.ts o guia gerado é página órfã: fica fora do
// sitemap, do llms.txt, do índice /guia e de todo bloco de link interno — nasce
// sem nenhuma rota de crawl.
export function guiaUpsert(source, draft) {
  const entry = [
    "{",
    `    slug: ${quoted(draft.slug)},`,
    `    titulo: ${quoted(draft.title)},`,
    `    descricao: ${quoted(draft.description)},`,
    "  }",
  ].join("\n");
  return catalogUpsert(String(source ?? ""), entry, String(draft.slug), "guias");
}

export function registryUpsert(source, slug) {
  const original = String(source ?? "");
  const content = original.replaceAll("\r\n", "\n");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("registry-format");

  const imports = [...content.matchAll(
    /^import\s+\{\s*post\s+as\s+([A-Za-z_$][\w$]*)\s*\}\s+from\s+(['"])\.\/posts\/([a-z0-9-]+)\2(;?)[ \t]*$/gm
  )];
  const markers = [...content.matchAll(
    /\bexport\s+const\s+blogPosts\s*:\s*BlogPost\s*\[\]\s*=\s*\[/g
  )];
  if (!imports.length || markers.length !== 1) throw new Error("registry-format");

  const marker = markers[0];
  const arrayStart = marker.index + marker[0].lastIndexOf("[");
  const arrayEnd = matchingBracket(content, arrayStart, "[", "]");
  if (arrayEnd < 0) throw new Error("registry-format");
  const entries = content.slice(arrayStart + 1, arrayEnd)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.some((entry) => !/^[A-Za-z_$][\w$]*$/.test(entry))) {
    throw new Error("registry-format");
  }
  const aliases = imports.map((match) => match[1]);
  const slugs = imports.map((match) => match[3]);
  const aliasSet = new Set(aliases);
  if (aliasSet.size !== aliases.length
    || new Set(slugs).size !== slugs.length
    || new Set(entries).size !== entries.length
    || entries.length !== aliases.length
    || entries.some((entry) => !aliasSet.has(entry))) {
    throw new Error("registry-format");
  }

  const existing = imports.filter((match) => match[3] === slug);
  if (existing.length > 1 || (existing.length === 1 && !entries.includes(existing[0][1]))) {
    throw new Error("registry-format");
  }
  if (existing.length === 1) return original;

  const identifier = `auto${slug
    .split("-")
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join("")}Post`;
  if (new RegExp(`\\b${identifier}\\b`).test(content)) {
    throw new Error("registry-format");
  }

  const lastImport = imports.at(-1);
  const importEnd = lastImport.index + lastImport[0].length;
  const quote = lastImport[2];
  const semicolon = lastImport[4];
  const withEntry = `${content.slice(0, arrayStart + 1)}\n  ${identifier},${content.slice(arrayStart + 1)}`;
  return `${withEntry.slice(0, importEnd)}
import { post as ${identifier} } from ${quote}./posts/${slug}${quote}${semicolon}${withEntry.slice(importEnd)}`;
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
    const typedObjects = /\.(?:ts|tsx)$/.test(path) ? objectsWithTopLevelSlug(content) : [];

    if (typedObjects.length) {
      for (const { slug, source: segment } of typedObjects) {
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
  } else if (project.renderer === "astro-content-ptbr") {
    path = `${normalizedPath(project.contentPath)}/${draft.slug}.mdx`;
    content = renderAstroContentPtBr(draft, project, image, path);
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
