# Phase 1 — Modelo de dados

Três tabelas no Postgres que já existe (`DATABASE_URL`), donas de `lib/telemetria-db.mjs`. Prefixo
`ia_` no molde de `hub_*`/`seo_*`/`crm_*`: o prefixo agrupa por domínio.

Nomeação das colunas segue o **vocabulário** das GenAI semantic conventions do OpenTelemetry sem
adotar o SDK (`pesquisa.md` §3.2) — o mapeamento fica na última seção, para que o dia em que um
collector fizer sentido seja renomear coluna, não reinstrumentar.

---

## `ia_chamadas` — detalhe por tentativa (retenção: 90 dias)

Uma linha por **tentativa** contra uma conta. Não por pedido lógico: quando a 1ª conta devolve 429 e a
2ª responde, as duas aparecem — uma falha e um sucesso. A linha única de sucesso esconderia a
saturação, que foi o defeito de 31/07.

```sql
CREATE TABLE IF NOT EXISTS ia_chamadas (
  id           BIGSERIAL PRIMARY KEY,
  pedido       UUID NOT NULL,          -- agrupa as tentativas de UM pedido lógico
  corrida      TEXT,                   -- HUB_CORRIDA; NULL fora de medição
  empregado    TEXT NOT NULL,          -- ver enum abaixo
  ambiente     TEXT NOT NULL CHECK (ambiente IN ('prod','dev')),
  operacao     TEXT NOT NULL,          -- 'chat' hoje; existe para não renomear depois
  modelo       TEXT NOT NULL,          -- sonnet | opus | o que o CLI recebeu em --model
  effort       TEXT NOT NULL,          -- low | medium | high
  conta        TEXT NOT NULL,          -- hash de 8 chars | 'cli-ambiente' | 'cache'
  tentativa    INT  NOT NULL,          -- 1-based, a ordem em que o pool foi percorrido
  inicio       TIMESTAMPTZ NOT NULL,
  duracao_ms   INT NOT NULL,
  tokens_entrada INT NOT NULL DEFAULT 0,
  tokens_saida   INT NOT NULL DEFAULT 0,
  turnos       INT NOT NULL DEFAULT 0, -- num_turns; vem de graça no payload
  desfecho     TEXT NOT NULL,          -- 'ok' | '<prefixo>-<classe>'
  status_api   INT NOT NULL DEFAULT 0, -- api_error_status: 0/401/403/429; separa 429 de 403
  prompt_hash  TEXT NOT NULL,          -- sha1, a MESMA chave do cache
  prompt_chars INT NOT NULL,
  criado       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ia_chamadas_inicio ON ia_chamadas (inicio DESC);
CREATE INDEX IF NOT EXISTS ia_chamadas_emp ON ia_chamadas (empregado, inicio DESC);
```

**Regras que a tabela carrega**

- **Nenhuma coluna de texto livre do modelo.** Sem prompt, sem resultado, sem stderr (FR-004). A
  identificação do conteúdo é `prompt_hash` + `prompt_chars`, e o hash é o mesmo do
  `.cache/rerank.json` de propósito — dá para cruzar acerto de cache com a chamada original.
- **`conta` tem dois sentinelas** e eles não são "faltando": `cli-ambiente` é chamada sem pool
  configurado (autenticação ambiente do CLI, o que permite medir na máquina do dev) e `cache` é
  acerto de `.cache/rerank.json`. Consumo do pool filtra `conta NOT IN ('cache','cli-ambiente')`.
- **`status_api` sobrevive ao código.** `rerank-conta` não diz se foi 429 ou 403, e é essa distinção
  que decide entre esperar recarregar e comprar conta nova.
- **`ambiente = 'dev'` sai de toda agregação por default**, exceto consumo do pool (FR-009).

**`empregado`** (o conjunto fechado de hoje; empregado novo entra na série sem código, como
`nao-declarado`, e é isso que o torna visível):

| valor | onde nasce | prefixo do código de erro |
|---|---|---|
| `autopublish-draft` | `lib/autopublish-clients.ts` (`webSearch: true`) | `llm-` |
| `autopublish-ymyl` | `lib/autopublish-clients.ts` (classificador) | `llm-` |
| `rerank` | `lib/reranker.mjs` | `rerank-` |
| `resposta` | `lib/resposta.mjs` | `resposta-` |
| `juiz` | `lib/juiz.mjs` | `juiz-` |
| `defasagem` | `scripts/corpus-defasado.mjs` | `defasagem-` |
| `sonda` | `sondar()` em `lib/reranker.mjs` | `sonda-` |
| `nao-declarado` | qualquer chamador novo que não declarou | o da origem |

**`desfecho`**: `ok`, ou prefixo do empregado + uma das classes já validadas pela casa — `-auth`,
`-rate`, `-cli`, `-output`, `-parse`, `-timeout`, `-conta`. Mais uma, só desta feature:
`-corrida-incompleta`, a linha sentinela do D6. Classe nova entra no conjunto validado, como já
acontece com o regex de status de `run-autopublish.mjs`.

