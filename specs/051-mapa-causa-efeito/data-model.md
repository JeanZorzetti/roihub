# Data Model: 051

Nenhuma tabela nova. As entidades são formas em memória, puras.

## Classe (campo do `CATALOGO`)

| Campo | Tipo | Regra |
|---|---|---|
| `classe` | `"resultado" \| "alavanca" \| "higiene"` | obrigatória em toda folha de métrica; ausente em `procedimento` |
| `acaoSemanal` | `string` | obrigatória se `classe === "alavanca"`; ausente nas outras |

`CLASSES` (constante): rótulo curto da etiqueta e a frase da nota por classe.

## Item da fila (saída de `linha()` + `alvo`)

| Campo | Tipo | Regra |
|---|---|---|
| `chave` | chave do `CATALOGO` | só folha com régua |
| `alvo` | `string \| null` | URL (itens de CTR Gap) ou `null` |
| `delta` | `number` | só nasce com selo `dado` e régua (regra de `linha()`) |
| `moeda` | `"cliques" \| "pp"` | obrigatória com `delta` |
| `detalhe` | `string` | CTR × régua e posição (cliques) ou contagem de títulos (pp) |

`filaDoMapa()` devolve `{ porMoeda, semDelta, fora, sobreposicao }`:
- `porMoeda`: a saída de `ordenar()`, maior `|delta|` primeiro dentro de cada moeda;
- `fora`: contagem por motivo (`recusa`, `norma`, `semColetor`, `procedimento`, `dentroDaRegua`, `semAmostra`);
- `sobreposicao`: a frase das faixas de posição, que ficam de fora.

## Pessoa × orçamento (regra nova em `okr.mjs`)

`ultimoPorPessoa(linhas, chave)` → `Map<pessoa, líquido do orçamento mais recente>`.
- Consumidores: `valorEmRisco()` (vivos, perdidos) e `ticketDeOrcamentos()` (média por pessoa).
- `enviados` continua somando **documentos** (valor e `n`).
- Órfão irreconhecível segue sendo uma pessoa por linha, no `semLead`.
- Invariante: `vivos.valor + perdidos.valor + (semLead?.valor ?? 0)` = soma de `ultimoPorPessoa()`.
