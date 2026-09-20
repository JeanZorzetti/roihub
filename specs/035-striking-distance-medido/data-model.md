# Phase 1 — Data Model: Striking Distance por termo

## A entrada

`LinhaPorTermo` — o que `mesclarPorTermo()` (`lib/gsc-hosts.mjs`, 034) devolve:

| campo | tipo | nota |
|---|---|---|
| `termo` | `string` | **o campo que distingue esta forma de `LinhaBusca`** |
| `cliques` | `number` | somado entre os hosts |
| `impressoes` | `number` | somado entre os hosts |
| `posicao` | `number \| null` | média **ponderada por impressões**; `null` quando nenhuma linha votou |
| `hosts` | `string[]` | quem contribuiu |

`posicao: null` não é 0 e não é "posição 100": é ausência de voto. O filtro da faixa testa o **tipo**
antes de comparar, para a medida não depender de `null >= 4` ser `false` por acidente de coerção.

## A saída

`strikingDistancePorTermo(linhas, ehMarca) → MedidaDeStriking | null`

```js
{
  total: number,        // consultas na faixa, marca fora — o número da folha
  impressoes: number,   // impressões somadas dessas consultas
  cliques: number,      // cliques somados dessas consultas
  removidas: number|null, // termos de marca tirados; null = marca não declarada
  base: number,         // termos lidos na janela (denominador de contexto, FR-011)
  cauda: number,        // quantas das `total` têm exatamente 1 impressão (FR-014)
}
```

`null` é devolvido **apenas** quando a forma de linha não carrega `termo` — a trava da FR-004.
Nunca por lista vazia: lista vazia é `{total: 0, ...}`, que é uma medida.

### Por que `removidas: null` ≠ `removidas: 0`

`null` = o projeto não declarou marca, então a fila **pode** conter a marca e ninguém sabe.
`0` = a marca foi declarada e nenhum termo dela caiu na faixa.
Consertos opostos: o primeiro é editar o card, o segundo é não fazer nada. Colapsá-los publicaria
"nenhuma marca na fila" sobre um projeto onde a marca nunca foi procurada. Mesma regra da 027.

### Por que `base` e `cauda` moram no retorno, e não no chamador

Recalculá-los na tela seria a segunda travessia das mesmas linhas, escrita à mão — e é assim que
duas versões do mesmo fato nascem e divergem na primeira edição. A função que conta é a função que
declara sobre o que contou.

## A faixa

`posicao >= 4 && posicao < 11` — `[4,0; 11,0)`, idêntica à de `strikingDistance()`. O rótulo do
board ("Posições 4 a 10") corresponde a `4,0–10,9`: 10,9 entra, 11,0 não.

A faixa **não** é reescrita nesta feature. Se um dia mudar, muda nos dois lugares ou as duas telas
passam a medir faixas diferentes sob o mesmo nome — risco registrado, não resolvido aqui (nenhum
dos dois consumidores a parametriza hoje, e extrair uma constante para dois usos é abstração que
ainda não se pagou).

## Os cinco estados da folha no mapa

Ordem de avaliação — da causa mais específica para a mais genérica, como a 034:

| # | condição | `topic` | conserto que o leitor precisa fazer |
|---|---|---|---|
| 1 | leitura não aconteceu (`termosGsc === null`) | `∅ não apurado · sem leitura do Search Console` + motivo de `motivoDeAusencia` | ligar credencial, declarar host, ou criar propriedade — o motivo diz qual |
| 2 | leitura falhou (`"erro" in termosGsc`) | `∅ não apurado · a leitura do Search Console falhou` + mensagem | nenhum: é transitório, volta na próxima leitura |
| 3 | medida devolveu `null` (forma de linha errada) | `∅ não apurado · forma de linha inesperada na leitura` | bug de código — a medida foi alimentada com a dimensão errada |
| 4 | `total === 0` | `Medido: 0 consultas entre as posições 4,0 e 10,9` | nenhum: é uma medida, e significa que o site não tem nada na faixa |
| 5 | `total > 0` | `Medido: 344 consultas entre as posições 4,0 e 10,9 · base 893 termos lidos` | converter |

**Nenhum dos estados 1–3 renderiza `0`** (FR-008). O estado 4 renderiza `0` e diz que é medida —
essa é a distinção inteira.

**Nenhum estado carrega glifo de veredito** (`▼`/`▲`/`◐`) — FR-009. Os 15% a 25% são meta do board
e `balizador.tipo` desta folha é `recusa`; um glifo ali publicaria julgamento que o painel nega duas
linhas acima.

## A nota (painel de seleção e lista sem JS)

Ordem fixa, porque a nota é lida como frase única:

1. **A medida e a janela** — `344 consultas entre as posições 4,0 e 10,9, sobre 893 termos lidos na
   janela 2026-08-21 → 2026-09-17 (28 dias, fecha em D-3).`
2. **A marca** (FR-005) — `3 termo(s) de marca removido(s) da contagem` ou `a marca própria NÃO foi
   filtrada: o projeto não declara marca no card`.
3. **A cauda** (FR-014) — `93 delas tiveram uma única impressão na janela.`
4. **O inventário** (FR-013), quando existe — `190 das 344 estão no inventário declarado de 725
   termos.`
5. **A divergência** (FR-007) — `/okr/atma/aquisicao publica 362 para o mesmo KPI: lá a leitura é
   por consulta×página, porque a lista de lá é fila de trabalho e precisa nomear a página a
   reforçar. Aqui a contagem é de consultas, como o board pede.`
6. **A meta** — `Meta do board: converter 15% a 25% ao trimestre — meta, não régua.`

## O que muda em `MEDIDO_POR`

```
strikingDistance: "lib/kpis-busca.mjs#strikingDistance"
                ↓
strikingDistance: "lib/kpis-busca.mjs#strikingDistancePorTermo (consultas na faixa 4,0–10,9, dimensão query, marca fora)"
```

`test/gsc-delta.test.mjs` reprova folha marcada `semColetor` que apareça no mapa — o valor novo
continua satisfazendo isso. O selo da folha segue `◇ sem fonte`: ela tem número, não tem régua.
