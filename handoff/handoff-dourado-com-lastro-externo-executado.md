# Handoff — o dourado de `estado` saiu do achismo (executado em 31/07/2026)

Especificação que originou: [`handoff-dourado-com-lastro-externo.md`](handoff-dourado-com-lastro-externo.md) ·
estado anterior: [`handoff-juiz-de-verdade-executado.md`](handoff-juiz-de-verdade-executado.md) ·
índice: [`../handoff.md`](../handoff.md).

**O que passou a ser verificado contra a realidade:** 5 das 8 perguntas de camada `estado` agora
têm resposta apurada na fonte viva (GitHub, GSC, arquivos do repo), e existe pela primeira vez um
número para a taxa de erro do corpus. **O que continua sendo prosa concordando com prosa:** as
outras 3 de `estado`, as 70 de protocolo/episódio, e todo o resto da aba `/busca`.

---

## Fase 0 — corrida que perde o pool PARA (feito)

`rodarClaude` agora distingue **pool esgotado** de **modelo escreveu bobagem**: toda conta
devolvendo 401/403/429 lança `rerank-conta`, que vira `resposta-conta` e `juiz-conta` nos
consumidores. `scripts/avaliar-resposta.mjs` aborta em **3 falhas de conta seguidas**, grava o
parcial com `incompleto: true` e **não imprime agregado nenhum**.

O agregado não é impresso nem com aviso ao lado: o relatório de 31/07 trazia o aviso das 15
respostas suprimidas e mesmo assim publicou 19,2% de recusa fantasma. Aviso perde para percentual.

Testes: `test/reranker.test.mjs` (3 seguidas abortam · sucesso no meio zera · erro que não é de
conta não aborta).

**Isto não é hipótese:** a primeira corrida da fase 3 morreu de pool no meio e abortou sozinha,
com 21 documentos julgados. A segunda retomou do cache e completou.

## Fases 1–2 — as 8 viraram função (`lib/dourado-estado.mjs`)

`node --env-file=.env scripts/dourado-estado.mjs [--estado tudo] [--diff]` — zero LLM, como o
`conformidade.mjs`. `--estado offline` roda só o que sai de arquivo do repo; sem rede, as caras
dizem `nao_apurado` e **nunca um valor velho**. Duas execuções no mesmo dia batem (verificado).

| | fonte viva | apurado em 31/07 |
|---|---|---|
| `D-66` quantos projetos | API do GitHub + `mergeProjects()` | 35 projetos (35 curados + 0 do GitHub); 36 repos ativos, 34 com homepage |
| `D-68` gate do sirius | GSC 28d, query × page × country | ≥ 5 cliques não-branded até 31/08 · **hoje 2** |
| `D-69` gate do tapepro | GSC 28d, total do site | ≥ 300 imp até 19/10 · **hoje 42** |
| `D-72` onde roda / como publica | Dockerfile + next.config + workflows | standalone confirmado, sem vercel.json, janela 00:13 BRT lida do cron |
| `D-73` teste novo está no CI? | `package.json` × `test/*.test.mjs` | 0 arquivos fora da lista |

### 🚩 A premissa da spec não sobreviveu em 3 das 8

A spec dizia que **todas** as 8 tinham fonte viva neste repo. Não têm:

- **`D-67` (receita provada)** — `data/projects.json` não tem campo de venda. `receita` é nota
  **0-10 de prioridade**, não faturamento, e `receitaNota` é prosa. Somar isso seria inventar.
