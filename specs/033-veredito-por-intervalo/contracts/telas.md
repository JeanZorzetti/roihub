# Contrato · as duas telas

O que cada tela **declara**, em contrato cobrável. Nenhuma conta aqui — as telas consomem
`lib/kpis-busca.mjs` e formatam. Princípio III.

---

## A · `app/okr/[slug]/aquisicao/page.tsx` — US1 e US3

### Mudanças de estrutura

| Hoje | Depois | Por quê |
|---|---|---|
| `revalidate = 3600` | inalterado | mesma fonte, mesma quota |
| `acimaDoPisoTermo` / `acimaDoPisoPagina` | **removidos** | FR-009 |
| `selo="piso"` + `palavra="sem veredito do board"` | `selo` novo para indecisão | o estado é da amostra, não do board |
| bloco `<dt>abaixo do piso</dt>` | bloco que explica **indecisão** e o par de leituras | FR-011 |

### A hierarquia de três níveis (FR-012, SC-009, SC-010)

**Nível 1 — a resposta.** Com `decididas < 20`, o bloco de maior área é a **frase da página nomeada**:

> `/blog/quanto-custa-alinhador-invisivel` — 94% do tráfego decidível, CTR 1,28% contra piso de
> 2,00% na posição 7,3; **faltam 155 cliques** na janela.

- Área de nível 1 ≥ **2× a área** de um bloco de nível 2, nas três larguras. A leitura recusada de
  18/09/2026 é explícita: esse gate pede **resposta maior**, não evidência menor — oito corridas
  leram ao contrário.
- Com `decididas >= 20`, a tela troca de forma e o índice por página sobe a nível 1. **A troca não
  pode ser silenciosa** (edge case da spec): a tela declara por escrito por que mudou de cara.
- Com `decididas === 0` (FR-013), o nível 1 é **texto**: quantas indecisas, quantas sem régua, e a
  declaração de que não há página nomeada. Nenhum índice é publicado. Não é espaço em branco.

**Nível 2 — a evidência.** Os dois índices, lado a lado e **sem o mesmo peso visual** (FR-010):

| Leitura | Rótulo na tela | Meta | Base ao lado |
|---|---|---|---|
| por página | "das páginas **decidíveis** atingem a régua da própria posição" | `[0.75, 0.80]` como faixa na trilha | `1 de 4 decididas · 20 indecisas · 5 sem régua` |
| por tráfego | "das **impressões decidíveis** estão em páginas que atingem" | **nenhuma** — sem tique, sem faixa | `583 de 22.899 impressões` |

- **A ausência de meta é o portador da distinção** (SC-008): a leitura que carrega a faixa do board é
  o KPI; a que não carrega é a qualificação. Um leitor que só viu a tela distingue as duas sem abrir a
  spec porque só uma tem régua desenhada.
- A leitura por página é a primeira e recebe o peso maior das duas. A por tráfego vem abaixo, com uma
  frase curta dizendo o que ela qualifica.

**Nível 3 — o contexto.** A procedência da régua (fonte, `medidaEm`, **idade derivada**, `serp`,
`serpDaFonte`, `cadencia`), a declaração de janela, a lista das decididas-e-abaixo ordenada por
impressões. As duas condições de SERP aparecem **nomeadas e separadas** — a da referência e a que a
régua julga. Colapsá-las numa frase só afirma sobre a régua o que só vale sobre a fonte.

### A forma do veredito — segmento contra tique

O `Trilha` existente é estendido para desenhar um **segmento** `[inferior, superior]` em vez de um
comprimento a partir do zero, com a régua como tique no mesmo eixo 0–100%.

```
abaixo        |====|        ┆                    segmento inteiro à esquerda do tique
atinge                ┆     |====|               segmento inteiro à direita
não decide         |=====┆=====|                 segmento cruza o tique
```

- **Custa zero pixel de altura**: o `Trilha` já mora na faixa de `padding-bottom` que a linha reserva
  (`position: absolute`). Foi essa a objeção que matou o gráfico de barras na corrida anterior desta
  tela, e ela não se aplica aqui.
- **A geometria é o portador** (FR-006, SC-006): em tons de cinza os três estados continuam
  distinguíveis, porque o que os separa é posição, não cor.
- `aria-hidden` no desenho; o estado vai no **texto** ao lado, com glifo:
  `▲ atinge` · `▼ abaixo` · `◐ a amostra não decide` · `○ sem régua nesta faixa` ·
  `∅ o site não aparece aqui`.
- **Os glifos nunca são `◆`/`◇`**, que neste hub já significam procedência da régua.

### US3 — a fração no Top 3

`impressoesNoTop3` mantém a barra e a faixa `[0.40, 0.50]` do board, e o veredito passa por
`vereditoContraFaixa()`. Quando a amostra não decide, o número aparece **com a base e sem veredito**
(AS-1 da US3). A ressalva "parâmetro do board, não régua publicada" (`◇` + motivo da recusa)
**permanece** — ela é ortogonal à suficiência de amostra.

---

## B · `app/gsc/mapa/page.tsx` + `mapa.tsx` — US2

### Mudanças de estrutura

