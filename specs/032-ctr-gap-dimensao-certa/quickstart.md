# Quickstart — como provar que cada medida foi lida pela dimensão certa

**Feature**: `032-ctr-gap-dimensao-certa` | **Data**: 2026-09-19

Este é um guia de **validação**, não de implementação: cada seção prova um critério da spec e diz o
que reprovar. Detalhe de forma está em [data-model.md](data-model.md) e
[contracts/medida-por-familia.md](contracts/medida-por-familia.md).

## Pré-requisitos

- Node 22.18, `npm ci` feito.
- `.env` com `GOOGLE_SERVICE_ACCOUNT_JSON` para as seções de rede (4, 6). As seções 1 a 3 rodam
  sem rede.
- Janela usada nas medições desta spec: **2026-08-20 → 2026-09-16** (a de descoberta em 19/09).
  Rodar em outro dia dá outros números — o que se confere é a **igualdade entre a tela e a
  testemunha**, não o 12,5% literal.

## 1. A suíte, que é o portão (Princípio II)

```bash
npm test
```

Linha de base medida em 19/09/2026, antes de tocar em qualquer arquivo: **1085 testes, 0 falhas,
~4,7 s**. Zero arquivo de teste novo nesta feature — os casos entram em `test/kpis-busca.test.mjs`
e `test/gsc-delta.test.mjs`, já registrados em `package.json`.

## 2. O portão que `npm test` NÃO cobre (D2, C5)

```bash
npx tsc --noEmit
```

Tem de sair limpo — e é ele, não a suíte, que reprova a leitura errada num chamador tipado. Prova de
que a fronteira está de pé, feita à mão uma vez:

```bash
cat > probe-tipos.ts <<'EOF'
import { kpisPorPagina } from "@/lib/kpis-busca.mjs";
const porTermo = [{ query: "x", page: "https://x/y", cliques: 1, impressoes: 2, posicao: 3 }];
kpisPorPagina(porTermo);   // tem de reprovar: falta `pagina`
EOF
npx tsc --noEmit   # espera-se erro TS2345 nesta linha
rm probe-tipos.ts
```

Se o `tsc` passar, a fronteira é convenção e não contrato — é a condição que permitiu esta spec
existir.

## 3. As duas famílias, sem rede e sem Next (FR-001, FR-002, SC-004)

```bash
node --test test/kpis-busca.test.mjs
```

O que os casos novos têm de cobrir:

- `ctrGap` sobre linhas por página: a URL na posição 6,9 com CTR 22,5% **entra** no denominador e
  atinge; a de posição 11,8 fica fora dele e **não** conta como falha.
- `ctrGap` **não re-agrega**: uma linha com posição `3.9` e 1.146 impressões sai com `3.9`, não com
  `3.8999999999999995` (D3).
- `kpisPorTermo` devolve o MESMO valor de hoje para `impressoesNoTop3`, `strikingDistance`,
  `canibalizacao`, `consultasUnicas` e `noTop20` com a mesma entrada — é a SC-004 em forma de teste.
- `kpisPorPagina` sem denominador de indexação devolve `activeIndexRatio: null` e a contagem fica.

## 4. A testemunha independente (SC-001, SC-002, SC-003)

```bash
node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --pagina
node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --consulta
```

Medido em 19/09/2026, antes da mudança — é a linha de base da feature:

| | `--consulta` | `--pagina` |
|---|---:|---:|
| impressões | 10.395 | **24.664** |
| cliques | 190 | **434** |
| chaves distintas | 989 pares | **29 páginas** |

Depois da D13 o modo `--pagina` imprime também a tabela por URL e a fração: esperado **12,50% · 24
avaliadas · 3 atingem**, com `https://usealigner.com/` entre as avaliadas (posição 6,93 · CTR
22,49% · piso 4,5%).

## 5. A aba de aquisição (US1, US2 — SC-001, SC-003, SC-005)

```bash
npm run dev   # http://localhost:3000/okr/atma/aquisicao
```

No bloco "Consultas — Search Console, 28 dias":

1. **O Índice de Conformidade** diz `12,5% … (24 avaliada(s))`. Hoje diz `0% … (6 avaliada(s))`.
   Se continuar 0%, a leitura não trocou.
2. **Cada medida declara a base**: as de URL sobre **24.664**, as de termo sobre **10.395**. Uma
   medida sem base é a FR-003 não cumprida — e é ela que impede o bloco ler como bug.
3. **O Top 3 não se move**: `27,3% das impressões no Top 3 (2.757 de 10.098)`. Qualquer outro
   número aqui é a SC-004 reprovada.
4. **Uma só linha de hosts** no cabeçalho do bloco (D14).
5. `ui-verification` na largura de celular também: a base ao lado de cada leitura não pode empurrar
   a coluna do valor.

## 6. Falha isolada (FR-005, D8)

Com o Next rodando, derrube **uma** leitura de cada vez (o jeito mais barato é um `throw` temporário
dentro do `buscar` de `gscPaginas` e depois o mesmo em `gscConsultas`):

- leitura por página caída → as medidas por termo continuam na tela; as de URL somem **nomeando a
  leitura por página**.
- leitura por termo caída → o inverso.
- as duas caídas → o bloco inteiro some, como hoje.

O que reprova: qualquer versão em que a falha de uma esconda as medidas da outra, ou em que a frase
diga só o host sem dizer qual leitura caiu.

## 7. O que NÃO pode mudar

- Os valores por termo (SC-004) — seção 3 e item 3 da seção 5.
- A régua de CTR (`BENCHMARK`) e a janela de descoberta (28 dias).
- O denominador da indexação (`denomIdx`), que vem do banco e não das leituras.
- O comportamento de projeto **sem** consultas raras: com as duas leituras iguais, nenhum veredito
  que já estava correto inverte.
- `lib/okr-coleta.ts` e a ficha: continuam com a chamada de páginas que já faziam.

**Muda de propósito**: o Pass Rate de Core Web Vitals (D11) — a amostra passa a sair de 29 URLs em
vez de 14, "não consultadas" vai de 4 para 19, e o número pode mudar. Confira que o custo não mudou:
continuam 10 consultas ao CrUX (`CAP_URLS_PASS_RATE`).

## 8. Antes do push

```bash
npm test && npx tsc --noEmit
grep -rn "kpisDeBusca\|porUrl" lib app test scripts   # só o porUrl homônimo de lib/crux.mjs
```

E a janela do Princípio IV: **nada de push entre 23:30–01:00 e 08:00–08:45 BRT**. O deploy do
EasyPanel leva ~15 min e a tela precisa ser conferida **duas** vezes depois dele.
