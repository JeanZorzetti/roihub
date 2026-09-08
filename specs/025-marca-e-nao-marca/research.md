# Research: Marca e não-marca (025)

Decisões técnicas e alternativas rejeitadas. Cada `Dn` é citada pelo `plan.md`.

---

## D1 — Não-marca é MEDIDA, não subtraída. Três pernas, não duas.

**Decisão**: a corrida pede ao Search Console **três séries diárias** para o projeto, todas com
`dimensions: ["date"]` e **sem** a dimensão `query`:

| perna | filtro adicional | vira |
|---|---|---|
| **total do corte** | país | `impressoes_pais`, `cliques_pais` |
| **marca** | país **+** `query includingRegex R` | `impressoes_marca`, `cliques_marca` |
| **não-marca** | país **+** `query excludingRegex R` | `impressoes_nao_marca`, `cliques_nao_marca` |

`R` é **o mesmo padrão** nas duas últimas (D3). Marca e não-marca são complementares **por
construção**, e a diferença contra o total do corte é observável (D8).

**Rationale**: a spec abre declarando que `total − marca` está errado, e o `CLAUDE.md` já mede o
porquê ("Impressão pede `dimensions: []`; clique não-branded pede `query` — 5 contra 33 no
tapepro"). A subtração devolve *não-marca **mais** o que o Google anonimizou*, inflando
exatamente o KPI que se quer ver subir. Medir as duas pernas separadamente custa **uma
requisição a mais** e transforma a pergunta aberta da spec num número que a própria corrida
apura.

**Alternativas rejeitadas**:

- **`total − marca`** (a proposta do handoff de 07/09): o defeito central que a spec existe para
  não repetir.
- **Uma requisição com `dimensions: ["date", "query"]`, classificando em casa**: é justamente a
  forma que OMITE as consultas raras. Traria o piso disfarçado de total e ainda pagaria dezenas de
  milhares de linhas por corrida.
- **`dimensions: ["date", "country"]` para poupar a perna do total**: acrescenta uma dimensão de
  agrupamento sem necessidade e mistura a pergunta "o filtro de consulta preserva as raras?" com
  "o agrupamento por país preserva as raras?". Duas incógnitas numa medição só não respondem
  nenhuma.

---

## D2 — O corte por país vale para as TRÊS pernas, ou a verificação mede a si mesma

**Decisão**: o filtro de país entra nas três pernas. A coluna `impressoes` da 021 (site inteiro,
sem corte) **não é tocada** e continua sendo o total da tela de 8 meses. O denominador da razão de
marca e o alvo da conferência da FR-006 é `impressoes_pais`, nunca `impressoes`.

**Rationale**: é a armadilha de "a primeira corrida mede o CHECK", que esta base já pagou quatro
vezes. Com marca e não-marca cortadas por país e o total sem corte, a soma **jamais** fecharia — e
a diferença resultante mediria o corte de país, não a anonimização. A conferência ficaria
permanentemente vermelha por um motivo que não é o investigado.

E o corte não é preciosismo neste projeto: **"atma" é palavra comum** (termo sânscrito). Sem corte
por país, buscas vindas da Índia entrariam no balde de marca de uma ortodontia brasileira. É o
edge case "termo de marca que também é palavra comum" acontecendo no projeto piloto, não no
segundo.

**Alternativas rejeitadas**:

- **Sem corte por país**: contraria a FR-005 e o fato já registrado em
  `gsc_branded_position_polluted_by_country`.
- **Cortar por país só a perna de marca**: a razão viraria `marca(BR) ÷ total(mundo)` — uma divisão
  entre dois universos diferentes, que é o defeito que a casa chama de "dois números que medem
  períodos diferentes", uma dimensão ao lado.

---

## D3 — Uma fonte só para a regra de casamento: `regexDeMarca(termos)`

**Decisão**: `lib/marca.mjs` exporta `regexDeMarca(termos)`, que devolve **o padrão como string**,
sem flags:

```text
["atma", "atma aligner"]   →   \b(atma aligner|atma)\b
```

Termos escapados para regex, deduplicados e ordenados **do mais longo para o mais curto** — a
alternação de RE2 e de JS é *leftmost-first*, e `atma|atma aligner` casaria só `atma`. Dois
consumidores, mesma string:

- a corrida manda `(?i)` + padrão para o Search Console (RE2 aceita a flag inline);
- a tela compila `new RegExp(padrao, "i")` para filtrar a canibalização (US3).

**Rationale**: se a classificação da série e a da canibalização fossem duas implementações, elas
divergiriam na primeira variante nova — e a tela mostraria uma lista de termos (FR-012) que não é a
que classificou os números. Uma função pura, dois chamadores, um teste.

**Regra explícita** (o edge case pede que ela seja): um termo casa quando aparece na consulta
**como palavra inteira**, ignorando maiúsculas. `\b` é a diferença entre `atma` casar em
`"atma aligner"` (deve) e em `"atmasfera"` (não deve). **Sem dobra de acento**: quem cura escreve a
variante acentuada explicitamente. Dobrar acento automaticamente casaria termos que ninguém
declarou, e o erro seria invisível justamente porque a tela mostra a lista declarada, não a
expandida.

**Alternativas rejeitadas**:

- **`contains` do GSC, um filtro por termo**: os filtros de um mesmo grupo combinam por `AND`; um
  `OR` de N termos exigiria N grupos e N requisições — e `contains` não tem fronteira de palavra,
  então `atma` casaria `atmasfera`.
- **Classificar em casa com `String.includes`**: exige a dimensão `query`, que é a origem do
  problema (D1).

---

## D4 — As pernas de marca puxam a JANELA INTEIRA toda corrida

**Decisão**: a perna do total continua incremental (`janelaDaCorrida()`, 021). As três pernas novas
pedem sempre a janela cheia de `DIAS_BACKFILL` (480 dias).

**Rationale**: dois problemas mortos com uma decisão.

1. **O backfill da FR-003 deixa de ser um evento.** Não há script de migração, não há estado "já
   fiz o backfill", não há como um deploy no meio deixar metade da série classificada.
2. **A lista de termos é curadoria e vai mudar.** Acrescentar `"alinhador atma"` amanhã
   **reclassifica o passado inteiro** — um backfill de uma vez só congelaria a história na lista de
   hoje, e a tela mostraria uma lista (FR-012) que não descreve os números antigos.

Custo: 3 requisições/dia devolvendo ~480 linhas cada, para 1 projeto. Ordem de segundos, dentro do
`maxDuration = 300` que a rota já tem.

**Alternativa rejeitada**: backfill único disparado por "existe dia com `impressoes_marca IS NULL`".
Precisa de uma consulta de estado, não se auto-corrige quando a lista muda, e cria a pergunta
"reclassificar é backfill ou não?" toda vez que alguém edita o card.

---

## D5 — Dia sem linha na perna de marca é `0`, não `NULL`

**Decisão**: `adensarDias(inicio, fim, linhas)` (puro) devolve, para cada dia da janela pedida, a
linha que o GSC deu ou `{impressoes: 0, cliques: 0}`.

**Rationale**: o GSC omite o dia sem impressão. Sem o adensamento, "nenhuma busca de marca nesse
dia" e "marca não declarada" ficariam **indistinguíveis no banco** — a inversão exata que a FR-004
proíbe, só que do lado de dentro.

---

## D6 — Escrita das colunas novas é `UPDATE`, nunca `INSERT`

**Decisão**: `gravarMarcaGsc()` faz um `UPDATE ... FROM (VALUES ...)` chaveado por
`(projeto, dia)`. Dia sem linha de total é **pulado**, e a contagem de pulados sai na resposta.

**Rationale**: `gravarDiasGsc()` escreve `impressoes`/`cliques`, e as pernas de marca cobrem 480
dias contra a janela curta do total (D4) — reusá-la sobrescreveria o total de ~477 dias com valores
que aquela chamada não tem. E dia sem total não tem denominador: gravar a fatia de marca dele
produziria uma razão sem divisor.

---

## D7 — A declaração mora no card, com o país junto

**Decisão**: campo novo no card de `data/projects.json`, tipado em `lib/projects.ts`:

```jsonc
"marca": { "termos": ["atma", "atma aligner"], "pais": "bra", "declaradaEm": "2026-09-08" }
```

Ausente, com `termos` vazio, **ou sem `pais`** ⇒ **não declarada**, e a tela nomeia qual das três
faltas é (FR-004, FR-013). Não existe declaração pela metade: sem país a razão sai contaminada
(D2), e número contaminado que parece medido é pior que ausência nomeada.

**Rationale**: é a mesma forma de `epoca`, `motivosDePerda` e `ga4` — curadoria humana, versionada,
com data para não apodrecer calada. Derivar do domínio erraria justamente nas variantes, que são o
que importa.

---

## D8 — A conferência da FR-006 é DERIVADA, não uma coluna

**Decisão**: `residuo = impressoes_pais − (impressoes_marca + impressoes_nao_marca)`, calculado na
leitura a partir das quatro colunas. A rota devolve o resíduo agregado da janela no corpo da
resposta (para o log do Actions); a tela o recalcula sobre a janela que exibe (para o rótulo da
FR-007).

**Rationale**: mesma regra que já vale para o CTR em `hub_gsc_dia` e para a taxa em
`hub_indexacao` — valor exato sempre derivável não vira coluna, porque coluna gravada só cria a
chance de divergir da própria conta.

**O que o resíduo responde**, e é a pergunta que a spec diz não ter resposta em documentação:

- **resíduo ≈ 0** ⇒ filtrar por consulta **sem** pedir a dimensão `query` preserva as raras. Marca
  e não-marca são medidas completas.
- **resíduo > 0** ⇒ o filtro também derruba as anonimizadas. As duas são **pisos**, a tela diz isso
  e informa o tamanho (FR-007).
- **resíduo < 0** ⇒ contradição: as pernas somam mais que o total. Não é anonimização, é defeito de
  filtro (por exemplo `R` casando fora do esperado, ou o `excludingRegex` não sendo o complemento
  exato). Estado próprio na tela, nunca arredondado para zero.

O terceiro caso é o que vigia a incerteza do D13.

---

## D9 — Mês fechado: todos os dias presentes **e** três dias de folga depois

**Decisão**: `mesesFechados(dias, hoje)` (puro) só considera o mês `M` quando:

1. a série tem linha para **cada dia** do calendário de `M`; **e**
2. o maior dia da série é ≥ último dia de `M` **+ 3**.

`crescimentoNaoMarca()` compara dois meses fechados **consecutivos**. O primeiro mês fechado
devolve `null` = "ainda não apurável" (FR-009), nunca `0%`.

**Rationale**: são dois modos de fabricar queda, e o segundo é o que a 021 já pagou uma escala
abaixo. (1) mata o mês parcial — a série começa em 11/01/2026, então janeiro tem 21 dias, e
compará-lo com fevereiro inteiro inventaria um crescimento que é só calendário. (2) mata a ponta
provisória — o GSC fecha o dia com ~3 dias de atraso, então no dia 2 do mês o mês anterior ainda
está subindo, e lê-lo como fechado inventa a queda oposta.

Meses **não consecutivos** não se comparam: um buraco na série (corrida que falhou por uma semana)
tornaria o mês anterior incompleto pela regra (1) e ele simplesmente não entra.

**Alternativa rejeitada**: exigir só "mês ≠ mês corrente". Passa no dia 2 e reprova só no fim do
mês — defeito que aparece uma vez por mês e some antes de alguém investigar.

---

## D10 — A canibalização ganha um argumento, e o retorno passa a carregar a contagem

**Decisão**: `canibalizacao(linhas, ehMarca = null)` devolve `{ lista, removidas }`. `ehMarca`
ausente ⇒ `removidas: null` e a lista de hoje, intacta (FR-013).

**Rationale**: a FR-011 exige a contagem na tela; devolver só o array a deixaria de fora, e "sumiu
em silêncio" é indistinguível de "filtro largo demais comeu tudo". `removidas: null` (não
declarada) é estado diferente de `removidas: 0` (declarada, nada casou) — a mesma distinção que
`nao_apurado` guarda em toda a casa.

