# Data Model: Indexação do sitemap

**Feature**: `022-indexacao-do-sitemap` | **Date**: 2026-09-07

---

## 1. Persistido — `hub_indexacao`

Uma linha por **apuração de um projeto num dia**. Criada no `ensure()` de `lib/db.ts`, junto das
outras, com `CREATE TABLE IF NOT EXISTS`.

| Coluna | Tipo | Notas |
|---|---|---|
| `projeto` | `TEXT NOT NULL` | o `slug` de `listProjects()`, nunca o rótulo de exibição |
| `dia` | `DATE NOT NULL` | dia da corrida |
| `propriedade` | `TEXT` | a propriedade do GSC usada; `NULL` quando `motivo = 'sem_propriedade'` |
| `declaradas` | `INT NOT NULL` | `<loc>` distintas no sitemap — o que o site **declara** |
| `inspecionadas` | `INT NOT NULL` | quantas foram efetivamente perguntadas ao GSC |
| `indexadas` | `INT NOT NULL` | |
| `rastreadas_nao_indexadas` | `INT NOT NULL` | "Crawled - currently not indexed" |
| `descobertas_nao_indexadas` | `INT NOT NULL` | "Discovered - currently not indexed" |
| `outras` | `INT NOT NULL` | inspecionadas, não indexadas, motivo fora das duas classes acima |
| `falhas` | `INT NOT NULL` | erro de rede ou de quota. **Fora** do numerador e do denominador |
| `motivo` | `TEXT` | `NULL` quando apurou. Senão: `sem_sitemap`, `sitemap_vazio`, `sem_propriedade`, `sem_orcamento` |
| `criado` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | quando esta linha foi (re)gravada |

**PK**: `(projeto, dia)` — mesma chave de idempotência que `hub_gsc_dia`. Rodar a corrida duas
vezes no mesmo dia regrava, não duplica.

**Escrita**: `ON CONFLICT (projeto, dia) DO UPDATE SET ... , criado = now()`, o mesmo padrão de
`gravarDiasGsc` (`lib/db.ts:798`).

### Invariante das contagens

```
inspecionadas = indexadas + rastreadas_nao_indexadas + descobertas_nao_indexadas + outras + falhas
inspecionadas ≤ declaradas
```

A primeira é asserção de teste, não comentário. Se ela quebrar, uma URL caiu em dois baldes ou em
nenhum — e é assim que uma taxa começa a mentir.

### `motivo = 'sem_orcamento'` não é `indexadas = 0`

FR-015. Um projeto pulado porque a propriedade esgotou o teto grava a linha do dia com
`declaradas` preenchido (o sitemap foi lido, isso não custa quota), `inspecionadas = 0` e
`motivo = 'sem_orcamento'`. Sem isso, "não perguntei" e "perguntei e deu zero" viram o mesmo
número — o erro que `zero_na_janela_nao_e_zero_no_mundo` nomeia.

### Por que a taxa não é coluna

`taxa = indexadas ÷ (inspecionadas − falhas)` é exata e derivada na leitura, como o CTR da 021.
Uma coluna gravada só cria a chance de divergir da própria divisão. Denominador `0` ⇒ taxa é
`null` (**não apurado**), nunca `0`.

### O detalhe por URL não é persistido

`hub_indexacao` guarda o **agregado do dia**. As URLs individuais não vão para o banco: 35
projetos × milhares de URLs × diário é volume que responde perguntas que esta spec não faz (a
US2 pede contagem por motivo, não a lista). A corrida devolve as URLs no corpo da resposta HTTP
para depuração da primeira corrida, e é só ali que elas existem. Se a lista de URLs recusadas
virar requisito de tela, é tabela nova numa spec nova.

---

## 2. Em memória — `lib/sitemap.mjs`

Módulo **puro de decisão**, com o `fetch` injetado. Sem `process.env`, sem `pg`.

```js
/** @typedef {{urls: string[], motivo: string|null, filhos: number, filhosLidos: number,
 *    profundidadeExcedida: boolean, erro: string}} Inventario */
```

| Função | Assinatura | Regra |
|---|---|---|
| `locs(corpo)` | `(string) => string[]` | todas as `<loc>`, na ordem do arquivo, **sem** deduplicar |
| `ehIndice(corpo)` | `(string) => boolean` | `/<sitemapindex/i` |
| `lerSitemap(url, buscar)` | `(string, fn) => Promise<Inventario>` | desce **um** nível em todos os filhos, concatena na ordem, dedupe preservando a primeira ocorrência |

`filhosLidos` e `erro` entraram na implementação e não estavam nesta tabela. `filhosLidos < filhos`
é um filho do índice que não respondeu: o inventário sai menor e o par de números **denuncia** isso
— sem ele, um sitemap parcialmente lido se apresentaria como o inventário completo do site. `erro`
separa "não deu para perguntar" (rede) de `sem_sitemap` ("perguntei, não é sitemap"): a corrida
manda o primeiro para `falhas` e só o segundo vira motivo gravado, pela mesma razão da FR-008 do
lado da inspeção.

