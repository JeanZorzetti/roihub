# Handoff — fases 0 e 3 executadas: a ressalva saiu do fato e o `(hoje N)` virou check (31/07/2026, 22h)

Spec que originou: [`handoff-checar-em-vez-de-julgar.md`](handoff-checar-em-vez-de-julgar.md) ·
estado anterior: [`handoff-dourado-com-lastro-externo-executado.md`](handoff-dourado-com-lastro-externo-executado.md) ·
índice: [`../handoff.md`](../handoff.md).

**Escolha da sessão:** as duas fases de **zero chamadas** da spec. A fase 1 (os dois portões do
detector) custa ~1 sessão de rótulo humano e ~30 chamadas; a fase 2 depende de dado que só o Jean
tem. As fases 0 e 3 custam leitura e regex, e a 3 é a tese do documento inteiro — converter
afirmação em CHECK — na sua forma mais barata.

**235 testes verdes** (eram 228), `npx tsc --noEmit` limpo.

---

## 1. Fase 0 — `ressalva` virou campo, e o fato voltou a ser só o número

`lib/dourado-estado.mjs` devolvia isto para `D-68`:

```
Gate 31/08: ≥ 5 cliques nao-branded/28d. Hoje: 2 — piso: query anonimizada pelo GSC não aparece. …
```

A limitação da medição estava **dentro do fato**, e foi ela que fez o detector de defasagem
devolver `desmente` sobre um documento que dizia "hoje 2" contra um apurado de **2** — acordo
perfeito lido como discordância, 1 dos 3 falsos positivos da primeira corrida.

O conserto é estrutural, não de redação:

- `apurado()` ganhou `ressalva`; `naoApurado()` devolve `ressalva: ""` para o objeto ser um só.
- `gate()` manda a ressalva para o campo próprio, e ela é **diferente por métrica**: clique
  não-branded é **piso** (query anonimizada não entra na soma); impressão é **total do site**
  (`dimensions: []`, e somar as linhas de query é que devolveria piso).
- `montarPromptDefasagem` mostra as duas separadas, com o bloco rotulado *"LIMITAÇÃO DA MEDIÇÃO
  (como o fato foi medido — NÃO é uma afirmação sobre o assunto)"*, e ganhou a regra explícita: a
  limitação **nunca** torna um documento `desmente` sozinha; documento que afirma o mesmo número
  do fato `bate`, porque concordar com o número é concordar.
- Sem ressalva, o bloco **não nasce** — cabeçalho vazio é ruído que o modelo preenche sozinho.

Apurado contra a fonte viva agora (`--estado tudo`, ~20 s, zero LLM):

```
✓ Gate 31/08: ≥ 5 cliques nao-branded/28d. Hoje: 2. Top não-branded: …
  ressalva da medição: é PISO: clique de query anonimizada pelo GSC não entra na soma…
```

**Aceite da spec cumprido:** `D-68` volta a ser comparado só pelo número. Teste de unidade sobre o
objeto apurado e sobre o prompt, **zero chamadas gastas**.

⚠️ Como a spec avisou: isto **invalida o `.cache/rerank.json` para os 50 documentos já julgados**.
A refação continua devendo ser feita **uma vez só, junto com a fase 1** — não rode o detector
antes dos portões só para ver o número mudar.

## 2. Fase 3 — `scripts/validade.mjs`, e a primeira corrida mediu o CHECK (de novo)

Três arquivos, e a divisão importa:

| arquivo | o quê | por quê separado |
|---|---|---|
| `lib/validade.mjs` | a regex e a absolvição, função pura | testável com fixture |
| `lib/validade-vivos.mjs` | quais arquivos são documento vivo | memória mora em `~/.claude` e **não existe na imagem Docker** |
| `scripts/validade.mjs` | CLI, sai 1 quando acha | pode virar portão |

- **Só documento VIVO**: protocolos não revogados (`valid_to` sai), `data/projects.json`,
  memórias. **Handoff nunca** — é registro datado.
- **A absolvição é avaliada DENTRO do trecho casado, nunca na linha.** Esta é a decisão que
  decide se o check serve: na linha, o `PRT-03` que originou a norma seria absolvido pela data do
  **prazo** do gate ("até 19/10/2026 (hoje 21)"). Data que não gruda no número não data nada — e
  há teste de regressão exatamente nesse texto.
