# Handoff — o próximo passo NÃO é código: 4 entregas estão prontas no `main` e presas no deploy (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-geo-01-nos-7-com-trafego.md`](handoff-geo-01-nos-7-com-trafego.md)
> (`GEO-01` nos 7 com tráfego + o conserto do check que media a palavra `GPTBot`).
> Índice: [`../handoff.md`](../handoff.md).

Este documento é **especificação de trabalho, não relatório**. Assume que quem chega não tem
contexto, e onde o caminho barato e o caminho certo divergem ele defende o certo e diz o preço.

`npm test` **270 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · corpus 306 docs.

---

## 0. Leia isto antes de escolher outra coisa

**O trabalho da sessão anterior está FEITO e commitado. O que falta não se resolve editando
arquivo.** Quatro projetos têm `llms.txt` e `robots.txt` corretos no `main` do GitHub e continuam
servindo a versão velha em produção. **Reescrever, recommitar ou "melhorar" esses arquivos é o
defeito**, não o atalho — §1 diz o que medir antes de tocar em qualquer coisa.

Os itens abaixo **não são tarefa de agente** e estão abertos há 5 dias:

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago. Gerar a nova sem invalidar a velha **não é rotação, é adição**. Único item que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 3 | **As 4 chaves da Stripe do `context`** | credencial de painel |
| 4 | **Export novo do Crawl Stats do `roilabs.com.br`** | export manual da UI do GSC — é o que fecha o `D-85` de verdade |
| 5 | 🆕 **Auto-deploy de 4 serviços no EasyPanel** | painel de infra — **é o §1 desta sessão** |

🧊 **A frente do detector de defasagem continua CONGELADA por decisão (01/08).** O número que
congelou é a **precisão da lista nominal: 70%**. **Descongelar exige responder ANTES para quê.**
Descongelar por inércia é o defeito.

---

## 1. 🚩 O próximo passo: quatro deploys presos, e a evidência já está toda levantada

### 1.1 O que foi medido, e é isto que separa "não fizeram" de "não subiu"

Sete projetos receberam `llms.txt` + whitelist de crawler de IA. **Três subiram em minutos. Quatro
seguiam em 404 uma hora depois do push, na mesma plataforma e no mesmo horário.**

| projeto | repo | host | estado às 20:13 BRT |
|---|---|---|---|
| `atma` | `Atma` | `atma.roilabs.com.br` | ✅ no ar, conferido |
| `nimblabs` | `nimblabs` | `nimblabs.com` | ✅ no ar, conferido |
| `orion` | `orion-nova-ui` | `orion.roilabs.com.br` | ✅ no ar, conferido |
| **`aftercare`** | `aftercare-nimblabs` | `aftercare.nimblabs.com` | ❌ **404** |
| **`context`** | `context-keeper` | `context.nimblabs.com` | ❌ **404** |
| **`reviewshield`** | `review-dispute` | `reviewshield.nimblabs.com` | ❌ **404** |
| **`fabrica`** | `estetia-demo` | `estetia.estetiacrm.com.br` | ❌ **404** |

**As quatro hipóteses de código foram TODAS descartadas antes deste documento ser escrito.** Não
refaça esta conferência, ela já custou o tempo dela:

1. **O commit está no `main` do GitHub nos quatro** — `gh api repos/JeanZorzetti/<repo>/commits`
   devolve o commit do `llms.txt` como `HEAD`: `96db6eb`, `8b46187`, `4d47b76`, `4a2db42`.
2. **O `Dockerfile` copia `public/` nos três que usam arquivo estático** (`aftercare` linha 22,
   `estetia-demo` linha 34, `review-dispute` — a linha foi ADICIONADA na sessão anterior, porque
   faltava). O `context` não depende disso: lá o `llms.txt` é **rota**, não arquivo.
3. **Nenhum `.dockerignore` exclui `public/` nem `*.txt`.**
4. **O mesmo padrão de conserto FUNCIONOU no `nimblabs`**, que também não tinha `public/` no
   `Dockerfile` e subiu com a linha nova. O conserto está certo; ele não chegou lá.

