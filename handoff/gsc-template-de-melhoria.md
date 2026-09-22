# Template de melhoria do GSC: os 18 KPIs do mapa, em "se… então"

**Documento reaplicável, vale para qualquer projeto de `/gsc/mapa/{slug}`.** Cada linha diz: *se a
folha estiver abaixo de X, faça Y*. Os limiares vêm do código (`lib/gsc-delta.mjs#CATALOGO`,
`lib/kpis-busca.mjs#BENCHMARK`, `lib/board-gsc.mjs#BOARD`), não de memória. Quando o board e o hub
divergem, a tabela usa o número do hub e declara o do board.

---

## 0. Antes de julgar qualquer linha: o recorte

Nenhuma regra abaixo vale se o número estiver contaminado. Confira nesta ordem:

| Se… | Então |
|---|---|
| A leitura mistura marca e não-marca | Julgue só a não-marca. Marca forte bate meta de CTR e de Top 3 sem mérito de SEO |
| Parte grande das impressões vem de país fora do mercado (ex.: Sirius, 64% EUA com 0 clique) | Separe o país antes de julgar CTR. CTR baixo ali é público errado, não snippet ruim. Decida se o termo fica no inventário |
| A janela atravessa migração, troca de domínio ou desindexação | Não compare com o período anterior. Anote a data e espere a série se refazer |
| A amostra é pequena (o hub mostra o intervalo de confiança) | Não julgue. Intervalo que cruza a régua não é "abaixo" |
| Você mexeu na página há menos de 28 dias | Não julgue de novo. Resultado do Google tem atraso de dias a meses |

---

## 1. Como ler as tabelas

- **Régua** ◆ = limiar com fonte publicada; o hub emite veredito com ele.
  ◇ = meta do board, sem fonte. Serve como gatilho de trabalho, não como veredito.
  ▣ = norma binária (tem ou não tem).
- **Classe** (`CLASSES` em `gsc-delta.mjs`):
  **resultado** é a reação do Google e não se move direto: a ação dele aponta para uma alavanca (→).
  **alavanca** a equipe move direto.
  **higiene** é limiar: abaixo atrapalha, acima dele não se espera ganho. Passou, pare.
- **Crítico** marca a faixa que entra na semana antes de todo o resto.

---

## 2. Ordem de ataque quando várias regras disparam

Consertar CTR de página fora do índice rende zero. Ataque de cima para baixo:

1. **PM2 Index Health**: página fora do índice zera tudo abaixo dela.
2. **PM1 Técnico**, só o que estiver reprovado (é higiene).
3. **PM3 Canibalização** e **CTR5 Intenção**: página errada para o termo.
4. **PM3 Cobertura** e **PM4 Links internos**: empurrar posição.
5. **CTR3 Schema** e **CTR4 Título**: snippet.
6. **CL, IM, CTR1, CTR2** são leitura de resultado. Quando disparam, a ação é a alavanca que a linha aponta.

---

## 3. Ramo CLIQUE

| KPI / folha | Se… | Então | Régua | Classe |
|---|---|---|---|---|
| **CL1 CTR relativo por posição** | CTR da consulta/URL abaixo do piso da posição: P1 **25%**, P2 **13%**, P3 **8%**, P4–6 **4,5%**, P7–10 **2%** | Reescreva title e meta description da URL (→ CTR4, CTR5). Se o Google reescreveu o título, alinhe o title com o H1 | ◆ | resultado |
| | **Crítico:** CTR abaixo da metade do piso (ex.: posição 2 com 5%) | Reescrita do title nesta semana | ◆ | |
| | Posição 11–20 | Não julgue CTR: não há piso com fonte na página 2. Vá para IM2 | — | |
| **CL2 Penetração no Top 3** | Menos de **20%** do inventário em posição ≤ 3 | Pegue os termos do inventário em 4–10,9 (CL3) e aplique PM3 + PM4 neles | ◇ 20–30% | resultado |
| | **Crítico:** menos de 10% | Confira primeiro se cada termo tem UMA página dedicada. Sem página → crie. Duas páginas → PM3 canibalização | ◇ | |
| **CL3 Striking distance (4,0–10,9)** | Termo com impressão relevante nessa faixa | Na URL do termo: +links internos contextuais vindos de páginas com tráfego (PM4), seção nova para o subtema que o Top 3 cobre (PM3), termo no title/H1 (CTR4) | ◇ | resultado |
| | Menos de **15%** dos termos da faixa subiram ao Top 3 no trimestre | Revise o alvo: termo difícil demais ou página errada. Troque o termo ou a página | ◇ 15–25%/tri | |
| | Nenhum termo na faixa | O gargalo está antes: vá para IM2 (Top 20) | — | |
| **CL4 Crescimento não-marca** | MoM abaixo de **5%** (ou de **15%** em site em tração inicial) | Amplie o footprint: páginas para os clusters do inventário sem página (IM1, IM5) | ◇ 5–10%/mês | resultado |
| | **Crítico:** negativo dois meses seguidos | Trate como incidente: PM2 (desindexação?), PM3 (canibalização?), data de core update | ◇ | |

