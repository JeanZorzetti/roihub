# Quickstart: validar os Medidores de Entrega

**Feature**: 023 | **Spec**: [spec.md](./spec.md) · **Contratos**:
[crux-mjs](./contracts/crux-mjs.md) · [crux-fonte](./contracts/crux-fonte.md)

Guia de validação, não de implementação. Os cenários abaixo provam a feature ponta a ponta; o
código está em `tasks.md` e na fase de implementação.

---

## Pré-requisitos

1. **A chave.** No Google Cloud, habilitar a **Chrome UX Report API** no projeto e criar uma
   chave de API simples. Não é service account, e **não** reusa a do Search Console.
2. `CRUX_API_KEY=<a chave>` no `.env` local. No `.env.example` ela fica **vazia** (Princípio V).
3. `npm i` já feito. Nenhuma dependência nova — a CrUX é `fetch` e JSON.

---

## Passo 0 — a suíte, antes de olhar tela nenhuma

```bash
npm test
```

Verde, **inteira** — não só `test/crux.test.mjs`. `test/validade.test.mjs` reprova se o arquivo
novo não estiver na lista de `package.json` (Princípio II). Os testes de `crux.mjs` rodam **sem
rede e sem chave**: toda a regra cara vive no módulo puro.

---

## Passo 1 — a fonte responde? (confirma a Assumption, não a documentação)

Antes de qualquer tela, medir o que a fonte de fato dá. Este passo é o equivalente do que a 022
fez com a quota da URL Inspection.

```bash
curl -s -X POST \
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"origin":"https://www.atma.com.br"}' | head -60
```

**Esperado**: `200` com `record.metrics` contendo `largest_contentful_paint`,
`interaction_to_next_paint`, `cumulative_layout_shift` e — provavelmente —
`experimental_time_to_first_byte`, mais `record.collectionPeriod`.

Anotar três coisas, que viram fato medido no handoff:

- Se o **TTFB experimental** veio. Se não veio, a US1 entrega 3 de 4 medidores e isso é o
  comportamento correto da FR-008 — não um defeito.
- O `collectionPeriod` real (a janela da fonte, FR-005).
- Se há `urlNormalizationDetails` — normalização silenciosa mediria outra página.

