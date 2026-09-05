# Data Model — 018 · Nenhum número da `/okr/atma` está errado

**Fase 1.** Não há banco a migrar: esta spec não cria tabela, não altera coluna e não escreve nada.
O "modelo" aqui é o das **estruturas em memória** que atravessam `lib/janelas.mjs` →
`lib/okr-coleta.ts` → `lib/okr.mjs` → `lib/ficha.mjs` → tela, mais os dois campos novos do card.

Convenção do repo mantida: `{valor}` ou `{naoApurado}` é a célula crua (`lib/funil.mjs`);
`{estado: "apurado"|"declarado"|"nao-apurado"|"inferido"}` é a célula de ficha (`lib/ficha.mjs`).
São dois tipos diferentes de propósito e continuam sendo.

---

## 1. `Janela` — novo, `lib/janelas.mjs`

```js
/** @typedef {{nome:string, inicio:string, fim:string, porque:string}} Janela */
```

| Campo | Tipo | Regra |
|---|---|---|
| `nome` | `"DESCOBERTA"` \| `"COMPORTAMENTO"` \| `"CONVERSAO"` | Fixo. É ele que aparece colado no número (FR-008). |
| `inicio` | `YYYY-MM-DD` | Inclusivo. |
| `fim` | `YYYY-MM-DD` | Inclusivo. |
| `porque` | `string` | Por que esta janela tem este tamanho. `DESCOBERTA`: "o Search Console fecha o dia com 3 dias de atraso". `CONVERSAO` com época: o `epoca.porque` do card. |

**Construtores** (funções de `agora`, nunca constantes avaliadas no import — research D1):

| Função | Assinatura | Devolve |
|---|---|---|
| `descoberta` | `(agora = Date.now())` | 28 dias fechando em `D-3` |
| `comportamento` | `(agora = Date.now())` | 28 dias fechando em `D-3` |
| `conversao` | `(agora = Date.now(), epoca = null)` | `epoca.data → hoje` se `epoca`; senão 28d/`D-3` |
| `hoje` | `(agora = Date.now())` | `YYYY-MM-DD` de `D-0` — o prazo é calendário, não fonte |

**Invariantes**:

- **I1** — puras: sem `process.env`, sem `pg`, sem `fetch`, sem `Date.now()` fora do default de
  parâmetro (FR-001).
- **I2** — fixas e declaradas: nenhuma janela é "o máximo que a fonte devolveu" (FR-002). A
  `CONVERSAO` com época cresce dia a dia **porque uma data escrita no card assim manda**, não
  porque a fonte entregou mais — e essa data aparece na tela (FR-005).
- **I3** — `inicio <= fim` sempre. Época futura é erro de card, não janela vazia silenciosa.
- **I4** — nenhuma outra definição de janela no repo. `lib/okr-coleta.ts` e `scripts/funil.mjs`
  importam daqui; a cópia local do script (`diasAtras(31)`/`diasAtras(3)`) morre (FR-001).

---

## 2. Campos novos do card — `data/projects.json` + `Project` em `lib/projects.ts`

### 2.1 `epoca`

```ts
epoca?: { data: string; porque: string };
```

| Campo | Regra |
|---|---|
| `data` | `YYYY-MM-DD`. Para a `atma`: `"2026-07-31"`. |
| `porque` | Obrigatório quando `data` existe. Para a `atma`: `"sociedade desfeita; o banco com os leads anteriores foi perdido"`. |

- Presente → `CONVERSAO` vira `data → hoje` e a ficha **exibe** a época com o motivo (FR-005).
- Ausente → `CONVERSAO` é 28d/D-3, idêntica à de hoje. **Os 16 outros cards não ganham o campo**
  (FR-006, SC-007).

### 2.2 `declaracoes`

```ts
declaracoes?: Record<string, { quem: string; em: string; texto: string }>;
```

Map **chaveado pela `chave` do marco** (`tratamento`, `lead`, …), não pelo nome de exibição — a
mesma razão de `REGUA` ser chaveada por `chave`: nome de tela já mudou uma vez.

Mora no **card**, não no perfil, porque `PERFIS.D` é compartilhado com `aftercare` e o nome do dono
da Atma não pode vazar para outro projeto (FR-025).

A ficha **anexa** a declaração à `fonte` do marco — não substitui:

```
extrato do gateway / contrato do tratamento · declarado por Jean em 2026-09-05:
"zero tratamentos iniciados; o checkout do MercadoPago está descontinuado — nada
registraria a próxima venda"
```

