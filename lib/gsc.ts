import { GoogleAuth } from "google-auth-library";

export type GscTrend = { current: number; previous: number } | null;

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

async function queryClicks(
  client: Awaited<ReturnType<GoogleAuth["getClient"]>>,
  property: string,
  startDate: string,
  endDate: string,
  hostFilter: string | null
): Promise<number> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    property
  )}/searchAnalytics/query`;
  const body: Record<string, unknown> = { startDate, endDate };
  if (hostFilter) {
    body.dimensionFilterGroups = [
      { filters: [{ dimension: "page", operator: "contains", expression: hostFilter }] },
    ];
  }
  const res = await client.request<{ rows?: { clicks: number }[] }>({
    url,
    method: "POST",
    data: body,
  });
  return res.data.rows?.[0]?.clicks ?? 0;
}

// Cliques dos últimos 28d (fechando 3 dias atrás, GSC atrasa) vs os 28d anteriores.
// Qualquer falha (env ausente, propriedade errada, quota) → null e o hub usa o seoSeed.
export async function gscTrend(property: string | null, hostFilter: string | null): Promise<GscTrend> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw || !property) return null;
  try {
    const auth = new GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    const client = await auth.getClient();
    const [current, previous] = await Promise.all([
      queryClicks(client, property, isoDaysAgo(31), isoDaysAgo(3), hostFilter),
      queryClicks(client, property, isoDaysAgo(59), isoDaysAgo(32), hostFilter),
    ]);
    return { current, previous };
  } catch {
    return null;
  }
}
