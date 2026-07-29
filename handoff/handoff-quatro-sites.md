# Handoff — os quatro repos que faltam viram site

Escrito na 3ª sessão de 29/07, a partir da decisão do Jean.
Precedente direto e **método a reusar**: [`handoff-seis-sites.md`](handoff-seis-sites.md) (6/6 no ar).
Índice: [`../handoff.md`](../handoff.md).

---

## O estado, e por que a lista agora tem 4 e não 6

Depois das exclusões de 29/07 (`splitjud`, `perfil360`, `loginsplit`, `obeflow`, `agattasemijoias`,
`financeiromedlly`), sobraram **41 repos ativos e 6 sem `homepage`**.

**Dois desses 6 saíram da lista por decisão, e isso já está em código** (feito nesta sessão):
`roihub` (100% admin, nunca terá site público) e `repo-de-teste` (descartável) agora são filtrados
em `semSitePorDecisao`, em [`lib/projects.mjs`](../lib/projects.mjs). O `<details>` da home passa a
mostrar **4**. Teste cobrindo isso em [`test/projects.test.mjs`](../test/projects.test.mjs) — 7/7
passando.

**Sobram estes 4, e a tarefa é criar o site de cada um:**

| # | repo | o que é DE VERDADE | o que existe hoje | esforço |
|---|---|---|---|---|
| 1 | `roi-labs-links` | link page da ROI Labs (linktree próprio) | **site estático pronto** | ~15 min |
| 2 | `aesthetic-perfection-page` | landing "Lumina Estética & Bem-Estar" | **landing pronta**, só falta build | ~30 min |
| 3 | `cannibal_scan` | CannibalScan — auditor de canibalização SEO | app real + decisão de escopo | meia sessão |
| 4 | `aprovai` | AprovAI — análise cadastral de locação com IA | app real pesado | sessão inteira |

**Faça nesta ordem.** É barato → caro, e os dois primeiros não exigem escrever uma linha de UI.

---

## 1 · `roi-labs-links` — o mais barato do lote

**Já é um site estático pronto.** `index.html` + `assets/css` + `assets/js` (React via CDN, sem
build), criado em 17/06/2025 e nunca deployado. Glassmorphism, responsivo, meta tags de social
prontas. O repo também traz um plugin WordPress e um widget Elementor Pro — **ignore os dois**, são
para embutir a página no WP e não têm nada a ver com publicá-la.

- **Deploy:** `vercel --prod` na raiz. Sem build step.
- **URL sugerida:** `links.roilabs.com.br` (é a página institucional de links da casa, `*.vercel.app`
  fica feio num link que vai pra bio de rede social). Se for anexar domínio, faça **antes** de gravar
  a `homepage` — a chave do projeto no hub é a URL.
- ⚠️ **Confira os links antes de publicar.** O arquivo é de junho/2025: verifique se os destinos
  ainda existem, porque de lá pra cá saíram do ar/mudaram vários domínios (`prolifemed.com.br`
  morreu, `splitjud.com.br` idem). Publicar uma link page com link quebrado é pior que não publicar.

## 2 · `aesthetic-perfection-page` — pronto, mas precisa de um rótulo

**Landing "Lumina Estética & Bem-Estar"**, clínica premium em São Paulo: Hero, Procedimentos,
Antes/Depois (carrossel), Depoimentos, Protocolo, Contato, botão de WhatsApp. Vite + React + shadcn +
Tailwind. Criada e abandonada em 08–09/01/2026, **nunca deployada** (README ainda com o literal
`REPLACE_WITH_PROJECT_ID`).

- **Deploy:** `npm i && npm run build` → `vercel --prod` servindo `dist/`. Sem backend, sem env var.
- 🚨 **A clínica Lumina não existe.** A página promete "agende sua avaliação gratuita", tem
  depoimentos e um botão de WhatsApp. Publicar isso como está cria um site que **se apresenta como um
  negócio real que não existe** — inclusive com um WhatsApp que precisa ir para algum lugar.
  **Publique explicitamente como demo**, no padrão que a casa já usa: a demo Aurora vive em
  `estetia.estetiacrm.com.br/demo`. Lumina vira a **segunda demo da Estética Fábrica** (útil: dois
  visuais para mostrar ao cliente em vez de um).
