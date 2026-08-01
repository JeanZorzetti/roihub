# Handoff — o formato era o bug, o gabarito chegou à régua, e o portfólio não cobra (01/08/2026)

Spec que originou este trabalho:
[`handoff-o-veredito-vem-antes-do-raciocinio.md`](handoff-o-veredito-vem-antes-do-raciocinio.md) ·
calibração: [`../docs/defasagem-calibracao.md`](../docs/defasagem-calibracao.md) ·
índice: [`../handoff.md`](../handoff.md).

**Executadas: A (fase mais barata, destravou o resto), B (maior retorno por hora), C.1 e C.4.
NÃO executada: D — e ela é a única que fica mais cara a cada dia.**

---

## 1. O placar, sem propaganda

| fase | o que era | o que ficou |
|---|---|---|
| **A** — detector de defasagem | holdout 71,4% · adversarial **3/10** | holdout **84,6%** · adversarial **8/10** — os dois ainda reprovam, por UM caso cada |
| **B** — dourado apurado no juiz | 8 de `estado` julgadas contra prosa datada | 8 de 8 julgadas contra apuração da hora, 0 fora |
| **C.1** — inventário de cobrança | ninguém sabia quantos projetos têm gateway | **1 ligado · 1 servido e não lido · 3 só preço · 30 nada** |
| **C.4** — `receitaProvada` no score | decisão pendente | **decidida e escrita em `lib/score.mjs`**, com condição nova |
| **D** — rotacionar o token do MP | 🚨 vencida | 🚨 **continua vencida** — exige o painel do Mercado Pago |

**252 testes verdes · `tsc` limpo · `validade` 0 achados em 234 documentos vivos · juiz da síntese
intacto em 87,5% / 10-10.**

---

## 2. As três coisas que a próxima sessão precisa saber

### 2.1 🔑 A hipótese do handoff anterior estava certa, e o preço dela era três linhas

O `VEREDITO` era a **primeira** linha que o modelo escrevia. Ele tinha que cravar a decisão antes
de escrever o raciocínio que a justifica, e o resultado apareceu três vezes:

> `VEREDITO: bate` · `MOTIVO: o número "hoje 9, BATIDO" é incompatível com o apurado hoje (2, não
> batido) — desmente.`

Inverter para `TRECHO → MOTIVO → VEREDITO` levou o adversarial de **3/10 a 8/10**. **Duas redações
de REGRA já tinham falhado no mesmo formato** (71,4% e 50,0%) — a segunda escrita mirando o modo de
falha nomeado, e ainda assim piorou. Não é o texto das regras. É o formato.

Isso está agora com teste que segura (`test/defasagem.test.mjs`): quem reordenar "para ficar igual
ao do juiz" quebra a suíte e lê o porquê.

### 2.2 🔑 Achado sem citação parou de contar como achado — e o check pegou fabricação de verdade

`desmente` é o único veredito que vira TAREFA, e passava sem evidência nenhuma. Agora
`defasagem-incoerente` (sem trecho) e `defasagem-citacao` (trecho ausente do documento) falham
fechado.

**A conferência ignora tudo que não é letra ou dígito, e isso foi MEDIDO, não escolhido.** Com
espaço apenas normalizado, **8 citações caíram e NENHUMA era fabricada** — o modelo cita a prosa e
larga o markdown. Reprovar isso seria trocar alucinação por diagramação. Sobraram 2, e as duas são
fabricação real:

- o documento diz `**31/08** — gate do \`sirius\``; o modelo citou `**19/10** — gate do \`sirius\``;
- o documento diz `gate do \`tapepro\`: ≥ 5.000 imp`; o modelo citou `gate do \`sirius\`` — **motivo
  certo, aspa errada**;
- um terceiro devolveu uma frase que está no `CLAUDE.md` e **não estava no documento recebido**.

### 2.3 🔑 O portfólio não cobra — e essa é a resposta que faltava para ler o "1 de 35"

`scripts/gateways.mjs` (zero LLM, HTTP contra os 35 sites):

| balde | n | quem |
|---|---|---|
| gateway LIGADO (a régua lê) | 1 | `atma` |
| gateway servido, **nenhuma régua lendo** | 1 | `orcaobra` — `<a href="https://pay.kiwify.com.br/…">` |
| só página de preço, sem gateway | 3 | `sirius`, `estetiacrm`, `orion` |
| nenhum caminho de cobrança servido | 30 | os outros |

**A leitura certa de "1 de 35 tem gateway ligado" é "faltam 2", não "faltam 34".** A cobertura não
é baixa por falta de integração — é baixa porque **não existe cobrança para integrar**. Isso muda a
priorização de tudo e foi o que fechou a decisão C.4.

---

## 3. O que quebrou nos checks novos, e é reutilizável

**As duas primeiras corridas do `gateways.mjs` mediram o CHECK — sexta vez nesta base.** Os dois
defeitos valem para qualquer varredura futura:

1. **200 em rota inexistente.** `tapevision` e `potencialarquitetado` marcaram os SEIS caminhos,
   `/comprar` e `/assinar` ao mesmo tempo — shell de SPA. **Validar o CORPO não bastou, porque o
   corpo É a home.** O controle é pedir uma rota que não pode existir; se ela vem 200, todo 200
   daquele host vale zero.
2. **A palavra não é a URL.** `estetiacrm` marcou três gateways porque o **catálogo de integrações
   do próprio produto** os cita ("56 integrações nativas com WhatsApp, Google, Stripe, Asaas") —
   gateways que o CRM integra PARA OS CLIENTES DELE. **O que separa vender de falar sobre vender é
   a URL apontar para o host do gateway.**

