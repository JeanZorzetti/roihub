# Contrato — cada família de medida e a sua leitura

**Feature**: `032-ctr-gap-dimensao-certa` | **Data**: 2026-09-19

O hub não expõe API pública para esta feature. As interfaces que mudam são **internas entre
módulos** — e é nelas que a FR-001 e a FR-002 são cobráveis: se a família por URL aceitar linhas por
termo, o contrato está quebrado mesmo com um número plausível na tela. Foi assim que o 0% chegou a
produção.

Entidades: [data-model.md](../data-model.md).

---

## C1 — `gscPaginas(hosts, janela, options?)`

`lib/gsc.ts` · **já existe, inalterada** (016/030) · D1.

Esta feature acrescenta **um** consumidor (a aba de aquisição) e nenhuma leitura nova. A janela e a
lista de hosts são **as mesmas variáveis** que `gscConsultas` recebe no mesmo `Promise.all` — não
duas expressões equivalentes (FR-006).

> **Cobrança**: na aba, `gscPaginas(...)` e `gscConsultas(...)` citam literalmente
> `hostsDeclarados(p)` e `curtaGsc`. Qualquer outra janela ali é a FR-006 quebrada.

---

## C2 — `kpisPorTermo(linhas, ehMarca?)`

`lib/kpis-busca.mjs` · **renomeada** de `kpisDeBusca` · D5.

```js
/** @param {LinhaBusca[]} linhas @param {((q: string) => boolean)|null} [ehMarca] */
kpisPorTermo(linhas, ehMarca) => {
  consultasUnicas: { valor: number, piso: true },
  noTop20: number,
  impressoesNoTop3: number|null,   // FICA aqui (D9) — decisão do dono
  strikingDistance: { lista, removidas },
  canibalizacao:    { lista, removidas },
}
```

Perde `urlsComImpressao` e `ctrGap` — que foram para C3. O rename é o que força a revisão do único
chamador; manter o nome antigo com o conteúdo novo deixaria a aba compilando e medindo menos.

> **Cobrança**: `grep -rn "kpisDeBusca" lib app test` devolve zero.

---

## C3 — `kpisPorPagina(paginas, indexadas?)`

`lib/kpis-busca.mjs` · **nova** · D5/D6.

```js
/** @param {LinhaPagina[]} paginas @param {number|null} [indexadas] */
kpisPorPagina(paginas, indexadas) => {
  urlsComImpressao: number,
  ctrGap: { fracao: number, avaliadas: number, abaixo: UrlAbaixo[] } | null,
  activeIndexRatio: number|null,   // null sem denominador apurado — a tela volta à contagem
}
```

`LinhaPagina` é a linha da E2: `{ pagina, cliques, impressoes, posicao, hosts }`. **Sem `query`** —
é o que faz `kpisPorPagina(linhasPorTermo)` não compilar no chamador `.tsx` (D2).

---

## C4 — `ctrGap(paginas)` — o Índice de Conformidade

`lib/kpis-busca.mjs` · **mesmo nome, entrada trocada** · D3.

```js
/** @param {LinhaPagina[]} paginas */
ctrGap(paginas) => null | {
  fracao: number,        // URLs que atingem o piso ÷ URLs avaliáveis
  avaliadas: number,     // denominador: posição dentro da faixa do balizador E com CTR
  abaixo: { url, posicao, ctr, benchmark, impressoes, cliques }[],  // ordenadas por impressões
}
```

Regras preservadas da 021, palavra por palavra: URL sem `benchmark` (posição acima de 10,9) ou sem
impressão fica **fora do denominador** e não conta como falha; `null` quando ninguém sobra — sem
denominador não há fração, e 0% mentiria.

Regra nova (D3): **nenhuma agregação**. Cada linha já é uma URL; recalcular
`posição × impressões ÷ impressões` reintroduz a deriva de ponto flutuante que a 031 removeu.

O campo de saída continua `url` (e não `pagina`) porque a lista "abaixo do benchmark" já é
renderizada por esse nome — trocar por simetria mexeria na tela sem mudar um número.

> **Cobrança (SC-001)**: com as 29 páginas da Atma na janela medida, `fracao === 0.125` e
> `avaliadas === 24`; a home está entre as avaliadas e **atinge** o piso.

---

## C5 — A fronteira de tipo

`lib/kpis-busca.mjs` · **regra de arquivo**, não função · D2.

Toda função exportada das duas famílias declara `@param` com o tipo da sua leitura. Hoje
`urlsComImpressao`, `activeIndexRatio` e `noTop20` não declaram — e por isso aceitam qualquer coisa
em silêncio, inclusive a lista errada.

> **Cobrança**: `npx tsc --noEmit` limpo, e uma função da família sem `@param` é a porta aberta que
> o próximo PR atravessa. `npm test` **não** cobre isto: a suíte não tipa nada.

---

## C6 — `porUrl()` deixa de existir

`lib/kpis-busca.mjs` · **deletada** · D4.

É a função "some as linhas por termo para formar a URL" — a operação que a FR-001 proíbe na família
por URL, e a que produziu o 0% publicado.

> **Cobrança**: `grep -rn "porUrl" lib app test scripts` só devolve o `porUrl` local de
> `lib/crux.mjs` (lista de URLs do Pass Rate, homônimo e sem parentesco).

---

## C7 — Contrato de tela (US2, FR-003/FR-005)

`app/okr/[slug]/aquisicao/page.tsx`.

1. **Base ao lado de cada medida**: toda leitura do bloco declara a base de impressões sobre a qual
   foi calculada e qual leitura a produziu (E5). Duas bases na mesma lista é a consequência que a
   spec aceita; sem a declaração, elas leem como bug.
2. **Piso por família** (D7): a régua do board vale por leitura; o medidor "de 100 impressões"
   aparece para a leitura que estiver abaixo e a nomeia.
3. **Falha isolada** (D8): cada família renderiza com a sua leitura; a ausência nomeia a leitura,
   preservando `null` × `{erro}`.
4. **Uma declaração de hosts** no cabeçalho (D14).
5. **Ressalva na leitura certa** (D15): o selo "piso, não total" e a frase das consultas raras ficam
   nas medidas por termo; o truncamento é declarado por leitura.

> **Cobrança**: `ui-verification` na aba da Atma — a lista mostra "12,5% … (24 avaliadas)" com a
> base de 24.664 ao lado, e o Top 3 continua "27,3% … (2.757 de 10.098)" com a base de 10.395.

---

## C8 — A testemunha

`scripts/conferir-soma-hosts.mjs --pagina` · **estendida** · D13.

Imprime, além do que já imprime, a tabela por URL (posição, CTR, piso da posição, atinge) e a fração
final. Importa `benchmark()` — a régua do board, que tem de ser a mesma — e **não** importa
`ctrGap`, `mesclarPorCaminho` nem a borda: a testemunha não pode ser o código que ela confere.

> **Cobrança (SC-001)**: o número impresso por ela e o número da tela são o mesmo, na mesma janela.
