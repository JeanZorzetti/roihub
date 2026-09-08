# Data Model: Medidores de Entrega

**Feature**: 023 | **Data**: 2026-09-07 | **Spec**: [spec.md](./spec.md) ·
**Pesquisa**: [research.md](./research.md)

Nenhuma entidade persistida. **Não há tabela nova, não há migração, não há `ensure()`** — a
decisão D1 lê a fonte no render, e a CrUX serve o próprio histórico. Todas as entidades abaixo
existem apenas dentro de uma requisição.

---

## 1. `Vital` — o catálogo dos quatro

Constante do módulo puro. É ela que amarra a chave da fonte, a chave da ficha, a unidade e o
limite do board num lugar só — três listas separadas divergiriam na primeira mudança.

| campo | tipo | o que é |
|---|---|---|
| `id` | `"lcp" \| "inp" \| "cls" \| "ttfb"` | a chave em `MEDIDORES.D2` (`lib/ficha.mjs:153`), já existente |
| `chaveCrux` | `string` | `largest_contentful_paint`, `interaction_to_next_paint`, `cumulative_layout_shift`, `experimental_time_to_first_byte` |
| `limite` | `number` | o limite do board, na unidade CRUA da fonte: `2500`, `200`, `0.1`, `600` |
| `ideal` | `number \| null` | só o TTFB tem: `300` (FR-007). Os outros três são `null` — não inventar alvo onde o board não deu |
| `unidade` | `"s" \| "ms" \| null` | `null` no CLS, e é daí que a FR-013 sai por construção |

**Invariante**: `id` ∈ `MEDIDORES.D2`. Um `id` fora do catálogo não teria onde aparecer na ficha
— o teste amarra as duas listas.

---

## 2. `LeituraDaFonte` — os três estados da D3, antes de virar célula

A saída da borda (`lib/crux.ts`) e a entrada do módulo puro. **União fechada de três**, porque é
o colapso dos dois últimos que a FR-003 proíbe:

```
| { estado: "record", record: RecordCrux }   // a fonte respondeu com dado
| { estado: "sem-amostra" }                  // HTTP 404 — o alvo não tem visitas suficientes
| { estado: "falhou", erro: string }         // timeout, 5xx, 403, 429, rede, JSON inválido
```

- `erro` é **truncado em 60 caracteres**, como em `app/api/gsc-serie/route.ts:60`, e nunca
  carrega valor de ambiente (Princípio V).
- `"sem-amostra"` **não tem** campo de erro de propósito: ausência de observação não é falha, e
  dar-lhe uma mensagem de erro convidaria a tela a exibi-la como tal.
- Chave ausente é um quarto caso tratado **antes** da chamada, não aqui: a borda nem chega a
  fazer `fetch` (D9).

---

## 3. `RecordCrux` — só o que lemos da resposta

Recorte deliberado: o que não é lido não entra no modelo, para não haver campo que a tela possa
exibir sem ninguém ter decidido que ele deve aparecer.

| campo | tipo | uso |
|---|---|---|
| `metrics` | `Record<string, { percentiles: { p75: number \| string } }>` | o p75 de cada vital (FR-001) |
| `collectionPeriod` | `{ firstDate: DataCrux, lastDate: DataCrux }` | a janela **da fonte** (FR-005) |
| `key.origin` | `string \| undefined` | o alvo que a fonte de fato mediu |

`DataCrux` = `{ year, month, day }`, três números — a CrUX **não** manda ISO. A conversão para
`YYYY-MM-DD` mora no módulo puro e é testada, porque `month` é 1-based ali e 0-based no `Date` do
JS, que é o tipo de erro que passa despercebido por um mês inteiro.

`p75` pode vir **número ou string** (o CLS costuma vir string). O parse normaliza para número e
devolve ausência quando não é finito — nunca `NaN` adiante.

---

## 4. `Medida` — um vital apurado de um alvo

O produto útil do módulo puro. É o que a spec chama de "Medida de campo".

| campo | tipo | o que é |
|---|---|---|
| `vital` | `Vital` | qual dos quatro |
| `p75` | `number` | o valor cru, na unidade da fonte (ms, ou índice no CLS) |
| `janela` | `{ inicio: string, fim: string }` | `YYYY-MM-DD`, **da fonte** (FR-005) |
| `dispositivo` | `"todos"` | fixo nesta versão (FR-010), declarado e não inferido |
| `experimental` | `boolean` | `chaveCrux.startsWith("experimental_")` (D5) |
| `veredito` | `"dentro" \| "fora"` | `p75 <= vital.limite` (FR-006) |

**Invariante que carrega a FR-004**: `Medida` só existe com `p75` finito. Não há `Medida` sem
valor, portanto não há caminho no código que produza veredito sobre uma ausência — a garantia é
do tipo, não da disciplina de quem escreve a tela.

**Bordas de `veredito`** (o que o teste fixa): `2500` é `dentro`, `2501` é `fora`. O limite é
inclusivo porque o board diz "≤".

---

## 5. `CelulaDeVital` — a saída para `disponiveisN5`

O contrato que **já existe** em `lib/ficha-dados.ts:187`. Esta feature não o estende (D4):

```
{ valor: string, fonte: string }                       // apurado
| { naoApurado: string, rotuloBuraco?: "falhou-agora" } // ausente ou falho
```

