# Data model: 058

Every table is created in `lib/db.ts#ensure()` with `IF NOT EXISTS`, like 055–057. JSON goes in `TEXT`
when the reader does the `JSON.parse`, like `hub_mapa_marca.leituras`. The columns are `JSONB` only
when SQL reads them, and no reader here does.

## 1. Stored

### `hub_plano` (057, changed)

| Column | Change | Meaning |
|---|---|---|
| `capacidade` | **dropped** (`DROP COLUMN IF EXISTS`; 0 rows in production on 28/09) | pages per week, replaced by `horas` |
| `horas` | **new** `TEXT NOT NULL DEFAULT '{}'` | `{"jean": number, "maria": number}`, hours per week per person (FR-025a) |
| `esforco` | **new** `TEXT NOT NULL DEFAULT '{}'` | `{alavanca \| "pergunta": number}`, default hours per target (FR-025) |

Unchanged: `projeto, versao, criado, criado_por, inicio, semanas_indexar, semanas_estabilizar,
piso_apoio, estado`.

Validation lives in `lerPlano`, which rejects the form when any of these is off:
- hours per person: 0–60, at most 2 decimals;
- the effort of each key: 0.25–80;
- keys: `RESPONSAVEL_IDS` for `horas`; `ALAVANCAS` + `pergunta` for `esforco`.

A missing key means its default: hours 0, effort from `PREMISSAS_PADRAO.esforco`.

### `hub_nucleo` (new) — the core, per cluster

| Column | Type | Meaning |
|---|---|---|
| `projeto` | TEXT | slug |
| `semente` | TEXT | the cluster's seed (stable across versions and consultations) |
| `intencao` | TEXT NULL | informacional \| comercial \| ambos; null = not decided |
| `pagina` | TEXT NULL | the owner's answering page (absolute URL of this project's hosts); null = the covering or planned page |
| `decidido_por` | TEXT | `RESPONSAVEL_IDS` |
| `decidido_em` | TIMESTAMPTZ DEFAULT now() | |

PK `(projeto, semente)`. Upsert on each decision.

### `hub_nucleo_item` (new) — questions and entities

| Column | Type | Meaning |
|---|---|---|
| `projeto`, `semente` | TEXT | cluster |
| `tipo` | TEXT | pergunta \| entidade |
| `texto` | TEXT | the question, or the entity's name (≤ 200 chars) |
| `detalhe` | TEXT NULL | entity: produto \| material \| aplicação \| norma \| marca própria \| outra. Question: the answering page URL, or null for the cluster's page |
| `estado` | TEXT | aceita \| removida \| respondida (respondida only for a question) |
| `decidido_por`, `decidido_em` | | as above |

PK `(projeto, semente, tipo, texto)`. Editing a question's text is two writes: the old one becomes
`removida` and the new one `aceita`.

### `hub_plano_tarefa` (new) — the owner's edits of one task

| Column | Type | Meaning |
|---|---|---|
| `projeto` | TEXT | slug |
| `chave` | TEXT | `alavanca\|alvo` (research D4), ≤ 600 chars |
| `responsavel` | TEXT NULL | override; null = the version's default |
| `esforco` | TEXT NULL | override hours (JSON number in TEXT); null = default |
| `prazo` | DATE NULL | fixed Monday; null = the scheduler's week |
| `atualizado` | TIMESTAMPTZ DEFAULT now() | |

PK `(projeto, chave)`. It is per project, not per version (FR-029). A row whose task no longer exists
is ignored.

### `hub_mapa_disparo` (new) — the map's fired cards, as last read

| Column | Type | Meaning |
|---|---|---|
| `projeto` | TEXT PK | slug |
| `lido_em` | TIMESTAMPTZ | when the map computed them |
| `disparos` | TEXT | JSON `[{chave, alavanca, estado, alvos, nAlvos}]`, only `dispara`/`critica` |

The map upserts it after `avaliar(leituras)`. The write never delays or breaks the map, because its
failure is swallowed.

## 2. Derived on every open (never stored)

### Cluster (057, extended)

`{semente, termos, volume, segmentos, pagina, apoios, estados}` from `cobrir`, plus:

- `intencao: {valor, proposta: {classe, volumeDeclarado, volumeTotal} | null, decidida: boolean}`
- `paginaResponsavel: {alvo, origem: "dono" | "cobertura" | "planejada"} | null`
- `perguntas: {texto, origem: "termo" | "dono", volume: number | null, pagina: alvo, estado}[]`. The
  proposed ones are not yet decided; the ones marked `removida` are left out of what the screen gets.
- `entidades: {nome, tipo}[]`
- `proxima: {tarefa chave, semana | null, estado} | null`: "nada planejado" when null.

### Tarefa (new; replaces 057's per-week `{alavanca, alvos[]}`)

```text
{
  chave: "alavanca|alvo",
  alavanca: keyof ALAVANCAS,
  alvo: { tipo: "url" | "planejada" | "termo" | "*", valor: string, rotulo: string },
  origens: ("pagina-nova" | "pagina-existente" | "mapa" | "pergunta")[],
  briefing: { intencao, perguntas, entidades } | null,   // FR-016, creation and question tasks
  impacto: { cliques: number, conta: string } | { naoCalculavel: string },
  esforco: { horas: number, editado: boolean },
  responsavel: { id: string, editado: boolean },
  prazoFixo: string | null,
  naoAntes: number | null,                               // week
  depende: string[],                                     // task keys
  // scheduler output
  semana: number | null,
  estado: "agendada" | "a-fazer" | "bloqueada",
  motivo: string | null,                                 // why "a fazer" / what blocks it
}
```

### Semana (057, changed)

`{n, inicio, tarefas: Tarefa[] (the scheduled ones), horas: {jean, maria} used, marcos}`. It starts at
the current week.

### Linha do OKR (new)

It takes one of three shapes:
- `{necessario: {min, max}, janelaDias: 28, plano: number, fracao: {min, max}}`;
- `{semComparacao: motivo}`;
- `{falhou: motivo}`.

## 3. State transitions

**Question**:
- `proposta` (derived) → `aceita` or `removida`.
- `aceita` → `respondida`, when the owner says a page answers it. A `respondida` question generates
  no task.

**Task**: derived every time, so it has no stored state. Its `estado` comes out of the scheduler. It
leaves the backlog by its origin's ending rule (research D5), never by a flag on the task.

**Version** (057): rascunho → ativo → encerrado. Unchanged. The plan shows the active version and the
draft.
