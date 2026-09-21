# Handoff — 049 · Active Index Ratio medido no board

**Data:** 21/09/2026 · **Estado:** conferido no dev server (canvas a 1440px com a folha expandida, nó + contador,
console limpo, tsc limpo, 1199/1199 testes). Produção: conferir depois do push (~1 a 15 min, ler a TELA duas vezes).

## O que mudou

A folha IMPRESSÕES › `4. KPI de Eficiência do Índice: Taxa de Páginas Geradoras de Impressão (Active Index Ratio)`
abre com o nó `activeIndexRatio-medido`, e o mapa passa de 25 para 26 folhas `-medido`. Nenhuma requisição nova: a
leitura por página (033), a apuração de indexação (043) e o sitemap URL a URL da corrida de página (024) já estavam
em memória.

| Onde | Mudança |
|---|---|
| `app/gsc/mapa/page.tsx` | Bloco 049 depois do 048. Usa `activeIndexRatio`, `urlsComImpressao` e `canonizar`, que já existiam. |
| `lib/` | Nada. |

## O número (Atma, janela 22/08 → 18/09)

**77,8% · 14 de 18 URLs indexadas do sitemap com impressão · 4 sem.** A meta do board é ≥ 70%. Como não é régua
(`balizador: recusa`, porque a razão cai com a idade do site), o nó não leva glifo de veredito.

As 11 URLs do sitemap sem impressão no domínio novo, separadas com a URL Inspection de 21/09 (fora da tela, 11
chamadas):

| Estado | URLs |
|---|---|
| **Indexadas sem impressão (as 4)** | `/blog/10-mitos-aparelho-invisivel`, `/blog/alinhador-invisivel-formatura-casamento-2026`, `/ortodontistas/seja-parceiro` (Submitted and indexed, rastreadas em 14/09) · `/blog/futuro-ortodontia-ia` (indexada na corrida, `Crawled - currently not indexed` numa inspeção seguinte) |
| Fora do índice (as 7 da corrida) | `/pacientes/precos`, `/contato`, `/ortodontistas`, `/blog`, `/blog/1`, `/blog/2`, `/blog/sorriso-perfeito-15-dicas` |

- Nenhuma das 4 teve impressão **nem pelo domínio antigo** na janela, então não é efeito da migração: são as
  candidatas a "zumbi" que a ação corretiva do board nomeia. Com 77,8% o board não manda podar (poda abaixo de 50%).
- `/pacientes/precos` tem 418 impressões pelo domínio antigo e 0 pelo novo porque segue `Discovered` (ver 043).
- O domínio novo exibe 3 URLs que o sitemap não declara: `/pacientes/antes-depois` (18), `/ortodontistas/modelos-parceria`
  (3) e `/ortodontistas/tecnologia` (2). Estão no índice e ficam fora das duas pontas. Com elas seria 17 ÷ 21 = 81,0%.

## Decisões

- **O numerador fica no conjunto do denominador.** A fórmula literal dá 29 ÷ 18 = 161%, porque os 29 somam os dois
  domínios, 14 caminhos fora do sitemap (variações de slug e páginas que o domínio antigo ainda exibe) e
  `/pacientes/precos`, que só o antigo exibe. O nó usa URL do sitemap com impressão **pelo host novo**, e uma URL só
  recebe impressão se está no índice. Por isso o numerador cabe no denominador. A função é a mesma
  (`activeIndexRatio`) e só a entrada muda, então a guarda de "numerador > denominador → null" continua valendo.
- **A partilha 7 fora / 4 sem impressão só é afirmada quando as duas corridas leram o mesmo sitemap** (tamanho igual,
  zero falha, a soma fecha). A tela não nomeia as 4, porque `hub_indexacao` grava só o agregado.
- **A janela tem 8 dias do domínio novo** (troca em 11/09). A nota diz isso, e a frase some sozinha quando a janela
  passar da troca (a partir de ~12/10).

## Pendente

- A aba `/okr/atma/aquisicao` segue mostrando "29 URLs com impressão · contagem, não razão", porque
  `kpisPorPagina` recebe as páginas dos dois hosts sem o sitemap. Para as duas telas publicarem 77,8%, a restrição
  (sitemap × host novo) precisa descer para `lib/kpis-busca.mjs`, com teste.
- Se as 4 indexadas sem impressão continuarem assim quando a janela for toda do domínio novo (~12/10), vale olhar
  conteúdo e link interno delas.
- Irmã do ramo IMPRESSÕES sem leitura: TAM (sem coletor).
