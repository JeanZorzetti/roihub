// O que há DENTRO de uma página (024). Entra uma string de HTML, sai uma forma — sem `fetch`, sem
// `pg`, sem `process.env` e sem relógio (o ano vigente é PARÂMETRO, D9).
//
// Três das quatro armadilhas 🚩 da spec moram aqui, e todas são erro de PARSING: pixel confundido
// com caractere (D4), `.*` guloso entre `<script>` (D5) e JSON-LD ausente lido como inválido
// (D11). Parsing é exatamente o que se prova sem rede — é por isso que a regra inteira nasce em
// `.mjs` e é reprovada em milissegundos por `test/pagina.test.mjs`, e não numa corrida semanal que
// levaria uma semana para exibir um número que parece certo.
import { detectarStack } from "./conformidade.mjs";

/** @typedef {{titulo: string|null, larguraPx: number|null, metodo: string,
 *    intencao: "informacional"|"comercial"|"ambos"|"ausente",
 *    schema: {estado:"valido"|"invalido"|"ausente", tipos: string[]},
 *    dataDeclarada: string|null, palavras: number,
 *    conteudo: "com-conteudo"|"js-dependente"|"sem-conteudo",
 *    links: {href: string, ancora: string}[]}} Extraida */

// ── Texto ───────────────────────────────────────────────────────────────────

/**
 * 🚩 D5/FR-010 — o `*?` é a feature.
 *
 * `D-84` (07/08) usou `sed 's/<script[^>]*>.*<\/script>//g'` e mediu **0 palavras em páginas que
 * têm `<h1>`**: HTML minificado é uma linha só, e o `.*` guloso apaga do PRIMEIRO `<script>` até o
 * ÚLTIMO fechamento do documento — ou seja, o body inteiro. Refeito não-guloso, as mesmas páginas
 * deram 472 e 301 palavras.
 *
 * O que denunciou o defeito foi a contradição interna (0 palavras numa página com `<h1>`), e é ela
 * que virou asserção de teste.
 */
