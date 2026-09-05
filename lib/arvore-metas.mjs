// A 010 (`lib/projecao.mjs`) divide a meta declarada UMA vez e para, porque `ancoraDe()` corta no
// primeiro `não apurado` de cima para baixo — na `atma` a âncora é `lead` e os quatro degraus
// abaixo ficam fora da conta. Este arquivo desce o resto: mesma divisão, continuada até a
// entrega.
//
// Continua sendo DIVISÃO sobre meta declarada, nunca projeção sobre benchmark. A R6 proíbe
// empilhar faixas de mercado pra frente (`35.294 × 8% × 42,5% × 62,5% × 40%` → "€1,8M", barra de
// erro de 56×). A trava aqui é aritmética e é testada: **no máximo UMA faixa na descida inteira**.
// A segunda para a árvore e devolve o degrau que parou.
//
// Proibido alterar `lib/okr.mjs` e `lib/projecao.mjs` (FR-014): a ficha e a projeção entram
// prontas. Proibido reimplementar célula, razão ou cadeia (FR-013) — `razao()` já recusa `0/0`,
// ponta não apurada e numerador > denominador, e `exigencia()` já é a divisão que pode passar de
// 1 legitimamente.
import { apurado, naoApurado, ehApurado, razao } from "./funil.mjs";
import { faixaDoSpan } from "./benchmark.mjs";

/** @typedef {{valor:number}|{naoApurado:string}} Celula */
/** @typedef {{min:number, max:number}} Banda */

/**
 * Banda degenerada. Toda camada carrega `{min,max}` desde a primeira, e antes da faixa de mercado
 * `min === max` (D4) — assim a trava da FR-004 é uma checagem trivial em vez de um contador
 * paralelo, e a tela não tem dois caminhos de renderização.
 * @param {number} v @returns {Banda}
 */
const ponto = (v) => ({ min: v, max: v });

/**
 * Divide uma banda por uma faixa de taxa. Dividir pela taxa MAIOR dá a exigência MENOR — por isso
 * `min` usa `hi` e `max` usa `lo`. Trocar os dois inverteria a banda e faria a tela prometer o
 * cenário otimista como piso.
 * @param {Banda} banda @param {number} lo @param {number} hi @returns {Banda}
 */
const dividirBanda = (banda, lo, hi) => ({ min: banda.min / hi, max: banda.max / lo });

/** Uma taxa só serve de divisor se for > 0 — `x/0` é `Infinity` com cara de meta (FR-003, D3). */
const divide = (celula) => ehApurado(celula) && celula.valor > 0;

/**
 * O índice do marco apurado mais próximo ACIMA de `i`, pulando o buraco. É o que torna a ponte
 * possível: na `atma`, `lead`(31) e `orcamento`(5) estão os dois apurados com `contatado` sem
 * coletor no meio, e a `/okr` de hoje tem os dois números na tela sem nunca calcular os 16,13%.
 * @param {{celula:Celula}[]} marcos @param {number} i
 */
function apuradoAcima(marcos, i) {
  for (let k = i - 1; k >= 0; k--) if (ehApurado(marcos[k].celula)) return k;
  return -1;
}

/**
 * Escolhe o divisor para chegar em `marcos[i]`, na ordem da FR-002. Devolve também o índice de
 * ORIGEM, porque a ponte e a faixa de span pulam degraus e o laço continua de lá — não de `i-1`.
 *
 * A recusa do zero vale para as TRÊS origens, não só para a apurada: a ponte
 * `orcamento→tratamento` da `atma` É uma taxa apurada e É zero (0/5). Sem esta guarda a árvore
 * dividiria por zero e devolveria `Infinity` formatado como número de meta.
 *
 * @param {{chave:string, nome:string, celula:Celula}[]} marcos
 * @param {number} i @param {string|null|undefined} perfil @param {boolean} bandaAberta
 */
