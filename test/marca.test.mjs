import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  regexDeMarca,
  marcaDeclarada,
  adensarDias,
  completude,
  mesesFechados,
  crescimentoNaoMarca,
  variacao,
  causaDaAusencia,
  linhaDeCrescimento,
  razaoDeMarca,
  semanasNaoMarca,
  ritmoNaoMarca,
  segmentosPorHost,
  ritmoDoSegmentoAtual,
} from "../lib/marca.mjs";

const casa = (termos, consulta) => new RegExp(regexDeMarca(termos), "i").test(consulta);

// ── a regra de casamento (D3) ───────────────────────────────────────────────────────────────
// A tabela inteira da quickstart §2. Cada linha aqui é uma contagem errada que não vai acontecer.
test("termo exato casa", () => {
  assert.equal(casa(["atma", "atma aligner"], "atma"), true);
});

test("termo composto casa", () => {
  assert.equal(casa(["atma", "atma aligner"], "atma aligner"), true);
});

test("o casamento ignora caixa", () => {
  assert.equal(casa(["atma", "atma aligner"], "ATMA Aligner"), true);
});

test("o termo casa no MEIO da consulta", () => {
  assert.equal(casa(["atma", "atma aligner"], "preço atma alinhador"), true);
});

// O teste que impede a marca de comer não-marca: sem `\b` no fim, `atmasfera` (e toda palavra que
// só COMEÇA com o termo) entraria em marca e o não-marca sairia subcontado — para o lado que agrada.
test("palavra que apenas começa com o termo NÃO casa", () => {
  assert.equal(casa(["atma", "atma aligner"], "atmasfera"), false);
});

test("consulta genérica NÃO casa", () => {
  assert.equal(casa(["atma", "atma aligner"], "alinhador invisível"), false);
});

// A asserção que fecha a D3. Alternação é *leftmost-first*: com o termo curto na frente,
// `atma aligner` casaria só o pedaço `atma`, o padrão continuaria "funcionando", e o erro só
// apareceria numa contagem meses depois.
test("o termo LONGO vem primeiro na alternação", () => {
  const p = regexDeMarca(["atma", "atma aligner"]);
  assert.ok(
    p.indexOf("atma aligner") < p.indexOf("|atma)") || p.indexOf("atma aligner") < p.lastIndexOf("atma"),
    `padrão com o termo curto na frente: ${p}`,
  );
  assert.match("atma aligner", new RegExp("^(?:" + p + ")$", "i"), "o padrão tem que casar o termo longo INTEIRO");
});

test("o padrão sai sem flags e sem barras — os dois consumidores escolhem as suas", () => {
  const p = regexDeMarca(["atma"]);
  assert.equal(p.startsWith("/"), false);
  assert.equal(p.includes("(?i)"), false, "o (?i) é prefixado pela CORRIDA, não gravado no padrão");
});

test("termos repetidos ou vazios não duplicam nem furam o padrão", () => {
  const p = regexDeMarca(["atma", "atma", "  ", "", "atma"]);
  assert.equal(casa(["atma", "atma", "  ", ""], "atma"), true);
  assert.equal(p.includes("||"), false, `alternativa vazia casaria TUDO: ${p}`);
});

// Termo com metacaractere: sem escape, um `.` no nome do projeto viraria "qualquer caractere" e o
// padrão casaria consultas que ninguém declarou — ou estouraria em tempo de execução.
test("metacaractere no termo é escapado", () => {
  assert.equal(casa(["a.b"], "comprar a.b hoje"), true);
  assert.equal(casa(["a.b"], "comprar axb hoje"), false, "o ponto virou curinga e comeu não-marca");
});

// ── a declaração do card ────────────────────────────────────────────────────────────────────
// Três motivos e não um `null` mudo: "não curei ainda" e "curei errado" pedem consertos opostos.
test("declaração válida devolve termos, país e padrão", () => {
  const m = marcaDeclarada({ marca: { termos: ["atma"], pais: "bra", declaradaEm: "2026-09-08" } });
  assert.equal(m.motivo, null);
  assert.deepEqual(m.termos, ["atma"]);
  assert.equal(m.pais, "bra");
  assert.equal(m.padrao, regexDeMarca(["atma"]));
  assert.equal(m.declaradaEm, "2026-09-08");
});

test("card sem `marca` é `ausente`, nunca zero busca de marca", () => {
  assert.equal(marcaDeclarada({ slug: "sirius" }).motivo, "ausente");
  assert.equal(marcaDeclarada({ slug: "sirius" }).termos, undefined);
});

