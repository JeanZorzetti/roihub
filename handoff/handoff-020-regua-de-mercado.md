# A régua que não existe, e por que dizer isso vale mais que inventá-la

**06-07/09/2026 — spec 020 fechada nos dois repositórios.**
roihub `1ace589` (deploy confirmado em duas checagens) · app da Atma `ddc0562` (migration aplicada).

A 020 nasceu de uma linha do handoff anterior: *"6 benchmarks pesquisados com fonte · apagar
`market_benchmarks` · fecha quando as 6 réguas têm fonte clicável"*. Duas das três premissas dessa
linha estavam erradas, e descobrir isso **antes** de implementar é o que este documento registra.

---

## 1. As duas premissas que caíram

### `market_benchmarks` não era tabela morta

O handoff dizia *"não é lida por [ninguém] e é apagada pela 020"*. O `grep` no roihub confirmava.
**O grep no app da Atma, não.**

`C:\dev\atma` tem `GET/PUT/POST /api/market-benchmarks` (`backend/src/routes/marketBenchmarks.js`,
montada em `server.js:305`) e a tela `/admin/benchmark-mercado`, que busca as 12 linhas, busca o funil
real e chama `generateComparisons()` — **rendendo um veredito que compara o desempenho real da Atma
contra doze números que ninguém pesquisou.**

⚠️ **E não era uma tela, eram duas.** O `grep -rn "market_benchmarks" C:\dev\atma` rodado imediatamente
antes de aplicar a migration revelou um segundo consumidor: `<BenchmarkEditor />` também é montado em
`admin/src/app/admin/configuracoes/page.tsx:1244`. Toda a documentação desta spec dizia "a tela
`/admin/benchmark-mercado`", no singular, até esse momento.

Não mudou a decisão — o editor já tinha sido deixado NULL-safe — mas mudou o que se sabia. A lição é
específica: **o inventário de consumidores é o primeiro comando antes de um `DELETE`, não uma
formalidade depois de decidir.** Custou dez segundos e corrigiu uma afirmação que já estava escrita em
quatro arquivos.

O medo escrito no handoff anterior — *"benchmark sem fonte produz veredito com aparência de rigor"* —
não era um risco a evitar. Estava no ar havia 38 dias, numa tela que ninguém desta família de specs
tinha aberto.

