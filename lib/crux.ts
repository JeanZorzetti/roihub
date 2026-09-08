// A borda com a CrUX API (spec 023). Única responsabilidade: falar com a rede e traduzir o
// resultado nos estados que `lib/crux.mjs` consome. Nenhuma regra de negócio mora aqui — nem
// formatação, nem veredito, nem Pass Rate (Princípio III).
//
// Princípio V: a chave vai na query string da chamada e em LUGAR NENHUM mais. Nenhum
// `console.log` do corpo, nenhum valor/prefixo/comprimento de `CRUX_API_KEY` em mensagem.

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
    return { estado: "falhou", erro: (e instanceof Error ? e.message : String(e)).slice(0, 60) };
  }
}