test("lista vazia é `sem-termos`", () => {
  assert.equal(marcaDeclarada({ marca: { termos: [], pais: "bra" } }).motivo, "sem-termos");
  assert.equal(marcaDeclarada({ marca: { termos: ["  "], pais: "bra" } }).motivo, "sem-termos");
});

// Sem corte de país a razão sai contaminada: o total do GSC é mundial. Meia-medição é pior que
// ausência, porque parece medida.
test("declaração sem país é `sem-pais`, não meia-medição", () => {
  assert.equal(marcaDeclarada({ marca: { termos: ["atma"] } }).motivo, "sem-pais");
  assert.equal(marcaDeclarada({ marca: { termos: ["atma"], pais: " " } }).motivo, "sem-pais");
});

test("os três motivos são distintos entre si", () => {
  const motivos = [
    marcaDeclarada({}).motivo,
    marcaDeclarada({ marca: { termos: [], pais: "bra" } }).motivo,
    marcaDeclarada({ marca: { termos: ["atma"] } }).motivo,
  ];
  assert.equal(new Set(motivos).size, 3, "dois motivos colapsados apontariam para o conserto errado");
});

// ── US1: o adensamento e a conferência ──────────────────────────────────────────────────────
// O GSC OMITE o dia sem impressão. Sem o adensamento, "nenhuma busca de marca nesse dia" e "não
// declarada" ficariam indistinguíveis DENTRO do banco — a inversão da FR-004 pelo lado de dentro.
test("adensarDias devolve TODOS os dias da janela pedida", () => {
  const d = adensarDias("2026-03-01", "2026-03-05", [{ date: "2026-03-03", impressions: 9, clicks: 2 }]);
  assert.deepEqual(
    d.map((x) => x.dia),
    ["2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04", "2026-03-05"],
  );
});

test("dia sem linha vira ZERO, nunca ausência", () => {
  const d = adensarDias("2026-03-01", "2026-03-03", [{ date: "2026-03-02", impressions: 9, clicks: 2 }]);
  assert.deepEqual(d[0], { dia: "2026-03-01", impressoes: 0, cliques: 0 });
  assert.deepEqual(d[1], { dia: "2026-03-02", impressoes: 9, cliques: 2 });
  assert.deepEqual(d[2], { dia: "2026-03-03", impressoes: 0, cliques: 0 });
});

test("linha FORA da janela pedida não entra", () => {
  const d = adensarDias("2026-03-01", "2026-03-02", [{ date: "2026-02-28", impressions: 500, clicks: 50 }]);
  assert.equal(d.length, 2);
  assert.equal(d.reduce((a, x) => a + x.impressoes, 0), 0, "dia de fora inflaria a janela");
});

test("janela invertida devolve lista vazia, não um laço infinito", () => {
  assert.deepEqual(adensarDias("2026-03-05", "2026-03-01", []), []);
});

// ── completude: QUATRO estados, e nunca três ────────────────────────────────────────────────
const dia = (pais, marca, naoMarca) => ({
  impressoesPais: pais,
  impressoesMarca: marca,
  impressoesNaoMarca: naoMarca,
});

test("resíduo zero é `fecha`", () => {
  const c = completude([dia(100, 40, 60), dia(50, 20, 30)]);
  assert.equal(c.estado, "fecha");
  assert.equal(c.residuo, 0);
});

test("resíduo positivo é `piso`, com o tamanho da diferença", () => {
  const c = completude([dia(100, 40, 55)]);
  assert.equal(c.estado, "piso");
  assert.equal(c.residuo, 5);
  assert.equal(c.fracao, 0.05);
});

// A asserção que separa dois consertos OPOSTOS. Resíduo negativo é as pernas somando MAIS que o
// total: defeito de filtro, não limitação da fonte. Colapsá-lo em `piso` faria um bug de regex se
// disfarçar de anonimização — e sair na tela como ressalva educada em vez de alarme.
test("resíduo negativo é `contradicao` e NUNCA colapsa em piso", () => {
  const c = completude([dia(100, 60, 55)]);
  assert.equal(c.estado, "contradicao");
  assert.equal(c.residuo, -15);
  assert.notEqual(c.estado, "piso");
});

test("resíduo negativo não é arredondado para zero", () => {
  assert.equal(completude([dia(100, 51, 50)]).estado, "contradicao");
  assert.notEqual(completude([dia(100, 51, 50)]).estado, "fecha");
});

