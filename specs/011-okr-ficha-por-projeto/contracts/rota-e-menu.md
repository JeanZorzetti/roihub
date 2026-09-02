# Contrato: a rota `/okr/<slug>` e o menu da aba OKR

**Feature**: `011-okr-ficha-por-projeto`

## 1. A rota

`app/okr/[slug]/page.tsx`, genérica, endereçada pelo `slug` do card (FR-007).

| entrada | resposta |
|---|---|
| slug em `listProjects()` | **200**, sete níveis N0-N6 |
| slug fora de `listProjects()` | **404** via `notFound()` — nunca uma ficha vazia |
| slug com perfil e sem `ficha` curada | **200**, níveis normais, N0 em `não apurado: sem declaração no card` |
| slug sem perfil | **200**, sete níveis, N1-N5 em `não apurado: sem perfil declarado`, **zero** números |

A existência é conferida contra a lista **completa** (curados + repos do GitHub), não contra as
fichas curadas: os 16 projetos com perfil e sem curadoria abrem a mesma página, e isso é o resultado
correto, não defeito.

`export const dynamic = "force-dynamic"` — igual à `/okr`. Número de OKR vindo do build é número de
outra janela, e a R7 pede **uma** janela declarada para a árvore inteira. A janela (`INICIO → FIM`,
28 dias fechando em D-3) aparece escrita na tela (FR-012, SC-019).

No Next 16 `params` é `Promise`: `const { slug } = await params`.

## 2. O menu

`app/tabs.tsx`. A aba OKR passa a ser um **par**, e as outras 12 abas não mudam (FR-001).

```
[ OKR ]  [ ▾ ]          ← link (href="/okr")   +   <summary> do <details> irmão
         └─ Portfólio    ← /okr, marcado aria-current quando a rota é /okr
            Atma         ← /okr/atma, marcado aria-current quando a rota é /okr/atma
```

| requisito | como é cumprido |
|---|---|
| FR-001 — controle de expandir/recolher | `<details>` nativo, `<summary>` é o controle |
| FR-002 — `/okr` em **um** acionamento | o link OKR continua sendo link; o disclosure é irmão, não substituto |
| FR-003 — nasce **aberto** na rota OKR | `open={rota === "/okr" || rota.startsWith("/okr/")}`, decidido no servidor |
| FR-004 — sem JS de cliente, teclado, foco visível | `<details>`/`<summary>` entregam Enter, Espaço, foco e `aria-expanded` nativamente; nenhuma das 12 telas ganha `"use client"` |
| FR-004 — "Pular para o conteúdo" primeiro | o `<a class="sr-only skip">` continua **antes** do `<nav>`, intocado |
| FR-005 — zero fichas curadas | `listFichas().length === 0` → a aba OKR renderiza como link simples, sem `<details>` |

**Ordem de foco** = ordem visual: link OKR → summary → `Portfólio` → cada ficha, na ordem da
curadoria.

**Página atual**: `aria-current="page"` no item que casa a rota, e no link OKR quando a rota é
exatamente `/okr` — o mesmo padrão que `Tabs` já usa hoje.

## 3. A única mudança permitida na `/okr` (FR-006 / FR-032)

O `<h2 className="hero-name">{p.nome}</h2>` de cada card **com perfil declarado** passa a envolver um
`<Link href={"/okr/" + p.slug}>`. Continua sendo o mesmo `<h2>`, na mesma posição, com o mesmo texto.

Card **sem** perfil não ganha caminho — não há ficha a oferecer, e os sem perfil já vivem recolhidos
no `<details className="sem-site">`.

**Nada mais muda**: mesmos 40 projetos, mesma ordem, mesmas posições de ataque, mesma tabela de
degraus, mesmo bloco de projeção da 010, mesmo rodapé. A SC-001 confere por comparação do HTML
servido antes e depois.

## 4. Responsivo (SC-014)

Em **390px**, nem a barra de abas nem o menu aberto podem provocar rolagem horizontal da página. A
`.tabs` já é `flex-wrap: wrap`; a faixa do menu quebra em linhas pela mesma regra. Nenhum
`overflow-x` no `<main>` nem no `.card` — a rolagem horizontal, quando necessária, mora dentro de
`.tabela-rolavel`, que é focável e nomeada (o conserto de WCAG 2.1.1 que a 009 já fez).

## 5. Proibições

- Nenhum client component novo, nenhum `"use client"` em `app/tabs.tsx`.
- Nenhuma rota de API, nenhum cron, nenhum `maxDuration` (Princípio IV).
- Nenhuma escrita: a ficha não tem `<form>`, `action` nem server action.
