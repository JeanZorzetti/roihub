# Pesquisa: o que "observabilidade de IA" significa em 2026 — e o que disso vale aqui

**Data**: 2026-08-10 · **Feature**: `002-observabilidade-ia`

Esta pesquisa existe para a spec não reinventar vocabulário nem importar peso de ferramenta que
este repo não paga. Ela tem três partes: o estado da arte, o inventário do que o roihub JÁ tem, e
as decisões que a pesquisa fecha antes de a spec começar.

---

## 1. O estado da arte

### 1.1 Observabilidade de IA não é APM com outro nome

A disciplina se separou do monitoramento de aplicação em três eixos, e a diferença é de **modelo de
dados**, não de dashboard:

| Eixo | APM clássico | Observabilidade de IA |
|---|---|---|
| Unidade | hop HTTP / request | **span** (`chat`, `execute_tool`, `invoke_agent`, `retriever`) |
| Sinal de qualidade | taxa de 5xx | **score de eval** (a chamada devolve 200 e a resposta está errada) |
| Custo | CPU-segundo | **tokens**, atribuídos por tag na raiz do trace |
| Saturação | CPU/memória/conexões | **rate limit e quota** do provedor |

O ponto que mais importa aqui: **em IA, sucesso de transporte não é sucesso de tarefa.** Um `exit 0`
com JSON válido pode conter uma resposta sem procedência. Por isso a stack tem uma quarta camada
além de traces/métricas/logs: **evals**.

### 1.2 O padrão de fato: OpenTelemetry GenAI semantic conventions

As convenções `gen_ai.*` saíram do repositório principal do OpenTelemetry e hoje moram em repo
próprio (`semantic-conventions-genai`), com spans, métricas e eventos para clientes GenAI, MCP e
provedores específicos. O núcleo estável:

