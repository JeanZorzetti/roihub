import { Pool } from "pg";
import { gscSeries, gscPaginas, type GscPaginas } from "@/lib/gsc";
import { totals28 } from "@/lib/series.mjs";
import { apurado, naoApurado, ehApurado } from "@/lib/funil.mjs";
import { pipelineDe, celulaDeLeads, celulasDeOrcamento, celulaDeContato, celulaDeResposta, ticketDeOrcamentos, motivosDoFunil } from "@/lib/okr.mjs";
import { dbOn, listLeads } from "@/lib/db";
import { ga4Canais, ga4Eventos, type LeituraGa4, type EventosGa4 } from "@/lib/ga4";
import { descoberta, comportamento, conversao, hoje } from "@/lib/janelas.mjs";

// A coleta das três células da 009 (cliques, leads, vendas), extraída de app/okr/page.tsx sem
// mudar comportamento (011, decisão D5): "se aparecer uma segunda [entrada], isto vira `lib/`" —
// e apareceu a segunda tela (a ficha de /okr/<slug>). Um import só para as duas rotas, senão elas
// divergem na primeira fonte própria nova e a ficha passa a exibir um número que a `/okr` não
// exibe — o defeito que a SC-001 mede. `.ts` porque toca `pg` e `google-auth-library`; não
// contém regra nenhuma (a regra — montarFicha, projetar, posicaoDeAtaque — fica na página).

type Celula = { valor: number } | { naoApurado: string };
// Mesma convenção de `Celula` acima: tipo local em vez de importado do JSDoc de lib/janelas.mjs —
// o `.ts` não atravessa a fronteira de tipos do `.mjs` (Princípio III).
type Janela = { nome: string; inicio: string; fim: string; porque: string };

// A palitagem — POR QUE o lead não avançou, quando a fonte própria grava um motivo por lead (hoje
// só a Atma). `null` = fonte própria não devolve `motivo` (nada a mostrar); `motivos: []` = fonte
// devolve o campo e nenhum lead real da janela tinha motivo — as duas coisas são estados
// diferentes, mesma regra de sempre para não confundir "não apurado" com "zero real".
type MotivosDoFunil = { motivos: { motivo: string; n: number }[]; semMotivo: number; total: number };

