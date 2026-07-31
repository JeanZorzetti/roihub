import Link from "next/link";
import type { GscStatus } from "@/lib/gsc";
import type { GithubStatus } from "@/lib/github";

// Chrome compartilhado entre as páginas (ranking e SEO).

export function Tabs({ active }: { active: "home" | "seo" | "infra" | "insights" | "agenda" | "resumo" }) {
  const tab = (key: string, href: string, label: string) => (
    <Link href={href} className={active === key ? "tab active" : "tab"} aria-current={active === key ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <nav className="tabs" aria-label="Seções">
      {tab("home", "/", "Ranking")}
      {tab("seo", "/seo", "SEO")}
      {tab("infra", "/infra", "Infra")}
      {tab("insights", "/insights", "Insights")}
      {tab("agenda", "/agenda", "Agenda")}
      {tab("resumo", "/resumo", "Resumo")}
    </nav>
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
