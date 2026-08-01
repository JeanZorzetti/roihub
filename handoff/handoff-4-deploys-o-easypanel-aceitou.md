# Handoff — as 4 hipóteses de deploy viraram 2, e a que a casa documentou foi REFUTADA (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-proximo-passo-4-deploys-presos.md`](handoff-proximo-passo-4-deploys-presos.md)
> (a spec que mandou investigar o EasyPanel antes de tocar em arquivo).
> Índice: [`../handoff.md`](../handoff.md).

Esta sessão **não editou uma linha de código de produção**, e era esse o trabalho: a spec anterior
mandava descobrir a CAUSA antes de qualquer conserto, e listava 4 hipóteses em ordem. Duas caíram
com evidência, incluindo a mais provável.

**Os 4 continuam em 404 às 20:21 BRT** — `aftercare`, `context`, `reviewshield`, `estetia`.

---

## 1. O que caiu, e com que evidência

### ❌ Hipótese 1 — "o webhook do GitHub não está ligado nesses 4" — REFUTADA

Os 4 têm webhook **ativo**, apontando para o mesmo host de deploy do EasyPanel
(`2.24.207.200:3000/api/deploy/<token>`), e a entrega do push do `llms.txt` saiu **200 OK**:

| repo | hook | entrega do push | status |
|---|---|---|---|
| `Atma` ✅ subiu | 659078481 | `2026-08-01T22:51:36Z` | 200 OK |
| `nimblabs` ✅ subiu | 640431513 | `2026-08-01T22:51:40Z` | 200 OK |
| **`aftercare-nimblabs`** ❌ | 640180303 | `2026-08-01T22:51:37Z` | 200 OK |
| **`context-keeper`** ❌ | 640209868 | `2026-08-01T22:52:10Z` | 200 OK |
| **`review-dispute`** ❌ | 640259460 | `2026-08-01T22:52:13Z` | 200 OK |
| **`estetia-demo`** ❌ | 640964400 | `2026-08-01T22:52:15Z` | 200 OK |

**Os que subiram e os que não subiram receberam o hook no MESMO minuto, pelo mesmo caminho, com a
mesma resposta.** O `orion` é o único fora do padrão: **não tem webhook nenhum** e mesmo assim
serve o arquivo novo — ele sobe por outro caminho, e por isso não é grupo de controle de nada.

**🚩 E o `200` é evidência de verdade, porque foi CONTROLADO:** `POST` no mesmo endpoint com um
token inventado devolve **`404 {"message":"Invalid Token"}`**. Então 200 significa que o token é
válido, o serviço existe e **o EasyPanel ACEITOU o pedido de deploy dos quatro**. Sem esse
controle, "webhook 200" seria a mesma classe de "site em 200": um status que parece prova e não é.

### ❌ Hipótese 3 — o incidente de junho (`HEALTHCHECK` trava o rolling update) — REFUTADA, e INVERTIDA

A previsão testável era: serviço **com** `HEALTHCHECK` congela na imagem velha. O `Dockerfile` de
cada repo diz o contrário:

| repo | `HEALTHCHECK` | deploy |
|---|---|---|
| `Atma` | **1** | ✅ subiu |
| `orion-nova-ui` | **1** | ✅ subiu |
| `nimblabs` | 0 (removido no incidente) | ✅ subiu |
| `aftercare-nimblabs` | **0** | ❌ |
| `review-dispute` | **0** | ❌ |
| `estetia-demo` | **0** | ❌ |
| `context-keeper` | (sem `Dockerfile` na raiz — mora em `apps/web/Dockerfile`) | ❌ |

**Quem tem healthcheck subiu; quem não tem, travou.** O eixo não separa os grupos. A hipótese que a
casa tinha documentado por escrito, depois de um incidente real, **não explica este.** Continua
verdadeira como incidente de junho — só não é este defeito.

### ❌ Hipótese 4 — cache de borda — REFUTADA

`curl -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' https://<host>/llms.txt?cb=<random>`
nos quatro: **404 nos quatro**. Um comando, como a spec previu.

### ✅ O que os 4 SÃO, e isto é medida, não suposição: imagem VELHA em execução

