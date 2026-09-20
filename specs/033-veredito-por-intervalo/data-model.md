# Fase 1 — Modelo de dados

**Feature**: 033 · O veredito sai do intervalo da amostra | **Data**: 2026-09-20

Nenhuma tabela nova, nenhuma migração, nenhuma escrita. As entidades abaixo são **estruturas em
memória** produzidas por `lib/*.mjs` a partir da leitura por página do Search Console. Elas existem
como `@typedef` JSDoc para que o `tsc` recuse na borda quem ler um campo que não existe naquele
estado — o mesmo mecanismo que `lib/benchmark.mjs` usa para separar `LeituraComparavel` de
`LeituraRecusada`.

---

## 1 · `Amostra`

O que foi medido, numa janela, sobre uma página ou uma faixa.

| Campo | Tipo | Regra |
|---|---|---|
| `impressoes` | `number` | ≥ 0. É o denominador de tudo nesta feature |
| `cliques` | `number` | ≥ 0, ≤ `impressoes` |
| `posicao` | `number` | média ponderada da janela, ≥ 1. Pode ser `11,000000000000002` — nunca re-agregada |
| `ctr` | `number \| null` | `cliques / impressoes`, e **`null` quando `impressoes === 0`**. Nunca `0` |

**Validação**: `ctr` nulo com `impressoes === 0` é a regra que já existe em `ctr()` e não muda —
exibir 0% para uma página que ninguém viu inventa desempenho ruim onde não houve medição.

---

## 2 · `Intervalo`

O intervalo de confiança da própria amostra. É o que substitui o piso de impressões.

| Campo | Tipo | Regra |
|---|---|---|
| `inferior` | `number` | `0 ≤ inferior ≤ superior` |
| `superior` | `number` | `inferior ≤ superior ≤ 1` |
| `confianca` | `number` | `0.95`, constante da feature |
| `metodo` | `"wilson"` | literal. Existe para a tela poder declarar o método, não para variar |

**Validação**: `null` inteiro quando `impressoes <= 0` — não há intervalo de uma amostra que não
existe. Limite fora de `[0,1]` é bug, não estado: a FR-003 proíbe, e o teste cobra nas duas bordas
(`k = 0` e `k = n`).

---

## 3 · `Regua`

O CTR mínimo esperado para a faixa, com a condição sob a qual vale.

| Campo | Tipo | Regra |
|---|---|---|
| `ctr` | `number \| null` | `null` é a faixa sem régua (página 2), e é **dado**, não chave faltando |
| `fonte` | `string` | obrigatório quando `ctr !== null` |
| `url` | `string` | obrigatório quando `ctr !== null` |
| `acessadoEm` | `string` | `AAAA-MM-DD` — quando o hub olhou |
| `medidaEm` | `string` | `AAAA-MM-DD` — quando a **curva** foi reconstruída. Hoje `"2025-05-28"`, a data real que o próprio repositório já corrige contra o `2025-12-23` que a versão anterior afirmava. FR-008 |
| `serp` | `string` | a SERP que a régua **julga** — hoje `"SERP real do Search Console, com resposta gerada por IA em ~31% das buscas"`. FR-008 |
| `serpDaFonte` | `string` | a SERP em que a **referência** foi medida — hoje `"SERP limpa, sem resposta gerada por IA"`. É outro fato, por isso outro campo: o hub cobra 25/13/8% contra os 39,8/18,7/10,2% da referência **porque** as duas SERPs são diferentes |
| `cadencia` | `string` | `"mensal"` — o que torna a idade da régua cobrável |

**Transição de estado**: nenhuma. A régua é estática nesta feature (Assumptions da spec). O que muda
é a decisão sobre se a amostra pode ser comparada a ela.

**A idade é derivada, nunca armazenada**: `medidaEm` + `cadencia` dão a idade no momento do render.
Em 20/09/2026 são **16 meses**, quinze reconstruções atrás. Campo calculado porque idade gravada
envelhece em silêncio — é `dado velho` sem carimbo, uma dimensão acima do que esta spec conserta.

---

## 4 · `Veredito`

O tipo central. Três valores, mais a ausência de régua.

