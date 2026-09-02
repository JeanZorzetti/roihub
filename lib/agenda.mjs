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

/** Hash curto e estável (djb2) — identifica a ação de um projeto; texto mudou = check reseta. */
export function hash8(s) {
  let h = 5381;
  for (const c of s) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/**
 * Chave de uma ação do ranking — o contrato entre a projeção do `data/projects.json` e as
 * duas camadas que o banco guarda por cima dela (o check em `hub_done` e o dono em
 * `hub_acao_dono`).
 *
 * Existe como função porque a expressão estava copiada na agenda e na home, e agora o dono
 * seria a terceira cópia: a hora de virar helper é essa. Carregar o `hash8` do texto é o que
 * faz ação reescrita valer como ação nova — check e dono resetam juntos, de propósito.
 */
export function acaoKey(slug, acao) {
  return `acao:${slug}:${hash8(acao)}`;
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

// ── Filtro e ordenação da lista ─────────────────────────────────────────────
// Tudo puro e derivado da querystring: filtro e ordem vivem na URL, então a
// visão é compartilhável e sobrevive ao reload e às server actions (marcar,
// editar, apagar revalidam a rota sem trocar a URL).

/** Dono do card. Usado pelos quadros e, desde 31/08, pela ação do ranking na agenda. */
export const RESPONSAVEIS = [
  { id: "jean", label: "Jean Zorzetti" },
  { id: "maria", label: "Maria Zorzetti" },
];

export const RESPONSAVEL_IDS = RESPONSAVEIS.map((r) => r.id);

/**
 * Id do filtro "sem responsável". NÃO é um responsável — é a ausência de um, e é ela que
 * responde "o que ainda não tem dono", a única pergunta que cobra a regra de que toda ação
 * precisa ter um. Por isso vive fora de RESPONSAVEIS: entrar na lista o transformaria numa
 * terceira pessoa atribuível.
 */
export const SEM_RESP = "sem";

/** Rótulo de exibição de um responsável. Id desconhecido volta como veio — nunca vira "". */
export function rotuloResp(id) {
  return RESPONSAVEIS.find((r) => r.id === id)?.label ?? id ?? "";
}

export const ORDENS = [
  { id: "ranking", label: "ranking" },
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
  const resp = um("responsavel");
  return {
    q: String(um("q")).trim().slice(0, 100),
    projeto: slugs.includes(um("projeto")) ? um("projeto") : "",
    tipo: naLista("tipo", TIPOS),
    responsavel: RESPONSAVEL_IDS.includes(resp) || resp === SEM_RESP ? resp : "",
    ordem: naLista("ordem", ORDENS) || "ranking",
  };
}

/** Quais filtros estão de fato ligados — a ordem não conta, ela sempre tem valor. */
export function filtrosAtivos(f) {
  return ["q", "projeto", "tipo", "responsavel"].filter((k) => f[k]);
}

/** Querystring com um filtro removido (chips "×") ou trocado. */
export function comFiltro(f, chave, valor) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, [chave]: valor })) {
    if (v && !(k === "ordem" && v === "ranking")) p.set(k, v);
  }
  const s = p.toString();
  return s ? `?${s}` : "?";
}

/** @param {{titulo:string, projeto:string, desc?:string|null, tipo:string, responsavel?:string|null}[]} items */
export function filtrar(items, f) {
  const alvo = semAcento(f.q);
  return items.filter(
    (i) =>
      (!f.projeto || i.projeto === f.projeto) &&
      // balde já derivado pela heurística de título — o filtro nunca reclassifica
      (!f.tipo || i.tipo === f.tipo) &&
      // SEM_RESP casa a AUSÊNCIA de dono; é o filtro que lista o que falta decidir
      (!f.responsavel ||
        (f.responsavel === SEM_RESP ? i.responsavel == null : i.responsavel === f.responsavel)) &&
      (!alvo || semAcento(`${i.titulo} ${i.projeto ?? ""} ${i.desc ?? ""}`).includes(alvo)),
  );
}

/**
 * A ordem da home, e nada mais: `rank` é a posição do projeto no ranking curado.
 *
 * É o mesmo `rank` que gera o rótulo "#N" da linha, então rótulo e ordem não podem divergir
 * — foi exatamente esse o bug medido em 29/08, quando "#N" era só rótulo.
 */
export function porRanking(a, b) {
  return a.rank - b.rank;
}

/**
 * Ordena uma cópia. Projeto e título desempatam pelo ranking, senão a lista
 * ficaria embaralhada dentro do mesmo projeto.
 */
export function ordenar(items, ordem) {
  const chave = { projeto: (i) => i.projeto, titulo: (i) => semAcento(i.titulo) }[ordem];
  if (!chave) return [...items].sort(porRanking);
  return [...items].sort((a, b) => chave(a).localeCompare(chave(b)) || porRanking(a, b));
}

/**
 * Linhas de "ação do ranking" a partir dos projetos curados, na ordem do ranking.
 *
 * Projeto em `standby` NÃO vira linha, mesmo com `acao` preenchida: a ação fica guardada para
 * quando ele voltar, e enquanto isso não cobra ninguém.
 *
 * `acao` vazia NÃO vira linha: um card pode ser curado justamente para dizer que não há o
 * que fazer (Lumina é demonstração, portfólio não vende). Sem esse corte o título ia vazio
 * e `tipoDe("")` caía no fallback "execucao" — em 31/08 eram três cards fantasma na fila de
 * Execução, cada um exibindo como tarefa o `acaoDesc` que manda não abrir tarefa nenhuma.
 *
 * O índice vem do array curado INTEIRO, antes do corte: `#N` é a posição no ranking, e
 * numerar depois de filtrar traz de volta o bug de 29/08 em que "#N" era rótulo, não ordem.
 *
 * `donos` é indexado pela MESMA `key` do check, montada uma vez logo abaixo. Recalcular o
 * `hash8` num segundo lugar para casar o dono é como se perde a ligação entre as duas camadas
 * — a `key` é o contrato entre projeção e banco, e ela nasce aqui.
 */
export function acoesDoRanking(curados, donos = new Map()) {
  return curados.flatMap((p, i) => {
    const acao = String(p.acao ?? "").trim();
    if (!acao || p.standby) return [];
    const key = acaoKey(p.slug, p.acao);
    return [{
      key,
      occ: NO_DATE,
      titulo: p.acao,
      projeto: p.slug,
      meta: `#${i + 1} · score ${p.score}`,
      desc: p.acaoDesc ?? null,
      tipo: tipoDe(p.acao), // a ação não tem linha no banco: a heurística de título é o único caminho
      rank: i,
      seguranca: seguranca(p.acao),
      responsavel: donos.get(key) ?? null,
      descontinuado: !!p.descontinuado,
    }];
  });
}
