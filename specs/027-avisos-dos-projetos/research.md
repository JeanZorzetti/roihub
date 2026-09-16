# Research: Avisos no Telegram — Atma, ROI Labs, Vértice e Coopluz (027)

Fatos medidos em 16/09/2026. Cada decisão cita o que a motivou.

## R1 — Uma rota genérica no hub, com o texto montado na origem

**Decision**: `POST /api/avisos/evento` recebe `projeto`, `titulo`, `texto`, `caminho` e `acao`.
O hub escapa o texto, põe o nome do projeto no título, monta o link a partir de uma base fixa por
projeto e envia. Cada origem monta o próprio texto.

**Rationale**: são 11 eventos em 3 repositórios, cada um com campos diferentes. Uma rota tipada
por evento (como a `/api/avisos/ticket` da 026) poria no hub o conhecimento de pedido, assinatura,
parceria e paciente, e cada campo novo exigiria deploy do hub e do produto. O ROI Labs já produz
título e corpo prontos no `sendAlert`: a rota só precisa receber isso.

**O que continua no hub, e por quê**:
- **Escape**: o hub é o único que fala com a Bot API em `parse_mode: HTML`. Se o escape ficasse na
  origem, um projeto que o esquecesse derrubaria o próprio envio com 400.
- **Base do link**: repete a regra da 026 (`lib/avisos.mjs`, comentário do `PAINEL`). Quem tem o
  segredo escolhe só o caminho, nunca o domínio.
- **Nome do projeto no título**: é o que a FR-015 exige, e fica igual em todas as origens.

**Alternatives considered**:
- *Uma rota tipada por evento*: rejeitada pelo custo de manutenção descrito acima.
- *Cada projeto fala direto com o Telegram*: cada um precisaria de token e chat id, o que dá 3
  cópias da credencial do bot em vez de 1 segredo que três já têm ou vão ter. O escape e o corte
  também seriam reimplementados em JS, TS e CommonJS. Rejeitada.

## R2 — O segredo é o `CRM_INGEST_SECRET`

**Decision**: a rota nova entra no mesmo bloco do middleware que `/api/crm/leads` e
`/api/avisos/ticket`, agora por prefixo (`/api/avisos/`). Nos projetos, as variáveis têm os nomes
já usados na Vértice, na Sirius e na Estetia: `ROIHUB_CRM_SECRET` (obrigatória) e
`ROIHUB_CRM_URL` (opcional, com padrão `https://hub.roilabs.com.br`).

**Rationale**: a FR-017 pede o mesmo nível de confiança da ingestão. Atma e ROI Labs já têm
pipelines cadastradas no hub (`atma`, `roilabs`), então são fontes legítimas de lead. Receber o
segredo que grava lead não dá a eles nenhuma capacidade fora do papel que já têm. Com o prefixo,
uma rota de aviso nova já nasce fechada.

**Alternatives considered**: um `AVISOS_SECRET` próprio seria mais uma chave para guardar em 4
lugares, sem proteger nada a mais, porque a capacidade dele é menor que a do segredo de ingestão
(mesmo raciocínio do comentário de `/api/paginas` no `middleware.ts`). Rejeitado.

## R3 — Vértice: uma linha no hub

**Decision**: `verticemarketing` entra em `PIPELINES_COM_AVISO`.

