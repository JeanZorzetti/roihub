# Handoff — o que é MELHOR fazer, sem desconto por esforço (01/08/2026)

> Escrito a pedido, com a mentalidade invertida: **não "qual o menor diff", e sim "o que resolve".**
> Onde a resposta cara é a certa, ela está aqui inteira, com o custo ao lado.

Índice: [`../handoff.md`](../handoff.md) · sessão anterior:
[`handoff-o-cruzamento-achou-o-check-errado.md`](handoff-o-cruzamento-achou-o-check-errado.md).

`npm test` 254 verdes · `npx tsc --noEmit` limpo.

---

## 0. Três premissas de handoffs anteriores foram MEDIDAS nesta sessão. Duas caíram.

Antes de qualquer plano, o que já não é verdade:

| premissa herdada | o que a medição diz |
|---|---|
| "Fase R: falta a 2ª medição (1.7 medido 1× de 2)" | ❌ **Falso.** As duas medições existem, movimento ZERO nas duas. **1.7 está FECHADO.** O documento com as duas nasceu no MESMO commit (`d87c788`) do handoff que dizia faltar uma. |
| "o token do MP segue vivo em `origin/main` do **repo público**" | ⚠️ **Meio falso, e o erro está no lado que tranquiliza.** `JeanZorzetti/Atma` está **privado hoje** (foi tornado privado em 30/07). Mas o token **está vivo**: `GET /users/me` → **200**, conta `3020352786`, `MLB`, `live=active`, medido agora. |
| "30 projetos sem caminho de cobrança" | ❌ **Era o check errado.** São **27**. Três estavam no balde errado por `/preco` no singular e por preço em âncora. |

**O padrão vale mais que os três itens:** *nenhuma* dessas premissas exigia mais que um comando para
ser conferida, e as três atravessaram handoffs sendo repetidas. **Lista de próximos passos é
hipótese datada.** Confira antes de executar — e o custo de conferir foi, aqui, de segundos.

---

## 1. 🚨 O incidente do token — e por que ele é o item 1 de verdade

Três fatos novos, todos medidos hoje, e cada um muda o que fazer:

1. **O token está em `DEPLOY_PRODUCTION.md:53` — um arquivo `.md`, não um `.env`.** É por isso que
   ele sobreviveu a toda higiene: `.gitignore` não pega, e nenhuma varredura de `.env*` — inclusive
   o `scripts/gateways-repo.mjs` desta casa — olharia lá. **Segredo em documentação é o ponto cego
   estrutural**, não um descuido pontual.
2. **Ele é byte-idêntico ao `MERCADOPAGO_ACCESS_TOKEN` do `.env` deste repo.** Rotacionar **quebra a
   régua do dinheiro** (`scripts/vendas-mercadopago.mjs`, que alimenta `D-67`) até três lugares
   serem atualizados juntos.
3. **O repo foi público e hoje é privado.** Privar depois não desfaz clone nem indexação: a janela
   de exposição existiu e não se pode medir. **O histórico do git guarda o token mesmo que o arquivo
   seja apagado hoje.**

### O procedimento COMPLETO, não o rápido

O jeito rápido — apagar a linha e commitar — deixa o token no histórico e mantém o vazamento. O
certo, na ordem, em um movimento só:

1. **Gerar credencial nova** no painel do Mercado Pago (aplicação do atma).
2. **Atualizar os três consumidores no mesmo intervalo:** `.env` do EasyPanel do atma, `.env` local
   do roihub, e qualquer serviço do atma que leia a env.
3. **Invalidar a antiga no painel do MP** — este é o passo que realmente fecha o vazamento. Sem ele,
   os dois passos acima só adicionam uma credencial.
4. **Purgar o histórico** (`git filter-repo` ou o BFG) no `Atma`, e force-push. Se isso for
   inaceitável, o passo 3 sozinho já basta para a segurança — mas então **assuma por escrito** que o
   valor morto continua no histórico.
5. **Conferir que fechou:** repetir `GET https://api.mercadopago.com/users/me` com o token ANTIGO e
   exigir **401**. Enquanto der 200, nada foi feito.
6. **Rodar `node --env-file=.env scripts/vendas-mercadopago.mjs`** e ver a régua voltar a apurar.
   Sem isso, `D-67` cai em `nao_apurado` no dia seguinte e ninguém liga o motivo à rotação.

⚠️ **O passo 5 é o único que produz evidência.** Todos os outros são intenção.

