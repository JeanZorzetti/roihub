# Handoff — o próximo passo é DOBRAR a camada `estado`, e as fontes já existem (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-a-segunda-via-de-selecao.md`](handoff-a-segunda-via-de-selecao.md) (2ª via de seleção,
> entregue e no ar). Índice: [`../handoff.md`](../handoff.md).

`npm test` **258 verdes** · `npx tsc --noEmit` limpo · `npm run validade` limpo · corpus reindexado
(297 docs).

---

## 0. Leia isto antes de escolher outra coisa

Os passos 1, 2 e 4 da ordem vigente **não são tarefa de agente** e continuam abertos. Estão aqui
para não serem silenciosamente pulados nem "contornados":

| # | o que é | por que não é agente |
|---|---|---|
| 1 | 🚨 **Invalidar o token antigo do MP e exigir 401** | painel do Mercado Pago, login, sua mão. Gerar a nova sem invalidar a velha **não é rotação, é adição**. Aberto há 2 dias e é o único item que pode custar dinheiro enquanto não é feito |
| 2 | **Destravar `31.97.23.166:5434`** | infra da VPS. As 3 vendas AFIRMADAS do `sirius` seguem sem conferência no banco |
| 4 | **As 4 chaves da Stripe do `context`** | credencial de painel. Escrever o checkout antes delas é **produzir preparação e chamar de entrega** |

**Contornar qualquer um deles é o defeito**, não o atalho.

## 1. O próximo passo de agente é o item 5, e ele mudou de preço

> **Dobrar a camada `estado` para ~20 fatos apuráveis.** É o único caminho que destrava o critério
> `1.8` (célula `desmente` ≥ 20), e desde ontem ele vale **o dobro**: cada fato novo ganha também
> uma **âncora da 2ª via de seleção**, que é a via que alcança número defasado citado de passagem.

O handoff de ontem provou o teto: **só existem 8 fatos com fonte viva**, cada um rende ~1 afirmação
defasada no corpus, **8 × 1,1 = 9**. Nenhuma varredura conserta um universo de 8. E ontem se provou
o outro lado: a 2ª via funciona, achou 3 documentos que a busca nunca traz — e **absolveu os 3
corretamente**, porque o corpus está limpo em `D-66` hoje. Instrumento bom, bancada pequena.

## 2. 🎯 A descoberta que muda o custo: as fontes JÁ RODAM

Dobrar a camada não exige construir fonte nova. **Seis scripts deste repo já apuram fato contra
fonte viva, com zero LLM, e nenhum deles está ligado à camada `estado`** (medido agora — nenhum
importa `rodarClaude`/`reranker`):

| script | o fato que ele já produz | rede |
|---|---|---|
| `scripts/gateways.mjs` | quantos dos 35 servem caminho de cobrança, e em que balde | HTTP × 35 sites (~250 req) |
| `scripts/gateways-repo.mjs` | quantos repos têm SDK de pagamento **escrito** | API do GitHub |
| **o cruzamento dos dois** | quantos têm SDK escrito e **nunca ligado** | (derivado) |
| `scripts/conformidade.mjs` | quantos projetos violam cada um dos 10 protocolos que rodam | HTTP × 35 (~140 req) |
| `scripts/validade.mjs` | quantos documentos vivos afirmam presente com número sem data | offline |
| `scripts/inspect-url.mjs` | o site está no índice do Google | URL Inspection API |
| `scripts/fetch-crawl-stats.mjs` | crawl requests / OK% dos hosts | GSC ⚠️ média de 90 dias |

**São ~7 fatos novos → 15 no total.** Para 20 faltariam ~5, e esses sim exigiriam fonte nova. O
trabalho aqui é **ligar**, não construir: escrever o apurador em `APURADORES` e a pergunta em
`data/dourado.json`.

### E cada um deles alimenta a 2ª via de graça

Esses números **estão escritos em memória viva**, que é exatamente o material que a célula
`desmente` não tem: `roihub_portfolio_nao_cobra` afirma *"10 com SDK escrito, UM faturou; 6 servem
preço"*, `project_roihub_conformidade` afirma *"10 protocolos × 35 projetos"*. Quantidade escrita em
documento vivo + fonte que a apura hoje = **exatamente o par que a mineração de ontem não conseguiu
fabricar do git.**

