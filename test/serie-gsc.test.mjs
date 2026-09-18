import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  janelaDaCorrida, diasParaGravar, mesesDaSerie, DIAS_BACKFILL,
  janelaDeFoco, reguaDeMeses, SEMANAS_DE_FOCO,
} from "../lib/serie-gsc.mjs";

const AGORA = Date.parse("2026-09-07T12:00:00Z");
const HOJE = "2026-09-07";

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
test("módulo é puro: sem process.env, e todo Date.now() é default de parâmetro", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/serie-gsc.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  const total = (src.match(/Date\.now\(\)/g) ?? []).length;
  const comoDefault = (src.match(/=\s*Date\.now\(\)/g) ?? []).length;
  assert.equal(total, comoDefault, "todo Date.now() tem que ser default de parâmetro");
});

// ── janelaDaCorrida ─────────────────────────────────────────────────────────────────────────
test("sem linha gravada, a janela é o backfill dos 16 meses", () => {
  const j = janelaDaCorrida(null, AGORA);
  assert.equal(j.backfill, true);
  assert.equal(j.fim, HOJE);
  assert.equal(j.inicio, new Date(AGORA - DIAS_BACKFILL * 864e5).toISOString().slice(0, 10));
});

test("com linha gravada, a janela começa NO último dia gravado — não no seguinte", () => {
  // O último gravado pode ter sido colhido dentro da janela de D-3, quando o GSC ainda não
  // fechou a contagem. Começar em ultimoDia+1 congelaria o valor provisório para sempre —
  // é o caso medido no atma (30/07 saiu com 30 impressões e fechou em 827).
  const j = janelaDaCorrida("2026-09-05", AGORA);
  assert.equal(j.inicio, "2026-09-05");
  assert.equal(j.fim, HOJE);
  assert.equal(j.backfill, false);
});

test("último dia igual a hoje ainda regrava hoje (janela de um dia, nunca vazia)", () => {
  const j = janelaDaCorrida(HOJE, AGORA);
  assert.equal(j.inicio, HOJE);
  assert.equal(j.fim, HOJE);
});

test("último dia no FUTURO não encolhe a janela para trás", () => {
  // Relógio torto ou fuso do banco não pode fazer a série parar de crescer em silêncio.
  const j = janelaDaCorrida("2026-12-31", AGORA);
  assert.equal(j.inicio, HOJE);
  assert.equal(j.fim, HOJE);
  assert.ok(j.inicio <= j.fim, "início nunca pode passar do fim");
});

test("uma lacuna longa é coberta inteira, não só os últimos dias", () => {
  const j = janelaDaCorrida("2026-06-01", AGORA);
  assert.equal(j.inicio, "2026-06-01");
  assert.equal(j.fim, HOJE);
});

// ── diasParaGravar ──────────────────────────────────────────────────────────────────────────
test("mapeia os dias do GSC para a forma da tabela", () => {
  const dias = diasParaGravar([{ date: "2026-09-01", clicks: 3, impressions: 120, position: 8.4 }]);
  assert.deepEqual(dias, [{ dia: "2026-09-01", impressoes: 120, cliques: 3, posicao: 8.4 }]);
});

test("posição ausente vira null, NUNCA 0", () => {
  // Posição 0 não existe no Google: gravá-la faria a melhor posição possível representar
  // "não medido" — a inversão que `nao_apurado` existe para impedir em toda a casa.
  const [d] = diasParaGravar([{ date: "2026-09-01", clicks: 0, impressions: 0 }]);
  assert.equal(d.posicao, null);
  assert.notEqual(d.posicao, 0);
});

test("linha sem data é descartada", () => {
  assert.equal(diasParaGravar([{ date: "", clicks: 1, impressions: 1, position: 2 }]).length, 0);
});

test("série vazia devolve lista vazia, sem estourar", () => {
  assert.deepEqual(diasParaGravar([]), []);
});

// ── mesesDaSerie (028 · a forma dos 8 meses de Descoberta) ──────────────────────────────────
test("só o mês inteiramente coberto pela janela recebe valor — as pontas saem `coberto: false`", () => {
  // Janela real da tela: 2026-01-15 → 2026-09-15. Janeiro e setembro são pontas.
  const janela = { inicio: "2026-01-15", fim: "2026-09-15" };
  const meses = mesesDaSerie(
    [
      { date: "2026-01-20", impressions: 10, clicks: 1 },
      { date: "2026-02-03", impressions: 5, clicks: 0 },
      { date: "2026-02-28", impressions: 7, clicks: 2 },
      { date: "2026-09-11", impressions: 63, clicks: 5 },
    ],
    janela,
  );
  assert.deepEqual(
    meses.map((m) => [m.mes, m.coberto, m.impressoes]),
    [
      ["2026-01", false, 10],
      ["2026-02", true, 12],
      ["2026-09", false, 63],
    ],
  );
  // fevereiro de 2026 tem 28 dias, e o mês fechou com 2 dias de linha: segue COBERTO.
  assert.equal(meses[1].fim, "2026-02-28");
  assert.equal(meses[1].diasComLinha, 2);
  assert.equal(meses[1].cliques, 2);
});

