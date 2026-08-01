# Handoff — a frente do detector foi CONGELADA, e o §6 não devolveu nenhum check quebrado (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-proximo-passo-a-lista-nominal-tem-30-de-ruido.md`](handoff-proximo-passo-a-lista-nominal-tem-30-de-ruido.md)
> (a lista nominal tem 30% de ruído — a decisão que ela pedia foi tomada e está abaixo).
> Índice: [`../handoff.md`](../handoff.md) · leitura desta sessão:
> [`../docs/estado-conformidade-crawl-2026-08-01.md`](../docs/estado-conformidade-crawl-2026-08-01.md).

---

## 0. A ESCOLHA, que o handoff anterior mandou escrever aqui no topo

> ## 🧊 **A frente do detector de defasagem está CONGELADA.**
> Decisão de 01/08, tomada pelo Jean com o custo na mesa. **Não é pausa por falta de ideia** — a
> ideia seguinte (§3.1 do handoff anterior, o exemplo para a regra do passado datado) continua
> escrita, barata e não tentada. A frente parou porque **o produto dela custa mais do que entrega
> hoje**.

O número que decidiu: **precisão da lista nominal = 70%**. Dez `desmente` emitidos no holdout de 15
fatos, sete corretos. Cada linha da lista é uma edição de memória ou handoff, então **3 de cada 10
linhas mandam editar o que está certo** — e a leitura humana de 31/07 já tinha dado 62,5%. Duas
medições independentes, ~2/3.

O que fechou a conta, do handoff anterior: 18 commits, ~19 h, 105 documentos julgados,
**~7 defeitos reais de corpus e 3 deles eram a MESMA memória**. Contra isso,
**`scripts/validade.mjs` acha memória podre melhor** — zero LLM, zero pool, segundos, dentro do
`npm test`, e impede o defeito de NASCER em vez de caçá-lo depois.

⚠️ **Para descongelar, responda ANTES para quê.** As duas respostas legítimas são diferentes:

| se o objetivo for… | então |
|---|---|
| **publicar uma taxa de erro do corpus** | descongele: sem os dois portões o número não vale, e não há atalho. Comece pelo §3.1 do handoff anterior |
| **achar memória podre para consertar** | **não descongele** — o `validade.mjs` já faz, mais barato e mais cedo |

**Descongelar por inércia é o defeito.** A frente já foi congelada uma vez por teto de material e
descongelada porque o material dobrou; desta vez o motivo é o INSTRUMENTO, e material novo não o
conserta. Registrado em `CLAUDE.md`, seção "Taxa de erro do corpus".

**Nada foi apagado.** Fixtures, holdout de 80 casos, adversarial, `--duas-passadas`, os dois portões
e os docs de calibração continuam no repo e continuam verdes. Congelar é parar de gastar pool nela,
não desmontá-la.

---

## 1. Leia isto antes de escolher outra coisa

Os itens abaixo **não são tarefa de agente** e estão abertos há 4 dias. Continuam aqui para não
serem silenciosamente pulados nem "contornados":

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago, sua mão. Gerar a nova sem invalidar a velha **não é rotação, é adição**. É o único item da casa que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 3 | **As 4 chaves da Stripe do `context`** | credencial de painel |

**Contornar qualquer um deles é o defeito**, não o atalho.

---

## 2. O que esta sessão fez com o resto: o §6, lido item a item

`npm test` **269 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo. Zero LLM e zero
pool nesta sessão inteira — nenhuma das três verificações abaixo gasta chamada.

**Resultado curto: os três checks estão certos, e é a primeira vez em oito leituras de primeira
corrida nesta base que nenhum precisou de conserto.** A explicação não é sorte: os três já rodavam
como script antes de virarem fato apurável, então a "primeira corrida" deles foi a **agregação**,
não a medição — exatamente o que o handoff anterior previu ao dizer "a novidade é só a agregação".

| # | número | check | virou tarefa? |
|---|---|---|---|
| `D-83` | `GEO-01` 28/35 · `DEP-08` 11/15 | **certo**, conferido fora do script | **sim**, e é cara |
| `D-84` | 12 de 34 homes fora do índice | **certo**, e corrige a prosa do handoff velho | **sim**, e é a barata |
| `D-85` | OK 33,6% no `roilabs.com.br` | **certo**, e o número é de junho | **não** — já consertado |

Detalhe completo em [`../docs/estado-conformidade-crawl-2026-08-01.md`](../docs/estado-conformidade-crawl-2026-08-01.md).

### 2.1 `D-83` — os dois placares são reais, e um deles é PISO

41 violações em 35 projetos. Número grande é o formato de um check quebrado (`repo` sem o dono deu
404 em 35 de 35), então os dois maiores foram conferidos **fora do script**, com `curl` à mão em 4
hosts cada. Os dois passaram:

- **`GEO-01` (28 falham):** `llms.txt` devolve 404 servindo o HTML da SPA — é a razão de o check
  julgar o CORPO, como o `VER-02`. O `orion` acusa **"sem llms.txt" apenas**, sem a metade do
  GPTBot, o que prova que o check separa as duas faltas em vez de reprovar por atacado.
