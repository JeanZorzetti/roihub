// A borda com a CrUX API (spec 023). Única responsabilidade: falar com a rede e traduzir o
// resultado nos estados que `lib/crux.mjs` consome. Nenhuma regra de negócio mora aqui — nem
// formatação, nem veredito, nem a conta do Pass Rate (Princípio III). O que mora aqui desde a 042
// é a escolha de O QUE perguntar (`lerOrigens`, `lerPassRate`), porque ela decide as chamadas.
//
// Princípio V: a chave vai na query string da chamada e em LUGAR NENHUM mais. Nenhum
// `console.log` do corpo, nenhum valor/prefixo/comprimento de `CRUX_API_KEY` em mensagem.

import { CAP_URLS_PASS_RATE, SLUGS_DE_CAMPO, passRate } from "@/lib/crux.mjs";
import { motivoDaFalha } from "@/lib/gsc-hosts.mjs";

export type Alvo = { tipo: "origem" | "url"; valor: string };

export type RecordCrux = {
  metrics?: Record<string, { percentiles?: { p75?: number | string } }>;
  collectionPeriod?: { firstDate?: DataCrux; lastDate?: DataCrux };
  key?: { origin?: string; url?: string };
};
type DataCrux = { year?: number; month?: number; day?: number };

export type LeituraDaFonte =
  | { estado: "record"; record: RecordCrux }
  | { estado: "sem-amostra" }
  | { estado: "falhou"; erro: string }
  | { estado: "sem-chave" };

const ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryRecord";

// A ficha é `force-dynamic`: sem teto, uma CrUX lenta segura a página inteira, que é a FR-012
// violada por lentidão em vez de por exceção.
const TIMEOUT_MS = 5_000;

/** Gêmeo de `dbOn()` (`lib/db.ts`): permite decidir sem chamar. */
export function cruxOn(): boolean {
  return !!process.env.CRUX_API_KEY?.trim();
}

/**
 * `formFactor` é OMITIDO de propósito = agregado de todos os dispositivos (FR-010). Um POST
 * devolve os quatro vitais no mesmo `record` — não quatro chamadas.
 *
 * A tradução de status é o coração da FR-003: `404` é o protocolo da fonte para "o alvo não tem
 * visitas suficientes" e **não é erro**; tudo o mais que impede a leitura é falha de agora.
 * Colapsar os dois é o defeito que a spec proíbe nominalmente.
 *
 * NUNCA lança (FR-012): a ficha não pode virar erro por causa de um medidor.
 */
export async function lerCampo(alvo: Alvo): Promise<LeituraDaFonte> {
  const chave = process.env.CRUX_API_KEY?.trim();
  // Sem `fetch` nenhum: não se gasta rede para descobrir que não há chave.
  if (!chave) return { estado: "sem-chave" };
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(chave)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alvo.tipo === "origem" ? { origin: alvo.valor } : { url: alvo.valor }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 404) return { estado: "sem-amostra" };
    // 401/403 (chave inválida ou API não habilitada), 429 (quota) e 5xx: conserta-se, e até lá é
    // falha. O status entra na mensagem; o corpo, não.
    if (!res.ok) return { estado: "falhou", erro: `HTTP ${res.status}` };
    const json = (await res.json()) as { record?: RecordCrux };
    if (!json?.record) return { estado: "falhou", erro: "200 sem `record`" };
    return { estado: "record", record: json.record };
  } catch (e) {
    // Inclui `JSON.parse` inválido e o `AbortError` do timeout. Truncado em 60, como em
    // `app/api/gsc-serie/route.ts:60`.
    return { estado: "falhou", erro: motivoDaFalha(e) };
  }
}

/**
 * 042 — a origem de CADA host declarado (`hostsDeclarados()`), na ordem dele: a atual primeiro, a
 * anterior depois. Quem escolhe qual responde é `vitalPorOrigem()`, puro; aqui só se pergunta.
 * Em SÉRIE, pelo mesmo motivo de `lerPassRate()`.
 */
export async function lerOrigens(hosts: string[]): Promise<{ alvo: Alvo; leitura: LeituraDaFonte }[]> {
  const leituras = [];
  for (const h of hosts) {
    const alvo: Alvo = { tipo: "origem", valor: `https://${h}` };
    leituras.push({ alvo, leitura: await lerCampo(alvo) });
  }
  return leituras;
}

/**
 * 023/US3 — o Core Web Vitals Pass Rate do board, sobre as URLs PRIORITÁRIAS: as de maior
 * impressão na janela curta, cortadas em `CAP_URLS_PASS_RATE`. Sem a ordenação o corte sortearia o
 * denominador; as que ficam de fora entram no texto como NÃO CONSULTADAS, nunca como reprovadas.
 *
 * 032 — a amostra é por URL e passa a sair da leitura por PÁGINA. Na Atma isso a tira de 14 URLs
 * para 29, e "não consultadas" de 4 para 19: a fração PODE mudar de valor, e isso é a medida
 * passando a ver o site inteiro, não regressão. O custo de rede não muda — `CAP_URLS_PASS_RATE`
 * continua 10 consultas ao CrUX.
 *
 * Em SÉRIE, pelo mesmo motivo de `app/api/gsc-serie/route.ts:36-38`: um punhado de POSTs
 * simultâneos ao mesmo endpoint do Google com a mesma chave é o caminho mais curto para o 429 que
 * transformaria a leitura inteira em falha por pressa. Só para `SLUGS_DE_CAMPO` (FR-014), e a
 * falha segue o idioma de `lerApuracao()`: não derruba a aba.
 *
 * 042 — MUDOU-SE de `app/okr/[slug]/aquisicao/page.tsx` para cá: `/gsc/mapa` é o segundo
 * consumidor, e a escolha das URLs prioritárias escrita duas vezes é como as duas telas passam a
 * discordar sobre o mesmo Pass Rate.
 */
export async function lerPassRate(slug: string, paginas: { pagina: string; impressoes: number }[] | null) {
  if (!SLUGS_DE_CAMPO.includes(slug) || !paginas) return null;
  // Cópia antes de ordenar: a MESMA lista alimenta as outras medidas por URL, e `sort` é no lugar.
  const urls = [...paginas].sort((a, b) => b.impressoes - a.impressoes);
  const prioritarias = urls.slice(0, CAP_URLS_PASS_RATE);
  try {
    const leituras = new Map();
    for (const u of prioritarias) leituras.set(u.pagina, await lerCampo({ tipo: "url", valor: u.pagina }));
    return { ...passRate(leituras, prioritarias.length), naoConsultadas: urls.length - prioritarias.length };
  } catch (e) {
    return { erro: motivoDaFalha(e) };
  }
}
