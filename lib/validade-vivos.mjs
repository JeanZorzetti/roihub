// Quais arquivos são "documento vivo". Separado de `validade.mjs` porque a lógica pura é testável
// com fixture e esta parte lê disco: o teste do `npm test` roda só os vivos do REPO (protocolos e
// cards), e o script de linha de comando soma as memórias, que moram em ~/.claude e não existem na
// imagem Docker. Um check que falhasse por falta das memórias sairia da lista do npm test na
// primeira sexta-feira.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MEMORIA_PADRAO } from "./corpus.mjs";

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

export function vivosDoRepo(raiz = RAIZ) {
  const arquivos = [];
  const prot = join(raiz, "data", "protocolos");
  for (const f of readdirSync(prot).filter((n) => n.endsWith(".json"))) {
    const texto = readFileSync(join(prot, f), "utf8");
    // Protocolo revogado não é documento vivo: ele registra o que valia, como um handoff.
    if (JSON.parse(texto).valid_to) continue;
    arquivos.push({ rel: `data/protocolos/${f}`, texto });
  }
  arquivos.push({ rel: "data/projects.json", texto: readFileSync(join(raiz, "data", "projects.json"), "utf8") });
  return arquivos;
}

export function vivosDaMemoria(dir = MEMORIA_PADRAO) {
  if (!existsSync(dir)) return [];
  // MEMORY.md entra: é índice, mas é prosa viva e carrega placar ("36 ativos, 34 com site").
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ rel: `memoria/${f}`, texto: readFileSync(join(dir, f), "utf8") }));
}
