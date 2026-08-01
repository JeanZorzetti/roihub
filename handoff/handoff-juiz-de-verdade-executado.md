# Handoff — o juiz de VERDADE, executado (31/07/2026)

Execução de [`handoff-juiz-de-verdade.md`](handoff-juiz-de-verdade.md), fases 0 a 5. As cinco
fases fecharam com os critérios de aceite que o handoff pediu, **e três decisões dele mudaram na
execução** — as três estão argumentadas abaixo, com o que as forçou.

Estado anterior: [`handoff-normas-que-rodam.md`](handoff-normas-que-rodam.md) ·
arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## O que existe agora

| arquivo | o que é |
|---|---|
| [`lib/juiz.mjs`](../lib/juiz.mjs) | as duas passadas, puras e testáveis |
| [`scripts/juiz-calibrar.mjs`](../scripts/juiz-calibrar.mjs) | os portões — 38 chamadas, decide se vale gastar as 156 |
| [`data/juiz-calibracao.json`](../data/juiz-calibracao.json) | 20 rótulos de regressão + **8 de holdout cego** |
| [`data/juiz-adversarial.json`](../data/juiz-adversarial.json) | 10 respostas sabidamente erradas, 10 corrupções diferentes |
| [`test/juiz.test.mjs`](../test/juiz.test.mjs) | 15 testes puros, dentro do `npm test` |
| `data/juiz-corridas/*.json` | toda corrida gravada: pergunta, resposta, citações, os dois vereditos, o modelo |

```
node --env-file=.env scripts/juiz-calibrar.mjs --ver          # os portões (38 chamadas)
node --env-file=.env scripts/avaliar-resposta.mjs --juiz --ver # as 78 (3 chamadas/pergunta)
node --env-file=.env scripts/avaliar-resposta.mjs --ids D-70,D-76 --juiz --ver   # um recorte
```

`--ids` é novo e não é conveniência: toda inspeção que importa é de um subconjunto escolhido (as 8
de `estado`, os casos que o juiz marcou `contradiz`), e `--limite N` só pega as N primeiras, que
são todas `protocolo`.

---

## As três decisões que mudaram, e o que forçou cada uma

### 1. O rótulo humano de 20 não podia ser as 20 primeiras perguntas

O handoff pedia "rotule 20 respostas à mão". As 20 primeiras do dourado são **todas de camada
`protocolo`**, que é onde a síntese acerta quase tudo: rodadas as 20, a ancoragem deu 100% e eu
rotulei 17 de 20 como `correta`. Um conjunto assim certifica o juiz na camada fácil e, pior,
**um juiz que respondesse sempre `correta` tiraria 85% e passaria no portão**.

O recorte virou **7 `protocolo` + as 8 `estado` + as 5 `episodio`** (todas as que existem fora de
`protocolo`), ao custo de gerar 13 respostas a mais. Pagou na hora: nas de `estado`+`episodio` a
ancoragem caiu para **84,6%** e apareceram os dois erros reais do dia (D-70 e D-71).

### 2. A concordância de 85% do handoff não podia ser medida nos 20 rótulos

Primeira corrida: **70% (14/20)**. Pelo handoff, isso é "o prompt do juiz está errado, conserte".
Lendo as 6 divergências uma a uma, **4 eram erro do rotulador, não do juiz**:

- **D-70 e D-71** — rotulei `contradiz` porque as respostas afirmam coisas falsas (21 projetos em
  domínio de fornecedor, revogado em 30/07; "pedir `HUB_USER`/`HUB_PASS` ao Jean", que estão no
  `.env` local). Só que **essas falsidades conflitam com o CORPUS, não com o dourado** — e a
  passada B julga contra o dourado por construção. Eu tinha vazado "verdade" para dentro de uma
  régua de consistência, que é exatamente o erro que o handoff avisa para não cometer.
- **D-03 × D-08** — a regra de "abertura invertida" estava mal definida e **eu mesmo a apliquei em
  direções opostas nos dois casos**, que têm a mesma forma. O juiz também. Afiada para: só é
  `contradiz` quando a correção chega em **outra frase**.
- **D-14** — punido sem que nada mudasse na ação prescrita.

Corrigi a **definição** (no prompt e nos rótulos) e revisei 4 rótulos. Mas **rótulo revisado
depois de ler o juiz é contaminado**: medir concordância contra ele é circular, e publicar esse
número seria repetir em 3 horas o pecado que este handoff existe para não repetir.

Então o portão passou a ser um **holdout cego**: 8 perguntas novas, respostas geradas, rotuladas
com a definição já afiada e **antes de o juiz vê-las**. Os 20 continuam no arquivo como conjunto
de regressão, marcados com `veredito_original` e o motivo da revisão, e **não decidem nada**.

