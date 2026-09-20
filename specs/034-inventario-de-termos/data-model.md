# Modelo de dados — 034

## `data/inventario-de-termos.json`

Objeto chaveado por `slug` de projeto. Um projeto tem no máximo um inventário; hoje só `atma` tem.

```json
{
  "atma": {
    "procedencia": {
      "congeladoEm": "2026-09-20",
      "janela": { "inicio": "2026-01-17", "fim": "2026-09-17" },
      "piso": 20,
      "dimensao": "query",
      "propriedades": ["sc-domain:roilabs.com.br", "sc-domain:usealigner.com"],
      "hosts": ["usealigner.com", "atma.roilabs.com.br"],
      "excluiMarca": ["atma", "atma aligner", "atma alinhadores"],
      "porque": "piso de 20 impressões em 8 meses retém 94,2% das impressões não-marca em 19% dos termos; abaixo disso é fragmento de uma impressão, não termo estratégico"
    },
    "termos": ["invisalign", "aparelho invisivel preço", "..."]
  }
}
```

### Regras do arquivo

| campo | regra | por que é regra e não convenção |
|---|---|---|
| `termos` | lista não vazia de strings únicas, já em minúsculas como o Search Console devolve | lista vazia divide por zero e devolve `NaN` para a tela; duplicata infla o denominador em silêncio |
| `procedencia.janela` | obrigatória, com `inicio` e `fim` | sem ela ninguém consegue refazer a lista, e o arquivo vira número digitado |
| `procedencia.piso` | obrigatório | é o parâmetro que mais move o KPI (61,3% a 21,0%); omiti-lo esconde a decisão |
| `procedencia.congeladoEm` | obrigatório | é o que separa "inventário declarado" de "snapshot que se refez sozinho" |
| `procedencia.excluiMarca` | obrigatório, mesmo que vazio | lista vazia declarada é diferente de esquecimento — e marca dentro do inventário mede outra coisa |

`lerInventario(slug)` recusa o arquivo que viole qualquer linha da tabela. Recusa é exceção, não
`null`: `null` significa "este projeto não tem inventário", que é estado válido para 34 dos 35, e
colapsar os dois faria erro de curadoria parecer com ausência de curadoria.

## `penetracaoNoTop3(linhas, inventario)`

```
{
  fracao: 0.102,        // noTop3 ÷ total — o KPI
  noTop3: 74,           // termos do inventário com posição ≤ 3 na janela
  total: 725,           // o inventário INTEIRO, sempre
  cobertura: 454,       // termos do inventário com impressão na janela
  piso: true            // cobertura < total ⇒ o número é piso
}
```

Devolve `null` quando `inventario` é `null` — **nunca** `{fracao: 0}`.

### Os quatro estados, e por que são quatro

| estado | condição | o que a tela diz |
|---|---|---|
| medido | inventário presente, leitura com linhas | `10,2% (74 de 725)` + janela + cobertura |
| piso | o acima, com `cobertura < total` | o mesmo, com o selo `piso` e a frase que explica |
| sem inventário | `lerInventario()` devolve `null` | "não apurado — inventário não declarado para este projeto" |
| falha de leitura | `gscTermos()` devolve `{erro}` | "não apurado — a leitura do Search Console falhou" |

Os dois últimos têm consertos opostos (curar uma lista × investigar uma credencial) e é por isso que
não colapsam num `null` mudo — a mesma regra que `GscSeries` já segue em `lib/gsc.ts`.

## O denominador não encolhe

Um termo do inventário sem impressão na janela **fica** no denominador e não entra no numerador.

A alternativa — medir só sobre os termos apurados — daria 16,3% em vez de 10,2% hoje, e sobe sozinha
conforme o site some do radar: quanto menos termos a janela devolve, melhor o número fica. É a mesma
armadilha que o hub já documentou em `consertar_o_numerador_expoe_o_denominador`, entrando pelo lado
do denominador.

A defesa contra ler o piso como verdade é publicar a cobertura ao lado, sempre.
