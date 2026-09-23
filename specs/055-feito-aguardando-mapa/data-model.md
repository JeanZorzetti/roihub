# Data Model — 055

## Tabela `hub_mapa_marca`

| Coluna | Tipo | Regra |
|---|---|---|
| `projeto` | TEXT NOT NULL | slug do mapa (`SLUGS_DE_BUSCA`), nunca o rótulo |
| `alavanca` | TEXT NOT NULL | chave de `ALAVANCAS` |
| `responsavel` | TEXT NOT NULL | id de `RESPONSAVEIS` (sem CHECK: a lista vive no `.mjs`, como em `hub_acao_dono`) |
| `marcado` | DATE NOT NULL | dia da marca em BRT |
| `reler` | DATE NOT NULL | `marcado + dias` (7, 14 ou 28) |
| `leituras` | TEXT NOT NULL | JSON `{chave: texto}` dos motivos no momento da marca. TEXT, não jsonb |
| | PK `(projeto, alavanca)` | uma marca por alavanca e projeto |

## Estados

**Entrada** (`apresentacao`):

| Estado | Quando | Aparece |
|---|---|---|
| `ativa` | sem marca | como na 054 |
| `aguardando` | marca e `hoje < reler` | fim do degrau, texto neutro, sem destaque de primeira |
| `voltou` | marca, `hoje >= reler` e a regra ainda dispara | ordem normal, com "feito em … e ainda dispara" |

Toda entrada marcada leva, por motivo, `naMarca` (o texto guardado, ou `null` se o motivo é novo) e
`novo` (motivo que não estava na marca).

**Degrau** (`estado`): `com-acao` (tem entrada ativa ou voltou), `aguardando` (só entradas aguardando),
`vazio` (nenhuma entrada) com `contagem = {semDisparo, naoDecide, semLeitura}` e
`semLeituraPorMotivo = [{motivo, chaves: chave[]}]`.

## Transições

```text
ativa --marcar--> aguardando --hoje >= reler e dispara--> voltou --marcar--> aguardando
aguardando|voltou --desfazer--> ativa
qualquer --regra não dispara (e leitura não falhou)--> (entrada some; a linha fica e não é mostrada)
```

**Primeira tarefa**: a primeira entrada `ativa` ou `voltou` na ordem de ataque (degraus 1→5, ordem da
054 dentro do degrau). Nenhuma: não há destaque.
