# Contrato — a leitura ao vivo da série do Search Console

**Feature**: `031-serie-ao-vivo-soma-hosts` | **Data**: 2026-09-19

O hub não expõe API pública para esta feature. As interfaces que mudam são **internas entre
módulos**, e é nelas que a FR-007 é cobrável: se as quatro leituras não passarem pelo mesmo
resolvedor, pelo mesmo laço e pela mesma soma, o contrato está quebrado mesmo com os números certos
na tela.

Entidades referenciadas: [data-model.md](../data-model.md).

---

## C1 — `hostsDeclarados(projeto) → string[]`

`lib/projects.mjs` · **já existe, inalterada.** Único resolvedor de host do hub (FR-001, D1).
Esta feature acrescenta quatro consumidores e **nenhuma** lista paralela.

> **Cobrança**: `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx lib app`
> não pode devolver linha nova fora de `lib/projects.*` e do que a 030 já deixou.

---

## C2 — `lerHosts<T>(hosts, buscar, client?)` — o laço único

`lib/gsc.ts` · **novo (extraído de `lerPorHosts`)** · D2.

```ts
lerHosts<T>(
  hosts: string[],
  buscar: (client: RequestClient, propriedade: string, host: string) => Promise<T>,
  client?: RequestClient,
): Promise<{ respostas: { host: string; propriedade: string; dados: T }[]; encerrados: string[] }
          | { erro: string } | null>
```

| # | Regra | FR |
|---|---|---|
| 1 | `hosts` vazio → `null`, **sem** requisição | FR-006 |
| 2 | env `GOOGLE_SERVICE_ACCOUNT_JSON` ausente → `null`, sem rede | como hoje |
| 3 | Uma chamada de `buscar` por host, **em série**, na ordem declarada | 030/D7 |
| 4 | Host sem propriedade → `encerrados`, a leitura segue com os vivos | 029, 030 |
| 5 | Host que lança → `{erro: "<host>: <msg ≤ 60>"}`; **nenhuma** resposta é devolvida | FR-004 |
| 6 | Falha em `listSites()` → `{erro}` nomeando TODOS os hosts (não é de um host) | 030 |
| 7 | Nenhum host vivo → `null` | como hoje |
| 8 | `getClient()` fica **fora** do `try` — o `JSON.parse` cita o texto da env (D6) | Princípio V |

**Não faz**: soma, ordenação, decisão de janela. Quem soma é a função pura do chamador.

> **Cobrança**: `grep -c "resolveProperty(" lib/gsc.ts` cai de **6 para 5** — a chamada que sai é a
> da `gscTrend`, que passa a resolver pelo laço. As cinco que ficam são a definição e quatro
> chamadas, todas com motivo: `lerHosts`; `gscConnection` (`inspectUrl`, de UM host por natureza); e
> as duas primitivas de um host que esta feature **não toca** — `gscSerieDeUmHost` (corpo preservado
> byte a byte, C3.1) e `gscSerieFiltrada` (as três pernas de marca, só a corrida usa). Uma **sexta**
> linha depois da entrega é uma leitura ao vivo resolvendo propriedade por fora do laço: a porta
> errada reaberta. Medido em 19/09/2026: 6 (linhas 68, 229, 262, 356, 392, 464).

---

## C3 — `gscSeries(hosts, janela?, options?)`

`lib/gsc.ts` · **assinatura nova** (o nome é o mesmo; o tipo do primeiro parâmetro mudou de
propósito — D1). Consumidores: `aquisicao/page.tsx`, `app/seo/page.tsx`, `lib/okr-coleta.ts`.

```ts
gscSeries(
  hosts: string[],
  janela: { inicio: string; fim: string } = { inicio: isoDaysAgo(86), fim: isoDaysAgo(3) },
  options: { client?: RequestClient } = {},
): Promise<GscSerieSomada>   // { property, days, hosts, encerrados } | { erro } | null
```

| # | Regra | FR |
|---|---|---|
| 1 | Consulta cada host pela dimensão `date` (`queryTimeseries`, `rowLimit` 2000) | FR-001 |
| 2 | `days` = `somarSeriesPorHost(respostas.map((r) => ({ host: r.host, days: r.dados })))` — **não há segunda implementação** | FR-002 |
| 3 | O dia presente num host e ausente no outro entra com o que existe | Edge |
| 4 | Mesma data nos dois hosts → **uma** linha, métricas somadas, posição ponderada | US1.2 |
| 5 | A janela default é `D-86 → D-3`, byte a byte, e é calculada UMA vez, fora do laço | D5 |
| 6 | Um host só → uma requisição por janela e `days` idênticos aos de hoje, posição inclusive | FR-006 |
| 7 | Dia sem impressão **permanece**, com `position: 0` (o `null` da soma volta a 0). **Corrigido na implementação:** a versão anterior desta regra descartava o dia, sob a premissa de que "o Google não devolve linha sem impressão" — falsa, medida em 19/09/2026: o Google devolve `impressions: 0, position: 0` (2 de 244 dias em `atma.roilabs.com.br`, 3 de 7 em `usealigner.com`). Descartar encurtava "dias com dado" (242 na tela contra 244 na testemunha) e deslocava a borda da janela recebida de um projeto de um host | FR-006 |
| 8 | `property` = propriedade do primeiro host vivo | D7 |
| 9 | Falha → `{erro}` que COMEÇA pelo host; nenhum `days` | FR-004 |

