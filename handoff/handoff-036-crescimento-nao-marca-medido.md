# Handoff — 036 · Crescimento Não-Marca medido no board

**Data:** 20/09/2026 · **Spec:** `specs/036-crescimento-nao-marca-medido/` · **Estado:** implementada e
verificada em build de produção local **e conferida no ar duas vezes** (15:50 e 15:55 BRT, mesma leitura).

## O que mudou

A folha `4. KPI de Escala: Crescimento de Impressões Não-Marca` de `/gsc/mapa` passou a ter o nó
`Medido:` como **primeiro filho**, ao lado de `Fórmula` e `Meta`. Antes era definição pura, com coletor
declarado desde a 025 e nenhum número na tela.

| Onde | Mudança |
|---|---|
| `lib/marca.mjs` | `crescimentoNaoMarca()` devolve **estado nomeado** (`nao-declarada` · `poucos-meses` · `nao-consecutivos` · `base-zero` · `medido`) em vez de `null`. Novas: `variacao()`, `causaDaAusencia()`, `linhaDeCrescimento()`. |
| `app/gsc/mapa/page.tsx` | Leitura da série da Atma em `hub_gsc_dia` (zero requisição nova ao Search Console), o nó `crescimentoNaoMarca-medido` e `noteDoCrescimento()`. `decl` subiu de escopo. |
| `app/okr/[slug]/aquisicao/page.tsx` | Consome `estado` e publica a causa certa; `variacao` local saiu, entra o import. |
| `test/marca.test.mjs` | Os cinco estados, a linha de topo, `43×`. Dois testes antigos mudaram de contrato (`null` → estado). |

## O número

Medido contra o banco real em 20/09/2026, idêntico à `research.md`:

- **jul→ago: `342 → 14.689`**, com **27 de 31 dias em zero** no mês-base → `baseInterrompida`.
- A linha de topo abre pelos **absolutos** e nomeia a base interrompida; o `43×` só aparece na **nota**,
  junto de "a faixa do board não se aplica". Lida sozinha, a linha não deixa concluir que a Atma está
  acima dos 5%–10% (SC-006).
- Forma da série na nota, do mesmo `ritmoDoSegmentoAtual` da aba: semana 07→13/09 com **1.492**
  impressões não-marca contra **17.020** do pico (06→12/04), **8,8% do pico**.

### A virada esperada de 04/10

Quando setembro fechar (mês completo + 3 dias de folga), a comparação passa a ser **ago→set com base
íntegra**. Aí `baseInterrompida` vira `false`, a linha passa a abrir **pela razão**, e o valor deve sair
perto de **−54%** (setembro corre a 223 impressões não-marca/dia contra 474/dia de agosto, medido em
20/09). **Não é regressão** — é o teste real de FR-003b. Se a linha continuar abrindo por absolutos
depois de 04/10, aí sim há defeito.

## O que ficou de fora, por decisão registrada

- A folha gêmea `buscasDeMarca` (`razaoDeMarca`) — vira 037 se valer.
- Mudar `marca.termos` da Atma para incluir `usealigner`: o nome novo ainda não é buscado, mas quando
  passar a ser, essas buscas caem em **não-marca e inflam este KPI**. Mudar a declaração exige recorrer
  o backfill (reescreve o histórico de marca) — não é mudança de tela.
- `ritmoNaoMarca` chama `semanasNaoMarca` sem os hosts declarados: inerte hoje (nada lê
  `ritmo.ultima.host`). O nó novo **não** depende desse campo.
- Mecanismo genérico "folha com coletor → nó medido" para as outras 23 folhas.

## Gotchas desta execução

- **`grep` pela função não acha quem lê a variável.** `crescimentoNaoMarca(` tinha um consumidor; o
  segundo (`crescimento === null` num `<details>` de `aquisicao/page.tsx`) só apareceu no `tsc`, quando o
  retorno virou união discriminada. Ao mudar o contrato de retorno de uma função, **rode o `tsc` antes
  de dar o grep por terminado**.
- **O mapa e a aba precisam da MESMA janela de leitura** (`descobertaLonga()`), não só do mesmo módulo.
  Sem janela o mapa lia desde 11/01 e a aba desde 17/01.
- **O `next dev` da 3002 devolveu 500 em `/okr/atma/aquisicao`** ("Jest worker encountered 2 child
  process exceptions") depois de um `npm run build` concorrente na mesma pasta; o build de produção
  serve a mesma rota com 200. Não foi investigado a fundo — se reaparecer sem build concorrente, é bug
  do dev server ou da página, e vale abrir.
- **Checagem que parecia prova e não era:** ler o painel do nó pelo `innerText` do `body` "passa" mesmo
  com o canvas quebrado, porque a lista aninhada (2º portador) tem a mesma nota. O clique foi refeito
  sobre o `me-tpc` do canvas.

## Pendente

Nada da 036 em aberto. Só o que depende do calendário: **a virada de 04/10** (acima) — conferir que a
linha passa a abrir pela razão quando setembro fechar.

Reindexar o corpus da busca só se este handoff virar fonte de pergunta — memória e handoff moram fora
do que o cron alcança (`node --env-file=.env scripts/indexar.mjs`).