Não é "o arquivo não foi servido" — é **o container nunca trocou**:

- `reviewshield` serve o `robots.txt` de **04/06/2026**. O `app/robots.ts` do `main` tem
  `allow: ['/blog', '/llms.txt']`; **produção serve `Allow: /blog` sozinho**, sem a linha do
  `llms.txt`, que é exatamente o que o commit `4d47b76` adicionou.
- `reviewshield` devolve **404 no `globe.svg`** — o defeito que o `COPY public/` do mesmo commit
  consertava. Se a imagem nova estivesse rodando, seria 200.
- `aftercare`, `context` e `estetia` servem `robots.txt` **sem uma linha de `GPTBot`**, enquanto o
  `robots.ts` do `main` tem, nos três.

### ⚠️ A armadilha que quase virou achado, e é a MESMA do `GEO-01`

`grep -c GPTBot` no `robots.txt` servido do `reviewshield` devolve **1**, e por 30 segundos isso
pareceu "a imagem nova está no ar, o defeito é outro". **É a palavra, não a permissão.** O
`review-dispute` cita `GPTBot` desde o commit `40cfb80` de **04/06/2026** — cujo título é *"block
AI bots from app surfaces"*. Só ler o CORPO inteiro e comparar com o `HEAD` mostrou que aquilo era
o robots de junho. **Contagem de palavra dá o sinal invertido pela terceira vez nesta casa**
(`palavra ≠ URL` no `gateways.mjs`, `GPTBot` no `conformidade.mjs`, e agora aqui).

---

## 2. O que sobrou: DUAS hipóteses, as duas dentro do painel

O EasyPanel aceitou o pedido (200 com token válido) e o container não trocou. Sobra:

1. **O build rodou e FALHOU** — o container velho segue servindo e ninguém percebe de fora. **É a
   primeira a olhar: é ler o log do build dos 4 serviços.**
2. **O token do webhook deploya um serviço que NÃO é o que serve o domínio** — dois serviços para o
   mesmo projeto, domínio pendurado no antigo. O 404 do token inválido prova que o serviço-alvo
   existe; **não prova que é o serviço certo.** Conferir de qual serviço pende o domínio de cada um
   dos 4.

**Não dá para separar as duas de fora.** Precisa do painel — é o item 5 da lista de "não é tarefa de
agente" da spec anterior, e continua sendo.

⚠️ **Continua valendo: não redeploye no braço antes de saber qual das duas é.** Com 4 serviços no
mesmo estado e 3 vizinhos sãos, um redeploy manual que funciona apaga a única amostra que existe.

---

## 3. O portão não mudou

```
node --env-file=.env scripts/conformidade.mjs
```

`GEO-01` **25 → 21** · violações **38 → 34** · **nenhum dos 21 restantes muda de balde**. Abaixo de
21 é o CHECK que mudou. Conferir o **CORPO** (`# <nome do projeto>`, `text/plain`), nunca o status.

**Não rodei o conformidade nesta sessão**, de propósito: nada foi entregue em produção, os 4 seguem
em 404 medidos um a um, e são ~140 requisições para reimprimir 38. Número que não pode ter mudado
não se remede.

---

## 4. O que NÃO fazer (herdado, e agora com uma linha a mais)

- ❌ **Reescrever ou recommitar os `llms.txt` dos 4.** Estão certos no `main`. Agora está PROVADO
  que a imagem em execução é velha — o repo está fora de suspeita por medida, não por confiança.
- ❌ **Voltar a investigar webhook, `HEALTHCHECK` ou cache.** Os três foram medidos e caíram; a
  tabela de cada um está no §1 para não custar o tempo de novo.
- ❌ **Contar palavra em `robots.txt`** (§1, a armadilha). Ler o corpo e comparar com o `HEAD`.
- ❌ Concluir deploy por 200 — nem do site, nem do webhook.
- ❌ Mexer no `claudeloop` · resubmeter sitemap · medir `D-84` antes de 15/08 · descongelar o
  detector sem responder "para quê" · caçar bug nos 33,6% do `roilabs.com.br`.
- ❌ Reescrever handoff datado.

⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
