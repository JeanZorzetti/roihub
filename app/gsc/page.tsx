import type { Metadata } from "next";
import { CATALOGO, MEDIDO_POR, EDITORIAIS, regua } from "@/lib/gsc-delta.mjs";
import { Tabs } from "../tabs";

// O BOARD DE GSC, publicado (031). A taxonomia do board `okr-Saw2eoSKZDPLJAk6xeDBuS` do Whimsical,
// com a procedência que o levantamento de 19/09/2026 apurou por folha.
//
// ⚠️ ESTA TELA NÃO LÊ DADO DE PROJETO NENHUM, e a ausência é o desenho. Os números da Atma vivem em
// `/okr/atma/aquisicao`, que já os renderiza há seis corridas; repeti-los aqui daria DUAS telas
// discordando sobre o mesmo KPI na primeira mudança — o defeito que `lib/janelas.mjs` proibiu para
// janelas e que este mesmo trabalho quase reintroduziu ao propor um `/gsc/[slug]`.
//
// O que esta tela responde, e nenhuma outra respondia: o que cada KPI É, ONDE ele é medido no
// código, e CONTRA O QUE ele é julgado — ou por que não é julgado contra nada. Era isso que o board
// do Whimsical fazia e que nenhuma tela do hub fazia.
//
// Estática por construção: sem banco, sem rede, sem relógio. O conteúdo sai de `CATALOGO`, então a
// página não pode divergir do motor — ela É o motor, renderizado.
export const dynamic = "force-static";

export const metadata: Metadata = { title: "Board GSC — a taxonomia e a procedência de cada KPI" };

const RAMOS: { id: string; nome: string; sub: string }[] = [
  { id: "clique", nome: "Clique", sub: "quem viu e clicou" },
  { id: "ctr", nome: "CTR", sub: "o snippet contra a posição" },
  { id: "posicao", nome: "Posição média", sub: "o que sustenta a posição" },
  { id: "impressoes", nome: "Impressões", sub: "quanto do mercado se alcança" },
];

const ROTULO_NATUREZA: Record<string, string> = {
  recusa: "parâmetro editorial, sem fonte",
  semColetor: "sem coletor",
  norma: "norma, não régua",
  procedimento: "procedimento",
};

type Folha = { chave: string; nome: string; ramo: string };

export default async function BoardGscPage() {
  const folhas: Folha[] = Object.entries(
    CATALOGO as Record<string, { nome: string; ramo: string }>
  ).map(([chave, v]) => ({ chave, nome: v.nome, ramo: v.ramo }));

  // O placar sai da CONTAGEM, nunca de um número escrito aqui: um total digitado à mão descola do
  // catálogo na primeira folha que mudar de natureza, e foi exatamente isso que aconteceu hoje
  // quando o TTFB saiu de recusa para régua e o estudo em markdown continuou dizendo "4".
  const contagem = folhas.reduce<Record<string, number>>((acc, f) => {
    const r = regua(f.chave);
    const k = r.tem ? "regua" : r.natureza;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="page">
      <Tabs active="gsc" />

      <section className="card ag-section" data-info="gsc">
        <p className="eyebrow">Referência · board de GSC</p>
        <h1 className="ficha-nome">O que cada KPI é, e contra o que ele é julgado</h1>
        <p className="foot">
          As {folhas.length} folhas do board, com a procedência apurada em <strong>19/09/2026</strong>.
          Esta tela <strong>não tem número de projeto</strong> — ela diz o que os números significam.
          Os da Atma estão em <a href="/okr/atma/aquisicao">aquisição</a>; o levantamento inteiro, com
          as contradições e as fontes descartadas, está em{" "}
          <code>handoff/gsc-balizador-estudo.md</code>.
        </p>

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

        {/* Por que a maioria não tem régua, UMA vez e no topo: sem esta linha, vinte losangos
            vazados leem como vinte defeitos da tela, e são vinte achados sobre o board. */}
        <p className="foot">
          <strong>Que a maioria não tenha régua não é defeito desta tela.</strong> É o board dizendo
          o que ele sempre foi: uma taxonomia de diagnóstico com valores editoriais. Como mapa do que
          olhar no Search Console, é bom. Como fonte de limiar para um motor de veredito, dois terços
          dele não têm de onde vir — e o hub passou a dizer isso em vez de emprestar autoridade.
        </p>
      </section>

      {RAMOS.map((ramo) => {
        const doRamo = folhas.filter((f) => f.ramo === ramo.id);
        if (!doRamo.length) return null;
        return (
          <section className="card ag-section" data-info="gsc" key={ramo.id}>
            <p className="eyebrow">{ramo.nome}</p>
            <h2 className="ficha-nome">{ramo.sub}</h2>
            <table className="inst">
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col">Medido em</th>
                  <th scope="col">Régua</th>
                </tr>
              </thead>
              <tbody>
                {doRamo.map((f) => {
                  const r = regua(f.chave) as
                    | {
                        tem: true;
                        meta: number | [number, number] | null;
                        fonte: { fonte: string; url: string; acessadoEm: string; recorte: string };
                      }
                    | { tem: false; motivo: string; natureza: string };
                  const onde = (MEDIDO_POR as Record<string, string>)[f.chave];
                  return (
                    <tr key={f.chave}>
                      <td className="inst-n">{f.nome}</td>
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
          vez de ajuste fino de constante. Ela sai de <code>lib/gsc-delta.mjs#EDITORIAIS</code>, e um
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
