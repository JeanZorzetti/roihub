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
 * A aba OKR é um PAR: o link (`/okr`, FR-002 — um acionamento) e um `<details>` irmão cujo
 * `<summary>` é o controle de expandir (FR-001). `<details>` nativo entrega foco, Enter/Espaço e
 * `aria-expanded` implícito de graça — nenhuma das 13 telas ganha `"use client"` por causa dele
 * (011, decisão D2/D3).
 *
 * Async porque `listFichas()` lê a curadoria — sem `listRepos()`, então as telas que hoje não
 * leem projeto (`/busca`, `/ia`, `/automacao`) não pagam chamada de rede só para desenhar o menu.
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

  return (
    <>
      {/* O alvo mora AQUI, logo depois da nav, e não em cada página: `Tabs` é a primeira coisa
          dentro do `<main>` das 13, então "depois da nav" é o começo do conteúdo em todas — e um
          `id` por página seriam 13 edições para o mesmo salto. */}
      <a href="#conteudo" className="sr-only skip">
        Pular para o conteúdo
      </a>
      <nav className="tabs" aria-label="Seções">
        {tab("home", "/", "Ranking")}
        {tab("seo", "/seo", "SEO")}
        {tab("infra", "/infra", "Infra")}
        {tab("insights", "/insights", "Insights")}
        {tab("agenda", "/agenda", "Agenda")}
        {/* Quadros vêm logo depois da Agenda porque é dela que se distinguem: a Agenda é
            compromisso com data, o quadro é o que ainda não virou compromisso. */}
        {tab("marketing", "/marketing", "Marketing")}
        {tab("ideias", "/ideias", "Ideias")}
        {tab("resumo", "/resumo", "Resumo")}
        {tab("busca", "/busca", "Busca")}
        {/* OKR fica depois do CRM porque é dele que sai o numerador: a árvore só mede o que o CRM
            e o gateway já gravaram. Sem ficha curada (FR-005), a aba volta a ser link simples. */}
        {fichas.length > 0 ? (
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
                      {f.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </span>
        ) : (
          tab("okr", "/okr", "OKR")
        )}
        {tab("crm", "/crm", "CRM")}
        {tab("ia", "/ia", "IA")}
        {tab("automacao", "/automacao", "Automação")}
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