---

## `ia_resumo` — agregado permanente por dia

Sobrevive à expiração dos 90 dias. É o que responde "quanto o autopublishing consumiu em maio" quando
maio já não tem detalhe.

```sql
CREATE TABLE IF NOT EXISTS ia_resumo (
  dia            DATE NOT NULL,
  ambiente       TEXT NOT NULL,
  empregado      TEXT NOT NULL,
  chamadas       INT NOT NULL,       -- tentativas
  pedidos        INT NOT NULL,       -- distinct pedido
  falhas         JSONB NOT NULL,     -- {"rerank-conta": 3, "rerank-timeout": 1}
  tokens_entrada BIGINT NOT NULL,
  tokens_saida   BIGINT NOT NULL,
  p50_ms         INT NOT NULL,
  p95_ms         INT NOT NULL,
  PRIMARY KEY (dia, ambiente, empregado)
);
```

- **PK composta e upsert**, no molde de `run_date` em `hub_estado`: o Actions pode repetir o dia, e
  repetir tem que dar o mesmo resultado, nunca somar duas vezes.
- **Consolida o dia ANTERIOR**, nunca o corrente — dia fechado não muda mais, e isso é o que torna a
  operação idempotente.
- **`falhas` é mapa código→contagem**, não um total: FR-014 pede a quebra por código, e o total é
  derivável do mapa (o contrário não).
- **`p50`/`p95` via `percentile_disc(...) WITHIN GROUP (ORDER BY duracao_ms)`** — média esconde o caso
  que interessa.

---

## `ia_pool` — histórico datado de cada conta (permanente)

Uma linha por **transição**, não por leitura. É o que responde "desde quando" com precisão de 24 h
(SC-003), contra a melhor resposta disponível hoje — "em algum ponto de uma janela de ~10 h, há mais
de uma semana".

```sql
CREATE TABLE IF NOT EXISTS ia_pool (
  conta   TEXT NOT NULL,          -- hash de 8 chars
  estado  TEXT NOT NULL CHECK (estado IN ('viva','rate-limit','desabilitada','auth','outro')),
  desde   TIMESTAMPTZ NOT NULL,
  visto   TIMESTAMPTZ NOT NULL,   -- última sondagem que CONFIRMOU este estado
  PRIMARY KEY (conta, desde)
);
```

- **Grava só quando o estado MUDA.** Sondagem que repete a anterior atualiza `visto` e não cria linha
  — confirmar o estado não compra janela nova.
- **`visto` é obrigatório e é o antídoto do carry-over**: sem ele, um dia em que a sonda não rodou
  ficaria indistinguível de um dia medido igual, esticando o "desde quando" em silêncio. `desde` conta
  a história; `visto` diz até quando ela foi de fato verificada.
- **`rate-limit` (429) e `desabilitada` (403) nunca colapsam num rótulo só** (FR-011): uma recarrega
  sozinha e a outra não, e as duas prescrevem ações opostas — esperar contra repor conta.
- **Pool vazio estoura** e não escreve nada (FR-012): env var ausente é "não olhei", nunca "nenhuma
  conta com problema".
- **Permanente por decisão** (assumption da spec): é ele que responde "morta desde quando" quando a
  resposta for "há três meses", muito além dos 90 dias do detalhe.

---

## Entidades derivadas (sem tabela)

| Entidade da spec | De onde sai |
|---|---|
| **Corrida** | `GROUP BY corrida` em `ia_chamadas`. Incompleta = existe linha com `desfecho LIKE '%-corrida-incompleta'`; corrida incompleta não produz agregado (FR-017). |
| **Janela de observabilidade** | Recorte por `inicio`. Estado *sem telemetria* = a janela não tem nenhuma linha de `empregado = 'sonda'`, que roda toda noite (D7). |
| **Empregado** | A coluna. Os três estados da FR-016 (*não acionado* / *acionado sem falhas* / *sem telemetria*) saem de: linhas do empregado na janela × existência das linhas da sonda. |

## Mapa para o vocabulário OTel GenAI

| Coluna | Atributo `gen_ai.*` |
|---|---|
| `operacao` | `gen_ai.operation.name` |
| `modelo` | `gen_ai.request.model` |
| `tokens_entrada` | `gen_ai.usage.input_tokens` |
| `tokens_saida` | `gen_ai.usage.output_tokens` |
| `duracao_ms` | duração do span |
| `desfecho` (≠ `ok`) | `error.type` |
| `pedido` | `trace_id` (o pedido lógico; cada tentativa seria um span) |
| `empregado`, `conta`, `ambiente`, `corrida` | atributos próprios da casa — o pool não tem análogo no padrão porque o padrão pressupõe API paga, e aqui o orçamento é conta × janela de rate limit |
