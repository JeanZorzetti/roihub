import { carregarCorpus } from "@/lib/corpus.mjs";
import { indexar, buscar, tokenizar } from "@/lib/bm25.mjs";
import { buscarDenso, MODELO } from "@/lib/denso.mjs";
import { rerank, trechoRelevante } from "@/lib/reranker.mjs";
import { responder, trechosPara } from "@/lib/resposta.mjs";
import { lerCorpus, lerVetores } from "@/lib/corpus-db.mjs";
import { rrf } from "@/lib/busca.mjs";
import { Tabs } from "../tabs";

export const dynamic = "force-dynamic";

// A casca fina sobre lib/bm25.mjs — a memória institucional consultável (camada 7 do doc de
// arquitetura). Formulário GET, sem client component: a resposta cabe num render do servidor e
// a URL com ?q= fica compartilhável.

type Doc = { id: string; tipo: string; titulo: string; texto: string };
type Achado = { id: string; tipo: string; score: number };

// Índice em escopo de módulo: 259 docs custam ~150 ms para ler e tokenizar, e refazer isso a
// cada requisição seria desperdício puro — o corpus só muda em deploy ou em reindexação.
//
// União do disco com o banco, e não um ou outro: no dev o disco tem protocolos, handoffs E as
// memórias (que ficam em ~/.claude); no container só existem os dois primeiros, e as memórias
// vêm do hub_corpus. O disco ganha em caso de empate, porque é o que está mais fresco.
let cache: { docs: Doc[]; indice: ReturnType<typeof indexar> } | null = null;
async function getIndice() {
  if (!cache) {
    const docs = carregarCorpus() as Doc[];
    const noDisco = new Set(docs.map((d) => d.id));
    if (process.env.DATABASE_URL) {
      try {
        for (const d of (await lerCorpus()) as Doc[]) if (!noDisco.has(d.id)) docs.push(d);
      } catch {
        // Banco fora: a aba ainda responde com o que está no disco.
      }
    }
    cache = { docs, indice: indexar(docs) };
  }
  return cache;
}

// Vetores do corpus: leitura única (~4 MB), na primeira busca. Sem DATABASE_URL, sem vetores
// gravados ou sem OLLAMA_URL a aba cai para BM25 — 82,3% em vez de 83,0%, degrada em vez de
// quebrar. Só o `undefined` significa "ainda não tentei"; `null` é "tentei e não tem".
let vetores: { chunks: { id: string; tipo: string }[]; vetores: number[][] } | null | undefined;
// Degradar em silêncio é pior que degradar: "BM25" no rodapé não distingue env faltando de
// Ollama fora do ar, e sem isso o diagnóstico só sai por dentro do container.
let porQueSemVetor = "";
async function getVetores() {
  if (vetores === undefined) {
    vetores = null;
    if (!process.env.OLLAMA_URL) porQueSemVetor = "OLLAMA_URL não está no ambiente";
    else if (!process.env.DATABASE_URL) porQueSemVetor = "DATABASE_URL não está no ambiente";
    else
      try {
        const lidos = await lerVetores(MODELO);
        if (lidos.vetores.length) vetores = lidos;
        else porQueSemVetor = `hub_embeddings vazia para o modelo ${MODELO} — rode scripts/indexar.mjs`;
      } catch (err) {
        porQueSemVetor = `banco: ${(err as Error).message.slice(0, 90)}`;
      }
  }
  return vetores;
}

