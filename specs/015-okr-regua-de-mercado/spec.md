# Feature Specification: Régua de mercado — segundo veredito da árvore OKR

**Feature Branch**: `015-okr-regua-de-mercado`
**Created**: 2026-09-03
**Status**: Draft
**Input**: Proposta aprovada em `handoff/okr-regua-de-mercado.md` (03/09/2026)

## Contexto

A `/okr` hoje devolve **um** veredito: a posição de ataque da §7 (`lib/okr.mjs`,
`posicaoDeAtaque()`), derivada só de fato apurado. Ela diz **que** um fator está zerado, nunca
**do tamanho de quê** — e não sabe dizer se `7,29%` é bom ou ruim, porque não tem referência
externa nenhuma.

Esta feature acrescenta um **segundo veredito, paralelo**: a distância de cada degrau apurado
para a faixa do mercado no vertical do projeto. A §7 continua mandando; a régua dimensiona.

### A tensão com a R6, e por que esta feature não a viola

A R6 do template (`benchmark é ontologia, nunca previsão`) nasceu de um defeito documentado em
`handoff/funil-seo/01-a-leitura-da-pesquisa.md`: empilhar o percentil de elite em quatro estágios
seguidos produziu uma projeção com barra de erro de **56×**, apresentada como determinística.

**O defeito é a multiplicação de faixas, não a comparação contra uma faixa.** Um degrau comparado
sozinho carrega a barra de erro dele (≈2–4×), não o produto de quatro. As cinco travas da §2 do
handoff são o que mantém a distinção — e a trava nº 1 vira teste executável (FR-002).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber se o degrau apurado está acima ou abaixo do mercado (Priority: P1)

Jean abre `/okr/atma` e, ao lado do veredito `§7.1 — fator ZERADO no fim da cadeia`, lê que
`visitante→lead` está em 7,29% contra um piso de mercado de 2% — **3,6× o piso**, quase na faixa
de elite. `1,0×` é exatamente "atingiu o mínimo do mercado", que é o piso que a feature existe
para tornar legível.

**Por que P1**: é o entregável. Sem isso, todo número apurado é um número solto e "no mínimo bater
a média do mercado" continua sendo uma frase, não um medidor.

**Teste de aceite**: dada a ficha da `atma` com `visitante=535` e `lead=39`, a função devolve para
o degrau `visitante→lead` o rótulo `acima da média`, a razão `3,6×` e a faixa citada com a fonte.

### User Story 2 - Não receber régua onde ela seria chute (Priority: P1)

Jean abre um projeto cujo degrau tem um dos lados `não apurado`. A régua **cala** naquele degrau e
devolve `sem par apurado`, apontando para a §7.2 (`apurar antes de melhorar`). Num degrau sem
linha na tabela, devolve `sem régua`.

**Por que P1**: é a trava que impede a feature de virar a projeção que a R6 recusa. Benchmark que
preenche buraco de medição é exatamente o defeito de origem.

**Teste de aceite**: ficha com `contatado` não apurado → o degrau `lead→contato feito` sai como
`sem par apurado`, nunca com número. Degrau `contato→orçamento` (sem linha na tabela) sai como
`sem régua`, mesmo com os dois lados apurados.

### User Story 3 - Dimensionar o buraco em unidades (Priority: P2)

Onde os dois lados estão apurados e existe régua, além do rótulo sai o buraco em unidades:
`39 leads × 25% (piso do mercado) = ~10 esperados; 0 apurado → buraco de ~10`.

**Por que P2**: transforma "está abaixo" em "está abaixo em N". Depende da P1 e da P2 estarem de pé.

**Teste de aceite**: uma multiplicação **só**, contra denominador apurado. Duas faixas compostas
DEVEM falhar (FR-002).

### Edge Cases

- Projeto **sem perfil declarado**: a régua não existe (a §7 já devolve posição 0). Não inventa perfil.
- Degrau com denominador apurado = 0: `razao()` de `lib/funil.mjs` já recusa `0/0`. A régua respeita
  a recusa e devolve `sem par apurado`, não `0×`.
- Apurado = 0 com denominador > 0 (o caso `atma`): é `abaixo do piso` com razão `0×`, **e** rende
  buraco em unidades. Zero é um número apurado, não uma ausência.
- Perfil A sem **modelo de trial** declarado: a linha `trial→cobrança` varia 3,5× entre opt-in
  (8,9%) e cartão exigido (31,4%). Sem a declaração → `sem régua`, nunca a média dos dois.
- Faixa de **paciente novo vs. base existente** (perfil D): a tabela usa a de **novo**. Um projeto
  que captasse da base ficaria cobrado abaixo do devido — declarado em Assumptions, não resolvido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor `distanciaDoMercado(ficha)` em `lib/benchmark.mjs`, função
  **pura**, que recebe a ficha de `montarFicha()` e devolve uma leitura por degrau da cadeia.
