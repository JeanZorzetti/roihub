# Fase 1 — Modelo de dados: Ficha N0-N6 por projeto

**Feature**: `011-okr-ficha-por-projeto` | **Data**: 2026-09-01

Nenhuma tabela nova, nenhuma migração. As entidades abaixo são estruturas em memória montadas por
`lib/ficha.mjs` a cada requisição, mais um campo curado à mão em `data/projects.json`.

---

## 1. `CelulaFicha` — a unidade, e a única que a tela sabe renderizar

Toda linha de todo nível é uma `CelulaFicha`. Não existe caminho na tela que imprima um número cru.

```js
/**
 * @typedef {{estado:"apurado",     valor:number, rotulo:string, fonte:string}} CelulaApurada
 * @typedef {{estado:"declarado",   valor:number|string, rotulo:string, declaradoEm:string, oQue:string}} CelulaDeclarada
 * @typedef {{estado:"nao-apurado", rotulo:string, motivo:string, consultar:string}} CelulaNaoApurada
 * @typedef {CelulaApurada|CelulaDeclarada|CelulaNaoApurada} CelulaFicha
 */
```

| campo | obrigatório em | por quê |
|---|---|---|
| `estado` | todas | é o que a tela lê primeiro; não há quarto valor |
| `rotulo` | todas | o nome da célula, e a **chave** de KR quando o nível tem espaço de chaves |
| `fonte` | `apurado` | FR-009/SC-003: número apurado sem fonte na mesma linha é proibido |
| `declaradoEm` | `declarado` | FR-014: declaração sem data apodrece calada |
| `oQue` | `declarado` | o campo do card de onde a declaração veio (`meta.ticket`, `ficha.objetivo`) |
| `motivo` | `nao-apurado` | R1: o motivo ocupa o lugar do número |
| `consultar` | `nao-apurado` | R4: a fonte a consultar, não a instrumentação a escrever |

### Máquina de estados — como uma célula nasce

```
célula da 009 ({valor} | {naoApurado})     ──estadoDeApurado(c, fonte)──▶  apurado | nao-apurado
declaração do card (meta.ticket, ficha.*)  ──declarada(v, {em, oQue})───▶  declarado
ausência de coletor / de perfil / de fonte ──naoApurada(motivo, consultar)▶ nao-apurado
```

### Herança (FR-010) — a regra que a aritmética correta não pode furar

`combinar(insumos, calcular)` é o **único** jeito de a ficha produzir célula derivada:

| insumos | resultado |
|---|---|
| qualquer um `nao-apurado` | `nao-apurado`, com o motivo do **primeiro** faltante nomeado |
| nenhum faltante, ao menos um `declarado` | `declarado`, com a data **mais antiga** entre as declarações |
| todos `apurado` | `apurado`, com as fontes concatenadas |

> `0 tratamentos × R$ 4.000 declarados = R$ 0` é uma conta certa e um número **declarado**. Chamá-lo
> de apurado seria a R1 caindo por dentro, com a aritmética impecável.

**Invariante testável**: nenhuma `CelulaFicha` tem `valor === undefined` com `estado !== "nao-apurado"`,
e nenhuma tem `estado === "nao-apurado"` com `valor` presente.

---

## 2. `FichaDeclarada` — o que o humano escreve no card

Campo `ficha` em `data/projects.json`, opcional, ao lado de `perfil`, `meta`, `estado` e `vendas`.
Contrato completo em [contracts/ficha-no-card.md](./contracts/ficha-no-card.md).

```jsonc
"ficha": {
  "declaradaEm": "2026-09-01",
  "objetivo": "Atma volta a converter busca em tratamento iniciado",
  "krs": [
    { "kpi": "leads na janela", "baseline": 39, "meta": 120, "prazo": "2026-12-31",
      "dono": "jean", "celula": "n3:lead" }
  ]
}
```

| campo | regra |
|---|---|
| `declaradaEm` | `YYYY-MM-DD`. Ausente → a ficha exibe `data não registrada`, não some com a declaração |
| `objetivo` | uma frase, **sem número** (US4-AC1: objetivo com número dentro é N1 disfarçado) |
| `krs` | array. Acima de 3 → todos exibidos, o excedente **marcado** (FR-018) |
| `krs[].dono` | ausente → `sem dono — sem dono não é KR, é observação`. Nunca inferido (FR-016) |
| `krs[].celula` | `n3:<chave>` \| `n4:<canal>` \| `n5:<medidor>`. Prefixo obrigatório (FR-013) |

Nada aqui é inferido, herdado ou tem padrão. Ausência do campo `ficha` inteiro é legítima: o projeto
abre a ficha com N0 e os KRs em `não apurado: sem declaração no card`, e os outros níveis normais.

---

## 3. `Nivel` — os sete, sempre

