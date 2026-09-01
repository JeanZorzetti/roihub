// A 009 (`lib/okr.mjs`) para na posição §7.3 e diz por escrito por quê: as posições 4 e 5 do
// template (volume/ticket, depois N5) exigiriam benchmark, e a R6 proíbe. Este arquivo NÃO
// estende aquele — vai pra TRÁS, não pra frente: `meta ÷ cadeia` é divisão sobre uma meta
// DECLARADA pelo humano, não estimativa sobre benchmark de terceiro. Nenhum número novo entra no
// sistema; entram a meta e o ticket, rotulados como declarados (D1).
//
// Proibido importar função de `lib/okr.mjs` — a ficha entra pronta em `projetar()` — e proibido
// reimplementar célula, razão ou cadeia (FR-015).
import { apurado, naoApurado, ehApurado, razao, exigencia } from "./funil.mjs";

/** @typedef {{valor:number}|{naoApurado:string}} Celula */

/** @typedef {{chave:string, nome:string, indice:number, valor:number, ehFinal:boolean}} Ancora */

/**
 * @typedef {object} Normalizacao
 * @property {number} janelaDias
 * @property {number} diasRestantes
 * @property {number} janelas
 * @property {boolean} encurtada
 * @property {string} conta
 */

/**
 * @typedef {object} Projecao
 * @property {Celula} n1Total
 * @property {Celula} n1Janela
 * @property {Ancora|null} ancora
 * @property {Celula} fatorObrigatorio
 * @property {Celula} multiploNecessario
 * @property {Celula} folga
 * @property {Celula} multiploDeVolume
 * @property {{de:string, para:string}[]} degrausAMedir
 * @property {Normalizacao|null} normalizacao
 * @property {string} veredito
 * @property {string} motivo
 */

/**
 * O denominador da inversão. Percorre `marcos` do topo, para no primeiro `não apurado`, devolve
 * o ÚLTIMO apurado da sequência contígua — o degrau final incluído (FR-005 literal, D2). Degrau
 * apurado depois de um buraco NUNCA é âncora: em `atma`, `tratamento = 0` é apurado e vem depois
 * de três `não apurado`; a âncora correta é `lead` (SC-007).
 *
 * @param {{chave:string, nome:string, celula:Celula}[]} marcos
 * @returns {Ancora|null}
 */
export function ancoraDe(marcos) {
  let ultimo = null;
  for (let i = 0; i < marcos.length; i++) {
    const m = marcos[i];
    if (!ehApurado(m.celula)) break;
    ultimo = { chave: m.chave, nome: m.nome, indice: i, valor: m.celula.valor, ehFinal: i === marcos.length - 1 };
  }
  return ultimo;
}

// Formatação local só para compor `motivo` — não reimplementa célula, razão nem cadeia (FR-015),
// e não entra na lista de imports permitidos do contrato (só apurado/naoApurado/ehApurado/razao/
// exigencia). É o mesmo formato de `pct()` de funil.mjs, copiado em vez de importado.
const fmtPct = (v) => `${(v * 100).toFixed(2).replace(".", ",")}%`;
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

const DIA_MS = 86400000;

