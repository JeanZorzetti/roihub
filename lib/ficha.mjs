// A ficha N0-N6 de UM projeto (feature 011) — sete níveis do handoff/okr-kpi-template.md que
// hoje não têm tela. Módulo PURO: sem env, sem banco, sem rede, sem relógio. `hoje` e a janela
// entram por parâmetro (Princípio III). Importa lib/funil.mjs e lib/okr.mjs e NÃO reimplementa
// célula, razão, cadeia, veredito nem inversão — `montarFicha()` e `projetar()` chegam prontas
// por parâmetro (contracts/ficha-mjs.md).
import { ehApurado, razao, pct } from "./funil.mjs";
import { PERFIS } from "./okr.mjs";

/**
 * @typedef {{estado:"apurado", valor:number, rotulo:string, fonte:string}} CelulaApurada
 * @typedef {{estado:"declarado", valor:number|string, rotulo:string, declaradoEm:string, oQue:string}} CelulaDeclarada
 * @typedef {{estado:"nao-apurado", rotulo:string, motivo:string, consultar:string}} CelulaNaoApurada
 * @typedef {{estado:"inferido", valor:number, rotulo:string, de:string, divida:string}} CelulaInferida
 * @typedef {CelulaApurada|CelulaDeclarada|CelulaNaoApurada|CelulaInferida} CelulaFicha
 * @typedef {{estado:"apurado", entrada:number, saida:number}|{estado:"nao-apurado"}} Segmento
 */

/**
 * Embrulha uma célula da 009 (`{valor}` ou `{naoApurado}`) no envelope de três estados desta
 * feature. `fonte` é quem confere o número quando ele existe; `consultar` é a mesma fonte quando
 * ele não existe — R4, a fonte a CONSULTAR, não a instrumentação a escrever.
 * @param {{valor:number}|{naoApurado:string}} celula @param {string} fonte @param {string} [rotulo]
 * @returns {CelulaFicha}
 */
export function estadoDeApurado(celula, fonte, rotulo = "") {
  if (ehApurado(celula)) return { estado: "apurado", valor: celula.valor, rotulo, fonte };
  return { estado: "nao-apurado", rotulo, motivo: celula.naoApurado, consultar: fonte };
}

/**
 * Nasce de uma declaração do card (`meta.ticket`, `ficha.objetivo`, …). `em` ausente não apaga a
 * declaração — vira `"data não registrada"` (FR-014).
 * @param {number|string} valor @param {{em?:string, oQue:string, rotulo?:string}} p
 * @returns {CelulaDeclarada}
 */
export function declarada(valor, { em, oQue, rotulo = "" }) {
  return { estado: "declarado", valor, rotulo, declaradoEm: em || "data não registrada", oQue };
}

/**
 * Nasce de uma ausência: sem coletor, sem perfil, sem fonte. `consultar` é obrigatório e não pode
 * ser vazio (R4) — célula não apurada sem fonte a consultar é a mesma omissão que R1 proíbe.
 * @param {string} motivo @param {string} consultar @param {string} [rotulo]
 * @returns {CelulaNaoApurada}
 */
export function naoApurada(motivo, consultar, rotulo = "") {
  if (!consultar) throw new Error("naoApurada() exige `consultar` não vazio — R4");
  return { estado: "nao-apurado", rotulo, motivo, consultar };
}

/**
 * Nasce de dedução, não de leitura direta nem de declaração (013, D5). `de` é o vestígio de onde
 * o número foi deduzido; `divida` é por que ele ainda não é apurado e o que o tornaria (FR-011b).
 * Estado próprio — nunca `apurado` com aviso, nunca `declarado` — para que `combinar()`, o total
 * composto e `validarKrs()` a ignorem por CONSTRUÇÃO, não por disciplina (SC-009).
 * @param {number} valor @param {{de:string, divida:string, rotulo?:string}} p
 * @returns {CelulaInferida}
 */
export function inferida(valor, { de, divida, rotulo = "" }) {
  if (!de) throw new Error("inferida() exige `de` não vazio");
  if (!divida) throw new Error("inferida() exige `divida` não vazia");
  return { estado: "inferido", valor, rotulo, de, divida };
}

/**
 * A herança da FR-010 — o único jeito de a ficha produzir célula DERIVADA.
 *
 * `0 tratamentos × R$ 4.000 declarados` é aritmética correta e resultado DECLARADO, nunca
 * apurado: um dos insumos veio de declaração, e o produto herda o estado mais fraco da entrada.
 *
 * @param {CelulaFicha[]} insumos @param {(valores:number[]) => number} calcular
 * @param {{rotulo?:string, oQue?:string}} [opts]
 * @returns {CelulaFicha}
 */
export function combinar(insumos, calcular, opts = {}) {
  const rotulo = opts.rotulo ?? "";
  const faltante = insumos.find((i) => i.estado === "nao-apurado");
  if (faltante) return naoApurada(faltante.motivo, faltante.consultar, rotulo);

  const declaracoes = insumos.filter((i) => i.estado === "declarado");
  const valores = insumos.map((i) => i.valor);
  const valor = calcular(valores);
  if (declaracoes.length === 0) {
    const fontes = [...new Set(insumos.map((i) => i.fonte))].join(" · ");
    return { estado: "apurado", valor, rotulo, fonte: fontes };
  }
  const declaradoEm = declaracoes
    .map((d) => d.declaradoEm)
    .filter((d) => d !== "data não registrada")
    .sort()[0] ?? "data não registrada";
  const oQue = declaracoes.map((d) => d.oQue).join(" · ");
  return { estado: "declarado", valor, rotulo, declaradoEm, oQue };
}