export function divisorDe(marcos, i, perfil, bandaAberta) {
  const alvo = marcos[i];
  const recusas = [];

  // 1 — apurado entre degraus consecutivos.
  const consecutiva = razao(alvo.celula, marcos[i - 1].celula);
  if (divide(consecutiva)) {
    return {
      origem: "apurado",
      de: i - 1,
      lo: consecutiva.valor,
      hi: consecutiva.valor,
      fonte: `${marcos[i - 1].nome} → ${alvo.nome}, apurado na janela`,
      atravessa: [],
    };
  }
  recusas.push(
    ehApurado(consecutiva)
      ? `apurado ${marcos[i - 1].chave}→${alvo.chave} em 0 — não divide`
      : `apurado ${marcos[i - 1].chave}→${alvo.chave}: ${consecutiva.naoApurado}`
  );

  // 2 — ponte sobre o buraco: os dois extremos apurados, o meio não.
  const k = apuradoAcima(marcos, i);
  const atravessa = k >= 0 ? marcos.slice(k + 1, i).map((m) => m.nome) : [];
  if (k >= 0 && k < i - 1) {
    const ponte = razao(alvo.celula, marcos[k].celula);
    if (divide(ponte)) {
      return {
        origem: "ponte",
        de: k,
        lo: ponte.valor,
        hi: ponte.valor,
        // A ponte é medida real; ela só não diz ONDE dentro do trecho a perda acontece. Nomear os
        // degraus atravessados é o que impede ler os 16,13% como taxa de um degrau só (FR-006).
        fonte: `${marcos[k].nome} → ${alvo.nome}, apurado atravessando ${atravessa.join(", ")}`,
        atravessa,
      };
    }
    recusas.push(
      ehApurado(ponte) ? `ponte ${marcos[k].chave}→${alvo.chave} em 0 — não divide` : `ponte ${marcos[k].chave}→${alvo.chave}: ${ponte.naoApurado}`
    );
  }

  // 3 — faixa de mercado. Uma só na descida inteira (FR-004): a segunda é a composição que a R6
  // recusa, e ela PARA a árvore em vez de compor.
  const spans = k >= 0 && k < i - 1 ? [[k, i], [i - 1, i]] : [[i - 1, i]];
  for (const [de, para] of spans) {
    const linha = faixaDoSpan(perfil, marcos[de].chave, marcos[para].chave);
    if (!linha) continue;
    if (bandaAberta) {
      return { origem: null, motivo: `segunda faixa de mercado (${marcos[de].chave}→${marcos[para].chave}) — a árvore não compõe duas faixas`, recusas };
    }
    const [lo, hi] = linha.media;
    if (!(lo > 0) || !(hi >= lo)) {
      return { origem: null, motivo: `faixa inválida em ${marcos[de].chave}→${marcos[para].chave} (${lo}–${hi})`, recusas };
    }
    return {
      origem: "mercado",
      de,
      lo,
      hi,
      fonte: linha.fonte,
      nota: linha.nota,
      atravessa: marcos.slice(de + 1, para).map((m) => m.nome),
    };
  }

  return { origem: null, motivo: `sem divisor para chegar em ${alvo.nome}`, recusas };
}

/**
 * A descida. Do último marco para o primeiro, uma camada por SPAN atravessado — degrau sem
 * medição não ganha camada própria, ele aparece dentro da ponte que o pulou.
 *
 * @param {{ficha:{perfil?:string|null, marcos:{chave:string,nome:string,celula:Celula}[]},
 *          projecao:{n1Janela:Celula}, ctr?:Celula}} entrada
 */
export function montarArvore({ ficha, projecao, ctr }) {
  const marcos = ficha?.marcos ?? [];
  if (!ehApurado(projecao?.n1Janela)) {
    // Herda o motivo EXATO da 010 (`sem meta declarada`, `sem ticket declarado`, `prazo vencido`…).
    // Reescrever aqui daria duas frases para a mesma ausência, divergindo na primeira correção.
    return { camadas: [], parou: { motivo: projecao?.motivo ?? projecao?.n1Janela?.naoApurado ?? "sem projeção" }, bandaAberta: false };
  }
  if (marcos.length < 2) return { camadas: [], parou: { motivo: "cadeia com menos de dois degraus" }, bandaAberta: false };

  const fim = marcos.length - 1;
  /** @type {any[]} */
  const camadas = [
    { chave: marcos[fim].chave, nome: marcos[fim].nome, necessario: ponto(projecao.n1Janela.valor), hoje: marcos[fim].celula, divisor: null },
  ];
  let banda = ponto(projecao.n1Janela.valor);
  let bandaAberta = false;
  let parou = null;
  let i = fim;

  while (i > 0) {
    const d = divisorDe(marcos, i, ficha.perfil, bandaAberta);
    if (!d.origem) {
      parou = { chave: marcos[i].chave, nome: marcos[i].nome, motivo: d.motivo, recusas: d.recusas };
      break;
    }
    banda = dividirBanda(banda, d.lo, d.hi);
    if (d.origem === "mercado") bandaAberta = true;
    camadas.push({ chave: marcos[d.de].chave, nome: marcos[d.de].nome, necessario: banda, hoje: marcos[d.de].celula, divisor: d });
    i = d.de;
  }

  // Impressões: mesmo laço conceitual (divisão por taxa apurada), mas fora do vetor de marcos —
  // o GSC entrega cliques e impressões na MESMA série, e a cadeia começa no clique (D5).
  // 018/FR-007: só quando a cadeia REALMENTE começa em `visitante` — sem isso, uma cadeia como a
  // D nova (`lead → respondeu → orcamento → tratamento`) dividiria `lead` pelo CTR do GSC e
  // publicaria uma taxa `impressão → lead` cruzando Descoberta com Conversão (research D6).
  if (!parou && i === 0 && marcos[0]?.chave === "visitante" && divide(ctr)) {
    banda = dividirBanda(banda, ctr.valor, ctr.valor);
    camadas.push({
      chave: "impressao",
      nome: "impressões",
      necessario: banda,
      hoje: ctr.impressoes ?? naoApurado("sem total de impressões"),
      divisor: { origem: "apurado", lo: ctr.valor, hi: ctr.valor, fonte: "CTR apurado da mesma série do Search Console", atravessa: [] },
    });
  }

  return { camadas: camadas.map(comGap), parou, bandaAberta };
}

