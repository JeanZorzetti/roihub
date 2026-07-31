import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";

// join(dirname(...)) e não new URL("../data/…", import.meta.url): o Turbopack lê o segundo como
// referência estática a asset, tenta resolver a pasta no bundle e a aba /busca quebra em
// "Module not found" — que é erro de build, não de caminho.
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROTOCOLOS = join(RAIZ, "data", "protocolos");
const HANDOFF = join(RAIZ, "handoff");

// As 124 memórias não moram no repo (vivem em ~/.claude/…/memory) e não existem na imagem
// Docker. Elas são 72 das 160 fontes do dourado: sem elas a avaliação mede meio corpus, então
// quem carrega precisa saber se vieram — daí o dir ser explícito em vez de escondido.
export const MEMORIA_PADRAO =
  process.env.MEMORIA_DIR ??
  join(homedir(), ".claude", "projects", "c--Users-jeanz-OneDrive-Desktop-ROI-Labs", "memory");

// O id de cada doc é o mesmo vocabulário das `fontes` do dourado (SEO-04,
// handoff-atma-reindexado.md, site_200_is_not_indexed_url_inspection). Divergir aqui zera o
// recall sem erro nenhum aparecer.
function textoProtocolo(p) {
  return [p.id, p.area, p.titulo, p.norma, p.motivo, p.verificacao?.como, ...(p.excecoes ?? []), ...(p.origem ?? [])]
    .filter(Boolean)
    .join("\n");
}

export function carregarCorpus({ memoriaDir = MEMORIA_PADRAO } = {}) {
  const docs = [];

  for (const f of readdirSync(PROTOCOLOS).filter((f) => f.endsWith(".json"))) {
    const p = JSON.parse(readFileSync(join(PROTOCOLOS, f), "utf8"));
    // Camada 0: devolver fato revogado é pior que não devolver nada.
    if (p.valid_to) continue;
    docs.push({ id: basename(f, ".json"), tipo: "protocolo", titulo: p.titulo, texto: textoProtocolo(p) });
  }

  for (const f of readdirSync(HANDOFF).filter((f) => f.endsWith(".md"))) {
    docs.push({ id: f, tipo: "handoff", titulo: f, texto: readFileSync(join(HANDOFF, f), "utf8") });
  }

  if (existsSync(memoriaDir)) {
    // MEMORY.md é o índice de uma linha por memória: casa com quase toda pergunta e não
    // responde nenhuma. Indexá-lo é fabricar um falso positivo no topo.
    for (const f of readdirSync(memoriaDir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md")) {
      const id = basename(f, ".md");
      const texto = readFileSync(join(memoriaDir, f), "utf8");
      // O `description` do frontmatter é a única frase da memória escrita para ser lida sozinha;
      // sem ele o título do resultado é o slug, que não diz nada a quem não escreveu a memória.
      const desc = texto.match(/^description:\s*"?(.+?)"?\s*$/m)?.[1];
      docs.push({ id, tipo: "memoria", titulo: desc ?? id, texto });
    }
  }

  return docs;
}