// ── Catálogos fixos (data-model §5, §6) ─────────────────────────────────────

/** Espaço de chaves de `n4:` na validação de KR. */
export const CANAIS = ["organico", "direto", "pago", "indicacao", "outbound", "social"];

/** As quatro famílias do §5, com os medidores fixos de cada uma. Catálogo INTEIRO — é ele o
 *  espaço de chaves de `n5:`, não só a família exibida (data-model §8, decisão D7 da pesquisa). */
export const MEDIDORES = {
  D1: ["paginas-indexadas", "posicao-media-com-corte-pais", "cobertura", "alcance", "citacao-por-ia", "impressoes"],
  D2: ["lcp", "inp", "cls", "ttfb", "uptime", "taxa-5xx", "build", "certificado"],
  D3: ["scroll-ate-oferta", "cliques-cta", "abandono-por-campo", "saida-checkout"],
  D4: ["lead-gravado", "webhook-2xx", "gateway-ligado", "email-entregue"],
};

const TITULOS_NIVEL = {
  N0: { titulo: "N0 — o que muda no mundo?", pergunta: "o que muda no mundo?" },
  N1: { titulo: "N1 — quanto isso vale em R$?", pergunta: "quanto isso vale em R$?" },
  N2: { titulo: "N2 — de que fatores o dinheiro é feito?", pergunta: "de que fatores o dinheiro é feito?" },
  N3: { titulo: "N3 — quanto se perde em cada etapa?", pergunta: "quanto se perde em cada etapa?" },
  N4: { titulo: "N4 — o que alimenta o topo, por canal?", pergunta: "o que alimenta o topo, por canal?" },
  N5: { titulo: "N5 — por que o volume é esse?", pergunta: "por que o volume é esse?" },
  N6: { titulo: "N6 — o que eu faço segunda?", pergunta: "o que eu faço segunda?" },
};

const ORDEM_NIVEIS = ["N0", "N1", "N2", "N3", "N4", "N5", "N6"];

/** @param {string} id @param {CelulaFicha[]} celulas @param {string} [nota] */
function nivel(id, celulas, nota) {
  return { id, ...TITULOS_NIVEL[id], celulas, ...(nota ? { nota } : {}) };
}

/** Célula única `não apurado`, para um nível inteiro sem entrada. */
const semEntrada = (motivo, consultar) => [naoApurada(motivo, consultar)];

// ── N2 — a conta de receita (FR-019 a FR-022) ───────────────────────────────

/**
 * Avalia os fatores da conta de receita de N2 contra a cadeia de N3.
 *
 * FR-020 — tudo ou nada: um fator de cadeia é `nao-apurado` se QUALQUER degrau da cobertura
 * estiver não apurado, nunca a taxa do pedaço medido.
 * FR-021 — conferência de definição, só sobre fatores de cadeia: coberturas contíguas na ordem
 * de `marcos`, a última termina no último marco; degraus acima da primeira cobertura são a
 * entrada (N4) e não produzem erro.
 * FR-022 — veredito nunca "fecha" derivado de ausência.
 *
 * @param {{nome:string, tipo:"cadeia"|"valor", cobertura?:string[], fonte?:string}[]} fatores
 * @param {{chave:string, nome:string, celula:{valor:number}|{naoApurado:string}}[]} marcos
 * @param {unknown} taxas não usado diretamente — a cobertura já referencia os marcos
 * @param {{ticket?: number, ticketDeclaradoEm?: string}} declaracoes
 */
export function avaliarN2(fatores, marcos, taxas, declaracoes) {
  const indiceMarco = new Map(marcos.map((m, i) => [m.chave, i]));
  let erroDeDefinicao = null;

  const chavesDeCadeia = fatores.filter((f) => f.tipo === "cadeia").flatMap((f) => f.cobertura);
  const indices = chavesDeCadeia.map((c) => indiceMarco.get(c));
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] !== indices[i - 1] + 1) {
      erroDeDefinicao = `cobertura dos fatores de cadeia tem buraco ou sobreposição entre \`${chavesDeCadeia[i - 1]}\` e \`${chavesDeCadeia[i]}\``;
      break;
    }
  }
  if (!erroDeDefinicao && indices.length && indices[indices.length - 1] !== marcos.length - 1) {
    erroDeDefinicao = `cobertura dos fatores de cadeia não termina no último marco (\`${marcos[marcos.length - 1]?.chave}\`)`;
  }

  // O PRIMEIRO fator de cadeia da fórmula é VOLUME (Leads, Sessões, Propostas, …), não taxa — é
  // o termo de entrada do produto. Os seguintes são CR(...): taxa do marco anterior à cobertura
  // (a saída do fator de cima) até o fim da própria cobertura — fração SEMPRE colada (R2).
  let indiceCadeia = -1;
  const celulasFatores = fatores.map((f) => {
    if (f.tipo === "valor") {
      if (declaracoes?.ticket == null) return naoApurada("sem ticket declarado", "campo `meta.ticket` do card", f.nome);
      return declarada(declaracoes.ticket, { em: declaracoes.ticketDeclaradoEm, oQue: "meta.ticket", rotulo: f.nome });
    }
    indiceCadeia++;
    const degraus = f.cobertura.map((chave) => marcos[indiceMarco.get(chave)]);
    const faltando = degraus.find((m) => !m || !ehApurado(m.celula));
    if (faltando) {
      return naoApurada(
        `degrau \`${faltando?.chave ?? "?"}\` não apurado — a taxa do trecho medido não representa o fator inteiro`,
        faltando?.fonte ?? "fonte do degrau faltante",
        f.nome,
      );
    }
    const ultimo = degraus[degraus.length - 1];
    if (indiceCadeia === 0) {
      // primeiro termo: o volume bruto do marco final da cobertura, não uma taxa.
      return { estado: "apurado", valor: ultimo.celula.valor, rotulo: f.nome, fonte: ultimo.fonte };
    }
    const anterior = marcos[indiceMarco.get(f.cobertura[0]) - 1];
    if (!anterior || !ehApurado(anterior.celula)) {
      return naoApurada(
        `degrau anterior \`${anterior?.chave ?? "?"}\` não apurado — taxa sem denominador`,
        anterior?.fonte ?? "fonte do degrau anterior",
        f.nome,
      );
    }
    const r = razao(ultimo.celula, anterior.celula);
    if (!ehApurado(r)) return naoApurada(r.naoApurado, ultimo.fonte, f.nome);
    return {
      estado: "apurado",
      valor: `${pct(r.valor)} (${ultimo.celula.valor}/${anterior.celula.valor})`,
      rotulo: f.nome,
      fonte: `${anterior.nome} → ${ultimo.nome}`,
    };
  });

  const faltantes = celulasFatores.filter((c) => c.estado === "nao-apurado");
  const veredito = faltantes.length
    ? naoApurada(
        `fatores não apurados: ${faltantes.map((c) => c.rotulo).join(", ")}`,
        "os degraus da cadeia que sustentam cada fator",
        "a conta fecha?",
      )
    : { estado: "apurado", valor: 1, rotulo: "a conta fecha?", fonte: "todos os fatores apurados/declarados" };

  return { fatores: celulasFatores, veredito, erroDeDefinicao };
}

