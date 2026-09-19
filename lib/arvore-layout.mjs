// O LAYOUT DE ÁRVORE (031) — coordenadas para desenhar o board, não para julgá-lo.
//
// O board do Whimsical é uma ÁRVORE: raiz à esquerda, ramificação para a direita, uma linha por
// folha. Reproduzi-lo no hub não precisa de biblioteca de grafo — Cytoscape, Sigma e companhia
// existem para redes com ciclos e N-para-N, e uma taxonomia hierárquica não tem nem um nem outro.
// O que falta é LAYOUT, e layout de árvore é aritmética.
//
// Algoritmo: Reingold-Tilford na forma simples (suficiente para árvore de profundidade fixa, sem
// subárvores que precisem de deslocamento lateral):
//   — percorre em pós-ordem;
//   — FOLHA ocupa o próximo slot livre;
//   — NÓ INTERNO fica no meio entre o primeiro e o último filho.
// O resultado é o "pente" do Whimsical: as folhas empilhadas, os pais centrados nelas.
//
// Zero rede, zero banco, zero relógio, zero DOM (Princípio III): devolve números, e quem desenha é
// a tela. Testável em milissegundos, e o desenho não pode divergir do dado porque o dado é a
// entrada.

/**
 * @typedef {{ id: string, rotulo: string, filhos?: No[], [extra: string]: unknown }} No
 * @typedef {{ id: string, rotulo: string, x: number, y: number, nivel: number, folha: boolean,
 *             dados: No }} NoPosicionado
 * @typedef {{ de: NoPosicionado, para: NoPosicionado }} Ligacao
 */

/**
 * Posiciona a árvore.
 *
 * `passoY` é o espaçamento entre FOLHAS — é ele que dá a altura total, porque toda folha ocupa uma
 * linha própria. `larguraNivel` é o espaço horizontal de cada nível; passar um array permite que o
 * nível dos rótulos longos (os nomes dos KPIs) receba mais largura que o da raiz, sem esticar a
 * árvore inteira pelo pior caso.
 *
 * @param {No} raiz
 * @param {{passoY?: number, larguraNivel?: number|number[], margemX?: number, margemY?: number}} [op]
 * @returns {{nos: NoPosicionado[], ligacoes: Ligacao[], largura: number, altura: number}}
 */
export function layoutDeArvore(raiz, op = {}) {
  const { passoY = 34, larguraNivel = 200, margemX = 12, margemY = 16 } = op;
  const larguraDe = (nivel) =>
    Array.isArray(larguraNivel) ? (larguraNivel[nivel] ?? larguraNivel[larguraNivel.length - 1]) : larguraNivel;
  // O x de um nível é a SOMA das larguras dos níveis anteriores, nunca `nivel * largura`: com
  // larguras diferentes por nível, a multiplicação colocaria o nível 3 em cima do 2.
  const xDe = (nivel) => {
    let x = margemX;
    for (let i = 0; i < nivel; i++) x += larguraDe(i);
    return x;
  };

  const nos = [];
  const ligacoes = [];
  let proximoSlot = 0;

  /** @returns {NoPosicionado} */
  function caminhar(no, nivel) {
    const filhos = Array.isArray(no.filhos) ? no.filhos : [];
    const posicionados = filhos.map((f) => caminhar(f, nivel + 1));
    // Folha ocupa o próximo slot; interno vai para o meio do primeiro e do último filho. Média dos
    // EXTREMOS e não de todos: com 5 filhos dos quais 4 são rasos, a média de todos puxaria o pai
    // para o lado dos rasos e a linha do meio deixaria de apontar para o centro do grupo.
    const y = posicionados.length
      ? (posicionados[0].y + posicionados[posicionados.length - 1].y) / 2
      : margemY + proximoSlot++ * passoY;
    const atual = {
      id: no.id,
      rotulo: no.rotulo,
      x: xDe(nivel),
      y,
      nivel,
      folha: posicionados.length === 0,
      dados: no,
    };
    nos.push(atual);
    for (const p of posicionados) ligacoes.push({ de: atual, para: p });
    return atual;
  }

  caminhar(raiz, 0);

  // A altura sai do ÚLTIMO slot usado, não de uma contagem de folhas feita à parte: as duas
  // divergiriam no dia em que um nó interno passasse a ocupar slot, e o SVG cortaria a última
  // linha sem ninguém perceber (o `viewBox` não reclama, ele só corta).
  const maiorY = nos.reduce((m, n) => Math.max(m, n.y), 0);
  const maiorNivel = nos.reduce((m, n) => Math.max(m, n.nivel), 0);
  return {
    nos,
    ligacoes,
    largura: xDe(maiorNivel) + larguraDe(maiorNivel) + margemX,
    altura: maiorY + margemY,
  };
}

