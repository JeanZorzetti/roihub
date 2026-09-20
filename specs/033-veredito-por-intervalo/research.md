# Fase 0 — Research

**Feature**: 033 · O veredito sai do intervalo da amostra | **Data**: 2026-09-20

A spec entrou sem nenhum marcador `[NEEDS CLARIFICATION]` — a Q1 foi fechada pelo dono em
20/09/2026 e o checklist de requisitos está inteiro marcado. O que esta fase resolve são as
**escolhas que a spec deliberadamente deixou para o plano**, com a FR-003 no centro: ela nomeia o
método pela propriedade ("válido para amostra pequena e proporção próxima de zero, que não produza
limite fora da faixa possível"), não pelo nome.

Toda decisão abaixo foi verificada rodando a aritmética, não argumentando. A verificação está no
próprio documento para que a próxima pessoa não precise repetir.

---

## R1 · O método de intervalo

**Decision**: **intervalo de Wilson (score interval)** a 95%, com
`z = 1.959963984540054`, em forma fechada:

```
d      = 1 + z²/n
centro = (p̂ + z²/2n) / d
meia   = (z/d) · √( p̂(1−p̂)/n + z²/4n² )
IC     = [ max(0, centro − meia) , min(1, centro + meia) ]
```

**Rationale**: Wilson a 95% **reproduz exatamente os quatro números que a spec publica**. Rodado em
20/09/2026 sobre os casos da própria spec:

| Caso da spec | k/n | CTR | IC 95% (Wilson) | régua | veredito |
|---|---|---:|---|---:|---|
| Posição 1 | 0/21 | 0,0% | **[0,0% ; 15,5%]** | 25,0% | **abaixo** |
| Posições 4 a 6 | 3/105 | 2,9% | **[1,0% ; 8,1%]** | 4,5% | **indecisa** |
| URL de 1 impressão | 0/1 | 0,0% | [0,0% ; 79,3%] | 13,0% | **indecisa** |
| `/blog/quanto-custa-alinhador-invisivel` | 275/21.500 | 1,3% | [1,1% ; 1,4%] | 2,0% | **abaixo** |

Os dois primeiros são literalmente a tabela de abertura da spec (15,5% e "1,0% a 8,1%"), o terceiro
é o AS-2 da US1 e o quarto é a frase da SC-009. Nenhum foi ajustado para caber: o método foi
aplicado e os números saíram.

Outras propriedades que o tornam o certo aqui, e não só o que casa:

- **Limites dentro de `[0,1]` por construção**, sem `clamp`. O `max`/`min` do pseudocódigo é cinto de
  segurança contra ponto flutuante, não correção de método — com `p̂ = 0` o centro é positivo e a meia
  é igual a ele, então o inferior é exatamente 0.
- **Forma fechada, só `Math.sqrt`.** Zero dependência nova, e o módulo continua folha da árvore.
- **Bem definido em `p̂ = 0` e `p̂ = 1`**, que é o caso mais comum desta feature: a maioria das URLs da
  Atma tem zero clique.

**Alternatives considered**:

| Método | Por que não |
|---|---|
| **Aproximação normal (Wald)** | **Reprova a FR-003 empiricamente.** Rodada nos mesmos casos: `3/105` devolve limite inferior **−0,33%**, e `0/21` devolve o intervalo degenerado `[0 ; 0]`, que "decidiria" tudo. CTR negativo não existe; publicá-lo transformaria o conserto em outro defeito, como o edge case da spec já antecipou. |
| **Clopper-Pearson (exato)** | Correto e sem limite fora da faixa, mas exige a função beta incompleta invertida — ou uma dependência nova (proibida pelo custo e pelo Princípio da stack fixa) ou ~80 linhas de série numérica sem teste de referência no repo. E é mais conservador: `0/21` devolveria 16,1% de teto em vez de 15,5%, deixando **mais** páginas indecisas sem que a spec tenha pedido isso. |
| **Agresti-Coull** | É uma aproximação de Wilson com a mesma motivação, e ainda pode estourar `[0,1]` em amostra minúscula — pior no exato caso que esta feature precisa acertar. |
| **Regra de três (`3/n`)** | Só vale para `k = 0`. Daria 14,3% na Posição 1 (contra 15,5%) e não diz nada sobre a faixa 4 a 6. Um método que só cobre metade dos casos obrigaria a dois métodos na mesma tela — o defeito que a US3 existe para eliminar. |

**Nível de confiança**: 95%, conforme a seção Assumptions da spec. Fica em constante exportada
(`CONFIANCA = 0.95`, `Z_95`) e **não** em parâmetro de tela: mudá-lo é decisão do dono e muda quantas
páginas ficam indecisas, então precisa ser um commit visível, não um seletor.

---

## R2 · A regra de decisão — três estados, exaustivos e exclusivos

**Decision**: contra uma régua escalar `r`, sobre o intervalo `[lo, hi]`:

```
hi <  r   →  "abaixo"      o intervalo inteiro está sob a régua
lo >= r   →  "atinge"      o intervalo inteiro está na régua ou acima
senão     →  "indecisa"    o intervalo atravessa a régua
```

**Rationale**: as três condições são **exaustivas e mutuamente exclusivas** por construção
(`hi < r`, `lo >= r` e o complemento), então não existe amostra sem veredito e não existe amostra com
dois. É isso que a FR-002 pede ao exigir que a indecisa seja um estado de primeira classe e não o
resto de um `if`.

A assimetria `<` contra `>=` é deliberada: a régua é um **piso** ("CTR mínimo esperado"), e o site que
empata com o piso o atinge. `lo > r` deixaria o empate exato em `indecisa`, o que é falso — a amostra
decidiu, e decidiu a favor.

O que a regra **não** é: contagem de cliques. O edge case da spec já escreveu por quê — zero clique em
21 impressões decide contra 25%, zero em 3 não decide contra 13% —, e o teste registra os dois lados
para que a próxima leitura não reintroduza `cliques === 0 → indecisa`.

**Alternatives considered**: comparar o **CTR pontual** com a régua e usar o intervalo só para um selo
de "confiança" ao lado. Recusado porque publica veredito onde a amostra não decide, que é literalmente
o defeito da SC-002 — a faixa 4 a 6 tem CTR pontual 2,9% abaixo de 4,5% e **não** reprovou nada.

---

## R3 · De onde `/gsc/mapa` tira o dado medido

**Decision**: a página server-side de `/gsc/mapa` troca `dynamic = "force-static"` por
`revalidate = 3600`, lê os hosts do projeto **`atma`** por `listProjects()` + `hostsDeclarados()`,
chama `gscPaginas(hosts, descoberta())` e passa as seis faixas já computadas por
`porFaixaDePosicao()` como props para o componente cliente.

**Rationale**:

- **Qual projeto**: o board `okr-Saw2eoSKZDPLJAk6xeDBuS` é o board **da Atma**, não do portfólio — está
  escrito no registro de 19/09/2026 da própria tela. Um mapa que é o board da Atma medindo outro
  projeto seria a divergência de escopo, não a correção dela. A tela declara o projeto por escrito.
- **Por que não `force-static`**: a janela é móvel (28 dias fechando em D-3). Número de janela móvel
  congelado em build é `dado velho` sem carimbo — o mesmo defeito que esta spec conserta um nível
  acima. `revalidate = 3600` é o valor que `/okr/[slug]/aquisicao` já usa, com a mesma fonte e a mesma
  quota diária compartilhada; adotar outro criaria duas políticas de frescor para o mesmo dado.
- **Por que o risco original não se realiza**: o cabeçalho da tela recusava ler dado de projeto para
  não ter "duas telas discordando sobre o mesmo KPI". A discordância vinha de **duas
  implementações**, não de dois lugares de exibição. Com `porFaixaDePosicao()` única em
  `lib/kpis-busca.mjs`, consumida pelas duas telas, discordar exigiria escrever a conta duas vezes —
  que é exatamente o que a função única impede, e o padrão que `lib/board-gsc.mjs` já aplica às folhas
  (nenhuma segunda lista, teste reprovando nos dois sentidos).
- **Ausência é estado, não erro**: `gscPaginas()` devolve `null` para "não há onde olhar" (env
  desligada, nenhum host com propriedade) e `{erro}` para falha transitória. As duas viram nó
  **nomeado** no mapa e na lista, nunca `0%` — Princípio V e o piso de estados do harness.

**Alternatives considered**:

| Alternativa | Por que não |
|---|---|
| Publicar as seis faixas só em `/okr/atma/aquisicao` | A FR-005 nomeia o mapa. E a faixa de posição não é unidade daquela tela: ela lê por URL e por termo. |
| Rota nova `/gsc/mapa/atma` | Terceira tela do mesmo board, com a lista acessível duplicada. O custo de manter três portadores em sincronia já cobrou preço aqui (o board reconstruído 3 vezes). |
| Parâmetro de query para escolher o projeto | Escopo que a spec não pede, e transformaria uma tela de referência do board da Atma num seletor de portfólio. Fica registrado como extensão possível, fora desta feature. |

---

## R4 · As seis faixas — derivadas, nunca uma segunda lista

**Decision**: `FAIXAS` nasce **de `BENCHMARK`**, com uma única entrada declarada a mais:

| Rótulo | de | até (exclusivo) | régua | origem |
|---|---:|---:|---:|---|
| Posição 1 | 1 | 2 | 25,0% | `BENCHMARK[0]` |
| Posição 2 | 2 | 3 | 13,0% | `BENCHMARK[1]` |
| Posição 3 | 3 | 4 | 8,0% | `BENCHMARK[2]` |
| Posições 4 a 6 | 4 | 7 | 4,5% | `BENCHMARK[3]` |
| Posições 7 a 10 | 7 | 11 | 2,0% | `BENCHMARK[4]` |
| Página 2 (11 a 20) | 11 | 21 | **`null`** | declarada — o board pede "~1,5%" e o número **não tem fonte** |

**Rationale**: `BENCHMARK` é a régua que julga e já existe; escrever as faixas à mão criaria a
segunda lista que divergiria em silêncio na primeira mudança de limiar — é o padrão que
`lib/board-gsc.mjs` documenta como a razão de o board ter sido reconstruído três vezes. O teste
percorre `BENCHMARK` e `FAIXAS` **nos dois sentidos**, como `test/board-gsc.test.mjs` faz com o
catálogo.

A sexta faixa é a única declarada porque ela existe no board e **não** em `BENCHMARK` — e a ausência
lá é decisão registrada: o piso de página 2 não tem fonte, e aplicá-lo à cauda longa faria o CTR Gap
medir o palpite. Ela entra com `regua: null`, o que produz o estado "CTR real sim, veredito não" que
o edge case "Faixa sem régua" pede. `benchmark(posicao)` continua devolvendo `null` acima de 10,9 —
não muda de comportamento, só ganha uma faixa nomeada para exibir o que mediu.

`ate` é **exclusivo** e as faixas são contíguas, exatamente como `BENCHMARK` já documenta: a posição
do GSC é média, então 3,95 e 6,5 existem de verdade e nenhuma pode cair fora de tudo.

**Alternatives considered**: usar a tabela transcrita do board (`BOARD.ctrPorPosicao`) como fonte das
faixas. **Proibido pela FR-005** e já registrado em `DIVERGENCIAS.ctrPorPosicao`: o board cobra
>30%/>7%/>4% onde o hub julga por 25%/4,5%/2% — o dobro nas posições 7 a 10. A transcrição continua
na tela como transcrição, e o nó ganha a régua que julga ao lado.

---

## R5 · O veredito contra uma FAIXA (US3), que não é o mesmo que contra uma régua

**Decision**: segunda função, `vereditoContraFaixa(cliques, impressoes, [piso, teto])`:

```
hi <  piso  →  "abaixo"
lo >= teto  →  "atinge"
senão       →  "indecisa"
```

**Rationale**: a fração de impressões no Top 3 é cobrada contra **40% a 50%** — um par, não um
escalar. O intervalo só decide quando fica inteiro de um lado da faixa **inteira**; qualquer
sobreposição com `[piso, teto]` é indecisão, porque a amostra não distingue "dentro da faixa" de
"fora dela". Aplicar `vereditoContraRegua` com o piso da faixa emitiria "atinge" para uma amostra que
não exclui o teto — inventaria precisão que o intervalo não tem.

**Ressalva que fica escrita na tela, e não some**: `impressoesTop3` tem
`balizador: { tipo: "recusa" }` no catálogo — os 40% a 50% são **parâmetro do board, sem fonte**, não
régua publicada. O veredito por faixa nunca é apresentado com a autoridade de régua: o `◇` e o motivo
da recusa continuam do lado, como a 032 já fez. É por isso que o AS-1 da US3 descreve o caso comum
como "o número aparece com a base e **sem** veredito".

**Alternatives considered**: reutilizar o piso da faixa como régua escalar única. Recusado acima. E
tratar Top 3 como "sem veredito possível, ponto" — recusado porque a amostra às vezes **decide**
(um site com 22.899 impressões e 3% no Top 3 exclui 40% com folga), e calar aí seria o erro simétrico
ao que a spec conserta.

---

## R6 · A auditoria do piso fixo — todos os chamadores, não o primeiro

**Decision**: `PISO_IMPRESSOES_VEREDITO` e o selo `piso` que depende dele saem em **um** commit, com
a lista abaixo como checklist de conclusão. `grep -rn "PISO_IMPRESSOES_VEREDITO\|exigePiso" lib app test`
deve devolver **zero** linhas fora de `.next/` ao fim.

**Rationale**: este hub já pagou seis vezes o padrão "a guarda no chamador volta pela porta
seguinte". Enumerar antes de mexer é o que transforma a FR-009 em algo cobrável.

Inventário medido em 20/09/2026 (`.next/standalone/` é build, ignorado):

| Arquivo | Pontos | O que muda |
|---|---:|---|
| `lib/kpis-busca.mjs` | 1 (`:93`) | a constante e o bloco de comentário da 026 **saem**; a derivação migra para `LIMIAR_PAGINAS_DECIDIDAS = 20` |
| `lib/gsc-delta.mjs` | 5 (`:26`, `:485`, `:528`, `:538`, `:616`) | `seloDaMedida()` perde o ramo `exigePiso`/`piso`; `limiarEmTexto()` troca o sufixo "só vale acima de 100 impressões" pela condição de SERP da FR-008; a re-exportação sai; `exigePiso` sai com o `base: "impressoes"` do catálogo |
| `app/okr/[slug]/aquisicao/page.tsx` | 18 (`:20`, `:657`, `:658`, `:1057`, `:1069`, `:1907`–`:1922`, `:1973`–`:1991`, `:2073`–`:2091`, `:2107`, `:2134`–`:2148`, `:2308`–`:2316`) | `acimaDoPisoTermo`/`acimaDoPisoPagina` **deixam de existir**; as trilhas passam a ser desenhadas sempre que houver medida, e o que gate o veredito é o intervalo; o bloco `<dt>abaixo do piso</dt>` é substituído pelo bloco que explica indecisão |
| `test/gsc-delta.test.mjs` | 4 (`:16`, `:18`, `:116`, `:129`) | as asserções de piso saem; entram as da condição de SERP |
| `test/kpis-busca.test.mjs` | 2 (`:21`, `:473`) | o teste "1 impressão vale no máximo 1 ponto" sai; entra o de `LIMIAR_PAGINAS_DECIDIDAS` derivado de `1/n < 0,05` |

**Achado colateral, resolvido nesta feature**: `cliquesNaoCapturados()` (`lib/gsc-delta.mjs:444`) **não
tem consumidor em produção** — só o próprio teste. A página nomeada da FR-012 é o primeiro, e a
função precisa ser importável por `lib/kpis-busca.mjs`, que hoje é importada *por* `gsc-delta.mjs`.
Decisão: a função **migra** para `lib/kpis-busca.mjs`, `gsc-delta.mjs` a re-exporta (como já faz com
`ctrEsperado`) e as 4 asserções migram para `test/kpis-busca.test.mjs`. Uma fórmula, um lugar — a
alternativa era recalcular "faltam N cliques" na tela nomeada e ter duas fórmulas para o mesmo número.

Verificação da aritmética da FR-012, para o teste: 21.500 × 2,00% = **430** cliques esperados contra
**275** medidos → faltam **155**, e 275/21.500 = **1,28%**. Confere com a SC-009.

---

## R7 · Design de informação — a forma, antes de existir CSS

Rodados os passos 0 a 3 do harness `information-design`. Os passos 5 a 8 (construir, 32 gates,
Playwright, registro) são do `speckit-implement` e estão em `quickstart.md`.

### Passo 0 — Pré-voo

- **Stack**: Next 16 App Router + React 19. `/gsc/mapa` é a **única** tela do hub com `"use client"`,
  por causa da `mind-elixir` 5.15.1. Tokens já existem, escopados em `[data-info="gsc"]`.
- **Deps já instaladas**: `mind-elixir` (mapa), nenhuma lib de gráfico. Os componentes `Leitura`,
  `Trilha` e `Parte` já existem em `app/okr/[slug]/aquisicao/page.tsx` e são o vocabulário desta tela.
- **Fonte do dado**: Search Console, dimensão `page`, janela `descoberta()`, hosts somados.
  **Consigo ler** — é a mesma chamada que a aba de aquisição já faz.
- **Log do projeto**: `.info/log.json` lido. A última entrada é a da própria `/gsc/mapa` e traz três
  pendências declaradas que esta feature herda: o mapa tem 1.060px numa caixa de 702 (POSIÇÃO MÉDIA e
  IMPRESSÕES abaixo da dobra), em 360px o mapa é decorativo e **quem responde é a lista**, e
  `me-tpc`/`me-root` são custom elements, não classes.
- **Leituras recusadas**: as duas entradas de `/okr/[slug]/aquisicao` lidas. As duas valem aqui e
  estão aplicadas abaixo.

### Passo 1 — A pergunta única, e a hierarquia

> **Quais páginas da Atma o CTR da janela de descoberta condena contra a régua da própria posição, e
> quantas a amostra ainda não julga?**

Hierarquia, que é onde a FR-012 vira desenho:

1. **A resposta** — a **frase da página nomeada**. Um bloco, o de maior área. "`/blog/…` — 94% do
   tráfego decidível, CTR 1,28% contra piso de 2,00% na posição 7,3; faltam 155 cliques na janela.""
2. **A evidência** — os dois índices (por página **com** a meta do board, por tráfego **sem** meta),
   a contagem de indecisas e de sem régua, e as seis faixas.
3. **O contexto** — a procedência da régua, a declaração de janela, a lista das abaixo.

A leitura recusada de 18/09/2026 é explícita sobre isto: o gate de área "nível 1 com o dobro do
nível 2" ficou 8 corridas aberto porque cada corrida foi **encolher a evidência**; ele pedia
**resposta maior**. A FR-012 diz a mesma coisa em outras palavras, e é por isso que a frase é o
bloco grande e os percentuais descem — não porque percentual seja ruim.

### Passo 2 — Inventário do dado real

| Campo | Tipo | Unidade | Cardinalidade (Atma, 20/09) | % nulo | Granularidade | Latência |
|---|---|---|---|---|---|---|
| `pagina` | string | URL canônica | 29 URLs | 0 | por caminho, hosts somados | D-3 |
| `impressoes` | number | contagem | 22.899 decidíveis / 24.664 no site | 0 | soma da janela | D-3 |
| `cliques` | number | contagem | 583 em páginas que atingem | 0 | soma da janela | D-3 |
| `posicao` | number | média ponderada | 1,0 a >20 | 0 | média da janela | D-3 |
| `regua` | number ou `null` | CTR | 5 valores + `null` acima de 10,9 | — | por faixa | estática, medida em **2025-05-28** (16 meses) |

Os cinco pontos que o passo 2 obriga a checar, e o que cada um devolveu:

1. **Zero na janela não é zero no mundo.** Uma faixa sem impressão na janela de 28 dias pode ter tido
   na de 8 meses — a própria spec prova que o conjunto medido **muda** com a janela (23.450 contra
   10.970 impressões na faixa 7 a 10). O estado é `o site não aparece nesta faixa`, **nunca** `0%`, e
   a FR-007 **proíbe** oferecer a janela longa como complemento no mesmo número.
2. **A ponta contrária.** Um veredito de 100% das páginas atingindo seria suspeito da mesma forma que
   um degrau de 100% num funil; com 1 de 4, não é o caso aqui, mas o teste guarda o caso.
3. **Tipo no dado, não no schema.** `posicao` pode chegar como `11,000000000000002` — a 031 já pagou
   por isso. É por isso que a régua é aplicada **linha a linha** e a faixa é escolhida por
   comparação com fronteira exclusiva, nunca por re-agregação.
4. **Latência contra promessa.** A fonte é D-3 **por natureza**, então a tela não pode oferecer um
   recorte D-0 — a janela mais recente que ela publica nunca é menor que a granularidade da fonte.
5. **Zero mock.** Todo número desta tela vem da fonte; nenhum carimbo de exemplo é necessário.

### Passo 3 — A forma

```
### Segmento de intervalo sobre trilha, com a régua como tique
**Responde:** Quais páginas da Atma o CTR da janela de descoberta condena contra a régua da própria
posição, e quantas a amostra ainda não julga?
**Codifica:** [inferior, superior] do IC → POSIÇÃO e COMPRIMENTO num eixo 0–100% de CTR;
              régua → posição de um tique no mesmo eixo;
              veredito → relação geométrica entre os dois (à esquerda / à direita / atravessando)
**Descartei:** barra do CTR pontual + selo de confiança ao lado, porque o dado tem 4 casos em que o
              pontual está de um lado da régua e o intervalo atravessa — a barra publicaria
              justamente o veredito que a SC-002 proíbe
**Estados:** com dado (decidido) · amostra não decide · sem régua nesta faixa · o site não aparece
              aqui · erro na fonte. `zero real` NÃO é produzido: CTR de página sem impressão é `null`
**Custo:** SVG/CSS à mão, extensão do `Trilha` que já existe · 0 kb de biblioteca · pior caso real
              6 faixas + 24 URLs
```

**Por que o segmento é a decisão que faz a FR-006 e a SC-006 passarem por construção**: os três
estados deixam de depender de rótulo ou de cor e passam a ser **geometria**. Segmento inteiro à
esquerda do tique = abaixo. Inteiro à direita = atinge. Cruzando o tique = a amostra não decide. Em
tons de cinza a distinção sobrevive porque não era cor; era posição. O `Trilha` já desenha
`fracao` + `meta` (tique escalar ou faixa) e mora na faixa de `padding-bottom` que a linha já
reservava — **custa zero pixel de altura**, que foi a objeção que matou o gráfico de barras na
corrida anterior desta tela.

Os glifos acompanham o segmento e **nunca** reusam `◆`/`◇`, que neste hub já significam procedência
da régua: `▲ atinge`, `▼ abaixo`, `◐ a amostra não decide`, `○ sem régua nesta faixa`,
`∅ o site não aparece aqui`. Todos com texto ao lado — ícone sozinho é indistinguível de bug de
renderização.

**O que isso obriga no mapa**: a `mind-elixir` **não renderiza `note`** (medido: a string aparece 0
vez no `dist`). Base, janela e veredito vão no **`topic`** do nó da faixa — curto, na forma
`Posições 4 a 6 · 105 impr · ◐ não decide` — e o texto longo vai no painel de seleção e na **lista
aninhada servida no servidor**, que é o portador que responde sem JS, na impressão, no Ctrl+F e a
360px. A FR-005 e a FR-006 têm de valer na **lista**, não só no mapa: a 360px o mapa é decorativo, e
isso está registrado no log do projeto como pendência declarada.

---

## R8 · A validade da régua (FR-008)

**Decision**: `CTR_PISO` em `lib/gsc-delta.mjs` ganha campos estruturados em vez de deixar a
condição enterrada em prosa dentro de `recorte`:

- `fonte`, `url`, `acessadoEm` — já existem (`2026-09-19`).
- `medidaEm: "2025-05-28"` — a data de reconstrução da curva citada, hoje só legível dentro do texto
  de `recorte`.
- `serp: "SERP real do Search Console, com resposta gerada por IA em ~31% das buscas"` — a SERP que
  a régua **julga** — e `serpDaFonte: "SERP limpa, sem resposta gerada por IA"` — a da referência.
  **Dois** campos porque são dois fatos: o `recorte` atual registra que o hub cobra 25/13/8% contra
  os 39,8/18,7/10,2% da First Page Sage **de propósito**, justamente porque o CTR do GSC é apurado
  na SERP real. Um campo só, com a condição da fonte, afirmaria sobre a régua o contrário do que foi
  medido.
- `cadencia: "mensal"` — a referência é reconstruída mensalmente, e é isso que torna a idade da régua
  cobrável em vez de opinável.

**Rationale**: a condição já está **escrita** no `recorte` atual ("a referência mede SERP LIMPA … com
AI Overview em ~31% delas"), mas como frase dentro de uma frase. `limiarEmTexto()` hoje anexa "só
vale acima de 100 impressões" — a condição que esta feature **remove** — e passa a anexar a condição
de SERP, que é a que de fato limita a régua. O edge case da spec é explícito: "uma régua de dois anos
atrás julgando a busca de hoje é o mesmo defeito que esta spec conserta, um nível acima". Campo
estruturado é o que permite um teste reprovar régua sem `medidaEm`; prosa não.

**A idade entra na tela, e a decisão sobre ela não**: `medidaEm` + `cadencia` dão 16 meses em
20/09/2026. A tela **exibe** a idade junto do valor (FR-008); ela **não** recusa a régua nem emite
alerta por idade. Um limiar de validade seria um segundo critério inventado aqui sem fato que o
derive — e esta spec existe justamente para trocar critério inventado por critério derivado.

**Fora de escopo, declarado**: esta feature **não** muda o valor de nenhuma régua (Assumptions da
spec) e **não** adota a segunda curva (com resposta de IA). Ela torna a condição visível e datada.
Trocar a curva é decisão do dono, e agora fica instrumentada para ser tomada.

---

## Saída da Fase 0

Nenhum `NEEDS CLARIFICATION` remanescente. As oito decisões acima são as entradas da Fase 1:
`data-model.md` (entidades e estados), `contracts/` (as assinaturas) e `quickstart.md` (como provar).
