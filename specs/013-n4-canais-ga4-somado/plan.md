# Implementation Plan: N4 por canal — GA4 somado ao GSC

**Branch**: `013-n4-canais-ga4-somado` | **Date**: 2026-09-02 | **Spec**: [spec.md](./spec.md)

## Summary

Cinco das seis linhas do N4 hoje imprimem a mesma frase — `sem coletor para este canal` — porque
`montarN4()` só tem uma fonte: os cliques orgânicos do Search Console. Esta feature liga uma
**segunda** fonte, a GA4 Data API, para **quatro** desses cinco canais (`direto`, `pago`,
`indicacao`, `social`), sem tocar em uma linha do caminho do orgânico.

O desenho inteiro cabe em três frases:

1. **Uma fonte por canal, decidida por tabela fixa, nunca por reconciliação** — o GSC serve
   `organico`, o GA4 serve os quatro, `outbound` continua sem fonte porque o GA4 não o distingue.
   Não há sobreposição a resolver: ela é impossível por construção (FR-005, SC-005).
2. **A cadeia não muda** — `visitante` continua sendo o orgânico do GSC, o N3 continua com os
   mesmos números e as mesmas taxas. O total composto do N4 é **leitura ao lado**, rotulada como
   composta, e não alimenta o N3 (FR-005c, SC-010).
3. **A origem WhatsApp entra como quarto estado de célula, `inferido`** — número visível, fora de
   toda conta, com a dívida escrita na própria linha (FR-011, FR-011b).

Zero dependência nova: `google-auth-library` já está no `package.json` e a Data API é um POST em
JSON. Zero arquivo de teste novo: `test/ficha.test.mjs` já está registrado em `npm test`. Zero
variável de ambiente nova: a credencial é o `GOOGLE_SERVICE_ACCOUNT_JSON` que o GSC já usa, com um
escopo a mais pedido por um cliente separado.

O que entra de código: um arquivo de borda (`lib/ga4.ts`), duas funções puras e um construtor em
`lib/ficha.mjs`, dois campos no retorno de `coletarDoProjeto()`, um campo no tipo `Project`, um ramo
em `<Cel>` e asserções em `test/ficha.test.mjs`.

## Technical Context

**Linguagem**: JS puro `.mjs` com JSDoc para o mapa de canais, os estados e a soma; TypeScript só
na borda de rede (`lib/ga4.ts`) e de render (`page.tsx`) — Princípio III. Node 22.

**Dependências**: **nenhuma nova**. `google-auth-library` (já em `dependencies`) autentica; a GA4
Data API v1beta é chamada por HTTP. `@google-analytics/data` foi rejeitado no
[research.md](./research.md) D1 — gRPC e protobuf para fazer um POST.

**Armazenamento**: nenhum. Nenhuma tabela, nenhuma migração. A única persistência é um campo de
curadoria (`ga4.propertyId`) em `data/projects.json`, dentro do contrato de `listProjects()`.

**Testes**: `node:test` + `assert/strict` em `test/ficha.test.mjs`, arquivo **já registrado** na
lista de `npm test`. Nenhum arquivo novo → `test/validade.test.mjs` continua concordando com o
diretório sem edição no `package.json` (Princípio II).

**Plataforma**: Next.js 16 App Router, React 19, rota `app/okr/[slug]/page.tsx` já existente com
`dynamic = "force-dynamic"`. Deploy Docker/EasyPanel. Dev em Windows, produção Alpine.

**Tipo de projeto**: aplicação web — uma fonte de leitura nova numa rota que já existe.

**Metas de desempenho**: **uma** chamada externa a mais por requisição de ficha, e só para projeto
com `ga4` configurado. O N4 só existe em `/okr/[slug]` (um projeto por requisição); a `/okr` do
portfólio, com 35 projetos, **não** monta N4 e não passa a chamar o GA4 — é a resposta ao item que
o checklist da spec deferiu para cá (D4). A chamada entra em `Promise.all` com a do GSC, sem somar
latência.

