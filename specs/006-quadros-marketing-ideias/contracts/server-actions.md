# Contrato — `app/quadro-actions.ts` (server actions)

```ts
"use server";
```

Todas seguem o formato já usado em [app/agenda/actions.ts](../../../app/agenda/actions.ts):
recebem `FormData`, saem cedo se `!dbOn()`, validam contra listas conhecidas, chamam `lib/db.ts` e
terminam em `revalidatePath`. **Retorno `Promise<void>`** — a página é re-renderizada, não há estado
de cliente para atualizar.

Entrada inválida **não lança**: é descartada e vira o valor neutro, como
`app/agenda/actions.ts:20` já faz com projeto desconhecido. Formulário é entrada de usuário e volta
para a tela nos `value` dos selects.

---

## Cards

### `addCard(fd)` · `updateCard(fd)`

| Campo | Tratamento |
|---|---|
| `quadro` | obrigatório; fora de `QUADROS` → sai sem gravar |
| `titulo` | `trim().slice(0, 200)`; vazio → sai sem gravar |
| `descricao` | `trim().slice(0, 4000)` ou `null` |
| `coluna_id` | tem que pertencer ao mesmo `quadro`; senão → primeira coluna do quadro |
| `projeto` | validado contra `listProjects()`; desconhecido → `null` |
| `responsavel` | validado contra `RESPONSAVEL_IDS` de `lib/agenda.mjs`; desconhecido → `null` |
| `canal` | validado contra `CANAIS`; **ignorado fora do Marketing** |
| `data` | `/^\d{4}-\d{2}-\d{2}$/`; senão `null` |
| `url` | tem que começar com `http://` ou `https://`; senão `null` |
| `tipo` | `card` \| `doc`; `doc` ignora `coluna_id`, `canal` e `data` |

> **`listProjects()` é o contrato** — nunca importar `data/projects.json` direto. É a primeira das
> cinco regras do [CLAUDE.md](../../../CLAUDE.md): importar o JSON direto faz a aba perder os repos
> que vêm da API do GitHub.

### `moverCard(fd)`

`id` + `coluna_id`. **Recusa coluna de outro quadro** — é o que impede um card de Marketing aparecer
no quadro de Ideias por id trocado na URL.

### `delCard(fd)`

Apaga o card. Anexos vão junto pelo `ON DELETE CASCADE`, sem código.

### `arquivarCard(fd)` · `restaurarCard(fd)`

Carimba e limpa `arquivado_em`. Restaurar **zera a carência**: arquivar de novo recomeça os 30 dias
(FR-034/FR-035).

---

## Colunas

### `addColuna(fd)`

`quadro` + `nome` (1–40) + `icone` opcional. `ordem` = última + 1. Nome repetido no mesmo quadro cai
no `UNIQUE` e sai sem gravar.

### `renameColuna(fd)`

Só `nome` e `icone`. **Não toca em card nenhum** — FR-015 é garantido pela estrutura (o card aponta
para `id`), não por cuidado nesta função.

### `moverColuna(fd)`

`id` + `dir` (`-1` | `1`). Troca `ordem` com a coluna vizinha, numa transação.

### `delColuna(fd)`

Passa por `validarColunaRemovivel()` antes:

| Situação | Resultado |
|---|---|
| Coluna com cards | **Recusa**, com a contagem (FR-013) |
| Última coluna do quadro | **Recusa** (FR-014) |
| Coluna vazia, não é a última | Apaga |

A recusa volta para a tela como aviso — não é exceção, é resposta esperada de uma ação que o usuário
tem todo direito de tentar.

---

## Manutenção

### `liberarVencidos()`

Não é action de formulário: é chamada na carga das páginas de quadro, junto das demais leituras.

Roda o `UPDATE` idempotente de [data-model.md](../data-model.md). Segura de chamar em toda
renderização — `WHERE bytes IS NOT NULL` faz a segunda passada não achar linha, e o índice parcial
mantém indexadas só as linhas ainda com bytes.

> **Não pendurar em cron.** Já há dois crons na janela da madrugada, o hub cai intermitentemente
> nela, e o Actions atrasa ~97 min ([CLAUDE.md](../../../CLAUDE.md)). Com carência de 30 dias, atraso
> de horas ou dias é irrelevante — e um cron novo não é (R-005).

---

## Revalidação

Toda action termina em `revalidatePath` da rota do quadro afetado (`/marketing` ou `/ideias`).

A querystring não entra no `revalidatePath` — é assim que o filtro e a vista sobrevivem a marcar,
mover, editar e apagar, exatamente como descrito em
[app/agenda/page.tsx:307](../../../app/agenda/page.tsx).

---

## O que NÃO existe aqui

Nenhuma action escreve em `hub_tasks`, em `seo_*`, em `crm_*` ou em `data/projects.json`.
FR-009 e FR-010 são verificáveis por leitura: se aparecer um `insertTask` neste arquivo, a entrega
está errada.
