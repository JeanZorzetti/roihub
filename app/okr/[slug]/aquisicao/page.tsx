import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProjects } from "@/lib/projects";
import { gscSeries } from "@/lib/gsc";
import { ga4Canais, ga4Cobertura } from "@/lib/ga4";
import { descobertaLonga, comportamentoLongo, descoberta, comportamento } from "@/lib/janelas.mjs";
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
  const [serie, canais, cobertura] = await Promise.all([
    gscSeries(p.url, janelaGsc.inicio, janelaGsc.fim),
    ga4Canais(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
    ga4Cobertura(p.ga4?.propertyId, { inicio: janelaGa4.inicio, fim: janelaGa4.fim }),
  ]);

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