test("nenhum dia declarado é `nao-declarada`, nunca `fecha` com resíduo 0", () => {
  assert.equal(completude([]).estado, "nao-declarada");
  assert.equal(completude([dia(null, null, null)]).estado, "nao-declarada");
  assert.equal(completude([{ impressoes: 10, cliques: 1 }]).estado, "nao-declarada");
});

test("dia com as sete colunas pela metade não entra na conferência", () => {
  const c = completude([dia(100, 40, 60), dia(80, null, 20)]);
  assert.equal(c.impressoesPais, 100, "dia meio-preenchido entraria só do lado do denominador");
  assert.equal(c.estado, "fecha");
});

// ── US2: as DUAS formas de fabricar queda (D9) ──────────────────────────────────────────────
// A série da quickstart §3: de 11/01 a 31/03. Janeiro entra com 21 dos 31 dias.
function serieDe(inicio, fim, porDia = 10) {
  const dias = [];
  for (let t = Date.parse(inicio + "T00:00:00Z"); t <= Date.parse(fim + "T00:00:00Z"); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    dias.push({ dia: d, impressoesPais: porDia * 2, impressoesMarca: porDia, impressoesNaoMarca: porDia });
  }
  return dias;
}
const serie = serieDe("2026-01-11", "2026-03-31");

// (1) Mês parcial NÃO existe na lista — nem com uma marca de "incompleto" que alguém compararia.
// Se janeiro entrasse, fevereiro apareceria com um crescimento que é só calendário.
test("mês com calendário incompleto fica FORA dos meses fechados", () => {
  assert.deepEqual(
    mesesFechados(serie, "2026-04-05").map((m) => m.mes),
    ["2026-02", "2026-03"],
  );
});

// (2) Ponta provisória fora: sem os 3 dias de folga o GSC ainda vai SUBIR os últimos dias do mês,
// e o mês entraria subcontado — queda fabricada pela segunda via.
test("mês sem os três dias de folga também sai", () => {
  assert.deepEqual(
    mesesFechados(serie, "2026-04-01").map((m) => m.mes),
    ["2026-02"],
    "março fechou no calendário mas o GSC ainda não fechou a contagem",
  );
});

test("o dia exato da folga já conta como fechado", () => {
  assert.ok(mesesFechados(serie, "2026-04-03").some((m) => m.mes === "2026-03"));
});

test("mês fechado carrega o somatório de não-marca e a contagem de dias", () => {
  const fev = mesesFechados(serie, "2026-04-05").find((m) => m.mes === "2026-02");
  assert.equal(fev.dias, 28);
  assert.equal(fev.impressoesNaoMarca, 280);
});

// 045 — a folha de marca do board lê o volume MENSAL de marca pela mesma régua de calendário.
test("mesesFechados soma a coluna pedida e devolve com o nome dela", () => {
  const dias = serie.map((d) => ({ ...d, impressoesMarca: d.dia.startsWith("2026-03") ? 0 : 7 }));
  const [fev, mar] = mesesFechados(dias, "2026-04-05", "impressoesMarca");
  assert.deepEqual([fev.mes, fev.impressoesMarca, fev.diasZero], ["2026-02", 196, 0]);
  assert.deepEqual([mar.mes, mar.impressoesMarca, mar.diasZero], ["2026-03", 0, 31]);
  assert.equal(fev.impressoesNaoMarca, undefined, "a coluna de não-marca não vaza para a leitura de marca");
});

// (3) Primeiro mês fechado: "ainda não apurável", NUNCA 0% — um zero aqui viraria uma queda de
// 100% na tela e mandaria consertar um problema que não existe (FR-009).
test("crescimento com UM só mês fechado é `poucos-meses`, e explicitamente não é 0", () => {
  const um = serieDe("2026-02-01", "2026-02-28");
  const c = crescimentoNaoMarca(um, "2026-04-05");
  assert.deepEqual(c, { estado: "poucos-meses", fechados: 1 });
  assert.equal(c.valor, undefined, "ler `.valor` sem checar o estado quebra à vista — 0 leria como estagnação medida");
});

test("crescimento compara os DOIS últimos meses fechados, nomeando os dois", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28", 10), ...serieDe("2026-03-01", "2026-03-31", 20)];
  const c = crescimentoNaoMarca(dias, "2026-04-05");
  assert.equal(c.de, "2026-02");
  assert.equal(c.para, "2026-03");
  assert.equal(c.valor, (31 * 20) / (28 * 10) - 1);
});

