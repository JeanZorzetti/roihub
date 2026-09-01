# Phase 1 — Data model: projeção invertida

Nada aqui é tabela de banco. A feature não escreve em lugar nenhum: uma entrada nova no card
(`meta`, curada à mão) e um objeto de saída em memória, calculado por request. O "modelo" é o
contrato entre `data/projects.json`, `lib/projecao.mjs` e `app/okr/page.tsx`.

## Célula, herdada de `lib/funil.mjs`

```js
/** @typedef {{valor:number}|{naoApurado:string}} Celula */
```

Toda saída numérica desta feature é `Celula`. `0` só existe como medição; ausência é sempre
`{ naoApurado: motivo }` com o motivo em português, pronto para a tela — a mesma regra da 009.

---

## 1. `Meta` — entrada declarada pelo humano

Mora em `data/projects.json`, por card, e entra no tipo `Project` de `lib/projects.ts`.

| Campo | Tipo | Regra |
|---|---|---|
| `valor` | `number` (R$) | **O que falta a partir da declaração**, não o total histórico. `> 0`; ausente ou `≤ 0` → `não apurado: sem valor de meta declarado` |
| `ticket` | `number` (R$ por unidade de N1) | `> 0`. Ausente ou `0` → `não apurado: sem ticket declarado — R$ não vira contagem sem valor por unidade` (FR-003, US1-AC3) |
| `prazo` | `string` `YYYY-MM-DD` | Data válida e futura. Inválida → `não apurado: prazo ausente ou inválido`; passada → `não apurado: prazo vencido em <data>` (US3-AC2) |
| `declaradaEm` | `string` `YYYY-MM-DD` | Data em que `valor` foi escrito. **Só exibição** — nunca entra em conta e nunca invalida a meta (D10) |

**Rótulo obrigatório (FR-002)**: `valor` e `ticket` são exibidos como **declarados**, nunca como
apurados. Não existe meta inferida, herdada, ou padrão (FR-001, FR-012).

Card da `atma` (o único desta feature — Q4):

```json
"meta": { "valor": 50000, "ticket": 4000, "prazo": "2026-12-31", "declaradaEm": "2026-09-01" }
```

---

## 2. `Ancora` — o denominador da inversão

Derivada da ficha da 009 (`montarFicha().marcos`), não declarada.

| Campo | Tipo | Descrição |
|---|---|---|
| `chave` | `string` | chave do marco (`lead`, `visitante`, …) |
| `nome` | `string` | nome exibível do degrau |
| `indice` | `number` | posição na cadeia do perfil |
| `valor` | `number` | valor apurado do degrau |
| `ehFinal` | `boolean` | a âncora é o próprio N1 — decide o ramo da D9 |

**Regra de eleição (FR-005, literal)**: percorre `marcos` do topo, para no primeiro `não apurado`,
devolve o último apurado. Degrau apurado depois de um buraco NÃO é âncora — em `atma`,
`tratamento = 0` é apurado e vem depois de três `não apurado`; a âncora é `lead` (SC-007).

| Situação | Âncora |
|---|---|
| nenhum degrau apurado | `null` → `não apurado: sem âncora — nenhum degrau medido para dividir` |
| só o degrau final apurado (após buraco) | `null` (mesma mensagem) |
| topo apurado, furo no meio | último apurado antes do furo, `ehFinal: false` |
| cadeia inteira apurada | o degrau final, `ehFinal: true` → ramo do múltiplo (D9) |
| âncora existe com `valor === 0` | `não apurado: âncora zerada — meta não se divide por volume nenhum` |

---

## 3. `Normalizacao` — do prazo para a janela (FR-004)

| Campo | Tipo | Descrição |
|---|---|---|
| `janelaDias` | `number` | 28, a janela da R7 herdada da 009 |
| `diasRestantes` | `number` | de **`hoje`** (inclusive) até `prazo` — nunca de `declaradaEm` (D3) |
| `janelas` | `number` | `diasRestantes ÷ janelaDias` |
| `encurtada` | `boolean` | `diasRestantes < janelaDias` |
| `conta` | `string` | a conta escrita, para a tela |

Fórmula única (D3): `n1Janela = n1Total × (janelaDias ÷ diasRestantes)`.

---

## 4. `Projecao` — a saída completa de `projetar()`