> **Checklist para auditar o GSC** é procedimento, não KPI: os três filtros dele são CL1/CTR2 (alta
> impressão com CTR baixo), CL3 (posições 4–10) e CTR3 (SERP com resumo de IA → schema).
> **Depois do clique** (clique → lead → R$) fica fora do GSC; ver `/okr/{slug}`.

---

## 4. Ramo CTR

| KPI / folha | Se… | Então | Régua | Classe |
|---|---|---|---|---|
| **CTR1 % de impressões no Top 3** | Menos de **40%** das impressões não-marca entre 1,0 e 3,9 | Não mexa no snippet: é posição. Mesma receita de CL2/CL3 | ◇ 40–50% | resultado |
| **CTR2 Conformidade com o benchmark (CTR Gap)** | URL com cliques não capturados > 0 (impressões × (piso − CTR)) | Ordene as URLs por cliques não capturados e reescreva o title das 5 primeiras da fila. Releia em 28 dias | ◆ piso de CL1 | resultado |
| | SERP com resumo de IA ou resultado rico | A meta vira ser elegível ao espaço visual: CTR3 | — | |
| ↳ **% de URLs acima do benchmark** | Menos de **75%** das URLs principais no piso | O defeito é do padrão, não da URL: revise o template de title do site/CMS | ◇ 75–80% | resultado |
| **CTR3 Dados estruturados** | Página prioritária sem schema do tipo certo (Product, Article, FAQPage, SoftwareApplication) | Adicione o JSON-LD | ▣ 100% | alavanca |
| | **Crítico:** qualquer erro crítico no relatório de Resultados Enriquecidos | Corrija antes de qualquer outra linha deste ramo | ▣ 0 erro | |
| **CTR4 Integridade do título** · largura | Title acima de **580px** | Encurte: tire sufixo de marca, ano, adjetivo | ◆ 580px | alavanca |
| | Title abaixo de 500px | Acrescente modificador de intenção ou benefício | ◇ 500px | |
| · reescrita pelo Google | O Google trocou o título na SERP | Alinhe title e H1, tire repetição e boilerplate. Não persiga os 15% do board: o melhor caso mundial medido é 39% | ◇ < 15% | resultado |
| · termo no início | Termo principal fora dos primeiros **35** caracteres | Mova o termo para o começo | ◇ 35 car. | alavanca |
| **CTR5 Alinhamento de intenção** | Página-chave sem modificador no title | Comercial: "Preço", "Planos", "Comparativo", "Grátis". Informacional: "Como", "Passo a passo", "Guia". Se usar o ano, ele entra na revisão de PM3 frescor | ▣ 100% | alavanca |
| | A SERP do termo mostra outra intenção (ex.: guia contra página de venda) | Troque a página alvo do termo. Não adianta mudar só o título | — | |

---

## 5. Ramo POSIÇÃO MÉDIA