// ── N4 — volume por canal (FR-023 a FR-025; GA4 somado ao GSC — 013) ────────

/** Mapa GA4 grupo → canal do hub (013, D3), constante para o teste conferir sem duplicar a
 *  tabela. `outbound` NÃO aparece aqui, de propósito: o GA4 não tem grupo que corresponda a
 *  prospecção ativa, e mapear qualquer coisa nele seria "jogar num canal existente" (edge case
 *  da spec). `Organic Search` também não aparece: vai para `organicoIgnorado`, nunca para
 *  `porCanal` (FR-005a). */
export const GRUPOS_GA4 = {
  Direct: "direto",
  Referral: "indicacao",
  "Organic Social": "social",
  "Paid Search": "pago",
  "Paid Social": "pago",
  "Paid Shopping": "pago",
  "Paid Video": "pago",
  "Paid Other": "pago",
  Display: "pago",
  "Cross-network": "pago",
};

/**
 * Camada pura sobre as linhas cruas da GA4 Data API — nenhuma regra de estado aqui, só a soma
 * por canal (contracts/n4-canais.md).
 * @param {{grupo:string, sessoes:number}[]} linhas
 * @returns {{porCanal: Record<"direto"|"pago"|"indicacao"|"social", number>, organicoIgnorado: number, foraDoCatalogo: {grupo:string, sessoes:number}[]}}
 */
export function mapearCanaisGa4(linhas) {
  const porCanal = { direto: 0, pago: 0, indicacao: 0, social: 0 };
  let organicoIgnorado = 0;
  const foraDoCatalogo = [];
  for (const linha of linhas ?? []) {
    const sessoes = linha?.sessoes;
    // número estranho que virasse `0` seria o defeito da R1 pela porta dos fundos — tratado como
    // grupo desconhecido, nunca somado.
    if (typeof sessoes !== "number" || !Number.isFinite(sessoes) || sessoes < 0) {
      foraDoCatalogo.push(linha);
      continue;
    }
    const canal = GRUPOS_GA4[linha.grupo];
    if (canal) porCanal[canal] += sessoes;
    else if (linha.grupo === "Organic Search") organicoIgnorado += sessoes;
    else foraDoCatalogo.push(linha);
  }
  return { porCanal, organicoIgnorado, foraDoCatalogo };
}

const MOTIVO_OUTBOUND = "a fonte GA4 não distingue prospecção ativa";
const CONSULTAR_OUTBOUND = "apuração manual de outbound";

/**
 * Resolve o estado da fonte GA4 para a janela pedida — uma vez, reaproveitado por `montarN4()`
 * (as quatro células) e por `montarNiveis()` (os extras do nível: fora do catálogo, orgânico
 * ignorado, propriedade). Não é a fonte do canal orgânico em nenhuma das três situações de erro:
 * essa coluna é constante em `montarN4()` (FR-005a, SC-008).
 * @param {import("./ga4.js").LeituraGa4} ga4 @param {{inicio:string, fim:string}} [janela]
 */
function resolverGa4(ga4, janela) {
  if (!ga4) {
    return {
      estado: "sem-config",
      motivo: "sem propriedade GA4 configurada para este projeto",
      consultar: "campo `ga4.propertyId` em data/projects.json",
    };
  }
  if ("erro" in ga4) {
    return { estado: "erro", motivo: `fonte GA4 indisponível (${ga4.erro})`, consultar: "GA4 Data API" };
  }
  if (janela && (ga4.janela.inicio !== janela.inicio || ga4.janela.fim !== janela.fim)) {
    return {
      estado: "janela-diverge",
      motivo: `janela do GA4 (${ga4.janela.inicio}→${ga4.janela.fim}) difere da janela da cadeia (${janela.inicio}→${janela.fim})`,
      consultar: "janela declarada (R7) em lib/okr-coleta.ts",
    };
  }
  return { estado: "ok", mapa: mapearCanaisGa4(ga4.linhas), propriedade: ga4.propriedade };
}

