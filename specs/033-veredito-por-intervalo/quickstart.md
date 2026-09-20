# Quickstart — como provar que a 033 funciona

**Feature**: 033 · O veredito sai do intervalo da amostra | **Data**: 2026-09-20

Guia de **validação**, não de implementação. Os detalhes de código estão em `contracts/`; o que
segue é a sequência que prova a feature de ponta a ponta, na ordem em que cada passo fica possível.

---

## Pré-requisitos

| Item | Como conferir |
|---|---|
| Node 22 | `node -v` |
| Deps instaladas | `npm ci` — **nenhuma dependência nova** nesta feature |
| `GOOGLE_SERVICE_ACCOUNT_JSON` no `.env.local` | necessária só para os passos 3 e 4 (tela). Os passos 1 e 2 rodam sem ela |
| Propriedade da Atma no Search Console | `atma.roilabs.com.br` + `usealigner.com`, hosts somados |

**Regra de depuração deste repo**: erro de API, de deploy ou de banco → **ler os `.env` antes de olhar
o código**. Caractere especial, comentário inline em URL, BOM no início do arquivo.

---

## 1 · A aritmética, sem subir o Next

O teste da folha é o que fecha a FR-003, e roda isolado:

```bash
node --test test/intervalo.test.mjs
```

**Deve afirmar, com estes valores exatos** (de `research.md` §R1):

| Entrada | Esperado |
|---|---|
| `wilson(0, 21)` | `superior` ≈ **0,1546** (15,5%), `inferior` **=== 0** — só com o clamp: a forma fechada devolve `-1,17e-17` |
| `wilson(3, 105)` | `[0,0098 ; 0,0807]` → **1,0% a 8,1%** |
| `wilson(0, 1)` | `inferior === 0`, `superior` ≈ 0,793 |
| clamp | `wilson(0, 21).inferior` é `-1,17e-17` sem ele — a varredura abaixo reprova |
| `wilson(k, 0)` | **`null`** |
| `wilson(n, n)` | `superior === 1` — nunca > 1 |
| `wilson(-1, 10)` / `wilson(11, 10)` | **lança** |
| `vereditoContraRegua(0, 21, 0.25)` | `"abaixo"` — **SC-001** |
| `vereditoContraRegua(3, 105, 0.045)` | `"indecisa"` — **SC-002** |
| `vereditoContraRegua(0, 1, 0.13)` | `"indecisa"` |
| `vereditoContraRegua(4, 900, null)` | **`null`**, não `"indecisa"` |
| `vereditoContraFaixa(x, n, [0.40, 0.50])` | `"atinge"` só quando `inferior >= 0.50` |

**Propriedade que o teste cobra em varredura**, não em caso pontual: para `n` de 1 a 500 e `k` de 0 a
`n`, `0 <= inferior <= superior <= 1`. É a FR-003 afirmada como invariante, não como três exemplos.

---

## 2 · A suíte inteira, e o portão de registro

```bash
npm test
```

**Portões (constituição, seção de Fluxo)**:

1. Verde na **suíte inteira** — ~1,6 s. Não só nos arquivos tocados.
2. `test/intervalo.test.mjs` **registrado na lista explícita** de `package.json`. `test/validade.test.mjs`
   já compara lista contra diretório nos dois sentidos e reprova a divergência.
3. `grep -rn "PISO_IMPRESSOES_VEREDITO\|exigePiso" lib app test` → **zero linhas**. É o teste da
   FR-009, e a lista está em `research.md` §R6 — **42 linhas em 5 arquivos**, medidas em 20/09/2026. Ele NÃO pega `app/gsc/page.tsx`, que chama `limiarEmTexto()`/`seloDaMedida()` sem citar as constantes: para esse, `grep -rn "limiarEmTexto\|seloDaMedida" app lib`.
4. Sem `data/projects.json` importado fora de `lib/projects.*`.

**O caso de referência da Atma** vive como fixture em `test/kpis-busca.test.mjs` e afirma os números
que a spec publica:

