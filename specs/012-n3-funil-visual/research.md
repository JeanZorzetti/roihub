# Research: N3 — Funil Visual

**Fase 0** | **Branch**: `012-n3-funil-visual` | **Date**: 2026-09-02

A spec deixou **um** ponto em aberto para esta fase (Assumptions): "a fórmula exata de escala
(valor absoluto vs. normalizado) é decisão de implementação... fica para o `/speckit-plan`". Ele é
o D2 abaixo. Os demais são decisões que a implementação precisa ter fechado antes de virar tarefa.

---

## D1 — O segmento é a TAXA, não o marco

**Decisão**: o funil tem um segmento por elemento de `ficha.taxas`, na ordem, 1:1 com as linhas de
texto que `montarN3()` já produz.

**Rationale**: N3 responde "quanto se perde em cada etapa?" — a unidade da pergunta é o vazamento
entre dois degraus, não o degrau. `montarN3()` já mapeia `ficha.taxas` uma linha por taxa; a FR-003
exige que o segmento use "o mesmo estado que já rege a linha de texto correspondente", e
correspondência só existe se as duas listas tiverem o mesmo tamanho e a mesma ordem.

Confere com o AS-1 da spec: `atma` é perfil D, 6 marcos → **5 taxas**, e só a primeira
(`visitante → lead`, `6,67% (35/525)`) é apurada. Cinco segmentos, o primeiro preenchido, quatro
hachurados — que é literalmente o cenário escrito.

Confere também com a FR-002 (nunca fixo em 5): A, B e C têm 5 marcos → **4 taxas**. A contagem sai
de `n3.celulas.length`, sem `switch` por perfil (SC-003).

**Alternativas consideradas**:

- *Segmento por marco (6 para o perfil D)*: desenharia `525 → 35 → ? → ? → ? → 0` literalmente,
  mas quebraria a correspondência com as 5 linhas de texto e faria o leitor casar 6 formas com 5
  parágrafos. Rejeitada pela FR-003/FR-004.
- *Segmento por marco com as arestas rotuladas*: rótulo dentro do SVG conflita com a FR-008
  (decorativo) e com a R2 (a fração colada mora no texto). Rejeitada.

---

## D2 — Escala: normalizada uma vez por cadeia, pelo maior marco apurado

**Decisão**: calcular uma altura por **marco**, `h(m) = valor(m) / base`, onde `base` é o maior
`valor` entre os marcos **apurados** da cadeia. Cada segmento apurado é o trapézio entre `h` do seu
denominador e `h` do seu numerador. Segmento não apurado não recebe altura nenhuma.

**Rationale**: o numerador de uma taxa é, por construção de `montarFicha()`, o denominador da
seguinte (`marcos.slice(1).map(...)`). Uma normalização única faz as arestas coincidirem: dois
degraus apurados seguidos formam um afunilamento contínuo, e o desenho passa a dizer o que a frase
"encolhe conforme desce a cadeia" promete. Com normalização por segmento, cada trapézio recomeçaria
na altura cheia e a cadeia inteira pareceria não perder nada.

A base é o maior marco **apurado** (na prática o topo, `visitante`/`contato`) e não o primeiro
marco: se o topo estiver não apurado e o meio não, o desenho ainda existe e continua honesto — só
não afirma nada sobre o topo.

Casos de borda:

- **Todos os marcos apurados valem 0** (`base = 0`): nenhuma divisão é feita; toda altura é 0. O
  funil vira uma linha, que é a leitura correta de "nada chegou". Sem `NaN`, sem `Infinity`.
- **Taxa muito pequena** (`6,67%` → 3,2 unidades de 48): piso de 1,5 unidade **somente quando o
  valor é maior que zero**, para que um `0,2%` não desapareça. `0` medido desenha `0` — o piso
  existe para não sumir com número pequeno, nunca para dar corpo a zero (R1).

**Alternativas consideradas**:

- *Largura proporcional em vez de altura*: a largura já é o eixo da ordem da cadeia; usá-la para
  valor faria degrau raro virar fatia fina e ilegível, e um degrau não apurado não teria largura
  definida — quebraria o alinhamento 1:1 com o texto.
