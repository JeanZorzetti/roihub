// Core Web Vitals de CAMPO (spec 023) — módulo PURO: sem `fetch`, sem `process.env`, sem relógio,
// sem `pg` (Princípio III). Recebe a leitura já resolvida por `lib/crux.ts` e devolve células
// prontas para `disponiveisN5`. É o que torna a distinção 404/falha, a formatação de cada unidade,
// as bordas de veredito e o Pass Rate de amostra 1 testáveis sem gastar uma chamada à fonte.

/**
 * @typedef {{id:string, chaveCrux:string, limite:number, ideal:number|null, unidade:"s"|"ms"|null}} Vital
 * @typedef {{inicio:string, fim:string}} Janela
 * @typedef {{vital:Vital, p75:number, janela:Janela|null, dispositivo:"todos", experimental:boolean, veredito:"dentro"|"fora"}} Medida
 * @typedef {{tipo:"origem"|"url", valor:string}} Alvo
 * @typedef {{estado:"record", record:object}|{estado:"sem-amostra"}|{estado:"falhou", erro:string}|{estado:"sem-chave"}} LeituraDaFonte
 * @typedef {{valor:string, fonte:string}|{naoApurado:string, fonte:string, rotuloBuraco?:"falhou-agora"}} CelulaDeVital
 */

/** O catálogo dos quatro (data-model §1). Único ponto onde a chave da fonte, a chave da ficha, a
 *  unidade e o limite do board se encontram — três listas separadas divergiriam na primeira
 *  mudança. `limite` na unidade CRUA da fonte; `unidade: null` no CLS, e é daí que a FR-013 sai
 *  por construção, não de um `if (id === "cls")` espalhado pela formatação.
 *  @type {readonly Vital[]} */
export const VITAIS = [
  { id: "lcp", chaveCrux: "largest_contentful_paint", limite: 2500, ideal: null, unidade: "s" },
  { id: "inp", chaveCrux: "interaction_to_next_paint", limite: 200, ideal: null, unidade: "ms" },
  { id: "cls", chaveCrux: "cumulative_layout_shift", limite: 0.1, ideal: null, unidade: null },
  { id: "ttfb", chaveCrux: "experimental_time_to_first_byte", limite: 600, ideal: 300, unidade: "ms" },
];

/** FR-014 — o escopo. Projeto fora da lista não gasta chamada e mantém o "sem coletor nesta
 *  requisição" que a ficha já exibe hoje. */
export const SLUGS_DE_CAMPO = ["atma"];

/** Teto de URLs perguntadas à fonte no Pass Rate. A 021 mediu 8 URLs com impressão em 28 dias na
 *  Atma — hoje o cap não corta nada; ele existe para o dia em que o site crescer. Subir só depois
 *  de medir a quota real da chave. Exportado para o teste medir o corte sem chamar a rede. */
export const CAP_URLS_PASS_RATE = 10;

/** Os três que definem "Bom" no board. O TTFB é experimental na fonte e não entra (data-model §7). */
const VITAIS_DO_PASS_RATE = VITAIS.filter((v) => !v.chaveCrux.startsWith("experimental_"));

/** `p75` chega número ou string (o CLS costuma vir `"0.08"`). Não-finito devolve `null` — nunca
 *  `NaN` adiante. */
