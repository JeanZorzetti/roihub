# Handoff — N4 por canal, GA4 somado ao GSC

**Feature**: `013-n4-canais-ga4-somado` | **Data**: 2026-09-02 | **Estado**: **34 de 34 tarefas
encerradas** (33 executadas + T029 encerrado por substituição, §3), **no ar e acesa** em
`hub.roilabs.com.br`. **A spec está fechada.**

Sobra **uma** conferência, e ela é de calendário, não de código: o quickstart **§5** (linha de
inferência do WhatsApp) só é conferível a partir de ~**05/09/2026**, quando a janela D-3 alcançar os
orçamentos de 01/09. O código da US3 está pronto, testado e no ar; hoje a linha corretamente não
aparece. Reconferir naquela data e marcar o §5 — não é motivo para manter a feature aberta.

**T002 fechou em 02/09.** A Data API foi habilitada e a conta de serviço ganhou acesso à propriedade
GA4 da Atma — os canais acenderam sem deploy novo, como o desenho previa. O que a ficha da `atma`
mostra agora, conferido no HTML servido:

```
orgânico                            [525]  (Search Console)
Direto                              [130]  (GA4 · properties/504053080)
Pago                                  [0]  (GA4 · properties/504053080)
Indicação                             [0]  (GA4 · properties/504053080)
Social                                [6]  (GA4 · properties/504053080)
fora do catálogo (AI Assistant 46 · Unassigned 1)  [47]
total composto (orgânico + 4 canais) [661]  (Search Console · GA4)
Outbound                             não apurado — a fonte GA4 não distingue prospecção ativa
diferença                            não apurado — canais sem fonte: outbound
```

N3 intacto: `visitante → lead 6,67% (35/525)` — o denominador continua o orgânico (SC-010).
`Pago 0` e `Indicação 0` são o FR-004 funcionando: a fonte respondeu zero, então o zero é apurado.

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

**A ficha atual está no topo deste arquivo.** Para referência, era assim enquanto o T002 estava
aberto — todo canal do GA4 em `não apurado`, o que é o comportamento correto na ausência da fonte,
não regressão:

```
orgânico                   [525]  (Search Console)
total composto (orgânico)  [525]  (Search Console)
Direto/Pago/Indicação/Social      não apurado — fonte GA4 indisponível (403) · consultar: GA4 Data API
Outbound                          não apurado — a fonte GA4 não distingue prospecção ativa
diferença                         não apurado — canais sem fonte: direto, pago, indicacao, outbound, social
```

---

## 1. Como o T002 fechou (histórico — não é tarefa)

Os três passos, e por que os 403 confundem:

1. **Habilitar a Google Analytics Data API — não precisou de console nem `gcloud`.** A própria conta
   de serviço (`nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`) tem
   `serviceUsageAdmin` no projeto `845396101677`, então
   `POST serviceusage.googleapis.com/v1/projects/845396101677/services/analyticsdata.googleapis.com:enable`
   com escopo `cloud-platform` devolveu `operations/acat.…` e a API subiu na hora.
2. **Acesso de Visualizador na propriedade — único passo genuinamente manual.** A Admin API só deixa
   criar `accessBinding` quem já é admin *daquela* propriedade; a conta não enxergava nenhuma, logo
   não podia se auto-adicionar. Feito à mão em *GA4 → Administrador → Acesso à propriedade*.
3. **`propertyId`** — `properties/504053080`, já curado no card.

**O texto do 403 diz em qual passo você está** — e só ele:

| Resposta | Passo pendente |
|---|---|
| `has not been used in project … or it is disabled` | 1 — habilitar a API |
| `User does not have sufficient permissions for this property` | 2 — acesso à propriedade |
| lista de grupos e sessões | nenhum |

⚠️ O admin do GA4 mostra `CÓDIGO DO FLUXO` (`12127687264`) e `ID DA MÉTRICA` (`G-EMCS41DMSP`).
**Nenhum dos dois serve** para a Data API — ela quer o ID da propriedade, em *Administrador →
Detalhes da propriedade*. Foi onde a primeira leitura errou.

---

## 2. O que foi conferido ao acender (quickstart §3, rodado)

Sem deploy: a rota é `force-dynamic` e a leitura é por requisição (D4), bastou recarregar
`/okr/atma` via `curl -su "$HUB_USER:$HUB_PASS" https://hub.roilabs.com.br/okr/atma`.

- [X] **5** canais com número e procedência (o desenho previa 5) — SC-001;
- [X] a fonte de cada um diz `GA4 · properties/504053080`;
- [X] `outbound` segue `não apurado`, e sempre seguirá — decisão de desenho (D3);
- [X] `total composto (orgânico + 4 canais) 661`; à mão 525+130+0+0+6 = 661;
- [X] `visitante` do N3 e todas as taxas idênticos — `6,67% (35/525)` (SC-010);
- [X] `fora do catálogo (AI Assistant 46 · Unassigned 1) 47`, fora do total, como previsto;
- [X] `Sessões orgânicas do GA4 ignoradas: 765` — descartado e nomeado (FR-005a, SC-008);
- [X] `diferença` encolheu de cinco canais sem fonte para **um** (`outbound`), e por isso continua
      não apurada (FR-012).

Janela conferida: `2026-08-03 → 2026-08-30` (D-30 → D-3). `T002` fechado no `tasks.md` e o
quickstart §3 marcado.

---

## 3. Pendências e o que NÃO dá para fazer

**T029 — diff byte a byte antes/depois: perdido, e não vale tentar reconstruir.** O retrato do
"antes" não foi tirado antes do primeiro deploy, e o HTML anterior já foi substituído. O que provou
a SC-004/SC-010 no lugar está escrito no fim do `tasks.md`: `deepEqual` do N3 no teste, varredura ao
vivo dos 17 projetos com perfil, e o T008 (assinatura de 3 argumentos). **Lição de processo**: o
retrato do "antes" é barato e só existe antes — tirar por padrão no começo de qualquer feature que
mexa em tela.

**A única conferência que sobra: quickstart §5, a partir de ~05/09.** A linha de inferência do
WhatsApp ainda não aparece, e está certo. Os 2 orçamentos com
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
