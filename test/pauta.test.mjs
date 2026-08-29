import { test } from "node:test";
import assert from "node:assert/strict";
import {
  QUADRO_IDS,
  CANAL_IDS,
  COLUNAS_INICIAIS,
  ANEXO_MAX_BYTES,
  ANEXO_MAX_POR_CARD,
  ANEXO_CARENCIA_DIAS,
  validarAnexo,
  validarColunaRemovivel,
  mesDe,
  rotuloMes,
  mesVizinho,
  gradeDoMes,
  lerFiltros,
  filtrosAtivos,
  comFiltro,
  filtrar,
  agruparPorColuna,
  agruparPorDia,
  podeLiberar,
  dataDeLiberacao,
  resumoDeEspaco,
  tamanhoHumano,
} from "../lib/pauta.mjs";

// ── Constantes ──────────────────────────────────────────────────────────────

test("os dois quadros nascem com colunas utilizáveis (FR-016)", () => {
  assert.deepEqual(QUADRO_IDS, ["marketing", "ideia"]);
  for (const quadro of QUADRO_IDS) {
    const cols = COLUNAS_INICIAIS[quadro];
    assert.ok(cols.length > 0, `${quadro} sem colunas semeadas`);
    // ordem contígua a partir de 0: é ela que decide a posição na tela
    assert.deepEqual(cols.map((c) => c.ordem), cols.map((_, i) => i));
    // nome único dentro do quadro — o UNIQUE do banco é sobre (quadro, nome)
    assert.equal(new Set(cols.map((c) => c.nome)).size, cols.length);
  }
});

// ── validarAnexo ────────────────────────────────────────────────────────────

test("validarAnexo aceita os três formatos declarados", () => {
  for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
    assert.deepEqual(validarAnexo({ mime, tamanho: 1024, jaTem: 0 }), { ok: true });
  }
});

test("validarAnexo recusa formato fora da lista (FR-019)", () => {
  assert.deepEqual(validarAnexo({ mime: "application/pdf", tamanho: 1024 }), { ok: false, erro: "mime" });
  assert.deepEqual(validarAnexo({ mime: "image/gif", tamanho: 1024 }), { ok: false, erro: "mime" });
  assert.deepEqual(validarAnexo({ tamanho: 1024 }), { ok: false, erro: "mime" });
});

test("validarAnexo recusa acima do teto e aceita exatamente no teto", () => {
  assert.deepEqual(validarAnexo({ mime: "image/jpeg", tamanho: ANEXO_MAX_BYTES }), { ok: true });
  assert.deepEqual(validarAnexo({ mime: "image/jpeg", tamanho: ANEXO_MAX_BYTES + 1 }), {
    ok: false,
    erro: "tamanho",
  });
  // arquivo vazio não é anexo: sem isto um upload truncado entraria como slide em branco
  assert.deepEqual(validarAnexo({ mime: "image/jpeg", tamanho: 0 }), { ok: false, erro: "tamanho" });
});

test("validarAnexo recusa o 21º arquivo do card (FR-017)", () => {
  assert.deepEqual(validarAnexo({ mime: "image/png", tamanho: 10, jaTem: ANEXO_MAX_POR_CARD - 1 }), {
    ok: true,
  });
  assert.deepEqual(validarAnexo({ mime: "image/png", tamanho: 10, jaTem: ANEXO_MAX_POR_CARD }), {
    ok: false,
    erro: "quantidade",
  });
});

// ── validarColunaRemovivel ──────────────────────────────────────────────────

test("coluna com cards não é removível, e a contagem vai na resposta (FR-013)", () => {
  assert.deepEqual(validarColunaRemovivel({ cards: 3, totalColunas: 4 }), {
    ok: false,
    erro: "tem-cards",
    cards: 3,
  });
});

test("a última coluna do quadro não é removível (FR-014)", () => {
  assert.deepEqual(validarColunaRemovivel({ cards: 0, totalColunas: 1 }), { ok: false, erro: "ultima-coluna" });
});

test("coluna vazia que não é a última é removível", () => {
  assert.deepEqual(validarColunaRemovivel({ cards: 0, totalColunas: 2 }), { ok: true });
});

