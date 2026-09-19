import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO, regua } from "../lib/gsc-delta.mjs";
import { BOARD, GRUPOS, NOTA_DO_GRUPO, RAMOS, selo, mapaDoBoard } from "../lib/board-gsc.mjs";

/** Todo nó do mapa, achatado, para as asserções de contagem e unicidade. */
function todosOsNos(no, acc = []) {
  acc.push(no);
  for (const f of no.children ?? []) todosOsNos(f, acc);
  return acc;
}

// ── A trava principal: DUAS listas de folhas divergem, e divergem em silêncio ──────────────────
// Foi assim que o board passou duas semanas sendo reconstruído do zero — cada tentativa escrevia a
// própria lista de KPIs. O teste corre nos dois sentidos de propósito: só "todo BOARD está no
// CATALOGO" deixaria passar a folha nova do catálogo que nasce sem detalhe nenhum e some do mapa.

test("todas as 32 folhas do catálogo têm entrada no board", () => {
  const faltando = Object.keys(CATALOGO).filter((k) => !BOARD[k]);
  assert.deepEqual(faltando, [], `folhas do CATALOGO sem detalhe em BOARD: ${faltando.join(", ")}`);
});

test("nenhuma entrada do board é órfã do catálogo", () => {
  const orfas = Object.keys(BOARD).filter((k) => !CATALOGO[k]);
  assert.deepEqual(orfas, [], `chaves em BOARD que não existem no CATALOGO: ${orfas.join(", ")}`);
});

test("nenhum grupo é declarado para folha que não existe", () => {
  const orfas = Object.keys(GRUPOS).filter((k) => !CATALOGO[k]);
  assert.deepEqual(orfas, [], `chaves em GRUPOS fora do CATALOGO: ${orfas.join(", ")}`);
});

test("toda nota de grupo pertence a um grupo realmente usado", () => {
  const usados = new Set(Object.values(GRUPOS).flat());
  const mortas = Object.keys(NOTA_DO_GRUPO).filter((g) => !usados.has(g));
  assert.deepEqual(mortas, [], `NOTA_DO_GRUPO para grupo que ninguém declara: ${mortas.join(", ")}`);
});

// ── O mapa ────────────────────────────────────────────────────────────────────────────────────

test("o mapa tem exatamente uma folha por KPI do catálogo", () => {
  const nos = todosOsNos(mapaDoBoard().nodeData);
  const folhas = nos.filter((n) => n.metadata?.chave);
  assert.equal(folhas.length, Object.keys(CATALOGO).length);
  assert.deepEqual(
    folhas.map((f) => f.metadata.chave).sort(),
    Object.keys(CATALOGO).sort(),
    "o nível de grupo comeu ou duplicou uma folha",
  );
});

test("todo id do mapa é único — o Mind Elixir seleciona por id", () => {
  const ids = todosOsNos(mapaDoBoard().nodeData).map((n) => n.id);
  const repetidos = ids.filter((v, i) => ids.indexOf(v) !== i);
  assert.deepEqual([...new Set(repetidos)], [], `ids repetidos: ${repetidos.join(", ")}`);
});

test("todo nó tem rótulo visível — nenhum nó identificado só pelo painel", () => {
  const mudos = todosOsNos(mapaDoBoard().nodeData).filter((n) => !n.topic || !n.topic.trim());
  assert.deepEqual(mudos.map((n) => n.id), []);
});

test("cada ramo do mapa leva as folhas daquele ramo, e nenhuma outra", () => {
  const raiz = mapaDoBoard().nodeData;
  assert.deepEqual(raiz.children.map((r) => r.id), RAMOS.map((r) => r.id));
  for (const ramo of raiz.children) {
    const chaves = todosOsNos(ramo)
      .filter((n) => n.metadata?.chave)
      .map((n) => n.metadata.chave);
    const esperado = Object.keys(CATALOGO).filter((k) => CATALOGO[k].ramo === ramo.id);
    assert.deepEqual(chaves.sort(), esperado.sort(), `ramo ${ramo.id} com folha de outro ramo`);
  }
});

