"use client";

import { useEffect, useRef, useState } from "react";
import MindElixir from "mind-elixir";
import type { MindElixirData, MindElixirInstance, NodeObj } from "mind-elixir";
import "mind-elixir/style";

// O MAPA INTERATIVO (032). A ÚNICA tela do hub que roda `"use client"` por causa de uma biblioteca.
//
// ⚠️ `note` NÃO É RENDERIZADO PELA BIBLIOTECA. Medido na 5.15.1: a string "note" aparece ZERO vez em
// `dist/MindElixir.js` — o campo existe no tipo, é guardado, é exportado no JSON, e nunca vira pixel.
// Posto na confiança de que a lib mostra, todo o parágrafo do board ficaria invisível e o mapa seria
// 113 rótulos curtos sem nenhuma definição. O painel abaixo do mapa existe por isso, e é ele que faz
// a nota ser informação em vez de dado morto.
//
// A versão do npm mente sobre estabilidade: a tag `latest` do `mind-elixir` aponta para
// `6.0.0-next.4`, um prerelease. `package.json` fixa **5.15.1**, a última estável de verdade.
//
// ⚠️ O MAPA NÃO É O ÚNICO PORTADOR. A página serve a mesma árvore como lista aninhada no servidor,
// e é ela que responde sem JS, na impressão e no leitor de tela. Mesma regra que o SVG de `/gsc`
// segue com a tabela: um desenho que só existe como desenho é inacessível.

type Meta = {
  chave: string;
  ramo: string;
  selo: string;
  marca: string;
  url: string | null;
  medidoPor: string | null;
};

type NoSelecionado = { topic: string; note?: string; metadata?: Meta };

/**
 * O tema, preso aos tokens do hub.
 *
 * A biblioteca traz paleta própria (roxo/laranja/verde saturados) e ela ganharia de qualquer coisa
 * que o resto do hub faz — a aparência default de toda biblioteca de grafo é o desenho dela, não o
 * seu. `palette` é a cor POR RAMO, na ordem de `RAMOS` em `lib/board-gsc.mjs`; nenhuma é verde nem
 * vermelha, porque neste hub as duas carregam estado e um ramo verde leria como aprovado.
 */
const TEMA = {
  name: "roihub",
  type: "light" as const,
  palette: ["#1d4ed8", "#6d28d9", "#0f766e", "#a16207"],
  cssVar: {
    // Vãos apertados contra os defaults (65/30/45/10). Medido em 19/09/2026: com os defaults o mapa
    // saía com 1.636px de largura numa caixa de 1.160 e CORTAVA o rótulo dos nós dos dois lados —
    // "4. Taxa de Integridade do Título (Sem Truncamento / Sem…" terminava na borda. Rótulo cortado
    // é nó que não existe para quem lê, e nenhuma medida de "nós visíveis" acusa isso: eles estão
    // lá, dentro da caixa, ilegíveis.
    "--main-gap-x": "38px",
    "--main-gap-y": "26px",
    "--node-gap-x": "18px",
    "--node-gap-y": "8px",
    "--map-padding": "24px 32px",
    "--main-color": "#0b0b0b",
    "--main-bgcolor": "#fcfcfb",
    "--color": "#52514e",
    "--bgcolor": "#f9f9f7",
    "--selected": "#1d4ed8",
    "--panel-color": "#0b0b0b",
    "--panel-bgcolor": "#fcfcfb",
    "--panel-border-color": "#e1e0d9",
    "--root-color": "#fcfcfb",
    "--root-bgcolor": "#0b0b0b",
    "--root-border-color": "#0b0b0b",
  },
};