E um terceiro, na fase B: **o portão do juiz se dizia congelado e lia um arquivo MUTÁVEL.**
`juiz-calibracao.json` e `juiz-adversarial.json` pegavam o gabarito de `dourado.json` na hora da
corrida, e as 8 de `estado` estão nos 20 rótulos de regressão — reescrever uma `resposta` movia o
número do portão sem tocar no juiz. Agora está inlinado em `dourado_congelado`, com teste.

---

## 4. O que fazer, em ordem

### 🚨 D — rotacionar o token do Mercado Pago (NÃO FEITA, e só o Jean pode)

`SEC-04` registra token de **produção** do MP em repo **público**, em todo o histórico. **Ele ainda
funciona: `scripts/vendas-mercadopago.mjs` rodou com ele hoje.** A frente do dinheiro aumentou a
superfície e não consertou a dívida.

Rotacionar no painel do MP e atualizar **os três**: `Atma/Site/Frontend/.env.local`, o env de
produção do atma no EasyPanel e o `.env` do roihub — senão a régua quebra em silêncio e vira
`nao_apurado` sem ninguém entender. Depois: e-mail transacional, senha de banco, JWT secret.

### A (continuação) — duas passadas, e só isso

**Os dois portões ainda reprovam por um caso cada, e todos os erros restantes apontam para
`nao-fala`**: o detector ainda julga o TEMA do documento, não a afirmação dentro dele. O mesmo
documento (`handoff-compass-e-repos-sem-site.md`) erra nos dois portões.

**NÃO escreva uma terceira redação de regra.** Três já falharam. O desenho seguinte é o do juiz:
uma passada que só extrai a afirmação do documento sobre o assunto, outra que só compara afirmação
com fato. ⚠️ **Custo: dobra as chamadas do `corpus-defasado.mjs`**, e o pool já morreu no meio de
uma corrida em 30/07.

⚠️ **O holdout de 14 casos tem resolução grossa demais** para a diferença entre 84,6% e 85%: um
caso a mais daria 92,3%. Quer resolução? **Acrescente pares novos, rotule antes de rodar e commite
antes de rodar.** Não conserte os 6 inválidos por construção.

### C.2 / C.3 — o dinheiro que continua sendo prosa

- **`sirius`**: o inventário confirmou que ele **não cobra pelo site** — fatura por tier de
  organização no próprio banco, e `31.97.23.166:5434` dá `ETIMEDOUT` da máquina de dev. A query
  honesta é conhecida (`SELECT count(*) FROM "Organization" WHERE tier <> 'FREE' AND
  "isTestAccount" = false`). Caminhos: abrir a porta no firewall · rodar de dentro do container no
  EasyPanel · rota de leitura autenticada. **Não invente número enquanto nenhum acontecer.**
- **`orcaobra`**: agora tem evidência de gateway (link Kiwify vivo), o que é MAIS do que o card
  tinha. Continua sem régua: a Kiwify tem API. **Enquanto não passar por régua, o card diz
  AFIRMADO**, como o do sirius.

### E, F, G — herdadas, na ordem do handoff anterior

F (contradição entre documentos) **continua bloqueada pela A**: usa a mesma passada.

---

## 5. O que NÃO fazer

- **Não reordene a saída do detector.** Há teste, e o motivo está no comentário de `lib/defasagem.mjs`.
- **Não afrouxe a conferência de citação para "melhorar" o número.** Os 2 que caem hoje são
  fabricação real; afrouxar traz de volta o achado sem prova.
- **Não escreva `resposta` numa pergunta de camada `estado`** do `data/dourado.json`. O teste
  reprova. Texto que não existe não apodrece.
- **Não acrescente caso de `estado` a fixture do juiz sem congelar o gabarito** em
  `dourado_congelado` — o juiz julgaria contra string vazia. O teste reprova.
- **Não leia `sem-gateway` como "não cobra".** É "não achei caminho de cobrança servido": não vê
  gateway montado por JS depois de clique, nem cobrança fora do site.
- **Não publique percentual de defasagem**, inclusive o 16,7% — que continua sendo **piso**, agora
  medido com um instrumento que absolve 2 de 10 em vez de 7 de 10.
- **Não trate `vendas` ausente como R$ 0**, nem `nao_apurado`/`n/a` como aprovação.
- **Não mexa no prompt do juiz da síntese.** Segue em 87,5% / 10-10 depois da fase B — conferido.

---

## 6. Primeiros 20 minutos

1. `npm test` (**252**), `npx tsc --noEmit`, `node scripts/validade.mjs` (**0 achados**).
2. `node scripts/gateways.mjs --ver` — **~1 min, zero LLM, zero pool.** O retrato do dinheiro.
3. `node --env-file=.env scripts/vendas-mercadopago.mjs` — ⚠️ **se falhar com erro de auth, é
   porque a fase D foi feita e o `.env` do roihub não foi atualizado junto.**
4. `node --env-file=.env scripts/defasagem-calibrar.mjs --ver` — **cache morno, ~0 chamadas.** Leia
   os 2 erros do holdout e os 2 adversariais que escaparam. **Todos dizem `nao-fala`.** É a
   fase A restante numa frase.
5. `node --env-file=.env scripts/juiz-calibrar.mjs` — cache morno. Confirma que o congelamento do
   fixture não moveu 87,5% / 10-10.
