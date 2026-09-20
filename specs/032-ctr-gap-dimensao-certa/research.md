# Fase 0 — Pesquisa: cada medida lida pela dimensão que a mede

**Feature**: [spec.md](spec.md) · **Data**: 2026-09-19

Nenhum `NEEDS CLARIFICATION` sobrou da spec: a Q1 (fronteira do Top 3) foi fechada pelo dono em
19/09/2026. As decisões abaixo são as que o CÓDIGO impôs depois que a spec fechou — cada uma com o
fato medido que a decidiu.

**A premissa foi reconferida antes de planejar**, com o mesmo script que mediu a spec, na mesma
janela (2026-08-20 → 2026-09-16), e depois com as duas leituras passando pelas funções que estão no
ar:

| | `query`+`page` (alimenta a tela) | `page` (completa) |
|---|---:|---:|
| impressões | 10.395 | 24.664 |
| cliques | 190 | 434 |
| URLs distintas | 14 | 29 |
| avaliadas pelo balizador | 6 | 24 |
| atingem o piso | **0,00%** | **12,50%** (3 de 24) |
| home | posição 11,82 — fora da faixa | posição 6,93 · CTR 22,49% · **passa** |

Os números da spec batem na casa decimal. A feature está de pé.

---

## D1 — A leitura por página já existe: `gscPaginas`, no mesmo `Promise.all`

**Decisão**: a aba passa a chamar `gscPaginas(hostsDeclarados(p), curtaGsc)` ao lado de
`gscConsultas(hostsDeclarados(p), curtaGsc)` — **a mesma variável de janela e a mesma lista de
hosts**, no `Promise.all` que a aba já monta. Nenhuma função de borda nova.

**Rationale**: `gscPaginas` nasceu na 016 para a camada de entrega, a 030 a fez somar hosts, e
`lib/okr-coleta.ts:192` já a chama com a janela de descoberta para a ficha. A FR-006 (mesma janela,
mesma lista) é satisfeita **por construção** quando as duas leituras recebem o mesmo objeto: duas
variáveis de janela é exatamente como dois blocos da mesma aba passam a medir períodos diferentes
sem ninguém notar.

**Alternativas descartadas**: (a) pedir as duas dimensões numa requisição — a API devolve
`query`+`page` **ou** `page`, são duas requisições por definição; (b) derivar as páginas somando as
linhas por termo — é o defeito que a spec abre.

## D2 — A fronteira é o NOME DO CAMPO, e quem cobra é o compilador

**Decisão**: a família por URL consome linhas cujo campo de URL se chama **`pagina`** (a forma que
`gscPaginas` já devolve) e a família por termo continua exigindo **`query` + `page`**. As duas
formas são disjuntas, e **toda** função das duas famílias ganha `@param` JSDoc.

**Medido em 19/09/2026** (probe descartado após a medição): o JSDoc de um `.mjs` **chega** ao
chamador `.tsx`. `kpisDeBusca(paginas, null)` reprova em `tsc --noEmit` (tem
`@param {LinhaBusca[]}`); `urlsComImpressao(paginas)` **não** reprova — porque não tem `@param`
nenhum. É a técnica da 031 (`siteUrl` → `string[]`) disponível aqui de graça: a porta errada deixa
de compilar em vez de ficar fechada por convenção.

**Consequência de trabalho**: `tsc --noEmit` entra no portão da entrega ao lado de `npm test` — a
suíte não tipa nada, `tsconfig.json` não tem `checkJs`, e o erro só aparece no chamador tipado (a
aba) e no `next build`. Função da família sem `@param` é a porta aberta.

**Descartado**: guarda em tempo de execução (`if (linhas[0]?.query) throw`). Ela dispara em
produção, no render, depois do deploy; o `@param` dispara no `tsc` de quem escreveu a linha.

## D3 — A família por URL **não re-agrega**

**Decisão**: `ctrGap` passa a aplicar `ctr()` + `benchmark()` **linha a linha**, sem somar nada.

**Rationale**: cada linha de `gscPaginas` já é UMA URL — `mesclarPorCaminho` (030) funde por caminho
antes de a borda devolver. Passá-las por `porUrl()` recalcularia `posição × impressões ÷ impressões`,
a mesma multiplicação-e-divisão que a 031 removeu de `somarSeriesPorHost` porque altera o número do
Google em ~8% dos casos (medido em 20.000). **Medido hoje nas 29 páginas da Atma: 0 mudaram** — é
sorte de ponto flutuante, não garantia: a faixa do balizador termina em 10,9 e um
`11,000000000000002` cai fora dela, que é o mecanismo exato do defeito desta spec.

