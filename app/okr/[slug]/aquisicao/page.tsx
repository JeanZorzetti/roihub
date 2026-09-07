import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { lerIndexacao, dbOn, type Apuracao } from "@/lib/db";
import { gscSeries, gscConsultas } from "@/lib/gsc";
import { ga4Canais, ga4Cobertura } from "@/lib/ga4";
import { descobertaLonga, comportamentoLongo, descoberta, comportamento } from "@/lib/janelas.mjs";
import { kpisDeBusca, activeIndexRatio, queryToPageRatio } from "@/lib/kpis-busca.mjs";
import { Tabs } from "../../../tabs";

// AQUISIÇÃO (019, FR-022..FR-029): o que tem relógio de TRIMESTRE sai da tela que se lê na
// segunda-feira e ganha a janela longa que a 018 adiou — 8 meses de Search Console, 12 de GA4.
//
// A ficha continua nas janelas CURTAS (28d/D-3, FR-024): esticá-las trocaria a célula `visitante`
// dos 17 projetos e o placar do portfólio inteiro (SC-007). As longas vivem só aqui.
//
// ISR de 1 hora (FR-028a): duas chamadas de rede em janela longa numa página lida uma vez por
// trimestre não precisam ser pagas a cada request.
export const revalidate = 3600;

/** A janela que a FONTE deu, não a que foi pedida (FR-027). Nunca se rotula de 12 meses um dado de
 *  3 — o truncamento é NOMEADO. */
function Recebida({ pedida, recebida }: { pedida: { inicio: string; fim: string }; recebida: { inicio: string; fim: string } | null }) {
  if (!recebida) return <span className="foot"> · janela recebida: não apurada</span>;
  const truncada = recebida.inicio > pedida.inicio || recebida.fim < pedida.fim;
  return (
    <span className="foot">
      {" "}
      · janela recebida: <strong>{recebida.inicio} → {recebida.fim}</strong>
      {truncada && (
        <>
          {" "}
          — <strong>truncada</strong>: a fonte não tem dado para todo o período pedido ({pedida.inicio} → {pedida.fim}).
        </>
      )}
    </span>
  );
}

/**
 * 022 — a última apuração de indexação, em três estados como o resto da página: `null` é ausência
 * estrutural (nunca apurado, ou hub sem banco) e `{erro}` é falha de agora. Uma falha do Postgres
 * não pode derrubar a aba inteira, e também não pode se disfarçar de "não apurado".
 *
 * A tela NUNCA inspeciona: a página tem `revalidate = 3600` e a quota é diária e compartilhada por
 * 21 projetos — inspecionar no render transformaria cada visita em consumo da quota que a corrida
 * precisa. E um número que vem do banco TEM data; um número buscado ao vivo finge ser de hoje.
 */
async function lerApuracao(slug: string): Promise<Apuracao | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerIndexacao(slug);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `${nomeCurto} — aquisição (janela longa)` };
}

