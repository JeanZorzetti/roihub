# Fase 0 — Pesquisa: Ficha N0-N6 por projeto

**Feature**: `011-okr-ficha-por-projeto` | **Data**: 2026-09-01

Nenhuma tecnologia nova entra nesta feature, então não há pesquisa de biblioteca. As incógnitas são
todas de **desenho sobre o código que já existe**: onde cada regra mora para não virar segunda régua
do mesmo número. Cada seção fecha com o que foi decidido, por quê, e o que foi recusado.

---

## D1 — Onde mora o terceiro estado da célula (`declarado`)

**Decisão**: envelope novo em `lib/ficha.mjs`. `lib/funil.mjs` fica **intocado**.

```
Celula (funil.mjs, hoje)      {valor} | {naoApurado}
CelulaFicha (ficha.mjs, novo) {estado, valor?, fonte?, declaradoEm?, motivo?, consultar?}
```

`estadoDeApurado(celula, fonte)` embrulha uma célula da 009; `declarada(valor, {em, o_que})` nasce de
uma declaração do card; `naoApurada(motivo, consultar)` nasce de uma ausência. `combinar(insumos,
calcular)` aplica a herança da FR-010.

**Motivo**: `ehApurado(c)` é `c != null && typeof c.valor === "number"`. Um construtor `declarado`
que devolvesse `{valor, declaradoEm}` passaria por apurado em **todo** consumidor existente —
`montarFicha()`, `posicaoDeAtaque()`, `ancoraDe()`, `projetar()` e as três células da `/okr`. O
veredito da 009 passaria a tratar ticket declarado como degrau medido, e a SC-001 (a `/okr` idêntica)
cairia sem um erro sequer. É exatamente o modo de falhar que a feature existe para não ter.

**Recusadas**:
- *Terceiro construtor em `lib/funil.mjs`*: contamina cinco consumidores para servir um.
- *Campo booleano `declarado` na célula existente*: mesma contaminação, com a agravante de que quem
  não conhecesse o campo continuaria lendo apurado — falha silenciosa por omissão, não por erro.
- *Rotular no componente React*: a herança da FR-010 é regra, e regra em `.tsx` não é testável por
  `node --test` (Princípio III). A SC-006 e a SC-007 exigem teste.

---

## D2 — Como a aba OKR vira menu sem custar o `/okr`

**Decisão**: a aba é um **par**: `<Link href="/okr">OKR</Link>` mais um `<details>` irmão, cujo
`<summary>` é o controle de expandir. Dentro do `<details>`, a lista abre com `Portfólio` (`/okr`) e
segue com um item por ficha curada.

**Motivo**: a FR-001 pede um controle de expandir/recolher e a FR-002 exige `/okr` em **um**
acionamento a partir de qualquer página. Um `<summary>OKR</summary>` satisfaz a primeira e quebra a
segunda: abrir o menu (1) e clicar em `Portfólio` (2) são dois. Separar o link do disclosure atende
as duas literalmente, e a US1-AC1 continua verdadeira nas duas leituras — acionar o disclosure abre o
menu; acionar o link navega para `/okr`, que renderiza com o menu já aberto pela FR-003.

**Motivo de ser `<details>` e não botão + JS**: a FR-004 exige funcionar **sem JavaScript de
cliente** e ser operável só por teclado. O elemento nativo entrega foco visível, Enter e Espaço,
`aria-expanded` implícito e — o que decide — o estado inicial vindo do servidor via
`open={rotaEhOkr}`, que é a FR-003 inteira sem uma linha de JS. Nenhuma das 12 telas do hub tem
`"use client"` (só `app/editar-card.tsx`, que não é página), então não há bundle a acrescentar.

**Recusadas**:
- *`<summary>` como a própria aba*: quebra a FR-002, medida acima.
- *`<nav>` com `<button aria-expanded>` e JS*: introduz o primeiro client component numa barra
  presente em 12 telas, para reimplementar o que o `<details>` já faz.
- *Menu sempre aberto*: 12 telas passariam a exibir a lista de fichas permanentemente; em 390px a
  barra já quebra em linhas com 13 abas (SC-014).

---

## D3 — De onde a barra tira a lista de fichas curadas

**Decisão**: `listFichas()` nova em `lib/projects.ts`, lendo a curadoria e filtrando quem tem o campo
`ficha`. `Tabs` vira componente assíncrono e a chama.

**Motivo**: `listProjects()` chama `listRepos()` (API do GitHub, cache de 10 min). Colocá-la numa
barra de navegação faria `/busca`, `/ia` e `/automacao` — que hoje não leem projeto nenhum — pagarem
rede no cold start para desenhar um menu. `listFichas()` não precisa do merge: `ficha` é curadoria
manual, repo vindo do GitHub nunca tem o campo, e as duas listas concordam por construção.

