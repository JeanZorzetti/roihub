# Handoff — a aba responde, e agora o gargalo é a verdade do corpus (31/07/2026, 17h BRT)

Estado anterior: [`handoff-reranker-no-ar.md`](handoff-reranker-no-ar.md) (o reranker, e as três
frentes ranqueadas). Arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

**Entregue:** a frente nº 1 daquele handoff — síntese com citação obrigatória sobre o top-10.
`lib/resposta.mjs`, `scripts/avaliar-resposta.mjs`, **181 testes verdes**, `tsc` limpo.

⚠️ **Verificado LOCAL, não em produção.** O que foi visto ao vivo: `/busca?q=…` no dev server,
resposta renderizada com `[1][3][4][10]` e a numeração casando com os cards (screenshot conferido,
18,8 s em dev). O que **não** foi possível: repetir isso em `hub.roilabs.com.br` — a aba pede
basic auth e o `HUB_PASS` não está no `.env` local (só na EasyPanel). Depois do build, **buscar
alguma coisa** lá e conferir se o bloco `Resposta` aparece; e lembrar que o rodapé é a **última**
`.foot` da página, porque cada card usa a mesma classe.

---

## O que mudou na tela

| | antes | agora |
|---|---|---|
| resultado | 10 cards, o leitor decide | **resposta em cima**, com `[n]` em cada afirmação |
| conferir | abrir o arquivo | `[3]` é o **3º card** logo abaixo |
| custo | 1 chamada claude-cli, 4,8 s | **2 chamadas**, ~12 s (dev: 18 s) |
| desligar | `?rerank=0` | `?rerank=0` · `?resposta=0` (o link do rodapé faz as duas) |

## A régua nova — 78 perguntas, `node --env-file=.env scripts/avaliar-resposta.mjs`

```
respondeu        97,4%  (76)      top-10 tinha fonte do dourado   100,0%  ← teto
recusou           2,6%  (2)       citação ancorada (respondidas)   97,4%
suprimida/erro    0,0%  (0)       citação ancorada (com material)  94,9%  ← o número
```

**Ela mede ANCORAGEM, não verdade.** Citar a fonte certa e resumi-la errado passa com 100%.
Julgar conteúdo exigiria um juiz LLM (mais 78 chamadas por corrida) que, sem ver a realidade, só
mediria concordância com o dourado. `--ver` imprime cada resposta — **ler é a única checagem que
pega resposta fluente e errada**, e é como os dois achados abaixo apareceram.

As 2 recusas legítimas: `D-51` (gravar stderr do claude-cli no banco) e `D-54` (Astro + nginx +
barra final, com a fonte em `[1]` e `[2]`). São o piso honesto do prompt, não bug de recuperação.

---

## 🚨 O bug que quase virou número publicado

A primeira medição deu **83,3% de resposta e 8 recusas**. Ao ler as 8 (`--ver`): **5 eram
respostas completas, corretas e citadas** — só abriam com uma ressalva do tipo
*"NÃO ESTÁ NO CORPUS quanto à data X, mas sobre a prática a regra é… [1][3]"*. O classificador
procurava a frase de recusa **em qualquer lugar do texto** e apagava a resposta inteira.

O conserto é a ORDEM: **quem decide é a citação**, não a frase. Com `[n]` válido é resposta,
mesmo com ressalva; sem `[n]` é que a frase separa recusa de alucinação suprimida.
83,3% → **97,4%**, sem uma chamada nova (o `.cache/rerank.json` guarda o texto cru, então
reclassificar saiu de graça).

**Lição transferível: agregado não pega bug de classificação, só leitura pega.** Um "83,3%"
publicado teria virado meta a bater nas próximas sessões — em cima de um bug meu.

## Recusa falsa: o prompt precisou aprender que a pergunta é sobre a PRÁTICA

Antes disso, com 5 perguntas, `D-03` (*"curl -sk devolveu 200, posso fechar a entrega?"*)
recusava com a memória certa em `[1]`. O modelo lia "os trechos não falam do SEU endpoint".
Uma linha no prompt resolveu: *um trecho que estabelece a regra sustenta a resposta mesmo que o
seu projeto, endpoint ou data não apareçam*. Recusa falsa é o modo de falha que torna o
componente inútil sem parecer quebrado.

## Decisões de projeto que não devem ser desfeitas

1. **DOIS prompts, não um.** Um prompt só que ordenasse e respondesse economizaria 1 chamada e
   **acoplaria os 88,0% de recall a cada ajuste de redação** — cada mexida na prosa exigiria
   remedir a recuperação inteira. Separados, cada um tem régua própria.
2. **Falha fechada na citação.** Prosa fluente sem procedência tem a autoridade da resposta e
   nenhuma da fonte; some da tela e vira `resposta-sem-citacao` no rodapé.
