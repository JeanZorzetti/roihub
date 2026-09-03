import { GoogleAuth } from "google-auth-library";

// Borda de rede da GA4 Data API (013). Zero regra: mapa de canais, estados e soma moram em
// lib/ficha.mjs (Princípio III). Cliente GoogleAuth PRÓPRIO — não compartilha escopo nem estado
// com lib/gsc.ts, para que uma falha aqui nunca alcance o caminho do orgânico (FR-008).

export type LeituraGa4 =
  | null
  | { erro: string }
  | { linhas: { grupo: string; sessoes: number }[]; janela: { inicio: string; fim: string }; propriedade: string };

type Client = Awaited<ReturnType<GoogleAuth["getClient"]>>;

let clientPromise: Promise<Client> | null = null;

function getClient(): Promise<Client> | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  clientPromise ??= new GoogleAuth({
    credentials: JSON.parse(raw),
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  }).getClient();
  return clientPromise;
}

function normalizarPropriedade(propertyId: string): string {
  return propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
}

export async function ga4Canais(
  propertyId: string | undefined,
  janela: { inicio: string; fim: string },
): Promise<LeituraGa4> {
  if (!propertyId) return null; // não configurado — sem tocar a rede
  const clientP = getClient();
  if (!clientP) return { erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" }; // o nome, nunca o valor
  const propriedade = normalizarPropriedade(propertyId);
  try {
    const client = await clientP;
    const res = await client.request<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>({
      url: `https://analyticsdata.googleapis.com/v1beta/${propriedade}:runReport`,
      method: "POST",
      data: {
        dateRanges: [{ startDate: janela.inicio, endDate: janela.fim }],
        dimensions: [{ name: "sessionDefaultChannelGroup" }],
        metrics: [{ name: "sessions" }],
      },
    });
    const linhas = (res.data.rows ?? []).map((r) => ({
      grupo: r.dimensionValues[0].value,
      sessoes: Number(r.metricValues[0].value),
    }));
    return { linhas, janela, propriedade };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { erro: err?.code ?? String(err?.message ?? "erro").slice(0, 60) };
  }
}

/**
 * Os eventos de comportamento da MESMA propriedade, para os medidores D3 do N5 (014). Uma
 * chamada só, três dimensões — `eventName` diz qual medidor, `pagePath` permite tirar o tráfego
 * interno e `linkUrl` é o que separa "clicou no WhatsApp" de "clicou no Instagram".
 *
 * 🚩 R4 antes de tudo: NÃO instrumentar o site. O `scroll` (90% da página), o `click` (link
 * EXTERNO) e o `form_start` são enhanced measurement do GA4 — já caem, retroativos, sem uma linha
 * nova no projeto. Instrumentar evento próprio antes de olhar isto criaria a cópia pior de sempre:
 * sem histórico, contando só de hoje em diante.
 */
export type EventosGa4 =
  | null
  | { erro: string }
  | { linhas: { evento: string; pagina: string; link: string; contagem: number }[]; janela: { inicio: string; fim: string }; propriedade: string };

/** Os eventos que os medidores D3 sabem ler. `form_submit` entra para poder sair ZERO: é a
 *  ausência dele que prova que o abandono não é derivável, e ausência só se vê perguntando. */
export const EVENTOS_D3 = ["scroll", "click", "form_start", "form_submit", "begin_checkout"];

export async function ga4Eventos(
  propertyId: string | undefined,
  janela: { inicio: string; fim: string },
): Promise<EventosGa4> {
  if (!propertyId) return null; // não configurado — sem tocar a rede
  const clientP = getClient();
  if (!clientP) return { erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" }; // o nome, nunca o valor
  const propriedade = normalizarPropriedade(propertyId);
  try {
    const client = await clientP;
    const res = await client.request<{ rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[] }>({
      url: `https://analyticsdata.googleapis.com/v1beta/${propriedade}:runReport`,
      method: "POST",
      data: {
        dateRanges: [{ startDate: janela.inicio, endDate: janela.fim }],
        dimensions: [{ name: "eventName" }, { name: "pagePath" }, { name: "linkUrl" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: { filter: { fieldName: "eventName", inListFilter: { values: EVENTOS_D3 } } },
        limit: 500,
      },
    });
    const linhas = (res.data.rows ?? []).map((r) => ({
      evento: r.dimensionValues[0].value,
      pagina: r.dimensionValues[1].value,
      link: r.dimensionValues[2].value,
      contagem: Number(r.metricValues[0].value),
    }));
    return { linhas, janela, propriedade };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { erro: err?.code ?? String(err?.message ?? "erro").slice(0, 60) };
  }
}
