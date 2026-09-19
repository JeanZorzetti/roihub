import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, EDITORIAIS, regua } from "@/lib/gsc-delta.mjs";
import { layoutDeArvore, caminhoDaLigacao, recuosPorNivel } from "@/lib/arvore-layout.mjs";
import { Tabs } from "../tabs";

// O BOARD DE GSC, DESENHADO (031). O board `okr-Saw2eoSKZDPLJAk6xeDBuS` do Whimsical como ÁRVORE,
// com a procedência que o levantamento de 19/09/2026 apurou por folha.
//
// ⚠️ NENHUM NÚMERO DESTA TELA É DIGITADO. O total de folhas e o placar por natureza saem de
// `CATALOGO`, contados a cada render. A razão é histórica e vale registrar: o levantamento em
// markdown escreveu "26 folhas, 4 com régua" à mão, e os dois números estavam errados — o board
// decompõe em 32 folhas, e 7 têm régua. Um total escrito à mão descola do catálogo na primeira
// folha que mudar de natureza, e ninguém percebe porque texto não tem como reclamar.
//
// SVG no servidor, zero dependência: o board é uma árvore (raiz à esquerda, ramificação para a
// direita, uma linha por folha), e árvore não precisa de engine de grafo. Cytoscape, Sigma e
// companhia existem para redes com ciclos e N-para-N; uma taxonomia hierárquica não tem nem um nem
// outro. O que falta é LAYOUT, e ele mora em `lib/arvore-layout.mjs`, testado sem subir o Next.
//
// ⚠️ ESTA TELA NÃO LÊ DADO DE PROJETO NENHUM, e a ausência é o desenho. Os números da Atma vivem em
// `/okr/atma/aquisicao`; repeti-los aqui daria DUAS telas discordando sobre o mesmo KPI na primeira
// mudança — o defeito que `lib/janelas.mjs` proibiu para janelas.
//
// O DESENHO É O DADO: os nós saem de `CATALOGO`, então a árvore não pode divergir do motor. Um
// board que vive num editor externo diverge do código na primeira mudança e ninguém percebe; este
// não tem como, porque é o código.
export const dynamic = "force-static";

export const metadata: Metadata = { title: "Board GSC — a árvore de KPIs e a procedência de cada um" };

const RAMOS: { id: string; nome: string }[] = [
  { id: "clique", nome: "CLIQUE" },
  { id: "ctr", nome: "CTR" },
  { id: "posicao", nome: "POSIÇÃO MÉDIA" },
  { id: "impressoes", nome: "IMPRESSÕES" },
];

const ROTULO_NATUREZA: Record<string, string> = {
  recusa: "parâmetro editorial, sem fonte",
  semColetor: "sem coletor",
  norma: "norma, não régua",
  procedimento: "procedimento",
};

type Regua =
  | { tem: true; meta: number | [number, number] | null; fonte: { fonte: string; url: string; acessadoEm: string; recorte: string } }
  | { tem: false; motivo: string; natureza: string };

// Geometria. `PASSO_Y` é o espaçamento entre FOLHAS e é ele que dá a altura: uma folha por linha.
// As larguras são POR NÍVEL porque os nomes dos KPIs são longos e a raiz é uma palavra — uma
// largura única esticaria a árvore inteira pelo pior caso e deixaria a raiz a 300px do primeiro
// ramo, com o traço atravessando o vazio.
const PASSO_Y = 26;
const LARGURAS = [80, 180, 300];
// Largura m�dia de caractere POR N�VEL, para estimar onde o r�tulo termina. Generosa de prop�sito:
// ver `larguraDoTexto` em `lib/arvore-layout.mjs`. N�vel 0 � 14px bold; n�vel 1 � 11px bold
// mai�sculo com letter-spacing, que � o que mais engana quem estima por contagem de caracteres.
const PX_POR_CHAR = [9.5, 8];