- *Escala logarítmica*: legível para `525 → 35`, mas mente sobre a proporção, que é justamente o
  que a tela existe para mostrar. Rejeitada.
- *Produto acumulado das taxas (funil cumulativo clássico)*: exigiria um número para os degraus não
  apurados — inventar `100%` ou herdar do vizinho. É a R6 caindo por dentro. Rejeitada.

---

## D3 — Não apurado é hachura, nunca cor sozinha nem barra vazia colorida

**Decisão**: segmento não apurado é um `<rect>` de altura fixa (a caixa inteira do slot) preenchido
com um `<pattern>` de linhas diagonais e contornado por `--grid`. Nenhum trapézio, nenhum
preenchimento sólido, nenhum número.

**Rationale**: FR-003 pede explicitamente "trilho vazio, padrão hachurado, nunca cor sozinha", e a
SC-002 mede 100% dos não apurados nesse padrão. A hachura é `<pattern>` nativo do SVG — zero JS,
zero dependência (FR-007).

Altura **fixa e cheia**, não zero: altura zero é a forma de um `0` medido (o `tratamento = 0` da
`atma`), e a R1 existe precisamente para que "não sei" e "zero" nunca se pareçam na tela.

**Alternativas consideradas**:

- *Segmento cinza sólido*: distingue por cor apenas; falha na FR-003 e some para quem imprime ou
  usa alto contraste.
- *Omitir o segmento não apurado*: o funil perderia a contagem de degraus, que é metade da SC-001.

---

## D4 — Decorativo para tecnologia assistiva

**Decisão**: `aria-hidden="true"` e `focusable="false"` no `<svg>`; nenhum `<title>`, `<desc>`,
`role` ou `tabindex`.

**Rationale**: FR-008. Cada segmento é a repetição de uma linha de texto que está logo abaixo,
completa e com o motivo. Anunciar os dois é obrigar quem usa leitor de tela a percorrer a cadeia
duas vezes, e a segunda passagem seria a pior — sem motivo, sem fonte, sem fração. `focusable="false"`
porque o IE/Edge legado punha `<svg>` na ordem de tabulação; custo zero manter.

**Alternativas consideradas**: `role="img"` + `<title>` resumindo a cadeia — duplicaria a leitura e
convidaria a resumir motivos dentro do SVG, que é exatamente a regressão da FR-004.

---

## D5 — Server Component puro, orçamento `js_kb: 0`

**Decisão**: o funil é uma função de render dentro de `app/okr/[slug]/page.tsx`, sem `'use client'`,
sem estado, sem efeito, sem tooltip.

**Rationale**: a direção corte-seco declara `js_kb: 0` para o chrome desta tela (`.art/log.json`) e
a SC-004 exige que o peso de JS não aumente. Markup renderizado no servidor custa bytes de HTML, não
de bundle. Tooltip — a tentação óbvia — traria `'use client'` e um estado a manter, para exibir um
motivo que já está escrito uma linha abaixo (AS-2 da User Story 2 diz isso explicitamente).

Herança visual: raio 0, sombra 0, sem `opacity` — os três limites da direção registrada. Cores
saem dos tokens já existentes em `app/globals.css` (`--seq550` para o preenchido, `--grid` para o
trilho e a hachura), sem hex solto.

---

## D6 — Onde a lógica mora

**Decisão**: `segmentosDoFunil()` exportada de `lib/ficha.mjs`, chamada dentro de `montarNiveis()`,
resultado anexado como `n3.funil`.

**Rationale**: Princípio III — a função é testável sem subir o Next, então DEVE nascer em `.mjs`.
Chamá-la dentro de `montarNiveis()` garante que ela receba as **mesmas** células que viram texto,
que é o que a FR-003 exige; derivar no `.tsx` a partir de `ficha.taxas` seria uma segunda régua, e
duas réguas divergem na primeira correção.

Bônus de Princípio II: as asserções entram em `test/ficha.test.mjs`, que **já está** na lista de
`npm test`. Nenhum arquivo de teste novo significa nenhuma chance de esquecer o registro.

**Alternativas consideradas**: `lib/funil-visual.mjs` novo. Um arquivo, um teste novo, uma linha no
`package.json` e um import a mais, para uma função de ~15 linhas que só o N3 chama. Rejeitada por
custo sem retorno.
