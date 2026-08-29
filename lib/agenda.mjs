// Helpers puros da agenda — datas como strings YYYY-MM-DD (fuso resolvido pelo caller).

export const WD_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Ocorrência-sentinela de tarefa sem data. */
export const NO_DATE = "1970-01-01";

/** Data de hoje em São Paulo, YYYY-MM-DD. */
export function todaySP(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** @param {string} iso @param {number} n */
export function addDaysISO(iso, n) {
  const d = new Date(iso + "T12:00:00Z"); // meio-dia UTC evita borda de DST
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Dia da semana 0-6 (domingo=0) de uma data ISO. */
export function weekdayOf(iso) {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}

/** Próxima ocorrência (hoje incluso) de um weekday 0-6; 7 = diária (sempre hoje). */
export function nextOccurrence(weekday, today) {
  if (weekday === 7) return today;
  return addDaysISO(today, (weekday - weekdayOf(today) + 7) % 7);
}

/** Hash curto e estável (djb2) — identifica a ação de um projeto; texto mudou = check reseta. */
export function hash8(s) {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** "11/07" a partir de YYYY-MM-DD. */
export function brShort(iso) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// ── Os três baldes: o que o card exige de você ──────────────────────────────
// Conferência = medir/olhar um número. Execução = escrever/publicar/deployar.
// Decisão = não há o que fazer até você decidir.

/** Ordem aqui é a ordem de render na página. */
export const TIPOS = [
  { id: "conferencia", label: "Conferência", icone: "🔍" },
  { id: "execucao", label: "Execução", icone: "🔨" },
  { id: "decisao", label: "Decisão", icone: "🧭" },
];

export const TIPO_IDS = TIPOS.map((t) => t.id);

const RE_DECISAO = /\bdecidir\b|\bdecis[ãa]o\b|\bescolher se\b|\bdefinir se\b/i;
const RE_CONFERENCIA =
  /^estado \d{4}-\d{2}-\d{2}|\bconferir\b|\bchecar\b|\bchecagem\b|\bcheckpoint\b|\bverificar\b|\b(?:re)?medir\b|\bmedi[çc][ãa]o\b|\bgate \d|\besperar\b|\bsem blocker\b|\bnenhuma a[çc][ãa]o\b/i;

/**
 * Balde do card, derivado do TÍTULO.
 *
 * Só o título de propósito: a `descricao` destes cards é um diário de bordo
 * ("✅ EXECUTADO 31/07…", "medido em 30/07…") e classificaria o card pelo que já
 * foi feito, não pelo que falta. Decisão vence conferência porque decisão
 * pendente trava a medição — e o inverso não é verdade.
 *
 * ponytail: heurística de palavra-chave. `hub_tasks.tipo` sobrescreve quando
 * ela erra; se o override virar regra em vez de exceção, a heurística é que
 * está errada e deve ser trocada, não remendada.
 */
export function tipoDe(titulo) {
  const t = String(titulo ?? "");
  if (RE_DECISAO.test(t)) return "decisao";
  if (RE_CONFERENCIA.test(t)) return "conferencia";
  return "execucao";
}

/** Urgência do bucket de data — ordena as linhas DENTRO de cada balde. */
export const ORDEM_BUCKET = { atrasadas: 0, hoje: 1, semana: 2, depois: 3, semdata: 4 };