Muda a forma do retorno de `kpisDeBusca()` para um consumidor (a aba de aquisição) e três asserções
de `test/kpis-busca.test.mjs`. Alternativa rejeitada: uma `canibalizacaoFiltrada()` ao lado — duas
funções que fazem a mesma coisa saem de sincronia na primeira mudança de ordenação.

---

## D11 — A tela lê o BANCO, não o Search Console

**Decisão**: os dois KPIs novos saem de `lerDiasGsc(slug)` (021), que hoje **não tem consumidor
nenhum**. A canibalização (US3) continua vindo de `gscConsultas()` ao vivo, como já vem.

**Rationale**: crescimento mês a mês precisa de meses, e mês é história — é exatamente para isso
que a 021 gravou a tabela. Buscar ao vivo pagaria rede numa página com `revalidate = 3600` para
recalcular um passado que não muda, e o número perderia a data da apuração.

---

## D12 — O que a corrida NÃO ganha

Nenhuma credencial nova, nenhuma tabela nova, nenhum workflow novo, nenhuma rota nova, nenhuma
dependência nova. A feature inteira mora na rota `/api/gsc-serie` que o cron das 05:17 BRT já
dispara, com sete colunas acrescentadas à tabela que a 021 criou.

---

## D13 — Incertezas que a primeira corrida resolve (e como elas falham alto)

Três coisas sobre o Search Console **não** são decidíveis por documentação, e a spec proíbe
resolvê-las por leitura. Nenhuma delas fica em aberto sem detector:

| Incerteza | Se der errado, o sintoma é | Quem denuncia |
|---|---|---|
| Filtrar por `query` sem a dimensão `query` preserva as consultas anonimizadas? | resíduo > 0 estável | **É a pergunta da FR-006.** Rótulo de piso na tela (FR-007) |
| `includingRegex` casa parcialmente (RE2 partial match) ou exige a consulta inteira? | perna de marca ≈ 0 e não-marca ≈ total | Resíduo ≈ 0 **com marca zerada** — a `quickstart.md` checa `marca > 0` explicitamente |
| `excludingRegex` é o complemento exato de `includingRegex` no mesmo padrão? | resíduo **negativo** ou grande demais | Estado próprio do resíduo negativo (D8) |

É por isso que as três pernas são pedidas na **mesma corrida e na mesma janela**: comparar pernas
de corridas diferentes esbarraria no fato de que a janela do GSC desliza na meia-noite UTC (o mesmo
fim de tarde já deu 33 e depois 42), e a diferença passaria a medir o relógio.
