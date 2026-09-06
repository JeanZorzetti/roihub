import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { FAMILIAS } from "@/lib/okr.mjs";
import { ehApurado, pct } from "@/lib/funil.mjs";
import { formatarRazao } from "@/lib/benchmark.mjs";
import { estadoDeApurado } from "@/lib/ficha.mjs";
import { canaisDoN4, razaoDoKr } from "@/lib/ficha-visual.mjs";
// 019/FR-021: a composição saiu daqui para `lib/ficha-dados.ts` — três telas precisam dela, e a
// ação citada na dobra tem que vir da MESMA chamada de `evaluateAll()` que a citada em N6.
import { dadosDaFicha, type CelulaFicha } from "@/lib/ficha-dados";
import { Buracos } from "./buracos";
import { ValorEmRisco } from "./risco";
import { Projecao, num } from "../projecao";
import { Tabs } from "../../tabs";
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
} from "./celulas";

// Igual à `/okr`: número de OKR vindo do build é número de outra janela, e a R7 pede UMA janela
// declarada para a árvore inteira (contracts/rota-e-menu.md).
export const dynamic = "force-dynamic";


// achado 8 do design-review de 03/09: `document.title` era "ROI Hub" nas 40 fichas — aba e
// histórico indistinguíveis. `fetch()` em `listProjects()`/`listRepos()` é deduplicado pelo Next
// dentro da mesma requisição (mesma URL), então repetir a chamada aqui não dobra a rede.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const projects = await listProjects();
  const p = projects.find((x) => x.slug === slug);
  const nomeCurto = p?.nome.split(" — ")[0] ?? slug;
  return { title: `${nomeCurto} — OKR` };
}

