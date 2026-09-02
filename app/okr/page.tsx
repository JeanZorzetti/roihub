import Link from "next/link";
import { listProjects } from "@/lib/projects";
import { ehApurado, pct } from "@/lib/funil.mjs";
import { montarFicha, posicaoDeAtaque, resumirPortfolio, POSICOES } from "@/lib/okr.mjs";
import { projetar } from "@/lib/projecao.mjs";
import { FIM, INICIO, HOJE, coletarLeadsDoHub, coletarDoProjeto } from "@/lib/okr-coleta";
import { Tabs } from "../tabs";

// GSC e CRM a cada request, igual /seo e /crm. Sem cache: um número de OKR que veio do build é um
// número de outra janela, e a R7 do template pede UMA janela declarada para a árvore inteira.
export const dynamic = "force-dynamic";

type Celula = { valor: number } | { naoApurado: string };

/** Fração SEMPRE colada no percentual (R2). `6,67%` sozinho cai na faixa de elite dos benchmarks e
 * são 2 leads em 30 cliques — aviso ao lado perde para o percentual em qualquer leitura rápida. */
function Taxa({ t }: { t: { celula: Celula; numerador: Celula; denominador: Celula } }) {
  if (!ehApurado(t.celula)) return <span className="foot">não apurado</span>;
  const n = (t.numerador as { valor: number }).valor;
  const d = (t.denominador as { valor: number }).valor;
  return (
    <strong>
      {pct((t.celula as { valor: number }).valor)} ({n}/{d})
    </strong>
  );
}

function Celula({ c }: { c: Celula }) {
  if (ehApurado(c)) return <strong>{(c as { valor: number }).valor}</strong>;
  // R1: o motivo ocupa o lugar do número. Nunca `0` onde a resposta é "não olhei".
  return <span className="foot">não apurado — {(c as { naoApurado: string }).naoApurado}</span>;
}

/** Número com vírgula, 2 casas só quando não é inteiro — mesma régua de `pct()` de funil.mjs. */
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));

type Meta = { valor?: number; ticket?: number; prazo?: string; declaradaEm?: string };
type ProjecaoResultado = ReturnType<typeof projetar>;

/**
 * Bloco de projeção invertida (010), abaixo do veredito da 009 na mesma seção do card (D6). Só a
 * `atma` tem `meta` hoje — os outros 39 caem na linha `.foot` (R-d, FR-013).
 */
function Projecao({ meta, p }: { meta?: Meta; p: ProjecaoResultado }) {
  if (p.veredito === "nao-apurado") {
    return <p className="foot">projeção: não apurado — {p.motivo}</p>;
  }

  const ancora = p.ancora as { nome: string; valor: number };
  return (
    <div className="foot">
      <p>
        Meta <strong>declarada</strong>: R$ {num(meta!.valor!)} em {num(meta!.ticket!)} por unidade
        (declarada em {meta!.declaradaEm ?? "data não registrada"}) · N1 necessário no prazo:{" "}
        <strong>{num((p.n1Total as { valor: number }).valor)}</strong>, na janela de {p.normalizacao!.janelaDias} dias:{" "}
        <strong>{num((p.n1Janela as { valor: number }).valor)}</strong>
        {p.normalizacao!.encurtada ? " — janela encurtada, prazo restante menor que uma janela cheia" : ""} —{" "}
        <code>{p.normalizacao!.conta}</code>
      </p>
      <p>
        Âncora: <strong>{ancora.nome} = {num(ancora.valor)}</strong>
        {p.ancora!.ehFinal && " (o próprio N1 — cadeia fechada)"}
      </p>
      {ehApurado(p.fatorObrigatorio) && (
        <p>
          <strong>fator obrigatório</strong>:{" "}
          {p.veredito === "impossivel" ? (
            <>meta impossível na janela — {p.motivo}</>
          ) : (
            <>
              <strong>
                {pct((p.fatorObrigatorio as { valor: number }).valor)} ({num((p.n1Janela as { valor: number }).valor)}/{num(ancora.valor)})
              </strong>
              {p.veredito === "limite" && <> — {p.motivo}</>}
            </>
          )}
        </p>
      )}
      {ehApurado(p.multiploNecessario) && (
        <p>
          <strong>múltiplo necessário</strong>: {num((p.multiploNecessario as { valor: number }).valor)}× (
          {num((p.n1Janela as { valor: number }).valor)}/{num(ancora.valor)}) — {p.motivo}
        </p>
      )}
      {ehApurado(p.folga) && (
        <p>
          <strong>folga</strong>: {num((p.folga as { valor: number }).valor)}×
        </p>
      )}
      {p.degrausAMedir.length > 0 && (
        <p>degraus a medir: {p.degrausAMedir.map((d) => `${d.de} → ${d.para}`).join(", ")}</p>
      )}
    </div>
  );
}

