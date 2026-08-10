# Implementation Plan: CRM do roihub recebe leads do Polaris

**Branch**: `001-polaris-crm-leads` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-polaris-crm-leads/spec.md`

## Summary

O CRM do roihub já ingere leads genéricos via `POST /api/crm/leads` (Bearer `CRM_INGEST_SECRET`), validando `pipeline`/`etapa` contra `data/pipelines.json` e deduplicando por `external_id`. A entrega adiciona uma pipeline `polaris` a esse JSON e faz o repositório `sofia-next` (Polaris) chamar esse mesmo endpoint a partir dos seus 3 pontos de captura de lead — sem criar nenhuma infraestrutura nova de CRM, só um cliente HTTP fino do lado do Polaris. A abordagem técnica central: **repurpose em vez de reescrever**. O proxy que hoje existe em `sofia-next` (`POST /api/crm/lead`, singular) já é chamado pelos 2 formulários que usavam o Sirius CRM — ele passa a chamar o roihub em vez do Sirius, sem tocar nos componentes de UI que o consomem. O `/api/contact` (usado por `/contato`, hoje só grava no Postgres do Polaris) ganha uma chamada adicional best-effort ao mesmo helper, depois do insert no Postgres.

## Technical Context

**Language/Version**: TypeScript, Next.js App Router em ambos os repositórios (roihub: Next 16.2, sofia-next: Next 16.1)

**Primary Dependencies**: roihub usa `pg` (driver Postgres cru, sem ORM) via `lib/db.ts`; sofia-next usa `@prisma/client` 5.22. Nenhuma dependência nova — a chamada roihub↔Polaris é `fetch` nativo.

**Storage**: Dois bancos Postgres independentes, sem link direto entre eles — a única ponte é HTTP. roihub grava em `crm_leads`/`crm_eventos` (via `insertLead`); sofia-next continua gravando em `salesLead` via Prisma, sem alteração de schema.

**Testing**: roihub usa `node --test` (`test/crm.test.mjs` já cobre `parseLead`/`etapasDe`); sofia-next usa `jest` (já tem `crm-lead.test.ts` e `crm-lead-intake.test.ts` cobrindo o proxy atual).

**Target Platform**: Duas aplicações web Next.js hospedadas separadamente (roihub e sofia-next/Polaris) — a integração é servidor-a-servidor (nenhuma chamada sai do navegador do visitante diretamente para o roihub).

**Project Type**: Integração entre dois serviços web já existentes (sem novo projeto/app).

**Performance Goals**: Sem meta explícita — volume é de formulários de marketing (dezenas/dia, não centenas por segundo). A única exigência de desempenho é indireta: a chamada ao roihub não pode atrasar perceptivelmente a resposta ao visitante (daí a entrega best-effort da FR-006).

**Constraints**:
- FR-006 (best-effort): falha/timeout ao chamar o roihub NUNCA deve virar erro para o visitante do Polaris nem atrasar a resposta além de um timeout curto.
- O segredo (`CRM_INGEST_SECRET`) só pode ser usado em código server-side do Polaris (Route Handler), nunca exposto ao cliente — os formulários continuam postando para rotas internas do próprio Next.js do Polaris, que é quem fala com o roihub.
- `external_id` é obrigatório e é a chave de dedupe real (`UNIQUE` no Postgres do roihub, `ON CONFLICT DO NOTHING`) — precisa ser estável entre tentativas técnicas de reenvio do MESMO envio, e diferente entre envios distintos do usuário (spec, edge case 3).

**Scale/Scope**: 3 pontos de entrada no Polaris (`/contato`, `/peca-seu-site`, `/early-access`), 1 pipeline nova no roihub (`polaris`), 0 mudanças de schema em qualquer um dos dois bancos.

## Constitution Check

`.specify/memory/constitution.md` ainda é o template (`/speckit-constitution` nunca foi rodado neste projeto) — não há princípios ratificados para checar. Gate tratado como **N/A** por ausência de constituição; nenhuma violação a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/001-polaris-crm-leads/
├── plan.md              # este arquivo
├── research.md          # decisões da Phase 0
├── data-model.md        # entidades da Phase 1
├── contracts/
│   └── crm-leads-ingest.md   # contrato do POST /api/crm/leads consumido pelo Polaris
├── quickstart.md        # como validar a feature ponta a ponta
└── tasks.md             # gerado pelo /speckit-tasks (ainda não existe)
```

### Source Code (repository root)

Nenhum diretório novo — mudanças pontuais em dois repositórios já existentes:

```text
roihub/
├── data/pipelines.json          # + entrada "polaris" (etapas iguais às demais)
└── test/crm.test.mjs            # + caso cobrindo a nova pipeline

Imob/sofia-next/
├── src/lib/roihub-crm.ts                    # NOVO: cliente HTTP fino, best-effort, para POST /api/crm/leads
├── src/app/api/crm/lead/route.ts            # reescrito: chama roihub-crm em vez do Sirius CRM (mesmo contrato de entrada/saída para IntakeForm.tsx e early-access/page.tsx, que não mudam)
├── src/app/api/contact/route.ts             # + chamada best-effort ao roihub-crm após o insertLead no Postgres, sem alterar o contrato com ContatoPage
└── src/__tests__/integration/crm-lead*.test.ts   # atualizados para o novo destino (roihub) em vez do Sirius
```

**Structure Decision**: Repurpose do proxy existente (`/api/crm/lead`) em vez de criar uma rota nova — os 2 componentes de UI que já o chamam (`IntakeForm.tsx`, `early-access/page.tsx`) continuam intocados, só o que acontece "atrás" da rota muda de destino (Sirius → roihub). Isso é o menor diff possível: zero mudança de contrato para quem já chama a rota, e a lógica de chamada ao roihub fica num único módulo (`roihub-crm.ts`) reaproveitado pelas duas rotas (`/api/crm/lead` e `/api/contact`), em vez de duplicar `fetch` + tratamento de erro em cada uma.

## Complexity Tracking

*Sem violações de constituição a justificar (ver Constitution Check acima).*
