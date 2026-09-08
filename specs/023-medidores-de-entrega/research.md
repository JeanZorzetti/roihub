# Research: Medidores de Entrega — os Core Web Vitals de campo da Atma

**Feature**: 023 | **Data**: 2026-09-07 | **Spec**: [spec.md](./spec.md)

Fase 0 do plano. Cada decisão abaixo foi tomada contra o código que existe hoje, não contra o
código que a spec imagina — uma delas corrige uma premissa da spec.

---

## D1 — A apuração acontece no RENDER, não numa corrida gravada

**Decisão**: ler a CrUX na renderização da página, no padrão de `gscConsultas` na aba de
aquisição. **Sem tabela nova, sem `ensure()`, sem rota, sem workflow, sem segredo de cron.**

**Rationale**: a própria spec já resolveu isto em Assumptions — "a fonte **serve o próprio
histórico** (p75 semanal dos últimos meses); gravar aqui seria cache, não calendário". A
diferença com a 021 é material: lá o dia não gravado não voltava (o GSC descarta), aqui a CrUX
devolve o mesmo período de coleta a quem perguntar amanhã. Uma tabela existiria só para
armazenar um dado que a fonte já historiza.

O custo evitado é concreto: a 022 gastou tabela + `ensure()` + `POST /api/indexacao` +
`.github/workflows/indexacao.yml` + horário fora das duas janelas proibidas do Princípio IV.
Nada disso é necessário aqui.

**Alternativa rejeitada**: corrida gravada no padrão 021/022. Entra quando houver razão
**medida** — latência da CrUX degradando a ficha, ou vontade de ter p75 semanal do próprio hub.
Nenhuma das duas existe hoje.

**Consequência**: `/okr/[slug]` é `force-dynamic` (`app/okr/[slug]/page.tsx:31`) e já paga GSC,
GA4 e Postgres por request; a aba de aquisição é `revalidate = 3600`. Uma chamada a mais na
primeira, cacheada por uma hora na segunda.

---

## D2 — A chamada: `records:queryRecord` por **origin**, um POST para os quatro vitais

**Decisão**:

```
POST https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY
{ "origin": "https://www.atma.com.br" }
```

`formFactor` **omitido** de propósito = agregado de todos os dispositivos (FR-010, e a Assumption
"recorte agregado na primeira versão, declarado na tela"). A resposta traz os quatro vitais no
mesmo `record`, então **um POST resolve LCP, INP, CLS e TTFB**.

Campos lidos:

| Do que precisamos | Onde está |
|---|---|
| p75 de cada vital | `record.metrics.<nome>.percentiles.p75` |
| a janela que a fonte cobre (FR-005) | `record.collectionPeriod.firstDate` / `.lastDate` (`{year,month,day}`) |
| o alvo efetivamente medido | `record.key.origin` (+ `urlNormalizationDetails` quando a CrUX normaliza a URL) |

Nomes das métricas: `largest_contentful_paint`, `interaction_to_next_paint`,
`cumulative_layout_shift`, `experimental_time_to_first_byte`.

**Alternativa rejeitada**: quatro chamadas, uma por métrica. Multiplicaria a quota por quatro
para ler o mesmo `record`.

---

## D3 — `404` é **ausência de amostra**, qualquer outra falha é **falhou agora**

**Decisão**: esta é a distinção que a FR-003 exige, e ela não é uma heurística nossa — é o
protocolo da fonte. A CrUX responde **`404`** para alvo sem amostra suficiente (o dado não
existe, e não vai existir enquanto o tráfego não crescer). Timeout, `5xx`, `403` de chave e
falha de rede são **outra coisa**: a apuração falhou agora.

Colapsar os dois é exatamente o defeito que a spec proíbe, e é o mesmo que `lib/gsc.ts` já evita
ao separar `null` (sem propriedade) de `{erro}` (falha transitória) — ver
`app/api/gsc-serie/route.ts:44-51`.

- `429` fica no lado de **falhou agora**: quota estourada é transitória por definição.
- Ausência de uma **chave de métrica** dentro de um record que veio não é `404` do record: a
  ausência é da métrica, não da amostra do site (ver D5).

**Confirmar na primeira corrida** (como a 022 fez com a quota da URL Inspection): o corpo real do
`404` e a quota real da chave. Número de documentação não é número medido.

---

## D4 — O veredito de meta e a unidade viajam na célula que já existe — **sem estado novo**

