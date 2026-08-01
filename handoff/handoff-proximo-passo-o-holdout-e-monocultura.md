# Handoff — o próximo passo é TIRAR O HOLDOUT DA MONOCULTURA, e a bancada nova já existe (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-a-camada-estado-dobrou.md`](handoff-a-camada-estado-dobrou.md) (a camada `estado` foi de
> 8 para 15 fatos, entregue e no ar). Índice: [`../handoff.md`](../handoff.md).

`npm test` **269 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · corpus reindexado
(300 docs) · `data/dourado.json` com **85 perguntas**, 15 de camada `estado`.

---

## 0. Leia isto antes de escolher outra coisa

Os itens 1, 2 e 4 da ordem vigente **não são tarefa de agente** e continuam abertos. Estão aqui
para não serem silenciosamente pulados nem "contornados":

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago, login, sua mão. Gerar a nova sem invalidar a velha **não é rotação, é adição**. Aberto há 3 dias e é o único item que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 4 | **As 4 chaves da Stripe do `context`** | credencial de painel. Escrever o checkout antes delas é **produzir preparação e chamar de entrega** |

**Contornar qualquer um deles é o defeito**, não o atalho.

## 1. O próximo passo de agente, e a premissa está MEDIDA

> **Gerar candidatos dos 7 fatos novos, rotular à mão ANTES de rodar, e congelar.** O holdout do
> detector tem **50 casos e todos saem de 8 perguntas** (`D-66`…`D-73`) — os 7 fatos que entraram
> hoje não têm **um único** caso nem candidato. Medido agora:

| fixture | tamanho | de quantos fatos | `desmente` |
|---|---|---|---|
| `data/defasagem-calibracao.json` (holdout) | 50 casos | **8** (D-66…D-73) | 7 |
| `data/defasagem-adversarial.json` | 20 casos | — | (corrompidos de propósito) |
| `data/defasagem-candidatos.json` (não rotulados) | 61 pares | **6** | — |
| `D-79`…`D-85` | **0 casos, 0 candidatos** | 7 | — |

O portão mede o detector, não o corpus — e um holdout inteiro derivado de 8 fatos mede o detector
**naquelas 8 perguntas**. Foi exatamente por isso que ele foi feito não-monocultura na dimensão da
FAMÍLIA de defeito (passado datado, projeto errado, crase, ressalva); ele nunca foi diversificado na
dimensão do FATO, porque até hoje só havia 8.

## 2. 🚩 Os 42 pares de hoje estão CONTAMINADOS para rótulo — não os use

As duas corridas de 01/08 julgaram **42 pares** (29 documentos distintos) e **eu li os vereditos um
a um** para escrever o handoff anterior. Rotular esses mesmos pares agora é a contaminação que os
dois portões existem para impedir — a mesma regra do `veredito_original` do juiz e do "rótulo
revisado depois de ler o juiz".

**O caminho limpo já está escrito no próprio fixture** (`defasagem-candidatos.json`, campo `como`):
gerar par (pergunta × documento) da seleção real, com `trechoRelevante` no orçamento da produção
(**2400**), **sem veredito e sem âncora**, rotular à mão, conferir a âncora contra o trecho e só
então mover para `defasagem-calibracao.json`. Par gerado com recorte diferente do que a produção
entrega não mede detector nenhum: **em 6 dos 20 primeiros rótulos a frase citada não estava no que o
detector recebeu**.

Os pares além do `--k 6` que rodei hoje **nunca foram lidos por ninguém** e são material limpo. A
seleção é **zero LLM e zero pool** até o julgamento — descobrir quantos são custa uma corrida de
seleção, não de detector.

## 3. 🚩 Consertar o corpus CONSOME a bancada — congele antes

Os 3 `desmente` reais de hoje apontavam todos a memória `roihub_portfolio_nao_cobra`, e ela **já foi
corrigida**: aqueles mesmos pares, hoje, devolvem `bate`. Isso não é perda — é o produto
funcionando —, mas tem uma consequência operacional que não estava escrita em lugar nenhum:

**O par só sobrevive ao conserto se estiver CONGELADO no fixture**, que inlina `apurado` + `doc`.
Achado real que vira edição sem passar pelo fixture é bancada que desaparece no mesmo dia. Quem
achar `desmente` daqui pra frente: **congela primeiro, conserta depois.**

## 4. O que NÃO fazer

- ❌ **Uma quarta redação da regra do prompt de defasagem.** Três tentativas, três derrotas medidas.
- ❌ **Uma segunda decomposição em duas passadas.** 83,3% → 65,9% e a célula que decide quebrou.
- ❌ **Rotular a partir do JSON da corrida** (`data/corpus-defasado/*.json`). Ele guarda o `trecho`
  que o modelo CITOU (77 chars), não o recorte de 2400 que ele recebeu — e o veredito já está lá.
- ❌ **Alargar âncora "para achar mais"** sem medir: `(\d+) protocolos?` solto casa 13 documentos.
- ❌ **Publicar percentual de defasagem.** Os dois portões seguem reprovando (83,3% e 14/20).
- ❌ **Reescrever handoff datado** para o corpus bater com hoje. O `desmente` de `D-85` de hoje foi
  exatamente isso e foi absolvido: `handoff-crawl-stats-semanal.md` diz "9 exports, todos de
  2026-07-10" e está certo sobre o dia dele.

## 5. Como saber que funcionou

- `node --env-file=.env scripts/defasagem-calibrar.mjs` roda os dois portões contra o fixture novo.
  **Piso é PROPORCIONAL** (holdout ≥ 85%, adversarial ≥ 90%): ampliar o fixture sem ajustar o piso
  absoluto já deixou "14/20 = 70%" passar como se fosse 9/10.
- **A primeira corrida contra um fixture AMPLIADO mede o fixture**, não o detector — como mediu na
  ampliação de 10 → 20. Leia as divergências uma a uma com `--ver` antes de tratar qualquer uma
  como defeito do detector.
- **Nenhum percentual de defasagem sai enquanto os dois portões não passarem.** Fato novo aumenta a
  bancada; ele não move portão.

## 6. Se sobrar sessão, na ordem

1. **`D-83` acusou `GEO-01` em 28 de 35 e `DEP-08` em 11.** Números do check que já rodava — a
   novidade é só a agregação. Ler as linhas antes de abrir frente: `n/a` não é aprovação, e 5 das
   46 violações da primeira corrida do conformidade eram o check errado.
2. **`D-84`: 12 homes fora do índice**, três delas em `URL is unknown to Google` (`orcaobra`,
   `lumina`, `pathfinder`). `portfolio` está em `*.vercel.app` e por isso fica **fora de toda
   propriedade** — não é sinal de SEO, é falta de domínio próprio.
3. **`D-85`: `roilabs.com.br` com OK em 33,6%** no export de 25/07. É o host com mais crawl (2596
   req) e o pior OK% da casa. ⚠️ **Date antes de caçar bug**: o export cobre 90 dias.
4. Para 20 fatos apuráveis faltam ~5, e **esses exigem fonte nova** — não há mais script pronto
   para ligar.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