E o caso oposto, que é o que a US3 prevê:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=$CRUX_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.atma.com.br/blog/quanto-custa-alinhador-invisivel"}'
```

**`404` aqui é resultado, não erro** — é a ausência de amostra que molda a spec inteira.

---

## Passo 2 — US1: os quatro medidores na ficha

```bash
npm run dev
```

Abrir **`/okr/atma/metodo`** (a 019 mandou N0–N6 para lá) e descer até **N5**, família
**D2 — Entrega**.

⚠️ **Antes de conferir número nenhum, conferir que o bloco EXISTE.** A família D2 nunca foi
escolhida por `escolherFamilia()` — ver [D11](./research.md). Se o bloco de Entrega não aparecer
ao lado da família do gargalo, a T009a não foi feita e não há o que medir aqui.

| conferir | esperado |
|---|---|
| o bloco de Entrega | aparece **junto** com a família do gargalo, com a nota dizendo qual é qual (FR-002b) |
| LCP, INP, CLS, TTFB | valor **com unidade**, não "sem coletor nesta requisição" |
| CLS | `0,08` — **sem `s`, sem `ms`** (FR-013) |
| LCP | `2,4 s` — segundos, uma casa |
| rodapé de cada um | `p75 de campo · CrUX <início>→<fim> · todos os dispositivos · meta …` |
| TTFB | `meta ≤ 600 ms (ideal < 300 ms)` — os dois, o ideal **ao lado** (FR-007) |
| TTFB, se a fonte servir como experimental | ` · experimental na fonte` (FR-008) |
| os outros 4 medidores de D2 | continuam "sem coletor nesta requisição" — **fora do escopo, e é correto** |

**US1-AC4** está no rodapé: a tela diz que é p75 de campo e qual janela a fonte cobre. Se a linha
não diz, a FR-005 não está cumprida por mais certo que o número esteja.

---

## Passo 3 — US2: o veredito contra o board

Na mesma tela, cada medidor apurado termina em `dentro` ou `fora`.

Para provar a borda **sem esperar o site mudar**, o teste do módulo puro é a evidência:

```bash
node --test test/crux.test.mjs
```

Ele fixa `2500 → dentro` e `2501 → fora` (limite inclusivo, "≤" do board). Um LCP de 2,4 s
classificado como dentro e um de 2,6 s como fora é o **Independent Test** da US2, e ele roda em
milissegundos em vez de depender do desempenho real do site naquele instante.

---

## Passo 4 — os três estados, provados um a um (FR-003)

A distinção é a feature. Cada estado tem um jeito barato de forçar:

| estado | como forçar | esperado na tela |
|---|---|---|
| **sem amostra** | apontar o alvo para uma origem sem tráfego (`{"origin":"https://exemplo-sem-trafego.invalid"}` num teste do módulo, ou a URL do Passo 1 que deu `404`) | `sem amostra suficiente na fonte…`, lendo **"não apurado"** |
| **falhou agora** | `CRUX_API_KEY=chave-invalida npm run dev` (a fonte devolve `403`) | `CrUX indisponível (…)`, lendo **"falhou agora"** |
| **não configurado** | remover `CRUX_API_KEY` do `.env` e reiniciar | `CRUX_API_KEY ausente` — **só o nome da variável** (FR-011) |

Nos três casos, conferir o que **não** aparece:

- **nenhum `0`** (FR-004, SC-004);
- **nenhum `dentro`/`fora`** — ausência não é aprovação nem reprovação (US2-AC2);
- **a ficha inteira continua de pé** — cadeia, N1..N6, veredito, tudo (FR-012, e é o teste mais
  importante do Passo 4).

E o par que a FR-003 proíbe colapsar: os textos de **sem amostra** e de **falhou agora** têm de
ser **diferentes na tela**, não só no código.

---

## Passo 5 — US3: o Pass Rate, ou o motivo

Abrir **`/okr/atma/aquisicao`**.

Na Atma, a previsão da spec é que **quase nenhuma URL individual** tenha dado. O resultado
esperado é a **explicação**, não o número:

> Pass Rate por URL não é apurável: das 8 URLs consultadas, 1 tem dado de campo. …

| conferir | esperado |
|---|---|
| com `comDado < 2` | frase explicando, **nunca `100%`** (US3-AC2, o proibido nominalmente) |
| com `comDado >= 2` | fração contra a meta de **90%**, com o denominador declarado |
| sempre | quantas URLs foram consultadas e quantas responderam |
| nunca | fração e explicação ao mesmo tempo, nem nenhuma das duas |

Se a Atma acabar tendo duas URLs com dado, a fração aparece — e o mesmo teste do módulo puro já
cobriu os dois ramos sem depender de qual foi o dia.

---

## Passo 6 — os outros 34 projetos não mudaram (FR-014)

```bash
# abrir a ficha de um projeto fora de SLUGS_DE_CAMPO
open http://localhost:3000/okr/goiania/metodo
```

**Esperado**: **nenhum bloco de Entrega** — a D11 condiciona a exibição à presença de medida, não
ao slug, justamente para não pôr 8 linhas permanentes de "não apurado" em 34 fichas. O N5 sai
idêntico ao de antes desta feature, e **zero chamada de rede** é gasta.

Conferir na aba Network do navegador que **nenhum** POST para `chromeuxreport.googleapis.com` sai
nesse render. Escopo que só existe no texto não é escopo.

---

## Passo 7 — o placar (SC-001)

Contar no board: **11 → 16 de 28**. As cinco que mudam são LCP, INP, CLS, TTFB e o Pass Rate —
este último contando como **explicado**, que é o que a SC-006 pede e o que a US3 prevê para a
Atma.

**SC-003 é uma checagem de ausência**: nenhum número de Lighthouse ou PageSpeed na tela. Se em
algum momento um valor de laboratório entrar "só para não ficar vazio", a feature falhou —
`lighthouse_local_windows_onedrive_unreliable` e `goiania_lcp_root_causes` já pagaram por isso.

---

## Fechamento (Princípio IV)

`npm test` verde + commit + push. **Fora das janelas proibidas**: 23:30–01:00 e 08:00–08:45 BRT.
Push é deploy, e o deploy do roihub demora ~15 min — conferir a tela **duas vezes** antes de
concluir que não subiu.
