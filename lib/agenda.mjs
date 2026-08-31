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

/**
 * Assunto do card, não esforço — ortogonal a `tipoDe`. Card de segurança é o que expõe
 * credencial, dado ou superfície: rotação de segredo, chave no repo, CORS/auth aberta, CVE.
 *
 * Só o TÍTULO, pelo mesmo motivo de `tipoDe`: a `descricao` destes cards é diário de bordo
 * ("✅ token rotacionado em 31/07…") e classificaria o card pelo que JÁ foi resolvido.
 */
const RE_SEGURANCA =
  /\btoken\b|\bcredencia(?:l|is)\b|\bsegredo\b|\bsecret\b|\brotacionar\b|\bchave (?:de api|secreta|privada)\b|\bvaz(?:ou|amento|ada)\b|\bexpost[oa]\b|\bCVE-\d|\bCORS\b|(?<![/\w])auth(?![/\w])|\bautentica[çc][ãa]o\b|\bvulnerab/i;

/** ponytail: heurística de palavra-chave, igual `tipoDe`. Erra do mesmo jeito e se conserta do
 * mesmo jeito — se o erro virar regra, troque a lista, não remende no render. */
export function seguranca(titulo) {
  return RE_SEGURANCA.test(String(titulo ?? ""));
}

/** Urgência do bucket de data — ordena as linhas DENTRO de cada balde. */
export const ORDEM_BUCKET = { atrasadas: 0, hoje: 1, semana: 2, depois: 3, semdata: 4 };

/**
 * Peso de ordenação da linha. Ação do ranking (`taskId === null`) vem antes de qualquer
 * tarefa do banco: ela É o ranking, e nasce sempre `semdata` — que era o último balde de
 * data. O efeito medido em 29/08 era o ranking afundar no rodapé de toda seção, com as
 * ações embaixo de card de rotina; a ordem do score virava só o rótulo "#N · score S".
 */
const ordemDaLinha = (i) => (i.taskId === null ? -1 : ORDEM_BUCKET[i.bucket]);

/**
 * Posição de quem não está no ranking curado — tarefa sem projeto, ou num repo que ainda
 * não tem receita/ação apuradas. Finito de propósito: `Infinity - Infinity` é `NaN`, e um
 * comparador que devolve NaN entrega ordem indefinida sem erro nenhum na tela.
 */
export const SEM_RANK = 9999;

/** Posição da linha no ranking; ausente = SEM_RANK. */
const rankDaLinha = (i) => i.rank ?? SEM_RANK;

// ── Filtro e ordenação da lista ─────────────────────────────────────────────
// Tudo puro e derivado da querystring: filtro e ordem vivem na URL, então a
// visão é compartilhável e sobrevive ao reload e às server actions (marcar,
// editar, apagar revalidam a rota sem trocar a URL).

/** Filtro de urgência — mesmos baldes de data de ORDEM_BUCKET, na mesma ordem. */
export const URGENCIAS = [
  { id: "atrasadas", label: "Atrasadas" },
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Nesta semana" },
  { id: "depois", label: "Mais tarde" },
  { id: "semdata", label: "Sem data" },
];

/** De onde o card veio: banco (tarefa editável) ou data/projects.json (ação do ranking). */
export const ORIGENS = [
  { id: "tarefa", label: "Minhas tarefas" },
  { id: "acao", label: "Ações do ranking" },
];

/** Dono da tarefa. Ação do ranking nunca tem — fica de fora do filtro (visível pros dois). */
export const RESPONSAVEIS = [
  { id: "jean", label: "Jean Zorzetti" },
  { id: "maria", label: "Maria Zorzetti" },
];

export const RESPONSAVEL_IDS = RESPONSAVEIS.map((r) => r.id);

export const ORDENS = [
  { id: "urgencia", label: "urgência" },
  { id: "projeto", label: "projeto" },
  { id: "titulo", label: "título (A→Z)" },
];