```
"atinge" | "abaixo" | "indecisa" | null
```

| Valor | Condição | Entra no denominador? | Entra no numerador? |
|---|---|---|---|
| `"atinge"` | `inferior >= regua` | **sim** | **sim** |
| `"abaixo"` | `superior < regua` | **sim** | não |
| `"indecisa"` | o intervalo atravessa a régua | **não** — e é contada e nomeada | não |
| `null` | `regua === null` ou `impressoes === 0` | **não** | não |

**Invariante cobrável**: `decididas = atinge + abaixo`, e
`total = decididas + indecisas + semRegua + semImpressao`. O teste soma as quatro e compara com a
contagem de entrada. É o que impede o denominador de encolher por um caminho que ninguém declarou —
o defeito de `consertar_o_numerador_expoe_o_denominador`.

---

## 5 · `FaixaDePosicao`

Uma das seis faixas. Derivada de `BENCHMARK` (ver `research.md` §R4), não escrita à mão.

| Campo | Tipo | Regra |
|---|---|---|
| `rotulo` | `string` | `"Posições 4 a 6"` — rótulo de tela, **nunca** chave |
| `de` | `number` | inclusivo |
| `ate` | `number` | **exclusivo**, contíguo com a faixa seguinte |
| `regua` | `Regua` | `ctr: null` na faixa 11 a 20 |
| `amostra` | `Amostra` | somada das páginas cuja `posicao` cai na faixa |
| `intervalo` | `Intervalo \| null` | `null` sem impressão |
| `veredito` | `Veredito` | pela regra da §4 |
| `paginas` | `number` | quantas URLs caíram nesta faixa |
| `janela` | `Janela` | a janela declarada, propagada de `descoberta()`. FR-004 |

**Validação**: a soma de `paginas` das seis faixas + as páginas acima de 20,0 = total de URLs com
impressão. Nenhuma página em duas faixas, nenhuma fora de todas abaixo de 21,0.

---

## 6 · `ConformidadeDeCtr`

O Índice de Conformidade nas **duas** leituras da FR-010, num objeto só — porque separá-los em duas
funções os deixaria sair de sincronia, e é o par que a FR-011 precisa.

| Campo | Tipo | Regra |
|---|---|---|
| `porPagina.fracao` | `number \| null` | `atingem / decididas`. `null` quando `decididas === 0` |
| `porPagina.atingem` | `number` | numerador |
| `porPagina.decididas` | `number` | denominador — as que a amostra julga |
| `porPagina.meta` | `[0.75, 0.80]` | **a meta do board vive aqui, e só aqui** |
| `porTrafego.fracao` | `number \| null` | impressões em páginas que atingem ÷ impressões decidíveis |
| `porTrafego.impressoesQueAtingem` | `number` | numerador |
| `porTrafego.impressoesDecididas` | `number` | denominador |
| `porTrafego.meta` | `null` | **obrigatoriamente `null`** — o board nunca definiu uma. FR-010 |
| `indecisas` | `number` | contadas e exibidas ao lado. FR-002 |
| `semRegua` | `number` | acima de 10,9, sem faixa com fonte |
| `semImpressao` | `number` | URLs sem impressão na janela |
| `abaixo` | `Array` | as decididas-e-abaixo, ordenadas por impressões |
| `nomeada` | `PaginaNomeada \| null` | a resposta da FR-012 |
| `janela` | `Janela` | FR-004 |

**Por que `porTrafego.meta` é um campo com `null` em vez de campo ausente**: campo ausente é
indistinguível de esquecimento. `null` afirma que fomos olhar e o board não definiu. O teste reprova
`porTrafego.meta !== null` — é a trava que impede alguém copiar a meta da leitura vizinha por
simetria, que é exatamente como duas leituras viram dois números disputando a mesma frase numa
reunião.

**Medido na Atma em 20/09/2026** (o caso de referência do teste):
`porPagina = 25,0% (1 de 4)` · `porTrafego = 2,5% (583 de 22.899)` · `indecisas = 20` · `semRegua = 5`.

---

## 7 · `PaginaNomeada`

