import { Pool } from "pg";
import { gscSeries, isoDaysAgo } from "@/lib/gsc";
import { totals28 } from "@/lib/series.mjs";
import { apurado, naoApurado, ehApurado } from "@/lib/funil.mjs";
import { pipelineDe, celulaDeLeads, celulasDeOrcamento } from "@/lib/okr.mjs";
import { dbOn, listLeads } from "@/lib/db";

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
  p: { slug: string; url: string; vendas?: { data: string }[] },
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
}> {
  // cliques — o GSC. Host de fornecedor (`*.vercel.app`) fica FORA de toda propriedade: isso NÃO
  // é "zero tráfego", é "não há onde olhar", e o conserto é domínio próprio, não SEO.
  const s = await gscSeries(p.url);
  const totals = s ? totals28(s.days, fim) : null;
  const cliques: Celula = totals ? apurado(totals.current.clicks) : naoApurado(`sem propriedade no GSC para ${p.url}`);
  // impressões — a MESMA série que dá cliques, sem chamada nova (FR-036, US3 disponiveisN5).
  const impressoes: Celula = totals ? apurado(totals.current.impressions) : naoApurado(`sem propriedade no GSC para ${p.url}`);

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
      ? (propria.orcamentos.rows as { criado: string; status: string }[])
      : null;
  const { enviados: orcamentos, aceitos: orcamentosAceitos } = celulasDeOrcamento(linhasOrc, { inicio, fim });

  // vendas — AUSENTE é "não olhei", `[]` é "olhei, zero". A distinção inteira do template.
  const vendas: Celula = Array.isArray(p.vendas)
    ? apurado(p.vendas.filter((v) => v?.data && v.data >= inicio && v.data <= fim).length)
    : naoApurado("sem régua de dinheiro (campo `vendas` ausente no card)");

  return { cliques, leads: leadsCel, vendas, impressoes, orcamentos, orcamentosAceitos };
}

export { ehApurado };