Registrado na tabela de Complexity Tracking do plano porque é, literalmente, uma segunda função de
leitura de projeto — mesmo estando dentro de `lib/projects.ts`, que é onde o Princípio I manda.

**Recusada**: *prop `fichas` em `Tabs`* — 12 arquivos editados para o mesmo dado, e o 13º
(a rota nova) esqueceria.

---

## D4 — Onde os fatores de N2 são declarados

**Decisão**: campo `fatores` dentro de `PERFIS.D`, em `lib/okr.mjs`, ao lado de `marcos`. Só o
perfil D nesta feature (FR-019a); A, B e C não ganham o campo e a ficha responde por eles com o
motivo declarado.

**Motivo**: a cobertura de um fator de cadeia é uma lista de `chave` de `marcos`. Declarar as duas
coisas em arquivos diferentes garante que a primeira etapa renomeada quebre a cobertura em silêncio.
Ao lado, um teste de contiguidade (G3 do contrato) reprova no `npm test` no mesmo instante.

**Impacto na `/okr`**: nenhum. A página lê `ficha.n1`, `ficha.n2`, `ficha.marcos` e `ficha.taxas`;
`fatores` é campo novo que `montarFicha()` não propaga hoje e a `/okr` não renderiza. Aditivo.

**Os quatro fatores do perfil D**, do `handoff/okr-kpi-template.md`
(`Receita = Leads × CR(lead→consulta) × CR(consulta→tratamento) × Valor do tratamento`):

| fator | tipo | cobertura / fonte | estado na `atma` |
|---|---|---|---|
| `Leads` | cadeia | `["lead"]` — o volume de entrada da conta | apurado (39), ou `não apurado` sem `ATMA_DATABASE_URL` |
| `CR(lead→consulta)` | cadeia | `["contatado","agendada","compareceu"]` | `não apurado` — três degraus sem coletor |
| `CR(consulta→tratamento)` | cadeia | `["tratamento"]` | `não apurado` — herda o buraco do denominador |
| `Valor do tratamento` | valor | `meta.ticket` do card | **declarado** (R$ 4.000, 01/09/2026) |

A cobertura dos fatores de cadeia é contígua (`lead` → `tratamento`) e termina no N1. `visitante`
fica **de fora de propósito**: é a entrada da cadeia, respondida por N4, e exigi-la acusaria erro de
definição nos quatro perfis (FR-021).

**Recusada**: *tabela `FATORES_N2` paralela em `lib/ficha.mjs`* — segunda régua para a mesma cadeia.

---

## D5 — Onde mora a coleta das três células

**Decisão**: `lib/okr-coleta.ts` novo, recebendo `FONTES_PROPRIAS`, `lerFontePropria()` e uma função
`coletarDoProjeto(p, {inicio, fim, leadsDoHub, erroLeads})` que devolve `{cliques, leads, vendas}`.
`app/okr/page.tsx` e `app/okr/[slug]/page.tsx` importam a mesma.

**Motivo**: o comentário que está hoje em `app/okr/page.tsx` já escreveu a regra — *"Uma entrada só e
explícita; se aparecer uma segunda, isto vira `lib/`"*. A segunda tela é a segunda entrada. Duas
cópias divergiriam na primeira fonte própria nova, e a ficha passaria a exibir um número que a `/okr`
não exibe — que é o defeito que a SC-001 mede.

**Por que `.ts` e não `.mjs`**: toca `pg` (`new Pool`) e `gscSeries` (`google-auth-library`). É borda
por definição do Princípio III, e não contém regra nenhuma — a regra (`celulaDeLeads`, `montarFicha`)
continua em `.mjs`.

**Recusada**: *duplicar a coleta na rota nova* — rejeitada pelo comentário do próprio arquivo.

---

## D6 — A data de cada item de N6 (a única incógnita real da spec)

**Contexto**: `acoesDoRanking()` produz `occ: NO_DATE` (`1970-01-01`) porque a `acao` do card **não
é datada**. A FR-030a exige que cada item exiba sua data, e a US5-AC5 justifica: um plano de três
meses atrás parece igual a um de hoje.

**Decisão**: exibir a data que o hub de fato tem — `hub_acao_dono.atualizado`, o instante em que
alguém assumiu a ação — rotulada como **`dono definido em <data>`**. Item sem dono sai
`sem data declarada — a acao do card não é datada`, que é o terceiro estado da FR-009 e é o achado,
não uma célula vazia. Uma função nova em `lib/db.ts`, `listDonoDatas(): Map<key, string>`, lê a
coluna — que **já existe** na tabela, sem migração.