// A razão sozinha é ilegível quando a base é pequena: 342 → 14.689 vira "43×", que lê como
// crescimento e é recuperação de um mês quebrado. Os dois absolutos saem junto ou o veredito
// contra a meta do board é ruído formatado.
test("crescimento devolve os ABSOLUTOS dos dois meses, não só a razão", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28", 10), ...serieDe("2026-03-01", "2026-03-31", 20)];
  const c = crescimentoNaoMarca(dias, "2026-04-05");
  assert.equal(c.deImpressoes, 28 * 10);
  assert.equal(c.paraImpressoes, 31 * 20);
  assert.equal(c.paraImpressoes / c.deImpressoes - 1, c.valor, "os absolutos têm que reproduzir a razão");
});

test("o mês CORRENTE nunca entra na comparação", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28"), ...serieDe("2026-03-01", "2026-03-31"), ...serieDe("2026-04-01", "2026-04-10")];
  const c = crescimentoNaoMarca(dias, "2026-04-10");
  assert.equal(c.para, "2026-03");
  assert.notEqual(c.para, "2026-04");
});

// (4) Buraco na série: o mês do buraco fica incompleto pela regra (1) e não entra — e os dois que
// sobram não são consecutivos, então NÃO se comparam. Comparar janeiro com março chamaria de
// crescimento a soma de dois meses de calendário.
test("meses não consecutivos não se comparam", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28"), ...serieDe("2026-03-01", "2026-03-20"), ...serieDe("2026-04-01", "2026-04-30")];
  assert.deepEqual(
    mesesFechados(dias, "2026-05-05").map((m) => m.mes),
    ["2026-02", "2026-04"],
    "março tem 20 dos 31 e sai",
  );
  assert.deepEqual(crescimentoNaoMarca(dias, "2026-05-05"), { estado: "nao-consecutivos", de: "2026-02", para: "2026-04" });
});

test("dia sem medição de não-marca não conta como dia do mês", () => {
  const dias = serieDe("2026-02-01", "2026-02-28").map((d, i) =>
    i === 10 ? { ...d, impressoesNaoMarca: null, impressoesMarca: null, impressoesPais: null } : d,
  );
  assert.deepEqual(mesesFechados(dias, "2026-04-05"), [], "27 dias medidos não fecham fevereiro");
});

// ── razão de marca ──────────────────────────────────────────────────────────────────────────
test("razão de marca é marca ÷ total do país na janela", () => {
  assert.equal(razaoDeMarca([{ impressoesPais: 100, impressoesMarca: 40, impressoesNaoMarca: 55 }]), 0.4);
});

test("razão sem denominador ou sem dia declarado é null, NUNCA 0%", () => {
  assert.equal(razaoDeMarca([]), null);
  assert.equal(razaoDeMarca([{ impressoesPais: 0, impressoesMarca: 0, impressoesNaoMarca: 0 }]), null);
  assert.equal(razaoDeMarca([{ impressoes: 10, cliques: 1 }]), null, "não declarada não é 0% de marca");
});

// ── pureza (Princípio III) ──────────────────────────────────────────────────────────────────
// O corte do Princípio III é o que decide o sucesso desta feature: as quatro armadilhas são REGRAS
// e cabem em milissegundos aqui. Um `Date.now()` que entrasse depois faria `mesesFechados` mudar de
// resposta sem ninguém passar `hoje` — e a ponta provisória voltaria calada.
test("módulo é puro: sem process.env, sem relógio interno, sem import", () => {
  const bruto = readFileSync(fileURLToPath(new URL("../lib/marca.mjs", import.meta.url)), "utf8");
  const src = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /process\.env/, "módulo puro não pode ler ambiente");
  assert.doesNotMatch(src, /Date\.now\(\)/, "módulo puro não pode ler relógio");
  assert.doesNotMatch(src, /new Date\(\)/, "`new Date()` sem argumento é relógio interno");
  assert.doesNotMatch(src, /^import /m, "módulo puro não importa nada");
});

// ── a FORMA da série: semanas e ritmo (information-design, 18/09) ────────────────────────────
// Cada teste aqui é uma frase falsa que a tela não vai exibir.

