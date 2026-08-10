# Quickstart — como validar a observabilidade de ponta a ponta

Guia de validação, não de implementação. Cada cenário é o *Independent Test* de uma user story, na
ordem em que elas ficam entregáveis.

## Pré-requisitos

- `.env` com `DATABASE_URL` (o Postgres de produção — é onde a série mora, inclusive para o que roda
  aqui como `dev`) e `CLAUDE_CODE_OAUTH_TOKENS`.
- `npm test` verde. `test/telemetria.test.mjs` **tem que estar na lista explícita do `package.json`** —
  `test/validade.test.mjs` reprova o esquecimento nos dois sentidos.
- **Não rodar deploy entre 23:30 e 01:00 BRT** (estado noturno 23:37, autopublishing 00:13).

Antes de tudo, o que o `npm test` cobre sem tocar em banco nem em pool: `hashConta`, `codigo`,
`montarRegistro` (garantindo que prompt e resultado não passam), `resumirDia`, `estadoDoEmpregado`,
`transicaoPool` e `celulasIA`.

---

## US1 — toda chamada deixa registro

```bash
# 1. duas chamadas: rerank + síntese
curl -s "https://hub.roilabs.com.br/busca?q=como+funciona+o+estado+noturno" > /dev/null

# 2. confere que as duas linhas existem, com empregado, conta, duração, tokens e desfecho
psql "$DATABASE_URL" -c "
  SELECT empregado, conta, tentativa, duracao_ms, tokens_entrada, tokens_saida, desfecho
  FROM ia_chamadas WHERE inicio > now() - interval '5 min' ORDER BY id;"
```

**Esperado**: 2 linhas, `rerank` e `resposta`, `conta` com hash de 8 caracteres, `desfecho = ok`.

**Controle negativo** — a busca com as duas camadas desligadas não registra nada:

```bash
curl -s "https://hub.roilabs.com.br/busca?q=teste&rerank=0&resposta=0" > /dev/null
# a query acima não deve trazer linha nova
```

**Percurso do pool (cenário 4)**: força a 1ª conta a falhar e confere que aparecem **duas tentativas**
com o mesmo `pedido` — uma falha e um sucesso —, não uma linha de sucesso só:

```sql
SELECT pedido, tentativa, conta, desfecho FROM ia_chamadas
WHERE pedido IN (SELECT pedido FROM ia_chamadas GROUP BY pedido HAVING count(*) > 1)
ORDER BY pedido, tentativa;
```

**Autopublishing (cenário 2)**: depois de um ciclo noturno, cada chamada de LLM de cada projeto tem
linha própria, e a soma bate com o agregado da publicação:

```sql
SELECT c.corrida, count(*) AS chamadas, sum(c.tokens_entrada) AS entrada
FROM ia_chamadas c WHERE c.empregado LIKE 'autopublish-%'
  AND c.inicio::date = current_date GROUP BY 1;
-- comparar com: SELECT project_slug, input_tokens FROM seo_publications WHERE run_date = current_date;
```

**Nenhum texto vazou (SC-007)** — check automático sobre a amostra:

```sql
SELECT count(*) FROM ia_chamadas
WHERE prompt_hash !~ '^[0-9a-f]{40}$' OR length(desfecho) > 40;
-- esperado: 0. Nenhuma coluna guarda texto livre: se este check precisar de regex nova, o schema mudou.
```

---

## US2 — a saúde de cada conta é datada

```bash
node --env-file=.env scripts/probe-pool.mjs --gravar
psql "$DATABASE_URL" -c "SELECT conta, estado, desde, visto FROM ia_pool ORDER BY conta, desde;"
```

**Esperado**: uma linha por conta por estado, com `desde` e `visto`. Rodar de novo sem mudar nada
**não** cria linha — só atualiza `visto`. Esse é o teste: confirmar estado não compra janela nova.

**Transição**: tire uma conta do `CLAUDE_CODE_OAUTH_TOKENS`, ou espere um 429 recarregar, e rode de
novo — a linha nova aparece com o `desde` da hora da sondagem, e a antiga **permanece**. Histórico
não é sobrescrito pela leitura mais recente.

**429 ≠ 403**: as duas contas aparecem com estados distintos (`rate-limit` e `desabilitada`). Se a aba
ou o rótulo do card colapsar as duas, a validação falhou — uma recarrega sozinha e a outra pede
compra.

