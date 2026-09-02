# Fase 1 — Modelo de dados: N4 por canal

**Feature**: `013-n4-canais-ga4-somado` | **Data**: 2026-09-02

Nenhuma tabela nova, nenhuma migração. Todas as entidades abaixo são estruturas em memória, vivas
por uma requisição da ficha. O que persiste é **um campo de curadoria** (§5).

---

## §1 — `CelulaFicha`: o envelope ganha um quarto estado

Hoje, em `lib/ficha.mjs`:

```js
CelulaApurada    = { estado:"apurado",     valor, rotulo, fonte }
CelulaDeclarada  = { estado:"declarado",   valor, rotulo, declaradoEm, oQue }
CelulaNaoApurada = { estado:"nao-apurado",        rotulo, motivo, consultar }
```

Acrescenta-se (D5 da pesquisa):

```js
CelulaInferida   = { estado:"inferido",    valor, rotulo, de, divida }
```

| Campo | Significado | Obrigatório |
|---|---|---|
| `valor` | o número deduzido | sim |
| `de` | o vestígio de onde ele foi deduzido (`orçamento sem lead vinculado`) | sim, não vazio |
| `divida` | por que ele ainda não é apurado, e o que o tornaria (FR-011b) | sim, não vazio |

**Invariantes**:

1. `inferido` **nunca** entra em `combinar()`, nem como insumo nem como resultado. Não é
   necessário alterar `combinar()`: basta que nenhum chamador lhe passe uma célula inferida — o que
   é garantido por construção, porque a célula inferida não é canal (§2) e não é somada (§4).
2. `inferido` **nunca** entra nos espaços `n3:`/`n4:`/`n5:` de `validarKrs()`. Um KR não pode
   apontar para ela; se apontasse, `chave-invalida` é a marca correta e é o que sai hoje.
3. `inferido` **nunca** alimenta `montarFicha()`, `posicaoDeAtaque()`, `projetar()` nem
   `segmentosDoFunil()` — a cadeia inteira ignora sua existência (SC-009, SC-010).
4. `<Cel>` imprime `inferido` com marca visível e distinta de `apurado` (FR-011, SC-007).

Os construtores `estadoDeApurado()`, `declarada()` e `naoApurada()` continuam idênticos.

---

## §2 — `Canal`

Uma das seis origens do catálogo `CANAIS` (inalterado): `organico`, `direto`, `pago`, `indicacao`,
`outbound`, `social`.

```js
{ id, nome, celula: CelulaFicha, semElo: boolean }
```

`semElo` mantém o significado de hoje (o canal é denominador de alguma taxa de N3 só quando o
primeiro marco da cadeia é `visitante`). A feature **não** o altera.

**Fonte de cada canal — a tabela que a FR-005 exige que seja única**:

| Canal | Fonte | Estado quando a fonte não responde |
|---|---|---|
| `organico` | Search Console (inalterado) | `não apurado` — como hoje |
| `direto` | GA4 · `Direct` | `não apurado` |
| `pago` | GA4 · grupos pagos (D3 da pesquisa) | `não apurado` |
| `indicacao` | GA4 · `Referral` | `não apurado` |
| `social` | GA4 · `Organic Social` | `não apurado` |
| `outbound` | **nenhuma** | `não apurado` — sempre, nomeando que a fonte não o distingue |

Nenhum canal aparece em duas linhas: é a SC-005 expressa como estrutura, não como conferência
manual.

---

## §3 — `LeituraGa4` — o que o coletor entrega à camada pura

```js
// não configurado
null
// configurado e falhou (FR-003, FR-008)
{ erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" | "403" | "ECONNRESET" | ... }
// configurado e respondeu (inclusive com zero linhas — FR-004)
{ linhas: [{ grupo: "Direct", sessoes: 128 }, ...], janela: { inicio, fim }, propriedade: "properties/123" }
```

`linhas` vem crua do GA4, **sem mapa aplicado**: o mapa é regra e mora em `.mjs` (Princípio III).
`janela` é a que o coletor de fato pediu, para a guarda da FR-006 (D8).