/** @param {string} hoje @param {string} prazo @returns {number} */
const diasEntre = (hoje, prazo) => Math.round((Date.parse(`${prazo}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / DIA_MS);

/** @param {unknown} s */
const prazoValido = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/**
 * A inversão: recebe a ficha PRONTA da 009 e uma meta DECLARADA, devolve quanto o resto da cadeia
 * precisa valer. Pura — `hoje` é parâmetro, nada de `Date.now()` aqui dentro (Princípio III).
 *
 * As 8 guardas seguem a ordem da própria divisão (data-model.md §4): cada uma nomeia o primeiro
 * fator que falta na conta, na ordem em que a conta o usa.
 *
 * @param {{ficha: object, meta: {valor?:number, ticket?:number, prazo?:string, declaradaEm?:string}|null|undefined, hoje: string, janelaDias?: number}} entrada
 * @returns {Projecao}
 */
export function projetar({ ficha, meta, hoje, janelaDias = 28 }) {
  const naoApuradaCompleta = (motivo) => ({
    n1Total: naoApurado(motivo),
    n1Janela: naoApurado(motivo),
    ancora: null,
    fatorObrigatorio: naoApurado(motivo),
    multiploNecessario: naoApurado(motivo),
    folga: naoApurado(motivo),
    multiploDeVolume: naoApurado(motivo),
    degrausAMedir: [],
    normalizacao: null,
    veredito: "nao-apurado",
    motivo,
  });

  // 1 — sem perfil (herda o motivo exato da 009, D1)
  if (ficha.semPerfil) return naoApuradaCompleta(ficha.semPerfil.naoApurado);
  // 2 — sem meta declarada (FR-013, US1-AC2)
  if (!meta) return naoApuradaCompleta("sem meta declarada");
  // 3 — sem valor de meta
  if (meta.valor == null || meta.valor <= 0) return naoApuradaCompleta("sem valor de meta declarado");
  // 4 — sem ticket (US1-AC3)
  if (meta.ticket == null || meta.ticket <= 0)
    return naoApuradaCompleta("sem ticket declarado — R$ não vira contagem sem valor por unidade");
  // 5 — prazo inválido
  if (!prazoValido(meta.prazo)) return naoApuradaCompleta("prazo ausente ou inválido");

  // 6 — prazo vencido (US3-AC2). `<= 0` fecha a porta pra divisão por janela negativa OU por zero.
  const diasRestantes = diasEntre(hoje, meta.prazo);
  if (diasRestantes <= 0) return naoApuradaCompleta(`prazo vencido em ${meta.prazo}`);

  // 7 — sem âncora
  const ancora = ancoraDe(ficha.marcos);
  if (!ancora) return naoApuradaCompleta("sem âncora — nenhum degrau medido para dividir");
  // 8 — âncora zerada (G5)
  if (ancora.valor === 0) return naoApuradaCompleta("âncora zerada — meta não se divide por volume nenhum");

  // Todas as guardas passaram — a divisão de verdade começa aqui.
  const n1Total = apurado(meta.valor / meta.ticket);
  const janelas = diasRestantes / janelaDias;
  const encurtada = diasRestantes < janelaDias;
  const n1JanelaValor = n1Total.valor * (janelaDias / diasRestantes);
  const n1Janela = apurado(n1JanelaValor);
  const normalizacao = {
    janelaDias,
    diasRestantes,
    janelas,
    encurtada,
    conta: `${fmtNum(n1Total.valor)} × ${janelaDias}/${diasRestantes} = ${fmtNum(n1JanelaValor)}`,
  };

  const cadeiaAposAncora = ficha.marcos.slice(ancora.indice);
  const degrausAMedir = ancora.ehFinal
    ? []
    : cadeiaAposAncora.slice(1).map((m, i) => ({ de: cadeiaAposAncora[i].nome, para: m.nome }));

  let fatorObrigatorio = naoApurado("âncora é o próprio N1 — não há trecho a exigir");
  let multiploNecessario = naoApurado("âncora não é o degrau final — não há múltiplo a exigir");
  let folga = naoApurado("fator não indica folga — fora do ramo de múltiplo");
  let multiploDeVolume = naoApurado("fator não excede 1 — sem múltiplo de volume a exigir");
  let veredito;
  let motivo;

  if (!ancora.ehFinal) {
    // Ramo da TAXA — degraus entre a âncora e o fim. O teto de 100% vale (D9).
    fatorObrigatorio = exigencia(n1Janela, apurado(ancora.valor));
    const fator = fatorObrigatorio.valor;
    if (fator < 1) {
      veredito = "cabe";
      motivo = `${fmtPct(fator)} (${fmtNum(n1Janela.valor)}/${fmtNum(ancora.valor)}) — cabe no volume atual de ${ancora.nome}`;
    } else if (fator === 1) {
      veredito = "limite";
      motivo = "100% em todos os degraus restantes — limite, não meta";
    } else {
      veredito = "impossivel";
      multiploDeVolume = apurado(fator);
      motivo = `exigiria ${fmtPct(fator)} de conversão de ${ancora.nome} até o fim da cadeia; taxa não passa de 100% — a meta só cabe multiplicando o volume de ${ancora.nome} em ${fmtNum(fator)}× OU o ticket em ${fmtNum(fator)}×`;
    }
  } else {
    // Ramo do MÚLTIPLO — a âncora é o próprio N1 (cadeia fechada). Sem teto: é crescimento (D9).
    multiploNecessario = exigencia(n1Janela, apurado(ancora.valor));
    const multiplo = multiploNecessario.valor;
    if (multiplo < 1) {
      veredito = "folga";
      folga = apurado(1 / multiplo);
      motivo = `${ancora.nome} já cobre a meta na janela — folga de ${fmtNum(folga.valor)}× (precisaria de só ${fmtNum(multiplo)}× do volume atual)`;
    } else {
      veredito = "multiplo";
      motivo = `precisa de ${fmtNum(multiplo)}× o volume atual de ${ancora.nome} na janela — sem teto de 100%, é crescimento de volume, não taxa`;
    }
  }

  return {
    n1Total,
    n1Janela,
    ancora,
    fatorObrigatorio,
    multiploNecessario,
    folga,
    multiploDeVolume,
    degrausAMedir,
    normalizacao,
    veredito,
    motivo,
  };
}