const semAcento = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const idsDe = (lista) => new Set(lista.map((x) => x.id));

/**
 * Só valores conhecidos entram: querystring é entrada do usuário e volta para a
 * tela nos chips de filtro ativo e no `value` dos selects. Desconhecido = sem
 * filtro, e não um filtro que não casa com nada (lista vazia sem explicação é o
 * bug #1 de painel).
 * @param {Record<string, string|string[]|undefined>} sp
 * @param {string[]} slugs projetos que existem
 */
export function lerFiltros(sp, slugs = []) {
  const um = (k) => (Array.isArray(sp?.[k]) ? sp[k][0] : sp?.[k]) ?? "";
  const naLista = (k, lista) => (idsDe(lista).has(um(k)) ? um(k) : "");
  return {
    q: String(um("q")).trim().slice(0, 100),
    projeto: slugs.includes(um("projeto")) ? um("projeto") : "",
    tipo: naLista("tipo", TIPOS),
    urgencia: naLista("urgencia", URGENCIAS),
    origem: naLista("origem", ORIGENS),
    responsavel: naLista("responsavel", RESPONSAVEIS),
    ordem: naLista("ordem", ORDENS) || "urgencia",
  };
}

/** Quais filtros estão de fato ligados — a ordem não conta, ela sempre tem valor. */
export function filtrosAtivos(f) {
  return ["q", "projeto", "tipo", "urgencia", "origem", "responsavel"].filter((k) => f[k]);
}

/** Querystring com um filtro removido (chips "×") ou trocado. */
export function comFiltro(f, chave, valor) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, [chave]: valor })) {
    if (v && !(k === "ordem" && v === "urgencia")) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "?";
}

/** @param {{titulo:string, projeto:string|null, desc?:string|null, bucket:string, tipo:string, taskId:number|null, task?:{responsavel:string|null}}[]} items */
export function filtrar(items, f) {
  const alvo = semAcento(f.q);
  return items.filter(
    (i) =>
      (!f.projeto || i.projeto === f.projeto) &&
      // balde já derivado (heurística ou override do banco) — o filtro nunca reclassifica
      (!f.tipo || i.tipo === f.tipo) &&
      (!f.urgencia || i.bucket === f.urgencia) &&
      (!f.origem || (f.origem === "acao") === (i.taskId === null)) &&
      // ação do ranking não tem dono: fica visível independente do filtro de responsável.
      (!f.responsavel || i.taskId === null || i.task?.responsavel === f.responsavel) &&
      (!alvo || semAcento(`${i.titulo} ${i.projeto ?? ""} ${i.desc ?? ""}`).includes(alvo)),
  );
}

/**
 * Ação do ranking primeiro, depois urgência, DEPOIS O RANKING DO PROJETO, e por fim a data.
 *
 * O rank entra como chave de ordenação de verdade, não como o rótulo "#N" que a linha exibe:
 * dentro do mesmo balde de data, tarefa do projeto #1 vem antes da tarefa do #20 — antes as
 * duas empatavam e quem decidia era a data de vencimento, que não sabe nada de prioridade.
 * É o mesmo `rank` que gera o rótulo, então rótulo e ordem não podem divergir.
 */
export function porUrgencia(a, b) {
  return (
    ordemDaLinha(a) - ordemDaLinha(b) || rankDaLinha(a) - rankDaLinha(b) || a.occ.localeCompare(b.occ)
  );
}

/**
 * Ordena uma cópia. Projeto e título desempatam por urgência, senão a lista
 * ficaria embaralhada dentro do mesmo projeto. Sem projeto vai para o fim: é
 * ausência de valor, não um nome que começa com espaço.
 */
export function ordenar(items, ordem) {
  const chave = { projeto: (i) => i.projeto ?? "￿", titulo: (i) => semAcento(i.titulo) }[ordem];
  if (!chave) return [...items].sort(porUrgencia);
  return [...items].sort((a, b) => chave(a).localeCompare(chave(b)) || porUrgencia(a, b));
}
