import insights from "@/data/insights.json";
import { checkHealth, type Health } from "@/lib/health";
import { gscTrend, type GscTrend } from "@/lib/gsc";
import { listProjects, type Project } from "@/lib/projects";
import { computeScore, seoScoreFromClicks, decayFromHealth } from "@/lib/score.mjs";

// Avaliação ao vivo de um projeto (saúde + GSC + insights) — a MESMA para home e agenda,
// pra ordem de prioridade nunca divergir entre as abas.

export type { Project };
type Insight = { health?: number; flags?: string[]; crawl?: { detail?: string } | null };
export type Evaluated = Project & {
  health: Health;
  trend: GscTrend;
  seo: number;
  seoAuto: number | null;
  decayAuto: number | null;
  decayEff: number;
  score: number;
};

export async function evaluate(p: Project): Promise<Evaluated> {
  const [health, trend] = await Promise.all([checkHealth(p.url), gscTrend(p.url)]);
  const seoAuto = trend ? seoScoreFromClicks(trend.current, trend.previous) : null;
  const seo = seoAuto ?? p.seoSeed;
  const insight = (insights.projects as unknown as Record<string, Insight>)[p.slug];
  const decayAuto = insight ? decayFromHealth(insight.health, insights.generatedAt) : null;
  const decayEff = !health.ok ? 10 : decayAuto ?? p.decay; // site fora do ar = decay máximo
  const blockersLista = insight?.flags?.length
    ? [
        ...p.blockersLista,
        ...insight.flags.map((f) =>
          f === "crawl-waste" && insight.crawl?.detail ? `⚠ ${f} — ${insight.crawl.detail}` : `⚠ ${f}`
        ),
      ]
    : p.blockersLista;
  const score = computeScore({ receita: p.receita, blockers: p.blockers, seo, decay: decayEff });
  return { ...p, blockersLista, health, trend, seo, seoAuto, decayAuto, decayEff, score };
}

/**
 * Todos os projetos avaliados, do maior score pro menor — a ordem do ranking da home.
 * Curado empata acima do não-curado: repo sem receita/blockers definidos nunca deve roubar
 * o foco do dia de um projeto que já tem trabalho medido.
 */
export async function evaluateAll(): Promise<Evaluated[]> {
  const evaluated = await Promise.all((await listProjects()).map(evaluate));
  evaluated.sort((a, b) => b.score - a.score || Number(b.curated) - Number(a.curated));
  return evaluated;
}
