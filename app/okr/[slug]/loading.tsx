// achado 6 do design-review de 03/09: `dynamic = "force-dynamic"` (R7, comentário no page.tsx)
// deixa a tela em branco pelo tempo inteiro da coleta (TTFB medido em prod: 3,3s a frio). Next
// troca este arquivo pelo conteúdo real assim que ele resolve — mesmos 8 cards da ficha (header +
// N0..N6), só sem texto, pra a tela não piscar de branco pra cheia de uma vez.
export default function Loading() {
  return (
    <main className="page">
      {Array.from({ length: 8 }, (_, i) => (
        <section className="card ag-section skeleton-card" key={i} aria-hidden="true">
          <div className="skeleton-linha" style={{ width: "40%" }} />
          <div className="skeleton-linha" />
          <div className="skeleton-linha" style={{ width: "70%" }} />
        </section>
      ))}
    </main>
  );
}