3. **A numeração da lista É a procedência.** `.busca-res` tem `list-style: none`, então o `[n]`
   é renderizado à mão no cabeçalho do card. Citação que dá trabalho de conferir não é conferida.
4. **Recusa não vira aviso de erro** — é o componente funcionando. Só falha de CLI e resposta
   suprimida aparecem no rodapé.
5. **Códigos de erro renomeados** (`rerank-timeout` → `resposta-timeout`): `rodarClaude` é
   compartilhado, e "rerank-output" no rodapé da resposta manda a próxima sessão debugar o
   componente errado.
6. **Orçamento de 2400 chars por trecho** (contra 900 do reranker): lá são 50 candidatos e a
   janela é a restrição; aqui responder por cima de um recorte que cortou a frase que sustentava
   a afirmação é o modo de falhar que importa.

---

# ▶️ O que é melhor fazer agora

## 1º — Corretude do corpus. Subiu de 3º para 1º, exatamente como previsto.

O handoff anterior já dizia: *"se a #1 for feita, isto sobe para 1º imediatamente: síntese
amplifica o que o corpus tem de errado"*. A #1 foi feita. **Recall de 88% e ancoragem de 94,9%
sobre um corpus com taxa de erro desconhecida é acesso rápido, citado e fluente à resposta
errada.** Nada neste sistema mede verdade.

O formato que resiste já existe: os **97 `protocolo`** são registros tipados e verificáveis, e
são a camada com melhor recall (93,3%). Os 41 handoffs e 126 memórias são prosa que acumula e
nunca é reconferida. Caminho: converter prosa que sustenta decisão em registro tipado, e/ou
auditar afirmação contra a realidade (git, GSC, banco, HTTP) — que é o que o hub já faz com
projetos. O `verificacao.como` de cada protocolo é a matéria-prima.

## 2º — Camada 4 (manifesto/pull) para a camada `estado`

Inalterado do handoff anterior, e a síntese não muda nada aqui: `estado` dá **74,0% em @50** —
um quarto dessas perguntas não está no corpus em k nenhum, e sintetizar sobre o que não existe
só produz recusa (foi o caso de `D-66`, "quantos projetos hoje": o modelo achou 4 contagens
defasadas e disse isso, corretamente). "Quantos projetos", "qual o gate do sirius" moram no
GitHub, no GSC e no banco — **e o hub já lê as três nas outras abas**.

## 3º — Latência, se ela incomodar de verdade

~12 s por busca. As duas chamadas são sequenciais por dependência real (a síntese precisa do
top-10 reranqueado). O que dá para fazer sem perder qualidade medida: streaming da resposta, ou
`?resposta=0` virar o padrão e a síntese ser um clique. **Não decidir isso sem usar a aba por
uma semana** — 12 s uma vez por pergunta pode ser irrelevante perto de abrir 3 arquivos.

## Não é a fase 4 (contextual retrieval)

Segue valendo o argumento do handoff anterior: 1331 chamadas por reindexação contra 1 por busca,
e ela levanta o teto (@50 = 92,9%) que a síntese **já não é a parte que aperta** — o teto medido
da síntese é 100% (toda pergunta tinha fonte no top-10).

---

## Medido e DESCARTADO — não reabrir

1. **Procurar a frase de recusa em qualquer lugar do texto.** Apagou 5 respostas boas. A citação
   decide primeiro.
2. **Fundir ordenação e síntese num prompt só.** Não medido, e não vai ser: acopla os 88,0% à
   redação. O custo economizado (1 chamada) é menor que o custo de remedir.
3. Tudo que o handoff anterior já descartou continua descartado: obedecer o reranker, atualizar
   o dourado para creditar memórias novas, piso absoluto de recall, `qwen3-embedding` na VPS.

## Armadilhas de operação (as do reranker continuam TODAS valendo)

- **`avaliar-resposta.mjs` gasta 1 chamada por pergunta ALÉM do rerank.** Com o cache morno, o
  rerank sai de graça e só a síntese gasta pool. `--limite 5` antes de gastar 78 (~20 min).
- **Mudar o prompt invalida o cache inteiro** (a chave é o hash do prompt): 78 chamadas novas.
  Reclassificar sem mexer no prompt, ao contrário, é grátis — foi o que salvou os 5 falsos.
- **`--ver` imprime resposta, citado e esperado.** Usar sempre que o número mudar muito.
- **Erro que não é cacheado é retentado** na corrida seguinte: os 5 `rerank-output` da primeira
  medição sumiram sozinhos na segunda.
- **Reindexar depois de escrever handoff/memória**: `node --env-file=.env scripts/indexar.mjs`.
  **Este handoff inclusive** — sem isso ele some da aba em silêncio.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica`, fechar o Ollama exposto sem auth na VPS
(decidido: depois) e — o mais antigo e perigoso — **rotacionar os segredos vazados**
([[secrets_to_rotate]]), com o `HUB_PASS` colado num chat em 31/07 na fila.
