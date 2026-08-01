# Handoff — o `D-84` não tem UMA ação, tem QUATRO classes — e a maior delas já foi executada em 31/07 (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-a-frente-do-detector-foi-congelada.md`](handoff-a-frente-do-detector-foi-congelada.md)
> (frente do detector congelada por decisão; §6 lido item a item). Índice:
> [`../handoff.md`](../handoff.md) · leitura que originou esta:
> [`../docs/estado-conformidade-crawl-2026-08-01.md`](../docs/estado-conformidade-crawl-2026-08-01.md).

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e onde o caminho barato e o caminho certo divergem ele defende o certo e diz o preço.

`npm test` **269 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · corpus 304 docs.

---

## 0. Leia isto antes de escolher outra coisa

**🧊 A frente do detector de defasagem está CONGELADA por decisão (01/08).** O número que congelou é
a **precisão da lista nominal: 70%** — 3 de cada 10 linhas mandam editar o que está certo.
**Descongelar exige responder ANTES para quê** (§3.3). Descongelar por inércia é o defeito.

Os itens abaixo **não são tarefa de agente** e estão abertos há 4 dias:

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago. Gerar a nova sem invalidar a velha **não é rotação, é adição**. Único item que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 3 | **As 4 chaves da Stripe do `context`** | credencial de painel |
| 4 | **Export novo do Crawl Stats do `roilabs.com.br`** | export manual da UI do GSC — é o que fecha o `D-85` de verdade |

**Contornar qualquer um deles é o defeito**, não o atalho.

---

## 1. 🚩 A correção que ordena esta sessão: "os 6 `Discovered`" estava errado nos DOIS números

O handoff anterior mandava começar pelos "6 `Discovered - currently not indexed`, estado que responde
a link interno e sitemap". **Os dois pedaços da frase são falsos, e foi medido:**

- **São 5, não 6.**
- **Sitemap não é a alavanca: os 12 já têm sitemap válido, JÁ SUBMETIDO e JÁ BAIXADO pelo Google.**

`GET /webmasters/v3/sites/{prop}/sitemaps` nas três propriedades (`roilabs.com.br`, `nimblabs.com`,
`estetiacrm.com.br`) devolve os 12 com **`lastSubmitted` em 30–31/07, `lastDownloaded` em 31/07 ou
01/08, e `errors: 0`**. O `sitemap.xml` responde 200 com corpo XML de verdade em 12 de 12
(corpo validado, nunca o status — `spa_sitemap_200_is_not_proof`).

> **A medição de `D-84` foi tirada 1 a 2 dias DEPOIS da ação.** A submissão dos sitemaps aconteceu em
> 30–31/07; a inspeção que devolveu "12 fora do índice" rodou em 01/08. **Ler isso como tarefa é o
> mesmo erro do `D-85`** — julgar um número dentro da janela em que o conserto ainda não podia ter
> efeito. Lá a janela era de 90 dias; aqui é de 24 h.

**Consequência direta: `D-84` não é a tarefa mais barata da casa. É uma REMEDIÇÃO DATADA.**

## 2. As quatro classes, porque a ação de cada uma é diferente

Os 12 não são uma fila. `dourado-estado.mjs --estado tudo` já devolve o estado nominal de cada um, e
eles se separam em quatro prognósticos incompatíveis:

| classe | n | projetos | o que o Google está dizendo | há alavanca? |
|---|---|---|---|---|
| `URL is unknown to Google` | **2** | `orcaobra` `pathfinder` | nunca vi essa URL | **já puxada** (sitemap baixado em 31/07) — resta esperar |
| `Discovered - currently not indexed` | **5** | `matchfios` `swarm` `moderador` `seo-forecaster` `lumina` | conheço, não priorizei rastrear | fraca: link interno e budget |
| `Crawled - currently not indexed` | **4** | `whatsmeow` `cannibal_scan` `orion` `vertice` | **rastreei, li e RECUSEI** | **nenhuma técnica** |
| `Duplicate, Google chose different canonical` | **1** | `claudeloop` | escolhi outra URL como original | **sim, e é diagnosticável hoje** |

⚠️ **`portfolio` fica fora das quatro e fora de qualquer meta:** mora em
`portfolio-three-mu-lfixsylpsz.vercel.app`, host de fornecedor que fica **fora de toda propriedade
do GSC**. "Sem propriedade" não é "fora do índice", é **"não há onde olhar"** — falta de domínio
próprio, não sinal de SEO. Por isso o denominador é 34, e submeter sitemap de lá **falha por
construção**, não por permissão.

