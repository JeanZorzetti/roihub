# Handoff EXECUTADO — a fase D era a aposta do documento e ela REPROVOU (01/08/2026)

Executa: [`handoff-a-definicao-de-pronto.md`](handoff-a-definicao-de-pronto.md) ·
índice: [`../handoff.md`](../handoff.md).

**Fases C, D, R e F executadas. A vem só do Jean e NÃO foi feita. G e L não começaram —
e a razão é o resultado da D, não falta de tempo.**

`npm test` 254 verdes · `npx tsc --noEmit` limpo · `validade` 0 achados em 235 vivos.

---

## 1. O achado que muda o plano

> **As duas passadas do detector — a aposta central da spec, com custo orçado de ~4 h e ~60
> chamadas — foram implementadas, medidas contra o MESMO fixture congelado e REPROVARAM em
> tudo que decide.**

| política | holdout | adversarial | células perigosas |
|---|---|---|---|
| **uma passada** (o que estava lá) | **83,3%** (35/42) | 14/20 | **ZERO** |
| duas passadas (fase D) | **65,9%** (29/44) | 14/20 | **`bate→desmente` 5 · `desmente→nao-fala` 1** |

Perdeu 17 pontos, não mexeu no adversarial e **quebrou o critério 1.6** — a única propriedade
que o próprio documento diz valer mais que o agregado. Com uma passada o detector nunca
fabricou tarefa nem escondeu corpus podre. Com duas, fabricou 5 e escondeu 1.

**A causa, e ela generaliza:** a passada 2 é cega ao documento de propósito, para não poder
absolver por assunto — mas cega ao documento é também **cega ao contexto que torna uma
afirmação compatível**. Vendo só a afirmação e o fato, ela grita `desmente` em qualquer
divergência literal. Chamou de incompatível *"a fonte é a API do GitHub + `lib/projects.mjs`
(`listProjects()`)"* contra um apurado que diz *"API do GitHub + `data/projects.json` via
`mergeProjects()`"* — **o mesmo mecanismo com outro nome**. Trocar absolvição indevida por
acusação indevida não é conserto: é mudar de lado o mesmo erro, e a acusação é o lado caro.

**A lição que a casa achava ter aprendido estava mal enunciada.** O que funcionou três vezes
não foi *separar em duas chamadas*; foi **forçar a evidência antes da decisão dentro da mesma
chamada** (`TRECHO → MOTIVO → VEREDITO`). É a mesma forma da lição do reranker: o modelo
acerta o conjunto e erra a ordem porque não vê o score do BM25 — aqui ele acerta a
incompatibilidade literal e erra a compatibilidade contextual porque não vê o texto.

O código ficou, atrás de `--duas-passadas`, com o número no comentário. Sem isso a próxima
sessão gasta ~130 chamadas para redescobrir o mesmo.

---

## 2. Fase C — o portão tem resolução, e o modo de falha não mudou

- **Holdout 33 → 44 casos que contam** (critério 1.1, meta ≥ 40). 11 pares novos, rotulados na
  janela de 2400 da produção, `ancora` conferida antes de escrever, **commitados antes da
  primeira corrida contra eles** (`7f2a773`).
- **Adversarial 10 → 20** (critério 1.5), **seis deles ESPELHO** de um caso do holdout.
- **`ancora` em 20/20 adversariais** (critério 1.3 na parte que era dívida de rigor). Os 7
  legados do holdout seguem sem, de propósito.

**A matriz com 44 casos é a mesma com 33:** `nao-fala→nao-fala` 19 · `bate→bate` 11 ·
**`bate→nao-fala` 7 ✗** · `desmente→desmente` 5. Triplicar a resolução não mudou o modo de
falha, só o denominador — **é UM defeito, não ruído**, e ele cai todo no lado seguro.

### 🚩 O achado da fase C que vale mais que os 11 casos

> **Li os 61 pares candidatos um a um e não há UM ÚNICO `desmente` natural entre eles.**

Não é escolha de rotulagem: entre os documentos que a busca recupera para as seis perguntas de
`estado`, **nenhum afirma no presente algo que a fonte viva desminta**. A célula `desmente`
fica em 7 e **não pode ser ampliada com este material** — a spec pedia priorizá-la e o material
não a tem.

