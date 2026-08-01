# Handoff — `GEO-01` nos 7 com tráfego, e o check media a PALAVRA `GPTBot`, não a permissão (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-proximo-passo-o-d84-e-data-nao-acao.md`](handoff-proximo-passo-o-d84-e-data-nao-acao.md)
> (as quatro classes do `D-84`; §5 executado nos itens 1 e 2). Índice: [`../handoff.md`](../handoff.md).

`npm test` **270 verdes** (era 269; +1 é o teste do conserto abaixo) · `npx tsc --noEmit` limpo.

---

## 0. O que fechou, o que espera build, o que continua aberto

| # | o que | estado |
|---|---|---|
| 1 | **`claudeloop`** (§5.2 do handoff anterior) | ✅ **diagnóstico FECHADO** — §2 |
| 2 | **`GEO-01` nos 7 com tráfego** (§5.1) | ✅ commitado e pushado nos 7 repos; ⏳ **espera o build** — §3 |
| 3 | **Conserto do check `GEO-01`** | ✅ no `npm test` — §1 |
| 4 | Os 4 itens que **não são tarefa de agente** (token do MP, `:5434`, Stripe, export do Crawl Stats) | ❌ abertos há 5 dias — §0 do handoff anterior, inalterado |

⏳ **A verificação de §3 ainda NÃO foi feita**, e ela é o portão de entrega: os 7 sites respondiam
`404` em `/llms.txt` no momento em que este documento foi escrito, minutos depois do push. **Rodar
`node --env-file=.env scripts/conformidade.mjs` e ler as LINHAS antes de dar por fechado** — §3.3
diz exatamente o que tem que aparecer.

---

## 1. 🚩 O achado que ordena esta sessão: `GEO-01` aprovava quem BARRAVA o GPTBot

O check era uma linha:

```js
if (!ctx.robots.erro && !/GPTBot/i.test(ctx.robots.corpo)) faltas.push("robots.txt sem GPTBot");
```

O `orion` passava nessa metade. O `robots.txt` dele servia, em produção:

```
User-Agent: GPTBot
Disallow: /
```

**O site inteiro opt-out do ChatGPT, e o check lendo isso como conformidade** — junto com
`ChatGPT-User`, `CCBot`, `anthropic-ai` e `Claude-Web`, todos com `Disallow: /`. Grep mede a
palavra, não a permissão: **a mesma classe do "palavra ≠ URL" do `gateways.mjs`**, oitava vez nesta
base.

### 1.1 O agregado escondeu, e isso é o mais importante daqui

`GEO-01` marcava **28 de 35 antes e 28 de 35 depois**; o total de violações ficou em **41 nos dois
lados**. Nada no placar se moveu, porque o `orion` já falhava por `llms.txt` — **só a linha mudou**:

```
- FALHA  GEO-01  sem llms.txt
+ FALHA  GEO-01  robots.txt BARRA o GPTBot (Disallow: /) · sem llms.txt
```

Um defeito que inverte o sentido do check não apareceu em número nenhum. **Ler as linhas.**

### 1.2 `barrado` é bloqueio TOTAL, e a fronteira é deliberada

`julgarGptbot()` devolve três estados — `ausente`, `barrado`, `permitido`. **`barrado` exige
`Disallow: /` sem nenhum `Allow:` no grupo.** O `reviewshield` serve, de propósito, `Allow: /blog`
+ `Disallow: /` para os crawlers de IA: é política parcial, decisão do projeto. **Um check que
reprovasse isso estaria opinando sobre escopo, não medindo a norma** — e um check que opina sai da
lista na primeira sexta-feira.

Grupo de `robots.txt` é `User-agent:` consecutivos + as regras que os seguem: `User-agent: GPTBot`
logo abaixo de `User-agent: CCBot` é **um** grupo, e as regras valem para os dois. Há teste para
isso, para comentário no meio da linha e para `Disallow:` vazio (que é "libera tudo").

### 1.3 O controle obrigatório passou

Regra do §4.1 do handoff anterior: **nenhum projeto NÃO TOCADO pode mudar de balde.** Rodadas antes
e depois, comparadas linha a linha: **exatamente um projeto mudou (`orion`), e é o que o conserto
visava.** Nada mais se moveu.

---

## 2. `claudeloop`: causa nomeada, conserto JÁ no ar, nada a fazer

Era a classe `Duplicate, Google chose different canonical` — 1 dos 12 do `D-84`, e a única das
quatro com causa determinística. **A URL que o Google escolheu:**

