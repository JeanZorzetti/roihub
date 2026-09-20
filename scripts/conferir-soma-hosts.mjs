// 029 — a testemunha independente da série: o que o Google responde por HOST, e a soma.
//
//   node --env-file=.env scripts/conferir-soma-hosts.mjs <slug> [inicio] [fim] [--pagina | --consulta]
//
// A corrida grava a soma dos hosts declarados. Conferir isso lendo a própria corrida seria o
// instrumento se auditando: este script pergunta ao Search Console de novo, por fora, e imprime
// host a host ao lado do total gravado. Foi ele que mediu o defeito que originou a 029 — em
// 18/09/2026, 15/09 valia 1.146 impressões no domínio anterior e 31 no novo, e o banco tinha 35
// gravados para 16/09.
//
// Zero LLM, uma requisição por host. `serie-gsc.mjs` responde a mesma pergunta para UM host solto;
// aqui a unidade é o PROJETO, que é a unidade em que a série é gravada.
//
// 030 — sem flag a dimensão é `date` (a série). `--pagina` confere a leitura da FICHA (`gscPaginas`,
// dimensão `page`) e `--consulta` a do bloco de consultas da aba de aquisição (`gscConsultas`,
// `query`+`page`). Compare SEMPRE na dimensão da tela: `query`+`page` devolve 42% do total do site
// na Atma (o Search Console omite as consultas raras), e cotejá-la com a dimensão `page` acusaria
// um buraco que é da API e não da soma. Neste modo NADA passa por `mesclarPorCaminho` — o total
// por host vem da resposta do Google e as chaves em comum saem de um Set, porque a testemunha não
// pode ser o código que ela confere.
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
import { melhorPropriedade, diasAtras } from "../lib/gsc-consulta.mjs";
import { somarSeriesPorHost, assinaturaDeHosts } from "../lib/serie-gsc.mjs";
import { hostsDeclarados } from "../lib/projects.mjs";
// 032 — a RÉGUA, e só ela. `ctrGap` e `mesclarPorCaminho` ficam de fora de propósito: a
// testemunha não pode ser o código que ela confere. A mescla por caminho e a conta do índice estão
// reescritas aqui embaixo; o piso por faixa de posição é o mesmo do board e divergir dele faria os
// dois números serem diferentes por um motivo que não é o medido.
import { benchmark } from "../lib/kpis-busca.mjs";

const args = process.argv.slice(2);
const dimensions = args.includes("--consulta") ? ["query", "page"] : args.includes("--pagina") ? ["page"] : ["date"];
const [slug, inicio = diasAtras(30), fim = diasAtras(0)] = args.filter((a) => !a.startsWith("--"));
if (!slug) throw new Error("uso: conferir-soma-hosts.mjs <slug> [inicio] [fim] [--pagina | --consulta]");

const projetos = JSON.parse(readFileSync(new URL("../data/projects.json", import.meta.url), "utf8"));
const p = (Array.isArray(projetos) ? projetos : Object.values(projetos).flat()).find((x) => x?.slug === slug);
if (!p) throw new Error(`projeto ${slug} não está em data/projects.json`);

const hosts = hostsDeclarados(p);
if (!hosts.length) throw new Error(`${slug} não declara host nenhum`);

const client = await new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
}).getClient();
const sites = await client.request({ url: "https://searchconsole.googleapis.com/webmasters/v3/sites" });
const verificadas = (sites.data.siteEntry ?? []).filter((s) => s.permissionLevel !== "siteUnverifiedUser");

const series = [];
const porHostPagina = [];
for (const host of hosts) {
  const prop = melhorPropriedade(host, verificadas);
  if (!prop) {
    console.log(`⚠️  ${host} · sem propriedade no GSC — a corrida trata como ENCERRADO e segue`);
    continue;
  }
  const res = await client.request({
    url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(prop)}/searchAnalytics/query`,
    method: "POST",
    data: {
      startDate: inicio,
      endDate: fim,
      // `date` sozinho: com `query` junto o GSC omite as raras e o total vira piso.
      dimensions,
      rowLimit: 25000,
      dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "contains", expression: `https://${host}/` }] }],
    },
  });
  console.log(`${host} · ${prop}`);
  if (dimensions[0] !== "date") {
    porHostPagina.push({ host, rows: res.data.rows ?? [] });
    continue;
  }
  series.push({
    host,
    days: (res.data.rows ?? []).map((r) => ({
      date: r.keys[0],
      impressions: r.impressions,
      clicks: r.clicks,
      position: r.position,
    })),
  });
}

