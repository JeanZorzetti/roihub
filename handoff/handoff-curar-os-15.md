# Handoff — próximo passo: curar os 15 projetos restantes (criado 30/07/2026, 22h BRT)

Os 9 subdomínios renomeados foram curados e estão em `data/projects.json`
([`handoff-renomear-subdominios-executado.md`](handoff-renomear-subdominios-executado.md)).
**Curados: 11 → 20. Faltam 15.**

⚠️ Isto **não** substitui [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) —
domingo **02/08, 10:00 BRT**, 1º run do robô de crawl, segue valendo. Índice:
[`../handoff.md`](../handoff.md).

---

## 🚨 Leia isto antes de escrever a primeira nota

**Card curado com premissa não verificada apodrece** — é o padrão de falha já registrado do hub, e
a curadoria é exatamente onde ele nasce. A regra desta leva: **nenhum número entra sem uma medição
que você rodou nesta sessão.**

E a medição que importa **não é o status da home**. Em 30/07, 3 dos 9 curados (`cardiorisk`,
`tapevision`, `potencialarquitetado`) respondiam **200** com o produto 100% quebrado: o frontend
chama uma API cujo host é NXDOMAIN. O `checkHealth` do hub faz `fetch` na URL do site e olha
`res.ok`, então os três entravam no ranking como **saudáveis**.

### O grep certo — e o que NÃO funciona

Procurar pelo **nome da env var** dá falso negativo. Testado ao vivo: no `atma`, que tem API real,
o grep por `VITE_API_URL|NEXT_PUBLIC_API_URL|API_BASE_URL` voltou **vazio**, porque o nome varia,
às vezes é default hardcoded e às vezes mora em `.env` não versionado.

O que funciona é grepar **qualquer URL absoluta dos domínios próprios** e bater `curl` em cada host
que sair:

```bash
git -C "$repo" grep -hIoE "https://[a-z0-9.-]+\.(roilabs\.com\.br|nimblabs\.com|polarisia\.com\.br|estetiacrm\.com\.br)" -- . \
  | sed 's|https://||' | sort -u \
  | while read h; do
      c=$(curl -s -o /dev/null -w "%{http_code}" --max-time 12 "https://$h/")
      [ "$c" = "000" ] && echo "🚨 $h NÃO RESOLVE"
    done
```

`http=000` = NXDOMAIN = produto morto com vitrine viva. **Já rodei isso nos 15: nenhum tem o
problema.** Detalhe abaixo — não precisa refazer, mas o método serve pra qualquer projeto futuro.

---

## 📋 Os 15, com o que já está medido

Todos responderam **200** em 30/07 22h. Último push e título servido conferidos no mesmo momento.

| slug | url | push | título servido |
|---|---|---|---|
| `Atma` | atma.roilabs.com.br | 30/07 | Atma Aligner — Alinhadores Invisíveis com Tecnologia Alemã |
| `aprovai` | aprovai.roilabs.com.br | 30/07 | AprovAI — análise cadastral de locação que nasce no Whats… |
| `moderador` | moderador.roilabs.com.br | 30/07 | Moderador — resumo do grupo de WhatsApp quatro vezes por dia |
| `meridian` | meridian.roilabs.com.br | 30/07 | Meridian — See every dollar. Own every decision. |
| `seo-forecaster` | seoforecaster.nimblabs.com | 30/07 | SEO Forecaster — o termo antes do volume de busca |
| `cannibal_scan` | cannibalscan.nimblabs.com | 30/07 | CannibalScan — find the pages competing with each other |
| `roi-labs-links` | links.roilabs.com.br | 30/07 | ROI Labs - Links |
| `aesthetic-perfection-page` | lumina.estetiacrm.com.br | 30/07 | Lumina (demonstração) — Site-modelo ROI Labs para clínicas |
| `cyberspace` | cyberspace.roilabs.com.br | 30/07 | **`Vite + React + TS`** ← boilerplate |
| `compass` | compass.polarisia.com.br | 29/07 | Compass — Know before you hit the AI limit |
| `orion-nova-ui` | orion.roilabs.com.br | 29/07 | Orion Nova — Sistema Completo de Gestão Empresarial |
| `qprime` | qprime.roilabs.com.br | 28/07 | QPrime — Outsourcing de impressão para empresas \| Goiânia |
| `portfolio` | portfolio-three-mu-…vercel.app | 26/07 | Jean Zorzetti — Full-Stack Engineer, AI-augmented |
| `vertice` | vertice.roilabs.com.br | **03/03** | Vértice – Automated Client Onboarding |
| `pathfinder` | pathfinder.roilabs.com.br | **23/10/25** | Pathfinder — Descubra seu Propósito através do Autoconhec… |

