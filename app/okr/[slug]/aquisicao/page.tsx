import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects, SLUGS_DE_BUSCA } from "@/lib/projects";
import {
  lerIndexacao,
  lerCrawlDePagina,
  lerDiasGsc,
  dbOn,
  type Apuracao,
  type CrawlDePagina,
  type PaginaCrawl,
  type DiaSeparado,
} from "@/lib/db";
import { gscSeries, gscConsultas } from "@/lib/gsc";
import { marcaDeclarada, completude, crescimentoNaoMarca, razaoDeMarca } from "@/lib/marca.mjs";
import { ga4Canais, ga4Cobertura } from "@/lib/ga4";
import { descobertaLonga, comportamentoLongo, descoberta, comportamento } from "@/lib/janelas.mjs";
import { kpisDeBusca, activeIndexRatio, queryToPageRatio, porUrl, termoPrincipal } from "@/lib/kpis-busca.mjs";
import { posicaoDoTermo } from "@/lib/pagina.mjs";
import {
  canonizar,
  taxaIntegridadeDoTitulo,
  taxaAlinhamento,
  taxaCobertura,
  cadencia,
  ordemDaPeriferia,
  TITULO_PX_MIN,
  TITULO_PX_MAX,
  TERMO_ATE,
  LINKS_CONTEXTUAIS_MIN,
  PROFUNDIDADE_MAX,
  CADENCIA_MESES,
} from "@/lib/grafo.mjs";
import { passRate, CAP_URLS_PASS_RATE, SLUGS_DE_CAMPO } from "@/lib/crux.mjs";
import { lerCampo } from "@/lib/crux";
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

/**
 * 024 — a última corrida do crawl de página, no mesmo idioma de três estados de `lerApuracao()`.
 *
 * A tela LÊ O GRAVADO E NUNCA BUSCA: com `revalidate = 3600`, uma página que crawleasse ao carregar
 * transformaria cada visita numa varredura do site do cliente — e a corrida semanal existe
 * exatamente para isso não acontecer.
 */
async function lerCrawl(slug: string): Promise<CrawlDePagina | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerCrawlDePagina(slug);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/**
 * 025 — a série gravada com a separação marca / não-marca, no mesmo idioma de três estados das duas
 * de cima.
 *
 * A tela lê o BANCO e nunca o Search Console (D11): as três pernas custam três requisições e são
 * pedidas UMA vez por dia pela corrida das 05:17. Buscá-las no render triplicaria a rede a cada
 * visita para exibir o mesmo número — e, pior, um número sem data, que finge ser de hoje.
 *
 * Primeiro consumidor de `lerDiasGsc()`: a função existe desde a 021 e ninguém a chamava.
 */
async function lerSerieSeparada(
  slug: string,
  janela: { inicio: string; fim: string },
): Promise<DiaSeparado[] | { erro: string } | null> {
  if (!dbOn()) return null;
  try {
    return await lerDiasGsc(slug, janela.inicio, janela.fim);
  } catch (e) {
    return { erro: e instanceof Error ? e.message.slice(0, 60) : String(e).slice(0, 60) };
  }
}

/**
 * 023/US3 — o Core Web Vitals Pass Rate do board, sobre as URLs PRIORITÁRIAS: as de maior
 * impressão na janela curta, cortadas em `CAP_URLS_PASS_RATE`. Sem a ordenação o corte sortearia o
 * denominador; as que ficam de fora entram no texto como NÃO CONSULTADAS, nunca como reprovadas.
 *
 * Em SÉRIE, pelo mesmo motivo de `app/api/gsc-serie/route.ts:36-38`: um punhado de POSTs
 * simultâneos ao mesmo endpoint do Google com a mesma chave é o caminho mais curto para o 429 que
 * transformaria a leitura inteira em falha por pressa. Só para `SLUGS_DE_CAMPO` (FR-014), e a
 * falha segue o idioma de `lerApuracao()`: não derruba a aba.
 */
