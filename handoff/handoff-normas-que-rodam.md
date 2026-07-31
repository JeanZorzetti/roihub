# Handoff — as normas rodaram, e o primeiro achado foi no próprio hub (31/07/2026, 20h BRT)

Executa: [`handoff-proximo-passo-corpus-verdade.md`](handoff-proximo-passo-corpus-verdade.md),
frente 1 ("transformar os 97 protocolos em verificação que RODA"). Antes dele:
[`handoff-resposta-com-citacao.md`](handoff-resposta-com-citacao.md) ·
[`handoff-reranker-no-ar.md`](handoff-reranker-no-ar.md).
Arquitetura: [`../docs/rag-arquitetura.md`](../docs/rag-arquitetura.md) ·
índice: [`../handoff.md`](../handoff.md).

---

## O achado mais caro veio do passo 1, antes de qualquer código

O handoff anterior mandava começar verificando produção. Verificado: **a busca estava morta em
produção e ninguém sabia.** O rodapé de `hub.roilabs.com.br/busca?q=…` trazia, lado a lado,
`rerank-output` e `resposta-output` — o código de erro que significa "o modelo escreveu bobagem".

Não era o modelo. `CLAUDE_CODE_OAUTH_TOKENS` é um pool de 3 contas, e `rodarClaude`
(`lib/reranker.mjs`) usava **sempre `tokens[0]`**, sem nunca tentar o próximo. Estado real do
pool naquele momento:

```
token[0]  429  "You've hit your monthly spend limit"
token[1]  ok
token[2]  403  "Your organization has disabled Claude subscription access"
```

Duas contas mortas, uma viva, e a busca inteira presa na primeira. **Não havia nada de errado com
a entrega de hoje de manhã** — a síntese com citação funcionava; ela só nunca chegava à conta que
respondia. O `avaliar-resposta.mjs --limite 5` reproduziu igual na máquina local: 5 de 5
suprimidas. Depois do fix, **5 de 5 respondidas, citação ancorada 100%**.

Duas coisas que valem mais que o conserto:

1. **O autopublishing NÃO está sujeito a isso.** Ele percorre o pool desde sempre
   (`autopublish-clients.ts:253`). A busca copiou o `spawn` e não a rotação — o comentário no
   arquivo até diz "duplicado de propósito", e a duplicação perdeu justamente a parte que
   importava. Se você duplicar de novo, duplique o loop.
2. **Só o `api_error_status` separa "a conta acabou" de "a resposta é ruim".** Nenhuma das duas
   mensagens do pool tem uma palavra de rate limit ou de auth: "monthly spend limit" e
   "organization has disabled" passariam batido por qualquer regex de texto. É por isso que
   `claudeError` classifica pelo status, e `trocaDeConta` agora faz o mesmo.

Este é o modo de falha que o handoff anterior descreveu na frente 5 — "o sintoma seria conta
esgotada, indistinguível de rate limit normal" — só que ele já estava acontecendo, do lado da
busca, e o rodapé o reportava com o código errado há horas.

---

## A frente 1, executada: 10 normas × 35 projetos

`lib/conformidade.mjs` + `scripts/conformidade.mjs` + `test/conformidade.test.mjs`
(**193 verdes**). Zero chamada de LLM: é rede pura, não divide pool com o autopublishing.

```
node --env-file=.env scripts/conformidade.mjs             # só as violações
node --env-file=.env scripts/conformidade.mjs --tudo      # inclui o que passou
node --env-file=.env scripts/conformidade.mjs --projeto atma
node --env-file=.env scripts/conformidade.mjs --check VER-02
```

**Quais 10, e por quê essas.** Dos 29 protocolos `falha_significa: bloqueia` + `por entrega`, só
entraram os que rodam contra a URL de produção. Os que fazem `grep` no repo do projeto ficaram de
fora **de propósito**: só o roihub está clonado aqui, então eles rodariam contra 1 de 35 e não
produziriam informação nova sobre o mundo real — que é a única justificativa desta frente.

**Stack e infra são DETECTADOS da resposta HTTP, não declarados.** `projects.json` não tem esses
campos, e criar um campo manual descreveria o que o projeto era quando alguém digitou. O header
diz o que ele é agora. É isso que faz o cruzamento `aplica_se_a × projeto` rodar sem curadoria.

### O placar da primeira corrida

```
VER-01   0 falham · 35 passam ·  0 n/a   cert que o navegador aceita
DEP-03   0 falham · 35 passam ·  0 n/a   home viva (200 com HTML)
VER-02   1 falham · 34 passam ·  0 n/a   sitemap e robots validados pelo CORPO
DEP-08  11 falham ·  4 passam · 20 n/a   headers do next.config chegam na borda
SEO-01   0 falham ·  4 passam · 31 n/a   URL sem barra não cai em http://
GEO-01  28 falham ·  7 passam ·  0 n/a   crawler de IA na whitelist + llms.txt
GEO-02   1 falham ·  6 passam · 28 n/a   sameAs só com perfil canônico
SEC-01   0 falham · 10 passam · 25 n/a   painel publicado tem sessão de verdade
DNS-05   0 falham ·  1 passam · 34 n/a   www do domínio próprio responde
VER-04   0 falham · 34 passam ·  1 n/a   homepage do repo é a URL que o hub usa

41 violações em 35 projetos.
```