**Restrições**: R1 (`não apurado` nunca vira `0`, e vice-versa); R4 (ler o dado onde ele já cai —
a coluna `paciente_lead_id` já vem no `SELECT` de hoje); R7 (uma janela declarada para a árvore
inteira, agora com guarda que **recusa** a soma se as duas leituras divergirem); Princípio V
(credencial validada pelo nome da variável, nunca pelo valor, e nada em log).

**Escala/Escopo**: 6 canais, 4 servidos pela fonte nova; 35 projetos, 17 com perfil, 1 com `ficha`
curada. Espera-se **1** projeto com `ga4` configurado na entrega (a `atma`) e 34 com o
comportamento de hoje, byte a byte.

**Critério de conferência**: HTML servido pelo EasyPanel, nunca `next dev` — mesma régua da 011 e
da 012.

## Constitution Check

*GATE: passa antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature cumpre | Pós-Fase 1 |
|---|---|---|
| **I. Contrato único de dados** | A configuração da fonte nova entra **dentro** do contrato: campo `ga4` no tipo `Project` de `lib/projects.ts`, lido do projeto que `listProjects()` já entregou à página. Nenhum import de `data/projects.json`, nenhum mapa `PROPRIEDADES_GA4` paralelo — que seria exatamente a segunda lista de projetos que o princípio existe para impedir (D9). | ✅ |
| **II. `node --test` registrado à mão** | Nenhum arquivo de teste novo. As asserções entram em `test/ficha.test.mjs`, já na lista de `npm test`; `package.json` não muda. Nenhum framework instalado. | ✅ |
| **III. `.mjs` puro, `.ts` na borda** | Toda regra — mapa de canais, tabela de estados, soma composta, guarda de janela, quarto estado — nasce em `lib/ficha.mjs`, testável sem subir o Next. `lib/ga4.ts` é `.ts` porque toca rede e `google-auth-library`, e **não contém regra**: devolve linhas cruas ou motivo de falha, o mesmo desenho de `okr-coleta.ts` em relação a `okr.mjs`. | ✅ ver [contracts/n4-canais.md](./contracts/n4-canais.md) |
| **IV. Push é deploy** | Feature de leitura: sem cron, sem rota de API, sem `maxDuration`, sem tocar no autopublishing. Push fora de 23:30–01:00 e 08:00–08:45 BRT. | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável nova. Ausência de `GOOGLE_SERVICE_ACCOUNT_JSON` vira `{ erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" }` — **o nome, nunca o valor**. `lib/ga4.ts` não escreve log nenhum, nem de sucesso nem de erro. `propertyId` não é segredo (número visível no admin do GA4) e mora no JSON versionado. | ✅ |

**Nenhuma violação a justificar** — a tabela de Complexity Tracking fica vazia de propósito.

**Revalidação pós-Fase 1**: o desenho detalhado não introduziu violação. Os dois pontos que
mereciam segundo olhar:

- **O quarto estado de célula** (`inferido`) amplia um tipo central da ficha, tocado por
  `montarNiveis`, `validarKrs` e `<Cel>`. Não é violação de princípio, e é o desenho que faz a
  SC-009 valer **por construção** em vez de por disciplina: um booleano `inferido` numa célula
  apurada falharia em silêncio no primeiro consumidor que esquecesse o `if` (D5).
- **A guarda de janela** (FR-006) hoje é inalcançável, porque as duas leituras saem das mesmas
  constantes. Mantida assim mesmo: um requisito `DEVE recusar` que nenhum código pode reprovar não
  é requisito, e é um `if` (D8).

Nota sobre as regras do template que não estão na constituição mas são o gate real desta tela: a
**R1** aparece três vezes no contrato (canal sem fonte nunca imprime `0`; GA4 que responde vazio
imprime `0` apurado; volume estranho não vira zero), e a **R6** não é tocada — a feature mede
volume e não compara com benchmark nenhum.

## Decisões de desenho

Detalhadas em [research.md](./research.md); resumo com o motivo de uma linha:

1. **GA4 Data API por HTTP, com o `google-auth-library` que já existe** — dependência nova para um
   POST em JSON não se paga (D1).
