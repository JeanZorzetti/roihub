# Phase 0 — Research: projeção invertida

Nenhum `NEEDS CLARIFICATION` sobrou da spec, mas as decisões de desenho abaixo precisavam existir
antes da Fase 1. Duas delas (D2 e D9) nasceram de uma tensão interna da spec, e uma (D2) foi
**refeita** depois que os fatos do repositório contradisseram a primeira versão — o registro do
erro está em D2, porque apagá-lo faria a próxima pessoa repetir o mesmo raciocínio.

## Fatos do repositório que sustentam estas decisões

Levantados em 01/09/2026, contra `data/projects.json` e `lib/`:

| Fato | Consequência |
|---|---|
| **17 dos 40 cards têm `perfil`** (9 A · 2 B · 4 C · 2 D) | o universo elegível a meta é 17, não 40 |
| **1 card tem o campo `vendas`** — `atma`, e é `[]` | o degrau final é `não apurado` em 16 dos 17: **zero cadeias fechadas**, hoje e no horizonte |
| **`razao()` é a única divisão em todo `lib/*.mjs`** | qualquer segunda divisão quebra um monopólio literal |
| Janela `isoDaysAgo(30)→isoDaysAgo(3)` = 28 dias inclusivos, batendo com `totals28` | `janelaDias = 28` está correto |

---

## D1 — A lógica nasce em `lib/projecao.mjs`, arquivo novo

**Decisão**: módulo novo `lib/projecao.mjs`, consumindo a ficha pronta de `lib/okr.mjs` e
importando as primitivas de `lib/funil.mjs`. Não reimplementa célula, razão nem cadeia.

**Motivo**: `lib/okr.mjs` abre com um contrato declarado — "este arquivo IMPORTA aquele e não
reimplementa nada dele" — e fecha em `posicaoDeAtaque()` declarando **por escrito** onde para e
por quê. Enfiar a inversão dentro dele desmontaria o comentário que é metade do valor do arquivo:
o veredito da 009 é "aqui eu paro", e a 010 é uma coisa **ao lado**, não a continuação da mesma
função. A FR-014 diz o mesmo da tela.

**Correção sobre a versão anterior deste documento**: `lib/funil.mjs` **não** fica intocado — ele
ganha `exigencia()`, ver D7. O que continua valendo é que nada dele é reimplementado.

**Alternativas rejeitadas**:

- *Estender `posicaoDeAtaque()` com as posições 4 e 5*: qualquer projeto sem meta passaria a
  receber um veredito diferente do de hoje, quebrando a SC-001.
- *Estender `lib/funil.mjs` com a cadeia por perfil*: aquele arquivo é consumido por
  `scripts/funil.mjs` com três degraus fixos. Cadeia por perfil já não coube lá na 009.

---

## D2 — A FR-005 vale ao pé da letra: a âncora pode ser o degrau final

**A tensão original**: a FR-005 diz "último degrau apurado da sequência contígua a partir do
topo". Numa cadeia fechada isso elege o próprio N1. Mas a US2-AC3 pedia
`fator atual 41%, obrigatório 32% — folga de 1,28×`: duas taxas comparáveis, o que só existe se a
âncora estiver acima do N1.

**A primeira resposta, errada**: excluir o degrau final da eleição, para os dois fatores medirem
sempre o mesmo trecho. Escrevi a justificativa **antes de contar os cards**.

**O fato que a derrubou**: nenhum dos 17 projetos com perfil tem cadeia fechada, e 16 não têm
sequer o campo `vendas`. A exclusão consertava um caso que **não existe**, ao custo de contradizer
um requisito e de introduzir uma regra especial que nenhum dado exercita.

**Decisão**: FR-005 literal. A âncora é o último apurado contíguo, o degrau final incluído. A
US2-AC3 foi emendada: numa cadeia fechada não há "fator atual", há o **múltiplo necessário**
(D9). Em `atma` a âncora é `lead` pelas duas regras — o caso real nunca distinguiu as duas.

**Alternativas rejeitadas**:

- *Excluir o degrau final* (a versão anterior): torce o requisito para salvar um exemplo de um
  caso inalcançável.
- *Cortar a FR-010 desta feature*: seria a saída mais preguiçosa e defensável — código de
  múltiplo/folga nasce sem nunca ter rodado contra dado real. Recusada em decisão do usuário: a
  FR-010 fica, com o ramo isolado da D9.

---

## D3 — Normalização: uma fórmula só, contando de hoje

**Decisão**: `N1 na janela = N1 total × (janelaDias ÷ diasRestantes)`, com `diasRestantes`
contado do **dia de hoje** até o prazo. `hoje` entra como parâmetro.

**Verificação da SC-006**: prazo a 112 dias → `× 28/112 = ÷ 4`; prazo a 28 dias → `× 28/28 = × 1`.
Razão de 4 para 1 entre os fatores obrigatórios. ✓

