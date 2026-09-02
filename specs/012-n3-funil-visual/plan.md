# Implementation Plan: N3 — Funil Visual

**Branch**: `012-n3-funil-visual` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

## Summary

Um SVG inline acima das linhas de texto do card N3 da ficha `/okr/[slug]`, com **um segmento por
taxa da cadeia do perfil ativo** — exatamente as mesmas linhas que já existem embaixo, na mesma
ordem, sem remover nenhuma (FR-004).

Nada é medido de novo. `montarFicha()` já devolve `marcos` (com valor apurado ou motivo) e `taxas`
(razão entre marcos consecutivos), e `montarN3()` já transforma cada taxa numa célula
`apurado`/`não apurado`. Esta feature acrescenta uma função pura no mesmo arquivo
(`segmentosDoFunil()` em `lib/ficha.mjs`) que lê **as células que `montarN3()` acabou de montar**
para o estado, e os **valores dos marcos** para a geometria — e um componente de apresentação
dentro da própria página, que vira esses segmentos em `<polygon>`/`<rect>`.

O que entra de código: uma função exportada em `lib/ficha.mjs`, um campo `funil` no nível N3, um
componente `FunilN3` dentro de `app/okr/[slug]/page.tsx`, um bloco de CSS em `app/globals.css` e
asserções novas em `test/ficha.test.mjs` (arquivo **já registrado** — nenhuma linha nova no
`package.json`).

Zero dependência, zero JavaScript enviado ao navegador (SC-004): a página é Server Component e o
funil é markup.

## Technical Context

**Linguagem**: JS puro `.mjs` com JSDoc para a derivação dos segmentos; TypeScript `.tsx` só na
borda de render (Princípio III). Node 22.

**Dependências**: nenhuma nova. Nenhuma biblioteca de gráfico (FR-007) — `<svg>`, `<polygon>`,
`<rect>` e `<pattern>` são markup nativo.

**Armazenamento**: nenhum. Leitura pura sobre o que a requisição da ficha já carrega.

**Testes**: asserções novas em `test/ficha.test.mjs` (`node:test` + `assert/strict`), que já está na
lista de `npm test`. Nenhum arquivo de teste novo → nenhum risco de `test/validade.test.mjs`
reprovar por lista divergente (Princípio II).

**Plataforma**: Next.js 16 App Router, React 19, rota `app/okr/[slug]/page.tsx` já existente com
`dynamic = "force-dynamic"`. Deploy Docker/EasyPanel. Dev em Windows.

**Tipo de projeto**: aplicação web — mudança de apresentação numa rota que já existe.

**Metas de desempenho**: `js_kb: 0` para o chrome desta tela (`.art/log.json`, direção
corte-seco). O funil não pode introduzir `'use client'`, nem `<script>`, nem hook de estado.

**Restrições**: R1 (`não apurado` nunca vira `0` nem sombra de barra), R2 (a fração colada continua
no texto — o funil não a substitui), R6 (nenhum número projetado para preencher buraco de cadeia).
Direção visual corte-seco: raio 0, sombra 0, `opacity` 0 em qualquer camada.

**Escala/Escopo**: 4 perfis, 4 ou 5 segmentos por cadeia (A/B/C têm 5 marcos → 4 taxas; D tem 6
marcos → 5 taxas). Um funil por página. O(n) sobre ≤5 elementos.

**Critério de conferência**: HTML servido pelo EasyPanel, nunca `next dev` — mesma régua da 011.

## Constitution Check

