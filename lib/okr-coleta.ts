import { Pool } from "pg";
import { gscSeries, gscPaginas, isoDaysAgo, type GscPaginas } from "@/lib/gsc";
import { totals28 } from "@/lib/series.mjs";
import { apurado, naoApurado, ehApurado } from "@/lib/funil.mjs";
import { pipelineDe, celulaDeLeads, celulasDeOrcamento } from "@/lib/okr.mjs";
import { dbOn, listLeads } from "@/lib/db";
import { ga4Canais, ga4Eventos, type LeituraGa4, type EventosGa4 } from "@/lib/ga4";

// A coleta das três células da 009 (cliques, leads, vendas), extraída de app/okr/page.tsx sem
// mudar comportamento (011, decisão D5): "se aparecer uma segunda [entrada], isto vira `lib/`" —
// e apareceu a segunda tela (a ficha de /okr/<slug>). Um import só para as duas rotas, senão elas
// divergem na primeira fonte própria nova e a ficha passa a exibir um número que a `/okr` não
// exibe — o defeito que a SC-001 mede. `.ts` porque toca `pg` e `google-auth-library`; não
// contém regra nenhuma (a regra — montarFicha, projetar, posicaoDeAtaque — fica na página).

type Celula = { valor: number } | { naoApurado: string };

// A mesma janela de scripts/funil.mjs e de totals28: 28 dias fechando em D-3, porque o Search
// Console fecha o dia com ~3 dias de atraso. Uma janela só, declarada na tela (R7).
export const FIM = isoDaysAgo(3);
export const INICIO = isoDaysAgo(30);
// ⚠️ `hoje` NÃO é `FIM`: o prazo da meta é compromisso de calendário, e o atraso de 3 dias do GSC
// é defeito da fonte, não do calendário (D3).
export const HOJE = isoDaysAgo(0);

/**
 * A Atma captura paciente no PRÓPRIO banco (`patient_leads`) desde julho. R4 manda ler o dado onde
 * ele JÁ cai: reinstrumentar o site para reenviar tudo ao CRM do hub criaria uma cópia PIOR da
 * tabela que já existe — sem histórico, contando só de hoje em diante.
 */
export const FONTES_PROPRIAS: Record<
  string,
  { env: string; tabela: string; sql: string; orcamentos?: { tabela: string; sql: string } }
> = {
  atma: {
    env: "ATMA_DATABASE_URL",
    tabela: "patient_leads",
    sql: `SELECT nome, email, to_char(created_at, 'YYYY-MM-DD') AS criado FROM patient_leads ORDER BY created_at`,
    // Mesma conexão, segunda query: o degrau que a cadeia nova mede. A Atma deixou de prometer
    // "achamos um doutor perto de você" (saída do sócio comercial) e passou a competir em PREÇO —
    // o orçamento é o degrau real, e ele JÁ estava gravado enquanto a ficha dizia "sem coletor".
    orcamentos: {
      tabela: "orcamentos",
      sql: `SELECT to_char(criado_em, 'YYYY-MM-DD') AS criado, status, paciente_lead_id FROM orcamentos ORDER BY criado_em`,
    },
  },
};

export async function lerFontePropria(slug: string) {
  const f = FONTES_PROPRIAS[slug];
  if (!f) return null;
  // Princípio V: o NOME da variável, nunca o valor.
  if (!process.env[f.env]) return { erro: `${f.env} ausente` };
  const pool = new Pool({ connectionString: process.env[f.env], max: 1 });
  try {
    const r = await pool.query(f.sql);
    // Uma conexão para as duas tabelas. Falha da segunda NÃO derruba a primeira: `orcamentos` é
    // degrau novo e leads é o que a `/okr` já servia — regressão silenciosa aqui apagaria número
    // que hoje está na tela.
    let orcamentos: { rows: unknown[] } | { erro: string } | null = null;
    if (f.orcamentos) {
      try {
        orcamentos = { rows: (await pool.query(f.orcamentos.sql)).rows };
      } catch (e) {
        const err = e as { code?: string; message?: string };
        orcamentos = { erro: err?.code ?? String(err?.message ?? "erro").slice(0, 60) };
      }
    }
    return { rows: r.rows, tabela: f.tabela, orcamentos };
  } catch (e) {
    // Falha FECHADA: banco externo fora NÃO pode virar "0 leads", que é o melhor placar possível
    // produzido pelo pior estado possível.
    const err = e as { code?: string; message?: string };
    return { erro: err?.code ?? String(err?.message ?? "erro").slice(0, 60) };
  } finally {
    await pool.end();
  }
}

/**
 * Leads do CRM do hub, agrupados por pipeline — UMA query para todos os projetos, não uma por
 * projeto. `null`/erro quando o banco do hub está fora.
 */
export async function coletarLeadsDoHub(): Promise<{
  porPipeline: Map<string, Awaited<ReturnType<typeof listLeads>>>;
  erroLeads: string | null;
}> {
  let erroLeads: string | null = null;
  let leads: Awaited<ReturnType<typeof listLeads>> | null = null;
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
  return { porPipeline: porPipeline as Map<string, Awaited<ReturnType<typeof listLeads>>>, erroLeads };
}

