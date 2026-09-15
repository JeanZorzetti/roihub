# Research: Avisos no Telegram — 026

Todas as decisões abaixo partem de leitura do código e do git em 15/09/2026. Nenhuma pergunta
ficou aberta no Technical Context.

## R1. Onde o aviso de lead nasce

- **Decision**: na rota de ingestão do hub, `POST /api/crm/leads`, depois do `insertLead`, só com
  `created: true` e pipeline `sirius` ou `estetiacrm`.
- **Rationale**: todo lead das duas pipelines já passa por ali, e `created` é o dedupe pronto —
  `insertLead` devolve `false` no reenvio pelo `UNIQUE(external_id)`. A FR-002 sai sem uma linha de
  lógica nova.
- **Alternatives considered**: cada produto avisar no envio do formulário (duplica em 2 repos e
  perde o dedupe do hub); cron no hub varrendo `crm_leads` (latência de minutos e um estado de "já
  avisei" para guardar).

## R2. Como o ticket chega ao hub

- **Decision**: o produto chama `POST /api/avisos/ticket` pelo mesmo `lib/roihub-crm.ts`, dentro de
  `after()`, sem nunca lançar.
- **Rationale**: o ticket só existe no banco do produto, e os dois produtos já têm endereço do hub,
  segredo e o padrão best-effort para falar com ele.
- **Alternatives considered**: hub lendo o banco dos produtos (a porta do Postgres da Sirius dá
  `ETIMEDOUT` fora da VPS, registrado no card `sirius`; exigiria credencial de banco de cliente no
  hub, poll e estado); produto falando direto com o Telegram (token do bot em 3 ambientes e texto da
  mensagem em 3 lugares, contra o pedido de a feature morar no hub).

## R3. Segredo da rota nova

- **Decision**: reusar `CRM_INGEST_SECRET` (nos produtos, `ROIHUB_CRM_SECRET`).
- **Rationale**: é a regra já escrita no `middleware.ts` e no `CLAUDE.md` — segredo próprio é para
  capacidade MAIOR. Mandar uma mensagem ao dono é capacidade menor que gravar lead no CRM.
- **Alternatives considered**: `AVISOS_SECRET` próprio — mais uma chave em 3 ambientes, nada a mais
  protegido.

## R4. Link do ticket

- **Decision**: o hub monta o link de um mapa fixo — `sirius` → `https://siriuscrm.com.br`,
  `estetiacrm` → `https://estetiacrm.com.br` — mais `/admin/support/<ticket_id>`, com `ticket_id`
  validado.
- **Rationale**: é o caminho que os e-mails de staff dos dois produtos já usam
  (`lib/email-templates/support/new-ticket-staff.tsx`). Aceitar `url` no payload deixaria qualquer
  chamador com o segredo pôr um link arbitrário no Telegram do dono.
- **Alternatives considered**: o produto mandar a `url` pronta — aceita qualquer link.

## R5. Formatação da mensagem

- **Decision**: `parse_mode: "HTML"`, escapando `&`, `<` e `>` em todo texto vindo de fora.
- **Rationale**: são 3 caracteres. MarkdownV2 exige escapar 18, e um esquecido derruba o envio com
  400 — a FR-012 vira loteria.
- **Alternatives considered**: texto puro — sem negrito, o título não se destaca do corpo.

## R6. Envio e falha

- **Decision**: `fetch` nativo com `AbortSignal.timeout(8000)`, sem retry nem fila. Na rota de
  leads, dentro de `after()`. Na rota de ticket, aguardado: responde 200 ou 502.
- **Rationale**: best-effort é premissa da spec — o lead fica no CRM e o ticket gera e-mail. Na rota
  de ticket o chamador já está em `after()`, então aguardar não atrasa ninguém e o status serve de
  prova no quickstart.
- **Alternatives considered**: fila com reenvio (persistência nova para evento que já tem cópia).
- **Armadilha**: o token vai **na URL** (`/bot<token>/sendMessage`). Nenhum log imprime a URL nem o
  objeto de erro do `fetch`; só `res.status`, `description` do Telegram ou `err.name`.

## R7. Quais pipelines avisam

- **Decision**: constante `["sirius", "estetiacrm"]` em `lib/avisos.mjs`.
- **Rationale**: é o escopo da spec; mudar é editar uma linha.
- **Alternatives considered**: variável de ambiente com a lista — config para um valor que não muda.

## R8. Rótulos e texto

- **Decision**: categoria e prioridade com os rótulos que o painel dos produtos já mostra
  (`CATEGORY_LABELS` em `admin/support/[id]/page.tsx`, `components/support/ticket-priority-badge.tsx`),
  com o valor cru como reserva; título `<evento> · <produto>`; prioridade alta ou urgente na frente
  do título. Texto final em [contracts/avisos.md](contracts/avisos.md); termos em `GLOSSARIO.md`.
- **Rationale**: a prévia da notificação no celular mostra ~40 caracteres — evento, produto e
  urgência têm de caber ali. Rótulo igual ao do painel evita dois nomes para a mesma coisa.
- **Alternatives considered**: enum cru (`HIGH`, `FEATURE_REQUEST`) — termo de banco na tela do dono.

## R9. Os commits de lead que não subiram

- **Decision**: Estetia — push de `88352ee`. Sirius — cherry-pick de `9a0b5e81` no
  `CRM/crm-project`, commitando só os arquivos do cherry-pick.
- **Rationale**: medido no git — Estetia está 1 à frente e 0 atrás do `origin/main`; o clone
  `C:\dev\sirius` está 1 à frente e 27 atrás, e o `CRM/crm-project` (em dia com o `origin`) não tem o
  código. O handoff `handoff/funil-seo/00-LEIA-PRIMEIRO.md` marca os dois como "ENTREGUE 01/09 ·
  falta env" — o "entregue" é falso e é corrigido no mesmo trabalho.
- **Alternatives considered**: reescrever o helper de lead da Sirius no `main` atual — o commit
  existe, tem 101 linhas e é o mesmo da Estetia; reescrever só arrisca divergir.
