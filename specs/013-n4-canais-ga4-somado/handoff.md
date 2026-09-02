# Handoff — N4 por canal, GA4 somado ao GSC

**Feature**: `013-n4-canais-ga4-somado` | **Data**: 2026-09-02 | **Estado**: 32 de 34 tarefas
fechadas, **no ar** em `hub.roilabs.com.br`, 6 commits em `main` (`c783faa` → `89a698c`).

A feature está **entregue e funcionando**. Falta **um** passo, e ele não é código: habilitar a GA4
Data API no projeto GCP. Depois disso os quatro canais acendem **sem novo deploy**.

---

## 0. O que já está feito (contexto, não é tarefa)

Working tree **limpo**, tudo commitado e pushado. `npm test` 509/509, `npx tsc --noEmit` limpo.

**Código** (um arquivo novo, o resto tocado onde a coisa já morava):

| Arquivo | O que entrou |
|---|---|
| `lib/ga4.ts` | **NOVO** — `ga4Canais()`: borda de rede, `GoogleAuth` próprio com escopo `analytics.readonly`, zero regra, zero log. Falha FECHADA: devolve `{erro}` como dado, nunca propaga |
| `lib/ficha.mjs` | `GRUPOS_GA4`, `mapearCanaisGa4()`, `inferida()`, `resolverGa4()`; `montarN4()` ganhou `ga4`+`janela`; `montarN4Nivel()` reescrito com total composto, fora do catálogo, diferença e nota |
| `lib/okr-coleta.ts` | `ga4` e `orcamentosSemLead` no retorno de `coletarDoProjeto()`; a chamada ao GA4 entra **no mesmo `Promise.all`** do GSC |
| `lib/projects.ts` | campo `ga4?: { propertyId: string }` no tipo `Project` |
| `data/projects.json` | `"ga4": { "propertyId": "properties/504053080" }` no card da `atma` |
| `app/okr/[slug]/page.tsx` | ramo `inferido` em `<Cel>`, nota do nível abaixo do `<h2>` de N4 |
| `app/globals.css` | `.ficha-inferido` (corte-seco: raio 0, sombra 0) e `.ficha-nota-n4` |
| `test/ficha.test.mjs` | +38 asserções; nenhum arquivo de teste novo, `package.json` intocado |

**Estado atual da ficha da `atma`, no HTML servido pelo EasyPanel:**

```
orgânico                   [525]  (Search Console)
total composto (orgânico)  [525]  (Search Console)
Direto/Pago/Indicação/Social      não apurado — fonte GA4 indisponível (403) · consultar: GA4 Data API
Outbound                          não apurado — a fonte GA4 não distingue prospecção ativa
diferença                         não apurado — canais sem fonte: direto, pago, indicacao, outbound, social
```

---

## 1. O ÚNICO passo bloqueante — habilitar a Data API (T002)

A conta de serviço é **`nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`**, a mesma de
`GOOGLE_SERVICE_ACCOUNT_JSON` que já serve o GSC. No projeto GCP **845396101677**
(`review-dispute-agent-498311`), a Data API responde:

```
403 — Google Analytics Data API has not been used in project 845396101677 before or it is disabled
https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=845396101677
```

São **três** passos distintos, e o 403 do primeiro se parece com o do terceiro:

1. ~~habilitar a Google Analytics Data API no projeto GCP~~ — **FEITO em 02/09**, via
   `POST serviceusage.googleapis.com/v1/projects/845396101677/services/analyticsdata.googleapis.com:enable`
   com a própria conta de serviço (ela tem `serviceUsageAdmin` no projeto). Não precisou de console;
2. adicionar a conta de serviço como **Visualizador** na propriedade GA4 da Atma ← **é o que falta**.
   A sonda agora responde `User does not have sufficient permissions for this property`, que é o 403
   do passo 2. Isto **não** dá para automatizar: a Admin API exige que quem chama já seja admin da
   propriedade, e a conta não enxerga nenhuma. É manual em *GA4 → Administrador → Acesso à
   propriedade → `+` → `nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com` → Visualizador*;
3. o `propertyId` — **já resolvido**: `properties/504053080`, curado no card.

⚠️ O screenshot do admin do GA4 mostra `CÓDIGO DO FLUXO` (`12127687264`) e `ID DA MÉTRICA`
(`G-EMCS41DMSP`). **Nenhum dos dois serve** para a Data API — ela quer o ID da propriedade, que só
aparece em *Administrador → Detalhes da propriedade*. Foi onde a primeira leitura errou.

**Sonda para saber em qual dos três passos você está** (leitura pura, não escreve nada). Salve como
`tmp-probe.mjs` na raiz do `roihub`, rode `node --env-file=.env tmp-probe.mjs`, apague depois:

```js
import { GoogleAuth } from "google-auth-library";
const auth = new GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
});
const client = await auth.getClient();
const inicio = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
const fim = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
try {
  const r = await client.request({
    url: "https://analyticsdata.googleapis.com/v1beta/properties/504053080:runReport",
    method: "POST",
    data: {
      dateRanges: [{ startDate: inicio, endDate: fim }],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }],
    },
  });
  for (const x of r.data.rows ?? []) console.log(x.dimensionValues[0].value, x.metricValues[0].value);
} catch (e) {
  console.log("FALHOU:", e?.response?.status, String(e?.message).slice(0, 200));
}
```

**Como ler a resposta:**

| Resposta | Significa | Ação |
|---|---|---|
| `has not been used ... or it is disabled` | passo 1 pendente | habilitar a API no console |
| `PERMISSION_DENIED` / `does not have sufficient permissions` | passo 1 OK, passo 2 pendente | adicionar a conta como Visualizador |
| lista de grupos e sessões | tudo pronto | ir para §2 |

