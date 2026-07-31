# Handoff — próximo passo: tipar os protocolos que já existem (31/07/2026)

Estado anterior: [`handoff-harness-decidido.md`](handoff-harness-decidido.md).
Índice: [`../handoff.md`](../handoff.md).

**Tarefa:** executar a **fase 2** de [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md)
— transformar o conhecimento já escrito em registros de protocolo tipados e verificáveis.

**Decisão do Jean (31/07):** começar por aqui, **não** pelo bug do undici (que continua
aberto — ver no fim).

---

## Por que esta fase antes de qualquer vetor

Ela **não precisa** de embedding, pgvector, reranker, grafo ou MCP. É extração e tipagem.
E entrega valor sozinha: com os protocolos tipados, já se responde

> *"quais dos 35 nunca foram checados contra a lição X"*

que hoje depende do Jean lembrar — e é o que falha em silêncio com 35 empresas.

Se o projeto travar depois desta fase, nada foi perdido: o ativo mais caro do portfólio
(o que já foi aprendido com incidente) sai de prosa espalhada e vira dado consultável.

## Leia isto antes de começar

- [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) — as 7 camadas e por que
  protocolo/estado/episódio não podem ir para o mesmo índice.
- [`../docs/protocolos-areas.md`](../docs/protocolos-areas.md) — **a taxonomia já está
  fechada**: 13 áreas com lastro + 5 lacunas declaradas. Não reabrir essa discussão; ela é a
  camada 0 e trocar depois custa reindexação.

---

## O corpus (medido em 31/07)

🚨 **A fonte mais rica está FORA do repositório.**