export default async function OkrPage() {
  const projects = await listProjects();

  // UMA query de leads para os 35, não uma por projeto.
  const { porPipeline, erroLeads } = await coletarLeadsDoHub();

  const linhas = await Promise.all(
    projects.map(async (p) => {
      const { cliques, leads: leadsCel, vendas, orcamentos, orcamentosAceitos } = await coletarDoProjeto(p, { inicio: INICIO, fim: FIM, porPipeline, erroLeads });
      // SC-001: a lista e a ficha leem o MESMO `coletado`. Passar menos aqui faria a `/okr` julgar
      // a posição de ataque por uma cadeia mais curta que a que a ficha exibe.
      const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads: leadsCel, vendas, orcamentos, orcamentosAceitos } });
      const projecao = projetar({ ficha, meta: p.meta ?? null, hoje: HOJE });
      return { p, ficha, v: posicaoDeAtaque(ficha), projecao };
    })
  );

  const resumo = resumirPortfolio(linhas.map((l) => l.v));
  // Ordem da §7: posição 1 primeiro. `sem perfil` (posição 0) vai para o FIM — não é um veredito,
  // é a ausência de um.
  const ordenadas = [...linhas].sort((a, b) => (a.v.posicao || 99) - (b.v.posicao || 99) || a.p.slug.localeCompare(b.p.slug));
  // 23 dos 40 cards renderizavam o MESMO texto duas vezes ("sem perfil declarado" no pill e no
  // corpo) e ocupavam 2288px de rolagem a 1440 — 57% dos cards com zero informação. A ausência de
  // veredito continua contada no resumo acima e nomeável aqui embaixo, mas não paga um card
  // inteiro cada. Mesmo padrão do `.sem-site` da home: pendência recolhida, não alerta.
  const comVeredito = ordenadas.filter((l) => l.v.posicao);
  const semPerfil = ordenadas.filter((l) => !l.v.posicao);

  return (
    <main className="page">
      <Tabs active="okr" />

      <section className="card ag-section">
        <p className="eyebrow">OKR · a árvore N0-N6 do portfólio</p>
        <h1>O que adianta fazer agora</h1>
        <p>
          Cada projeto entra na cadeia do <strong>perfil</strong> dele e sai com a posição de ataque
          do §7 de <code>handoff/okr-kpi-template.md</code>. Janela única para a árvore inteira (R7):{" "}
          <strong>
            {INICIO} → {FIM}
          </strong>{" "}
          — 28 dias fechando em D-3, o atraso do Search Console.
        </p>
        {/* Em ordem de índice a linha abria com `23 sem perfil declarado`, em cinza de rodapé: o
            primeiro número que se lia era a AUSÊNCIA de veredito, e o que decide o dia (quantos com
            fator zerado) vinha depois e apagado. Posição 0 continua na linha — a soma tem que fechar
            em 40, senão a contagem mente sobre onde a perda acontece — mas por último. */}
        <p>
          {[1, 2, 3].map((i) => `${resumo.porPosicao[i]} ${POSICOES[i]}`).join(" · ")} · {resumo.porPosicao[0]} {POSICOES[0]} — soma{" "}
          {resumo.porPosicao.reduce((a: number, b: number) => a + b, 0)} de {resumo.total}.
        </p>
        {erroLeads && <p className="banner">⚠️ A coluna de leads caiu inteira ({erroLeads}). Nenhuma linha vira 0 por isso — todas viram `não apurado`.</p>}
      </section>

      {comVeredito.map(({ p, ficha, v, projecao }) => (
        <section className="card ag-section" key={p.slug}>
          {/* `<h2>`, não `<span>`: com 40 nomes em span a página inteira tinha UM heading, e quem
              navega por heading parava uma vez em 10886px. */}
          <div className="hero-top okr-top">
            {/* Única mudança permitida nesta página (FR-006/FR-032): o nome do card com perfil
                declarado vira link para a ficha inteira. Mesmo `<h2>`, mesma posição, mesmo
                texto — a SC-001 confere por diff do HTML servido. */}
            <h2 className="hero-name">
              <Link href={`/okr/${p.slug}`}>{p.nome}</Link>
            </h2>
            <span className={v.posicao === 1 ? "pill pill-crit" : v.posicao === 2 ? "pill pill-warn" : "pill"}>
              {v.posicao ? `§7.${v.posicao} — ${v.rotulo}` : v.rotulo}
            </span>
          </div>
          {ficha.perfil && (
            <p className="foot">
              Perfil {ficha.perfil} — {ficha.perfilNome} · N1: {ficha.n1} · <code>{ficha.n2}</code>
            </p>
          )}
          <p>
            {v.celula && <strong>{v.celula}: </strong>}
            {v.motivo}
          </p>

          <Projecao meta={p.meta} p={projecao} />

          {ficha.marcos.length > 0 && (
            // A rolagem horizontal vinha do `overflow-x` do próprio `.card` — que não é focável, e
            // em 390px a tabela rola de fato (383 contra 325): teclado sem mouse não alcançava
            // colunas que existem (WCAG 2.1.1). Container próprio, focável e nomeado; assim o card
            // também para de rolar junto com a prosa.
            <div className="tabela-rolavel" tabIndex={0} role="region" aria-label={`Degraus da cadeia de ${p.nome}`}>
              <table>
                <thead>
                  <tr>
                    <th>degrau</th>
                    <th>valor</th>
                    <th>taxa desde o anterior</th>
                    <th>fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {ficha.marcos.map((m: { chave: string; nome: string; celula: Celula; fonte: string; familiaDoBuraco: string | null }, i: number) => (
                    <tr key={m.chave}>
                      <td>{m.nome}</td>
                      <td>
                        <Celula c={m.celula} />
                      </td>
                      <td>{i > 0 ? <Taxa t={ficha.taxas[i - 1]} /> : "—"}</td>
                      <td className="foot">
                        {m.familiaDoBuraco && <span className="pill">{m.familiaDoBuraco}</span>} {m.fonte}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      {semPerfil.length > 0 && (
        <details className="sem-site">
          <summary>
            {semPerfil.length} projetos sem perfil declarado — fora da árvore até alguém escolher a cadeia
          </summary>
          <ul>
            {semPerfil.map(({ p }) => (
              <li key={p.slug}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.nome}
                </a>
                <code>{p.slug}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="card ag-section">
        <h2 className="eyebrow">O que isto NÃO vê</h2>
        <ul className="foot">
          <li>
            <strong>`não apurado` nunca significa zero.</strong> Significa que não há de onde ler — e para cada célula o conserto é
            diferente: propriedade no GSC, evento de lead no banco, régua de dinheiro no gateway.
          </li>
          <li>
            <strong>Cliques ≠ sessões.</strong> O GSC conta clique na SERP; quem sai antes de carregar não vira sessão. A taxa do
            primeiro degrau é um PISO da conversão, nunca a conversão.
          </li>
          <li>
            <strong>Lead de outro canal</strong> (indicação, WhatsApp, tráfego direto) entra no numerador e não no denominador. Por
            isso numerador &gt; denominador vira `não apurado` em vez de uma taxa acima de 100%.
          </li>
          <li>
            <strong>O Nível 0 — DEMANDA</strong> (volume de busca) não está aqui. Projeto com 0 clique pode ser SEO ruim ou mercado que
            não busca, e a diferença decide tudo.
          </li>
          <li>
            <strong>N1 é contagem, não R$.</strong> O valor em reais sai `não apurado: sem ticket declarado` — nenhum card tem ticket.
            Isso não muda o veredito: a §7 decide por fator zerado e por `não apurado`, não pelo total.
          </li>
          <li>
            <strong>As posições §7.4 e §7.5</strong> (volume/ticket, depois N5) não são derivadas aqui. Separar taxa &quot;razoável&quot;
            de taxa ruim exigiria benchmark como meta, e a R6 proíbe.
          </li>
          <li>
            <strong>O fator obrigatório caber em 100% não significa a meta ser alcançável</strong> — só que ela não é
            aritmeticamente impossível. A distância entre &quot;cabe&quot; e &quot;acontece&quot; é leitura humana.
          </li>
          <li>
            <strong>A primeira corrida de um check mede o CHECK</strong>, não o negócio. Conferir uma linha à mão antes de citar
            qualquer contagem acima.
          </li>
        </ul>
      </section>
    </main>
  );
}