/** Dias sintéticos a partir de um `YYYY-MM-DD` inicial, um valor por dia. */
const diasDe = (inicio, valores) =>
  valores.map((v, i) => ({
    dia: new Date(Date.parse(inicio + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10),
    impressoesNaoMarca: v,
    cliquesNaoMarca: 0,
    posicao: 5,
  }));

test("a semana começa na SEGUNDA, não no dia em que a série começa", () => {
  // 2026-01-11 é um domingo: ele pertence à semana que começou em 05/01.
  const s = semanasNaoMarca(diasDe("2026-01-11", [10, 20]));
  assert.equal(s.length, 2);
  assert.equal(s[0].inicio, "2026-01-05");
  assert.equal(s[1].inicio, "2026-01-12");
});

test("semana de ponta é PARCIAL, nunca soma com as de 7 dias", () => {
  const s = semanasNaoMarca(diasDe("2026-01-12", [1, 1, 1, 1, 1, 1, 1, 9, 9]));
  assert.equal(s[0].completa, true);
  assert.equal(s[0].dias, 7);
  assert.equal(s[1].completa, false);
  assert.equal(s[1].dias, 2);
});

test("a ponta parcial NÃO fabrica queda no ritmo", () => {
  // Sete semanas iguais (700) e uma ponta de 2 dias (200). Somada, a ponta leria como -71%.
  const r = ritmoNaoMarca(diasDe("2026-01-05", [...Array(49).fill(100), 100, 100]));
  assert.equal(r.semanasCompletas, 7);
  assert.equal(r.parciaisIgnoradas, 1);
  assert.equal(r.ultima.impressoesNaoMarca, 700);
  assert.equal(r.fracaoDoPico, 1);
});

test("dia com ZERO medido entra na semana; dia SEM a coluna não entra", () => {
  const s = semanasNaoMarca([
    { dia: "2026-01-05", impressoesNaoMarca: 0 },
    { dia: "2026-01-06", impressoesNaoMarca: null },
    { dia: "2026-01-07", impressoesNaoMarca: 5 },
  ]);
  assert.equal(s[0].dias, 2, "o dia sem medida não conta como medido");
  assert.equal(s[0].impressoesNaoMarca, 5);
  assert.equal(s[0].completa, false);
});

test("`quedasConsecutivas` é 0 quando a última semana SOBE — a tela não pode dizer 'caindo'", () => {
  // O caso real da atma: quatro semanas de recuo e a última subindo (1.449 → 1.492).
  const semanas = [4129, 4121, 3447, 1449, 1492];
  const r = ritmoNaoMarca(diasDe("2026-01-05", semanas.flatMap((v) => Array(7).fill(v / 7))));
  assert.equal(r.quedasConsecutivas, 0);
});

test("`quedasConsecutivas` conta só o recuo que chega ATÉ a última semana", () => {
  const semanas = [100, 900, 800, 700, 600];
  const r = ritmoNaoMarca(diasDe("2026-01-05", semanas.flatMap((v) => Array(7).fill(v / 7))));
  assert.equal(r.quedasConsecutivas, 3, "para no 100 → 900, que é subida");
});

test("o pico é o PRIMEIRO máximo — repetir o pico não reescreve a data dele", () => {
  const r = ritmoNaoMarca(diasDe("2026-01-05", [...Array(7).fill(10), ...Array(7).fill(10), ...Array(7).fill(1)]));
  assert.equal(r.pico.inicio, "2026-01-05");
});

test("`fracaoDoPico` mede a última contra o pico, e não contra a semana anterior", () => {
  const r = ritmoNaoMarca(diasDe("2026-01-05", [...Array(7).fill(100), ...Array(7).fill(10), ...Array(7).fill(20)]));
  assert.equal(r.ultima.impressoesNaoMarca, 140);
  assert.equal(r.pico.impressoesNaoMarca, 700);
  assert.equal(r.fracaoDoPico, 0.2);
});

test("menos de duas semanas completas é `null`, nunca um veredito sobre nada", () => {
  assert.equal(ritmoNaoMarca(diasDe("2026-01-05", Array(7).fill(1))), null);
  assert.equal(ritmoNaoMarca([]), null);
  assert.equal(ritmoNaoMarca(null), null);
});

// ── a base interrompida: a razão mensal que mede a VOLTA, não o crescimento ──────────────────

test("mês-base com um terço dos dias em zero marca `baseInterrompida`", () => {
  // Julho da atma: 27 dias de zero em 31, seguido de agosto cheio.
  const julho = diasDe("2026-07-01", [...Array(27).fill(0), ...Array(4).fill(85)]);
  const agosto = diasDe("2026-08-01", Array(31).fill(474));
  const c = crescimentoNaoMarca([...julho, ...agosto], "2026-09-10");
  assert.equal(c.baseInterrompida, true);
  assert.equal(c.diasZeroDe, 27);
  assert.equal(c.diasDe, 31);
});

test("mês-base normal NÃO é interrompido — um dia de zero não cala a medida", () => {
  const julho = diasDe("2026-07-01", [...Array(1).fill(0), ...Array(30).fill(100)]);
  const agosto = diasDe("2026-08-01", Array(31).fill(110));
  const c = crescimentoNaoMarca([...julho, ...agosto], "2026-09-10");
  assert.equal(c.baseInterrompida, false);
  assert.equal(c.diasZeroDe, 1);
});

// ── 036: o `null` que não dizia a causa, e a linha de topo do nó do mapa ─────────────────────────
// Quatro ausências com consertos opostos: esperar o calendário, investigar um buraco, aceitar que não
// há base, declarar a marca. Cada uma com a entrada MÍNIMA que a produz.

const jul = () => diasDe("2026-07-01", [...Array(27).fill(0), ...Array(4).fill(85)]);
const ago = () => diasDe("2026-08-01", Array(31).fill(474));

test("`nao-declarada`: série SEM impressoesNaoMarca — as de 33 dos 34 projetos", () => {
  // Só o total, sem a separação: é o que `hub_gsc_dia` guarda para quem não declara marca.
  const soTotal = serieDe("2026-01-11", "2026-08-31").map(({ dia }) => ({ dia, impressoes: 40, cliques: 1 }));
  assert.deepEqual(crescimentoNaoMarca(soTotal, "2026-09-20"), { estado: "nao-declarada" });
  assert.deepEqual(crescimentoNaoMarca([], "2026-09-20"), { estado: "nao-declarada" });
  assert.deepEqual(crescimentoNaoMarca(null, "2026-09-20"), { estado: "nao-declarada" });
});

test("`nao-declarada` ≠ `poucos-meses`: 238 dias sem a coluna NÃO acusam falta de calendário", () => {
  // O defeito que a 036 conserta: `mesesFechados` devolve [] para essa série, e o `null` antigo lia
  // "menos de dois meses fechados" onde a causa é a marca.
  const dias = serieDe("2026-01-11", "2026-09-05").map(({ dia }) => ({ dia, impressoes: 40, cliques: 1 }));
  assert.equal(dias.length, 238);
  assert.notEqual(crescimentoNaoMarca(dias, "2026-09-20").estado, "poucos-meses");
});

test("`poucos-meses` traz quantos fechados há, e zero é diferente de um", () => {
  assert.deepEqual(crescimentoNaoMarca(serieDe("2026-02-01", "2026-02-10"), "2026-04-05"), {
    estado: "poucos-meses",
    fechados: 0,
  });
  assert.match(causaDaAusencia({ estado: "poucos-meses", fechados: 0 }), /^nenhum mês fechado/);
  assert.match(causaDaAusencia({ estado: "poucos-meses", fechados: 1 }), /^1 mês fechado/);
});

test("`nao-consecutivos` nomeia os DOIS meses — sem eles ninguém sabe onde procurar o buraco", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28"), ...serieDe("2026-04-01", "2026-04-30")];
  const c = crescimentoNaoMarca(dias, "2026-05-05");
  assert.equal(c.estado, "nao-consecutivos");
  assert.equal(linhaDeCrescimento(c), "∅ não apurado · buraco na série entre 2026-02 e 2026-04");
});

