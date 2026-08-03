# Handoff — a gramática da pergunta era o termo mais raro, e por isso um detector de handoff (03/08/2026, manhã)

> Sessão anterior: [`handoff-a-sonda-virou-script-e-o-403-nao-datou.md`](handoff-a-sonda-virou-script-e-o-403-nao-datou.md)
> (a sonda virou `scripts/probe-pool.mjs`; a pendência era datar o 403 com janela LARGA).
> Índice: [`../handoff.md`](../handoff.md) · doc da feature: [`../docs/busca/`](../docs/busca/).

`npm test` **273 verdes** · `tsc --noEmit` limpo · `npm run validade` 0 achados · **zero chamada de
LLM nesta sessão** · pool intocado (3 contas, 1 viva).

---

## 0. A tarefa do handoff anterior NÃO era executável, e rodá-la seria o defeito

O handoff pedia: sondar de novo **com janela larga** e `--gravar`. A 3ª leitura foi **07:59**; esta
sessão abriu **08:05**. Seis minutos.

O próprio handoff anterior nomeia isso: *"a próxima leitura útil é a que abre janela larga — dias,
ou depois de um ciclo de reset —, não a próxima que alguém rodar por hábito."* Sondar às 08:05
gravaria uma quarta linha idêntica em `data/pool-sondagens.json` e **compraria zero janela**. O item
2 do handoff era "nada do portão". Então a lista executável estava vazia, e o que sobrou foi o §4:
**as 5 piores em recall@10, todas em 0,0%** — que se ataca com **zero pool**.

---

## 1. 🚩 O achado: o BM25 estava certo, e a consulta é que estava errada

