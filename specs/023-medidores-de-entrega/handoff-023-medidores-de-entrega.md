# Handoff 023 — Medidores de Entrega (Core Web Vitals de campo)

**Data**: 07/09/2026 · **Branch**: `023-medidores-de-entrega` · **Fonte**: CrUX API (Chrome UX
Report), chave simples do Google Cloud em `CRUX_API_KEY`.

## Os fatos MEDIDOS (T002) — número de documentação não é número medido

Tudo abaixo saiu de chamada real à fonte em 07/09/2026, não da documentação.

### 1. A origem da Atma é `https://atma.roilabs.com.br` — e TEM dado de campo

A spec e os contratos diziam `https://www.atma.com.br`. **É um domínio diferente e não existe na
CrUX** (404). A origem certa é a do card (`data/projects.json`, campo `url`), e ela responde 200.
Os documentos foram corrigidos. A lição é a de sempre nesta casa: a chave é a URL do card, nunca o
nome que a gente lembra — [[rotulo_de_exibicao_nunca_e_chave]].

### 2. O corpo do `404` confirma que ele é "sem amostra", e não outra condição

```json
{"error":{"code":404,"message":"chrome ux report data not found","status":"NOT_FOUND"}}
```

É o que a tradução de `lib/crux.ts` assumia. `404` = `"sem-amostra"` está confirmado.

### 3. `collectionPeriod` real: **2026-08-09 → 2026-09-05** (28 dias, fechando em D-2)

É a janela da FONTE, e não é a janela da ficha nem a da aba de aquisição. Por isso ela aparece
declarada em todo rodapé.

### 4. O TTFB experimental **veio** — e os quatro vitais estão dentro da meta

| medidor | p75 medido | meta do board | veredito |
|---|---|---|---|
| LCP | 1.844 ms → **1,8 s** | ≤ 2,5 s | dentro |
| INP | **106 ms** | ≤ 200 ms | dentro |
| CLS | **0,00** | ≤ 0,1 | dentro |
| TTFB | **487 ms** | ≤ 600 ms (ideal < 300 ms) | dentro do limite, **acima do ideal** |

`experimental_time_to_first_byte` está presente na origem e na URL. O record traz ainda
`round_trip_time`, `first_contentful_paint`, `form_factors` e
`largest_contentful_paint_resource_type`, que esta feature **não** lê — o que não é lido não entra
no modelo, para não haver campo que a tela possa exibir sem ninguém ter decidido que ele deve
aparecer.

### 5. `urlNormalizationDetails` EXISTE — e a normalização é silenciosa

Pedindo `https://atma.roilabs.com.br/` (com barra), a resposta volta com:

```json
"urlNormalizationDetails": {
  "originalUrl": "https://atma.roilabs.com.br/",
  "normalizedUrl": "https://atma.roilabs.com.br"
}
```

O campo vive no **topo da resposta**, não dentro de `record`. No caso da origem é só a barra final,
e `lib/ficha-dados.ts` passou a cortá-la antes de chamar — assim o alvo que a tela declara é
exatamente o que a fonte mediu. **Para alvos do tipo URL o risco continua real** e não está
instrumentado: se um dia o Pass Rate exibir URL a URL, ler `urlNormalizationDetails` deixa de ser
opcional.

### 6. Quota: **não é observável pelos headers**

Nenhum header `x-ratelimit`, `quota` ou equivalente na resposta. Não dá para afirmar qual é a cota
real sem estourá-la de propósito, e não vale gastar a cota para descobrir a cota. O que se sabe é
o que se mediu: 15 chamadas na sessão de implementação, zero `429`. `CAP_URLS_PASS_RATE = 10`
segura o consumo por render da aba de aquisição, que tem `revalidate = 3600`.

### 7. 🚩 A URL de blog responde 200 **sem INP** — parcial não é ausência

A URL que concentra o tráfego da Atma (`/blog/quanto-custa-alinhador-invisivel`) tem `record` com
LCP (1.849), CLS (0,00) e TTFB (542) e **não tem `interaction_to_next_paint`**. A fonte mede cada
vital separadamente, e URL com poucas interações não recebe INP.

Isso apareceu só porque o Pass Rate foi conferido contra a fonte depois de rodar: a primeira versão
contava essa URL como "sem dado de campo", **colapsando "não respondeu" com "respondeu parcial"** —
a mesma confusão que a FR-003 proíbe nas células. `passRate()` agora conta `parciais` e `falharam`
separadamente, e o motivo nomeia os três números.

## O que a tela mostra hoje

- **`/okr/atma/metodo`, N5** — a família **D2 — Entrega** aparece ao lado da família do gargalo
  (Persuasão), com a nota dizendo qual é qual e por quê. Os quatro vitais apurados, com
  `p75 de campo · origem … · CrUX 2026-08-09→2026-09-05 · todos os dispositivos · meta …: dentro`.
  Os outros quatro medidores de D2 (`uptime`, `taxa-5xx`, `build`, `certificado`) continuam
  honestamente em "sem coletor nesta requisição", colapsados no `<details>`.
- **`/okr/atma/aquisicao`** — o Pass Rate por URL **não é apurável na Atma**, exatamente como a
  spec previu: das 8 URLs consultadas, 0 têm os três vitais, 1 respondeu parcial. A tela explica,
  e **nunca** exibe 100% de uma amostra de um.
- **`/okr/goiania/metodo`** — nenhum bloco de Entrega, N5 idêntico ao de antes, zero chamada de
  rede gasta (FR-014).

## Placar do board (SC-001)

**11 → 16 de 28.** Quatro medidas passam a ser **exibidas** (LCP, INP, CLS, TTFB) e uma passa a ser
**explicada** (Core Web Vitals Pass Rate). Nenhum número de laboratório em tela nenhuma (SC-003).

## O que ficou fora, e por quê

- Os outros quatro medidores de D2 não estão no board. `certificado` já é verificado pelo check
  `VER-01` da conformidade sem estar ligado à ficha — candidato barato a uma spec futura, pelo
  mesmo padrão de "já existe e não está ligado".
- Recorte por dispositivo (celular × desktop): o agregado está declarado na tela. Separar entra
  quando o agregado esconder alguma coisa, não por antecipação.
- Histórico: a fonte serve o próprio (p75 semanal). Gravar aqui seria cache, não calendário.

## Pendência operacional

`CRUX_API_KEY` está no `.env` local. **Falta pôr a mesma variável na Vercel** (projeto `roihub`,
ambiente Production) e redeployar — sem ela a produção exibe, corretamente, `CRUX_API_KEY ausente`,
e a ficha não quebra.