**O `.map()` da regra 2 não é estilo.** `lerHosts` devolve `{host, propriedade, **dados**}` e
`somarSeriesPorHost` lê `s.**days**` (`lib/serie-gsc.mjs:75`). Passar `respostas` cru **compila**:
o tipo do JSDoc tem todas as propriedades opcionais e `host` em comum, então o TypeScript aceita e a
soma devolve `[]` — série vazia, sem erro, sem aviso. `tsc --noEmit`, que é o único portão que
`gscSeries` tem, não pega. Quem pega é o teste da T010 ("dois hosts somam e o total fecha").

**Campo removido: nenhum.** `.days`, `.property` e `.erro` continuam com o significado de hoje.

### C3.1 — A primitiva de um host

`gscSerieDeUmHost(siteUrl, inicio, fim)` — **é o `gscSeries` antigo, renomeado** (D3). Consumidor
único: `app/api/gsc-serie/route.ts`. **Comportamento idêntico**; só o nome muda.

> **Cobrança**: `grep -rn "gscSerieDeUmHost" app lib` devolve **só** `route.ts` e a definição. Um
> chamador de leitura ao vivo aparecendo aqui é a porta errada reaberta.

---

## C4 — `gscTrend(hosts, options?)`

`lib/gsc.ts` · **assinatura nova**. Consumidor: `lib/evaluate.ts` → home e agenda.

```ts
gscTrend(hosts: string[], options?: { client?: RequestClient }): Promise<GscTrend>
// { current, previous, property } | null
```

| # | Regra | FR |
|---|---|---|
| 1 | Por host, as **duas** janelas: `D-31→D-3` e `D-59→D-32` (`queryClicks`), como hoje | Assumptions |
| 2 | `current` e `previous` = soma dos cliques dos hosts vivos, **por janela** | US3 |
| 3 | Um host só → duas requisições, o número de hoje | FR-006 |
| 4 | Qualquer falha — host que lança, env malformada, sem propriedade — → `null` | D6 |
| 5 | As quatro datas são calculadas UMA vez, fora do laço | D5 |
| 6 | As duas janelas **de um host** ficam no `Promise.all` de hoje; o que roda em série são os HOSTS (C2.3). Teto em voo: 2 requisições, nunca 2×N | FR-006 |

> `null` é o contrato existente: o consumidor cai em `seoSeed`. **Nada parcial é publicado**; nomear
> o host é impossível aqui porque a forma não tem onde (D6).

---

## C5 — `somarSeriesPorHost(series)` — a correção do voto único

`lib/serie-gsc.mjs` · **alterada** (D4). O contrato antigo continua; acrescenta-se:

| # | Regra |
|---|---|
| 1 | Dia com **um** voto de posição → `position` é o valor recebido, sem passar por `× imp ÷ imp` |
| 2 | Dia com dois ou mais votos → média ponderada por impressões, como hoje |
| 3 | Dia sem voto (nenhuma impressão) → `null`, nunca 0, como hoje |

Prova mínima: `3,9` com `1146` impressões devolve **exatamente** `3,9` (hoje: `3,8999999999999995`).

---

## C6 — Contrato de tela (FR-003, FR-005)

`app/okr/[slug]/aquisicao/page.tsx`. Um componente — `HostsDaLeitura` — recebe `{hosts, encerrados}`
e é usado no bloco de **série** e no de **consultas**. A frase é a que a 030 já publica; **sem string
nova**.

| Estado | O que a tela diz |
|---|---|
| um host, nenhum encerrado | nada de novo (FR-006: a tela de hoje) |
| dois ou mais | "hosts somados: a + b", nomeados |
| algum em `encerrados` | o host, e que está sem propriedade e fora da soma |
| série `{erro}` | `Search Console indisponível (<host>: …)` — o texto de hoje, agora com o host |

A régua da janela (`ReguaJanela`) passa a declarar a **união** dos dias dos hosts — a fonte segue
autodeclarando, sem campo novo.

> **Cobrança**: `grep -c "HostsDaLeitura" app/okr/[slug]/aquisicao/page.tsx` ≥ 3 (definição + dois
> usos). Menos que isso é FR-005 em risco.
