# Contract: Avisos — 026

## 1. `POST /api/avisos/ticket` (produto → hub)

**Autenticação**: `Authorization: Bearer <CRM_INGEST_SECRET>`, checada no `middleware.ts` — o mesmo
segredo de `POST /api/crm/leads`. Sem ele: `401 { "error": "unauthorized" }`.

**Corpo** (`application/json`):

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `produto` | string | sim | `"sirius"` ou `"estetiacrm"` |
| `tipo` | string | sim | `"novo"` ou `"resposta"` |
| `ticket_id` | string | sim | 1–64 caracteres, `[A-Za-z0-9-]` |
| `assunto` | string | sim | aparado; 1–200 caracteres |
| `organizacao` | string | sim | aparado; 1–200 caracteres |
| `categoria` | string | não | enum `TicketCategory`; ignorado em `resposta` |
| `prioridade` | string | não | enum `TicketPriority`; ignorado em `resposta` |

Exemplo:

```json
{
  "produto": "sirius",
  "tipo": "novo",
  "ticket_id": "4f7c2b1e-9a0d-4c55-8e21-3b6f0d9a7c12",
  "assunto": "Não consigo exportar contatos",
  "organizacao": "Clínica Bella",
  "categoria": "BUG",
  "prioridade": "URGENT"
}
```

**Respostas**:

| Status | Corpo | Quando |
|---|---|---|
| 200 | `{ "enviado": true }` | Telegram aceitou a mensagem |
| 400 | `{ "error": "<motivo>" }` | JSON inválido ou campo fora da regra |
| 401 | `{ "error": "unauthorized" }` | segredo ausente ou errado |
| 502 | `{ "error": "telegram <status>" }` ou `{ "error": "telegram indisponível" }` | Telegram recusou, caiu ou passou de 8 s |
| 503 | `{ "error": "missing-env", "fields": ["TELEGRAM_BOT_TOKEN", …] }` | ambiente do bot ausente, vazio ou só espaços |

Nenhuma resposta ecoa token, chat id ou segredo.

**Lado do produto**: chamada dentro de `after()`, nunca lança; status fora de 2xx vira uma linha de
log com o status e nada mais.

## 2. Mensagens (hub → Telegram)

`sendMessage` com `parse_mode: "HTML"` e prévia de link desligada. Todo texto vindo de fora passa por
escape de `&`, `<`, `>`. Título: `<evento> · <produto>` — é a linha que cabe na prévia da notificação.

### Lead novo

```text
🟢 <b>Lead novo · Sirius CRM</b>
Maria Souza, pela calculadora de ROI
maria@exemplo.com
11 99999-0000
<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>
```

Sem e-mail ou sem telefone, a linha correspondente some.

### Ticket novo

Prioridade baixa ou normal:

```text
🎫 <b>Ticket novo · Estetia CRM</b>
Clínica Bella
“Não consigo exportar contatos”
Dúvida · prioridade normal
<a href="https://estetiacrm.com.br/admin/support/<id>">Responder no painel</a>
```

Prioridade alta ou urgente — a prioridade vai para a frente do título e sai do corpo:

```text
🔴 <b>Urgente · Ticket novo · Sirius CRM</b>
Clínica Bella
“Não consigo exportar contatos”
Bug
<a href="https://siriuscrm.com.br/admin/support/<id>">Responder no painel</a>
```

Alta usa `🟠 <b>Prioridade alta · Ticket novo · <produto></b>`.

### Cliente respondeu

```text
💬 <b>Cliente respondeu · Sirius CRM</b>
Clínica Bella
“Não consigo exportar contatos”
<a href="https://siriuscrm.com.br/admin/support/<id>">Responder no painel</a>
```

### Rótulos

| Enum | Rótulo |
|---|---|
| `BUG` · `QUESTION` · `FEATURE_REQUEST` · `BILLING` · `ONBOARDING` · `OTHER` | Bug · Dúvida · Sugestão · Financeiro · Onboarding · Outro |
| `LOW` · `NORMAL` · `HIGH` · `URGENT` | baixa · normal · alta · urgente |

Os mesmos do painel de suporte dos produtos. Valor fora da lista sai cru, e a mensagem não falha.

### Antes → depois (ux-writing)

| Antes (rascunho da spec) | Depois | Motivo |
|---|---|---|
| "Lead novo — Estetia CRM (clínicas de estética)" | "Lead novo · Estetia CRM" | Corta: a prévia mostra ~40 caracteres e o parêntese empurra o produto para fora |
| "Origem: estetiacrm:calculadora-roi" | "Maria Souza, pela calculadora de ROI" | É do usuário: `estetiacrm:calculadora-roi` é chave de banco |
| "Nome: / E-mail: / Telefone:" | só os valores | Corta: e-mail e telefone se reconhecem pelo formato |
| "Ticket aberto" | "Ticket novo" | "Aberto" é status do ticket; o aviso fala do evento e casa com "Lead novo" |
| "Prioridade: HIGH" no corpo | "🟠 Prioridade alta ·" no título | Acionável: a urgência precisa estar na prévia, antes de abrir a mensagem |
| "Categoria: FEATURE_REQUEST" | "Sugestão" | É do usuário: mesmo rótulo do painel |
| link cru `https://…/admin/support/…` | "Responder no painel" | Verbo + objeto: diz o que fazer agora |
