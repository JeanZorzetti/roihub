export type Health = { ok: boolean; status: number; ms: number };

export async function checkHealth(url: string): Promise<Health> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "roihub-healthcheck" },
    });
    return { ok: res.ok, status: res.status, ms: Date.now() - t0 };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - t0 };
  }
}