- **Antes de deployar:** trocar/remover o número de WhatsApp e o `og:image`, que hoje aponta para
  `lovable.dev/opengraph-image-p98pqg.png`. Cabeçalho ou faixa marcando "demonstração".
- **URL sugerida:** `lumina.estetiacrm.com.br` ou `estetia.estetiacrm.com.br/lumina` — não um domínio
  que sugira clínica real.

## 3 · `cannibal_scan` — decidir escopo antes de escrever qualquer coisa

**CannibalScan**: auditor de canibalização de conteúdo SEO que roda **no browser**. Arrasta CSV do
Screaming Frog → parsing pesado em **Rust compilado pra WASM** (custo marginal ~zero, sem servidor) →
botão "Explicar/recomendar" manda os pares a um **agente Mastra** (server-only, OpenRouter) que
devolve auditoria priorizada. Estrutura: `wasm-core/` (crate Rust), `web/` (Next.js App Router +
Mastra), `docs/superpowers/`. Público, 18–20/06/2026.

**Contexto que mudou a prioridade:** este é um dos 3 bets do portfólio nimblabs, e a revisão de 11/07
já apontava **"CannibalScan NÃO INDEXADO"**. Medido em 29/07: o `sitemap.xml` do `nimblabs.com` tem
só `/` e `/blog/*`, e **`nimblabs.com/cannibalscan` dá 404**. Não existe página nenhuma dele hoje.

**A decisão:** landing estática ou o app de verdade?

- **Recomendado: landing primeiro**, no método dos 6 (uma página, um arquivo, zero build, hero =
  a ferramenta rodando). Resolve a `homepage`, resolve o "não indexado", e não depende de toolchain.
- O app real exige **toolchain Rust GNU no Windows** (`rustup default stable-x86_64-pc-windows-gnu`),
  target `wasm32-unknown-unknown` e `wasm-pack`; o pacote WASM em `web/src/wasm/` é **build output
  gitignored** e precisa ser regenerado. Some a chave do OpenRouter. É meia sessão só de ambiente,
  e ⚠️ **não há verba de API paga** — o agente Mastra usa OpenRouter, o que conflita com a regra
  "claude-cli é a única opção". Resolver isso **antes** de prometer o app no ar.
- **URL:** os irmãos são `aftercare.nimblabs.com` e `reviewshield.nimblabs.com` → **`cannibalscan.nimblabs.com`**
  mantém o padrão da família. (Uma página `nimblabs.com/cannibalscan` também serve, mas foge do padrão
  dos outros dois bets.)

## 4 · `aprovai` — o mais caro, e o único com armadilha de identidade

**AprovAI**: análise cadastral de locação imobiliária com IA. MVP inteiro escrito num único dia
(23/03/2026, 5 commits) e nunca mais tocado. Next.js + Prisma + Postgres + Redis + **Evolution API**
(WhatsApp) + Anthropic + **DataJud** + uma API de crédito. Modelos: `Organization`, `User`,
`WhatsAppInstance`, `Analysis`, `Document`. Rotas `(auth)` e `(dashboard)`.

- 🚨 **`aprovai.vercel.app` NÃO é seu.** Responde 200, é um Next.js pt-BR com o title *"AprovAI - Sua
  Plataforma de Estudos Inteligente"*, e a API da Vercel devolve 404 para o projeto `aprovai` no único
  scope da conta. Agora está **duplamente confirmado que é outro produto**: aquele é plataforma de
  estudos, este é análise cadastral de locação. **Gravar aquela URL como `homepage` colocaria o site
  de um terceiro no ranking do hub.** Escolha outro nome de projeto no deploy.
