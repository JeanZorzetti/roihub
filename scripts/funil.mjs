// O funil de cada projeto, e onde ele MORRE. `lib/funil.mjs` é a lógica; aqui é a coleta e a
// impressão, mesmo par de `conformidade.mjs` e `gateways.mjs`.
//
//   node --env-file=.env scripts/funil.mjs          # os 35
//   node --env-file=.env scripts/funil.mjs --ver    # com o motivo de cada `não apurado`
//
// Zero LLM e zero pool. Três fontes, todas já existentes:
//   cliques → Search Console, janela de 28d fechando em D-3 (a mesma do `lib/gsc.ts`)
//   leads   → `crm_leads` no Postgres, agrupado por pipeline
//   vendas  → campo `vendas` de `data/projects.json`, escrito por `vendas-mercadopago.mjs`
//
// FORA do `npm test` pelo mesmo motivo dos irmãos: teste não bate em produção nem no GSC.
//
// ⚠️ A PRIMEIRA CORRIDA DE UM CHECK NOVO MEDE O CHECK (VER-08). A saída é LISTA NOMINAL de
// propósito — leia as linhas antes de acreditar em qualquer contagem do rodapé.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { consultarGsc, diasAtras } from "../lib/gsc-consulta.mjs";
import { apurado, naoApurado, ehApurado, montarLinha, resumir, mostrar, pct } from "../lib/funil.mjs";

const ver = process.argv.includes("--ver");
const ler = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8"));
const projetos = ler("../data/projects.json");
const pipelines = ler("../data/pipelines.json");

const INICIO = diasAtras(31);
const FIM = diasAtras(3);

// A pipeline do CRM cujo slug NÃO é o slug do projeto. Mapa explícito de uma entrada em vez de
// casar por prefixo: prefixo erraria calado, e atribuir lead ao projeto errado é leitura de
// dinheiro. Pipeline nova com nome divergente entra aqui à mão, de propósito.
const PIPELINE_DO_PROJETO = { polarisia: "polaris" };
const pipelineDe = (slug) => PIPELINE_DO_PROJETO[slug] ?? slug;
const temPipeline = new Set(pipelines.map((p) => p.slug));

// ── leads ────────────────────────────────────────────────────────────────────────────────────
// Uma consulta só, com as DUAS contagens: a da janela e a histórica. A histórica não é enfeite —
// é ela que decide se o 0 da janela pode ser publicado (ver `celulaLeads`).
async function lerLeads() {
  if (!process.env.DATABASE_URL) return { erro: "DATABASE_URL ausente" };
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    const { rows } = await pool.query(
      `SELECT pipeline,
              count(*)                                                        AS total,
              count(*) FILTER (WHERE criado::date BETWEEN $1 AND $2)          AS janela
         FROM crm_leads GROUP BY pipeline`,
      [INICIO, FIM],
    );
    return { porPipeline: new Map(rows.map((r) => [r.pipeline, { total: +r.total, janela: +r.janela }])) };
  } catch (e) {
    // Falha FECHADA: banco fora NÃO pode virar "0 leads em todo mundo", que é o melhor placar
    // possível produzido pelo pior estado possível.
    return { erro: e?.code ?? e?.message?.slice(0, 80) ?? "erro" };
  } finally {
    await pool.end();
  }
}

function celulaLeads(slug, leads) {
  if (leads.erro) return naoApurado(`banco indisponível (${leads.erro})`);
  const pipe = pipelineDe(slug);
  if (!temPipeline.has(pipe)) return naoApurado("sem pipeline no CRM");
  const l = leads.porPipeline.get(pipe);
  // 🚩 ZERO LEAD NA HISTÓRIA INTEIRA NÃO É ZERO — é a pergunta sem resposta. Pipeline cadastrada
  // e nenhum lead jamais recebido não separa "o site não manda evento" de "manda e ninguém
  // converteu". As duas hipóteses dão o mesmo 0 e pedem trabalho oposto (encanamento × oferta).
  if (!l || l.total === 0) return naoApurado("pipeline existe e nunca recebeu lead — não separa 'sem instrumentação' de 'instrumentado e zero'");
  return apurado(l.janela);
}

// ── vendas ───────────────────────────────────────────────────────────────────────────────────
// A distinção já existe no card e é a mesma deste script inteiro (`lib/dourado-estado.mjs`):
// `vendas` AUSENTE é "não olhei", `vendas: []` é "olhei, zero".
function celulaVendas(p) {
  if (!Array.isArray(p.vendas)) return naoApurado("sem régua de dinheiro (campo `vendas` ausente no card)");
  const naJanela = p.vendas.filter((v) => v?.data && v.data >= INICIO && v.data <= FIM);
  return apurado(naJanela.length);
}

