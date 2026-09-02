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