- **Não vai para a Vercel como app.** Tem `Dockerfile`, `docker-compose.prod.yml` e `start.sh` — foi
  feito para **EasyPanel**. Subir o app de verdade significa: Postgres + Redis + instância da Evolution
  API + 3 chaves externas (`ANTHROPIC_API_KEY`, `DATAJUD_API_KEY`, `CREDIT_API_KEY`) + `JWT_SECRET`.
- **Recomendado: landing estática**, mesmo método dos 6. O app completo é um projeto à parte, e não
  há sinal de que ele seja prioridade comercial (zero commits em 4 meses).

---

## O método que já funcionou (reusar, não reinventar)

Direto do [`handoff-seis-sites.md`](handoff-seis-sites.md), que produziu 6 páginas em uma sessão:

1. **Uma página, um arquivo, zero build.** Só `site/index.html`, CSS e JS inline, nenhuma
   dependência. Deploy é `vercel --prod` de dentro de `site/`. Astro aqui só somaria tooling.
2. **O hero é a ferramenta rodando, não uma frase sobre ela.** Anime a saída real do projeto — é o
   que impede N páginas do mesmo template de parecerem N páginas do mesmo template. Roteiro fixo,
   escrito à mão, e a página **diz** que é roteiro.
3. **Identidade de família, alma por projeto.** Mesmo esqueleto (fundo `#E4E7E6`, tinta `#12171A`,
   monoespaçada como display, barra de status no topo) e **uma cor de sinal por página** (`--signal`).
   As 6 já usadas: pinho `#1F6F5C`, ferrugem `#B0442A`, índigo `#3A4FA0`, violeta `#6B3FA0`, ocre
   `#A8761F`, granada `#8C1D45` — **escolha cores novas** para não repetir.
4. **Conteúdo vem do repo, não de invenção.** Números, rotas, nomes de módulo e armadilhas saem do
   README, do `.env.example` e do código.
5. **Numeração só onde é sequência de verdade.**

⚠️ Os itens 1 e 2 valem para `cannibal_scan` e `aprovai`. Os itens **1 e 2 NÃO se aplicam** a
`roi-labs-links` (já tem site) nem a `aesthetic-perfection-page` (já tem landing) — nesses dois o
trabalho é build + deploy + revisão de conteúdo, não escrever página nova.

## Gotchas da execução (todos já custaram tempo)

- ⛔ **Clonar fora do OneDrive.** `vercel --prod` de dentro do OneDrive falha com `UNKNOWN: unknown
  error, read`, sem mencionar OneDrive nem o path. Use `C:\dev\<repo>`.
- **`vercel link --yes --project <nome>`** antes do deploy, senão o projeto nasce com o nome da pasta
  (`site`) e todos colidem.
- **A URL de produção nem sempre é `<projeto>.vercel.app`** — o `seo-forecaster` saiu como
  `seo-forecaster-pi`. **Ler do `vercel project ls`** e confirmar com `curl` **antes** de gravar a
  `homepage`.
- 🚨 **NUNCA `yes | vercel project rm`** — o comando é interativo, não tem `--yes`, e o `yes` apaga
  **projetos vizinhos** (levou `eg`, `eg-site` e `roi-zenith`).
- **`gh repo edit --homepage` não funciona no PowerShell.** Use, pelo Bash tool:
  `echo '{"homepage":"https://…"}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -`
- **A chave de um projeto no hub é a URL, não o repo.** Anexar domínio depois **sem** trocar a
  `homepage` cria um projeto duplicado no ranking em vez de mover o existente.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).

## Depois que os 4 estiverem no ar

- O `<details>` da home fica **vazio** e some sozinho (`semSite.length > 0`).
- Os 4 entram no ranking **com todos os critérios em 0** e vão para o fim da lista até ganharem
  receita/blockers/ação em `data/projects.json`. Isso é esperado, não é bug — mas **um site vazio no
  ar vira card vermelho**, então não deploye casca sem conteúdo.
- Sem `sitemap.xml`/`robots.txt`/`llms.txt` por padrão: são páginas de ferramenta. A exceção é
  `cannibal_scan` — esse é aposta de SEO real e merece o pacote do [[geo_aeo_playbook]].
