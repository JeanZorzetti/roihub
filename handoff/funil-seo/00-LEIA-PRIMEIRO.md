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

## ⚠️ ATUALIZAÇÃO 02/09/2026 — a cadeia da Atma MUDOU de forma, leia antes do resto

O texto abaixo continua válido como método. O que mudou é o **negócio**, e com ele a cadeia:

**A Atma parou de prometer "achamos um doutor perto de você".** Ela era representante comercial; o
sócio que fazia comercial + fabricação saiu por não entregar a venda. A fábrica nova cuida de
planejamento e fabricação, mas exige os exames. Um dos leads acusou propaganda enganosa (não foi
adiante), e o posicionamento público virou **hiperfoco em PREÇO**.

**Consequência de medição, e é ela que importa aqui:** o que trazia cadastro era a comodidade do
direcionamento, não o preço. O paciente agora chega **direto no WhatsApp do Jean** e não preenche
form. Por isso `patient_leads` está seco desde 17/08 — **queda de CANAL, não de demanda.** Ler
aqueles 16 dias como colapso de funil manda o trabalho errado.

O que a cadeia passou a medir (`lib/okr.mjs`, perfil D):

```
visitante 525 → lead (form) 35 → contato feito [?] → orçamento ENVIADO 5 → orçamento ACEITO [?] → tratamento 0
```

- **`orcamentos` era o degrau que já estava medido e a ficha dizia "sem coletor".** 7 linhas,
  R$ 37.465, todas `enviado`; 5 na janela, R$ 28.485. Agora é coletor de verdade.
- **2 dos 7 orçamentos têm `paciente_lead_id NULL`** — é a assinatura do lead de WhatsApp: veio
  sem cadastro. É o proxy medível do canal novo.
- `patient_orthodontist_assignments` tem **0 linhas** — o passo "atribuir ortodontista" nunca
  rodou de verdade e agora não existe mais. Não modele por ele.
- **`orçamento ACEITO` sai `não apurado`, nunca 0**: a tabela só conheceu `enviado`, e nenhum
  código do repo da Atma escreve outro status. `STATUS_ACEITE` em `lib/okr.mjs` está **vazio de
  propósito** — preencher só quando a Atma DECLARAR a regra, nunca por adivinhação.
- **`contato feito` continua `não apurado` de propósito.** `status` é posição ATUAL, não evento: os
  16 `cancelado` quase todos foram atendidos antes. Migration pronta e **não rodada** em
  `Atma/Site/database/2026-09-02-historico-status.sql` — e ela só conta de hoje em diante, o
  passado não volta.

## O estado em uma frase

**A cascata fecha em UM projeto do portfólio, e o que ela diz é que o gargalo não é tráfego:
`atma` faz 535 cliques → 39 leads (7,29%) → 0 vendas.** Os outros 34 continuam sem numerador.
Medido, não suposto — `scripts/funil.mjs`, corrida de 01/09/2026 (2ª corrida do dia).

Na 1ª corrida a coluna de leads da `atma` saía `não apurado` e a única taxa do portfólio era
`polarisia 6,67% (2/30)`. **As duas leituras estavam erradas, em direções opostas**, e as duas
causas estão registradas abaixo: a Atma tinha 43 leads reais num banco que o hub não lia, e os
2 leads do Polaris eram testes do próprio Jean.

## Os três fatos que decidem tudo aqui

**0. O lead pode já estar medido — em outro banco.** (Aprendido em 01/09, depois dos 3 abaixo.)
A `atma` captura paciente em `patient_leads` no PRÓPRIO banco desde julho: 43 linhas com nome e
e-mail de gente real, 39 dentro da janela. O plano original mandava *instrumentar* o site dela
para reenviar isso ao CRM do hub — o que criaria uma cópia PIOR da tabela que já existe, sem o
histórico e contando só de hoje em diante. **Antes de instrumentar qualquer projeto, procure o
lead onde ele já cai.** O hub agora lê a fonte onde ela está (`FONTES_PROPRIAS` em
`scripts/funil.mjs`, uma entrada, `ATMA_DATABASE_URL`).

