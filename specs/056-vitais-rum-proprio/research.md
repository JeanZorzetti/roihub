# Research — 056 Vitais de campo próprios (RUM)

## D1 — Medir no navegador com o que o Next do Sirius já traz

- **Decision**: `useReportWebVitals` de `next/web-vitals`, que embute a lib `web-vitals` do Google
  (`next/dist/compiled/web-vitals`, com `onLCP`, `onINP`, `onCLS`, `onTTFB`), conferido em
  `C:\dev\sirius\node_modules` em 26/09/2026 com Next 16.1.1.
- **Rationale**: é a implementação de referência das métricas da CrUX (FR-001) e já está no
  bundle do Next, então não entra dependência nova. O peso novo é o componente e a lib compilada,
  bem abaixo de 3 KB comprimido (FR-003). O hook registra os observadores num `useEffect`, depois
  da hidratação, e não bloqueia a renderização.
- **Alternatives**: `web-vitals` como dependência direta (mesma lib, um item a mais no
  `package.json` sem ganho); script inline no `<head>` (roda antes do conteúdo, o contrário da
  FR-003).

## D2 — Uma medida por métrica por carregamento, no caminho do carregamento

- **Decision**: (a) o caminho é o do documento carregado (`performance.getEntriesByType
  ("navigation")[0].name`), não o `location` do momento do envio; (b) só envia se o componente
  montou nesse mesmo caminho; (c) um `Set` no módulo manda cada métrica no máximo uma vez por
  carregamento.
- **Rationale**: CLS e INP chegam quando a aba é escondida. No App Router o visitante pode ter
  navegado no cliente para outra página até lá, e `location.pathname` atribuiria a medida à página
  errada. A CrUX atribui ao documento carregado. (b) impede que quem carregou o `/dashboard` e
  navegou no cliente até o blog mande o LCP do dashboard como se fosse do blog. (c) cobre a
  remontagem do layout (troca de idioma) e a volta do cache de navegação, que registrariam os
  observadores de novo.
- **Teto conhecido**: com (c), um CLS ou INP que cresce depois de a aba voltar a ficar visível não
  é reenviado. A primeira vez que a aba fica escondida é quase sempre a saída. Reenviar exigiria
  um id de carregamento no servidor para substituir a medida.

## D3 — Só páginas públicas, e sem as de conta

- **Decision**: montar o coletor em `app/[locale]/(marketing)/layout.tsx` e pular os caminhos de
  conta desse mesmo layout (`login`, `register`, `forgot-password`, `reset-password`,
  `complete-profile`).
- **Rationale**: a área logada fica fora do grupo `(marketing)` (FR-002). As páginas de conta estão
  nele, mas o Google não as ranqueia, e o login é aberto todo dia por quem já é cliente. Num site
  com 56 cliques de busca em 28 dias, ele dominaria a amostra.

## D4 — Envio por `sendBeacon` em texto, sem preflight e sem mexer na CSP

- **Decision**: `navigator.sendBeacon("https://hub.roilabs.com.br/api/vitais", JSON)` com corpo
  string, que sai como `text/plain`.
- **Rationale**: `text/plain` é requisição simples de CORS, então não há preflight, e o beacon não lê
  resposta, então o hub não precisa de cabeçalho CORS. O navegador manda `Origin`, e é por ele que
  o hub resolve o projeto. A CSP do Sirius (`next.config.ts`) já libera `https://*.roilabs.com.br`
  em `connect-src`. Sem `sendBeacon`, não envia (nenhum fallback com `fetch`).

## D5 — O projeto sai do `Origin`, pela curadoria, sem rede

- **Decision**: helper em `lib/projects.ts` que lê a curadoria (como `dominioAnteriorDoSlug`) e
  devolve o slug de `SLUGS_DE_CAMPO` cujo `hostsDeclarados()` contém o host do `Origin`, sem `www.`.
- **Rationale**: FR-014 sem lista nova de hosts. `listProjects()` chamaria a API do GitHub a cada
  beacon; o campo `url` que decide o host só existe na curadoria. Princípio I: a leitura continua
  dentro de `lib/projects.*`.

