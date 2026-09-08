# Data Model: Marca e não-marca (025)

Uma tabela alterada, **nenhuma tabela nova**. Um campo novo na curadoria. Três formas puras em
memória.

---

## 1. `hub_gsc_dia` — sete colunas acrescentadas

A tabela é a da 021. As colunas `impressoes`, `cliques` e `posicao` **não mudam de significado**:
continuam sendo o **site inteiro, sem corte de país**, e são elas que alimentam a tela de 8 meses e
a célula `visitante` da ficha. Mexer nelas moveria números de outra feature.

```sql
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS impressoes_pais INT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS cliques_pais INT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS impressoes_marca INT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS cliques_marca INT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS impressoes_nao_marca INT;
ALTER TABLE hub_gsc_dia ADD COLUMN IF NOT EXISTS cliques_nao_marca INT;
```

No `ensure()` de `lib/db.ts`, junto do `CREATE TABLE` da 021 — é o padrão já usado por
`hub_tasks` (`descricao`, `tipo`, `responsavel`, `gerador`).

| coluna | tipo | significado |
|---|---|---|
| `pais` | `TEXT` NULL | O corte declarado que produziu as seis colunas seguintes (ISO-3166-1 alfa-3 minúsculo, ex. `bra`). **`NULL` = não declarada** |
| `impressoes_pais` / `cliques_pais` | `INT` NULL | Total **dentro do corte**. O denominador da razão de marca e o alvo da conferência da FR-006 |
| `impressoes_marca` / `cliques_marca` | `INT` NULL | A fatia que casou o padrão de marca, dentro do corte |
| `impressoes_nao_marca` / `cliques_nao_marca` | `INT` NULL | A fatia que **não** casou, dentro do corte. **Medida, não subtraída** (D1) |

### As três regras que o modelo carrega

1. **`NULL` é "não declarada", nunca zero** (FR-004). As sete colunas andam juntas: ou todas
   preenchidas para aquele dia, ou todas `NULL`. Nenhum `NOT NULL`, nenhum `DEFAULT 0` — um default
   de zero transformaria 480 dias de "nunca perguntei" em "nenhuma busca de marca", que é a mentira
   exata que a FR-004 proíbe.
2. **Zero é zero** (D5). Dia dentro da janela pedida em que a perna de marca não devolveu linha
   grava `0`, não `NULL`. O GSC omite o dia sem impressão; sem o adensamento, "não houve busca de
   marca" e "não declarada" ficariam indistinguíveis dentro do banco.
3. **Sem coluna de razão, sem coluna de resíduo, sem coluna de crescimento.** Todos são divisões e
   subtrações exatas das colunas acima — mesma regra que já manteve o CTR fora desta tabela e a
   taxa fora de `hub_indexacao`. Coluna gravada só cria a chance de divergir da própria conta.

### O que a chave garante

`PRIMARY KEY (projeto, dia)` continua igual, e é ela que dá a FR-015: repetir a corrida no mesmo
dia reescreve as mesmas linhas com os mesmos valores. `projeto` é o **slug**, nunca o rótulo de
exibição.

---

## 2. `data/projects.json` — o campo `marca` no card

```jsonc
{
  "slug": "atma",
  "marca": {
    "termos": ["atma", "atma aligner", "atma alinhadores"],
    "pais": "bra",
    "declaradaEm": "2026-09-08"
  }
}
```

Tipado em `lib/projects.ts` (Princípio I: quem lê é `listProjects()`, nunca o JSON direto):

```ts
/** Curadoria humana: as variantes pelas quais as pessoas procuram o projeto pelo NOME, e o
 *  corte de país sob o qual a classificação vale. Ausente é o estado padrão dos outros 34
 *  projetos — "não declarada", nunca "zero buscas de marca" (FR-004). */
marca?: { termos: string[]; pais: string; declaradaEm?: string };
```