```
conformidadeDeCtr(fixture, janela) →
  porPagina   : 0,25   (1 de 4)          · meta [0.75, 0.80]
  porTrafego  : 0,025  (583 de 22.899)   · meta null          ← reprova qualquer outro valor
  indecisas   : 20
  semRegua    : 5
  nomeada     : /blog/quanto-custa-alinhador-invisivel · 155 cliques faltantes
```

E as invariantes:

- `decididas + indecisas + semRegua + semImpressao === paginas.length`
- `porPagina.atingem <= porPagina.decididas`
- `FAIXAS` percorrida contra `BENCHMARK` **nos dois sentidos** — degrau sem faixa, e faixa com régua
  que não existe na tabela
- `porFaixaDePosicao()` devolve **sempre 6** entradas, inclusive as sem impressão
- `1 / LIMIAR_PAGINAS_DECIDIDAS < 0.05` e `1 / (LIMIAR_PAGINAS_DECIDIDAS - 1) >= 0.05`

---

## 3 · As telas, com dado real

```bash
npm run dev
```

| Rota | O que conferir |
|---|---|
| `/okr/atma/aquisicao` | o elemento mais destacado é a **frase da página nomeada**, não um percentual (SC-009/SC-010). Os dois índices abaixo, com base ao lado e **só o por página com a faixa do board** (SC-007/SC-008) |
| `/gsc/mapa` | as **seis** faixas com base, janela e veredito quando existe; só as decisivas com veredito (SC-004) |
| `/gsc/mapa` **com JS desligado** | a lista aninhada carrega os mesmos seis estados. **É ela que responde a 360px** |

**As cinco perguntas de aceitação**, respondíveis olhando a tela:

1. Qual das duas leituras é o KPI do board? (só uma tem faixa desenhada)
2. Quantas páginas ficaram indecisas? (número ao lado do denominador)
3. Que página precisa de trabalho, pelo nome? (nível 1)
4. De que janela é cada número? (declarada em cada nó e em cada leitura)
5. Contra que régua a Posição 1 foi julgada — 25% ou os >30% do board? (a que julga é a de 25%;
   a transcrição continua exibida como transcrição, com a etiqueta `⚠`)

---

## 4 · Estados de ausência — os que não aparecem no caminho felizmente

Cada um precisa de **um frame próprio**. Screenshot do estado com dado não prova painel nenhum.

| Estado | Como provocar |
|---|---|
| `o site não aparece aqui` | faixa sem impressão na janela — ocorre naturalmente na Atma |
| `a amostra não decide` | a faixa 4 a 6 da Atma já está nesse estado |
| `sem régua nesta faixa` | a Página 2 (11 a 20) |
| `sem propriedade` (`null`) | comentar `GOOGLE_SERVICE_ACCOUNT_JSON` no `.env.local` |
| `erro na fonte` (`{erro}`) | derrubar a rede durante o render |
| `zero página decidida` (FR-013) | fixture com todas as URLs indecisas |

Nenhum deles pode renderizar `0%`. `erro` nunca vira `0`; `sem impressão` nunca vira `0`.

---

## 5 · A prova visual — `ui-verification`, e depois abrir os PNGs

Este é o passo 7 do harness `information-design`, e ele **não é opcional**: mexeu em tela com URL
alcançável, sem screenshot depois não está pronto.

```
3 larguras (360 / 768 / 1440) × o estado com dado
1 frame por estado de ausência da tabela acima
1 frame com o pior dado real — a URL de rótulo mais longo, a faixa de maior contagem
```

Depois, **abrir cada PNG e olhar**. Playwright ter retornado sem erro prova que nada quebrou; não
prova que a tela é legível. As três lições registradas desta tela, que só a imagem pegou:

- **`me-tpc` e `me-root` são custom elements, não classes.** `querySelectorAll('.me-tpc').length`
  devolve **0 num mapa renderizado normalmente** — parece que a lib não montou. Selecionar por tag.
- **Nó dentro da caixa ≠ nó legível.** Com os vãos default o mapa cortou o rótulo nas duas bordas e
  os nós contavam como visíveis.