`estado` fazia **0,0% em @1** contra 89,5% em @10 de `protocolo`. A leitura fácil ("o vetor/reranker
não resolve `estado`") estava disponível havia sessões. O que a medição diz é outra coisa.

Rodando as 5 zeradas e imprimindo o **idf de cada termo da pergunta** e a **cobertura dele por tipo
de doc** (`node scripts/avaliar.mjs --motor bm25` + uma sonda de 20 linhas, sem LLM):

| token | em N das 85 | idf | % handoff | % protocolo |
|---|---|---|---|---|
| `posso` | 9 | **5,5** | 1% | **0%** |
| `vou` | 5 | 4,4 | 5% | 0% |
| `preciso` | 5 | 4,0 | 4% | 1% |
| `quantos` | 7 | 2,7 | **29%** | **0%** |
| `qual` | 3 | 2,1 | 40% | 3% |
| `onde` | 6 | 1,3 | **70%** | 8% |
| `ele` | 7 | 1,0 | **91%** | 9% |

**Os termos de MAIOR idf das perguntas eram a gramática delas.** Em `D-66` ("Quantos projetos o hub
tem hoje e de onde vem essa lista?") os dois primeiros colocados em idf são `quantos` (2,7) e `essa`
(2,0) — à frente de `hub`, `lista` e `projetos`. O BM25 fez exatamente o que deve fazer: premiou o
documento que tinha as palavras raras da consulta. Só que as palavras raras eram **registro
conversacional, não assunto** — e quem escreve em registro conversacional nesta casa é o handoff.
`posso` sozinho (idf 5,5, presente em UM handoff e em ZERO protocolo) dava a um doc arbitrário um
pico que nenhum termo de conteúdo alcança.

Por isso a camada `estado` — as perguntas em língua natural — ia mal, e a `protocolo` — perguntas em
jargão — ia bem. **Não era a recuperação, era o registro da pergunta.**

Descartados antes de chegar aqui, e vale registrar para ninguém refazer: **não é parâmetro do BM25**
(`k1=1.5`, `b=0.75`, normalização por comprimento presente e correta em `lib/bm25.mjs:43`) e **não é
título fora do índice** (`textoProtocolo` já concatena `p.titulo`, e memória indexa o arquivo
inteiro).

## 2. O conserto: uma lista de vazios em `tokenizar`, ~1 linha

```js
return t.filter((x) => x.length > 1 && !VAZIOS.has(x));
```

| recall@10 | antes | depois |
|---|---|---|
| **todas** | 77,7% | **81,1%** |
| `estado` | 30,6% | **46,1%** |
| `estado` @1 | **0,0%** | 11,1% |
| `protocolo` | 89,5% | 90,3% |
| perguntas em 0,0% | **8** | **2** |

Das 5 nomeadas no handoff anterior, **`D-66`, `D-70` e `D-71` saíram do zero**. Continuam em 0,0%
só `D-73` e `D-85`, e as duas são **outra classe** (§4).

Duas decisões de projeto, as duas medidas:

- **Filtra na `tokenizar`, que indexa E consulta.** Tirar só do lado da consulta deixaria `d.len` —
  o denominador do BM25 — inflado pelos mesmos vazios, que é metade do defeito.
- **`nao` fica FORA da lista.** A casa escreve norma como negação e o idf dele é 0,1: não paga o
  risco. `diz`, `novo` e `proprio` também ficam fora — verbo e adjetivo carregam assunto. **Palavra
  nova só entra medida contra o dourado**, a mesma regra das âncoras do detector.

Teste no `npm test` (`test/busca.test.mjs`), que amarra as três coisas: a pergunta do `D-66`
tokenizada, `nao` sobrevivendo, e o doc perdendo os MESMOS tokens que a consulta.

---

## 3. 🚩 O efeito colateral que precisa de decisão: o `--min bm25` REPROVOU o híbrido

```
── hibrido — 85 perguntas
recall@k       @1     @3     @5    @10    @20    @50
todas       30.8%  63.2%  69.8%  79.3%  85.1%  88.3%

✗ recall@10 79.3% abaixo do piso 81.1%
```

**O vetor estava em parte compensando o defeito do BM25.** Com o BM25 consertado, a fusão **dilui**
em @10. A comparação é limpa: `lib/denso.mjs` **não usa `tokenizar`** (chunka texto cru, cache
keyed por hash do texto), então a metade densa é byte-idêntica à de antes — só o BM25 mudou.

**Não desligue o vetor por causa disso.** Ele ganha onde alimenta o resto:

| | BM25 | híbrido |
|---|---|---|
| @20 | 83,5% | **85,1%** |
| @50 | 87,8% | **88,3%** |
| `estado` @20 | 48,3% | **56,1%** |

É o **top-50 da fusão** que vai para o reranker (`CANDIDATOS`), e lá o híbrido ainda é melhor.
Decidir a fusão exige a corrida do rerank — que é exatamente a que o pool não paga hoje.

## 4. 🚩 O ganho do reranker ficou SEM MEDIÇÃO, e o rodapé já diz isso

Os **81,1% do rerank** são de 03/08 de madrugada, medidos contra um híbrido de **77,1% que não
existe mais**. E o número que ele alcançava gastando 1 chamada de claude-cli por busca é **o mesmo
81,1% que o BM25 sozinho agora faz de graça**.

Isso **não** quer dizer que o reranker virou inútil — quer dizer que **ninguém sabe**, porque o
baseline dele foi trocado. O `+4,0 sobre o híbrido` não se cita mais, e foi apagado do comentário
em `app/busca/page.tsx` e do `CLAUDE.md`.

Remedir custa **85 chamadas contra 1 conta viva de 3**. Até lá o rodapé da `/busca` marca o número
**dentro do texto** ("…ANTES da lista de vazios do BM25 — defasado"), nunca como aviso ao lado:
esta base já pagou duas noites de pool para aprender que **aviso perde para percentual**.

---

## 5. O que a próxima sessão roda

1. **Remedir o portão do rerank** (`--motor rerank --min bm25`) **quando o pool permitir** — é a
   única coisa que responde se as 2 chamadas por busca ainda se pagam. Sonde antes
   (`scripts/probe-pool.mjs`, ~40 s).
2. **Sondar o pool com janela LARGA** e `--gravar` — continua pendente e continua sendo dias, não
   minutos. Última leitura: 03/08 07:59.
3. **`D-73` e `D-85` são a outra classe: descasamento de VOCABULÁRIO, não de registro.** `D-85`
   pergunta "Quanto o **Googlebot rastreia** cada **propriedade**" e o alvo `SEO-05` fala "**Crawl
   Stats** do GSC", "requests", "hosts" — casaram exatamente **um** token, `de` (idf 0,0). Nenhuma
   lista de vazios alcança isso; é trabalho de sinônimo/vetor, e o vetor também não pegou. **Medir
   antes de mexer**: pode ser que o dourado esteja pedindo um doc que não responde a pergunta.

## 6. O que continua aberto e não é isto

- **Os 4 deploys presos no EasyPanel** (`aftercare`, `context`, `reviewshield`, `estetia`) seguem em
  404 — [`handoff-4-deploys-o-easypanel-aceitou.md`](handoff-4-deploys-o-easypanel-aceitou.md).
- **A busca continua FORA do `computeScore`.**
- **O 403 da conta 3 continua NÃO DATADO.**