function numero(v) {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * A CrUX manda `{year, month, day}` com `month` **1-based**. Função separada e testada de
 * propósito: misturar essa base com a do `Date` do JS produz erro de um mês que ninguém percebe
 * olhando a tela. Campo ausente ou não finito devolve `null`, e a janela some do rodapé em vez de
 * virar `"NaN-NaN-NaN"`.
 * @param {{year:number, month:number, day:number}} d @returns {string|null} `YYYY-MM-DD`
 */
export function dataCrux(d) {
  const y = numero(d?.year);
  const m = numero(d?.month);
  const dia = numero(d?.day);
  if (y === null || m === null || dia === null) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** A janela É da fonte, não nossa (FR-005). Faltando uma das pontas não há janela — meia janela
 *  rotulada como janela é a mesma mentira que a FR-027 da 019 proíbe. */
function janelaDe(periodo) {
  const inicio = dataCrux(periodo?.firstDate);
  const fim = dataCrux(periodo?.lastDate);
  return inicio && fim ? { inicio, fim } : null;
}

/**
 * Extrai do record as `Medida` que ele contém — **só as que contém**.
 *
 * Invariante que carrega a FR-004: nenhuma `Medida` existe sem `p75` finito, então não há caminho
 * no código que produza veredito sobre uma ausência. A garantia é do tipo, não da disciplina de
 * quem escreve a tela.
 * @param {object} record @returns {Map<string, Medida>} chaveado por `chaveCrux`
 */
export function medirRecord(record) {
  const janela = janelaDe(record?.collectionPeriod);
  const mapa = new Map();
  for (const vital of VITAIS) {
    const p75 = numero(record?.metrics?.[vital.chaveCrux]?.percentiles?.p75);
    if (p75 === null) continue;
    mapa.set(vital.chaveCrux, {
      vital,
      p75,
      janela,
      dispositivo: "todos",
      // D5: derivado do prefixo, nunca de uma lista fixa — a rotulagem para sozinha no dia em que
      // o Google promover a métrica.
      experimental: vital.chaveCrux.startsWith("experimental_"),
      // Limite INCLUSIVO, porque o board diz "≤" (FR-006).
      veredito: p75 <= vital.limite ? "dentro" : "fora",
    });
  }
  return mapa;
}

/**
 * @param {Vital} vital @param {number} p75 @returns {string}
 */
export function formatarValor(vital, p75) {
  if (vital.unidade === "s") return `${(p75 / 1000).toFixed(1).replace(".", ",")} s`;
  if (vital.unidade === "ms") return `${Math.round(p75)} ms`;
  return p75.toFixed(2).replace(".", ",");
}

/** O alvo aparece no texto de TODA célula: é ele que impede a leitura errada dos Edge Cases —
 *  exibir a distribuição do site inteiro no lugar da de uma página. */
const descreverAlvo = (alvo) => `${alvo.tipo === "origem" ? "origem" : "URL"} ${alvo.valor}`;

/** `meta ≤ 2,5 s` — e no TTFB o ideal entra AO LADO do limite, nunca no lugar (FR-007). */
function meta(vital) {
  const limite = `meta ≤ ${formatarValor(vital, vital.limite)}`;
  return vital.ideal === null ? limite : `${limite} (ideal < ${formatarValor(vital, vital.ideal)})`;
}

/**
 * O rodapé que a ficha imprime entre parênteses. Sempre a mesma ordem, sempre os mesmos fatos
 * (FR-005, FR-006, FR-007, FR-008, FR-010). Janela ausente OMITE o trecho — nunca datas inventadas.
 * @param {Medida} medida @param {Alvo} alvo @returns {string}
 */
export function rodape(medida, alvo) {
  const partes = ["p75 de campo", descreverAlvo(alvo)];
  if (medida.janela) partes.push(`CrUX ${medida.janela.inicio}→${medida.janela.fim}`);
  partes.push(`${medida.dispositivo} os dispositivos`);
  partes.push(`${meta(medida.vital)}: ${medida.veredito}`);
  if (medida.experimental) partes.push("experimental na fonte");
  return partes.join(" · ");
}

/**
 * Sempre devolve as quatro chaves — é a função inteira da FR-003. Os quatro estados da fonte
 * produzem quatro textos DIFERENTES, e só a falha ganha `rotuloBuraco`: ausência de observação não
 * é falha, e chave não configurada não se conserta esperando.
 *
 * `fonte` está nos DOIS ramos e não é simetria decorativa: `montarN5()` repassa
 * `celula.fonte ?? "coleta desta requisição"` como o `consultar` da célula não apurada, e sem ela
 * a célula `CRUX_API_KEY ausente` sairia mandando consultar a coleta desta requisição — a
 * instrução errada, e a R4 cumprida só na forma.
 * @param {LeituraDaFonte} leitura @param {Alvo} alvo @returns {Record<string, CelulaDeVital>}
 */
export function celulasDeVitais(leitura, alvo) {
  const fonte = `CrUX API para ${descreverAlvo(alvo)}`;
  const ausente = (naoApurado, rotuloBuraco) => ({ naoApurado, fonte, ...(rotuloBuraco ? { rotuloBuraco } : {}) });
  const todas = (celula) => Object.fromEntries(VITAIS.map((v) => [v.id, celula]));

  if (leitura?.estado === "sem-chave") return todas(ausente("CRUX_API_KEY ausente"));
  if (leitura?.estado === "sem-amostra") return todas(ausente(`sem amostra suficiente na fonte de campo para ${descreverAlvo(alvo)}`));
  if (leitura?.estado !== "record") {
    const erro = leitura?.erro ?? "leitura de campo indisponível";
    return todas(ausente(`CrUX indisponível (${erro})`, "falhou-agora"));
  }
  const medidas = medirRecord(leitura.record);
  return Object.fromEntries(
    VITAIS.map((v) => {
      const m = medidas.get(v.chaveCrux);
      return [
        v.id,
        m
          ? { valor: formatarValor(v, m.p75), fonte: rodape(m, alvo) }
          : ausente(`sem amostra suficiente na fonte para ${v.id}`),
      ];
    }),
  );
}

/**
 * FR-009 — a fração das URLs com "Bom" nos três vitais, ou o motivo honesto de não haver uma.
 *
 * `comDado < 2` devolve `motivo` e `fracao: null`: uma URL com dado nunca vira `100%`, que é o
 * "100% de amostra de um" que a spec proíbe nominalmente. Invariante: exatamente um de
 * `fracao`/`motivo` é não-nulo — a tela fica incapaz de exibir fração sem denominador ou silêncio
 * sem explicação.
 * @param {Map<string, LeituraDaFonte>} leiturasPorUrl @param {number} consultadas
 */
export function passRate(leiturasPorUrl, consultadas) {
  let comDado = 0;
  let passam = 0;
  let parciais = 0;
  let falharam = 0;
  for (const leitura of leiturasPorUrl.values()) {
    if (leitura?.estado === "falhou") {
      falharam += 1;
      continue;
    }
    if (leitura?.estado !== "record") continue;
    const medidas = medirRecord(leitura.record);
    const tres = VITAIS_DO_PASS_RATE.map((v) => medidas.get(v.chaveCrux));
    // MEDIDO em 07/09/2026 na atma: a URL do blog responde 200 com LCP e CLS e SEM INP — a fonte
    // mede cada vital separadamente. Contar isso como "sem dado de campo" colapsaria "não
    // respondeu" com "respondeu parcial", que é a mesma confusão que a FR-003 proíbe nas células.
    if (tres.some((m) => !m)) {
      parciais += 1;
      continue;
    }
    comDado += 1;
    if (tres.every((m) => m.veredito === "dentro")) passam += 1;
  }
  if (comDado < 2) {
    const plural = (n) => (n === 1 ? "tem" : "têm");
    return {
      consultadas,
      comDado,
      passam,
      parciais,
      falharam,
      fracao: null,
      // O motivo nomeia os números que EXISTEM, não só a ausência (SC-006): quem lê precisa
      // entender que é característica do tráfego do site, não defeito do hub.
      motivo:
        `Pass Rate por URL não é apurável: das ${consultadas} URLs consultadas, ${comDado} ${plural(comDado)} os três vitais medidos.` +
        (parciais ? ` ${parciais} ${parciais === 1 ? "respondeu" : "responderam"} com dado PARCIAL — a fonte mede cada vital separadamente, e URL com poucas interações não recebe INP.` : "") +
        (falharam ? ` ${falharam} ${falharam === 1 ? "falhou" : "falharam"} agora — isso é falha, não ausência de dado.` : "") +
        " A fração precisa de pelo menos duas URLs com os três — uma amostra de uma nunca é 100%.",
    };
  }
  return { consultadas, comDado, passam, parciais, falharam, fracao: passam / comDado, motivo: null };
}
