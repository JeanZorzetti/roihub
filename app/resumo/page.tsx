import { listProjects } from "@/lib/projects";
import resumos from "@/data/resumos.json";
import { Tabs } from "../tabs";

export const dynamic = "force-dynamic";

// Única aba que responde "o que eu tenho?" em vez de "o que eu faço hoje?".
// Os outros cinco painéis descrevem a próxima ação; aqui é o produto.

type Resumo = {
  oQueE: string;
  paraQuem: string;
  estado: string;
  dinheiro: string;
  oQueTrava: string;
  proximaDecisao: string | null;
};

const ESTADO: Record<string, { label: string; pill: string }> = {
  "no-ar": { label: "no ar", pill: "pill pill-ok" },
  "no-ar-inutilizavel": { label: "no ar · não utilizável", pill: "pill pill-crit" },
  prototipo: { label: "protótipo", pill: "pill pill-warn" },
  parado: { label: "parado", pill: "pill pill-warn" },
  morto: { label: "morto", pill: "pill pill-crit" },
};

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="rsm-row">
      <dt className="stat-label">{rotulo}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function Page() {
  const projetos = (await listProjects()).filter((p) => p.curated);
  const todos = resumos as Record<string, Resumo>;

  return (
    <main className="page">
      <div className="topbar">
        <div className="topbar-left">
          <div className="brand">
            ROI <span>Hub</span>
          </div>
          <Tabs active="resumo" />
        </div>
        <div className="topbar-meta">{projetos.length} projetos curados</div>
      </div>

      {projetos.map((p) => {
        const r = todos[p.slug];
        const estado = r ? ESTADO[r.estado] : null;
        return (
          <section key={p.slug} className="card rsm">
            <div className="rsm-head">
              <div>
                <h2 className="rsm-name">{p.nome}</h2>
                <a className="proj-url" href={p.url} target="_blank" rel="noreferrer">
                  {p.url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                </a>
              </div>
              {estado ? <span className={estado.pill}>{estado.label}</span> : <span className="pill">sem resumo</span>}
            </div>

            {r ? (
              <>
                <p className="rsm-oque">{r.oQueE}</p>
                <dl className="rsm-grid">
                  <Linha rotulo="Para quem">{r.paraQuem}</Linha>
                  <Linha rotulo="Dinheiro">{r.dinheiro}</Linha>
                  <Linha rotulo="O que trava">{r.oQueTrava}</Linha>
                  {r.proximaDecisao && <Linha rotulo="Próxima decisão">{r.proximaDecisao}</Linha>}
                </dl>
              </>
            ) : (
              <p className="rsm-oque rsm-vazio">
                Sem resumo em <code>data/resumos.json</code> — o projeto entrou na curadoria depois desta página. Escrever
                os seis campos para o slug <code>{p.slug}</code>.
              </p>
            )}
          </section>
        );
      })}

      <p className="foot">
        Resumo executivo por projeto — o que cada coisa é, não o que fazer hoje. Conteúdo em{" "}
        <code>data/resumos.json</code>, chaveado por <code>slug</code>; a ordem é a da curadoria em{" "}
        <code>data/projects.json</code>. <b>estado</b> e <b>dinheiro</b> não saem de card: estado vem de{" "}
        <code>curl</code> sem <code>-k</code> mais checagem de host NXDOMAIN, e dinheiro é o que está escrito com data —
        sem data, é zero. Card apodrece; esta página só vale enquanto for medida.
      </p>
    </main>
  );
}