// Derivadas de lib/janelas.mjs (018, FR-001): a R7 ("uma janela só para a árvore inteira") foi
// substituída pela 018 — cada cadeia lê a janela que a fonte tem (FR-007/FR-008). GSC e GA4
// continuam em DESCOBERTA/COMPORTAMENTO (28d/D-3, inalteradas nesta spec); INICIO/FIM aqui
// continuam sendo essa mesma janela, para nenhum call site mudar de forma — só `coletarDoProjeto()`
// (T013) passa a escolher CONVERSAO para `patient_leads`/`orcamentos`.
export const FIM = descoberta().fim;
export const INICIO = descoberta().inicio;
// ⚠️ `hoje` NÃO é `FIM`: o prazo da meta é compromisso de calendário, e o atraso de 3 dias do GSC
// é defeito da fonte, não do calendário (D3).
export const HOJE = hoje();

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
    // `status` e `motivo` entraram em 05/09/2026 (spec 017): as duas colunas sempre existiram, a
    // query nunca tinha pedido os campos. `status` dá o degrau `contatado` sem coletor novo;
    // `motivo` dá o "por quê" que o funil sozinho não responde. Ambas em lib/okr.mjs
    // (`celulaDeContato()`, `motivosDoFunil()`).
    sql: `SELECT nome, email, status, motivo, to_char(created_at, 'YYYY-MM-DD') AS criado FROM patient_leads ORDER BY created_at`,
    // Mesma conexão, segunda query: o degrau que a cadeia nova mede. A Atma deixou de prometer
    // "achamos um doutor perto de você" (saída do sócio comercial) e passou a competir em PREÇO —
    // o orçamento é o degrau real, e ele JÁ estava gravado enquanto a ficha dizia "sem coletor".
    orcamentos: {
      tabela: "orcamentos",
      // `preco`/`desconto_vista` (018, FR-020) sempre existiram — a query nunca tinha pedido as
      // colunas. Mesma conexão, mesma query, zero chamada de rede nova.
      sql: `SELECT to_char(criado_em, 'YYYY-MM-DD') AS criado, status, paciente_lead_id, preco, desconto_vista FROM orcamentos ORDER BY criado_em`,
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
 * As três células de UM projeto, cada fonte na janela QUE ELA TEM (018, FR-007/FR-008): GSC em
 * DESCOBERTA, GA4 em COMPORTAMENTO (as duas 28d/D-3, inalteradas), `patient_leads`/`orcamentos` em
 * CONVERSAO (`epoca → hoje` quando o card declara `epoca`; senão a mesma 28d/D-3 de sempre —
 * FR-006, SC-007). Quem monta a cadeia é `montarFicha()` (009), chamada pela página; esta função só
 * coleta e devolve as três janelas junto, para a tela colar cada uma no número que ela produziu.
 */
export async function coletarDoProjeto(
  p: { slug: string; url: string; vendas?: { data: string }[]; ga4?: { propertyId: string }; epoca?: { data: string; porque: string } },
  {
    porPipeline,
    erroLeads,
    agora = Date.now(),
  }: { porPipeline: Map<string, Awaited<ReturnType<typeof listLeads>>>; erroLeads: string | null; agora?: number },
): Promise<{
  cliques: Celula;
  leads: Celula;
  contatados: Celula;
  respondeu: Celula;
  ticket: Celula;
  vendas: Celula;
  impressoes: Celula;
  orcamentos: Celula;
  motivos: MotivosDoFunil | null;
  ga4: LeituraGa4;
  ga4ev: EventosGa4;
  orcamentosSemLead: { valor: number } | null;
  paginas: GscPaginas;
  janelas: { descoberta: Janela; comportamento: Janela; conversao: Janela };
}> {
  const janelaDescoberta = descoberta(agora);
  const janelaComportamento = comportamento(agora);
  const janelaConversao = conversao(agora, p.epoca ?? null);

  // cliques — o GSC, na janela de DESCOBERTA. Host de fornecedor (`*.vercel.app`) fica FORA de
  // toda propriedade: isso NÃO é "zero tráfego", é "não há onde olhar", e o conserto é domínio
  // próprio, não SEO. GA4 (013) entra no MESMO Promise.all, na janela de COMPORTAMENTO — duas
  // fontes independentes, sem somar latência. GA4 entra DUAS vezes (canais para N4, eventos para
  // os medidores D3 do N5) — duas queries independentes da mesma propriedade, sem somar latência e
  // sem que a falha de uma alcance a outra. `gscPaginas` (016) entra no MESMO Promise.all, mesma
  // janela do GSC: é a segunda query da mesma propriedade, para a camada de entrega, e falha dela
  // não pode alcançar as outras três.
  const [s, ga4, ga4ev, paginas] = await Promise.all([
    gscSeries(p.url),
    ga4Canais(p.ga4?.propertyId, { inicio: janelaComportamento.inicio, fim: janelaComportamento.fim }),
    ga4Eventos(p.ga4?.propertyId, { inicio: janelaComportamento.inicio, fim: janelaComportamento.fim }),
    gscPaginas(p.url, { inicio: janelaDescoberta.inicio, fim: janelaDescoberta.fim }),
  ]);
  const totals = s && "days" in s ? totals28(s.days, janelaDescoberta.fim) : null;
  // `s` distingue fato real (`null`) de falha transitória (`{erro}`) — achado 1 do design-review
  // de 03/09: colapsar os dois fazia "sem propriedade" mentir quando era só timeout, e o veredito
  // (que lê esta frase pra classificar D1 vs D4 em okr.mjs) mudava sozinho a cada release.
  const motivoGsc = s && "erro" in s ? `falhou agora — GSC indisponível (${s.erro})` : `sem propriedade no GSC para ${p.url}`;
  // 018/FR-028: segundo ponto revisado — `gscSeries` com `{erro}` é falha transitória; "sem
  // propriedade" é ausência estrutural (D1) e fica SEM rótulo, de propósito.
  const rotuloGsc = s && "erro" in s ? "falhou-agora" : undefined;
  const cliques: Celula = totals ? apurado(totals.current.clicks) : naoApurado(motivoGsc, rotuloGsc);
  // impressões — a MESMA série que dá cliques, sem chamada nova (FR-036, US3 disponiveisN5).
  const impressoes: Celula = totals ? apurado(totals.current.impressions) : naoApurado(motivoGsc, rotuloGsc);

  // leads — fonte própria primeiro (R4), CRM do hub depois, na janela de CONVERSAO. `contatados`
  // só apura quando a fonte própria devolve `status` na mesma linha do lead (hoje só a Atma) — os
  // outros projetos com perfil D ficam com este texto até declararem a própria fonte, nunca com
  // "coletor não rodou" (o campo é sempre devolvido; ver `celulaDeContato()` em lib/okr.mjs).
  let leadsCel: Celula;
  let contatadosCel: Celula = naoApurado("sem fonte própria declarada para este projeto — `contatado` depende da coluna `status`");
  // `respondeu` (018) vem da MESMA linha de `patient_leads` — nenhuma chamada de rede nova.
  let respondeuCel: Celula = naoApurado("sem fonte própria declarada para este projeto — `respondeu` depende da coluna `motivo`");
  // `motivos` fica `null` (não `[]`) até a fonte própria confirmar que o campo existe — `[]` já
  // significa "consultei e ninguém tinha motivo", e os dois não podem nascer iguais.
  let motivosCel: MotivosDoFunil | null = null;
  const propria = await lerFontePropria(p.slug);
  if (propria && "erro" in propria) {
    // 018/FR-028: um dos três pontos revisados que ganham `falhou-agora` — erro de CONEXÃO em
    // `lerFontePropria()`, transitório por definição (o banco volta, o buraco não é permanente).
    leadsCel = naoApurado(`fonte própria indisponível (${propria.erro})`, "falhou-agora");
    contatadosCel = naoApurado(`fonte própria indisponível (${propria.erro})`, "falhou-agora");
    respondeuCel = naoApurado(`fonte própria indisponível (${propria.erro})`, "falhou-agora");
  } else if (propria) {
    const { celula, reais } = celulaDeLeads(propria.rows, { inicio: janelaConversao.inicio, fim: janelaConversao.fim, onde: `tabela \`${propria.tabela}\` do próprio projeto`, propria: true });
    leadsCel = celula;
    contatadosCel = celulaDeContato(reais as { status?: string }[]);
    respondeuCel = celulaDeResposta(reais as { motivo?: string | null }[]);
    motivosCel = motivosDoFunil(reais as { motivo?: string | null }[]);
  } else if (erroLeads) {
    leadsCel = naoApurado(`banco indisponível (${erroLeads})`);
  } else {
    leadsCel = celulaDeLeads(porPipeline.get(pipelineDe(p.slug)) ?? null, { inicio: janelaConversao.inicio, fim: janelaConversao.fim, onde: `pipeline \`${pipelineDe(p.slug)}\`` }).celula;
  }

  // orçamentos — o degrau do meio que sobrou da cadeia D depois que `aceito` saiu (017), na janela
  // de CONVERSAO. Projeto sem fonte de orçamento não recebe `0`: recebe o `não apurado` que
  // `celulasDeOrcamento(null)` devolve, senão todo perfil D sem a tabela passaria a exibir uma
  // cadeia zerada que ninguém mediu.
  const linhasOrc =
    propria && !("erro" in propria) && propria.orcamentos && !("erro" in propria.orcamentos)
      ? (propria.orcamentos.rows as { criado: string; status: string; paciente_lead_id: string | null; preco?: number | null; desconto_vista?: number | null }[])
      : null;
  const { enviados: orcamentos } = celulasDeOrcamento(linhasOrc, { inicio: janelaConversao.inicio, fim: janelaConversao.fim });
  // ticket (018, FR-020/FR-021) — mesma conexão, mesma query, zero chamada de rede nova. Só a
  // borda tem acesso às linhas cruas; `resolverTicket()` (lib/ficha.mjs) decide depois se ele
  // vence o declarado.
  const ticket = ticketDeOrcamentos(linhasOrc, { inicio: janelaConversao.inicio, fim: janelaConversao.fim });

  // orçamentoSemLead (013, US3) — o vestígio do WhatsApp: a coluna paciente_lead_id JÁ vem no
  // SELECT acima e era descartada. `null` quando não há fonte de orçamento; nunca vira `0`.
  const orcamentosSemLead = linhasOrc
    ? { valor: linhasOrc.filter((o) => o.criado >= janelaConversao.inicio && o.criado <= janelaConversao.fim && o.paciente_lead_id == null).length }
    : null;

  // vendas — AUSENTE é "não olhei", `[]` é "olhei, zero". A distinção inteira do template. Continua
  // na janela de DESCOBERTA (research D2): esta spec não move o `vendas` do card de lugar nenhum.
  const vendas: Celula = Array.isArray(p.vendas)
    ? apurado(p.vendas.filter((v) => v?.data && v.data >= janelaDescoberta.inicio && v.data <= janelaDescoberta.fim).length)
    : naoApurado("sem régua de dinheiro (campo `vendas` ausente no card)");

  return {
    cliques,
    leads: leadsCel,
    contatados: contatadosCel,
    respondeu: respondeuCel,
    ticket,
    vendas,
    impressoes,
    orcamentos,
    motivos: motivosCel,
    ga4,
    ga4ev,
    orcamentosSemLead,
    paginas,
    janelas: { descoberta: janelaDescoberta, comportamento: janelaComportamento, conversao: janelaConversao },
  };
}

export { ehApurado };
