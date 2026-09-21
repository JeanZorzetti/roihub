# Quickstart: validar a 051

## 1. Suíte

```bash
npm test          # verde; inclui classes, fila e último orçamento
npx tsc --noEmit  # limpo
```

## 2. Números contra a fonte (mesmo dia)

```bash
set -a; . ./.env; set +a
curl -s -u "$HUB_USER:$HUB_PASS" https://hub.roilabs.com.br/okr/atma   > /tmp/okr.html
curl -s -u "$HUB_USER:$HUB_PASS" https://hub.roilabs.com.br/gsc/mapa  > /tmp/mapa.html
```

- Os degraus da cadeia no mapa são iguais aos de `/okr/atma` (SC-004).
- O primeiro item em cliques é `/blog/quanto-custa-alinhador-invisivel`, com os mesmos "faltam N cliques" de
  `/okr/atma/aquisicao` (SC-003). Nenhum "total" no HTML do painel.
- `/okr/atma` publica o valor em aberto pelo último orçamento por pessoa (SC-006). Conferir contra o banco
  com a consulta de pessoas × último orçamento do handoff.

## 3. Tela

`ui-verification`: 1440, 768 e 360px; o painel legível em 360 pela lista servidor (SC-005); 5 segundos para
dizer onde a cadeia trava (SC-001).
