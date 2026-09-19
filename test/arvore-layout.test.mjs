import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutDeArvore, caminhoDaLigacao, larguraDoTexto, recuosPorNivel } from "../lib/arvore-layout.mjs";

const folha = (id) => ({ id, rotulo: id });

test("uma folha por linha, na ordem em que aparecem", () => {
  const { nos } = layoutDeArvore(
    { id: "r", rotulo: "r", filhos: [folha("a"), folha("b"), folha("c")] },
    { passoY: 10, margemY: 0 }
  );
  const y = (id) => nos.find((n) => n.id === id).y;
  assert.deepEqual([y("a"), y("b"), y("c")], [0, 10, 20]);
});

test("o pai fica no MEIO dos filhos — é isso que faz o pente do board", () => {
  const { nos } = layoutDeArvore(
    { id: "r", rotulo: "r", filhos: [folha("a"), folha("b"), folha("c")] },
    { passoY: 10, margemY: 0 }
  );
  assert.equal(nos.find((n) => n.id === "r").y, 10, "meio de 0 e 20");
});

test("o meio sai dos EXTREMOS, não da média de todos", () => {
  // 4 folhas num ramo e 1 no outro: a média de todos puxaria o pai para o lado cheio, e a linha
  // do meio deixaria de apontar para o centro do grupo.
  const raiz = {
    id: "r",
    rotulo: "r",
    filhos: [
      { id: "g", rotulo: "g", filhos: [folha("a"), folha("b"), folha("c"), folha("d")] },
      folha("e"),
    ],
  };
  const { nos } = layoutDeArvore(raiz, { passoY: 10, margemY: 0 });
  // folhas em 0,10,20,30 (dentro de g) e 40 (e). g fica em 15; a raiz entre 15 e 40 = 27,5
  assert.equal(nos.find((n) => n.id === "g").y, 15);
  assert.equal(nos.find((n) => n.id === "r").y, 27.5);
});

test("níveis de larguras diferentes não se sobrepõem", () => {
  // `nivel * largura` colocaria o nível 2 em cima do 1 quando as larguras diferem
  const raiz = {
    id: "r",
    rotulo: "r",
    filhos: [{ id: "m", rotulo: "m", filhos: [folha("f")] }],
  };
  const { nos } = layoutDeArvore(raiz, { larguraNivel: [50, 300], margemX: 0 });
  const x = (id) => nos.find((n) => n.id === id).x;
  assert.deepEqual([x("r"), x("m"), x("f")], [0, 50, 350]);
});

test("a altura cobre a última folha — SVG cortado não reclama, só corta", () => {
  const { altura } = layoutDeArvore(
    { id: "r", rotulo: "r", filhos: [folha("a"), folha("b")] },
    { passoY: 10, margemY: 5 }
  );
  assert.equal(altura, 20, "última folha em 15, mais a margem");
});

test("cada ligação liga um par de nós posicionados", () => {
  const { nos, ligacoes } = layoutDeArvore({
    id: "r",
    rotulo: "r",
    filhos: [folha("a"), { id: "m", rotulo: "m", filhos: [folha("b")] }],
  });
  assert.equal(ligacoes.length, nos.length - 1, "árvore com N nós tem N-1 arestas");
  for (const l of ligacoes) assert.equal(l.para.nivel, l.de.nivel + 1);
});

test("folha e nó interno são distinguíveis", () => {
  const { nos } = layoutDeArvore({ id: "r", rotulo: "r", filhos: [folha("a")] });
  assert.equal(nos.find((n) => n.id === "r").folha, false);
  assert.equal(nos.find((n) => n.id === "a").folha, true);
});

test("árvore de um nó só não quebra", () => {
  const { nos, ligacoes, altura } = layoutDeArvore(folha("sozinho"), { passoY: 10, margemY: 4 });
  assert.equal(nos.length, 1);
  assert.equal(ligacoes.length, 0);
  assert.equal(altura, 8);
});

test("a curva sai reta quando os dois nós estão na mesma linha", () => {
  const l = { de: { x: 0, y: 50 }, para: { x: 100, y: 50 } };
  const d = caminhoDaLigacao(l);
  // os dois pontos de controle no mesmo y da reta: a cúbica degenera em segmento
  assert.equal(d, "M 0 50 C 50 50, 50 50, 100 50");
});

test("o recuo afasta o traço do rótulo de origem", () => {
  const l = { de: { x: 0, y: 0 }, para: { x: 100, y: 20 } };
  assert.match(caminhoDaLigacao(l, 30), /^M 30 0 C 65 0, 65 20, 100 20$/);
});

// ---------- o recuo por nivel (19/09/2026) ----------

// O defeito: com recuo FIXO, o leque de um ramo de rotulo longo convergia DENTRO da palavra e os
// tracos atravessavam as letras. So abrir o PNG pegou; nenhum teste anterior podia pegar, porque
// nenhum deles conhecia a largura do texto.
test("o recuo sai do rotulo MAIS LONGO do nivel, nunca do primeiro", () => {
  const nos = [
    { rotulo: "CTR", nivel: 1, folha: false },
    { rotulo: "POSICAO MEDIA", nivel: 1, folha: false },
    { rotulo: "GSC", nivel: 0, folha: false },
  ];
  const r = recuosPorNivel(nos, [9.5, 8], 12);
  assert.equal(r[1], 13 * 8 + 12, "o ramo mais longo manda no nivel inteiro");
  assert.equal(r[0], 3 * 9.5 + 12);
});

test("folha nao empurra o recuo do nivel", () => {
  // um rotulo de folha longo somado ao recuo jogaria a coluna de tracos para fora da tela
  const nos = [
    { rotulo: "CTR", nivel: 1, folha: false },
    { rotulo: "Densidade de links internos contextuais", nivel: 1, folha: true },
  ];
  assert.equal(recuosPorNivel(nos, [9.5, 8], 12)[1], 3 * 8 + 12);
});

test("o traco parte DEPOIS do rotulo, nunca por cima dele", () => {
  const x = 90; // x do nivel 1
  const recuo = recuosPorNivel([{ rotulo: "POSICAO MEDIA", nivel: 1, folha: false }], [9.5, 8], 12)[1];
  const fimDoRotulo = x + larguraDoTexto("POSICAO MEDIA", 8);
  const partida = x + recuo;
  assert.ok(partida > fimDoRotulo, `traco parte em ${partida} e o rotulo termina em ${fimDoRotulo}`);
});

test("larguraDoTexto aguenta nulo sem virar NaN", () => {
  assert.equal(larguraDoTexto(null, 8), 0);
  assert.equal(larguraDoTexto(undefined, 8), 0);
});
