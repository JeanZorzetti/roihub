# Estudo de fontes — balizador GSC (board Whimsical → regime da RÉGUA)

**Levantado em 19/09/2026.** Fonte do board: `https://whimsical.com/v-rtice3/okr-Saw2eoSKZDPLJAk6xeDBuS`
Regime escolhido: **A** — as linhas entram sob as regras de `lib/benchmark.mjs` (`media`/`elite`/`fonte`/`url`/`acessadoEm`/`recorte` obrigatórios, ou `Recusa` com motivo próprio).

Nenhuma das folhas do board ficou de fora. Cada uma está abaixo como `LINHA`, `RECUSA` ou `PROCEDIMENTO`.

---

## 0. Veredito

⚠️ **O placar abaixo foi escrito à mão e estava errado até 19/09/2026.** Dizia "26 folhas, 4 com
régua". São **32 folhas** — o board decompõe em mais itens do que a leitura visual contou — e
**7 têm régua**, porque LCP, INP e CLS são três entradas de catálogo e não uma. O erro sobreviveu a
várias revisões deste documento porque prosa não tem como reclamar.

O número que vale é o de `/gsc`, **contado do catálogo a cada render**. Este aqui é cópia datada:

| natureza | quantas | o que significa |
|---|---|---|
| `régua` | **7** | fonte, url, data de acesso e recorte declarados |
| `recusa` | **18** | o número existe e ninguém publica a faixa dele |
| `sem coletor` | **3** | falta ligar a fonte, não procurar estudo |
| `norma` | **3** | binário: não existe quartil de "válido ou inválido" |
| `procedimento` | **1** | não é KPI |

**Três números do board não sobrevivem ao contato com a fonte primária.** Estão na §1 porque não são "linha sem fonte" — são linha *contra* a fonte.

---

## 0.1 CORREÇÃO — cinco itens estavam com o rótulo errado

**Registrada em 19/09/2026, no mesmo dia.** O levantamento original leu onze arquivos de `lib/` e
**não leu `lib/grafo.mjs`**. Consequência: cinco folhas foram descritas como "sem coletor" ou
"meio-vivas" quando já eram medidas. Seguir o texto original mandaria ligar fonte já ligada.

| Folha | Dizia | É |
|---|---|---|
| Profundidade de clique | sem coletor | `grafo.mjs#profundidades` — falta **régua**, não coletor |
| Densidade de links internos | sem coletor | `grafo.mjs#densidades` — idem |
| Cobertura de Schema | meio-viva (extrai, não valida) | `grafo.mjs#taxaCobertura` — medida |
| Cadência / frescor | medida | certo, mas o limite `CADENCIA_MESES = 12` é editorial |
| Integridade do título | medida | certo, mas `TITULO_PX_MIN = 500` e `TERMO_ATE = 35` são editoriais |

**As recusas continuam válidas.** O que muda é o conserto: não é ligar fonte, é aceitar que
ninguém publica régua para esses KPIs. A natureza `semColetor` ficou reservada a três folhas —
`referringDomains`, `rejeicaoRastreio` e `tamBusca` — e `test/gsc-delta.test.mjs` agora reprova
qualquer folha que alegue ausência de coletor estando em `MEDIDO_POR`. O erro não volta em silêncio.

### Divergência board × código que ninguém decidiu

| | Board | `lib/grafo.mjs` |
|---|---|---|
| Profundidade de clique | ≤ 3 | `PROFUNDIDADE_MAX = 4` |
| Links internos contextuais | 5 a 10 | `LINKS_CONTEXTUAIS_MIN = 5` |
| Cadência de atualização | 6 a 12 meses | `CADENCIA_MESES = 12` |

Nenhum dos seis números tem fonte. Estão listados em `EDITORIAIS` no `lib/gsc-delta.mjs` para que a
tela possa marcá-los como editoriais em vez de exibi-los com a mesma tipografia de `LCP 2,5s` — e
para que mudá-los seja decisão consciente, não ajuste fino de constante.

---

## 1. Contradições — prioridade de correção

### 1.1 TTFB: o board dizia 600ms; o Google diz 800ms — **RESOLVIDO em 19/09/2026**

