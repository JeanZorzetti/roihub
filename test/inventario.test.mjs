import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerInventario, motivoForaDoCatalogo, validarInventario } from "../lib/inventario.mjs";
import { PROJECTS } from "../lib/autopublish-projects.mjs";

const json = (f) => JSON.parse(readFileSync(new URL(`../data/${f}.json`, import.meta.url), "utf8"));
const INVENTARIO = json("inventario-de-termos");
const DEMANDA = json("demanda-estimada");

const PROCEDENCIA = {
  congeladoEm: "2026-09-20",
  janela: { inicio: "2026-01-20", fim: "2026-09-17" },
  piso: 20,
  dimensao: "query",
  propriedades: ["sc-domain:roilabs.com.br"],
  hosts: ["usealigner.com", "atma.roilabs.com.br"],
  excluiMarca: ["atma", "atma aligner"],
  porque: "piso de 20 impressões em 8 meses",
};

const arquivo = (entrada) => ({ atma: entrada });
const bom = { procedencia: PROCEDENCIA, termos: ["invisalign", "aparelho invisivel preço"] };

test("projeto sem entrada devolve null — é estado válido em 34 dos 35", () => {
  assert.equal(lerInventario("goiania", arquivo(bom)), null);
  assert.equal(lerInventario("atma", {}), null);
  assert.equal(lerInventario("atma", null), null);
});

test("projeto com entrada devolve termos e procedência", () => {
  const inv = lerInventario("atma", arquivo(bom));
  assert.deepEqual(inv.termos, ["invisalign", "aparelho invisivel preço"]);
  assert.equal(inv.procedencia.piso, 20);
  assert.equal(inv.total, 2);
});

// Lista vazia LANÇA e não devolve `null`: `null` significa "não curei este projeto" e a tela
// imprime "não apurado", que é a frase certa para 34 projetos e a errada para um arquivo quebrado.
// Sem a exceção, `noTop3 / total` devolveria `NaN` e a tela publicaria "NaN%" ou, pior, 0.
test("lista vazia é erro de curadoria, não ausência", () => {
  assert.throws(() => lerInventario("atma", arquivo({ ...bom, termos: [] })), /vazia/);
});

// Duplicata infla o denominador sem aparecer: 723 vira 724 e a penetração cai 0,1 ponto por termo
// repetido, sem nenhum sintoma na tela.
test("termo duplicado reprova", () => {
  const dup = { ...bom, termos: ["invisalign", "invisalign"] };
  assert.throws(() => lerInventario("atma", arquivo(dup)), /duplicad/);
});

test("termo vazio ou só espaço reprova", () => {
  assert.throws(() => lerInventario("atma", arquivo({ ...bom, termos: ["invisalign", "  "] })), /vazio/);
});

// Cada campo da procedência responde uma pergunta que ninguém consegue responder sem ele: de onde
// veio (janela), por que este termo e não aquele (piso), e desde quando esta lista é a lista
// (congeladoEm). Procedência incompleta transforma o arquivo em número digitado.
for (const campo of ["congeladoEm", "janela", "piso", "excluiMarca"]) {
  test(`procedência sem \`${campo}\` reprova`, () => {
    const p = { ...PROCEDENCIA };
    delete p[campo];
    assert.throws(() => lerInventario("atma", arquivo({ ...bom, procedencia: p })), new RegExp(campo));
  });
}

test("janela sem início ou sem fim reprova", () => {
  const p = { ...PROCEDENCIA, janela: { inicio: "2026-01-20" } };
  assert.throws(() => lerInventario("atma", arquivo({ ...bom, procedencia: p })), /janela/);
});

// `excluiMarca: []` declarado é diferente de esquecido — um projeto pode legitimamente não ter
// marca a excluir, e a lista vazia DECLARADA diz isso. Por isso o campo é obrigatório e o valor
// vazio é aceito.
test("excluiMarca vazio é aceito quando declarado", () => {
  const p = { ...PROCEDENCIA, excluiMarca: [] };
  assert.equal(lerInventario("atma", arquivo({ ...bom, procedencia: p })).total, 2);
});

// A trava que impede o inventário de medir outra coisa: marca própria dentro da lista faz a
// penetração subir por um trabalho que não é SEO. A checagem é aqui, na LEITURA, e não só no
// gerador — o arquivo é editável à mão e o gerador não roda de novo a cada deploy.
test("termo que casa a marca declarada reprova na leitura", () => {
  const comMarca = { ...bom, termos: ["invisalign", "atma aligner preço"] };
  assert.throws(() => lerInventario("atma", arquivo(comMarca)), /marca/);
});

test("marca casa por palavra inteira, não por prefixo", () => {
  const p = { ...PROCEDENCIA, excluiMarca: ["atma"] };
  const semMarca = { procedencia: p, termos: ["atmosfera de consultorio"] };
  assert.equal(lerInventario("atma", arquivo(semMarca)).total, 1);
});

test("validarInventario aceita a entrada boa sem lançar", () => {
  assert.equal(validarInventario("atma", bom).total, 2);
});

// 057, 28/09: a demanda da Tape Pro congelou «fita gomada scotch», «transparente», «branca», «80mm»…
// (1.470 de 17.030 buscas/mês) e o plano mandou criar página para eles. O catálogo declarado no
// projeto é a régua; a mesma checagem da marca, na leitura.
const CATALOGO = { "marca de terceiro": ["scotch", "3m"], "gomada é de papel": ["gomada transparente"] };

test("termo fora do catálogo reprova na leitura, com o motivo", () => {
  const p = { ...PROCEDENCIA, foraDoCatalogo: CATALOGO };
  assert.throws(() => validarInventario("tapepro", { procedencia: p, termos: ["fita gomada", "fita gomada 3m"] }), /marca de terceiro.*fita gomada 3m/);
});

test("catálogo casa por palavra inteira: «transparente personalizada» não é «gomada transparente»", () => {
  assert.equal(motivoForaDoCatalogo("fita transparente personalizada", CATALOGO), null);
  assert.equal(motivoForaDoCatalogo("fita gomada transparente", CATALOGO), "gomada é de papel");
});

test("a demanda congelada respeita o catálogo declarado no projeto", () => {
  for (const projeto of PROJECTS.filter((p) => p.foraDoCatalogo)) {
    for (const [nome, arquivo] of [["inventario-de-termos", INVENTARIO], ["demanda-estimada", DEMANDA]]) {
      const entrada = arquivo[projeto.slug];
      if (!entrada) continue;
      // Catálogo mudou no projeto e o JSON não foi recurado = régua velha no arquivo.
      assert.deepEqual(entrada.procedencia.foraDoCatalogo, projeto.foraDoCatalogo, `${nome}/${projeto.slug}: procedencia.foraDoCatalogo difere do projeto`);
      const termos = Array.isArray(entrada.termos) ? entrada.termos : Object.keys(entrada.termos);
      const intruso = termos.find((t) => motivoForaDoCatalogo(t, projeto.foraDoCatalogo));
      assert.equal(intruso, undefined, `${nome}/${projeto.slug}: «${intruso}» está fora do catálogo`);
    }
  }
});
