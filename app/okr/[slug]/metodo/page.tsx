import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { canaisDoN4, razaoDoKr } from "@/lib/ficha-visual.mjs";
import { dadosDaFicha, type CelulaFicha } from "@/lib/ficha-dados";
import { Arvore } from "../../arvore";
import { Tabs } from "../../../tabs";
import {
  ROTULOS_AMIGAVEIS,
  MARCAS_AMIGAVEIS,
  GLOSSARIO,
  ehFalhaTransitoria,
  Cel,
  Linha,
  agruparPorMotivo,
  CanaisN4,
  HeroN1,
  CadeiaDiagrama,
} from "../celulas";

// A DERIVAÇÃO de método (019, FR-018..FR-021): os sete níveis N0–N6 e a árvore de metas da 016,
// que saíram da ficha para ela poder responder em 30 segundos. NADA foi recalculado — é o mesmo
// `montarNiveis()`, com a mesma saída (FR-019), a partir da mesma `dadosDaFicha()`.
//
// A rota é do TEMPLATE (`app/okr/[slug]/metodo`, nunca `app/okr/atma/…`) e responde para os 17
// projetos: rota exclusiva de um projeto seria a primeira vez que o hub faz isso.
//
// A ficha continua `force-dynamic` (número vindo do build é número de outra janela). AQUI é ISR de
// 1 hora (FR-028a): esta é a tela da CONTA, lida quando alguém quer conferir a derivação — não a
// de segunda-feira. Uma hora não muda dígito numa cadeia de 52 leads.
export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `${nomeCurto} — método (N0–N6)` };
}