**Decisão**: `disponiveisN5` já aceita `{ valor, fonte }`, e `CelulaFicha["apurado"].valor` já é
`number | string` (`lib/ficha-dados.ts:25`). `Cel` (`app/okr/[slug]/celulas.tsx:107-113`) imprime
`valor` em negrito e `fonte` entre parênteses. Então:

- `valor` = **o número já formatado com a unidade certa** — `"2,4 s"`, `"187 ms"`, `"0,08"`.
- `fonte` = `"p75 de campo · CrUX 2026-08-10→2026-09-06 · todos os dispositivos · meta ≤ 2,5 s: dentro"`.

Isso entrega FR-005, FR-006, FR-007, FR-010 e FR-013 **sem tocar em `Cel`, sem componente novo,
sem coluna nova**. `formatarCifra()` já devolve string não-monetária intacta
(`celulas.tsx:101-104`), então o diff de apresentação é zero.

FR-004 sai **por construção**: sem dado não há `valor`, e `naoApurada()` não tem onde pendurar
classificação. Não existe caminho no código que classifique uma ausência.

**Alternativa rejeitada**: um quinto estado de célula, ou um campo `veredito` no envelope. Mexeria
em `combinar()`, `validarKrs()`, `agruparPorMotivo()` e nos pontos que leem célula — para exibir
uma palavra que cabe na `fonte`.

**Limites do board, fixos** (FR-006/FR-007): LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1 ·
TTFB ≤ 600 ms, com o ideal de 300 ms exibido **ao lado**, nunca no lugar do limite.

---

## D5 — "Experimental" é lido do **prefixo da chave**, não de uma lista nossa

**Decisão**: o TTFB chega como `experimental_time_to_first_byte`. O rótulo "experimental" da
FR-008 vem de o nome começar com `experimental_` — não de uma constante `["ttfb"]` no nosso
código.

**Rationale**: se o Google promover a métrica, a chave perde o prefixo e a nossa rotulagem para
sozinha, sem commit. Uma lista fixa continuaria chamando de experimental uma métrica que deixou
de ser — a mesma classe de defeito do detector congelado que já mordeu esta casa.

**Ausência não contamina**: os quatro vitais são lidos do mesmo `record`, cada um com o seu
acesso opcional. Sumir o `experimental_time_to_first_byte` deixa o TTFB sem amostra e **os outros
três intactos** (FR-008, segunda metade).

---

## D6 — `rotuloBuraco: "falhou-agora"` é **propagado**, não inferido por regex

**Decisão**: `montarN5()` (`lib/ficha.mjs:527-542`) hoje só sabe emitir
`naoApurada(motivo, consultar, id)` — sem `rotuloBuraco`. A tela então cai no fallback
`EH_FALHA_TRANSITORIA = /indispon[íi]vel/i` (`celulas.tsx:86-90`). Mudança: `montarN5()` passa
`celula.rotuloBuraco` adiante quando a entrada trouxer um.

**Rationale**: a alternativa era escrever a palavra "indisponível" dentro da mensagem só para
casar uma regex — acoplamento por string, num texto que qualquer revisão de UX writing pode
reescrever e quebrar em silêncio. A 018 criou `rotuloBuraco` exatamente para isso e definiu a
precedência (`rotuloBuraco` primeiro, regex só como fallback). Três linhas, dentro do contrato
que já existe.

---

## D7 — O Pass Rate mora na **aba de aquisição**, não em N5

**Decisão**: o Pass Rate (FR-009) **não** entra em `MEDIDORES.D2`. Vai para
`app/okr/[slug]/aquisicao/page.tsx`, ao lado dos KPIs de board que a 021 e a 022 puseram lá.

**Rationale**, dois motivos independentes:

1. `MEDIDORES` **é o espaço de chaves de `n5:`** (`lib/ficha.mjs:149-155`) — `validarKrs()` casa
   KR por igualdade exata contra ele. Criar `cwv-pass-rate` ali criaria uma chave de KR que
   aponta para uma fração de URLs, não para um vital de um alvo. São escopos diferentes de
   medição, que é justamente o que a spec proíbe misturar em Edge Cases.
2. A aba já tem tudo: `revalidate = 3600`, a lista de URLs em mãos via `porUrl()`
   (`lib/kpis-busca.mjs:44`), e é onde `activeIndexRatio` e `queryToPageRatio` já vivem.