---

## O que o placar diz, lido do jeito que o handoff anterior pediu

**Norma que passa em 35/35 não é norma morta aqui — é norma que já venceu.** `VER-01` (cert) e
`DEP-03` (home viva) passam em todo mundo: **nenhum certificado quebrado e nenhum site fora do ar
em todo o portfólio**, com o cert mais apertado a 31 dias do vencimento (`reviewshield`). Isso é
resultado, não trivialidade — o `VER-01` nasceu de um incidente real no `atmaadmin`, e o número
de hoje é a prova de que ele parou de acontecer. **Se algum dia esse 0 virar 1, o runner acha em
40 segundos.**

**`GEO-02` no `estetiacrm` é o achado caro e é barato de consertar.** O JSON-LD serve
`twitter.com/roilabs` e `linkedin.com/company/roilabs` — os dois nomes que a norma lista
explicitamente como queimados: a página do LinkedIn foi **deletada** e o handle do Twitter não é
da casa. Pior: **são dois blocos `sameAs` na mesma página**, o que viola de quebra o "@graph
único" do `GEO-01`. Entidade errada em structured data é exatamente o que o playbook GEO/AEO
existe para impedir, e está no ar num produto com 3 vendas orgânicas.

**`GEO-01` falhando em 28/35 não é norma errada, é trabalho não feito** — e agora ele tem lista.
Os 7 que passam são os que receberam investimento de SEO (`tapepro`, `goiania`, `sirius`,
`estetiacrm`…). Os 28 restantes não têm `llms.txt` nem whitelist de crawler de IA. Num portfólio
declaradamente **100% SEO, sem Ads**, isso é a diferença entre ser citável e ser invisível para
ChatGPT/Perplexity. Baixa urgência por projeto, alto valor agregado: é um arquivo estático por
site.

**`DEP-08` em 11 de 15 apps Next merece leitura honesta.** O check mede **ausência dos três
headers**, e ausência tem duas causas: config duplicado (`next.config.js` vencendo o `.mjs`, que
é o que o protocolo descreve) ou headers simplesmente nunca configurados. **O check não separa as
duas** — só `ls next.config.*` no repo separa. O que ele prova é mais simples e ainda assim vale:
11 apps Next em produção sem `x-frame-options`, `x-content-type-options` nem `referrer-policy`.

**`VER-02` no `portfolio`**: `robots.txt` sem linha `Sitemap:` (e o arquivo nem existe — 404 com
HTML). É o único projeto em domínio de fornecedor (`*.vercel.app`), que já está fora de toda
propriedade do GSC por decisão do Jean. Achado real, prioridade baixa por consequência.

---

## As 3 normas que o próprio runner reescreveu

Este é o retorno que o handoff anterior previu — "norma que não roda está mal escrita" — e ele
veio três vezes na primeira sessão. Em todos os casos **o check estava errado, não o projeto**, e
consertar o check tornou a norma mais precisa do que a prosa original:

1. **`SEC-01` acusou 3 projetos e nenhum era violação.** O check perguntava
   `/api/auth/session` e tratava 404 como "não existe login". O `context.nimblabs.com` protege
   `/dashboard` com **Auth0** (307 para `/api/auth/login`) e não tem rota de next-auth nenhuma; o
   `verticemarketing` nem painel tem. A norma não fala de biblioteca — ela manda *"iterar TODAS
   as rotas sem sessão contando quantas devolvem 200"*. Medindo isso: **0 falhas em 10 apps,
   nenhuma rota de painel aberta.** Um check de 3 falsos positivos virou uma garantia de
   segurança em cima de 10 projetos.
2. **`VER-02` reprovou o `tapepro` por adivinhar `/sitemap.xml`.** Ele serve
   `sitemap-index.xml` (o padrão do `@astrojs/sitemap`) e **anuncia isso corretamente no
   robots.txt**. O check media a convenção do Next, não a norma. Agora ele **segue o ponteiro do
   robots** — que é, aliás, o que a própria exceção do protocolo já mandava fazer.
3. **`GEO-02` acusou os perfis do Atma Aligner.** Facebook/Instagram/LinkedIn da marca do
   projeto, que não estão sob uma norma sobre a identidade **ROI Labs**. O critério verificável é
   mais estreito: perfil da lista negra, ou perfil que se apresenta como ROI Labs sem ser um dos
   quatro canônicos. ⚠️ E a comparação tem que ser **por perfil inteiro, nunca por substring** —
   `roi-labs-curadoria` (canônico) contém `roi-labs` (proibido), e `includes` reprovaria
   justamente o perfil certo.

