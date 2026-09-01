import { Pool } from "pg";
import { listProjects } from "@/lib/projects";
import { gscSeries, isoDaysAgo } from "@/lib/gsc";
import { totals28 } from "@/lib/series.mjs";
import { apurado, naoApurado, ehApurado, pct } from "@/lib/funil.mjs";
import { montarFicha, posicaoDeAtaque, resumirPortfolio, POSICOES, pipelineDe, celulaDeLeads } from "@/lib/okr.mjs";
import { dbOn, listLeads } from "@/lib/db";
import { Tabs } from "../tabs";

// GSC e CRM a cada request, igual /seo e /crm. Sem cache: um número de OKR que veio do build é um
// número de outra janela, e a R7 do template pede UMA janela declarada para a árvore inteira.
export const dynamic = "force-dynamic";

// A mesma janela de `scripts/funil.mjs` e de `totals28`: 28 dias fechando em D-3, porque o Search
// Console fecha o dia com ~3 dias de atraso. Uma janela só, declarada na tela (R7) — numerador de
// agosto sobre denominador de 90 dias é uma taxa inventada.
const FIM = isoDaysAgo(3);
const INICIO = isoDaysAgo(30);

type Celula = { valor: number } | { naoApurado: string };

/**
 * A Atma captura paciente no PRÓPRIO banco (`patient_leads`) desde julho. R4 manda ler o dado onde
 * ele JÁ cai: reinstrumentar o site para reenviar tudo ao CRM do hub criaria uma cópia PIOR da
 * tabela que já existe — sem histórico, contando só de hoje em diante.
 *
 * Pool próprio e efêmero porque é banco EXTERNO, não o do hub. Uma entrada só e explícita; se
 * aparecer uma segunda, isto vira `lib/`.
 */
const FONTES_PROPRIAS: Record<string, { env: string; tabela: string; sql: string }> = {
  atma: {
    env: "ATMA_DATABASE_URL",
    tabela: "patient_leads",
    sql: `SELECT nome, email, to_char(created_at, 'YYYY-MM-DD') AS criado FROM patient_leads ORDER BY created_at`,
  },
};

async function lerFontePropria(slug: string) {
  const f = FONTES_PROPRIAS[slug];
  if (!f) return null;
  // Princípio V: o NOME da variável, nunca o valor.
  if (!process.env[f.env]) return { erro: `${f.env} ausente` };
  const pool = new Pool({ connectionString: process.env[f.env], max: 1 });
  try {
    const r = await pool.query(f.sql);
    return { rows: r.rows, tabela: f.tabela };
  } catch (e) {
    // Falha FECHADA: banco externo fora NÃO pode virar "0 leads", que é o melhor placar possível
    // produzido pelo pior estado possível.
    const err = e as { code?: string; message?: string };
    return { erro: err?.code ?? String(err?.message ?? "erro").slice(0, 60) };
  } finally {
    await pool.end();
  }
}

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

export default async function OkrPage() {
  const projects = await listProjects();

  // UMA query de leads para os 35, não uma por projeto.
  let leads: Awaited<ReturnType<typeof listLeads>> | null = null;
  let erroLeads: string | null = null;
  if (!dbOn()) erroLeads = "DATABASE_URL ausente";
  else {
    try {
      leads = await listLeads();
    } catch (e) {
      erroLeads = (e as { code?: string })?.code ?? "banco indisponível";
    }
  }
  const porPipeline = new Map<string, typeof leads>();
  for (const l of leads ?? []) {
    const arr = porPipeline.get(l.pipeline) ?? [];
    arr.push(l);
    porPipeline.set(l.pipeline, arr as typeof leads);
  }

  const linhas = await Promise.all(
    projects.map(async (p) => {
      // cliques — o GSC. Host de fornecedor (`*.vercel.app`) fica FORA de toda propriedade: isso
      // NÃO é "zero tráfego", é "não há onde olhar", e o conserto é domínio próprio, não SEO.
      const s = await gscSeries(p.url);
      const cliques: Celula = s ? apurado(totals28(s.days, FIM).current.clicks) : naoApurado(`sem propriedade no GSC para ${p.url}`);

      // leads — fonte própria primeiro (R4), CRM do hub depois.
      let leadsCel: Celula;
      const propria = await lerFontePropria(p.slug);
      if (propria && "erro" in propria) leadsCel = naoApurado(`fonte própria indisponível (${propria.erro})`);
      else if (propria) leadsCel = celulaDeLeads(propria.rows, { inicio: INICIO, fim: FIM, onde: `tabela \`${propria.tabela}\` do próprio projeto` }).celula;
      else if (erroLeads) leadsCel = naoApurado(`banco indisponível (${erroLeads})`);
      else leadsCel = celulaDeLeads(porPipeline.get(pipelineDe(p.slug)) ?? null, { inicio: INICIO, fim: FIM, onde: `pipeline \`${pipelineDe(p.slug)}\`` }).celula;

      // vendas — AUSENTE é "não olhei", `[]` é "olhei, zero". A distinção inteira do template.
      const vendas: Celula = Array.isArray(p.vendas)
        ? apurado(p.vendas.filter((v) => v?.data && v.data >= INICIO && v.data <= FIM).length)
        : naoApurado("sem régua de dinheiro (campo `vendas` ausente no card)");

      const ficha = montarFicha({ slug: p.slug, perfil: p.perfil, coletado: { cliques, leads: leadsCel, vendas } });
      return { p, ficha, v: posicaoDeAtaque(ficha) };
    })
  );

  const resumo = resumirPortfolio(linhas.map((l) => l.v));
  // Ordem da §7: posição 1 primeiro. `sem perfil` (posição 0) vai para o FIM — não é um veredito,
  // é a ausência de um.
  const ordenadas = [...linhas].sort((a, b) => (a.v.posicao || 99) - (b.v.posicao || 99) || a.p.slug.localeCompare(b.p.slug));

  return (
    <main className="page">
      <Tabs active="okr" />

      <section className="card">
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
        <p className="foot">
          {resumo.porPosicao.map((n, i) => `${n} ${POSICOES[i]}`).join(" · ")} — soma {resumo.porPosicao.reduce((a: number, b: number) => a + b, 0)} de{" "}
          {resumo.total}.
        </p>
        {erroLeads && <p className="banner">⚠️ A coluna de leads caiu inteira ({erroLeads}). Nenhuma linha vira 0 por isso — todas viram `não apurado`.</p>}
      </section>

      {ordenadas.map(({ p, ficha, v }) => (
        <section className="card" key={p.slug}>
          <div className="hero-top">
            <span className="hero-name">{p.nome}</span>
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

          {ficha.marcos.length > 0 && (
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
          )}
        </section>
      ))}

      <section className="card">
        <p className="eyebrow">O que isto NÃO vê</p>
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
            <strong>A primeira corrida de um check mede o CHECK</strong>, não o negócio. Conferir uma linha à mão antes de citar
            qualquer contagem acima.
          </li>
        </ul>
      </section>
    </main>
  );
}