| campo | obrigatório | nota |
|---|---|---|
| `termos` | sim, e não-vazio | Casamento por palavra inteira, sem acento derivado (D3). É esta lista que a tela exibe (FR-012) — a lista declarada, não a expandida |
| `pais` | **sim** | Sem ele a razão sai contaminada (D2). `termos` sem `pais` é declaração inválida ⇒ tratada como **não declarada**, com o motivo nomeado na tela |
| `declaradaEm` | não | Mesma razão de `epoca.data` e `ficha.declaradaEm`: declaração sem data apodrece calada |

**Validação** (`marcaDeclarada(projeto)` em `lib/marca.mjs`, pura): devolve
`{ termos, pais, padrao }` ou `null` com o motivo — `ausente`, `sem-termos`, `sem-pais`. Três
motivos, três frases na tela; um `null` mudo faria "não curei ainda" parecer com "curei errado".

---

## 3. Formas em memória (`lib/marca.mjs`, puro)

### `PernaDeMarca`

O que uma perna do GSC vira depois do adensamento (D5):

```ts
type PernaDeMarca = { dia: string; impressoes: number; cliques: number };  // dia = YYYY-MM-DD
```

### `DiaSeparado`

O que `lerDiasGsc()` passa a devolver — `DiaGsc` da 021 mais as sete colunas, com os nomes do
domínio:

```ts
type DiaSeparado = DiaGsc & {
  pais: string | null;
  impressoesPais: number | null;  cliquesPais: number | null;
  impressoesMarca: number | null; cliquesMarca: number | null;
  impressoesNaoMarca: number | null; cliquesNaoMarca: number | null;
};
```

**Derivados, nunca gravados**:

| derivado | conta | `null` quando |
|---|---|---|
| `residuo(dia)` | `impressoesPais − (impressoesMarca + impressoesNaoMarca)` | qualquer uma das três é `null` |
| `razaoDeMarca(dias)` | `Σ impressoesMarca ÷ Σ impressoesPais` | denominador `0` ou nenhum dia declarado |
| `crescimentoNaoMarca(dias, hoje)` | `(mês N ÷ mês N−1) − 1` sobre `impressoesNaoMarca` | menos de **dois** meses fechados (D9) — "ainda não apurável", nunca `0%` |

### `MesFechado`

```ts
type MesFechado = { mes: string; impressoesNaoMarca: number; dias: number };  // mes = YYYY-MM
```

Só entra o mês que satisfaz as **duas** condições da D9: calendário completo na série **e** três
dias de folga depois do último dia do mês. Mês parcial não vira `MesFechado` — ele não existe na
lista, em vez de existir com uma marca de "incompleto" que alguém acabaria comparando.

### `Completude`

O veredito da FR-006/FR-007, calculado sobre a janela exibida:

```ts
type Completude =
  | { estado: "nao-declarada" }
  | { estado: "fecha"; residuo: 0 }
  | { estado: "piso"; residuo: number; fracao: number }        // residuo > 0
  | { estado: "contradicao"; residuo: number };                // residuo < 0 — é defeito, não anonimização
```

Quatro estados e não um booleano: `contradicao` (as pernas somam **mais** que o total) não é "não
fecha um pouco mais", é sinal de que o filtro está errado (D8/D13), e o conserto é oposto ao de um
piso. Colapsar os dois faria um bug de regex se disfarçar de limitação da fonte — e sair na tela
como uma ressalva educada em vez de um alarme.

---

## 4. O que este modelo NÃO guarda

- **A consulta.** Nenhuma linha por `query` é persistida: é a dimensão que omite as raras (D1), e
  guardá-la traria o piso para dentro do banco.
- **Posição por marca/não-marca.** Out of Scope da spec.
- **O padrão de regex.** É derivado de `termos` a cada leitura (D3). Gravá-lo criaria a chance de o
  padrão que classificou divergir da lista que a tela mostra.
- **Uma segunda série paralela.** Assumption da spec: duas séries do mesmo Search Console
  divergiriam na primeira mudança de janela.