- **Roda dentro do `npm test`**, não ao lado: `test/validade.test.mjs` tem um caso que varre os
  vivos do repo de verdade. Régua que depende de alguém lembrar de rodar não roda. Está na lista
  explícita do `package.json` ([`D-73`](../data/dourado.json)); `npm run validade` soma as
  memórias.

### Os 3 achados da primeira corrida, lidos um a um

**Precisão: 1 defeito limpo em 3 achados.** Terceira vez seguida que a primeira corrida de um
check novo mede o check — e desta vez estava escrito na spec que ia acontecer.

| achado | veredito | o que se fez |
|---|---|---|
| `data/projects.json` — card do **aftercare**: "o D+180 mede CLIQUES — 10/sem — e **hoje são 0**" | **defeito real**, e irônico: o próprio card diz que ler número à mão "foi exatamente o que apodreceu este card" | trocado por "o clique, **que se apura no `/insights`**, ainda não saiu de 0" — aponta a apuração em vez de congelar o placar |
| `data/projects.json` — card do **meridian**: "deixar /admin funcional (**hoje stub em 302**)" | **fronteira**: é status HTTP dentro da descrição da tarefa, não placar que desliza sozinho | datado — "(stub em 302, **medido em 30/07**)", data que o próprio `acaoDesc` já trazia |
| `memoria/project_polaris_teams_v2_1.md`: "(**agora 6 asserts**; …)" | **fronteira**: o bullet já está datado (`commit 6e23fce, 2026-06-19`), mas a data está fora do parêntese | "(6 asserts **em 19/06**; …)" |

**Por que datar os dois de fronteira em vez de afrouxar a regex:** afrouxar para absolver por data
na linha teria absolvido o achado real — o card do aftercare tem `28/11`, `28/07` e `25/07` na
mesma linha. Duas edições de 5 caracteres custam menos que um check que passa limpo por construção.

### O 4º achado, 20 minutos depois: o check reprovou quem ENSINA a norma

Ao escrever a memória desta sessão, ela citou o defeito como exemplo — `(hoje 21)` — e o check
reprovou a citação. Não é o defeito: é um documento **falando sobre** o defeito.

**Conserto:** span de crase é mascarado antes do casamento. Crase é a marca de "isto é literal,
não é minha afirmação", e sem ela o check reprova exatamente os documentos que documentam a norma —
o tipo de atrito que faz alguém tirar o check da lista do `package.json` na primeira sexta-feira.
Teto declarado no código: placar de verdade escrito dentro de crase escaparia; nenhum dos 6
achados reais até hoje estava.

Corrida atual: **0 achados em 230 documentos vivos**, em segundos.

---

## 3. O que NÃO foi feito, e continua valendo palavra por palavra

- **Fase 1 — os dois portões do detector de defasagem.** É o pré-requisito de tudo. **Nenhum
  percentual de defasagem pode ser publicado antes**, inclusive o 16,7% de 30/07, que segue
  **preliminar**. A fase 0 corrige a causa de **1** dos 3 falsos positivos; os outros dois
  (`handoff-autopublish` comparando gate de canário com gate de tapepro, `handoff-normas-que-rodam`
  devolvendo `desmente` com o motivo dizendo "o veredito correto é nao-fala") **não têm conserto
  estrutural conhecido** — é o holdout que decide.
- **Fase 2 — feita em 2 dos 3 campos** (ver seção 3-bis abaixo). `D-67` fica `nao_apurado` e é a
  resposta certa: **o Jean não tem as datas das vendas de cabeça**, e inventar data de venda é
  fabricar registro. Só vira apurável se as datas saírem de fonte viva (Mercado Pago, Kiwify ou o
  banco do sirius) — aí é `vendas: [{ data, valor }]` no card e o apurador já lê.
- **Fases 4, 5 e 6** intocadas. A 5 (detector de contradição) continua sendo a mais bonita de
  mostrar e continua não sendo a primeira.

## 3-bis. Fase 2 — `D-70` e `D-71` ligadas: **7 das 8 apuradas**

Curadoria nos 35 cards, zero chamadas. `familia` e `estado` em todos, `blockersLista` virou
`{ texto, humano }`.