| Hoje | Depois |
|---|---|
| `export const dynamic = "force-static"` | `export const revalidate = 3600` |
| não lê dado de projeto | lê os hosts de **`atma`** por `listProjects()` + `hostsDeclarados()` |
| — | `gscPaginas(hosts, descoberta())` → `porFaixaDePosicao(paginas, janela)` |

O cabeçalho em ⚠️ que declara "esta tela não lê dado de projeto nenhum" é **reescrito no mesmo
commit**, com o motivo da reversão e a trava que neutraliza o risco original (uma função, dois
portadores). Comentário que contradiz o código é pior que comentário ausente.

### O nó de cada faixa

A `mind-elixir` **não renderiza `note`** (medido: 0 ocorrências da string em `dist/MindElixir.js` na
5.15.1). Portanto:

- **`topic`** carrega o que precisa ser lido sem clique, curto:
  `Posições 4 a 6 · 105 impr · 3 págs · ◐ não decide`
- **`note`** carrega a prosa longa (IC, régua, janela, fonte), que só é informação porque o **painel de
  seleção** a torna visível — `bus.addListener("selectNodes", …)` + `aria-live="polite"`.
- **A lista aninhada servida no servidor** carrega tudo, aberto. É ela que responde sem JS, na
  impressão, no Ctrl+F e a **360px, onde o mapa é decorativo** (registrado no log do projeto).

**Consequência cobrável**: a FR-005 e a FR-006 têm de valer na **lista**, não só no mapa. Um teste de
verificação que só olhe o mapa aprova uma tela que não responde no celular.

### Os cinco estados no nó

| Estado | `topic` |
|---|---|
| decidido | `Posição 1 · 21 impr · 1 pág · ▼ abaixo (IC até 15,5% < régua 25,0%)` |
| não decide | `Posições 4 a 6 · 105 impr · 3 págs · ◐ não decide` |
| sem régua | `Página 2 (11 a 20) · 900 impr · 4 págs · ○ sem régua` |
| não aparece | `Posição 3 · ∅ o site não aparece aqui` |
| erro na fonte | `CTR por posição · erro na fonte: <mensagem>` — **nunca** `0%` |

- A **janela** aparece uma vez no nó pai de "Posição no Google" e **de novo em cada nó de faixa**
  (FR-004): o nó é lido isolado, e janela só no cabeçalho não acompanha.
- O nó pai mantém a **tabela transcrita do board** como transcrição, com a etiqueta `⚠` de
  `DIVERGENCIAS.ctrPorPosicao` — e a etiqueta passa a dizer **qual régua julgou cada faixa**, porque
  agora há veredito ao lado da transcrição. A FR-005 proíbe usar a transcrição como régua; ela
  continua exibida como o que é.
- A tela declara **qual projeto** está medindo, por escrito, no cabeçalho da seção.

---

## C · Contrato de ausência, comum às duas telas

| Retorno de `gscPaginas()` | Significado | Como aparece |
|---|---|---|
| `null` | não há onde olhar — env desligada ou nenhum host com propriedade | estado nomeado: "sem propriedade no Search Console para este projeto" |
| `{ erro }` | falha transitória | o erro, nomeado |
| `{ paginas: [] }` | respondeu, nada na janela | "nenhuma impressão nesta janela", com a janela declarada |

Colapsar `null` e `{erro}` faz "sem propriedade" mentir quando era timeout. Nenhum dos três renderiza
`0%`. Princípio V: nenhum nome de variável de ambiente, valor ou prefixo em log, mensagem ou resposta.

---

## D · `app/gsc/page.tsx` — a terceira tela, que muda sem ser tocada

**Ela não estava no inventário, e é o ponto cego do `grep` da FR-009.** `research.md` §R6 enumerou os
chamadores por `grep "PISO_IMPRESSOES_VEREDITO\|exigePiso"`; `/gsc` não casa com nenhuma das duas
strings porque **chama a função**: `limiarEmTexto(k)` e `r.fonte.recorte` em `app/gsc/page.tsx:260`, e
`seloDaMedida()` pelo placar de procedência.

Consequência: `limiarEmTexto()` perder o sufixo "só vale acima de 100 impressões" e `CTR_PISO` ganhar
`medidaEm`/`serp`/`serpDaFonte`/`cadencia` **muda o texto desta tela**, com ou sem tarefa. É
`guarda_no_chamador_volta_pela_porta_seguinte` entrando pela porta oposta — a mudança está na função
compartilhada e o chamador não foi enumerado.

O que a tela passa a declarar, já que é ela quem publica a procedência das 32 linhas:

| Campo | Onde |
|---|---|
| `medidaEm` + idade derivada | ao lado de `acessadoEm`, que já está lá |
| `serp` (a que a régua julga) | no lugar de onde o sufixo do piso saiu |
| `serpDaFonte` (a da referência) | junto de `r.fonte.recorte`, que já cita os 39,8/18,7/10,2% |

**O que NÃO muda aqui**: `/gsc` continua estática, sem ler dado de projeto, sem veredito de amostra.
Ela responde "contra o que este KPI é julgado" — a régua e a procedência dela. A suficiência da
amostra é das outras duas telas.