/**
 * O gap só existe com `hoje` apurado (FR-007). Abaixo de 1× a camada já cobre a meta — e isso sai
 * rotulado, nunca como número negativo.
 */
function comGap(c) {
  if (!ehApurado(c.hoje) || c.hoje.valor === 0) return { ...c, gap: null };
  const gap = { min: c.necessario.min / c.hoje.valor, max: c.necessario.max / c.hoje.valor };
  return { ...c, gap, jaCobre: gap.max < 1 };
}

/**
 * Quantas páginas a meta exige, e em que ritmo. Divisão por uma MÉDIA, não por uma taxa — por isso
 * fora do laço da árvore (D5): a guarda de amostra mínima é desta conta e não pode vazar para
 * degraus onde não se aplica.
 *
 * Média de menos de 3 páginas não vira meta de publicação (FR-010): uma página fora da curva
 * define sozinha o alvo, e o alvo sai errado por um fator, não por uma margem.
 *
 * @param {Banda|null} impressoesNecessarias @param {{impressoes:number}[]|null} paginas
 * @param {number} impressoesHoje @param {number} diasRestantes
 */
export function camadaDeEntrega(impressoesNecessarias, paginas, impressoesHoje, diasRestantes) {
  if (!impressoesNecessarias) return { celula: naoApurado("a árvore parou antes da camada de impressões") };
  if (!Array.isArray(paginas)) return { celula: naoApurado("sem leitura de páginas do Search Console") };
  const comImpressao = paginas.filter((p) => p.impressoes > 0);
  if (comImpressao.length < 3) {
    return { celula: naoApurado(`${comImpressao.length} página(s) com impressão na janela — amostra mínima é 3, média de menos que isso não vira meta de publicação`) };
  }
  const media = comImpressao.reduce((t, p) => t + p.impressoes, 0) / comImpressao.length;
  const faltam = { min: Math.max(0, impressoesNecessarias.min - impressoesHoje), max: Math.max(0, impressoesNecessarias.max - impressoesHoje) };
  const semanas = diasRestantes / 7;
  const paginasNecessarias = { min: faltam.min / media, max: faltam.max / media };
  return {
    celula: apurado(paginasNecessarias.max),
    mediaPorPagina: media,
    amostra: comImpressao.length,
    paginasNecessarias,
    porSemana: { min: paginasNecessarias.min / semanas, max: paginasNecessarias.max / semanas },
    fonte: `impressões por página do Search Console na janela (${comImpressao.length} páginas, média ${Math.round(media)})`,
  };
}

/**
 * A alternativa a publicar: o mesmo gap fecha subindo o CTR nas páginas que já rankeiam.
 *
 * Fica FORA da conta da árvore (D7). Ela usaria uma segunda faixa (curva CTR × posição), e faixa
 * composta com faixa é exatamente a trava nº 1. Aqui ela é leitura paralela — responde "e se eu
 * não publicar nada?" sem alterar camada nenhuma.
 *
 * @param {Banda|null} cliquesNecessarios @param {number} impressoesHoje
 */
export function alavancaDePosicao(cliquesNecessarios, impressoesHoje) {
  if (!cliquesNecessarios || !(impressoesHoje > 0)) return naoApurado("sem cliques necessários ou sem impressões apuradas");
  return apurado(cliquesNecessarios.max / impressoesHoje);
}