> A ironia que vale guardar: a 018 escreveu "não é lida" **sem consultar quem lê** — o mesmo defeito
> que ela própria existiu para matar (o comentário de `lib/okr.mjs` afirmando "0 transições reais
> gravadas" numa tabela com 82). Afirmação sobre o dado escrita sem consultar o dado sobrevive a
> quantas specs forem necessárias até alguém rodar o comando.

### "As 6 réguas têm fonte clicável" era inalcançável sem inventar número

`lib/benchmark.mjs` já dizia que ninguém publica benchmark para os degraus da Atma — sem que ninguém
tivesse procurado. **A pesquisa foi feita e o comentário estava certo.** Se o critério de aceitação
fosse a redação literal do handoff, cumpri-lo exigiria fabricar as faixas que faltam.

O critério virou **seis vereditos**, não seis réguas: cada degrau termina com faixa **ou** recusa
escrita com motivo.

---

## 2. O resultado da pesquisa

Seis degraus, sete páginas abertas e lidas (não só encontradas na busca).

| degrau | veredito | por quê |
|---|---|---|
| `lead→respondeu` | 🚫 recusa | ninguém publica; o que existe é B2B SaaS (MQL→SQL 13%) e outbound frio (reply 1-5%) |
| `respondeu→orçamento` | 🚫 recusa | *quote-to-close* mede o degrau **seguinte** |
| `orçamento→tratamento` | 🚫 recusa | as fontes medem aceite **pós-consulta presencial**; a Atma não tem consulta |
| `impressão→clique` | ⏳ condicional | fonte boa (AWR), mas CTR agregado sem controle de posição mede **mix de posição** |
| `clique→form_start` | 🚫 recusa estrutural | numerador GA4 × denominador GSC — a taxa gêmea que a FR-029 da 019 baniu |
| `form_start→lead` | ✅ **linha** | Zuko: 66% de quem começa um formulário termina. Corroborado: FormAssembly 68% / 1,6 bi de interações |

**Uma linha publicável em seis. E ela é de aquisição**, cuja exibição foi para a 022. A cadeia de
Conversão da Atma fica com **três recusas e zero réguas**.

### Por que isso não é entregar nada

Quem pesquisar *"case acceptance rate"* acha **45%** no primeiro resultado do Google e conclui que os
0% da Atma são catástrofe. Aquele número mede o aceite de um plano apresentado **depois de uma
consulta presencial** — estágio que a Atma não tem. Aplicá-lo é cobrar de quem manda preço por
WhatsApp o número de quem sentou o paciente na cadeira.

A ficha agora diz isso, em uma linha, com o link:

> **Mercado** · orçamento ENVIADO → tratamento INICIADO não tem régua: os benchmarks de aceitação
> medem aceite pós-consulta, e a atma manda preço sem consulta. *Não confundir com Henry Schein One,
> Catalyst Index 2026 (média 45%, top 10% 75%), que mede outro degrau.*

Antes, os três degraus devolviam a **mesma frase** — medido em 06/09, 1 motivo para 3 degraus.

---

## 3. Duas armadilhas de pesquisa, medidas

**Duas de sete páginas abertas não continham o número que a busca prometeu.** Uma terceira devolveu
403.

| página | o que o resumo da busca prometeu | o que a página tinha |
|---|---|---|
| `navboost.com/ctr-by-industry` | CTR orgânico de saúde | só *Pharmaceutical*, de dados de campanha 2019-2023, ~73% B2B |
| `cufinder.io/blog/benchmarks/dentists` | CTR orgânico odontológico | nenhum CTR orgânico, e sem metodologia declarada |
| `getgrowthrx.com/...` | case acceptance novo vs. carteira | HTTP 403 |

Se a régua tivesse sido montada a partir dos resumos, **duas das seis linhas seriam falsas** — com
nome de veículo, aparência de rigor e nenhum número por trás. É por isso que a FR-002 exige URL e a
verificação é **abrir o link**, não achar o link.

---

## 4. A regra de exibição que estava errada no meu próprio contrato

O rascunho dizia que a ficha mostraria a recusa do **degrau mais alto da cadeia**, importando a regra
de desempate da §7.1. Aplicada, ela mostraria `lead→respondeu` — cujas fontes descartadas são
métricas de B2B SaaS que nenhum dono de clínica encontra por acidente.

A §7.1 responde *"qual degrau consertar primeiro"*. Aqui a pergunta é **outra**: *qual ausência, se
ficar calada, faz o leitor buscar o número errado sozinho?*

A recusa ganhou um booleano `armadilha`, com critério estreito: marca-se quando a fonte descartada é
**do setor do leitor** e **achável em cinco minutos**. Só `orçamento→tratamento` a tem.

---

## 5. 🚨 Defeito ACHADO e NÃO consertado — a ficha conta um orçamento a mais

Verificando a SC-006 (que nenhum número apurado mudou), a cadeia na tela apareceu como
`52 → 22 → 6 → 0`. O banco diz **5** pessoas com orçamento, não 6.

```
docs=9 | paciente_lead_id NULO=1 | nomes distintos=5 | lead_id distintos não-nulos=5
```

`celulasDeOrcamento()` (`lib/okr.mjs:99`) faz `apurado(pessoas.size + semLead)`. **Maiara Fernanda
Hermann tem dois orçamentos**: o id 11 com `paciente_lead_id` NULL e o id 12 com lead 53. Ela entra
nos dois lados da soma e é contada duas vezes.

A intenção do `semLead` é defensável — orçamento sem lead vinculado ainda é gente a quem se mandou
preço. O defeito é que ele **não confere se aquela pessoa já entrou pelo outro lado**, e `paciente_nome`
está ali, idêntico nas duas linhas.

**Por que não foi consertado aqui**: a FR-018 da 020 proíbe alterar qualquer número apurado, e
misturar correção de cadeia com pesquisa de régua repetiria exatamente a confusão que a 018 e a 019
separaram de propósito. **Vira spec própria.** O conserto provável é deduplicar por
`coalesce(paciente_lead_id::text, lower(trim(paciente_nome)))`, e o teste é o caso da Maiara.

⚠️ Isto **não** foi causado pela 020 — é anterior, e só apareceu porque a verificação de "nada mudou"
foi feita contra o banco em vez de contra a tela.

### O lado da Atma já tem meio conserto — e é por isso que o defeito continua

Ao pushar a 020 no repo da Atma (07/09), o remoto tinha **4 commits** que este trabalho não conhecia.
Um deles é exatamente sobre isto:

```
9c78ec5 fix(orcamento): vincula o lead pelo nome, e mostra quando nao vinculou
```

Alguém já atacou o mesmo sintoma pelo outro lado: o app da Atma passou a vincular o lead pelo nome ao
gravar um orçamento. **Mas ele conserta o fluxo daqui para a frente e não fez backfill** — a linha
`id=11` (Maiara) continua com `paciente_lead_id` NULL, conferido no banco depois do rebase:

```
docs=9 | NULL=1 | lead_id distintos=5 | nomes distintos=5
celulasDeOrcamento() daria: 5 + 1 = 6   (verdade = 5)
```

Ou seja: **o conserto existe, foi feito, e o número errado continua na tela** — porque o dado velho
não foi migrado e porque o roihub soma `pessoas.size + semLead` sem conferir se aquela pessoa já
entrou pelo outro lado.

São **dois** consertos, e a spec futura precisa dos dois:

1. **Atma** — backfill do `paciente_lead_id` das linhas antigas (só a id=11, hoje).
2. **roihub** — `celulasDeOrcamento()` deduplicar por nome quando o `lead_id` for nulo. Sem isso, a
   próxima linha sem vínculo reintroduz o erro, mesmo com o fluxo novo funcionando.

> A lição, que vale além deste bug: **conserto do fluxo não conserta o histórico**, e uma função que
> soma dois conjuntos sem checar interseção erra em silêncio — não estoura, só publica um número a
> mais.

---

## 6. O que ficou pronto e o que não

### No ar depois do push (roihub)

- `REGUA.D` com as três recusas pesquisadas, cada uma com as fontes descartadas, número e porquê.
- `Linha` ganhou `url`, `acessadoEm` e `recorte` — obrigatórios em linha nova.
- `Recusa` é entidade de primeira classe: entra na mesma tabela, chega à tela, e `faixaDoSpan()`
  devolve `null` para ela (a árvore de metas da 016 não pode projetar contra recusa).
- Travas 6 a 9 como teste executável. **660 testes, verdes.**
- Dobra medida a 1280×800: *"POR QUE NÃO AVANÇOU, E O QUE FAZER"* em **647px**, 153px de folga. A
  linha de Mercado ocupa 2 linhas visuais (44px) e não empurra nada.

### Aplicado no app da Atma (`C:\dev\atma`, commit `ddc0562`)

Migration **rodada em 07/09**, depois do inventário de consumidores. Antes: 12 linhas, 12/12 com
"A definir". Depois: **6 linhas, 0 sem fonte verificável**, e nenhum dos 7 degraus proibidos de volta.

- `backend/migrations/024_regua_pesquisada.sql` — `DROP NOT NULL` em `metric_value`, `DELETE` das 12,
  `INSERT` dos seis vereditos.
- `backend/src/routes/marketBenchmarks.js` — recusa `source` vazio, com "A definir", ou sem URL
  (a menos que comece com `SEM FONTE — `). E conserta um bug anterior: exigir `metric_value` em todo
  `PUT` tornava impossível editar só a fonte.
- `admin/.../benchmark-mercado/page.tsx` — não quebra com `metric_value` NULL, e ganhou a seção
  **"Sem régua de mercado"**, que é onde o motivo de cada recusa aparece.
- `admin/.../benchmark-editor.tsx` — campo vazio grava `NULL`, não `NaN`; e um `400` da API agora
  mostra toast em vez de não fazer nada.

**Feito**: migration aplicada e push nos dois repositórios (`roihub 1ace589`, `atma ddc0562`).
O deploy do roihub foi confirmado em **duas** checagens, procurando `"pós-consulta"` — string que
só existe na versão nova.

---

## 7. O que levar para a próxima

1. **`grep` no repo certo.** "Ninguém lê esta tabela" é verdade sobre o repo em que você está, não
   sobre o produto. O consumidor estava a um `grep` de distância, em `C:\dev\atma`.
2. **Abrir o link, não achar o link.** 2 de 7 páginas não tinham o número que a busca prometeu.
3. **Fonte certa do degrau vizinho é pior que fonte nenhuma.** Henry Schein One é sólida, tem amostra
   de mercado e mede o degrau errado. InfluxMD, idem (mede *agendamento*). A régua errada com fonte
   boa é mais convincente — e por isso mais cara — que a ausência declarada.
4. **Quando o critério de aceitação só se cumpre inventando, o critério está errado.** "Seis réguas"
   virou "seis vereditos" e a spec passou a ser cumprível sem fabricar nada.
5. **Verificar "nada mudou" contra o banco, não contra a tela.** A tela concorda consigo mesma; foi o
   banco que revelou o orçamento contado a mais (§5).

---

## 8. Pendências nomeadas

| # | o que | onde |
|---|---|---|
| 1 | ✅ **feito** — migration aplicada, push nos dois repos, deploy do roihub confirmado 2× | — |
| 2 | **Orçamento contado a mais** — precisa de DOIS consertos: backfill no banco da Atma **e** dedup por nome no roihub | §5 — spec própria |
| 3 | Exibir as réguas de aquisição em `/okr/atma/aquisicao` | spec **022**; a pesquisa está pronta em `research.md §D4/D5/D6` |
| 4 | Achar o número de **elite** de `form_start→lead` | `research.md §D6` — a Zuko publica média, não quartil superior |
| 5 | As **7 linhas legadas** de A/B/C sem URL | `handoff/okr-regua-de-mercado.md §7`, nomeadas uma a uma |
| 6 | `status_historico` — velocidade, passagem cumulativa, coorte | spec **021** |

⚠️ Depois do push: o roihub **deploya sozinho, mas o build demora ~15 min**. Esperar e conferir
**duas** vezes, procurando `"pós-consulta"` — string que só existe na versão nova. Uma checagem única
14 minutos após o push já produziu uma conclusão errada na auditoria da 018.

⚠️ Janela de push proibida (Princípio IV): **23:30–01:00** e **08:00–08:45 BRT**.
