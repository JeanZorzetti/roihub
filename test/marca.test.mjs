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
  razaoDeMarca,
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

// (3) Primeiro mês fechado: "ainda não apurável", NUNCA 0% — um zero aqui viraria uma queda de
// 100% na tela e mandaria consertar um problema que não existe (FR-009).
test("crescimento com UM só mês fechado é null, e explicitamente não é 0", () => {
  const um = serieDe("2026-02-01", "2026-02-28");
  const c = crescimentoNaoMarca(um, "2026-04-05");
  assert.equal(c, null);
  assert.notEqual(c, 0, "0 leria como estagnação medida, e não como ausência de medição");
});

test("crescimento compara os DOIS últimos meses fechados, nomeando os dois", () => {
  const dias = [...serieDe("2026-02-01", "2026-02-28", 10), ...serieDe("2026-03-01", "2026-03-31", 20)];
  const c = crescimentoNaoMarca(dias, "2026-04-05");
  assert.equal(c.de, "2026-02");
  assert.equal(c.para, "2026-03");
  assert.equal(c.valor, (31 * 20) / (28 * 10) - 1);
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
  assert.equal(crescimentoNaoMarca(dias, "2026-05-05"), null);
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