- Board: `TTFB ≤ 600ms, idealmente < 300ms em conexões locais`
- `lib/crux.mjs`: era `{ id: "ttfb", limite: 600, ideal: 300 }`
- Fonte oficial (`https://web.dev/articles/ttfb`, atualizada 18/11/2025, acessada 19/09/2026):
  **bom ≤ 0,8s · ruim > 1,8s · medido no percentil 75.**

Dois agravantes, ambos na própria página do Google:

1. TTFB **não é** Core Web Vital. O texto diz que não é necessário bater o limiar de TTFB desde que isso não atrapalhe as métricas que contam.
2. O limiar é declarado como *rough guide* — um site renderizado no servidor pode ter TTFB maior e LCP melhor que um SPA.

**Decisão do dono em 19/09/2026: 800ms.** Entre 600 e 800ms a tela reprovava o que a fonte oficial aprova — falso-negativo, não rigor. `lib/crux.mjs` foi alterado, `test/crux.test.mjs` acompanhou (o limite inclusivo passou a ser 800/801), e o TTFB saiu da lista de recusas e entrou como **`LINHA`** com fonte própria — `web.dev/articles/ttfb`, separada da página dos três vitais, porque a fonte classifica as duas coisas de modo diferente e herdar o recorte seria emprestar autoridade que ela mesma recusou.

⚠️ O `ideal: 300` **fica e continua sem fonte**: o Google não publica alvo abaixo do limiar. Segue listado em `EDITORIAIS`, e não emite veredito — aparece ao lado do limite, nunca no lugar dele (FR-007).

### 1.2 Reescrita de título: a meta do board é aritmeticamente inatingível

- Board: `Taxa de reescrita pelo Google: menor que 15% dos títulos`
- Zyppy (Cyrus Shepard), 80.959 títulos em 2.370 sites — `https://zyppy.com/seo/google-title-rewrite-study/`:
  **61,6% de reescrita como linha de base.**
  Melhor faixa observada: **39%–42%**, em títulos de 51–60 caracteres.
  Títulos > 70 caracteres: 99,9%. Títulos de 1–5 caracteres: 96,6%.
- Estudos independentes convergem: Dr. Pete Meyers (Moz) ≈ 83%; Alexis Rylko ≈ 40% contando só reescritas grandes; Portent ≈ 63%.
- Reportagens de Q1/2025 citam Zyppy em **76%**, ou seja, a tendência é de alta.

Nenhum site do planeta opera a 15%. O piso conhecido é ~39%, e só se todo o inventário estiver na faixa de caracteres ideal. Uma meta abaixo do melhor caso mundial é uma meta que só produz vermelho permanente.

### 1.3 CTR por posição: o número depende mais da SERP do que da posição

- Board: `Posição 1 > 30% (ou > 50% para termos de marca)`
- Os estudos divergem por um fator de quase 5× **na mesma posição**:

| Estudo | Posição 1 | Por que diverge |
|---|---|---|
| First Page Sage (2026) | 39,8% | filtra SERPs limpas |
| SISTRIX (80M keywords, mobile) | 28,5% | inclui composições variadas |
| Backlinko (4M keywords) | 27,6% | clickstream |
| seoClarity (750bi impressões) | 8,17% | inclui toda SERP, com anúncios e AIO |

A própria SISTRIX mede a posição 1 variando de **13,7% a 46,9%** conforme o layout da página. Com AI Overview presente, a posição 1 cai de 27% para 11% (amostra alemã, fev/2026).

O `> 30%` do board é defensável **só** para SERP limpa. Como régua geral, é otimista.

---

## 2. As 4 linhas aprovadas

### 2.1 CTR por posição — ramo CTR (CTR Gap)

```
faixa por posição, media…elite (SISTRIX…First Page Sage)
  pos 1 ....... 28,5% … 39,8%
  pos 2 ....... 15,7% … 18,7%
  pos 3 ....... 10,2% … 11,0%   ⚠️ faixa invertida entre fontes — ver nota
  pos 4-6 .....  4,4% …  7,2%
  pos 7-10 ....  1,6% …  3,0%
```

