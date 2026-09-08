// O grafo interno do site e as agregações da corrida (024). Recebe arestas já extraídas e páginas
// já montadas, devolve números. Zero rede, zero banco, zero relógio (`hoje` é PARÂMETRO) — é o que
// torna a SC-003 provável em milissegundos, em vez de descoberta numa semana de números que
// parecem certos.
//
// As quatro taxas do board moram aqui, ao lado de `agregar()`, e não no `.tsx`: são agregação
// sobre a coleção de páginas, e o Princípio III diz que o que dá para testar sem subir o Next
// nasce em `.mjs`. A tela só renderiza.

/** @typedef {{de: string, para: string, ancora: string}} Aresta */

// ── A chave de página (D3) ──────────────────────────────────────────────────

const NAO_E_ARESTA = /^(?:mailto|tel|javascript|sms|data|ftp|file):/i;

/**
 * D3 — a chave de página é a URL CANÔNICA, nunca a forma crua do href.
 *
 * O sitemap declara `/pacientes/precos` e o HTML linka `href="/pacientes/precos/"`. Sem canonizar
 * essas são duas páginas: a do sitemap fica ÓRFÃ e a linkada fica fora do inventário — e a feature
 * inteira publicaria um site que aponta para lugar nenhum. É `rotulo_de_exibicao_nunca_e_chave`
 * aplicado à URL.
 *
 * A QUERY é preservada de propósito (`?p=2` costuma ser outra página de verdade); o fragmento é
 * descartado porque `#preco` é a mesma página.
 */
export function canonizar(href, base) {
  const h = String(href ?? "").trim();
  if (!h || h.startsWith("#") || NAO_E_ARESTA.test(h)) return null;
  let u;
  try {
    u = new URL(h, base);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const caminho = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, "") || "/" : u.pathname || "/";
  return `${u.protocol}//${u.host.toLowerCase()}${caminho}${u.search}`;
}

/** Mesmo host EXATO. Subdomínio não é interno (Edge Case da spec): `blog.x.com` é outro site para
 *  efeito de link interno, e contá-lo inflaria a densidade com autoridade que não é da página. */
export function ehInterna(url, host) {
  try {
    return new URL(url).hostname.toLowerCase() === String(host ?? "").toLowerCase();
  } catch {
    return false;
  }
}

// ── D1: o que é menu ────────────────────────────────────────────────────────

/** Fração das páginas visitadas que precisa emitir o mesmo par para ele virar navegação. */
export const FRACAO_NAVEGACAO = 0.5;
/** ...e o piso absoluto, para um site de 2 páginas não classificar o próprio corpo como menu. */
export const MIN_PAGINAS_NAVEGACAO = 3;

/** A chave da D1: destino + âncora. Sem a âncora, "Preços" no menu e "nossos preços" no meio de um
 *  parágrafo seriam o mesmo link, e excluir o menu levaria o link editorial junto. */
const chave = (a) => `${a.para}\n${a.ancora}`;

/**
 * D1 — navegação é o link que aparece em quase toda página, por FREQUÊNCIA e não por `<nav>`.
 *
 * Confiar na marcação semântica dependeria de o site marcá-la; a regra por frequência satisfaz a
 * SC-003 POR CONSTRUÇÃO — um menu que cresce de 5 para 15 links continua sendo menu, e a densidade
 * contextual não se move.
 *
 * As duas constantes ficam no módulo, cobertas por teste, e NUNCA em variável de ambiente: mudá-las
 * muda o significado do número gravado, e isso é deploy.
 */
export function navegacao(arestas, totalPaginas) {
  const paginasPorChave = new Map();
  for (const a of arestas) {
    const k = chave(a);
    if (!paginasPorChave.has(k)) paginasPorChave.set(k, new Set());
    paginasPorChave.get(k).add(a.de);
  }
  const piso = Math.max(MIN_PAGINAS_NAVEGACAO, FRACAO_NAVEGACAO * (totalPaginas || 0));
  const nav = new Set();
  for (const [k, paginas] of paginasPorChave) if (paginas.size >= piso) nav.add(k);
  return nav;
}

// ── D2: duas leituras do mesmo grafo ────────────────────────────────────────

/**
 * D2/D7 — profundidade usa TODAS as arestas: um link de menu é um clique de verdade.
 *
 * Travessia em LARGURA a partir da home, `visitados` como `Set` (ciclo termina por construção,
 * FR-012) e parada no teto. Ausente do mapa = INALCANÇÁVEL, jamais 0 — a raiz é o único 0 que
 * existe, e órfã com profundidade 0 seria a home mentindo sobre si mesma.
 */
export function profundidades(arestas, home, teto = Infinity) {
  const saindo = new Map();
  for (const a of arestas) {
    if (!saindo.has(a.de)) saindo.set(a.de, []);
    saindo.get(a.de).push(a.para);
  }
  const mapa = new Map([[home, 0]]);
  let fila = [home];
  let tetoAtingido = false;
  while (fila.length) {
    const proxima = [];
    for (const url of fila) {
      for (const destino of saindo.get(url) ?? []) {
        if (mapa.has(destino)) continue;
        if (mapa.size >= teto) {
          tetoAtingido = true;
          return { mapa, tetoAtingido };
        }
        mapa.set(destino, mapa.get(url) + 1);
        proxima.push(destino);
      }
    }
    fila = proxima;
  }
  return { mapa, tetoAtingido };
}