export default async function MetodoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dados = await dadosDaFicha(slug);
  if (!dados) notFound();
  // FR-021: a MESMA composição da ficha — uma chamada de `evaluateAll()` só. A ação citada na
  // dobra e a citada em N6 não têm como divergir, porque não existe segunda fonte.
  const {
    niveis, arvore, entrega, ctrAlvo, impressoes, janelas, veredito, marcosCadeia, taxasCadeia,
    iniciaEmVisitante, pendentes, proximoBuraco, nomeCurto, necessarioNaJanela,
  } = dados;

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      <section className="card ag-section">
        <p className="eyebrow">OKR · método de {nomeCurto}</p>
        <h1 className="ficha-nome">Como a conta é feita</h1>
        {/* FR-020: os links vão nos DOIS sentidos — a ficha aponta para cá, e daqui se volta. */}
        <p className="foot">
          A derivação N0–N6 e a árvore de metas de <a href={`/okr/${slug}`}>{nomeCurto}</a>. O
          veredito, os buracos e o placar estão na <a href={`/okr/${slug}`}>ficha</a>; os números de
          aquisição em janela longa, em <a href={`/okr/${slug}/aquisicao`}>aquisição</a>.
        </p>
        <p className="foot">
          Cadência de leitura desta página: quando você quer ver a <strong>conta</strong>. A tela de
          segunda-feira é a ficha.
        </p>

        {(arvore.camadas.length > 1 || arvore.parou) && (
          <div className="ficha-bloco ficha-bloco--novo">
            <h2 className="ficha-bloco-h">Árvore de metas</h2>
            <Arvore arvore={arvore} entrega={entrega} ctrAlvo={ctrAlvo} impressoesHoje={impressoes} />
          </div>
        )}

        <details className="ficha-glossario">
          <summary className="foot">termos desta página</summary>
          <dl className="foot">
            {GLOSSARIO.map((g) => (
              <div key={g.termo} className="ficha-glossario-item">
                <dt>{g.termo}</dt>
                <dd>{g.def}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      {niveis.map((n) => {
        // A primeira célula do N1 é a contagem do último marco da cadeia (`montarN1`) — a única
        // que vira figura, e só quando apurada e numérica (célula de taxa chega como string).
        const primeira = n.celulas[0];
        // N4 renderiza os canais com trilho e SÓ o resto (fora do catálogo, total composto,
        // diferença, inferências) pelo caminho comum de agrupamento.
        // Mesmo casting de `montarNiveis()` acima: o módulo é .mjs (para `node --test` importar
        // sem transpilar), então o tipo entra aqui, na fronteira.
        const n4 = (n.id === "N4" ? canaisDoN4(n.celulas) : null) as {
          canais: { celula: CelulaFicha; fracao: number | null }[];
          resto: CelulaFicha[];
        } | null;
        const heroN1 =
          n.id === "N1" && primeira?.estado === "apurado" && typeof primeira.valor === "number" ? primeira : null;
        return (
        <section className="card ag-section" aria-labelledby={n.id} key={n.id}>
          <h2 className="eyebrow" id={n.id}>{n.titulo}</h2>
          {n.id === "N4" && n.nota && <p className="foot ficha-nota-n4">{n.nota}</p>}
          {/* 018/FR-013: a nota de contato — `contatado` saiu de marco, e a leitura ("todo lead
              fora de `novo` foi contatado") continua visível, só que fora da cadeia e do gargalo. */}
          {n.id === "N3" && n.nota && <p className="foot ficha-nota-n4">{n.nota}</p>}

          {/* achado 3: substitui o funil decorativo (área proporcional a `aria-hidden`, sem
              rótulo, sem eixo) por um diagrama de cadeia com nó por marco e aresta por taxa —
              lido diretamente de `marcosCadeia`/`taxasCadeia` (018: sem `visitante`, que foi para
              o bloco de Descoberta), não do `n.funil` derivado. */}
          {n.id === "N3" && marcosCadeia.length > 0 && (
            <>
              {/* FR-005/FR-008 (018): a época aparece com o motivo declarado ao lado da janela de
                  Conversão — `janelas.conversao.porque` já É esse motivo quando o card declara
                  `epoca`, e "sem época declarada no card" quando não declara. */}
              <p className="foot">
                Janela desta cadeia: <strong>{janelas.conversao.inicio} → {janelas.conversao.fim}</strong> — {janelas.conversao.porque}
              </p>
              <CadeiaDiagrama marcos={marcosCadeia} taxas={taxasCadeia} veredito={veredito} janela={{ inicio: janelas.conversao.inicio, fim: janelas.conversao.fim }} />
            </>
          )}
          {n4 && <CanaisN4 canais={n4.canais} />}
          {heroN1 && <HeroN1 c={heroN1} necessario={necessarioNaJanela} />}

          {/* N2 fica de fora: as células ali formam uma equação lida em sequência (Leads × CR1 ×
              CR2 × Valor = "a conta fecha?") — agrupar reordenaria os não-apurados para depois dos
              apurados/declarados e quebraria essa leitura. N3 é seguro: os 4 não-apurados já vêm
              consecutivos, sem apurado no meio, então agrupar não reordena nada. */}
          {n.id === "N3" || n.id === "N4" || n.id === "N5"
            ? (() => {
                // N3 (018, FR-007): a primeira célula é a taxa `visitante→lead` quando a cadeia
                // ainda começa em `visitante` — ela já saiu para o bloco de Descoberta, então some
                // daqui também. `agruparPorMotivo` nunca vê essa célula.
                const celulasN3 = n.id === "N3" && iniciaEmVisitante ? n.celulas.slice(1) : n.celulas;
                const { avulsas, grupos } = agruparPorMotivo(n4 ? n4.resto : celulasN3);
                return (
                  <>
                    {avulsas.map((c, i) => (
                      <Linha key={`avulsa-${i}`} c={c} />
                    ))}
                    {grupos.map((grupo, i) =>
                      grupo.itens.length > 1 ? (
                        <details key={`grupo-${i}`} className="ficha-linha">
                          <summary>
                            {grupo.itens.length} {ehFalhaTransitoria(grupo.itens[0]) ? "falharam agora" : "não apurados"} — {grupo.motivo}:{" "}
                            {grupo.itens.map((c) => ROTULOS_AMIGAVEIS[c.rotulo] ?? c.rotulo).join(", ")}
                          </summary>
                          {grupo.itens.map((c, j) => (
                            <Linha key={j} c={c} />
                          ))}
                        </details>
                      ) : (
                        <Linha key={`grupo-${i}`} c={grupo.itens[0]} />
                      ),
                    )}
                  </>
                );
              })()
            : (heroN1 ? n.celulas.slice(1) : n.celulas).map((c, i) => <Linha key={i} c={c} />)}

          {n.id === "N0" && n.krs && n.krs.length > 0 && (
            <ul className="ficha-krs">
              {n.krs.map((k, i) => (
                <li key={i}>
                  <strong>{k.kr.kpi}</strong>
                  {k.kr.dono && <span className="pill">{k.kr.dono}</span>}
                  {k.marca && <span className="pill pill-warn">{MARCAS_AMIGAVEIS[k.marca] ?? k.marca}</span>}
                  {/* O KR que passa na validação era o que aparecia mais POBRE: `validarKrs()` só
                      produz `texto` quando há problema, então KR válido saía como nome + dono e
                      nada mais — meta e prazo ficavam no card sem nunca chegar à tela, e um
                      coletor novo podia ser ligado sem que seu número aparecesse em lugar nenhum.
                      O valor sai por `Cel`, o único caminho que imprime valor (FR-009). */}
                  {k.celulaAlvo && (
                    <div className="foot">
                      hoje: <Cel c={k.celulaAlvo} />
                      {k.kr.meta != null && (
                        <>
                          {" · meta "}
                          {k.kr.meta}
                          {k.kr.prazo && ` até ${k.kr.prazo}`}
                        </>
                      )}
                    </div>
                  )}
                  {/* Quanto do caminho até a meta já foi andado. `razaoDoKr()` só devolve algo
                      para célula apurada e numérica — o trilho é redundante com o "hoje X · meta Y"
                      logo acima, por isso `aria-hidden` e sem rótulo próprio. */}
                  {(() => {
                    const r = razaoDoKr(k.celulaAlvo, k.kr.meta);
                    return r ? (
                      <div className="meter-track ficha-kr-medidor" aria-hidden="true">
                        <div className="meter-fill" style={{ width: `${r.fracao * 100}%` }} />
                      </div>
                    ) : null;
                  })()}
                  {k.texto && <div className="foot">{k.texto}</div>}
                </li>
              ))}
            </ul>
          )}

          {n.id === "N6" && n.itens && n.itens.length > 0 && (
            <>
              {n.itens.some((item) => !item.descontinuado) && (
                <ul className="ficha-krs">
                  {n.itens
                    .filter((item) => !item.descontinuado)
                    .map((item) => (
                      <li key={item.key}>
                        <strong>{item.titulo}</strong>
                        {item.meta && <span> {item.meta}</span>}
                        {item.dono ? <span className="pill">{item.dono}</span> : <span className="pill pill-warn">sem responsável</span>}
                        <div className="foot">
                          <Cel c={item.data} /> · célula que move: {item.celulaQueMove === "nao-declarada" ? "não declarada" : item.celulaQueMove}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              {n.itens.some((item) => item.descontinuado) && (
                <details className="ficha-glossario">
                  <summary className="foot">decisões revogadas</summary>
                  <ul className="ficha-krs">
                    {n.itens
                      .filter((item) => item.descontinuado)
                      .map((item) => (
                        <li key={item.key}>
                          <strong>{item.titulo}</strong>
                          {item.meta && <span> {item.meta}</span>}
                          {item.dono ? <span className="pill">{item.dono}</span> : <span className="pill pill-warn">sem responsável</span>}
                          <div className="foot">
                            <Cel c={item.data} /> · célula que move: {item.celulaQueMove === "nao-declarada" ? "não declarada" : item.celulaQueMove}
                          </div>
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {/* achado 6: sem ação com dono, N6 respondia só com um disclosure de decisões revogadas
              — a pergunta "o que eu faço segunda?" ficava sem resposta nenhuma. O próximo dado a
              apurar já é conhecido pela própria árvore (primeiro marco não apurado); mostrar isso
              como SUGESTÃO SEM DONO, nunca como ação da agenda, respeita o FR-031 (nada de
              inferência de responsável ou de célula que move). */}
          {n.id === "N6" && pendentes.length === 0 && proximoBuraco && (
            <p className="ficha-sugestao">
              <span className="pill">sugestão · sem dono</span> Próximo dado a apurar:{" "}
              <strong>{proximoBuraco.nome}</strong> — consultar {proximoBuraco.fonte}.
            </p>
          )}
        </section>
        );
      })}
    </main>
  );
}
