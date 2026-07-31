import { carregarCorpus } from "@/lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "@/lib/bm25.mjs";
import { Tabs } from "../tabs";

export const dynamic = "force-dynamic";

// A casca fina sobre lib/bm25.mjs — a memória institucional consultável (camada 7 do doc de
// arquitetura). Formulário GET, sem client component: a resposta cabe num render do servidor e
// a URL com ?q= fica compartilhável.

type Doc = { id: string; tipo: string; titulo: string; texto: string };
type Achado = { id: string; tipo: string; score: number };

// Índice em escopo de módulo: 259 docs custam ~150 ms para ler e tokenizar, e refazer isso a
// cada requisição seria desperdício puro — o corpus só muda em deploy.
let cache: { docs: Doc[]; indice: ReturnType<typeof indexar> } | null = null;
function getIndice() {
  if (!cache) {
    const docs = carregarCorpus() as Doc[];
    cache = { docs, indice: indexar(docs) };
  }
  return cache;
}

const ONDE: Record<string, (id: string) => string> = {
  protocolo: (id) => `data/protocolos/${id}.json`,
  handoff: (id) => `handoff/${id}`,
  memoria: (id) => `memória: ${id}.md`,
};

// Trecho em volta do primeiro termo da pergunta que aparece no doc: sem isso o resultado é só
// um id, e conferir a procedência exigiria abrir o arquivo — que é o custo que a aba existe
// para eliminar.
function trecho(texto: string, termos: string[]): string {
  const alvo = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let pos = -1;
  for (const t of termos) {
    const i = alvo.indexOf(t);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  const ini = Math.max(0, (pos === -1 ? 0 : pos) - 90);
  return (ini ? "…" : "") + texto.slice(ini, ini + 260).replace(/\s+/g, " ").trim() + "…";
}

export default async function Busca({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { docs, indice } = getIndice();
  const termos = tokenizar(q) as string[];
  const achados: Achado[] = q.trim() ? buscar(indice, q, 10) : [];
  const porId = new Map(docs.map((d) => [d.id, d]));
  const tipos = docs.reduce<Record<string, number>>((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});

  return (
    <main>
      <h1>ROI Hub</h1>
      <Tabs active="busca" />
      <p className="sub">
        Pergunta em português. O índice cobre {docs.length} documentos: protocolos, handoffs e memórias.
      </p>

      {/* .ag-add/.ag-in/.ag-btn são os controles que a aba Agenda já usa: campo novo com
          estilo próprio seria um segundo design system dentro do mesmo hub. */}
      <form className="ag-add" method="get">
        <input
          className="ag-in grow"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="por que o sitemap em 200 não prova indexação?"
          aria-label="Pergunta"
          autoFocus
        />
        <button className="ag-btn" type="submit">
          Buscar
        </button>
      </form>

      {q.trim() && achados.length === 0 && (
        <p className="foot">Nada casou. O BM25 casa palavra literal — tente o termo exato (slug, código de erro, nome do projeto).</p>
      )}

      <ol className="busca-res">
        {achados.map((r) => {
          const doc = porId.get(r.id)!;
          return (
            <li key={r.id}>
              <div className="busca-cab">
                <span className={`pill ${r.tipo === "protocolo" ? "pill-ok" : r.tipo === "handoff" ? "pill-warn" : ""}`}>{r.tipo}</span>
                <strong>{doc.titulo}</strong>
              </div>
              <p className="busca-trecho">{trecho(doc.texto, termos)}</p>
              {/* Procedência sempre visível: resposta que não dá para conferir é resposta que
                  o leitor vai re-derivar, e aí o índice não economizou nada. */}
              <p className="foot">{ONDE[r.tipo]?.(r.id) ?? r.id}</p>
            </li>
          );
        })}
      </ol>

      <p className="foot">
        BM25 · recall@10 medido em 82,3% contra as 78 perguntas de <code>data/dourado.json</code> (
        <code>node scripts/avaliar.mjs</code>).{" "}
        {!tipos.memoria && "⚠️ Sem as memórias neste ambiente: 72 das 160 fontes do dourado não estão no índice."}
      </p>
    </main>
  );
}