2. **Cliente `GoogleAuth` separado do de `lib/gsc.ts`** — reaproveitar exigiria mexer no escopo do
   cliente que serve o orgânico de todos os projetos, e a SC-008 exige esse número idêntico. O
   arquivo novo torna a falha FECHADA (FR-008) verdadeira por construção (D1).
3. **`sessionDefaultChannelGroup` × `sessions`** — a classificação do próprio GA4. Reimplementar
   atribuição a partir de `source`/`medium` criaria uma segunda régua de canal que divergiria da
   tela do GA4 na primeira UTM torta (D2).
4. **`outbound` continua sem fonte** — o GA4 não tem grupo que corresponda a prospecção ativa.
   Mapear `Email` → `outbound` seria "jogar num canal existente", que o edge case da spec proíbe
   (D3). Com GA4 ligado os apurados vão de 1 para **5**, e a SC-001 pede ≥ 4.
5. **`Organic Search` do GA4 é descartado e nomeado na nota** — FR-005a. O orgânico vem do Search
   Console, e o volume ignorado aparece escrito para que o descarte não seja silencioso (D3).
6. **Uma chamada por requisição de ficha, sem cache** — o N4 só existe em `/okr/[slug]`; o
   multiplicador é 1, não 35. Cache traria de volta o número de outra janela que `force-dynamic`
   existe para evitar (D4).
7. **Quarto estado `inferido`, não booleano nem `declarado`** — a inferência precisa ser impossível
   de entrar numa taxa, não só combinada para não entrar (D5).
8. **O total composto soma só os canais com fonte** — `combinar()` cru devolveria `não apurado`
   para sempre, porque `outbound` nunca terá fonte, e aí a FR-005b não teria o que rotular. A
   cobertura vai escrita no rótulo, e a `diferença` continua `não apurado` (D7).
9. **A configuração mora no `Project`, não num mapa em `lib/ga4.ts`** — Princípio I (D9).

## Project Structure

### Documentation (this feature)

```text
specs/013-n4-canais-ga4-somado/
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — as nove decisões, com as alternativas rejeitadas
├── data-model.md        # Fase 1 — o quarto estado, o Canal, a LeituraGa4, as 10 células do N4
├── quickstart.md        # Fase 1 — como conferir, um bloco por Critério de Sucesso
├── contracts/
│   ├── n4-canais.md     # Fase 1 — camada pura: mapa, tabela de decisão, garantias
│   └── ga4-leitura.md   # Fase 1 — borda: ga4Canais(), ordem das guardas, integração na coleta
├── checklists/
│   └── requirements.md  # já existente — 16/16
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

```text
lib/
├── ga4.ts               # NOVO — ga4Canais(): borda de rede, zero regra, falha fechada
├── ficha.mjs            # + GRUPOS_GA4, mapearCanaisGa4(), inferida(); montarN4() e
│                        #   montarN4Nivel() ganham a fonte nova e a nota do nível
├── okr-coleta.ts        # + `ga4` e `orcamentosSemLead` no retorno de coletarDoProjeto()
│                        #   (a coluna paciente_lead_id JÁ vem no SELECT de hoje)
└── projects.ts          # + campo `ga4?: { propertyId: string }` no tipo Project

data/
└── projects.json        # + "ga4" no card da atma (curadoria)

app/
├── okr/[slug]/page.tsx  # + ramo `inferido` em <Cel>, + nota do nível N4
└── globals.css          # + marca visual da célula inferida (corte-seco: raio 0, sombra 0)

test/
└── ficha.test.mjs       # + asserções do §6 do data-model — arquivo JÁ registrado
```

**Structure Decision**: um arquivo novo, e só um — `lib/ga4.ts`, pelo mesmo motivo que `lib/gsc.ts`
existe: uma fonte externa com autenticação própria não cabe dentro de um módulo puro. Todo o resto
são arquivos que já existem, tocados onde a coisa já mora: o N4 é montado em `lib/ficha.mjs`, a
coleta em `lib/okr-coleta.ts`, o contrato de projeto em `lib/projects.ts`. Nenhum diretório novo,
nenhum componente novo, nenhuma rota nova.

## Complexity Tracking

> Vazia: o Constitution Check passou sem violações, antes e depois da Fase 1.