### 3. O adversarial não podia ser `test/juiz.test.mjs`

O handoff pedia as 10 corrupções como teste. Mas `npm test` roda em 1,6 s sem rede — a mesma razão
que mantém `conformidade.mjs` fora dele. As corrupções viraram **dados** (`data/juiz-adversarial.json`,
com os ids apontando para o dourado para não haver duas cópias do padrão) e rodam no
`juiz-calibrar.mjs`. O que ficou no `npm test` é o que é determinístico: prompt, parse, falha
fechada, e a **integridade dos dois arquivos de dados** — inclusive uma asserção de que um juiz
degenerado não passaria nos conjuntos, porque essa garantia se perde em silêncio se alguém
rotular mais alguns casos `correta`.

---

## Os portões

```
portão 1 — holdout cego (8 rotulados antes de o juiz vê-los)
  veredito    87,5%  (7/8)     ← portão: >= 85%   ✅
  armadilha  100,0%  (8/8)
  a única divergência é `incompleta → correta` (D-55)

regressão — os 20 (4 revisados; NÃO decide)
  veredito    85,0%  (17/20)
  armadilha  100,0%  (20/20)

portão 2 — adversarial
  reprovou   10/10   ← portão: >= 9/10   ✅
```

**O número que mais importa não é nenhum dos dois: em 38 casos julgados, zero vezes o juiz chamou
de `correta` uma resposta errada.** Todas as divergências foram entre `correta` e `incompleta`,
que é a direção barata. A confusão cara — `contradiz → correta` — não aconteceu nenhuma vez,
inclusive nas 10 corrompidas, e é ela que decide se a régua serve.

**`armadilha` foi o eixo mais estável de todos (100% nos dois conjuntos)** e o mais barato de
confiar: ele pergunta uma coisa concreta e declarada por escrito, não um juízo de grau. O campo
estava preenchido nas 78 perguntas desde que o dourado nasceu e nunca tinha sido lido por código.

---

## O achado que justifica as duas passadas

A célula `fiel + discorda` apareceu na **primeira corrida real**, no `D-76` (*"o sirius precisa de
hreflang?"*):

- **Passada A (fiel):** a resposta é derivada corretamente do que citou — inclusive a premissa
  falsa que ela reproduz, que é **citação exata** de um documento do corpus.
- **Passada B (contradiz):** ela abre com "Sim" onde o dourado diz "não precisa: existe e
  funciona".

Não é bug da síntese. É **contradição dentro do corpus**: um handoff antigo afirmando que o sirius
não tem uma única ocorrência de `hreflang` convive com o de 31/07 que provou por `curl` que tem.
A síntese leu os dois e abriu pelo velho.

Isso é a frente 6 (detecção de contradição) nascendo como subproduto, exatamente como o handoff
previu — e é o argumento inteiro contra juntar as duas passadas num prompt só para economizar
uma chamada.

E o inverso também apareceu: **D-70 e D-71 saíram `infiel`**, ou seja, a passada A pegou
afirmações não sustentadas pelas fontes citadas que a passada B **não tinha como ver**, porque o
dourado não fala do assunto. As duas passadas cobrem buracos diferentes uma da outra.

---

## Armadilhas que esta sessão descobriu

- **`recusou` não pode ser veredito de LLM.** Ele sai do contrato de `responder()` (texto vazio e
  `erro: ""`). Deixar o modelo "concluir" que houve recusa cria um caminho para resposta errada
  virar recusa e sumir da conta — e recusa não é erro (`D-66`).
- **Resposta SUPRIMIDA não é recusa.** `responder()` tem três causas para texto vazio e as duas
  outras (`resposta-sem-citacao`, falha de CLI) significam componente quebrado. Contá-las como
  `recusou` creditaria isso como acerto. O curto-circuito só vale para recusa de verdade.
- **Sem fallback silencioso de modelo.** Se `opus` falhar, a corrida sai com `juiz-output`. Cair
  para `sonnet` — o modelo que escreveu a resposta — reintroduziria viés de auto-preferência sem
  ninguém notar, e o número sairia melhor justamente por isso.
- **A chave do cache passou a incluir o modelo.** Sem isso o veredito de `opus` seria servido para
  uma corrida de `sonnet` e a troca de modelo ficaria invisível.
- **Um juiz que reprova tudo passa no adversarial.** O controle contra ele é o holdout ter maioria
  de respostas boas. Os dois conjuntos só passam juntos se o juiz discriminar de verdade; nenhum
  dos dois sozinho prova nada.
