# Handoff — o teste de 20 minutos deu VERMELHO, e a frente do detector está congelada (01/08/2026)

> Executa [`handoff-o-que-e-melhor-fazer.md`](handoff-o-que-e-melhor-fazer.md) na ordem da seção 5.
> Os passos 1, 2 e 4 estão **medidos e bloqueados em ação humana**; o passo 3 foi executado e
> **decidiu**.

Índice: [`../handoff.md`](../handoff.md) · medição completa:
[`../docs/defasagem-mineracao-2026-08-01.md`](../docs/defasagem-mineracao-2026-08-01.md).

`npm test` 254 verdes · `npx tsc --noEmit` limpo.

---

## 0. As premissas do próprio handoff de hoje, remedidas antes de executar

A norma da casa aplicada ao handoff de 4 horas atrás. **As duas continuam de pé** — e as duas
custaram um comando:

| premissa | medido agora | veredito |
|---|---|---|
| "o token do MP está VIVO" | `GET api.mercadopago.com/users/me` → **200** | ✅ continua verdade — **incidente segue aberto** |
| "`31.97.23.166:5434` dá TIMEOUT da máquina de dev" | conexão TCP → **TIMEOUT** | ✅ continua verdade — segue bloqueado |

---

## 1. 🚨 Passo 1 (token) e 2 (porta) — MEDIDOS, e os dois param em você

Nenhum dos dois é tarefa de agente, e é importante que isso esteja escrito em vez de silenciosamente
pulado:

- **O token do MP segue devolvendo 200.** O passo que fecha o vazamento é **invalidar a credencial
  antiga no painel do Mercado Pago** — painel, login, sua mão. Gerar a nova e atualizar os 3
  consumidores sem invalidar a velha **não é rotação, é adição**. O procedimento completo, na ordem,
  está na seção 1 do handoff anterior; **só o passo 5 (o antigo devolvendo 401) produz evidência.**
- **A porta 5434 do `sirius` segue em TIMEOUT.** É infra da VPS. As 3 vendas AFIRMADAS continuam sem
  conferência no banco — o único sinal de demanda do portfólio segue não confirmado nem morto.

**Nada disso foi contornado.** Contornar seria o defeito: um token "rotacionado" sem 401 e um card
de vendas mantido sem banco.

---

## 2. 🧊 Passo 3 — o teste de 20 minutos, e ele deu VERMELHO

A pergunta era: *o histórico versionado rende ≥ 15 pares `(afirmação histórica, apurado de hoje)`
para levar a célula `desmente` de 5 para 25+?*

**Saíram 8 pares legítimos (9 com um de fronteira).** Detalhe em
[`../docs/defasagem-mineracao-2026-08-01.md`](../docs/defasagem-mineracao-2026-08-01.md).

### A primeira via parecia verde com folga — e era o check

`git log -p` sobre todo `.md` versionado: **166 candidatos, 116 com número diferente do apurado.**
Verde com 7× de margem. **E não vale nada**, por duas razões independentes:

1. **O git não adiciona nada.** Handoff datado não se reescreve — norma desta casa. Então
   `handoff-proximo-passo-02-08.md:130` ainda diz *"40 repos ativos, 39 projetos no ranking"*
   **hoje, no corpus, byte a byte**. O histórico só acrescenta versões velhas de `CLAUDE.md`,
   `README.md` e `docs/` — **e esses três não estão em `carregarCorpus()`**. O que o `git log` acha
   a mais é exatamente o que não serve: treinar o detector em documento que o produto nunca julga é
   **fabricar bancada**.
2. **Os 116 eram quantidade homônima.** "10 projetos" é o autopublishing, "21 projetos" são os
   apagados da Vercel, "19 no ar" é outra conta. Nenhum é a contagem do ranking.

### A segunda via, ancorada no fato — e o check errou 5 vezes

Casamento ancorado em cada um dos 8 fatos de `estado`, absolvição por data avaliada DENTRO do span
(a regra do `lib/validade.mjs`): **16 candidatos, e ler um a um derrubou 7.** Nona vez nesta base
que a primeira corrida mede o check. Os 5 defeitos, todos reutilizáveis:

