# Contrato: o coletor `IA` no estado noturno e o delta do `POST /api/estado`

A corrida das 23:37 BRT já tem quatro coletores e entrega o **diff**, nunca placar. Esta feature
acrescenta um quinto e re-chaveia o `POOL`. Nenhum cron novo, nenhum segredo novo.

**Ordem contra o autopublishing continua deliberada**: 23:37 mede o pool **em repouso**. Depois das
00:13 a sondagem mediria o pool drenado e chamaria de morta (403) a conta que só está em 429.

---

## Células

O contrato do estado noturno é `DOMINIO:slug:id → rótulo`, e só célula que **apareceu** ou **sumiu**
vira card.

### `POOL` — re-chaveado por hash (mudança)

| Antes | Depois |
|---|---|
| `POOL:1:rate-limit` | `POOL:a1b2c3d4:rate-limit` |

Índice posicional sai por FR-002a: reordenar `CLAUDE_CODE_OAUTH_TOKENS` faria o histórico de uma conta
virar o da outra em silêncio, quebrando exatamente o "desde quando" que a US2 existe para produzir.

**Efeito de day one, conhecido e aceito**: a primeira corrida depois do deploy emite 3 "novos" e 3
"resolvidos" que não são achado nenhum — o rótulo trocou de chave. Ruído de uma noite só; nomear no
commit.

O rótulo passa a carregar a data: `desabilitada desde 2026-08-02`.

### `IA` — novo

| Chave | Quando entra | Rótulo |
|---|---|---|
| `IA:empregado:<nome>` | o empregado teve ≥ 1 falha na janela de 24 h | o código mais frequente (`rerank-conta`) |
| `IA:coletor:telemetria` | `ultimaSonda` ausente ou mais velha que **36 h** | `sem telemetria desde <quando>` |

A lacuna **não** se mede por "sonda ausente na janela de 24 h": o Actions atrasa o cron em ~97 min
(medido), então uma janela rígida joga a sonda para fora sozinha e o coletor emite card sobre um
sistema saudável — o oposto exato do que a US4 existe para fazer. 36 h = 24 h + duas vezes o atraso
observado.

**Só isso.** Nenhum limiar numérico (FR-018): latência que dobra, volume que triplica e taxa que sobe
**não** viram card — ficam visíveis na aba `/ia`. Limiar sobre linha de base não calibrada fabrica
card, e card ruidoso mata o mecanismo de card que hoje funciona.

Empregado que **parou** de falhar sai da célula sozinho, e o diff o reporta como resolvido — o mesmo
mecanismo, sem código novo.

---

## Falha fechada

O coletor `IA` **estoura** (e sai do diff via `dominiosOk`) quando:

- o banco não responde;
- `atualizarPool` recebe pool vazio.

Coletor que estoura devolve zero chave e carrega os valores de ontem por `mesclarEstado` — sem isso o
diff leria a ausência como conserto, que é a fabricação que o `dominiosOk` existe para barrar.

**Cuidado que esta feature acrescenta**: "zero linha na série" **não** é falha do coletor — é uma
leitura legítima que significa lacuna de telemetria, e por isso vira a célula `IA:coletor:telemetria`
em vez de um `throw`. Confundir as duas mandaria o diagnóstico para o lugar errado, como
`request-failed` do autopublish (que é o hub fora do ar, não o modelo falhando).

**Primeira corrida não gera card**: `primeiraCorrida`/`estadoAnterior` já cuidam disso — mas só da
primeira corrida do **aparato**. Ver a seção seguinte.

---

## Domínio novo não gera card

O domínio `IA` nasce com `hub_estado` já povoado: `primeiraCorrida` devolve `false` e **todas** as
células dele sairiam como novidade na estreia. A guarda vai um nível abaixo — **domínio ausente por
inteiro do estado anterior fica fora do diff na primeira aparição**, grava e cala. É a mesma regra da
1ª corrida, aplicada por coletor em vez de por corrida, e é o que a FR-019 pede de fato.

São ~2 linhas em `diffEstado`: o predicado `conta` passa a exigir também
`conhecidos.has(dominioDe(k))`, com `conhecidos` derivado das chaves do estado anterior.

**Não vale para o `POOL`.** Aquele domínio já existe, e a troca de chave (índice → hash) produz 3
novos + 3 sumidos numa noite. Ruído conhecido e nomeado no commit — a alternativa seria reescrever as
chaves antigas usando a ordem atual de `CLAUDE_CODE_OAUTH_TOKENS`, que é exatamente a premissa que a
FR-002a proíbe confiar.

---

## Ausência total de linhas ≠ falha de infraestrutura

Empregado sem nenhuma linha na janela é *não acionado*. Quando o hub cai na madrugada, o
`run-autopublish.mjs` morre no `fetch` (`request-failed`) e **nunca chega ao `claudeRun`** — não há
chamada de LLM, logo não há linha, e a série mostra corretamente que o empregado não rodou. Isso é
assunto do log do Actions, não da série: se a leitura tratar as duas coisas como a mesma, o
diagnóstico vai de novo para o lugar errado, como já foi em 02/08 e 03/08.

---

## Delta do `POST /api/estado`

```
coletores = [ CONF, GTW, REPO, POOL, IA ]        // IA é o quinto, serial como os outros
                                                  // (o `sondar` troca process.env; paralelo vira corrida)
...diff, card, gravarEstado como hoje...
+ await consolidar(ontem)                         // upsert idempotente em ia_resumo
+ await expirar(90)                               // DELETE do detalhe fora da janela
```

`consolidar` e `expirar` rodam **depois** do diff e nessa ordem — inverter perderia o último dia. As
duas são idempotentes: repetir o dia dá o mesmo resultado, como `run_date` é PK de `hub_estado`.

Resposta da rota ganha três campos, para o Actions imprimir no log:

```json
{ "runDate": "…", "primeira": false, "celulas": 41, "novos": 1, "sumidos": 0,
  "falhas": [], "card": "criado",
  "resumo": 7, "expiradas": 0, "telemetria": "ok" }
```

`telemetria` é `"ok"` ou `"lacuna"` — a mesma distinção da célula, visível sem abrir a aba.

`maxDuration` continua 600: o coletor IA são duas queries e não move a conta.

---

## A aba `/ia`

Server component `force-dynamic`, no padrão de `/crm` e `/busca`; `Tabs` ganha `"ia"` na união e no
nav. Lê só por `lib/telemetria-db.mjs`. Mostra, para a janela escolhida (24 h por default):

1. **Consumo por empregado** — chamadas, pedidos, tokens. Nunca só o total (FR-014).
2. **Falhas agrupadas por código estável**, com contagem por código.
3. **Latência p50/p95 por empregado.**
4. **Pool datado** — por conta: estado, desde quando, última confirmação. `rate-limit` e
   `desabilitada` visualmente distintos (FR-011).
5. **Os três estados por empregado** (FR-016): *não acionado* ≠ *acionado sem falhas* ≠ *sem
   telemetria*. Pelo mesmo motivo pelo qual o placar de conformidade imprime `n/a` separado de
   aprovado.
6. **Lacuna explícita** quando a janela não tem linhas da sonda — nunca "zero chamadas", nunca "zero
   falhas" (FR-007, SC-006).

Corrida marcada como incompleta não produz agregado na aba (FR-017): a linha aparece nomeada, sem
percentual. Aviso ao lado do número perde para o número — foi assim que 19,2% de recusa fantasma foi
publicado em 31/07.