export default async function BoardGscPage() {
  const cat = CATALOGO as Record<string, { nome: string; ramo: string }>;
  const chaves = Object.keys(cat);

  // A árvore sai do CATÁLOGO — nunca de uma estrutura escrita aqui. Uma segunda lista de folhas
  // divergiria do motor na primeira folha nova, e o desenho passaria a mostrar um board que o
  // código não usa mais: exatamente o que aconteceu com o Whimsical.
  const arvore = {
    id: "gsc",
    rotulo: "GSC",
    filhos: RAMOS.map((r) => ({
      id: r.id,
      rotulo: r.nome,
      filhos: chaves
        .filter((k) => cat[k].ramo === r.id)
        .map((k) => ({ id: k, rotulo: cat[k].nome, chave: k })),
    })),
  };

  const { nos, ligacoes, largura, altura } = layoutDeArvore(arvore, {
    passoY: PASSO_Y,
    larguraNivel: LARGURAS,
    margemX: 10,
    margemY: 16,
  });
  // O recuo sai do R�TULO MAIS LONGO de cada n�vel, nunca de uma constante: com 8px fixos, medido
  // em 19/09/2026, o leque de POSI��O M�DIA convergia dentro da palavra e os tra�os atravessavam
  // as letras. Tirado do dado, ele acompanha um ramo renomeado sem ningu�m lembrar de ajustar.
  const recuos = recuosPorNivel(nos, PX_POR_CHAR);

  // O placar sai da CONTAGEM, nunca de um número escrito aqui: um total digitado à mão descola do
  // catálogo na primeira folha que mudar de natureza, e foi o que aconteceu quando o TTFB saiu de
  // recusa para régua e o estudo em markdown continuou dizendo "4".
  const contagem = chaves.reduce<Record<string, number>>((acc, k) => {
    const r = regua(k) as Regua;
    const key = r.tem ? "regua" : r.natureza;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="page">
      <Tabs active="gsc" />

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Referência · board de GSC</p>
        <h1 className="ficha-nome">A árvore de KPIs, e contra o que cada folha é julgada</h1>
        <p className="foot">
          As {chaves.length} folhas do board, com a procedência apurada em <strong>19/09/2026</strong>.
          Esta tela <strong>não tem número de projeto</strong> — ela diz o que os números significam.
          Os da Atma estão em <a href="/okr/atma/aquisicao">aquisição</a>.
        </p>

        {/* ── A ÁRVORE ────────────────────────────────────────────────────────────────────────
            `role="img"` com `aria-label` no SVG e a MESMA informação em tabela logo abaixo: um
            desenho que só existe como desenho é inacessível, e a tabela não é duplicação, é o
            segundo portador. */}
        <figure className="arv">
          <svg
            className="arv-svg"
            viewBox={`0 0 ${largura} ${altura}`}
            role="img"
            aria-label={`Árvore do board de GSC: ${RAMOS.map((r) => r.nome).join(", ")}, com ${chaves.length} KPIs no total. A mesma informação está na tabela abaixo.`}
          >
            {/* Traços primeiro, nós por cima: o traço que passa atrás de um rótulo some sob o
                fundo dele, e não precisa de máscara. */}
            {ligacoes.map((l) => (
              <path
                key={`${l.de.id}-${l.para.id}`}
                className="arv-t"
                d={caminhoDaLigacao(l, recuos[l.de.nivel] ?? 0)}
                fill="none"
              />
            ))}
            {nos.map((n) => {
              const r = n.folha ? (regua(n.id) as Regua) : null;
              // O marcador da régua é FORMA, não cor: losango cheio tem fonte, vazado não tem.
              // Impresso em cinza a distinção sobrevive — mesma regra do `.org` na tela de
              // aquisição e do hachurado contra o cheio na composição.
              const marcador = r ? (r.tem ? "◆" : "◇") : null;
              return (
                <g key={n.id} className={`arv-n arv-n${n.nivel}${n.folha ? " arv-f" : ""}`}>
                  {marcador ? (
                    <text className="arv-m" x={n.x} y={n.y} dominantBaseline="middle">
                      {marcador}
                    </text>
                  ) : null}
                  <text
                    x={marcador ? n.x + 13 : n.x}
                    y={n.y}
                    dominantBaseline="middle"
                  >
                    {n.rotulo}
                  </text>
                </g>
              );
            })}
          </svg>
          <figcaption className="foot">
            <span className="arv-k">◆</span> régua publicada, com fonte e recorte ·{" "}
            <span className="arv-k">◇</span> sem régua: o número existe e ninguém publica a faixa
            dele. <strong>Cheio e vazado, não cor</strong> — a distinção sobrevive ao cinza e à
            impressão.
          </figcaption>
        </figure>

        <ul className="lts">
          <li className="lt">
            <span className="lt-v">{contagem.regua ?? 0}</span>
            <span className="lt-r">
              com <strong>régua publicada</strong> — fonte, URL, data de acesso e recorte declarados
            </span>
          </li>
          <li className="lt">
            <span className="lt-v">{contagem.recusa ?? 0}</span>
            <span className="lt-r">
              sem fonte: o número existe e <strong>ninguém publica</strong> a faixa dele
            </span>
          </li>
          <li className="lt">
            <span className="lt-v">{contagem.semColetor ?? 0}</span>
            <span className="lt-r">
              sem coletor no hub — falta <strong>ligar a fonte</strong>, não procurar estudo
            </span>
          </li>
          <li className="lt">
            <span className="lt-v">{(contagem.norma ?? 0) + (contagem.procedimento ?? 0)}</span>
            <span className="lt-r">
              norma binária ou procedimento: <strong>não existe quartil</strong> de válido ou inválido
            </span>
          </li>
        </ul>

        <p className="foot">
          <strong>Que a maioria não tenha régua não é defeito desta tela.</strong> É o board dizendo
          o que ele sempre foi: uma taxonomia de diagnóstico com valores editoriais. Como mapa do que
          olhar no Search Console, é bom. Como fonte de limiar para um motor de veredito, dois terços
          dele não têm de onde vir. O levantamento inteiro, com as contradições e as fontes
          descartadas, está em <code>handoff/gsc-balizador-estudo.md</code>.
        </p>
      </section>

      {RAMOS.map((ramo) => {
        const doRamo = chaves.filter((k) => cat[k].ramo === ramo.id);
        if (!doRamo.length) return null;
        return (
          <section className="card ag-section" data-info="gsc" key={ramo.id}>
            <p className="eyebrow">{ramo.nome}</p>
            <table className="inst">
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col">Medido em</th>
                  <th scope="col">Régua</th>
                </tr>
              </thead>
              <tbody>
                {doRamo.map((k) => {
                  const r = regua(k) as Regua;
                  const onde = (MEDIDO_POR as Record<string, string>)[k];
                  return (
                    <tr key={k}>
                      <td className="inst-n">{cat[k].nome}</td>
                      <td className="inst-q">
                        {/* Ausência NOMEADA: um traço faria "ninguém mediu ainda" parecer com "não
                            se aplica", e os dois pedem trabalho oposto. */}
                        {onde ? <code>{onde}</code> : <span className="lt-v-sem">nenhum coletor</span>}
                      </td>
                      <td>
                        {r.tem ? (
                          <span className="org org-com">
                            <a href={r.fonte.url} target="_blank" rel="noreferrer">
                              {r.fonte.fonte}
                            </a>
                            {r.meta !== null ? (
                              <>
                                {" "}
                                · limiar{" "}
                                <strong>
                                  {Array.isArray(r.meta) ? `${r.meta[0]} a ${r.meta[1]}` : r.meta}
                                </strong>
                              </>
                            ) : null}{" "}
                            · {r.fonte.recorte} · acessado em {r.fonte.acessadoEm}
                          </span>
                        ) : (
                          <span className="org org-sem">
                            {ROTULO_NATUREZA[r.natureza] ?? r.natureza}
                            {r.motivo ? <>: {r.motivo}</> : null}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Sem origem</p>
        <h2 className="ficha-nome">Os números que estão no código e não vieram de estudo nenhum</h2>
        <p className="foot">
          Não estão <strong>errados</strong> — estão <strong>sem fonte</strong>, que é diferente. A
          lista existe para que a tela possa marcá-los com o losango vazado em vez de exibi-los com a
          mesma tipografia de <code>LCP ≤ 2,5s</code>, e para que mudá-los seja decisão consciente em
          vez de ajuste fino de constante. Sai de <code>lib/gsc-delta.mjs#EDITORIAIS</code>, e um
          teste reprova quem apagar uma entrada sem apagar o número.
        </p>
        <dl className="gsc-ed">
          {Object.entries(EDITORIAIS as Record<string, string>).map(([onde, porque]) => (
            <div key={onde}>
              <dt>
                <code>{onde}</code>
              </dt>
              <dd>{porque}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
