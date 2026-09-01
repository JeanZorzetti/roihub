# A OKR não falta número — falta fator: leitura da pesquisa do funil matemático

**01/09/2026** · fonte `docs/deep-research/Funil Matemático SEO SaaS B2B.md` · ANÁLISE, nada implementado

## O pedido

> "Eu sinto que nós não temos uma OKR produzida de forma formal baseada em matemática. Temos KPIs
> muito macro, genéricas e primárias — CTR, clique, impressão, posição, as padrões do Search
> Console. Tenho a sensação de que tem **números ocultos** e, se eu tivesse ciência deles, poderia
> ir atrás de melhorá-los para melhorar as KPIs primárias e chegar numa OKR. Fiz essa pesquisa
> porque senti falta de me basear em número: número não mente. Quero mais matemática e
> previsibilidade de receita."

Quatro perguntas: (1) o que acho da pesquisa, (2) como aplicar no hub, (3) dá para mesclar no
ranking, (4) o diagnóstico por trás da motivação.

---

## 1. A ossatura da pesquisa presta. Os números, não.

O documento monta uma cascata de 5 níveis — N1 OKR/receita, N2 sintomas (GSC), N3 leading
(PageRank, content velocity), N4 diagnóstico técnico (crawl budget, TTFB, CWV), N5 execução
diária (bundle, cache, links internos) — e projeta €1.830.000 de ARR a partir de 35.294 sessões.

**Vale como ontologia**: dá um lugar para cada métrica morar e uma direção de causalidade. É
exatamente o que falta hoje, onde CTR e posição são números soltos sem nada dizendo "isso é
sintoma de quê".

### 🚩 A projeção de €1.830.000 tem barra de erro de ~60×, e a própria tabela do documento prova

Empilhando os pontos médios de cada linha da tabela de benchmarks que o próprio documento traz:

| cenário | visitante→lead | MQL→SQL | SQL→opp | opp→won | ponta a ponta |
|---|---|---|---|---|---|
| Média | 1,5% | 16,5% | 35% | 17,5% | **0,0152%** |
| Elite | 8% | 42,5% | 62,5% | 40% | **0,85%** |

`0,85 / 0,0152 = 56×`. As **mesmas** 35.294 sessões dão **5 clientes** (média) ou **300** (elite) —
€50k ou €3M de ARR. O modelo escolheu 8,5% de visitante→lead e 51% de MQL→SQL, ou seja **elite em
todos os estágios**, e apresentou o resultado como determinístico ("matemática e irrefutável").

É benchmark multiplicado por benchmark com a autoridade de um número apurado. É a mesma classe de
defeito que esta casa já nomeia em outro lugar: **afirmado × apurado**, e "aviso perde para
percentual".

### 🚩 A fórmula do INP se contradiz dentro do próprio parágrafo — 6× de diferença

- A prosa diz: *"cada 100 ms de latência adicional penalizam a taxa de conversão em sensivelmente
  **1% absoluto**"*.
- O exemplo trabalhado diz: INP de 700 ms leva uma base de 8,5% até **7,9%**.

Confere qual dos dois: `8,5 × (1 − 0,01×6) = 7,99 ≈ 7,9` → o exemplo é **1% RELATIVO**.
Pela regra escrita (absoluto), seria `8,5 − 6 = 2,5%`.

**São 6× no tamanho do efeito.** Quem construir meta de N5 lendo "absoluto" superprecifica conserto
de INP em 6× e desloca esforço de onde ele renderia.

### Os outros três reparos

- **PageRank / gap espectral**: matemática correta, operacionalmente inútil aqui. Você não observa
  o grafo do Google. Dá para calcular o gap espectral da *sua* malha interna, mas é a parte mais
  cara de implementar e a menos acionável do documento inteiro.
- **"304 Not Modified → 25× no volume de indexação"**: afirmação extraordinária com uma fonte só.
- **As 612 oportunidades são número pendurado**: o documento calcula `1.530 × 40% = 612` e depois
  ignora, aplicando 12% agregado direto sobre os 1.530 SQLs para chegar aos 183 clientes. Dois
  caminhos apresentados como um.

### 🚩 O ponto cego que mais custa a ESTE portfólio: não existe Nível 0 (demanda)

A fórmula de tráfego do documento é `T = Σ Vᵢ × CTR(pᵢ)` e trata **`Vᵢ` como dado**. Toda a cascata
assume que a demanda existe e o problema é capturá-la.

A realidade medida aqui é o contrário em pelo menos dois projetos:
- **aftercare**: 28 artigos, **4 impressões em 90 dias**. Não é INP, não é crawl budget — é ausência
  de mercado buscando.
- **atma**: 86% do tráfego em UMA URL, uma query de preço.

Aplicar a cascata nesses casos manda caçar bug no lugar errado. **E a ferramenta do N0 já existe na
casa**: o OpenSEO Keyword Planner (DataForSEO) é justamente quem mede `Σ Vᵢ`.

**Veredito:** guardar como mapa de onde as coisas moram. Não guardar nenhum número dele como meta.

---

## 2. Como aplicar no hub: o N1 é o vazio, e não por falta de ferramenta