**Motivo de não mexer em `listDonos()`**: ela devolve `Map<key, string>` e é consumida pela
`/agenda` e por `acoesDoRanking()`, que tem teste. Trocar a assinatura para `Map<key, {responsavel,
atualizado}>` arrastaria dois arquivos e um teste para servir uma tela nova, e a SC-018 exige que os
itens e os donos da ficha sejam **exatamente** os da `/agenda` — quanto menos a compartilhada mudar,
mais barato é provar isso.

**Recusadas**:
- *Não exibir data nenhuma*: contraria FR-030a e US5-AC5 literalmente.
- *`pushedAt` do repositório*: é a data do último push do código, não da premissa da ação. Seria um
  número certo respondendo a outra pergunta — a armadilha que a spec inteira nomeia.
- *`hub_done.done_at`*: só existe para o que já foi marcado feito; N6 lista o pendente.

---

## D7 — O espaço de chaves de N5 para validar KR

**Decisão**: o catálogo de medidores das **quatro** famílias, não só o da família exibida.

**Motivo**: a FR-026 manda exibir uma família só, e a família é escolhida pelo veredito da 009 — que
muda quando um degrau passa a ser apurado. Se o espaço de chaves fosse o que está na tela, um KR
válido em `n5:` viraria "erro de declaração" no dia em que o gargalo mudasse de família, e a FR-017
existe para acusar erro de **escrita**, não movimento do diagnóstico. O KR sobre medidor não exibido
continua caindo na FR-015 (`não verificável`), que é o tratamento certo.

**Chaves**, do §5 do template (fixas, não declaradas por projeto):

- `D1` descoberta: `paginas-indexadas`, `posicao-media-com-corte-pais`, `cobertura`, `alcance`,
  `citacao-por-ia`, `impressoes`
- `D2` entrega: `lcp`, `inp`, `cls`, `ttfb`, `uptime`, `taxa-5xx`, `build`, `certificado`
- `D3` persuasão: `scroll-ate-oferta`, `cliques-cta`, `abandono-por-campo`, `saida-checkout`
- `D4` encanamento: `lead-gravado`, `webhook-2xx`, `gateway-ligado`, `email-entregue`

**Quais podem exibir número** (FR-028 — só o que a própria requisição já carrega): `impressoes` (da
mesma série do GSC que dá `cliques`), `lead-gravado` (a célula de leads) e `gateway-ligado` (o campo
`vendas` do card: ausente é "não olhei", `[]` é "olhei, zero"). Todo o resto sai `não apurado` com a
fonte a consultar. `posicao-media-com-corte-pais` sai `não apurado` **mesmo existindo na API**, pelo
motivo da FR-029 — sem corte por país a média mistura branded com genérico.

**Recusada**: *ligar `indexacao`, `health` e `seo-score`* — cada um tem janela própria (Crawl Stats é
média de 90 dias, health é pontual) e seriam a segunda janela que a FR-012 proíbe. É feature própria,
e começa por decidir a janela e o corte de cada medidor.

---

## D8 — N4: canais, elo e a diferença

**Decisão**: lista fixa de seis canais do §3-N4 (`organico`, `direto`, `pago`, `indicacao`,
`outbound`, `social`). Só `organico` tem coletor — os cliques do Search Console, **rotulados
orgânico** (FR-023). Os outros cinco saem `não apurado` com a fonte a consultar.

`sem elo` (FR-025) é derivado, não declarado: o canal ganha a marca quando **não** é denominador de
nenhuma taxa de N3. Nos perfis A, B e D o primeiro marco é `visitante`, então `organico` tem elo; no
perfil C a cadeia começa em `contato` e `organico` sai marcado `sem elo` — que é exatamente a leitura
que o template quer ("volume sem cadeia abaixo é vaidade").

A diferença entre a soma dos medidos e a entrada da cadeia sai `não apurado` com o motivo, e a ficha
**não** exibe total (FR-024). Na `atma` isso é a linha que importa: lead de WhatsApp, indicação e
direto entra no numerador de `CR(visitante→lead)` sem entrar em denominador nenhum.

**Recusada**: *canais declarados por projeto* — segunda régua para o mesmo número (Assumptions da
spec).

---

## D9 — 404 do slug desconhecido

**Decisão**: `notFound()` do Next quando o slug não está em `listProjects()`. A verificação é contra
a lista **completa** (curados + repos do GitHub), não contra as fichas curadas — os 16 projetos com
perfil e sem curadoria abrem a mesma página, com os níveis declarados em `não apurado`, e isso é o
resultado correto (FR-007 + Assumptions).

**Motivo**: uma ficha em branco com sete cabeçalhos vazios para um projeto inexistente é
indistinguível de um projeto real sem dados — que é a distinção que a feature inteira defende.

---

## Resumo das incógnitas

Nenhum `NEEDS CLARIFICATION` permanece. A única que a spec deixou aberta era a data de N6 (D6),
resolvida acima com a coluna que já existe e sem tocar na projeção compartilhada.