## D6 — Filtro de entrada (FR-005)

- **Decision**: recusa, com 204 e sem gravar: `Origin` sem projeto; `User-Agent` que casa
  `bot|crawl|spider|lighthouse|headless|pagespeed|inspectiontool|gtmetrix|pingdom`; métrica fora de
  `LCP|INP|CLS|TTFB`; valor não finito, negativo ou acima do teto (60.000 ms para LCP, INP e TTFB;
  10 para CLS); caminho que não começa com `/` ou passa de 300 caracteres; corpo acima de 512
  bytes; mais de 20 medidas por minuto do mesmo endereço.
- **Rationale**: 204 em toda recusa, porque o navegador ignora a resposta e o status não deve
  ensinar a quem sonda qual filtro pegou. O limite por endereço é um `Map` em memória zerado a cada
  minuto. O endereço nunca vai ao banco (FR-004). Um carregamento manda no máximo 4 medidas, e 20
  por minuto cobre 5 carregamentos. Teto conhecido: com mais de uma réplica, o limite vale por
  réplica. Hoje o hub roda uma.

## D7 — Veredito pelo intervalo da 033, contra 25%

- **Decision**: para cada vital, `acima` = medidas com valor acima do limite, `n` = medidas.
  `vereditoContraRegua(acima, n, 0.25)` de `lib/intervalo.mjs`: `atinge` (inferior ≥ 25%) → **fora**;
  `abaixo` (superior < 25%) → **dentro**; `indecisa` → **não decide**. O p75 exibido é o empírico
  por posto mais próximo (o valor na posição ⌈0,75·n⌉ da lista ordenada).
- **Rationale**: p75 ≤ limite equivale a no máximo 25% das visitas acima do limite. O intervalo de
  Wilson é o que a casa usa para veredito desde a 033, e ele decide sozinho quando a amostra basta.
  Com `acima/n` > 25%, o p75 por posto fica acima do limite, e com `acima/n` < 25% fica dentro.
  Então o número exibido e o veredito nunca se contradizem. O limite vem de `VITAIS` (FR-010).

## D8 — Quando o RUM entra no lugar da CrUX

- **Decision**: num vital, o RUM entra quando `vitalPorOrigem()` devolve `sem-amostra` ou `parcial`
  **e** o projeto tem alguma medida gravada nos últimos 90 dias (coletor instalado). Nos outros
  estados (`medido`, `falhou`, `sem-chave`) e sem coletor instalado, a folha fica exatamente como
  hoje.
- **Rationale**: FR-007 e SC-005. A Atma tem o INP em `parcial` e nenhum coletor. Trocar a folha
  dela para "nenhuma visita no RUM" apagaria a explicação da CrUX, que é mais útil. "Instalado" é
  inferido do próprio dado: não existe lista de projetos com RUM para manter.

## D9 — URLs boas: veredito misto por URL

- **Decision**: o Pass Rate da CrUX segue igual. Para cada URL em `sem-amostra` nele, com coletor
  instalado, entra o veredito do RUM daquela URL (host e caminho, barra final normalizada): passa
  com LCP, INP e CLS **dentro**; reprova com qualquer um **fora**; senão fica indecisa, ou
  sem-amostra se o RUM também não tem nada. A fração exige duas URLs decididas.
- **Rationale**: FR-011. A regra de "passa" continua sendo a da CrUX (três vitais), e a de decidir
  é a de D7. Com o tráfego do Sirius, "não apurável" é o resultado esperado por semanas, e a folha
  diz quantas URLs têm alguma medida.

## D10 — Retenção e janela

- **Decision**: janela = `[current_date − 28, current_date)` no relógio do banco (FR-012). O
  `DELETE` de medidas com mais de 90 dias roda na leitura do mapa (FR-015).
- **Rationale**: é o padrão de `liberarAnexosVencidos`, que roda na renderização do quadro: não
  cria cron novo na janela da madrugada, e um atraso de dias é irrelevante para 90 dias de
  carência.
