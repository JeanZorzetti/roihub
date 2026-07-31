# Handoff — os 15 curados; e o Atma perdeu 98% do tráfego sem ninguém ver (30/07/2026, 22h BRT)

**Curadoria do hub FECHADA: 20 → 35. Não sobra nenhum projeto não-curado.**
`mergeProjects` contra a lista real do GitHub: `CURADO: 35 · NÃO-CURADO: 0 · hosts duplicados: ZERO`,
todos os 15 casaram com o `repo` certo, `npm test` 130/130.

Receita e método vieram de [`handoff-curar-os-15.md`](handoff-curar-os-15.md).
⚠️ Não substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) — domingo
**02/08, 10:00 BRT**, 1º run do robô de crawl, segue valendo.

---

## 🚨 O achado que muda a prioridade do portfólio inteiro

**O Atma está DESINDEXADO — o site inteiro, inclusive a home — e perdeu 98% das impressões.**

Era, com folga, o maior ativo orgânico da ROI Labs: ~1.600 impressões e ~30 cliques por dia.
Hoje faz 10–20 impressões/dia. Ninguém viu porque a home responde **200** e o `checkHealth` do hub
só olha `res.ok` — a mesma armadilha dos 3 de ontem, em versão nova e mais cara.

| janela | cliques | impressões |
|---|---|---|
| 28d anteriores | **298** | **14.818** |
| 28d atuais | 43 | 316 |

**A queda tem data exata: 09/06 fechou com 1.675 impressões; 10/06, com 380.**

O que a medição fecha, em ordem:

1. **Não foi deploy.** Não existe um único commit no repo `Atma` entre 20/05 e 30/07.
2. **URL Inspection API:** home, `/pacientes/precos` e `/blog/quanto-custa-alinhador-invisivel` estão
   todos em **`Crawled - currently not indexed`**, com **último crawl em 04–05/06**. O Google
   rastreou, desindexou, e o tráfego caiu 5 dias depois.
3. **Um único post carregava o projeto:** `/blog/quanto-custa-alinhador-invisivel` fez **59.008 das
   69.494 impressões (85%)** e 791 cliques entre 01/05 e 09/06. Hoje faz 227.
4. **É desindexação, não perda de ranking** — e este é o ponto que evita caçar o bug errado: a
   **posição MELHOROU** (6,4 → 2,9) enquanto as queries que servem a página caíram de **500 para 53**.
   Ela ainda ranqueia; o Google só não a exibe mais.
5. **Descartado:** `robots.txt` libera tudo, meta robots é `index, follow`, `sitemap.xml` serve 36
   URLs, host em 200.
6. **Descartado também o crawl budget do domínio** — que era a hipótese mais bonita, porque o
   `sc-domain:roilabs.com.br` está com crawl crítico (33,6% OK) no `insights.json`. Não se sustenta:
   **`aprovai` e `links` foram rastreados HOJE e estão indexados.** O Google está rastreando
   `roilabs.com.br` normalmente — ele escolheu não voltar ao Atma.

**Próximo passo é o `acao` do card:** pedir reindexação da home e do post no Search Console.
Se em ~2 semanas não voltar, aí sim vira investigação de qualidade/conteúdo.

### ⚠️ Uma premissa do handoff anterior já estava velha em 24h

O briefing mandava o card do Atma nascer com **o Clerk como blocker**. Ele **já tinha sido removido**
— commit `726e45f` *"Remove Clerk and the patient portal from the site"*, do próprio dia 30/07. O card
teria nascido mentindo. Sobrou só resíduo de DNS (`clerk.atma…` em 301, `www.atma…` sem resolver).

---

## 📊 O estado real de índice dos 15 — só 3 estão no Google

Esta era a medição que o handoff anterior supunha que ia render "curadoria mais rica" por haver
histórico. **Rendeu o oposto, e é mais útil:** quase nada dos 15 existe para o Google.

