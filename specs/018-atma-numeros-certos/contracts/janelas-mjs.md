# Contrato: `lib/janelas.mjs` (novo)

**Feature**: `018-atma-numeros-certos` · FR-001 a FR-006, FR-008, FR-009

Módulo **puro**: sem env, sem banco, sem rede, **sem relógio além do parâmetro**. Não importa nada
de `lib/` — é a folha da árvore de dependências, para que `scripts/funil.mjs` possa importá-lo sem
arrastar `pg` nem `google-auth-library`.

## Imports permitidos

Nenhum. Zero.

## Por que existe

Hoje há **duas** definições de janela no repo:

| onde | o quê |
|---|---|
| `lib/okr-coleta.ts:26-30` | `FIM = isoDaysAgo(3)`, `INICIO = isoDaysAgo(30)`, `HOJE = isoDaysAgo(0)` |
| `scripts/funil.mjs:28-29` | `INICIO = diasAtras(31)`, `FIM = diasAtras(3)` |

Duas verdades sobre "a janela" divergem na primeira spec que mexer em uma delas — e esta é
exatamente essa spec. **Nenhuma outra definição PODE existir no repo depois desta feature**
(FR-001).

## API

Toda função recebe `agora` como parâmetro com default — o mesmo padrão de
`lib/gsc-consulta.mjs:17` (`diasAtras(n, agora = Date.now())`). **Nunca** constante avaliada no
import: a época faz a janela crescer todo dia, e sem `agora` parametrizado o teste passa hoje e
reprova amanhã.

### `descoberta(agora = Date.now()) → Janela`

```js
{ nome: "DESCOBERTA", inicio, fim, porque: "o Search Console fecha o dia com ~3 dias de atraso" }
```

28 dias fechando em `D-3`. **Não muda nesta spec** (FR-003): esticar para 8 meses trocaria a célula
`visitante` dos 17 projetos e o ranking do portfólio inteiro — amplitude que não anda escondida
dentro de uma correção. As janelas longas são a 019.

### `comportamento(agora = Date.now()) → Janela`

```js
{ nome: "COMPORTAMENTO", inicio, fim, porque: "mesma janela da Descoberta até a 019" }
```

28 dias fechando em `D-3`. **Não muda nesta spec** (FR-003).

### `conversao(agora = Date.now(), epoca = null) → Janela`

```js
// com epoca:
{ nome: "CONVERSAO", inicio: epoca.data, fim: hoje(agora), porque: epoca.porque }
// sem epoca:
{ nome: "CONVERSAO", inicio: diasAtras(30), fim: diasAtras(3), porque: "sem época declarada no card" }
```

**A única que troca de tamanho nesta spec** (FR-003), e só para projeto que declara `epoca`.

`epoca.data → hoje` e **não** uma janela rolante de 37 dias: rolante faria os leads de agosto
caírem fora com o tempo, jogando fora exatamente o que a época existe para preservar (FR-005).

Isto **não** contradiz a FR-002: o que a FR-002 proíbe é janela definida pelo que a fonte
devolveu. A época é uma data que alguém escreveu no card e que aparece na tela.

### `hoje(agora = Date.now()) → string`

`YYYY-MM-DD` de `D-0`. O prazo da meta é compromisso de **calendário**; o atraso de 3 dias do GSC é
defeito da fonte, não do calendário (mantém a decisão D3 da 010).

## Invariantes testáveis

| # | Invariante | Teste |
|---|---|---|
| I1 | Puro — nenhum `process.env`, `Date.now()` fora de default, import de rede/banco | inspeção + `import` sem `--env-file` |
| I2 | `inicio <= fim` em toda janela, para qualquer `agora` e qualquer época passada | `test/janelas.test.mjs` |
| I3 | `conversao(agora, null)` é **byte a byte** a janela de hoje (28d/D-3) | SC-007 |
| I4 | `conversao(agora, epoca)` cresce quando `agora` avança e `epoca` fica parada | `test/janelas.test.mjs` |
| I5 | `descoberta` e `comportamento` são idênticas entre si e à janela de hoje | FR-003 |

## Consumidores

| arquivo | o que muda |
|---|---|
| `lib/okr-coleta.ts` | `INICIO`/`FIM`/`HOJE` passam a **derivar** daqui; as telas continuam importando de lá e nenhum call site muda de forma |
| `scripts/funil.mjs` | apaga a cópia local (`diasAtras(31)`/`diasAtras(3)`) e importa daqui |
| `app/okr/page.tsx` | exibe a janela de **cada linha**, não uma no cabeçalho (FR-009) |
| `app/okr/[slug]/page.tsx` | exibe a janela colada em cada número e a época com o motivo (FR-005, FR-008) |