**Custo e cap**: uma chamada CrUX **por URL**. Consultar as URLs de maior impressão até um teto
declarado na tela; as demais entram no texto como "não consultadas", nunca como reprovadas. O cap
é uma constante do módulo puro, testável sem gastar chamada.

**Previsão**: pela 021, a Atma tem 8 URLs com impressão em 28 dias e uma concentra 13.262 delas.
A expectativa realista é `404` em quase todas — e então a tela sai com a **explicação** da US3,
que é o resultado correto, não um defeito.

---

## D8 — `projetosDeBusca()` **não existe**; o escopo sai de uma constante local

**Achado que corrige a spec.** `grep -rn "projetosDeBusca\|SLUGS_DE_BUSCA"` no repo inteiro
devolve **duas ocorrências, ambas dentro da própria `spec.md`**. As corridas de busca que existem
percorrem `(await listProjects()).filter((p) => p.url)` — **todos** os projetos com URL
(`app/api/gsc-serie/route.ts:29`, e o mesmo em `/api/indexacao`).

**Decisão**: `SLUGS_DE_CAMPO = ["atma"]` como constante exportada de `lib/crux.mjs`, checada
antes de qualquer chamada. Como esta feature lê no render de **um** projeto por vez (D1), o
filtro é um `if` — não uma fila.

**Projeto fora da lista não muda de comportamento**: a chave simplesmente não entra em
`disponiveisN5`, e os quatro medidores continuam dizendo "sem coletor nesta requisição", que é o
que dizem hoje e é verdade. **Zero diff para os outros 34 projetos.**

**Alternativa rejeitada**: escrever `projetosDeBusca()` agora. Seria uma abstração com um
consumidor, para unificar duas corridas que não pediram para ser unificadas. Quando a 021 e a 022
precisarem do mesmo filtro, ele nasce lá, com dois consumidores reais.

---

## D9 — A credencial falha **na célula**, não em `503`

**Decisão**: `CRUX_API_KEY` nova, vazia no `.env.example`. Ausente, produz
`naoApurada("CRUX_API_KEY ausente", …)` nos quatro medidores — nomeando **apenas a variável**
(FR-011), nunca valor, prefixo ou comprimento.

**Rationale**: o Princípio V manda **rota** validar ambiente na entrada e responder `503` com só
os nomes. Aqui não há rota (D1) — o equivalente numa leitura de render é a célula. E a FR-012
proíbe o contrário: a ficha não pode virar erro por causa de um medidor. Toda a leitura da CrUX
vive dentro de um `try` cujo `catch` vira célula, no mesmo idioma de `lerApuracao()`
(`aquisicao/page.tsx:47-54`).

**É a primeira credencial desta série que não reusa a do Search Console** — a CrUX aceita chave de
API simples do Google Cloud, sem service account e sem OAuth.

---

## D10 — `lib/crux.mjs` puro + `lib/crux.ts` borda

**Decisão**, direto do Princípio III:

- **`lib/crux.mjs`** — sem `fetch`, sem `process.env`, sem relógio. Recebe a leitura já resolvida
  (record, ausência ou falha) e devolve as células prontas: parse do p75, formatação por medidor,
  classificação contra o board, rótulo de experimental, período de coleta, Pass Rate,
  `SLUGS_DE_CAMPO`.
- **`lib/crux.ts`** — só o `fetch`, a chave e a tradução de status HTTP nos três estados da D3.

É essa separação que torna todo o comportamento caro — a distinção 404/falha, a formatação de
cada unidade, as bordas de 2,4 s vs 2,6 s, o Pass Rate de amostra 1 — testável **sem gastar uma
chamada e sem subir o Next**.

**Teste**: `test/crux.test.mjs`, registrado na lista de `package.json` **no mesmo commit**
(Princípio II). `test/validade.test.mjs` reprova se esquecermos.

---

## Quota — a confirmar na primeira corrida

A documentação da CrUX cita um limite por minuto por chave. Como a 022 fez com a quota da URL
Inspection: **o número entra no plano como "a confirmar", não como fato**. O consumo real desta
feature é 1 chamada por render da ficha da Atma, mais até o cap de chamadas por render da aba de
aquisição (cacheado por 1 h). Um hub interno com um punhado de leituras por dia não chega perto
de nenhum teto plausível — mas o número medido substitui esta frase assim que existir.
