# Handoff — 047 · Palavras-Chave no Top 20 medidas no board

**Data:** 21/09/2026 · **Estado:** conferido no dev server (canvas a 1440px, nó + contador, console limpo);
produção a conferir depois do push (~1 a 15 min, ler a TELA duas vezes).

## O que mudou

A folha IMPRESSÕES › `2. KPI de Limiar: Volume de Palavras-Chave no Top 20 (Posições 1 a 20)` abre com o nó
`top20-medido`. O mapa passa de 23 para 24 folhas `-medido`. Zero requisição nova: as duas leituras que o nó
consome (consulta×página e por termo) já estavam em memória para as folhas 034 e 046.

| Onde | Mudança |
|---|---|
| `lib/kpis-busca.mjs` | `penetracaoNoInventario(linhas, inventario, ate)`: a conta da penetração com a fronteira como parâmetro. `penetracaoNoTop3` virou um wrapper dela (`ate = 3`). |
| `app/gsc/mapa/page.tsx` | Bloco 047 depois do bloco 046. |
| `test/kpis-busca.test.mjs` | Fronteira 20,0 entra e 20,01 não entra; o termo ausente conta no denominador. |

## O número (Atma, janela 22/08 → 18/09)

**755 consultas entre as posições 1,0 e 20,0 (piso) · 50,1% do inventário (363 de 725 termos).**
A meta do board é 60% do catálogo dentro do Top 20. Ela não tem régua (`balizador: recusa`), então o nó não
leva glifo de veredito.

- 755 das 887 consultas lidas (85%) têm alguma página no Top 20. Na dimensão `query` sozinha, o número é 751.
- 312 das 755 tiveram uma única impressão.
- 752 aparecem por `atma.roilabs.com.br` e só 8 por `usealigner.com`.
- Faixas, na leitura por termo: 301 consultas em 1–3, 350 em 4–10 e 100 em 11–20. Outras 136 ficam acima de 20.
- Inventário: 453 dos 725 termos tiveram impressão. Desses, 363 estão no Top 20 e 90 estão fora. Os maiores
  fora do Top 20 são `alinhadores invisiveis preco` (23,7), `alinhadores invisíveis` (22,2), `aparelhos alinhadores`
  (34,9), `alinhadores ortodônticos` (30,7) e `alinhadores transparentes` (26,7).

Série do inventário no Top 20, em janelas de 28 dias (medida à parte, fora do nó):

| fecha em | consultas no Top 20 | inventário no Top 20 |
|---|---:|---:|
| 06/02 | 783 | 60,3% |
| 06/03 | 1.099 | 74,8% |
| 03/04 | 1.711 | **87,7%** |
| 01/05 | 1.836 | 85,7% |
| 29/05 | 1.262 | 78,1% |
| 26/06 | 652 | 56,4% |
| 24/07 | 6 | 0,6% (desindexação) |
| 21/08 | 760 | 53,0% |
| 18/09 | 755 | 50,1% |

⚠️ Todas essas janelas ficam dentro dos 8 meses que derivaram o inventário (17/01 → 17/09). Um termo entrou no
inventário por ter tido ≥ 20 impressões, e a maioria delas veio dos meses fortes. Por isso o pico de março e abril
sai inflado pela seleção (a lição da 034). A série mostra a forma da curva, mas não serve para medir "quanto
caímos desde o pico".

## Decisões

- **Absoluto por consulta×página.** É a mesma função (`noTop20`) e a mesma leitura da aba de aquisição, então as
  duas telas publicam 755. O 751 da dimensão `query` fica na nota.
- **Fração pela leitura por termo, contra o inventário da 034.** É a mesma base da penetração no Top 3 (10,2%).
  Por isso as duas frações podem ser comparadas: metade do catálogo está no Top 20 e um décimo está no Top 3.
- **A fração é piso.** 272 termos do inventário não tiveram impressão na janela. Eles contam no denominador, mas
  não podem contar no numerador.

## Pendente

- Irmãs do ramo IMPRESSÕES sem leitura: Query-to-Page, Active Index Ratio, TAM (sem coletor).
