# Quickstart: validar leads do Polaris chegando no CRM do roihub

## Pré-requisitos

- roihub rodando localmente com `DATABASE_URL` apontando para um Postgres com a tabela `crm_leads` (mesma migração já usada por Orion/Atma/ROI Labs).
- `CRM_INGEST_SECRET` definido no `.env` do roihub.
- sofia-next rodando localmente com `ROIHUB_CRM_URL=http://localhost:<porta-do-roihub>` e `ROIHUB_CRM_SECRET=<mesmo valor de CRM_INGEST_SECRET>`.
- `data/pipelines.json` do roihub já contém a entrada `"polaris"` (ver [data-model.md](./data-model.md)).

## Cenário 1 — lead do formulário de contato aparece no CRM

1. Preencher e enviar o formulário em `/contato` do Polaris (nome + email válidos).
2. Confirmar que a resposta ao visitante é de sucesso imediatamente (não deve esperar o roihub).
3. Abrir `/crm` no roihub → deve existir um card na pipeline "Polaris" com `origem = polaris:contato`, nome e email corretos.
4. Confirmar em paralelo que o registro em `salesLead` (Postgres do Polaris) continua sendo criado normalmente — o CRM do roihub é adicional, não substitui esse registro.

## Cenário 2 — intake de site e early access usam o mesmo caminho (ex-Sirius)

1. Enviar o formulário em `/peca-seu-site`.
2. Enviar o formulário em `/early-access`.
3. Confirmar 2 cards novos em `/crm` (roihub), pipeline "Polaris", com `origem` = `polaris:peca-seu-site` e `polaris:early-access` respectivamente.
4. Confirmar que nenhuma chamada ao Sirius CRM acontece mais (nenhum uso de `SIRIUS_CRM_API_KEY`/`SIRIUS_CRM_URL` restando no código desses 2 caminhos).

## Cenário 3 — reenvio técnico não duplica

1. Enviar o mesmo formulário (mesmos dados) duas vezes em menos de 2 minutos (simula um retry de rede).
2. Confirmar que existe **um único** card no CRM do roihub para esse envio (ver janela de dedupe em [research.md §2](./research.md)).

## Cenário 4 — indisponibilidade do roihub não afeta o visitante

1. Derrubar o roihub local (ou apontar `ROIHUB_CRM_URL` para uma porta inexistente).
2. Enviar qualquer um dos 3 formulários no Polaris.
3. Confirmar que o visitante recebe sucesso normalmente (FR-006) — o erro de conexão ao roihub deve aparecer só no log do servidor do Polaris, nunca na resposta ao visitante.

## Verificação automatizada (o que os testes devem cobrir)

- roihub: `test/crm.test.mjs` — `pipelines.json` reconhece `"polaris"` e suas etapas.
- sofia-next: `crm-lead.test.ts`/`crm-lead-intake.test.ts` — o proxy chama o roihub (não mais o Sirius) e nunca propaga erro de rede como falha para o visitante.