if (dimensions[0] !== "date") {
  const chave = (keys) => {
    try {
      const u = new URL(keys.at(-1));
      return `${keys.length > 1 ? keys[0] : ""}\0${u.pathname}${u.search}`;
    } catch {
      return null;
    }
  };
  const soma = (rows, campo) => rows.reduce((t, r) => t + r[campo], 0);
  const num = (n) => n.toLocaleString("pt-BR");
  console.log(`\n${dimensions.join("+")} · ${inicio} → ${fim}`);
  console.log("host".padEnd(24), "linhas".padStart(8), "impressões".padStart(12), "cliques".padStart(9));
  for (const { host, rows } of porHostPagina) {
    console.log(host.padEnd(24), num(rows.length).padStart(8), num(soma(rows, "impressions")).padStart(12), num(soma(rows, "clicks")).padStart(9));
  }
  const todas = porHostPagina.flatMap((h) => h.rows);
  console.log("TOTAL".padEnd(24), num(todas.length).padStart(8), num(soma(todas, "impressions")).padStart(12), num(soma(todas, "clicks")).padStart(9));
  const conjuntos = porHostPagina.map((h) => new Set(h.rows.map((r) => chave(r.keys)).filter(Boolean)));
  const uniao = new Set(conjuntos.flatMap((c) => [...c]));
  const emComum = [...uniao].filter((k) => conjuntos.filter((c) => c.has(k)).length > 1).length;
  console.log(`\nchaves distintas (a linha que a tela deve mostrar): ${num(uniao.size)} · presentes em mais de um host: ${num(emComum)}`);
  console.log("Sem a mescla, cada chave em comum apareceria uma vez por host — é a diferença entre `linhas` e as chaves distintas.");
  // 032/C8 — em `--pagina`, a testemunha imprime também o que a aba publica como Índice de
  // Conformidade: a tabela por URL e a fração. Sem isso a SC-001 só era conferível pelo próprio
  // código que a calcula. A mescla abaixo repete a regra da borda de propósito, escrita de novo.
  if (dimensions.length === 1) {
    const porChave = new Map();
    for (const { rows } of porHostPagina) {
      for (const r of rows) {
        const k = chave(r.keys);
        if (!k) continue;
        const e = porChave.get(k) ?? { caminho: k.slice(1), cliques: 0, impressoes: 0, votos: [] };
        e.cliques += r.clicks ?? 0;
        e.impressoes += r.impressions ?? 0;
        // Linha sem impressão não vota: a posição dela não descreve exibição nenhuma.
        if (Number.isFinite(r.position) && (r.impressions ?? 0) > 0) e.votos.push([r.position, r.impressions]);
        porChave.set(k, e);
      }
    }
    const urls = [...porChave.values()]
      .map((e) => {
        const peso = e.votos.reduce((t, [, i]) => t + i, 0);
        // Voto único devolve a posição como o Google mandou: (3,9 × 1.146) ÷ 1.146 dá
        // 3,8999999999999995, e a faixa do balizador acaba em 10,9 — a deriva tira página do
        // denominador sem nada ter mudado.
        const posicao =
          e.votos.length === 1 ? e.votos[0][0] : peso > 0 ? e.votos.reduce((t, [p, i]) => t + p * i, 0) / peso : null;
        const ctr = e.impressoes > 0 ? e.cliques / e.impressoes : null;
        return { ...e, posicao, ctr, piso: posicao === null ? null : benchmark(posicao) };
      })
      .sort((a, b) => b.impressoes - a.impressoes);
    const pc = (v) => (v === null ? "—" : `${(v * 100).toFixed(2)}%`);
    console.log("\ncaminho".padEnd(52), "impr".padStart(8), "cliq".padStart(6), "posição".padStart(8), "CTR".padStart(8), "piso".padStart(7), " atinge");
    for (const u of urls) {
      const dentro = u.piso !== null && u.ctr !== null;
      console.log(
        u.caminho.slice(0, 50).padEnd(51),
        num(u.impressoes).padStart(8),
        num(u.cliques).padStart(6),
        (u.posicao === null ? "—" : u.posicao.toFixed(2)).padStart(8),
        pc(u.ctr).padStart(8),
        pc(u.piso).padStart(7),
        dentro ? (u.ctr >= u.piso ? " sim" : " não") : " fora da faixa",
      );
    }
    const avaliadas = urls.filter((u) => u.piso !== null && u.ctr !== null);
    const atingem = avaliadas.filter((u) => u.ctr >= u.piso);
    console.log(
      avaliadas.length
        ? `\nÍndice de Conformidade: ${((atingem.length / avaliadas.length) * 100).toFixed(2)}% · ${num(avaliadas.length)} avaliadas · ${num(atingem.length)} atingem · meta do board: 75% a 80%`
        : "\nÍndice de Conformidade: sem denominador — nenhuma URL na faixa do balizador. Não é 0%.",
    );
    console.log("Fora da faixa = posição acima de 10,9, onde o board não define piso: não entra no denominador e NÃO é reprovada.");
  }
  const truncou = porHostPagina.filter((h) => h.rows.length >= 25000).map((h) => h.host);
  if (truncou.length) console.log(`⚠️  bateu o teto de 25.000 linhas: ${truncou.join(", ")} — o total é piso`);
  process.exit(0);
}

const porHost = new Map(series.map((s) => [s.host, new Map(s.days.map((d) => [d.date, d]))]));
const soma = somarSeriesPorHost(series);

console.log(`\nassinatura esperada: ${assinaturaDeHosts(series.map((s) => s.host))}`);
console.log(`\ndia         ${series.map((s) => s.host.slice(0, 14).padStart(15)).join("")}            soma`);
for (const d of soma) {
  const colunas = series.map((s) => String(porHost.get(s.host).get(d.date)?.impressions ?? 0).padStart(15)).join("");
  console.log(d.date, colunas, String(d.impressions).padStart(15));
}

const total = soma.reduce((a, d) => a + d.impressions, 0);
// 031/SC-005: a célula `visitante` da ficha é de CLIQUES — sem esta soma o critério não é conferível
// à mão, e a testemunha só falaria de impressão.
const cliques = soma.reduce((a, d) => a + d.clicks, 0);
console.log(`\n${soma.length} dia(s) · ${total} impressões · ${cliques} cliques somados · ${inicio} → ${fim}`);
for (const s of series) {
  console.log(`  ${s.host.padEnd(24)} ${String(s.days.length).padStart(4)} dia(s) · ${s.days.reduce((a, d) => a + d.impressions, 0)} impressões · ${s.days.reduce((a, d) => a + d.clicks, 0)} cliques`);
}
console.log("Os ~3 últimos dias saem baixos porque o GSC não os fechou — não são queda.");