export function Mapa({ dados }: { dados: MindElixirData }) {
  const caixa = useRef<HTMLDivElement>(null);
  const instancia = useRef<MindElixirInstance | null>(null);
  const [no, setNo] = useState<NoSelecionado | null>(null);

  useEffect(() => {
    if (!caixa.current || instancia.current) return;

    const me = new MindElixir({
      el: caixa.current,
      // `SIDE` e não `RIGHT`, decidido por medição em 19/09/2026 e não por gosto: com tudo à
      // direita o mapa saía com 2.693px de altura numa caixa de 630, e abria mostrando 5 dos 44 nós
      // — o Whimsical de volta, que é o defeito que esta tela existe para consertar. Irradiando dos
      // dois lados a altura cai pela metade. O custo é real e está declarado: a ordem 1-2-3-4 dos
      // ramos deixa de ser de cima para baixo. Ela sobrevive na numeração do próprio rótulo e na
      // lista abaixo, que é servida na ordem do board.
      direction: MindElixir.SIDE,
      // `editable: false` — arrastar nó reordenaria um board que não é nosso para reordenar.
      editable: false,
      contextMenu: false,
      toolBar: true,
      keypress: true,
      overflowHidden: false,
      theme: TEMA,
    });

    // `structuredClone` porque `init` MUTA o dado: a lib pendura `parent` em cada nó, e o objeto
    // vem serializado do servidor e é reusado se o efeito rodar duas vezes (StrictMode em dev).
    // As folhas chegam com `expanded: false` de `mapaDoBoard()` — os 113 nós abertos de saída são o
    // Whimsical de volta (2.139 × 5.614 px). Aberto fica o esqueleto: raiz, 4 ramos, 5 grupos, 32 KPIs.
    me.init(structuredClone(dados));
    // `toCenter()` porque `init` sozinho deixava o canvas em `y: -786px` num container de 630px —
    // medido em 19/09/2026: o mapa abria com a raiz acima do topo da caixa e a primeira tela era
    // vazia. `scaleFit()` resolveria o enquadramento e não serve: um mapa de 2.693px de altura numa
    // caixa de 630 cabe a ~23% de zoom, que é o Whimsical ilegível de volta.
    me.toCenter();

    me.bus.addListener("selectNodes", (nos: NodeObj[]) => {
      const n = nos[0];
      setNo(n ? { topic: n.topic, note: n.note, metadata: n.metadata as Meta | undefined } : null);
    });
    me.bus.addListener("unselectNodes", () => setNo(null));

    // Expandir um nó do lado ESQUERDO empurra os filhos para fora do container, e `overflow:hidden`
    // os corta: medido em 19/09/2026, o "Meta: 20% a 30%" de Penetração no Top 3 nascia 1.059px à
    // esquerda da borda. Sem isso a interação principal do mapa parece não ter feito nada — o pior
    // tipo de falha, porque não erra, some. `scrollIntoView` é da própria lib.
    // `me.findEle` e não o estático `MindElixir.E`: os dois são a MESMA função, mas ela é declarada
    // com `this: MindElixirInstance` e o estático não tem instância — `tsc` reprova, e com razão.
    me.bus.addListener("expandNode", (n: NodeObj) => {
      const el = me.findEle(n.id);
      // `forceCenter` porque o nó expandido JÁ está visível — é o filho que nasce fora. Sem ele a
      // função não mexe em nada e o filho parava a 117px da borda esquerda (contra 1.059 sem
      // chamada nenhuma): meio conserto, que num mapa é o mesmo que nenhum.
      if (el) me.scrollIntoView(el, true);
    });

    instancia.current = me;
    return () => {
      instancia.current = null;
      if (caixa.current) caixa.current.innerHTML = "";
    };
  }, [dados]);

  return (
    <div className="me-wrap">
      {/* `tabIndex` e `aria-describedby`: a lib não dá papel nenhum ao container, e sem isso o mapa
          é um buraco na passagem de Tab. A descrição manda quem usa leitor de tela para a lista
          abaixo, que é onde a mesma árvore está em forma navegável. */}
      <div
        ref={caixa}
        className="me-box"
        tabIndex={0}
        role="application"
        aria-label="Mapa mental do board de GSC"
        aria-describedby="me-alt"
      />
      {/* O salto não é conveniência: medida a passagem de Tab em 19/09/2026, sair do mapa custa ~25
          tabulações — uma por expansor. Não é armadilha (dá para escapar), mas quem navega por
          teclado paga 25 paradas para chegar ao conteúdo que responde melhor. Mesmo padrão do
          "Pular para o conteúdo" que a `Tabs` já usa. */}
      <p id="me-alt" className="foot">
        Mapa interativo: arraste para deslocar, roda do mouse para o zoom, clique num nó para ler a
        definição do board. A <strong>mesma árvore em lista</strong>, navegável por teclado e sem
        JavaScript, está <a href="#board-lista">logo abaixo</a>.
      </p>

      {/* ── O PAINEL ────────────────────────────────────────────────────────────────────────────
          `aria-live="polite"`: a seleção acontece no mapa e o texto muda aqui embaixo, longe do
          foco. Sem o live region, quem usa leitor de tela clica e não ouve nada mudar. */}
      <aside className="me-painel" aria-live="polite">
        {!no ? (
          // Estado vazio NOMEADO, nunca um branco mudo: "nada selecionado" e "este nó não tem
          // definição no board" pedem ações opostas, e um painel em branco diz os dois.
          <p className="me-vazio">Nenhum nó selecionado — clique num nó do mapa para ler a definição.</p>
        ) : (
          <>
            <p className="eyebrow">
              {no.metadata ? `KPI · ramo ${no.metadata.ramo}` : "Nó do board"}
            </p>
            <h3 className="me-painel-t">{no.topic}</h3>

            {no.metadata ? (
              <>
                <p className={no.metadata.marca === "◆" ? "org org-com" : "org org-sem"}>
                  <strong>{no.metadata.selo}</strong>
                  {no.note ? <> — {no.note}</> : null}{" "}
                  {no.metadata.url ? (
                    <a href={no.metadata.url} target="_blank" rel="noreferrer">
                      ver a fonte
                    </a>
                  ) : null}
                </p>
                <p className="foot">
                  Medido em{" "}
                  {no.metadata.medidoPor ? (
                    <code>{no.metadata.medidoPor}</code>
                  ) : (
                    <span className="lt-v-sem">nenhum coletor</span>
                  )}
                </p>
              </>
            ) : no.note ? (
              <p className="me-nota">{no.note}</p>
            ) : (
              <p className="me-vazio">
                O board não escreve nada neste nó — ele agrupa, e o texto está nos filhos.
              </p>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
