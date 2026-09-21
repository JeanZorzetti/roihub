// O grafo interno do site e as agregações da corrida (024). Recebe arestas já extraídas e páginas
// já montadas, devolve números. Zero rede, zero banco, zero relógio (`hoje` é PARÂMETRO) — é o que
// torna a SC-003 provável em milissegundos, em vez de descoberta numa semana de números que
// parecem certos.
//
// As quatro taxas do board moram aqui, ao lado de `agregar()`, e não no `.tsx`: são agregação
// sobre a coleção de páginas, e o Princípio III diz que o que dá para testar sem subir o Next
// nasce em `.mjs`. A tela só renderiza.

// Único import do módulo, e ele não quebra a pureza: `pagina.mjs` também é zero rede, zero banco,
// zero relógio. `PISO_PALAVRAS` é o limiar de "a página serve texto legível no HTML inicial", e
// `densidadeContextual()` precisa dele pelo MESMO motivo que `estadoDoConteudo()` — redeclará-lo
// aqui daria duas definições de "página vazia" no repo, e uma delas ficaria para trás na primeira
// correção (a frase que `okr.mjs` escreveu sobre a regra de `0/0`).
import { PISO_PALAVRAS } from "./pagina.mjs";

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

/**
 * O host contra o qual `ehInterna` mede, tirado da home que a requisição de fato ALCANÇOU.
 *
 * A declaração (`p.url`) fica velha nos dias entre uma troca de domínio e a edição do card, e a
 * home responde 301 para o site novo. Casar os links contra a declaração que o próprio 301 acabou
 * de desmentir rejeita TODO link como externo: zero aresta, zero navegação, zero densidade, e
 * todas as páginas do sitemap saem como órfãs — um defeito do site que é da medição.
 *
 * Medido na atma em 2026-09-14: 13 links internos no HTML de `usealigner.com`, `host` declarado
 * `atma.roilabs.com.br`, resultado gravado 0 arestas e 35 órfãs de 35 visitadas.
 */
export function hostDaTravessia(homeResolvida, declarado) {
  try {
    return new URL(homeResolvida).hostname.toLowerCase();
  } catch {
    return String(declarado ?? "").toLowerCase();
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
    // 040 — a meta do TERMO sozinha, no mesmo denominador da conjunção (é o mesmo pré-requisito:
    // sem termo apurado não há o que procurar no título). `ausentes` separa os dois jeitos de
    // reprovar, que pedem trabalho oposto: o termo aparece DEPOIS do caractere 35 (mover o gancho
    // para a frente) × o termo não aparece no título de jeito nenhum (reescrever, ou aceitar que a
    // página ranqueia para uma consulta que ela não nomeia). Sem a distinção, "0% no começo do
    // título" manda encurtar um título em que a palavra não está.
    termo: {
      passam: base.filter((p) => noComeco(p)).length,
      base: base.length,
      ausentes: base.filter((p) => posicao(p.url) < 0).length,
    },
  };
}

/**
 * 040 — a LARGURA sozinha, no denominador que a meta do board pede.
 *
 * A meta é "100% dos títulos entre 500px e 580px" e não menciona termo nenhum: sai do denominador
 * quem não tem título, e mais ninguém. `taxaIntegridadeDoTitulo` responde outra pergunta — a
 * conjunção largura E termo — e o denominador dela é menor por construção, porque exige termo
 * apurado no Search Console. Publicar a conjunção no lugar desta leria "a largura está em 0%" num
 * site em que quase metade dos títulos cabe na faixa.
 *
 * `estreitos` e `largos` saem SEPARADOS pelo mesmo motivo de `invalidas`/`ausentes` em
 * `taxaCobertura`: um título curto demais desperdiça pixel comprado, um longo demais é cortado na
 * SERP — e os consertos são opostos.
 */
export function taxaLarguraDoTitulo(paginas) {
  const base = avaliaveis(paginas).filter((p) => p.titulo !== null && p.tituloPx !== null);
  if (!base.length) return null;
  const estreitos = base.filter((p) => p.tituloPx < TITULO_PX_MIN);
  const largos = base.filter((p) => p.tituloPx > TITULO_PX_MAX);
  return {
    fracao: (base.length - estreitos.length - largos.length) / base.length,
    avaliadas: base.length,
    estreitos,
    largos,
    // Título presente e largura nula seria medida ausente, nunca título fora da faixa — e como o
    // crawl grava `titulo_px` NULL só quando não há título, este número é a asserção de que a
    // coluna continua significando isso.
    semLargura: avaliaveis(paginas).filter((p) => p.titulo !== null && p.tituloPx === null).length,
  };
}

