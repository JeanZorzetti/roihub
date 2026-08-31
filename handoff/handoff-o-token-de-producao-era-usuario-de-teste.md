# O token "de produção" do Mercado Pago era usuário de TESTE

> **Executado em 31/08/2026.** Card #1 da Execução (balde 🔒 Segurança), projeto `atma`, score 66.
> Entrada: "Rotacionar o token de produção do MercadoPago (é o único item que sobrou, e é humano)".
> **Saída: o item não era o único que sobrou, e o token não é de produção.**

## BLUF

Três coisas medidas, nesta ordem de importância:

1. **O checkout do atma cobra numa conta de TESTE do Mercado Pago.** `GET /users/me` com o token do
   projeto devolve 200 e `tags: ["test_user","normal"]`, nickname `TESTUSER8780611611385518759`,
   e-mail `@testuser.com`. Logo **comprador real nenhum consegue pagar hoje** — o que fecha este
   projeto não é marketing, é uma credencial.
2. **O `DEPLOY_PRODUCTION.md` nunca foi apagado: ele mudou de lugar.** A auditoria de 01/08 conferiu
   `DEPLOY_PRODUCTION.md` na raiz, recebeu 404 e concluiu "removido". O arquivo estava em
   `docs/deploy/DEPLOY_PRODUCTION.md`, com o token em claro, e ficou lá **um mês a mais**.
3. **Lado do código do vazamento: FECHADO** (`JeanZorzetti/Atma@2b05bee`). Não fecha o vazamento em
   si — o valor segue no histórico e em qualquer clone feito enquanto o repo era público.

## 1. O prefixo `APP_USR-` foi o detector errado

`APP_USR-` parece produção e não é: **usuário de teste do Mercado Pago recebe credencial com o mesmo
prefixo.** As duas verificações anteriores (30/07 e 01/08) liam `GET /users/me` e paravam em
`live=active` + `site_id: MLB` — os dois campos são verdadeiros na conta de teste também.

O campo que decide é `tags`. E o repo **já dizia**, em dois arquivos que se contradiziam:

| arquivo | o que afirmava sobre a MESMA string |
|---|---|
| `docs/deploy/DEPLOY_PRODUCTION.md:53` | `MERCADOPAGO_ACCESS_TOKEN=APP_USR-…` sob "variáveis de produção" |
| `docs/deploy/TESTE_COMPLETO.md:5` | "✅ **Mercado Pago (TEST):** Configurado" |

> **Reutilizável:** em Mercado Pago, `APP_USR-` não separa teste de produção e `live_mode: true`
> também não. Só `tags` (em `/users/me`) e o **payer** separam. Isso é a mesma família da armadilha
> já registrada: *approved + live_mode não é venda*.

## 2. A prova de 11/08 saiu na conta errada

O card afirmava, desde 11/08, "o checkout fecha em produção — POST devolve 200 com `init_point` real".
`GET /checkout/preferences/search` na conta devolve **`total: 1`**. Uma preferência, só:

```
date_created      2026-08-11T03:44:05-04:00
external_reference relatorio-1-1
payer_email       teste-diagnostico-roihub@example.com
collector_id      3020352786          ← o usuário de TESTE
live_mode         true                ← não desmente nada
```

Ou seja: **a única preferência que existe é a própria prova de 11/08**, e ela foi criada na conta de
teste. Nenhum visitante chegou ao checkout desde então — consistente com as 0 vendas, e agora com
motivo.

Consequências que ficam escritas:

- `scripts/vendas-mercadopago.mjs` aponta para uma conta de teste. O "0 venda" dele é verdadeiro mas
  **cego**: mediria 0 mesmo se a conta real tivesse faturado. Ele acerta em descartar os 20
  pagamentos de 11/2025 como `usuário de teste do gateway` — o que ele não sabe é que **a conta
  inteira** é de teste.
- O vazamento perde a urgência de *dinheiro* que carregava desde 30/07 (é token de teste). Segue
  sendo higiene, não emergência.

