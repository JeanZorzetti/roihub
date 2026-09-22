# Template de melhoria do GSC: os 18 KPIs do mapa, em "se… então"

**Documento reaplicável, vale para qualquer projeto de `/gsc/mapa/{slug}`.** Desde a spec 054 o
template mora na TELA: cada folha do mapa mostra a próxima ação (ou por que não há), e o bloco
"O que fazer primeiro" junta as ações por alavanca, na ordem de ataque abaixo.

**As regras, com limiar, estão num lugar só: `lib/proxima-acao.mjs#REGRAS`.** Na tela, a regra
inteira de cada folha ("Regra: se …, …") aparece no painel do nó e na lista abaixo do mapa. Este
arquivo não repete limiar nenhum: uma segunda tabela divergiria calada na primeira correção.

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

## 1. Ordem de ataque: os degraus do bloco "O que fazer primeiro"

Consertar CTR de página fora do índice rende zero. A tela ordena de cima para baixo:

1. **Índice**: indexação limpa, rejeição de rastreio, profundidade de clique.
2. **Desempenho**: Core Web Vitals e TTFB, só o que estiver reprovado (é higiene).
3. **Página certa para o termo**: canibalização e intenção.
4. **Posição**: links internos, cobertura de termos, frescor.
5. **Snippet**: dados estruturados e título.

KPI de resultado (penetração no Top 3, striking distance, Top 20, CTR Gap…) não vira ação própria:
entra como motivo da alavanca para a qual aponta, com o número dele.

---

## 2. Onde está cada regra

- Limiar, alavanca e degrau de cada uma das 32 folhas: `lib/proxima-acao.mjs#REGRAS`.
- Régua com fonte (◆): lida de `lib/gsc-delta.mjs#CATALOGO` e `lib/kpis-busca.mjs#BENCHMARK`.
- Decisões e o que foi descartado: `specs/054-proxima-acao-mapa/research.md`.
