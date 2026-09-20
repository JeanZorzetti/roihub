/**
 * Deriva o inventário de termos monitorados de um projeto a partir do que ele JÁ ranqueia (034).
 *
 *   node --env-file=.env scripts/derivar-inventario.mjs atma --piso 20 --meses 8
 *   node --env-file=.env scripts/derivar-inventario.mjs atma --piso 20 --meses 8 --gravar
 *
 * SEM `--gravar` ele só imprime. O inventário é CONGELADO (`lib/inventario.mjs`): sobrescrevê-lo é
 * trocar o denominador de um KPI, e isso não pode ser efeito colateral de rodar um script para
 * olhar um número. Medido na Atma em 20/09/2026: o mesmo inventário dá 49,0% de penetração em
 * março e 10,1% hoje — um denominador que se refaz sozinho apagaria essa queda.
 *
 * A DIMENSÃO É `query` SOZINHA e não `query`+`page`. A fórmula do board conta TERMO; uma leitura
 * por par (termo, página) devolve o mesmo termo três vezes quando ele ranqueia em três páginas, e
 * somar as linhas de volta é o `porUrl()` que a 032 deletou por medir com o instrumento errado.
 *
 * Os hosts vêm de `hostsDeclarados()`, que já inclui o `dominioAnterior` do card: a Atma migrou em
 * 11/09 e o domínio antigo ainda carrega 97% das impressões. Derivar só do novo daria 29 termos.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { hostsDeclarados } from "../lib/projects.mjs";
import { regexDeMarca } from "../lib/marca.mjs";
import { consultarGsc, diasAtras } from "../lib/gsc-consulta.mjs";
import { validarInventario } from "../lib/inventario.mjs";

const ARQUIVO = new URL("../data/inventario-de-termos.json", import.meta.url);

const argv = process.argv.slice(2);
const flag = (nome, padrao) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : padrao;
};
const slug = argv.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
const piso = flag("piso", 20);
const meses = flag("meses", 8);
const gravar = argv.includes("--gravar");

if (!slug) {
  console.error("uso: node --env-file=.env scripts/derivar-inventario.mjs <slug> [--piso 20] [--meses 8] [--gravar]");
  process.exit(2);
}

const projetos = JSON.parse(readFileSync(new URL("../data/projects.json", import.meta.url), "utf8"));
const projeto = (Array.isArray(projetos) ? projetos : projetos.projects).find((p) => p.slug === slug);
if (!projeto) throw new Error(`projeto ${slug} não está em data/projects.json`);

// Sem marca declarada não há como tirar a marca do inventário, e um inventário com a marca dentro
// mede outra coisa: na Atma são 21 termos e 9.823 impressões, quase todos no Top 3. A recusa é
// preferível ao inventário silenciosamente inflado.
const termosDeMarca = projeto.marca?.termos ?? [];
if (termosDeMarca.length === 0) {
  throw new Error(`${slug} não declara \`marca.termos\` no card — sem isso o inventário mede a própria marca`);
}
const reMarca = new RegExp(regexDeMarca(termosDeMarca), "i");

const hosts = hostsDeclarados(projeto);
if (hosts.length === 0) throw new Error(`${slug} não tem host declarado`);

const fim = diasAtras(3);
const inicio = new Date(new Date(fim).setMonth(new Date(fim).getMonth() - meses)).toISOString().slice(0, 10);
const janela = { inicio, fim };

console.log(`projeto ${slug} · hosts ${hosts.join(" + ")} · janela ${inicio} → ${fim} · piso ${piso}\n`);

// União por TERMO entre os hosts, posição ponderada por impressão. A ponderação é a mesma regra de
// `mesclarPorCaminho()`: média simples daria o mesmo peso a 1 e a 1.000 impressões.
const porTermo = new Map();
const propriedades = new Set();
for (const host of hosts) {
  const linhas = await consultarGsc(host, ["query"], janela);
  console.log(`  ${host.padEnd(24)} ${String(linhas.length).padStart(5)} termos`);
  for (const l of linhas) {
    const termo = l.keys?.[0];
    if (!termo) continue;
    const a = porTermo.get(termo) ?? { termo, impressoes: 0, cliques: 0, peso: 0, soma: 0 };
    a.impressoes += l.impressions ?? 0;
    a.cliques += l.clicks ?? 0;
    if (typeof l.position === "number" && (l.impressions ?? 0) > 0) {
      a.soma += l.position * l.impressions;
      a.peso += l.impressions;
    }
    porTermo.set(termo, a);
  }
  propriedades.add(host);
}

const todos = [...porTermo.values()];
const naoMarca = todos.filter((t) => !reMarca.test(t.termo));
const inventario = naoMarca.filter((t) => t.impressoes >= piso).sort((a, b) => b.impressoes - a.impressoes);

const noTop3 = inventario.filter((t) => t.peso > 0 && t.soma / t.peso <= 3).length;
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : "—");

console.log(`\n  ${todos.length} termos na janela`);
console.log(`  ${todos.length - naoMarca.length} de marca própria, excluídos`);
console.log(`  ${naoMarca.length - inventario.length} abaixo do piso de ${piso}, excluídos`);
console.log(`  → INVENTÁRIO: ${inventario.length} termos`);
console.log(`     retém ${pct(inventario.reduce((a, t) => a + t.impressoes, 0), naoMarca.reduce((a, t) => a + t.impressoes, 0))}% das impressões não-marca`);
// Este número é a penetração NA JANELA QUE DEFINIU o inventário, e não o estado do site: a posição
// de cada termo é a média dos 8 meses. Impresso como referência do corte, nunca como o KPI — o KPI
// é medido na janela de Descoberta, e na Atma a diferença é 26,6% contra 10,1%.
console.log(`     penetração nesta mesma janela (referência do corte, NÃO o KPI): ${pct(noTop3, inventario.length)}%`);

const entrada = {
  procedencia: {
    congeladoEm: new Date().toISOString().slice(0, 10),
    janela,
    piso,
    dimensao: "query",
    hosts,
    excluiMarca: termosDeMarca,
    porque: `termos com ao menos ${piso} impressões em ${meses} meses, somados os hosts declarados, sem a marca própria`,
  },
  termos: inventario.map((t) => t.termo),
};
validarInventario(slug, entrada);

if (!gravar) {
  console.log(`\n  (nada gravado — repita com --gravar para congelar em data/inventario-de-termos.json)`);
  process.exit(0);
}

let arquivo = {};
try {
  arquivo = JSON.parse(readFileSync(ARQUIVO, "utf8"));
} catch {
  // Primeira derivação: o arquivo ainda não existe. Qualquer outro erro de parse também cai aqui e
  // seria destrutivo — por isso o aviso explícito antes de sobrescrever.
  console.log("  (arquivo não existia ou não parseou — criando do zero)");
}
const antes = arquivo[slug]?.termos?.length;
arquivo[slug] = entrada;
writeFileSync(ARQUIVO, JSON.stringify(arquivo, null, 2) + "\n");
console.log(`\n  gravado: ${antes === undefined ? "novo" : `${antes} → ${entrada.termos.length}`} termos em data/inventario-de-termos.json`);
