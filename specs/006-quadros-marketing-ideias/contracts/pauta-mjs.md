# Contrato — `lib/pauta.mjs` (módulo puro)

A lógica testável da feature. **Zero import de `next`, `pg` ou `react`** — é o que permite
`node --test` importá-lo direto, sem transpilar, como manda a convenção do repo
(`.mjs` = lógica pura; `.ts` = só o que toca Next/DB).

Consumido por: `app/quadro.tsx`, `app/quadro-actions.ts`, `app/api/pauta/anexo/[[...id]]/route.ts`,
`test/pauta.test.mjs`.

---

## Constantes

```js
export const QUADROS            // [{ id, label, rota }] — marketing, ideia
export const CANAIS             // [{ id, label }] — blog, instagram, facebook, …
export const TIPOS_CARD         // ["card", "doc"]
export const VISTAS             // [{ id, label }] — kanban, calendario, docs
export const COLUNAS_INICIAIS   // { marketing: [{nome, icone, ordem}], ideia: [...] }
export const MIMES_ACEITOS      // ["image/png", "image/jpeg", "image/webp"]
export const ANEXO_MAX_BYTES    // 3 * 1024 * 1024
export const ANEXO_MAX_POR_CARD // 20
export const ANEXO_CARENCIA_DIAS// 30
```

---

## Validação

### `validarAnexo({ mime, tamanho, jaTem })`

```
→ { ok: true }
→ { ok: false, erro: "mime" | "tamanho" | "quantidade" }
```

Código de erro estável, **nunca mensagem livre** — mesma disciplina dos códigos de erro do
autopublishing (`llm-auth`, `llm-rate`, …), pelo mesmo motivo: mensagem é para a tela, código é para
o teste e para o log. A tela traduz o código.

### `validarColunaRemovivel({ cards, totalColunas })`

```
→ { ok: true }
→ { ok: false, erro: "tem-cards", cards: N }   // FR-013
→ { ok: false, erro: "ultima-coluna" }         // FR-014
```

---

## Calendário

### `gradeDoMes(ym)`

`ym` no formato `"YYYY-MM"`. Devolve as semanas do mês como matriz de datas ISO, com `null` nos dias
antes do dia 1 e depois do último. Semana começa no domingo, igual a `WD_LABELS` de `lib/agenda.mjs`.

```js
gradeDoMes("2026-09")
// [[null,null,"2026-09-01",…,"2026-09-05"], […], …]
```

Casos que o teste tem que cobrir: mês que começa no domingo (sem `null` à esquerda), fevereiro
bissexto, virada de ano em `mesVizinho`.

### `mesVizinho(ym, n)`

`mesVizinho("2026-12", 1) === "2027-01"` · `mesVizinho("2026-01", -1) === "2025-12"`

### `mesDe(iso)` · `rotuloMes(ym)`

`"2026-09-02" → "2026-09"` · `"2026-09" → "setembro de 2026"`

---

## Filtro e ordenação

Mesmo desenho de `lib/agenda.mjs`: **filtro e ordem vivem na URL**, então a visão é compartilhável e
sobrevive ao reload e às server actions.

### `lerFiltros(sp, { slugs, colunas })`

Só valores conhecidos entram. Desconhecido = **sem filtro**, nunca um filtro que não casa com nada —
lista vazia sem explicação é o bug nº 1 de painel (a razão está escrita em `lib/agenda.mjs`).

```
→ { q, projeto, responsavel, canal, vista, mes, arquivados }
```

### `filtrosAtivos(f)` · `comFiltro(f, chave, valor)`

Idênticos em contrato aos de `lib/agenda.mjs`. `comFiltro` omite os valores padrão da querystring
(`vista=kanban`, `arquivados=0`) para o link ficar curto.

### `filtrar(cards, f)`

Casamento de texto sem acento sobre título + projeto + descrição.

### `agruparPorColuna(cards, colunas)`

Devolve **todas** as colunas, inclusive as vazias — FR-030: filtro não pode esconder que a etapa
existe.

### `agruparPorDia(cards, ym)`

`{ "2026-09-02": [card, …] }`. Card sem `data` **não entra** (FR-025) e continua acessível no quadro.

---

## Regras de negócio puras

### `podeLiberar(card, hoje)`

`true` quando `arquivado_em` existe e passou `ANEXO_CARENCIA_DIAS`. É a mesma regra que o `UPDATE` da
varredura aplica — existir aqui em forma pura é o que permite testá-la sem banco.

### `dataDeLiberacao(card)`

Data em que os anexos daquele card serão liberados. Alimenta o aviso do FR-031 ("informar quando as
imagens serão liberadas").

### `resumoDeEspaco(anexos)`

```
→ { ativos: N, bytes: N, liberados: N }
```

Alimenta FR-036 — o contador permanente de espaço na aba.

---

## Fora do contrato, de propósito

- **Nada que converta card em tarefa da Agenda.** O envio está fora de escopo (FR-009/FR-010). Os
  campos do card foram nomeados iguais aos de `Task` para que essa ponte, quando existir, seja uma
  função de poucas linhas — mas ela não existe agora e não deve ser antecipada.
- **Nenhuma derivação de coluna a partir do título.** A agenda deriva o balde por palavra-chave
  (`tipoDe`) porque o balde nasceu depois de 63 cards já escritos. Quadro novo tem `select` desde o
  primeiro card: adivinhar aqui seria copiar a solução sem copiar o problema.
