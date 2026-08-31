# Phase 1 Data Model: Sub-balde Segurança na Agenda

Nenhuma tabela ou schema novo. Um campo derivado é adicionado à entidade de UI já existente e
uma função pura nova é o único "contrato" desta feature.

## Entidade: `Item` (card da agenda, `app/agenda/page.tsx`)

Já existe com os campos usados por `filtrar`/`ordenar`/`porUrgencia` em `lib/agenda.mjs`
(`titulo`, `projeto`, `desc`, `bucket`, `tipo`, `taskId`, `rank`, `occ`, `task.responsavel`).

**Campo novo**:

| Campo | Tipo | Origem | Regra |
|---|---|---|---|
| `seguranca` | `boolean` | Derivado no momento em que o `Item` é montado (ação do ranking em `page.tsx:216`, ou `itemFromTask` para tarefa do banco) | `seguranca(tituloDoItem)` — mesma função para as duas origens |

Não é persistido: não existe coluna nova em `hub_tasks` nem campo novo em `data/projects.json`.
É recalculado a cada render a partir do título, do mesmo jeito que `tipo` (quando não há
override em `hub_tasks.tipo`).

## Contrato de função: `seguranca(titulo)`

```ts
function seguranca(titulo: string | null | undefined): boolean
```

- **Entrada**: o título do card (mesma fonte que alimenta `tipoDe`). `null`/`undefined` são
  aceitos e tratados como string vazia — não lança exceção (FR-010).
- **Saída**: `true` quando o título casa `RE_SEGURANCA` (termos de credencial/segredo/CVE/CORS/
  auth isolada/autenticação/vulnerabilidade — ver `lib/agenda.mjs` e research.md §3); `false`
  caso contrário.
- **Pureza**: sem efeito colateral, sem I/O — mesmo contrato de `tipoDe`.
- **Independência**: não lê nem escreve `tipo`/`tipoDe`; um card pode ter qualquer combinação de
  `tipo` × `seguranca`.

## Regra de agrupamento (render, não é entidade nova)

Dentro do `Balde` de `tipo.id === "execucao"`:

```
seg   = items.filter(i => i.seguranca)                       // pode ser []
resto = seg.length > 0 ? items.filter(i => !i.seguranca) : items
```

- Cada uma das duas listas é ordenada por `ordenar()` (que usa `porUrgencia` internamente) —
  nenhuma ordenação nova é criada.
- `seg.length === 0` ⇒ apenas `resto` é renderizado, sem subtítulo (lista chapada, igual hoje).
- `seg.length > 0` ⇒ os dois grupos são renderizados com subtítulo `<h3>` (`.ag-sub`).