async function lerPassRate(slug: string, linhas: Parameters<typeof porUrl>[0] | null) {
  if (!SLUGS_DE_CAMPO.includes(slug) || !linhas) return null;
  const urls = porUrl(linhas).sort((a, b) => b.impressoes - a.impressoes);
  const prioritarias = urls.slice(0, CAP_URLS_PASS_RATE);
  try {
    const leituras = new Map();
    for (const u of prioritarias) leituras.set(u.url, await lerCampo({ tipo: "url", valor: u.url }));
    return { ...passRate(leituras, prioritarias.length), naoConsultadas: urls.length - prioritarias.length };
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
  const [serie, canais, cobertura, consultas, indexacao, crawl, serieSeparada] = await Promise.all([
    gscSeries(p.url, janelaGsc.inicio, janelaGsc.fim),
    ga4Canais(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
    ga4Cobertura(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
    // 021: as consultas vêm na janela CURTA (descoberta, 28d), não na longa desta página.
    // Striking Distance com 8 meses misturaria posição de fevereiro com a de hoje e a lista de
    // trabalho apontaria para páginas que já subiram ou já caíram — uma fila de trabalho velha
    // é pior que fila nenhuma. A janela sai declarada no bloco, como manda a FR-026 da 019.
    // Fora de `SLUGS_DE_BUSCA` a chamada nem sai: os KPIs do board são da Atma, e este bloco era
    // o último pedaço da 021 que ainda servia os 35 — porque lê ao vivo no render, sem passar
    // pela corrida que já foi restringida.
    SLUGS_DE_BUSCA.includes(slug) ? gscConsultas(p.url, curtaGsc) : null,
    // 022: a indexação vem do BANCO, apurada pela corrida das 05:47. Zero chamada à URL Inspection
    // API aqui — ver `lerApuracao`.
    lerApuracao(slug),
    // 024: o crawl de página vem do BANCO, apurado pela corrida de segunda 06:17. Ver `lerCrawl`.
    lerCrawl(slug),
    // 025: a separação marca / não-marca também vem do BANCO. Ver `lerSerieSeparada`.
    lerSerieSeparada(slug, janelaGsc),
  ]);
  const linhasBusca = consultas && "linhas" in consultas ? consultas.linhas : null;

  // ── 025: a declaração de marca, que serve os DOIS blocos desta página ─────────────────────
  //
  // Uma fonte só (D3): o mesmo padrão que a corrida mandou ao Search Console volta aqui para
  // filtrar a canibalização. Duas construções divergiriam na primeira variante nova, e a tela
  // exibiria uma lista de termos (FR-012) que não é a que classificou os números.
  const decl = marcaDeclarada(p);
  const ehMarca = decl.motivo ? null : (q: string) => new RegExp(decl.padrao, "i").test(q);
  const kpis = linhasBusca ? kpisDeBusca(linhasBusca, ehMarca) : null;
  const vitais = await lerPassRate(slug, linhasBusca);
  const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  // 025: acima de 10× o `pct` vira armadilha de leitura. Em pt-BR o separador de milhar é o PONTO,
  // então um crescimento de 4195% sai "4.195%" — que, ao lado de uma meta de "5% a 10%", lê como
  // 4,195% e inverte o veredito para quem bate o olho. Medido em 08/09: julho da atma colapsou para
  // 342 impressões não-marca e agosto voltou a 14.689, uma recuperação real de 42×.
  const variacao = (f: number) =>
    Math.abs(f) >= 10 ? `${(f + 1).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}×` : pct(f);
  const br = (n: number) => n.toLocaleString("pt-BR");
  // Só encurta a URL para caber na linha: a chave continua sendo a canônica da D3.
  const caminho = (u: string) => u.replace(p.url.replace(/\/+$/, ""), "") || "/";

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

  // ── 024: as seis medidas do crawl ────────────────────────────────────────
  //
  // NENHUMA conta aqui: `taxa*`, `cadencia` e `ordemDaPeriferia` moram em `lib/grafo.mjs` e
  // `posicaoDoTermo` em `lib/pagina.mjs` — o que dá para testar sem subir o Next nasce em `.mjs`
  // (Princípio III). Esta seção só chama e passa adiante.
  const paginado = crawl && !("erro" in crawl) && !crawl.motivo ? crawl : null;
  // As URLs do GSC vêm na forma que o Google guarda; as do crawl são a chave canônica da D3.
  // Sem canonizar dos dois lados, `/precos` e `/precos/` seriam páginas diferentes e TODA página
  // apareceria como "sem termo apurado".
  const linhasCanon =
    linhasBusca?.map((l) => ({ ...l, page: canonizar(l.page, p.url) ?? l.page })) ?? null;
  const impressoesPorUrl = new Map<string, number>(
    linhasCanon ? porUrl(linhasCanon).map((u: { url: string; impressoes: number }) => [u.url, u.impressoes]) : []
  );
  const termoPorUrl = new Map<string, string | null>(
    (paginado?.paginas ?? []).map((pg) => [pg.url, linhasCanon ? termoPrincipal(linhasCanon, pg.url) : null])
  );
  const posicaoPorUrl = new Map<string, number | null>(
    (paginado?.paginas ?? []).map((pg) => [pg.url, posicaoDoTermo(pg.titulo, termoPorUrl.get(pg.url) ?? null)])
  );
  const integridade = paginado ? taxaIntegridadeDoTitulo(paginado.paginas, posicaoPorUrl) : null;
  const alinhamento = paginado ? taxaAlinhamento(paginado.paginas) : null;
  const cobertura024 = paginado ? taxaCobertura(paginado.paginas) : null;
  const atualizacao = paginado ? cadencia(paginado.paginas, paginado.dia) : null;
  const periferia = paginado ? ordemDaPeriferia(paginado.paginas, impressoesPorUrl) : [];
  // FR-013: URL do sitemap que responde erro ou redireciona é ACHADO — o sitemap declarando uma
  // URL morta é a informação, não um buraco na medição.
  const achadosDoSitemap = (paginado?.paginas ?? []).filter((pg) => pg.noSitemap && (pg.erro || pg.redirecionada));

  const dias = serie && "days" in serie ? serie.days : null;
  // FR-027, lado GSC: a janela real sai da PRÓPRIA série — `days[0].date` / `days.at(-1).date`.
  // Zero chamada extra: a fonte se autodeclara.
  const recebidaGsc = dias && dias.length ? { inicio: dias[0].date, fim: dias[dias.length - 1].date } : null;
  const cliques = dias?.reduce((t, d) => t + d.clicks, 0) ?? null;
  const impressoes = dias?.reduce((t, d) => t + d.impressions, 0) ?? null;
  // ── 025: as duas medidas do board que não existiam ───────────────────────────────────────
  //
  // NENHUMA conta aqui: `completude`, `crescimentoNaoMarca` e `razaoDeMarca` moram em
  // `lib/marca.mjs`, testadas sem subir o Next (Princípio III). Esta seção só chama.
  //
  // ⚠️ `hoje` é o dia de VERDADE, não o `fim` da janela (que já é D-3). É dele que sai a folga de
  // três dias da D9 — e o mês precisa dos três depois de fechar no calendário, porque o GSC ainda
  // sobe a ponta (30/07 da atma saiu com 30 impressões e fechou em 827).
  const diasSeparados = Array.isArray(serieSeparada) ? serieSeparada : null;
  const hojeIso = new Date().toISOString().slice(0, 10);
  const comp = diasSeparados ? completude(diasSeparados) : null;
  const crescimento = diasSeparados ? crescimentoNaoMarca(diasSeparados, hojeIso) : null;
  const razao = diasSeparados ? razaoDeMarca(diasSeparados) : null;
  // A janela que a SEPARAÇÃO cobre, tirada dos próprios dias medidos — e não a pedida. A
  // `conferencia` da corrida soma os 480 dias inteiros, então tela e log podem divergir de veredito
  // LEGITIMAMENTE; sem a janela escrita ao lado, a divergência lê como bug e alguém caça um defeito
  // que não existe.
  const diasComMarca = (diasSeparados ?? []).filter((d) => typeof d.impressoesMarca === "number");
  const janelaMarca = diasComMarca.length
    ? { inicio: diasComMarca[0].dia, fim: diasComMarca[diasComMarca.length - 1].dia }
    : null;

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

        {/* 025 — as duas medidas do board que não existiam: crescimento de impressões NÃO-MARCA e
            proporção de buscas de marca. Vêm do BANCO, gravadas pela corrida das 05:17 (D11).
            Não-marca é MEDIDA, nunca `total − marca`: o total inclui as consultas anonimizadas e a
            fatia de marca não, então a subtração devolveria não-marca MAIS o resto anonimizado —
            inflando exatamente o KPI que se quer ver crescer (5 contra 33 medidos no tapepro). */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Marca e não-marca — a demanda que já é sua e a que ainda não é</h2>

          {decl.motivo ? (
            /* FR-004/FR-013: "não declarada" NUNCA vira 0%. Os três motivos saem NOMEADOS porque
               pedem consertos diferentes — e um número inventado aqui seria uma afirmação sobre o
               site que ninguém mediu. */
            <p className="foot">
              <strong>Marca não declarada</strong> para este projeto ({decl.motivo}).{" "}
              {decl.motivo === "ausente"
                ? "O card não tem lista de termos de marca. Sem ela o hub não sabe quais consultas são busca pelo NOME, e as duas medidas não existem — o que não é o mesmo que zero busca de marca."
                : decl.motivo === "sem-termos"
                  ? "O card declara `marca` com a lista de termos vazia. Uma lista vazia não classifica nada; declarar é escrever as variantes pelas quais as pessoas procuram o projeto."
                  : "O card declara os termos mas não o corte de país. Sem ele o total do Search Console é mundial e a fatia de marca não seria comparável com ele — a razão sairia contaminada, e meia-medição é pior que ausência porque parece medida."}
            </p>
          ) : !janelaMarca ? (
            <p className="foot">
              não apurado —{" "}
              {serieSeparada && !Array.isArray(serieSeparada) && "erro" in serieSeparada
                ? `banco indisponível (${serieSeparada.erro})`
                : diasSeparados
                  ? "a série está gravada, mas nenhum dia desta janela tem a separação medida ainda. A corrida das 05:17 preenche a janela inteira na próxima passagem."
                  : "sem banco configurado para o hub"}
              .
            </p>
          ) : (
            <>
              <p className="foot">
                Janela da separação: <strong>{janelaMarca.inicio} → {janelaMarca.fim}</strong> —{" "}
                {diasComMarca.length} dia(s) com marca e não-marca medidas. ⚠️ A corrida confere a
                janela inteira de <strong>480 dias</strong>; esta tela confere só os dias acima,
                então os dois vereditos podem divergir <strong>legitimamente</strong>.
              </p>

              <ul className="ficha-krs">
                <li>
                  {/* FR-008/FR-009: os dois meses saem NOMEADOS, nenhum é o corrente, e o primeiro
                      mês fechado é "ainda não apurável" — nunca 0%, que leria como estagnação
                      medida e mandaria consertar um problema que não existe. */}
                  <strong>
                    {crescimento === null ? "ainda não apurável" : variacao(crescimento.valor)}
                  </strong>{" "}
                  de crescimento de impressões não-marca{" "}
                  <span className="foot">
                    {crescimento === null ? (
                      <>
                        — ainda não há <strong>dois meses fechados</strong> nesta janela.{" "}
                        <strong>Não é 0%</strong>: um zero aqui seria estagnação medida, e o que
                        existe é ausência de medição. Um mês só entra quando tem o calendário
                        completo <strong>e</strong> três dias de folga depois do fim — o Search
                        Console ainda sobe a ponta (30/07 da atma saiu com 30 impressões e fechou em
                        827).
                      </>
                    ) : (
                      <>
                        (<strong>{crescimento.de} → {crescimento.para}</strong>, dois meses{" "}
                        <strong>fechados</strong> — nenhum deles é o mês corrente) · meta do board:{" "}
                        <strong>5% a 10%/mês</strong> —{" "}
                        {crescimento.valor >= 0.05 && crescimento.valor <= 0.1
                          ? "dentro da faixa."
                          : crescimento.valor > 0.1
                            ? "acima da faixa."
                            : "abaixo: a demanda que ainda não é sua não está crescendo no ritmo pedido."}
                      </>
                    )}
                  </span>
                </li>
                <li>
                  <strong>{razao === null ? "não apurado" : pct(razao)}</strong> de buscas de marca{" "}
                  <span className="foot">
                    (impressões de marca ÷ total do corte <code>{decl.pais}</code>, em{" "}
                    {janelaMarca.inicio} → {janelaMarca.fim}). O denominador é o total{" "}
                    <strong>dentro do corte de país</strong>, não o site inteiro: o total sem corte é
                    mundial e a fatia de marca não é, então dividir um pelo outro mediria o corte.
                  </span>
                </li>
              </ul>

              {/* FR-006/FR-007: o rótulo de completude. `contradicao` é ALARME e não ressalva
                  educada — resíduo negativo é defeito de filtro, e o conserto é oposto ao de um
                  piso. Colapsar os dois faria um bug de regex se disfarçar de limitação da fonte. */}
              {comp?.estado === "fecha" ? (
                <p className="foot">
                  ✅ <strong>A soma fecha</strong> nesta janela: marca + não-marca ={" "}
                  {br(comp.impressoesPais!)} impressões, exatamente o total do corte. O filtro por
                  consulta preserva as raras, então as duas medidas acima são{" "}
                  <strong>completas</strong> — não são pisos.
                </p>
              ) : comp?.estado === "piso" ? (
                <p className="foot">
                  ⚠️ <strong>Os dois números acima são PISO, não total.</strong> Marca + não-marca
                  somam {br(comp.impressoesMarca! + comp.impressoesNaoMarca!)} contra{" "}
                  {br(comp.impressoesPais!)} do total do corte: faltam {br(comp.residuo!)} impressões
                  ({comp.fracao === null ? "fração não apurada" : pct(comp.fracao)} do total) que o
                  Search Console não atribui a consulta nenhuma. O real é maior dos dois lados, e
                  quanto maior não é observável.
                </p>
              ) : comp?.estado === "contradicao" ? (
                <p className="foot">
                  🚨 <strong>Contradição, e isto é defeito — não limitação da fonte.</strong> Marca
                  + não-marca somam {br(comp.impressoesMarca! + comp.impressoesNaoMarca!)}, que é{" "}
                  {br(-comp.residuo!)} <strong>a mais</strong> que o total do corte (
                  {br(comp.impressoesPais!)}). O filtro de exclusão não é o complemento exato do de
                  inclusão: os números acima não devem ser lidos até isso ser consertado.
                </p>
              ) : null}

              {/* FR-005/FR-012: a lista e o corte na tela. É o que permite a quem lê DESCONFIAR da
                  classificação — e a única defesa contra a lista pobre, cujo erro é favorável e
                  por isso perigoso: uma variante esquecida infla o não-marca. */}
              <p className="foot">
                <strong>Termos de marca em uso</strong> ({decl.termos.length}):{" "}
                {decl.termos.map((t) => (
                  <code key={t}>{t} </code>
                ))}{" "}
                · corte de país: <code>{decl.pais}</code>
                {decl.declaradaEm ? <> · declarados em {decl.declaradaEm}</> : null}. Casamento por{" "}
                <strong>palavra inteira</strong>: <code>atmasfera</code> não conta como marca. Termo
                que falte nesta lista cai em <strong>não-marca</strong> e infla o número que se quer
                ver crescer — é curadoria, e por isso a lista fica aqui em vez de escondida no card.
              </p>
            </>
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

          {!SLUGS_DE_BUSCA.includes(slug) ? (
            /* Escopo, não ausência: sem esta linha o `kpis === null` abaixo diria "sem propriedade
               no GSC", que é uma afirmação sobre o projeto — e a única coisa verdadeira aqui é que
               ninguém perguntou. */
            <p className="foot">
              <strong>Fora do escopo da medição.</strong> Os KPIs do board são apurados só para{" "}
              {SLUGS_DE_BUSCA.join(", ")} — o board de busca é de lá. Nada foi perguntado ao Search
              Console sobre este projeto: isto é decisão, não ausência de dado.
            </p>
          ) : kpis === null ? (
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
              {/* 025: a ressalva de 07/09 virou FILTRO. Medido na atma: `atma aligner` listava 8
                  URLs e não é canibalização nenhuma — busca de marca traz o site inteiro por
                  construção. Com a lista de termos declarada no card, a linha sai da lista em vez
                  de o leitor ter que ignorá-la a cada leitura.
                  Sem lista declarada, o parágrafo e o comportamento de sempre ficam intactos. */}
              {kpis.canibalizacao.removidas === null ? (
                <p className="foot">
                  Consultas de <strong>marca</strong> aparecem aqui e quase nunca são problema:
                  buscar o nome da empresa traz o site inteiro, e é assim que deve ser. A linha que
                  importa é a consulta genérica com duas URLs suas disputando — aí a autoridade está
                  dividida. <strong>Este projeto não declarou lista de termos de marca</strong>, então
                  o rótulo fica com quem lê.
                </p>
              ) : (
                /* FR-011: sumir em SILÊNCIO é indistinguível de um filtro largo demais que também
                   comeu consulta genérica. A contagem é o que permite desconfiar do próprio filtro. */
                <p className="foot">
                  <strong>{br(kpis.canibalizacao.removidas)} consulta(s) de marca removida(s)</strong>{" "}
                  desta lista — buscar o nome da empresa traz o site inteiro por construção e não é
                  canibalização. O filtro usa os {decl.motivo ? 0 : decl.termos.length} termos
                  declarados no card, exibidos no bloco de marca acima.
                </p>
              )}
              {kpis.canibalizacao.lista.length === 0 ? (
                <p className="foot">
                  Nenhuma consulta atendida por duas URLs suas nesta janela — que é a meta do board
                  (zero páginas competindo pela mesma palavra-chave).
                </p>
              ) : (
                <ul className="ficha-krs">
                  {kpis.canibalizacao.lista.slice(0, 10).map((c) => (
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
          {/* Linha morta: a corrida das 05:47 varreu os 35 projetos antes da correção de escopo,
              então há apuração gravada para projetos que não são mais percorridos. A data já sai
              embaixo (FR-014), mas data velha sozinha lê como atraso, não como fim. */}
          {indexacao !== null && !SLUGS_DE_BUSCA.includes(slug) && (
            <p className="foot">
              ⚠️ <strong>Fora do escopo da medição.</strong> A corrida de indexação roda só para{" "}
              {SLUGS_DE_BUSCA.join(", ")}. O número abaixo é de uma corrida antiga e{" "}
              <strong>não será atualizado</strong>.
            </p>
          )}
          {indexacao === null && !SLUGS_DE_BUSCA.includes(slug) ? (
            /* Escopo, não fila: a corrida percorre só `SLUGS_DE_BUSCA`. Dizer "ainda não teve a
               vez" aqui prometeria uma apuração que nunca vem — a mesma mentira de tratar ausência
               declarada como pendência. */
            <p className="foot">
              <strong>Fora do escopo da medição.</strong> A corrida de indexação roda só para{" "}
              {SLUGS_DE_BUSCA.join(", ")} — o board de busca é de lá. Este projeto não é apurado, e
              isso é decisão, não pendência nem falha.
            </p>
          ) : indexacao === null ? (
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

        {/* 024 — o que há DENTRO das páginas. Bloco abaixo de Indexação de propósito: a 022 diz
            QUANTO do site está no índice, e este diz o que existe nas páginas que sobraram fora.
            Fonte: a corrida de segunda 06:17, LIDA do banco — a tela nunca crawleia. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Dentro das páginas — seis medidas de um crawl só</h2>
          {crawl === null ? (
            <p className="foot">
              não apurado —{" "}
              {dbOn() ? "a corrida de crawl ainda não passou por este projeto." : "o hub está sem banco."}
            </p>
          ) : "erro" in crawl ? (
            <p className="foot">
              <strong>A leitura falhou agora</strong> ({crawl.erro}) — distinto de não haver crawl. O
              bloco volta na próxima leitura desta página.
            </p>
          ) : crawl.motivo ? (
            /* Os três motivos são estados DIFERENTES e nunca somam num "0 páginas". */
            <p className="foot">
              <strong>Sem apuração em {crawl.dia}</strong> —{" "}
              {crawl.motivo === "sem_sitemap"
                ? "o site não serve sitemap; o conserto é no build do site."
                : crawl.motivo === "sitemap_vazio"
                  ? "o sitemap existe e está vazio; é uma declaração do próprio site."
                  : "a home não respondeu, e sem home não há origem para a travessia — toda página do sitemap sairia órfã por causa de um timeout, então nenhuma linha foi gravada."}
            </p>
          ) : (
            <>
              {/* FR-015: número sem data sempre parece de hoje. */}
              <p className="foot">
                Apurado em <strong>{crawl.dia}</strong> · {br(crawl.visitadas)} página(s) visitada(s)
                de {br(crawl.declaradas)} declarada(s) no sitemap · {br(crawl.linksNavegacao)} link(s)
                classificado(s) como navegação (menu e rodapé, fora da densidade contextual)
                {crawl.falhas > 0 && <> · {br(crawl.falhas)} falha(s) de rede, fora de todo numerador</>}
              </p>
              {crawl.tetoAtingido && (
                /* FR-012: número cortado que não se declara é número errado. */
                <p className="foot">
                  ⚠️ <strong>A travessia parou no teto</strong> — os números abaixo estão{" "}
                  <strong>incompletos</strong> e valem só para as páginas alcançadas.
                </p>
              )}

              {/* US1 — para onde vai a autoridade interna. */}
              <p>
                <strong>{br(crawl.orfas)}</strong> página(s) órfã(s){" "}
                <span className="foot">
                  declaradas no sitemap que <strong>nenhum link interno alcança</strong> ·{" "}
                  {br(crawl.linkadasNaoDeclaradas)} alcançada(s) por link e ausente(s) do sitemap
                </span>
              </p>
              <ul className="ficha-krs">
                {periferia.slice(0, 15).map((pg) => (
                  <li key={pg.url}>
                    <strong>{caminho(pg.url)}</strong>{" "}
                    <span className="foot">
                      {pg.erro ? (
                        <>
                          falhou na busca ({pg.erro}) — <strong>não</strong> é órfã, é erro de rede
                        </>
                      ) : pg.profundidade === null && pg.noSitemap ? (
                        <>
                          <strong>órfã</strong> — nenhum link interno chega aqui
                        </>
                      ) : (
                        <>profundidade {br(pg.profundidade ?? 0)} clique(s)</>
                      )}
                      {!pg.erro && (
                        <>
                          {" · "}
                          {br(pg.linksContextuais)} link(s) contextual(is)
                          {pg.linksContextuais < LINKS_CONTEXTUAIS_MIN && (
                            <> (abaixo dos {LINKS_CONTEXTUAIS_MIN} do board)</>
                          )}
                          {" · "}
                          {impressoesPorUrl.get(pg.url)
                            ? `${br(impressoesPorUrl.get(pg.url)!)} impressões em 28 d`
                            : "zero impressão no Search Console"}
                          {pg.conteudoEstado === "js-dependente" && (
                            <>
                              {" "}
                              · conteúdo só existe depois do JS — <strong>atrasa</strong> a indexação,
                              não a impede
                            </>
                          )}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {periferia.length > 15 && (
                <p className="foot">
                  {br(periferia.length - 15)} página(s) a mais, fora do topo da lista — ordenadas por
                  periferia (órfã → profundidade ≥ {PROFUNDIDADE_MAX} → menos de{" "}
                  {LINKS_CONTEXTUAIS_MIN} links contextuais) e, dentro do empate, por impressões.
                </p>
              )}

              {/* US2 — o título, que já tem evidência contra si (CTR Gap de 0% na 021). */}
              {integridade && (
                <>
                  <p>
                    <strong>{pct(integridade.fracao)}</strong> de integridade do título{" "}
                    <span className="foot">
                      ({br(integridade.avaliadas)} URL(s) com título e termo apurado · meta do board:{" "}
                      <strong>100%</strong>) — largura <strong>estimada</strong> entre {TITULO_PX_MIN}{" "}
                      e {TITULO_PX_MAX} px E o termo principal nos primeiros {TERMO_ATE} caracteres.
                      {integridade.semTermo > 0 && (
                        <>
                          {" "}
                          {br(integridade.semTermo)} URL(s) ficam fora por{" "}
                          <strong>sem termo apurado</strong> — o Search Console não tem impressão
                          delas, o que não é o mesmo que título errado.
                        </>
                      )}
                    </span>
                  </p>
                  <ul className="ficha-krs">
                    {integridade.fora.slice(0, 10).map((pg: PaginaCrawl) => (
                      <li key={pg.url}>
                        <strong>{pg.titulo}</strong>{" "}
                        <span className="foot">
                          {/* FR-005/SC-004: o método viaja com o número até aqui. Um pixel solto é
                              indistinguível de uma medição, e vai ser lido como uma. */}
                          {pg.tituloPx} px (<strong>estimativa</strong>, método {pg.tituloMetodo}) ·{" "}
                          {posicaoPorUrl.get(pg.url) === null
                            ? "sem termo apurado"
                            : posicaoPorUrl.get(pg.url)! < 0
                              ? `o termo "${termoPorUrl.get(pg.url)}" NÃO aparece no título`
                              : `termo "${termoPorUrl.get(pg.url)}" a partir do caractere ${br(posicaoPorUrl.get(pg.url)!)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {alinhamento && (
                <p>
                  <strong>{pct(alinhamento.fracao)}</strong> de alinhamento de intenção{" "}
                  <span className="foot">
                    ({br(alinhamento.avaliadas)} título(s) avaliado(s)) — título com modificador
                    explícito, informacional ou comercial.
                    {alinhamento.ausentes.length > 0 && (
                      <>
                        {" "}
                        Sem modificador:{" "}
                        {alinhamento.ausentes
                          .slice(0, 6)
                          .map((pg: PaginaCrawl) => caminho(pg.url))
                          .join(", ")}
                        .
                      </>
                    )}
                  </span>
                </p>
              )}

              {/* US3 — dados estruturados: presentes, ausentes ou QUEBRADOS. */}
              {cobertura024 && (
                <p>
                  <strong>{pct(cobertura024.fracao)}</strong> de cobertura de dados estruturados{" "}
                  <span className="foot">
                    ({br(cobertura024.validas)} de {br(cobertura024.avaliadas)} página(s) com JSON-LD
                    válido · meta do board: <strong>100%</strong> e <strong>0 erro crítico</strong>) —{" "}
                    <strong>{br(cobertura024.invalidas.length)} inválida(s)</strong> (o schema existe e
                    estoura no parse: achar a vírgula) e{" "}
                    <strong>{br(cobertura024.ausentes.length)} ausente(s)</strong> (não há schema
                    nenhum: escrever). São consertos diferentes, e a soma dos dois não é um número.
                  </span>
                </p>
              )}

              {/* US4 — há quanto tempo o conteúdo não é tocado. */}
              {atualizacao && (
                <p>
                  {atualizacao.fracao === null ? (
                    <span className="foot">
                      <strong>Cadência de atualização não apurada</strong> — nenhuma das{" "}
                      {br(atualizacao.semData.length)} página(s) declara data. Sem data declarada{" "}
                      <strong>não é</strong> desatualizada: é ausência de declaração.
                    </span>
                  ) : (
                    <>
                      <strong>{pct(atualizacao.fracao)}</strong> dentro da cadência{" "}
                      <span className="foot">
                        ({br(atualizacao.avaliadas)} página(s) que <strong>declaram</strong> data ·
                        auditoria a cada {CADENCIA_MESES} meses) — {br(atualizacao.vencidas.length)}{" "}
                        passaram de {CADENCIA_MESES} meses. As {br(atualizacao.semData.length)} sem
                        data declarada ficam fora do numerador <strong>e</strong> do denominador.
                      </span>
                    </>
                  )}
                </p>
              )}

              {/* FR-013 — o sitemap declarando URL morta ou redirecionada é o achado. */}
              {achadosDoSitemap.length > 0 && (
                <>
                  <p className="foot">
                    <strong>{br(achadosDoSitemap.length)} URL(s) do sitemap com achado</strong> — o
                    sitemap declara, e o site responde outra coisa:
                  </p>
                  <ul className="ficha-krs">
                    {achadosDoSitemap.slice(0, 8).map((pg) => (
                      <li key={pg.url}>
                        <strong>{caminho(pg.url)}</strong>{" "}
                        <span className="foot">
                          {pg.erro ? pg.erro : `redireciona (HTTP ${pg.status ?? "?"}) — o destino é que conta`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Risco aceito do plano, DECLARADO na tela: sem esta frase o leitor conclui sozinho
                  que a órfã é a página recusada pelo Googlebot. */}
              <p className="foot">
                <strong>Esta lista não cruza página a página com as URLs fora do índice.</strong> A
                apuração de indexação acima grava só o agregado do dia, sem veredito por URL — então
                não dá para dizer qual órfã é também uma das recusadas. O que está marcado aqui é quem
                tem <strong>zero impressão</strong> no Search Console. Cruzar as duas exige a corrida
                de indexação persistir por URL: spec nova, não esta.
              </p>
            </>
          )}
        </div>

        {/* 023/US3 — o Pass Rate de campo. Bloco separado porque a fonte é outra (CrUX, dado de
            CAMPO do Chrome) e o alvo é outro: aqui é URL, e URL não se soma com origem. A origem
            aparece na ficha, no N5/Entrega. */}
        {vitais && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Core Web Vitals — quantas URLs passam</h2>
            {"erro" in vitais ? (
              <p className="foot">
                <strong>A apuração falhou agora</strong> ({vitais.erro}) — distinto de não haver
                dado. A fração volta na próxima leitura desta página.
              </p>
            ) : vitais.fracao === null ? (
              <p className="foot">{vitais.motivo}</p>
            ) : (
              <p>
                <strong>{pct(vitais.fracao)}</strong> das URLs prioritárias com &quot;Bom&quot; nos
                três vitais{" "}
                <span className="foot">
                  ({vitais.passam} de {vitais.comDado} URLs com dado de campo · meta do board:{" "}
                  <strong>90%</strong>) — LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no p75. O TTFB fica
                  fora: é experimental na fonte e não entra na definição de &quot;Bom&quot;.
                </span>
              </p>
            )}
            {!("erro" in vitais) && (
              <p className="foot">
                {vitais.consultadas} URL(s) consultada(s) por impressão decrescente
                {vitais.naoConsultadas > 0 && (
                  <> · {vitais.naoConsultadas} não consultada(s) (teto de {CAP_URLS_PASS_RATE}) — <strong>não</strong> reprovadas</>
                )}{" "}
                · p75 de campo, todos os dispositivos, na janela que a CrUX cobre — que não é a
                janela desta página.
              </p>
            )}
          </div>
        )}

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
