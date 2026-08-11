# O card do atma pedia três coisas e só uma era tarefa

**11/08/2026.** O card `atma` da agenda dizia: *"Reindexação confirmada em 31/07 — deixar assentar e
reconferir a série de impressões em ~14 dias. Restam MercadoPago não testado em produção e o resíduo
de DNS do clerk/www"*. Os três foram checados antes de qualquer edição. **Dois não eram tarefa e o
terceiro escondia um defeito de 3,5 meses em produção.**

---

## 1. A série de impressões reagiu — e o dia do salto é o dia da reindexação

Medido com `scripts/serie-gsc.mjs` (novo, abaixo), `dimensions: ["date"]`, filtro por página:

| janela | imp/dia | cliques |
|---|---|---|
| pré-colapso 01–09/06 | 1.455 | 218 em 9 dias |
| 14 dias ANTES do fix (17–30/07) | 11,1 | 26 |
| 8 dias completos DEPOIS (31/07–07/08) | **860** | 99 |

30/07 fechou com 30 impressões e 31/07 com **827**. Não é pico: sustentou 10 dias. Recuperou ~59%
das impressões e ~51% dos cliques do patamar antigo — por isso `decay` foi de **10 para 3**, não
para 1.

**⚠️ Os ~3 últimos dias da série saem baixos e NÃO são queda** (08/08 = 612, 09/08 = 524): o GSC não
fechou esses dias. Ler o dia de ontem como regressão é inventar queda — o script corta em D-3 no
bloco final de propósito.

## 2. O "resíduo de DNS" não existe como tarefa

- **`clerk.atma` responde 301 DE PROPÓSITO.** O Clerk foi arrancado do código (`726e45f`) e o
  handoff da migração Postgres do próprio atma diz literalmente *"clerk.atma está certo em MORTOS —
  não mexa no `cloudflare-redirects.mjs` por causa dele"*. 41 requisições no crawl, `No problems`.
- **`www.atma` é NXDOMAIN e ninguém pede.** Não está entre os 19 hosts da propriedade na
  `Hosts table.csv` — o Googlebot nunca o requisitou. Custo medido: zero. Criar o registro seria
  trabalho contra nada.

**A leitura geral:** o blocker foi escrito por analogia com os 14 subdomínios NXDOMAIN que queimavam
76% do crawl. Mas aquele caso doía porque os hosts **apareciam no crawl**. Sem a linha na
`Hosts table.csv`, "não resolve" é fato sem consequência.

## 3. 🚨 O item do MercadoPago estava errado nos DOIS sentidos

O card dizia "não testado em produção". O gateway já desmentia metade disso desde 31/07 (20
aprovações de R$ 47 em 11/2025, todas de `test_user_…@testuser.com`). **A outra metade era pior:**

```
POST https://atma.roilabs.com.br/api/infoproduto/checkout  → HTTP 500
{"error":"Erro ao salvar dados","details":{"message":"connect ECONNREFUSED 127.0.0.1:5432"}}
```

`127.0.0.1:5432` é o **default do `pg` quando `connectionString` é `undefined`**. A rota morria no
banco e **nunca chegava a chamar o Mercado Pago**. Duas causas empilhadas:

1. **`frontend/lib/db.ts` trocou mysql2 por `pg` em `e7277b6` (24/04/2026)**, passando a ler
   `DATABASE_URL`. O projeto Vercel `atma` só tinha `DB_HOST`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`, de
   255 dias atrás — e **zero linha do código lê essas quatro** (`grep` = 0 ocorrências).
2. **`clientes` e `relatorios` não existiam em `atma_db`.** As 33 tabelas de lá são do backend; o
   handoff da migração lista 7 tabelas faltando e **estas duas não estão na lista** — são do
   frontend, e viviam no MySQL antigo.

### O conserto

- `DATABASE_URL` adicionada à env de **produção** da Vercel (projeto `atma`).
- DDL Postgres novo: `frontend/db/002_clientes_relatorios_postgres.sql` (commit `d97e9cb` em
  `JeanZorzetti/Atma`). **`db/schema.sql` não servia**: é MySQL (`AUTO_INCREMENT`, `ENGINE=`, `INDEX`
  inline) e está defasado nos dois sentidos — não tem `pagamento_status` nem as colunas de
  follow-up, e tem `consultas`/`tratamentos`/`atividades` mais 3 views que **nenhuma rota consulta**.
  As colunas do DDL novo são as que o CÓDIGO toca.

### 🚩 A armadilha que quase entrou: jsonb

`problemas_atuais` e `problemas_saude` são **`TEXT`, não `jsonb`**. O repositório grava com
`JSON.stringify` (`relatorio-repository.ts:98`) e lê com `JSON.parse` (`:171`). Em `jsonb` o `pg`
devolve **objeto**, e `JSON.parse(objeto)` estoura — **o erro apareceria na LEITURA, muito depois de
o INSERT passar limpo**. Tipo "mais correto" que o código não espera é defeito adiado.

### Como foi provado (não por 2xx da home)

POST real na rota de produção → **200 com `init_point` de verdade do MP**; a linha foi lida de volta
**pelo mesmo caminho do `JSON.parse`**; e o registro de diagnóstico foi **apagado** (0 relatórios no
banco). O site respondia 200 esse tempo todo — é exatamente por isso que ninguém viu.

---

## Correções de registro que isto obriga

- **Nenhum registro de teste foi para o Postgres.** O blocker previa "~20 registros de teste na base
  de produção"; eles estão no MySQL antigo. `atma_db` tinha 0 e voltou a 0.
- **O "1 de 35 com gateway LIGADO" valia ZERO desde 24/04.** O cruzamento de
  `docs/gateways-cruzamento-2026-08-01.md` elegeu o `atma` como o único ligado — e ele estava
  quebrado. O portfólio não tinha nem um. `gateways.mjs` mede o HTML servido; a rota respondia 200
  na página de checkout e 500 só no POST, então **nenhum inventário de superfície pegaria isso**.
- **🚨 O token de PRODUÇÃO do MercadoPago continua VÁLIDO e versionado.**
  `GET api.mercadopago.com/users/me` com `APP_USR-4457823026267557-…` devolveu **200 em 11/08**, e
  ele segue em `docs/deploy/DEPLOY_PRODUCTION.md`, de um repo que foi público até 30/07. Virou o
  único blocker do card, com `humano: true`.

## O que ficou no repo

- `roihub/scripts/serie-gsc.mjs` — `node --env-file=.env scripts/serie-gsc.mjs <host> [inicio] [fim]`.
  A janela de 28 dias do `lib/gsc.ts` responde "quanto" e nunca "a partir de que DIA", que é o que
  data a causa. Reusa `melhorPropriedade` de `lib/gsc-consulta.mjs`.
- Card `atma` reescrito: `receita` 6→7 (a `receitaNota` antiga dizia "6 e não 7" justamente por não
  dar para provar que fecha venda — agora dá), `decay` 10→3, `blockers` 4→5 com um único item.

## Próximo passo

**Rotacionar o token do MP** — é humano e é dinheiro. Depois disso o atma não tem defeito técnico
conhecido: o tráfego reagiu e o checkout fecha. O que falta é comprador REAL, que é marketing.
