# Contract: Avisos — 027

Complementa [026/contracts/avisos.md](../../026-avisos-no-telegram/contracts/avisos.md). O envio,
o escape e o formato `parse_mode: HTML` com prévia de link desligada são os mesmos.

## 1. `POST /api/avisos/evento` (projeto → hub)

**Autenticação**: `Authorization: Bearer <CRM_INGEST_SECRET>`, checada no `middleware.ts` para
todo caminho que começa com `/api/avisos/`. Sem o segredo, a resposta é
`401 { "error": "unauthorized" }`.

**Corpo** (`application/json`):

| Campo | Tipo | Obrigatório | Regra |
|---|---|---|---|
| `projeto` | string | sim | `"atma"`, `"roilabs"` ou `"coopluz"` |
| `titulo` | string | sim | aparado; vazio → 400; acima de 120 caracteres é cortado |
| `texto` | string | não | aparado; quebras de linha mantidas; acima de 3.500 caracteres é cortado e ganha "…" |
| `caminho` | string | não | `^/[A-Za-z0-9/_-]{0,199}$`, senão → 400 |
| `acao` | string | não | aparado; até 40 caracteres; padrão `"Abrir no painel"`; ignorado sem `caminho` |

Exemplo:

```json
{
  "projeto": "atma",
  "titulo": "🟢 Lead novo",
  "texto": "Maria Souza, paciente\nmaria@exemplo.com\n62 99999-0000\nGoiânia/GO",
  "caminho": "/admin/pacientes"
}
```

**Respostas**: as mesmas de `/api/avisos/ticket`.

| Status | Corpo | Quando |
|---|---|---|
| 200 | `{ "enviado": true }` | o Telegram aceitou a mensagem |
| 400 | `{ "error": "<motivo>" }` | JSON inválido ou campo fora da regra |
| 401 | `{ "error": "unauthorized" }` | segredo ausente ou errado |
| 502 | `{ "error": "telegram <status>: <description>" }` ou `{ "error": "telegram indisponível" }` | o Telegram recusou, caiu ou passou de 8 s |
| 503 | `{ "error": "missing-env", "fields": [...] }` | ambiente do bot ausente |

**Montagem** (hub):

```text
<b>{titulo}{ · Projeto, se o nome não estiver no título}</b>
{texto}
<a href="{base do projeto}{caminho}">{acao}</a>
```

Tudo o que vem do corpo passa por `escaparHtml`. A base do link é fixa por projeto
(data-model.md). O chamador escolhe só o caminho.

**Lado do projeto**: a chamada nunca lança e nunca atrasa a resposta a quem preencheu.

| Projeto | Como a chamada fica solta |
|---|---|
| Atma (Express, contêiner) | `avisar(...)` sem `await` |
| ROI Labs (Next, contêiner) | dentro do `sendAlert`, que já é fire-and-forget |
| Coopluz (Astro, Vercel) | `waitUntil(avisar(...))` |

Sem `ROIHUB_CRM_SECRET`, o projeto registra uma linha de log com o nome da variável e não chama o
hub. Uma resposta fora de 2xx vira uma linha de log com o status.

## 2. Vigia (Worker → Telegram direto)

Não tem interface HTTP. O Worker roda pelo Cron Trigger `*/2 * * * *`, lê a chave `atma` do KV
`VIGIA` e fala direto com a Bot API por `enviarTelegram`.

| Binding / variável | Tipo | Valor |
|---|---|---|
| `VIGIA` | KV namespace | criado no quickstart §1 |
| `ALVO_URL` | var (`wrangler.toml`) | `https://atmaapi.roilabs.com.br/api/system/health` |
| `TELEGRAM_BOT_TOKEN` | secret | o mesmo do hub |
| `TELEGRAM_CHAT_ID` | secret | o mesmo do hub |

## 3. Mensagens

Hora sempre em BRT (UTC−3), `HH:MM`. Data `dd/mm`.

### Lead novo · Vértice (hub, `avisoDeLead` da 026)

```text
🟢 <b>Lead novo · Vértice Marketing</b>
Maria Souza, pelo formulário de contato
maria@exemplo.com
62 99999-0000
<a href="https://hub.roilabs.com.br/crm">Abrir no CRM do hub</a>
```

### Lead novo · Coopluz

```text
🟢 <b>Lead novo · Coopluz</b>
Maria Souza, pela página Energia Coopluz
62 99999-0000
Conta de luz: R$ 251 a R$ 500
<a href="https://admin.autogestor.roilabs.com.br/leads">Abrir no painel</a>
```

Na página Parceiro Coopluz Goiás, a última linha é `Cidade: Anápolis`. Sem o terceiro campo, a
linha some.

### Lead novo · Atma

```text
🟢 <b>Lead novo · Atma</b>
Maria Souza, paciente
maria@exemplo.com
62 99999-0000
Goiânia/GO
<a href="https://atmaadmin.roilabs.com.br/admin/pacientes">Abrir no painel</a>
```

