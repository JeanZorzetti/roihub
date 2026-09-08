# Contrato: `POST /api/gsc-serie` (025) e as leituras de marca

A rota é a da 021 e **não muda de nome, de segredo, de cron nem de `maxDuration`**. O que muda é o
que ela faz depois de gravar o total, e o que ela devolve.

---

## 1. `POST /api/gsc-serie`

### Autenticação

Inalterada: `middleware.ts` exige `Authorization: Bearer <CRON_SECRET>`. Sem segredo novo —
`GOOGLE_SERVICE_ACCOUNT_JSON` e `DATABASE_URL` já são as mesmas credenciais.

### Ambiente (Princípio V)

Inalterado. `503` com **apenas os nomes** ausentes:

```json
{ "error": "ambiente incompleto", "faltando": ["DATABASE_URL"] }
```

### O que a corrida passa a fazer, por projeto de `projetosDeBusca()`

1. Grava o total como hoje (janela incremental, `gravarDiasGsc`). **Sem alteração.**
2. Lê a declaração de marca do card. **Não declarada ⇒ pula para o próximo projeto**, e o slug sai
   em `semMarca` com o motivo. O total já está gravado (FR-004).
3. Declarada ⇒ pede **três** séries na **mesma janela** de 480 dias (D4) e na **mesma corrida**
   (D13), todas com `dimensions: ["date"]`:

   | perna | `dimensionFilterGroups[0].filters` |
   |---|---|
   | total do corte | `page contains https://<host>/` · `country equals <pais>` |
   | marca | as duas acima · `query includingRegex (?i)<padrao>` |
   | não-marca | as duas acima · `query excludingRegex (?i)<padrao>` |

4. Adensa as três (D5) e grava com `gravarMarcaGsc()` — `UPDATE`, nunca `INSERT` (D6).

### Resposta `200`

Os campos da 021 permanecem. Três acrescentados:

```json
{
  "projetos": 1,
  "linhas": 3,
  "gravados": { "atma": 3 },
  "backfills": [],
  "semPropriedade": [],
  "falhas": [],

  "marca": {
    "atma": { "dias": 480, "atualizados": 241, "semLinhaDeTotal": 239, "termos": 3, "pais": "bra" }
  },
  "conferencia": {
    "atma": {
      "impressoesPais": 18432,
      "impressoesMarca": 7311,
      "impressoesNaoMarca": 11009,
      "residuo": 112,
      "fracao": 0.0061,
      "veredito": "piso"
    }
  },
  "semMarca": [{ "projeto": "sirius", "motivo": "ausente" }]
}
```

| campo | contrato |
|---|---|
| `marca[slug].semLinhaDeTotal` | dias da janela de marca sem linha de total, portanto pulados (D6). **Alto é normal na primeira corrida** — a série do total só existe desde 11/01/2026 e a janela de marca pede 480 dias |
| `conferencia[slug]` | **É a FR-006 registrada.** Somatório da janela inteira e o `veredito` de quatro estados: `fecha`, `piso`, `contradicao`, `nao-declarada` |
| `conferencia[slug].veredito = "contradicao"` | resíduo negativo — defeito de filtro, não anonimização (D8/D13). A corrida **continua devolvendo 200**: o dado gravado é honesto e o alarme é o campo, não o status |
| `semMarca[]` | motivo entre `ausente`, `sem-termos`, `sem-pais` — três faltas diferentes, três consertos diferentes |

**Nunca no corpo**: valor de credencial, prefixo, comprimento. Erro de projeto continua truncado em
60 caracteres, como na 021.

### Falha parcial

Igual à 021: um projeto que estoura entra em `falhas` e a corrida segue. **Novo**: falha só das
pernas de marca deixa o total gravado e o projeto em `falhas` — o dado do total não é revertido, e
as colunas de marca daquele dia ficam com o valor da corrida anterior. Não há estado intermediário
visível: a leitura só considera declarado o dia com as sete colunas preenchidas.

### Idempotência (FR-015)

`gravarDiasGsc` (`ON CONFLICT DO UPDATE`) e `gravarMarcaGsc` (`UPDATE`) são ambos idempotentes.
Duas corridas no mesmo dia, com a mesma lista de termos, deixam o banco byte a byte igual — o único
movimento legítimo é o GSC ter fechado um dia que estava provisório.

---

## 2. `lerDiasGsc(projeto, inicio?, fim?)` — leitura, `lib/db.ts`

Assinatura inalterada. O retorno ganha as sete colunas com nomes de domínio (ver `data-model.md`,
§3). Todas `null` para os dias que nasceram antes desta feature ou de projeto sem lista.

**Primeiro consumidor**: a aba `/okr/[slug]/aquisicao`. Até aqui a função existia sem ninguém
chamando (D11).

---

## 3. `lib/marca.mjs` — o módulo puro (Princípio III)

Zero imports, sem `process.env`, sem `pg`, sem `fetch`, sem relógio interno.

```js
/** O padrão de casamento, como STRING sem flags. Uma fonte para os dois consumidores (D3):
 *  a corrida prefixa "(?i)" e manda ao GSC; a tela faz new RegExp(padrao, "i"). */
export function regexDeMarca(termos)

/** A declaração validada do card, ou null com o motivo (ausente | sem-termos | sem-pais). */
export function marcaDeclarada(projeto)

/** Todos os dias da janela, com 0 onde o GSC não devolveu linha (D5). */
export function adensarDias(inicio, fim, linhas)

/** Meses com calendário completo E três dias de folga depois do fim (D9). */
export function mesesFechados(dias, hoje)

/** (mês N ÷ mês N−1) − 1 sobre impressoesNaoMarca. null com menos de dois meses fechados. */
export function crescimentoNaoMarca(dias, hoje)

/** Σ impressoesMarca ÷ Σ impressoesPais na janela. null sem denominador. */
export function razaoDeMarca(dias)

/** O veredito de completude da FR-006/FR-007, em quatro estados. */
export function completude(dias)
```

Nenhuma delas conhece o Search Console, o Postgres ou o Next. É o que permite provar a D9 (as duas
formas de fabricar queda) e a D3 (`atma` casa `atma aligner` e não casa `atmasfera`) em
milissegundos, sem gastar requisição.

---

## 4. `canibalizacao(linhas, ehMarca = null)` — `lib/kpis-busca.mjs`

**Mudança de forma**, e é deliberada (D10):

```js
// antes: LinhaCanibalizada[]
// agora:
{ lista: LinhaCanibalizada[], removidas: number | null }
```

| `ehMarca` | `removidas` | comportamento |
|---|---|---|
| ausente / `null` | `null` | Lista intacta — o comportamento de hoje, preservado (FR-013) |
| função | `0..n` | Consultas que casam saem da lista, e a contagem vai para a tela (FR-011) |

`removidas: null` (não declarada) ≠ `removidas: 0` (declarada, nada casou). `kpisDeBusca(linhas,
ehMarca)` repassa o argumento.

**Quebra**: um consumidor (`app/okr/[slug]/aquisicao/page.tsx`) e três asserções de
`test/kpis-busca.test.mjs` mudam no mesmo commit.