/**
 * @param {string[]} canais @param {{valor:number}|{naoApurado:string}} cliquesCelula
 * @param {{chave:string, celula:{valor:number}|{naoApurado:string}}[]} marcos
 * @param {import("./ga4.js").LeituraGa4} [ga4] @param {{inicio:string, fim:string}} [janela]
 */
export function montarN4(canais, cliquesCelula, marcos, ga4, janela) {
  // sem elo: o canal é DENOMINADOR de alguma taxa de N3 quando o primeiro marco é o topo da
  // cadeia (visitante nos perfis A/B/D) — no perfil C a cadeia começa em `contato`, e `organico`
  // fica sem elo (data-model §5).
  const primeiroMarco = marcos[0]?.chave;
  const resolvido = resolverGa4(ga4, janela);
  return canais.map((id) => {
    if (id === "organico") {
      return {
        id,
        nome: "orgânico",
        celula: estadoDeApurado(cliquesCelula, "Search Console", "orgânico"),
        semElo: primeiroMarco !== "visitante",
      };
    }
    if (id === "outbound") {
      return { id, nome: id, celula: naoApurada(MOTIVO_OUTBOUND, CONSULTAR_OUTBOUND, id), semElo: true };
    }
    const celula =
      resolvido.estado === "ok"
        ? { estado: "apurado", valor: resolvido.mapa.porCanal[id], rotulo: id, fonte: `GA4 · ${resolvido.propriedade}` }
        : naoApurada(resolvido.motivo, resolvido.consultar, id);
    return { id, nome: id, celula, semElo: true };
  });
}

// ── N5 — a família do gargalo (FR-026 a FR-029) ─────────────────────────────

/**
 * @param {{posicao:number, celula?:string|null}} veredito saída de `posicaoDeAtaque()`
 * @param {{marcos:{chave:string, familiaDoBuraco:string|null}[], taxas:{de:string, para:string, celula:{valor:number}|{naoApurado:string}}[]}} ficha
 */
export function escolherFamilia(veredito, ficha) {
  if (veredito.posicao === 0) return { familia: null, motivo: "sem perfil declarado" };
  if (veredito.posicao === 1) {
    const marco = ficha.marcos.find((m) => m.chave === veredito.celula || m.nome === veredito.celula);
    // `familiaDoBuraco` é SEMPRE null aqui: `familiaDe()` só classifica buraco, e zero apurado não
    // é buraco. O fallback decide sozinho — e zero na ENTRADA e zero no FIM são doenças opostas
    // (§7): ninguém chega × chegam e não fecham. Um fallback só para os dois mandava o trabalho
    // errado — a `atma` lia "trava em D1 — Descoberta" com 525 cliques e 33.881 impressões, e o
    // D1 ainda escolhia os MEDIDORES do N5, apontando meia página para a disciplina errada.
    const naEntrada = marco === ficha.marcos[0];
    return {
      familia: marco?.familiaDoBuraco ?? (naEntrada ? "D1" : "D3"),
      motivo: `célula \`${veredito.celula}\` está em 0`,
    };
  }
  if (veredito.posicao === 2) {
    const buraco = ficha.marcos.find((m) => m.nome === veredito.celula || m.chave === veredito.celula);
    return { familia: buraco?.familiaDoBuraco ?? "D4", motivo: `\`${veredito.celula}\` não apurado` };
  }
  // posição 3 — cadeia fechada: a família do degrau de MENOR taxa.
  const comTaxa = ficha.taxas.filter((t) => ehApurado(t.celula));
  if (!comTaxa.length) return { familia: null, motivo: "sem taxa apurada para escolher família" };
  const menor = comTaxa.reduce((a, b) => (b.celula.valor < a.celula.valor ? b : a), comTaxa[0]);
  const marcoDoDegrau = ficha.marcos.find((m) => m.nome === menor.para);
  return {
    familia: marcoDoDegrau?.familiaDoBuraco ?? marcoDoDegrau?.familia ?? "D1",
    motivo: `menor taxa da cadeia: ${menor.de} → ${menor.para} (${pct(menor.celula.valor)})`,
  };
}

/**
 * Páginas que NÃO são visitante: painel interno e login. Sem este corte o N5 mede a EQUIPE — em
 * 03/09/2026 a `atma` tinha 629 `scroll` na janela e 327 deles (52%) em `/admin/pacientes/lista`,
 * gente da casa trabalhando no painel. Um medidor de persuasão alimentado por tráfego interno não
 * é um número ruim, é um número de outra coisa.
 */
export const PAGINA_INTERNA = /^\/(admin|login)(\/|$|\?)/;

/** @param {{evento:string, pagina:string, link:string, contagem:number}[]} linhas @param {string} evento */
const somar = (linhas, evento, filtro = () => true) =>
  linhas.filter((l) => l.evento === evento && !PAGINA_INTERNA.test(l.pagina) && filtro(l)).reduce((t, l) => t + l.contagem, 0);

/**
 * Os medidores D3 do N5 lidos do GA4 (014) — R4 pura: nenhum evento novo no site, só o enhanced
 * measurement que já cai. Devolve o mapa que entra em `disponiveisN5`, com a `fonte` colada em
 * cada célula porque o NOME do medidor promete mais do que o evento entrega:
 *
 * - `scroll` do GA4 é 90% da PÁGINA, não a seção de oferta;
 * - `click` do GA4 é clique em link EXTERNO, e clique em Instagram não é CTA de venda — por isso a
 *   fonte sai com a quebra por destino colada, como a R2 exige a fração colada no percentual;
 * - `abandono-por-campo` precisa do PAR `form_start`/`form_submit`. Com submit em zero o abandono
 *   não é derivável, e isso é `não apurado` com motivo — nunca 100% de abandono, que teria cara
 *   de apurado e mandaria mexer em copy quando o defeito é o site não emitir o evento.
 *
 * @param {import("./ga4.js").EventosGa4} ga4ev
 * @returns {Record<string, {valor:number, fonte?:string}|{naoApurado:string}>}
 */