**A lição operacional:** a primeira corrida de um check novo mede o check. Ler as violações uma a
uma antes de acreditar no agregado é a mesma disciplina que salvou os 5 falsos "recusou" da
síntese hoje de manhã — e ela pegou 5 de 46 aqui.

---

## O que NÃO fazer

- **Não converter os 19 checks restantes de `bloqueia` que fazem grep no repo** enquanto os repos
  não estiverem clonados. Rodar contra 1 de 35 não é executar a norma, é rodar um teste.
- **Não tratar `n/a` como aprovação.** `SEO-01` deu 31 n/a: só 4 projetos têm sitemap com página
  interna terminada em barra. O check é honesto sobre o que não olhou.
- **Não usar o `-k` que o `VER-01` proíbe.** O `pegarCert` usa `rejectUnauthorized: false`, que
  parece o mesmo e é o oposto: o flag proibido **esconde** a recusa, este **lê o motivo dela** —
  sem ele, um cert auto-assinado derruba a conexão antes do callback e some justamente o campo
  (`issuer`) que prova que ele é auto-assinado.
- **Não mexer no prompt da síntese sem intenção de remedir tudo:** a chave do cache é o hash do
  prompt (continua valendo, ver dívida nº 6 do handoff anterior).

---

## Próximo passo, ranqueado

1. **Consertar o `sameAs` do `estetiacrm`** — é o único achado desta corrida que é dano ativo em
   produção, e é uma edição de arquivo. Fonte única: `lib/geo/entity.ts` (o padrão que o Sirius
   já usa). Depois: `--check GEO-02` para confirmar.
2. **A frente 2 do handoff anterior, intocada: o juiz de VERDADE sobre `dourado.resposta`**, com
   a régua quebrada por camada. Continua sendo o maior débito, continua cabendo numa sessão, e
   **a régua de hoje continua medindo ancoragem**.
3. **Rodar o `conformidade.mjs` toda entrega** — ele leva ~40 s e agora é o único componente do
   sistema que produz informação nova sobre o mundo real. Ainda **não está no `npm test`** de
   propósito: teste não faz 140 requisições contra produção. Candidato natural a cron, junto do
   robô de crawl de domingo.
4. **`llms.txt` + whitelist nos 28 do `GEO-01`**, em lote, começando pelos que têm tráfego.

## Dívida contraída aqui

1. **O resultado não é persistido.** Cada corrida imprime e some — não há série temporal, então
   "isso quebrou hoje ou está quebrado há um mês?" não tem resposta. Um JSON por corrida em
   `data/` resolveria e alimentaria a aba.
2. **Nada disso aparece na UI.** O hub sabe de 41 violações e não conta a ninguém que não rode o
   script.
3. **`DEP-08` não separa suas duas causas** (ver acima). Separar exige o repo na mão.
4. **A concorrência é 6 fixa, sem retry.** Um projeto lento vira violação por timeout de 15 s —
   não aconteceu nesta corrida, mas acontecerá.

## Armadilhas de operação (continuam valendo)

- **Reindexar depois de escrever handoff ou memória:** `node --env-file=.env scripts/indexar.mjs`
  (de máquina com Ollama, nunca do container). As memórias moram em `~/.claude`, fora do repo.
  **Este handoff inclusive.**
- **`--motor todos` NÃO inclui o rerank.** `--motor rerank` explicitamente, com `--min bm25`.
- **Não dar push entre 00:00 e 01:00 BRT** (cron do autopublishing às 00:13).
- **Deploy é Docker no EasyPanel, não Vercel.**
- **O rodapé da aba é a ÚLTIMA `.foot` da página** — grep por texto de aviso casa com o CONTEÚDO
  de um resultado.
- **`HUB_USER`/`HUB_PASS` estão no `.env` local** — não é preciso pedir ao Jean para verificar
  produção, ao contrário do que o handoff anterior supunha. Continuam na fila de rotação
  ([[secrets_to_rotate]]).

## Datas firmes

- **Domingo 02/08, 10:00 BRT** — 1º run do robô de crawl.
- **~02/08** — reconferir o `errors: 1` do sitemap do `fabrica`.
- **~14/08** — remedir `sirius` (CTR do `agaas`) **e** a série de impressões do `atma`.
- **31/08** — gate do `sirius`: ≥ 5 cliques não-branded/28d.
- **19/10** — gate do `tapepro`: ≥ 300 imp/28d.

## Verificado em produção

`hub.roilabs.com.br/busca?q=…` depois do deploy: **200 em 15,8 s, rodapé com "BM25 + vetor +
rerank · recall@10 88,0%", bloco `Resposta` renderizado com `[1][2]`, zero aviso de erro.** É a
primeira vez que essa frase pode ser escrita sobre a síntese — hoje de manhã ela era falsa e o
rodapé dizia por quê.