`buscar` é `lib/conformidade.mjs:216` injetada — a rede fica fora do módulo e o teste roda com um
stub sem tocar em nada. `julgarSitemap()` decide `motivo`: corpo não-XML ⇒ `sem_sitemap` (é a
**ausência** de sitemap, não um sitemap vazio); XML válido com zero `<loc>` ⇒ `sitemap_vazio`.

**Dedupe preservando ordem** porque a D3 amostra o prefixo: reordenar mudaria a amostra entre
corridas e violaria a SC-004.

---

## 3. Em memória — `lib/indexacao-corrida.mjs`

Módulo **puro de orçamento e classificação**. Zero rede, zero banco — é o que torna as regras
mais caras desta feature testáveis sem gastar uma inspeção.

```js
/** @typedef {{slug: string, propriedade: string|null, declaradas: number, ultimaApuracao: string|null}} Candidato */
/** @typedef {{slug: string, cota: number}} Fatia */
```

| Função | Regra |
|---|---|
| `filaDoDia(candidatos)` | ordena por `ultimaApuracao` ascendente, `null` primeiro; desempate por `slug` para ser determinística |
| `repartir(fila, tetoPorPropriedade, tetoDaCorrida)` | percorre a fila e dá a cada projeto `min(declaradas, saldo da propriedade, saldo da corrida)`; cota `0` ⇒ `motivo: 'sem_orcamento'` |
| `amostra(urls, cota)` | `urls.slice(0, cota)` — o prefixo da D3 |
| `classificar(linha)` | `linha` como `inspecionarIndexacao` devolve → uma das cinco classes |
| `agregar(linhas)` | as cinco contagens + `taxa` e `rejeicao`, ambas `null` quando o denominador é 0 |

### `classificar` — a ordem dos testes importa

1. `erro` não vazio ⇒ `falha`. **Primeiro de tudo**, antes de olhar veredito: uma resposta de
   erro tem `verdict: ""` e cairia em "outra" se o erro fosse checado depois. É a FR-008 no
   código.
2. `estaIndexada(linha)` (`lib/indexacao.mjs:83`, reusada) ⇒ `indexada`.
3. `/^Crawled - currently not indexed/i` em `coverage` ⇒ `rastreada_nao_indexada`.
4. `/^Discovered - currently not indexed/i` ⇒ `descoberta_nao_indexada`.
5. resto ⇒ `outra`.

As classes 3 e 4 **nunca** somam num balde único (FR-009 / cenário 2 da US2): "rastreada e
recusada" é trabalho editorial, "descoberta e não lida" é trabalho de link e crawl. `D-84` já
mostrou que os prognósticos são incompatíveis.

### `repartir` é o coração da SC-003

O saldo é decrementado **por propriedade**, e 21 projetos que resolvem para
`sc-domain:roilabs.com.br` compartilham um único saldo. Uma corrida completa cabe no orçamento de
toda propriedade **por construção** — a asserção existe no teste, com 21 projetos fictícios de
1.000 URLs cada e teto de 2.000, verificando que a soma das cotas é exatamente 2.000 e não 21.000.

---

## 4. Os dois KPIs destravados — `lib/kpis-busca.mjs`

`urlsComImpressao` continua devolvendo a contagem (é o numerador). Duas funções novas, ambas com
o denominador **injetado**, nunca buscado:

| Função | Fórmula | Sem denominador |
|---|---|---|
| `activeIndexRatio(linhas, indexadas)` | `urlsComImpressao(linhas) ÷ indexadas` | `null` |
| `queryToPageRatio(linhas, indexadas)` | `consultasUnicas(linhas).valor ÷ indexadas` | `null` |

`indexadas ≤ 0` ou `null` ⇒ `null`, e a tela volta a exibir a contagem **com o motivo**
(FR-011). Denominador chutado é proibido; a spec 021 já deixou o Active Index Ratio como contagem
justamente para não inventá-lo.

O `queryToPageRatio` herda o piso de `consultasUnicas` — o GSC omite consultas raras da dimensão
`query`, então a razão é **piso**, e a tela repete esse rótulo.

---

## 5. Entidades da spec → onde cada uma mora

| Entidade da spec | Onde |
|---|---|
| **URL declarada** | efêmera: `Inventario.urls` + a linha de `inspecionarIndexacao`. Só o agregado persiste |
| **Apuração de indexação** | uma linha de `hub_indexacao` |
| **Orçamento de propriedade** | `INSPECOES_POR_PROPRIEDADE` (env) + o saldo em memória de `repartir()`. Não é tabela: é derivado da fila a cada corrida |

---

## 6. O que esta feature NÃO modela

- **URLs fora do sitemap** (páginas órfãs). O denominador é o que o site *declara*. Fica para a
  spec do crawl (024).
- **Histórico por URL.** Sem ele, "esta página específica saiu do índice em que dia?" continua
  irrespondível. Decisão consciente da seção 1.
- **Solicitar indexação.** A API é somente leitura, e a tela não deve sugerir o contrário.
