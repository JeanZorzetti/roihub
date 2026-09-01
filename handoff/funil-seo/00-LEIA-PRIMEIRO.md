# Funil Matemático de SEO — LEIA ISTO PRIMEIRO

**Subprojeto fechado do roihub. Aberto em 01/09/2026. EM ANDAMENTO.**

Se você é uma sessão nova e não sabe nada deste assunto: leia este arquivo inteiro antes de tocar
em qualquer coisa. São 3 minutos e evitam refazer o que já está feito.

## O que este subprojeto é

Transformar as KPIs soltas do Search Console (clique, impressão, CTR, posição) numa **cadeia
matemática que termina em dinheiro**, para que exista uma OKR derivada de medição em vez de palpite.

Nasceu de uma deep-research que o Jean encomendou:
`docs/deep-research/Funil Matemático SEO SaaS B2B.md`. Ela propõe uma cascata de 5 níveis
(N1 receita → N2 sintomas GSC → N3 leading → N4 diagnóstico técnico → N5 execução diária).

**Ele NÃO é um projeto de SEO.** É um projeto de MEDIÇÃO. O produto final é a capacidade de dizer,
com número apurado, quanto vale um clique a mais.

## O estado em uma frase

**A cascata não fecha em nenhum projeto do portfólio: 0 de 35 têm funil mensurável de ponta a ponta.**
Isso está medido, não suposto — `scripts/funil.mjs`, corrida de 01/09/2026.

## Os três fatos que decidem tudo aqui

**1. `ARR` é MULTIPLICAÇÃO, e há um fator zerado.**
`ARR = Tráfego × CR(visitante→lead) × CR(lead→SQL) × … × ACV`. Hoje `CR(fecho)` tem **zero eventos**
(0 de 35 com gateway ligado de verdade) e `CR(visitante→lead)` é **não medido em 34 de 35**. Dá para
medir INP, crawl budget e razão de 304 com perfeição absoluta e a OKR ainda resolve para R$ 0.
**Não existe número oculto que conserte um fator zerado.**

**2. A pesquisa vale como ONTOLOGIA, nunca como previsão.**
A projeção de €1.830.000 dela empilha benchmark de ELITE em todos os estágios. Pelos pontos médios
da própria tabela dela, média × elite dá **56× de diferença** ponta a ponta. As mesmas 35.294 sessões
viram 5 ou 300 clientes. **Não cite número dela como meta.** Detalhe e a conta em `01-`.

**3. `0` e `não apurado` são coisas diferentes, e essa é a regra central do subprojeto.**
Todo número aqui é `{valor}` ou `{naoApurado: motivo}`. Somar "0 leads" de um projeto sem
instrumentação com "0 leads" de um projeto instrumentado fabrica uma taxa com cara de apurada.

## O que já existe e NÃO deve ser refeito

| coisa | onde | estado |
|---|---|---|
| Leitura crítica da pesquisa (4 frentes) | `01-a-leitura-da-pesquisa.md` | FECHADO |
| Lógica pura do funil (célula, razão, profundidade) | `lib/funil.mjs` | ENTREGUE |
| Coleta + relatório dos 35 | `scripts/funil.mjs` | ENTREGUE |
| 7 testes, registrados no `package.json` | `test/funil.test.mjs` | ENTREGUE |
| Handoff recursivo no corpus (esta pasta é buscável) | `lib/corpus.mjs` | ENTREGUE |
| Plano até o fim, com critério de pronto | `02-plano-ate-o-fim.md` | É O QUE FALTA |

Comando:

```bash
node --env-file=.env scripts/funil.mjs          # os 35
node --env-file=.env scripts/funil.mjs --ver    # com o motivo de cada `não apurado`
```

## O resultado da primeira corrida (01/09/2026, janela 01/08 → 29/08)

| onde o funil MORRE | n |
|---|---|
| nem cliques | 1 |
| para nos cliques | 31 |
| para nos leads | 3 |
| **mensurável até vendas** | **0** |

- **Uma única taxa clique→lead existe no portfólio:** `polarisia`, **6,67% (2/30)**.
- Chegam ao degrau de leads: `polarisia` (2), `matchfios` (1), `verticemarketing` (1).
- `portfolio` é o único sem nem cliques — `*.vercel.app` fica fora de toda propriedade do GSC.
- Os 5 leads que o CRM tem na vida inteira estão **todos** em `etapa=perdido`. Não investigado.

**Os 3 com tráfego e sem denominador — a lista acionável:**
`atma` (535 cliques), `sirius` (56), `estetiacrm` (23).

## As armadilhas já pagas — não pise de novo

- **A 1ª corrida imprimia `6,67%` sozinho.** Esse número cai na faixa ELITE da tabela da pesquisa
  sendo **2 leads em 30 cliques**. A fração agora sai colada: `6,67% (2/30)`. Regra da casa: aviso ao
  lado perde para percentual; denominador DENTRO do texto, não.
- **Pipeline com zero lead na história inteira é `não apurado`, nunca 0.** Não separa "o site não
  manda evento" de "manda e ninguém converteu", e as duas pedem trabalho oposto (encanamento ×
  oferta). É por isso que o `atma`, com 535 cliques, não aparece com 0,00%.
- **`0/0` não é 0%** e **numerador > denominador não é taxa acima de 100%**. As duas viram
  `não apurado`. Lead sem clique no GSC veio de outro canal.
- **A pesquisa NÃO foi movida para cá de propósito.** Ela fica em `docs/deep-research/`, que **não**
  entra no `carregarCorpus()`. Indexá-la faria a `/busca` devolver os benchmarks de terceiro dela
  como se fossem fato da casa — exatamente o que `01-` argumenta que eles não são.
- **Handoff em subpasta só é indexado desde 01/09.** `lib/corpus.mjs` fazia `readdirSync` sem
  recursão: pasta não termina em `.md`, então os arquivos sumiriam da busca **sem erro nenhum**.
  Consertado com teste (`test/corpus.test.mjs`). Arquivo na raiz de `handoff/` mantém o id nu; aqui
  o id carrega a pasta (`funil-seo/00-LEIA-PRIMEIRO.md`).

## Onde o resto do contexto mora

- `01-a-leitura-da-pesquisa.md` — a leitura crítica completa das 4 frentes (o que vale na pesquisa,
  como aplicar no hub, por que NÃO entra no `computeScore`, e por que o diagnóstico original da
  motivação estava errado por um grau). **É o documento denso. Leia se for decidir qualquer coisa.**
- `02-plano-ate-o-fim.md` — os passos que faltam, em ordem, com critério de pronto por passo.
- `docs/deep-research/Funil Matemático SEO SaaS B2B.md` — a pesquisa original (fonte, não norma).
- Memória `okr_falta_fator_nao_numero` — o resumo que carrega sozinho em toda sessão.