## D4 — `porUrl()` é **deletada**

**Decisão**: depois da D3, `porUrl` fica sem chamador de produto — os três (`ctrGap`, `lerPassRate`,
`impressoesPorUrl`) migram para a leitura por página. Ela sai do repo.

**Rationale**: `porUrl` é literalmente "some as linhas por termo para formar a URL" — a operação que
a FR-001 proíbe na família por URL. Deixá-la na prateleira sem chamador é manter à mão o caminho que
fabricou o 0%: o próximo a precisar de "impressões por URL" acha ela primeiro.

**Consequência**: `MEDIDO_POR.ctrPorPosicao` aponta hoje para `lib/kpis-busca.mjs#porUrl+benchmark`
e passa a apontar para a função nova. `test/gsc-delta.test.mjs` confere que a CHAVE é folha do
board, **não** que o símbolo exista no arquivo — o conserto é manual e virou linha da tabela de
riscos.

**Descartado**: manter `porUrl` "para quem precisar um dia". É a prateleira que a 030 esvaziou.

## D5 — `kpisDeBusca` vira `kpisPorTermo`; nasce `kpisPorPagina`

**Decisão**: dois agregados, um por leitura.

- `kpisPorTermo(linhas, ehMarca)` → consultasUnicas, noTop20, impressoesNoTop3, strikingDistance,
  canibalizacao.
- `kpisPorPagina(paginas, indexadas)` → urlsComImpressao, ctrGap, activeIndexRatio.

**Rationale**: `kpisDeBusca(linhas, paginas, ehMarca)` — uma função com as duas listas — põe a
fronteira DENTRO do corpo e deixa o chamador passar a mesma lista nos dois parâmetros sem erro
nenhum. Com dois agregados a fronteira é a **assinatura**, e o `@param` da D2 a cobra. O rename
força a revisão do único chamador (a aba), do mesmo jeito que a 031 usou
`gscSeries`/`gscSerieDeUmHost`.

## D6 — `activeIndexRatio` vai junto; `queryToPageRatio` fica

"URLs com impressão ÷ URLs indexadas" conta **URLs**: família por URL, e a spec a lista.
`queryToPageRatio` tem `consultasUnicas` no numerador — é por termo, e **mantém o selo de piso**
(FR-004). Os dois dividem pelo mesmo `denomIdx`, que vem da apuração de indexação no banco e não de
nenhuma das duas leituras: a migração não toca o denominador.

## D7 — O portão do piso passa a ser **por família**

**Decisão**: `PISO_IMPRESSOES_VEREDITO` (100) continua um só, mas é aplicado à base **da leitura que
alimenta a medida**. A linha "de 100 impressões — o piso da régua do board" aparece por leitura
abaixo do piso e **nomeia** a leitura.

**Rationale**: hoje `acimaDoPiso` sai da base por termo e governa as barras de todas as leituras do
bloco, inclusive o CTR Gap — um portão decidindo a régua de um número com a base de **outro**. É a
doença desta spec em escala menor, e ela sobreviveria à correção. Na Atma as duas bases estão muito
acima de 100 e nada muda na tela hoje; o conserto é para o projeto pequeno, que é para quem a régua
existe. Seis vezes nesta tela um veredito consertado no chamador voltou pela porta seguinte
(`guarda_no_chamador_volta_pela_porta_seguinte`) — o portão mora no cálculo da base, não em cada
linha.

## D8 — Falha isolada: o bloco deixa de ter um `kpis === null` só

**Decisão**: cada família renderiza com a sua leitura; a ausência **nomeia a leitura que faltou**
("a leitura por página falhou — …"), preservando a distinção da 030 entre `null` (sem propriedade:
conserto é domínio) e `{erro}` (falha de agora).

**Rationale**: a FR-005 é explícita, e colapsar esconderia metade do bloco sem motivo. A mensagem de
erro já COMEÇA pelo host (030/031); o que falta é o nome da leitura — com duas leituras no mesmo
bloco, o host sozinho não diz qual das duas caiu.

## D9 — O Top 3 fica por termo — e isso é **não mexer**

