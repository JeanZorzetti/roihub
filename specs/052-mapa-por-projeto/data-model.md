# Data Model: 052

Nenhuma tabela nova e nenhuma coluna nova. O que muda é **quem** entra nas tabelas que já existem, e dois
arquivos de dado declarado.

## Projeto do mapa (`Project`, de `projetosDeBusca()`)

| Campo | Uso no mapa | Atma | Sirius |
|---|---|---|---|
| `slug` | segmento da rota; chave de `lerDiasGsc`, `lerIndexacao`, `lerCrawlDePagina`, `lerInventario`, `DEMANDAS` | `atma` | `sirius` |
| `nome` | `nomeCurto = nome.split(" — ")[0]`: cabeçalho e seletor | Atma Aligner | Sirius CRM |
| `url` + `dominioAnterior?` | `hostsDeclarados()`: hosts somados e `canonizar()` | `usealigner.com` + `atma.roilabs.com.br` | `siriuscrm.com.br` |
| `marca?` | `marcaDeclarada()`: guarda de marca, não-marca, pernas da corrida | declarada em 08/09 | **proposta** (abaixo) |
| `perfil` | `cadeiaLigada(perfil)`: decide o painel "Depois do clique" | D, ligada | A, não ligada |

Regra: o mapa existe se e só se o slug está em `projetosDeBusca()`. Fora disso a resposta é 404 (FR-003). A
lista já sai de `deBusca(projetos, SLUGS_DE_BUSCA)` (`lib/projects.mjs`): card curado, com `url`, na ordem de
`SLUGS_DE_BUSCA`. O `curated` separa o card do repo do GitHub que só tem `homepage` (research D2).

## Marca declarada (campo `marca` do card)

`{ termos: string[], pais: string, declaradaEm: "YYYY-MM-DD" }`. O formato já é validado por
`marcaDeclarada()` em `lib/marca.mjs`. `pais` é obrigatório (sem ele o motivo é `sem-pais`) e filtra as três
pernas de marca da série: as folhas de marca leem só esse país (FR-007).

**Proposta para o Sirius (FR-007, aguardando o aceite)**: `termos: ["sirius", "siriuscrm"]`, `pais: "bra"`,
`declaradaEm`: a data do aceite.

- `sirius` com fronteira de palavra cobre `sirius crm`, `crm sirius`, `sirius ia` e `plataforma sirius`, e
  também os homônimos (`sirius financeira`, `sirius corretora`). Isso é conservador de propósito: tira do
  não-marca a demanda que o Sirius não pode conquistar.
- `siriuscrm` entra à parte porque não tem fronteira no meio.

Transição: sem `marca` → o motivo `ausente` (o estado de hoje). Com `marca` → a próxima corrida grava as sete
colunas nos dias dos últimos 480 que já existem (research D7).

## Inventário de termos (`data/inventario-de-termos.json`, chave `sirius`)

A forma é a mesma da chave `atma`, validada por `validarInventario()`:

```json
{
  "procedencia": {
    "congeladoEm": "YYYY-MM-DD",
    "janela": { "inicio": "…", "fim": "…" },
    "piso": 20,
    "dimensao": "query",
    "hosts": ["siriuscrm.com.br"],
    "excluiMarca": ["sirius", "siriuscrm"],
    "porque": "termos com ao menos 20 impressões em 8 meses, somados os hosts declarados, sem a marca própria"
  },
  "termos": ["…"]
}
```

Só é escrito por `scripts/derivar-inventario.mjs sirius --gravar` e só depois do aceite (FR-008). A prévia de
21/09 tem 18 termos. Enquanto a chave não existir, `lerInventario("sirius")` devolve `null`, e as folhas de
penetração e TAM ficam em "inventário não declarado".

## Demanda estimada (`data/demanda-estimada.json`)

Sem chave `sirius`, e fica assim nesta feature (fora do escopo). `DEMANDAS[slug]` é `undefined`, e a folha
mostra o motivo da FR-009.

## Escopo (constantes)

| Constante | Arquivo | Hoje | Depois | Quem lê |
|---|---|---|---|---|
| `SLUGS_DE_BUSCA` | `lib/projects.ts` | `["atma"]` | `["atma", "sirius"]` | as três corridas e o mapa (rota e seletor), por `projetosDeBusca()` → `deBusca()`; `/okr/[slug]/aquisicao`, direto |
| `SLUGS_DE_CAMPO` | `lib/crux.mjs` | `["atma"]` | `["atma", "sirius"]` | o mapa (vitais e Pass Rate) e a ficha `/okr/[slug]` |

## Cadeia ligada (função nova em `lib/okr.mjs`)

`cadeiaLigada(perfil)` → `{ ligada: boolean, semColetor: string[] }`

- Toma `PERFIS[perfil].marcos` e tira o `visitante` inicial, pela mesma regra de `ficha-dados.ts:106`.
- `ligada` é `true` quando a lista não está vazia e todo degrau tem `coletor`.
- `semColetor` traz os **nomes** dos degraus sem coletor, na ordem do perfil. É o texto do painel.
- Perfil desconhecido → `{ ligada: false, semColetor: [] }`.
- Perfil A → `{ ligada: false, semColetor: ["signup", "ativado", "trial pago"] }`. Perfil D →
  `{ ligada: true, semColetor: [] }`.

## Testemunhas (`lib/mapa-projeto.mjs`, puro)

| Export | Forma | Regra |
|---|---|---|
| `EVIDENCIAS` | `RegExp[]` | as frases que PODEM nomear a Atma no mapa de outro projeto (research D5): hoje, duas |
| `textoDoMain(html)` | → `string` | o texto visível de `<main>`: tira os blocos `<script>` e `<style>` inteiros, depois as tags (research D12) |
| `frasesAlheias(texto, alheio, permitidas)` | → `string[]` | divide o texto em frases (corte em `.`, `!` ou `?` seguidos de espaço, para não partir `1.234` nem `.mjs`) e devolve as que contêm `alheio` (sem diferenciar maiúsculas) e não casam com nenhuma de `permitidas` |
| `numerosDoMapa(texto)` | → `string[]` | os números em ordem de aparição, no formato pt-BR (`1.234`, `12,5%`, `4,4`), sem o carimbo "Apurado ao abrir a página, em …" |