const ONDE: Record<string, (id: string) => string> = {
  protocolo: (id) => `data/protocolos/${id}.json`,
  handoff: (id) => `handoff/${id}`,
  memoria: (id) => `memória: ${id}.md`,
  projeto: (id) => `data/projects.json — card ${id}`,
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

// O reranker recebe 50 candidatos porque é onde o doc certo está: recall@50 do híbrido é 92,9%
// contra 82,4% em @10. Reordenar 10 não teria de onde tirar ganho.
const CANDIDATOS = 50;

export default async function Busca({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rerank?: string; resposta?: string }>;
}) {
  const { q = "", rerank: querRerank = "1", resposta: querResposta = "1" } = await searchParams;
  const { docs, indice } = await getIndice();
  const termos = tokenizar(q) as string[];
  const porId = new Map(docs.map((d) => [d.id, d]));

  let achados: Achado[] = q.trim() ? buscar(indice, q, CANDIDATOS) : [];
  let motor = "BM25";
  let falha = "";
  // Consultado mesmo sem pergunta: o rodapé precisa dizer o estado do motor no primeiro
  // carregamento, senão "BM25" antes da primeira busca é palpite, não diagnóstico.
  const denso = await getVetores();
  if (denso) motor = "BM25 + vetor";
  if (denso && q.trim()) {
    try {
      achados = rrf([buscar(indice, q, CANDIDATOS), await buscarDenso(denso, q, CANDIDATOS)], { k: CANDIDATOS });
    } catch (err) {
      // Ollama fora do ar não derruba a aba: cai para o BM25 e o rodapé diz o que falhou.
      motor = "BM25";
      falha = `ollama em ${process.env.OLLAMA_URL}: ${(err as Error).message.slice(0, 90)}`;
    }
  }
  // Vetor de doc que saiu do corpus (reindexação pendente) devolve id sem texto para renderizar.
  achados = achados.filter((r) => porId.has(r.id));

  // Reranker: +4,0 pontos em recall@10 sobre o híbrido da MESMA corrida (77,1% → 81,1%) e +1,1 em
  // @3, medido em 03/08 com 85 perguntas e 347 docs, zero `rerank-conta`. O +5,6 (82,4% → 88,0%)
  // que ficava aqui era de 31/07 com 78 perguntas e 263 docs — denominador diferente não se
  // compara, e o ganho é lido dentro da corrida justamente por isso. Custa uma chamada de
  // claude-cli por busca — ~8 s, contra ~200 ms sem ele. `?rerank=0` desliga para quem quer a
  // resposta rápida, e falha do CLI cai na fusão sem derrubar a aba.
  let erroRerank = "";
  if (querRerank !== "0" && q.trim() && achados.length > 1) {
    const candidatos = achados.map((r) => {
      const d = porId.get(r.id)!;
      return { id: r.id, tipo: d.tipo, titulo: d.titulo, trecho: trechoRelevante(d.texto, termos) };
    });
    const { itens, ok, erro } = await rerank(q, candidatos);
    if (ok) motor += " + rerank";
    else erroRerank = erro;
    // score zerado: depois da fusão RRF a posição é a informação, o número não significa mais nada.
    achados = (itens as Achado[]).map((c) => ({ id: c.id, tipo: c.tipo, score: 0 }));
  }
  achados = achados.slice(0, 10);

  // Síntese sobre os 10 finais: recall@10 é 81,1% mas @1 é 29,5% — o material está lá e a lista
  // não o entrega. Segunda chamada de claude-cli, DEPOIS da fusão, e não um prompt só que
  // ordena e responde: acoplar as duas obrigaria a remedir o recall a cada ajuste de redação.
  // `?resposta=0` desliga; falha ou resposta sem citação some da tela e vira aviso no rodapé.
  const resposta = querResposta !== "0" && q.trim() && achados.length
    ? await responder(q, trechosPara(achados.map((r) => porId.get(r.id)!), termos))
    : { texto: "", fontes: [] as number[], erro: "" };

  const tipos = docs.reduce<Record<string, number>>((a, d) => ({ ...a, [d.tipo]: (a[d.tipo] ?? 0) + 1 }), {});

  return (
    <main>
      <h1>ROI Hub</h1>
      <Tabs active="busca" />
      <p className="sub">
        Pergunta em português. O índice cobre {docs.length} documentos: protocolos, handoffs, memórias e
        os cards de projeto do ranking.
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

      {/* `card ag-section` é a caixa que a Agenda e o SEO já usam — caixa nova só para a resposta
          seria um segundo design system dentro do mesmo hub. */}
      {resposta.texto && (
        <section className="card ag-section">
          <p className="ag-h">Resposta</p>
          <p className="rsm-oque">{resposta.texto}</p>
          <p className="foot">
            Sintetizada pelo claude-cli a partir dos resultados {resposta.fontes.map((n) => `[${n}]`).join(" ")} abaixo.
            Toda afirmação carrega o número do resultado que a sustenta — <strong>confira antes de agir</strong>: o
            corpus mede recuperação, não verdade.
          </p>
        </section>
      )}

      <ol className="busca-res">
        {achados.map((r, i) => {
          const doc = porId.get(r.id)!;
          return (
            <li key={r.id}>
              <div className="busca-cab">
                {/* A numeração é o que torna a citação conferível: `[3]` na resposta é este card.
                    A lista tem list-style: none, então sem isto o número não existe na tela. */}
                <span className="foot">[{i + 1}]</span>
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
        {/* Os TRÊS remedidos na mesma corrida de 03/08, 347 docs e 85 perguntas, com ZERO
            `rerank-conta` — as duas tentativas anteriores saíram com 42/85 e 59/85 caídas na fusão,
            e o que elas imprimiam era média de reranqueado com híbrido puro. O do rerank NÃO se
            compara com os 88,0% de 31/07: aquilo eram 78 perguntas e 263 docs, e denominador novo
            não se compara com número velho. Um recall absoluto no rodapé envelhece sozinho de
            qualquer jeito: handoff e memória são reescritos toda sessão, o que mexe em vetor e IDF
            (83,0% → 82,4% sem mudar código) — por isso o portão é `--min bm25`, relativo. */}
        {motor} · recall@10{" "}
        {`${motor.includes("rerank") ? "81,1%" : motor === "BM25" ? "77,7%" : "77,1%"} medido em 03/08 com 347 docs e 85 perguntas`}{" "}
        de <code>data/dourado.json</code> (<code>node scripts/avaliar.mjs</code>).{" "}
        {motor === "BM25" && (falha || porQueSemVetor) && `⚠️ Vetor desligado — ${falha || porQueSemVetor}. `}
        {erroRerank && `⚠️ Reranker caiu para a fusão — ${erroRerank}. `}
        {/* Recusa não aparece aqui de propósito: "os 10 não sustentam" é o componente
            funcionando. O que precisa de aviso é síntese que falhou ou que veio sem citação e
            foi suprimida — sem isto, as duas seriam indistinguíveis de "não houve resposta". */}
        {resposta.erro && `⚠️ Resposta suprimida — ${resposta.erro}. `}
        {/* O formulário só manda `q`, então sem este link o `?rerank=0` existiria e ninguém
            saberia: medido, o reranker leva a busca de 0,3 s para 6,5 s. */}
        {motor.includes("rerank") && (
          <a href={`/busca?q=${encodeURIComponent(q)}&rerank=0&resposta=0`}>só a lista (0,3 s em vez de ~12 s)</a>
        )}
        {!tipos.memoria && "⚠️ Sem as memórias neste ambiente: 72 das 160 fontes do dourado não estão no índice."}
      </p>
    </main>
  );
}