| defeito | exemplo |
|---|---|
| quantidade homônima | "19 projetos no ar" não é "projetos no ranking" |
| **ALVO do gate ≠ valor de hoje** | "≥ 5 cliques não-branded" é curadoria, **correta para sempre**; o apurado é 2 |
| **bloco cercado não é afirmação** | `validade.mjs` mascara crase simples; saída de script colada em ``` é literal igual |
| tabela de rotulagem é meta | `\| handoff-hub-github \| desmente \| "37 projetos" contra 35 \|` — cita, não afirma |
| regex comeu o número errado | "10 dos **35** com gateway LIGADO. Hoje é 1" · "**9** com SDK e nunca ligado" (certo: 10 escrito, 1 faturou, 9 não) |

### 🎯 O motivo real, que não estava no handoff anterior

Dos 8 sobreviventes, **7 são o MESMO fato (`D-66`) e 5 saem de DOIS documentos.**

> A célula `desmente` não é pequena porque falta minerar. É pequena porque **só existem 8 fatos com
> fonte viva**, e cada um rende ~1 afirmação defasada no presente dentro do corpus. **8 × 1,1 = 9.**
> Para 25 casos seriam necessários **~20 fatos apuráveis** — dobrar a camada `estado`, não varrer
> melhor. Nenhuma varredura conserta um universo de 8.

**A frente do detector fica CONGELADA**, como o handoff manda no vermelho: portões em **83,3%
(35/42)** e **14/20**, `1.8` (`desmente` ≥ 20) inalcançável com o material existente, motivo escrito.
**Um instrumento que não pode ser validado com o material que existe não é um instrumento ruim — é
um instrumento sem bancada.**

---

## 3. 🚩 O subproduto vale mais que o teste: a SELEÇÃO é o gargalo

Um dos 8 pares é **defeito real num documento vivo**: a memória `project_cannibalscan` afirmava
`Hub: 39 projetos` no presente. Hoje são 35.

**O `corpus-defasado.mjs` nunca emitiu esse achado.** Ele julga só os top-10 da busca para 6
perguntas — e essa memória é sobre deploy da Vercel; o número aparece de passagem no item 4. Ela
jamais entra no top-10 de *"quantos projetos o hub tem"*.

> **A seleção por embedding é o gargalo do produto, não a redação do prompt.** Um `grep` ancorado no
> fato achou em segundos um `desmente` que a busca não recupera — **sem gastar uma chamada do pool.**

É o mesmo mecanismo dos 7 erros `bate → nao-fala`: **o detector julga o TEMA do documento.** Aqui o
tema é outro e a afirmação defasada está lá do mesmo jeito. As três tentativas que falharam (duas
redações, uma decomposição) mexeram todas no prompt. **Nenhuma mexeu em quais documentos chegam
até ele.**

✅ **Consertado:** a memória foi corrigida tirando o número que apodrece, não reescrevendo-o para 35
— a lição do `validade.mjs`: *número sem apuração junto apodrece de novo em uma semana*. O handoff
datado que diz 39 **não foi tocado**, por norma.

**Próximo passo barato e nomeado:** dar ao `corpus-defasado.mjs` uma **2ª via de seleção** — os
documentos que citam o número, não só os que a busca acha parecidos. Não muda prompt, não muda
portão, não gasta pool a mais por documento. **É a única alavanca da frente do detector que sobrou
sem exigir dobrar a camada `estado`.**

---

## 4. Passo 4 (ligar UMA cobrança) — não iniciado, e o motivo

`context` é a recomendação do handoff anterior e ela continua certa. **Mas as 4 chaves da Stripe são
credenciais de painel** — a mesma classe do passo 1. Um agente escreve o checkout inteiro e ele não
cobra ninguém sem elas, e o critério de PRONTO da seção 6 exige *dinheiro de terceiro na conta lido
por máquina*. **Escrever o checkout antes das chaves é produzir preparação e chamar de entrega** —
exatamente o que a definição de pronto proíbe.

---

## 5. A ordem daqui pra frente

1. **🚨 Invalidar o token antigo do MP e exigir 401.** Segue sendo a única coisa da lista que pode
   custar dinheiro enquanto não é feita. Aberto há 2 dias.
2. **Destravar `31.97.23.166:5434`** e conferir OU MATAR as 3 vendas do `sirius`.
3. **2ª via de seleção no `corpus-defasado.mjs`** (seção 3) — é barato, é nomeado, e é o único
   caminho da frente do detector que não exige dobrar a camada `estado`.
4. **As chaves da Stripe do `context`**, e aí o checkout de ponta a ponta.
5. **Dobrar a camada `estado` para ~20 fatos apuráveis** — só isto destrava o critério `1.8`. É caro
   e deve ser decisão consciente, não consequência.

**O que NÃO fazer:** uma quarta redação de regra, uma segunda decomposição, ou mais uma varredura
atrás de `desmente`. **As três já foram medidas e as três perderam.**

---

## 6. Armadilhas desta sessão

- **Verde com 7× de margem pode ser o check.** 116 candidatos viraram 8 ao ancorar no fato e ler um
  a um. **Margem larga não substitui leitura nominal.**
- **A via cara pode não adicionar nada à barata.** O `git log -p` foi a ideia do handoff e o corpus
  vivo já continha tudo que servia — porque handoff datado não se reescreve **de propósito**.
- **ALVO de gate não é valor de hoje.** `≥ 5 cliques até 31/08` é curadoria e está correta para
  sempre; confundir com o apurado fabrica defasagem onde há acordo.
- **Bloco cercado é literal, igual à crase.** `validade.mjs` já mascara crase; ``` é a mesma classe e
  não estava mascarada.
- **Universo pequeno não se conserta com varredura melhor.** 8 fatos rendem ~9 pares por mais fina
  que seja a mineração.