- `fonte`: First Page Sage — meta-análise · `url`: https://firstpagesage.com/reports/google-click-through-rates-ctrs-by-ranking-position/ · última atualização declarada 23/12/2025
- `fonte`: SISTRIX — >80 milhões de keywords, resultados móveis · `url`: https://www.sistrix.com/blog/why-almost-everything-you-knew-about-google-ctr-is-no-longer-valid/
- `acessadoEm`: 2026-09-19
- `recorte`: **EUA e Europa · SERP majoritariamente limpa · sem segmentação por vertical.** Não há estudo público de CTR por posição para o Brasil nem para odontologia/saúde.

**Nota da faixa invertida (pos 3):** SISTRIX (11,0%) fica *acima* de First Page Sage (10,2%). A faixa não é monotônica entre fontes, e isso não é erro de transcrição — é metodologia diferente. Escrever `10,2…11,0` preserva o fato; escrever um ponto único esconderia que as duas melhores fontes discordam na ordem.

**Relação com o `BENCHMARK` de `lib/kpis-busca.mjs`** (hoje: 25% / 13% / 8% / 4,5% / 2%, sem campo `fonte`): os valores atuais funcionam como **piso** e ficam abaixo de toda a faixa levantada. Sugestão: mantê-los como piso, adicionar o teto, e migrar a tabela para o formato de `Linha` — hoje ela é a única régua do repo sem fonte, com o comentário `/** direto do board */` no lugar onde a trava 4 exige uma URL.

### 2.2, 2.3, 2.4 — Core Web Vitals (LCP, INP, CLS)

```
  LCP ... ≤ 2,5s   (p75)
  INP ... ≤ 200ms  (p75)
  CLS ... ≤ 0,1    (p75)
```

- `fonte`: Google / web.dev — definição oficial dos Core Web Vitals
- `url`: https://web.dev/articles/vitals · `acessadoEm`: 2026-09-19
- `recorte`: dados de campo (CrUX), percentil 75 de carregamentos de página, por URL

Já implementado corretamente em `lib/crux.mjs`. **Só falta o campo `fonte`.**

⚠️ A meta do board `90% das URLs prioritárias com status "Bom"` **não** acompanha: é `Recusa` (item 11b). O critério do Google é p75 por URL, não percentual de URLs aprovadas. São duas agregações diferentes e a segunda não tem fonte.

### 2.5 Truncamento de título por largura

- Board: `100% dos títulos entre 500px e 580px`
- O Google trunca por **largura em pixels**, não por contagem de caracteres — confirmado. O ponto de corte é reportado entre **~580px e ~650px** conforme dispositivo e fonte de medição.
- `recorte`: desktop; móvel costuma comportar um pouco mais.

O limite superior do board (580px) é **conservador e defensável**. O limite inferior (500px) não tem fonte — é preferência editorial. Entra como linha só o teto; o piso vira nota.

`lib/pagina.mjs` já mede isso (`larguraDoTitulo`, método `arial-20px-tabela`). O método está declarado, que é o que importa.

---

## 3. As 21 recusas — motivo individual

A regra de `benchmark.mjs` é explícita: três degraus não podem devolver a mesma frase por três razões diferentes. Cada recusa abaixo tem o motivo *dela*.

### Ramo CLIQUE

**2. Penetração no Top 3 (20–30% do inventário)** — `recusa`
Inventário de palavras-chave é definido por quem mede. Dois sites do mesmo porte com listas diferentes produzem percentuais incomparáveis. Nenhuma amostra de mercado publica essa distribuição porque não existe denominador comum.

**3. Striking Distance — conversão de 15–25% para o Top 3** — `recusa`
A taxa de promoção depende da dificuldade do termo e do esforço aplicado. Nenhum estudo público controla essas duas variáveis; sem controle, a faixa seria a média de esforços desconhecidos.

**4. Crescimento de impressões não-marca (5–10% ao mês)** — `recusa`
Taxa de crescimento é função da base, não do mercado. Site com 1.000 impressões e site com 1 milhão não compartilham faixa. Além disso é **previsão**, e a R6 já a recusa por natureza.