/**
 * D2 — densidade usa só as arestas CONTEXTUAIS: link de menu não é voto editorial.
 *
 * Autolink fora (`de === para`): uma página não vota em si mesma. Duas leituras do mesmo grafo,
 * como a spec pede — não dois crawls.
 */
export function densidades(arestas, nav) {
  const mapa = new Map();
  for (const a of arestas) {
    if (a.de === a.para) continue;
    if (nav.has(chave(a))) continue;
    mapa.set(a.para, (mapa.get(a.para) ?? 0) + 1);
  }
  return mapa;
}

/**
 * O que ainda falta visitar. `vistas` guarda os DOIS lados de cada busca: a URL PEDIDA e a URL de
 * DESTINO.
 *
 * MEDIDO na primeira corrida (08/09/2026): a fase largura chaveava as visitadas pelo destino (D3),
 * então uma URL que REDIRECIONA nunca aparecia como visitada e a fronteira a devolvia a cada volta
 * — travessia infinita, com o teto de 300 páginas como único freio. Uma corrida de 30 s virou 13
 * minutos sem gravar linha nenhuma.
 */
export function fronteira(arestas, vistas) {
  return [...new Set(arestas.map((a) => a.para))].filter((u) => !vistas.has(u));
}

// ── Uma URL canônica, uma linha ─────────────────────────────────────────────

/**
 * A PK `(projeto, dia, url)` estoura no INSERT multi-linha se a mesma URL aparecer duas vezes — e
 * aí a corrida INTEIRA cai, que é o oposto da FR-016.
 *
 * Dois caminhos produzem a colisão e os dois são normais: duas URLs do sitemap redirecionando para
 * o MESMO destino (D13 — o destino é que conta) e uma URL alcançada na fase largura recolhida de
 * novo na fase colheita.
 *
 * A linha que sobrevive é a primeira, mas `noSitemap` é o OU de todas: se qualquer das colididas
 * era declarada, a sobrevivente é declarada — senão o sitemap encolheria em silêncio.
 */
export function dedupPorUrl(paginas) {
  const mapa = new Map();
  for (const p of paginas) {
    const anterior = mapa.get(p.url);
    if (!anterior) {
      mapa.set(p.url, { ...p });
      continue;
    }
    anterior.noSitemap = anterior.noSitemap || p.noSitemap;
  }
  return [...mapa.values()];
}

// ── As contagens da corrida ─────────────────────────────────────────────────

/**
 * O agregado de `hub_pagina_corrida`, mais as invariantes do §2 do data-model como asserção.
 *
 * A que mais importa: ÓRFÃ é `profundidade === null` com busca BEM-SUCEDIDA. Uma página que falhou
 * também tem profundidade indefinida, e somar as duas transformaria erro de rede em achado de
 * arquitetura de links — a inversão de sinal que esta casa já pagou uma vez.
 */
export function agregar(paginas, { linksNavegacao = 0, declaradas = 0, tetoAtingido = false } = {}) {
  const declaradasVistas = paginas.filter((p) => p.noSitemap).length;
  if (!tetoAtingido && declaradas > 0 && declaradasVistas > declaradas) {
    throw new Error("invariante: mais páginas declaradas na corrida do que no sitemap");
  }
  const profundidades = paginas.map((p) => p.profundidade).filter((d) => typeof d === "number");
  return {
    declaradas,
    visitadas: paginas.length,
    falhas: paginas.filter((p) => p.erro).length,
    orfas: paginas.filter((p) => p.profundidade === null && p.noSitemap && !p.erro).length,
    linkadasNaoDeclaradas: paginas.filter((p) => !p.noSitemap).length,
    linksNavegacao,
    tetoAtingido,
    profundidadeMaxima: profundidades.length ? Math.max(...profundidades) : null,
    semTitulo: paginas.filter((p) => !p.erro && p.titulo === null).length,
    schemaAusente: paginas.filter((p) => p.schemaEstado === "ausente").length,
    schemaInvalido: paginas.filter((p) => p.schemaEstado === "invalido").length,
    semDataDeclarada: paginas.filter((p) => !p.erro && p.dataDeclarada === null).length,
    jsDependente: paginas.filter((p) => p.conteudoEstado === "js-dependente").length,
  };
}

// ── As quatro taxas do board ────────────────────────────────────────────────

/** A faixa do board para o título na SERP desktop, em pixels estimados (D4). */
export const TITULO_PX_MIN = 500;
export const TITULO_PX_MAX = 580;
/** ...e o limite de caracteres para o termo principal aparecer no título. */
export const TERMO_ATE = 35;

/** Só quem respondeu entra em taxa. Falha de rede fica FORA do numerador e do denominador — ela é
 *  falha da corrida, nunca "página sem título, sem Schema ou sem links" (FR-016). */
const avaliaveis = (paginas) => paginas.filter((p) => !p.erro);

