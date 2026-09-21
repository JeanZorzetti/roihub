import test from "node:test";
import assert from "node:assert/strict";
import { CATALOGO, CLASSES, regua } from "../lib/gsc-delta.mjs";
import { BENCHMARK, benchmark } from "../lib/kpis-busca.mjs";
import { PROFUNDIDADE_MAX } from "../lib/grafo.mjs";
import { BOARD, DIVERGENCIAS, GRUPOS, NOTA_DO_GRUPO, RAMOS, selo, mapaDoBoard } from "../lib/board-gsc.mjs";

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
    assert.ok(Array.isArray(f.tags) && f.tags.length >= 1, `folha sem tag: ${f.metadata.chave}`);
    // A PRIMEIRA tag é sempre a procedência — a ordem importa porque a lista da página imprime as
    // tags na ordem e a procedência é a que qualifica todo o resto. A segunda é a CLASSE (051/FR-005,
    // ausente só no procedimento) e a terceira, quando existe, é a divergência board × código. Nada
    // mais entra: tag extra sem dono vira decoração com cara de selo, que é o defeito que a forma
    // ◆/◇ existe para não ter.
    assert.match(f.tags[0], /^[◆◇] /, `tag sem marca de forma: ${f.metadata.chave}`);
    const { classe } = CATALOGO[f.metadata.chave];
    const extras = f.tags.slice(1);
    const divergencia = DIVERGENCIAS[f.metadata.chave] ? [DIVERGENCIAS[f.metadata.chave].tag] : [];
    assert.equal(extras.length, (classe ? 1 : 0) + divergencia.length, `tag extra sem dono: ${f.metadata.chave}`);
    if (classe) assert.ok(extras[0].startsWith(CLASSES[classe].rotulo), `${f.metadata.chave}: a segunda tag não é a classe`);
    assert.deepEqual(extras.slice(classe ? 1 : 0), divergencia, `tag extra que não é a divergência declarada: ${f.metadata.chave}`);
  }
});

