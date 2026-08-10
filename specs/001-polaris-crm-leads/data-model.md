# Data Model: CRM do roihub recebe leads do Polaris

Nenhuma entidade nova é criada — a feature reutiliza o modelo `Lead` (tabela `crm_leads`) que já existe no roihub (`lib/db.ts`, `NewLead`). O que muda é (a) um novo valor de `pipeline`, e (b) três novos valores de `origem` alimentando esse modelo existente.

## Entidade: Lead (existente, `crm_leads` no roihub)

| Campo | Tipo | Regra | Preenchimento pelo Polaris |
|---|---|---|---|
| `external_id` | string, único | chave de dedupe (`UNIQUE`, `ON CONFLICT DO NOTHING`) | `sha256(email\|origem\|bucket-2min)` — ver [research.md §2](./research.md) |
| `pipeline` | string | deve existir em `data/pipelines.json` | sempre `"polaris"` |
| `etapa` | string | deve estar em `etapas` da pipeline, ou cai na primeira (`novo`) | omitido → default `"novo"` |
| `nome` | string, obrigatório | não vazio | campo `name`/`nome` do formulário |
| `email` | string \| null | — | campo `email` do formulário |
| `telefone` | string \| null | — | campo `phone`/`telefone`, quando fornecido |
| `origem` | string, obrigatório | livre, mas convenção `"<pipeline>:<subtipo>"` | `"polaris:contato"` \| `"polaris:peca-seu-site"` \| `"polaris:early-access"` |
| `valor` | number \| null | ≥ 0 | sempre `null` — nenhum dos 3 formulários captura valor de negócio |
| `metadata` | objeto livre | — | contexto específico do formulário (ver abaixo) |

## Entidade: Pipeline (existente, `data/pipelines.json`)

Novo registro:

```json
{
  "slug": "polaris",
  "nome": "Polaris",
  "etapas": ["novo", "contato", "proposta", "ganho", "perdido"]
}
```

Decisão e alternativas em [research.md §4](./research.md).

## Mapeamento por origem (o que cada formulário do Polaris envia)

### `/contato` → `origem: "polaris:contato"`

Campos hoje capturados por `ContatoPage` e já persistidos em `salesLead` (Prisma, Postgres do Polaris): `name`, `email`, `company`, `phone`, `type` (`enterprise`/`whitelabel`/`general`), `message`, `employees`, `useCase`.

- `nome` ← `name`
- `email` ← `email`
- `telefone` ← `phone` (opcional)
- `metadata` ← `{ company, type, employees, useCase }` (tudo opcional/livre — o CRM não valida o conteúdo de `metadata`)

### `/peca-seu-site` → `origem: "polaris:peca-seu-site"`

Campos hoje enviados pelo `IntakeForm.tsx` ao proxy `/api/crm/lead` (antes destinado ao Sirius CRM): o corpo bruto do formulário (`...form`) + `subject: "site-intake"`.

- `nome`/`email`/`telefone` ← campos equivalentes do form
- `metadata` ← restante dos campos do intake (tipo de site, site atual, objetivo, mensagem) — já é o mesmo payload que hoje vira `notes` no proxy antigo, só que preservado como `metadata` estruturada em vez de string concatenada

### `/early-access` → `origem: "polaris:early-access"`

Campos hoje enviados: `name`, `email`, `company`, `subject: "early_access"`, `message` (contém `usage` e mensagem livre), `phone: ""`.

- `nome` ← `name`
- `email` ← `email`
- `telefone` ← `null` (early access não coleta telefone — o proxy antigo sempre mandava string vazia)
- `metadata` ← `{ company, usage, message }`

## Relacionamentos

Nenhum novo — o Lead continua pertencendo só à sua `pipeline` (já é assim para Orion/Atma/ROI Labs). Não há relação entre o `crm_leads` do roihub e o `salesLead` do Polaris: são registros independentes em bancos diferentes, ligados só pelo `external_id` semanticamente (não há FK entre os dois bancos).