export function semScriptNemStyle(html) {
  return String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

const ENTIDADES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

/** Entidades básicas. Suficiente para título e âncora — o resto do HTML só é contado, não exibido. */
function decodificar(s) {
  return String(s ?? "")
    .replace(/&(?:amp|lt|gt|quot|apos|#39|nbsp);/gi, (m) => ENTIDADES[m.toLowerCase()] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** Tags fora, espaço colapsado. */
function texto(html) {
  return decodificar(String(html ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavras do conteúdo servido, pelo método não-guloso. FR-010. */
export function contarPalavras(html) {
  const t = texto(semScriptNemStyle(html));
  return t ? t.split(" ").length : 0;
}

// ── Título ──────────────────────────────────────────────────────────────────

/**
 * O primeiro `<title>` da página.
 *
 * `null` quando a página NÃO SERVE `<title>`; string vazia quando serve um vazio. São coisas
 * diferentes — a primeira é "não escreveram título", a segunda é "escreveram e apagaram" —, e a
 * coluna `titulo TEXT` anulável do data-model depende dessa separação.
 */
export function titulo(html) {
  const m = String(html ?? "").match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodificar(m[1]).replace(/\s+/g, " ").trim() : null;
}

export const METODO_LARGURA = "arial-20px-tabela";
const PX_SERP = 20; // Arial 20px é o título na SERP desktop.

// Larguras de Arial em `em`. Tabela CURTA de propósito: a decisão que ela serve é binária ("cabe
// ou não cabe em 500-580 px"), e a faixa do board tem 80 px de folga para absorver o erro.
const LARGURAS = {
  i: 0.22, l: 0.22, j: 0.22, I: 0.22, ".": 0.22, ",": 0.22, ";": 0.22, ":": 0.22,
  "'": 0.22, "!": 0.22, "|": 0.22, " ": 0.28,
  m: 0.83, M: 0.83, W: 0.83,
};
const MINUSCULA = 0.55;
const MAIUSCULA = 0.7;
const DESCONHECIDO = 0.55;

/** Acento fora, letra base preservada — e o índice de cada caractere INTACTO, que é o que
 *  `posicaoDoTermo` precisa (NFD sobre a string inteira mudaria o comprimento). */
function semAcento(s) {
  return [...String(s ?? "")].map((c) => c.normalize("NFD")[0]).join("");
}

/**
 * 🚩 D4/FR-005 — pixel não é caractere. "iiiii" e "WWWWW" têm o mesmo `length` e larguras
 * completamente diferentes, e o board pede 500-580 PX.
 *
 * Devolve `{px, metodo}` e NUNCA um número solto: o `metodo` viaja com o número até a tela porque
 * um pixel sem o rótulo do método é indistinguível de uma medição — e vai ser lido como uma. O que
 * a spec proíbe não é estimar, é chamar a estimativa de medição (SC-004).
 */
export function larguraDoTitulo(t) {
  if (t === null || t === undefined) return { px: null, metodo: METODO_LARGURA };
  const em = [...semAcento(t)].reduce((soma, c) => {
    if (c in LARGURAS) return soma + LARGURAS[c];
    if (/[a-z]/.test(c)) return soma + MINUSCULA;
    if (/[A-Z]/.test(c)) return soma + MAIUSCULA;
    return soma + DESCONHECIDO;
  }, 0);
  return { px: Math.round(em * PX_SERP), metodo: METODO_LARGURA };
}

// D9 — as duas listas saem do próprio board.
const INFORMACIONAL = ["como fazer", "passo a passo", "guia", "exemplos"];
const COMERCIAL = ["preco", "comparativo", "melhores", "planos", "gratis"];

/**
 * D9 — o ano vigente é PARÂMETRO, não `new Date()` dentro do módulo puro. "2026" escrito no código
 * apodrece em janeiro, e a partir daí o modificador comercial reprovaria todo mundo em silêncio.
 */
export function modificadoresDeIntencao(t, ano) {
  if (t === null || t === undefined) return "ausente";
  const alvo = semAcento(t).toLowerCase();
  const info = INFORMACIONAL.some((m) => alvo.includes(m));
  const com = COMERCIAL.some((m) => alvo.includes(m)) || alvo.includes(String(ano));
  if (info && com) return "ambos";
  if (info) return "informacional";
  if (com) return "comercial";
  return "ausente";
}

/**
 * FR-006 — o índice do termo principal dentro do título, contra o limite de 35 caracteres do board.
 *
 * Três retornos, três coisas diferentes: `null` é "não dá para medir" (título ausente ou termo não
 * apurado no GSC), `-1` é "o termo NÃO está no título" e `0` é a MELHOR posição possível. Devolver
 * `0` para ausência inverteria a medida — o pior caso apareceria como o melhor.
 */
export function posicaoDoTermo(tituloDaPagina, termo) {
  if (tituloDaPagina === null || tituloDaPagina === undefined) return null;
  if (termo === null || termo === undefined || !String(termo).trim()) return null;
  return semAcento(tituloDaPagina).toLowerCase().indexOf(semAcento(termo).toLowerCase().trim());
}

// ── Dados estruturados ──────────────────────────────────────────────────────

const RE_JSONLD = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

/** Todos os `@type`, descendo em `@graph` e em arrays, recursivamente. Um `@graph` com três tipos
 *  é lido como TRÊS tipos — é o Independent Test da US3. */
function tiposDe(valor, saida = []) {
  if (Array.isArray(valor)) {
    for (const v of valor) tiposDe(v, saida);
    return saida;
  }
  if (!valor || typeof valor !== "object") return saida;
  const t = valor["@type"];
  for (const v of Array.isArray(t) ? t : [t]) if (typeof v === "string" && !saida.includes(v)) saida.push(v);
  for (const [k, v] of Object.entries(valor)) if (k !== "@type") tiposDe(v, saida);
  return saida;
}

/**
 * D11/FR-008 — `ausente`, `invalido` e `valido` são TRÊS estados, nunca dois.
 *
 * Página com um bloco válido e outro quebrado é **inválida**: o board mede "0 erros críticos", e um
 * erro presente não é apagado por um acerto ao lado. E ausente ≠ inválido porque os consertos são
 * completamente diferentes — escrever o schema × achar a vírgula.
 *
 * `dados` sai junto para `dataDeclarada()` não reparsear o mesmo HTML.
 */
export function blocosJsonLd(html) {
  const dados = [];
  let invalido = false;
  let blocos = 0;
  for (const m of String(html ?? "").matchAll(RE_JSONLD)) {
    blocos++;
    try {
      dados.push(JSON.parse(m[1]));
    } catch {
      invalido = true;
    }
  }
  if (!blocos) return { estado: "ausente", tipos: [], dados };
  return { estado: invalido ? "invalido" : "valido", tipos: tiposDe(dados), dados };
}

/** A primeira data ISO reconhecível de um valor solto. Sem isso um `dateModified` com hora ou fuso
 *  viraria `null` — e ausência inventada é o que o §2 do data-model proíbe. */
function dia(valor) {
  const m = String(valor ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

function buscarChave(valor, chave) {
  if (Array.isArray(valor)) {
    for (const v of valor) {
      const r = buscarChave(v, chave);
      if (r) return r;
    }
    return null;
  }
  if (!valor || typeof valor !== "object") return null;
  if (chave in valor && dia(valor[chave])) return dia(valor[chave]);
  for (const v of Object.values(valor)) {
    const r = buscarChave(v, chave);
    if (r) return r;
  }
  return null;
}

/**
 * A ORDEM das três fontes É a regra: JSON-LD `dateModified` → `article:modified_time` →
 * `<time datetime>`.
 *
 * O `<time>` é o último porque na página ele tanto pode ser a data do artigo quanto a data de um
 * comentário. Nenhuma das três ⇒ `null`, e `null` fica fora do numerador E do denominador da
 * cadência (FR-009): "sem data declarada" nunca é "desatualizada".
 */
export function dataDeclarada(html, jsonLd) {
  const ld = jsonLd ?? blocosJsonLd(html);
  const doLd = buscarChave(ld.dados, "dateModified");
  if (doLd) return doLd;
  const meta = String(html ?? "").match(
    /<meta\b[^>]*(?:property|name)\s*=\s*["']article:modified_time["'][^>]*>/i,
  );
  const doMeta = meta && dia(meta[0].match(/content\s*=\s*["']([^"']*)["']/i)?.[1]);
  if (doMeta) return doMeta;
  const time = String(html ?? "").match(/<time\b[^>]*\bdatetime\s*=\s*["']([^"']*)["']/i);
  return time ? dia(time[1]) : null;
}

// ── Links ───────────────────────────────────────────────────────────────────

const RE_LINK = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Todos os `<a href>` com a âncora já limpa. O par `(href, âncora)` é a CHAVE que `navegacao()`
 * usa para reconhecer menu — sem a âncora, "Preços" no menu e "nossos preços" no meio de um
 * parágrafo seriam o mesmo link, e a exclusão do menu levaria o link editorial junto.
 */
export function linksDe(html) {
  const saida = [];
  for (const m of String(html ?? "").matchAll(RE_LINK)) {
    saida.push({ href: decodificar(m[1] ?? m[2] ?? m[3] ?? "").trim(), ancora: texto(m[4]) });
  }
  return saida;
}

// ── Conteúdo ────────────────────────────────────────────────────────────────

/** Abaixo disto a página não serve conteúdo legível — é casca. Constante coberta por teste e NÃO
 *  variável de ambiente: mudar o piso muda o significado do número gravado, e isso é deploy. */
export const PISO_PALAVRAS = 10;

/**
 * D12/FR-011 — página vazia ≠ conteúdo que só existe depois do JavaScript.
 *
 * `D-84` mediu 3 projetos da casa servindo zero palavra no HTML inicial, e o prognóstico dos dois
 * casos é OPOSTO: conteúdo em JS é renderizável pelo Google, então SPA vazia ATRASA a indexação;
 * página sem texto nenhum não tem o que indexar. Colapsar os dois num "sem conteúdo" trocaria
 * "está na fila de render" por "não tem texto".
 *
 * `detectarStack()` é REUSADA em vez de reescrita: ela já responde a mesma pergunta de outro
 * ângulo, pelo que o servidor entrega.
 */
export function estadoDoConteudo(html, palavras) {
  if (palavras > PISO_PALAVRAS) return "com-conteudo";
  const h = String(html ?? "");
  const hidrata =
    /<div[^>]*\bid\s*=\s*["'](?:root|__next|app)["']/i.test(h) || detectarStack({}, h).includes("vite-spa");
  return hidrata ? "js-dependente" : "sem-conteudo";
}

// ── A composição ────────────────────────────────────────────────────────────

/**
 * Tudo numa passada — é esta função que a rota chama para preencher a linha inteira de
 * `hub_pagina`, e é por isso que ela é Foundational e não da US1: as 17 colunas são escritas numa
 * transação só, então a extração não se fatia por user story.
 *
 * NENHUM campo ausente vira zero: `titulo` `null` ≠ `''`, `dataDeclarada` `null` é ausência, e
 * `palavras: 0` só sai quando o método não-guloso de fato contou zero.
 *
 * @returns {Extraida}
 */
export function extrair(html, ano) {
  const t = titulo(html);
  const ld = blocosJsonLd(html);
  const palavras = contarPalavras(html);
  const { px, metodo } = larguraDoTitulo(t);
  return {
    titulo: t,
    larguraPx: px,
    metodo,
    intencao: modificadoresDeIntencao(t, ano),
    schema: { estado: ld.estado, tipos: ld.tipos },
    dataDeclarada: dataDeclarada(html, ld),
    palavras,
    conteudo: estadoDoConteudo(html, palavras),
    links: linksDe(html),
  };
}
