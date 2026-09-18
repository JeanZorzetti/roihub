# Pesquisa — 029

Cinco decisões. Cada uma traz o fato medido que a sustenta, não a preferência que a sugeriu.

## D1 — Somar os hosts declarados, e não concatenar os segmentos

**Decisão**: o dia vale a soma dos hosts que o card declara.

**Alternativa rejeitada**: manter um host por dia e emendar os segmentos na leitura (a série antiga
até 15/09, a nova a partir de 16/09).

**Por quê**: medido em 18/09 nas duas propriedades, o domínio ANTERIOR ainda carregava 1.146
impressões em 15/09 contra 31 do novo — 97% do volume. Emendar os segmentos produziria uma série
que cai de 1.146 para 35 de um dia para o outro. A queda seria inteira do instrumento: o 301
transfere sinal em semanas, e durante esse período os dois domínios servem o mesmo negócio. Só a
soma mede o negócio.

**Consequência**: o número do dia deixa de ser "o que este host fez" e passa a ser "o que este
negócio fez", que já era a definição usada pelo bloco de Comportamento (GA4) da mesma tela.

## D2 — A soma mora numa função pura em `.mjs`

**Decisão**: `somarSeriesPorHost()` em `lib/serie-gsc.mjs`, ao lado de `diasParaGravar()`.

**Alternativa rejeitada**: somar dentro do laço da rota `.ts`.

**Por quê**: Princípio III da constituição — o que pode ser testado sem subir o Next nasce em
`.mjs`. A soma tem três casos que precisam de teste e nenhum precisa de rede: dia presente num host
e ausente no outro, posição ponderada, e conjunto vazio. Dentro da rota, nenhum deles seria coberto.

## D3 — A posição é ponderada por impressão

**Decisão**: `posicao = Σ(posicao_h × impressoes_h) / Σ impressoes_h`, e `null` quando não há
impressão nenhuma no dia.

**Alternativa rejeitada**: média simples das posições dos hosts.

**Por quê**: em 15/09 o domínio anterior tinha 1.146 impressões e o novo 31. A média simples daria
às duas o mesmo peso e deslocaria a posição do dia para um número que nenhum dos dois mediu. O
próprio Search Console já devolve a posição do dia como média ponderada por impressão — ponderar é
continuar a mesma conta, não inventar outra.

`null` e nunca 0 segue `diasParaGravar()`: posição 0 não existe no Google, e gravá-la faria "não
medido" ler como a melhor posição possível.

## D4 — `host` guarda a assinatura do conjunto, sem DDL nova

**Decisão**: a coluna `host` passa a guardar os hosts somados, normalizados, ordenados e unidos por
`+` — `atma.roilabs.com.br+usealigner.com`.

**Alternativas rejeitadas**:

- **Coluna `hosts TEXT[]`**: exige migração e reescreve leitura e guarda para um tipo novo, sem
  responder nada que o texto ordenado não responda.
- **PK `(projeto, dia, host)`, uma linha por host**: é o modelo "correto" no papel e o mais caro na
  prática — muda a chave da tabela, as sete colunas de marca, `ultimoDiaGsc`, toda leitura e a
  guarda inteira, para depois somar na leitura o que a corrida já podia somar na escrita. Fica
  registrado como o caminho se um dia for preciso ler a série por host isoladamente.

**Por quê**: uma linha antiga (`atma.roilabs.com.br`) já é uma assinatura válida de um elemento, o
que torna a mudança compatível para trás sem tocar em 5.840 linhas. E a assinatura responde à FR-007
— ela distingue "o anterior zerou" (assinatura com dois hosts, um deles somando 0) de "o anterior
saiu da conta" (assinatura voltou a ter um host).

Ordenar antes de unir é o que faz a assinatura ser do CONJUNTO e não da ordem em que a corrida
consultou. `hostsDeclarados()` já normaliza `www.` e deduplica (FR-013), então a assinatura herda
as duas garantias em vez de reimplementá-las.

## D5 — A guarda da 026 muda de "mesmo host" para "dentro do declarado"

**Decisão**: a regravação passa quando **todos** os hosts da assinatura já gravada estão entre os
declarados pelo projeto; é recusada quando qualquer um está fora.

**Por quê**: a guarda existe porque trocar a `url` de um projeto fazia a corrida seguinte reescrever
248 dias com os números de outro site. Essa proteção continua de pé para o caso que a motivou —
troca não declarada (FR-015). O que ela não pode fazer é bloquear a regravação de um dia cuja
medição melhorou dentro da MESMA declaração, que é o caso da transição.

**Medido**: a propriedade `sc-domain:usealigner.com` não devolve impressão nenhuma antes de
14/09/2026, e responde 5 dias e 63 impressões no total (conferido em 18/09). Ou seja, regravar os
dias anteriores à troca com a soma devolve exatamente os valores que já estão lá — propriedade nova
do Search Console não backfilla histórico. É isso que torna a SC-005 verificável por teste em vez de
depender de uma janela artificial na escrita.

## D6 — A correção do histórico entra pela própria rota, não por um script paralelo

**Decisão**: a rota aceita um `desde` opcional que substitui o início da janela da corrida. A
correção é uma execução da corrida com `desde` na data declarada da troca.

**Alternativa rejeitada**: um `scripts/refazer-serie-migracao.mjs` próprio.

**Por quê**: o script teria de repetir o laço de projetos, as três pernas de marca, a janela e a
gravação — quatro lugares onde ele passaria a divergir da rota no primeiro conserto que só um dos
dois recebesse. `backfill-host-gsc.mjs` é precedente de script próprio, mas ele faz um `UPDATE` que
a rota não sabe fazer (preencher `host` sem consultar o Google); aqui é a mesma corrida, só com
outra janela.

As sete colunas de marca vêm de graça: as três pernas já rodam na janela de backfill de 480 dias a
cada corrida, então elas se recorrigem sozinhas assim que a régua muda (FR-016). O `desde` é
necessário só para o TOTAL, cuja janela é incremental.
