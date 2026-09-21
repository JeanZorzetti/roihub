/**
 * Estima a demanda de cada termo do inventário congelado pelo que o próprio Search Console viu (050).
 *
 *   node --env-file=.env scripts/estimar-demanda.mjs atma
 *   node --env-file=.env scripts/estimar-demanda.mjs atma --gravar
 *
 * O GSC não informa volume de busca. Mas impressão só existe onde houve busca, então as impressões de
 * um termo numa janela são um PISO do volume dele. A estimativa é o maior piso entre janelas de 28 dias
 * que cobrem a janela do inventário. É um proxy gratuito, e não o volume do Google Ads: o denominador
 * fica abaixo do real, e a cobertura que sai dele (`coberturaDaDemanda`) é teto.
 *
 * A primeira versão só aceitava janelas em que o termo estivesse na 1ª página, supondo que ali impressão
 * ≈ volume. Os dados de 21/09/2026 derrubaram a hipótese: «invisalign» na posição 1,06 teve 6.934
 * impressões, e hoje, na posição 3,6, tem 24. A posição do GSC é a média só das buscas em que o site
 * apareceu, e o corte por página não aproxima nada. Por isso a estimativa aceita qualquer posição.
 *
 * SEM `--gravar` ele só imprime. Mesma regra do inventário: trocar o denominador de um KPI não pode ser
 * efeito colateral de rodar um script para olhar um número.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { consultarGsc } from "../lib/gsc-consulta.mjs";
import { lerInventario } from "../lib/inventario.mjs";

const ARQUIVO = new URL("../data/demanda-estimada.json", import.meta.url);
const DIAS = 28;

const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));
const gravar = process.argv.includes("--gravar");
if (!slug) {
  console.error("uso: node --env-file=.env scripts/estimar-demanda.mjs <slug> [--gravar]");
  process.exit(2);
}

const inventario = lerInventario(slug, JSON.parse(readFileSync(new URL("../data/inventario-de-termos.json", import.meta.url), "utf8")));
if (!inventario) throw new Error(`${slug} não tem inventário de termos: sem ele não há termo para estimar`);
const { janela, hosts } = inventario.procedencia;
if (!hosts?.length) throw new Error(`o inventário de ${slug} não declara hosts`);

// Janelas de 28 dias para trás a partir do fim do inventário, até cobrir o início dele. A última pode
// começar alguns dias antes do inventário; a procedência grava as datas exatas.
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);
const fimMs = Date.parse(`${janela.fim}T00:00:00Z`);
const n = Math.ceil((fimMs - Date.parse(`${janela.inicio}T00:00:00Z`)) / 864e5 / DIAS);
const janelas = Array.from({ length: n }, (_, i) => {
  const fim = fimMs - i * DIAS * 864e5;
  return { inicio: dia(fim - (DIAS - 1) * 864e5), fim: dia(fim) };
}).reverse();

const monitorados = new Set(inventario.termos);
const pico = Object.fromEntries(inventario.termos.map((t) => [t, 0]));
for (const j of janelas) {
  const porTermo = new Map();
  for (const host of hosts) {
    for (const l of await consultarGsc(host, ["query"], j)) {
      const t = l.keys?.[0];
      if (monitorados.has(t)) porTermo.set(t, (porTermo.get(t) ?? 0) + (l.impressions ?? 0));
    }
  }
  for (const [t, imp] of porTermo) pico[t] = Math.max(pico[t], imp);
  j.impressoes = [...porTermo.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${j.inicio} → ${j.fim}  ${String(porTermo.size).padStart(4)} termos  ${String(j.impressoes).padStart(7)} impressões`);
}

const total = Object.values(pico).reduce((a, b) => a + b, 0);
const zerados = Object.values(pico).filter((v) => v === 0).length;
console.log(`\n  ${inventario.total} termos · demanda estimada ${total} impressões por ${DIAS} dias${zerados ? ` · ${zerados} sem impressão em janela nenhuma` : ""}`);

const entrada = {
  procedencia: {
    congeladoEm: dia(Date.now()),
    inventarioCongeladoEm: inventario.procedencia.congeladoEm,
    hosts,
    dias: DIAS,
    janelas,
    regra: `maior número de impressões do termo numa janela de ${DIAS} dias, somados os hosts do inventário, em qualquer posição`,
  },
  termos: pico,
};

if (!gravar) {
  console.log("\n  (nada gravado — repita com --gravar para congelar em data/demanda-estimada.json)");
  process.exit(0);
}
let arquivo = {};
try {
  arquivo = JSON.parse(readFileSync(ARQUIVO, "utf8"));
} catch {
  console.log("  (arquivo não existia ou não parseou — criando do zero)");
}
arquivo[slug] = entrada;
writeFileSync(ARQUIVO, JSON.stringify(arquivo, null, 2) + "\n");
console.log(`\n  gravado em data/demanda-estimada.json`);
