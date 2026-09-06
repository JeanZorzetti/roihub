# Contrato — as duas rotas novas, a orquestração compartilhada e as janelas longas

**FRs**: FR-018..FR-029, FR-030..FR-033, FR-007, FR-021

---

## 1. `lib/ficha-dados.ts` — a orquestração, movida

Hoje `FichaPage` (`app/okr/[slug]/page.tsx:381-547`) faz, em linha reta: dispara `evaluateAll()`,
coleta, `montarFicha()`, `posicaoDeAtaque()`, `resolverTicket()`, `projetar()`, `montarArvore()`,
`montarNiveis()`. Três telas passam a precisar disso.

```ts
/** A composição da ficha, uma vez só. Existe porque a FR-021 exige que a ação citada na dobra e a
 *  citada em N6 venham da MESMA chamada de `evaluateAll()` — duas telas montando por conta própria
 *  é o defeito que a 018 matou nos degraus, um nível acima. */
export async function dadosDaFicha(slug: string): Promise<DadosDaFicha | null>
```

Devolve `{ p, ficha, veredito, mercado, projecao, arvore, niveis, janelas, motivos, orcamentos,
valorEmRisco, buracos, pendentes, cliques, impressoes, ... }` — os mesmos nomes de hoje, para o
diff da página ser de **ordem**, não de renomeação. `null` quando o projeto não existe (a página
chama `notFound()`).

**Nenhuma regra nova mora aqui.** É borda: `pg`, `google-auth-library`, `evaluateAll()`. Toda
decisão continua em `.mjs` (Princípio III).

---

## 2. `/okr/[slug]` — a ordem nova

`export const dynamic = "force-dynamic"` **fica** (o motivo de sempre: número vindo do build é
número de outra janela).

Ordem dos blocos, sem nada entre eles e o `<h1>` (FR-001):

| ordem | bloco | conteúdo |
|---|---|---|
| 1 | **Cadeia** | degraus + taxas + janela de CONVERSAO com a época declarada + o pior degrau marcado. **Legenda**: `veredito.rotulo` / `veredito.motivo` (FR-002a — "Onde trava" deixa de existir como bloco). **Uma linha abaixo**: a régua de mercado, diagnóstico e nunca alvo (FR-006) |
| 2 | **Motivo + ação, num bloco só** | `motivos.motivos[0]` colado à ação de `evaluateAll()` (FR-003). Sem `motivo` na fonte (`aftercare`) o bloco é **omitido**, não preenchido com placeholder, e a ordem dos demais não muda (US1-AC5) |
| 3 | **Buracos** | `<Buracos>` — ver `buracos.md` |
| 4 | **Placar** | `<Projecao>` (os dois lados, FR-012) + `<ValorEmRisco>` |
| 5 | link único | **um** link para `/okr/[slug]/metodo`. O índice de âncoras `N0…N6` sai (FR-007) |

**O pior degrau é `posicaoDeAtaque()` e ponto** (FR-002). `indiceTrava()` já aponta o diagrama para
a mesma célula do veredito — a função sobrevive intacta, e é ela que garante a régua única.

Some da ficha: `<nav className="tabs ficha-indice">`, os sete `<section>` de N0–N6, o bloco "Árvore
de metas", "Onde trava" como bloco, "Quanto falta" como bloco separado do valor em risco. O bloco
"Descoberta" **fica onde está** (FR-024a), agora declarando a janela curta e linkando a longa —
renderiza só quando `marcos[0]` é `visitante`, ou seja, perfis A/B, nunca a atma.

---

## 3. `/okr/[slug]/metodo`

```ts
export const revalidate = 3600;               // FR-028a
export async function generateStaticParams()  // opcional; a rota é do TEMPLATE (FR-018)
```

- Os sete níveis N0–N6, com o **mesmo** conteúdo de hoje, montados por `montarNiveis()` via
  `dadosDaFicha()`.
- **Mais a árvore de metas da 016** (`<Arvore>`, sem mudança de componente).
- Link de volta para a ficha, e link da ficha para cá (FR-020).
- Responde para os **17** projetos (SC-005). Projeto inexistente → `notFound()`.

**`montarNiveis()` não muda de saída** (FR-019). A suíte de N0–N6 passa **sem uma linha editada** —
teste de N0–N6 reescrito é sinal de escopo estourado, não de progresso (US4-AC2).

---

## 4. `/okr/[slug]/aquisicao`

```ts
export const revalidate = 3600;               // FR-028a
```

