# Memória institucional dos 35 — arquitetura

> Decisão de arquitetura, 31/07/2026. Objetivo: o hub deixa de ser painel de leitura e
> passa a ser a memória operacional das 35 empresas — consultável por mim (agente), pelo
> Jean e pelas próprias páginas do hub.

## O enquadramento certo

"RAG" é o nome errado do problema. Não é busca em documentos: são **três camadas com ritmos
de atualização e fontes de verdade diferentes**.

| Camada | Exemplo | Muda | Fonte de verdade |
|---|---|---|---|
| **Protocolo** — normativo | "sitemap se valida pelo corpo, nunca pelo status" | mensal | escrito |
| **Estado** — factual, medido | "atma: 4 blockers, 5/5 indexadas, deploy verde" | horas | GitHub, GSC, health, DB |
| **Episódio** — histórico, append-only | "30/07 atma desindexado; resubmit resolveu em 24h" | nunca | handoffs, memórias |

🚨 **Achatar as três num único índice vetorial é o maior erro disponível.** "O que faço com o
atma hoje?" precisa de norma + fato de agora + o que já foi tentado. Num índice único, um
handoff de três meses pontua acima da leitura do GSC de hoje, e a resposta sai confiante e
velha. As três se indexam separado e se juntam **na consulta**.

---

## Camada 0 — ontologia e tempo (a decisão irreversível)

Todo fato indexado carrega: `tipo`, `projeto[]`, `área`, `data`, `evidência`, e
**`valid_from` / `valid_to`**.

O modelo bitemporal não é refinamento — é o que impede a base de virar armadilha. A memória
atual já tem fato revogado convivendo com fato vivo: *gortex REMOVIDO*, *ProLife REPO
DELETADO*, *SplitJud EXCLUÍDO*, *Clerk vai ser arrancado*. **Devolver fato revogado é pior
que não devolver nada**, porque leva a agir com confiança em algo falso.

Fato novo que contradiz fato indexado não convive: aresta `supersede` explícita, o antigo
sai de circulação e continua auditável.

## Camada 1 — recuperação híbrida com filtro antes

- **BM25** (`tsvector`) para termo literal — `UND_ERR_HEADERS_TIMEOUT`, `decay 10`, slug
- **Denso** (`pgvector`, embedding local, custo zero de token) para paráfrase
- **Reciprocal Rank Fusion** para combinar os rankings
- **Cross-encoder reranker local** — busca 50, reordena para 10
- **Filtro de metadado ANTES da busca**: `área=seo AND projeto=atma AND válido_em=hoje`

Filtrar depois é o que faz RAG parecer burro: acha 10 bons, descarta 8 por data, sobram 2
ruins.

## Camada 2 — Contextual Retrieval

Técnica publicada pela Anthropic: antes de embedar, 2 linhas situando o chunk no documento.
Corta perto de metade das falhas de recuperação; ~2/3 combinado com reranking. Custa
claude-cli **na indexação**, uma vez por chunk — trabalho em lote para janela ociosa do pool
de tokens. Entra na fase 4 e **só fica se ganhar no conjunto dourado**.

## Camada 3 — grafo (a carga útil, não o enfeite)

Os 35 não são independentes: compartilham infra, stack, domínio e **modo de falha**. A
pergunta que justifica o hub existir não é "qual o protocolo de X", é:

> **Quais dos meus 35 têm o problema que eu acabei de descobrir neste aqui?**

Isso é travessia de grafo, não similaridade de vetor. O histórico já prova que é a pergunta
cara — cada uma destas foi descoberta projeto a projeto, separadamente:

- `vercel project não ligado ao git` — **2 projetos**
- `landing 200 ≠ backend vivo` — **3 projetos** chamando API NXDOMAIN
- `curl -k esconde erro de cert`, `Astro+nginx 301`, `middleware Edge + API Node` — cada uma
  aplicável a N outros que nunca foram checados

