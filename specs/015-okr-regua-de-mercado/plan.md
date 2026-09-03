# Implementation Plan: Régua de mercado

**Branch**: `015-okr-regua-de-mercado` · **Spec**: `spec.md` · **Pesquisa**: `handoff/okr-regua-de-mercado.md`

## Resumo

`lib/benchmark.mjs` nasce com duas coisas: a **tabela** (dado, `fonte` por linha) e
`distanciaDoMercado(ficha)` (função pura). A ficha já existe — `montarFicha()` de `lib/okr.mjs`
devolve `taxas[]` com `{de, para, numerador, denominador, celula}`. A régua **lê** essa saída e
não recalcula nada: `razao()` de `lib/funil.mjs` já recusa `0/0`, ponta não apurada e numerador >
denominador, e as três recusas são exatamente os casos em que a régua deve calar.

Isso é o que torna a feature pequena: ela não mede, só compara.

## Constitution Check

| Princípio | Como esta feature atende |
|---|---|
| **I. Contrato único de dados** | Não toca `listProjects()`. A régua consome ficha, não projeto. |
| **II. `node --test`, registrado à mão** | `test/benchmark.test.mjs` entra no `package.json` **no mesmo commit**. |
| **III. `.mjs` puro, `.ts` só na borda** | Tabela e função em `.mjs`, testáveis sem subir o Next. `page.tsx` só renderiza. |
| **IV. Push é deploy** | Um push só, fora da janela noturna. |
| **V. Ambiente explícito** | Sem env var nova. A tabela é literal no código. |

## Decisões de projeto

### D1 — A régua lê `ficha.taxas`, não os marcos

`montarFicha()` já pareia cada degrau com o anterior e já passou por `razao()`. Reimplementar o
pareamento aqui criaria uma segunda régua de "o que é um degrau" que divergiria na primeira etapa
renomeada — o mesmo defeito que `fatores.cobertura` evita morando no mesmo arquivo dos marcos.

### D2 — Chave da tabela é o par de `chave` dos marcos, não o `nome`

`nome` é rótulo de tela e já mudou uma vez (`"form / WhatsApp"` → `"lead (form do site)"`).
`chave` é identidade. Um teste percorre `PERFIS` e recusa linha de régua que aponte para par
inexistente — sem isso, renomear um marco silencia a régua daquele degrau sem erro nenhum.

### D3 — A trava nº 1 é teste, não comentário

`test/benchmark.test.mjs` afirma que nenhuma leitura carrega mais de uma faixa e que a saída de
uma leitura não é aceita como entrada de outra. É a R6 vertida em asserção: se alguém um dia
compuser dois degraus, a suíte fica vermelha antes do deploy.

### D4 — `sem régua` e `sem par apurado` são estados de primeira classe

Nunca `null`, nunca faixa vazia. Cada um carrega o **motivo** — como a célula de `lib/funil.mjs`
carrega `naoApurado`. Estado sem motivo apodrece em silêncio.

### D5 — Razão contra o **piso** da média

Divisor é o menor número da faixa da média, o mais conservador. Usar o ponto médio inflaria todo
"quanto abaixo" e reintroduziria a autoridade falsa que a trava nº 3 existe para evitar.

## Estrutura

| Arquivo | O quê |
|---|---|
| `lib/benchmark.mjs` | **novo** — `REGUA`, `leituraDoDegrau()`, `distanciaDoMercado(ficha)` |
| `test/benchmark.test.mjs` | **novo** — travas 1-4, caso `atma`, casamento de chaves com `PERFIS` |
| `package.json` | registro do teste (Princípio II) |
| `app/okr/[slug]/page.tsx` | segunda linha ao lado do veredito da §7 |
| `handoff/okr-kpi-template.md` | nota na R6 |
| `lib/okr.mjs` | **intocado** (FR-012) |