/**
 * US2 — a Taxa de Integridade do Título: largura estimada dentro da faixa E termo principal nos
 * primeiros 35 caracteres.
 *
 * `termos` é `Map<url, posicao|null>` — a posição já calculada por `posicaoDoTermo()`, porque o
 * termo vem do GSC na LEITURA (D10) e não da corrida. URL SEM termo apurado sai do DENOMINADOR:
 * ela nunca pode aparecer como título reprovado, que seria transformar "o GSC não tem impressão
 * dessa página" em "o título está errado".
 */
export function taxaIntegridadeDoTitulo(paginas, termos) {
  const posicao = (u) => (termos instanceof Map ? termos.get(u) : termos?.[u]) ?? null;
  const base = avaliaveis(paginas).filter((p) => p.titulo !== null && posicao(p.url) !== null);
  if (!base.length) return null;
  const cabe = (p) => p.tituloPx !== null && p.tituloPx >= TITULO_PX_MIN && p.tituloPx <= TITULO_PX_MAX;
  const noComeco = (p) => posicao(p.url) >= 0 && posicao(p.url) <= TERMO_ATE;
  const passam = base.filter((p) => cabe(p) && noComeco(p));
  return {
    fracao: passam.length / base.length,
    avaliadas: base.length,
    semTermo: avaliaveis(paginas).filter((p) => posicao(p.url) === null).length,
    fora: base.filter((p) => !cabe(p) || !noComeco(p)),
  };
}

/** US2 — a Taxa de Alinhamento de Intenção: título com modificador explícito (FR-007). */
export function taxaAlinhamento(paginas) {
  const base = avaliaveis(paginas).filter((p) => p.titulo !== null);
  if (!base.length) return null;
  const ausentes = base.filter((p) => p.intencao === "ausente");
  return { fracao: (base.length - ausentes.length) / base.length, avaliadas: base.length, ausentes };
}

/**
 * US3 — a Taxa de Cobertura de Dados Estruturados, contra a meta de 100% do board.
 *
 * `invalido` e `ausente` saem como DOIS números, nunca somados num "sem schema": o board mede
 * também "0 erros críticos", e os consertos são completamente diferentes — escrever o schema ×
 * achar a vírgula.
 */
export function taxaCobertura(paginas) {
  const base = avaliaveis(paginas);
  if (!base.length) return null;
  const validas = base.filter((p) => p.schemaEstado === "valido");
  const invalidas = base.filter((p) => p.schemaEstado === "invalido");
  const ausentes = base.filter((p) => p.schemaEstado === "ausente");
  return {
    fracao: validas.length / base.length,
    avaliadas: base.length,
    validas: validas.length,
    invalidas,
    ausentes,
  };
}

/** A cadência que o board pede: auditoria a cada 6 a 12 meses. */
export const CADENCIA_MESES = 12;

/**
 * US4 — quanto do conteúdo passou da cadência, medido só sobre quem DECLARA data.
 *
 * `hoje` é parâmetro pelo mesmo motivo da D9. Página com `dataDeclarada = null` fica fora do
 * numerador E do denominador (FR-009): "sem data declarada" nunca é "desatualizada" — é o
 * Independent Test desta história.
 */
export function cadencia(paginas, hoje) {
  const base = avaliaveis(paginas);
  const comData = base.filter((p) => p.dataDeclarada);
  const semData = base.filter((p) => !p.dataDeclarada);
  if (!comData.length) return { fracao: null, avaliadas: 0, vencidas: [], semData };
  const limite = new Date(hoje);
  limite.setMonth(limite.getMonth() - CADENCIA_MESES);
  const corte = limite.toISOString().slice(0, 10);
  const vencidas = comData.filter((p) => p.dataDeclarada < corte);
  return { fracao: (comData.length - vencidas.length) / comData.length, avaliadas: comData.length, vencidas, semData };
}

/**
 * A ordenação da SC-006: PERIFERIA primeiro — órfã, depois profundidade ≥ 4, depois menos de 5
 * links contextuais. Quem falhou vai para o fim: erro de rede não é achado de arquitetura.
 *
 * Empate desfeito por impressões (o trabalho que rende mais primeiro) e depois por URL, para a
 * lista não dançar entre duas leituras da mesma corrida.
 */
export const LINKS_CONTEXTUAIS_MIN = 5;
export const PROFUNDIDADE_MAX = 4;

export function ordemDaPeriferia(paginas, impressoesPorUrl = new Map()) {
  const imp = (u) => (impressoesPorUrl instanceof Map ? impressoesPorUrl.get(u) : impressoesPorUrl?.[u]) ?? 0;
  const grau = (p) => {
    if (p.erro) return 4;
    if (p.profundidade === null && p.noSitemap) return 0;
    if (p.profundidade !== null && p.profundidade >= PROFUNDIDADE_MAX) return 1;
    if (p.linksContextuais < LINKS_CONTEXTUAIS_MIN) return 2;
    return 3;
  };
  return [...paginas].sort(
    (a, b) => grau(a) - grau(b) || imp(b.url) - imp(a.url) || a.url.localeCompare(b.url),
  );
}