Hoje a propagação depende do Jean lembrar. Com 35, isso falha em silêncio.

**Entidades:** `Projeto`, `Stack`, `Infra`, `Domínio`, `Protocolo`, `Incidente`, `Lição`.
**Arestas:** `usa`, `depende-de`, `aprendeu-em`, `aplica-se-a`, `viola`, `supersede`.

Lição nova entra ligada a uma stack → o grafo devolve na hora todos os projetos que usam
aquela stack e ainda não foram checados.

## Camada 4 — federação por manifesto, não por 35 serviços

Estado vivo tem que vir por pull do projeto; conhecimento tem que ser central (ele não mora
nos repos — mora em `handoff/`, na memória e no Obsidian).

A forma boa de federar **não** é 35 MCPs à mão (35 deploys, 35 pontos de quebra, mudar o
formato = redeploy em 35). É **um MCP server falando com os 35 por contrato uniforme**:
cada repo declara `.roilabs/manifest.yaml` — stack, infra, health, gates, e **quais
protocolos afirma seguir**.

É isso que transforma protocolo de documento em sistema operacional:

> `goiania` declara seguir `SEO-04`. `SEO-04` exige "indexação provada por URL Inspection".
> O robô checa. O hub mostra vermelho quando declaração e realidade divergem.

**Protocolo que ninguém verifica é decoração** — e com 35 empresas, verificação manual não
existe.

## Camada 5 — ingestão

Não é script que quebra markdown em pedaços:

- **Extração estruturada** — handoff em prosa vira fato tipado (afirmação, evidência, data,
  projeto, área, o que revoga). claude-cli em lote.
- **Detecção de contradição na escrita** — fato novo conflita com indexado → levanta
  bandeira em vez de deixar os dois convivendo. **É a única feature que impede a base de
  apodrecer.**
- **Contínua**, no cron que já existe.

## Camada 6 — avaliação (inegociável)

**Conjunto dourado de ~50 perguntas reais com resposta conhecida**, recall@k e precisão
medidos a cada mudança de índice. Sem isso não dá para responder se o contextual retrieval
ajudou, se o reranker paga a latência, se o grafo vale. É onde a maioria dos projetos de RAG
morre em silêncio.

Matéria-prima de graça: **cada handoff contém perguntas que já foram respondidas.** O
dourado se extrai do histórico.

## Camada 7 — interfaces

Núcleo como serviço, três cascas finas: **MCP** (agente), **rota HTTP** (hub e outros
agentes), **aba** (Jean).

Toda resposta devolve **procedência + data + validade**. Resposta que o agente não consegue
verificar é resposta que ele vai re-derivar — e aí o índice não economizou nada.

---

## Sequência

1. Ontologia, schema, modelo bitemporal ← decide tudo que vem depois
2. Ingestão do corpus atual + extração estruturada + conjunto dourado
3. Híbrido + reranking, medido contra o dourado
4. Contextual retrieval, medido — mantém só se ganhar
5. Manifesto por repo + verificação de conformidade
6. Grafo + propagação de lição entre projetos
7. As três interfaces

## Risco

É sistema de verdade — semanas, não dias — competindo por atenção com 35 empresas que
precisam ser operadas. **O modo de falha é construir o sistema de conhecimento em vez de usar
o conhecimento.**

A defesa não é cortar escopo: é a fase 2 já entregar valor sozinha. Com o corpus extraído e
tipado, já se responde "quais projetos nunca foram checados contra a lição X" — antes de
existir vetor, reranker ou grafo. Se travar depois disso, nada foi perdido.

## Restrições que a implementação não pode ignorar

- **Sem API paga.** Embedding local (Ollama, como no `housing-pro-api` e no SEO Forecaster);
  claude-cli só na indexação em lote. `[[budget_claude_cli_only]]`
- **Postgres já existe** no hub (`DATABASE_URL`) — `pgvector` + `tsvector` sem infra nova.
- **Janela de não-push 00:00–01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel**, não Vercel.