/**
 * US2 — a Taxa de Alinhamento de Intenção: título com modificador explícito (FR-007).
 *
 * 041 — `fracao` NÃO mudou, e não pode mudar: `/okr/[slug]/aquisicao` publica este mesmo número, e
 * duas telas que discordam sobre a mesma folha é o defeito que a 038 nomeou. O que entrou é
 * `compartilhado`, e ele existe porque a meta do board é "modificador explícito no Title" — no
 * Title DA PÁGINA. Medido na Atma em 20/09/2026: 13 das 35 URLs servem o mesmo `<title>` de
 * fallback do site, e as 13 passam pela palavra "Preço" que está no template e não foi escrita
 * para nenhuma delas. Sem este campo a folha publica 54,3% e 13 dos 19 aprovados são uma página só.
 *
 * `proprias` é o denominador da leitura honesta (22 na Atma, 27,3%) e sai SEPARADO em vez de virar
 * a fração: qual dos dois denominadores o board quer é decisão do dono, não da função.
 */
export function taxaAlinhamento(paginas) {
  const base = avaliaveis(paginas).filter((p) => p.titulo !== null);
  if (!base.length) return null;
  const ausentes = base.filter((p) => p.intencao === "ausente");
  // Um título servido por mais de uma URL não identifica página nenhuma. `Map` e não `Set` porque
  // o nó precisa nomear QUAL título repete e em quantas URLs — "há duplicata" não manda consertar.
  const porTitulo = new Map();
  for (const p of base) porTitulo.set(p.titulo, [...(porTitulo.get(p.titulo) ?? []), p]);
  const repetidas = [...porTitulo.values()].filter((v) => v.length > 1);
  const compartilhadas = repetidas.flat();
  const proprias = base.filter((p) => !compartilhadas.includes(p));
  return {
    fracao: (base.length - ausentes.length) / base.length,
    avaliadas: base.length,
    ausentes,
    compartilhado: {
      urls: compartilhadas.length,
      passam: compartilhadas.filter((p) => p.intencao !== "ausente").length,
      // O campeão de repetição, que é o que o nó nomeia: título, quantas URLs o servem e QUAIS —
      // "há duplicata" não manda consertar nada; a lista de caminhos manda.
      titulos: repetidas
        .map((v) => ({ titulo: v[0].titulo, urls: v.length, intencao: v[0].intencao, paginas: v }))
        .sort((a, b) => b.urls - a.urls),
      // A mesma medida sobre quem tem título próprio. `null` quando ninguém tem: dividir por zero
      // publicaria `NaN%`, e "todas as páginas compartilham título" é achado, não ausência.
      proprias: proprias.length,
      passamProprias: proprias.filter((p) => p.intencao !== "ausente").length,
      fracaoPropria: proprias.length ? proprias.filter((p) => p.intencao !== "ausente").length / proprias.length : null,
    },
  };
}

/**
 * 041 — o MATCH que dá nome ao KPI: a intenção da BUSCA contra a intenção do TÍTULO.
 *
 * `taxaAlinhamento` responde "o título tem modificador", que é metade da definição do board ("a
 * correspondência entre o modificador de intenção DA BUSCA e o gancho do título"). A outra metade
 * precisa da consulta que traz a impressão, e ela não está na corrida de página — chega por `busca`,
 * `Map<url, intencao>` já classificada pelo MESMO `modificadoresDeIntencao()` que gravou a coluna.
 * Um segundo classificador aqui daria duas definições de "comercial" ao lado uma da outra.
 *
 * Três saídas e nunca duas: `decididas` é onde os DOIS lados declaram intenção, e só ali existe
 * correspondência para julgar. Consulta sem modificador não é "não casa" — é "a busca não declarou
 * intenção", e chamar isso de reprovação mandaria reescrever um título contra um termo mudo.
 */