Mapeamento do que JÁ existe contra os níveis do documento:

| Nível | O que o hub já tem | O que falta |
|---|---|---|
| **N5** execução | `lib/conformidade.mjs` (10 checks × 35), estado noturno (diff), `npm test`, autopublishing = content velocity | — |
| **N4** técnico | `lib/crawl.mjs` (crawl stats, export manual da UI), `lib/indexacao.mjs` (URL Inspection), stack/infra detectados do header | **TTFB por projeto, CWV reais, razão 5xx, razão 304** |
| **N3** leading | autopublishing (velocidade de cobertura), indexação | grafo interno / páginas órfãs |
| **N2** sintoma | `lib/series.mjs` + `lib/seo-score.mjs` — clicks/impr/CTR/posição, 28d vs 28d | — completo |
| **N1** alvo | `lib/vendas.mjs` (classificador do MP), `lib/crm.mjs` (ingest de lead) | **tudo — não há denominador** |
| **N0** demanda | *(nem o documento tem)* | volume de busca por projeto — OpenSEO/DataForSEO |

Três passos, do mais barato ao mais caro:

**A. Funil por projeto que MORRE onde o dado morre** (~1 script, zero infra nova, zero LLM).
Cruzar `series.mjs` (cliques 28d) × `crm.mjs` (leads por `origem`) × `vendas.mjs` (venda com data).
Onde a fonte não existe, imprime **`não apurado`** — nunca `0`. É a mesma regra do estado noturno
(fonte que não respondeu SAI da corrida em vez de cair para um valor que dá notícia boa). O
resultado vai mostrar que a maioria morre no passo 2. **Esse é o achado**, não o efeito colateral.

**B. CrUX API para os 35 domínios** — o "número oculto" mais barato que existe. LCP/INP/CLS de
usuário real, por origem, sem instrumentar nada nos sites. É literalmente o N4 do documento e é uma
chamada HTTP por projeto. E o coletor `CONF` do estado noturno **já faz um request contra cada uma
das 35 URLs de produção**: gravar `ttfb_ms` e status code ali custa zero marginal.

**C. Instrumentar o evento de lead nos projetos com tráfego.** `POST /api/crm/leads` +
`CRM_INGEST_SECRET` já existe e o sofia-next já manda. O buraco são os outros. Não é trabalho de
matemática — é encanamento, e é o único caminho para `CR(visitante→lead)` virar número medido em
vez de benchmark emprestado.

---

## 3. Mesclar no ranking: NÃO no `computeScore`, e o precedente é da própria casa

`lib/score.mjs` já tem essa decisão escrita, sobre `receitaProvada`:

> *"um campo quase todo nulo no score é pior que nenhum: ele empurraria 33 projetos para o mesmo
> lugar."*

**Qualquer número de funil N1 adicionado hoje é nulo em 34 de 35.** Entra e piora o ranking.

Mas há resposta melhor que "não". **O score responde "de quem o Jean precisa cuidar hoje". A
cascata responde "onde este projeto está travado".** São perguntas diferentes; misturar degrada as
duas.

**A proposta: um campo `nivelDoGargalo` (N0…N5)** — o nível mais profundo quebrado de cada projeto.
Diferente de todo o resto do N1, ele é **não-nulo para os 35** (sempre existe um nível mais fundo
quebrado) e é acionável na hora: *"goiania travado em N4, aftercare travado em N0"*. Deriva 100% de
dado que já existe: conformidade (N5), crawl/CWV (N4), indexação (N3), GSC (N2), CRM/vendas (N1),
keyword planner (N0).

E entra no score pelo **mesmo caminho que a `receitaProvada` tomou: relatório primeiro, peso depois,
com condição de entrada escrita NO CÓDIGO**, não na memória de quem leu. Condição sugerida: entra
quando ≥10 dos 35 tiverem N1 apurável (lead OU venda medida). Antes disso é coluna de tela, não peso.

---

## 4. 🚩 O diagnóstico por trás da motivação está errado por um grau

O instinto está certo: clique/impressão/CTR/posição são sintomas terminais, e não existe OKR. Mas a
causa **não é falta de números ocultos**.

A cascata do documento é uma multiplicação:

```
ARR = Tráfego × CR(visitante→lead) × CR(lead→SQL) × CR(SQL→opp) × CR(fecho) × ACV
```

Hoje, medido e não afirmado:

- `CR(visitante→lead)` — **não medido em 34 de 35**
- `CR(fecho)` — **zero eventos**. 0 de 35 com gateway ligado de verdade (o balde "LIGADO=1" foi
  desmentido DUAS vezes por duas réguas diferentes); os PRO do Polaris são trials expirados a R$ 0;
  zero checkout em 6 meses
- `ACV` — indefinido na maioria

**Pode-se medir INP, crawl budget e razão de 304 com perfeição absoluta e a OKR ainda resolve para
R$ 0**, porque há um fator zerado na multiplicação. Não existe número oculto que conserte um fator
zerado. A precisão dos outros termos não compra nada.

### A primeira OKR matematicamente defensável não é de receita — é de fechar o funil

