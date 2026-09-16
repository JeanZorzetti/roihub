# Quickstart: Avisos — 027

Roteiro de configuração e de verificação em produção. As mensagens esperadas estão em
[contracts/avisos.md](contracts/avisos.md) §3. O bot e o chat são os da 026 e já estão no hub.

Convenção dos testes: todo nome de teste começa com `TESTE 027`, e todo e-mail de teste é
`teste027+<origem>@roilabs.com.br`. No fim, as linhas de teste são apagadas (§8).

## 1. Ambiente (dono)

| Onde | Variável | Valor |
|---|---|---|
| Atma backend (EasyPanel) | `ROIHUB_CRM_SECRET` | o `CRM_INGEST_SECRET` do hub |
| ROI Labs painel (EasyPanel) | `ROIHUB_CRM_SECRET` | o mesmo |
| Coopluz (Vercel, Production) | `ROIHUB_CRM_SECRET` | o mesmo; depois, redeploy |
| Vértice (Vercel, Production) | `ROIHUB_CRM_SECRET` | **conferir se existe** (research R3) |

`ROIHUB_CRM_URL` fica vazia em todos: o padrão é `https://hub.roilabs.com.br`.

Nos serviços do EasyPanel, faça um deploy de cada vez. Um build simultâneo derruba os serviços com
137.

### Vigia (Cloudflare, uma vez)

```sh
cd roihub/vigia
npx wrangler login
npx wrangler kv namespace create VIGIA        # copiar o id para o wrangler.toml
npx wrangler secret put TELEGRAM_BOT_TOKEN    # o mesmo do hub
npx wrangler secret put TELEGRAM_CHAT_ID      # o mesmo do hub
npx wrangler deploy
```

Esperado: o `deploy` lista o trigger `*/2 * * * *`. Em `npx wrangler tail`, aparece uma execução a
cada 2 minutos, sem log de erro, e `npx wrangler kv key list --binding VIGIA --remote` volta vazio.

## 2. Rota do hub

```sh
H=https://hub.roilabs.com.br/api/avisos/evento
S=<CRM_INGEST_SECRET>
curl -s -X POST $H -H 'content-type: application/json' -d '{}'                                  # 401
curl -s -X POST $H -H "authorization: Bearer $S" -H 'content-type: application/json' \
  -d '{"projeto":"x","titulo":"t"}'                                                             # 400 projeto
curl -s -X POST $H -H "authorization: Bearer $S" -H 'content-type: application/json' \
  -d '{"projeto":"atma","titulo":"t","caminho":"//evil.com"}'                                   # 400 caminho
curl -s -X POST $H -H "authorization: Bearer $S" -H 'content-type: application/json' \
  -d '{"projeto":"atma","titulo":"🧪 TESTE 027 <b>","texto":"a & b","caminho":"/admin/pacientes"}'  # 200
```

Esperado: 1 mensagem "🧪 TESTE 027 &lt;b&gt; · Atma", com o texto `<b>` literal e o link
"Abrir no painel".

## 3. SC-003 — aviso quebrado não perde lead

Antes de preencher `ROIHUB_CRM_SECRET` na Coopluz (§1), envie um lead `TESTE 027 sem segredo`
pelo formulário.

Esperado: a página de obrigado aparece, o lead está no admin do autogestor, o log da função tem 1
linha com o nome `ROIHUB_CRM_SECRET`, e nenhuma mensagem chega. Repita na Atma antes de preencher
o segredo lá.

## 4. US1 — seis origens (SC-001, SC-002, SC-004)

Anote a hora de cada envio.

| # | Onde enviar | Mensagem esperada |
|---|---|---|
| 1 | vertice: formulário de contato | Lead novo · Vértice Marketing |
| 2 | coopluz.roilabs.com.br: formulário Energia Coopluz | Lead novo · Coopluz, "pela página Energia Coopluz", "Conta de luz: …" |
| 3 | atma: `/pacientes/enviar-exames`, com observação preenchida | Lead novo · Atma, **sem** a observação |
| 4 | atma: `/ortodontistas/seja-parceiro` | Pedido de parceria · Atma |
| 5 | roilabs.com.br: formulário de candidatura | 🏭 Candidatura nova · ROI Labs |
| 6 | goiania.roilabs.com.br: calculadora ou formulário de lead | 🛒 Lead novo · ROI Labs |