/**
 * O caminho da ligação: uma curva em S entre dois nós, no estilo do board.
 *
 * Cúbica com os pontos de controle no MEIO do vão horizontal — é a forma que sai reta quando os
 * dois nós estão na mesma linha e curva quando não estão, sem um `if` separando os dois casos.
 *
 * @param {Ligacao} l
 * @param {number} recuo quanto o traço começa depois do nó de origem (o texto do rótulo)
 */
export function caminhoDaLigacao(l, recuo = 0) {
  const x1 = l.de.x + recuo;
  const x2 = l.para.x;
  const meio = x1 + (x2 - x1) / 2;
  return `M ${x1} ${l.de.y} C ${meio} ${l.de.y}, ${meio} ${l.para.y}, ${x2} ${l.para.y}`;
}

/**
 * A largura APROXIMADA de um texto, em unidades do viewBox.
 *
 * Estimativa e n�o medi��o: medir exigiria DOM, e este m�dulo � puro (Princ�pio III). A estimativa
 * � aceit�vel porque decide UMA coisa � onde o tra�o come�a � e nunca se o texto cabe ou � leg�vel.
 * Errar para mais deixa folga antes da curva; errar para menos faz o tra�o atravessar o r�tulo, que
 * � o defeito medido em 19/09/2026: com recuo fixo de 8px o leque de POSI��O M�DIA convergia DENTRO
 * da palavra, e s� abrir o PNG pegou. Por isso `pxPorChar` � generoso, nunca justo.
 *
 * @param {string} texto
 * @param {number} pxPorChar largura m�dia de um caractere na fonte daquele n�vel
 */
export const larguraDoTexto = (texto, pxPorChar) => String(texto ?? "").length * pxPorChar;

/**
 * O RECUO de cada n�vel: onde os tra�os daquele n�vel come�am, medido a partir do x do n�.
 *
 * Um valor POR N�VEL, tirado do r�tulo mais longo daquele n�vel � nunca um por n�. Com recuo por
 * n�, cada tra�o partiria de um x diferente e o leque viraria serrilhado; com um por n�vel todos
 * partem da mesma coluna, e � da� que sai a barra vertical que o board tem.
 *
 * Folha n�o entra na conta: dela n�o parte tra�o nenhum, e o r�tulo longo de uma folha empurraria
 * o recuo do n�vel inteiro para fora da tela.
 *
 * @param {NoPosicionado[]} nos
 * @param {number[]} pxPorChar por n�vel
 * @param {number} [folga] espa�o entre o fim do r�tulo e o come�o do tra�o
 * @returns {number[]} recuo por n�vel
 */
export function recuosPorNivel(nos, pxPorChar, folga = 12) {
  const porNivel = new Map();
  for (const n of nos) {
    if (n.folha) continue;
    const px = pxPorChar[n.nivel] ?? pxPorChar[pxPorChar.length - 1];
    porNivel.set(n.nivel, Math.max(porNivel.get(n.nivel) ?? 0, larguraDoTexto(n.rotulo, px)));
  }
  const saida = [];
  for (const [nivel, largura] of porNivel) saida[nivel] = largura + folga;
  return saida;
}
