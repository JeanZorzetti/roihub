# Contrato — a régua depois da 020

O que `lib/benchmark.mjs` promete a quem chama, e o que a tela promete a quem lê. Complementa
`handoff/okr-regua-de-mercado.md` (spec 015), que continua valendo no que não é contradito aqui.

---

## 1. `leituraDoDegrau(perfil, taxa, chaveDoDegrau)`

### Rótulos possíveis — inalterados

`"abaixo do piso"` · `"na média"` · `"acima da média"` · `"elite"` · `"sem régua"` · `"sem par apurado"`

**Nenhum rótulo novo.** Uma recusa continua saindo como `sem régua` — o que muda é o `motivo`.

### Ordem de avaliação — a mudança está no passo 2

```
1. sem entrada na REGUA          → { rotulo: "sem régua", motivo: <genérico> }
2. entrada com `recusa`          → { rotulo: "sem régua", motivo: recusa.motivo,     ← NOVO
                                     descartadas, armadilha }
3. entrada com `condicional`     → { rotulo: "sem régua", motivo: condicional, fonte }
4. par não apurado               → { rotulo: "sem par apurado", motivo: "… §7.2 …", fonte }
5. caso normal                   → faixa, rótulo, razao, buraco, fonte, url, acessadoEm, recorte
```

`distanciaDoMercado()` devolve, além de `leituras` e `destaque`, o campo **`recusaEmDestaque`** — a
recusa que a tela mostra quando não há destaque. Ver §4.

O passo 2 vem **antes** do 4 de propósito: se o mercado não publica o degrau, não importa se as duas
pontas estão apuradas — a régua não existe de qualquer jeito, e mandar o leitor para a §7.2 (*apurar
antes de comparar*) o mandaria apurar algo que já está apurado.

### Garantias

| garantia | por quê |
|---|---|
| devolve **sempre** objeto com `rotulo`, nunca `null` | estado sem motivo apodrece em silêncio |
| toda saída que cala carrega `motivo` **não vazio** | FR-001a |
| dois degraus recusados por razões diferentes têm `motivo` **diferente** | SC-001a — é o teste |
| `razao` só existe em leitura comparável | o typedef separado já força isso |
| `url` e `acessadoEm` presentes em toda leitura comparável de **linha nova** | FR-002, FR-003 |
| leitura de linha **legada** (A/B/C) pode não ter `url` | FR-002a — não são tocadas |

### O que a função continua **não** fazendo

Não mede nada. `taxa.celula` já passou por `razao()` em `lib/funil.mjs`, que recusa ponta não
apurada, denominador 0 e numerador > denominador. Reimplementar isso aqui criaria uma segunda
definição de "degrau apurado" para divergir depois.

---

## 2. `distanciaDoMercado(ficha)`

Inalterada em forma. Duas notas de comportamento que a 020 torna observáveis:

- `destaque` continua sendo escolhido **só entre leituras comparáveis**. Uma recusa **nunca** vira
  destaque — recusa não tem `razao` para comparar.
- Para a Atma, hoje, `leituras` traz **3 recusas** e `destaque` é **`null`**. É o resultado correto,
  não uma falha.

---

## 3. `faixaDoSpan(perfil, chaveDe, chavePara)`

**Uma `Recusa` devolve `null`**, exatamente como chave ausente.

Crítico para a árvore de metas (016): `null` **PARA** a árvore (FR-004 da 016). Se uma recusa
vazasse como faixa, a árvore projetaria contra uma faixa que não existe — e projetar contra faixa
inventada é a R6 inteira.

---

## 4. O que a tela mostra — `app/okr/[slug]/page.tsx`

### A restrição que vem da 019, e que não pode ser quebrada

A ausência de régua sai em **UMA linha**. A 019 mediu: três linhas de prosa explicando a ausência
empurraram *"o que fazer"* para **801px** a 1280×800 — 1px abaixo da dobra. O motivo continua dito; o
parágrafo, não.

**Esta spec substitui o texto daquela linha. Não acrescenta linha.**

### Antes (genérico, idêntico para qualquer projeto sem régua)

