import test from "node:test";
import assert from "node:assert/strict";
import { montarN4, montarN4Nivel, mapearCanaisGa4 } from "../lib/ficha.mjs";
import { canaisDoN4, razaoDoKr } from "../lib/ficha-visual.mjs";

const CANAIS = ["organico", "direto", "pago", "indicacao", "outbound", "social"];
const janela = { inicio: "2026-08-03", fim: "2026-08-30" };
const ga4Atma = {
  propriedade: "properties/504053080",
  janela,
  linhas: [
    { grupo: "Direct", sessoes: 130 },
    { grupo: "Organic Search", sessoes: 765 },
    { grupo: "Organic Social", sessoes: 6 },
    { grupo: "AI Assistant", sessoes: 46 },
    { grupo: "Unassigned", sessoes: 1 },
  ],
};
const marcos = [{ chave: "visitante", celula: { valor: 525 } }];

/** As células reais do N4 da /okr/atma, montadas pelo caminho de produção. */
function celulasN4() {
  const canais = montarN4(CANAIS, { valor: 525 }, marcos, ga4Atma, janela);
  const mapa = mapearCanaisGa4(ga4Atma.linhas);
  return montarN4Nivel(canais, { foraDoCatalogo: mapa.foraDoCatalogo, propriedade: ga4Atma.propriedade }).celulas;
}

test("trilho só para canal — total composto e diferença ficam de fora", () => {
  const celulas = celulasN4();
  // Sanidade: as células derivadas ESTÃO na lista plana que a função recebe.
  assert.ok(celulas.some((c) => c.rotulo === "total composto (orgânico + 4 canais)"));

  const { canais, resto } = canaisDoN4(celulas);
  const rotulos = canais.map((c) => c.celula.rotulo);
  assert.ok(!rotulos.some((r) => r.startsWith("total composto")), "total composto viraria canal e dobraria o tráfego");
  assert.ok(!rotulos.includes("diferença"));
  assert.deepEqual(rotulos, ["orgânico", "direto", "social", "pago", "indicacao", "outbound"]);
  // As derivadas continuam na página — saem em `resto`, nunca somem.
  assert.ok(resto.some((c) => c.rotulo === "total composto (orgânico + 4 canais)"));
  assert.ok(resto.some((c) => c.rotulo === "diferença"));
  // A soma dos canais com trilho é o total composto do nível, não mais que ele.
  assert.equal(canais.filter((c) => c.fracao !== null).reduce((s, c) => s + c.celula.valor, 0), 661);
});

test("nenhuma célula do nível se perde entre canais e resto", () => {
  const celulas = celulasN4();
  const { canais, resto } = canaisDoN4(celulas);
  assert.equal(canais.length + resto.length, celulas.length);
});

test("canal não apurado vem por último e sem trilho — nunca trilho de comprimento 0", () => {
  const { canais } = canaisDoN4(celulasN4());
  const outbound = canais.find((c) => c.celula.rotulo === "outbound");
  assert.equal(outbound.fracao, null, "trilho vazio leria como 'medimos e deu zero'");
  assert.equal(canais[canais.length - 1], outbound, "sem fonte vai para o fim da lista");
  // Mas canal APURADO em zero continua com trilho: a fonte foi consultada e respondeu 0 (FR-004).
  assert.equal(canais.find((c) => c.celula.rotulo === "pago").fracao, 0);
});

test("fração é relativa ao maior canal, e zero canal apurado não divide por zero", () => {
  const { canais } = canaisDoN4(celulasN4());
  assert.equal(canais[0].fracao, 1);
  assert.ok(Math.abs(canais[1].fracao - 130 / 525) < 1e-9);
  const secos = canaisDoN4([{ estado: "apurado", rotulo: "direto", valor: 0 }]);
  assert.equal(secos.canais[0].fracao, 0);
});

test("medidor de KR só para célula apurada e numérica", () => {
  assert.deepEqual(razaoDoKr({ estado: "apurado", valor: 35 }, 120), { valor: 35, meta: 120, fracao: 35 / 120 });
  assert.equal(razaoDoKr({ estado: "declarado", valor: 4000 }, 10000), null, "declarado não é apurado");
  assert.equal(razaoDoKr({ estado: "nao-apurado" }, 120), null);
  assert.equal(razaoDoKr({ estado: "apurado", valor: "6,67% (35/525)" }, 20), null, "taxa do N3 chega como string");
  assert.equal(razaoDoKr({ estado: "apurado", valor: 35 }, null), null);
  assert.equal(razaoDoKr({ estado: "apurado", valor: 35 }, 0), null, "meta 0 dividiria por zero");
  assert.equal(razaoDoKr(null, 120), null);
});

test("medidor satura em 100% sem estourar o trilho", () => {
  assert.equal(razaoDoKr({ estado: "apurado", valor: 300 }, 120).fracao, 1);
  assert.equal(razaoDoKr({ estado: "apurado", valor: 300 }, 120).valor, 300, "o número ao lado continua o real");
});