export default async function AquisicaoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  if (!p) notFound();
  const nomeCurto = p.nome.split(" — ")[0];

  const janelaGsc = descobertaLonga() as { nome: string; inicio: string; fim: string; porque: string };
  const janelaGa4 = comportamentoLongo() as { nome: string; inicio: string; fim: string; porque: string };
  const curtaGsc = descoberta() as { inicio: string; fim: string };
  const curtaGa4 = comportamento() as { inicio: string; fim: string };

  // Duas fontes independentes, sem somar latência — mesmo padrão de `coletarDoProjeto()`. A falha
  // de uma nunca alcança a outra.
  const [serie, canais, cobertura, consultas, indexacao] = await Promise.all([
    gscSeries(p.url, janelaGsc.inicio, janelaGsc.fim),
    ga4Canais(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
    ga4Cobertura(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
    // 021: as consultas vêm na janela CURTA (descoberta, 28d), não na longa desta página.
    // Striking Distance com 8 meses misturaria posição de fevereiro com a de hoje e a lista de
    // trabalho apontaria para páginas que já subiram ou já caíram — uma fila de trabalho velha
    // é pior que fila nenhuma. A janela sai declarada no bloco, como manda a FR-026 da 019.
    gscConsultas(p.url, curtaGsc),
    // 022: a indexação vem do BANCO, apurada pela corrida das 05:47. Zero chamada à URL Inspection
    // API aqui — ver `lerApuracao`.
    lerApuracao(slug),
  ]);
  const linhasBusca = consultas && "linhas" in consultas ? consultas.linhas : null;
  const kpis = linhasBusca ? kpisDeBusca(linhasBusca) : null;
  const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const br = (n: number) => n.toLocaleString("pt-BR");

  // A apuração de verdade: motivo `null` E alguma inspeção que não falhou.
  const idx = indexacao && !("erro" in indexacao) && !indexacao.motivo ? indexacao : null;
  // Denominador da taxa = inspecionadas − falhas (022, FR-008). A falha sai dos DOIS lados: erro de
  // quota contado como não-indexação inverteria o sinal, e quanto mais o sistema falhasse pior o
  // site pareceria. Zero ⇒ `null`, "não apurado", nunca 0%.
  const base = idx ? idx.inspecionadas - idx.falhas : 0;
  const taxaIdx = idx && base > 0 ? idx.indexadas / base : null;
  const rejeicao = idx && base > 0 ? (idx.rastreadasNaoIndexadas + idx.descobertasNaoIndexadas) / base : null;
  const amostrado = !!idx && idx.inspecionadas < idx.declaradas;

  // 022/US3 — o denominador das duas razões do board.
  //
  // ⚠️ Ele só existe quando NÃO houve amostragem, e a razão é aritmética, não preciosismo: o
  // numerador (URLs com impressão) é do SITE INTEIRO, medido pelo GSC em 28 dias. Se a apuração
  // inspecionou 200 de 1.200 URLs, `indexadas` é a contagem DA AMOSTRA — dividir um numerador de
  // site por um denominador de amostra produz uma razão que pode passar de 1 e que não mede nada.
  // Com amostra, o denominador é tão chutado quanto o que a 021 se recusou a inventar, então a
  // tela volta à contagem com o motivo (FR-011). Cobrir o site inteiro é aumentar o orçamento.
  const denomIdx = idx && !amostrado ? idx.indexadas : null;
  const ativas = linhasBusca && denomIdx ? activeIndexRatio(linhasBusca, denomIdx) : null;
  const porPagina = linhasBusca && denomIdx ? queryToPageRatio(linhasBusca, denomIdx) : null;

  const dias = serie && "days" in serie ? serie.days : null;
  // FR-027, lado GSC: a janela real sai da PRÓPRIA série — `days[0].date` / `days.at(-1).date`.
  // Zero chamada extra: a fonte se autodeclara.
  const recebidaGsc = dias && dias.length ? { inicio: dias[0].date, fim: dias[dias.length - 1].date } : null;
  const cliques = dias?.reduce((t, d) => t + d.clicks, 0) ?? null;
  const impressoes = dias?.reduce((t, d) => t + d.impressions, 0) ?? null;
  const recebidaGa4 = cobertura && "primeiro" in cobertura ? { inicio: cobertura.primeiro, fim: cobertura.ultimo } : null;
  const sessoes = canais && "linhas" in canais ? canais.linhas.reduce((t, l) => t + l.sessoes, 0) : null;

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      <section className="card ag-section">
        <p className="eyebrow">OKR · aquisição de {nomeCurto}</p>
        <h1 className="ficha-nome">Descoberta e Comportamento em janela longa</h1>
        {/* FR-028: o leitor tem que saber que esta NÃO é uma tela de segunda-feira. */}
        <p className="foot">
          <strong>Cadência de leitura: trimestral.</strong> Descoberta e Comportamento se movem por
          trimestre, não por semana — ler esta página toda segunda produz ruído, não decisão. A tela
          semanal é a <a href={`/okr/${slug}`}>ficha</a>; a derivação da conta é o{" "}
          <a href={`/okr/${slug}/metodo`}>método</a>.
        </p>

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Descoberta — Search Console, 8 meses</h2>
          <p className="foot">
            Janela pedida: <strong>{janelaGsc.inicio} → {janelaGsc.fim}</strong> — {janelaGsc.porque}.
            <Recebida pedida={janelaGsc} recebida={recebidaGsc} />
          </p>
          {/* FR-026: cada tela cita a outra PELO NOME e pela janela, para ninguém comparar dois
              números que medem períodos diferentes achando que medem o mesmo. */}
          <p className="foot">
            <strong>8 meses</strong> — a célula <code>visitante</code> da{" "}
            <a href={`/okr/${slug}`}>ficha</a> usa <strong>28 dias</strong> ({curtaGsc.inicio} →{" "}
            {curtaGsc.fim}). São a mesma fonte em janelas diferentes: os números NÃO se dividem um
            pelo outro.
          </p>
          {cliques != null && impressoes != null ? (
            <p>
              <strong>{cliques.toLocaleString("pt-BR")}</strong> cliques ·{" "}
              <strong>{impressoes.toLocaleString("pt-BR")}</strong> impressões{" "}
              <span className="foot">
                ({dias!.length} dia(s) com dado — Search Console
                {serie && "property" in serie ? `, propriedade ${serie.property}` : ""})
              </span>
            </p>
          ) : (
            <p className="foot">
              não apurado —{" "}
              {serie && "erro" in serie
                ? `Search Console indisponível (${serie.erro})`
                : `sem propriedade no GSC para ${p.url}`}
              .
            </p>
          )}
        </div>

        {/* 021 — os KPIs de busca do board, na janela CURTA. Bloco separado do de cima de
            propósito: aquele é de leitura trimestral, este é a fila de trabalho da semana. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Consultas — Search Console, 28 dias</h2>
          <p className="foot">
            Janela: <strong>{curtaGsc.inicio} → {curtaGsc.fim}</strong> — a mesma da célula{" "}
            <code>visitante</code> da <a href={`/okr/${slug}`}>ficha</a>, e{" "}
            <strong>não</strong> a de 8 meses do bloco acima. Os números dos dois blocos medem
            períodos diferentes e não se dividem um pelo outro.
          </p>

          {kpis === null ? (
            /* FR-010: três telas diferentes, nunca uma lista vazia sem explicação. `null` é
               ausência estrutural (o conserto é domínio próprio); `{erro}` é falha de agora. */
            <p className="foot">
              não apurado —{" "}
              {consultas && "erro" in consultas
                ? `Search Console indisponível (${consultas.erro})`
                : `sem propriedade no GSC para ${p.url}`}
              .
            </p>
          ) : (
            <>
              <ul className="ficha-krs">
                <li>
                  <strong>{kpis.consultasUnicas.valor.toLocaleString("pt-BR")}</strong> consultas únicas{" "}
                  {/* FR-009: o rótulo de piso é para o LEITOR, não um comentário no código. */}
                  <span className="foot">
                    — <strong>piso, não total</strong>: o Search Console omite as consultas raras da
                    dimensão <code>query</code>, então o número real é maior e não é observável.
                  </span>
                </li>
                <li>
                  <strong>{kpis.noTop20.toLocaleString("pt-BR")}</strong> consultas no Top 20{" "}
                  <span className="foot">(posições 1,0 a 20,0)</span>
                </li>
                <li>
                  <strong>{kpis.impressoesNoTop3 === null ? "não apurado" : pct(kpis.impressoesNoTop3)}</strong>{" "}
                  das impressões no Top 3 <span className="foot">(meta do board: 40% a 50%)</span>
                </li>
                {/* 022/FR-011: com denominador apurado isto vira a RAZÃO que o board pede; sem ele
                    volta a ser contagem COM O MOTIVO. Razão de denominador chutado é falha. */}
                {ativas === null ? (
                  <li>
                    <strong>{br(kpis.urlsComImpressao)}</strong> URLs com impressão{" "}
                    <span className="foot">
                      — contagem, não o Active Index Ratio do board.{" "}
                      {denomIdx === null && amostrado ? (
                        <>
                          A indexação foi apurada por <strong>amostra</strong> ({br(idx!.inspecionadas)}{" "}
                          de {br(idx!.declaradas)} URLs): o numerador acima é do site inteiro e
                          dividi-lo por um denominador de amostra daria uma razão que não mede nada.
                          Para a razão existir aqui, a apuração precisa cobrir o sitemap inteiro.
                        </>
                      ) : (
                        <>
                          O total de URLs indexadas ainda não foi apurado para este projeto — ver o
                          bloco de indexação abaixo. Sem denominador a razão seria inventada.
                        </>
                      )}
                    </span>
                  </li>
                ) : (
                  <>
                    <li>
                      <strong>{pct(ativas)}</strong> de Active Index Ratio{" "}
                      <span className="foot">
                        ({br(kpis.urlsComImpressao)} URLs com impressão ÷ {br(denomIdx!)} indexadas,
                        apuradas em {idx!.dia}) · meta do board: <strong>≥ 70%</strong> —{" "}
                        {ativas >= 0.7 ? "atingida." : "abaixo: há páginas no índice que ninguém vê."}
                      </span>
                    </li>
                    {porPagina && (
                      <li>
                        <strong>
                          {porPagina.valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </strong>{" "}
                        consultas por URL indexada{" "}
                        <span className="foot">
                          — <strong>piso, não total</strong>, pela mesma omissão das consultas raras
                          da linha acima. Faixas do board: <strong>30 a 80</strong> para artigo/blog,{" "}
                          <strong>10 a 25</strong> para produto/landing. O hub não sabe qual é o tipo
                          de cada URL deste projeto, então quem lê escolhe a faixa — inventar o tipo
                          para poder pintar um veredito seria pior que não pintar.
                        </span>
                      </li>
                    )}
                  </>
                )}
              </ul>

              {consultas && "truncado" in consultas && consultas.truncado && (
                <p className="foot">
                  ⚠️ <strong>Resultado truncado</strong> no teto de linhas da API do Search Console:
                  há mais consultas do que as listadas, e os números acima são piso por essa segunda
                  razão além da omissão das raras.
                </p>
              )}

              <h3 className="ficha-bloco-h">Striking distance — a um empurrão do Top 3</h3>
              <p className="foot">
                Consultas entre as posições 4,0 e 10,9: já rankeiam, e reforço de conteúdo ou link
                interno as move. Ordenadas por impressões — a primeira linha é a que rende mais.
              </p>
              {kpis.strikingDistance.length === 0 ? (
                <p className="foot">
                  Nenhuma consulta na faixa 4,0–10,9 nesta janela. Isso não é falha de medição: o
                  site tem consultas, nenhuma delas está nessa posição.
                </p>
              ) : (
                <ul className="ficha-krs">
                  {kpis.strikingDistance.slice(0, 15).map((c) => (
                    <li key={`${c.query} ${c.page}`}>
                      <strong>{c.query}</strong>{" "}
                      <span className="foot">
                        posição {c.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ·{" "}
                        {c.impressoes.toLocaleString("pt-BR")} impressões · {c.cliques.toLocaleString("pt-BR")}{" "}
                        cliques · {c.page}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="ficha-bloco-h">CTR contra o benchmark da posição</h3>
              {kpis.ctrGap === null ? (
                <p className="foot">
                  Sem URL avaliável: o board só define CTR mínimo até a posição 10,9, e nenhuma URL
                  desta janela está nessa faixa com impressão. Sem denominador não há fração —
                  exibir 0% aqui seria inventar uma reprovação.
                </p>
              ) : (
                <>
                  <p>
                    <strong>{pct(kpis.ctrGap.fracao)}</strong> das URLs atingem o CTR mínimo da
                    própria posição{" "}
                    <span className="foot">
                      ({kpis.ctrGap.avaliadas} URL(s) avaliada(s) · meta do board: 75% a 80%). URLs
                      acima da posição 10,9 ficam fora da conta: o board não define piso lá, e
                      contá-las como reprovadas faria toda cauda longa parecer quebrada.
                    </span>
                  </p>
                  {kpis.ctrGap.abaixo.length > 0 && (
                    <>
                      <p className="foot">
                        Abaixo do benchmark — aqui o problema é o <strong>título</strong>, não a
                        posição:
                      </p>
                      <ul className="ficha-krs">
                        {kpis.ctrGap.abaixo.slice(0, 10).map((u) => (
                          <li key={u.url}>
                            <strong>{u.url}</strong>{" "}
                            <span className="foot">
                              posição {u.posicao!.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ·
                              CTR {pct(u.ctr!)} contra {pct(u.benchmark!)} esperado ·{" "}
                              {u.impressoes.toLocaleString("pt-BR")} impressões
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              <h3 className="ficha-bloco-h">Canibalização</h3>
              {/* Medido na atma em 07/09: `atma aligner` lista 8 URLs e NÃO é canibalização —
                  busca de marca traz o site inteiro por construção. Separar marca de não-marca
                  exige uma lista de termos de marca por projeto e um corte por país, que esta
                  feature não tem; enquanto não tiver, o rótulo fica com o leitor em vez de a
                  lista fingir que toda linha é trabalho. */}
              <p className="foot">
                Consultas de <strong>marca</strong> aparecem aqui e quase nunca são problema: buscar
                o nome da empresa traz o site inteiro, e é assim que deve ser. A linha que importa é
                a consulta genérica com duas URLs suas disputando — aí a autoridade está dividida.
              </p>
              {kpis.canibalizacao.length === 0 ? (
                <p className="foot">
                  Nenhuma consulta atendida por duas URLs suas nesta janela — que é a meta do board
                  (zero páginas competindo pela mesma palavra-chave).
                </p>
              ) : (
                <ul className="ficha-krs">
                  {kpis.canibalizacao.slice(0, 10).map((c) => (
                    <li key={c.consulta}>
                      <strong>{c.consulta}</strong>{" "}
                      <span className="foot">
                        {c.urls.length} URLs disputando ·{" "}
                        {c.urls
                          .map(
                            (u) =>
                              `${u.url} (pos ${u.posicao.toLocaleString("pt-BR", { maximumFractionDigits: 1 })})`,
                          )
                          .join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* 022 — o denominador que faltava ao board. Bloco separado dos dois de cima porque a
            fonte é outra: aqui não é a série nem as consultas, é a URL Inspection API, apurada
            pela corrida das 05:47 e LIDA do banco. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Indexação — quanto do que o site declara está no índice</h2>
          {indexacao === null ? (
            <p className="foot">
              <strong>Ainda não apurado.</strong> A corrida de indexação roda às 05:47 e percorre os
              projetos por rodízio — do que está há mais tempo sem apuração para o mais recente.
              Este ainda não teve a vez, ou o hub está sem banco.
            </p>
          ) : "erro" in indexacao ? (
            <p className="foot">
              não apurado — a <strong>leitura</strong> da apuração falhou ({indexacao.erro}). O que
              caiu foi o banco agora, não a medição: o número da última corrida continua gravado.
            </p>
          ) : indexacao.motivo === "sem_sitemap" ? (
            /* Cenário 3 da US1: NUNCA 0% de indexação aqui. Sem sitemap não há denominador, e um
               "0%" diria que o Google recusou páginas que o site nunca declarou. */
            <p className="foot">
              <strong>Não há sitemap alcançável</strong> em <code>{p.url}</code> — nem anunciado no{" "}
              <code>robots.txt</code>, nem no caminho convencional. Isso não é 0% de indexação: é a
              ausência da lista que diria o que medir. O passo é o <strong>build do site</strong>{" "}
              publicar um sitemap.
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : indexacao.motivo === "sitemap_vazio" ? (
            <p className="foot">
              O sitemap existe, é XML válido e <strong>declara zero URLs</strong>. Diferente do caso
              acima: aqui o site foi perguntado e respondeu que não tem nada a declarar — o passo é
              a geração do sitemap, não a publicação dele.
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : indexacao.motivo === "sem_propriedade" ? (
            /* Cenário 4 da US1: "não indexado" seria a leitura errada. Host de fornecedor
               (*.vercel.app) fica fora de toda propriedade — não há ONDE olhar. */
            <p className="foot">
              <strong>Não há onde olhar.</strong> O host de <code>{p.url}</code> está fora de toda
              propriedade do Search Console, então nenhuma inspeção é possível — o que{" "}
              <strong>não</strong> quer dizer que as páginas não estejam indexadas. O passo é{" "}
              <strong>domínio próprio verificado no Search Console</strong>.
              <br />
              Apurado em <strong>{indexacao.dia}</strong> · {br(indexacao.declaradas)} URL(s)
              declarada(s) no sitemap.
            </p>
          ) : indexacao.motivo === "sem_orcamento" ? (
            /* FR-015: "não perguntei nesta rodada" NUNCA pode virar `indexadas: 0`. */
            <p className="foot">
              <strong>Não inspecionado nesta rodada.</strong> O sitemap foi lido e declara{" "}
              <strong>{br(indexacao.declaradas)}</strong> URL(s), mas a quota da propriedade
              ({indexacao.propriedade ?? "—"}) já tinha sido consumida por outros projetos quando
              chegou a vez deste. Ele volta na frente da fila na próxima corrida.
              <br />
              Apurado em <strong>{indexacao.dia}</strong>.
            </p>
          ) : taxaIdx === null ? (
            /* Todas as inspeções falharam: denominador zero. "Não apurado", nunca 0% — contar
               erro de quota como não-indexação inverteria o sinal da medição inteira. */
            <p className="foot">
              não apurado — as <strong>{br(indexacao!.inspecionadas)}</strong> inspeções desta
              corrida falharam (rede ou quota). Falha de inspeção não é não-indexação, então não há
              fração a exibir.
              <br />
              Apurado em <strong>{indexacao!.dia}</strong>.
            </p>
          ) : (
            <>
              {/* FR-007 / SC-002: o tamanho da amostra e o total declarado ficam na MESMA frase da
                  fração, nunca em nota de rodapé. Uma taxa de 200 URLs apresentada como "a taxa do
                  site" é a armadilha que esta feature existe para não repetir. */}
              <p>
                <strong>{pct(taxaIdx)}</strong> das URLs inspecionadas estão no índice do Google —{" "}
                <strong>{br(idx!.indexadas)}</strong> de <strong>{br(base)}</strong>
                {amostrado ? (
                  <>
                    , e essas <strong>{br(idx!.inspecionadas)}</strong> são uma amostra das{" "}
                    <strong>{br(idx!.declaradas)}</strong> que o sitemap declara:{" "}
                    <strong>a fração vale para a amostra, não para o site inteiro</strong>.
                  </>
                ) : (
                  <>
                    , que é o sitemap <strong>inteiro</strong> ({br(idx!.declaradas)} URL(s)
                    declarada(s)) — sem amostragem.
                  </>
                )}
              </p>
              {/* FR-014: um inventário de semanas atrás não pode se apresentar como o estado de
                  hoje. A data vem do banco justamente porque um número buscado ao vivo não teria. */}
              <p className="foot">
                Apurado em <strong>{idx!.dia}</strong>
                {idx!.propriedade ? <> · propriedade {idx!.propriedade}</> : null}
                {idx!.falhas > 0 && (
                  <>
                    {" "}
                    · <strong>{br(idx!.falhas)}</strong> inspeção(ões) falharam e ficaram FORA da
                    conta, dos dois lados da divisão — falha não é não-indexação.
                  </>
                )}
                {amostrado && (
                  <>
                    {" "}
                    · a amostra é o <strong>começo do sitemap</strong>, na ordem em que o próprio
                    site declara: estável entre corridas (a fração não se move por troca de amostra)
                    e enviesada para o que o site trata como prioritário.
                  </>
                )}
              </p>
              {/* FR-010: a taxa contra a meta do board, na linha da própria taxa. */}
              <p className="foot">
                Meta do board: <strong>95%</strong> —{" "}
                {taxaIdx >= 0.95 ? (
                  <>atingida.</>
                ) : (
                  <>faltam {pct(0.95 - taxaIdx)} para chegar lá.</>
                )}
              </p>

              {/* US2 / SC-006 — o leitor tem que responder em 30 segundos se o problema é "o Google
                  não conhece as páginas" ou "o Google conhece e recusou". Por isso o RÓTULO é o
                  diagnóstico em português e o termo do Search Console fica em segundo plano: quem
                  lê esta tela decide trabalho, e "Crawled - currently not indexed" não é uma
                  decisão. Os dois baldes NUNCA somam num "não indexadas" único — os prognósticos
                  são incompatíveis e o conserto de um não move o outro. */}
              {idx!.rastreadasNaoIndexadas + idx!.descobertasNaoIndexadas + idx!.outras > 0 && (
                <>
                  <h3 className="ficha-bloco-h">Por que as que faltam não entraram</h3>
                  {idx!.rastreadasNaoIndexadas !== idx!.descobertasNaoIndexadas && (
                    <p>
                      {idx!.rastreadasNaoIndexadas > idx!.descobertasNaoIndexadas ? (
                        <>
                          O problema deste site é <strong>conteúdo</strong>: o Google leu a maior
                          parte das páginas que ficaram de fora e recusou.
                        </>
                      ) : (
                        <>
                          O problema deste site é <strong>rastreio</strong>: o Google nem chegou a
                          ler a maior parte das páginas que ficaram de fora.
                        </>
                      )}
                    </p>
                  )}
                  <ul className="ficha-krs">
                    <li>
                      <strong>{br(idx!.rastreadasNaoIndexadas)}</strong> — o Google leu e recusou{" "}
                      <span className="foot">
                        (no Search Console: <em>rastreada, atualmente não indexada</em>). Ele buscou
                        a página e decidiu que ela não vale uma vaga no índice.{" "}
                        <strong>Nenhum conserto técnico move isto</strong> — é trabalho editorial:
                        profundidade, originalidade, a intenção que a página atende.
                      </span>
                    </li>
                    <li>
                      <strong>{br(idx!.descobertasNaoIndexadas)}</strong> — o Google nem leu{" "}
                      <span className="foot">
                        (no Search Console: <em>descoberta, atualmente não indexada</em>). Ele sabe
                        que a URL existe e não gastou rastreio nela. Aqui o conteúdo não é a
                        questão: é <strong>link interno, profundidade de cliques e sitemap</strong>.
                      </span>
                    </li>
                    <li>
                      <strong>{br(idx!.outras)}</strong> — outros motivos{" "}
                      <span className="foot">
                        redirect, canonical apontando para outra página, <code>noindex</code>. Cada
                        uma é um caso — abra a URL no Search Console para ver qual.
                      </span>
                    </li>
                  </ul>
                  {rejeicao !== null && (
                    <p>
                      <strong>{pct(rejeicao)}</strong> de rejeição de rastreio{" "}
                      <span className="foot">
                        (as duas primeiras linhas somadas ÷ {br(base)} inspecionadas com resposta) ·
                        meta do board: <strong>abaixo de 5%</strong> —{" "}
                        {rejeicao < 0.05 ? "atingida." : "acima do teto."} A soma aparece só aqui,
                        como placar: as duas linhas acima continuam separadas porque pedem trabalhos
                        diferentes.
                      </span>
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Comportamento — GA4, 12 meses</h2>
          <p className="foot">
            Janela pedida: <strong>{janelaGa4.inicio} → {janelaGa4.fim}</strong> — {janelaGa4.porque}.
            <Recebida pedida={janelaGa4} recebida={recebidaGa4} />
            {cobertura && "erro" in cobertura && (
              <> — a sonda de cobertura falhou ({cobertura.erro}); a janela recebida fica não apurada.</>
            )}
          </p>
          <p className="foot">
            <strong>12 meses</strong> — o N4 da <a href={`/okr/${slug}/metodo`}>derivação</a> usa{" "}
            <strong>28 dias</strong> ({curtaGa4.inicio} → {curtaGa4.fim}).
          </p>
          {canais && "linhas" in canais ? (
            <>
              <p>
                <strong>{sessoes!.toLocaleString("pt-BR")}</strong> sessões{" "}
                <span className="foot">(GA4, propriedade {canais.propriedade})</span>
              </p>
              <ul className="ficha-krs">
                {[...canais.linhas]
                  .sort((a, b) => b.sessoes - a.sessoes)
                  .map((l) => (
                    <li key={l.grupo}>
                      <strong>{l.grupo}</strong>{" "}
                      <span className="foot">{l.sessoes.toLocaleString("pt-BR")} sessões</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <p className="foot">
              não apurado —{" "}
              {canais && "erro" in canais ? `GA4 indisponível (${canais.erro})` : "propriedade GA4 não configurada no card"}
              .
            </p>
          )}
        </div>

        {/* FR-029/SC-008: NENHUMA taxa entre `cliques` (GSC) e `sessões` (GA4). Na época da atma são
            599 contra 1.140 — o GSC vê só busca orgânica, o GA4 vê todo canal. Dividir um pelo
            outro produz um número que não mede nada, e a tela não o exibe em lugar nenhum. */}
        <p className="foot">
          <strong>Cliques (Search Console) e sessões (GA4) não se dividem.</strong> São cadeias
          diferentes: o GSC conta o clique na SERP e só vê busca orgânica; o GA4 conta a sessão
          carregada, de qualquer canal. Não existe nesta página nenhuma razão entre as duas séries —
          uma taxa assim mediria a diferença entre os instrumentos, não o negócio.
        </p>
      </section>
    </main>
  );
}