A resposta de nível 1 quando `decididas < LIMIAR_PAGINAS_DECIDIDAS` (= 20).

| Campo | Tipo | Regra |
|---|---|---|
| `url` | `string` | a de **maior impressão entre as decididas** — não a pior |
| `impressoes` | `number` | base dela |
| `participacao` | `number` | `impressoes ÷ impressões decidíveis` — **93,9%** na Atma, e não os 87,2% sobre o tráfego do site inteiro. A tela **nomeia a grandeza** ("do tráfego decidível"), pelo mesmo motivo da FR-010. Existe para a troca de página nomeada entre duas leituras ser visível |
| `ctr` | `number` | o CTR real dela |
| `regua` | `number` | a régua da posição **dela** |
| `posicao` | `number` | a posição média dela |
| `veredito` | `"atinge" \| "abaixo"` | nunca `"indecisa"` — a lista de onde ela sai é a das decididas |
| `cliquesFaltantes` | `number \| null` | `round(impressoes × regua) − cliques`, `null` quando já cobre |

**Regra de seleção, e o que ela NÃO é**: maior impressão, não pior desempenho. O edge case da spec é
explícito — se a maior estiver acima da régua, a frase diz isso. Inverter para "a pior" faria a tela
procurar problema mesmo quando não há, e um painel que só sabe dar má notícia é ignorado na terceira
semana. Empate de impressões resolve pela URL alfabeticamente menor, para duas leituras da mesma
janela não devolverem páginas diferentes (mesma regra de `termoPrincipal()`).

**Medido na Atma em 20/09/2026**: `/blog/quanto-custa-alinhador-invisivel` · 21.500 impressões ·
**94% do tráfego decidível** (21.500 de 22.899) · CTR 1,28% · régua 2,00% na posição 7,3 ·
**faltam 155 cliques**.

---

## Os cinco estados de tela

Derivados do passo 2 do harness: são os que **este dado de fato produz**, não os sete por reflexo.

| Estado | Quando | Glifo + texto | O leitor precisa |
|---|---|---|---|
| **decidido** | `veredito` é `atinge` ou `abaixo` | `▲ atinge` · `▼ abaixo` | ler o veredito e a base |
| **amostra não decide** | `veredito === "indecisa"` | `◐ a amostra não decide` | saber que há dado e que ele não resolve — **com a base** |
| **sem régua nesta faixa** | `regua.ctr === null` | `○ sem régua nesta faixa` | ver o CTR real e saber que não há o que julgar |
| **o site não aparece aqui** | `impressoes === 0` na faixa | `∅ o site não aparece aqui` | saber que é ausência de impressão, não CTR zero |
| **erro na fonte** | `gscPaginas()` devolveu `{erro}` | o erro, nomeado | saber que **não é zero** |

Regras que valem para os cinco, e que não são negociáveis:

- **Nunca cor como único portador.** O veredito é geometria (segmento contra tique) + glifo + texto.
  Em tons de cinza os três estados continuam distinguíveis — é a SC-006.
- **Nunca `0%` no lugar de ausência.** `erro` não vira `0`, `sem impressão` não vira `0`.
- **O bloco não muda de tamanho entre estados.** Bloco que encolhe sem dado reorganiza a página.
- **A procedência acompanha os cinco**: janela, base e a régua contra a qual foi julgado. FR-004.
- **O estado é texto e chega ao leitor de tela** — nunca só `title`, nunca só o glifo.
- **`null` de `gscPaginas()`** ("não há onde olhar": env desligada, nenhum host com propriedade) é
  distinto de `{erro}` (falha transitória). Colapsar os dois faz "sem propriedade" mentir quando era
  timeout.

## O que a FR-011 exige do modelo

O par `porPagina` + `porTrafego` **é** o portador da distinção: o índice por página sobe de 12,5%
para 25,0% sem que nenhuma página tenha melhorado, só porque 20 indecisas saíram do denominador.
`decididas` sendo campo exposto — e não um número interno — é o que permite a tela dizer que a
variação pode vir do denominador. É por isso que `decididas`, `indecisas`, `semRegua` e
`semImpressao` são todos campos públicos, e não derivados que a tela recalcula.