**`valor`** — o número **já formatado**, e é aqui que a FR-013 acontece:

| vital | formato | exemplo |
|---|---|---|
| LCP | segundos, 1 casa, vírgula decimal | `"2,4 s"` |
| INP, TTFB | milissegundos inteiros | `"187 ms"` |
| CLS | índice, 2 casas, **sem unidade** | `"0,08"` |

**`fonte`** — o rodapé que `Cel` imprime entre parênteses, montado sempre na mesma ordem:

```
p75 de campo · CrUX 2026-08-10→2026-09-06 · todos os dispositivos · meta ≤ 2,5 s: dentro
```

e, no TTFB, o ideal entra **ao lado** do limite, nunca no lugar dele (FR-007):

```
… · meta ≤ 600 ms (ideal < 300 ms): dentro · experimental na fonte
```

**`naoApurado`** — três textos distintos, e é a distinção inteira da FR-003:

| origem | `naoApurado` | `rotuloBuraco` |
|---|---|---|
| `sem-amostra` (404) | `sem amostra suficiente na fonte de campo para <alvo>` | ausente |
| `falhou` | `CrUX indisponível (<erro>)` | `"falhou-agora"` |
| chave ausente | `CRUX_API_KEY ausente` | ausente |
| métrica sumiu do record | `sem amostra suficiente na fonte para <vital>` | ausente |

`consultar` (obrigatório em `naoApurada()`, R4) é preenchido pela borda de `montarN5()` com o
alvo e a fonte — nunca vazio, nunca "instrumentar".

**Ausência da chave não é buraco transitório**: sem `rotuloBuraco`, ela lê "não apurado", que é
o certo — a variável não está configurada, e isso não se conserta esperando.

---

## 6. `Alvo` — origem e URL não se somam

Duas formas, e a spec proíbe explicitamente misturá-las numa média:

```
{ tipo: "origem", valor: "https://www.atma.com.br" }
| { tipo: "url",  valor: "https://www.atma.com.br/blog/quanto-custa-alinhador-invisivel" }
```

O `Alvo` aparece **no texto** de toda célula (apurada ou não): é ele que impede a leitura errada
que a spec descreve em Edge Cases — exibir a distribuição do site inteiro no lugar da de uma
página. A ficha (N5) usa **apenas** `tipo: "origem"`; o Pass Rate usa **apenas** `tipo: "url"`.
Não há função que receba os dois e devolva um número.

---

## 7. `PassRate` — a fração, ou o motivo de não haver uma

Entidade da aba de aquisição (D7). Só três dos quatro vitais entram: **LCP, INP e CLS** — TTFB é
experimental e não faz parte da definição de "Bom" do relatório do board.

| campo | tipo | o que é |
|---|---|---|
| `consultadas` | `number` | quantas URLs foram perguntadas à fonte (≤ o cap) |
| `comDado` | `number` | quantas responderam com record — **o denominador** |
| `passam` | `number` | quantas têm os três vitais `dentro` |
| `fracao` | `number \| null` | `passam / comDado`, ou `null` |
| `motivo` | `string \| null` | preenchido **exatamente quando** `fracao` é `null` |

**A regra que a FR-009 exige, como invariante do tipo**: `fracao` é `null` sempre que
`comDado < 2`. Uma URL com dado devolve `motivo`, nunca `1` — que é o "100% de amostra de um"
que a spec proíbe nominalmente.

**Nunca há `fracao` e `motivo` simultâneos, nem ambos `null`.** Exatamente um dos dois. É o que
faz a tela ser incapaz de exibir uma fração sem denominador ou um silêncio sem explicação.

O texto do `motivo` nomeia o número que existe (`comDado`), não só a ausência — SC-006 pede que
quem lê entenda que é característica do site:

> Pass Rate por URL não é apurável: das 8 URLs consultadas, 1 tem dado de campo. A fonte só
> reporta URL com visitas suficientes, e o tráfego da Atma está concentrado numa página só.

---

## 8. `SLUGS_DE_CAMPO` — o escopo (FR-014)

`["atma"]`, constante exportada do módulo puro (D8 — `projetosDeBusca()` não existe no repo).

Projeto fora da lista **não produz célula nenhuma**: a chave não entra em `disponiveisN5`, e
`montarN5()` mantém o `"sem coletor nesta requisição"` que já exibe hoje. Zero diff de
comportamento para os outros 34 projetos, e zero chamada de rede gasta por eles.

---

## Relações

```
SLUGS_DE_CAMPO ─── decide se há chamada
                        │
                     Alvo (origem)                    Alvo (url) × N ≤ cap
                        │                                   │
                 LeituraDaFonte                       LeituraDaFonte
                   3 estados                            3 estados
                        │                                   │
              ┌─────────┴─────────┐                         │
         Medida × 4          (ausência)                Medida × 3 por URL
         (p75 + veredito)          │                         │
              └─────────┬─────────┘                    PassRate (comDado ≥ 2 ⇒ fracao)
                CelulaDeVital × 4                            │
                        │                                    │
              disponiveisN5 → montarN5()            aba de aquisição
                        │
                     N5, família D2
```

`Vital` é o único ponto onde a chave da fonte, a chave da ficha, a unidade e o limite do board se
encontram. Tudo mais deriva dele.
