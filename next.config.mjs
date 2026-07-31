/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // A aba /busca lê o corpus do disco em runtime, e o tracing do standalone só copia o que é
  // importado: sem isto o container sobe com o índice vazio e a aba não acha nada.
  outputFileTracingIncludes: { "/busca": ["./data/protocolos/**", "./handoff/**"] },
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
