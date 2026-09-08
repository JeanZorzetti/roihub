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
  /** Propriedade GA4 que responde pelos canais não-orgânicos deste projeto (013). AUSENTE é
   *  "não configurado", nunca "sem tráfego" — a distinção inteira da FR-010. Não é segredo:
   *  `propertyId` é o número visível no admin do GA4. */
  ga4?: { propertyId: string };
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
  /** Data escrita no card a partir da qual a cadeia de Conversão passa a valer (018, FR-004/FR-005).
   *  Presente → `conversao()` de `lib/janelas.mjs` vira `data → hoje`, exibida com `porque` ao lado
   *  do número. Ausente é o normal para os outros 16 projetos: `conversao()` cai para 28d/D-3, a
   *  mesma janela de sempre (FR-006, SC-007) — o campo NÃO se espalha para quem não declarou. */
  epoca?: { data: string; porque: string };
  /** A taxonomia de PERDA é do CLIENTE, não do template (019, FR-015): os slugs de
   *  `patient_leads.motivo` são livres e vivem no repo do projeto, não neste. Ausente = a ficha
   *  exibe `enviados` e OMITE vivos/perdidos, nomeando o que falta declarar (FR-015b) — nunca
   *  herda a lista da Atma de graça, que é o defeito que a 017 matou na palitagem.
   *  Vivo é o COMPLEMENTO, `motivo === null` incluído: quem ainda não foi palitado não é perda. */
  motivosDePerda?: string[];
  /** Curadoria humana: as variantes pelas quais as pessoas procuram o projeto pelo NOME, e o
   *  corte de país sob o qual a classificação vale (025). AUSENTE é o estado padrão dos outros 34
   *  projetos — "não declarada", NUNCA "zero buscas de marca": as duas sairiam iguais na tela, e a
   *  segunda é uma afirmação sobre o site que ninguém mediu. `pais` é obrigatório porque sem corte
   *  a razão sai contaminada — o total do GSC é mundial e a fatia de marca não teria o mesmo
   *  denominador. Quem lê é `listProjects()`, nunca `data/projects.json` direto (Princípio I). */
  marca?: { termos: string[]; pais: string; declaradaEm?: string };
  /** Declaração humana chaveada pela `chave` do marco (`tratamento`, não o nome de exibição — a
   *  mesma razão de `REGUA` ser chaveada por `chave` em lib/benchmark.mjs). A ficha ANEXA este
   *  texto à `fonte` do marco, não substitui (018, FR-025/FR-026/FR-027 — fecha a FR-004 da 017,
   *  que citava a regra sem nomear quem declarou nem quando). Mora no card, não no perfil: `PERFIS.D`
   *  é compartilhado com outros projetos e o nome do dono da Atma não pode vazar para eles. */
  declaracoes?: Record<string, { quem: string; em: string; texto: string }>;
  /** false = repo do GitHub que ainda não tem receita/blockers/ação definidos à mão. */
  curated: boolean;
  repo: string | null;
  repoUrl: string | null;
  pushedAt: string | null;
};

export async function listProjects(): Promise<Project[]> {
  return mergeProjects(curated as Curated[], await listRepos()) as Project[];
}

/** Escopo das corridas de busca (021 série do GSC · 022 indexação do sitemap): **só a Atma**.
 *
 *  Decisão do Jean (07/09/2026), corrigindo o escopo com que as duas specs nasceram: o board de
 *  OKR de busca é da Atma, e as corridas estavam varrendo os 35 projetos. Não é otimização — é o
 *  objetivo original. De quebra some a restrição que MOLDOU a 022 inteira (a quota de ~2000
 *  inspeções/dia dividida por 21 subdomínios de `roilabs.com.br`): com um projeto só, o rodízio e
 *  a amostra continuam no código mas nunca disparam.
 *
 *  Lista e não constante porque "primeiras servidas" é sequência, não exclusão permanente: abrir
 *  para o segundo projeto é acrescentar um slug aqui, sem tocar em rota nenhuma. */
export const SLUGS_DE_BUSCA = ["atma"];

/** Os projetos que as corridas de busca percorrem. Filtra por `url` como antes — quem não tem site
 *  não tem o que inspecionar. */
export async function projetosDeBusca(): Promise<Project[]> {
  return (await listProjects()).filter((p) => p.url && SLUGS_DE_BUSCA.includes(p.slug));
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