**O caso do prazo curto (US3-AC3)** parecia exigir uma segunda regra — "encurtar a janela" — e não
exige: encurtar a janela para 14 dias e escalar a âncora junto (`total ÷ (âncora × 14/28)`) é
**algebricamente idêntico** a manter a janela de 28 e escalar a meta (`total × 28/14 ÷ âncora`).
Uma fórmula só, e "a janela foi encurtada" vira **texto**, não um segundo caminho de cálculo.

**De hoje, não de `declaradaEm`**: o fator obrigatório TEM que subir conforme a janela aperta —
é o sinal que faz a tela dizer "isso não cabe mais" antes do fim do trimestre. Congelar na data da
declaração produziria um retrato datado que nunca reage. Custo aceito: superestima, porque o já
realizado não é descontado; o conserto é reescrever `valor` no card (D5), e a superestimação é
visível, enquanto o congelamento falharia calado.

**`hoje` não é `FIM`**: o prazo é compromisso de calendário. O atraso de 3 dias do Search Console
é defeito da fonte de dado, não do calendário — contar de `D-3` daria 3 dias de folga inexistentes.
O parâmetro também tira o teste da dependência da data em que ele roda.

---

## D4 — No caso impossível, o múltiplo de volume e o de ticket são o MESMO número: o próprio fator

**Decisão**: quando `fatorObrigatorio > 1`, o múltiplo exigido — tanto no volume de entrada quanto
no ticket — é o próprio fator obrigatório.

**Derivação** (é o que permite escrever isso sem benchmark nenhum):

- volume: `necessário ÷ (âncora × k) ≤ 1  ⟺  k ≥ necessário ÷ âncora = fator`;
- ticket: `necessário = valor ÷ ticket`, logo `ticket × k` divide o necessário por `k`, e
  `(necessário ÷ k) ÷ âncora ≤ 1  ⟺  k ≥ fator`.

`fator = 1,87` → `1,9× no volume OU 1,9× no ticket`, exatamente o texto da US2-AC2.

**Rejeitado**: *sugerir qual dos dois atacar*. Escolher entre volume e ticket exige saber o que o
mercado paga — que é benchmark, que é a R6. A tela nomeia os dois e cala.

---

## D5 — `meta` é campo curado no card, com as partes independentemente ausentes

**Decisão**: `meta?: { valor?: number; ticket?: number; prazo?: string; declaradaEm?: string }` em
`data/projects.json`, escrito à mão como `perfil` e `estado`, e declarado no tipo `Project`
(Princípio I / FR-017). As partes são opcionais **dentro** do objeto porque a US1-AC3 exige o caso
"meta sem ticket" com motivo próprio.

**`valor` é "o que falta a partir da declaração"**, não o total histórico do período. A alternativa
— `valor` como total do período, sem desconto — produz um número que cresce sozinho conforme o
prazo encurta até declarar "impossível" por decurso de prazo, mesmo com metade já faturada.
Descontar automaticamente exigiria ler o realizado, que é acompanhamento, que a spec proíbe. Então
o desconto é **curadoria**: quem reescreve `valor` é o humano.

**Motivo de não validar no carregamento**: não há validador de JSON no repo e a constituição proíbe
adicionar tooling. A defesa é a função pura recusar cada parte ausente com o motivo nomeado —
validar cedo transformaria "sem ticket" em "sem meta", perdendo o motivo, que é o entregável.

---

## D6 — A "coluna" é um bloco no card existente, não uma coluna de tabela

**Decisão**: a projeção entra em `app/okr/page.tsx` como um bloco dentro do card do projeto, logo
abaixo da linha do veredito e antes da tabela de degraus.

**Motivo**: a FR-014 diz "coluna na `/okr` existente, ao lado da posição de ataque, na mesma linha
do projeto", mas a `/okr` **não é uma tabela de projetos** — cada projeto é um
`<section className="card">`. "Mesma linha" é o requisito real (a projeção não é rota nova nem card
novo), e o card é a linha. Coluna literal ao lado do pill quebraria em 390px, largura em que a
tabela de degraus já precisou de container rolável próprio.

**Projeto sem meta**: uma linha `.foot` de `não apurado — sem meta declarada`, nunca um bloco
vazio. É a R1 aplicada ao layout, e 39 dos 40 cards vão exibir exatamente isso — o resultado
pretendido pela FR-013.

---

## D7 — `exigencia()` mora em `lib/funil.mjs`, ao lado de `razao()`

**A tensão**: a FR-015 proíbe reimplementar razão. Mas `razao()` devolve `não apurado` quando
`numerador > denominador` ("pontas não casam") — e no fator obrigatório o numerador **maior** que o
denominador é justamente o resultado que a feature existe para produzir. Usar `razao()` apagaria o
único achado que economiza um trimestre.