export function medidoresDeEventos(ga4ev) {
  if (!ga4ev) return {};
  if ("erro" in ga4ev) {
    const fora = { naoApurado: `GA4 indisponível (${ga4ev.erro})`, fonte: "GA4 Data API da propriedade declarada no card" };
    return { "scroll-ate-oferta": fora, "cliques-cta": fora, "abandono-por-campo": fora, "saida-checkout": fora };
  }
  const { linhas } = ga4ev;
  const scroll = somar(linhas, "scroll");
  const cliques = linhas.filter((l) => l.evento === "click" && !PAGINA_INTERNA.test(l.pagina));
  const totalCliques = cliques.reduce((t, l) => t + l.contagem, 0);
  const porDestino = new Map();
  for (const l of cliques) {
    const host = /^https?:\/\/([^/]+)/.exec(l.link)?.[1]?.replace(/^www\./, "") ?? (l.link || "destino não informado");
    porDestino.set(host, (porDestino.get(host) ?? 0) + l.contagem);
  }
  const quebra = [...porDestino.entries()].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} ${n}`).join(" · ");
  const inicios = somar(linhas, "form_start");
  const envios = somar(linhas, "form_submit");
  const checkout = somar(linhas, "begin_checkout");

  return {
    "scroll-ate-oferta": {
      valor: scroll,
      fonte: "evento `scroll` do GA4 (enhanced measurement = 90% da PÁGINA, não a seção de oferta), fora de /admin e /login",
    },
    "cliques-cta": {
      valor: totalCliques,
      fonte: `evento \`click\` do GA4 = clique em link EXTERNO, fora de /admin e /login${quebra ? ` — ${quebra}` : ""}`,
    },
    "abandono-por-campo": envios
      ? { valor: inicios - envios, fonte: `\`form_start\` ${inicios} − \`form_submit\` ${envios} do GA4, fora de /admin e /login` }
      : {
          naoApurado: `GA4 lido na janela: \`form_start\` ${inicios} e \`form_submit\` ZERO — sem o par não há abandono, e o zero é o site não emitir o evento, não o formulário ser perfeito`,
          fonte: "o site do projeto: fazer o formulário emitir `form_submit` (ou um evento de conversão próprio) — é encanamento, não copy",
        },
    "saida-checkout": checkout
      ? { valor: checkout, fonte: "evento `begin_checkout` do GA4, fora de /admin e /login" }
      : {
          naoApurado: "GA4 lido na janela e a propriedade não registrou nenhum `begin_checkout` — projeto sem checkout, ou checkout sem evento",
          fonte: "o site do projeto: confirmar se existe checkout e se ele emite `begin_checkout`",
        },
  };
}

/**
 * @param {string|null} familia @param {Record<string, {valor:number, fonte?:string}|{naoApurado:string}>} disponiveis
 */
export function montarN5(familia, disponiveis) {
  if (!familia) return [];
  return MEDIDORES[familia].map((id) => {
    // FR-029: sem corte por país a média mistura branded com genérico — sai não apurado mesmo
    // existindo na API.
    if (id === "posicao-media-com-corte-pais") {
      return { id, nome: id, familia, celula: naoApurada("sem corte por país — mistura branded com genérico", "Search Console, com filtro de país aplicado manualmente", id) };
    }
    const celula = disponiveis?.[id];
    // A `fonte` vem da célula quando ela traz uma: o medidor do GA4 promete mais do que o evento
    // entrega, e "coleta desta requisição" apagaria justamente o aviso que impede a leitura errada.
    if (celula) return { id, nome: id, familia, celula: estadoDeApurado(celula, celula.fonte ?? "coleta desta requisição", id) };
    return { id, nome: id, familia, celula: naoApurada("sem coletor nesta requisição", `apuração manual de ${id}`, id) };
  });
}

// ── N0 — objetivo e KRs (FR-013 a FR-018) ───────────────────────────────────

/**
 * Confere cada KR contra a árvore, na ordem da FR-017 — sem casamento por aproximação em ponto
 * nenhum.
 * @param {{kpi:string, baseline:number|null, meta:number, prazo:string, dono?:string, celula:string}[]} krs
 * @param {{"n3:"?: Record<string, CelulaFicha>, "n4:"?: Record<string, CelulaFicha>, "n5:"?: Record<string, CelulaFicha>}} espacos
 */
export function validarKrs(krs, espacos) {
  return (krs ?? []).map((kr, indice) => {
    const m = /^(n3|n4|n5):(.+)$/.exec(kr.celula ?? "");
    if (!m) {
      return { kr, marca: "chave-invalida", celulaAlvo: null, texto: `célula \`${kr.celula}\` sem prefixo n3:/n4:/n5:` };
    }
    const [, nivelChave, chave] = m;
    const espaco = espacos[`${nivelChave}:`] ?? {};
    if (!(chave in espaco)) {
      return { kr, marca: "chave-invalida", celulaAlvo: null, texto: `\`${chave}\` não existe no espaço de ${nivelChave}: — proibido casar por aproximação ou procurar em outro nível` };
    }
    const celulaAlvo = espaco[chave];
    if (celulaAlvo.estado === "nao-apurado") {
      return { kr, marca: "nao-verificavel", celulaAlvo, texto: "sem baseline apurado — o trabalho é apurar a célula, não perseguir o número" };
    }
    if (!kr.dono) {
      return { kr, marca: "sem-dono", celulaAlvo, texto: "sem dono — sem dono não é KR, é observação" };
    }
    if (indice >= 3) {
      return { kr, marca: "excedente", celulaAlvo, texto: "KR excedente — acima de 3, exibido, nunca truncado" };
    }
    return { kr, marca: null, celulaAlvo, texto: "" };
  });
}

