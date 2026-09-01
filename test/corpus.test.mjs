import test from "node:test";
import assert from "node:assert/strict";
import { carregarCorpus } from "../lib/corpus.mjs";

// O modo de falha que este arquivo existe para pegar: handoff em subpasta sumindo da busca SEM
// ERRO NENHUM. `readdirSync` sem recursão simplesmente não via a pasta (nome de diretório não
// termina em `.md`), e a única evidência seria documento faltando num resultado de busca.
const handoffs = carregarCorpus().filter((d) => d.tipo === "handoff");

test("handoff em subpasta entra no corpus", () => {
  const doSubprojeto = handoffs.filter((d) => d.id.startsWith("funil-seo/"));
  assert.ok(doSubprojeto.length >= 3, `esperava os documentos de funil-seo/, achei ${doSubprojeto.length}`);
  assert.ok(
    doSubprojeto.every((d) => d.texto.length > 0),
    "documento de subpasta entrou sem texto",
  );
});

test("handoff na RAIZ mantém o id NU — é o vocabulário das `fontes` do dourado", () => {
  const naRaiz = handoffs.filter((d) => !d.id.includes("/"));
  assert.ok(naRaiz.length >= 80, `esperava os handoffs da raiz, achei ${naRaiz.length}`);
  assert.ok(
    naRaiz.every((d) => d.id.endsWith(".md") && !d.id.startsWith("handoff/")),
    "id da raiz ganhou prefixo — isso zera o recall de toda pergunta do dourado que cita handoff",
  );
});

test("nenhum id usa separador do Windows", () => {
  // O índice é gerado nesta máquina (Windows) e lido pelo container Linux. `a\b.md` e `a/b.md`
  // são DUAS chaves na PK de hub_corpus, e a divergência só apareceria como documento sumido.
  const comBarraInvertida = handoffs.filter((d) => d.id.includes("\\"));
  assert.deepEqual(comBarraInvertida, [], "id com `\\` divergiria entre Windows e o container");
});

test("id de handoff é único — subpasta não pode colidir com a raiz", () => {
  const vistos = new Set();
  for (const d of handoffs) {
    assert.ok(!vistos.has(d.id), `id duplicado: ${d.id} — na PK de hub_corpus um sobrescreve o outro`);
    vistos.add(d.id);
  }
});