Três situações, três textos distintos na tela — a distinção que a FR-010 exige:

| Situação | Motivo impresso |
|---|---|
| sem `ga4.propertyId` no card | `sem propriedade GA4 configurada para este projeto` |
| configurado, API falhou | `fonte GA4 indisponível (<código>)` |
| configurado, respondeu, canal ausente das linhas | **não é motivo** — é `0` apurado (FR-004) |

---

## §4 — As células de N4, na ordem em que a ficha as imprime

| # | Rótulo | Estado possível | Regra |
|---|---|---|---|
| 1 | `orgânico` | apurado / não apurado | GSC, **byte a byte** o de hoje (SC-008) |
| 2 | `direto` | apurado / não apurado | GA4 |
| 3 | `pago` | apurado / não apurado | GA4 |
| 4 | `indicação` | apurado / não apurado | GA4 |
| 5 | `outbound` | não apurado | sempre (D3) |
| 6 | `social` | apurado / não apurado | GA4 |
| 7 | `fora do catálogo` | apurado / ausente | só quando o GA4 respondeu **e** houve volume fora do mapa; o rótulo nomeia os grupos (FR-009) |
| 8 | `total composto` | apurado / não apurado | soma **só** dos canais com fonte; rótulo declara a cobertura (FR-005b, D7) |
| 9 | `diferença` | não apurado | enquanto houver canal sem fonte (FR-012) |
| 10 | `contato fora do formulário` | inferido / ausente | só quando o vestígio existe (FR-011a, D6) |

Mais a **nota do nível** (FR-005d), impressa uma vez abaixo do título de N4:

> O total composto soma cliques em resultado de busca (Search Console) com sessões no site (GA4).
> Ele **não** é o `visitante` da cadeia — este continua sendo só o orgânico, e é ele que serve de
> denominador a toda taxa do N3. Sessões orgânicas do GA4 não entram: o orgânico vem do Search
> Console.

A célula 7 nunca vira canal e nunca entra na célula 8 — ela existe para que o volume seja
**nomeado**, não somado (FR-009).

---

## §5 — `Project.ga4` — a única persistência da feature

Em `data/projects.json` (curadoria) e no tipo `Project` de `lib/projects.ts`:

```ts
/** Propriedade GA4 que responde pelos canais não-orgânicos deste projeto (013). AUSENTE é
 *  "não configurado", nunca "sem tráfego" — a distinção inteira da FR-010. */
ga4?: { propertyId: string };
```

- `propertyId` no formato `properties/<número>`, ou só o número (normalizado na borda).
- Não é segredo (D9). A credencial continua em `GOOGLE_SERVICE_ACCOUNT_JSON`.
- Ausência é estado significativo, não defeito: 34 dos 35 projetos vão nascer sem o campo e a
  ficha deles tem de sair **idêntica** à de hoje (FR-007, SC-004).

---

## §6 — Regras de validação, resumidas para virar asserção

| Regra | Origem | Onde falha se quebrar |
|---|---|---|
| canal sem fonte nunca imprime `0` | FR-003, SC-003 | `montarN4()` |
| GA4 respondeu e canal ausente → `0` apurado | FR-004 | `montarN4()` |
| `organico` nunca lê linha do GA4 | FR-005a, SC-008 | `montarN4()` |
| cada canal tem no máximo uma fonte | FR-005, SC-005 | `montarN4()` (tabela §2) |
| janelas divergentes → canais do GA4 `não apurado` | FR-006, D8 | `montarN4()` |
| falha do GA4 não altera a célula do orgânico | FR-008, SC-006 | `montarN4()` |
| grupo fora do mapa é nomeado, não descartado nem realocado | FR-009 | `mapearCanaisGa4()` |
| inferido não entra em taxa nem em soma | FR-011, SC-009 | ausência de chamador (§1) |
| `diferença` permanece `não apurado` com `outbound` sem fonte | FR-012 | `montarN4Nivel()` |
| erro nomeia a variável, nunca o valor | FR-013, Princípio V | `lib/ga4.ts` |