test("`base-zero` traz o mês seguinte: há um número a publicar mesmo sem razão", () => {
  const dias = [...diasDe("2026-07-01", Array(31).fill(0)), ...ago()];
  const c = crescimentoNaoMarca(dias, "2026-09-10");
  assert.deepEqual(c, { estado: "base-zero", de: "2026-07", para: "2026-08", paraImpressoes: 31 * 474 });
  assert.equal(c.valor, undefined, "÷0 renderizaria Infinity");
  assert.equal(linhaDeCrescimento(c), "∅ não apurado · mês-base em zero (2026-07) — sem base não há razão");
});

test("`medido` mantém os campos de sempre e ganha só o discriminador", () => {
  const c = crescimentoNaoMarca([...jul(), ...ago()], "2026-09-20");
  assert.deepEqual(Object.keys(c).sort(), [
    "baseInterrompida", "de", "deImpressoes", "diasDe", "diasZeroDe", "estado", "para", "paraImpressoes", "valor",
  ]);
  assert.equal(c.estado, "medido");
  assert.equal(c.deImpressoes, 4 * 85);
});

// FR-014/SC-006 — o defeito desta feature: a razão sobre um mês quebrado, lida ao lado de "5% a 10%".
test("`medido` com `baseInterrompida` NÃO abre a linha pela razão", () => {
  const c = crescimentoNaoMarca([...jul(), ...ago()], "2026-09-20");
  assert.equal(c.baseInterrompida, true);
  const linha = linhaDeCrescimento(c);
  assert.equal(
    linha,
    "Medido: 14.694 impressões não-marca em 2026-08, contra 340 em 2026-07 — base interrompida (27 de 31 dias em zero)",
  );
  // Lida SOZINHA, a linha não pode conter a razão nem o veredito que ela sugere.
  assert.doesNotMatch(linha, /×|%|\+\d/, "a razão desce para a nota; a linha de topo fala em absolutos");
  assert.match(linha, /^Medido: [\d.]+ impressões/, "os absolutos vêm ANTES de tudo");
});

