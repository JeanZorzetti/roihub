# Handoff — próximo passo: o Sirius (criado 31/07/2026, 08h BRT)

**O próximo passo é UM projeto: o `sirius`.** É o mais bem colocado do ranking entre os que uma
sessão de código resolve (score 45; o `atma`, 51, agora é espera, e o `goiania`, 44, é painel do
Bing). Tem gate datado — **31/08** — e a agulha está a **3 cliques** de distância.

Estado anterior: [`handoff-atma-reindexado.md`](handoff-atma-reindexado.md) (frente do Atma
encerrada). Índice geral: [`../handoff.md`](../handoff.md).

⚠️ Isto **não** substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) —
domingo **02/08, 10:00 BRT**, 1º run do robô de crawl, segue valendo e não depende de sessão.

---

## O gate, em 3 linhas

- **31/08: ≥ 5 cliques não-branded / 28d.** Hoje são **2**.
- 28d atuais: **7 cliques / 633 impressões**. 28d anteriores: **6 / 228** — impressões **+178%**.
- Dos 7 cliques, **5 são `sirius crm`** (branded). Os 2 não-branded vieram todos de **`agaas`**.

O card estava certo e continua válido. O que mudou é que agora há **medição por query, país e
página** — e ela diz que o caminho para os 3 cliques que faltam **não** é o que o card sugere.

---

## 🚨 Os 3 achados que mudam o plano (GSC, medido 31/07, janela 30/06–28/07)

### 1. `agaas` não é query brasileira — e isso muda o que fazer com ela

| país | cliques | impressões | posição |
|---|---|---|---|
| usa | **1** | 23 | 9,5 |
| rwa | 0 | 10 | 8,3 |
| fra | 0 | 7 | 10,7 |
| can | 0 | 6 | 7,7 |
| **bra** | 0 | **5** | 7,6 |
| aus | **1** | 4 | 8,8 |

**85 impressões, e só 5 são do Brasil.** A posição 8,1 do card é média global
([[gsc_branded_position_polluted_by_country]] vale aqui também: sem quebrar por país, a leitura
engana). Os 2 cliques não-branded do portfólio vieram de **AUS e USA**.

Quem ranqueia é **`/en/blog/agentes-ia-vs-saas-tradicional`** — página em inglês
(*"AgaaS vs Traditional SaaS: Why AI Agents Are the Future of CRM in 2026"*) **com slug em
português**. Ela já está na página 1 de um público internacional; o trabalho aqui é de **CTR**, não
de posição.

### 2. Duas canibalizações medidas, com a causa confirmada no HTML servido

**`crm roi` — 72 impressões partidas em duas URLs:**

| página | impressões | posição | título |
|---|---|---|---|
| `/blog/roi-de-crm` | 28 | **24,3** | "ROI de CRM: Como Calcular e Justificar o Investimento em 2026" |
| `/ferramentas/calculadora-roi-agencias` | 45 | **44,0** | "Calculadora de ROI para Agências de Marketing" |

A página que **casa** com a intenção ranqueia melhor e recebe **menos** impressão que a que não
casa. Não é conteúdo duplicado: são duas URLs disputando a mesma query, e a errada leva a maior
fatia.

**`crm solar` — 69 impressões partidas entre PT e EN:**

| página | impressões | posição |
|---|---|---|
| `/solucoes/energia-solar` | 58 | 39,2 |
| `/en/solutions/energia-solar` | 11 | 51,3 |

**Causa confirmada, não suposta:** as duas páginas servem **zero `hreflang`** e cada uma é
`canonical` de si mesma (conferido por `curl` no HTML servido, 31/07). Ou seja, nada diz ao Google
que são a mesma página em dois idiomas — elas competem de verdade. E o slug da versão EN também está
em português (`/en/solutions/energia-solar`).

### 3. O volume não está no `agaas` — está num cluster solar em pt-BR, todo na página 3–4

Todas essas queries são servidas por **uma única página**, `/solucoes/energia-solar`:

