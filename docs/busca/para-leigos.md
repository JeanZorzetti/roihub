# `/busca` explicado sem jargão

> Público: quem quer entender o que a ferramenta faz e por que ela é confiável (ou não), sem saber
> programar. Versão técnica em [`tecnico-devs.md`](tecnico-devs.md). Escrito em 01/08/2026.

## O problema que ela resolve

Ao longo do tempo, o trabalho nos 35 projetos do portfólio gerou três tipos de anotação:

- **Protocolos** — as regras da casa. *"Site respondendo 200 não prova que ele está no índice do
  Google."*
- **Handoffs** — o diário de bordo. Cada sessão de trabalho deixa escrito o que foi feito, o que foi
  medido e o que não fazer.
- **Memórias** — as lições soltas. *"O `curl -k` esconde erro de certificado."*

São **309 documentos** (dado de 01/08/2026). Ninguém lê 309 documentos para lembrar de uma regra. E o
custo real não é ler — é **não saber que a regra existe** e refazer um erro que já custou horas.

A `/busca` é o lugar onde se pergunta em português e a resposta vem com a fonte junto.

## Como funciona, em ordem

Pense num arquivo enorme e em quatro funcionários em sequência.

### 1º — o que casa a palavra exata

O primeiro procura pela **palavra literal**. Se você escreveu "sitemap", ele acha todo documento que
diz "sitemap", e dá mais peso para palavra rara: "sitemap" identifica muito mais que "projeto".

Rápido (milissegundos) e ótimo com termo técnico exato — código de erro, nome de projeto, sigla. Mas
ele é **cego para sinônimo**: quem pergunta "como faço para o Google achar meu site" não escreveu
"sitemap" nenhuma vez.

### 2º — o que entende o sentido

O segundo transforma cada pedaço de texto em uma lista de números que representa o **significado** —
e faz o mesmo com a sua pergunta. Aí compara: textos com significado parecido têm números parecidos.

É ele que acha "sitemap" quando você perguntou "como faço o Google achar meu site". Roda numa
máquina da casa (Ollama), sem custo por consulta.

**Os dois trabalham juntos**, não um ou outro. Um documento bem colocado nas duas listas sobe; um
que só apareceu numa fica atrás. Cada um sozinho é pior que a dupla.

### 3º — o que lê e reordena

Os dois primeiros entregam **50 documentos** — e o certo está entre eles em **92,9%** das perguntas.
O problema é a ordem: o certo pode estar em 30º.

O terceiro é a IA (Claude). Ela recebe um trecho de cada um dos 50 e devolve os melhores, do melhor
para o pior.

**Detalhe importante e contraintuitivo:** a ordem da IA **não é obedecida**, é *misturada* com a
ordem anterior. Testado duas vezes: obedecer piora. A IA acerta **quais** documentos servem e erra
**qual vem primeiro**, porque ela não enxerga o quanto uma palavra é rara. Misturando as duas
opiniões, o acerto nos 10 primeiros sobe de 82% para **88%**.

### 4º — o que escreve a resposta

O último recebe só os 10 finalistas e escreve até 5 frases em português.

**A regra dele é a parte que importa:** cada afirmação tem que terminar com o número do resultado
que a sustenta — `[1]`, `[3]`. E os números batem com os cards logo abaixo: `[3]` é o terceiro card
da lista.

## As três garantias

### 1. Sem fonte, não aparece

Se a IA escrever uma resposta bonita **sem citar nenhum resultado**, a resposta é **jogada fora** e
você vê só a lista.

Isso é deliberado. Um texto fluente sem procedência é o pior resultado possível: tem toda a
autoridade de uma resposta e nenhuma da fonte. Some da tela e um aviso aparece no rodapé.

### 2. "Não sei" é resposta certa

Se nenhum dos 10 documentos trata do assunto, a IA escreve **NÃO ESTÁ NO CORPUS** e a lista fica
sozinha. Isso **não é erro** e nem gera aviso — é o sistema funcionando.

### 3. Se um pedaço cai, o resto continua

Cada camada falha sozinha, e o rodapé diz o que caiu:

| o que caiu | o que acontece |
|---|---|
| a máquina que entende sentido | volta para palavra literal (um pouco pior) |
| a IA que reordena | usa a ordem anterior |
| a IA que escreve | mostra só a lista |

Você nunca vê uma tela de erro. Vê uma versão mais simples, **com o motivo escrito no rodapé** —
degradar em silêncio seria pior que degradar.

## O limite, dito na cara

**A ferramenta mede se ela encontra o documento certo. Ela não mede se o documento está certo.**

Se uma anotação de 2 meses atrás diz um número que hoje mudou, a `/busca` vai achar essa anotação e
resumi-la com confiança. Ela não sabe que envelheceu.

É exatamente por isso que a citação é obrigatória: com `[3]` do lado da frase, conferir custa um
olhar para o card abaixo. **Confira antes de agir** — o próprio rodapé da resposta diz isso.

## Quanto ela acerta

Testada contra **85 perguntas** com resposta conhecida escritas à mão:

| medida | valor |
|---|---|
| o documento certo está entre os 10 primeiros | **88,0%** |
| o documento certo está em 1º | 34,2% |
| o documento certo está entre os 3 primeiros | 70,5% |

⚠️ Os 88,0% foram medidos com 78 dessas perguntas; hoje são 85. **Número medido com uma régua não se
compara com número medido com outra** — quando remedirem, o valor muda mesmo sem ninguém tocar no
código.

Os 34,2% em 1º lugar são **o motivo de a resposta existir**: em quase 9 de 10 buscas o material está
ali, mas em 2 de 3 ele não é o primeiro da lista. A resposta faz a leitura dos 10 por você.

## Quanto custa e quanto demora

| modo | tempo | o que usa |
|---|---|---|
| completo | ~12 s | 2 chamadas de IA |
| só a lista (link no rodapé) | ~0,3 s | nenhuma |

Não há API paga: a IA é a assinatura do Claude, e o sistema **reveza entre várias contas** — se uma
esgota o limite do mês, a próxima assume automaticamente.

## Uma coisa que quem usa precisa saber

Documento novo (um handoff ou uma memória recém-escrita) **só entra na busca depois de reindexar**.
Sem esse passo ele simplesmente não aparece — e sem barulho nenhum.

Quem escreve, roda: `node --env-file=.env scripts/indexar.mjs`.
