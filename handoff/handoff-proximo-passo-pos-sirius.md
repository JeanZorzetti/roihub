# Handoff — próximo passo, separado por quem executa (31/07/2026, 09h BRT)

Estado anterior: [`handoff-sirius-agaas-ctr-31-07.md`](handoff-sirius-agaas-ctr-31-07.md)
(frente do `sirius` executada; agora é espera até ~14/08). Índice: [`../handoff.md`](../handoff.md).

**Ranking de hoje:** `atma` 51 e `sirius` 45 são **espera, não trabalho** — os dois já foram
consertados e o que falta é a série de dados reagir. O primeiro item acionável do ranking é o
`goiania` (44), e ele é **manual**. Daí a divisão abaixo.

Tudo o que está aqui foi **conferido em produção hoje** (`curl`, `nslookup`, API do GSC), não copiado
dos cards — dois cards estavam errados e estão marcados como tal.

---

## 🙋 SÓ O JEAN PODE FAZER

Painel de terceiro, credencial ou decisão de negócio. Nenhum destes tem código para o agente escrever.

| # | Projeto | O que fazer | Onde | Por que trava |
|---|---|---|---|---|
| 1 | **goiania** (44) | Verificar `goiania.roilabs.com.br` | Bing Webmaster Tools | IndexNow devolve **403**: 94 URLs "enviadas" a cada build não chegam a ninguém ([[indexnow_403_subdomain_bing]]). ~5 min, destrava sozinho |
| 2 | **compass** (38) | Preencher `STRIPE_SECRET_KEY`, `PRICE_PRO_MONTHLY`, `PRICE_LIFETIME`, `WEBHOOK_SECRET` | EasyPanel | Sem elas **não há como cobrar**. O site está no ar desde antes e não fatura |
| 3 | **compass** (38) | GitHub OAuth + Resend | Painéis GitHub/Resend + EasyPanel | Sem login e sem e-mail transacional o produto não é usável |
| 4 | **reviewshield** | `GOOGLE_CLIENT_ID` | EasyPanel | Blocker único do projeto |
| 5 | **todos** | **Rotacionar os segredos vazados** | Stripe, PG, Google, Meta, Resend | A chave **LIVE** da Stripe apareceu em texto puro num build-log ([[secrets_to_rotate]]). É o item mais perigoso da lista e o mais antigo |
| 6 | **atma** | Decidir se testa o MercadoPago em produção | — | A rota grava cliente e relatório no banco **antes** de chamar o MP: testar suja a base real. Decisão + plano de limpeza são seus |

### Decisões que destravam trabalho de agente (1 frase sua = 1 sessão minha)

| Projeto | A pergunta | Sem resposta |
|---|---|---|
| **cardiorisk** (37) | Sobe o backend FastAPI ou a landing vira vitrine? | `cardioapi.roilabs.com.br` é NXDOMAIN e é o default de `API_BASE_URL` — a landing promete análise que a API morta não entrega |
| **tapevision** (37) | Hospedar ou aposentar `Backend/` + `MLEngine`? | `aitradingapi.roilabs.com.br` é NXDOMAIN em `VITE_API_URL` e `VITE_WS_URL` — dashboard no ar sem dado e sem stream |
| **potencialarquitetado** (32) | O conteúdo vira produto pago? | Define se vale mexer além da `og:image` |

---

## 🤖 O AGENTE FAZ SOZINHO

Nenhuma credencial de painel; tudo por repo, `curl` ou API que já tem service account.

| # | Projeto | Tarefa | Verificado hoje |
|---|---|---|---|
| 1 | **fabrica** (30) | Resubmeter o sitemap pela API + URL Inspection nos 21 artigos | ⚠️ **o card mente**: o sitemap **já foi submetido em 10/06** — e voltou com **`errors: 1` e zero conteúdo processado**. Hoje ele serve **26 `<loc>`** em 200 com corpo XML. A tarefa não é "submeter", é **destravar o erro e resubmeter** |
| 2 | **orcaobra** (38) | Trocar a `og:image` | Confirmado: `https://lovable.dev/opengraph-image-p98pqg.png`. É o **único projeto com checkout vivo** — todo share sai sem marca |
| 3 | **potencialarquitetado** (32) | Trocar a `og:image` | Confirmado: aponta para `arquiteturadopotencial.com`, **NXDOMAIN** (`nslookup`). Share sai sem imagem |
| 4 | **cardiorisk** (37) | Corrigir o H1 | Confirmado: ainda `Sistema IA Médica`. O `<title>` foi corrigido em 30/07, o H1 do componente não. Independe da decisão do backend |
| 5 | **vertice** (35) / **compass** (38) | `/sitemap.xml` responde **404** nos dois | Confirmado. No `compass` isso casa com o `URL is unknown to Google` |
| 6 | **polarisia** (32) | Home V4, spec 012 T001–T017 | Spec pronta desde 12/07. É a única tarefa de sessão longa da lista |

### ⚠️ Card podre encontrado hoje — corrigir antes de trabalhar

**`vertice`**: a ação do card ("o CTA da hero é `href='#'`") **não é mais verdade**. Os cinco botões
`Começar Grátis`/`Começar Trial` apontam para `/signup`, e `/signup` responde **200**. O que sobrou de
`href="#"` é a **navbar** (`Funcionalidades`, `Integrações`, `Preços`) — outro problema, menor. O card
já foi corrigido neste commit; a lição é a de sempre ([[roihub_agenda_task_premises_unverified]]).

---

## ▶️ PRÓXIMO PASSO — uma coisa de cada lado

**🤖 Agente, próxima sessão: `fabrica`.** São 21 artigos escritos que o Google não vê, o instrumento
é exatamente o que acabou de funcionar no Atma (resubmit de sitemap → reindexação em 24h,
[[site_200_is_not_indexed_url_inspection]]), e não depende de nenhuma credencial sua. Ordem:
`scripts/submit-sitemap.mjs` → `scripts/inspect-url.mjs` nos artigos → ler o campo, não o status.
Sobrando tempo na mesma sessão: os itens 2, 3 e 4 acima — são três `curl` de prova e diffs de
uma linha.

**🙋 Jean, 5 minutos: Bing Webmaster Tools no `goiania`.** É o maior score acionável do ranking (44) e
some com um blocker que reaparece a cada build.

---

## 📅 Datas firmes (não dependem de sessão)

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~14/08** — remedir o `sirius` (CTR do `agaas` em cliques não-branded/28d, por query × país) **e**
  a série de impressões do `atma`. ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21). Nada de SEO nele até lá.

## Regras que continuam valendo

- **Validar a premissa em produção antes de executar** — hoje isso derrubou a tarefa do `vertice` e
  trocou a do `fabrica`. `curl` **sem `-k`** ([[curl_insecure_flag_hides_cert_errors]]).
- **Push não é deploy em todo projeto**: `pathfinder`, `orcaobra` e `tapevision` publicam só por
  deploy manual ([[vercel_project_not_linked_to_git]]). `sirius` publica sozinho em ~3 min (EasyPanel).
- **Janela de não-push: 00:00–01:00 BRT** (cron do autopublishing às 00:13), pela hora local da máquina.
- **Fechar entrega = atualizar o card em `data/projects.json` + push.**
- SEM Google Ads — portfólio 100% SEO ([[feedback_full_seo_no_ads]]).
