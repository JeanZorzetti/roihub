import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tokenizar, indexar, buscar } from "../lib/bm25.mjs";
import { chunkar } from "../lib/denso.mjs";
import { rrf } from "../lib/busca.mjs";
import { carregarCorpus } from "../lib/corpus.mjs";

const dourado = JSON.parse(readFileSync(fileURLToPath(new URL("../data/dourado.json", import.meta.url)), "utf8"));

test("tokenizar tira acento, caixa e pontuação", () => {
  assert.deepEqual(tokenizar("Indexação NÃO é prova, a 1 vez!"), ["indexacao", "nao", "prova", "vez"]);
  // Consulta e documento têm que cair no mesmo token, senão o BM25 nunca casa.
  assert.deepEqual(tokenizar("UND_ERR_HEADERS_TIMEOUT"), ["und", "err", "headers", "timeout"]);
});

test("BM25 prefere o doc com o termo raro, não o com mais texto", () => {
  const ix = indexar([
    { id: "a", texto: "sitemap sitemap sitemap indexacao status http corpo" },
    { id: "b", texto: "sitemap pgvector" },
    { id: "c", texto: "sitemap deploy docker easypanel" },
  ]);
  assert.equal(buscar(ix, "pgvector")[0].id, "b");
  // "sitemap" está nos três: idf baixo não pode virar o ranking sozinho.
  assert.equal(buscar(ix, "pgvector sitemap")[0].id, "b");
});

test("BM25 não devolve doc sem nenhum termo da consulta", () => {
  const ix = indexar([{ id: "a", texto: "deploy docker" }, { id: "b", texto: "sitemap gsc" }]);
  assert.deepEqual(buscar(ix, "sitemap").map((r) => r.id), ["b"]);
  assert.deepEqual(buscar(ix, "ollama"), []);
});

test("chunkar corta doc longo e repete o título em todo pedaço", () => {
  const doc = { id: "h", tipo: "handoff", titulo: "handoff-atma.md", texto: "linha\n\n".repeat(400) };
  const partes = chunkar(doc);
  assert.ok(partes.length > 1, "doc de 2800 caracteres não foi cortado");
  for (const p of partes) {
    assert.ok(p.texto.startsWith("handoff-atma.md\n"), "chunk sem título perde de que projeto fala");
    assert.ok(p.texto.length < 2200, `chunk de ${p.texto.length} caracteres`);
  }
  // Protocolo mediano tem 780 caracteres: não pode ser fatiado.
  assert.equal(chunkar({ id: "p", tipo: "protocolo", titulo: "t", texto: "a".repeat(700) }).length, 1);
});

test("rrf combina rankings sem comparar score", () => {
  // Score de escalas diferentes (BM25 em dezenas, cosseno em 0..1) de propósito.
  const bm25 = [{ id: "x", score: 40 }, { id: "y", score: 39 }];
  const denso = [{ id: "y", score: 0.9 }, { id: "z", score: 0.8 }];
  const fundido = rrf([bm25, denso]);
  assert.equal(fundido[0].id, "y", "quem aparece bem nos dois tem que ganhar");
  assert.deepEqual(new Set(fundido.map((r) => r.id)), new Set(["x", "y", "z"]));
});

// Card fora do corpus era o que fazia `quais os blockers do goiania` devolver handoff que fala
// do goiania e nunca o card onde os blockers estão escritos. Fonte = `data/projects.json`, id =
// slug: id divergente do slug some da procedência da aba sem erro nenhum aparecer.
test("os cards curados entram no corpus com id = slug e sem os números do score", () => {
  const projetos = JSON.parse(readFileSync(fileURLToPath(new URL("../data/projects.json", import.meta.url)), "utf8"));
  const docs = carregarCorpus({ memoriaDir: "/inexistente" }).filter((d) => d.tipo === "projeto");
  assert.deepEqual(docs.map((d) => d.id), projetos.map((p) => p.slug));

  const goiania = docs.find((d) => d.id === "goiania");
  assert.ok(goiania.texto.includes("IndexNow devolve 403"), "blocker do card não entrou no texto");
  // Nota 0-10 de prioridade dentro do texto é ruído de token: quem pergunta por número quer o
  // score da home. `receita: 8` viraria os tokens `receita` e `8` em 35 documentos iguais.
  for (const campo of ["receita", "blockers", "decay", "seoSeed"]) {
    assert.ok(!new RegExp(`${campo}\\W*\\d`, "i").test(goiania.texto), `${campo} numérico indexado`);
  }
});

// O id do doc é o mesmo vocabulário das fontes do dourado. Divergir aqui zera o recall em
// silêncio — nenhum teste de formato pegaria.
test("toda fonte de protocolo e handoff do dourado vira doc no corpus", () => {
  const ids = new Set(carregarCorpus({ memoriaDir: "/inexistente" }).map((d) => d.id));
  for (const q of dourado) {
    for (const fonte of q.fontes.filter((f) => /^[A-Z0-9]+-\d+$/.test(f) || f.endsWith(".md"))) {
      assert.ok(ids.has(fonte), `${q.id}: fonte ${fonte} não existe como doc do corpus`);
    }
  }
});