Isso fecha a **FR-004 da 017** ("a `fonte` de todo degrau vindo de declaração humana DEVE nomear
quem declarou e quando"), que ficou meio cumprida: a `fonte` do `contatado` citava a regra e não
citava quem nem quando (FR-027).

**Card da `atma`, valores exatos** (FR-026 — a declaração diz **as duas coisas**):

```json
"epoca": {
  "data": "2026-07-31",
  "porque": "sociedade desfeita; o banco com os leads anteriores foi perdido"
},
"declaracoes": {
  "tratamento": {
    "quem": "Jean",
    "em": "2026-09-05",
    "texto": "zero tratamentos iniciados — declarado pelo dono. O checkout do MercadoPago está descontinuado: nada registraria a próxima venda."
  }
}
```

---

## 3. `Celula` crua — dois campos opcionais novos (`lib/funil.mjs`)

```js
/** @typedef {{valor:number, piso?:Piso}|{naoApurado:string, rotuloBuraco?:RotuloBuraco}} Celula */
/** @typedef {{indeterminados:number, teto:number}} Piso */
/** @typedef {"nao-mede"|"falhou-agora"|"tela-nao-le"} RotuloBuraco */
```

| Campo | Onde nasce | Efeito |
|---|---|---|
| `piso` | `celulaDeResposta()` quando há lead sem motivo | A taxa que tem essa célula como **numerador** é publicada como piso (FR-015) |
| `rotuloBuraco` | quem constrói o `naoApurado` | Só `tela-nao-le` muda comportamento (FR-028/FR-029) |

**Invariantes**:

- **I5** — `ehApurado()`, `razao()` e `exigencia()` **não mudam**. Ambos os campos atravessam a
  cadeia inteira sem que nenhuma função precise saber que existem (research D3/D7).
- **I6** — ausência de `rotuloBuraco` é **comportamento de hoje**, byte a byte. Nunca há default
  (FR-028): gravar `nao-mede` em ~70 dos 72 call sites não revisados produziria em massa a
  declaração falsa que esta spec existe para acabar.
- **I7** — `rotuloBuraco` é campo, **nunca** regex sobre o texto do motivo. A regex
  `EH_FALHA_TRANSITORIA` de `app/okr/[slug]/page.tsx` continua existindo só como o comportamento
  de hoje para célula **sem** rótulo.
- **I8** — o rótulo é ortogonal a D1–D4 (FR-030): a família diz **onde** está a causa,
  o rótulo diz **de quem** é o trabalho. `familiaDe()` fica como está.

---

## 4. `CelulaNaoApurada` de ficha — o mesmo campo, outro nome de vizinho

```js
/** @typedef {{estado:"nao-apurado", rotulo:string, motivo:string, consultar:string,
 *             rotuloBuraco?:RotuloBuraco}} CelulaNaoApurada */
```

`rotulo` já existe e é o **texto exibido** ("orçamento ENVIADO"). O campo novo é `rotuloBuraco` —
dois significados na mesma palavra é o defeito que `rotulo_de_exibicao_nunca_e_chave` já custou.

**Regra de lista de buracos** (FR-029): célula com `rotuloBuraco === "tela-nao-le"` **não entra**
na lista de buracos da ficha e **não pode** ser escolhida por `posicaoDeAtaque()`. As outras duas
etiquetas são informativas — `falhou-agora` continua separada do buraco permanente (regressão da
rodada 3 do design-review, US4-AC3).

**Meta da `atma` depois desta spec** (US4-AC4): **zero** células `tela-nao-le`. As quatro fontes
passaram a ser lidas, e `status_historico` — que ninguém lê — **não vira célula só para ser
escondida** (FR-031). O backlog de velocidade, passagem cumulativa e coorte fica em `handoff/`.

---

## 5. `Marco` — a cadeia D canônica

**Antes**: `visitante → lead → contatado → orcamento → tratamento`
**Depois**: `lead → respondeu → orcamento → tratamento`

| `chave` | `nome` | `coletor` | `familia` | `fonte` |
|---|---|---|---|---|
| `lead` | lead (form do site) | `leads` | D4 | tabela `patient_leads` do próprio projeto — NÃO inclui quem chega direto no WhatsApp |
| `respondeu` | respondeu | `respondeu` | **D4** | coluna `patient_leads.motivo` do próprio projeto: `motivo IS NOT NULL AND motivo <> 'sem_resposta'` |
| `orcamento` | orçamento ENVIADO | `orcamentos` | D3 | tabela `orcamentos` do próprio projeto |
| `tratamento` | tratamento INICIADO | `vendas` | D4 | extrato do gateway / contrato do tratamento **+ `declaracoes.tratamento`** |

**Saíram**:

- `visitante` — é `DESCOBERTA`, e ligá-lo a `lead` seria taxa entre cadeias (FR-011). Os números
  de Descoberta e Comportamento **continuam exibidos**, em bloco próprio, com a janela deles e sem
  taxa ligando à Conversão.
- `contatado` — degrau de 100% declarado. Vira **nota** (FR-013), nunca marco, nunca taxa, nunca
  candidato a gargalo: `"100% contatados (declarado pelo operador, 05/09/2026)"`.

**Perfis A e B mantêm `visitante`** (FR-012): a travessia de cadeia existe lá também
(`visitante→signup`, `visitante→produto`), mas os coletores são `null` e a taxa nunca chega a ser
calculada — defeito latente, não vivo. O que segura é **teste**, não comentário: um teste que
reprova se `signup` ou `produto` ganhar coletor sem tratar a travessia (SC-004).

**Herança**: projeto perfil D **sem** fonte própria que devolva `motivo` (hoje `aftercare`) recebe
`não apurado` nomeando a fonte a consultar. A regra é do cliente; o template não a herda de graça
(FR-017) — mesmo tratamento que `contatado` recebeu na 017.

### 5.1 `PERFIS.D.n2` e `PERFIS.D.fatores` remapeados (FR-018)

```
n2: "Receita = Leads × CR(lead→respondeu) × CR(respondeu→orçamento) × CR(orçamento→tratamento) × Valor do tratamento"
```

| Fator | tipo | cobertura | nota |
|---|---|---|---|
| Leads | cadeia | `["lead"]` | primeiro termo é VOLUME, não taxa |
| CR(lead→respondeu) | cadeia | `["respondeu"]` | |
| CR(respondeu→orçamento) | cadeia | `["orcamento"]` | era `["contatado","orcamento"]` |
| CR(orçamento→tratamento) | cadeia | `["tratamento"]` | inalterado |
| Valor do tratamento | valor | — | agora recebe o **ticket resolvido**, não `meta.ticket` cru |

`avaliarN2()` exige cobertura **contígua** terminando no último marco — a tabela acima satisfaz,
sem buraco nem sobreposição.

---

## 6. Ticket — de declarado para apurado líquido

### 6.1 Entrada (`lib/okr-coleta.ts`, FR-020)

```sql
SELECT to_char(criado_em, 'YYYY-MM-DD') AS criado, status, paciente_lead_id,
       preco, desconto_vista
  FROM orcamentos ORDER BY criado_em
```

As duas colunas **sempre existiram**; a query nunca as pediu.

### 6.2 Apuração (`ticketDeOrcamentos()`, `lib/okr.mjs`, FR-021)

```
ticket = avg( preco × (1 − coalesce(desconto_vista, 0)) )   sobre a janela CONVERSAO
```

Líquido porque o desconto foi concedido em **7 de 7** linhas (5–10%): desconto que 100% dos casos
recebe **é** o preço.

Números de 05/09/2026:

| conta | valor |
|---|---|
| `avg(preco)` | R$ 5.352,20 (bruto) |
| `avg(preco × (1 − desconto_vista))` | **R$ 4.932,34** (líquido) |
| `sum(preco)` | R$ 37.465,43 (pipeline enviado — **não** é meta, é valor em risco; exibi-lo é a 019) |

### 6.3 Resolução (`resolverTicket()`, `lib/ficha.mjs`, FR-022/023/024)

| Entrada | Saída | Rótulo |
|---|---|---|
| apurado existe | `{estado:"apurado", valor:4932.34, fonte:"média de 7 orçamentos da janela CONVERSAO, líquido de desconto"}` | `apurado` |
| sem orçamento na janela, `meta.ticket` existe | `declarada(meta.ticket)` | `declarado` |
| sem os dois | `naoApurada("sem ticket declarado", "campo `meta.ticket` do card")` | — |

**Nunca** zero, **nunca** média de outra janela. Apurado vence declarado, resolvido **antes** de
entrar em `lib/projecao.mjs` — que continua recebendo o ticket pronto e sem regra nova (FR-034).

**Efeito na meta** (SC-002): `R$ 50.000 ÷ 4.932,34 = **10,1**`, não as 12,5 que
`projetar()` calcula hoje com o declarado. E o ticket entra rotulado `apurado`, não
"declarada (D1)" (FR-023).

---

## 7. `respondeu` e o piso

```
respondeu = count(*) WHERE motivo IS NOT NULL AND motivo <> 'sem_resposta'   -- 21
lead      = 51
indeterminados = count(*) WHERE motivo IS NULL                               -- 1
```

| Grandeza | Valor | Como sai na tela |
|---|---|---|
| `respondeu` | `apurado(21)` | `21` |
| `lead→respondeu` | piso | **no mínimo 41,2% (21/51)** · 1 indeterminado (teto 43,1%) |

**Regras** (FR-015/FR-016):

- Lead sem motivo **não** conta como respondeu **nem** como não-respondeu.
- O denominador continua sendo `lead` inteiro (**51**, nunca 50) — trocar faria a cadeia ter duas
  populações, que é o defeito dos orçamentos órfãos da 017 outra vez.
- O piso **pode** ser divisor na árvore de metas, e a saída **herda o "no mínimo"** como flag no
  rótulo que a célula já carrega — não um quinto estado. Parar a árvore inteira por 1 em 51
  (1,9 pp) entrega menos que uma conta declaradamente conservadora; usá-lo sem rótulo é como o
  R$ 4.000 virou 12,5 vendas: número certo, procedência apagada.

---

## 8. Medidores — `form_submit` fora, abandono derivado do banco

| Antes | Depois |
|---|---|
| `EVENTOS_D3 = [scroll, click, form_start, form_submit, begin_checkout]` | `EVENTOS_D3 = [scroll, click, form_start, begin_checkout]` (FR-032) |
| `abandono = form_start − form_submit` (GA4 × GA4) | `abandono = form_start (GA4) − lead (banco)`, **restrito à época** (FR-033) |

Números da época: `form_start` 63 − `lead` 51 = **12 (19,1%)**.

**Guarda de janela** (nasce inerte, de propósito): se a janela do GA4 **não couber inteira dentro
da época**, o abandono sai `não apurado` nomeando a divergência — nunca compõe 12 meses de GA4 com
37 dias de banco. Hoje o ramo não dispara (GA4 em 28d cabe nos 37 dias); ele existe para o dia em
que a 019 esticar a janela.

**`resolverGa4()`** (`lib/ficha.mjs`) para de tratar janela divergente do GA4 como defeito a
corrigir e passa a tratá-la como **estado normal** (FR-010) — com a época, divergência é a regra
para a `atma`. O que ela bloqueia é a **composição entre cadeias** (FR-007), não a leitura.

---

## 9. Exibição — a janela colada em cada número

| Onde | Regra |
|---|---|
| Ficha `/okr/<slug>` | Todo número exibido carrega a janela que o produziu (FR-008). O rodapé "janela única para a árvore inteira (R7)" some; entram as janelas por bloco. |
| `/okr` (portfólio) | Janela de **cada linha**, não uma no cabeçalho (FR-009). Continua ordenando por `posicaoDeAtaque()` — que diagnostica cada projeto dentro da própria cadeia e não compara projetos entre si. |
| Frase de resumo de `/okr` | "N projetos na posição 1" **DEVE dizer que soma janelas diferentes** (FR-009). |
| Época | Exibida com o motivo declarado, ao lado da janela de Conversão (FR-005). |

---

## 10. Regra transversal — nenhuma taxa cruza cadeias (FR-007)

Vale para a cadeia da ficha **e** para as camadas da árvore de metas.

| Ponto | O que muda |
|---|---|
| `PERFIS.D.marcos` | `visitante` fora → nenhuma taxa `visitante→lead` nasce (FR-011) |
| `montarN4()` | já marca `semElo` quando o primeiro marco não é `visitante` — passa a valer sozinho |
| `montarArvore()` | camada de impressões só quando `marcos[0].chave === "visitante"` (research D6) |
| Árvore de metas | desce **só dentro da Conversão**, parando e nomeando onde a cadeia acaba |
| `REGUA.D` | perde `lead→contatado` e `visitante→lead`; citações viram comentário (FR-019) |
| Perfis A/B | `visitante` fica, mas um **teste** reprova se `signup`/`produto` ganhar coletor (FR-012) |

A costura entre cadeias é a **época**, e ela é a 019.