### 🔎 O que já apareceu sem eu procurar

- **`cyberspace` serve `<title>Vite + React + TS</title>`** — é o boilerplate default do Vite, nunca
  teve conteúdo. É o corte mais óbvio dos 15.
- **`vertice` (03/03) e `pathfinder` (23/10/2025)** são os únicos sem push recente. Todo o resto foi
  tocado nos últimos 4 dias. Isso não é abandono automático — mas é a pergunta certa a fazer neles.
- **`clerk.atma.roilabs.com.br` responde 301**, não 200. A auth do Atma segue quebrada pela limpeza
  de NXDOMAIN, e a decisão de 30/07 foi **arrancar o Clerk**. O card do Atma tem que nascer com
  isso como blocker, senão nasce mentindo.
- `n8n-staging.roilabs.com.br` e `www.atma.roilabs.com.br` **não resolvem**, mas são periféricos
  citados no repo do Atma — não estão no caminho principal do produto. Não confundir com o padrão
  dos 3 quebrados.

---

## 🤔 A decisão que precede a curadoria

**Vários dos 15 não estão sem curadoria por esquecimento — eles já têm dono em outro lugar.**
Curar de novo do zero é como o card apodrece: duas fontes divergem e nenhuma vence.

Antes de escrever, checar se o projeto já tem decisão tomada:

- **`portfolio`** — está em host de fornecedor (`*.vercel.app`) **por decisão do Jean**, que vai
  comprar domínio próprio pro CV depois. **Não é pendência.** Curar refletindo isso, não sinalizando
  como problema.
- **`aesthetic-perfection-page` (Lumina)** — publicado como **demonstração explícita**: a clínica
  não existe. Receita não se aplica da forma normal.
- **`Atma`, `compass`, `meridian`, `cannibal_scan`, `seo-forecaster`, `qprime`** — todos têm
  histórico próprio e blockers conhecidos fora do `projects.json`. Importar a decisão que já existe,
  não inventar uma nova.

**Pergunta pro Jean antes de começar:** os 15 entram todos, ou corta primeiro? `cyberspace` é
boilerplate puro; `vertice` e `pathfinder` estão parados há meses. A régua vigente é **"todos
entram, zero arquivamentos"** — então provavelmente é curar os 15 mesmo, mas com `receita` honesta
(1–2) em vez de fingir tese comercial. Confirmar antes de escrever 15 cards.

---

## ▶️ A receita, na ordem que funcionou nos 9

1. **Entender a régua antes de dar nota** — `lib/score.mjs`. Score 0–100 com pesos
   `receita 0.35 · blockers 0.25 · seo 0.20 · decay 0.20`, cada critério 0–10.
2. 🚨 **`seo` e `decay` são AUTOMÁTICOS.** `seoSeed` e `decay` do JSON são só *fallback*:
   `seo` vem de `seoScoreFromClicks(28d, 28d anteriores)` do GSC e `decay` vem do `health` do
   `insights.json`. Site fora do ar força decay 10. **Não gaste tempo calibrando esses dois** — o
   que você realmente cura é `receita`, `blockers`, `blockersLista`, `acao` e `nome`.
