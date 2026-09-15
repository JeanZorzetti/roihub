# Quickstart: Avisos no Telegram — 026

Roteiro para provar a feature em produção. Contrato e texto das mensagens em
[contracts/avisos.md](contracts/avisos.md).

## 1. Pré-requisitos (dono, uma vez)

**Bot**

1. No Telegram, abra `@BotFather`, mande `/newbot` e siga as perguntas. Guarde o token.
2. Abra a conversa com o bot novo e mande `/start` — sem isso o bot não consegue escrever para você.
3. Descubra o id do chat:

   ```powershell
   $t = '<token>'
   (Invoke-RestMethod "https://api.telegram.org/bot$t/getUpdates").result[0].message.chat.id
   ```

**Ambiente no EasyPanel**

| Serviço | Variável | Valor |
|---|---|---|
| hub | `TELEGRAM_BOT_TOKEN` | token do passo 1 |
| hub | `TELEGRAM_CHAT_ID` | id do passo 3 |
| sirius | `ROIHUB_CRM_URL` | `https://hub.roilabs.com.br` |
| sirius | `ROIHUB_CRM_SECRET` | o `CRM_INGEST_SECRET` do hub |
| estetia | `ROIHUB_CRM_URL` | `https://hub.roilabs.com.br` |
| estetia | `ROIHUB_CRM_SECRET` | o `CRM_INGEST_SECRET` do hub |

Variável nova no EasyPanel só vale depois do redeploy do serviço. No hub, respeite as janelas do
Princípio IV (23:30–01:00 e 08:00–08:45 BRT).

## 2. Suíte do hub

```powershell
npm test
```

Esperado: tudo verde, com `test/avisos.test.mjs` na contagem.

## 3. Rota de ticket, direto (sem produto)

```powershell
$h = @{ Authorization = "Bearer $env:CRM_INGEST_SECRET" }
$b = '{"produto":"sirius","tipo":"novo","ticket_id":"teste-026","assunto":"TESTE 026","organizacao":"ROI Labs","categoria":"BUG","prioridade":"URGENT"}'
Invoke-RestMethod -Method Post https://hub.roilabs.com.br/api/avisos/ticket -Headers $h -ContentType 'application/json' -Body $b
```

| Variação | Esperado |
|---|---|
| como acima | `200 { enviado: true }` e a mensagem "🔴 Urgente · Ticket novo · Sirius CRM" |
| sem `Authorization` | `401`, nenhuma mensagem |
| `"produto":"atma"` | `400`, nenhuma mensagem |
| `"assunto":"<b>&"` | `200`, e a mensagem mostra `<b>&` literal |

## 4. Lead — SC-001 e SC-004

1. Envie um lead por formulário — contato e calculadora de ROI, na Sirius e na Estetia — com nome
   começando por `TESTE 026`. **Esperado**: 4 mensagens "Lead novo" e 4 cards no CRM do hub
   (`node --env-file=.env scripts/funil.mjs --ver`).
2. Reenvio: repita um `POST /api/crm/leads` com o mesmo `external_id`. **Esperado**:
   `200 { created: false }`, nenhuma mensagem.
3. Outra pipeline: `POST /api/crm/leads` com `"pipeline":"atma"`. **Esperado**: `201`, nenhuma
   mensagem.
4. Apague os cards `TESTE 026` do CRM do hub.

## 5. Ticket — SC-005

Numa conta de teste de cada produto:

1. Abra um ticket. **Esperado**: 1 mensagem "Ticket novo"; o link abre o ticket em
   `/admin/support/<id>`; o e-mail de novo ticket continua chegando.
2. Responda como cliente. **Esperado**: 1 mensagem "Cliente respondeu".
3. Responda como staff e registre uma nota interna. **Esperado**: nenhuma mensagem.

## 6. Falha não derruba nada — SC-003

Momento natural: depois do deploy e **antes** de preencher `TELEGRAM_*` no hub (Ordem de entrega do
plano, entre os passos 4 e 5).

1. Envie um lead por um formulário. **Esperado**: sucesso para o visitante, card gravado no hub e,
   no log do hub, só os nomes das variáveis que faltam — nenhum valor.
2. Abra um ticket numa conta de teste. **Esperado**: ticket criado, e-mail enviado e, no log do
   produto, uma linha `[roihub-crm]` com o status `503`.