// ── cliques ──────────────────────────────────────────────────────────────────────────────────
// `dimensions: []` devolve o TOTAL do site. Com a dimensão `query` o GSC omite as raras e o total
// vira piso — já medido nesta casa (5 contra 33 no tapepro).
async function celulaCliques(p) {
  let host;
  try {
    host = new URL(p.url).hostname;
  } catch {
    return naoApurado(`url inválida no card: ${p.url}`);
  }
  try {
    const linhas = await consultarGsc(host, []);
    return apurado(linhas[0]?.clicks ?? 0);
  } catch (e) {
    const msg = String(e?.message ?? e);
    // Host de fornecedor (`*.vercel.app`) fica FORA de toda propriedade sua. Isso NÃO é "zero
    // tráfego" — é "não há onde olhar", e o conserto é domínio próprio, não SEO.
    if (/sem propriedade/i.test(msg)) return naoApurado(`sem propriedade no GSC para ${host}`);
    return naoApurado(`GSC falhou: ${msg.slice(0, 70)}`);
  }
}

// ── corrida ──────────────────────────────────────────────────────────────────────────────────
console.log(`funil de ${projetos.length} projetos · janela ${INICIO} → ${FIM} (28d fechando em D-3)`);
console.log("fontes: GSC (cliques) · crm_leads (leads) · campo `vendas` do card (vendas) · zero LLM\n");

const leads = await lerLeads();
if (leads.erro) console.log(`⚠️ coluna LEADS caiu inteira: ${leads.erro} — nenhuma linha vira 0 por isso\n`);

const linhas = [];
for (const p of projetos) {
  linhas.push(
    montarLinha({
      slug: p.slug,
      cliques: await celulaCliques(p),
      leads: celulaLeads(p.slug, leads),
      vendas: celulaVendas(p),
    }),
  );
}

const col = (c, l) => mostrar(c).padStart(l);
console.log(`${"projeto".padEnd(22)}${"cliques".padStart(12)}${"leads".padStart(14)}${"vendas".padStart(14)}   clique→lead`);
console.log("─".repeat(88));
for (const l of [...linhas].sort((a, b) => b.profundidade - a.profundidade || a.slug.localeCompare(b.slug))) {
  // A FRAÇÃO sai SEMPRE colada no percentual. `6,67%` de 2 leads em 30 cliques é o mesmo número
  // que 667 em 10.000 e não é a mesma informação — e "6,67%" sozinho cai na faixa de ELITE da
  // tabela de benchmarks da pesquisa, o que é ruído de amostra, não performance. Aviso ao lado
  // perde para percentual; denominador dentro do texto, não.
  const taxa = ehApurado(l.crCliqueLead)
    ? `${pct(l.crCliqueLead.valor)} (${l.leads.valor}/${l.cliques.valor})`
    : "—";
  console.log(`${l.slug.padEnd(22)}${col(l.cliques, 12)}${col(l.leads, 14)}${col(l.vendas, 14)}   ${taxa}`);
  if (ver)
    for (const d of ["cliques", "leads", "vendas"])
      if (!ehApurado(l[d])) console.log(`${"".padEnd(22)}   · ${d}: ${l[d].naoApurado}`);
}

const r = resumir(linhas);
console.log(`\n── onde o funil MORRE (soma = ${r.total}, não é acumulado)`);
const rotulos = ["nem cliques", "para nos cliques", "para nos leads", "mensurável até vendas"];
r.porDegrau.forEach((n, i) => console.log(`   ${String(n).padStart(3)}  ${rotulos[i]}`));

console.log(`\n${r.completos.length} projeto(s) com funil mensurável de ponta a ponta: ${r.completos.join(", ") || "NENHUM"}`);
console.log(`${r.comTaxa.length} com taxa clique→lead apurada: ${r.comTaxa.join(", ") || "NENHUM"}`);
console.log("\nLISTA NOMINAL, não percentual: esta é a primeira corrida deste check, e a primeira");
console.log("corrida mede o CHECK. Conferir as linhas antes de citar qualquer contagem acima.");
console.log("");
console.log("⚠️ O QUE ISTO NÃO VÊ:");
console.log("   · `não apurado` NUNCA significa zero. Significa que não há de onde ler — e para");
console.log("     cada coluna o conserto é diferente: propriedade no GSC, evento de lead no CRM,");
console.log("     régua de dinheiro no gateway.");
console.log("   · Cliques ≠ sessões. O GSC conta clique na SERP; quem sai antes de carregar não");
console.log("     vira sessão. A taxa clique→lead é um PISO da conversão, nunca a conversão.");
console.log("   · Lead que chega por outro canal (indicação, WhatsApp, tráfego direto) entra no");
console.log("     numerador e não no denominador. Por isso numerador > denominador vira `não");
console.log("     apurado` em vez de uma taxa acima de 100%.");
console.log("   · O Nível 0 da cascata — DEMANDA (volume de busca) — não está aqui. Projeto com");
console.log("     0 clique pode ser SEO ruim ou mercado que não busca, e a diferença decide tudo.");
