# Contrato — a leitura por página do Search Console

**Feature**: `030-consultas-somam-hosts` | **Data**: 2026-09-19

O hub não expõe API pública para esta feature. As interfaces que mudam são **internas entre
módulos**, e é nelas que a FR-007 é cobrável: se as três leituras não chamarem o mesmo resolvedor e
a mesma mescla, o contrato está quebrado mesmo com os números certos na tela.

Entidades referenciadas: ver [data-model.md](../data-model.md).

---

## C1 — `hostsDeclarados(projeto) → string[]`

`lib/projects.mjs` · **já existe, inalterada.** Único resolvedor de host do hub (FR-001, D1).

Esta feature acrescenta dois consumidores e **nenhuma** lista paralela.

> **Cobrança**: `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx lib app
> scripts` não pode devolver linha fora de `lib/projects.ts` e `lib/projects.mjs`.

---

## C2 — `dominioAnteriorDoSlug(slug) → { url: string } | null`

`lib/projects.ts` · **novo.** Lê a curadoria direto, sem rede — mesmo argumento (e mesmo arquivo)
que autoriza `listFichas()`, porque `dominioAnterior` só existe na curadoria (D2).

| Entrada | Saída |
|---|---|
| slug de projeto curado com `dominioAnterior` | o objeto declarado |
| slug curado sem `dominioAnterior` | `null` |
| slug desconhecido | `null` |

Existe para um consumidor só: o autopublishing, cuja lista de projetos é própria e não tem o campo.

---

## C3 — `mesclarPorCaminho(respostas, hosts) → PáginaMesclada[]`

`lib/gsc-hosts.mjs` · **novo, módulo PURO** (zero imports, sem `process.env`, sem rede) — Princípio
III, e é o que permite testar as bordas da mescla sem gastar requisição (D3).

```js
/**
 * @param {{host: string, rows: {keys: string[], clicks: number, impressions: number, position: number}[]}[]} respostas
 * @param {string[]} hosts declarados, em ordem — `hosts[0]` assina a URL canônica
 * @returns {{query?: string, page: string, caminho: string, cliques: number,
 *            impressoes: number, posicao: number|null, hosts: string[]}[]}
 */
```

**Contrato**

| # | Regra | FR |
|---|---|---|
| 1 | Chave = `pathname + search` da URL em `keys`, mais `query` quando a dimensão existir | FR-002 |
| 2 | `cliques` e `impressoes` somados entre hosts | FR-002 |
| 3 | `posicao` = `Σ(posição × impressões) / Σ(impressões)`; `null` quando `Σ impressões = 0` | FR-002 |
| 4 | `page` reconstruída como `https://${hosts[0]}${caminho}` | FR-003 |
| 5 | Linha com `query` ou `page` vazio é descartada | — |
| 6 | URL que não parseia é descartada, nunca vira chave crua | — |
| 7 | Barra final e querystring preservadas: `/x` ≠ `/x/`, `/x?p=2` ≠ `/x` | D4 |
| 8 | `respostas` com um host só devolve as mesmas linhas de hoje, com `page` idêntica | FR-006 |
| 9 | `hosts` por linha lista só quem contribuiu com ela | FR-008 |

**Não faz**: rede, ordenação por relevância, corte por posição, régua de benchmark. Quem ordena e
julga é `lib/kpis-busca.mjs`, que não é tocado.

---

## C4 — As três leituras de `lib/gsc.ts`

As três trocam `siteUrl: string` por `hosts: string[]` e passam a devolver `E5 — Leitura somada`.
A resolução de propriedade, o filtro de host, o teto e o contrato de falha ficam num único caminho
interno compartilhado (FR-007) — hoje são três cópias.

### C4.1 `gscConsultas(hosts, janela, options?)`

Consumidor: `app/okr/[slug]/aquisicao/page.tsx` (ramo CLIQUE do board).
Dimensões `["query","page"]`, `rowLimit` 25.000, uma janela.

```ts
{ linhas: LinhaBusca[], hosts: string[], encerrados: string[], truncado: boolean }
| { erro: string } | null
```

`LinhaBusca` mantém os nomes de hoje (`query`, `page`, `cliques`, `impressoes`, `posicao`) e ganha
`hosts`. **Campo removido: nenhum** — o bloco da tela continua lendo o que lia.

### C4.2 `gscPaginas(hosts, janela)`

Consumidor: `lib/okr-coleta.ts` → `lib/ficha-dados.ts` → `camadaDeEntrega()`.
Dimensão `["page"]`, `rowLimit` 1.000, uma janela.

```ts
{ paginas: { pagina, impressoes, cliques, posicao, hosts }[], hosts, encerrados, truncado }
| { erro: string } | null
```

> ⚠️ `rowLimit` 1.000 aqui, 25.000 nas outras duas. O teto do truncamento é o teto DESTA
> requisição, não a constante das outras — comparar contra 25.000 faria a flag nunca disparar na
> ficha (D6 aplicada ao valor certo).

### C4.3 `gscQueryPages(hosts, options?)`

Consumidor: `lib/autopublish.ts` (decisão de pauta). Duas janelas, dimensões `["query","page"]`.
Mantém `strict`, `sleep`, as 3 tentativas e o `mergeGscWindows` depois da soma por host — a ordem
importa: **soma os hosts primeiro, compara as janelas depois**, senão a mesma página entra duas
vezes no par `current`/`previous`.

| Entrada | `strict: false` | `strict: true` |
|---|---|---|
| host sem propriedade (todos) | `[]` | lança `gsc-unavailable` |
| falha transitória | `[]` após 3 tentativas | lança `gsc-unavailable` após 3 tentativas |
| **`hosts` vazio** | `[]` | **lança** — nunca `[]` (D2) |

> ⚠️ A última linha é a armadilha: `[]` em `strict` faz toda pauta virar `new` e o robô publica uma
> segunda página para uma URL que já ranqueia. É o defeito que o `strict` existe para impedir, e
> uma lista de hosts vazia entraria por essa porta.

---

## C5 — Contrato de falha, comum às três (FR-004, D5)

| Situação | Retorno | Tela |
|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` ausente | `null` | como hoje |
| `hosts` vazio | `null` | como hoje |
| todos os hosts sem propriedade | `null` + `encerrados` cheio | "sem propriedade no GSC" |
| **um** host sem propriedade | leitura normal dos vivos, host em `encerrados` | soma publicada, host nomeado |
| **um** host falha na requisição | `{ erro: "<host>: <mensagem>" }` | **nada do bloco é publicado**; host nomeado |

`erro` COMEÇA com o host e a mensagem é truncada em 60 caracteres, como no resto do arquivo. Sem o
host, um `{erro}` de uma leitura de dois hosts não diz onde ir.

**Proibido**: publicar soma parcial. Um total que encolhe sem explicação lê como queda de tráfego.

---

## C6 — Contrato de tela (FR-008)

A aba de aquisição publica, junto do bloco de consultas, **quais hosts compuseram os números** —
não só o total. Um número somado sem a assinatura de quem o compôs não é conferível.

| Estado | O que a tela diz |
|---|---|
| um host | nada de novo (FR-006: a tela de hoje) |
| dois ou mais | os hosts somados, nomeados |
| algum em `encerrados` | o host, e que ele não tem mais propriedade no Search Console |
| `truncado` | a ressalva que já existe, mais o fato de o teto ser por propriedade |

A ressalva `piso, não total` (omissão das consultas raras na dimensão `query`) **continua** — somar
hosts não conserta a omissão, e retirá-la faria o piso ser publicado como total (D9).