> **Consequência: o problema está entre o `git push` e o container em execução.** Não há mais nada
> a medir do lado do repositório.

⏱️ **E não é lentidão de fila: foi medido.** Um monitor bateu nos quatro `/llms.txt` a cada minuto,
**28 verificações consecutivas entre 20:08 e 20:36 BRT, todas 404** — mais de uma hora depois do
push, e depois de os outros três já estarem no ar. Uma fila serial de build teria liberado pelo
menos um nesse intervalo. **Esperar mais não é plano.**

### 1.2 A hipótese que a própria casa já documentou, e ela é a primeira a checar

O `Dockerfile` do `nimblabs` carrega este comentário, escrito depois de um incidente real:

> `HEALTHCHECK` no Docker foi removido de propósito. EasyPanel/Swarm **trava a atualização
> em rolling update quando o container novo não fica saudável, e MANTÉM O ANTIGO SERVINDO** —
> foi assim que a produção congelou na imagem de 13/06/2026 depois do healthcheck adicionado em
> 17/06.

**Esse é exatamente o sintoma:** site respondendo 200 normalmente, conteúdo velho, nenhum erro
visível de fora. **Site no ar não prova deploy** — a mesma classe de "site em 200 não é site no
índice".

Ordem de investigação no painel do EasyPanel, da mais provável para a menos:

1. **O build rodou?** Se não há build novo, o webhook do GitHub não está ligado nesses 4 serviços —
   e aí a correção é de configuração, uma vez, por serviço.
2. **O build rodou e FALHOU?** Ler o log. O container velho continua servindo, e é por isso que
   ninguém percebe.
3. **O build passou e o container novo não ficou saudável?** É o incidente de junho se repetindo.
4. **Só então** suspeitar de cache de borda — e mesmo aí, `curl -H 'Cache-Control: no-cache'`
   decide em um comando.

⚠️ **Não redeploye "no braço" antes de saber qual dos quatro é.** Um redeploy manual que funciona
apaga a evidência e deixa os outros três serviços com o mesmo defeito latente, para reaparecer no
próximo push. **O valor aqui é a causa, não o arquivo no ar.**

### 1.3 O portão: o que precisa bater para considerar FECHADO

```
node --env-file=.env scripts/conformidade.mjs
```

| medida | agora | tem que ficar |
|---|---|---|
| `GEO-01` falhando | **25** | **21** |
| total de violações | **38** | **34** |

- **Se `GEO-01` cair ABAIXO de 21, o CHECK mudou e não o portfólio — pare e leia as linhas.** Foi
  exatamente assim que o defeito do `GPTBot` foi achado (§4).
- **Nenhum dos 21 restantes pode mudar de balde.** Esse controle passou nas duas corridas da sessão
  anterior; ele é o que separa "o conserto funcionou" de "o check inflou".
- Conferir o **CORPO**, nunca o status: `curl -sSL https://<host>/llms.txt` tem que começar em
  `# <nome do projeto>` e vir como `text/plain`. Catch-all de SPA devolve 200 com HTML.

---

## 2. Depois que os 4 subirem — a ordem, com o preço

1. **`DEP-08` nos 11 projetos `next`** — três headers no `next.config`. É o maior bloco que não
   espera o Google e fecha no mesmo dia. ⚠️ **`ls next.config.*` PRIMEIRO**: se o repo tiver `.js`
   **e** `.mjs`, o `.js` vence sem warning e os headers morrem sem erro nenhum.
2. **Os 3 SPAs que servem ZERO palavra no HTML inicial** (`pathfinder`, `matchfios`, `lumina`) —
   prerender/SSR. Preço real: **mudança de build em 3 repositórios**, fora deste. **Prometa HTML,
   nunca indexação**: `orcaobra` serve 472 palavras e continua `URL is unknown`, então shell vazio
   não explica os 12 do `D-84`.
