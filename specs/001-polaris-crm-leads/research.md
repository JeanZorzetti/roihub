# Phase 0 Research: CRM do roihub recebe leads do Polaris

## 1. Como entregar best-effort (FR-006) sem bloquear o visitante

**Decision**: usar `after()` de `next/server` para disparar a chamada ao roihub depois que a resposta já foi enviada ao visitante.

**Rationale**: `after()` já é usado no próprio repo do Polaris (`src/app/api/companies/[id]/run/route.ts`, `src/lib/orchestration/team/start-team-run.ts` e outros) para "trabalho que continua depois da resposta" — é o padrão nativo do Next.js 15+ para exatamente este caso, e já é familiar no código. Elimina a necessidade de `AbortSignal.timeout` + try/catch manual para não atrasar a resposta: a chamada ao roihub literalmente não pode atrasar nem falhar a resposta, porque roda depois dela.

**Alternatives considered**:
- `fetch` com `AbortSignal.timeout(2000)` awaited antes de responder: funciona, mas ainda expõe o visitante a uma latência extra (até 2s) e exige tratamento de erro manual em cada rota. `after()` remove os dois problemas de graça.
- Fila/job assíncrono (ex.: tabela de outbox, cron de retry): resolve também garantia de entrega, mas é infraestrutura nova para um volume de leads de marketing (dezenas/dia) — over-engineering para o problema atual.

## 2. Como gerar o `external_id` (dedupe de reenvio, FR-003)

**Decision**: gerar server-side, dentro do próprio helper (`roihub-crm.ts`), como hash das partes estáveis do lead + uma janela de tempo curta: `sha256(email + "|" + origem + "|" + bucket)`, onde `bucket = floor(Date.now() / 120_000)` (janelas de 2 minutos).

**Rationale**: reenvios técnicos (timeout de rede, duplo-clique acidental, retry) acontecem em segundos — caem na mesma janela de 2 minutos e dedupam corretamente contra o `UNIQUE(external_id)` do roihub. Resolve o requisito **sem tocar em nenhum componente de UI** dos 3 formulários (zero mudança de contrato para quem já chama `/api/crm/lead` ou `/api/contact`) — a alternativa abaixo exigiria mudança nos 3 componentes para um ganho marginal.

**Alternatives considered**:
- Id gerado no cliente (ex.: `crypto.randomUUID()` guardado em `useState` no mount do formulário, enviado como campo extra): dedupe perfeito mesmo entre janelas de tempo longas, mas exige tocar `ContatoPage`, `IntakeForm.tsx` e `early-access/page.tsx` para um ganho que só importa se o usuário reenviar o MESMO envio depois de >2 minutos — cenário raro para um reenvio técnico.
- Hash sem janela de tempo (`email + origem` puro): rejeitado — colide com o edge case da spec de que um reenvio *intencional* do mesmo formulário (dias depois) deve virar um lead novo, não ser descartado como duplicata.

**Known ceiling** (documentar como `ponytail:` no código): um reenvio técnico que só acontece depois de 2 minutos (ex.: usuário mata a aba e reabre) não vai dedupar — vira um segundo card. Aceitável dado o volume baixo; se virar problema real, trocar pela alternativa de id gerado no cliente.

## 3. Nome das env vars novas (sofia-next → roihub)

**Decision**: `ROIHUB_CRM_URL` (base URL do hub) e `ROIHUB_CRM_SECRET` (mesmo valor configurado em `CRM_INGEST_SECRET` no roihub).

**Rationale**: segue a convenção já usada no proxy antigo (`SIRIUS_CRM_URL` / `SIRIUS_CRM_API_KEY`) — `<SERVIÇO>_CRM_URL` / `<SERVIÇO>_CRM_SECRET` — e a convenção do próprio roihub, que já trata esse segredo como "capacidade própria" (comentário em `middleware.ts`: "segredo PRÓPRIO... não é para cada rota, é para capacidade MAIOR").

## 4. Etapas da pipeline "polaris"

**Decision**: reaproveitar o mesmo conjunto já usado por `orion`/`atma`/`roilabs`: `["novo", "contato", "proposta", "ganho", "perdido"]`.

**Rationale**: `etapasDe`/`parseLead` em `lib/crm.mjs` não têm nada específico de domínio — validam contra o que estiver no JSON. Não há indício de que o funil do Polaris precise de etapas diferentes; manter o mesmo conjunto evita uma pipeline com regras próprias sem necessidade comprovada (já documentado como Assumption na spec).

## 5. Origem (`origem`) de cada lead

**Decision**: `"polaris:contato"`, `"polaris:peca-seu-site"`, `"polaris:early-access"` — mesmo padrão `"<pipeline>:<subtipo>"` já usado pela Orion (`origem: "orion:contato"`, visto em `test/crm.test.mjs`).

**Rationale**: reutiliza uma convenção que já existe e já é testada, sem inventar um novo esquema de classificação.
