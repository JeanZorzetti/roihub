# Handoff — `sirius` executado: CTR do AgaaS + dono do "crm roi" (31/07/2026, 08h30 BRT)

Estado anterior: [`handoff-proximo-passo-31-07.md`](handoff-proximo-passo-31-07.md) — **executado, com
uma correção de premissa**. Índice geral: [`../handoff.md`](../handoff.md).

Commit `6773951` em `JeanZorzetti/sirius@main`. Clone local criado em `C:\dev\sirius`
(não existia; **não é** `ROI Labs\AGI_Sirius`).

---

## 🚨 A premissa do passo 1 era falsa

O plano mandava pôr `hreflang` "porque não existe uma única ocorrência de `hreflang` ou `alternates`
no projeto". **Existe, e funciona.** Verificado por `curl` **sem `-k`** no HTML servido em 31/07:

| URL | canonical | hreflang servido |
|---|---|---|
| `/solucoes/energia-solar` | ela mesma | `pt-BR` + `en` + `x-default` |
| `/en/solutions/energia-solar` | ela mesma | `pt-BR` + `en` + `x-default` |
| `/blog/agentes-ia-vs-saas-tradicional` | ela mesma | os três |
| `/en/blog/agentes-ia-vs-saas-tradicional` | ela mesma | os três |

O helper é `lib/seo/canonical.ts` (`buildLocaleAlternates`), usado desde antes deste commit; o par
solar tem tratamento próprio em `solucoes/[slug]/page.tsx`. **Cada página ser `canonical` de si mesma
com o par `hreflang` completo é o comportamento correto** — é assim que se declara "mesma página em
dois idiomas". Não era canibalização, e **zero linha de `hreflang` foi escrita**.

Lição, já registrada antes e reincidente: [[roihub_agenda_task_premises_unverified]] — validar a
premissa no HTML servido antes de planejar em cima dela.

## O que a remedição própria mostrou (GSC API, `query × page × country`, 01/07→29/07)

- **Cliques não-branded = 2** (branded = 4). Gate 31/08 continua em ≥ 5. Confere com o plano.
- **`agaas` é a única query não-branded de página 1 com volume:** 85 imp, pos 8,1, os 2 cliques
  (AUS e USA). `agaas meaning` aparece separada: 3 imp, pos 9,0.
- Tudo o mais está em página 3+. **Logo o gate é CTR de UMA página, não ranking.**
- **NOVO — `crm roi` está partido em QUATRO URLs, não duas:** `/blog/roi-de-crm` mais as
  calculadoras `-agencias`, `-consultores` e `-representantes`. O plano só tinha visto duas.

## O que foi feito

1. **CTR do AgaaS** (`lib/blog/posts/agentes-ia-vs-saas-tradicional.ts`) — a página já é página 1 lá
   fora, então o trabalho foi de título/meta:
   - `titleEn`: `AgaaS Meaning: Agentic-as-a-Service vs Traditional SaaS`
     (era `AgaaS vs Traditional SaaS: Why AI Agents Are the Future of CRM in 2026`);
   - `excerptEn`: definição BLUF em vez de "compare X com Y";
   - `keywordsEn`: entram `agaas meaning` e `what is agaas`;
   - `contentEn` abre com a definição, não com a história do SaaS.
   - **SLUG INTOCADO** — trocar exige 301, e é a única página que gera clique não-branded.
2. **Dono do `crm roi`** — o post ranqueia ~20 posições melhor que as calculadoras, então ele fica com
   a query genérica. O link para ele foi posto **no componente compartilhado** `CalculadoraROI`
   (um diff cobre as 5 calculadoras + páginas de nicho e de cidade), e o post passou a linkar para as
   calculadoras por segmento. O link só aparece em pt-BR: o post não tem versão EN, e a `/en` dele sai
   `noindex`.
   ⚠️ `usePathname()` devolve `null` quando a calculadora é montada em root avulso (`createRoot` no
   `blog-content-wrapper`), fora do contexto do router — daí o `?.` no código.
3. **Cluster solar: NÃO começado, de propósito.** ~215 imp em pos 26–41 não vira clique até 31/08, e
   agora não há mais motivo estrutural (o `hreflang` já estava lá) para tratá-lo como bloqueado.
   É trabalho de conteúdo, para depois da leitura de 14/08.

## Como medir (mesmo instrumento)

Cliques **não-branded** em 28d, por `query × page × country` — nunca impressão, nunca posição média
global ([[gsc_branded_position_polluted_by_country]]). Script descartável usou
`GOOGLE_SERVICE_ACCOUNT_JSON` do `.env` do roihub com
`searchAnalytics/query` em `sc-domain:siriuscrm.com.br`.

**Próxima leitura: ~14/08.** Se o CTR do `agaas` não subir com a página em pos 8, o alvo passa a ser
posição/conteúdo — não mais título.

## ⚠️ Armadilhas confirmadas nesta sessão

- **O `sirius` não é Vercel.** Não existe projeto `sirius` em `vercel project ls` (as duas páginas da
  conta), e a prod não devolve header de Vercel — a CSP cita `*.easypanel.host`. O `CLAUDE.md` do repo
  ainda diz "Deploy: Vercel": **desatualizado**. Vale
  [[vercel_project_ls_is_not_proof_of_offline]] ao contrário.
- **O CI já estava vermelho em `main` antes deste commit:** `npx tsc --noEmit` acusa 54 erros
  pré-existentes (implicit `any` em rotas de WhatsApp/IA). **Nenhum nos arquivos alterados** —
  conferido rodando o tsc completo e filtrando pelos três arquivos.
- Janela de não-push 00:00–01:00 BRT respeitada (push às 08h30).

## Ainda de pé, e não depende desta frente

- **Domingo 02/08, 10:00 BRT — 1º run do robô de crawl**
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **Atma:** não baixar o `decay 10` antes de a série reagir (~14/08).
- **`pathfinder`:** backend continua morto (`/api/*` → NXDOMAIN).