// ── O ponto de entrada ───────────────────────────────────────────────────────

/**
 * Sempre 7 níveis N0-N6, na ordem, cada um com ao menos uma célula (FR-008). Nível sem entrada
 * vira um nível com uma célula `não apurado` explicando — nunca some.
 *
 * @param {{
 *   slug: string, ficha: object, projecao: object, veredito: object,
 *   declarada: {declaradaEm?:string, objetivo?:string, krs?:object[]}|null,
 *   meta: {valor?:number, ticket?:number, prazo?:string, declaradaEm?:string}|null,
 *   itensAgenda: object[]|null, erroAgenda: string|null, datasDono: Map<string,string>,
 *   disponiveisN5: Record<string, {valor:number}|{naoApurado:string}>,
 *   janela: {inicio:string, fim:string},
 *   ga4: import("./ga4.js").LeituraGa4,
 *   orcamentosSemLead: {valor:number}|null,
 * }} entrada
 */
export function montarNiveis(entrada) {
  const { ficha, veredito, declarada: dec, meta, itensAgenda, erroAgenda, datasDono, disponiveisN5, ga4, janela, orcamentosSemLead } = entrada;
  const semPerfil = !ficha?.perfil;

  let n1, n2, n3, n4, espacosKr;
  let n5 = nivel("N5", semEntrada("sem perfil declarado", "campo `perfil` do card"));
  if (semPerfil) {
    n1 = nivel("N1", semEntrada("sem perfil declarado", "campo `perfil` do card"));
    n2 = nivel("N2", semEntrada("sem perfil declarado", "campo `perfil` do card"));
    n3 = { ...nivel("N3", semEntrada("sem perfil declarado", "campo `perfil` do card")), funil: [] };
    n4 = nivel("N4", semEntrada("sem perfil declarado — não há cadeia para dizer quem tem elo", "campo `perfil` do card"));
    espacosKr = null;
  } else {
    const canais = montarN4(
      CANAIS,
      marcoVisitante(ficha)?.celula ?? { naoApurado: "sem marco `visitante` no perfil" },
      ficha.marcos,
      ga4,
      janela,
    );
    const { familia, motivo: motivoFamilia } = escolherFamilia(veredito, ficha);
    const medidores = montarN5(familia, disponiveisN5 ?? {});

    n1 = nivel("N1", montarN1(ficha, meta));
    n2 = nivel("N2", montarN2(ficha, meta));
    const celulasN3 = montarN3(ficha);
    n3 = { ...nivel("N3", celulasN3), funil: segmentosDoFunil(ficha, celulasN3) };
    const resolvidoGa4 = resolverGa4(ga4, janela);
    const extrasN4 = {
      foraDoCatalogo: resolvidoGa4.mapa?.foraDoCatalogo ?? [],
      propriedade: resolvidoGa4.propriedade,
      organicoIgnorado: resolvidoGa4.mapa?.organicoIgnorado ?? 0,
      // `valor > 0` e não só `!= null`: a célula 10 do data-model existe "só quando o vestígio
      // existe", e vestígio de zero não é vestígio — uma linha "0 inferido" faria parecer que
      // ninguém chegou fora do formulário, quando o certo é a janela não ter alcançado ninguém.
      // Diferente dos CANAIS, onde `0` apurado é exigido (FR-004) porque a fonte foi consultada.
      inferencias: orcamentosSemLead?.valor > 0
        ? [
            {
              rotulo: "contato fora do formulário",
              valor: orcamentosSemLead.valor,
              de: "orçamento sem lead vinculado",
              divida: "instrumentar a origem do contato no site do projeto tornaria este número apurado — fora do escopo desta feature (FR-011b)",
            },
          ]
        : [],
    };
    const { celulas: n4Celulas, nota: n4Nota } = montarN4Nivel(canais, extrasN4);
    n4 = nivel("N4", n4Celulas, n4Nota);
    n5 = { id: "N5", ...TITULOS_NIVEL.N5, celulas: medidores.map((m) => m.celula), familia, motivoFamilia };
    espacosKr = {
      "n3:": Object.fromEntries(ficha.marcos.map((m) => [m.chave, estadoDeApurado(m.celula, m.fonte, m.nome)])),
      "n4:": Object.fromEntries(canais.map((c) => [c.id, c.celula])),
      "n5:": Object.fromEntries(medidores.map((m) => [m.id, m.celula])),
    };
  }

  // N0 — não depende da cadeia, mas a validação de KR sim (data-model §3, §8).
  const n0 = montarN0(dec, ficha, espacosKr);

  // N6 — não depende da cadeia (data-model §3, §7).
  const { celulas: n6Celulas, itens: n6Itens } = montarN6(itensAgenda, erroAgenda, datasDono);
  const n6 = { id: "N6", ...TITULOS_NIVEL.N6, celulas: n6Celulas, itens: n6Itens };

  return ORDEM_NIVEIS.map((id) => ({ N0: n0, N1: n1, N2: n2, N3: n3, N4: n4, N5: n5, N6: n6 })[id]);
}

const marcoVisitante = (ficha) => ficha.marcos.find((m) => m.chave === "visitante");