- **`D-70` (o que está travado)** — as três famílias ("não tem como cobrar", "não tem quem
  venda", "não tem tráfego") e o estado (no-ar / inutilizável / protótipo) não existem como
  campo; são prosa em `acaoDesc`.
- **`D-71` (esperando o Jean)** — `blockersLista` é texto livre. Grep por `manual|jean` devolve
  **18 cards contra os 5 reais**: mede o texto, não o bloqueio.

As três saem `nao_apurado` com o campo que falta escrito no motivo, e **saem de circulação como
gabarito**. Preencher `vendas: [{data, valor}]`, `familia`/`estado` e
`blockersLista: [{texto, humano}]` liga as três sem tocar em código — os apuradores já leem esses
campos. Extrair a resposta da prosa de `receitaNota` teria sido reconstruir o dourado com o mesmo
material que ele deveria checar.

### Viés de medição encontrado no caminho

O gate de **impressão** é o total do site (`dimensions: []`); somar linhas de `query` devolve um
**piso**, porque o GSC omite query rara. Medido: **5 somando queries contra 33 no total** para o
tapepro. Sem essa correção, a primeira apuração teria publicado "o gate do tapepro despencou de 21
para 5" — artefato da dimensão, não do projeto. O gate de **clique não-branded** continua exigindo
a dimensão `query` (é o que a norma define) e por isso é declarado como piso na resposta.

⚠️ **A janela do GSC desliza na meia-noite UTC.** O mesmo fim de tarde devolveu 33 e depois 42 para
o tapepro. `apurado_em` é carimbado em **BRT** (como todo o resto da casa); a janela, não.

## Fase 3 — a taxa de erro do corpus (o produto)

`node --env-file=.env scripts/corpus-defasado.mjs` — 1 chamada por documento, top-10 da mesma
busca da aba, cache morno retoma corrida morta. Compara **o que o documento afirma × o que a fonte
viva devolve**, nunca contra o dourado escrito.

```
50 documentos julgados em 5 perguntas de estado
falam do assunto        30
DESMENTEM a fonte viva   8   26,7% dos que falam
```

**Ler os 8 um a um baixou o número para 5 (16,7%)** — a 1ª corrida de um check novo mede o CHECK,
igual às 46 violações do conformidade das quais 5 eram o check errado:

| documento | veredito | leitura |
|---|---|---|
| `handoff-deep-research-harness` | `desmente` | ❌ **falso positivo** — diz "hoje 2" e o apurado é 2; o juiz se confundiu com a ressalva "piso" do meu próprio texto |
| `handoff-autopublish` | `desmente` | ❌ **falso positivo** — "gate dos canários 3/3" é outro gate |
| `handoff-normas-que-rodam` | `desmente` | ❌ **falso positivo** — o MOTIVO diz literalmente "o veredito correto é nao-fala" |
| `PRT-03` | `desmente` | ✅ real — norma viva carregando `(hoje 21)` |
| `handoff-proximo-passo-pos-sirius` | `desmente` | ✅ real — `(hoje 21)` |
| `handoff-conjunto-dourado` | `desmente` | ✅ real — `(hoje 21)` |
| `handoff-resumo-entregue-e-as-26-decisoes` | `desmente` | ✅ real — `(hoje 21)` |
| `handoff-hub-github` | `desmente` | ✅ real, datável — "37 projetos (10 curados + 27 do GitHub)" contra 35 + 0 |

### 🔑 Os 5 reais são UM defeito só, e ele tem nome

**`(hoje N)` escrito em prosa.** Não é erro de quem escreveu — era verdade no dia. O defeito é a
palavra *hoje* num documento que sobrevive ao dia: ela continua se afirmando presente para sempre,
e a síntese lê o mais antigo tão convictamente quanto o mais novo.

Nenhum dos 5 é "documento errado". São 5 cópias do mesmo número certo de ontem.

## Fase 4 — corpus corrigido (parcial, e de propósito)

- **`PRT-03`**: o `(hoje 2)` / `(hoje 21)` saiu do `motivo`. A norma agora diz explicitamente que
  **alvo e data são curadoria e ficam escritos; o número de hoje não se escreve — apura-se**.
- **`data/projects.json`** (sirius, tapepro): `(hoje N)` → `(número de hoje:
  scripts/dourado-estado.mjs)`. O card é vitrine viva, não registro datado.
- **Os 4 handoffs NÃO foram reescritos.** Handoff é registro datado; reescrever história para
  fazer o corpus "bater" com hoje é falsificar o único lugar onde se pode ver o que se sabia
  quando a decisão foi tomada. O conserto certo é a convenção, não o retrofit.

Remedir a camada `estado` com `--juiz` antes × depois ficou **fora**: precisa do pool, que morreu
na fase 3 e voltou só o suficiente para terminar a corrida.

## O que ficou aberto

1. **Fase 5 — detector de contradição** (`scripts/contradicoes.mjs`, pares vizinhos no espaço
   vetorial, ~100 chamadas). Agora **tem contra o que ser calibrado**: os 5 reais e os 3 falsos
   positivos acima são o conjunto de teste. Não faça sem ele.
2. **Remedir `estado` com o juiz**, antes × depois, por camada — nunca no agregado.
3. **Os 3 campos de `data/projects.json`** que ligam `D-67`, `D-70` e `D-71`. É curadoria, não
   código.
4. **O falso positivo #1 é acionável:** a ressalva "piso: query anonimizada" dentro do texto
   apurado fez o juiz ler discordância onde havia acordo. Ressalva de medição devia ir num campo
   separado do fato, não no meio dele.

## Armadilhas (continuam valendo, com duas novas)

- **Reindexar depois de escrever handoff/memória** — `node --env-file=.env scripts/indexar.mjs`.
  **Este handoff inclusive.** O corpus foi de 272 para 273 docs durante esta sessão.
- **🆕 Número de GSC não reproduz entre dias UTC**, mesmo no mesmo fim de tarde BRT.
- **🆕 Impressão pede `dimensions: []`; clique não-branded pede `query`.** Trocar os dois inventa
  quedas.
- **Ler as linhas, não o agregado** — 8 viraram 5 lendo. Pela terceira vez nesta base.
- **Não dar push entre 00:00 e 01:00 BRT.**
- **Deploy é Docker no EasyPanel, não Vercel.**

## Primeiros 20 minutos da próxima sessão

1. `npm test` (**228 verdes**) e `npx tsc --noEmit`.
2. `node --env-file=.env scripts/dourado-estado.mjs --estado tudo --diff` — 5 apuradas contra o
   dourado escrito, lado a lado. Zero LLM, ~20 s. É o retrato do que a casa acha × o que é.
3. Abrir `data/corpus-defasado/` e ler os `desmente` da corrida mais recente. São 8 linhas.
4. Decidir a fase 5 **ou** os 3 campos do `projects.json` — os campos são mais baratos e
   destravam 3 das 8 sem gastar uma chamada.