Os key results são a **existência** das medições, não os valores delas:

- **KR1** — N projetos com caminho de cobrança provado por **POST real devolvendo `init_point`**
  (a régua já escrita nesta casa; 200 na página de preço não conta, e o atma provou isso duas vezes)
- **KR2** — N projetos emitindo evento de lead no CRM, para `CR(visitante→lead)` virar apurado
- **KR3** — primeiro R$ contado por `lib/vendas.mjs` com payer real

Não é prêmio de consolação: é a pré-condição literal. Sem KR1 e KR2 uma OKR de receita não tem
denominador, e qualquer meta escrita será benchmark de terceiro com cara de previsão — exatamente o
que o documento faz.

### E o número genuinamente oculto aqui não é o INP

É o **`CR(clique→lead)` por projeto**. É o multiplicador que decide se mais tráfego vale alguma
coisa. Há 35 sites gerando clique no GSC e **UM** funil instrumentado (a demo do `/agenda`,
instrumentada em 12/08). Enquanto essa razão for desconhecida, "melhorar CTR" é otimizar um fator
sem saber o sinal do próximo.

---

## Passo A — EXECUTADO no mesmo dia, e a resposta é ZERO

`lib/funil.mjs` (puro) + `scripts/funil.mjs` (coleta) + `test/funil.test.mjs` (7 casos, registrado
no `package.json`). Zero LLM, zero pool, zero infra nova. Três fontes que já existiam: GSC (cliques,
janela 28d fechando em D-3), `crm_leads` (leads por pipeline), campo `vendas` do card.

```
node --env-file=.env scripts/funil.mjs [--ver]
```

**Corrida de 01/09/2026, janela 01/08 → 29/08:**

| onde o funil MORRE | n |
|---|---|
| nem cliques | 1 |
| para nos cliques | 31 |
| para nos leads | 3 |
| **mensurável até vendas** | **0** |

- **0 de 35 têm funil mensurável de ponta a ponta.** O palpite era 1; era otimista.
- **1 tem taxa clique→lead apurada:** `polarisia`, **6,67% (2/30)**.
- Os 3 que chegam ao degrau de leads são `polarisia` (2), `matchfios` (1), `verticemarketing` (1).
- `portfolio` é o único sem nem cliques — `*.vercel.app` fica fora de toda propriedade do GSC.

**Isto fecha a discussão da OKR por medição, não por opinião:** não existe hoje um único projeto do
qual se possa derivar `ARR` pela cascata da pesquisa. Escrever meta de receita agora seria escrever
benchmark de terceiro.

### O que a primeira corrida achou do próprio CHECK (VER-08, mais uma vez)

**A régua concorda com uma régua independente:** `atma` deu 535 cliques nas duas — neste script e no
`serie-gsc.mjs` somando a série diária da mesma janela. E as 3 linhas de lead conferem contra o
`crm_leads` lido à mão (polaris 2 em 10 e 11/08; matchfios tem 2 mas a de 31/08 cai FORA da janela;
vertice 1 em 16/08).

**Um defeito real, consertado na hora:** a primeira versão imprimia `6,67%` sozinho. Esse número cai
na faixa de **ELITE** da tabela de benchmarks da pesquisa (5–11% para visitante→lead) e é **2 leads
em 30 cliques** — ruído de amostra com cara de performance. Agora a fração sai colada no percentual,
dentro do texto: `6,67% (2/30)`. Aviso ao lado perde para percentual; denominador dentro, não.

**Achado de brinde, não do funil:** os 5 leads que o CRM tem na vida inteira estão TODOS em
`etapa=perdido`. Não muda nenhuma célula deste relatório e não foi investigado aqui.

### As três regras que o `lib/funil.mjs` existe para sustentar

1. **`0` e `não apurado` nunca ocupam a mesma casa.** Cada célula é `{valor}` ou `{naoApurado: motivo}`.
2. **`0/0` NÃO é 0%.** É a diferença entre "ninguém que chegou converteu" (problema de conversão) e
   "ninguém chegou" (problema de tráfego, ou de demanda). Vira `não apurado`.
3. **Numerador > denominador vira `não apurado`, nunca taxa acima de 100%.** Lead sem clique no GSC
   significa que as pontas não medem a mesma coisa — outro canal, ou propriedade que não cobre o host.

E a regra de fora: **pipeline cadastrada com ZERO lead na história inteira é `não apurado`, não 0** —
não separa "o site não manda evento" de "manda e ninguém converteu", e as duas hipóteses pedem
trabalho oposto (encanamento × oferta). É por isso que o `atma`, com 535 cliques, aparece sem lead
apurado em vez de com 0,00%.

## Próximo passo (não executado)

Com o número na mão, o KR2 do handoff deixa de ser abstrato: **instrumentar evento de lead nos que
têm tráfego e não têm medição** — `atma` (535 cliques), `sirius` (56), `estetiacrm` (23). São os três
únicos do portfólio com tráfego relevante e nenhum denominador. `POST /api/crm/leads` +
`CRM_INGEST_SECRET` já existem; falta o lado dos sites.
