# O cruzamento dos dois inventários de cobrança (01/08/2026)

**Pergunta:** `scripts/gateways.mjs` lê o HTML servido e `scripts/gateways-repo.mjs` lê o código
pela API do GitHub. Cada um sozinho responde uma coisa que não é a que se quer saber. Cruzados,
respondem: **em quais projetos a cobrança está ESCRITA e não está LIGADA?**

Zero LLM, zero pool nas duas metades. Ambas as corridas desta página são a **segunda ou terceira**
de cada check — a primeira de cada um mediu o check, não os projetos.

---

## A matriz, 35 projetos, nenhuma célula vazia por omissão

| repo ↓ · HTML → | ligado | gateway servido, régua nenhuma | só preço | nenhum caminho | total |
|---|---|---|---|---|---|
| **SDK no `package.json`** | `atma` | — | `sirius` `polarisia` `estetiacrm` `context` `orion` `vertice` | `reviewshield` `aftercare` `compass` | **10** |
| só variável de ambiente | — | — | — | `goiania` `roilabs` | **2** |
| nada no código | — | `orcaobra` | — | 22 | **23** |
| **total** | **1** | **1** | **6** | **27** | **35** |

---

## 1. A lista nominal: 9 projetos com cobrança escrita e nunca ligada

Dos 10 com SDK de pagamento no `package.json`, **um único chegou a faturar** (`atma`). Os outros
nove estão em dois estágios diferentes, e a distinção decide o esforço:

**Pede dinheiro na página E tem o checkout escrito no repo — falta LIGAR (6):**

| projeto | SDK escrito | onde o preço aparece |
|---|---|---|
| `sirius` | mercadopago + stripe | `/pricing` |
| `polarisia` | mercadopago | `/preco` |
| `estetiacrm` | mercadopago | `/precos`, `/pricing` |
| `context` | stripe | seção `#pricing` na home |
| `orion` | mercadopago | `/checkout`, `/precos` |
| `vertice` | mercadopago | seção `#pricing` na home |

**SDK escrito e nem página de preço servida — está mais longe (3):** `reviewshield` (stripe),
`aftercare` (stripe), `compass` (stripe).

⚠️ `sirius` é o caso onde as duas réguas são cegas ao mesmo tempo: ele fatura por tier de
organização **no próprio banco**, então nenhuma página dele carregaria gateway — e o banco
(`31.97.23.166:5434`) segue em `TIMEOUT` da máquina de dev. As 3 vendas do card continuam
**AFIRMADAS**, não apuradas.

## 2. `orcaobra` é o único caso inverso, e é por ele que o inventário do repo não basta

Kiwify servido na home (`<a href="https://pay.kiwify.com.br/…">`), **zero SDK no repo**: cobrança
por link externo não deixa dependência nenhuma no `package.json`. Se só existisse o inventário do
código, o único projeto do portfólio com gateway no ar e nenhuma régua lendo seria invisível.

## 3. 🚩 O balde "só variável de ambiente" tem 2 cards e 1 REPO

`goiania` e `roilabs` apontam os dois para `JeanZorzetti/roilabs`, e a prova dos dois é
**literalmente a mesma linha do mesmo arquivo** (`app/.env.example` → `MERCADOPAGO_ACCESS_TOKEN`,
`ASAAS_API_KEY`). Não são dois sinais independentes: é um sinal contado duas vezes porque o
inventário itera CARDS e a evidência mora em REPOS.

Vale para qualquer contagem futura pelo repo — **card ≠ repositório**, e a régua que somar os dois
como se fossem infla exatamente onde há vertical dentro de monorepo.

---

## 4. 🚩 VER-08, oitava vez: a terceira corrida do `gateways.mjs` achou dois defeitos DELE

Os dois só apareceram porque o inventário do repo deu um palpite independente sobre quem deveria
estar em qual balde. **É essa a função do cruzamento** — check sozinho não tem contra o quê errar.

1. **`/preco` no singular não estava na lista.** O `polarisia` serve `/preco` com 200, tem
   `mercadopago` no `package.json` e caía em **NÃO TEM GATEWAY**, o balde mais errado possível.
   Uma letra decidiu a leitura de um card. Variante de rota custa uma requisição; balde errado
   custa a priorização inteira.
2. **Preço em ÂNCORA, não em rota.** `context` e `vertice` são landing de uma página só: o preço
   mora em `href="#pricing"` na home e não existe `/precos` para pedir. A lista de caminhos
   pergunta por ROTA, então os dois caíam em "não achei caminho de cobrança".

O casamento da âncora é contra o **`href`**, nunca contra a palavra no corpo — "plano" aparece em
qualquer texto de marketing, e foi essa confusão que custou a segunda corrida deste check
("palavra ≠ URL"). `href="#pricing"` é o site declarando onde começa a seção de preço: é
estrutura, da mesma família de uma rota.

**O controle de que o conserto não inflou:** os três projetos que mudaram de balde
(`polarisia`, `context`, `vertice`) têm **os três** SDK de pagamento escrito no repo. Nenhum
projeto sem SDK entrou em `só preço`. Um conserto que só move quem a outra régua já apontava é
conserto; um que move qualquer um é regex frouxa.

`sem-gateway` foi de **30 para 27**, e a leitura "30 sem caminho de cobrança" do handoff de hoje
mais cedo era do check antigo.

---

## 5. O que este cruzamento NÃO resolve

- **`goiania` continua em `sem-gateway` e provavelmente está errado.** A variável
  `MERCADOPAGO_ACCESS_TOKEN` está declarada e há registro de checkout de produção falhando com
  `?erro=pagamento` — preferência do Mercado Pago criada **no servidor, depois de um clique**, que
  é o ponto cego declarado do `gateways.mjs` desde a primeira corrida. Confirmar exige clicar, não
  buscar HTML.
- **`nada no código` (23) continua sendo "não achei", nunca "não cobra".** Repo privado fora do
  alcance do token, cobrança fora do site e arquivo além dos 40 primeiros que o check abre.
- **Nenhum percentual sai daqui.** A saída é lista nominal: cada linha da seção 1 é um projeto
  para ligar, não um ponto de um agregado.