---

## 2. Quando acender — conferir e fechar (quickstart §3)

**Não precisa de deploy.** A rota é `force-dynamic` e a leitura é por requisição (D4) — basta
recarregar `/okr/atma`.

```bash
curl -su "$HUB_USER:$HUB_PASS" https://hub.roilabs.com.br/okr/atma
```

Checklist do quickstart §3:

- [ ] pelo menos **4** canais com número e procedência na mesma linha (SC-001; o desenho prevê **5**
      apurados: orgânico + direto + pago + indicação + social);
- [ ] a fonte de cada um diz `GA4 · properties/504053080`;
- [ ] `outbound` continua `não apurado` — ele **nunca** terá fonte, é decisão de desenho (D3);
- [ ] `total composto` muda de `(orgânico)` para `(orgânico + 4 canais)` e a soma bate à mão;
- [ ] o `visitante` do N3 e **todas** as taxas continuam idênticos (SC-010) — se mudarem, a feature
      furou o próprio contrato;
- [ ] se aparecer `fora do catálogo (Email 12 · ...)`, está certo: é volume nomeado, fora do total.

Depois: fechar `T002` no `tasks.md` e marcar o quickstart §3.

---

## 3. Pendências e o que NÃO dá para fazer

**T029 — diff byte a byte antes/depois: perdido, e não vale tentar reconstruir.** O retrato do
"antes" não foi tirado antes do primeiro deploy, e o HTML anterior já foi substituído. O que provou
a SC-004/SC-010 no lugar está escrito no fim do `tasks.md`: `deepEqual` do N3 no teste, varredura ao
vivo dos 17 projetos com perfil, e o T008 (assinatura de 3 argumentos). **Lição de processo**: o
retrato do "antes" é barato e só existe antes — tirar por padrão no começo de qualquer feature que
mexa em tela.

**A linha de inferência do WhatsApp ainda não aparece, e está certo.** Os 2 orçamentos com
`paciente_lead_id` nulo são de **01/09**; a janela da cadeia é **03/08 → 30/08** (D-3, atraso do
GSC). Ela entra sozinha conforme a janela desliza — a partir de ~**05/09**. Se alguém "consertar"
isso forçando a linha a aparecer com `0`, está reintroduzindo o defeito que o commit `4f8de90`
corrigiu.

---

## 4. Decisões que quem continuar precisa respeitar

1. **O canal orgânico é intocável.** Nenhum caminho de `montarN4()` lê `ga4` para produzi-lo
   (FR-005a, SC-008). `Organic Search` do GA4 é descartado e **nomeado** na nota do nível.
2. **`outbound` sem fonte é de propósito.** O GA4 não tem grupo para prospecção ativa; mapear
   `Email → outbound` seria jogar volume num canal existente, que a spec proíbe. É ele que mantém a
   `diferença` em `não apurado` (FR-012), corretamente.
3. **O total composto não vira `visitante`.** É leitura ao lado, rotulada como composta. Promovê-lo
   a denominador mudaria toda taxa do N3 — está em **Fora de escopo** como migração futura e datada.
4. **`inferido` é um quarto estado, não um booleano.** Um `if (!c.inferido)` esquecido em qualquer
   consumidor futuro poria inferência na cadeia; o estado separado falha ruidosamente (D5).
5. **Assimetria deliberada do zero**: para CANAL com fonte consultada, `0` apurado é **exigido**
   (FR-004) — a fonte respondeu; para número **deduzido**, zero não é vestígio e a linha some.

---

## 5. Próximos passos naturais (fora do escopo desta spec)

- **Ligar GA4 nos outros projetos**: agora é só acrescentar `"ga4": { "propertyId": "..." }` ao card
  em `data/projects.json`. Zero código. Com a **Admin API** habilitada,
  `GET analyticsadmin.googleapis.com/v1beta/accountSummaries` lista `properties/<n>` + nome de toda
  propriedade que a conta enxerga — evita depender de alguém copiar número da tela.
- **Instrumentar a origem do contato** (FR-011b) — o que tornaria a inferência do WhatsApp apurada.
  Exige mudança no site da Atma, em outro repositório, e só conta a partir da data em que for ligado;
  o passado não volta. É a feature separada que a 013 abriu como dívida explícita.
- **Promover o total composto a `visitante`** — migração datada e isolada, nunca junto da chegada de
  uma fonte nova (senão não dá para separar "a conversão caiu" de "a conta mudou").

---

## 6. Gotchas de ambiente (custaram tempo nesta sessão)

- **`/tmp` diverge entre ferramentas no Windows**: `curl` (MSYS) escreve num lugar e `python3`
  (Windows nativo) lê de outro — o script leu arquivo errado **sem dar erro**. Usar sempre caminho
  absoluto do scratchpad.
- **O console do Windows não renderiza UTF-8**: `orgânico` sai como `org?nico` no terminal. O HTML
  está correto; não é bug da página.
- **Detector de varredura precisa se auto-validar.** O primeiro extrator devolveu "nenhum canal com
  número" — que era a resposta *desejada*, e estava errada: o regex não casava nada. Sempre conferir
  que o detector **acha onde deveria achar** antes de acreditar no vazio.
- **Heredoc aninhado quebra o `Bash` tool**: para escrever arquivo que contém blocos de código, usar
  a ferramenta `Write`.
- **Push em `main` é deploy** (Princípio IV). Fora de **23:30–01:00** e **08:00–08:45** BRT. A
  conferência é sempre no HTML servido pelo EasyPanel, nunca `next dev`.
- **A janela é D-30 → D-3**, não "os últimos 28 dias até hoje". Dado de ontem não está na janela — é
  o que explica a inferência em zero do §3.
