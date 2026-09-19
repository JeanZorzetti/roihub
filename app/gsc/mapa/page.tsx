import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, regua } from "@/lib/gsc-delta.mjs";
import { DIVERGENCIAS, mapaDoBoard, RAMOS } from "@/lib/board-gsc.mjs";
import { Tabs } from "../../tabs";
import { Mapa } from "./mapa";

// O BOARD DE GSC COMO MAPA MENTAL (032). O Whimsical `okr-Saw2eoSKZDPLJAk6xeDBuS` completo — os
// níveis que `/gsc` não desenha porque o SVG dele para na folha.
//
// POR QUE UMA SEGUNDA TELA E NÃO A SUBSTITUIÇÃO DE `/gsc`: as duas respondem perguntas diferentes.
// `/gsc` responde "contra o que este KPI é julgado" — 32 linhas, estático, imprimível, zero JS, e é
// dele que sai o placar de procedência. Esta responde "o que este KPI É, na definição do board" —
// 113 nós em 6 níveis (medidos, nunca estimados: ver `fundo`), e a prosa que só existia dentro do
// editor. Fundir as duas custaria o render
// estático da primeira para ganhar profundidade que a maior parte das visitas não pede.
//
// ⚠️ ESTA TELA TAMBÉM NÃO LÊ DADO DE PROJETO NENHUM, pelo mesmo motivo da irmã: os números da Atma
// vivem em `/okr/atma/aquisicao`, e repeti-los aqui daria duas telas discordando sobre o mesmo KPI.
//
// ⚠️ A META DO BOARD NÃO VIRA RÉGUA AO SER DESENHADA. Cada folha carrega o losango da procedência
// (`◆` tem fonte, `◇` não tem) e o painel imprime o motivo. Publicar "< 15% de reescrita" com a
// mesma tipografia de "LCP ≤ 2,5s" é o defeito que `/gsc` existe para acusar — e um mapa bonito é
// justamente onde ele passaria despercebido.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Board GSC — o mapa mental completo, com a definição de cada KPI",
};

