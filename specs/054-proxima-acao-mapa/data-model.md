# Data model — 054

Tudo mora em `lib/proxima-acao.mjs` (D1). Nenhuma tabela nova, nenhuma leitura nova de fonte.

## 1. Degrau

| id | nome | porque |
|---|---|---|
| `indice` | 1 · Índice | página fora do índice não recebe clique nenhum |
| `desempenho` | 2 · Desempenho | abaixo do limiar atrapalha; acima dele, não rende mais |
| `pagina` | 3 · Página certa para o termo | a página errada não sobe com reforço |
| `posicao` | 4 · Posição | impressão só vem com a página na primeira e na segunda página |
| `snippet` | 5 · Snippet | CTR só se mede onde há impressão |

## 2. Alavanca (a entrada do painel)

| id | degrau | curta (etiqueta) | ação (painel) |
|---|---|---|---|
| `indexacao` | indice | consertar o índice | Consertar o índice: tirar do sitemap o que não deve indexar e pedir a indexação do resto |
| `poda` | indice | consolidar ou desindexar | Consolidar (301), enriquecer ou desindexar as páginas recusadas e sem impressão |
| `profundidade` | indice | linkar as fundas | Linkar as páginas fundas e órfãs a partir da home, do menu ou de um hub |
| `vitais` | desempenho | corrigir os vitais | Corrigir os vitais reprovados nas URLs prioritárias |
| `canibalizacao` | pagina | consolidar a disputa | Escolher uma página por consulta disputada e consolidar a outra |
| `intencao` | pagina | modificador no título | Pôr o modificador de intenção no título: Preço, Planos, Como, Guia |
| `links` | posicao | apontar links internos | Apontar links contextuais para as páginas dos termos, a partir de páginas com tráfego |
| `cobertura` | posicao | cobrir o termo | Criar página ou seção para os termos e subtemas sem cobertura |
| `frescor` | posicao | revisar as vencidas | Revisar dados, preços e ano das páginas vencidas e declarar a data |
| `backlinks` | posicao | conquistar domínios | Conquistar domínios que linkem para a pasta-alvo |
| `marca` | posicao | gerar busca de marca | Gerar busca pela marca fora do Google |
| `schema` | snippet | completar o schema | Adicionar o JSON-LD que falta nas páginas prioritárias |
| `titulo` | snippet | reescrever o título | Reescrever o título: termo no início, até 580px |

A ordem desta tabela é a ordem de desempate dentro do degrau (D7).

## 3. Regra (uma por folha, 32)

`op` compara o `valor` da leitura com `limiar`; `critico` é um segundo par, opcional. `◆` lê o limiar
da régua viva (D2). Unidade: `%` fração 0–1, `n` contagem, `ms`, `cls`, `razao` (CTR ÷ piso).