// ── A trava de procedência: a meta do board NÃO é régua ────────────────────────────────────────
// A razão de este arquivo existir é publicar a prosa do board. A razão de `/gsc` existir é dizer que
// 25 das 32 metas não têm fonte. Se o selo se soltar da natureza, o mapa passa a exibir "< 15% de
// reescrita" com a mesma autoridade de "LCP ≤ 2,5s" — o defeito exato que a tela acusa.

test("o selo de cada folha segue a natureza do balizador, nunca o texto do board", () => {
  for (const chave of Object.keys(CATALOGO)) {
    const s = selo(chave);
    const r = regua(chave);
    assert.equal(s.marca, r.tem ? "◆" : "◇", `selo divergente da natureza em ${chave}`);
    assert.ok(s.detalhe && s.detalhe.trim(), `folha sem motivo nem fonte: ${chave}`);
  }
});

test("toda folha do mapa carrega a tag de procedência visível", () => {
  const folhas = todosOsNos(mapaDoBoard().nodeData).filter((n) => n.metadata?.chave);
  for (const f of folhas) {
    assert.ok(Array.isArray(f.tags) && f.tags.length === 1, `folha sem tag: ${f.metadata.chave}`);
    assert.match(f.tags[0], /^[◆◇] /, `tag sem marca de forma: ${f.metadata.chave}`);
  }
});

test("a folha leva no metadata tudo o que o painel precisa, sem casar por rótulo", () => {
  const folhas = todosOsNos(mapaDoBoard().nodeData).filter((n) => n.metadata?.chave);
  for (const f of folhas) {
    const m = f.metadata;
    assert.equal(m.chave in CATALOGO, true);
    assert.equal(m.ramo, CATALOGO[m.chave].ramo);
    assert.ok(m.selo, `folha sem rótulo de selo: ${m.chave}`);
    // `url` só existe onde há régua — e é a única coisa do painel que vira link. Link para folha
    // sem fonte seria a tela emprestando autoridade que a própria tela diz não existir.
    assert.equal(m.url !== null, regua(m.chave).tem, `url descolada da régua em ${m.chave}`);
  }
});

test("as 7 folhas com régua são exatamente as que o catálogo diz ter régua", () => {
  const comRegua = Object.keys(CATALOGO).filter((k) => regua(k).tem);
  const marcadas = todosOsNos(mapaDoBoard().nodeData)
    .filter((n) => n.metadata?.chave && n.tags[0].startsWith("◆"))
    .map((n) => n.metadata.chave);
  assert.deepEqual(marcadas.sort(), comRegua.sort());
});

// ── A forma ───────────────────────────────────────────────────────────────────────────────────

test("nenhum rótulo de nó carrega o parágrafo inteiro do board", () => {
  // O limite não é estético: acima de ~95 caracteres o nó deixa de ser uma ideia e o mapa vira uma
  // lista com curvas — que é no que o Whimsical virou, 2.139 × 5.614 px para 32 KPIs. A prosa longa
  // tem lugar: `note`, que a tela mostra no painel.
  const longos = todosOsNos(mapaDoBoard().nodeData).filter((n) => n.topic.length > 95);
  assert.deepEqual(longos.map((n) => `${n.id}: ${n.topic.length}`), []);
});

test("nenhuma nota repete o próprio rótulo", () => {
  const iguais = todosOsNos(mapaDoBoard().nodeData).filter((n) => n.note && n.note.trim() === n.topic.trim());
  assert.deepEqual(iguais.map((n) => n.id), [], "nota igual ao rótulo é ruído com cara de conteúdo");
});

test("o mapa cabe no teto de leitura da forma — 150 nós", () => {
  const total = todosOsNos(mapaDoBoard().nodeData).length;
  assert.ok(total <= 150, `${total} nós: acima de 150 o leitor não lê, admira — agregue antes`);
});