- **FR-002**: O sistema NÃO PODE compor duas faixas de benchmark em nenhum caminho de código. Esta
  proibição DEVE ter teste próprio que falha se violada. *(trava nº 1 — a R6 como código)*
- **FR-003**: O sistema DEVE devolver `sem par apurado` para todo degrau em que qualquer um dos
  dois lados não esteja apurado, sem número e sem faixa.
- **FR-004**: O sistema DEVE devolver `sem régua` para todo degrau sem linha na tabela, mesmo com
  ambos os lados apurados. A ausência é estado visível, não é preenchida por estimativa.
- **FR-005**: Toda linha da tabela DEVE carregar `fonte` citável (R8) e o vertical a que se aplica.
  Linha sem fonte não entra.
- **FR-006**: A tabela DEVE guardar **faixa** (`media: [min, max]`, `elite: [min, max]`), nunca
  ponto único. *(trava nº 3)*
- **FR-007**: O rótulo DEVE ser um de: `abaixo do piso` (< média), `na média` (dentro da faixa),
  `acima da média` (entre topo da média e piso da elite), `elite` (≥ piso da elite), `sem régua`,
  `sem par apurado`.
- **FR-008**: Onde houver par apurado e régua, o sistema DEVE devolver também o **buraco em
  unidades**: `denominador apurado × piso da média`, arredondado, contra o numerador apurado. Uma
  multiplicação só.
- **FR-009**: A saída DEVE citar a fonte junto do número, como a §7 já cita a célula que decidiu.
  Régua sem fonte na tela é a mesma opinião que a tela existe para substituir.
- **FR-010**: `app/okr/[slug]/page.tsx` DEVE renderizar a leitura como **segunda linha ao lado** do
  veredito da §7, visualmente subordinada a ele.
- **FR-011**: O sistema NÃO PODE apresentar nenhum valor da régua como meta, alvo ou KR. O texto
  na tela DEVE ser diagnóstico (`0,4× a média`), nunca prescritivo (`atingir 3,6%`). *(trava nº 5)*
- **FR-012**: `lib/okr.mjs` NÃO PODE ser modificado por esta feature. A §7 sai como entrou.
- **FR-013**: `handoff/okr-kpi-template.md` DEVE ganhar, na R6, uma nota apontando para
  `handoff/okr-regua-de-mercado.md` como o uso permitido de benchmark.

### Key Entities

- **Linha de régua**: `{ perfil, degrau, media: [min,max], elite: [min,max], fonte, nota? }`.
  `degrau` referencia o par de `chave` dos marcos de `PERFIS` em `lib/okr.mjs` — as duas tabelas
  DEVEM casar por chave, e um teste DEVE recusar linha que aponte para degrau inexistente.
- **Leitura**: `{ degrau, rotulo, apurado, faixa, razao, buraco?, fonte }`. `razao` é
  `apurado / piso da média` — logo `1,0×` significa "bateu o mínimo do mercado".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `/okr/atma` mostra `visitante→lead` como `acima da média` com razão `3,6×`,
  fonte citada, e a §7.1 inalterada ao lado.
- **SC-002**: Dos **17** degraus dos 4 perfis (A:4, B:4, C:4, D:5), exatamente as **10** linhas com
  fonte publicada existem na tabela; as **7** restantes devolvem `sem régua`. Destas 10, uma
  (`trial→cobrança`) é condicional ao modelo de trial e devolve `sem régua` enquanto nenhum
  projeto declarar o modelo — ou seja, **9 leituras efetivas hoje**. Nenhum degrau devolve número
  estimado.
- **SC-003**: `npm test` verde, com `test/benchmark.test.mjs` registrado no `package.json`
  (Princípio II da constituição) e contendo o teste da FR-002.
- **SC-004**: Nenhum diff em `lib/okr.mjs`.

## Assumptions

- As faixas da §3 do handoff são de **aquisição fria / paciente novo**, que é o que o SEO entrega.
  Projeto que captasse da base existente seria cobrado abaixo do devido — aceito, e declarado na
  nota da linha.
- Benchmark publicado é de mercado majoritariamente norte-americano. Serve como ordem de grandeza,
  não como recorte Brasil. A `fonte` por linha deixa isso auditável.
- As faixas envelhecem. Não há mecanismo de atualização automática nesta feature; a `fonte` por
  linha é o que permite reconferir à mão.
- O cálculo da razão usa o **piso da média** como divisor (o número mais conservador da faixa),
  para não inflar o "quanto abaixo" de ninguém.
