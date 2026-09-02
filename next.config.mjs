/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // A aba /busca lê o corpus do disco em runtime, e o tracing do standalone só copia o que é
  // importado: sem isto o container sobe com o índice vazio e a aba não acha nada.
  outputFileTracingIncludes: {
    "/busca": ["./data/protocolos/**", "./handoff/**", "./data/projects.json"],
  },
  turbopack: { root: import.meta.dirname },
  // Corte Seco (.art/log.json): a transicao de rota e a 4a camada da direcao — o wipe de
  // `::view-transition-*` no globals.css. A flag habilita o <ViewTransition> do React.
  experimental: { viewTransition: true },
};

export default nextConfig;