| Onde | Quanto | O que é |
|---|---|---|
| `C:\Users\jeanz\.claude\projects\c--Users-jeanz-OneDrive-Desktop-ROI-Labs\memory\` | **123 arquivos** | A mina. Ver quebra abaixo. |
| `roihub/handoff/` | **35 handoffs** | Episódio + protocolo misturados em prosa. |
| `Docs/Obsidian/80-dev/` (vault do roilabs) | a medir | Docs de feature; provável fonte de DEP/DAT. |
| `lib/autopublish-clients.ts` | 1 arquivo | Protocolo editorial **em código**: as regras de CNT estão no prompt (fontes, concorrente, estrutura, imageScene, YMYL). Extrair de lá também. |

Quebra dos 123 arquivos de memória:

- **79 candidatos diretos a protocolo** (tudo que não é `project_*` nem `feedback_*`)
- **38 `project_*`** — são **estado/episódio**, não protocolo. Não force tipagem neles.
- **6 `feedback_*`** — parte é protocolo de trabalho de verdade (`no_lazy_features`,
  `full_seo_no_ads`, `push_apos_concluir`, `handoff_md`). Triar caso a caso.

**Estimativa: ~85 protocolos**, não os "~65" que o doc de arquitetura chuta. Corrigir o doc
ao terminar a contagem real.

---

## Formato: JSON, não YAML

⚠️ O exemplo em `protocolos-areas.md` está escrito em YAML **por legibilidade**. A
implementação tem que ser **JSON**: o Node 22 não tem parser de YAML nativo e este repo não
adiciona dependência para isso. Precedente da casa: `data/projects.json`.

**Onde:** `data/protocolos/<AREA>-<NN>.json` — um arquivo por protocolo.

Um arquivo por protocolo, e não um `protocolos.json` gigante, por três motivos: diff
legível, `supersede` vira mudança de um arquivo só, e conflito de merge fica local.

`data/` já é copiado para a imagem no `Dockerfile:28`, então os protocolos viajam com o
deploy e qualquer página do hub lê por `fs` sem banco.

Campos: os de `protocolos-areas.md` § "O registro de protocolo". Os que não podem faltar:

- **`verificacao.como`** — sem comando, o protocolo não entra no robô de conformidade nem
  no manifesto do projeto. **É o campo que separa protocolo de anotação.** Protocolo sem
  checagem possível volta para a fila ou vira nota — não vira registro.
- **`aplica_se_a`** — vira aresta do grafo depois; é o que responde "quais dos 35".
- **`excecoes`** — o histórico prova que protocolo sem exceção derruba tarefa boa (o
  `errors: 1` do sitemap do `fabrica` viraria bloqueio falso).
- **`origem`** — nome do arquivo de memória ou do handoff. Procedência é obrigatória:
  resposta sem ela é resposta que o agente vai re-derivar.
- **`valid_from` / `valid_to`** — bitemporal. Fato revogado sai de circulação e continua
  auditável.

## O teste que fecha a fase

`test/protocolos.test.mjs`, no padrão da casa (`node --test`, `assert/strict`, sem
framework) — e **adicionar à lista explícita do `npm test` no `package.json`**, senão nunca
roda.

Precisa falhar se:

- algum `.json` em `data/protocolos/` não parseia;
- falta campo obrigatório, ou `verificacao.como` está vazio;
- `area` não é uma das 18 (13 com lastro + 5 lacunas);
- `id` não bate com o nome do arquivo, ou está duplicado;
- `origem` está vazio;
- um `valid_to` preenchido não tem `supersede` apontando para o substituto.

Esse teste é a única coisa que impede 85 arquivos escritos à mão de derivarem em 85
formatos.

## Ordem de execução

1. **Triar** os 123 arquivos de memória em protocolo / estado / episódio. Só a triagem já
   vale — ela mostra o tamanho real de cada área.
2. **Tipar por área, começando pelas de maior lastro** (`DEP` ~9, `SEO` ~8, `UI` ~8,
   `VER` ~7). Área inteira de uma vez, para o vocabulário sair consistente.
3. **Escrever `verificacao.como`** em cada um. Aqui se descobre quais "protocolos" eram só
   opinião — esperado perder alguns, e isso é resultado, não fracasso.
4. **Extrair de `autopublish-clients.ts`** as regras editoriais que hoje só existem no
   prompt (área `CNT`).
5. **Não abrir as 5 lacunas** (`BKP`, `CST`, `OBS`, `PRV`, `A11Y`) nesta sessão. Escrever
   área nova antes de tipar o que já foi aprendido caro descarta o ativo.

## Fase 2b — o conjunto dourado (se sobrar sessão)

~50 perguntas reais com resposta conhecida, extraídas dos 35 handoffs (cada handoff contém
perguntas que já foram respondidas). É o que vai medir se o vetor/reranker/grafo das fases
seguintes ganharam alguma coisa. Sem ele, as fases 3–6 melhoram no achismo.

Pode ficar para a sessão seguinte **sem prejuízo** — mas as fases 3+ não devem começar antes
dele existir.

## O que fecha a entrega

`npm test` verde (com o teste novo na lista) + commit + push. Sem card de agenda para isto.

---

## ⏸️ Continua aberto: o `UND_ERR_HEADERS_TIMEOUT` (adiado por decisão)

Diagnóstico fechado em [`handoff-harness-decidido.md`](handoff-harness-decidido.md) § D, com
o patch escrito. Resumo: o `fetch()` do `scripts/run-autopublish.mjs` roda **no GitHub
Actions**, e o `headersTimeout` default do undici é **300 s** — enquanto a rota tem
`maxDuration = 900` e o CLI 600 s. O cliente desiste antes do servidor terminar o artigo e
grava `request-failed`. O próprio código já mede `goiania 366s` > 300 s.

**Pode estar custando artigo toda noite** no `polarisia` e no `reviewshield`. Confirmar é
barato (~10 min): adicionar o log de `error.cause?.code` no `catch` de `requestPhase`
(`run-autopublish.mjs:87`), esperar um run, ler o código.

⚠️ Qualquer mexida ali é caminho crítico das 00:13 — **fora da janela 00:00–01:00 BRT**.

## Datas firmes que continuam correndo

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl
  ([`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md)).
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
  ⚠️ Não baixar o `decay 10` do `atma` antes disso.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d (hoje 2).
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d (hoje 21).

## Ainda só o Jean pode fazer

Bing Webmaster Tools no `goiania`, as 4 chaves do Stripe do `compass`, `GOOGLE_CLIENT_ID` do
`reviewshield`, os 2 Request Indexing do `fabrica` e — o mais antigo e perigoso —
**rotacionar os segredos vazados** ([[secrets_to_rotate]]).