**Rationale**: o lead da Vértice já passa por `POST /api/crm/leads` (`lib/actions/submit-lead.ts`,
origem `verticemarketing:contato`). O `avisoDeLead` da 026 já trata `contato` ("pelo formulário de
contato") e já corta o parêntese de "Vértice Marketing (agência)". O dedupe vem do
`UNIQUE(external_id)` e do agrupamento de 2 minutos da própria Vértice.

**Risco medido**: o hub tem 1 lead dessa pipeline, de 16/08. Não dá para saber, sem o painel da
Vercel, se `ROIHUB_CRM_SECRET` continua lá. Sem ele, a Vértice mostra erro ao visitante (ela falha
fechado), o que é diferente da 026. O quickstart envia um lead real antes de tudo.

## R4 — Coopluz: `waitUntil` do `@vercel/functions`

**Decision**: em `src/pages/api/lead.ts`, quando `gravarLead` devolve `created: true`, chamar
`waitUntil(avisar(...))`. O `@vercel/functions` vira dependência direta.

**Rationale**: a Coopluz é Astro na Vercel (`@astrojs/vercel` 8.2.9, função Node). Uma promise
solta depois da resposta pode ser congelada junto com a função. O adapter não expõe `waitUntil`
em `locals` nas funções serverless: o `entrypoint.js` só repassa os `locals` do middleware, e a
dica de `ctx.locals.waitUntil` do código vale só para o middleware de borda. O
`@vercel/functions` 2.2.13 já está no `node_modules` como dependência do adapter. Declará-lo no
`package.json` não baixa nada novo e evita importar uma dependência indireta.

**Alternatives considered**:
- *`await` com timeout curto*: somaria até o timeout ao envio do formulário. Com o hub na VPS sob
  steal, isso quebraria a FR-016. Rejeitado.
- *Mandar o lead da Coopluz ao CRM do hub*: o hub não tem a pipeline, e a Coopluz já tem CRM (o
  admin do autogestor). Seria um segundo CRM para o mesmo lead. Rejeitado.

## R5 — Atma: chamada solta, fora do `notificationService`

**Decision**: um `services/avisoRoihub.js` com funções puras (`avisoPaciente`, `avisoParceria`) e
um `avisar()` que nunca lança. Os dois controllers chamam `avisar()` sem `await`, depois do
`INSERT`. No paciente, só quando `!req.isAdmin`.

**Rationale**:
- O backend é Express num contêiner Node 20 de vida longa, então uma promise solta termina
  normalmente. O `fetch` é nativo.
- O `notificationService.notifyNewPatient` já existe, mas só envia se as chaves
  `notification_*` de `system_settings` estiverem ligadas. O padrão delas é desligado, e o único
  canal é o e-mail. Pendurar o Telegram nele deixaria o aviso refém de uma configuração de banco
  que ninguém conferiu.
- `req.isAdmin` já é calculado pelo `identifyAdmin` para toda requisição. Cadastro manual no
  painel usa a mesma rota com `x-admin-key`.
- As observações do paciente ficam de fora pela FR-003. Na parceria, `mensagem` e
  `valorParteClinica` também ficam de fora: são texto livre e valor comercial, e o link leva ao
  CRM.
- O duplicado já é barrado antes do `INSERT` (409 por e-mail ativo e por CRO), então o aviso só
  sai para lead criado.

**Risco**: o bot do WhatsApp não está em nenhum repositório de `C:\dev`. Se ele manda
`x-admin-key`, os leads dele não vão avisar. O quickstart confere isso no log do backend.

**Links**: o painel da Atma não tem página por paciente, só `/admin/pacientes` (lista, kanban e
agenda). A parceria vai para `crm_leads` → `/admin/crm`.

## R6 — ROI Labs: terceiro canal no `sendAlert`

**Decision**: `sendAlert(subject, html)` em `src/lib/email.ts` passa a chamar também
`avisarRoihub(alertaParaAviso(subject, html))`. A conversão é pura, mora em
`src/lib/aviso-telegram.ts` e tem teste próprio (`test/aviso-telegram.test.mjs`, registrado no
script `test`).

**Conversão** (`alertaParaAviso`):
- **Título**: o `subject` até o primeiro " — ", com as entidades desfeitas. "💰 Pedido pago — Maria ·
  R$ 900" vira "💰 Pedido pago". O nome e o valor já estão no corpo.
- **Link**: o primeiro `<a href="https://app.roilabs.com.br/...">`. O caminho vai em `caminho`, e o
  texto da âncora em `acao` ("Abrir no admin"). A âncora sai do corpo para não aparecer duas vezes.
  Um link de outro domínio fica só como texto.
- **Corpo**: `</p>`, `<br>`, `</li>`, `</h2>` e `</ul>` viram quebra de linha, `<li>` vira "• ", as
  demais tags somem, as entidades são desfeitas, e linhas vazias e espaços repetidos saem. É o
  mesmo tratamento que o canal ntfy já faz, mas preservando as linhas.

**Rationale**: o `sendAlert` já é o ponto único de "alerta interno" do painel. Os 6 chamadores
existentes (candidatura, lead de consumidor, pedido pago, frete quebrado, carteira e resumo
semanal) ganham Telegram sem mudar nenhuma linha. É exatamente a FR-014.

**Eventos novos** (FR-010 a FR-013), todos por `sendAlert`:

| Evento | Onde | Trava contra repetição |
|---|---|---|
| Pedido pago abre assinatura | alerta existente ganha a linha "Assinatura: renova sozinha a cada ciclo." quando `cancelToken` existe | a do webhook (`mpPaymentId` + `pendente`) |
| Pagamento devolvido / contestação | ramo `refunded`/`charged_back` do webhook | **nova**: só alerta se `pedido.statusPagamento !== 'reembolsado'` antes do update. Hoje o ramo regrava a cada notificação repetida |
| Renovação recusada | ramo `decisao.acao === 'falha'`, dentro do `if (decisao.setarJanela)` que já manda o e-mail ao cliente | `setarJanela` só é verdadeiro na 1ª falha da sequência (FR-004 da spec 014 do ROI Labs) |
| Assinatura cancelada pelo cliente | `api/assinaturas/cancelar`, caminho do `token`, depois do `cancelarAssinatura` | `decidirCancelamento` devolve `noop` para assinatura já cancelada |
| Assinatura cancelada pelo sistema | `api/cron/assinaturas`, depois de cada `cancelarAssinatura` bem-sucedido | a assinatura sai de `inadimplente` e não volta à varredura |

`JANELA_DIAS` (7) sai do `cron/assinaturas/route.ts` para `lib/assinaturas.ts`, porque o alerta de
renovação recusada precisa da data do cancelamento. Uma constante com dois donos acabaria
divergindo.

O corpo dos alertas de assinatura precisa de nome e WhatsApp do pedido. `Assinatura` tem
`pedidoId` e `slug`. Um helper `alertarCancelamento(assinaturaId, quem)` em `lib/assinaturas.ts`
busca o pedido e chama `sendAlert`, e os dois caminhos de cancelamento o usam.

**Alternatives considered**: chamar o hub nos 5 pontos novos e deixar os 6 antigos sem Telegram
contraria a FR-014. Rejeitado.

## R7 — Vigia da Atma: Cloudflare Worker com Cron Trigger

**Decision**: um Worker (`vigia/worker.mjs` no roihub) roda a cada 2 minutos, consulta
`https://atmaapi.roilabs.com.br/api/system/health` e guarda o estado numa chave do Workers KV. A
lógica de transição é pura, em `lib/vigia.mjs`, e testada por `node --test`. O envio reusa
`enviarTelegram` de `lib/avisos.mjs`. O Worker tem `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID`
como secrets próprios.

**Rationale**:
- **Fora da VPS** (FR-009): o hub e o backend da Atma dividem a VPS.
- **Pontualidade** (SC-002, ≤ 15 min): a documentação do GitHub Actions diz que o `schedule` "can
  be delayed during periods of high loads… some queued jobs may be dropped", com picos na virada
  de cada hora. O Cron Trigger do Worker roda no minuto.
- **Custo zero**: no plano Free, 5 Cron Triggers por conta, 100.000 requisições por dia e 10 ms de
  CPU por invocação. A espera do `fetch` não conta como CPU. No KV Free, 100.000 leituras e 1.000
  escritas por dia. O vigia faz 720 leituras por dia e no máximo 3 escritas por queda.
- **2 minutos, não 1**: uma escrita no KV pode levar alguns segundos para aparecer em outra região.
  Com duas execuções seguidas em regiões diferentes a menos de um minuto, a segunda poderia ler o
  estado antigo e mandar a queda duas vezes. Com 2 minutos de intervalo, essa janela fica de fora,
  e o limite de 10 minutos continua com 5 checagens de resolução.
- **O que é "fora"**: sem resposta em 10 s, status fora de 2xx ou `status !== "OK"` no corpo. O
  `/health` responde 200 mesmo sem banco, de propósito (comentário no `server.js`), e diz o estado
  no corpo.

**Máquina de estados** (detalhe em data-model.md): a queda é registrada na 1ª checagem ruim, o
aviso sai quando ela completa 10 minutos, e a volta só avisa se a queda foi avisada. Uma oscilação
curta limpa o estado em silêncio. O estado só é gravado depois de o Telegram aceitar: um envio que
falha é tentado de novo na execução seguinte.

**Alternatives considered**:
- *GitHub Actions `*/5`*: o roihub é público (minutos grátis) e já tem workflows agendados, mas o
  atraso documentado derruba a SC-002 justo na hora de pico, e o estado entre execuções exigiria
  improvisar com o cache do Actions. Rejeitado.
- *Dead-man's switch (Healthchecks.io) com ping saindo da Atma*: não enxerga a URL pública (proxy
  ou DNS quebrado com contêiner saudável), e o webhook não fornece a duração da queda. Rejeitado.