| Campo | Tipo | Descrição |
|---|---|---|
| `n1Total` | `Celula` | `meta.valor ÷ meta.ticket` — contagem da unidade final no prazo inteiro |
| `n1Janela` | `Celula` | `n1Total` normalizado para a janela |
| `ancora` | `Ancora \| null` | ver §2 |
| `fatorObrigatorio` | `Celula` | `n1Janela ÷ ancora.valor`, **só** com `ancora.ehFinal === false`. Pode exceder 1 — é o teste de viabilidade |
| `multiploNecessario` | `Celula` | `n1Janela ÷ ancora.valor`, **só** com `ancora.ehFinal === true`. Sem teto — é crescimento (D9) |
| `folga` | `Celula` | `1 ÷ multiploNecessario`, só quando o múltiplo `< 1` |
| `multiploDeVolume` | `Celula` | igual a `fatorObrigatorio` quando `> 1` (D4) |
| `degrausAMedir` | `{de,para}[]` | as transições entre a âncora e o fim da cadeia (FR-009). Vazio quando `ancora.ehFinal` |
| `normalizacao` | `Normalizacao \| null` | |
| `veredito` | `string` | uma das etiquetas abaixo |
| `motivo` | `string` | a frase pronta para a tela, com a prova aritmética |

`fatorObrigatorio` e `multiploNecessario` **nunca** saem apurados ao mesmo tempo (D9, FR-010).

### Vereditos possíveis

| `veredito` | Condição | O que a tela diz |
|---|---|---|
| `nao-apurado` | qualquer guarda abaixo falhou | o motivo, no lugar do número (R1) |
| `cabe` | `ehFinal: false` e `0 < fator < 1` | fator com a fração colada + os degraus a medir |
| `limite` | `ehFinal: false` e `fator === 1` | 100% em todos os degraus restantes — limite, não meta |
| `impossivel` | `ehFinal: false` e `fator > 1` | prova aritmética + `multiploDeVolume` em volume OU ticket |
| `multiplo` | `ehFinal: true` e múltiplo `≥ 1` | precisa de `N×` — **sem** veredito de impossibilidade |
| `folga` | `ehFinal: true` e múltiplo `< 1` | folga de `N×`, sem alerta |

⚠️ `impossivel` **jamais** dispara com `ancora.ehFinal === true`. O teto de 100% vem do produto de
taxas ≤ 1; sem degrau no trecho não há produto, e "crescer 2×" não é impossibilidade (D9).

### Ordem das guardas — é a ordem da própria divisão

Cada guarda nomeia **o primeiro fator que falta na conta**, na ordem em que a conta o usa. Uma
ordem arbitrária faria o mesmo card exibir motivos diferentes conforme a implementação mudasse.

1. `ficha.semPerfil` → `sem perfil declarado` (herda a 009)
2. `meta` ausente → `sem meta declarada` (FR-013, US1-AC2)
3. `meta.valor` ausente ou `≤ 0` → `sem valor de meta declarado`
4. `meta.ticket` ausente ou `≤ 0` → `sem ticket declarado — R$ não vira contagem sem valor por unidade`
5. `meta.prazo` inválido → `prazo ausente ou inválido`
6. `meta.prazo` vencido → `prazo vencido em <data>`
7. âncora `null` → `sem âncora — nenhum degrau medido para dividir`
8. âncora `0` → `âncora zerada — meta não se divide por volume nenhum`

`declaradaEm` não tem guarda: ausente ou antiga, a meta continua válida (D10).

---

## 5. Fluxo de dados

```text
data/projects.json  ──(curadoria à mão: meta)──┐
                                               ▼
lib/projects.ts  listProjects()  ──> Project { perfil, meta, vendas, … }
                                               │
app/okr/page.tsx  coleta GSC + CRM + vendas ───┤
                                               ▼
lib/okr.mjs   montarFicha() ──> ficha ──> posicaoDeAtaque()   (009, intocado)
                                 │
                                 ▼
lib/projecao.mjs  projetar({ ficha, meta, hoje, janelaDias }) ──> Projecao
        │                                                           │
        └──> lib/funil.mjs  razao() | exigencia()  (D7)             ▼
                                              bloco no card, abaixo do veredito (D6)
```

Nenhuma escrita, nenhuma consulta nova: a inversão é aritmética sobre células que a 009 já produz.

---

## 6. Caso de referência — `atma` (datado, não é teste)

`535 cliques → 39 leads (7,29%) → 0 vendas`, perfil D, medido em 01/09/2026. Com a meta do §1,
lida em **01/09/2026**:

| Passo | Conta | Resultado |
|---|---|---|
| N1 total | `50.000 ÷ 4.000` | `12,5 tratamentos` no prazo |
| normalização | 121 dias restantes ÷ 28 | `4,32 janelas` |
| N1 na janela | `12,5 × 28/121` | `2,89` |
| âncora | contígua do topo, para em `contatado` | `lead = 39`, `ehFinal: false` |
| fator obrigatório | `2,89 ÷ 39` | `7,42% (2,89/39)` → **cabe** |
| degraus a medir | 4 | `lead→contatado`, `contatado→agendada`, `agendada→compareceu`, `compareceu→tratamento` |

⚠️ **O número muda com a data de leitura**, porque `diasRestantes` conta de hoje (D3). O `32,05%`
do Contexto da spec continua correto como ilustração — lá a meta é declarada *na janela*, aqui o
prazo é o ano. O teste automatizado usa cadeia **sintética** com `hoje` fixo; a conferência com
`atma` é manual e datada.
