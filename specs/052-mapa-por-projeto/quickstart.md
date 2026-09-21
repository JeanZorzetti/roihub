# Quickstart: validar a 052

## 1. Suíte

```bash
npm test          # verde; inclui cadeiaLigada, SLUGS_DE_CAMPO e test/mapa-projeto.test.mjs (registrado)
npx tsc --noEmit  # limpo
```

## 2. SC-002: a Atma igual, antes e depois, no mesmo minuto

A janela fecha em D-3 e muda à meia-noite, então a comparação é local e simultânea (research D12):

```bash
# fora do OneDrive: o worktree precisa de node_modules próprio
git worktree add C:/dev/roihub-antes fc2ea3d604875dbc2d516bbb49c66cb19ca520e0
cp .env C:/dev/roihub-antes/.env        # não rastreado: o worktree não o traz
(cd C:/dev/roihub-antes && npm ci)
# em dois terminais:
(cd C:/dev/roihub-antes && npx next dev -p 3001)
npx next dev -p 3002
# o middleware pede Basic Auth em toda rota: as credenciais saem do .env sem ser impressas
export HUB_USER="$(grep -m1 '^HUB_USER=' .env | cut -d= -f2-)" HUB_PASS="$(grep -m1 '^HUB_PASS=' .env | cut -d= -f2-)"
curl -s -u "$HUB_USER:$HUB_PASS" localhost:3001/gsc/mapa      > antes.html
curl -s -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa/atma > depois.html
node scripts/conferir-mapa.mjs numeros antes.html depois.html   # esperado: "iguais: N números"
git worktree remove --force C:/dev/roihub-antes                 # depois de parar o servidor da 3001
```

- `curl -sI -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa` → `307` com `location: /gsc/mapa/atma` (FR-002).
- Tirando os números, o diff do texto de `<main>` só pode ter as trocas da tabela D5 (cabeçalho, frase do
  board e seletor). Nenhuma folha troca de estado.

## 3. SC-001 e SC-005: o mapa do Sirius

```bash
curl -s -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa/sirius > sirius.html
node scripts/conferir-mapa.mjs alheio sirius.html Atma    # esperado: 0 frases fora de EVIDENCIAS
curl -sI -u "$HUB_USER:$HUB_PASS" localhost:3002/gsc/mapa/tapepro   # 404 (FR-003)
```

- Cada folha com leitura própria abre com um número e a janela, ou com `∅` e o motivo. Um `0`/`0%` só
  pode aparecer onde o Search Console respondeu e contou zero (SC-001, FR-013).

- O cabeçalho diz "O que esta tela mede é o projeto Sirius CRM — siriuscrm.com.br".
- As seis faixas de posição mostram as impressões do Sirius, e os números são diferentes dos da Atma.
- "Depois do clique" diz que signup, ativado e trial pago não têm coletor, sem diagrama e sem taxa.
- A lista `#board-lista` tem ao menos 112 itens `<li>`: os 113 nós do board menos a raiz, mais os filhos
  medidos que a página antepõe.
- Vitais e Pass Rate mostram o número de campo ou `∅ sem dado na CrUX`, nunca "reprovado" (research D9).

## 4. SC-003 e FR-012: as corridas, no dia do deploy

Disparar as três pelo Actions (`workflow_dispatch`) depois do deploy, fora das janelas do Princípio IV, e
conferir no banco:

```sql
SELECT projeto, max(dia) FROM hub_gsc_dia        WHERE projeto IN ('atma','sirius') GROUP BY 1;
SELECT projeto, max(dia) FROM hub_indexacao      WHERE projeto IN ('atma','sirius') GROUP BY 1;
SELECT projeto, max(dia) FROM hub_pagina_corrida WHERE projeto IN ('atma','sirius') GROUP BY 1;
-- FR-012: zero lacunas no Sirius desde 06/09
SELECT count(*) FROM (SELECT dia - lag(dia) OVER (ORDER BY dia) AS d FROM hub_gsc_dia WHERE projeto='sirius') t WHERE d > 1;
-- research D7: com a marca aceita, os 141 dias antigos também ganham a separação
SELECT count(*) FILTER (WHERE impressoes_nao_marca IS NOT NULL), count(*) FROM hub_gsc_dia WHERE projeto='sirius';
```

- `hub_indexacao` do Sirius com `motivo IS NULL` e `inspecionadas = declaradas` (114 em 21/09), não `sem_orcamento`.
- `/okr/sirius/aquisicao` abre sem "⚠️ Fora do escopo" e com os KPIs do Search Console.
- No dia seguinte, depois das 06:30 BRT, repetir as três consultas de `max(dia)`: a SC-003 fala das corridas
  agendadas, e o disparo manual só adianta a prova.

## 5. SC-004: sete dias depois

No mapa do Sirius em produção, nenhuma das 11 folhas que leem o banco diz "nenhuma corrida gravada": crescimento
não-marca, marca, schema, título, intenção, profundidade, frescor, links, indexação limpa, rejeição de rastreio e
active index (spec US4).

## 6. Tela

`ui-verification` em `/gsc/mapa/sirius` e `/gsc/mapa/atma`: 1440, 768 e 360px; o seletor com o teclado
(SC-006); o console limpo.