/**
 * As três células de UM projeto na janela declarada, sem regra nenhuma por cima — quem monta a
 * cadeia é `montarFicha()` (009), chamada pela página.
 */
export async function coletarDoProjeto(
  p: { slug: string; url: string; vendas?: { data: string }[]; ga4?: { propertyId: string } },
  {
    inicio = INICIO,
    fim = FIM,
    porPipeline,
    erroLeads,
  }: { inicio?: string; fim?: string; porPipeline: Map<string, Awaited<ReturnType<typeof listLeads>>>; erroLeads: string | null },
): Promise<{
  cliques: Celula;
  leads: Celula;
  vendas: Celula;
  impressoes: Celula;
  orcamentos: Celula;
  orcamentosAceitos: Celula;
  ga4: LeituraGa4;
  ga4ev: EventosGa4;
  orcamentosSemLead: { valor: number } | null;
  paginas: GscPaginas;
}> {
  // cliques — o GSC. Host de fornecedor (`*.vercel.app`) fica FORA de toda propriedade: isso NÃO
  // é "zero tráfego", é "não há onde olhar", e o conserto é domínio próprio, não SEO.
  // GA4 (013) entra no MESMO Promise.all — duas fontes independentes, sem somar latência.
  // GA4 entra DUAS vezes no mesmo Promise.all (canais para N4, eventos para os medidores D3 do
  // N5) — duas queries independentes da mesma propriedade, sem somar latência e sem que a falha
  // de uma alcance a outra.
  // `gscPaginas` (016) entra no MESMO Promise.all: é a segunda query da mesma propriedade, para a
  // camada de entrega, e falha dela não pode alcançar as outras três.
  const [s, ga4, ga4ev, paginas] = await Promise.all([
    gscSeries(p.url),
    ga4Canais(p.ga4?.propertyId, { inicio, fim }),
    ga4Eventos(p.ga4?.propertyId, { inicio, fim }),
    gscPaginas(p.url, { inicio, fim }),
  ]);
  const totals = s && "days" in s ? totals28(s.days, fim) : null;
  // `s` distingue fato real (`null`) de falha transitória (`{erro}`) — achado 1 do design-review
  // de 03/09: colapsar os dois fazia "sem propriedade" mentir quando era só timeout, e o veredito
  // (que lê esta frase pra classificar D1 vs D4 em okr.mjs) mudava sozinho a cada release.
  const motivoGsc = s && "erro" in s ? `falhou agora — GSC indisponível (${s.erro})` : `sem propriedade no GSC para ${p.url}`;
  const cliques: Celula = totals ? apurado(totals.current.clicks) : naoApurado(motivoGsc);
  // impressões — a MESMA série que dá cliques, sem chamada nova (FR-036, US3 disponiveisN5).
  const impressoes: Celula = totals ? apurado(totals.current.impressions) : naoApurado(motivoGsc);

  // leads — fonte própria primeiro (R4), CRM do hub depois.
  let leadsCel: Celula;
  const propria = await lerFontePropria(p.slug);
  if (propria && "erro" in propria) leadsCel = naoApurado(`fonte própria indisponível (${propria.erro})`);
  else if (propria)
    leadsCel = celulaDeLeads(propria.rows, { inicio, fim, onde: `tabela \`${propria.tabela}\` do próprio projeto` }).celula;
  else if (erroLeads) leadsCel = naoApurado(`banco indisponível (${erroLeads})`);
  else leadsCel = celulaDeLeads(porPipeline.get(pipelineDe(p.slug)) ?? null, { inicio, fim, onde: `pipeline \`${pipelineDe(p.slug)}\`` }).celula;

  // orçamentos — os dois degraus do meio da cadeia D. Projeto sem fonte de orçamento não recebe
  // `0`: recebe o `não apurado` que `celulasDeOrcamento(null)` devolve, senão todo perfil D sem a
  // tabela passaria a exibir uma cadeia zerada que ninguém mediu.
  const linhasOrc =
    propria && !("erro" in propria) && propria.orcamentos && !("erro" in propria.orcamentos)
      ? (propria.orcamentos.rows as { criado: string; status: string; paciente_lead_id: string | null }[])
      : null;
  const { enviados: orcamentos, aceitos: orcamentosAceitos } = celulasDeOrcamento(linhasOrc, { inicio, fim });

  // orçamentoSemLead (013, US3) — o vestígio do WhatsApp: a coluna paciente_lead_id JÁ vem no
  // SELECT acima e era descartada. `null` quando não há fonte de orçamento; nunca vira `0`.
  const orcamentosSemLead = linhasOrc
    ? { valor: linhasOrc.filter((o) => o.criado >= inicio && o.criado <= fim && o.paciente_lead_id == null).length }
    : null;

  // vendas — AUSENTE é "não olhei", `[]` é "olhei, zero". A distinção inteira do template.
  const vendas: Celula = Array.isArray(p.vendas)
    ? apurado(p.vendas.filter((v) => v?.data && v.data >= inicio && v.data <= fim).length)
    : naoApurado("sem régua de dinheiro (campo `vendas` ausente no card)");

  return { cliques, leads: leadsCel, vendas, impressoes, orcamentos, orcamentosAceitos, ga4, ga4ev, orcamentosSemLead, paginas };
}

export { ehApurado };