**1. `ARR` é MULTIPLICAÇÃO, e há um fator zerado.**
`ARR = Tráfego × CR(visitante→lead) × CR(lead→SQL) × … × ACV`. Hoje `CR(fecho)` tem **zero eventos**
(0 de 35 com gateway ligado de verdade) e `CR(visitante→lead)` é **não medido em 34 de 35** — a
`atma` é a exceção, e ela fecha o `CR(fecho)` em **0 de 39** (22 cancelados, 7 em pré-orçamento,
nenhum convertido). Dá para
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
| Filtro de lead de teste (`ehLeadDeTeste`) | `lib/funil.mjs` + teste | ENTREGUE 01/09 |
| Leitura do banco da Atma (`FONTES_PROPRIAS`) | `scripts/funil.mjs` | ENTREGUE 01/09 |
| POST ao CRM do hub no sirius e no estetiacrm | `lib/roihub-crm.ts` dos 2 repos | ENTREGUE 01/09 · **falta env** |
| Plano até o fim, com critério de pronto | `02-plano-ate-o-fim.md` | É O QUE FALTA |

Comando:

```bash
node --env-file=.env scripts/funil.mjs          # os 35
node --env-file=.env scripts/funil.mjs --ver    # motivo de cada `não apurado` + leads nominais
```

Precisa de `ATMA_DATABASE_URL` no `.env` (só leitura de `patient_leads`). Sem ela a coluna de
leads da Atma volta a `não apurado` — nunca a 0.

## O resultado da corrida (01/09/2026, janela 01/08 → 29/08)

| onde o funil MORRE | 1ª corrida | **depois dos dois consertos** |
|---|---|---|
| nem cliques | 1 | 1 |
| para nos cliques | 31 | **33** |
| para nos leads | 3 | **0** |
| **mensurável até vendas** | **0** | **1** (`atma`) |

**A cadeia da `atma`, a única que existe:**

```
535 cliques  →  39 leads  →  0 vendas
             7,29% (39/535)      0 de 39
```

O denominador saiu do GSC, o numerador de `patient_leads` no banco da própria Atma, os dois na
mesma janela. Por status: **22 cancelado, 14 contatado, 7 pré-orçamento, 0 convertido** — o
pipeline foi TRABALHADO e mesmo assim fechou zero. Não é um zero de "ninguém olhou".

- `portfolio` é o único sem nem cliques — `*.vercel.app` fica fora de toda propriedade do GSC.
- **Os 5 leads que o `crm_leads` tem na vida inteira são os 5 de teste.** Investigado em 01/09:
  nome "Teste"/"TESTE E2E Spec012", e-mails nossos (`teste@teste.com.br`, `flow.controlx@`,
  `jeanzorzetti@`), todos em `etapa=perdido` porque ninguém nunca os moveu. Era daí que saía o
  `6,67%` do `polarisia`. **A taxa existia; a demanda, não.**
- **Os 3 com tráfego e sem denominador tinham diagnósticos DIFERENTES**, e supor que era o mesmo
  ("falta instrumentar") custou meio plano:

| projeto | captação | grava? | o que faltava de verdade |
|---|---|---|---|
| `atma` (535 cliques) | funil de paciente | ✅ `patient_leads`, 43 reais | **o hub LER** — feito |
| `sirius` (56) | `/api/contact` + calculadora | ❌ só e-mail / Resend | POST ao hub — feito, falta env |
| `estetiacrm` (23) | as mesmas duas (fork) | ❌ só e-mail / Resend | POST ao hub — feito, falta env |

## As armadilhas já pagas — não pise de novo

- **🚩 Lead nosso não é demanda, e contar um fecha este subprojeto com um `curl`.** O critério de
  pronto é "existe cadeia apurada"; três testes do Jean produziam cadeia apurada em três
  projetos. Agora `ehLeadDeTeste()` (em `lib/funil.mjs`, com teste) tira nome "teste", e-mail
  começando com "teste" e domínio nosso — e quem testa com nome plausível manda
  `metadata.teste: true`. **A heurística é o piso, não a garantia:** a defesa que não depende
  dela é o `--ver`, que agora lista os leads contados NOME A NOME. Confira as pessoas antes de
  citar a taxa.
- **`não apurado` da coluna de leads não quer dizer "o site não captura".** Queria dizer, no
  máximo, "o CRM do hub não tem". A Atma capturava havia dois meses. Antes de escrever
  encanamento novo: procure a tabela do próprio projeto, o Resend, a caixa de entrada.
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
