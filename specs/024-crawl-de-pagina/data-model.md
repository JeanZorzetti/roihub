# Data Model: O que há dentro das páginas da Atma

**Feature**: `024-crawl-de-pagina` | **Date**: 2026-09-08

---

## 1. Persistido — `hub_pagina_corrida`

Uma linha por **corrida de um projeto num dia**. É a entidade "Apuração de crawl" da spec. Criada
no `ensure()` de `lib/db.ts`, junto das outras, com `CREATE TABLE IF NOT EXISTS`.

| Coluna | Tipo | Notas |
|---|---|---|
| `projeto` | `TEXT NOT NULL` | o `slug` de `listProjects()`, nunca o rótulo de exibição |
| `dia` | `DATE NOT NULL` | dia da corrida |
| `declaradas` | `INT NOT NULL` | `<loc>` distintas no sitemap (o inventário da 022) |
| `visitadas` | `INT NOT NULL` | páginas efetivamente buscadas, do sitemap ou não |
| `falhas` | `INT NOT NULL` | erro de rede ou HTTP ≥ 400. **Fora** de qualquer numerador |
| `orfas` | `INT NOT NULL` | declaradas que nenhum link interno alcança |
| `linkadas_nao_declaradas` | `INT NOT NULL` | alcançadas por link e ausentes do sitemap (D7) |
| `links_navegacao` | `INT NOT NULL` | pares `(href, âncora)` classificados como navegação (D1) |
| `teto_atingido` | `BOOLEAN NOT NULL` | FR-012 — a travessia parou no teto e o número está incompleto |
| `motivo` | `TEXT` | `NULL` quando apurou. Senão: `sem_sitemap`, `sitemap_vazio`, `home_inacessivel` |
| `criado` | `TIMESTAMPTZ NOT NULL DEFAULT now()` | quando esta linha foi (re)gravada |

**PK**: `(projeto, dia)` — a mesma chave de idempotência de `hub_indexacao` e `hub_gsc_dia`. Rodar
a corrida duas vezes no mesmo dia regrava, não duplica.

`motivo` reusa dois dos quatro estados da 022 porque vêm do mesmo `lerSitemap()`, e acrescenta um
que só existe aqui: **`home_inacessivel`**. Sem a home não há origem para a travessia, e toda
página do sitemap sairia órfã — que seria a feature inteira mentindo por causa de um `ETIMEDOUT`.
Nesse caso a corrida grava o motivo e **não** grava linha nenhuma em `hub_pagina`.

---

## 2. Persistido — `hub_pagina`

Uma linha por **URL por corrida**. É a entidade "Página crawleada" da spec. É a tabela que a
**SC-006** exige (D8): ela é a única forma de nomear *quais* páginas são órfãs ou periféricas.

| Coluna | Tipo | Notas |
|---|---|---|
| `projeto` | `TEXT NOT NULL` | o `slug` |
| `dia` | `DATE NOT NULL` | mesma chave da corrida |
| `url` | `TEXT NOT NULL` | a URL **canônica** da D3 — nunca a forma crua do href |
| `no_sitemap` | `BOOLEAN NOT NULL` | declarada pelo site, ou só alcançada por link |
| `profundidade` | `INT` | cliques a partir da home. **`NULL` = órfã**, jamais `0` |
| `links_contextuais` | `INT NOT NULL` | quantos links **contextuais** apontam para cá (D1/D2) |
| `titulo` | `TEXT` | `NULL` = a página não serve `<title>`; `''` = serve vazio. São coisas diferentes |
| `titulo_px` | `INT` | largura **estimada** (D4). `NULL` quando não há título |
| `titulo_metodo` | `TEXT` | `arial-20px-tabela`. Viaja com o número até a tela (FR-005) |
| `intencao` | `TEXT` | `informacional`, `comercial`, `ambos` ou `ausente` (FR-007) |
| `schema_estado` | `TEXT NOT NULL` | `valido`, `invalido` ou `ausente` (FR-008) |
| `schema_tipos` | `TEXT` | os `@type` achados, separados por vírgula; `NULL` quando não há |
| `data_declarada` | `DATE` | o que a página diz sobre si. `NULL` = **não declara** (FR-009) |
| `palavras` | `INT` | contagem sem `<script>`/`<style>`, pelo método não-guloso (D5) |
| `conteudo_estado` | `TEXT NOT NULL` | `com-conteudo`, `js-dependente` ou `sem-conteudo` (D12) |
| `status` | `INT` | HTTP final, após redirecionamento. `NULL` quando nem respondeu |
| `redirecionada` | `BOOLEAN NOT NULL` | FR-013 — sitemap declarando URL que redireciona é achado |
| `erro` | `TEXT` | mensagem truncada em 60 caracteres. `NULL` = buscou bem (FR-016) |

