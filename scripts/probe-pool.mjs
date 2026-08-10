// Sonda o pool com 1 chamada por conta (~40 s) — a ferramenta barata que faltava.
//
// O portão do rerank (`scripts/avaliar.mjs --motor rerank`) custa 85 chamadas contra 3 contas que
// o autopublishing divide, e por duas noites ele foi o ÚNICO jeito de descobrir que o pool estava
// morto: as corridas saíram com 42/85 e 59/85 caídas na fusão, média de reranqueado com híbrido
// puro. 3 chamadas respondem a mesma pergunta antes de gastar as 85.
//
// E o pool NÃO se lê como bloco: "as 3 esgotadas" escondia que 429 recarrega esperando e 403
// (`subscription access disabled`) não. Se a conta 3 estiver morta de vez, somar conta ao pool
// deixa de ser expansão e vira REPOSIÇÃO — decidir sem isso é comprar antes de contar.
//
//   node --env-file=.env scripts/probe-pool.mjs [--gravar]
//
// `--gravar` acrescenta a leitura a `data/pool-sondagens.json`, que é o que DATA a conta: duas
// leituras a 9 h de distância não provam morte, e sem histórico a terceira também não provaria.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// `sondar` mudou para `lib/reranker.mjs` em 09/08: o coletor noturno é o segundo consumidor e o
// Next só importa de `lib/`. Este script voltou a ser só impressão, que é o padrão da casa.
import { sondar } from "../lib/reranker.mjs";

const HISTORICO = fileURLToPath(new URL("../data/pool-sondagens.json", import.meta.url));

// Com relógio, ao contrário do `apurado_em` do dourado: as duas primeiras sondagens são do mesmo
// ciclo de 9 h (02/08 22:12 → 03/08 07:46) e só a hora mostra o autopublishing das 00:13 no meio.
const agoraBRT = (agora = new Date()) =>
  new Date(agora.getTime() - 3 * 3600e3).toISOString().slice(0, 16).replace("T", " ");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tokens = String(process.env.CLAUDE_CODE_OAUTH_TOKENS ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (!tokens.length) {
    console.error("CLAUDE_CODE_OAUTH_TOKENS vazio — rode com `node --env-file=.env`.");
    process.exit(1);
  }

  const em = agoraBRT();
  const contas = await sondar(tokens);
  console.log(`sondagem ${em} BRT — ${tokens.length} contas\n`);
  contas.forEach((c, i) => {
    const detalhe = c.status ? ` (${c.status})` : c.erro ? ` (${c.erro})` : "";
    console.log(`conta ${i + 1}  ${c.estado}${detalhe}`);
  });

  const vivas = contas.filter((c) => c.estado === "viva").length;
  console.log(`\n${vivas} viva(s) de ${contas.length}.`);
  // 429 volta sozinho; 403 não. Sem essa linha o operador lê "0 vivas" e espera por nada.
  const mortas = contas.filter((c) => c.estado === "desabilitada").length;
  if (mortas) console.log(`⚠️ ${mortas} com subscription disabled (403) — 403 NÃO recarrega esperando.`);

  if (process.argv.includes("--gravar")) {
    const historico = JSON.parse(readFileSync(HISTORICO, "utf8"));
    historico.push({
      em,
      fonte: "sonda",
      contas: contas.map((c) => ({ estado: c.estado, status: c.status })),
    });
    writeFileSync(HISTORICO, `${JSON.stringify(historico, null, 2)}\n`);
    console.log(`\ngravado em data/pool-sondagens.json (${historico.length} sondagens).`);
  }
}
