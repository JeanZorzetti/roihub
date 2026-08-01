# O holdout da CURADORIA — duas leituras cegas dos mesmos 35 cards

Medido em 31/07/2026. A fase 2 de 31/07 tirou `D-70` e `D-71` de `nao_apurado` curando `familia`,
`estado` e `blockersLista` nos 35 cards. Isso trocou "prosa concordando com prosa" por "número
concordando com o julgamento de um agente" — melhor, mas **não é lastro**. Este é o portão que
`D-70` nunca teve, e é o mesmo que o juiz da síntese teve que passar.

| eixo | concordância |
|---|---|
| `familia` | **27/35 = 77,1%** |
| `estado` | **30/35 = 85,7%** |

## 1. Como foi feito

A segunda derivação leu um dump que **não continha `familia`, `estado` nem `vendas`** — só `slug`,
`nome`, `url`, `receitaNota`, `decayNota`, `acao` e os textos de `blockersLista`. Ela recebeu as
**três** famílias da spec original (`cobranca`, `venda`, `trafego`), nunca a quarta, e permissão
explícita para dizer "nenhuma destas serve" e propor a sua.

Quem curou em 31/07 não podia fazer esta derivação: já tinha visto os valores na saída de `D-70`.
Autoavaliação cega não existe — por isso a segunda leitura é de outro agente.

## 2. O achado que valida a quarta família

**A derivação cega reinventou `nao-vende` sozinha**, com outro nome (`nao-comercial`) e a mesma
definição, para 8 projetos. Ela não sabia que a quarta família existia.

Isso encerra a dúvida aberta na spec: `nao-vende` **não é invenção de quem curou**. Duas leituras
independentes olharam para CV, demo, pesquisa e vitrine e as duas se recusaram a chamar aquilo de
travamento. As frases que decidiram, citadas pela derivação cega: *"não vende e não deveria
vender"*, *"É CV, não produto"*, *"receita vem dos bets, não dele"*, *"Nenhuma ação comercial — é
pesquisa"*.

## 3. E o achado que a curadoria não tinha: a QUINTA família

A derivação cega precisou de mais uma, que nem a spec nem a curadoria tinham: **`produto`** —
*quebra antes da cobrança, não há o que cobrar*. Quatro projetos, e a curadoria os havia espalhado
por **três famílias diferentes** dizendo a mesma coisa:

| projeto | curadoria dizia | a frase do card |
|---|---|---|
| `cardiorisk` | `cobranca` | "o produto NÃO funciona: a API que ele chama não existe" |
| `tapevision` | `cobranca` | "Dashboard no ar sem backend" |
| `cyberspace` | `nao-vende` | "Não existe produto: o site é o template default do Vite" |
| `reviewshield` | `trafego` | "sem ele o OAuth do GBP não roda" |

Chamar `cardiorisk` de "não tem como cobrar" é tecnicamente verdadeiro e analiticamente inútil: o
hub proporia trabalho de cobrança num projeto cujo defeito é não existir produto. **Aprovada pelo
Jean em 31/07.**

## 4. A leitura da concordância: 6 das 8 divergências são a DEFINIÇÃO, não o rótulo

77,1% não é "as duas leituras discordam um pouco em tudo". As divergências são agrupadas:

| divergência | curadoria → cega | é o quê |
|---|---|---|
| `cardiorisk`, `tapevision` | `cobranca` → `produto` | **falta de família** |
| `cyberspace` | `nao-vende` → `produto` | **falta de família** |
| `reviewshield` | `trafego` → `produto` | **falta de família** |
| `roilabs`, `nimblabs` | `trafego` → `nao-vende` | **fronteira mal definida** |
| `goiania`, `qprime` | `venda` → `trafego` | julgamento de negócio |

Só **duas** das oito são julgamento genuíno sobre o projeto. As outras seis eram a taxonomia
faltando um balde ou não dizendo onde acaba um e começa o outro. **O conserto é a definição, e por
isso as definições abaixo são testes.**

## 5. As definições, escritas como TESTE

Adjetivo não se checa; teste sim. "não tem como cobrar" é opinião — a linha de baixo se verifica.

| família | teste |
|---|---|
| `produto` | O card afirma que o produto **não funciona** (API ausente, backend ausente, template default, chave sem a qual o fluxo não roda). O defeito é anterior à cobrança. **Tem precedência sobre todas as outras.** |
| `cobranca` | O produto funciona, e **não existe caminho de pagamento no repo NEM gateway ligado**. Mesmo com cliente na porta, não haveria como cobrar. |
| `venda` | Existe caminho de pagamento, e **falta o ato comercial**: nenhuma prospecção, nenhum cliente, nenhum contrato em andamento. |
| `trafego` | Existe caminho de pagamento **E** existe quem venda. O gargalo é **quem chega**. |
| `nao-vende` | O card **afirma** que faturar não é o objetivo (CV, demo, pesquisa, vitrine institucional). Não é ausência de receita — é decisão declarada. |