**PK**: `(projeto, dia, url)`.

**Escrita**: `DELETE FROM hub_pagina WHERE projeto = $1 AND dia = $2` seguido de um **INSERT
multi-linha**, no padrão de `gravarDiasGsc`. `DELETE` antes do `INSERT` e não `ON CONFLICT`: uma
URL que **saiu** do site precisa sumir da corrida do dia, e o upsert a deixaria para trás como
fantasma indistinguível de uma página viva.

**Índice**: `(projeto, dia)` já é prefixo da PK — a leitura da tela usa só isso, e índice extra
seria peso sem consulta que o justifique.

### As três invariantes

```
visitadas   = COUNT(hub_pagina WHERE projeto, dia)
orfas       = COUNT(profundidade IS NULL AND no_sitemap AND erro IS NULL)
declaradas >= COUNT(no_sitemap = true)      -- menor só quando o teto cortou
```

São asserções de teste, não comentário. A segunda é a que mais importa: **órfã é `profundidade
IS NULL` com busca bem-sucedida**. Uma página que falhou tem `profundidade` indefinida também, e
somar as duas transformaria erro de rede em achado de arquitetura de links.

### Nenhum campo ausente vira zero

`titulo NULL` ≠ `titulo ''`. `data_declarada NULL` **não** entra no numerador nem no denominador
da cadência (FR-009). `profundidade NULL` é órfã, não raiz. `palavras` só é `0` quando o método
não-guloso de fato contou zero — e `palavras = 0` numa página com `<h1>` é a contradição que
denunciou o `D-84`, então ela é caso de teste.

---

## 3. Não persistido — as arestas

A entidade "Aresta interna" da spec vive **apenas durante a corrida**. Ela produz dois números por
página (profundidade e links contextuais recebidos) e some.

Guardar o grafo inteiro responderia "quais páginas linkam para esta?", que é pergunta que esta spec
não faz. Se virar requisito de tela, é tabela nova numa spec nova — a mesma decisão que a 022 tomou
sobre o detalhe por URL, invertida aqui só onde a SC-006 obriga (D8).

---

## 4. Em memória — `lib/pagina.mjs`

Módulo **puro de extração**. Entra uma string de HTML, sai uma forma. Sem `fetch`, sem `pg`, sem
`process.env`, sem relógio.

```js
/** @typedef {{titulo: string|null, larguraPx: number|null, metodo: string,
 *    intencao: "informacional"|"comercial"|"ambos"|"ausente",
 *    schema: {estado:"valido"|"invalido"|"ausente", tipos: string[]},
 *    dataDeclarada: string|null, palavras: number,
 *    conteudo: "com-conteudo"|"js-dependente"|"sem-conteudo",
 *    links: {href: string, ancora: string}[]}} Extraida */
```

| Função | Assinatura | Regra |
|---|---|---|
| `semScriptNemStyle(html)` | `(string) => string` | **D5** — `[\s\S]*?` não-guloso. É a FR-010 |
| `contarPalavras(html)` | `(string) => number` | remove script/style, tira tags, colapsa espaço |
| `titulo(html)` | `(string) => string\|null` | primeiro `<title>`; entidades básicas decodificadas |
| `larguraDoTitulo(t)` | `(string) => {px, metodo}` | **D4** — tabela Arial em `em` × 20 px |
| `modificadoresDeIntencao(t, ano)` | `(string, number) => string` | **D9** — ano é parâmetro |
| `blocosJsonLd(html)` | `(string) => {estado, tipos}` | **D11** — ausente ≠ inválido; desce em `@graph` |
| `dataDeclarada(html)` | `(string) => string\|null` | JSON-LD `dateModified` → `article:modified_time` → `<time datetime>`, nessa ordem |
| `linksDe(html)` | `(string) => {href, ancora}[]` | todos os `<a href>`, âncora com tags removidas e espaço colapsado |
| `estadoDoConteudo(html, palavras)` | `(string, number) => string` | **D12** — reusa `detectarStack()` |
| `extrair(html, ano)` | `(string, number) => Extraida` | compõe as anteriores numa passada |

### `larguraDoTitulo` — o que a tabela é, e o que ela não é

Tabela de larguras de Arial em `em` (estreitos: `iljI.,;:'!|` ~0.22; médios: minúsculas ~0.55;
largos: `mMW` ~0.83; maiúsculas ~0.70), fallback `0.55` para caractere desconhecido, acentuado
usando a largura da letra base. Multiplicada por 20 px.

Devolve `{px, metodo}` e **não** um número solto: o `metodo` é o que impede a estimativa de ser
lida como medição (SC-004). Quem renderiza é obrigado a receber os dois.

### `dataDeclarada` — a ordem das fontes é a regra