| KPI / folha | Se… | Então | Régua | Classe |
|---|---|---|---|---|
| **PM1 Técnicas (CWV + TTFB)** · LCP | p75 acima de **2,5 s** | Imagem do hero (tamanho, formato, preload), fonte bloqueante, TTFB | ◆ web.dev | higiene |
| · INP | Acima de **200 ms** | Corte JS de terceiro e hidratação; quebre tarefa longa | ◆ | higiene |
| · CLS | Acima de **0,1** | Reserve espaço para imagem, embed e fonte | ◆ | higiene |
| · TTFB | Acima de **800 ms** (o board diz 600, sem fonte) | Cache/CDN, render estático, consulta ao banco | ◆ 800 ms | higiene |
| · Pass rate | Menos de **90%** das URLs prioritárias com status Bom | Aplique as quatro linhas acima só nas URLs prioritárias reprovadas | ◇ 90% | higiene |
| **PM2 Index Health** · indexação limpa | Menos de **95%** das URLs do sitemap indexadas | URL Inspection das não indexadas. O que não deve indexar sai do sitemap; o que deve, conserte | ◇ ≥ 95% | higiene |
| · rejeição de rastreio | **5%** ou mais em "Rastreada / Descoberta, mas não indexada" | Conteúdo raso ou duplicado: consolide (301), enriqueça ou `noindex`. Dê links internos às que ficam | ◇ < 5% | higiene |
| · profundidade | Página transacional ou pilar a mais de **4** cliques da home (board: 3) | Linke da home, do menu ou de um hub de categoria | ◇ 4 (3) | higiene |
| **PM3 Relevância on-page** · cobertura semântica | O Top 3 da SERP cobre subtema que a página não cobre | Acrescente a seção: H2 com a pergunta, resposta na primeira frase | ◇ 100% | alavanca |
| · frescor | Sem revisão há mais de **6 meses** (comercial) ou **12** (informacional) | Revise dados, preços, ano e fontes; atualize `dateModified` | ◇ política do dono | alavanca |
| · canibalização | Duas ou mais URLs alternando na mesma consulta | Escolha a canônica; 301 ou consolide a outra; aponte os links internos para a canônica; mude o termo da perdedora | ▣ 0 | alavanca |
| **PM4 Autoridade** · links internos | Página alvo com menos de **5** links contextuais de entrada (hub: 3 a 10 por 1.000 palavras) | Links de páginas com tráfego, com âncora no termo ou variação dele | ◇ 5–10 | alavanca |
| · domínios referenciadores | Menos de **3** domínios novos no trimestre | Parceria, conteúdo citável, perfis e diretórios do setor. O hub não mede: conferir no relatório de Links do GSC | ◇ +3 a +10/tri | resultado |
| · buscas de marca | Queda dois meses seguidos | É demanda de marca, não on-page: ações fora do Google (redes, e-mail, parceria) | ◇ "crescente" | resultado |

---

## 6. Ramo IMPRESSÕES

| KPI / folha | Se… | Então | Régua | Classe |
|---|---|---|---|---|
| **IM1 Footprint de consultas únicas** | Cresceu menos de **10%** no trimestre | Páginas novas para clusters sem cobertura (IM5) e subtemas nas existentes (IM3) | ◇ 10–20%/tri | resultado |
| | **Crítico:** caiu | PM2 primeiro: queda de consultas quase sempre é página saindo do índice | — | |
| **IM2 Palavras-chave no Top 20** | Menos de **60%** do inventário entre 1 e 20 | Termo sem página → crie. Termo com página em 21–50 → PM3 + PM4 nela | ◇ 60% | resultado |
| **IM3 Consultas por página** | Abaixo de **30** por URL (blog/guia) ou **10** (produto/landing) | Cubra subtemas e perguntas ("como", "quando", "preço de") e sinônimos no corpo | ◇ 30–80 / 10–25 | resultado |
| | Uma URL concentra quase tudo (Atma: 1 post = 814 de 887) | A média mente: leia sem ela antes de concluir | — | |
| **IM4 Active Index Ratio** | Menos de **70%** das URLs indexadas com ≥ 1 impressão em 28 dias | Liste as URLs sem impressão (descontando as publicadas há menos de 28 dias) e dê a elas um termo e links (PM3, PM4) | ◇ ≥ 70% | resultado |
| | **Crítico:** menos de 50% | Pode: `noindex`, 301 para a semelhante ou exclua o conteúdo morto | ◇ | |
| **IM5 Cobertura do TAM** | Menos de **60%** dos clusters de maior volume com página | Pauta pelos clusters faltantes, maior volume primeiro | ◇ 60–80% | resultado |

---

## 7. Placar semanal (4DX)

Resultado se lê a cada 28 dias. O que se conta toda semana são as alavancas, com o nome que o
catálogo já dá a cada uma (`acaoSemanal`):

| Alavanca | Conta da semana |
|---|---|
| CTR3 Schema | páginas com schema corrigido |
| CTR4 Largura | títulos encurtados |
| CTR4 Termo no início | títulos reescritos |
| CTR5 Intenção | títulos com modificador |
| PM3 Cobertura | subtemas cobertos |
| PM3 Frescor | páginas revisadas |
| PM3 Canibalização | páginas consolidadas |
| PM4 Links internos | links contextuais |