🚩 **A classe que importa entender é a terceira.** `Crawled - currently not indexed` significa que o
Googlebot baixou a página, processou e **decidiu não indexar**. Medido nesta sessão, os quatro servem
**486 a 1038 palavras** de HTML real — não é página vazia, é conteúdo que o Google leu e julgou não
valer o índice. **Nenhum conserto técnico move essa célula**, e é exatamente aqui que uma meta
numérica vira meta em cima de um defeito.

## 3. O achado NOVO desta leitura: 3 SPAs servem ZERO palavra no HTML inicial

Este é o único defeito técnico que a leitura de `D-84` produziu, e ele é real, nosso e verificável
no ato:

| projeto | HTML servido | palavras no corpo | estado no índice |
|---|---|---|---|
| `pathfinder` | 4,8 KB | **0** | `URL is unknown to Google` |
| `matchfios` | 1,6 KB | **0** | `Discovered - currently not indexed` |
| `lumina` | 1,4 KB | **0** | `Discovered - currently not indexed` |

Os três são `vite-spa` (stack detectada pelo `conformidade.mjs`): o HTML inicial é um shell e todo o
texto nasce em JS depois. Os outros 9 fora do índice servem 301–1038 palavras no HTML.

⚠️ **Este número foi medido DUAS vezes, e a primeira medição era o CHECK.** A primeira passada usou
`sed 's/<script[^>]*>.*<\/script>//g'` e devolveu **0 palavras para `orcaobra` e `vertice` — que têm
`<h1>`**. HTML minificado é uma linha só, então o `.*` guloso apaga do primeiro `<script>` ao
ÚLTIMO, ou seja, o body inteiro. Refeito com parser não-guloso, `orcaobra` tem 472 e `vertice` 301.
**Contradição interna (0 palavras com `h1` presente) foi o que denunciou** — décima vez de
`first_run_measures_the_check` nesta base.

**Não é conclusão fechada:** conteúdo em JS é renderizável pelo Google, então SPA vazia **atrasa**
a indexação, não a impede. O que se pode afirmar é que os 3 estão na fila de render e que
prerender/SSR os tira dela. `orcaobra` serve 472 palavras e continua `unknown`, então **shell vazio
não é a explicação única dos 12**.

---

## 4. 🎯 A META — o que precisa bater para considerar PRONTO

A pergunta não tem uma resposta só, porque as duas metades têm donos diferentes. **Misturá-las é o
que faz frente rodar por inércia.**

### 4.1 Meta de ENTREGA — nossa mão, verificável no mesmo dia

É esta que decide se a sessão fechou. Não depende do Google.

| trabalho | portão | como verificar |
|---|---|---|
| **3 SPAs com shell vazio** | `curl` da home devolve o `<h1>` e o texto principal **no HTML inicial** — hoje são 0 palavras nos três | o parser não-guloso do §3, mesmo comando |
| **`GEO-01` nos projetos tocados** | `GEO-01` cai de 28 **pelo número exato de projetos tocados** | `node --env-file=.env scripts/conformidade.mjs` |
| **`claudeloop`** | saber **qual** canonical o Google escolheu (não necessariamente consertar) | URL Inspection do `claudeloop`, campo do canonical do Google |

⚠️ **O controle obrigatório, e ele é a lição do `gateways.mjs`:** **nenhum projeto NÃO TOCADO pode
mudar de balde.** Quando o `gateways.mjs` foi consertado, o controle de que o conserto não inflou foi
"os 3 que mudaram de balde têm os 3 SDK escrito no repo, e nenhum sem SDK entrou". Aqui é igual: se
`GEO-01` cair de 28 para 20 tendo tocado 5 projetos, **o check mudou, não o portfólio** — pare e leia.

⚠️ **`GEO-01` são DUAS faltas com valores MUITO diferentes, e o placar as soma.** `GPTBot` no
`robots.txt` tem efeito real e verificável (permite ou barra o crawler da OpenAI). **`llms.txt` não
tem consumidor medido** — é norma declarada da casa (playbook GEO/AEO), não efeito observado. Fazer
os dois é obedecer a norma; **só não trate o `llms.txt` como se fosse tráfego.** E não faça os 28 de
uma vez: comece pelos que já têm tráfego, porque norma aplicada em massa sem leitura é como check
vira enfeite.

### 4.2 Meta de RESULTADO — mão do Google, e ela é DATADA e POR CLASSE