test("ter cards vence ser a última: a mensagem acionável é a da contagem", () => {
  assert.deepEqual(validarColunaRemovivel({ cards: 2, totalColunas: 1 }), {
    ok: false,
    erro: "tem-cards",
    cards: 2,
  });
});

// ── Calendário ──────────────────────────────────────────────────────────────

test("mesDe e rotuloMes", () => {
  assert.equal(mesDe("2026-09-02"), "2026-09");
  assert.equal(rotuloMes("2026-09"), "setembro de 2026");
  assert.equal(rotuloMes("2027-01"), "janeiro de 2027");
});

test("mesVizinho vira o ano nos dois sentidos", () => {
  assert.equal(mesVizinho("2026-12", 1), "2027-01");
  assert.equal(mesVizinho("2026-01", -1), "2025-12");
  assert.equal(mesVizinho("2026-09", 1), "2026-10");
  assert.equal(mesVizinho("2026-09", -1), "2026-08");
});

test("gradeDoMes: mês que começa no domingo não tem null à esquerda", () => {
  // 2026-03-01 é domingo
  const g = gradeDoMes("2026-03");
  assert.equal(g[0][0], "2026-03-01");
  assert.equal(g.length, 5); // 31 dias a partir de domingo = 5 semanas
  assert.equal(g.at(-1).at(-1), null);
});

test("gradeDoMes: fevereiro de 28 dias começando no domingo cabe em 4 semanas exatas", () => {
  // 2026-02-01 é domingo e o mês tem 28 dias: nenhuma célula null no mês inteiro
  const g = gradeDoMes("2026-02");
  assert.equal(g.length, 4);
  assert.equal(g.flat().filter((d) => d === null).length, 0);
  assert.equal(g[0][0], "2026-02-01");
  assert.equal(g.at(-1).at(-1), "2026-02-28");
});

test("gradeDoMes: fevereiro bissexto tem o dia 29", () => {
  const g = gradeDoMes("2028-02"); // 2028 é bissexto; 01/02 cai numa terça
  const dias = g.flat().filter(Boolean);
  assert.equal(dias.length, 29);
  assert.equal(dias.at(-1), "2028-02-29");
  assert.deepEqual(g[0].slice(0, 2), [null, null]); // domingo e segunda antes do dia 1
  assert.equal(g[0][2], "2028-02-01");
});

test("gradeDoMes: toda semana tem 7 células e os dias saem em ordem", () => {
  const g = gradeDoMes("2026-09");
  for (const semana of g) assert.equal(semana.length, 7);
  const dias = g.flat().filter(Boolean);
  assert.deepEqual(dias, [...dias].sort());
  assert.equal(dias.length, 30);
});

test("gradeDoMes devolve vazio para entrada que não é mês", () => {
  assert.deepEqual(gradeDoMes(""), []);
  assert.deepEqual(gradeDoMes(undefined), []);
});

// ── Filtros ─────────────────────────────────────────────────────────────────

const CTX = { slugs: ["atma", "tapepro"], responsaveis: ["jean", "maria"] };

test("lerFiltros: valor desconhecido vira SEM filtro, nunca filtro que não casa", () => {
  const f = lerFiltros({ projeto: "nao-existe", responsavel: "fulano", canal: "tiktok" }, CTX);
  assert.equal(f.projeto, "");
  assert.equal(f.responsavel, "");
  assert.equal(f.canal, "");
});

test("lerFiltros aceita o que existe e cai no padrão no resto", () => {
  const f = lerFiltros({ projeto: "atma", responsavel: "maria", canal: "blog" }, CTX);
  assert.equal(f.projeto, "atma");
  assert.equal(f.responsavel, "maria");
  assert.equal(f.canal, "blog");
  assert.equal(f.vista, "kanban"); // padrão
  assert.equal(f.arquivados, "0"); // padrão
  assert.equal(f.mes, "");
});

test("lerFiltros valida a vista e o mês", () => {
  assert.equal(lerFiltros({ vista: "calendario" }, CTX).vista, "calendario");
  assert.equal(lerFiltros({ vista: "docs" }, CTX).vista, "docs");
  assert.equal(lerFiltros({ vista: "planilha" }, CTX).vista, "kanban");
  assert.equal(lerFiltros({ mes: "2026-09" }, CTX).mes, "2026-09");
  assert.equal(lerFiltros({ mes: "2026-13" }, CTX).mes, "");
  assert.equal(lerFiltros({ mes: "setembro" }, CTX).mes, "");
});

