// O export chama-se `ViewTransition` (nao `unstable_`) no canal experimental do React, que e o
// unico que o tem — ver a nota de `react`/`react-dom` no package.json.
import { ViewTransition } from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROI Hub",
  description: "Um projeto por dia. Os outros nove esperam.",
  robots: { index: false, follow: false },
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎯</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* A 4a camada do Corte Seco (.art/log.json): a troca de rota CORTA, nunca faz fade. E o
            <ViewTransition> que faz o router chamar document.startViewTransition — a flag
            experimental.viewTransition sozinha nao dispara nada, so habilita este componente; o
            desenho do wipe mora em ::view-transition-* no globals.css.

            Por que ele e nao um interceptor de cliques com startViewTransition na mao: as rotas
            deste hub levam de 3 a 6s (server components lendo GSC, GitHub e Postgres). Um wipe
            disparado NO CLIQUE congela o snapshot da tela velha ate o RSC chegar. O React so
            inicia a transicao no commit, entao a tela velha segue viva e clicavel durante a
            espera e o corte acontece quando ha o que mostrar.

            `name` porque sem ele o React gera um nome proprio (`_t_0_`) e o CONTEUDO sai pelo
            cross-fade do navegador enquanto o wipe anima a raiz, que sobra quase vazia — dois
            gestos ao mesmo tempo, e um deles e o fade que a direcao proibe. */}
        <ViewTransition name="conteudo">{children}</ViewTransition>
      </body>
    </html>
  );
}