A ordem importa: aplique de cima para baixo e pare no primeiro que casar. Foi a falta dessa
precedência que colocou `cyberspace` (template default do Vite) em `nao-vende`.

E `estado`:

| estado | teste |
|---|---|
| `no-ar-inutilizavel` | O **caminho principal não completa de ponta a ponta**: formulário que não envia, login que não loga, API que não responde. Responder 200 não conta. |
| `prototipo` | Não é um produto no ar. |
| `no-ar` | O resto. |

O teste de `no-ar-inutilizavel` foi decidido pelo Jean em 31/07 depois de a derivação cega
discordar em 3 cards. O critério anterior ("só se não abre") deixava passar o `matchfios`, cujo
único caminho de conversão **não vai a lugar nenhum** — um site que responde 200 e não converte
nada está no ar da mesma forma que uma placa está.

## 6. Os divergentes, e o que o Jean decidiu em cada um

| projeto | curadoria | cega | decisão | virou |
|---|---|---|---|---|
| `cardiorisk` | `cobranca` | `produto` | 5ª família criada | **`produto`** |
| `tapevision` | `cobranca` | `produto` | idem | **`produto`** |
| `cyberspace` | `nao-vende` | `produto` | idem | **`produto`** |
| `reviewshield` | `trafego` | `produto` | idem | **`produto`** |
| `roilabs` | `trafego` | `nao-comercial` | **curadoria vence** | `trafego` |
| `nimblabs` | `trafego` | `nao-comercial` | **curadoria vence** | `trafego` |
| `goiania` | `venda` | `trafego` | **cega vence** | **`trafego`** |
| `qprime` | `venda` | `trafego` | **cega vence** | **`trafego`** |
| `reviewshield` (estado) | `no-ar` | `no-ar-inutilizavel` | teste do caminho principal | **`no-ar-inutilizavel`** |
| `potencialarquitetado` (estado) | `no-ar` | `no-ar-inutilizavel` | idem | **`no-ar-inutilizavel`** |
| `matchfios` (estado) | `no-ar` | `no-ar-inutilizavel` | idem | **`no-ar-inutilizavel`** |

Placar do confronto: **a curadoria perdeu 6 das 8 divergências de família e 3 das 5 de estado.** Não
é vergonha — é o que um portão serve para produzir. O que seria vergonha é ter construído em cima
sem ele.

### 🚩 Dois divergentes NÃO foram decididos

| projeto | curadoria | cega | por quê ficou aberto |
|---|---|---|---|
| `lumina` | `prototipo` | `no-ar` | não foi levado ao Jean nesta rodada; o valor da curadoria foi mantido |
| `polarisia` | `no-ar` | `indefinido` | a cega marcou `indefinido` dizendo que **o card não tem evidência nenhuma de status** — `decayNota` vazia, nenhum 200, nenhum dado de GSC. O valor da curadoria foi mantido, mas ele não tem lastro no próprio card |

O `polarisia` é o mais incômodo dos dois: um card que não diz se o que está no ar é usável não
sustenta nenhum dos três estados. Ou o card ganha evidência, ou o `estado` dele é chute.

## 7. Distribuição depois das decisões

| família | n | projetos |
|---|---|---|
| `cobranca` | 12 | polarisia, context, potencialarquitetado, matchfios, whatsmeow, aprovai, moderador, seo-forecaster, cannibal_scan, compass, orion, pathfinder |
| `trafego` | 11 | goiania, tapepro, sirius, fabrica, roilabs, aftercare, nimblabs, orcaobra, atma, qprime, vertice |
| `nao-vende` | 6 | claudeloop, swarm, meridian, roi-labs-links, lumina, portfolio |
| `produto` | 4 | reviewshield, cardiorisk, tapevision, cyberspace |
| `venda` | 2 | estetiacrm, verticemarketing |

`estado`: 25 `no-ar` · 8 `no-ar-inutilizavel` · 2 `prototipo`.

⚠️ **A distribuição continua sendo apuração de CURADORIA.** O que `D-70` apura é a contagem, e é
isso que a `ressalva` dela declara. Este documento não transforma julgamento em fato — ele só
mostra que dois julgamentos independentes chegam a 77,1% e diz onde os 22,9% moram.

## 8. O que fazer na próxima curadoria

1. Aplicar as famílias **na ordem** da tabela da seção 5, parando no primeiro teste que casar.
2. Card sem evidência para um dos dois campos: **escrever a evidência no card antes de rotular.**
   `indefinido` é resposta válida e é melhor que um rótulo sem lastro (ver `polarisia`).
3. Repetir este holdout **sempre que a taxonomia mudar** — e ela acabou de mudar.