3. **Medir o GSC de verdade.** Nos 9 deu **zero em todos** — sitemaps entraram em 30/07, não há
   série. Com `previous === 0 && current === 0`, `seoScoreFromClicks` devolve **2**, não `null`:
   ou seja, o `seoSeed` nem chega a ser lido. Vale conferir se os 15 têm histórico real (vários
   estão no ar há mais tempo, então aqui provavelmente **tem** dado — e aí a curadoria fica bem
   mais rica que a dos 9).
4. **Rodar o grep de host morto** (bloco acima) antes de escrever qualquer `receitaNota`.
5. **Procurar o caminho de dinheiro, não a intenção.** Nos 9 isto separou tudo: só o `orcaobra`
   tinha checkout vivo (Kiwify 200, R$ 47,90) e ficou com `receita: 7`; o `matchfios` tinha preço
   na página mas o botão só rolava pro formulário e ficou com 3. Grep útil:
   `stripe|mercadopago|checkout|hotmart|kiwify|pricing|R\$` — e depois **curl no link de checkout**,
   porque checkout morto é o pior blocker que existe.
6. **Escrever a entrada** seguindo o formato de `data/projects.json`: `acaoDesc` é o texto longo com
   histórico e contexto, `acao` é **uma linha** — a ação do dia. `repo` tem que bater com o nome
   real do repositório, senão `mergeProjects` não substitui a entrada auto-gerada e o projeto
   **duplica**.
7. **Provar que moveu em vez de duplicar:**
   ```bash
   npm test          # 130 testes hoje, todos passando
   ```
   e rodar o `mergeProjects` contra a lista real do GitHub conferindo `hosts duplicados: ZERO` e
   que cada slug novo saiu como `CURADO`.
8. **Commit + push** — fechar entrega é atualizar o card e pushar.

### ⛔ O que não fazer

- **Não curar pelo status da home.** 200 não prova produto funcionando (os 3 de 30/07).
- **Não grepar por nome de env var** — falso negativo comprovado no `atma`.
- **Não inventar `acao` pra projeto que não tem trabalho definido.** Card inventado apodrece; o
  `tapepro` já tem `acao` vazia de propósito, e isso é o padrão correto, não um esquecimento.
- **Não re-litigar arquivamento.** Decisão do Jean, tomada e reafirmada: **zero arquivamentos**,
  *"quero todos ativos, vou monetizar/produtizar todos"*.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing roda 00:13).
- ⚠️ Cuidado com `TZ=America/Sao_Paulo` no Git Bash do Windows: **não tem tzdata** e devolve UTC,
  o que faz parecer que você está dentro da janela de não-push quando não está. Use a hora local
  da máquina.

---

## 📊 Onde os 9 ficaram, pra calibrar a régua dos 15

Com `seo = 2` automático (GSC zerado) nos nove:

```
42  orcaobra              receita 7 — único com checkout vivo
41  cardiorisk            blockers 7 — API NXDOMAIN
41  tapevision            blockers 7 — API NXDOMAIN
36  potencialarquitetado  blockers 6 — API NXDOMAIN + og:image morta
28  matchfios             receita 3 — preço na página, sem checkout
23  verticemarketing      receita 3 — agência, receita por serviço
21  whatsmeow             receita 3 — infra do Sirius, sem cobrança própria
14  claudeloop            receita 1 — dev tool interna
14  swarm                 receita 1 — pesquisa, repo público
```

Nota de calibração: `receita 7` foi reservado pra quem **fatura hoje**; `3` pra quem tem produto mas
não tem caminho de pagamento; `1–2` pra dev tool, pesquisa e vitrine quebrada. Os 15 devem cair na
mesma régua — se algum passar de 7, é porque tem receita maior que a do único que vende hoje, e isso
precisa de evidência, não de otimismo.

---

## Contexto herdado

- A leva de renomeação que originou isto: [`handoff-renomear-subdominios-executado.md`](handoff-renomear-subdominios-executado.md)
- A data de 02/08 e o robô de crawl: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)
- Projetos vêm do GitHub, não de lista fixa: [`handoff-hub-github.md`](handoff-hub-github.md)
