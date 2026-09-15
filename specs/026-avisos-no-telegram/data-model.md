# Data Model: Avisos no Telegram — 026

Nada é gravado: nenhuma tabela, coluna ou migração nova. Os três avisos são derivados de dados que
já existem e morrem no envio.

## Aviso de lead novo

Derivado da linha recém-criada em `crm_leads` (hub).

| Campo | Origem | Regra |
|---|---|---|
| produto | `data/pipelines.json` → `nome` da pipeline, sem o trecho entre parênteses | só `sirius` e `estetiacrm` geram aviso |
| canal | parte de `origem` depois de `:` | `contato` → "pelo formulário de contato"; `calculadora-roi` → "pela calculadora de ROI"; outro valor → "via <valor>" |
| nome | `nome` | obrigatório na ingestão |
| e-mail | `email` | linha omitida quando nulo |
| telefone | `telefone` | linha omitida quando nulo |

**Dispara quando**: `insertLead` devolve `created: true`. Reenvio (`created: false`) não dispara.

## Aviso de ticket novo

Derivado do `SupportTicket` recém-criado no produto, recebido em `POST /api/avisos/ticket`.

| Campo | Origem | Regra |
|---|---|---|
| produto | `produto` do payload | `sirius` ou `estetiacrm`; outro valor → 400 |
| ticket_id | `ticket.id` | 1–64 caracteres `[A-Za-z0-9-]`; outro valor → 400 |
| organização | `ticket.organization.name` | obrigatória, até 200 caracteres |
| assunto | `ticket.subject` | obrigatório, até 200 caracteres (o produto já limita a 5–200) |
| categoria | `ticket.category` | rótulo do painel; valor desconhecido sai cru |
| prioridade | `ticket.priority` | `HIGH`/`URGENT` vão para o título; `LOW`/`NORMAL` ficam no corpo |

**Nunca inclui**: `description`.

## Aviso de cliente respondeu

Derivado do `SupportMessage` recém-criado no produto quando o autor **não** é staff.

| Campo | Origem | Regra |
|---|---|---|
| produto, ticket_id, organização, assunto | ticket da mensagem | as mesmas do aviso de ticket novo |

**Dispara quando**: `!ctx.isRoiLabsStaff` na rota de mensagem. Resposta de staff e nota interna
(`isInternal`, que só staff consegue marcar) não disparam.

**Nunca inclui**: `content` da mensagem.