## 3. 🚩 Duas premissas medidas AGORA, e as duas fecham caminhos tentadores

Estão aqui para a próxima sessão não gastar o comando de novo:

- **Gates NÃO multiplicam de graça.** A ideia óbvia — "cada card com gate vira um fato do GSC" —
  rende **2 cards de 35** (`tapepro` e `sirius`), que são exatamente os dois que já existem como
  `D-68`/`D-69`. **Zero fato novo por aí.** Escrever gate em card para criar fato seria fabricar
  bancada: o gate é curadoria de negócio, não se inventa para alimentar régua.
- **`rede` é campo do apurador e declara CUSTO, e `apurarEstado({modo:"tudo"})` roda TODOS.** Hoje
  `corpus-defasado.mjs` e `avaliar-resposta.mjs` chamam com `modo: "tudo"`. Pendurar `gateways.mjs`
  (250 requisições contra produção) ali dentro faria **toda corrida de régua** disparar 250
  requisições — é o mesmo motivo pelo qual o conformidade está fora do `npm test`. **Fonte cara
  precisa de modo próprio ou cache**, não de mais uma entrada em `APURADORES`.

## 4. O custo real de UM fato novo (leia antes de estimar)

Não é só o apurador. Cada fato de `estado` toca quatro lugares:

1. `APURADORES` em [`lib/dourado-estado.mjs`](../lib/dourado-estado.mjs) — a função, com `rede`
   declarando o custo e **falha FECHADA** (`nao_apurado` com motivo, nunca o valor da corrida
   anterior).
2. `data/dourado.json` — a pergunta, as `fontes` e a `armadilha`. **O campo `resposta` fica VAZIO** e
   há teste que segura: texto que não existe não apodrece.
3. **Âncora de citação** (opcional, e é o que faz o fato render `desmente`): regex + valor, no molde
   de `CITACOES_D66`. **Mede a largura contra o corpus ANTES de escrever** — `(\d+) projetos` solto
   seleciona 43 documentos e a estreita seleciona 6.
4. **Fixture do juiz**, se o fato entrar nos 20 rótulos de regressão: `dourado_congelado` em
   `data/juiz-calibracao.json` / `juiz-adversarial.json`. Há teste que reprova caso de `estado` em
   fixture sem o gabarito congelado junto.

**Ordem sugerida:** comece pelos **offline e baratos** (`validade.mjs`, `gateways-repo.mjs` pela API
do GitHub), que não pedem modo novo. Deixe `gateways.mjs` e `conformidade.mjs` por último — são os
que forçam a decisão de custo do item 3.

## 5. Como saber que funcionou

- `node --env-file=.env scripts/dourado-estado.mjs --estado tudo` lista os fatos novos **apurados**,
  não `nao_apurado`. Zero LLM, é a verificação barata.
- `node --env-file=.env scripts/corpus-defasado.mjs --ids D-XX` para cada fato novo: a **lista
  nominal** é a saída, o percentual não. **LEIA os achados um a um** — décima vez nesta base que a
  1ª corrida de um check novo mede o CHECK.
- **Não publique percentual de defasagem.** Os dois portões continuam reprovando (83,3% e 14/20) e a
  frente do detector segue **congelada**: fato novo aumenta a bancada, não move portão.

## 6. O que NÃO fazer

- ❌ **Uma quarta redação da regra do prompt de defasagem.** Três tentativas, três derrotas medidas.
- ❌ **Uma segunda decomposição em duas passadas.** 83,3% → 65,9% e a célula que decide quebrou.
- ❌ **Mais uma varredura atrás de `desmente`** no corpus ou no git. O teto são os FATOS.
- ❌ **Reescrever handoff datado** para o corpus bater com hoje. É o único lugar onde se vê o que se
  sabia quando a decisão foi tomada.
- ❌ **Alargar a âncora da 2ª via "para achar mais"** sem medir: ela compra homônimo com pool.
- ⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