- **Sobreposição não aparece em medida de caixa.** Dois rótulos no mesmo lugar têm
  `scrollWidth === clientWidth` e nenhum truncado.

### Os dois gates finais, com as imagens abertas

- **G31 · cinco segundos** — olhando só a imagem, sem o código: você diz **o nome da página que
  precisa de trabalho**? É literalmente a SC-010. Não: volte à forma, não ao CSS.
- **G32 · procedência** — pegue o número mais destacado e responda só pela imagem: de quando é, de
  onde veio, sobre qual total. Faltou um dos três, a tela ainda não é informação.

E o gate de área: **nível 1 ≥ 2× a área de um nível 2**, nas três larguras. A leitura recusada de
18/09/2026 é explícita — esse gate pede resposta maior, não evidência menor.

---

## 6 · Registro, antes de fechar

1. **`.info/log.json`** — pergunta, forma escolhida, forma descartada, fonte do dado, estados
   implementados, pior caso medido. As pendências herdadas de `/gsc/mapa` (mapa acima da dobra em
   1.060px numa caixa de 702; decorativo a 360px) precisam ser **reafirmadas ou resolvidas**, não
   herdadas em silêncio.
2. **`references/leituras.md`** do harness — só se houve recusa. Há um candidato já identificado: o
   estado **`a amostra não decide` não existe na taxonomia dos sete estados** do harness. Ela tem
   `não apurado` (alguém precisa preencher) e `sem dado` (nada registrado), e nenhum dos dois é
   "está apurado, está fresco, e não resolve". Vale entrada com padrão transferível.

---

## 7 · Deploy

**`main` faz auto-deploy por push** no EasyPanel, e o push **reinicia o container**.

| Janela | Não dar push |
|---|---|
| 23:30 – 01:00 BRT | estado noturno às 23:37 e autopublishing às 00:13 |
| 08:00 – 08:45 BRT | cron diário do autopublishing |

Deploy leva **~15 min**. Conferir a tela **duas vezes** — a primeira conferência frequentemente pega
o container antigo. A hora BRT sai pelo PowerShell, não pelo `date` do Git Bash (que ignora `TZ`).

---

## Rastreabilidade — cada critério da spec e onde ele é provado

| Critério | Provado em |
|---|---|
| SC-001 · 21 impr / 0 cliques **recebe** veredito | passo 1, `vereditoContraRegua(0, 21, 0.25) === "abaixo"` |
| SC-002 · 105 impr / 2,9% **não recebe** | passo 1, `vereditoContraRegua(3, 105, 0.045) === "indecisa"` |
| SC-003 · denominador + indecisas publicados | passo 2 (fixture 4/1/20/5) e passo 3 |
| SC-004 · seis faixas com base e janela | passo 2 (sempre 6) e passo 3 (`/gsc/mapa`) |
| SC-005 · nenhum número combina janelas | contrato: `porFaixaDePosicao` recebe **uma** janela, sem parâmetro para a segunda |
| SC-006 · três estados em tons de cinza | passo 5, frame em escala de cinza — a geometria é o portador |
| SC-007 · duas leituras, só uma com meta | passo 2 (`porTrafego.meta === null`) e passo 3 |
| SC-008 · o leitor distingue KPI de qualificação | passo 3, pergunta 1 |
| SC-009 · nível 1 é a frase, não o percentual | passo 5, G31 + gate de área |
| SC-010 · 5 s e o leitor diz o nome da página | passo 5, G31 |
| FR-003 · nunca limite fora da faixa | passo 1, varredura de `n` 1–500 |
| FR-008 · régua declara fonte, data, idade e as DUAS SERPs | passo 2 (`test/gsc-delta.test.mjs`: `medidaEm`, `cadencia`, `serp`, `serpDaFonte`) e passo 3 (nível 3, e `/gsc` — ver `contracts/telas.md` §D) |
| FR-009 · o piso fixo deixa de existir | passo 2, portão 3 (`grep` → zero) |
| FR-013 · zero página decidida | passo 4, fixture com todas indecisas |