## 3. O que foi purgado do repo (`Atma@2b05bee`)

Redação para placeholder:

| arquivo | segredo |
|---|---|
| `docs/deploy/DEPLOY_PRODUCTION.md` | `MERCADOPAGO_ACCESS_TOKEN`, `RESEND_API_KEY`, `CLERK_SECRET_KEY`, `MYSQL_PASSWORD`, `CRON_SECRET` |
| `docs/deploy/TESTE_COMPLETO.md` | chave Resend citada **em prosa** (não em bloco `env`) |
| `backend/CORS_CONFIG.md` | `DB_PASSWORD`, `JWT_SECRET` |
| `backend/DATABASE_SETUP.md` (2×), `backend/.env.example`, `database/README.md` | `DB_PASSWORD` |

Destrackeados quatro `.env` **versionados** com senha e JWT reais — `backend/.env.easypanel`,
`.env.production`, `.env.server_direct`, `.env.tunnel` — mais `.env.*` no `backend/.gitignore`.
Conferido antes de remover: **nenhum dos dois Dockerfiles lê esses arquivos**; só o
`backend/setup-db-step-by-step.bat` copia `.env.tunnel`, e ele segue funcionando porque os arquivos
continuam em disco.

Removidos os fallbacks `process.env.DB_PASSWORD || '<senha de prod>'` dos dois runners de migração
(`backend/database/run-fix-column-sizes.js`, `run-pagamento-status-migration.js`): script rodado sem
env estava **alcançando produção com senha embutida**. Falhar alto é o comportamento certo.

### Quem ainda está vivo (aferido em 31/08, não suposto)

| segredo | veredito |
|---|---|
| Mercado Pago `APP_USR-…` | 200 — **mas é `test_user`** |
| Resend `re_TVthPAVn…` | **MORTO** — `{"message":"API key is invalid"}` |
| Clerk `sk_test_…` | **VIVO**, 200 em `/v1/users` (o Clerk saiu do código em `726e45f`; a instância atende) |
| família `<senha de prod>` | segue senha de produção em vários bancos da casa — não sondada aqui |

> **Reutilizável:** varredura de segredo por `grep '<CHAVE>=<valor>'` não pega chave citada em prosa
> (`TESTE_COMPLETO.md`) nem fallback em código (`|| '<senha de prod>'`). E **conferir caminho não é conferir
> conteúdo**: `404` no caminho antigo é compatível com "o arquivo mudou de pasta".

## ▶️ Próximo passo — humano, painel do Mercado Pago

Não é código. Na conta REAL do Mercado Pago do Jean: **Suas integrações → aplicação do atma →
Credenciais de produção**, e colar o `Access Token` em **três lugares no mesmo movimento** (senão a
régua do dinheiro quebra):

1. `MERCADOPAGO_ACCESS_TOKEN` no projeto `atma` da Vercel → **Redeploy**;
2. `MERCADOPAGO_ACCESS_TOKEN` no `.env` local do roihub (é o que `scripts/vendas-mercadopago.mjs` lê);
3. onde mais o atma consumir o token (conferir o EasyPanel do `atmaapi`).

Gate para fechar, sem escrever no banco: `GET /users/me` com o token novo **sem** `test_user` em
`tags`, e `scripts/vendas-mercadopago.mjs` rodando contra a conta real.

## Fora do card, consertado no caminho

`npm test` estava **vermelho em `main`** antes desta sessão (388/389): `validade.test.mjs` acusava
`data/projects.json:141`. Era **falso positivo do padrão `(hoje N)`** — o card do estetiacrm dizia
"(agora no title e no H1: '…Dermatologistas 2026')", e o detector leu `agora` + `2026`. Consertado
pelo caminho que o próprio check pede ("apure o número ou date-o"): virou "desde 31/08 no title".
**389 verdes.** Mesma família de [`corpus_hoje_n_prose_rot`] — o `(hoje N)` volta a morder prosa.