JSON-LD `dateModified` primeiro porque é declaração estruturada e explícita; `article:modified_time`
depois; `<time datetime>` por último, porque `<time>` na página tanto pode ser a data do artigo
quanto a data de um comentário. Nenhuma das três ⇒ `null`, e `null` fica **fora do numerador e do
denominador** (FR-009). "Sem data declarada" nunca é "desatualizada" — é o Independent Test da US4.

---

## 5. Em memória — `lib/grafo.mjs`

Módulo **puro de travessia e agregação**. Recebe arestas já extraídas e devolve números. Zero rede,
zero banco — é o que torna a **SC-003** provável em milissegundos.

```js
/** @typedef {{de: string, para: string, ancora: string}} Aresta */
/** @typedef {{url: string, profundidade: number|null, contextuais: number, noSitemap: boolean}} NoDoGrafo */
```

| Função | Regra |
|---|---|
| `canonizar(href, base)` | **D3** — resolve relativo, minúscula o host, tira fragmento e barra final; devolve `null` para `mailto:`/`tel:`/`javascript:`/âncora pura |
| `ehInterna(url, host)` | mesmo host **exato**. Subdomínio **não** é interno (Edge Case da spec) |
| `navegacao(arestas, totalPaginas)` | **D1** — devolve o `Set` de chaves `href\nâncora` presentes em ≥ `FRACAO_NAVEGACAO` (0,5) das páginas **e** em ≥ `MIN_PAGINAS_NAVEGACAO` (3) |
| `profundidades(arestas, home)` | **D2/D7** — largura sobre **todas** as arestas; `Map<url, número>`; ausente do mapa = inalcançável |
| `densidades(arestas, nav)` | **D2** — conta arestas recebidas **excluindo** as de `nav` e os autolinks |
| `agregar(paginas)` | contagens da corrida + as três invariantes do §2 |

### `navegacao` é a SC-003 por construção

O teste que prova: o mesmo conjunto de páginas, primeiro com um menu de 5 links em todas, depois
com um menu de 15 links em todas. As contagens de `densidades()` são **idênticas** nos dois casos.
Nenhum número certo precisa ser conhecido de antemão — é teste de invariância, que é o que o
checklist de requisitos apontou como a forma mais barata de verificar a FR-004.

### `profundidades` e o teto

A travessia recebe o teto e para nele, devolvendo `tetoAtingido: true`. `visitados` é `Set`, então
ciclo termina por construção (FR-012). Com 36 URLs a Atma não chega perto do teto — ele existe para
o dia em que um site maior entrar em `SLUGS_DE_BUSCA`, e a tela declara quando ele corta.

---

## 6. As seis medidas, e de onde cada uma sai

| Medida do board | Sai de | Meta |
|---|---|---|
| Profundidade de Clique | `hub_pagina.profundidade` | 100% das transacionais e pilares a ≤ 3 |
| Densidade de Links Internos Contextuais | `hub_pagina.links_contextuais` | 5 a 10 por página alvo |
| Taxa de Integridade do Título | `titulo_px` ∈ [500, 580] **e** termo nos 35 primeiros | 100% |
| Taxa de Alinhamento de Intenção | `intencao != 'ausente'` | modificador explícito |
| Taxa de Cobertura de Dados Estruturados | `schema_estado = 'valido'` | 100% das prioritárias, 0 erro crítico |
| Cadência de Atualização | `data_declarada` contra hoje | auditoria a cada 6 a 12 meses |

A **Integridade do Título** é a única que precisa de dado de fora da tabela: a posição do termo
principal, que vem do Search Console na leitura (D10). URL sem consulta com impressão exibe **"sem
termo apurado"**, e sai do denominador dessa medida — nunca aparece como título reprovado.

---

## 7. Entidades da spec → onde cada uma mora

| Entidade da spec | Onde |
|---|---|
| **Página crawleada** | uma linha de `hub_pagina` |
| **Aresta interna** | efêmera: `Aresta[]` durante a corrida. Produz dois números e some (§3) |
| **Apuração de crawl** | uma linha de `hub_pagina_corrida` |

---

## 8. O que esta feature NÃO modela

- **A taxa de reescrita do título pelo Google.** O Search Console não expõe o título exibido na
  SERP. Declarada ausente com o motivo, como o handoff de 07/09 combinou.
- **Cobertura Semântica / Entidades.** Exige comparar com o Top 3 da SERP; continua fora.
- **O HTML renderizado.** O crawl lê o que o servidor entrega. Quando o conteúdo depende de JS a
  tela **diz isso** (D12) em vez de fingir que a página está vazia.
- **O status de índice por URL.** A 022 grava só o agregado do dia. Cruzar "página órfã" com
  "página que o Google leu e recusou" exige a 022 persistir por URL — spec nova.
- **Onde adicionar links.** A lista de páginas periféricas é o insumo; a decisão editorial é humana.
