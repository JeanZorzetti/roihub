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

/** Próxima ocorrência (hoje incluso) de um weekday 0-6. */
export function nextOccurrence(weekday, today) {
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