*GATE: passa antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature cumpre | Pós-Fase 1 |
|---|---|---|
| **I. Contrato único de dados** | Nenhuma leitura nova. A página já recebe o projeto por `listProjects()`; o funil consome `ficha.marcos` e as células de N3, ambos já montados nesta requisição. Nenhum import de `data/projects.json`. | ✅ |
| **II. `node --test` registrado à mão** | Nenhum arquivo de teste novo: as asserções entram em `test/ficha.test.mjs`, já na lista de `npm test`. Nenhum framework instalado. | ✅ |
| **III. `.mjs` puro, `.ts` na borda** | `segmentosDoFunil()` nasce em `lib/ficha.mjs` — sem env, sem banco, sem rede, sem relógio; entra ficha, sai lista de segmentos em **fração** (`0..1`). O `.tsx` não decide estado nem **normaliza** altura; ele só converte fração em unidade de `viewBox` (`× 44`, `600 ÷ N`), aritmética que morre junto com o `viewBox` e não sobrevive a uma troca de desenho. | ✅ ver [contracts/funil-n3.md](./contracts/funil-n3.md) |
| **IV. Push é deploy** | Feature de leitura. Sem cron, sem rota de API, sem `maxDuration`. Push fora de 23:30-01:00 e 08:00-08:45 BRT. | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma env nova, nenhum log novo. O SVG não carrega texto — nem de motivo, nem de fonte. | ✅ |

**Nenhuma violação a justificar** — a tabela de Complexity Tracking fica vazia de propósito.

Nota sobre a R6, que é regra do template e não da constituição, mas é o gate real desta tela: a
geometria só usa valores **medidos** (`{valor}` de marco apurado). Degrau sem valor não recebe
altura inferida, interpolada nem herdada do vizinho — vira trilho hachurado, que é a forma de "não
sei", não de "zero" (D2 do research).

## Decisões de desenho

Detalhadas em [research.md](./research.md); resumo com o motivo de uma linha:

1. **Segmento é TAXA, não marco.** Cinco linhas de texto em N3 são cinco taxas; um funil de seis
   marcos ao lado de cinco linhas quebraria a correspondência 1:1 que a FR-003 exige. A `atma`
   (perfil D) tem 5 taxas, 1 apurada — exatamente o AS-1 da spec.
2. **A altura vem dos MARCOS, o estado vem da CÉLULA DE N3.** São coisas diferentes e só uma delas
   pode divergir do texto: o estado. Por isso ele é lido da célula que `montarN3()` acabou de
   montar, nunca recalculado a partir de `taxas`.
3. **Normalização única por cadeia: o maior marco apurado é 100%.** Assim dois degraus apurados
   seguidos compartilham a aresta (o numerador de uma taxa é o denominador da seguinte, por
   construção de `montarFicha()`) e o funil afunila de verdade, em vez de recomeçar cheio a cada
   segmento.
4. **Degrau não apurado é trilho hachurado de altura fixa, não trapézio de altura zero.** Altura
   zero é a forma de `0` medido (o `tratamento = 0` da `atma`), e a R1 existe para as duas coisas
   nunca se parecerem.
5. **`aria-hidden="true"` no `<svg>` inteiro (FR-008).** A informação já é lida por completo nas
   linhas abaixo; anunciar cinco segmentos sem rótulo faria o leitor de tela percorrer a cadeia
   duas vezes, a segunda sem os motivos.
6. **O componente mora na própria página, ao lado de `Cel` e `Linha`.** FR-006 restringe o funil à
   ficha; um arquivo de componente para um uso só é pasta a manter sem chamador.

## Project Structure

### Documentation (this feature)

```text
specs/012-n3-funil-visual/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — a escala, resolvida
├── data-model.md        # Fase 1 — o Segmento
├── quickstart.md        # Fase 1 — como conferir
├── contracts/
│   └── funil-n3.md      # Fase 1 — contrato de segmentosDoFunil() e do markup
├── checklists/
│   └── requirements.md  # já existente
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
lib/
└── ficha.mjs            # + segmentosDoFunil() e o campo `funil` no nível N3

app/
├── okr/[slug]/page.tsx  # + <FunilN3 /> acima das linhas, só quando n.id === "N3"
└── globals.css          # + bloco .ficha-funil (corte-seco: raio 0, sombra 0)

test/
└── ficha.test.mjs       # + asserções de contagem, estado, escala e ausência de perfil
```

**Structure Decision**: nenhum diretório novo. A feature toca quatro arquivos que já existem, todos
no lugar onde N3 já é montado e desenhado. `lib/ficha.mjs` recebe a lógica porque ela é testável
sem subir o Next (Princípio III) e porque a fonte do estado já está lá — derivar o estado no `.tsx`
criaria a segunda régua que a FR-003 proíbe.

## Complexity Tracking

> Vazia: o Constitution Check passou sem violações.