test("051/FR-005..FR-007 — a classe aparece na etiqueta, na nota e no metadata", () => {
  const folhas = new Map(todosOsNos(mapaDoBoard().nodeData).filter((n) => n.metadata?.chave).map((n) => [n.metadata.chave, n]));
  // A alavanca NOMEIA a ação semanal na etiqueta — visível sem clique, que é onde a Q2 do dono pôs.
  assert.equal(folhas.get("larguraTitulo").tags[1], "alavanca · títulos encurtados por semana");
  assert.equal(folhas.get("lcp").tags[1], "higiene · limiar");
  assert.equal(folhas.get("ctrGap").tags[1], "resultado");
  assert.equal(folhas.get("checklistGsc").metadata.classe, null, "procedimento não tem classe");
  for (const [chave, n] of folhas) {
    const { classe } = CATALOGO[chave];
    if (!classe) continue;
    assert.equal(n.metadata.classe, classe, `${chave}: metadata sem a classe`);
    assert.ok(n.note.includes(CLASSES[classe].nota), `${chave}: a nota não explica a classe`);
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

// ── A TRAVA QUE FALTAVA: valor transcrito × constante que o hub usa para julgar ────────────────
//
// A auditoria de 19/09/2026 achou 9 defeitos de DADO que passavam pelos 1029 testes sem uma falha,
// e a razão era sempre a mesma: os testes comparam LISTA contra LISTA — chave daqui existe lá, selo
// segue o balizador — e nenhum deles olha para DENTRO da prosa. O board entrou no repo como terceira
// fonte de números sem herdar a disciplina que as outras duas têm.
//
// O caso que doeu: o TTFB. O board diz 600ms, `crux.mjs` e `gsc-delta.mjs` julgam por 800ms desde o
// mesmo dia, e os dois foram publicados juntos — o 600 no rótulo do nó, o 800 atrás de um clique.
//
// Os três testes abaixo são o único ponto onde essa classe de divergência é pega antes da tela,
// enquanto o board for transcrito à mão e julgado à parte.

/** Toda a prosa de uma folha — rótulo e nota, folha e descendentes. */
function prosaDaFolha(chave) {
  const cai = (ds) => ds.flatMap((d) => [d.rotulo, d.nota ?? "", ...(d.filhos ? cai(d.filhos) : [])]);
  return cai(BOARD[chave].detalhe).join(" \n ");
}

/**
 * O número aparece na prosa, nas grafias que ele mesmo gera?
 *
 * ⚠️ TETO CONHECIDO: isto casa GRAFIA, não interpreta a frase. `2500` casa "2,5s" porque a função
 * gera a forma dividida por mil; um board que escrevesse "dois segundos e meio" passaria batido. O
 * upgrade, se um dia doer, é declarar a meta do board como DADO ao lado da prosa — e aí o teste vira
 * igualdade. Enquanto as metas forem numéricas, a grafia basta e custa cinco linhas.
 *
 * As bordas existem porque `8` casava dentro de `18%` e aprovava a tabela errada em silêncio.
 */
function citaONumero(texto, n, exigePorcento = false) {
  const formas = new Set([String(n), String(n).replace(".", ",")]);
  if (n >= 1000) formas.add(String(n / 1000)).add(String(n / 1000).replace(".", ","));
  return [...formas].some((forma) => {
    const corpo = forma.replace(/[.,]/g, "[.,]");
    return new RegExp(`(?<![\d,.])${corpo}${exigePorcento ? "\s*%" : "(?![\d])"}`).test(texto);
  });
}

/** A constante VIVA de cada divergência — lida do código, nunca copiada. Divergência declarada sem
 *  entrada aqui reprova: é o que impede alguém de declarar uma divergência contra nada. */
const CONSTANTE_VIVA = {
  ttfb: () => regua("ttfb").meta,
  ctrPorPosicao: () => benchmark(1),
  profundidadeClique: () => PROFUNDIDADE_MAX,
};

test("nenhuma meta escalar publicada contradiz a constante que o hub usa para julgar", () => {
  const mudas = Object.keys(CATALOGO)
    .filter((k) => regua(k).tem && regua(k).meta !== null && !DIVERGENCIAS[k])
    .filter((k) => !citaONumero(prosaDaFolha(k), regua(k).meta));
  assert.deepEqual(
    mudas,
    [],
    `o board publica um número que não é o do hub, e a divergência não está declarada em DIVERGENCIAS: ${mudas.join(", ")}`,
  );
});

test("a tabela de CTR do board é a que julga, ou a divergência está declarada", () => {
  const fora = ["ctrPorPosicao", "ctrGap"]
    .filter((k) => !DIVERGENCIAS[k])
    .filter((k) => !BENCHMARK.every((faixa) => citaONumero(prosaDaFolha(k), faixa.ctr * 100, true)));
  assert.deepEqual(fora, [], `folha de CTR cuja tabela transcrita não reproduz BENCHMARK: ${fora.join(", ")}`);
});

test("toda divergência declarada aponta para um nó real e para a constante viva", () => {
  for (const [chave, d] of Object.entries(DIVERGENCIAS)) {
    assert.ok(CATALOGO[chave], `divergência em folha fora do catálogo: ${chave}`);
    assert.ok(
      prosaDaFolha(chave).includes(d.no),
      `${chave}: o rótulo declarado em \`no\` não existe mais na transcrição — a divergência ficou órfã`,
    );
    const viva = CONSTANTE_VIVA[chave];
    assert.ok(viva, `${chave}: divergência sem constante viva declarada em CONSTANTE_VIVA`);
    assert.equal(d.hub, viva(), `${chave}: \`hub\` copiado do código saiu de sincronia com a constante`);
  }
});

test("a divergência é VISÍVEL no nó, não só no painel do pai", () => {
  const nos = todosOsNos(mapaDoBoard().nodeData);
  for (const [chave, d] of Object.entries(DIVERGENCIAS)) {
    const folha = nos.find((n) => n.id === chave);
    assert.ok(folha.tags.includes(d.tag), `${chave}: a folha não carrega a etiqueta da divergência`);
    const no = nos.find((n) => n.topic === d.no);
    assert.ok(no?.tags?.includes(d.tag), `${chave}: o nó divergente não carrega a etiqueta — o número do board fica sozinho`);
  }
});

// 033/T035/FR-005 — a divergência do CTR por posição precisa dizer QUAL régua julga cada faixa,
// agora que há veredito por faixa ao lado da transcrição (`porFaixaDePosicao`).
test("a divergência de ctrPorPosicao diz qual régua julga cada faixa, não só que a tabela do board diverge", () => {
  const d = DIVERGENCIAS.ctrPorPosicao;
  assert.match(d.nota, /BENCHMARK/);
  assert.match(d.tag, /veredito/i, "a etiqueta passa a dizer que há veredito ao lado da transcrição");
});
