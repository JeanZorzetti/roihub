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
 * @typedef {CelulaApurada|CelulaDeclarada|CelulaNaoApurada} CelulaFicha
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

// ── N4 — volume por canal (FR-023 a FR-025) ─────────────────────────────────

/**
 * @param {string[]} canais @param {{valor:number}|{naoApurado:string}} cliquesCelula
 * @param {{chave:string, celula:{valor:number}|{naoApurado:string}}[]} marcos
 */
export function montarN4(canais, cliquesCelula, marcos) {
  // sem elo: o canal é DENOMINADOR de alguma taxa de N3 quando o primeiro marco é o topo da
  // cadeia (visitante nos perfis A/B/D) — no perfil C a cadeia começa em `contato`, e `organico`
  // fica sem elo (data-model §5).
  const primeiroMarco = marcos[0]?.chave;
  return canais.map((id) => {
    if (id === "organico") {
      return {
        id,
        nome: "orgânico",
        celula: estadoDeApurado(cliquesCelula, "Search Console", "orgânico"),
        semElo: primeiroMarco !== "visitante",
      };
    }
    return {
      id,
      nome: id,
      celula: naoApurada("sem coletor para este canal", `apuração manual de ${id}`, id),
      semElo: true,
    };
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
    return { familia: marco?.familiaDoBuraco ?? "D1", motivo: `célula \`${veredito.celula}\` está em 0` };
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
 * @param {string|null} familia @param {Record<string, {valor:number}|{naoApurado:string}>} disponiveis
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
    if (celula) return { id, nome: id, familia, celula: estadoDeApurado(celula, "coleta desta requisição", id) };
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
 * }} entrada
 */
export function montarNiveis(entrada) {
  const { ficha, veredito, declarada: dec, meta, itensAgenda, erroAgenda, datasDono, disponiveisN5 } = entrada;
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
    const canais = montarN4(CANAIS, marcoVisitante(ficha)?.celula ?? { naoApurado: "sem marco `visitante` no perfil" }, ficha.marcos);
    const { familia, motivo: motivoFamilia } = escolherFamilia(veredito, ficha);
    const medidores = montarN5(familia, disponiveisN5 ?? {});

    n1 = nivel("N1", montarN1(ficha, meta));
    n2 = nivel("N2", montarN2(ficha, meta));
    const celulasN3 = montarN3(ficha);
    n3 = { ...nivel("N3", celulasN3), funil: segmentosDoFunil(ficha, celulasN3) };
    n4 = nivel("N4", montarN4Nivel(canais));
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

/** @param {ReturnType<typeof montarN4>} canais */
function montarN4Nivel(canais) {
  // Só `organico` tem coletor; os outros cinco são sempre `não apurado` por desenho (D8). Sem
  // total, sem soma (FR-024) — a diferença nunca é atribuída a "direto".
  const diferenca = naoApurada(
    "canais sem coletor — diferença entre soma medida e entrada da cadeia não apurada",
    "apuração manual dos cinco canais sem coletor",
    "diferença",
  );
  return [...canais.map((c) => c.celula), diferenca];
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