| query | impressões | posição |
|---|---|---|
| `crm solar` | 69 | 41,1 |
| `crm para industria energetica` | 29 | 26,7 |
| `crm energia` | 11 | 31,9 |
| `crm energia solar` | 11 | 27,5 |
| `crm empresas energia solar` | 9 | 27,8 |
| `crm solar vitória da conquista` | 9 | 36,0 |
| `crm para energia solar` | 5 | 29,8 |

**~215 impressões**, contra 85 do `agaas` — mas em posição 26–41, ou seja, página 3 e 4. Volume real,
distância real.

---

## ▶️ O que fazer, na ordem (do mais barato ao mais lento)

**Repo: `sirius`** (`JeanZorzetti/sirius`, último push 25/07). ⚠️ **Não tem clone local** — a pasta
`ROI Labs\AGI_Sirius` é outra coisa (agency/vertice-agi) e nem repo git é. Precisa `git clone` antes.

1. **`hreflang` no par PT/EN** — o menor diff, e mata a canibalização (2) na raiz. Fazer no lugar
   sistêmico (o `alternates.languages` do metadata do Next), não página a página: o problema é do
   `/en` inteiro, e hoje **não existe uma única ocorrência de `hreflang` ou `alternates` no
   projeto**. Enquanto não existir, toda página nova em EN nasce competindo com a irmã em PT.
2. **Decidir quem é dono de `crm roi`.** O default razoável: o post `/blog/roi-de-crm` fica com a
   query genérica (já ranqueia 20 posições melhor) e a calculadora se estreita para o que ela é —
   *agências de marketing* — em `<title>`, H1 e conteúdo, com link interno do post para ela. Fazer
   antes de escrever qualquer conteúdo novo de ROI.
3. **CTR do `agaas`.** A página já é página 1 lá fora e converteu 2 cliques. Título e meta description
   escritos para a intenção real (aparece `agaas meaning` nas queries) valem mais que qualquer ganho
   de posição. Trocar o slug PT por um em inglês **só com redirect 301** — sem isso, joga fora a
   única página que traz clique não-branded.
4. **Só então o cluster solar.** É o volume (215 imp), mas está em posição 26–41: é trabalho de
   conteúdo, não de ajuste, e depende do passo 1 para não continuar competindo consigo mesmo.

**Como medir:** cliques **não-branded** em 28d (hoje 2, gate 5 em 31/08) — não impressão, que já está
subindo sozinha (+178%) sem virar clique. Por query e **quebrado por país**, sempre.

---

## ⛔ O que não fazer

- **Não ler a posição do `agaas` como ranking no Brasil.** É média de 8 países; o BR são 5 das 85
  impressões ([[gsc_branded_position_polluted_by_country]]).
- **Não escrever conteúdo novo para o cluster solar antes do `hreflang`** — sem ele, cada página nova
  em EN vira mais um concorrente da própria PT.
- **Não trocar o slug do `/en/blog/agentes-ia-vs-saas-tradicional` sem 301.** É a única página do
  projeto que gera clique não-branded.
- **Não mexer nos pesos do `lib/score.mjs`** — decisão do Jean, e o defeito conhecido do critério
  `seo` continua registrado, não consertado.
- **Não baixar o `decay 10` do `atma`** antes de a série de impressões reagir (~14 dias, reconferir
  por volta de **14/08**). A causa saiu; o efeito ainda está nos números.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing às 00:13). Usar a hora local da
  máquina — `TZ=America/Sao_Paulo` no Git Bash devolve UTC e engana.
- ⚠️ **Push não é deploy em todo projeto.** Antes de dar entrega por fechada, conferir se o projeto
  publica sozinho: o `pathfinder` não publica ([[vercel_project_not_linked_to_git]]).
- **Fechar entrega = atualizar o card no `data/projects.json` + push.**

## Ainda de pé, e não depende desta frente

- **Domingo 02/08, 10:00 BRT — 1º run do robô de crawl**
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **`pathfinder`: o backend continua morto** (`/api/*` → NXDOMAIN). A descoberta foi consertada em
  30/07, o produto não.
- **Compass, Etapas 2 e 3** — painel de terceiro (GitHub OAuth, Resend, Stripe), sem código a
  escrever.