```
https://claudeloop.roilabs.com.br/     → canonicalGgl: https://claude-loop-runner.roilabs.com.br/
https://claude-loop-runner.roilabs.com.br/ → PASS · Submitted and indexed · lastCrawl 30/07 21:45
```

**O conteúdo não está fora do índice: está indexado sob o host ANTIGO.** E o conserto já está de pé
— `claude-loop-runner.roilabs.com.br` devolve **308 para `claudeloop`**, e o host novo declara o
canonical certo. O que falta é o Google recrawlear o host velho: a última visita dele foi **30/07
21:45**, antes do redirect, e por isso ele ainda se acha canônico.

> **Não é tarefa.** É a mesma espera datada do resto do `D-84`. Se em **15/08** o `claudeloop` ainda
> estiver `Duplicate`, aí sim há o que caçar.

`scripts/inspect-url.mjs` agora imprime `canonicalUsr` e `canonicalGgl` — sem eles o `coverage` diz
que houve uma escolha e esconde QUAL, que é o diagnóstico inteiro.

---

## 3. `GEO-01` nos 7 com tráfego

### 3.1 Por que 7, e por que estes

O handoff anterior mandava "comece pelos que já têm tráfego" e "não faça os 28 de uma vez". Tráfego
medido no GSC, 28 dias, `dimensions: []` (a dimensão `query` omite as raras e a soma vira piso):

| projeto | cliques | impressões | o que faltava |
|---|---|---|---|
| `atma` | **42** | 305 | GPTBot + llms.txt |
| `aftercare` | 0 | **1626** | GPTBot + llms.txt |
| `nimblabs` | 0 | 408 | GPTBot + llms.txt |
| `context` | 0 | 119 | GPTBot + llms.txt |
| `reviewshield` | 0 | 81 | só llms.txt |
| `fabrica` | 0 | 24 | GPTBot + llms.txt |
| `orion` | 0 | 3 | **BARRAVA** o GPTBot + llms.txt |

**Os outros 21 que falham `GEO-01` têm 0 clique E 0 impressão.** O corte não é arbitrário: é onde a
norma tem chance de virar citação. `atma` é o projeto com mais cliques da casa inteira.

### 3.2 🚩 Três defeitos de INFRA que o `llms.txt` só desenterrou

Escrever o arquivo era a parte fácil. Em três dos sete ele teria **404 em produção passando local**:

1. **`output: standalone` NÃO empacota `public/`** — Next espera a cópia à mão. `nimblabs` e
   `reviewshield` copiavam só `.next/standalone` e `.next/static`. No `reviewshield` isso já era
   defeito vivo: **`globe.svg` respondia 404 em produção**, ninguém tinha percebido. Conserto = uma
   linha de `COPY` no Dockerfile, e ela vale para todo asset futuro.
2. **`context` nem com a cópia serviria**: é monorepo e o `server.js` roda de `apps/web/`. Ali o
   `llms.txt` virou **rota** (`app/llms.txt/route.ts`), e o matcher do middleware Auth0 passou a
   excluí-lo, pelo mesmo motivo que já excluía `robots.txt` e `sitemap.xml`.
3. **`robots.txt` DUPLICADO em `public/` e em `app/robots.ts`** no `aftercare` e no `orion`. Qual
   vence é acidente do build — **mesma classe do `next.config.js` derrotando o `.mjs` sem warning**.
   No `orion` os dois se **contradiziam**: o de `public/` liberava todo mundo, o `.ts` barrava a IA,
   e quem estava no ar era o `.ts`. Fonte única nos dois.

⚠️ **O `reviewshield` precisou de mais uma coisa:** a regra dele é `Disallow: /` com exceção para
`/blog`. **Um `llms.txt` que os crawlers de IA estão proibidos de buscar é enfeite** — entrou
`Allow: /llms.txt` junto.

### 3.3 O portão de entrega: **3 de 7 verificados em produção, 4 presos no build**

```
node --env-file=.env scripts/conformidade.mjs
```

**Medido às 20:10 BRT de 01/08, contra a corrida de referência da mesma sessão:**

| | antes | agora |
|---|---|---|
| `GEO-01` falhando | 28 | **25** |
| total de violações | 41 | **38** |

Diff NOMINAL, que é o que decide: **sumiram exatamente `atma`, `nimblabs` e `orion` — os três que
subiram — e ZERO violação nova apareceu.** Nenhum projeto não-tocado mudou de balde. O controle do
§4.1 do handoff anterior passou nas duas corridas desta sessão (a do conserto do check e esta).

