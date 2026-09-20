# Pesquisa — 034

Tudo aqui foi medido em **2026-09-20**, ao vivo, contra `sc-domain:roilabs.com.br` (filtrada em
`atma.roilabs.com.br`) e `sc-domain:usealigner.com`, dimensão `query`, com a conta de serviço do
`.env`. Nada é estimado.

## 1. Qual piso forma o inventário

Janela `2026-01-17 → 2026-09-17`, a que o arquivo congelado declara. Universo: **3.831** termos
unidos entre os dois hosts. Marca própria (`atma`, `atma aligner`, `atma alinhadores`, via
`regexDeMarca()`) são **21 termos e 9.936 impressões** e saem. Sobram **3.810** não-marca, com
174.419 impressões.

| piso | termos | no Top 3 (8 meses) | % | impressões retidas |
|---:|---:|---:|---:|---:|
| 1 | 3.810 | 2.337 | 61,3% | 100,0% |
| 10 | 1.019 | 347 | 34,1% | 96,5% |
| **20** | **725** | **193** | **26,6%** | **94,2%** |
| 50 | 453 | 95 | 21,0% | 89,2% |
| 100 | 253 | 55 | 21,7% | 81,4% |

**Escolhido: 20.** Vinte impressões em oito meses é ~1 busca a cada 12 dias. O que cai abaixo disso
é fragmento: `quero`, `a vista`, `e muito caro`, `celular transparente existe`,
`aparelho para alinhamento automotivo`, `ar_on_you`. Ranquear em primeiro para uma busca que
ninguém faz é fácil, e é isso que produz os 61,3% do piso 1.

**Decisão do dono, 20/09**: piso 20, termos de concorrente **dentro**.

## 2. Concorrente dentro ou fora

| recorte (piso 20) | termos | no Top 3 | % |
|---|---:|---:|---:|
| inventário inteiro | 725 | 193 | 26,6% |
| só genéricos | 450 | 137 | 30,4% |
| só concorrente | 275 | 56 | 20,4% |

Os maiores de concorrente: `invisalign` (10.408 impressões, posição 1,1), `invisalign preço`
(5.767, 4,2), `sousmile preço` (776, 1,7), `clearcorrect valor` (835, 4,5).

São a fatia **mais difícil** (20,4% contra 30,4%) e existe página da Atma ranqueando para eles de
propósito. Retirá-los subiria o KPI 3,8 pontos sem que nada tivesse melhorado — denominador
escolhido depois de ver o resultado.

## 3. A janela que define não pode ser a janela que julga

O achado que mudou o desenho. O mesmo inventário de 725 termos, medido em janelas de 28 dias
(recomputado contra o arquivo congelado, pelas funções que a feature entrega):

| janela de 28 dias | cobertura | no Top 3 | penetração |
|---|---:|---:|---:|
| 2026-03-01 → 03-28 | 641/725 (88%) | 355 | **49,0%** |
| 2026-05-01 → 05-28 | 613/725 (85%) | 159 | **21,9%** |
| 2026-07-01 → 07-28 | 2/725 (0%) | 0 | **0,0%** |
| 2026-08-07 → 09-03 | 505/725 (70%) | 78 | **10,8%** |
| **2026-08-21 → 09-17** | **454/725 (63%)** | **74** | **10,2%** |
| 8 meses inteiros | 725/725 | 193 | 26,6% |

Três conclusões:

1. **Os 26,6% são artefato de janela.** Medir o inventário na mesma janela de 8 meses que o
   selecionou usa, como posição de cada termo, a média de um período que inclui março — quando o
   site estava 5× melhor. O estado de hoje é **10,2%**, metade do piso da faixa do board.
2. **Julho é a desindexação de junho**, e a série já registrada no hub datava a reindexação em
   31/07. A cobertura de 2 em 725 confirma pelo lado do inventário: não é queda de posição, é
   ausência do índice.
3. **A recuperação parou.** De 49,0% em março para 10,2% hoje, e a janela pré-migração (10,8%) mostra
   que a troca de domínio de 11/09 **não** é a causa — o patamar de ~10% já estava posto antes dela.

## 4. Por que a dimensão é `query` e não `query`+`page`

`gscConsultas()` lê `["query", "page"]`. Um termo que ranqueia em três páginas vira três linhas com
três posições, e contar termos ali exigiria somar linhas de volta — que é `porUrl()`, deletada na
032 por esse motivo exato.

Medido: a dimensão `query` devolve **893 termos** na janela atual sobre os dois hosts. É sobre ela
que os 10,2% foram apurados, e é ela que a fórmula do board pede ("termos monitorados").

`mesclarPorCaminho()` não serve para essa leitura: ela faz `new URL(keys.at(-1))`, e numa resposta
só de `query` a chave não é URL — cai no `catch` e devolve lista vazia, **sem erro**. Daí
`mesclarPorTermo()`.

## 5. Estado do domínio novo, para não medir o site errado

`sc-domain:usealigner.com` na janela atual: **29 termos, 56 impressões, 0 clique**, impressão em
apenas **4 dias** (14 a 17/09). Nenhum termo em posição ≤ 3; o melhor é `atma aligner` em 4,2 — a
própria marca. Do inventário de 725, **17** aparecem no domínio novo.

Impressões por dia, os dois hosts lado a lado:

```
        atma.roilabs   usealigner
14/09        687            15
15/09       1146            25
16/09        967            24
17/09        791            28
```

Medir só o domínio novo publicaria 0% sobre 29 termos. A leitura soma os dois hosts via
`hostsDeclarados()`, que já devolve os dois desde que o card declarou `dominioAnterior`.

## 6. Alternativas descartadas

**(a) Inventário derivado por regra a cada leitura** (sem arquivo congelado). Zero manutenção, e o
denominador anda sozinho: termo que perde impressão sai do inventário, e o KPI sobe sem que nada
tenha melhorado. Inventário que se recalcula não é inventário, é recorte.

**(b) Inventário dentro do card em `data/projects.json`.** É onde `marca.termos` já mora, e teria
simetria. Descartado por tamanho: 725 strings dentro do card de um projeto, num arquivo que outros
processos escrevem, transforma todo diff de curadoria em ruído.

**(c) Medir só sobre os termos apurados na janela** (denominador = cobertura). Daria 16,3% em vez de
10,2% e melhora conforme o site some do radar. Descartado pelo mesmo motivo de (a).

**(d) Publicar a série histórica da penetração** (a tabela da seção 3, na tela). É a leitura que
mais informa, e exige gravar a penetração por dia — tabela nova, corrida nova, migração. Fica para
a feature seguinte; esta entrega o ponto e a cobertura.