test("lerFiltros lê o primeiro valor quando a querystring repete a chave", () => {
  assert.equal(lerFiltros({ projeto: ["atma", "tapepro"] }, CTX).projeto, "atma");
});

test("filtrosAtivos ignora vista, mês e arquivados — navegação não é filtro", () => {
  const f = lerFiltros({ vista: "calendario", mes: "2026-09", arquivados: "1" }, CTX);
  assert.deepEqual(filtrosAtivos(f), []);
  assert.deepEqual(filtrosAtivos({ ...f, projeto: "atma", canal: "blog" }), ["projeto", "canal"]);
});

test("comFiltro omite os valores padrão para o link ficar curto", () => {
  const f = lerFiltros({ projeto: "atma" }, CTX);
  assert.equal(comFiltro(f, "canal", "blog"), "?projeto=atma&canal=blog");
  assert.equal(comFiltro(f, "projeto", ""), "?");
  // vista=kanban e arquivados=0 são padrão: não entram na URL
  assert.equal(comFiltro(f, "vista", "kanban"), "?projeto=atma");
  assert.equal(comFiltro(f, "vista", "docs"), "?projeto=atma&vista=docs");
  assert.equal(comFiltro(f, "arquivados", "1"), "?projeto=atma&arquivados=1");
});

const CARDS = [
  { id: 1, titulo: "Post sobre órteses", projeto: "atma", responsavel: "maria", canal: "blog", coluna_id: 10, data: "2026-09-02", tipo: "card" },
  { id: 2, titulo: "Reels do lançamento", projeto: "tapepro", responsavel: "jean", canal: "instagram", coluna_id: 11, data: "2026-09-02", tipo: "card" },
  { id: 3, titulo: "Sem data ainda", projeto: null, responsavel: null, canal: "blog", coluna_id: 10, data: null, tipo: "card" },
  { id: 4, titulo: "Como a casa publica", projeto: null, responsavel: "maria", canal: null, coluna_id: null, data: null, tipo: "doc" },
];

test("filtrar casa texto sem acento sobre título, projeto e descrição", () => {
  assert.deepEqual(filtrar(CARDS, { q: "orteses" }).map((c) => c.id), [1]);
  assert.deepEqual(filtrar(CARDS, { q: "ÓRTESES" }).map((c) => c.id), [1]);
  assert.deepEqual(filtrar(CARDS, { q: "tapepro" }).map((c) => c.id), [2]);
  assert.deepEqual(
    filtrar([{ titulo: "x", descricao: "pauta de setembro" }], { q: "setembro" }).length,
    1,
  );
});

test("filtrar combina projeto, responsável e canal", () => {
  assert.deepEqual(filtrar(CARDS, { canal: "blog" }).map((c) => c.id), [1, 3]);
  assert.deepEqual(filtrar(CARDS, { responsavel: "maria" }).map((c) => c.id), [1, 4]);
  assert.deepEqual(filtrar(CARDS, { projeto: "atma", canal: "blog" }).map((c) => c.id), [1]);
  assert.deepEqual(filtrar(CARDS, {}).length, CARDS.length);
});

// ── Agrupamento ─────────────────────────────────────────────────────────────

const COLUNAS = [
  { id: 10, nome: "Pauta", ordem: 0 },
  { id: 11, nome: "Produzindo", ordem: 1 },
  { id: 12, nome: "Publicado", ordem: 2 },
];

test("agruparPorColuna devolve a coluna vazia — o filtro não esconde a etapa (FR-030)", () => {
  const g = agruparPorColuna(filtrar(CARDS, { canal: "instagram" }), COLUNAS);
  assert.equal(g.length, 3); // as três continuam na saída
  assert.deepEqual(g.map((x) => x.cards.length), [0, 1, 0]);
  assert.deepEqual(g.map((x) => x.coluna.nome), ["Pauta", "Produzindo", "Publicado"]);
});

test("agruparPorColuna não põe documento em coluna nenhuma (FR-026)", () => {
  const ids = agruparPorColuna(CARDS, COLUNAS).flatMap((x) => x.cards.map((c) => c.id));
  assert.ok(!ids.includes(4));
});