Sem telefone ou sem cidade, a linha some. As observações nunca entram.

### Pedido de parceria · Atma

```text
🤝 <b>Pedido de parceria · Atma</b>
Dr. João Lima, Clínica Sorriso
Anápolis/GO
joao@clinica.com
62 98888-0000
<a href="https://atmaadmin.roilabs.com.br/admin/crm">Abrir no painel</a>
```

### Fora do ar · Atma (vigia)

```text
🔴 <b>Fora do ar · Atma</b>
Backend sem resposta desde 14:32 de 16/09
<a href="https://atmaapi.roilabs.com.br/api/system/health">Abrir a checagem</a>
```

Motivos: `sem resposta` · `com erro 502` · `sem banco de dados` · `com resposta inesperada`.

### De volta · Atma (vigia)

```text
✅ <b>De volta · Atma</b>
Backend ficou fora por 23 min, das 14:32 às 14:55
<a href="https://atmaapi.roilabs.com.br/api/system/health">Abrir a checagem</a>
```

Duração: `23 min`, `2 h 05 min`. Se a queda atravessou o dia, os dois horários levam a data
(`das 23:50 de 16/09 às 00:20 de 17/09`). A precisão é a do intervalo do vigia (2 min).

### Alertas do ROI Labs (`sendAlert` → hub)

O título é o assunto do alerta até o primeiro " — ". O corpo é o HTML do alerta convertido em
linhas (research.md, R6). Exemplo com o alerta que já existe:

```text
💰 <b>Pedido pago · ROI Labs</b>
Maria Souza · 62 99999-0000 · maria@exemplo.com
• Porcelanato 60×60 — 20 m²
Total: R$ 900,00 · entrega: retirada
Assinatura: renova sozinha a cada ciclo.
<a href="https://app.roilabs.com.br/admin/pedidos">Abrir no admin</a>
```

A linha "Assinatura: …" é nova e aparece só quando o pedido abre uma assinatura.

Alertas novos, com assunto e corpo como saem no `sendAlert`, nos três canais:

| Assunto | Corpo | Link |
|---|---|---|
| `↩️ Pagamento devolvido — {nome} · {total}` | `{nome} · {whatsapp}` / `Total devolvido: {total}` | `/admin/pedidos` |
| `⚠️ Contestação no cartão — {nome} · {total}` | `{nome} · {whatsapp}` / `O cliente contestou a compra com o banco. Responda a disputa no Mercado Pago.` | `/admin/pedidos` |
| `⚠️ Renovação recusada — {nome}` | `{nome} · {whatsapp}` / `Assinatura {slug} · {total}` / `Cancela sozinha em {dd/mm} se nenhuma cobrança passar.` | `/admin/assinaturas` |
| `⛔ Assinatura cancelada — {nome}` | `{nome} · {whatsapp}` / `Assinatura {slug}` / `Cancelada pelo cliente.` ou `Cancelada por falta de pagamento: 7 dias sem cobrança aprovada.` | `/admin/assinaturas` |

Os links usam o rótulo "Abrir no admin", que é o que o painel do ROI Labs já usa.

## 4. Antes → depois (ux-writing)

| Antes | Depois | Motivo |
|---|---|---|
| "Novo Paciente Cadastrado: Maria" (e-mail atual da Atma) | "Lead novo · Atma" + "Maria Souza, paciente" | Consistência: o glossário define "Lead novo". "Cadastrado" descreve o que o sistema fez |
| "Novo parceiro" | "Pedido de parceria · Atma" | É do usuário: ninguém virou parceiro ainda. O evento é o pedido |
| "Atma DOWN (status ERROR)" | "Fora do ar · Atma" + "Backend sem banco de dados desde 14:32" | É do usuário: `ERROR` é valor do `/health`. O motivo em português diz onde olhar |
| "Atma UP" | "De volta · Atma" + "ficou fora por 23 min" | Acionável: é a duração que decide se vale investigar |
| "webhook: pedido reembolsado/chargeback" (log atual) | "Pagamento devolvido" ou "Contestação no cartão" | É do usuário: `charged_back` é termo do gateway, e os dois casos pedem ações diferentes |
| "webhook: ciclo de renovação falhou" (log atual) | "Renovação recusada" + "Cancela sozinha em 23/09 se nenhuma cobrança passar." | Acionável: a data diz até quando dá para salvar a assinatura |
| "Valor médio da sua conta de luz: R$ 251 a R$ 500" | "Conta de luz: R$ 251 a R$ 500" | É do usuário: "sua" fala com o visitante, não com o dono |
| "Ver health" | "Abrir a checagem" | Verbo + objeto. `health` é nome de rota |
| "Abrir no admin" (ROI Labs) | mantido | Consistência: é o texto que os e-mails do painel já usam. Mudar só no Telegram criaria dois nomes |