> **Mercado** · nenhum degrau com régua e os dois lados apurados — apurar vem antes de comparar (§7.2).

### Depois (específico do degrau, mesma altura)

Quando não há destaque **e** existe pelo menos uma recusa com motivo, a linha passa a nomear o degrau
e o motivo dele. Para a Atma:

> **Mercado** · `orçamento → tratamento` não tem régua: os benchmarks de aceitação (45%–75%) medem
> aceite **depois de consulta presencial**, e a Atma não tem consulta. [fonte]

**Qual recusa aparece**: a marcada como **`armadilha`** — a única regra. Empate ou nenhuma armadilha:
a primeira da cadeia.

> 🔁 **Esta regra foi corrigida durante a implementação.** O rascunho dizia *"a do degrau mais alto da
> cadeia"*, importando a regra de desempate da §7.1. Aplicada, ela mostraria `lead→respondeu`, cujas
> fontes descartadas são métricas de B2B SaaS (MQL→SQL 13%) — que nenhum dono de clínica encontra por
> acidente. A §7.1 responde *"qual degrau consertar primeiro"*; aqui a pergunta é **outra**: *qual
> ausência, se ficar calada, faz o leitor ir buscar o número errado sozinho?* São perguntas diferentes
> e a resposta é `orçamento→tratamento`: "case acceptance rate" devolve **45%** no primeiro resultado
> do Google.

**`armadilha`** é um booleano na `Recusa`, e o critério é estreito de propósito: marca-se quando a
fonte descartada é **do setor do leitor** e **achável em cinco minutos**. Não é "esta recusa é
importante" — é "este número existe, parece a régua, e não é".

**Quando não há recusa nenhuma com motivo** (qualquer projeto que não seja a Atma): cai no texto
genérico de hoje, inalterado.

### O que a linha continua carregando

- Rótulo **diagnóstico, nunca alvo** (R6, FR-011). O texto "(diagnóstico, nunca alvo)" fica.
- Fonte visível. Em linha nova, **clicável** (FR-002).

---

## 5. Travas que continuam sendo teste, não comentário

As cinco da 015 seguem. A nº 1 é a que mais importa:

| # | trava | onde vive |
|---|---|---|
| 1 | um degrau por vez, **nunca compor duas faixas** | `test/benchmark.test.mjs` (executável) |
| 2 | só lê degrau com os **dois** lados apurados | `leituraDoDegrau`, via `razao()` |
| 3 | faixa, nunca ponto | formato de `REGUA` |
| 4 | fonte por linha, vertical declarado (R8) | campo `fonte` — agora **+ `url` + `acessadoEm`** |
| 5 | nunca vira meta de KR | saída é `razao`, nunca alvo |

**Travas novas da 020**, também executáveis:

| # | trava | como falha |
|---|---|---|
| 6 | linha **nova** sem `url` ou sem `acessadoEm` reprova | varredura em `REGUA`, ignorando as 7 legadas nomeadas |
| 7 | duas recusas não podem ter o **mesmo** `motivo` | SC-001a |
| 8 | uma `Recusa` não pode ter `media`/`elite` | `Linha` e `Recusa` são mutuamente exclusivas |
| 9 | `faixaDoSpan()` sobre uma recusa devolve `null` | protege a árvore de metas (016) |

---

## 6. Contrato da rota da Atma — `/api/market-benchmarks`

`GET /` e `GET /:id`: forma inalterada. O que muda é o **conteúdo** (ver `data-model.md §4`).

`PUT /:id` e `POST /bulk-update`: passam a **recusar** gravação cujo `source` não seja verificável
(FR-015a). Critério mínimo, e é intencionalmente grosso — trava contra reincidência, não validador de
URL:

- `source` vazio, nulo ou só espaços → **recusa**
- `source` contendo `"A definir"` (sem diferenciar maiúsculas) → **recusa**
- `source` sem `http://` nem `https://` → **recusa**

Resposta de recusa: `400`, dizendo **qual** regra falhou. Nunca ecoa credencial nem valor de ambiente
(Princípio V da constituição).

> Sem esta trava, a próxima pessoa reabastece a tabela com "A definir" e a 020 vira um `DELETE` que
> durou uma semana.