test("`medido` SEM base interrompida abre pela razão, com sinal e os dois absolutos", () => {
  const julho = diasDe("2026-07-01", Array(31).fill(100));
  const agosto = diasDe("2026-08-01", Array(31).fill(107));
  const c = crescimentoNaoMarca([...julho, ...agosto], "2026-09-20");
  assert.equal(c.baseInterrompida, false);
  assert.equal(
    linhaDeCrescimento(c),
    "Medido: +7% de 2026-07 para 2026-08 (3.100 → 3.317 impressões não-marca)",
  );
});

test("queda é medida, sai com sinal e sem o `+`", () => {
  const julho = diasDe("2026-07-01", Array(31).fill(100));
  const agosto = diasDe("2026-08-01", Array(31).fill(46));
  const linha = linhaDeCrescimento(crescimentoNaoMarca([...julho, ...agosto], "2026-09-20"));
  assert.match(linha, /^Medido: -54% de 2026-07 para 2026-08/);
});

// SC-002 — o fato da 025: em pt-BR `4195%` imprime "4.195%" e, ao lado de "5% a 10%", inverte o veredito.
test("variacao acima de 10× escreve múltiplo, nunca porcentagem com ponto de milhar", () => {
  assert.equal(variacao(41.95), "43×");
  assert.equal(variacao(0.072), "7,2%");
  assert.equal(variacao(-0.54), "-54%");
  assert.equal(variacao(9.99), "999%", "abaixo de 10× continua porcentagem");
  assert.equal(variacao(10), "11×", "o limiar é 10×, inclusive");
});

test("nenhum estado publica `0%`, `4.195%` ou a razão de um mês quebrado", () => {
  const estados = [
    crescimentoNaoMarca([], "2026-09-20"),
    crescimentoNaoMarca(serieDe("2026-02-01", "2026-02-28"), "2026-04-05"),
    crescimentoNaoMarca([...serieDe("2026-02-01", "2026-02-28"), ...serieDe("2026-04-01", "2026-04-30")], "2026-05-05"),
    crescimentoNaoMarca([...diasDe("2026-07-01", Array(31).fill(0)), ...ago()], "2026-09-10"),
    crescimentoNaoMarca([...jul(), ...ago()], "2026-09-20"),
  ];
  assert.deepEqual(estados.map((e) => e.estado), ["nao-declarada", "poucos-meses", "nao-consecutivos", "base-zero", "medido"]);
  for (const e of estados) {
    const linha = linhaDeCrescimento(e);
    // `0%` SOZINHO: "10%" e "-54%" são medidas legítimas e contêm a substring.
    assert.doesNotMatch(linha, /(^|[^\d,.])0%/, linha);
    assert.doesNotMatch(linha, /\d\.\d{3}%/, linha);
    assert.doesNotMatch(linha, /Infinity|NaN|undefined/, linha);
  }
});

test("as quatro ausências abrem com o glifo `∅ não apurado`, e a medida não", () => {
  const ausentes = [
    { estado: "nao-declarada" },
    { estado: "poucos-meses", fechados: 1 },
    { estado: "nao-consecutivos", de: "2026-02", para: "2026-04" },
    { estado: "base-zero", de: "2026-07", para: "2026-08", paraImpressoes: 10 },
  ];
  for (const a of ausentes) assert.match(linhaDeCrescimento(a), /^∅ não apurado · /);
  assert.equal(new Set(ausentes.map(causaDaAusencia)).size, 4, "quatro causas, quatro frases");
});

