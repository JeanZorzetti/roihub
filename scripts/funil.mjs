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
import { apurado, naoApurado, ehApurado, montarLinha, resumir, mostrar, pct, ehLeadDeTeste } from "../lib/funil.mjs";
import { pipelineDe } from "../lib/okr.mjs";

const ver = process.argv.includes("--ver");
const ler = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8"));
const projetos = ler("../data/projects.json");
const pipelines = ler("../data/pipelines.json");

const INICIO = diasAtras(31);
const FIM = diasAtras(3);

// O mapa de pipeline mudou de casa para `lib/okr.mjs` em 01/09: a `/okr` lê a MESMA pipeline que
// este script, e duas cópias divergiriam na primeira pipeline nova sem ninguém ver.
const temPipeline = new Set(pipelines.map((p) => p.slug));

// ── leads ────────────────────────────────────────────────────────────────────────────────────
// Duas fontes, e a distinção importa: o CRM do hub (`crm_leads`) e o banco DO PRÓPRIO PROJETO,
// para quem já capturava lead antes de o hub existir.
const zerado = () => ({ total: 0, janela: 0, teste: 0, reais: [] });

// Linha a linha em vez de `count()` no SQL por dois motivos: o filtro de lead de teste é lógica
// testada (`ehLeadDeTeste`, com teste em `test/funil.test.mjs`), e o `--ver` precisa listar os
// leads contados NOME A NOME. O volume é de dezenas — agrupar aqui sai mais barato que a segunda
// query que a contagem no banco exigiria.
function agrupar(rows, chaveDe) {
  const m = new Map();
  for (const r of rows) {
    const k = chaveDe(r);
    let e = m.get(k);
    if (!e) m.set(k, (e = zerado()));
    // 🚩 Lead nosso não é demanda. Sem esta linha, o critério de pronto deste subprojeto fecha
    // com um curl — foi o que aconteceu com o `polarisia 6,67% (2/30)`, dois testes do Jean.
    if (ehLeadDeTeste(r)) {
      e.teste++;
      continue;
    }
    e.total++;
    if (r.dia >= INICIO && r.dia <= FIM) {
      e.janela++;
      e.reais.push(r);
    }
  }
  return m;
}

async function comPool(url, fn) {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function lerLeads() {
  if (!process.env.DATABASE_URL) return { erro: "DATABASE_URL ausente" };
  try {
    const rows = await comPool(process.env.DATABASE_URL, async (pool) =>
      (
        await pool.query(
          `SELECT pipeline, nome, email, metadata, to_char(criado, 'YYYY-MM-DD') AS dia
             FROM crm_leads ORDER BY criado`,
        )
      ).rows,
    );
    return { porPipeline: agrupar(rows, (r) => r.pipeline) };
  } catch (e) {
    // Falha FECHADA: banco fora NÃO pode virar "0 leads em todo mundo", que é o melhor placar
    // possível produzido pelo pior estado possível.
    return { erro: e?.code ?? e?.message?.slice(0, 80) ?? "erro" };
  }
}

// Projeto que captura lead no PRÓPRIO banco. A Atma tem funil de paciente desde julho
// (`patient_leads`, com nome e e-mail de gente real): instrumentar o site para reenviar tudo ao
// CRM do hub criaria uma segunda cópia PIOR da tabela que já existe — sem o histórico, contando
// só de hoje em diante. O hub lê a fonte onde ela está.
//
// Uma entrada só, e explícita. `sirius` e `estetiacrm` NÃO entram aqui: os formulários dos dois
// (`/api/contact` e `/api/leads/capture-calculator`) só disparam e-mail e Resend, não gravam em
// lugar nenhum — lá não há o que ler, e o conserto é no site.
const FONTES_PROPRIAS = {
  atma: {
    env: "ATMA_DATABASE_URL",
    tabela: "patient_leads",
    sql: `SELECT nome, email, to_char(created_at, 'YYYY-MM-DD') AS dia
            FROM patient_leads ORDER BY created_at`,
  },
};

async function lerFontesProprias() {
  const out = new Map();
  for (const [slug, f] of Object.entries(FONTES_PROPRIAS)) {
    const url = process.env[f.env];
    if (!url) {
      out.set(slug, { erro: `${f.env} ausente` });
      continue;
    }
    try {
      const rows = await comPool(url, async (pool) => (await pool.query(f.sql)).rows);
      out.set(slug, { agregado: agrupar(rows, () => slug).get(slug) ?? zerado() });
    } catch (e) {
      out.set(slug, { erro: e?.code ?? String(e?.message ?? "erro").slice(0, 60) });
    }
  }
  return out;
}

// 🚩 ZERO LEAD NA HISTÓRIA INTEIRA NÃO É ZERO — é a pergunta sem resposta. Fonte ligada e nenhum
// lead jamais recebido não separa "o site não manda evento" de "manda e ninguém converteu". As
// duas hipóteses dão o mesmo 0 e pedem trabalho oposto (encanamento × oferta).
function contar(e, onde) {
  if (!e || e.total === 0)
    return naoApurado(
      e?.teste
        ? `${e.teste} lead(s) em ${onde}, TODOS de teste nosso — nenhum lead real jamais recebido`
        : `${onde} existe e nunca recebeu lead — não separa 'sem instrumentação' de 'instrumentado e zero'`,
    );
  return apurado(e.janela);
}

function celulaLeads(slug, leads, proprias) {
  const propria = proprias.get(slug);
  if (propria) {
    if (propria.erro) return naoApurado(`fonte própria indisponível (${propria.erro})`);
    return contar(propria.agregado, `tabela \`${FONTES_PROPRIAS[slug].tabela}\` do próprio projeto`);
  }
  if (leads.erro) return naoApurado(`banco indisponível (${leads.erro})`);
  const pipe = pipelineDe(slug);
  if (!temPipeline.has(pipe)) return naoApurado("sem pipeline no CRM");
  return contar(leads.porPipeline.get(pipe), `pipeline \`${pipe}\``);
}

/** Os leads REAIS contados na janela, por slug — o `--ver` lista nome a nome. */
function reaisDe(slug, leads, proprias) {
  const propria = proprias.get(slug);
  if (propria) return propria.agregado?.reais ?? [];
  return leads.porPipeline?.get(pipelineDe(slug))?.reais ?? [];
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

const proprias = await lerFontesProprias();

const linhas = [];
for (const p of projetos) {
  linhas.push(
    montarLinha({
      slug: p.slug,
      cliques: await celulaCliques(p),
      leads: celulaLeads(p.slug, leads, proprias),
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
  if (ver) {
    for (const d of ["cliques", "leads", "vendas"])
      if (!ehApurado(l[d])) console.log(`${"".padEnd(22)}   · ${d}: ${l[d].naoApurado}`);
    // LISTA NOMINAL do numerador. Percentual não se confere; nome e e-mail se conferem — e foi
    // exatamente a falta disto que deixou `6,67%` de dois testes passar por taxa do portfólio.
    const reais = reaisDe(l.slug, leads, proprias);
    for (const r of reais.slice(0, 5))
      console.log(`${"".padEnd(22)}   · lead: ${r.dia} ${String(r.nome).slice(0, 28)} <${r.email ?? "sem e-mail"}>`);
    if (reais.length > 5) console.log(`${"".padEnd(22)}   · … e mais ${reais.length - 5} lead(s) na janela`);
  }
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