export default async function FichaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dados = await dadosDaFicha(slug);
  if (!dados) notFound();
  // Os MESMOS nomes de campo de antes da extração (019/T005): o diff desta página é de ORDEM
  // dos blocos, não de renomeação.
  const {
    p, ficha, veredito, mercado, projecao, niveis, janelas, motivos,
    buracos, risco, degrauFinal, pendentes, cliques, iniciaEmVisitante,
    marcosCadeia, taxasCadeia, ticketCel, metaComTicket, n5, proximoBuraco,
    nomeCurto, nomeDescricao, necessarioNaJanela,
  } = dados;
  // US1-AC5: `motivos === null` (a fonte não devolve a coluna) e `motivos.motivos.length === 0`
  // (devolve e ninguém foi palitado) são dois estados diferentes, e nenhum dos dois vira
  // placeholder — o lado do motivo simplesmente não renderiza.
  const temMotivo = !!motivos && motivos.motivos.length > 0;

  return (
    <main className="page">
      <Tabs active="okr" okrSlug={slug} />

      {/* 019/FR-007: o índice de âncoras `N0…N6` saiu — os sete níveis mudaram de ROTA, não de
          código, e um índice para seções que não estão mais aqui é navegação para lugar nenhum.
          No lugar dele, UM link, no fim da dobra. */}

      <section className="card ag-section">
        <p className="eyebrow">OKR · ficha de {nomeCurto}</p>
        <div className="hero-top okr-top">
          <div>
            <h1 className="ficha-nome">{nomeCurto}</h1>
            {nomeDescricao && <p className="foot ficha-subtitulo">{nomeDescricao}</p>}
          </div>
          <span
            className={
              veredito.posicao === 1 ? "pill pill-crit" : veredito.posicao === 2 ? "pill pill-warn" : veredito.posicao === 3 ? "pill pill-ok" : "pill"
            }
          >
            {veredito.posicao ? `§7.${veredito.posicao} — ${veredito.rotulo}` : veredito.rotulo}
          </span>
        </div>
        {ficha.perfil && (
          <p className="foot">
            Perfil {ficha.perfil} — {ficha.perfilNome} · N1: {ficha.n1} · <code>{ficha.n2}</code>
          </p>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────────────
            019/FR-001: TRÊS blocos, nesta ordem, sem NADA entre eles e o `<h1>`. A ficha responde
            em 30 segundos — qual degrau é o pior, por quê, e o que fazer — ou não responde.

            BLOCO 1 — a CADEIA. O diagrama subiu de dentro de N3 (onde vivia ~2.000px abaixo) para
            cá, e o veredito virou LEGENDA dele: o `<section>` "Onde trava" deixou de existir como
            bloco próprio (FR-002a). Uma coisa só — o pior degrau marcado no diagrama É
            `veredito.celula`, via `indiceTrava()`, que sobrevive intacta. Não existe segunda régua
            de "pior" nesta tela (FR-002).
            ───────────────────────────────────────────────────────────────────────────────────── */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">A cadeia</h2>
          {marcosCadeia.length > 0 ? (
            <>
              {/* 018/FR-005/FR-008: a época aparece com o motivo DECLARADO ao lado da janela —
                  `janelas.conversao.porque` já É esse motivo quando o card declara `epoca`. */}
              <p className="foot">
                Janela desta cadeia: <strong>{janelas.conversao.inicio} → {janelas.conversao.fim}</strong> — {janelas.conversao.porque}
              </p>
              <CadeiaDiagrama marcos={marcosCadeia} taxas={taxasCadeia} veredito={veredito} janela={{ inicio: janelas.conversao.inicio, fim: janelas.conversao.fim }} />
            </>
          ) : (
            <p className="foot">Sem cadeia: {(ficha.semPerfil as { naoApurado: string } | undefined)?.naoApurado ?? "perfil não declarado"}.</p>
          )}
          {/* A LEGENDA da cadeia — o veredito da §7, que antes era um bloco separado com o mesmo
              peso do diagrama e dizia a mesma coisa por outro caminho. */}
          <p className="ficha-veredito">
            {veredito.celula && <strong>{veredito.celula}: </strong>}
            {veredito.motivo}
          </p>
          {n5?.familia && (
            <p className="foot">
              A cadeia trava em{" "}
              <strong>
                {n5.familia} — {FAMILIAS[n5.familia as keyof typeof FAMILIAS]?.split(" — ")[0] ?? n5.familia}
              </strong>{" "}
              ({n5.motivoFamilia}).
            </p>
          )}
          {/* FR-006 — a régua de mercado é UMA LINHA dentro do bloco da cadeia, subordinada ao
              veredito e rotulada como DIAGNÓSTICO. Nunca alvo: benchmark citado como meta de KR é
              o que a R6 proíbe, e a linha inteira perde o direito de existir se virar prescrição. */}
          {mercado.destaque ? (
            <p className="foot">
              <strong>Mercado</strong> (diagnóstico, nunca alvo) · {mercado.destaque.de} → {mercado.destaque.para}:{" "}
              <strong>{(mercado.destaque.apurado * 100).toFixed(2).replace(".", ",")}%</strong> ={" "}
              <strong>{formatarRazao(mercado.destaque.razao)} o piso</strong> ({mercado.destaque.rotulo}).{" "}
              Faixa da média {(mercado.destaque.faixa.media[0] * 100).toFixed(1).replace(".", ",")}–
              {(mercado.destaque.faixa.media[1] * 100).toFixed(1).replace(".", ",")}% · elite a partir de{" "}
              {(mercado.destaque.faixa.elite[0] * 100).toFixed(1).replace(".", ",")}%.
              {mercado.destaque.buraco &&
                ` Buraco: ${mercado.destaque.buraco.esperado} esperados no piso, ${mercado.destaque.buraco.apuradoEmUnidades} apurados — faltam ${mercado.destaque.buraco.faltam}.`}{" "}
              <em>Fonte: {mercado.destaque.fonte}.</em>
            </p>
          ) : (
            ficha.perfil && (
              // A ausência de régua sai em UMA linha. Antes eram três de prosa explicando por que
              // não há comparação, e foi o que empurrou "o que fazer" para baixo da dobra a
              // 1280×800 (medido: 801px, 1px abaixo). O motivo continua dito; o parágrafo não.
              //
              // 020 — a MESMA linha, com texto melhor. Quando a recusa foi pesquisada, ela nomeia o
              // degrau e diz por que aquele degrau não tem régua; a fonte descartada aparece com o
              // número, porque é justamente o número que o leitor acharia sozinho e aplicaria errado.
              // Sem recusa pesquisada (os outros 34 projetos), o texto genérico continua igual.
              <p className="foot">
                <strong>Mercado</strong> ·{" "}
                {mercado.recusaEmDestaque ? (
                  <>
                    <strong>
                      {mercado.recusaEmDestaque.de} → {mercado.recusaEmDestaque.para}
                    </strong>{" "}
                    não tem régua: {mercado.recusaEmDestaque.motivo}.
                    {mercado.recusaEmDestaque.descartadas?.[0] && (
                      <>
                        {" "}
                        <em>
                          Não confundir com{" "}
                          {mercado.recusaEmDestaque.descartadas[0].url ? (
                            <a href={mercado.recusaEmDestaque.descartadas[0].url} target="_blank" rel="noopener noreferrer">
                              {mercado.recusaEmDestaque.descartadas[0].fonte}
                            </a>
                          ) : (
                            mercado.recusaEmDestaque.descartadas[0].fonte
                          )}{" "}
                          ({mercado.recusaEmDestaque.descartadas[0].numero}), que mede outro degrau.
                        </em>
                      </>
                    )}
                  </>
                ) : (
                  <>nenhum degrau com régua e os dois lados apurados — apurar vem antes de comparar (§7.2).</>
                )}
              </p>
            )
          )}
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────────────
            BLOCO 2 — POR QUÊ e O QUE FAZER num `<section>` SÓ (FR-003). Antes eram dois blocos com
            a árvore de metas inteira entre eles: a palitagem dizia `sem_resposta 29` e a ação
            ficava quatro blocos abaixo, sem se citarem.

            O lado do MOTIVO é omitido quando a fonte não grava `motivo` (US1-AC5) — nunca
            preenchido com placeholder, e a ordem dos demais blocos não muda.
            ───────────────────────────────────────────────────────────────────────────────────── */}
        {(temMotivo || ficha.perfil) && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Por que não avançou, e o que fazer</h2>
            {temMotivo && (
              <>
                <p>
                  {motivos!.motivos.map((m, i) => (
                    <span key={m.motivo}>
                      {i > 0 && " · "}
                      <strong>{m.n}</strong> {m.motivo.replace(/_/g, " ")}
                    </span>
                  ))}
                  {motivos!.semMotivo > 0 && (
                    <span className="foot"> · {motivos!.semMotivo} sem motivo registrado</span>
                  )}
                </p>
                <p className="foot">
                  {motivos!.motivos[0].n / motivos!.total >= 0.5 ? (
                    <>
                      <strong>{motivos!.motivos[0].motivo.replace(/_/g, " ")}</strong> sozinho é{" "}
                      {Math.round((motivos!.motivos[0].n / motivos!.total) * 100)}% dos {motivos!.total} leads
                      reais da janela — não é taxonomia de família (D3/D4 é do degrau, não do motivo),
                      mas um motivo dominando por larga margem lê como encanamento antes de oferta.
                    </>
                  ) : (
                    <>Palitagem do próprio projeto ({motivos!.total} lead(s) reais na janela), sem classificação de família — a taxonomia é do cliente.</>
                  )}
                </p>
              </>
            )}
            {/* A ação vem da MESMA chamada de `evaluateAll()` que alimenta N6 (FR-021): uma
                composição só, em `dadosDaFicha()`. Duas telas montando por conta própria é o
                defeito que a 018 matou nos degraus, um nível acima. */}
            {pendentes.length > 0 ? (
              <p>
                <strong>Fazer:</strong> <a href={`/okr/${slug}/metodo#N6`}>{pendentes[0].titulo}</a>
                {pendentes.length > 1 ? ` — e mais ${pendentes.length - 1} em N6.` : "."}
              </p>
            ) : proximoBuraco ? (
              <p>
                <strong>Fazer:</strong> sem ação com dono agora. Próximo dado a apurar:{" "}
                <strong>{proximoBuraco.nome}</strong> — consultar {proximoBuraco.fonte}.
              </p>
            ) : (
              // Mesma regra da lista vazia de buracos (FR-005): sem ação E sem dado a apurar é um
              // estado EXIBIDO. Renderizar nada aqui é indistinguível de a composição ter falhado —
              // e esta é a terceira das três perguntas que a dobra existe para responder.
              <p>
                <strong>Fazer:</strong> sem ação com dono na agenda e sem dado a apurar na cadeia —
                o trabalho é o degrau que o veredito aponta acima, não medição nova.
              </p>
            )}
          </div>
        )}

        {/* BLOCO 3 — os buracos de medição, contados e nomeados (FR-004/FR-005). */}
        <Buracos buracos={buracos} veredito={veredito} />

        {/* BLOCO 4 — o PLACAR: o que a meta exige (os dois lados da FR-012) e o que está em risco.
            "Quanto falta" deixou de ser bloco separado do valor em risco — são a mesma pergunta. */}
        <div className="ficha-bloco">
          <h2 className="ficha-bloco-h">Quanto falta</h2>
          <Projecao meta={metaComTicket ?? undefined} p={projecao} ticketCel={ticketCel} />
        </div>
        <ValorEmRisco risco={risco} motivosDePerda={p.motivosDePerda} nomeDoDegrauFinal={degrauFinal?.nome ?? "degrau final"} />

        {/* FR-024a: o bloco de Descoberta FICA onde está — declarando a janela CURTA que produziu o
            número, e linkando a longa (FR-026). Renderiza só quando `marcos[0]` é `visitante`,
            ou seja, perfis A/B — nunca a atma. */}
        {iniciaEmVisitante && (
          <div className="ficha-bloco">
            <h2 className="ficha-bloco-h">Descoberta</h2>
            <p className="foot">
              Janela: <strong>{janelas.descoberta.inicio} → {janelas.descoberta.fim}</strong> — {janelas.descoberta.porque}.
              Sem taxa ligando estes números à Conversão — são cadeias diferentes.{" "}
              <strong>28 dias</strong> — série de 8 meses em <a href={`/okr/${slug}/aquisicao`}>Aquisição</a>.
            </p>
            <Linha c={estadoDeApurado(cliques, "Search Console", "visitante")} />
          </div>
        )}

        {/* FR-007/FR-020: UM link para a derivação de método, no lugar do índice de sete âncoras. */}
        <p className="foot">
          A derivação completa — <strong>N0 a N6</strong> e a árvore de metas — está em{" "}
          <a href={`/okr/${slug}/metodo`}>método</a>. Os números de aquisição em janela longa (8 meses de
          Search Console, 12 de GA4) estão em <a href={`/okr/${slug}/aquisicao`}>aquisição</a>.
        </p>

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

    </main>
  );
}