**A meta NÃO é "12 → 0", e escrever isso seria o defeito.** Duas datas fixas, contadas da submissão
dos sitemaps em 31/07:

- **D+14 → 15/08/2026**
- **D+28 → 29/08/2026**

Remedição: `node --env-file=.env scripts/dourado-estado.mjs --estado tudo` (zero LLM), lendo a lista
NOMINAL, nunca o "22 de 34".

| classe | meta em 15/08 | por quê |
|---|---|---|
| `URL is unknown` (2) | **os 2 saem desse estado** | é o único com efeito esperado determinístico — o Google baixou o sitemap em 31/07. **Se em 15/08 ainda estiverem `unknown`, AÍ é defeito real e vale caçar** |
| `Duplicate canonical` (1) | **resolve ou tem causa nomeada** | determinístico, não depende de fila |
| `Discovered` (5) | **≥ 3 dos 5 saem** — meta fraca, declarada como fraca | fila de crawl não tem prazo contratual |
| `Crawled - currently not indexed` (4) | **SEM META NUMÉRICA** | o Google leu 486–1038 palavras e recusou. Pôr número aqui é **meta em cima de um defeito** — a régua não declararia o próprio limite |
| `portfolio` | **fora de qualquer meta** | sem propriedade: não há onde olhar. Só sai disso com domínio próprio, que é decisão, não tarefa |

⚠️ **Não meça antes de 15/08.** A janela do GSC desliza na meia-noite UTC e o mesmo fim de tarde já
deu 33 e depois 42; medir no dia seguinte não diz nada e gasta a credibilidade do número. **Site em
200 não é site no índice** — só a URL Inspection decide, e tráfego reage ~14 dias depois da
indexação, não da submissão.

### 4.3 Meta para DESCONGELAR o detector — se a pergunta for essa

**Proposta, não estabelecida — ninguém fixou esta barra ainda, e ela é a decisão do Jean.**

O produto da frente é a lista nominal, então a barra tem que ser sobre ela:
**precisão da lista nominal ≥ 90%**, medida no holdout de 15 fatos, com os dois portões atuais
(holdout ≥ 85% e adversarial proporcional ≥ 90%) continuando de pé.

Hoje é **70%**. O raciocínio da barra: a 1 em 10 um humano que lê a lista ainda absorve o erro; a 3
em 10 a lista custa mais do que entrega, que é exatamente por que a frente foi congelada. **Barra
menor que 90% precisa dizer quem paga a linha errada.**

---

## 5. A ordem sugerida, com o preço

1. **`GEO-01` num punhado de projetos** — é o único trabalho desta lista que **não espera o Google**
   e fecha no mesmo dia. Comece pelos que têm tráfego.
2. **`claudeloop`** — 1 inspeção, diagnóstico fechado, e é a única das 4 classes com causa
   determinística.
3. **Os 3 SPAs com shell vazio** — prerender/SSR em `pathfinder`, `matchfios`, `lumina`. Preço real:
   é mudança de build em 3 repositórios, fora deste. Não prometa indexação em troca — prometa HTML.
4. **`DEP-08` nos 11 `next`** — três headers no `next.config`. ⚠️ Se o repo tiver `next.config.js`
   **e** `.mjs`, **o `.js` vence sem warning** e os headers morrem; `ls next.config.*` separa os dois
   casos que o check não separa.
5. **15/08: remedir `D-84`** contra a tabela do §4.2.
6. **Para 20 fatos apuráveis faltam ~5, e esses exigem FONTE NOVA** — não há mais script pronto para
   ligar. Continua verdade.

## 6. O que NÃO fazer

- ❌ **Resubmeter os sitemaps.** Já foram, em 30–31/07, e o Google baixou. Resubmeter é a ação que
  parece trabalho e não muda célula nenhuma.
- ❌ **Tratar os 12 como uma fila só.** São 4 classes; 4 delas têm prognósticos incompatíveis e uma
  não tem alavanca técnica.
- ❌ **Pôr meta numérica em `Crawled - currently not indexed`.** O Google leu e recusou.
- ❌ **Medir `D-84` antes de 15/08**, nem "só para ver".
- ❌ **Descongelar a frente do detector sem responder "para quê"** (§0 e §4.3).
- ❌ **Caçar bug nos 33,6% do `roilabs.com.br`.** É de junho e o conserto já foi entregue; só um
  export novo fecha isso.
- ❌ **Confiar em contagem de texto feita com `sed` guloso** — ver §3.
- ❌ **Reescrever handoff datado** para o corpus bater com hoje.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