export function correspondenciaDeIntencao(paginas, busca) {
  const base = avaliaveis(paginas).filter((p) => p.titulo !== null && busca?.get(p.url) != null);
  if (!base.length) return null;
  // `ambos` no título cobre qualquer intenção declarada: o título que diz "Guia" e "Preço" atende a
  // busca informacional e a comercial, e reprová-lo numa delas puniria a página mais completa.
  const casa = (p) => p.intencao === busca.get(p.url) || (p.intencao === "ambos" && busca.get(p.url) !== "ausente");
  const decididas = base.filter((p) => busca.get(p.url) !== "ausente");
  return {
    // `null` e não `0` quando nenhuma busca declara intenção: zero casos julgados nunca é 0% de acerto.
    fracao: decididas.length ? decididas.filter(casa).length / decididas.length : null,
    avaliadas: base.length,
    decididas: decididas.length,
    casam: decididas.filter(casa).length,
    divergem: decididas.filter((p) => !casa(p)),
    // A busca muda não é resto: na Atma ela é 9 de 10, e é ela que explica por que a fração acima
    // não tem denominador para existir. Sai como LISTA além da contagem, porque o nó nomeia os
    // termos — "9 consultas sem modificador" não deixa ninguém julgar se a régua é justa.
    mudas: base.filter((p) => busca.get(p.url) === "ausente"),
    buscaMuda: base.length - decididas.length,
  };
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

/** A cadência que o board pede: auditoria a cada 6 a 12 meses.
 *
 * ⚠️ 19/09/2026 — deixou de ser UM número. Ver `CADENCIA_POR_INTENCAO` abaixo. A constante fica
 * como o piso conservador e a compatibilidade de quem importa `CADENCIA_MESES` por nome. */
export const CADENCIA_MESES = 12;

/**
 * A cadência por INTENÇÃO da página (decisão do dono, 19/09/2026).
 *
 * O board dizia "6 a 12 meses" e o código fixou 12. Nenhum dos dois tem fonte — nenhum estudo
 * publica cadência de revisão, porque ela depende inteiramente da volatilidade do TEMA. Um número
 * só para o site inteiro erra dos dois lados ao mesmo tempo: preço de alinhador muda por
 * trimestre, anatomia dentaria não muda nunca.
 *
 * Isto NÃO é régua de mercado e nunca vai virar uma: é **política editorial declarada**, e está
 * registrada como tal em `lib/gsc-delta.mjs#EDITORIAIS`. A diferença importa na tela: régua leva
 * fonte e URL, política leva o nome de quem decidiu.
 *
 * A chave é a saída de `modificadoresDeIntencao()` — a MESMA que `taxaAlinhamento()` já usa e que
 * o crawl já grava em `hub_pagina.intencao`. Uma segunda classificação de intenção ao lado
 * divergiria da primeira no dia em que alguém acrescentasse um modificador.
 *
 * `ambos` cai em 6 de propósito: página que mistura "como fazer" com "preço" carrega a parte que
 * apodrece. O prazo mais curto entre os dois é o que vale — arredondar para cima deixaria o preço
 * velho na tela por meio ano.
 *
 * `ausente` fica em 12: sem modificador não há sinal de que o conteúdo se move, e presumir
 * volatilidade geraria revisão semestral do site inteiro por falta de evidência — que é o oposto
 * do que "sem sinal" deveria produzir.
 */
export const CADENCIA_POR_INTENCAO = {
  comercial: 6,
  ambos: 6,
  informacional: 12,
  ausente: 12,
};

/** Os meses que valem para uma página. Função e não acesso direto ao mapa: intenção `null` (crawl
 *  anterior à coluna) cai no conservador em vez de devolver `undefined` e virar `NaN` na data. */
export const cadenciaDe = (intencao) => CADENCIA_POR_INTENCAO[intencao] ?? CADENCIA_MESES;

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
  // 19/09/2026 — o corte passou a ser POR PÁGINA, porque o prazo agora depende da intenção dela.
  // Um corte único calculado fora do laço (como era até aqui) não tem como variar por linha.
  const corteDe = (meses) => {
    const limite = new Date(hoje);
    limite.setMonth(limite.getMonth() - meses);
    return limite.toISOString().slice(0, 10);
  };
  const cortes = new Map(); // memo: são dois prazos, não um por página
  const vencidas = comData.filter((p) => {
    const meses = cadenciaDe(p.intencao);
    if (!cortes.has(meses)) cortes.set(meses, corteDe(meses));
    return p.dataDeclarada < cortes.get(meses);
  });
  return {
    fracao: (comData.length - vencidas.length) / comData.length,
    avaliadas: comData.length,
    vencidas,
    semData,
    // Os prazos em uso nesta leitura, para a tela poder dizer QUAL venceu — "12 páginas vencidas"
    // sem o prazo de cada uma esconde que metade delas tinha seis meses e metade tinha doze.
    prazos: Object.fromEntries([...cortes.keys()].map((m) => [m, corteDe(m)])),
  };
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

/**
 * A DENSIDADE contextual, em links por 1.000 palavras (decisão do dono, 19/09/2026).
 *
 * `LINKS_CONTEXTUAIS_MIN = 5` sozinho tem dois defeitos, e são opostos:
 *   — numa página de 200 palavras, 5 links são um link a cada 40 palavras: é menu disfarçado.
 *   — num guia de 4.000 palavras, 5 links passam como saudável enquanto a página está muda.
 * E, por ser só um piso, ele não tem como acusar EXCESSO — 40 links contextuais numa página não
 * é melhor que 8, é pior: dilui o sinal e costuma ser rodapé vestido de texto.
 *
 * ⚠️ OS DOIS NÚMEROS SÃO EDITORIAIS. Nenhum estudo público prescreve contagem de links internos —
 * o maior que existe (Zyppy, 23 milhões de links) mede DIVERSIDADE DE ÂNCORA, não quantidade, e
 * declara correlação, não causa. Citar aquele estudo para sustentar esta faixa seria dado real
 * amparando número inventado — a pior falsa autoridade, porque a URL confere quando alguém clica.
 * Registrados em `lib/gsc-delta.mjs#EDITORIAIS`.
 *
 * Calibrar com o próprio site é barato e honesto: `node scripts/profundidade.mjs <slug>` imprime
 * p25, mediana e p75 de links por 1.000 palavras da última corrida. Estes 3 e 10 são o ponto de
 * partida, não um veredito de mercado.
 *
 * `MINIMO_ABSOLUTO` existe porque a densidade sozinha absolve a página curta: 250 palavras × 3 por
 * mil dá 0,75 link, e nenhum link inteiro satisfaz um alvo fracionário para baixo. Uma página de
 * conteúdo com ZERO link contextual é uma folha do grafo, qualquer que seja o tamanho dela.
 */
export const LINKS_POR_MIL_MIN = 3;
export const LINKS_POR_MIL_MAX = 10;
export const LINKS_MINIMO_ABSOLUTO = 1;

/**
 * O veredito de densidade de uma página. Quatro estados, e `null` quando não dá para dizer.
 *
 * `palavras` ausente ou abaixo de `PISO_PALAVRAS` devolve `null`, NUNCA "escasso": página que não
 * serve texto no HTML inicial não é página pobre em links — é página que o crawl não leu, e os dois
 * pedem trabalho oposto (renderizar no servidor × escrever links).
 *
 * @param {number} links contextuais apontando PARA esta página
 * @param {number|null} palavras
 * @returns {{estado:"escasso"|"dentro"|"excessivo", porMil:number, alvo:[number,number]}|null}
 */
export function densidadeContextual(links, palavras) {
  if (!Number.isFinite(palavras) || palavras < PISO_PALAVRAS) return null;
  if (!Number.isFinite(links)) return null;
  const porMil = (links / palavras) * 1000;
  const piso = Math.max(LINKS_MINIMO_ABSOLUTO, (LINKS_POR_MIL_MIN * palavras) / 1000);
  const teto = (LINKS_POR_MIL_MAX * palavras) / 1000;
  const estado = links < piso ? "escasso" : links > teto ? "excessivo" : "dentro";
  return { estado, porMil, alvo: [piso, teto] };
}

/**
 * VARIEDADE DE TEXTO-ÂNCORA — quantas âncoras DISTINTAS apontam para cada página.
 *
 * É a única coisa desta família que tem estudo grande por trás: Zyppy analisou 23 milhões de links
 * internos em 1.800 sites e encontrou correlação positiva entre o número de variações de âncora
 * apontando para uma página e o tráfego dela. Os autores dizem, com todas as letras, que é
 * **correlação e não causa**, e que atualizações de ranking posteriores podem tê-la afetado.
 *
 * Por isso esta função **conta e não julga**: devolve o número de âncoras distintas e nada mais.
 * Não há limiar aqui, e não deve haver — transformar uma correlação declarada pelos próprios
 * autores como incerta num "mínimo de N âncoras" seria exatamente o salto que a R6 recusa.
 *
 * DEZ links idênticos ("clique aqui" × 10) contam como UMA variação. É esse o ponto: a contagem de
 * `densidades()` não distingue dez links repetidos de dez links escritos, e são coisas diferentes.
 *
 * `nav` é o mesmo conjunto de `densidades()` — menu fora, pela mesma razão: "Preços" repetido no
 * cabeçalho de 35 páginas é uma âncora só, e ela não é voto editorial.
 *
 * @param {{de:string, para:string, ancora:string}[]} arestas
 * @param {Set<string>} nav
 * @returns {Map<string, number>} URL de destino → âncoras distintas
 */
export function variedadeDeAncora(arestas, nav) {
  const mapa = new Map();
  for (const a of arestas) {
    if (a.de === a.para) continue;
    if (nav.has(chave(a))) continue;
    // Normalização mínima: caixa e espaço. "Preços" e "preços " são a mesma âncora escrita duas
    // vezes, e contá-las como duas variações inflaria a única métrica desta família que tem estudo.
    // Acento FICA: "preco" e "preço" são textos diferentes na SERP e para o leitor.
    const texto = String(a.ancora ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!texto) continue; // âncora vazia (imagem sem alt) não é variação de texto
    const set = mapa.get(a.para) ?? new Set();
    set.add(texto);
    mapa.set(a.para, set);
  }
  return new Map([...mapa].map(([url, set]) => [url, set.size]));
}

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