test("mês coberto com zero impressão é ZERO MEDIDO, não ausência — o valor sai 0 e `coberto` fica true", () => {
  // Medido em roilabs.com.br em 18/09: jan, fev e mar devolveram linha com 0 impressão. Se o mês
  // caísse em "sem dado" por não ter linha em todo dia, o gráfico esconderia justamente os meses
  // em que o site não foi visto — que são a informação.
  const meses = mesesDaSerie(
    [
      { date: "2026-03-02", impressions: 0, clicks: 0 },
      { date: "2026-03-19", impressions: 0, clicks: 0 },
    ],
    { inicio: "2026-01-15", fim: "2026-09-15" },
  );
  assert.equal(meses.length, 1);
  assert.equal(meses[0].coberto, true);
  assert.equal(meses[0].impressoes, 0);
  assert.equal(meses[0].diasComLinha, 2);
});

test("bissexto sai do calendário, não de tabela à mão: fevereiro de 2024 fecha em 29", () => {
  const meses = mesesDaSerie([{ date: "2024-02-10", impressions: 1 }], { inicio: "2024-02-01", fim: "2024-03-31" });
  assert.equal(meses[0].fim, "2024-02-29");
  assert.equal(meses[0].coberto, true);
});

test("série vazia ou nula não quebra e não inventa mês", () => {
  assert.deepEqual(mesesDaSerie([], { inicio: "2026-01-15", fim: "2026-09-15" }), []);
  assert.deepEqual(mesesDaSerie(null, { inicio: "2026-01-15", fim: "2026-09-15" }), []);
});

test("a janela que decide é a RECEBIDA: o mês de estreia da propriedade não é mês inteiro", () => {
  // Medido em goiania.roilabs.com.br em 18/09: a propriedade só tem dado desde 28/06, e a janela
  // PEDIDA (15/01 → 15/09) cobre junho inteiro. Contra a pedida, junho saía `coberto` com os 7
  // impressões dos seus 3 dias e desenhava uma barra ao lado dos 292 de julho — a leitura de
  // queda que a função existe para impedir, entrando pela porta do denominador.
  const days = [
    { date: "2026-06-28", impressions: 7 },
    { date: "2026-07-15", impressions: 292 },
    { date: "2026-08-15", impressions: 520 },
    { date: "2026-09-10", impressions: 388 },
  ];
  const pedida = { inicio: "2026-01-15", fim: "2026-09-15" };
  const recebida = { inicio: "2026-06-28", fim: "2026-09-15" };
  assert.deepEqual(
    mesesDaSerie(days, pedida).map((m) => [m.mes, m.coberto]),
    [["2026-06", true], ["2026-07", true], ["2026-08", true], ["2026-09", false]],
    "contra a janela pedida, junho passa por inteiro — é o defeito",
  );
  assert.deepEqual(
    mesesDaSerie(days, recebida).map((m) => [m.mes, m.coberto]),
    [["2026-06", false], ["2026-07", true], ["2026-08", true], ["2026-09", false]],
    "contra a recebida, sobram os dois meses que a fonte cobriu do primeiro ao último dia",
  );
});

test("as pontas saem CORTADAS pela janela — o eixo não promete dado que a série não tem", () => {
  // O rótulo da ponta direita vem de `fim`. Sem o corte, uma série que fecha em 15/09 rotularia
  // o eixo com 30/09 e prometeria duas semanas que ninguém mediu.
  const meses = mesesDaSerie(
    [{ date: "2026-06-28", impressions: 7 }, { date: "2026-09-10", impressions: 388 }],
    { inicio: "2026-06-28", fim: "2026-09-15" },
  );
  assert.equal(meses[0].inicio, "2026-06-28");
  assert.equal(meses[meses.length - 1].fim, "2026-09-15");
  // O mês do meio, inteiro dentro da janela, mantém as bordas do calendário.
  const cheio = mesesDaSerie([{ date: "2026-07-15", impressions: 1 }], { inicio: "2026-06-28", fim: "2026-09-15" })[0];
  assert.deepEqual([cheio.inicio, cheio.fim, cheio.coberto], ["2026-07-01", "2026-07-31", true]);
});

// ── janelaDeFoco / reguaDeMeses (030) ───────────────────────────────────────────────────────
/** A série semanal REAL da atma, lida de `hub_gsc_dia` em 18/09: impressões não-marca por semana
 *  ISO, com as duas pontas parciais em `null` como o gráfico as recebe. É a regressão: é esta
 *  série que o eixo compartilhado esmagava. */
const ATMA = [
  null, 3009, 5520, 5107, 5799, 5012, 5293, 4623, 5119, 7419, 9647, 9408, 11579,
  17020, 16225, 6454, 5616, 6043, 5586, 5670, 4624, 4079, 1754, 509, 28, 7, 0, 0, 2,
  974, 2081, 4129, 4121, 3447, 1449, 1492, null,
].map((value, i) => {
  const dia = new Date(Date.UTC(2026, 0, 5) + i * 7 * 864e5).toISOString().slice(0, 10);
  return { start: dia, end: dia, value };
});