| folha | alavanca | origem | valor que a página entrega | op limiar | crítico |
|---|---|---|---|---|---|
| ctrPorPosicao | titulo | ◆ | pior razão IC superior ÷ piso, entre as faixas `abaixo` | `<` 1 | `<` 0,5 |
| penetracaoTop3 | links | ◇ meta | fração do inventário no Top 3 | `<` 0,20 | `<` 0,10 |
| strikingDistance | links | ◇ meta | consultas entre 4,0 e 10,9 | `>` 0 | — |
| crescimentoNaoMarca | cobertura | ◇ meta | variação do último mês fechado | `<` 0,05 | `<` 0 |
| checklistGsc | — | procedimento | — | — | — |
| impressoesTop3 | links | ◇ meta | fração das impressões entre 1,0 e 3,9 | `<` 0,40 | — |
| ctrGap | titulo | ◆ | pior razão CTR ÷ piso, entre as URLs `abaixo` | `<` 1 | `<` 0,5 |
| conformidadeUrls | titulo | ◇ meta | fração das URLs decididas no piso | `<` 0,75 | — |
| schema | schema | ◇ norma | fração das URLs no índice com rich result | `<` 1 | — |
| larguraTitulo | titulo | ◆ | títulos acima de `CATALOGO.larguraTitulo.balizador.limite` px | `>` 0 | — |
| reescritaTitulo | titulo | ◇ meta | (sem coletor) | `>` 0,15 | — |
| termoNoTitulo | titulo | ◇ meta | URLs sem o termo nos `TERMO_ATE` primeiros caracteres | `>` 0 | — |
| intencao | intencao | ◇ norma | títulos sem modificador | `>` 0 | — |
| lcp | vitais | ◆ | p75 ms | `>` `CATALOGO.lcp…limite` | — |
| inp | vitais | ◆ | p75 ms | `>` `CATALOGO.inp…limite` | — |
| cls | vitais | ◆ | p75 | `>` `CATALOGO.cls…limite` | — |
| ttfb | vitais | ◆ | p75 ms | `>` `CATALOGO.ttfb…limite` | — |
| urlsBoas | vitais | ◇ meta | fração das URLs prioritárias com status Bom | `<` 0,90 | — |
| indexacaoLimpa | indexacao | ◇ meta | fração do sitemap no índice | `<` 0,95 | — |
| rejeicaoRastreio | poda | ◇ meta | fração do sitemap descoberta ou recusada | `>=` 0,05 | — |
| profundidadeClique | profundidade | ◇ meta | páginas a mais de `PROFUNDIDADE_DO_BOARD` cliques ou órfãs | `>` 0 | — |
| coberturaSemantica | cobertura | ◇ meta | (sem coletor) | `<` 1 | — |
| frescor | frescor | ◇ política do dono | páginas vencidas | `>` 0 | — |
| canibalizacao | canibalizacao | ◇ norma | páginas com a primária disputada | `>` 0 | — |
| linksInternos | links | ◇ meta | páginas com menos de `LINKS_DO_BOARD[0]` links contextuais | `>` 0 | — |
| referringDomains | backlinks | ◇ meta | (sem coletor) | `<` 3 | — |
| buscasDeMarca | marca | ◇ meta | meses fechados seguidos em queda | `>=` 2 | — |
| consultasUnicas | cobertura | ◇ meta | variação contra 13 semanas antes | `<` 0,10 | `<` 0 |
| top20 | cobertura | ◇ meta | fração do inventário no Top 20 | `<` 0,60 | — |
| queryToPage | cobertura | ◇ meta | consultas por URL indexada | `<` 10 | — |
| activeIndexRatio | poda | ◇ meta | fração das indexadas com impressão | `<` 0,70 | `<` 0,50 |
| tamBusca | cobertura | ◇ meta | cobertura estimada dos clusters | `<` 0,60 | — |

`queryToPage` usa 10, o piso menor das duas metas do board (10–25 landing, 30–80 blog): o hub não
classifica tipo de página (a mesma limitação que a profundidade declara).

## 4. Leitura (entrada, uma por folha, montada pela página)

```
{ valor: number, texto: string, fonte: string, alvos?: string[], nAlvos?: number, piso?: boolean, ressalva?: string }
| { ausente: string }      // sem leitura: motivo curto ("sem coletor", "sem amostra de campo")
| { indecisa: string }     // a amostra não decide (IC atravessa a régua, base interrompida)
```

Folha sem leitura entregue pela página cai em `sem-leitura` com o motivo "leitura não ligada nesta
tela", nunca em `sem-acao`.

## 5. Disparo (saída, uma por folha)

```
{ chave, estado: "critica" | "dispara" | "sem-acao" | "nao-decide" | "sem-leitura",
  alavanca, origem, texto, meta, fonte, alvos, nAlvos, piso, ressalva, motivo }
```

Transições (uma avaliação por abertura de página, sem estado guardado):

```
ausente → sem-leitura       indecisa → nao-decide       regra nula → sem-acao ("procedimento")
compara(valor, op, limiar) = falso → sem-acao
                           = verdadeiro → piso e op "<"? dispara com ressalva de piso
                                          compara(valor, critico) → critica, senão dispara
```

## 6. Plano (o painel)

```
{ degraus: [{ id, nome, porque, entradas: [{ alavanca, acao, critica, motivos: Disparo[], alvos, nAlvos }] }],
  semAcao: Disparo[], naoDecide: Disparo[], semLeitura: Disparo[] }
```

Degrau sem entrada não aparece em `degraus`. Os alvos da entrada são os do primeiro motivo que os
tem, com a folha da própria alavanca antes das de resultado.