// ── 026: a série que trocou de domínio no meio ───────────────────────────────────────────────
//
// O caso real: a Atma saiu de `atma.roilabs.com.br` para `usealigner.com`. A propriedade nova do
// Search Console nasceu vazia (5 dias, 63 impressões contra 244 dias e 371.189 da antiga), e sem
// o corte a tela leria a mudança de casa como colapso de tráfego.

/** Uma série de `n` dias a partir de `de`, todos com o mesmo host e o mesmo valor. */
const serieHost = (de, n, host, valor) =>
  Array.from({ length: n }, (_, i) => ({
    dia: new Date(Date.parse(de + "T00:00:00Z") + i * 864e5).toISOString().slice(0, 10),
    host,
    impressoesNaoMarca: valor,
    cliquesNaoMarca: 0,
    posicao: 5,
  }));

test("segmentosPorHost separa blocos contíguos e não agrupa por nome", () => {
  const dias = [...serieHost("2026-09-01", 3, "a.com", 10), ...serieHost("2026-09-04", 2, "b.com", 1), ...serieHost("2026-09-06", 2, "a.com", 9)];
  const segs = segmentosPorHost(dias);
  assert.deepEqual(segs.map((s) => s.host), ["a.com", "b.com", "a.com"]);
  assert.deepEqual(segs.map((s) => s.dias.length), [3, 2, 2]);
});

test("host null não abre segmento novo — ignorância não é evidência de troca", () => {
  const dias = [...serieHost("2026-09-01", 2, null, 10), ...serieHost("2026-09-03", 2, "a.com", 10)];
  const segs = segmentosPorHost(dias);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].host, "a.com", "o bloco sem nome adota o host que apareceu");
});

test("semana que cruza o corte sai com host null — ela soma dois sites", () => {
  // Segunda 07/09 a domingo 13/09: 4 dias no host antigo, 3 no novo.
  const dias = [...serieHost("2026-09-07", 4, "antigo.com", 100), ...serieHost("2026-09-11", 3, "novo.com", 5)];
  const [semana] = semanasNaoMarca(dias);
  assert.equal(semana.dias, 7);
  assert.equal(semana.completa, true, "tem os 7 dias do calendário");
  assert.equal(semana.host, null, "mas não pertence a nenhum dos dois sites");
});

test("semana inteira num host só carrega o nome dele", () => {
  const [semana] = semanasNaoMarca(serieHost("2026-09-07", 7, "antigo.com", 100));
  assert.equal(semana.host, "antigo.com");
});

test("o veredito vem do domínio ANTIGO enquanto o novo não tem 2 semanas completas", () => {
  // 3 semanas fechadas no antigo (a última caindo) + 5 dias no novo, como a Atma em 18/09.
  const dias = [
    ...serieHost("2026-08-17", 7, "antigo.com", 1000),
    ...serieHost("2026-08-24", 7, "antigo.com", 800),
    ...serieHost("2026-08-31", 7, "antigo.com", 600),
    ...serieHost("2026-09-07", 5, "novo.com", 6),
  ];
  const r = ritmoDoSegmentoAtual(dias);
  assert.equal(r.segmento.host, "antigo.com");
  // Os valores são por DIA na fixture, então a semana soma 7x: 1.000/dia = 7.000 na semana.
  assert.equal(r.ritmo.pico.impressoesNaoMarca, 7000);
  assert.equal(r.ritmo.ultima.impressoesNaoMarca, 4200, "4.200, nunca os 30 do domínio novo");
  assert.equal(r.posteriores.length, 1, "e a tela precisa saber que fala do site anterior");
  assert.equal(r.posteriores[0].host, "novo.com");
});

test("com 2 semanas completas no domínio novo, o veredito passa para ele", () => {
  const dias = [
    ...serieHost("2026-08-17", 7, "antigo.com", 1000),
    ...serieHost("2026-08-24", 7, "antigo.com", 800),
    ...serieHost("2026-08-31", 7, "novo.com", 50),
    ...serieHost("2026-09-07", 7, "novo.com", 70),
  ];
  const r = ritmoDoSegmentoAtual(dias);
  assert.equal(r.segmento.host, "novo.com");
  assert.equal(r.ritmo.pico.impressoesNaoMarca, 490, "o pico é do site de hoje, não os 7.000 da casa antiga");
  assert.equal(r.posteriores.length, 0);
});

test("série sem nenhuma semana completa não inventa veredito", () => {
  assert.equal(ritmoDoSegmentoAtual(serieHost("2026-09-11", 5, "novo.com", 6)), null);
});