Decisão do dono, registrada na spec. Implementação: `impressoesNoTop3` continua em `kpisPorTermo`
recebendo as linhas por termo. A trava é a SC-004 — um teste que fixa o valor com a mesma entrada,
para a migração não vazar para cá nem para `strikingDistance`/`canibalizacao`, que precisam do
termo.

## D10 — `impressoesPorUrl` (bloco de crawl) migra, mesmo fora da tabela da spec

**Decisão**: o mapa `URL → impressões` que alimenta a lista de páginas do crawl ("22.059 impressões
em 28 d") e a ordem da periferia passa a sair da leitura por página.

**Rationale**: é impressão **por URL**, medida pelo instrumento errado pelo mesmo motivo — a tabela
da spec enumera as medidas do bloco de busca e este mapa mora no bloco vizinho. Registrado aqui
porque **não está na tabela**: quem só ler a spec vai procurar e não vai achar. A canonização que já
se aplica às linhas do GSC antes de cruzar com o crawl (024/D3) continua valendo, agora sobre as
linhas por página.

## D11 — A amostra do Pass Rate muda de valor, e isso é esperado

`lerPassRate` ordena as URLs por impressão e pergunta as 10 primeiras ao CrUX. Com a leitura por
página são 29 URLs em vez de 14: o topo pode mudar e "não consultadas" vai de 4 para 19. **O número
do Pass Rate pode mudar** — a SC-004 protege as medidas por termo, e a spec lista a amostra como
família por URL. Custo de rede idêntico: `CAP_URLS_PASS_RATE` continua 10.

## D12 — Três requisições em voo, não duas

A 031 fixou o teto em 2. A aba passa a ter **três** leituras no mesmo `Promise.all` — série,
consultas, páginas —, cada uma com os hosts **em série** dentro (`lerHosts`). Teto em voo: 3, nunca
3×N. Precedente: `lib/okr-coleta.ts` dispara série + páginas em paralelo desde a 030. A latência não
soma (manda a mais lenta) e a quota do Search Console é por requisição, não por dimensão. Só projeto
em migração paga host a mais, e só a Atma declara `dominioAnterior`.

## D13 — A testemunha passa a calcular o índice

**Decisão**: `scripts/conferir-soma-hosts.mjs --pagina` ganha, no mesmo modo, a tabela por URL com
CTR, piso da posição e veredito, mais a fração — usando `benchmark()` (a régua do board, que **tem**
de ser a mesma) e aritmética própria, **sem** passar por `ctrGap` nem por `mesclarPorCaminho`.

**Rationale**: a SC-001 exige "conferível contra a leitura por página medida à mão". Foi assim que
esta spec foi medida — num script descartável, que o próximo a conferir não vai ter. A testemunha
continua não sendo o código que ela confere: o que ela importa é a régua, não a leitura.

## D14 — Uma declaração de hosts no cabeçalho, não duas

As duas leituras recebem a MESMA lista (`hostsDeclarados(p)`), então `hosts` e `encerrados` só
divergiriam se uma propriedade sumisse entre as duas chamadas. O cabeçalho mantém **um**
`<HostsDaLeitura>`, alimentado pela leitura que respondeu. Duas linhas "hosts somados" no mesmo
cabeçalho seriam duas versões do mesmo fato — `transcricao_vira_terceira_fonte_de_numero` em forma
de cabeçalho.

## D15 — Truncamento e selo de piso: cada ressalva na leitura certa

`gscPaginas` pede `rowLimit: 1.000` (030) e devolve `truncado` por propriedade; `gscConsultas` pede
25.000. O `<details>` do bloco declara o truncamento das **duas** leituras, e a frase "o Search
Console omite as consultas raras" passa a valer **só** para as medidas por termo. É a FR-004 na
direção inversa: a spec não remove a ressalva, ela para de aplicá-la onde não precisa existir.
A Atma tem 29 páginas — o sinal existe para o dia em que não tiver.

## D16 — `lib/gsc-delta.mjs` é parte da entrega, não documentação solta

`RESSALVA_DO_COLETOR.activeIndexRatio` hoje diz "devolve um PISO … a dimensão `query` do GSC omite as
consultas raras". Depois desta spec isso deixa de ser verdade para essa folha, e só a metade de
janela (`E_A_JANELA`) continua. `MEDIDO_POR` ganha os símbolos novos (D4/D5). Um mapa que descreve o
coletor errado manda o próximo a ligar um coletor que já está ligado — foi o defeito que o próprio
arquivo documenta ter cometido com `linksInternos`.