```
D-70 ✓ 27 de 35 têm blocker registrado. Por família — não tem como cobrar: 13 · não tem tráfego: 7
       · não tenta faturar por decisão: 5 · não tem quem venda: 2. Estado: 28 no-ar,
       5 no-ar-inutilizavel, 2 prototipo.
D-71 ✓ 8 bloqueios humanos: goiania (Bing Webmaster/IndexNow), fabrica (Request Indexing manual),
       reviewshield (GOOGLE_CLIENT_ID), atma (MP nunca testado em produção), cyberspace (decisão
       do Jean), compass (4 chaves Stripe · GitHub OAuth+Resend), qprime (domínio do cliente).
```

**A quarta família não estava na spec.** A spec pedia três — "não tem como cobrar", "não tem quem
venda", "não tem tráfego". Lendo os 35, **sete projetos não tentam faturar por decisão** (portfolio
e meridian são peça de candidatura, lumina é demo, swarm é pesquisa, roi-labs-links é vitrine,
claudeloop é ferramenta interna, cyberspace não tem produto). Forçá-los para uma das três
inventaria um travamento que não existe, e "não vende de propósito" é estado legítimo. Daí
`familia: "nao-vende"`.

**⚠️ Isto é CURADORIA e precisa do seu olho.** O apurador conta a distribuição; o julgamento por
card é meu, derivado de `receitaNota` + `decayNota` + `acao` + `blockersLista`. Divergências
conhecidas contra o dourado escrito, que valem revisão:

| card | dourado escrito | curado agora | por quê |
|---|---|---|---|
| `whatsmeow` | não tem quem venda | **cobrança** | o card diz "decidir se vira produto cobrável" — não há caminho de pagamento |
| `vertice` | não tem quem venda | **tráfego** | o CTA da hero aponta para `/signup` em 200; o que falta é indexação (parado desde 03/03) |
| `moderador`, `cannibal_scan`, `seo-forecaster` | "o resto" (tráfego) | **cobrança** | os três anunciam grátis ou só WhatsApp: nem com tráfego faturam |
| `goiania` | tráfego | **venda** | o gate declarado é o **1º fornecedor**, não visita |

**Falha FECHADA no `D-70`:** card sem `familia`/`estado` válidos tira a pergunta inteira de
circulação, nomeando os slugs — contagem parcial com cara de completa é o defeito que esta frente
existe para matar.

**Custo colateral que a spec não mencionou:** trocar `blockersLista` de `string[]` para objeto
quebra três consumidores — o tipo `Project` (`lib/projects.ts`), o render do foco do dia
(`app/page.tsx`) e o merge das flags de crawl (`lib/evaluate.ts`, que agora entra com
`humano: false`, porque achado de robô não é bloqueio do Jean). Os três foram corrigidos; `tsc`
limpo.

## 4. Armadilhas novas desta sessão

- **A regex do `hoje é N` para na pontuação de propósito** (`[^.;\n]*`). Sem isso ela engole o
  parágrafo e uma data três frases adiante absolve a afirmação — o check continuaria verde e não
  estaria medindo nada.
- **`(hoje …)` sem dígito não é achado.** "(hoje o deploy é Docker)" é regra, não placar.
- **`data/projects.json` é UTF-8 e o `Get-Content` do PowerShell mostra mojibake.** Editar pelo
  terminal a partir do que ele imprime corrompe o arquivo; editar pela ferramenta de arquivo, e
  validar com `JSON.parse` depois.
- As de sempre: reindexar após escrever handoff/memória (`scripts/indexar.mjs`, de máquina com
  Ollama); não dar push entre 00:00 e 01:00 BRT; deploy é Docker no EasyPanel.

## 5. Primeiros 10 minutos da próxima sessão

1. `npm test` (**238 verdes**) — a suite agora inclui o check de validade contra o repo real.
2. `node --env-file=.env scripts/dourado-estado.mjs --diff` — **7 das 8 apuradas**, zero LLM. E
   **revisar a tabela de divergências da seção 3-bis**: 6 cards em que a curadoria de 31/07
   discorda do dourado escrito. Divergência aqui não é bug, é o dourado escrito envelhecendo.
3. Se o pool estiver bom: **fase 1**, e refazer o `.cache/rerank.json` **uma vez só**, já com a
   ressalva separada.