✅ **Um alarme falso foi descartado no caminho:** varri `APP_USR` em todos os repos do usuário. Só o
Atma tem token real. Os 2 hits em `JeanZorzetti/sofia-ia` — **esse é público** — são a string
`APP_USR-` de 8 caracteres, exemplo em página. **Não há segunda exposição.**

---

## 2. A frase incômoda, atualizada — e ela ficou pior

O handoff da spec abriu com: *em 3 dias esta frente produziu 6 handoffs, 9 réguas e 4 docs de
calibração, e o número que ela existe para produzir nunca foi publicado uma única vez.*

Hoje são 4 dias, 8 handoffs, 11 réguas e 6 docs. **O número continua não publicado.** E o
cruzamento de hoje adicionou a segunda metade da frase:

> **A frente que consome tudo (o detector) não gera receita nenhuma. A frente que geraria (a
> cobrança) tem 9 projetos com checkout escrito e nunca ligado — e nunca teve uma definição de
> pronto.**

Isso não é crítica ao trabalho do detector: ele é uma peça de instrumentação boa, com decisões
difíceis defendidas com número (evidência antes do veredito, piso proporcional, falha fechada,
fixture congelado). **É uma observação de alocação.** Instrumentação de qualidade sem produto que
cobre é um laboratório, e um laboratório se justifica pelo que valida — não por si.

---

## 3. A frente do DETECTOR — a decisão franca

### Onde ela trava, com número

| critério | estado | falta |
|---|---|---|
| 1.1 holdout ≥ 40 | 44 ✅ | — |
| 1.2 adversarial ≥ 20 | 20 ✅ | — |
| 1.3 âncora | 63/70 (20/20 nos adversariais) | 7 legados, de propósito |
| **1.4 portão 1 ≥ 85% E zero sem veredito** | **83,3% (35/42), 2 sem veredito** ❌ | 1,7 pt **e** 2 casos |
| **1.5 portão 2 ≥ 90%** | **14/20 (70%)** ❌ | 4 casos |
| 1.6 células perigosas em ZERO | ✅ | — |
| 1.7 reprodutibilidade 2× | ✅ **fechado hoje** | — |

Três tentativas de conserto já falharam **com número**: duas redações de regra (71,4% e 50,0%) e uma
decomposição em duas passadas (65,9%, e ela quebrou o 1.6, que é o que decide).

### O diagnóstico que ninguém escreveu ainda

Os 7 erros restantes são **todos** `bate → nao-fala`. Zero `desmente` perdido, zero fabricado. A
leitura corrente é "cai todo no lado seguro". A leitura mais honesta é outra:

> **A célula que decide tem 5 casos.** A matriz é `nao-fala→nao-fala` 19 · `bate→bate` 11 ·
> `bate→nao-fala` 7 · `desmente→desmente` 5. O detector acertou **5 de 5** `desmente`. Cinco.
>
> **A pergunta que este instrumento existe para responder — "ele deixa passar corpus podre?" — está
> sendo respondida por uma amostra de cinco.** Nenhuma redação de prompt conserta isso. Não é
> problema do detector; é problema do CONJUNTO.

E o handoff anterior já provou que o conjunto não cresce: **61 pares candidatos lidos um a um, zero
`desmente` natural.**

### 🎯 A ideia cara que eu acho que resolve — e o teste barato que a mata em 20 minutos

Os 61 pares vieram do top-k da busca **contra o corpus de HOJE**. Mas esta casa tem uma regra que
ninguém conectou a este problema:

> **"Handoff datado NÃO se reescreve — é o único lugar onde se vê o que se sabia quando a decisão
> foi tomada."**

Ou seja: **o repositório preserva, de propósito e datadas, afirmações que a fonte viva hoje
desmente.** Só nesta sessão nasceram três — "faltam 30 sem caminho de cobrança" (são 27), "1.7
medido 1× de 2" (são 2), "repo público" (é privado). Isso é matéria-prima de `desmente` **natural,
datada e verificável**, não sintética. E o `git log` dos handoffs e memórias tem 4 dias dela.

**O trabalho (caro, e é o certo):** minerar pares `(afirmação histórica, apurado de hoje)` do
histórico versionado, rotular, e levar a célula `desmente` de 5 para 25+. Só então os portões medem
o que dizem medir.

**O teste barato que decide se vale (faça ANTES):** pegue os 8 fatos de `estado` que têm fonte viva,
rode `git log -p` nos handoffs e memórias procurando os valores ANTIGOS desses mesmos números, e
conte quantos pares saem. **Se saírem menos de 15, a ideia morreu e você economizou dias.**

