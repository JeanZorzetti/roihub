# Handoff — 048 · Query-to-Page Ratio medido no board

**Data:** 21/09/2026 · **Estado:** conferido no dev server (canvas a 1440px, nó + contador, console limpo);
produção a conferir depois do push (~1 a 15 min, ler a TELA duas vezes).

## O que mudou

A folha IMPRESSÕES › `3. KPI de Densidade: Média de Consultas por Página (Query-to-Page Ratio)` abre com o nó
`queryToPage-medido`. O mapa passa de 24 para 25 folhas `-medido`. Zero requisição nova: o numerador é a leitura
consulta×página da 046 e o denominador é a apuração de indexação da 043, as duas já em memória.

| Onde | Mudança |
|---|---|
| `app/gsc/mapa/page.tsx` | Bloco 048 depois do bloco 047. Usa `queryToPageRatio` e `urlsComImpressao`, que já existiam. |
| `lib/` | Nada. `queryToPageRatio` é o mesmo que a aba de aquisição publica desde a 022. |

## O número (Atma, janela 22/08 → 18/09)

**49,3 consultas por URL indexada (piso) · 887 ÷ 18 · 814 delas numa única URL.**
As metas do board são 30–80 para blog e 10–25 para landing. Não há régua (`balizador: recusa`), então o nó não
leva glifo de veredito.

- A média cai dentro da faixa de blog, mas quem a sustenta é **um post**: `/blog/quanto-custa-alinhador-invisivel`
  tem 814 das 887 consultas, 740 delas exclusivas. 814 vêm pelo domínio antigo e só 8 pelo `usealigner.com`.
- Sem esse post sobram 147 consultas para as outras 13 URLs com consulta nomeada. Dividindo pelas 17 indexadas
  restantes, dá **8,6**, abaixo das duas faixas. A URL Inspection de 21/09 confirma que o post está `Submitted and
  indexed`.
- Mediana de **4** entre as 14 URLs com consulta nomeada. Das 29 URLs com impressão, 15 não têm nenhuma consulta
  nomeada (tudo o que elas recebem o Search Console omite).
- Contra as 29 URLs com impressão em vez das 18 indexadas, a razão seria 30,6.
- `/pacientes/precos` soma 33 consultas pelo domínio antigo e continua `Discovered - currently not indexed` no novo.

## Decisões

- **Mesma função e mesmo denominador da aba de aquisição.** Sem denominador quando a corrida amostrou o sitemap,
  igual à guarda de `denomIdx`. As duas telas publicam 49,3.
- **O topo abre pela concentração junto com a média.** Só a média leria como "dentro da faixa de blog", e a média
  descreve um post, não o site.
- **As pontas não são o mesmo conjunto de URLs.** O numerador conta consulta de qualquer URL que o Google exibiu,
  pelos dois domínios. O denominador é o índice do sitemap novo. A nota diz isso, mas a função não muda: a fórmula
  do board é literal.
- **Por tipo de página não dá.** `hub_indexacao` grava o agregado, sem o estado por URL, então o denominador não
  se separa entre blog e landing.

## Pendente

- Irmãs do ramo IMPRESSÕES sem leitura: Active Index Ratio e TAM (sem coletor).
