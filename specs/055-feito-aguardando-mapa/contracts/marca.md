# Contrato — marca e plano

## Server actions (`app/gsc/mapa/[slug]/actions.ts`)

### `marcar(fd: FormData): Promise<void>`

| Campo | Valor aceito | Fora disso |
|---|---|---|
| `projeto` | um de `SLUGS_DE_BUSCA` | não grava |
| `alavanca` | chave de `ALAVANCAS` | não grava |
| `responsavel` | id de `RESPONSAVEIS` | não grava |
| `dias` | `7`, `14` ou `28` | não grava |
| `leituras` | JSON `{chave de REGRAS: string ≤ 300}`, até 32 chaves | não grava |

Sem banco (`dbOn()` falso): não grava. Grava com `marcado = hoje BRT`, `reler = hoje + dias`, e
`revalidatePath("/gsc/mapa/<projeto>")`.

### `desmarcar(fd: FormData): Promise<void>`

`projeto` e `alavanca` como acima; apaga a linha. Idempotente.

## `lerMarca(campos, { slugs, hoje })` — puro, `lib/proxima-acao.mjs`

Devolve `{ projeto, alavanca, responsavel, marcado, reler, leituras }` ou `null`. É toda a validação;
a action só chama.

## `plano(disparos, { marcas = [], hoje } = {})`

Chamada sem o segundo argumento, devolve o painel sem marca nenhuma (os 5 degraus). Retorno:

```text
{
  degraus: [{ id, nome, porque, estado, entradas: Entrada[], contagem?, semLeituraPorMotivo? }] (sempre 5),
  primeira: { degrau, alavanca } | null,
  semAcao, naoDecide, semLeitura   // como na 054
}
Entrada = 054 + { apresentacao, marca: {responsavel, marcado, reler} | null,
                  motivos[i].naMarca, motivos[i].novo, leituraFalhou: string | null }
```