3. **15/08/2026: remedir o `D-84`** com `node --env-file=.env scripts/dourado-estado.mjs --estado
   tudo`, lendo a lista NOMINAL. A tabela por classe está no §4.2 de
   [`handoff-proximo-passo-o-d84-e-data-nao-acao.md`](handoff-proximo-passo-o-d84-e-data-nao-acao.md).
   **`claudeloop` já tem causa nomeada e não é tarefa** — o Google escolheu o host antigo
   (`claude-loop-runner`), que está indexado e hoje devolve 308 para o novo; falta só o recrawl.
4. **`GEO-01` nos 21 restantes** — todos com **0 clique e 0 impressão**. Vem depois, e sem pressa:
   norma aplicada em massa sem leitura é como check vira enfeite.
5. **Metadata do `atma`** (card, não remendo): 10 URLs do sitemap servem o título e a description da
   home — `/contato`, os cinco `/ortodontistas/*`, `/blog` e `/blog/1`–`/blog/3`. As três últimas
   parecem rota placeholder e talvez devam sair do sitemap antes de ganhar título. É o projeto com
   **mais cliques da casa** (42 em 28 dias), então isto vale dinheiro.

---

## 3. O que a sessão anterior aprendeu e vale para a próxima decisão

**🚩 O agregado escondeu um defeito que invertia o sentido de uma norma.** O check `GEO-01` era
`/GPTBot/i.test(corpo)`. O `orion` servia `User-Agent: GPTBot` seguido de **`Disallow: /`** — o site
inteiro fora do ChatGPT — e o check lia isso como conformidade. Ao consertar, **o placar não se
mexeu: 41 violações antes, 41 depois**, porque o `orion` já falhava pela outra metade. Só a linha
mudou. **Ler as linhas, nunca o placar.**

Três defeitos de infra reutilizáveis que só apareceram porque alguém tentou SERVIR um arquivo:

- **`output: standalone` NÃO empacota `public/`.** Next espera a cópia à mão no `Dockerfile`. No
  `reviewshield` isso já era defeito vivo e invisível: **`globe.svg` respondia 404 em produção.**
- **`public/robots.txt` + `app/robots.ts` no mesmo repo**: qual vence é acidente do build, mesma
  classe do `next.config.js` derrotando o `.mjs`. No `orion` os dois **se contradiziam**.
- **`Allow: /llms.txt` é obrigatório** quando o grupo do crawler tem `Disallow: /`. Um `llms.txt`
  que a IA está proibida de buscar é enfeite.

⚠️ **`llms.txt` continua SEM consumidor medido** — é norma declarada da casa, não efeito observado.
A metade do `GEO-01` com efeito verificável é o `GPTBot`. **Não trate `llms.txt` como tráfego.**

---

## 4. O que NÃO fazer

- ❌ **Reescrever ou recommitar os `llms.txt` dos 4.** Estão certos e no `main`. O problema é deploy.
- ❌ **Redeployar no braço antes de saber POR QUE não subiu** — o redeploy que funciona apaga a
  evidência e deixa o mesmo defeito nos outros três.
- ❌ **Concluir que está no ar porque o site responde 200.** Container velho serve 200 feliz.
- ❌ **Ler o placar de `GEO-01` sem ler as linhas** (§3).
- ❌ **Reprovar política parcial de crawler**: o `reviewshield` libera só `/blog` e `/llms.txt` de
  propósito, e um check que reprovasse isso estaria opinando sobre escopo.
- ❌ **Mexer no `claudeloop`.** O 308 já está de pé; falta o Google recrawlear o host velho.
- ❌ **Resubmeter sitemap** · **medir `D-84` antes de 15/08** · **descongelar o detector sem
  responder "para quê"** · **caçar bug nos 33,6% do `roilabs.com.br`** (é de junho, o conserto já
  foi entregue, só um export novo fecha).
- ❌ **Reescrever handoff datado** para o corpus bater com hoje.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
