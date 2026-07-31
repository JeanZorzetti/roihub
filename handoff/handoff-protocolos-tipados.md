# Handoff — os protocolos estão tipados: 97 registros verificáveis (31/07/2026)

Estado anterior: [`handoff-tipar-protocolos.md`](handoff-tipar-protocolos.md).
Índice: [`../handoff.md`](../handoff.md).

**Entregue:** a fase 2 de [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md). O
conhecimento que estava em prosa espalhada agora é dado consultável, com procedência e comando
de checagem.

---

## O que existe agora

| Artefato | O que é |
|---|---|
| `data/protocolos/<AREA>-<NN>.json` | **97 arquivos**, um por protocolo, com `verificacao.como` preenchido em todos |
| `test/protocolos.test.mjs` | 8 checagens, **na lista explícita do `npm test`** |
| [`../docs/protocolos-triagem.md`](../docs/protocolos-triagem.md) | a triagem dos 123 arquivos: o que virou protocolo, o que é estado/episódio e por quê |
| [`../docs/protocolos-areas.md`](../docs/protocolos-areas.md) | atualizado com a contagem **real** por área (a coluna "estimado" ficou, porque a diferença é informação) |

`npm test` **verde: 140 testes** (eram 132). `data/` já é copiado no `Dockerfile:28`, então os
protocolos viajam com o deploy e qualquer página do hub lê por `fs`, sem banco.

**Distribuição:** DEP 16 · AGT 12 · UI 11 · CNT 10 · VER 7 · INT 7 · SEO 6 · DNS 6 · SEC 6 ·
PRT 6 · DAT 4 · PRF 4 · GEO 2. As 5 lacunas seguem **vazias e declaradas**, como manda o doc.

## 🚨 O achado: o protocolo mais caro do repo estava em CÓDIGO, não em memória

As regras de `CNT` — fonte real e nunca concorrente direto, BLUF de 40–60 palavras, 4–6 seções,
tabela obrigatória em comparação, `imageScene` como cena fotografável, gate YMYL — só existiam
no prompt de `lib/autopublish-clients.ts` e nas validações de `lib/autopublish-core.mjs`. Elas
governam **10 sites que publicam sozinhos toda noite** e nunca tinham sido escritas como norma.
`CNT` era a área mais subdimensionada do portfólio: estimada em ~4, tipada em **10**.

**Consequência para a fase 5 (manifesto por repo):** a varredura de conformidade não pode
assumir que toda norma nasceu em `memory/`. Protocolo mora em código também.

## O que o handoff anterior previu e não aconteceu

Ele previa perder protocolos no passo do `verificacao.como` ("esperado perder alguns, e isso é
resultado"). **Nenhum caiu por falta de checagem.** As memórias da casa já nascem com a seção
*How to apply*, que é a verificação escrita em prosa — o trabalho caro não foi descobrir opinião
disfarçada de protocolo, foi **traduzir prosa em comando**.

E a contagem passou de "~85": memória densa rende vários registros.
`roihub_autopublishing_gotchas` sozinha virou **11 protocolos em 5 áreas**.

## Três decisões de fronteira — não re-litigar

1. **"200 não prova X" é `VER`, não a área do X.** `curl -k`, sitemap em 200, landing com backend
   morto, `vercel project ls`, clone quebrado. A exceção é `SEO-04` (indexação), que o próprio
   doc de áreas fixou como exemplo canônico de `SEO` — e o `SEO-04` do exemplo **existe e é
   literalmente esse**.
2. **Protocolo de processo de trabalho não ganhou área nova** e foi distribuído: fechar entrega
   em `DEP-12`, handoff em `PRT-05`, vault em `PRT-06`. São 3 registros; se a família crescer,
   aí sim é candidata a área.
3. **`area` é o código em MAIÚSCULAS** (`SEO`), não o slug minúsculo do YAML de exemplo — é o
   que faz `id`, nome de arquivo e área concordarem, e é o que o teste cobra.

## Próximo passo — fase 2b, o conjunto dourado

~50 perguntas reais com resposta conhecida, extraídas dos **36 handoffs** (cada um contém
perguntas que já foram respondidas). É o que vai medir se o vetor, o reranker e o grafo das
fases 3–6 ganharam alguma coisa.

⚠️ **As fases 3+ não devem começar antes de ele existir** — sem dourado, elas melhoram no
achismo. Esta é a regra da camada 6 e ela continua valendo.

Depois dele, na ordem do doc de áreas: **abrir as 5 lacunas** (`BKP`, `CST`, `OBS`, `PRV`,
`A11Y`), escrevendo do zero, **com a checagem definida antes da norma**.

## O que dá para responder agora, antes de qualquer vetor

Com 97 registros tipados e o campo `aplica_se_a`, a pergunta que justifica o hub existir já tem
substrato: *"quais dos 35 nunca foram checados contra a lição X"*. O que ainda **não** existe é
o outro lado da junção — o `.roilabs/manifest.yaml` por repo (camada 4). Enquanto ele não
existe, a resposta é por `aplica_se_a` + inspeção manual, não automática.

---

## ⏸️ Continua aberto: o `UND_ERR_HEADERS_TIMEOUT` (adiado por decisão, agora é `INT-02`)

Inalterado desde [`handoff-harness-decidido.md`](handoff-harness-decidido.md) § D. O
diagnóstico virou protocolo (`INT-02`), o **patch continua não aplicado**. Pode estar custando
artigo toda noite no `polarisia` e no `reviewshield`; confirmar custa ~10 min (logar
`error.cause?.code` no `catch` de `requestPhase`, `run-autopublish.mjs:87`).

⚠️ Caminho crítico das 00:13 — mexer **fora da janela 00:00–01:00 BRT**.

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica` (que **não** bloqueia indexação —
  é a exceção declarada em `SEO-04`).
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Ainda só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica` e — o mais antigo e perigoso —
**rotacionar os segredos vazados** ([[secrets_to_rotate]], agora normatizado em `SEC-04`).
