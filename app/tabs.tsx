import Link from "next/link";
import type { GscStatus } from "@/lib/gsc";
import type { GithubStatus } from "@/lib/github";

// Chrome compartilhado entre as páginas (ranking e SEO).

export function Tabs({
  active,
}: {
  active:
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
}) {
  const tab = (key: string, href: string, label: string) => (
    <Link href={href} className={active === key ? "tab active" : "tab"} aria-current={active === key ? "page" : undefined}>
      {label}
    </Link>
  );
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
            e o gateway já gravaram. */}
        {tab("okr", "/okr", "OKR")}
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