**Falha fechada (cenário 4)**:

```bash
CLAUDE_CODE_OAUTH_TOKENS= node --env-file=/dev/null scripts/probe-pool.mjs
# esperado: erro explícito "pool vazio". NUNCA "nenhuma conta com problema".
```

---

## US3 — a aba `/ia` responde

Abra `https://hub.roilabs.com.br/ia` depois de um ciclo noturno completo e confira:

| O que | Esperado |
|---|---|
| Consumo | quebrado **por empregado**, não só o total |
| Falhas | agrupadas por código estável, com contagem por código |
| Latência | p50 e p95 por empregado |
| Pool | estado datado por conta, com 429 e 403 visualmente distintos |
| Empregado não acionado | aparece como *não acionado*, distinto de *acionado sem falhas* |

**Bate com o bruto**: o consumo mostrado na aba tem que ser igual a

```sql
SELECT empregado, count(*), sum(tokens_entrada), sum(tokens_saida)
FROM ia_chamadas WHERE ambiente = 'prod' AND inicio > now() - interval '24 hours'
GROUP BY 1;
```

**Lacuna (SC-006)** — derrube a escrita de propósito e confira que a aba diz *lacuna*, jamais "zero
falhas":

```bash
# roda uma busca com o banco inacessível para o processo
DATABASE_URL=postgres://invalido:5432/x npm run start   # e faça uma busca
```

A busca **tem que continuar respondendo** (FR-007, primeira metade) e a janela **tem que aparecer como
lacuna** (segunda metade). As duas coisas ao mesmo tempo, ou a validação falhou.

---

## US4 — card sem ruído

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://hub.roilabs.com.br/api/estado
```

| Cenário | Esperado |
|---|---|
| Estado idêntico ao de ontem | **zero** card |
| Conta mudou de estado | 1 card nomeando conta, estado novo e desde quando |
| Só latência/volume mudaram de patamar | **zero** card — limiar numérico não gera card nesta feature |
| Primeira corrida do coletor | grava a linha de base e **não** gera card |
| Coletor estourou | zero chave, vira card de coletor caído, valores de ontem carregados |

**A validação que mais importa é a segunda corrida**: rode duas vezes seguidas sem mudar nada. A
segunda tem que sair silenciosa. Card que sai todo dia vira enfeite e sai da lista na primeira
sexta-feira.

**Esperado só no primeiro deploy**: a corrida seguinte ao deploy emite 3 novos + 3 resolvidos no
domínio `POOL`, porque a chave trocou de índice para hash. Não é achado. Acontece uma noite só.

---

## US5 — sondar o orçamento antes de gastar

```bash
node --env-file=.env scripts/orcamento.mjs --chamadas 85
```

**Esperado**: contas vivas, consumo já feito na janela e veredito sobre uma corrida de 85 chamadas.
Com duas de três contas indisponíveis, ele diz que a corrida é **arriscada** — que é a leitura que
teria evitado a corrida morta no meio, com o parcial gravado e nenhum número publicável.

**Custo da consulta**: no máximo 1 chamada por conta (SC-008). Se precisar de mais, a implementação
está gastando o pool para medir o pool.

**Corrida incompleta**: aborte uma corrida de régua com 3 falhas de conta seguidas e confira que os
registros dela ficam marcados e que **nenhum agregado** sai a partir deles — nem com aviso ao lado.

---

## Retenção (SC-005a)

```sql
-- resumo confere com o detalhe enquanto os dois coexistem (FR-023)
SELECT r.dia, r.empregado, r.chamadas,
       (SELECT count(*) FROM ia_chamadas c
         WHERE c.inicio::date = r.dia AND c.empregado = r.empregado AND c.ambiente = r.ambiente)
FROM ia_resumo r WHERE r.dia = current_date - 1;
-- as duas colunas têm que ser iguais, linha a linha
```

Depois de 90 dias, o detalhe some e `ia_resumo` continua respondendo o consumo diário por empregado.
`ia_pool` **não expira**: é ele que responde "morta desde quando" quando a resposta for "há três
meses".

---

## O que NÃO é critério de aceite

Nenhuma meta sobre o **valor** dos números na primeira janela — taxa de falha, latência, consumo. A
primeira corrida de um check novo mede o check, regra confirmada quatro vezes nesta base. Ler as
linhas uma a uma antes de olhar qualquer agregado.