Corpo conferido host a host, nunca o status (`spa_sitemap_200_is_not_proof`): os três servem
`text/plain` começando em `# <nome do projeto>`, e o `robots.txt` do `orion` agora traz os 12
crawlers de IA com `Allow: /` no lugar do `Disallow: /`.

> 🚩 **Faltam 4, e a causa NÃO é o repositório: é o deploy.** `aftercare`, `context`,
> `reviewshield` e `estetia` seguiam em **404 quarenta minutos depois do push**, enquanto `atma`,
> `nimblabs` e `orion` — mesma plataforma, mesmo horário — subiram em minutos. Commit e push estão
> feitos e conferidos nos quatro. **Próximo passo é olhar o auto-deploy desses quatro serviços no
> EasyPanel**, não mexer no código: os arquivos que faltam estão no `main` de cada repo.
>
> Quando subirem, `GEO-01` tem que fechar em **21**. **Se cair abaixo de 21, o CHECK mudou e não o
> portfólio: pare e leia as linhas.**

### 3.4 O que os `llms.txt` dizem, e por que não são link dump

Cada um tem uma seção **"como citar este site"** com as afirmações que um motor de resposta erra
sobre aquele produto — apuradas do próprio site, não inventadas:

- `atma`: preço é **faixa por complexidade** (R$ 3.990 / 5.990 / 8.990), e a Atma **não vende
  direto ao paciente** — a compra é com o ortodontista parceiro. Resposta que manda comprar no site
  está errada.
- `reviewshield`: remove review que **viola política do Google**, não review negativo legítimo — e
  nenhum serviço honesto remove.
- `estetia`: vende **site e automação**, não é clínica; e publicidade em saúde no Brasil não
  permite promessa de resultado.
- `orion`: é **ERP + CRM na mesma plataforma**; as soluções por segmento são configurações do mesmo
  produto, não produtos com preço próprio.

⚠️ **`llms.txt` continua sem consumidor medido** — é norma declarada da casa, não efeito observado.
A metade do `GEO-01` que tem efeito verificável é o `GPTBot`. **Não trate o `llms.txt` como
tráfego.**

---

## 4. Achado lateral que NÃO foi consertado (de propósito)

O `atma` serve **o mesmo `<title>` e a mesma `<meta description>` da home** em `/contato`, nos
cinco `/ortodontistas/*`, em `/blog` e em `/blog/1`, `/blog/2`, `/blog/3` — 10 URLs do sitemab sem
metadata própria. É defeito real de SEO e está **fora do escopo do `GEO-01`**; entra como card, não
como remendo de passagem. `/blog/1`–`/blog/3` parecem rota placeholder e talvez devessem sair do
sitemap antes de ganhar título.

---

## 5. A ordem sugerida daqui

1. **Verificar §3.3 quando o build subir.** É o que fecha esta entrega. Nada mais.
2. **`DEP-08` nos 11 `next`** — três headers no `next.config`, item 4 do handoff anterior, ainda de
   pé. ⚠️ `ls next.config.*` primeiro: se houver `.js` **e** `.mjs`, o `.js` vence sem warning.
3. **Os 3 SPAs com shell vazio** (`pathfinder`, `matchfios`, `lumina`) — mudança de build em 3
   repos. Prometa HTML, nunca indexação.
4. **15/08: remedir `D-84`** contra a tabela do §4.2 do handoff anterior. `claudeloop` já tem causa
   nomeada (§2); o que se olha é se ele saiu do estado.
5. Os 21 projetos sem tráfego que faltam em `GEO-01` — **depois**, e sem pressa: norma aplicada em
   massa sem leitura é como check vira enfeite.

## 6. O que NÃO fazer

- ❌ **Ler o placar de `GEO-01` sem ler as linhas.** O defeito do §1 não moveu um número sequer.
- ❌ **Concluir que o `llms.txt` falhou porque deu 404 hoje** — o build ainda não tinha subido.
- ❌ **Reprovar política parcial de crawler** (o `reviewshield` escolheu liberar só `/blog`).
- ❌ **Mexer no `claudeloop`.** O 308 já está de pé; falta o Google recrawlear o host velho.
- ❌ **Resubmeter sitemap**, **medir `D-84` antes de 15/08**, **descongelar o detector sem dizer
  para quê** — tudo do §6 anterior continua valendo.
- ❌ **Deixar `public/robots.txt` e `app/robots.ts` no mesmo repo.** Fonte única, sempre.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
