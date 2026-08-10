# Contrato: `POST /api/crm/leads` (roihub) — consumido pelo Polaris

Este endpoint já existe (`roihub/app/api/crm/leads/route.ts`) e não muda de contrato — este documento descreve como o Polaris (novo consumidor) deve chamá-lo.

## Request

```
POST https://<host-do-roihub>/api/crm/leads
Authorization: Bearer <ROIHUB_CRM_SECRET>
Content-Type: application/json
```

```json
{
  "external_id": "string, obrigatório — chave de dedupe",
  "pipeline": "polaris",
  "etapa": "novo",
  "nome": "string, obrigatório",
  "email": "string | omitido",
  "telefone": "string | omitido",
  "origem": "polaris:contato | polaris:peca-seu-site | polaris:early-access",
  "valor": "omitido (não aplicável aos 3 formulários)",
  "metadata": { "...": "campos livres específicos do formulário — ver data-model.md" }
}
```

## Responses (já implementadas no roihub, sem mudança)

| Status | Quando | Ação do chamador (Polaris) |
|---|---|---|
| `201` | lead novo, criado | nenhuma — sucesso |
| `200` | `external_id` já existia (reenvio deduplicado) | nenhuma — tratar como sucesso, é o comportamento esperado de retry |
| `400` | payload inválido (`pipeline`/`etapa` desconhecida, `nome`/`origem` ausente) | logar e descartar — não deve acontecer se o helper montar o payload corretamente; nunca repassar esse erro ao visitante (FR-006) |
| `401` | `ROIHUB_CRM_SECRET` errado/ausente | logar (erro de configuração) — nunca repassar ao visitante |
| `503` | `DATABASE_URL` ausente no roihub | logar — nunca repassar ao visitante |

Nenhuma dessas respostas deve alterar o que o Polaris responde ao visitante — a chamada roda em `after()` (ver [research.md §1](../research.md)), depois da resposta já ter sido enviada.

## Pré-requisito de infraestrutura

Antes de qualquer chamada real funcionar: a pipeline `"polaris"` precisa existir em `data/pipelines.json` do roihub (ver [data-model.md](../data-model.md)) — sem ela, toda chamada volta `400 pipeline desconhecida`.
