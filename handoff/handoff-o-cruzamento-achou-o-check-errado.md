# Handoff — o cruzamento de inventários existe para o check ter contra o quê errar (01/08/2026)

Executa o item 5 de [`handoff-a-definicao-de-pronto-executado.md`](handoff-a-definicao-de-pronto-executado.md) ·
índice: [`../handoff.md`](../handoff.md).

`npm test` 254 verdes. Zero LLM e zero pool nesta sessão inteira.

---

## 1. 🚩 O item 4 daquele handoff JÁ ESTAVA FEITO quando ele foi commitado

A lista "o que fazer a seguir" pedia **"Fase R, 2ª medição — falta uma"**, e a seção 7 do mesmo
documento marcava 1.7 como "medido 1× de 2". Mas
[`../docs/defasagem-reprodutibilidade-2026-08-01.md`](../docs/defasagem-reprodutibilidade-2026-08-01.md)
tem **Medição 1 e Medição 2**, as duas com movimento ZERO, e conclui que o critério fechou —
e os dois arquivos **nasceram no MESMO commit** (`d87c788`).

O handoff apodreceu antes de ser escrito: a seção de próximos passos foi redigida contra um estado
que o corpo do próprio documento já superava. **Não é caso isolado** — é a mesma família de
"validar a premissa do card ANTES de executá-lo". Quem for executar uma lista de próximos passos
confere primeiro se o item ainda existe; aqui, um dos cinco não existia.

**Efeito prático: o critério 1.7 está FECHADO.** O nível 1 continua aberto pelos portões 1.4 e 1.5.

## 2. O cruzamento (item 5) — 9 projetos com cobrança escrita e nunca ligada

Página inteira, com a matriz 35×4 e a evidência de cada linha, em
[`../docs/gateways-cruzamento-2026-08-01.md`](../docs/gateways-cruzamento-2026-08-01.md).

Dos **10 com SDK de pagamento no `package.json`, um único faturou** (`atma`). Os outros nove em
dois estágios:

- **Pede dinheiro na página E tem o checkout escrito — falta LIGAR (6):** `sirius` (mp+stripe),
  `polarisia` (mp), `estetiacrm` (mp), `context` (stripe), `orion` (mp), `vertice` (mp).
- **SDK escrito e nem página de preço (3):** `reviewshield`, `aftercare`, `compass` — todos stripe.

`orcaobra` é o **único caso inverso** e justifica as duas metades existirem: cobra por link externo
da Kiwify, o que **não deixa dependência nenhuma no `package.json`**. Só o inventário do código, e
o único projeto com gateway no ar sem régua lendo seria invisível.

## 3. 🚩 E o cruzamento achou dois defeitos do `gateways.mjs` — VER-08, oitava vez

Os dois só apareceram porque a outra metade deu um **palpite independente** sobre quem devia estar
em qual balde. **Um check sozinho não tem contra o quê errar.**

1. **`/preco` no singular não estava na lista de caminhos.** `polarisia` serve `/preco` com 200,
   tem `mercadopago` no `package.json`, e caía em **NÃO TEM GATEWAY** — o balde mais errado
   possível. Uma letra decidiu a leitura de um card.
2. **Preço em ÂNCORA não é rota.** `context` e `vertice` são landing de uma página só: o preço mora
   em `href="#pricing"` na home e não existe `/precos` para pedir.

O casamento da âncora é contra o **`href`**, nunca contra a palavra no corpo — "plano" aparece em
qualquer marketing, e foi essa confusão que custou a 2ª corrida deste check ("palavra ≠ URL").

**O controle de que o conserto não afrouxou nada:** os três projetos que mudaram de balde têm **os
três** SDK de pagamento escrito no repo, e **nenhum projeto sem SDK entrou** em `só preço`. Conserto
que só move quem a outra régua já apontava é conserto; que move qualquer um é regex frouxa.

`sem-gateway` foi de **30 → 27**. A frase "30 sem caminho de cobrança", do handoff de hoje mais
cedo, é do check antigo.

## 4. O que continua em aberto

1. **🚨 Fase A (Jean).** O token de produção do Mercado Pago segue vivo em `origin/main` do repo
   público do `atma`. Não mudou, e fica mais caro a cada dia.
2. **`goiania` está em `sem-gateway` e quase certamente errado.** Tem `MERCADOPAGO_ACCESS_TOKEN`
   declarado e registro de checkout de produção falhando com `?erro=pagamento`: preferência criada
   **no servidor, depois de um clique** — o ponto cego declarado deste check. Confirmar exige
   clicar, não buscar HTML.
3. **Portões 1.4 (83,3%) e 1.5 (14/20) seguem reprovando.** Nada nesta sessão tocou no detector, e
   a orientação anterior continua valendo: **não tente uma terceira decomposição.**
4. **A célula `desmente` não cresce com o material que existe** — decisão pendente, não execução.

## 5. Armadilhas desta sessão

- **Lista de próximos passos de handoff é premissa, não fato.** Um dos cinco itens já estava
  entregue no commit que criou a lista.
- **Card ≠ repositório.** `goiania` e `roilabs` apontam para o mesmo `JeanZorzetti/roilabs`, e a
  prova dos dois é a mesma linha do mesmo `app/.env.example`. Somar infla onde há vertical dentro
  de monorepo.
- **Variante de rota é barata; balde errado não.** Uma requisição a mais por projeto contra a
  priorização inteira do dinheiro da casa.
- **Duas réguas que olham a mesma coisa por caminhos diferentes se auditam uma à outra.** Foi o
  cruzamento, não uma releitura, que encontrou os dois defeitos.