| projeto | coverage (URL Inspection, 30/07) | último crawl |
|---|---|---|
| `aprovai` | ✅ Submitted and indexed | 30/07 21:30 |
| `roi-labs-links` | ✅ Submitted and indexed | 30/07 20:51 |
| `qprime` | ✅ Submitted and indexed | 29/07 00:48 |
| `atma` | 🚨 Crawled - currently not indexed | **04/06** |
| `vertice` | Crawled - currently not indexed | 23/05 |
| `orion` | Crawled - currently not indexed | **07/03** |
| `moderador` · `meridian` · `cyberspace` · `seo-forecaster` · `cannibal_scan` · `lumina` | Discovered - currently not indexed | **nunca** |
| `compass` · `pathfinder` | 🚨 **URL is unknown to Google** | nunca |
| `portfolio` | fora de qualquer propriedade — **por decisão** | — |

**GSC:** só `atma` (43/316 vs 298/14.818) e `orion` (0/3 vs 1/60) têm série. Os outros 13 estão em
0/0, então `seoScoreFromClicks(0,0)` devolve **2** e o `seoSeed` do JSON nunca é lido — **exceto no
`portfolio`**, que por não ter propriedade recebe `gscTrend = null` e é o **único dos 35 em que o
`seoSeed` importa de verdade**. Está em 1, que é a nota honesta de um CV.

---

## 🔎 Os outros achados que a medição entregou

- **🚨 `orion` publica `aggregateRating` FABRICADO** — 4,8 sobre **1.250 avaliações que não existem**,
  dentro do `schema.org` servido. Review falsa é violação de spam policy do Google e é punível com
  ação manual — **num subdomínio de `roilabs.com.br`**, o mesmo domínio do institucional, do goiania
  e do orcaobra. O resto acompanha: endereço falso (*Av. Paulista, 1000*), telefones placeholder
  (`+55-11-1234-5678`), `sameAs` para perfis `/orionnova` inexistentes (contraria a regra de perfis
  canônicos), e `+2.500 empresas usando` com logos de clientes fictícios na página. São **64 URLs no
  sitemap** — bastante superfície com esses dados dentro. **Não afirmo que causou a desindexação de
  07/03; afirmo que as duas coisas foram medidas e que o risco é do domínio, não do projeto.**

- **`pathfinder`: a cadeia inteira fecha sozinha.** O `robots.txt` está no ar e é caprichado, e
  termina apontando `Sitemap: …/sitemap.xml` com o comentário honesto *"served via frontend proxy"*.
  Só que o proxy está morto: **`/sitemap.xml` devolve 502 com `DNS_HOSTNAME_NOT_FOUND`**. O robots
  manda o Google buscar o sitemap, o sitemap devolve erro de DNS, e o resultado é `URL is unknown to
  Google` depois de **nove meses no ar**. É o mesmo padrão de vitrine viva sobre backend morto do
  cardiorisk/tapevision/potencialarquitetado — mas **na rota do sitemap**, então o grep de host
  NXDOMAIN nos repos *não* o pegaria. Bônus: `/rota-que-nao-existe` devolve 200 (soft-404 de SPA).

- **`vertice` tem preço público de verdade** (Starter R$ 97/mês, Pro R$ 197/mês, trial 14 dias),
  `/signup` e `/login` em 200 — e **o CTA da hero é `href="#"`**. Quem chega pela dobra e clica em
  "Começar Grátis" não vai a lugar nenhum. Mesmo padrão do matchfios, mesma nota 3. Ressalva medida:
  o "Stripe" na home é **logo da seção de integrações**, não gateway do Vértice.

- **`compass` confirmado por medição, não herdado:** `web/.env` existe e o grep de chaves `STRIPE_`
  preenchidas devolve **ZERO** — as quatro estão em branco. Somado a `URL is unknown to Google` e
  `/sitemap.xml` em 404, é o projeto no ar mais invisível e mais distante de cobrar.

