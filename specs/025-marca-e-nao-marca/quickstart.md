# Quickstart: como provar que a 025 funciona

Cinco checagens, na ordem em que destravam. As três primeiras não gastam requisição nenhuma do
Search Console.

---

## Pré-requisitos

- Node 22, `npm ci` feito.
- Para as checagens 4 e 5: `DATABASE_URL`, `GOOGLE_SERVICE_ACCOUNT_JSON` e `CRON_SECRET` no
  ambiente, e a série da 021 já gravada para a `atma` (ela cobre desde 11/01/2026).

---

## 1. A suíte inteira, verde (Princípio II)

```bash
npm test
```

Espera-se: ~1,6 s, zero falhas. `test/marca.test.mjs` é **novo** e precisa estar na lista explícita
de `package.json` **no mesmo commit** — `test/validade.test.mjs` reprova se esquecermos.

---

## 2. A regra de casamento (D3) — a armadilha do segundo projeto

```bash
node --test test/marca.test.mjs
```

O que precisa estar provado ali, com a lista `["atma", "atma aligner"]`:

| consulta | casa? | por quê |
|---|---|---|
| `atma` | sim | termo exato |
| `atma aligner` | sim | palavra inteira, e o termo longo vem antes na alternação |
| `ATMA Aligner` | sim | `(?i)` / flag `i` |
| `preço atma alinhador` | sim | `\b` casa no meio da consulta |
| `atmasfera` | **não** | é o teste que impede a marca de comer não-marca |
| `alinhador invisível` | **não** | genérica |

E a asserção que fecha a D3: `regexDeMarca(["atma", "atma aligner"])` produz o termo **longo
primeiro**. Alternação *leftmost-first* com o curto na frente casaria só `atma`, e o padrão ainda
"funcionaria" — o erro só apareceria numa contagem, meses depois.

---

## 3. As duas formas de fabricar queda (D9)

Ainda em `test/marca.test.mjs`, sem rede e sem banco:

```js
// Série de 11/01 a 31/03. Janeiro tem 21 dias.
mesesFechados(serie, "2026-04-05")   // → ["2026-02", "2026-03"], NUNCA "2026-01"
```

1. **Mês parcial fora**: janeiro tem 21 dos 31 dias e não entra. Se entrasse, fevereiro apareceria
   com crescimento de calendário.
2. **Ponta provisória fora**: com `hoje = "2026-04-01"`, março **também** sai — faltam os 3 dias de
   folga, e o GSC ainda vai subir os últimos dias dele.
3. **Primeiro mês fechado**: `crescimentoNaoMarca` devolve `null` quando há um só mês fechado.
   `null` é "ainda não apurável" (FR-009). **Uma asserção explícita de que não é `0`.**

---

## 4. A corrida, e a resposta da pergunta que a spec deixou aberta

```bash
curl -sS -X POST "$HUB_URL/api/gsc-serie" \
  -H "authorization: Bearer $CRON_SECRET" --max-time 360 | jq .conferencia
```

Espera-se, para a `atma`:

```json
{ "atma": { "impressoesPais": 18432, "impressoesMarca": 7311,
            "impressoesNaoMarca": 11009, "residuo": 112, "fracao": 0.0061,
            "veredito": "piso" } }
```

**Leia nesta ordem** — a segunda checagem é a que impede a primeira de mentir:

| olhe | e conclua |
|---|---|
| `impressoesMarca > 0` | **Antes de qualquer coisa.** Marca zerada com resíduo ≈ 0 não é "fecha": é `includingRegex` exigindo casamento da consulta inteira (D13), e não-marca engoliu tudo. O `veredito` diria `fecha` e estaria errado |
| `veredito` | `fecha` ⇒ o filtro por consulta preserva as raras, as duas medidas são completas. `piso` ⇒ as duas são pisos e a tela diz isso (FR-007). `contradicao` ⇒ resíduo negativo, o `excludingRegex` não é o complemento exato — **é defeito, não limitação da fonte** |
| `fracao` | é o "tamanho da diferença" que a FR-007 manda informar |
| `marca.atma.semLinhaDeTotal` | ~239 na primeira corrida é o esperado: a janela de marca pede 480 dias e a série do total começa em 11/01/2026 |

**Registre o número.** É a SC-003, e é o produto mais duradouro desta feature — a resposta a uma
pergunta que só a medição responde.

### Idempotência (FR-015)

Rode de novo, na mesma hora:

```bash
curl -sS -X POST "$HUB_URL/api/gsc-serie" -H "authorization: Bearer $CRON_SECRET" | jq .conferencia
```

Os mesmos números. Diferença só é legítima se o GSC tiver fechado um dia provisório entre as duas —
e a janela dele desliza na **meia-noite UTC**, então não rode uma de cada lado dessa fronteira e
chame a diferença de bug.

---

## 5. A tela

`/okr/atma/aquisicao`, e o que precisa estar visível:

| o quê | FR | prova |
|---|---|---|
| Crescimento de impressões não-marca contra **5% a 10%/mês** | FR-008 | Os dois meses comparados aparecem **nomeados** (`2026-08 → 2026-09`). Nenhum deles é o mês corrente |
| Proporção de buscas de marca com a **janela declarada** | FR-010 | A janela sai por extenso, como em todo bloco da aba |
| O rótulo de completude | FR-007 | Com `veredito = "piso"`, os dois números saem marcados **piso** e o tamanho da diferença aparece |
| A lista de termos em uso | FR-012 | Os três termos e o corte `bra`, visíveis — é o que permite a quem lê desconfiar da classificação |
| O corte de país declarado | FR-005 | Junto da lista |
| Canibalização sem `atma aligner` | FR-011, SC-006 | A linha some **e** a tela diz *"N consultas de marca removidas"*. Some sem dizer = filtro largo demais escondido |
| O parágrafo de ressalva | SC-006 | **Saiu da tela** para a atma |
| Uma consulta genérica com duas URLs | US3 / Teste Independente | **Continua** aparecendo |

### O projeto sem lista (FR-013)

`/okr/sirius/aquisicao` — o comportamento de hoje, intacto: o parágrafo de ressalva continua lá, a
canibalização não filtra nada, e os dois KPIs novos saem como **não declarada** com o motivo
nomeado (`ausente`), nunca como `0%`.

---

## O que **não** é prova

- **`npm test` verde não prova a 4.** Os módulos puros não conhecem o Search Console; o resíduo só
  existe depois da corrida real. A suíte prova a regra, a corrida prova a fonte.
- **`residuo: 0` sozinho não prova que fecha.** Ver a primeira linha da tabela do §4.
- **A primeira corrida mede a primeira corrida.** Se algum número da §4 sair estranho, rode de novo
  no dia seguinte antes de mexer no código: a janela do GSC desliza, e uma leitura só já deu 33 e
  depois 42 no mesmo fim de tarde.
