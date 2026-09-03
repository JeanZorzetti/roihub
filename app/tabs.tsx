import Link from "next/link";
import type { GscStatus } from "@/lib/gsc";
import type { GithubStatus } from "@/lib/github";
import { listFichas } from "@/lib/projects";

// Chrome compartilhado entre as páginas (ranking e SEO).

type Active =
  | "home"
  | "seo"
  | "infra"
  | "insights"
  | "agenda"
  | "marketing"
  | "ideias"
  | "resumo"
  | "busca"
  | "crm"
  | "ia"
  | "automacao"
  | "okr";

/**
 * As 13 seções em 4 grupos, na ordem em que o trabalho acontece: o número chega (Medir), vira
 * escolha (Decidir), vira trabalho (Executar), e a máquina que roda por baixo (Máquina).
 *
 * Uma faixa de 13 links planos não tinha ordem legível nenhuma — era só uma lista. O agrupamento
 * é o que a coluna compra e a faixa não comprava; abaixo de 1024px o CSS devolve os itens à faixa
 * horizontal de antes (`display: contents`), sem hambúrguer e sem JS de cliente.
 */
const GRUPOS: { id: string; titulo: string; itens: [Active, string, string][] }[] = [
  {
    id: "medir",
    titulo: "Medir",
    itens: [
      ["home", "/", "Ranking"],
      ["seo", "/seo", "SEO"],
      ["infra", "/infra", "Infra"],
      ["insights", "/insights", "Insights"],
    ],
  },
  {
    // OKR abre o grupo porque é dele que sai a pergunta "o que adianta fazer agora"; Agenda é o
    // que já virou compromisso com data, e Resumo é o contexto de quem não lembra o que é o projeto.
    id: "decidir",
    titulo: "Decidir",
    itens: [
      ["okr", "/okr", "OKR"],
      ["agenda", "/agenda", "Agenda"],
      ["resumo", "/resumo", "Resumo"],
    ],
  },
  {
    id: "executar",
    titulo: "Executar",
    itens: [
      ["marketing", "/marketing", "Marketing"],
      ["ideias", "/ideias", "Ideias"],
      ["crm", "/crm", "CRM"],
    ],
  },
  {
    // O hub cuidando de si: o índice que se pergunta, os empregados que gastam token e o cron.
    id: "maquina",
    titulo: "Máquina",
    itens: [
      ["busca", "/busca", "Busca"],
      ["ia", "/ia", "IA"],
      ["automacao", "/automacao", "Automação"],
    ],
  },
];

/**
 * A entrada OKR é um PAR: o link (`/okr`, FR-002 — um acionamento) e um `<details>` irmão cujo
 * `<summary>` é o controle de expandir (FR-001). `<details>` nativo entrega foco, Enter/Espaço e
 * `aria-expanded` implícito de graça — nenhuma das 13 telas ganha `"use client"` por causa dele
 * (011, decisão D2/D3).
 *
 * Async porque `listFichas()` lê a curadoria (import estático do JSON curado — nenhuma chamada de
 * rede, então o menu não custa nada às telas que não leem projeto).
 */
export async function Tabs({ active, okrSlug }: { active: Active; okrSlug?: string }) {
  const fichas = await listFichas();
  const tab = (key: string, href: string, label: string) => (
    <Link href={href} className={active === key ? "tab active" : "tab"} aria-current={active === key ? "page" : undefined}>
      {label}
    </Link>
  );
  // FR-003: aberto de saída em QUALQUER rota da árvore — decidido no servidor, sem JS de cliente.
  const okrAberto = active === "okr";
  const naPortfolio = active === "okr" && !okrSlug;

  const entrada = (key: Active, href: string, label: string) => {
    // FR-005: sem ficha curada, a entrada OKR volta a ser link simples.
    if (key !== "okr" || fichas.length === 0) return tab(key, href, label);
    return (
      <span className="tab-okr">
        <Link href="/okr" className={naPortfolio ? "tab active" : "tab"} aria-current={naPortfolio ? "page" : undefined}>
          OKR
        </Link>
        <details className="okr-menu" open={okrAberto}>
          <summary aria-label="Fichas do OKR por projeto">
            <span aria-hidden="true">▾</span>
          </summary>
          <ul>
            <li>
              <Link href="/okr" className={naPortfolio ? "active" : undefined} aria-current={naPortfolio ? "page" : undefined}>
                Portfólio
              </Link>
            </li>
            {fichas.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/okr/${f.slug}`}
                  className={okrSlug === f.slug ? "active" : undefined}
                  aria-current={okrSlug === f.slug ? "page" : undefined}
                >
                  {/* achado 7 do design-review de 03/09: nome completo ("Atma Aligner — alinhadores
                      invisíveis + infoproduto R$ 47") ocupava 3 linhas no menu — a mesma quebra de
                      "nome curto vs. descrição" que o h1 da ficha já faz (page.tsx, nomeCurto). */}
                  {f.nome.split(" — ")[0]}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </span>
    );
  };

  return (
    <>
      {/* O alvo mora AQUI, logo depois da nav, e não em cada página: `Tabs` é a primeira coisa
          dentro do `<main>` das 13, então "depois da nav" é o começo do conteúdo em todas — e um
          `id` por página seriam 13 edições para o mesmo salto. */}
      <a href="#conteudo" className="sr-only skip">
        Pular para o conteúdo
      </a>
      <nav className="tabs nav-col" aria-label="Seções">
        {GRUPOS.map((g) => (
          <div className="nav-grupo" key={g.id}>
            {/* `aria-labelledby` em vez de `aria-hidden` no título: em coluna os grupos SÃO
                navegação nomeada, e quem usa leitor de tela ouve "Medir, lista de 4 itens". */}
            <p className="nav-grupo-h" id={`nav-g-${g.id}`}>
              {g.titulo}
            </p>
            <ul aria-labelledby={`nav-g-${g.id}`}>
              {g.itens.map(([key, href, label]) => (
                <li key={key}>{entrada(key, href, label)}</li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {/* `tabIndex={-1}` para o alvo receber o foco de fato: sem ele o navegador rola até a âncora
          e deixa o foco na barra, e o próximo Tab volta para a primeira aba. */}
      <span id="conteudo" tabIndex={-1} />
    </>
  );
}

export function GithubFoot({ gh }: { gh: GithubStatus }) {
  return (
    <p className={gh.state === "error" ? "foot gsc-err" : "foot"}>
      {gh.state === "off" &&
        "GitHub: desligado — a env GITHUB_TOKEN não está configurada neste ambiente; a lista cai só na curadoria do data/projects.json."}
      {gh.state === "error" && `GitHub: ERRO — ${gh.message}`}
      {gh.state === "ok" && `GitHub: conectado — ${gh.total} repositórios lidos (cache de 10 min).`}
    </p>
  );
}

export function GscFoot({ gsc }: { gsc: GscStatus }) {
  return (
    <p className={gsc.state === "error" ? "foot gsc-err" : "foot"}>
      {gsc.state === "off" &&
        "GSC: desligado — a env GOOGLE_SERVICE_ACCOUNT_JSON não está configurada neste ambiente."}
      {gsc.state === "error" && `GSC: ERRO — ${gsc.message}`}
      {gsc.state === "ok" &&
        `GSC: conectado — ${gsc.properties.length} propriedades: ${gsc.properties
          .map((p) => p.replace("sc-domain:", ""))
          .sort()
          .join(", ")}`}
    </p>
  );
}
