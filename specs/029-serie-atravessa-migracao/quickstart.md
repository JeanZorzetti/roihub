# Quickstart — 029

## Conferir o defeito antes de consertar

O script de conferência consulta as duas propriedades e imprime dia a dia. Rode antes e depois:

```bash
node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-09-01 2026-09-16
```

Em 18/09/2026 ele imprimia (o que a spec cita como fato medido):

```
2026-09-14     687   32     719
2026-09-15   1.146   31   1.177
```

E o banco tinha `687`, `1146` e — em 16/09 — `35`.

## Rodar a corrida

```bash
# local, contra o banco de produção do .env
curl -s -X POST localhost:3000/api/gsc-serie -H "authorization: Bearer $CRON_SECRET" | jq

# corrigir o histórico da transição (uma vez, depois da corrida normal passar)
curl -s -X POST localhost:3000/api/gsc-serie \
  -H "authorization: Bearer $CRON_SECRET" -H 'content-type: application/json' \
  -d '{"desde":"2026-09-11"}' | jq
```

`desde` é a data declarada em `dominioAnterior.data`. Rodar duas vezes com a mesma data produz o
mesmo resultado (SC-006).

## As três conferências que fecham a entrega

1. **O dia mede o negócio** — o banco bate com o script:

   ```sql
   SELECT dia, impressoes, host FROM hub_gsc_dia
    WHERE projeto = 'atma' AND dia >= '2026-09-10' ORDER BY dia;
   ```

   15/09 deve valer `1177` com assinatura `atma.roilabs.com.br+usealigner.com`.

2. **Nada antes da troca mudou** (SC-005) — guardar o antes e comparar:

   ```sql
   SELECT count(*) FROM hub_gsc_dia
    WHERE projeto = 'atma' AND dia < '2026-09-11' AND criado > now() - interval '1 hour';
   ```

   Tem de voltar `0`: nenhum dia anterior à troca foi regravado.

3. **A tela lê uma série só** — abrir `/okr/atma/aquisicao` e conferir que:
   - o veredito do topo não diz que a série está encerrada;
   - a semana de 14/09 tem barra, não coluna vazia;
   - a fronteira aparece marcada e datada no gráfico.

## Suíte

```bash
npm test
```

Os dois arquivos novos (`serie-soma-hosts` e `serie-migracao-regressao` — este último absorveu a
cobertura de segmento/semana que o plano previa em arquivo próprio) precisam estar em
`package.json` — `test/validade.test.mjs` reprova a
suíte se algum ficar de fora (Princípio II).
