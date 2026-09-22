# Quickstart — como provar a 053

## 1. Suíte

```bash
npm test          # a lista explícita inclui test/saas.test.mjs
npx tsc --noEmit
```

## 2. A contagem direta no banco (SC-002)

Com `SIRIUS_DATABASE_URL` (o usuário só de leitura):

```sql
-- cadastros reais na época
SELECT count(*) FROM "Organization" WHERE NOT "isTestAccount" AND "createdAt" >= '2026-03-17';
-- ativadas
SELECT count(DISTINCT o.id) FROM "Organization" o JOIN "Contact" x ON x."organizationId" = o.id
WHERE NOT o."isTestAccount" AND o."createdAt" >= '2026-03-17'
  AND x."createdAt" >= o."createdAt" + interval '5 minutes';
```

Em 22/09/2026: 108 e 32. A ficha deve mostrar os mesmos números no mesmo dia.

## 3. O usuário só de leitura não lê dado pessoal

```sql
SELECT name FROM "Organization" LIMIT 1;   -- deve falhar: permission denied
SELECT email FROM "Contact" LIMIT 1;       -- deve falhar
INSERT INTO "Organization" DEFAULT VALUES; -- deve falhar
```

## 4. As telas

- `/okr/sirius`: signup 108, ativado 32, primeira cobrança aprovada 6 (declaradas), paga hoje 1, trial
  omitido com o motivo, taxa clique → signup recusada por janela, a Boxer listada como "plano PRO sem
  pagamento ativo".
- `/gsc/mapa/sirius`: o painel "Depois do clique" com os mesmos números.
- `/okr/polarisia` (um dos outros 8 do perfil A): igual ao HTML de antes (SC-005).

## 5. Sem a chave do Stripe

Com `SIRIUS_STRIPE_KEY` ausente, a ficha mostra "chave do Stripe ausente" no lado Stripe, e as 6 declaradas
continuam contando.