- **`atma` é o único dos 15 com caminho de pagamento implementado:** infoproduto de R$ 47 com
  landing, formulário, checkout, PDF e webhook MercadoPago; a página serve 200 com o preço e a API
  devolve `400 Dados incompletos`, o que prova rota viva e validando. **Não testei a criação da
  preference** — a rota grava cliente e relatório no banco de produção *antes* de chamar o MP, então
  o teste sujaria a base real. Por isso `receita 6`, não 7.

- **`meridian` contradiz o próprio registro.** A memória do projeto o descreve como laboratório de
  **beleza** para a vaga da FitNext; o site no ar é um **SaaS financeiro em inglês** ("See every
  dollar. Own every decision."). Curei pelo que está servido. Além disso metade do nav
  (`/signin`, `/product`, `/security`) devolve **404**.

- **`qprime` é o mais sólido comercialmente dos 15** e é uma operação real: 25 anos, +300 contratos
  ativos, endereço e telefone verdadeiros no schema. Está indexado, sitemap com 13 URLs. O ponto
  aberto é estrutural: um cliente com essa idade mora em **subdomínio de `roilabs.com.br`**.

- **`cyberspace` confirmado como boilerplate puro** — `<title>Vite + React + TS</title>`, favicon
  `/vite.svg`, `lang="en"`. Deixei o `acao` como **decisão do Jean**, não tarefa: inventar trabalho de
  SEO ou receita para um projeto que ainda não existe é exatamente como card apodrece.

- **`roi-labs-links` e `lumina` nasceram com `acao` VAZIA de propósito** — como o `tapepro`. Links é
  vitrine institucional; Lumina é demonstração explícita de uma clínica que não existe, e há
  argumento para que *não* indexar seja até preferível.

---

## 📈 Ranking projetado dos 15 (com o `seo` automático que o hub calcula)

```
62  atma           ← desindexado, 98% do tráfego perdido
42  compass        ← no ar, não cobrável, invisível ao Google
39  vertice        ← preço publicado, CTA morto
37  pathfinder     ← sitemap 502, unknown to Google há 9 meses
33  orion          ← schema fabricado
29  cyberspace     ← boilerplate; decisão pendente
28  meridian       27  cannibal_scan   25  moderador
25  seo-forecaster 23  qprime          20  aprovai
17  lumina         12  roi-labs-links   7  portfolio
```

Régua de `receita` mantida igual à dos 9: **7** = fatura hoje (só `orcaobra`); **6** = caminho de
pagamento construído e vivo, sem venda provada (`atma`); **3** = preço público sem caminho até o
dinheiro (`vertice`, `compass`, `qprime`); **2** = produto comercial sem preço nem cobrança;
**0–1** = dev tool, demo, vitrine, CV, boilerplate.

### ⚠️ Um defeito da régua que apareceu e que eu NÃO consertei

O critério `seo` é *"tração acontecendo = merece atenção"*, então **um projeto que desaba ganha nota
BAIXA**: o Atma tirou **0,7** justamente por ter colapsado, e o orion tirou **0**. No Atma isso foi
compensado à mão pelo `decay 10`, mas a régua está empurrando para baixo exatamente o projeto que
mais precisa do Jean. Mexer nos pesos é decisão do Jean, não da curadoria — fica registrado.

---

## ⛔ O que continua valendo

- **Não curar pelo status da home.** Desta vez o 200 escondeu um projeto inteiro fora do índice.
- **Não grepar por nome de env var** — falso negativo comprovado.
- **Validar corpo, não status:** `/sitemap.xml` do pathfinder responde e o corpo é uma página de erro.
- **Zero arquivamentos** — decisão do Jean, tomada e reafirmada. Não relitigar.
- ⚠️ Janela de não-push **00:00–01:00 BRT** (cron do autopublishing às 00:13). Esta sessão fechou
  antes disso, pela hora local da máquina — `TZ=America/Sao_Paulo` no Git Bash devolve UTC e engana.