**5. Checklist para auditar o GSC** — `procedimento`
Não é KPI: são três instruções de trabalho. Vai para a tela como texto de apoio, nunca como linha com veredito.

### Ramo CTR

**6. % de impressões concentradas no Top 3 (40–50%)** — `recusa`
Mesma objeção do item 2, com um agravante: mede concentração de impressões, que depende do mix de termos de marca. Um site com marca forte bate a meta sem nenhum mérito de SEO.

**7b. Conformidade com o benchmark (75–80% das URLs)** — `recusa`
O benchmark em si entra (§2.1). A meta de *quantas* URLs devem superá-lo não é observável em amostra externa — exige acesso ao GSC de terceiros, que ninguém publica.

**8. Cobertura de dados estruturados (100%, 0 erros)** — `recusa`
100% não é benchmark, é norma binária. Não existe `media…elite` para "válido ou inválido". Vira validador (`blocosJsonLd` + validação de sintaxe), não linha de régua.

**9b. Reescrita de título < 15%** — `recusa por contradição` · ver §1.2
Fontes descartadas e por quê:
- Zyppy (61,6%) — **não descartada**, é a régua real. Descartada foi a meta do board.
- Q1/2025 em 76% — citada em segunda mão, sem acesso ao relatório primário; não entra como linha.

**9c. Termo de busca nos primeiros 35 caracteres do título** — `recusa`
Número sem origem. O estudo Zyppy mede posição relativa e correspondência com H1, nunca posição em caracteres. Medem coisas diferentes.

**10. Alinhamento de intenção (100% das páginas-chave)** — `recusa`
Norma binária, não faixa. `lib/pagina.mjs` já detecta modificadores; o veredito é "tem / não tem", sem régua de mercado por trás.

### Ramo POSIÇÃO MÉDIA

**11b. 90% das URLs com status "Bom" em CWV** — `recusa`
Agregação inventada. O Google define p75 por URL; "percentual de URLs aprovadas" é outra métrica, sem limiar publicado.

**13. Taxa de indexação limpa (≥ 95%)** — `recusa`
O denominador é "URLs submetidas via sitemap", que é escolha de quem monta o sitemap. Quem submete só o que já indexa bate 100% sem fazer nada.

**14. Rejeição de rastreio (< 5%)** — `recusa` + **sem coletor**
Sem fonte publicada, e o repo não lê o relatório de cobertura do GSC. Balizador morto duas vezes.

**15. Profundidade de clique (100% das transacionais em ≤ 3 cliques)** — `recusa`
A **direção** está documentada (Botify, OnCrawl e declarações do John Mueller: mais fundo → menos rastreio → menos tráfego). A **faixa** não. O número 3 vem da documentação de ajuda da OnCrawl como heurística de produto, sem distribuição por trás. Direção sem faixa não vira régua.
**JÁ É MEDIDA** por `lib/grafo.mjs#profundidades` (ver §0.1) — e o código usa 4 onde o board diz 3.

**16. Cobertura semântica / entidades (100% das sub-intenções)** — `recusa`
"Sub-intenção mandatória" não tem definição operacional. Sem definição, não há o que medir nem contra o que comparar.

**17. Frescor de conteúdo (auditoria a cada 6–12 meses)** — `recusa`
Cadência de revisão depende da volatilidade do tema. Nenhum estudo público estabelece faixa. `dataDeclarada` mede a idade; a idade aceitável é decisão editorial, não régua de mercado.

**18. Canibalização (0 páginas)** — `recusa`
Norma binária. Já implementado como detector em `canibalizacao()`; zero não é elite, é ausência de defeito.

**19. Densidade de links internos (5–10 contextuais)** — `recusa por recorte`
Este é o caso-armadilha que `benchmark.mjs` descreve na documentação. O maior estudo existente é o da Zyppy — **23 milhões de links internos em 1.800 sites** — e ele mede **diversidade de texto-âncora**, não contagem de links. Os autores declaram explicitamente que é correlação, não causa.
É o mesmo erro do InfluxMD × Henry Schein One: fonte sólida medindo o degrau vizinho. Usar esse estudo para justificar "5 a 10 links" seria citar dado real para sustentar número inventado — a pior categoria de falsa autoridade, porque a URL confere.
**JÁ É MEDIDA** por `lib/grafo.mjs#densidades` (ver §0.1); o `LINKS_CONTEXTUAIS_MIN = 5` é editorial.