test("atma: o foco pega as 13 últimas e a escala cai de 17.020 para 4.129", () => {
  const f = janelaDeFoco(ATMA);
  assert.ok(f, "série de 37 slots com pico 11x a última tem foco");
  assert.equal(f.fim, ATMA.length - 1);
  assert.equal(f.fim - f.inicio + 1, SEMANAS_DE_FOCO);
  assert.equal(f.max, 4129);
  assert.equal(f.maxSerie, 17020);
  assert.equal(Math.round(f.vezesAbaixo * 10) / 10, 4.1);
});

test("a última semana completa sai de 5 para 20 unidades de um plot de 56", () => {
  const f = janelaDeFoco(ATMA);
  const ultima = 1492;
  assert.equal(Math.round((ultima / f.maxSerie) * 56), 5, "escala compartilhada: 5 de 56");
  assert.equal(Math.round((ultima / f.max) * 56), 20, "escala do foco: 20 de 56");
});

test("série curta não ganha foco — ele SERIA a série", () => {
  // Pico no PRIMEIRO slot, fora do foco em qualquer comprimento: assim só a guarda de
  // comprimento pode reprovar, e o teste mede ela e não o teto de 80%.
  const comPico = (n) =>
    Array.from({ length: n }, (_, i) => ({ start: `2026-0${1 + Math.floor(i / 4)}-0${1 + (i % 4)}`, value: i === 0 ? 17020 : 1000 + i }));
  assert.equal(janelaDeFoco(comPico(SEMANAS_DE_FOCO + 2)), null, "13+2 slots: o foco seria a série");
  assert.ok(janelaDeFoco(comPico(SEMANAS_DE_FOCO + 3)), "um slot a mais e há o que ampliar");
});

test("pico DENTRO do foco não ganha foco: não há esmagamento a desfazer", () => {
  // As 16 últimas da atma contêm o pico do recorte (4.129) dentro das 13 finais — a escala
  // compartilhada dessa série já é a escala do foco, e dois gráficos diriam a mesma coisa.
  const f = janelaDeFoco(ATMA.slice(-(SEMANAS_DE_FOCO + 3)));
  assert.equal(f, null);
});

test("série sem esmagamento não ganha foco: o topo do foco já usa mais de 80% da escala", () => {
  const plana = ATMA.map((p, i) => ({ ...p, value: i === 0 ? null : 1000 }));
  assert.equal(janelaDeFoco(plana), null);
  // 0,8 é o corte: com o pico em 1.200 o foco usa 83% e não há foco; com 1.300 usa 77% e há.
  const quase = plana.map((p, i) => (i === 5 ? { ...p, value: 1200 } : p));
  assert.equal(janelaDeFoco(quase), null);
  const esmagada = plana.map((p, i) => (i === 5 ? { ...p, value: 1300 } : p));
  assert.ok(janelaDeFoco(esmagada));
});

test("foco sem dois valores medidos é null, não um foco de uma barra só", () => {
  const pontas = ATMA.map((p, i) => (i >= ATMA.length - SEMANAS_DE_FOCO + 1 ? { ...p, value: null } : p));
  assert.equal(janelaDeFoco(pontas), null);
});

test("série em que só o zero foi medido não tem foco (nem pico para medir contra)", () => {
  assert.equal(janelaDeFoco(ATMA.map((p) => ({ ...p, value: 0 }))), null);
  assert.equal(janelaDeFoco([]), null);
  assert.equal(janelaDeFoco(null), null);
});

test("a régua põe um tique por mês e o ANO só quando muda", () => {
  const r = reguaDeMeses(ATMA);
  assert.deepEqual(r.map((t) => t.rotulo), ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set"]);
  assert.equal(r[0].index, 0);
  assert.equal(r[0].ano, "2026");
  assert.deepEqual(r.slice(1).map((t) => t.ano), [null, null, null, null, null, null, null, null]);
  // O tique de abril cai no slot 13, que é o do pico (06/04) — é ele que torna a data localizável.
  assert.equal(r[3].index, 13);
});

test("série que atravessa o réveillon marca o ano no segundo janeiro", () => {
  const pontos = ["2026-12-07", "2026-12-14", "2026-12-28", "2027-01-04", "2027-01-11"].map((start) => ({ start, value: 10 }));
  const r = reguaDeMeses(pontos);
  assert.deepEqual(r.map((t) => [t.rotulo, t.ano]), [["dez", "2026"], ["jan", "2027"]]);
});

test("slot sem data ou com mês fora de 1..12 não produz tique", () => {
  assert.deepEqual(reguaDeMeses([{ value: 1 }, { start: "2026-13-01", value: 1 }, { start: "", value: 1 }]), []);
  assert.deepEqual(reguaDeMeses(null), []);
});
