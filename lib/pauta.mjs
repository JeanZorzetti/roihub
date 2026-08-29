// Helpers puros dos quadros (Marketing e Ideias). Zero import de next/pg/react — é o que
// permite ao node --test importar este arquivo sem transpilar, e é a única forma de testar a
// grade do calendário e a regra de retenção sem banco e sem DOM.

// ── Constantes ──────────────────────────────────────────────────────────────

/** Os dois quadros. Sem CHECK no banco: a lista vive aqui e a validação é na action. */
export const QUADROS = [
  { id: "marketing", label: "Marketing", rota: "/marketing" },
  { id: "ideia", label: "Ideias", rota: "/ideias" },
];

export const QUADRO_IDS = QUADROS.map((q) => q.id);

/** Canal de publicação — decisão de código, não do usuário (diferente das colunas). */
export const CANAIS = [
  { id: "blog", label: "Blog" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube" },
  { id: "email", label: "E-mail" },
  { id: "outro", label: "Outro" },
];

export const CANAL_IDS = CANAIS.map((c) => c.id);

/** `doc` sai do fluxo: não aparece em coluna nem no calendário. */
export const TIPOS_CARD = ["card", "doc"];

export const VISTAS = [
  { id: "kanban", label: "Fluxo" },
  { id: "calendario", label: "Calendário" },
  { id: "docs", label: "Documentação" },
];

export const VISTA_IDS = VISTAS.map((v) => v.id);

/** Semeadas no ensure() com ON CONFLICT DO NOTHING: quadro utilizável sem configuração. */
export const COLUNAS_INICIAIS = {
  marketing: [
    { nome: "Pauta", icone: "📝", ordem: 0 },
    { nome: "Produzindo", icone: "🔨", ordem: 1 },
    { nome: "Agendado", icone: "📅", ordem: 2 },
    { nome: "Publicado", icone: "✅", ordem: 3 },
  ],
  ideia: [
    { nome: "Produto novo", icone: "🌱", ordem: 0 },
    { nome: "Melhoria", icone: "🔧", ordem: 1 },
    { nome: "Gaveta", icone: "🗄️", ordem: 2 },
  ],
};

export const MIMES_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

/** 3 MB. O limite existe para tornar visível que PNG de carrossel é ~10x um JPEG da mesma arte. */
export const ANEXO_MAX_BYTES = 3 * 1024 * 1024;

/** Maior carrossel aceito pelas redes de destino. */
export const ANEXO_MAX_POR_CARD = 20;

/** Carência contada do ARQUIVAMENTO, nunca do upload: arte enviada com semanas de
 *  antecedência não pode expirar antes de ser usada. */
export const ANEXO_CARENCIA_DIAS = 30;

export const TITULO_MAX = 200;

/** O dobro da agenda — a vista `docs` guarda texto de processo, não lembrete. */
export const DESCRICAO_MAX = 4000;

export const COLUNA_NOME_MAX = 40;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// ── Validação ───────────────────────────────────────────────────────────────
// Código de erro estável, nunca mensagem livre — mesma disciplina dos códigos do
// autopublishing (llm-auth, llm-rate…): mensagem é para a tela, código é para o teste e o log.

/** @param {{mime?:string, tamanho?:number, jaTem?:number}} a */
export function validarAnexo({ mime, tamanho, jaTem = 0 } = {}) {
  if (!MIMES_ACEITOS.includes(mime)) return { ok: false, erro: "mime" };
  if (!(Number(tamanho) > 0) || Number(tamanho) > ANEXO_MAX_BYTES) return { ok: false, erro: "tamanho" };
  if (Number(jaTem) >= ANEXO_MAX_POR_CARD) return { ok: false, erro: "quantidade" };
  return { ok: true };
}

/**
 * Recusa é resposta esperada, não exceção: o usuário tem todo direito de tentar apagar uma
 * coluna cheia. A contagem vai junto porque "mova 3 cards" é acionável e "não pode" não é.
 * @param {{cards?:number, totalColunas?:number}} c
 */
export function validarColunaRemovivel({ cards = 0, totalColunas = 0 } = {}) {
  if (Number(cards) > 0) return { ok: false, erro: "tem-cards", cards: Number(cards) };
  if (Number(totalColunas) <= 1) return { ok: false, erro: "ultima-coluna" };
  return { ok: true };
}

// ── Calendário ──────────────────────────────────────────────────────────────

/** "2026-09-02" → "2026-09" */
export function mesDe(iso) {
  return String(iso ?? "").slice(0, 7);
}

/** "2026-09" → "setembro de 2026" */
export function rotuloMes(ym) {
  const [a, m] = String(ym ?? "").split("-").map(Number);
  return MESES[m - 1] ? `${MESES[m - 1]} de ${a}` : String(ym ?? "");
}

/** `mesVizinho("2026-12", 1) === "2027-01"` — a virada de ano sai do Date, não de aritmética à mão. */
export function mesVizinho(ym, n) {
  const [a, m] = String(ym ?? "").split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + Number(n), 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Semanas do mês como matriz de datas ISO, com `null` antes do dia 1 e depois do último.
 * Semana começa no domingo, igual a WD_LABELS de lib/agenda.mjs — duas grades do mesmo hub
 * começando em dias diferentes seria erro de leitura garantido.
 * @param {string} ym "YYYY-MM"
 */
export function gradeDoMes(ym) {
  const [a, m] = String(ym ?? "").split("-").map(Number);
  if (!a || !m) return [];
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const celulas = new Array(new Date(Date.UTC(a, m - 1, 1)).getUTCDay()).fill(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (celulas.length % 7) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

// ── Filtro e ordenação ──────────────────────────────────────────────────────
// Mesmo desenho de lib/agenda.mjs: filtro e vista vivem na URL, então a visão é
// compartilhável e sobrevive ao reload e às server actions (que revalidam a rota sem
// trocar a querystring).

const semAcento = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const idsDe = (lista) => new Set(lista.map((x) => x.id));

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Só valores conhecidos entram. Desconhecido = sem filtro, e não um filtro que não casa com
 * nada — lista vazia sem explicação é o bug nº 1 de painel (a razão está escrita em agenda.mjs).
 *
 * `colunas` é aceito para o caller poder passar o mesmo objeto que já montou; nenhum filtro é
 * validado contra ele de propósito: filtrar por coluna esconderia colunas, e FR-030 proíbe.
 *
 * @param {Record<string, string|string[]|undefined>} sp
 * @param {{slugs?:string[], responsaveis?:string[], colunas?:unknown[]}} ctx
 */
export function lerFiltros(sp, ctx = {}) {
  const { slugs = [], responsaveis = [] } = ctx;
  const um = (k) => (Array.isArray(sp?.[k]) ? sp[k][0] : sp?.[k]) ?? "";
  const naLista = (k, lista) => (idsDe(lista).has(um(k)) ? um(k) : "");
  return {
    q: String(um("q")).trim().slice(0, 100),
    projeto: slugs.includes(um("projeto")) ? um("projeto") : "",
    responsavel: responsaveis.includes(um("responsavel")) ? um("responsavel") : "",
    canal: naLista("canal", CANAIS),
    vista: naLista("vista", VISTAS) || "kanban",
    mes: RE_MES.test(um("mes")) ? um("mes") : "",
    arquivados: um("arquivados") === "1" ? "1" : "0",
  };
}

/** Quais filtros de conteúdo estão ligados — vista, mês e arquivados são navegação, não filtro. */
export function filtrosAtivos(f) {
  return ["q", "projeto", "responsavel", "canal"].filter((k) => f?.[k]);
}

/** Valor que não precisa aparecer na URL — o link do chip fica curto e legível. */
const PADRAO = { vista: "kanban", arquivados: "0" };

/** Querystring com um filtro removido (chips "×") ou trocado. */
export function comFiltro(f, chave, valor) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, [chave]: valor })) {
    if (v && PADRAO[k] !== v) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "?";
}

/** @param {{titulo?:string, projeto?:string|null, descricao?:string|null, responsavel?:string|null, canal?:string|null}[]} cards */
export function filtrar(cards, f = {}) {
  const alvo = semAcento(f.q);
  return (cards ?? []).filter(
    (c) =>
      (!f.projeto || c.projeto === f.projeto) &&
      (!f.responsavel || c.responsavel === f.responsavel) &&
      (!f.canal || c.canal === f.canal) &&
      (!alvo || semAcento(`${c.titulo ?? ""} ${c.projeto ?? ""} ${c.descricao ?? ""}`).includes(alvo)),
  );
}

/**
 * Devolve TODAS as colunas, inclusive as que ficaram vazias pelo filtro (FR-030): o filtro
 * não pode esconder que a etapa existe. Card de `tipo = 'doc'` não entra em coluna nenhuma.
 */
export function agruparPorColuna(cards, colunas) {
  return (colunas ?? []).map((coluna) => ({
    coluna,
    cards: (cards ?? []).filter((c) => c.tipo !== "doc" && c.coluna_id === coluna.id),
  }));
}

/** `{ "2026-09-02": [card, …] }`. Card sem data não entra (FR-025) e segue acessível no quadro. */
export function agruparPorDia(cards, ym) {
  const dias = {};
  for (const c of cards ?? []) {
    if (c.tipo === "doc" || !c.data) continue;
    if (ym && mesDe(c.data) !== ym) continue;
    (dias[c.data] ??= []).push(c);
  }
  return dias;
}

// ── Retenção ────────────────────────────────────────────────────────────────

const emMs = (v) => (v instanceof Date ? v.getTime() : Date.parse(String(v)));

const DIA_MS = 86_400_000;

/**
 * Mesma regra que o UPDATE da varredura aplica. Existir aqui em forma pura é o que permite
 * testá-la sem banco e sem esperar 30 dias.
 */
export function podeLiberar(card, hoje = new Date()) {
  if (!card?.arquivado_em) return false;
  const t = emMs(card.arquivado_em);
  const agora = emMs(hoje);
  if (!Number.isFinite(t) || !Number.isFinite(agora)) return false;
  return Math.floor((agora - t) / DIA_MS) >= ANEXO_CARENCIA_DIAS;
}

/** Data em que os anexos do card serão liberados — alimenta o aviso do FR-031. */
export function dataDeLiberacao(card) {
  if (!card?.arquivado_em) return null;
  const t = emMs(card.arquivado_em);
  if (!Number.isFinite(t)) return null;
  return new Date(t + ANEXO_CARENCIA_DIAS * DIA_MS).toISOString().slice(0, 10);
}

/** Anexo liberado = a linha continua, os bytes não. Ver FR-033. */
const liberado = (a) => a?.liberado_em != null || a?.bytes === null;

/** Alimenta o contador permanente de espaço da aba (FR-036). */
export function resumoDeEspaco(anexos) {
  let ativos = 0;
  let bytes = 0;
  let liberados = 0;
  for (const a of anexos ?? []) {
    if (liberado(a)) liberados++;
    else {
      ativos++;
      bytes += Number(a?.tamanho) || 0;
    }
  }
  return { ativos, bytes, liberados };
}

/** "2,4 MB" — o número precisa caber no topo da aba sem virar tabela. */
export function tamanhoHumano(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
