# O teste de 20 minutos da seção 3 — VERMELHO, e por um motivo melhor que "deu menos de 15"

Executa o passo 3 de [`handoff/handoff-o-que-e-melhor-fazer.md`](../handoff/handoff-o-que-e-melhor-fazer.md):
*minerar pares `(afirmação histórica, apurado de hoje)` do histórico versionado para levar a célula
`desmente` de 5 para 25+. Se saírem menos de 15 pares, a ideia morreu.*

**Saíram 8 pares legítimos (9 com um de fronteira). A ideia morreu.** E as duas vias que a
mataram valem mais que o número.

## 1. A via cara não adiciona nada à via barata

A hipótese era `git log -p` nos handoffs. Rodado sobre todo `.md` versionado + `data/projects.json`:
**166 candidatos, 116 com número diferente do apurado de hoje.** Parecia verde com folga.

Não é. **Handoff datado não se reescreve — é norma desta casa.** Então a afirmação de 30/07 está
VIVA no corpus de hoje, byte a byte:

```
handoff-proximo-passo-02-08.md:130  "40 repos ativos, 39 projetos no ranking"   ← hoje: 36 e 35
handoff-proximo-passo-dominios.md:231  "Contagem do ranking: 40 projetos"       ← hoje: 35
```

O histórico do git só acrescenta versões antigas de `CLAUDE.md`, `README.md` e `docs/` — e esses
três **não estão em `carregarCorpus()`**. Treinar o detector em documento que o produto nunca julga
é fabricar bancada. **O que o `git log` acha a mais é exatamente o que não serve.**

## 2. A 2ª via: minerar o corpus VIVO, ancorado no fato

Casamento ancorado em cada um dos 8 fatos de `estado`, absolvição por data avaliada DENTRO do span
(mesma regra do `lib/validade.mjs`): **16 candidatos, e ler um a um derrubou 7. O check errou 5
vezes** — nona vez nesta base que a primeira corrida mede o check:

| defeito do check | exemplo |
|---|---|
| **quantidade homônima** | "10 projetos" do autopublishing, "21 projetos" apagados da Vercel, "19 projetos no ar" — nenhum é a contagem do ranking |
| **ALVO do gate ≠ valor de hoje** | "≥ 5 cliques não-branded" é curadoria, correta para sempre; o apurado é 2 |
| **bloco cercado não é afirmação** | `validade.mjs` mascara crase simples; saída de script colada em ``` é literal igual — foi o que absolveu `D-70`/`D-71` |
| **tabela de rotulagem é meta** | `\| handoff-hub-github \| desmente \| "37 projetos" contra 35 \|` — o doc não afirma 37, cita |
| **regex comeu o número errado** | "10 dos **35** com gateway LIGADO. Hoje é 1" e "**9** com SDK e nunca ligado" (o certo: 10 escrito, 1 faturou, 9 não) |

### Os 8 que sobreviveram

| fato | hoje | documento | afirma |
|---|---|---|---|
| D-66 projetos no ranking | 35 | `handoff-proximo-passo-02-08.md:130` | 39 |
| D-66 | 35 | `handoff-proximo-passo-02-08.md:198` | 39 |
| D-66 | 35 | `handoff-proximo-passo-dominios.md:216` | 39 |
| D-66 | 35 | `handoff-proximo-passo-dominios.md:231` | 40 |
| **D-66** | **35** | **`project_cannibalscan` (memória VIVA):36** | **39** |
| D-66b repos ativos | 36 | `handoff-proximo-passo-02-08.md:14` | 40 |
| D-66b | 36 | `handoff-proximo-passo-02-08.md:130` | 40 |
| D-66b | 36 | `handoff-proximo-passo-02-08.md:143` | 41 |
| _(fronteira)_ | 36 | `handoff-quatro-sites.md:71` "sobraram 41 repos ativos" | 41 |

**7 dos 8 são o MESMO fato (D-66) e 5 saem de DOIS documentos.** Uma célula assim não mede o
detector, mede dois handoffs.

## 3. O teto não é a mineração — são 8 fatos

É esta a conclusão que decide, e ela não estava no handoff:

> A célula `desmente` não é pequena porque falta minerar. É pequena porque **só existem 8 fatos com
> fonte viva**, e cada um rende ~1 afirmação defasada no presente dentro do corpus. 8 × 1,1 = 9.
> Para 25 casos seriam necessários **~20 fatos apuráveis** — dobrar a camada `estado`, não varrer
> melhor.

**Congelar a frente do detector**, como o handoff manda no vermelho: portões em 83,3% (35/42) e
14/20, motivo escrito, `1.8` (célula `desmente` ≥ 20) inalcançável com o material existente.
Um instrumento que não pode ser validado com o material que existe não é um instrumento ruim — é um
instrumento sem bancada.

## 4. O subproduto que vale mais que o teste

Um dos 8 é **defeito real num documento vivo**: a memória `project_cannibalscan` afirma
`Hub: 39 projetos` no presente. Hoje são 35. **O `corpus-defasado.mjs` nunca emitiu esse achado** —
ele julga só os top-10 da busca para 6 perguntas, e essa memória nunca entra no top-10 de "quantos
projetos o hub tem" (ela é sobre deploy da Vercel; o número aparece de passagem no item 4).

> **A seleção por embedding é o gargalo do produto, não a redação do prompt.** Um `grep` ancorado no
> fato achou em segundos um `desmente` que a busca não recupera — e sem gastar uma chamada do pool.

É o mesmo mecanismo dos 7 erros `bate → nao-fala`: o detector julga o TEMA do documento. Aqui o
tema do documento é outro e a afirmação defasada está lá do mesmo jeito.

**Próximo passo barato e nomeado:** dar ao `corpus-defasado.mjs` uma 2ª via de seleção — os
documentos que citam o número, não só os que a busca acha parecidos. Não muda prompt, não muda
portão, não gasta pool a mais por documento.

---

Medições desta corrida: `git log -p` sobre 89 commits de `handoff/` · `carregarCorpus()` = 294
documentos · apurado de `01/08/2026` por `scripts/dourado-estado.mjs --estado tudo`.