export default function MapaDoBoardPage() {
  const dados = mapaDoBoard();
  const cat = CATALOGO as Record<string, { nome: string; ramo: string }>;
  const reguaDe = regua as (k: string) => { tem: boolean; meta: number | [number, number] | null };
  const medidoPor = MEDIDO_POR as Record<string, string | undefined>;

  type No = { id: string; topic: string; note?: string; tags?: string[]; children?: No[] };

  const nos = (n: No): number => 1 + (n.children ?? []).reduce((s, f) => s + nos(f), 0);
  const total = nos(dados.nodeData as No);

  // TODO número desta tela é COMPUTADO, e a regra nasceu de um erro publicado: a primeira versão
  // escreveu "7", "25" e "5 níveis" como texto corrido. Os 5 níveis eram 6 — 7 nós viviam no nível
  // que a tela dizia não existir, e a medida nunca tinha sido feita, foi estimada e propagada de
  // `.info/log.json`. Os 7/25 sobreviveriam intactos a mudar o balizador de uma folha, porque os
  // testes comparam LISTA contra LISTA e nunca contra a constante. Constante acoplada ao tamanho de
  // uma lista é armadilha: a lista muda, a constante fica, e a tela mente sem nenhum teste ficar
  // vermelho.
  const niveis = (n: No, d = 1): number => Math.max(d, ...(n.children ?? []).map((f) => niveis(f, d + 1)));
  const fundo = niveis(dados.nodeData as No);

  const chaves = Object.keys(cat);
  const comRegua = chaves.filter((k) => reguaDe(k).tem);
  // Régua ESCALAR × régua TABELADA: `ctrPorPosicao` e `ctrGap` são julgadas por uma tabela por faixa
  // de posição, não por um número, e o selo `◆` as igualava às outras cinco sem dizer isso.
  const escalar = comRegua.filter((k) => reguaDe(k).meta !== null);
  // Sem coletor ≠ sem faixa publicada, e os dois pedem trabalho OPOSTO: um é ligar a fonte, o outro
  // é aceitar que ninguém publica a régua. A frase antiga dizia "o número existe" para as 25 — e era
  // falsa para as que nenhum coletor mede.
  const semColetor = chaves.filter((k) => !medidoPor[k]);

  // A lista é gerada do MESMO `mapaDoBoard()` que alimenta o mapa. Uma segunda travessia escrita à
  // mão divergiria do desenho na primeira folha nova — e divergiria calada, porque o portador
  // acessível é justamente o que ninguém olha ao mudar o outro.
  const lista = (n: No, nivel: number) => (
    <li key={n.id}>
      <span className={`mb-n mb-n${Math.min(nivel, 3)}`}>{n.topic}</span>
      {n.tags?.map((t) => (
        <span className="mb-tag" key={t}>
          {t}
        </span>
      ))}
      {n.note ? <span className="mb-nota">{n.note}</span> : null}
      {n.children?.length ? <ul>{n.children.map((f) => lista(f, nivel + 1))}</ul> : null}
    </li>
  );

  return (
    <main className="page">
      <Tabs active="gsc" />

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Referência · board de GSC · mapa completo</p>
        <h1 className="ficha-nome">O board do Whimsical inteiro, e o que cada KPI quer dizer</h1>
        <p className="foot">
          As <strong>{Object.keys(cat).length} folhas</strong> do board com os níveis que a{" "}
          <a href="/gsc">árvore de procedência</a> não desenha: o título numerado, a família dentro do
          ramo e a definição — <em>o que mede</em>, <em>fórmula</em>, <em>meta recomendada</em>.{" "}
          <strong>{total} nós</strong> ao todo, em {fundo} níveis. Levantado do board{" "}
          <code>okr-Saw2eoSKZDPLJAk6xeDBuS</code> em <strong>19/09/2026</strong>.
        </p>
        <p className="foot">
          <strong>A meta do board não é régua.</strong> Ela está aqui porque é o que o board diz, não
          porque tem fonte: <span className="arv-k">◆</span> marca as {comRegua.length} folhas com
          limiar declarado — {escalar.length} com um número, {comRegua.length - escalar.length} com a
          tabela de CTR por faixa de posição —, <span className="arv-k">◇</span> as{" "}
          {chaves.length - comRegua.length} em que o hub não publica faixa nenhuma. Dessas,{" "}
          <strong>{semColetor.length} não têm coletor</strong>: ali o número não existe, e o trabalho
          é ligar a fonte, não procurar estudo. O motivo de cada ausência aparece no painel ao clicar
          no nó, e o placar fechado está na <a href="/gsc">árvore</a>.
        </p>
        <p className="foot">
          <strong>Onde o board e o código discordam, o nó diz.</strong> A transcrição não é corrigida
          — o board é o que o board diz —, mas o nó divergente carrega a etiqueta{" "}
          <span className="mb-tag">⚠</span> com o número que o hub usa para julgar, e o painel explica
          qual dos dois tem fonte. São {Object.keys(DIVERGENCIAS).length}:{" "}
          {Object.keys(DIVERGENCIAS)
            .map((k) => cat[k].nome)
            .join(" · ")}
          .
        </p>

        <Mapa dados={dados} />
      </section>

      {/* ── O SEGUNDO PORTADOR ────────────────────────────────────────────────────────────────
          O mapa é `role="application"` e vive de clique e roda de mouse. A mesma árvore em lista
          aninhada responde sem JavaScript, na impressão, na busca da página (Ctrl+F acha a prosa
          que no mapa está atrás de uma seleção) e no leitor de tela, que lê `ul` aninhada como
          hierarquia. Não é duplicação — é a mesma informação num portador que o mapa não cobre. */}
      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">O mesmo board em lista</p>
        <h2 className="ficha-nome">Sem JavaScript, e com a prosa toda aberta</h2>
        <p className="foot">
          Tudo o que o mapa mostra atrás de um clique está aqui em texto corrido — inclusive as notas,
          que no mapa só aparecem no painel. É esta versão que a impressão e o <kbd>Ctrl</kbd>+
          <kbd>F</kbd> alcançam.
        </p>
        {/* `tabIndex={-1}` para o alvo receber o foco de fato — sem ele o navegador rola até a
            âncora e deixa o foco no link dentro do mapa, e o próximo Tab volta para os expansores. */}
        <ol className="mapa-board" id="board-lista" tabIndex={-1}>
          {(dados.nodeData as No).children?.map((r) => lista(r, 0))}
        </ol>
      </section>

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Procedência</p>
        <h2 className="ficha-nome">De onde estes nós vieram</h2>
        <p className="foot">
          O board vive em <code>whimsical.com/v-rtice3/okr-Saw2eoSKZDPLJAk6xeDBuS</code> e não tem API
          de leitura — o conteúdo foi transcrito do render completo em 19/09/2026 e mora em{" "}
          <code>lib/board-gsc.mjs</code>, com as chaves presas às do <code>CATALOGO</code>. Um teste
          reprova nos dois sentidos: chave daqui que não existe no catálogo, e folha do catálogo sem
          detalhe aqui. É a trava que faltava — o board foi reconstruído do zero três vezes porque
          cada tentativa escrevia a própria lista de KPIs, e listas divergem em silêncio.
        </p>
        <ul className="lts">
          {RAMOS.map((r) => {
            const n = Object.keys(cat).filter((k) => cat[k].ramo === r.id).length;
            return (
              <li className="lt" key={r.id}>
                <span className="lt-v" style={{ color: r.cor }}>
                  {n}
                </span>
                <span className="lt-r">
                  KPIs em <strong>{r.nome}</strong>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="foot">
          Divergência conhecida e mantida: o board tem <strong>um</strong> nó para "Taxa de
          Integridade do Título" com três metas dentro; o catálogo tem <strong>três</strong> folhas,
          porque as três têm procedência diferente — a largura em pixels tem fonte, a taxa de
          reescrita e a posição do termo não têm. O mapa mostra as duas coisas: o grupo do board e as
          três folhas com o losango de cada uma. O caminho do grupo está em{" "}
          <code>lib/board-gsc.mjs#GRUPOS</code>.
        </p>
      </section>
    </main>
  );
}