**20. Velocidade de domínios referenciadores (+3 a +10 por trimestre)** — `recusa` + **sem coletor**
Não há fonte pública de faixa, e o repo não tem nenhuma origem de dado de backlink. Nem balizador, nem lado real.

**21. Proporção de buscas de marca (crescente)** — `recusa`
"Crescente" é direção, não faixa. `razaoDeMarca()` e `crescimentoNaoMarca()` já medem; o que falta é contra o que comparar, e não existe.

### Ramo IMPRESSÕES

**22. Consultas únicas (+10–20% ao trimestre)** — `recusa`
Função de base, igual ao item 4. Um site novo cresce 200% e um maduro cresce 3%, e os dois podem estar indo bem.

**23. Palavras-chave no Top 20 (60% do catálogo)** — `recusa`
"Catálogo" é definido por quem mede. Mesma objeção estrutural do item 2.

**24. Consultas por página (artigo 30–80, produto 10–25)** — `recusa`
Sem fonte. A razão depende de quantas URLs estão indexadas e do tamanho do nicho — as duas pontas da divisão variam junto, o que torna a faixa instável mesmo dentro de um único site.

**25. Active Index Ratio (≥ 70%)** — `recusa`
Sem fonte. O número muda com a idade do site: um site publicando rápido tem massa de URLs novas ainda sem impressão, e é reprovado por estar crescendo.

**26. Cobertura do TAM de busca (60–80% dos clusters)** — `recusa` + **sem coletor**
O GSC não informa volume de mercado — só o que o próprio site recebeu. Medir TAM exige fonte de volume externa que o repo não tem.

---

## 4. O que isso significa para a tela do `atma`

Das 32 folhas do board, **7 emitem veredito**. As outras 25 aparecem como `sem régua` — estado que `benchmark.mjs` já trata como dado legítimo e visível.

Isso não é fracasso do levantamento. É o board revelando o que ele sempre foi: **uma taxonomia de diagnóstico com valores editoriais**, não uma régua de mercado. Como mapa do que olhar no GSC, é bom. Como fonte de limiar para um motor de veredito, dois terços dele não têm de onde vir.

Três caminhos para as 22, e só o primeiro é gratuito:

1. **Ficam como `sem régua`** — visíveis na tela, com o motivo à mostra. Preserva a disciplina e não custa nada.
2. **Viram régua interna, medida no portfólio** — em vez de "o mercado diz 40%", passa a ser "a mediana dos seus 35 projetos é X". Deixa de ser benchmark de mercado e vira comparação com você mesmo, que é honesta desde que rotulada como tal. Exige série histórica que o repo já coleta.
3. **Alguém procura fonte primária por item** — caro, e a maioria não tem porque o número nunca saiu de um estudo.

## 5. Dívidas registradas

- ~~`lib/crux.mjs` — corrigir TTFB de 600/300 para 800 (p75)~~ **FEITO em 19/09/2026** (§1.1). O `ideal: 300` segue sem fonte, listado em `EDITORIAIS`.
- `lib/kpis-busca.mjs` — `BENCHMARK` é a única régua do repo sem `fonte`/`url`/`acessadoEm`. Migrar para o formato `Linha`.
- Nenhuma fonte de CTR levantada tem recorte Brasil ou saúde. Para a `atma`, toda a §2.1 é régua emprestada de outro mercado — o que é legítimo com o `recorte` declarado, e desonesto sem ele.
- Os seis números de `EDITORIAIS` (§0.1) estão no código sem origem. Não estão errados — estão sem fonte, que é diferente. A tela precisa distingui-los de `LCP 2,5s`.
- Três divergências board × código (profundidade 3×4, links 5-10×5, cadência 6-12×12) esperam decisão. Nenhuma tem lado certo por fonte; ambos os lados são editoriais.