- *Vigia no hub*: cai junto com a VPS. Rejeitado pela FR-009.
- *Durable Object*: dá consistência forte, mas é mais código para um estado de 3 campos que muda
  poucas vezes por mês. Rejeitado.

**Custo operacional**: o dono faz uma vez `npx wrangler login`, cria o namespace KV e grava 2
secrets (quickstart §1). Não entra dependência no `package.json`: o `wrangler` roda por `npx`.

## R8 — Horário em BRT sem depender do fuso do ambiente

**Decision**: o texto do vigia formata a hora com deslocamento fixo de −3 h.

**Rationale**: o Worker roda em UTC, e o Brasil não tem horário de verão desde 2019. Um
deslocamento fixo é determinístico no teste. `Intl` com `timeZone` depende dos dados de fuso de
cada ambiente, e no Windows de desenvolvimento o `TZ` já enganou antes. Se o horário de verão
voltar, a troca é trocar a constante por `Intl` e ajustar o teste.

## R9 — Corte da mensagem

**Decision**: o hub corta `texto` em 3.500 caracteres (com "…") e `titulo` em 120, antes do
escape.

**Rationale**: a Bot API limita `text` a 4.096 caracteres **depois** do parse das entidades, então
a medida é o texto visível, sem as tags. 3.500 + título + link fica abaixo disso com folga. O
resumo semanal do ROI Labs, com a tabela de rank no fim, é o único alerta que chega perto.