**Atributos de span**
- `gen_ai.operation.name` — `chat`, `execute_tool`, `invoke_agent`
- `gen_ai.request.model` / `gen_ai.response.model`
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`
- `gen_ai.response.finish_reasons` — `stop`, `tool_calls`, `length`…
- `gen_ai.data_source.id` — a fonte de grounding em RAG
- `gen_ai.system_instructions`, `gen_ai.input.messages`, `gen_ai.output.messages` — **só quando a
  captura de conteúdo é ligada explicitamente**

**Métricas recomendadas** (só duas, e é deliberado)
- `gen_ai.client.operation.duration` — histograma de latência, filtrável por modelo
- `gen_ai.client.token.usage` — histograma de consumo, filtrável por tipo de token

**Forma do trace de agente**: um span raiz `invoke_agent`, com filhos `chat` (cada chamada de LLM) e
`execute_tool` (cada ferramenta). Há proposta em aberto para sistemas agênticos multi-agente
(tarefas, ações, times, artefatos, memória) — **ainda não estabilizada**, e por isso não é base
segura para desenhar nada agora.

**Conteúdo não é capturado por padrão.** Prompt, argumentos de ferramenta e resposta ficam de fora a
menos que se ligue uma opção. A razão é sensibilidade de dados — e ela vale duplamente aqui (§3.4).

### 1.3 O modelo de eval em três camadas

Quem opera agente confiável converge para a mesma pilha:

1. **Unit / determinístico** — asserção barata, sem LLM (formato, presença de citação, schema).
2. **LLM-as-judge** — um segundo modelo julga a saída do primeiro, com portões de calibração.
3. **Amostragem de produção** — scorers online em uma fatia do tráfego real.

E o **loop de realimentação**: trace de produção que reprova num scorer online vira caso de eval. A
suíte cresce a partir do comportamento real, e a regressão seguinte é pega automaticamente.

### 1.4 Os sinais operacionais que se alerta

Latência (p50/p95), taxa de erro, throughput, **custo por hora contra orçamento diário** e
**saturação de rate limit**. Dois detalhes reutilizáveis:

- **Limite por token, não por requisição**: um prompt longo consome muito mais que muitas
  requisições curtas, então RPS sozinho não protege SLO nenhum.
- **A razão p99/p50 de custo é um detector**: se a requisição do percentil 99 custa dezenas de vezes
  a mediana, quase sempre é `max_tokens` sem trava.

### 1.5 Amostragem

Tail-based sampling: decide-se guardar o trace **depois** de saber como ele terminou, ficando com os
que falharam, os lentos e os caros. Guardar 100% de tudo é o modo default de estourar armazenamento
sem ganhar diagnóstico.

---

## 2. O inventário: o que o roihub já tem (verificado no código, 10/08)

**Seis consumidores de claude-cli**, em **duas** implementações de `spawn` duplicadas de propósito:

| Consumidor | Onde | Custo por corrida | Telemetria hoje |
|---|---|---|---|
| Autopublishing (draft + classificador YMYL) | `lib/autopublish-clients.ts` | 10 projetos/dia | tokens em `seo_publications` |
| Reranker da `/busca` | `lib/reranker.mjs` | 1 chamada/busca | **nenhuma** |
| Síntese da resposta | `lib/resposta.mjs` | 1 chamada/busca | **nenhuma** |
| Juiz | `lib/juiz.mjs` | 3 chamadas/pergunta | JSON de corrida em `data/juiz-corridas/` |
| Detector de defasagem | `scripts/corpus-defasado.mjs` | 1 chamada/documento | JSON em `data/corpus-defasado/` |
| Sonda do pool | `lib/reranker.mjs` (`sondar`) | 1 chamada/conta | `data/pool-sondagens.json` (3 leituras) |

**O que já é bom e não se toca:**
- **Códigos de erro estáveis**, nunca a mensagem do modelo: prefixo por consumidor
  (`llm-`, `rerank-`, `resposta-`, `juiz-`) + sufixo por classe (`-auth`, `-rate`, `-cli`,
  `-output`, `-parse`, `-timeout`, `-conta`). Isso já é o `finish_reasons` da casa, e é melhor:
  separa falha de instrumento de falha de resultado.
- **`classificarConta`** devolve `viva | rate-limit | desabilitada | auth | outro` — a distinção
  429 (recarrega esperando) × 403 (não recarrega) é exatamente a "saturação × quota" do §1.4, e a
  casa chegou nela antes por conta própria.
- **As réguas de qualidade estão à frente do mercado**: o juiz roda em duas passadas com dois
  portões (holdout cego ≥ 85% e adversarial), o dourado de `estado` é **apurado na hora** em vez de
  escrito, e `scripts/validade.mjs` é eval determinístico dentro do `npm test`. As três camadas do
  §1.3 existem. **O que falta não é mais eval — é série temporal de produção.**

**O buraco, nominal:**

1. **`spawnClaude` (`lib/reranker.mjs:243`) resolve `payload.result` e joga fora o resto.** O
   claude-cli devolve `total_cost_usd`, `duration_ms`, `num_turns`, `usage` e `session_id` em TODA
   chamada — e quatro dos seis consumidores descartam os cinco. A telemetria já chega; ninguém a lê.
2. **`seo_publications` é uma linha por PUBLICAÇÃO, não por chamada** (PK `project_slug, run_date`).
   As várias chamadas de um dia colapsam numa linha, e `estimated_cost_usd` é **nominal** — com
   claude-cli o gasto marginal é zero e o recurso escasso é outro (§3.1).
3. **A saúde do pool mora num arquivo do repo**, não em banco: `data/pool-sondagens.json` tem **3
   leituras**, duas delas a 13 minutos de distância. **O 403 da conta 3 continua sem data**, e é essa
   data que decide comprar conta (reposição) ou não (só esperar o 429 recarregar).
4. **A `/busca` não deixa rastro nenhum.** Quando ela morreu em produção em 31/07, ninguém soube: o
   sintoma foi `rerank-output`/`resposta-output` — "o modelo escreveu bobagem" — quando a causa era
   duas de três contas mortas. Um contador por código de erro teria mostrado a mudança de regime.

---

## 3. As decisões que a pesquisa fecha

### 3.1 O eixo caro NÃO é dólar — é o pool

Não há API paga neste projeto: o único LLM é a assinatura Claude via `claude setup-token`. Logo
`estimated_cost_usd` é ficção contábil útil só para comparar prompts entre si. **O orçamento real é
"chamadas contra N contas de assinatura por janela de rate limit"**, e ele já foi estourado de forma
cara: uma corrida do portão custa 85 chamadas contra 3 contas que o autopublishing divide, e uma
corrida morta no meio virou pool em pó.

→ A unidade de custo desta spec é **chamada** e **conta-janela**, com dólar como campo secundário.

### 3.2 Adotar o VOCABULÁRIO do OTel, não o SDK

Instalar SDK e collector de OTel para seis `spawn` de CLI seria mais infra que produto — e este repo
não tem nem jest, por decisão. Mas nomear os campos como o padrão nomeia (`operacao`, `modelo`,
`tokens_entrada`, `tokens_saida`, `duracao_ms`, `motivo_fim`) custa zero e mantém a porta aberta:
o dia em que um collector fizer sentido, o mapeamento é renomear coluna, não reinstrumentar.

→ **Convenção sim, dependência não.** As duas métricas do §1.2 (duração e tokens) são as duas que
importam, e as duas já vêm no payload que hoje se descarta.

### 3.3 Falha FECHADA vale para a telemetria também

A regra do `nao_apurado` é a corretude inteira do estado noturno: fonte que não respondeu SAI da
corrida em vez de cair para um valor que dá notícia boa. **Registro de IA tem exatamente o mesmo
risco, com o sinal invertido**: se a escrita da telemetria falhar em silêncio, a janela aparece como
**zero falhas** — que é o melhor placar possível produzido pelo pior estado possível.

→ Lacuna de telemetria é um estado próprio, nunca ausência de linha.

### 3.4 O conteúdo do prompt NÃO entra

O padrão deixa a captura de conteúdo desligada por default por sensibilidade. Aqui o argumento é
mais forte e já está escrito no código (`lib/autopublish-clients.ts:146`): **o corpo do erro pode
conter o prompt inteiro**, e o prompt do reranker carrega até 50 trechos do corpus — memórias,
handoffs, cards. Gravar isso numa tabela é copiar o corpus para dentro do banco de operação.

→ Grava-se **hash do prompt** (a chave de cache já é um: `chave(prompt, modelo, effort)`), tamanho e
código de erro. Nunca o texto.

### 3.5 O observador consome o recurso observado

A sonda gasta 1 chamada por conta. Isso não é defeito — é o preço de saber, e é barato (~40 s)
contra as 85 do portão. Mas obriga duas coisas: a telemetria da sonda tem que ser **distinguível**
do tráfego que ela mede, e a série tem que registrar **quem gastou**, não só quanto se gastou.

### 3.6 A primeira corrida vai medir o CHECK

Regra da casa, confirmada quatro vezes (conformidade, gateways ×3, validade, `D-85`). Uma frente de
observabilidade tem a forma exata do erro: o primeiro painel vai mostrar números que parecem achado
e são defeito de coleta. **A spec assume isso e não põe meta numérica na primeira janela.**

---

## Fontes

- [Gen AI attributes registry — OpenTelemetry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)
- [open-telemetry/semantic-conventions-genai](https://github.com/open-telemetry/semantic-conventions-genai)
- [Semantic Conventions for Generative AI Agentic Systems (issue #2664)](https://github.com/open-telemetry/semantic-conventions/issues/2664)
- [Agent observability: the complete guide for 2026 — Braintrust](https://www.braintrust.dev/articles/agent-observability-complete-guide-2026)
- [AI Agent Observability: everything you need to know in 2026 — Confident AI](https://www.confident-ai.com/blog/ai-agent-observability)
- [Agent Observability 2026: evals, traces, cost](https://www.digitalapplied.com/blog/agent-observability-2026-evals-traces-cost-guide)
- [Observability in AI gateways: key metrics — TrueFoundry](https://www.truefoundry.com/blog/observability-in-ai-gateway)
- [Rate limiting in an AI gateway — TrueFoundry](https://www.truefoundry.com/blog/rate-limiting-in-llm-gateway)
- [From bills to budgets: tracking token usage and cost per user — Traceloop](https://www.traceloop.com/blog/from-bills-to-budgets-how-to-track-llm-token-usage-and-cost-per-user)
- [LLM monitoring best practices 2026 — OpenObserve](https://openobserve.ai/blog/llm-monitoring-best-practices/)
