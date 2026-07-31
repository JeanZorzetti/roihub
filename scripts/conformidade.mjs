#!/usr/bin/env node
// Roda os 10 protocolos convertidos contra os 35 projetos de data/projects.json.
//
//   node --env-file=.env scripts/conformidade.mjs            # só as violações
//   node --env-file=.env scripts/conformidade.mjs --tudo     # inclui o que passou
//   node --env-file=.env scripts/conformidade.mjs --projeto atma
//   node --env-file=.env scripts/conformidade.mjs --check VER-02
//
// Sem chamada de LLM: é rede pura contra produção, não divide pool com o autopublishing.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CHECKS, rodarProjeto } from "../lib/conformidade.mjs";

const argv = process.argv.slice(2);
const flag = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i === -1 ? null : argv[i + 1];
};
const TUDO = argv.includes("--tudo");
const CONCORRENCIA = 6;

// A lista inteira segue disponível mesmo com --projeto: o VER-04 precisa dela para saber que um
// monorepo publica vários hosts.
const todos = JSON.parse(readFileSync(new URL("../data/projects.json", import.meta.url), "utf8")).filter((p) => p.url);
const projetos = todos.filter((p) => !flag("projeto") || p.slug === flag("projeto"));

const filtroCheck = flag("check");
if (filtroCheck) CHECKS.splice(0, CHECKS.length, ...CHECKS.filter((c) => c.id === filtroCheck));

const SIMBOLO = { true: "ok", false: "FALHA", null: "n/a" };

console.log(`${CHECKS.length} checks × ${projetos.length} projetos — ${CHECKS.map((c) => c.id).join(" ")}\n`);

const fila = [...projetos];
const resultados = [];
await Promise.all(
  Array.from({ length: CONCORRENCIA }, async () => {
    while (fila.length) {
      const p = fila.shift();
      const r = await rodarProjeto(p, todos);
      resultados.push(r);
      const falhas = r.linhas.filter((l) => l.ok === false);
      const mostrar = TUDO ? r.linhas : falhas;
      if (mostrar.length) {
        console.log(`${r.slug}  (${r.host} · ${r.stack.join("+")})`);
        for (const l of mostrar) console.log(`  ${SIMBOLO[l.ok]}  ${l.id}  ${l.detalhe ?? ""}`);
        console.log();
      }
    }
  })
);

// Norma que passa em todo mundo desde sempre é norma morta ou trivial; norma que falha em massa
// é um achado caro OU uma norma errada. O agregado por check é o que separa os três casos.
console.log("── por norma");
for (const check of CHECKS) {
  const linhas = resultados.flatMap((r) => r.linhas.filter((l) => l.id === check.id));
  const falha = linhas.filter((l) => l.ok === false).length;
  const passa = linhas.filter((l) => l.ok === true).length;
  const na = linhas.filter((l) => l.ok === null).length;
  console.log(`  ${check.id}  ${String(falha).padStart(2)} falham · ${String(passa).padStart(2)} passam · ${String(na).padStart(2)} n/a   ${check.resumo}`);
}

const totalFalhas = resultados.reduce((n, r) => n + r.linhas.filter((l) => l.ok === false).length, 0);
console.log(`\n${totalFalhas} violações em ${resultados.length} projetos.`);