**Decisão**: uma segunda primitiva, `exigencia(necessario, ancora)`, **exportada de
`lib/funil.mjs`**, imediatamente abaixo de `razao()`. Recusa denominador `0` e ponta não apurada
como `razao()` recusa; **não** recusa acima de 1. `razao()` continua sendo a única divisão usada
para confrontar duas medições — as taxas por degrau da cadeia, que `montarFicha()` já produz.

⚠️ Não existe mais um campo `fatorAtual`: a D9 o substituiu por `fatorObrigatorio` e
`multiploNecessario`, mutuamente exclusivos. A versão anterior deste documento previa os dois
lado a lado, e isso morreu junto com a D2 antiga.

**Por que adjacente e não inline em `projecao.mjs`**: `razao()` é hoje a única divisão em todo
`lib/*.mjs`. Uma segunda divisão noutro arquivo é a forma exata do medo que o cabeçalho de
`okr.mjs` nomeia — "duas regras de `0/0` no mesmo repo, uma delas ficando para trás na primeira
correção". A diferença entre as duas (uma mede duas pontas apuradas; a outra confronta uma
exigência declarada com uma medição) só fica legível se elas estiverem uma embaixo da outra. Custo
aceito: `funil.mjs` deixa de ser intocado, embora `scripts/funil.mjs` não seja afetado — é só um
export novo.

**Rejeitado**: `razao(n, d, { permitirAcimaDeUm: true })`. Uma flag que desliga a guarda é a morte
da guarda: o primeiro chamador com pressa a liga e a recusa de `250%` deixa de existir.

---

## D8 — Fator > 1 jamais é formatado como percentual

**Decisão**: a renderização ramifica **antes** de formatar. `fator ≤ 1` sai como percentual com a
fração colada (R2, FR-011); `fator > 1` sai como "meta impossível" com o percentual exigido citado
**dentro da frase de prova** (`exigiria 187% de conversão; taxa não passa de 100%`), nunca como o
valor da célula.

**Motivo**: a SC-005 proíbe "uma taxa exibida acima de 100%", e `lib/funil.mjs` já recusa isso na
`razao()` pelo mesmo motivo — "devolver 250% seria publicar o defeito como resultado". Aqui o 187%
não é defeito, é prova, e a diferença tem que estar no lugar onde ele aparece.

**`fator === 1` exatamente**: ramo próprio. Exige 100% em todos os degraus restantes — "100% não é
meta, é limite". Impossível na prática, com texto diferente do `> 1` porque o conserto é diferente:
não há múltiplo de volume que resolva "todo mundo converte".

---

## D9 — Dois campos, nunca os dois preenchidos, e o teto de 100% preso a um deles

Consequência direta da D2. Com a âncora podendo ser o degrau final, `necessário ÷ âncora` muda de
unidade conforme o ramo: é **taxa** quando há degrau depois, e **múltiplo de crescimento** quando
não há.

**Decisão**: dois campos separados, mutuamente exclusivos.

| Ramo | `fatorObrigatorio` | `multiploNecessario` | Teto de 100% |
|---|---|---|---|
| há degrau depois da âncora | taxa apurada | `não apurado` | **vale** |
| âncora É o N1 (cadeia fechada) | `não apurado: âncora é o próprio N1 — não há trecho a exigir` | múltiplo apurado | **não vale** |

**O que isto evita**: um único `if (fator > 1) → impossível` declararia "meta impossível" num
projeto de cadeia fechada que só precisa **crescer 2×** — normal, não impossível. O teto existe
porque o produto de taxas ≤ 1 nunca passa de 1; sem degrau nenhum no trecho, não há produto de
taxas, e o teto não tem de onde sair.

**Rejeitado**: um campo com discriminador `unidade: "taxa" | "multiplo"`. Menos campos, mas quem
renderiza ramifica igual — e erra calado se esquecer, que é a falha pior.

---

## D10 — `declaradaEm` datado, e a tela nunca recusa por idade

**Decisão**: `declaradaEm` no objeto `meta`, exibido ao lado do valor
(`declarada em 01/09 — restam 121 dias`). Nenhuma invalidação automática.

**Motivo de existir**: com a D5, `valor` só se atualiza à mão. Uma meta escrita há 90 dias segue
sendo lida como "o que falta hoje" — número errado que não parece errado, e a tela não tem como
saber. É o mesmo remédio do `pushed_at` nos cards da agenda: sem a data, a premissa apodrece e
ninguém vê.

**Motivo de não recusar**: um limiar de "velha demais" é um número escolhido, e número escolhido é
benchmark disfarçado de higiene. A tela mostra a data e cala — a decisão continua sendo leitura
humana, como a FR-018 já estabelece para a distância entre "cabe" e "acontece".