- **`DEP-08` (11 falham):** `curl -sSL -D -` em `compass`, `vertice`, `orion` e `verticemarketing`
  devolve 200 e **nenhum** dos três headers.

⚠️ **Dois cuidados de leitura, os dois no lado de não inflar:**
**os 28 são PISO** — a falta de GPTBot só é acusada quando o `robots.txt` existe (`!ctx.robots.erro`),
então host sem robots nenhum passa batido; e **`DEP-08` é 11 de 15 projetos `next`**, nunca "11 de
35", porque os 20 `n/a` são "não é next" e `n/a` não é aprovação.

**Não virou edição neste repo de propósito:** o conserto de `GEO-01` são 28 repositórios e o de
`DEP-08` são 11. Ficam nomeados.

### 2.2 `D-84` — a correção do handoff anterior confere

22 de 34 homes inspecionáveis no índice. A apuração viva confirma, item por item, a correção que o
handoff anterior já registrava: **`lumina` está em `Discovered - currently not indexed`**, não em
`URL is unknown to Google`, e os `URL is unknown` são **dois** — `orcaobra` e `pathfinder`.

`portfolio` fica fora do denominador com razão: mora em `*.vercel.app`, host de fornecedor que fica
fora de toda propriedade do GSC. **"Sem propriedade" não é "fora do índice", é "não há onde olhar"** —
falta de domínio próprio, não sinal de SEO. Por isso 34 e não 35.

**É a tarefa mais barata das três:** 6 dos 12 estão em `Discovered - currently not indexed`, estado
que responde a link interno e sitemap, não a conserto de código.

### 2.3 `D-85` — datar dissolveu o achado

O 33,6% parecia a pior coisa da casa: o host com mais crawl (2596 req) e a pior taxa de OK. A
`ressalva` manda datar antes de caçar bug, e datar bastou.

**Não é 404 nem 5xx** (5xx é 0,02%): **53,5% do crawl é DNS error**, e o `File type` fecha pelo
outro lado com 60,7% de "Unknown (failed requests)". Mais da metade morreu antes de chegar a um
servidor. O export é de **25/07 e cobre 90 dias** — janela que engole inteira a limpeza NXDOMAIN
dos subdomínios aposentados, que **`scripts/cloudflare-redirects.mjs` já fechou**.

Conferido host a host hoje: **os 19 da `Hosts table.csv` resolvem, 17 servem** (14 aposentados dão
301 para o sucessor, 8 dão 200, 2 dão 307 para `/admin`). Sobram duas falhas —
`www.sirius.roilabs.com.br` (698 req) e `www.goiania.roilabs.com.br` (4 req) — e as duas são
**handshake TLS por construção**: o cert Universal da Cloudflare cobre apex + **um** label.
`cloudflare-redirects.mjs:164` já documenta isso e `DNS-05` as exclui pelo mesmo motivo. Conserto é
ACM pago, contra 702 requisições em hosts que ninguém digita. **Registrado, não agendado.**

---

## 3. O que fazer na próxima sessão

Em ordem de preço, e nenhuma delas é a frente do detector:

1. **`D-84`, os 6 `Discovered - currently not indexed`** — é a tarefa mais barata que sobrou e a
   única com efeito direto em tráfego. ⚠️ **Site em 200 não é site no índice**, e só a URL Inspection
   decide; `scripts/inspect-url.mjs` já roda. Reindexação leva ~14 dias para o tráfego reagir, então
   medir no dia seguinte não diz nada.
2. **`GEO-01` num punhado de projetos, não nos 28.** `llms.txt` + GPTBot no `robots.txt` é o
   playbook GEO/AEO da casa. Comece pelos que já têm tráfego (os 7 que passam mostram o formato);
   fazer 28 de uma vez é como o check vira enfeite.
3. **Export novo do Crawl Stats do `roilabs.com.br`.** Uma corrida diria se os 33,6% viraram os
   ~95% dos vizinhos, e é a única coisa que fecha o `D-85` de verdade. É export manual da UI do
   Search Console — sua mão, não do agente.
4. **`D-83`/`DEP-08` nos 11 `next`** — três headers no `next.config`. ⚠️ Se o repo tiver
   `next.config.js` **e** `.mjs`, o `.js` vence sem warning e os headers morrem; `ls next.config.*`
   separa os dois casos que o check não separa.
5. **Para 20 fatos apuráveis faltam ~5, e esses exigem FONTE NOVA** — não há mais script pronto
   para ligar. Continua verdade.

## 4. O que NÃO fazer

- ❌ **Descongelar a frente do detector sem responder "para quê"** (§0). Material novo não conserta
  instrumento; o que congelou foi a precisão de 70%, não a falta de casos.
- ❌ **Caçar bug nos 33,6% do `roilabs.com.br`.** É junho, e o conserto está entregue. Se o número
  reaparecer num export novo, aí sim.
- ❌ **Ler "28 de 35" como se fosse teto.** É piso — ver §2.1.
- ❌ **Contar `n/a` como aprovação.** `DEP-08` é 11 de 15, não 11 de 35.
- ❌ **Publicar percentual de defasagem**, inclusive o 16,7%. Os dois portões reprovam e continuam
  reprovando com a frente congelada.
- ❌ **Reescrever handoff datado** para o corpus bater com hoje.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