Esperado: 6 mensagens, cada uma em até 60 s, com o projeto certo na primeira linha.

Duplicados, que devem gerar **0 mensagens**:
- Coopluz: o mesmo WhatsApp e a mesma página no mesmo dia (a resposta traz `duplicado: true`).
- Atma: o mesmo e-mail do envio 3 (a resposta é 409).
- Atma: um paciente criado pelo painel (`/admin/pacientes`, cadastro manual).

**Bot do WhatsApp (research R5)**: peça um lead pelo bot. Se nenhuma mensagem chegar e o log do
backend mostrar o `POST /api/patients/leads` com `x-admin-key`, o bot usa a chave do painel e
precisa de ajuste do lado dele. Registre o resultado em tasks.md.

## 5. US2 — vigia (SC-005)

Teste local contra um alvo que você liga e desliga. As mensagens vão para o chat real.

```sh
# terminal 1: alvo saudável na porta 8799
node -e "require('http').createServer((q,r)=>r.end('{\"status\":\"OK\"}')).listen(8799)"

# terminal 2: vigia local; secrets em vigia/.dev.vars (fora do git)
cd roihub/vigia
npx wrangler dev --test-scheduled --var ALVO_URL:http://127.0.0.1:8799

# terminal 3: dispara uma execução a cada 2 min
while true; do curl -s "http://127.0.0.1:8787/__scheduled?cron=*/2+*+*+*+*"; sleep 120; done
```

- **Queda curta**: pare o terminal 1 por 4 minutos e religue. Esperado: nenhuma mensagem.
- **Queda longa**: pare o terminal 1 por 15 minutos e religue. Esperado: "Fora do ar · Atma …
  sem resposta desde HH:MM" entre 10 e 12 minutos depois de parar, e "De volta · Atma … ficou fora
  por ~15 min" até 2 minutos depois de religar. **Exatamente 2 mensagens.**
- **Banco fora**: troque a resposta do alvo por `{"status":"ERROR"}` por 12 minutos. Esperado: o
  motivo "sem banco de dados".

Em produção, não derrube a Atma. Confira só que `wrangler tail` mostra as execuções e que o KV está
vazio.

## 6. US3 — dinheiro do ROI Labs (SC-006)

- **Canal no `sendAlert`**: reenvie o resumo semanal.
  ```sh
  curl -s -X POST https://app.roilabs.com.br/api/cron/digest -H "x-cron-secret: <CRON_SECRET>"
  ```
  Esperado: 1 mensagem "📊 Semana ROI Labs", e o e-mail do resumo chega como antes.
- **Cancelamento pelo cliente**: se existir assinatura de teste, abra o link de cancelamento do
  e-mail dela. Esperado: 1 mensagem "⛔ Assinatura cancelada · ROI Labs … Cancelada pelo cliente."
  Abrir o mesmo link de novo não gera outra.
- **Pago, devolvido e renovação recusada**: exigem dinheiro real no Mercado Pago. Se não houver
  pedido de teste de valor baixo, a prova fica com os testes automatizados (tasks) e com o
  primeiro evento real da semana (§7). Registre qual caminho foi usado.

## 7. SC-007 e SC-008 — regressão e primeira semana

- `npm test` verde no hub. Os casos da 026 continuam no `test/avisos.test.mjs`.
- Um ticket de teste na Sirius ou na Estetia ainda gera "Ticket novo" como antes.
- Durante 7 dias, anote em tasks.md, por projeto, o primeiro lead real que chegou ao Telegram, ou
  "sem lead".

## 8. Limpeza

Apague as linhas `TESTE 027` em:
- `crm_leads` do hub (Vértice);
- `crm_leads` do autogestor (Coopluz);
- `patient_leads` e `crm_leads` da Atma (paciente e parceria, com as atividades da parceria);
- `Candidatura` e `LeadConsumidor` do ROI Labs.