```js
/** @typedef {{id:"N0"|"N1"|"N2"|"N3"|"N4"|"N5"|"N6", titulo:string, pergunta:string,
 *             celulas:CelulaFicha[], nota?:string}} Nivel */
```

`montarNiveis()` devolve **sempre sete**, na ordem, cada um com pelo menos uma célula (FR-008).
Nível inteiramente ausente vira um nível com uma célula `nao-apurado` explicando — nunca some.

| nível | pergunta | de onde vem | quando sai inteiro `não apurado` |
|---|---|---|---|
| **N0** | o que muda no mundo? | `ficha.objetivo` + `krs` | sem campo `ficha` no card |
| **N1** | quanto isso vale em R$? | rótulo de `PERFIS[perfil].n1`; contagem = último marco; R$ = contagem × `meta.ticket` (**declarado**, herança) | sem perfil |
| **N2** | de que fatores o dinheiro é feito? | `PERFIS[perfil].fatores` × cadeia de N3 | sem perfil; ou perfil A/B/C (FR-019a) |
| **N3** | quanto se perde em cada etapa? | `ficha.marcos` + `ficha.taxas` da 009, intactos | sem perfil |
| **N4** | o que alimenta o topo, por canal? | `CANAIS` fixos; só `organico` tem coletor | sem perfil (não há cadeia para dizer quem tem elo) |
| **N5** | por que o volume é esse? | `MEDIDORES[familia]`, família do veredito da 009 | sem perfil |
| **N6** | o que eu faço segunda? | `acoesDoRanking()` filtrada pelo slug | fonte da agenda indisponível (FR-030b) |

**N0 e N6 não dependem da cadeia** — continuam válidos num projeto sem perfil (Edge Case da spec).

---

## 4. `FatorN2` — o termo da conta de receita

```js
/** @typedef {{nome:string, tipo:"cadeia", cobertura:string[]}} FatorDeCadeia
 *  @typedef {{nome:string, tipo:"valor",  fonte:string}}       FatorDeValor */
```

Declarado em `PERFIS[perfil].fatores` (`lib/okr.mjs`), ao lado dos `marcos` cuja `chave` a
`cobertura` referencia. Nesta feature **só o perfil D** (FR-019a).

**Perfil D** — `Receita = Leads × CR(lead→consulta) × CR(consulta→tratamento) × Valor do tratamento`:

| fator | tipo | cobertura / fonte |
|---|---|---|
| `Leads` | cadeia | `["lead"]` |
| `CR(lead→consulta)` | cadeia | `["contatado","agendada","compareceu"]` |
| `CR(consulta→tratamento)` | cadeia | `["tratamento"]` |
| `Valor do tratamento` | valor | `meta.ticket` do card |

**Regras de avaliação**

1. **FR-020 — tudo ou nada**: um fator de cadeia é `nao-apurado` se **qualquer** degrau da sua
   `cobertura` estiver não apurado. A taxa do pedaço medido nunca é exibida como se fosse a do fator.
2. **FR-021 — conferência de definição** (só sobre os fatores de **cadeia**):
   - as coberturas concatenadas são **contíguas** na ordem de `marcos`;
   - a última cobertura **termina no último marco** (o N1);
   - os marcos **acima** da primeira cobertura são a **entrada** — respondidos por N4, nunca buraco;
   - buraco no meio ou sobreposição → `erro de definição do perfil`, nomeando os degraus.
   Fatores de **valor** ficam fora desta conferência por definição.
3. **FR-022 — o veredito**: `a conta fecha?` sai `nao-apurado` se qualquer fator estiver não apurado,
   nomeando os que faltam. Nunca um `✓ fecha` derivado de ausência.

---

## 5. `CanalN4` — origem de entrada

```js
/** @typedef {{id:string, nome:string, celula:CelulaFicha, semElo:boolean}} CanalN4 */
```

`CANAIS` fixos, do §3-N4 do template: `organico`, `direto`, `pago`, `indicacao`, `outbound`,
`social`. Não são declarados por projeto (Assumptions da spec).

- `organico` ← a mesma célula `cliques` do Search Console que a 009 usa, com o rótulo **orgânico**
  (FR-023: nunca "tráfego", nunca "visitantes").
- os outros cinco → `nao-apurado` com a fonte a consultar.
- `semElo` é **derivado**: verdadeiro quando o canal não é denominador de nenhuma taxa de N3. Nos
  perfis A/B/D o primeiro marco é `visitante` e `organico` tem elo; no perfil C a cadeia começa em
  `contato`, então `organico` sai `sem elo`.
- **Não há total** (FR-024). A linha `diferença entre a soma medida e a entrada da cadeia` sai
  `nao-apurado`, e a diferença nunca é atribuída a "direto".

---

## 6. `MedidorN5` — o diagnóstico de uma família só

```js
/** @typedef {{id:string, nome:string, familia:"D1"|"D2"|"D3"|"D4", celula:CelulaFicha}} MedidorN5 */
```