test("agruparPorDia: card sem data não aparece em dia nenhum (FR-025)", () => {
  const dias = agruparPorDia(CARDS, "2026-09");
  assert.deepEqual(Object.keys(dias), ["2026-09-02"]);
  assert.deepEqual(dias["2026-09-02"].map((c) => c.id), [1, 2]);
  // o card 3 não sumiu do sistema, só não tem dia
  assert.ok(CARDS.some((c) => c.id === 3));
});

test("agruparPorDia só traz o mês pedido, e documento nunca entra", () => {
  const cards = [
    { id: 1, data: "2026-09-30", tipo: "card" },
    { id: 2, data: "2026-10-01", tipo: "card" },
    { id: 3, data: "2026-09-15", tipo: "doc" },
  ];
  assert.deepEqual(Object.keys(agruparPorDia(cards, "2026-09")), ["2026-09-30"]);
  assert.deepEqual(Object.keys(agruparPorDia(cards, "2026-10")), ["2026-10-01"]);
});

// ── Retenção ────────────────────────────────────────────────────────────────

const HOJE = "2026-09-30";
const diasAntes = (n) => new Date(Date.parse(HOJE + "T00:00:00Z") - n * 86_400_000);

test("podeLiberar: 29 dias não, 30 dias sim", () => {
  assert.equal(podeLiberar({ arquivado_em: diasAntes(29) }, HOJE), false);
  assert.equal(podeLiberar({ arquivado_em: diasAntes(30) }, HOJE), true);
  assert.equal(podeLiberar({ arquivado_em: diasAntes(365) }, HOJE), true);
  assert.equal(ANEXO_CARENCIA_DIAS, 30);
});

test("podeLiberar: card não arquivado nunca libera — a carência conta do arquivamento (FR-035)", () => {
  assert.equal(podeLiberar({ arquivado_em: null }, HOJE), false);
  assert.equal(podeLiberar({}, HOJE), false);
  assert.equal(podeLiberar(null, HOJE), false);
  // arte enviada há um ano num card ativo continua intocada
  assert.equal(podeLiberar({ arquivado_em: null, criado: diasAntes(365) }, HOJE), false);
});

test("podeLiberar aceita string ISO do banco tanto quanto Date", () => {
  assert.equal(podeLiberar({ arquivado_em: "2026-08-01T10:00:00Z" }, "2026-09-30T10:00:00Z"), true);
  assert.equal(podeLiberar({ arquivado_em: "2026-09-25T10:00:00Z" }, "2026-09-30T10:00:00Z"), false);
  assert.equal(podeLiberar({ arquivado_em: "não é data" }, HOJE), false);
});

test("dataDeLiberacao é o arquivamento + 30 dias, e null enquanto o card está ativo", () => {
  assert.equal(dataDeLiberacao({ arquivado_em: "2026-09-01T00:00:00Z" }), "2026-10-01");
  assert.equal(dataDeLiberacao({ arquivado_em: "2026-12-15T00:00:00Z" }), "2027-01-14");
  assert.equal(dataDeLiberacao({ arquivado_em: null }), null);
  assert.equal(dataDeLiberacao({}), null);
});

test("resumoDeEspaco conta só o que ainda ocupa espaço (FR-036)", () => {
  const anexos = [
    { tamanho: 1000, liberado_em: null },
    { tamanho: 2000, liberado_em: null },
    { tamanho: 5000, liberado_em: "2026-09-01T00:00:00Z" }, // liberado: a linha fica, os bytes não
    { tamanho: 7000, bytes: null },
  ];
  assert.deepEqual(resumoDeEspaco(anexos), { ativos: 2, bytes: 3000, liberados: 2 });
  assert.deepEqual(resumoDeEspaco([]), { ativos: 0, bytes: 0, liberados: 0 });
});

test("tamanhoHumano não vira tabela", () => {
  assert.equal(tamanhoHumano(0), "0 B");
  assert.equal(tamanhoHumano(900), "900 B");
  assert.equal(tamanhoHumano(2048), "2 kB");
  assert.equal(tamanhoHumano(3 * 1024 * 1024), "3,0 MB");
});

test("os canais oferecidos incluem os três pedidos e uma saída aberta", () => {
  for (const c of ["blog", "instagram", "facebook", "outro"]) assert.ok(CANAL_IDS.includes(c));
});
