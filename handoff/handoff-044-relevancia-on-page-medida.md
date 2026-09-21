# Handoff — 044 · Relevância On-Page medida no board (canibalização, cadência, cobertura semântica)

**Data:** 21/09/2026 · **Estado:** conferido no dev server (lista servidor + mapa expandido + painel);
produção a conferir depois do push (~15 min).

## O que mudou

As folhas do ramo POSIÇÃO MÉDIA › `3. KPIs de Relevância On-Page e Cobertura de Entidades` abrem com
leitura própria. O mapa passa de 18 para 20 folhas `-medido`. **Nenhuma requisição nova:** a
canibalização lê as linhas consulta×página já canonizadas (`linhasDoTermo`, 040) e a cadência lê a
corrida de página (024).

| Onde | Mudança |
|---|---|
| `lib/kpis-busca.mjs` | `canibalizacaoPorPagina()` nova e pura: conta PÁGINAS cuja primária (`termoPrincipal`) é disputada, que é a unidade da meta do board. |
| `app/gsc/mapa/page.tsx` | Bloco 044: nós em Canibalização e Cadência, e o nó "∅ sem coletor" na Cobertura Semântica. |
| `lib/gsc-delta.mjs` | `MEDIDO_POR.canibalizacao` credita as duas funções, primeiro a que abre o nó. |
| `app/okr/[slug]/aquisicao/page.tsx` | A frase "N passaram de 12 meses" era falsa desde 19/09 (o prazo é 6 **ou** 12 por intenção). |
| `test/` | +1 teste (1.197 no total). |

## O número (Atma, janela 22/08 → 18/09, corrida de 21/09)

| Folha | Leitura | Meta do board |
|---|---|---|
| Canibalização interna | **5 de 10** páginas com a palavra-chave primária disputada · **73** consultas em 2+ URLs (33,1% das impressões não-marca) | 0 páginas |
| Cadência de atualização | **40%** · 4 de 10 páginas com data dentro do prazo · 6 vencidas · 20 sem data | auditoria a cada 6–12 meses |
| Cobertura semântica | **∅ sem coletor** | 100% das sub-intenções do Top 3 |

## Achados

1. **O post de preço tira a página de preço das consultas de preço.** O par que mais se repete (28 das 73
   consultas) é `/blog/quanto-custa-alinhador-invisivel` à frente de `/pacientes/precos`. Em «alinhador
   invisível preço» (349 impressões) o post está na 4,6 e a página de preço na 56,3. `/pacientes/precos`
   só recebeu impressão pelo **domínio anterior**: pelo usealigner.com, nenhuma na janela (ela segue
   "Descoberta, mas não indexada", ver 043).
2. **O mesmo post está vencido:** intenção `ambos` (prazo de 6 meses), `dateModified` 2025-10-20.
3. **Quatro posts carimbam a mesma data (2025-01-20)** e estão vencidos pelo prazo de 12 meses.
4. **20 das 30 páginas não declaram data**, inclusive `/pacientes/precos`. Ficam fora do numerador e do
   denominador (sem data declarada não é desatualizada).

## Declarado, não consertado

- O nó "∅ sem coletor" da reescrita do título (040) tem id `reescritaTitulo-medido` e **conta** em
  "folhas com leitura própria". O da cobertura semântica (`coberturaSemantica-sem-coletor`) não conta.
  Quando alguém decidir, as duas folhas devem ter a mesma regra.
- A cobertura semântica precisaria de um coletor novo: SERP por consulta primária, as 3 páginas do topo
  e extração de entidades. Não tem fonte no hub e não é dado parado no Search Console.

## Pendências (humanas, no site, não no hub)

- Decidir qual URL responde às consultas de preço: a página de preço (canonical ou 301 do post, ou link
  do post para ela) ou o post. Enquanto `/pacientes/precos` não for indexada no domínio novo, a
  pergunta nem chega a ser testada.
- Revisar e recarimbar os 6 posts vencidos, começando pelo de preço.