| bloco | fonte | janela pedida | função |
|---|---|---|---|
| Descoberta | GSC | **8 meses** fechando em D-3 | `descobertaLonga()` → `gscSeries(url, inicio, fim)` |
| Comportamento | GA4 | **12 meses** fechando em D-3 | `comportamentoLongo()` → `ga4Canais(prop, janela)` + `ga4Cobertura(prop, janela)` |

Regras da tela:

- Cada número carrega **a janela que a fonte deu**, não a pedida (FR-027). GSC: `days[0].date` /
  `days.at(-1).date`. GA4: `ga4Cobertura()`. Truncamento é nomeado — nunca se rotula de 12 meses um
  dado de 3.
- Cada tela **cita a outra pelo nome** (FR-026): a ficha diz "28 dias — série de 8 meses em
  Aquisição"; aqui diz "8 meses — a célula `visitante` da ficha usa 28 dias".
- **Nenhuma taxa entre `cliques` (GSC) e `sessões` (GA4)** (FR-029). São cadeias diferentes: na
  época são 599 contra 1.140, porque o GSC vê só busca orgânica. Uma asserção de teste garante que
  nenhuma razão cruza as duas séries (SC-008).
- A página **declara que a cadência de leitura dela é trimestral** (FR-028). O leitor precisa saber
  que não é uma tela de segunda-feira.

### `lib/gsc.ts` — parâmetros opcionais, default intocado (FR-025)

```ts
export async function gscSeries(
  siteUrl: string,
  inicio: string = isoDaysAgo(86),
  fim: string = isoDaysAgo(3),
): Promise<GscSeries>
```

O mesmo default alimenta o portfólio inteiro; chamada sem os dois argumentos sai **byte a byte**
igual à de hoje. `totals28()` continua fatiando 28 e não é tocada.

### `lib/ga4.ts` — `ga4Cobertura()`

```ts
/** Primeiro e último dia COM DADO dentro da janela pedida. A Data API não devolve a data de
 *  criação da propriedade nem a retenção configurada — sem esta sonda não há como cumprir a
 *  FR-027 e "12 meses" viraria rótulo sobre um dado de 3. Uma chamada a mais numa página servida
 *  por ISR de 1 h e lida uma vez por trimestre. */
export async function ga4Cobertura(propertyId: string, janela: {inicio: string; fim: string})
  : Promise<{ primeiro: string; ultimo: string } | { erro: string } | null>
```

Dimensão `date`, métrica `sessions`; min e max locais. **Não** se acrescenta `date` às dimensões de
`ga4Canais()`: mudaria a forma do retorno para todos os consumidores para servir um só (mesmo
argumento da 016 em `gscPaginas`).

---

## 5. `lib/arvore-metas.mjs` — a costura da época

Substitui `lib/arvore-metas.mjs:176`:

```js
// FR-031: nome de marco não prova que as janelas batem — foi a trava certa na 018 porque era a
// única disponível. Agora a árvore exige a COINCIDÊNCIA: a série do GSC tem que CONTER a janela de
// Conversão. A época da atma (37 dias) cabe inteira dentro dos 84 que gscSeries() já busca, então
// a camada sai fatiando a série existente — sem chamada nova.
const cobre = ctr?.janela
  && ctr.janela.inicio <= janelaConversao.inicio
  && ctr.janela.fim    >= janelaConversao.fim;
if (!parou && i === 0 && cobre && divide(ctr)) { /* camada de impressões */ }
```

Quando `ctr.janela` **não** contém a de Conversão, a árvore **para e nomeia** o que faltou
(FR-033): `parou = { nome: "impressões", motivo: "a série do Search Console começa em <data>, depois do início da época (<data>) — compor períodos diferentes seria inventar o dado" }`. Nunca compõe.

Projeto **sem** `epoca` mantém o comportamento de hoje (FR-032): a janela de Conversão é 28d/D-3 e
a contenção falha onde já falhava.

**Trava da 016 preservada**: no máximo **uma** faixa de mercado na descida, e nenhuma vira meta de
KR (US6-AC4, R6).

### Testes obrigatórios (`test/arvore-metas.test.mjs`)

| # | Dado | Espera |
|---|---|---|
| 1 | `ctr.janela` contendo a de Conversão | camada de impressões entra, usando a janela da época |
| 2 | projeto sem `epoca` | árvore para exatamente onde para hoje |
| 3 | `ctr.janela.inicio` **depois** do início da época | `parou` preenchido, nomeando o que faltou — **e nenhuma camada de impressões** |
| 4 | a descida completa | no máximo uma faixa de mercado |

O teste 3 é a bomba-relógio desta decisão: para a atma ele passa a ser o caso real em **2026-10-23**,
quando a época ultrapassar os 84 dias do GSC.
