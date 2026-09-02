import curated from "@/data/projects.json";
import { listRepos } from "@/lib/github";
import { mergeProjects, reposSemSite } from "@/lib/projects.mjs";

// Ponto único de entrada da lista de projetos do hub. Todo consumidor (ranking, SEO, infra,
// insights, agenda) passa por aqui — nenhum importa data/projects.json direto, senão a aba
// mostra um conjunto e o ranking outro.

type Curated = (typeof curated)[number] & { repo?: string };

/** `humano` = painel de terceiro, login manual ou decisão que só o Jean toma — o que nenhum agente
 * destrava. Era string solta, e aí grep por `manual|jean` devolvia 18 cards contra os 5 reais:
 * media o texto, não o bloqueio. */
export type Blocker = { texto: string; humano?: boolean };

export type Project = {
  slug: string;
  nome: string;
  url: string;
  gscInicio?: string;
  receita: number;
  receitaNota: string;
  blockers: number;
  blockersLista: Blocker[];
  seoSeed: number;
  decay: number;
  decayNota: string;
  /** Curadoria: o que impede de faturar, e se o host serve produto de verdade. Ver `FAMILIAS` e
   * `ESTADOS` em lib/dourado-estado.mjs — é de lá que sai a apuração de `D-70`. */
  familia?: "cobranca" | "venda" | "trafego" | "nao-vende" | "produto";
  estado?: "no-ar" | "no-ar-inutilizavel" | "prototipo";
  acao: string;
  acaoDesc: string;
  /** Curado (§9 item 9 do design-review): revoga a `acao` sem apagar o registro — mesma lógica de
   *  não-apagar de `standby`. Card continua na agenda, mas separado do que é ação de fato pendente
   *  (FR-031 proíbe inferir isso do texto/emoji de `acao`). */
  descontinuado?: boolean;
  /** Perfil de negócio do §4 de `handoff/okr-kpi-template.md` — A SaaS, B E-commerce, C Serviço,
   * D Clínica/lead. Decide QUAL cadeia a `/okr` monta: `trial → primeira cobrança` e
   * `consulta → compareceu` falham por motivos opostos e pedem conserto oposto. Ausente é
   * `não apurado` de propósito: cadeia errada é pior que cadeia ausente, porque parece medida. */
  perfil?: "A" | "B" | "C" | "D";
  /** Meta DECLARADA pelo humano, nunca apurada e nunca inferida (FR-001/FR-002). `ticket` paga a
   *  lacuna que a 009 deixou aberta de propósito — mas rotulado como declaração, não medição.
   *  `valor` é o que FALTA a partir de `declaradaEm`: a tela não desconta o realizado (seria
   *  acompanhamento), então o desconto é curadoria e a data existe para ele não apodrecer calado. */
  meta?: { valor?: number; ticket?: number; prazo?: string; declaradaEm?: string };
  /** Régua de dinheiro escrita por `scripts/vendas-mercadopago.mjs`. AUSENTE é "não olhei",
   * `[]` é "olhei, zero" — a distinção inteira de `lib/funil.mjs`. */
  vendas?: { data: string }[];
  /** Stand-by: decisão de não trabalhar o projeto agora, e o motivo. Preenchido = cai pro fim do
   * ranking (`ordemDoRanking`) e a `acao` não vira linha na agenda — mas continua sendo medido
   * (health, GSC, insights) e a `acao` fica guardada intacta para quando voltar. Por isso é campo
   * e não apagar a `acao`: apagar destrói a curadoria e zera o dono no banco. */
  standby?: string;
  /** Declaração humana do §6 do template: o objetivo (N0) e os KRs. Curado à mão, como `perfil` e
   *  `meta`. Rotulado como DECLARADO em toda exibição, com a data — declaração sem data apodrece
   *  calada. Ausente é legítimo: a ficha (/okr/<slug>) abre com N0 em `não apurado` e os outros
   *  seis níveis normais. */
  ficha?: {
    declaradaEm?: string;
    objetivo?: string;
    krs?: { kpi: string; baseline: number | null; meta: number; prazo: string; dono?: string; celula: string }[];
  };
  /** false = repo do GitHub que ainda não tem receita/blockers/ação definidos à mão. */
  curated: boolean;
  repo: string | null;
  repoUrl: string | null;
  pushedAt: string | null;
};

export async function listProjects(): Promise<Project[]> {
  return mergeProjects(curated as Curated[], await listRepos()) as Project[];
}

/** Repos vivos sem homepage — pendências de "todo projeto terá site". */
export async function listReposSemSite(): Promise<{ name: string; url: string; pushedAt: string | null }[]> {
  return reposSemSite(curated as Curated[], await listRepos());
}

/** Só os projetos com `ficha` curada, para o menu da aba OKR. Lê a curadoria direto porque `ficha`
 *  SÓ existe nela — repo vindo do GitHub nunca tem o campo, então esta lista e a de
 *  `listProjects()` concordam por construção. Sem `listRepos()`: uma barra de navegação presente
 *  em 12 telas não paga chamada de rede para se desenhar (Complexity Tracking do plano da 011). */
export async function listFichas(): Promise<{ slug: string; nome: string }[]> {
  return (curated as Curated[])
    .filter((p) => p.ficha)
    .map((p) => ({ slug: p.slug, nome: p.nome }));
}