`MEDIDORES` fixos, do §5 do template. O catálogo tem as quatro famílias — é ele o espaço de chaves de
`n5:` na validação de KR (D7 da pesquisa) — mas a ficha **exibe uma só** (FR-026).

**Escolha da família**, do veredito de `posicaoDeAtaque()` (FR-027, sempre com o motivo escrito):

| posição da §7 | família exibida | motivo exibido |
|---|---|---|
| 1 — fator zerado | `familiaDe()` do marco zerado | qual célula está em 0 |
| 2 — apurar antes de melhorar | `familiaDoBuraco` do degrau escolhido | qual `não apurado` |
| 3 — cadeia fechada | família do degrau de **menor taxa** | qual taxa (US3-AC2) |
| 0 — sem perfil | nenhuma | `sem perfil declarado` |

**Quais medidores podem exibir número** (FR-028 — só o que esta requisição já carrega):
`impressoes` (mesma série do GSC que dá `cliques`), `lead-gravado` (a célula de leads),
`gateway-ligado` (campo `vendas` do card — ausente é "não olhei", `[]` é "olhei, zero").
Todo o resto sai `nao-apurado` **na lista**, com a fonte: o medidor que falta é o entregável.
`posicao-media-com-corte-pais` sai `nao-apurado` mesmo existindo na API (FR-029).

---

## 7. `ItemN6` — a execução

```js
/** @typedef {{key:string, titulo:string, dono:string|null, data:CelulaFicha,
 *             celulaQueMove:"nao-declarada"}} ItemN6 */
```

Vem de `acoesDoRanking(curados, donos)` de `lib/agenda.mjs`, filtrado por `projeto === slug`.
**Reimplementar a projeção é proibido** (FR-030) — duas regras para a mesma lista divergem na
primeira correção, e a SC-018 confere abrindo as duas telas.

- `dono` ← `hub_acao_dono`, o mesmo mapa da `/agenda`. Ausente → `sem dono` (herda a 008).
- `data` ← `hub_acao_dono.atualizado`, rotulada `dono definido em`. Sem dono →
  `nao-apurado: a acao do card não é datada` (D6 da pesquisa, FR-030a).
- `celulaQueMove` é **sempre** `nao-declarada`. Inferir do texto é proibido (FR-031) — medir a
  palavra em vez do fato já produziu 18 cards onde havia 5.

**Três leituras que não compartilham texto**:

| situação | o que N6 exibe |
|---|---|
| projeto sem item na agenda | `sem ação declarada para este projeto` |
| fonte da agenda indisponível | `não apurado — banco indisponível (<código>)` |
| itens existem | a lista, com dono, data e `célula que move: não declarada` |

Zero ações **não pode** ser o resultado de banco fora: é o melhor plano possível produzido pelo pior
estado possível.

---

## 8. `KrValidado` — a declaração conferida contra a árvore

```js
/** @typedef {{kr:object, marca:null|"nao-verificavel"|"sem-dono"|"chave-invalida"|"excedente",
 *             celulaAlvo:CelulaFicha|null, texto:string}} KrValidado */
```

Ordem de validação — **sem casamento por aproximação em nenhum ponto** (FR-017):

1. `celula` sem prefixo `n3:`/`n4:`/`n5:` → `chave-invalida`.
2. Prefixo válido, chave ausente **no espaço daquele nível** → `chave-invalida`, nomeando a chave. É
   proibido procurar nos outros níveis, casar por nome parecido ou por posição.
3. Chave existe e a célula está `nao-apurado` → `nao-verificavel`, com o texto
   `sem baseline apurado — o trabalho é apurar a célula, não perseguir o número`.
4. `dono` ausente → `sem-dono`, e o KR **continua visível**.
5. Índice ≥ 3 → `excedente`, exibido (FR-018).

**Sem cadeia para validar** (projeto que perdeu o perfil): objetivo e KRs continuam exibidos como
declarados, e a validação sai `não apurado: sem cadeia para validar a célula`. A declaração do humano
não é apagada por causa de um campo removido.

**Espaços de chave**

| prefixo | espaço | fonte |
|---|---|---|
| `n3:` | `PERFIS[perfil].marcos[].chave` | `lib/okr.mjs` |
| `n4:` | `CANAIS[].id` | `lib/ficha.mjs` |
| `n5:` | `MEDIDORES[].id` das **quatro** famílias | `lib/ficha.mjs` |

---

## 9. O que NÃO entra no modelo

- Nenhuma tabela nova, nenhuma coluna nova, nenhuma env nova (FR-036).
- Nenhuma série temporal, nenhum período anterior, nenhum gráfico — a ficha carrega **uma** janela,
  a da FR-012, e ela aparece escrita na tela.
- Nenhum campo de escrita: a página é leitura. Nada nela edita card, banco ou ação.