function montarN0(dec, ficha, espacosKr) {
  if (!dec) {
    return nivel("N0", semEntrada("sem declaração no card", "campo `ficha` em data/projects.json"));
  }
  const objetivo = declarada(dec.objetivo ?? "sem objetivo escrito", { em: dec.declaradaEm, oQue: "ficha.objetivo", rotulo: "objetivo" });
  if (!espacosKr) {
    // Projeto que perdeu o perfil: objetivo e KRs continuam exibidos como declarados, a
    // validação sai `não apurado: sem cadeia para validar a célula` (data-model §8).
    const krs = (dec.krs ?? []).map((kr) => ({
      kr,
      marca: null,
      celulaAlvo: null,
      texto: "não apurado: sem cadeia para validar a célula",
    }));
    return { id: "N0", ...TITULOS_NIVEL.N0, celulas: [objetivo], krs };
  }
  const validados = validarKrs(dec.krs, espacosKr);
  return { id: "N0", ...TITULOS_NIVEL.N0, celulas: [objetivo], krs: validados };
}

function montarN1(ficha, meta) {
  const ultimo = ficha.marcos[ficha.marcos.length - 1];
  if (!ultimo) return semEntrada("sem marcos na cadeia do perfil", "campo `perfil` do card");
  const contagem = estadoDeApurado(ultimo.celula, ultimo.fonte, ficha.n1);
  if (meta?.ticket == null) {
    return [contagem, naoApurada("sem ticket declarado", "campo `meta.ticket` do card", `${ficha.n1} em R$`)];
  }
  const valorReais = combinar(
    [contagem, declarada(meta.ticket, { em: meta.declaradaEm, oQue: "meta.ticket", rotulo: "ticket" })],
    ([qtd, ticket]) => qtd * ticket,
    { rotulo: `${ficha.n1} em R$` },
  );
  return [contagem, valorReais];
}

function montarN2(ficha, meta) {
  const def = PERFIS[ficha.perfil];
  if (!def?.fatores) {
    return semEntrada("fatores do perfil ainda não declarados", "PERFIS[perfil].fatores em lib/okr.mjs");
  }
  const { fatores, veredito, erroDeDefinicao } = avaliarN2(def.fatores, ficha.marcos, ficha.taxas, {
    ticket: meta?.ticket,
    ticketDeclaradoEm: meta?.declaradaEm,
  });
  const celulas = [...fatores, veredito];
  return erroDeDefinicao
    ? [...celulas, naoApurada(erroDeDefinicao, "PERFIS[perfil].fatores em lib/okr.mjs", "erro de definição do perfil")]
    : celulas;
}

function montarN3(ficha) {
  if (!ficha.marcos.length) return semEntrada("sem marcos na cadeia do perfil", "campo `perfil` do card");
  return ficha.taxas.map((t) => {
    const rotulo = `${t.de} → ${t.para}`;
    if (!ehApurado(t.celula)) {
      // `razao()` checa o denominador primeiro — mesma ordem aqui, para "consultar" apontar para
      // o lado que o motivo realmente nomeia, nunca para o rótulo da seta (o próprio rótulo da
      // linha, que a UI já mostra em negrito — repeti-lo como "fonte" não informa nada).
      const consultar = !ehApurado(t.denominador)
        ? t.fonteDenominador
        : !ehApurado(t.numerador)
          ? t.fonteNumerador
          : `${t.fonteDenominador} e ${t.fonteNumerador}`;
      return naoApurada(t.celula.naoApurado, consultar, rotulo);
    }
    // R2 — fração SEMPRE colada no percentual: `6,67%` sozinho cai na faixa de elite dos
    // benchmarks quando são 2 leads em 30 cliques.
    const n = t.numerador.valor;
    const d = t.denominador.valor;
    return { estado: "apurado", valor: `${pct(t.celula.valor)} (${n}/${d})`, rotulo, fonte: rotulo };
  });
}

/** Piso de altura de um segmento apurado (~1,5 de 44), para uma taxa pequena e real (6,67%) não
 *  virar linha invisível. Nunca se aplica a `valor === 0`: dar corpo mínimo a zero faria "ninguém
 *  passou" e "não sei" se parecerem — a leitura que R1 proíbe. */
const PISO = 1.5 / 44;

/** @param {number} valor @param {number} base */
function altura(valor, base) {
  if (valor === 0) return 0;
  if (base <= 0) return 0;
  return Math.max(PISO, valor / base);
}

/**
 * Os segmentos do funil de N3, um por célula de N3, na mesma ordem.
 *
 * O ESTADO vem da célula (a mesma que vira linha de texto); a GEOMETRIA vem dos marcos. São
 * coisas diferentes e só uma delas poderia divergir do texto — por isso o estado é copiado,
 * nunca recalculado a partir de `ficha.taxas`.
 *
 * @param {ReturnType<typeof import("./okr.mjs").montarFicha>} ficha
 * @param {{estado:string}[]} celulasN3 o retorno de montarN3(ficha)
 * @returns {Segmento[]}
 */
export function segmentosDoFunil(ficha, celulasN3) {
  if (ficha.taxas.length !== celulasN3.length) return [];
  // O maior marco APURADO da cadeia. `Math.max()` de conjunto vazio é `-Infinity` — a guarda
  // `base <= 0` de `altura()` absorve isso de propósito (C8), o mesmo caminho que cobre uma
  // cadeia inteira apurada em zero (C6).
  const base = Math.max(...ficha.marcos.filter((m) => ehApurado(m.celula)).map((m) => m.celula.valor));
  return ficha.taxas.map((t, i) => {
    if (celulasN3[i].estado !== "apurado") return { estado: "nao-apurado" };
    return { estado: "apurado", entrada: altura(t.denominador.valor, base), saida: altura(t.numerador.valor, base) };
  });
}