Isso é evidência (fraca, porque a amostra é o top-k) de que o `validade.mjs` fez o que
prometia: a família `(hoje N)` em prosa era o defeito, e ela parou de nascer.

### C-4 resolvido: é fabricação real, o caso fica

O caso que travava o portão 1 (`project_roihub_conformidade`, `defasagem-citacao`) é a
**primeira** das duas hipóteses da spec. O detector citou
`10 dos 97 protocolos viraram função e rodam contra os 35 projetos de \`data/projects.json\``
— frase que **não está no documento** e está, literal, no `CLAUDE.md`. Veredito certo (`bate`),
citação fabricada. **Não é conserto de check.** Um segundo caso igual apareceu com os pares
novos: são 2 `defasagem-citacao`, os dois com o mesmo mecanismo.

---

## 3. 🚩 O portão 2 afrouxava sozinho quando o fixture crescia

`const p2 = pegou.length >= 9` era **absoluto**, escrito quando o fixture tinha exatamente 10
casos. Ao dobrar para 20, a corrida imprimiu **"✅ passou 14/20"** — 70%, contra os 80% que ele
reprovava no dia anterior.

**Um portão que fica mais fácil quando o denominador cresce recompensa quem amplia o fixture**,
que é o oposto do que ampliar o fixture serve para fazer. O portão 1 já era proporcional
(`>= 0.85`); este tinha ficado para trás. Agora é `>= 90%` e os dois reprovam honestamente.

Foi a ampliação da fase C que revelou isso — **a primeira corrida de um portão ampliado mede o
PORTÃO**, e é uma forma nova do `VER-08` que vale registrar.

---

## 4. Fase R — reprodutibilidade (1.7): MEDIDA, e a crença estava certa

O buraco que a spec chamava de mais sério da lista. Teste mecânico: rodar, escrever handoff,
**reindexar**, rodar de novo, com cache morno nas duas vezes.

**Resultado: zero movimento em todas as células**, com o corpus mudando entre as duas corridas.
Está registrado em [`../docs/defasagem-reprodutibilidade-2026-08-01.md`](../docs/defasagem-reprodutibilidade-2026-08-01.md).

O fixture inlina apurado **e** trecho, então o portão não toca no índice — e agora isso é
**medido**, não uma crença de projeto. **O critério 1.7 pede duas medições: esta é a primeira.**

---

## 5. Fase F — o dinheiro (paralela, zero pool)

### F.3 ✅ — e ele INVERTE a leitura do inventário de gateways

`scripts/gateways-repo.mjs` (novo): lê `package.json` e `.env*` de **todos os repos** pela API
do GitHub. Zero LLM, zero pool.

| balde | n | quem |
|---|---|---|
| **SDK de pagamento no `package.json`** | **10** | `sirius` (mp+stripe), `polarisia`, `estetiacrm`, `reviewshield`, `context`, `aftercare`, `atma`, `compass`, `orion`, `vertice` |
| só variável de ambiente | 2 | `goiania`, `roilabs` |
| nada no código | 23 | os outros |

**`gateways.mjs` via 1 gateway ligado e 30 sem caminho servido. O repo mostra 12 projetos com
cobrança escrita e 2 servindo.** A leitura "faltam 2" era do HTML; pelo código, **10 projetos
têm integração de pagamento escrita e nunca ligada** — essa é a lacuna cara, e nenhuma régua a
via.

⚠️ **`VER-08` valeu duas vezes, sétima nesta base**, e os dois defeitos são reutilizáveis:
1. **`repo` em `projects.json` é o NOME, sem o dono** — `/repos/roilabs` deu 404 em **35 de
   35**. "Tudo quebrado" é o formato que um check quebrado tem.
2. **Linha COMENTADA contava como env var declarada** — `orion` marcado com stripe por
   `# STRIPE_SECRET_KEY`, `goiania` com asaas por `# Asaas (cobrança de success fee…`.
   **Mesma classe do "palavra ≠ URL"** do irmão. Exige `NOME=` no começo da linha.