⚠️ **E a armadilha nesse caminho:** afirmação em handoff datado tem contexto de data. Um par só é
`desmente` legítimo se a afirmação estiver **no presente** — "hoje são 30" desmente; "em 30/07 eram
30" não desmente coisa nenhuma, está correto para sempre. É exatamente a distinção do
`validade.mjs`, e ela vai ser a parte difícil da rotulagem.

### O que NÃO fazer, e por quê

- ❌ **Uma quarta redação de regra ou uma segunda decomposição.** Três tentativas, três números
  piores. O problema não está no prompt.
- ❌ **Redefinir o portão em torno do que o produto emite** ("`bate` e `nao-fala` prescrevem a mesma
  ação, então não deviam contar como erro"). É tecnicamente defensável **e é ajustar o gabarito
  depois de ver a prova** — a coisa exata que o `VER-08` desta casa proíbe. Se um dia for feito, a
  justificativa tem que ser escrita **antes** da corrida e validada em material novo.
- ❌ **Publicar a taxa de erro com o portão reprovando.** É o defeito que esta base existe para não
  cometer.

---

## 4. A frente da COBRANÇA — onde o dinheiro está, e ela nunca teve dono

**9 projetos com SDK de pagamento escrito e nunca ligado.** Seis deles já mostram preço na página:
`sirius`, `polarisia`, `estetiacrm`, `context`, `orion`, `vertice`. Um portfólio que pede dinheiro
em seis páginas e não tem como recebê-lo em nenhuma.

Sem desconto: **isso não é um problema de medição. Já está medido.** Mais uma régua aqui não
adiciona informação — adiciona documento.

### São dois trabalhos diferentes e eles não competem

**(a) Provar receita que talvez JÁ EXISTA — `sirius`.** É o único projeto do portfólio com sinal de
demanda: **3 vendas AFIRMADAS e nunca conferidas no banco**. Ele fatura por tier de organização no
próprio banco, então nenhuma página dele carregaria gateway — as duas réguas são cegas a ele ao
mesmo tempo. **Blocker: `31.97.23.166:5434` dá TIMEOUT da máquina de dev, e o controle prova que não
é rede geral** (`2.24.207.200:5435` responde em 143 ms no mesmo instante). É aquele host/porta, e é
infra — sua.

> **Confirmar OU MATAR essas 3 vendas vale mais que qualquer checkout novo.** Se forem reais, é a
> primeira receita provada do portfólio. Se não forem, um card mente há semanas e a priorização
> inteira está montada em cima disso.

**(b) Ligar UMA cobrança de ponta a ponta.** Não seis. Uma. E escolhida pelo critério certo — não o
mais fácil de plugar, e sim **o que tem alguém do outro lado disposto a pagar**. Ligar checkout em
produto sem demanda produz um número zero muito bem instrumentado.

Recomendação, se a demanda for igual entre eles: **`context`** — está no ar, tem `stripe` no
`package.json` **e** `STRIPE_SECRET_KEY` no `.env.example` (integração começada, não só sonhada), e
tem pacote npm publicado, que é distribuição pronta.

---

## 5. A ordem que eu executaria, e o porquê de cada posição

1. **🚨 Rotacionar o token do MP, procedimento completo da seção 1, incluindo o passo 5 (401).** É a
   única coisa nesta lista que pode custar dinheiro enquanto não é feita. Não é uma tarefa — é um
   incidente aberto há 2 dias.
2. **Destravar a porta 5434 e conferir as 3 vendas do `sirius`.** Uma porta contra o único sinal de
   demanda do portfólio.
3. **O teste de 20 minutos da seção 3** (minerar `desmente` do histórico do git). Ele decide se a
   frente do detector tem caminho ou deve ser congelada — e essa decisão vale mais que qualquer
   corrida nova.
4. **Ligar UMA cobrança de ponta a ponta**, com o critério de PRONTO da seção 6.
5. **Só então**, se o passo 3 tiver dado verde: minerar os pares, refazer os portões, publicar a taxa
   de erro do corpus **uma vez**.

**Se o passo 3 der vermelho:** congele a frente do detector com o número que ela tem e o motivo
escrito. **Um instrumento que não pode ser validado com o material existente não é um instrumento
ruim — é um instrumento sem bancada.** Congelar com o porquê escrito é resultado; continuar
tentando redações é o que os últimos 4 dias já mostraram que não converge.

---

## 6. 🎯 A DEFINIÇÃO DE PRONTO — a pergunta 2, respondida

São **duas features**, e a confusão entre elas é parte do problema. Cada uma precisa da sua.

### Feature A — o detector de defasagem (o instrumento)

A definição já existe em 3 níveis, e o nível 1 está aberto. **Ela continua correta e eu não a
mudaria** — só acrescentaria o critério que a sessão de hoje mostrou faltar:

| # | critério | como se verifica |
|---|---|---|
| 1.1–1.3 | ✅ fechados | 44 casos, 20 adversariais, âncora em 20/20 |
| 1.4 | portão 1 **≥ 85% E zero caso sem veredito parseável** | `scripts/defasagem-calibrar.mjs` |
| 1.5 | portão 2 **≥ 90%** (proporcional, nunca absoluto) | idem |
| 1.6 | **células perigosas em ZERO** — `bate→desmente` e `desmente→nao-fala` | idem; vale mais que o agregado |
| 1.7 | ✅ reprodutibilidade medida 2×, movimento < 3 pts | fechado hoje: movimento ZERO |
| **1.8** | 🆕 **a célula `desmente` tem ≥ 20 casos** | contar a matriz |
| 2 | a taxa de erro do corpus é publicada **UMA vez**, com o recorte E a fronteira na mesma frase | "8 de 78 contra fonte viva; 70 são prosa concordando com prosa" |
| 3 | **o loop fecha**: uma 2ª corrida mostra o **achado NOMINAL sumindo** porque foi consertado | nunca o percentual descendo — o corpus muda entre as corridas |

**1.8 é o critério novo e é ele que trava tudo hoje.** Sem ele, os outros seis podem ficar verdes e o
instrumento continua sem ter provado a única coisa que importa. **Um portão que passa com 5 casos na
célula que decide não é um portão — é uma cerimônia.**

**Sem o nível 3 isto é um termômetro caro que ninguém leu.** A frase é do handoff da spec e continua
sendo a melhor da frente.

### Feature B — a cobrança (o produto)

**Nunca teve definição. Esta é a proposta, e ela é deliberadamente dura:**

> **PRONTO = um estranho consegue pagar, o dinheiro chega numa conta real, e uma RÉGUA lê o valor
> sem ninguém digitar.**

Os cinco testes, todos verificáveis, nenhum opinativo:

1. **O caminho completa de ponta a ponta** para alguém que não é você, num navegador limpo, sem
   token de teste. *(Verifica: clicar, pagar, receber confirmação.)*
2. **O pagamento é real.** `approved` + `live_mode` **não** basta — os 20 pagamentos de R$ 47 do atma
   passam nos dois e são você testando. **Quem separa é o `payer`**: e-mail que não é
   `…@testuser.com`, CPF que não é `11111111111`.
3. **`vendas` sai do card por RÉGUA**, derivado da API do gateway com `{data, valor, fonte, id}` —
   **nunca digitado**. Card com valor escrito à mão é `AFIRMADO`, não apurado.
4. **O número sobrevive a outra sessão.** Rodar a régua em outro dia, sem editar nada, e o valor
   apurar de novo. *(Falha fechada: sem rede, sai `nao_apurado` com motivo — nunca o valor de
   ontem.)*
5. **Um segundo pagamento entra sem intervenção manual.** Um é demo; dois é canal.

❌ **Explicitamente NÃO conta como pronto:** mais uma corrida de inventário, mais um balde, mais um
doc, "o gateway está configurado", "só falta publicar". **Cobrança pronta é dinheiro de terceiro na
conta, lido por máquina.** Todo o resto é preparação.

📌 **E o alvo do portfólio, para o `receitaProvada` entrar no `computeScore`:** a condição já está
escrita em `lib/score.mjs` — **10 dos 35 com gateway LIGADO**, não com página de preço. Hoje é 1.
Com os 6 da seção 4 ligados, seriam 7.

---

## 7. O que fica registrado como armadilha desta sessão

- **Premissa de handoff é hipótese datada.** Três caíram hoje, e conferir custou segundos cada.
- **Segredo em `.md` é o ponto cego estrutural.** Nenhuma varredura de `.env*` o encontra — e esta
  casa tem uma varredura de `.env*` (`gateways-repo.mjs`) que passou ao lado dele.
- **Rotacionar credencial sem invalidar a antiga não é rotação, é adição.** Só o **401** prova.
- **Amostra da célula que decide > agregado do portão.** 83,3% com 5 casos em `desmente` diz menos
  que 100% com 25 diria.
- **Card ≠ repositório** (`goiania` e `roilabs` são o mesmo repo, a mesma linha do mesmo arquivo).
- **Um check sozinho não tem contra o quê errar.** Foi o cruzamento — não a terceira releitura — que
  achou os dois defeitos do `gateways.mjs`.