const NOTA_N4 =
  "O total composto soma cliques em resultado de busca (Search Console) com sessões no site " +
  "(GA4). Ele não é o `visitante` da cadeia — este continua sendo só o orgânico, e é ele que " +
  "serve de denominador a toda taxa do N3. Sessões orgânicas do GA4 não entram: o orgânico vem " +
  "do Search Console.";

/** Célula 7 do data-model §4: só existe com volume, nomeia os grupos e não entra no total. */
function celulaForaDoCatalogo(extras) {
  const grupos = extras?.foraDoCatalogo ?? [];
  if (!grupos.length) return null;
  const valor = grupos.reduce((acc, g) => acc + (Number(g?.sessoes) || 0), 0);
  const lista = grupos.map((g) => `${g.grupo} ${g.sessoes}`).join(" · ");
  return { estado: "apurado", valor, rotulo: `fora do catálogo (${lista})`, fonte: `GA4 · ${extras.propriedade}` };
}

/** Célula 8: soma só os canais com `estado === "apurado"` — `combinar()` cru devolveria
 *  `não apurado` para sempre, porque `outbound` nunca terá fonte (D7). Rótulo declara a
 *  cobertura, nunca o nome de uma grandeza só (FR-005b). */
function totalComposto(canais) {
  const apurados = canais.filter((c) => c.celula.estado === "apurado");
  if (!apurados.length) {
    return naoApurada("nenhum canal apurado nesta janela", "os coletores de cada canal", "total composto");
  }
  const valor = apurados.reduce((acc, c) => acc + c.celula.valor, 0);
  const fonte = [...new Set(apurados.map((c) => c.celula.fonte))].join(" · ");
  const outros = apurados.filter((c) => c.id !== "organico").length;
  const temOrganico = apurados.some((c) => c.id === "organico");
  const cobertura = temOrganico ? (outros > 0 ? `orgânico + ${outros} canais` : "orgânico") : `${outros} canais`;
  return { estado: "apurado", valor, rotulo: `total composto (${cobertura})`, fonte };
}

/** Célula 9: `não apurado` enquanto houver canal sem fonte (FR-012) — `outbound` nunca tem, então
 *  na prática esta célula é sempre `não apurado` hoje, e é o comportamento correto. */
function celulaDiferenca(canais, totalCel) {
  const semFonte = canais.filter((c) => c.celula.estado === "nao-apurado");
  if (semFonte.length) {
    return naoApurada(
      `canais sem fonte: ${semFonte.map((c) => c.nome).join(", ")}`,
      "apuração manual dos canais sem fonte",
      "diferença",
    );
  }
  const organico = canais.find((c) => c.id === "organico");
  return { estado: "apurado", valor: totalCel.valor - organico.celula.valor, rotulo: "diferença", fonte: `${totalCel.fonte} − Search Console` };
}

/**
 * @param {ReturnType<typeof montarN4>} canais
 * @param {{foraDoCatalogo?: {grupo:string, sessoes:number}[], propriedade?:string, organicoIgnorado?:number, inferencias?: {rotulo:string, valor:number, de:string, divida:string}[]}} [extras]
 * @returns {{celulas: CelulaFicha[], nota: string}}
 */
export function montarN4Nivel(canais, extras = {}) {
  const foraCel = celulaForaDoCatalogo(extras);
  const totalCel = totalComposto(canais);
  const diferencaCel = celulaDiferenca(canais, totalCel);
  const inferencias = (extras.inferencias ?? []).map((i) => inferida(i.valor, { de: i.de, divida: i.divida, rotulo: i.rotulo }));
  const nota = extras.organicoIgnorado > 0 ? `${NOTA_N4} Sessões orgânicas do GA4 ignoradas: ${extras.organicoIgnorado}.` : NOTA_N4;
  return {
    celulas: [...canais.map((c) => c.celula), ...(foraCel ? [foraCel] : []), totalCel, diferencaCel, ...inferencias],
    nota,
  };
}

function montarN6(itensAgenda, erroAgenda, datasDono) {
  if (itensAgenda == null) {
    return { celulas: [naoApurada(`banco indisponível (${erroAgenda ?? "erro desconhecido"})`, "lib/db.ts listDonoDatas()/listDonos()", "N6")], itens: [] };
  }
  if (itensAgenda.length === 0) {
    return { celulas: [naoApurada("sem ação declarada para este projeto", "data/projects.json campo `acao`", "N6")], itens: [] };
  }
  const itens = itensAgenda.map((item) => {
    const dataDono = datasDono?.get(item.key);
    const data = item.responsavel
      ? declarada(dataDono ?? "", { em: dataDono, oQue: "hub_acao_dono.atualizado", rotulo: "dono definido em" })
      : naoApurada("a acao do card não é datada", "hub_acao_dono", "data");
    return {
      key: item.key,
      titulo: item.titulo,
      // `#N · score` — o mesmo rótulo de ranking da /agenda (SC-018), para a conferência lado a
      // lado do quickstart §4/T036. Não é a ORDEM (já apagou ranking da tela antes de virar
      // rótulo explícito) — só o texto que `acoesDoRanking()` já monta.
      meta: item.meta ?? null,
      dono: item.responsavel ?? null,
      data,
      // FR-031: inferir do texto é proibido, nem por palavra nem por parecença — constante.
      celulaQueMove: "nao-declarada",
      // Campo curado (`descontinuado` em data/projects.json), não inferência do título — mesma
      // regra do FR-031 acima.
      descontinuado: !!item.descontinuado,
    };
  });
  return { celulas: [], itens };
}