Os números acima são a **segunda** corrida, depois dos dois consertos.

### F.2 ❌ — segue bloqueada por infra, e agora com controle

`31.97.23.166:5434` continua `TIMEOUT` da máquina de dev. **Controle novo:**
`2.24.207.200:5435` (o `sofia_db`) conecta em **143 ms** da mesma máquina, no mesmo instante —
**não é rede geral, é aquele host/porta.** Nenhum número de venda do `sirius` pode sair; o card
continua **AFIRMADO**.

### F.1 ❌ — sem credencial

Não há chave da Kiwify no `.env` (as chaves são `GOOGLE_SERVICE_ACCOUNT_JSON`, `DATABASE_URL`,
`OLLAMA_URL`, `HUB_USER`, `HUB_PASS`, `CRON_SECRET`, `CLAUDE_CODE_OAUTH_TOKENS`, `GITHUB_TOKEN`,
`UNSPLASH_ACCESS_KEY`, `MERCADOPAGO_ACCESS_TOKEN`). O card do `orcaobra` continua **AFIRMADO**.

---

## 6. 🚨 Fase A — NÃO foi feita, e o teste confirma

`node --env-file=.env scripts/vendas-mercadopago.mjs` **autenticou hoje de novo**. O token de
produção do Mercado Pago segue vivo em `origin/main` do repo público. **Só o Jean pode fazer, e
fica mais caro a cada dia.**

---

## 7. Onde a definição de PRONTO está agora

| # | critério | antes | agora |
|---|---|---|---|
| 1.1 | holdout ≥ 40 casos que contam | 33 | **44 ✅** |
| 1.2 | adversarial ≥ 20 | 10 | **20 ✅** |
| 1.3 | `ancora` em 100% | 26/49 | **63/70** — 20/20 nos adversariais; os 7 legados ficam sem, de propósito |
| 1.4 | portão 1 ≥ 85% e zero sem veredito | 87,5%, 1 sem | **83,3%, 2 sem** ❌ |
| 1.5 | portão 2 ≥ 90% | 8/10 | **14/20** ❌ |
| 1.6 | 🔑 células perigosas em ZERO | ✅ | **✅ mantido** (e é o que reprovou a fase D) |
| 1.7 | reprodutibilidade | nunca medido | **medido 1× de 2** |

**O nível 1 continua não fechado, e o caminho que a spec apostava para fechá-lo está
descartado com número.** Os níveis 2 e 3 seguem intocados — corretamente: publicar percentual
com o portão reprovando é o defeito que esta base existe para não cometer.

---

## 8. O que fazer a seguir, na ordem

1. **🚨 Fase A (Jean).** Continua primeiro e continua não feita.
2. **A célula `desmente` não cresce com o material que existe.** Antes de mais rotulagem,
   decidir: ou se aceita que o holdout meça sobretudo `bate`/`nao-fala`, ou se geram pares de
   outras perguntas — e as de `estado` são só 8.
3. **NÃO tente uma terceira decomposição.** Duas redações de regra e uma decomposição já
   falharam, cada uma com número. Os 7 erros restantes são todos `bate → nao-fala` e **todos
   caem no lado seguro**: a pergunta honesta passou a ser se o portão 1 deve reprovar por eles.
4. **Fase R, 2ª medição** — falta uma para fechar 1.7.
5. **Cruzar `gateways-repo.mjs` com `gateways.mjs`**: os 10 com SDK escrito e não servido são a
   lista nominal mais acionável que saiu desta sessão.

---

## 9. Armadilhas novas desta sessão

- **Piso de portão tem que ser PROPORCIONAL.** Absoluto afrouxa sozinho quando o fixture cresce.
- **`repo` em `data/projects.json` não tem o dono.** Prefixe `JeanZorzetti/`.
- **Linha comentada num `.env.example` não é variável declarada.** Exija `NOME=`.
- **A primeira corrida de um PORTÃO AMPLIADO mede o portão**, não só a primeira de um check novo.
- **`--duas-passadas` custa o dobro e piora 17 pontos.** Está no código só como registro.
