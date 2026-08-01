# ROI Hub — handoff

> ▶️ **PRÓXIMO PASSO — [`handoff/handoff-a-camada-estado-dobrou.md`](handoff/handoff-a-camada-estado-dobrou.md)
> (01/08): a camada `estado` foi de 8 para 15 fatos, e o custo era LIGAR, não construir.** As sete
> fontes que já rodavam viraram apurador; o trabalho foi mover a lógica de script para `lib/`.
> 🚩 **Fonte cara ganhou MODO PRÓPRIO** (`offline` < `tudo` < `caro`): sem isso, toda corrida de
> régua dispararia ~250 requisições contra produção. Perguntas que leem a mesma varredura
> compartilham cache por execução, e há teste que conta as requisições.
> ✅ **A 1ª corrida mediu o CHECK duas vezes** — `D-85` listou 34 "hosts com problema" e nenhum era
> de agora (grep por `problem` casa os TRÊS estados do GSC); `D-81` decompunha 10 em subgrupos que
> somavam 9. **4 âncoras de 6 candidatas entraram, medidas contra o corpus antes de escrever.**
> 🚩 **4 `desmente`: 3 reais (a MESMA memória viva, que se contradizia internamente) e 1 falso
> positivo em handoff DATADO, que não se reescreve.** Nenhum percentual saiu daqui.
> ⚠️ **O dourado foi de 78 para 85 perguntas:** o recall da busca tem denominador novo — piso
> relativo (`--min bm25`), nunca comparação com o número de ontem.
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-proximo-passo-dobrar-a-camada-estado.md`](handoff/handoff-proximo-passo-dobrar-a-camada-estado.md)
> (01/08): dobrar a camada `estado`, e as FONTES JÁ EXISTEM.** O teto do detector eram **8 fatos**
> (8 × 1,1 = 9 pares), e nenhuma varredura conserta um universo de 8. Mas **6 scripts deste repo já
> apuram fato contra fonte viva com ZERO LLM e nenhum está ligado à camada** (`gateways`,
> `gateways-repo`, `conformidade`, `validade`, `inspect-url`, `fetch-crawl-stats`) — são **~7 fatos
> novos → 15**, e o trabalho é LIGAR, não construir.
> 🎯 **Vale o dobro desde ontem:** cada fato novo ganha também uma **âncora da 2ª via**, e esses
> números estão escritos em MEMÓRIA VIVA — o par que a mineração do git não conseguiu fabricar.
> 🚩 **Duas premissas medidas que fecham caminhos:** gate em card rende **2 de 35** (os dois que já
> são `D-68`/`D-69` — zero fato novo por aí) · `apurarEstado({modo:"tudo"})` roda TODOS os
> apuradores, então pendurar `gateways.mjs` (250 req) ali faria **toda corrida de régua** disparar
> 250 requisições contra produção.
> ⚠️ Fato novo aumenta a BANCADA, não move portão: a frente do detector segue **congelada**.
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-a-segunda-via-de-selecao.md`](handoff/handoff-a-segunda-via-de-selecao.md)
> (01/08): o passo 3 — o `corpus-defasado.mjs` tem 2ª via de seleção.** A busca
> recupera por TEMA; a 2ª via traz quem **CITA a quantidade com outro número** (`docsQueCitam`, zero
> LLM, zero rede). É a única via que alcança a classe de defeito do `project_cannibalscan`.
> 🎯 **A largura da âncora foi medida ANTES de escrever:** `(\d+) projetos` solto seleciona **43**
> documentos e quase todos são quantidade HOMÔNIMA — cada um custaria uma chamada do pool para o
> modelo dizer `nao-fala`. Estreita: **6**. Âncora nova só entra medida contra o corpus.
> 🚩 **O PERCENTUAL SAI SÓ DA BUSCA.** A 2ª via só seleciona número que JÁ diverge: é amostra
> PROCURADA, e no denominador faria a taxa de erro subir sozinha a cada melhora da âncora. O campo
> `via` separa; a lista NOMINAL junta.
> ✅ **1ª corrida (D-66, 16 chamadas): 3 documentos novos, 3 `nao-fala`, ZERO acusação fabricada.**
> Os 3 estão certos — 2 handoffs de 29/07 e o `project_roihub`, cujo "41 repos ativos" mora num
> bullet **`★ Estado 30/07`**. **Data grudada no span absolve**, a mesma regra do `validade.mjs`.
> ⚠️ A frente do detector **segue congelada**: nada aqui move portão.
> 🚨 **Passos 1 (token do MP), 2 (porta 5434) e 4 (chaves da Stripe) seguem parados em você.**
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-o-teste-de-20-minutos-deu-vermelho.md`](handoff/handoff-o-teste-de-20-minutos-deu-vermelho.md)
> (01/08): o teste da seção 3 foi executado e deu VERMELHO. A frente do detector está CONGELADA.**
> Minerar `desmente` do histórico do git rendeu **8 pares legítimos, meta era 15**. O `git log -p`
> parecia verde com 7× de margem (116 candidatos) e **era o check**: handoff datado não se reescreve
> de propósito, então a afirmação de 30/07 já está VIVA no corpus — o histórico só acrescenta versão
> velha de `CLAUDE.md`/`docs/`, que **nem estão em `carregarCorpus()`**.
> 🎯 **O teto são 8 FATOS, não a varredura.** Cada fato com fonte viva rende ~1 afirmação defasada;
> 8 × 1,1 = 9. Para 25 casos é preciso **dobrar a camada `estado`** — e **7 dos 8 pares são o mesmo
> fato**. Nenhuma varredura conserta um universo de 8.
> 🚩 **O subproduto vale mais: a SELEÇÃO por embedding é o gargalo, não o prompt.** Um `grep`
> ancorado no fato achou um `desmente` REAL que a busca nunca recupera — a memória
> `project_cannibalscan` dizia `Hub: 39 projetos` (hoje 35), num doc sobre deploy da Vercel.
> **As 3 tentativas que falharam mexeram todas no prompt; nenhuma mexeu em quais documentos chegam
> até ele.** Conserto barato e nomeado: 2ª via de seleção por citação do número.
> 🚨 **Passos 1 e 2 remedidos e SEGUEM bloqueados em você:** token do MP → **200** (incidente aberto
> há 2 dias, só o 401 fecha) · `31.97.23.166:5434` → **TIMEOUT** (as 3 vendas do `sirius` seguem sem
> conferência no banco).
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-o-que-e-melhor-fazer.md`](handoff/handoff-o-que-e-melhor-fazer.md)
> (01/08): o que é MELHOR fazer, sem desconto por esforço — e a DEFINIÇÃO DE PRONTO das duas
> features.** Três premissas herdadas foram medidas e **duas caíram**: 1.7 já estava fechado, e
> "30 sem cobrança" eram 27. A terceira piorou — **o token de produção do MP está VIVO** (`/users/me`
> → 200, conta 3020352786, `live=active`), mora em `DEPLOY_PRODUCTION.md:53` (**um `.md`, não um
> `.env` — por isso nenhuma higiene o vê**) e é **byte-idêntico ao do `.env` deste repo**, então
> rotacionar quebra a régua do dinheiro se os 3 consumidores não forem atualizados juntos.
> **Só o antigo devolvendo 401 prova que fechou.** ✅ Varredura em todos os repos descartou 2ª
> exposição.
> 🎯 **O diagnóstico que faltava no detector: a célula que decide tem CINCO casos.** `desmente` 5/5
> — os portões estão respondendo "ele deixa passar corpus podre?" com uma amostra de cinco, e
> nenhuma redação de prompt conserta conjunto. **Critério 1.8 novo: `desmente` ≥ 20.**
> 💡 **A mina de `desmente` natural é o HISTÓRICO DO GIT** — esta casa não reescreve handoff datado
> de propósito, então ela preserva afirmações que a fonte viva hoje desmente. **Teste de 20 min que
> mata a ideia antes de dias de trabalho está na seção 3.**
> 💰 **A cobrança nunca teve definição de pronto. Agora tem:** *um estranho consegue pagar, o
> dinheiro chega numa conta real e uma RÉGUA lê o valor sem ninguém digitar* — 5 testes, `payer`
> separando venda de teste, e um SEGUNDO pagamento sem intervenção.
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-o-cruzamento-achou-o-check-errado.md`](handoff/handoff-o-cruzamento-achou-o-check-errado.md)
> (01/08): o item 5 executado, e o cruzamento auditou o próprio check.** Dos **10 projetos com SDK
> de pagamento escrito, UM faturou** (`atma`): **6 já servem preço e só falta LIGAR** (`sirius`,
> `polarisia`, `estetiacrm`, `context`, `orion`, `vertice`) e 3 estão mais longe (`reviewshield`,
> `aftercare`, `compass`). `orcaobra` é o único inverso — Kiwify por link externo não deixa
> dependência no `package.json`, e por isso as duas metades precisam existir.
> 🚩 **VER-08, oitava vez: o cruzamento achou dois defeitos do `gateways.mjs`** — `/preco` no
> singular fora da lista de caminhos (o `polarisia` caía em "NÃO TEM GATEWAY") e **preço em ÂNCORA
> não é rota** (`context` e `vertice` são landing de uma página só). **Um check sozinho não tem
> contra o quê errar.** Controle: os 3 que mudaram de balde têm os 3 SDK no repo, nenhum sem SDK
> entrou. `sem-gateway` 30 → 27.
> 🚩 **E o item 4 daquela lista JÁ ESTAVA FEITO no commit que a criou** — 1.7 tem as duas medições
> e está **FECHADO**. Lista de próximos passos é premissa, não fato.
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-a-definicao-de-pronto-executado.md`](handoff/handoff-a-definicao-de-pronto-executado.md)
> (01/08): a fase D era a aposta do documento e ela REPROVOU com número.** Quebrar o detector em
> duas passadas (extrair a afirmação / julgar contra o fato) foi implementado e medido no MESMO
> fixture congelado: **83,3% → 65,9%** no holdout, adversarial parado em 14/20, e — o que decide —
> **as células perigosas saíram de ZERO para `bate→desmente` 5 e `desmente→nao-fala` 1**. Cego ao
> documento é cego ao **contexto que torna a afirmação compatível**: a passada 2 chamou de
> incompatível *"a fonte é a API do GitHub + `lib/projects.mjs`"* contra um apurado que dizia
> *"API do GitHub + `data/projects.json` via `mergeProjects()`"* — o mesmo mecanismo com outro nome.
> **O que funciona é evidência antes da decisão DENTRO da mesma chamada, não a decomposição em
> duas.** Fica atrás de `--duas-passadas` só para o número ser reproduzível.
> ✅ **C, R e F entregues:** holdout **33 → 44** casos que contam, adversarial **10 → 20** (6
> espelhos), âncora em 20/20; **1.7 medido 2× com movimento ZERO** — o portão mede o detector, não
> o dia; e `scripts/gateways-repo.mjs` **inverte o inventário de cobrança**: pelo HTML eram 30 sem
> caminho, pelo CÓDIGO são **10 projetos com SDK de pagamento escrito e nunca ligado**.
> 🚩 **Dois portões afrouxaram/travaram sozinhos:** o piso do adversarial era ABSOLUTO (`>= 9`) e
> dobrar o fixture fez 14/20 "passar"; e **os 61 pares candidatos não têm UM `desmente` natural** —
> a célula que decide não cresce com este material.
>
> 📄 **A SPEC — [`handoff/handoff-a-definicao-de-pronto.md`](handoff/handoff-a-definicao-de-pronto.md)
> (01/08): a DEFINIÇÃO DE PRONTO, e por que ela vem antes da próxima fase.** A frase incômoda que
> abre o documento: **em 3 dias esta frente produziu 6 handoffs, 9 réguas e 4 docs de calibração — e
> o número que ela existe para produzir nunca foi publicado uma única vez.** Causa mecânica, não
> moral: **nenhum handoff desta frente jamais escreveu o que significa terminar**, então cada um
> entrega 9 fases, executa 3 e gera o próximo com 8.
> 🎯 **PRONTO = 3 níveis.** (1) o **instrumento** passa nos dois portões com 40+/20 casos, âncora em
> 100%, **células perigosas em zero** e — critério que não existia — **reprodutibilidade medida 2×**.
> (2) a **feature** publica a taxa de erro do corpus **uma vez**, com o recorte E a fronteira na
> mesma frase (8 de 78 contra fonte viva; 70 são prosa concordando com prosa). (3) o **loop** fecha:
> uma segunda corrida mostra o número **CAINDO** porque os achados da primeira foram consertados.
> **Sem o nível 3 isto é um termômetro caro que ninguém leu.**
> 💰 **Custo honesto do caminho inteiro: ~20 a 26 h e ~350 chamadas.** Explicitamente FORA do pronto:
> fases I e H, cobrir as 78 com fonte viva, e qualquer régua de LLM nova.
> **Ordem: A → C → D → R → G → L**, com F em paralelo. **A (token do MP) é dívida vencida e só sua.**
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-os-quatro-erros-sao-a-mesma-celula.md`](handoff/handoff-os-quatro-erros-sao-a-mesma-celula.md)
> (01/08): B e E executadas, C parcial.** A tese: **o detector não fabrica achado e não esconde
> achado — ele erra em decidir se o documento FALA do assunto.** Com o holdout ampliado (13 → **33
> casos que contam**, um caso vale 3,0 pts e não 7,7), os 4 erros são **todos `bate → nao-fala`**:
> zero `desmente` perdido, zero fabricado, 5/5 na célula que decide. **Para a lista nominal o
> detector acertou 32/32** — e isso **não libera percentual**, porque é o mesmo mecanismo do erro
> que esconde corpus podre.
> 🚨 **(A) O token de PRODUÇÃO do MP vazado AINDA FUNCIONA** — reconferido em 01/08, autenticou.
> Nada depende dela, só a inércia. ~1 h, só o Jean.
> 🔑 **(B, feita) `fiel + discorda` é NECESSÁRIO, não suficiente:** dos 3 casos, só **1** aponta para
> o corpus — `D-71` aponta para a **síntese** (a resposta estava no trecho que ela recebeu) e `D-72`
> para a **recuperação** (o doc citado não tem `00:13`; 10+ que têm nunca chegaram).
> 🔑 **(E, feita) O `effort` ficava fora da chave do cache** — trocar o effort do detector devolveria
> as respostas do effort anterior em silêncio. Consertado com 0 chamadas. E `dourado_lacrado` agora
> trava por hash os 27 gabaritos que os portões liam de um arquivo mutável.
> 🔑 **(C, parcial) 33 de 40.** Faltam +7 no holdout e o adversarial 10 → 20. **61 pares candidatos
> já estão gerados e recortados** em `data/defasagem-candidatos.json` — falta a leitura.
> 💰 **(F) `orcaobra` segue sendo o único gateway vivo sem régua lendo.**
> **Ordem defendida: A → C(resto) → D → B-2/B-4 → F → G → H → I.**
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-o-portao-tem-treze-casos.md`](handoff/handoff-o-portao-tem-treze-casos.md)
> (01/08, 04h50): o instrumento melhorou, o portão que julga o instrumento não.** Especificação de
> trabalho, não relatório. A tese: o detector saiu de **3 para 9** vereditos corretos em 10
> corrupções, enquanto o holdout marcou 71,4% → 88,9% → 91,7% → **84,6%**, subindo e descendo com a
> qualidade só subindo. **Um portão com 13 casos válidos oscila 7 pontos quando UM caso muda de
> lado — ele não decide nada.**
> 🚨 **(A) O token de PRODUÇÃO do Mercado Pago vazado AINDA FUNCIONA** — autenticou hoje. Rotacionar
> no painel do MP e atualizar os TRÊS envs. Nada depende dela, só a inércia. ~1 h.
> 🔑 **(B) O sinal mais valioso que este sistema já produziu nunca foi lido, e custa ZERO chamada.**
> A primeira corrida do juiz com gabarito vivo devolveu **3 `fiel + discorda` + 1 `contradiz`** — a
> síntese derivou CERTO do corpus e mesmo assim discorda da fonte viva. É o corpus errado, medido.
> Está em `data/juiz-corridas/2026-08-01-0423.json`.
> 🔑 **(C) ANTES de mexer no detector de novo: holdout 13 → 40, adversarial 10 → 20.** É a fase
> braçal, sem gráfico bonito, e é a que torna todas as outras decidíveis. **~4-6 h de rotulagem à
> mão.** Com 13 casos a fase D não é avaliável: qualquer resultado cabe no ruído.
> 🔑 **(D) Só então as DUAS PASSADAS** (extrair a afirmação / comparar com o fato). Três redações de
> regra já falharam; o que funcionou 3× foi **forçar a evidência antes da decisão**.
> 💰 **(F) `orcaobra` subiu:** é o **único** projeto com gateway vivo (`pay.kiwify.com.br`) e nenhuma
> régua lendo. `sirius` não cobra pelo site — fatura por tier no banco, `:5434` ETIMEDOUT.
> **Ordem defendida: A → B → C → D → E → F → G → H → I.** Com pool ruim, **A → B → C → E → F não
> gastam uma chamada sequer.**
>
> ✅ **EXECUTADO (01/08) — [`handoff/handoff-o-formato-era-o-bug.md`](handoff/handoff-o-formato-era-o-bug.md)
> (01/08): A, B, C.1 e C.4 executadas. D NÃO — e é a única que fica mais cara a cada dia.**
> 🔑 **(A) A hipótese era certa e custou três linhas.** `VEREDITO` deixou de ser a primeira linha da
> resposta e virou a última, depois do trecho e do motivo: adversarial **3/10 → 8/10**, holdout
> **71,4% → 84,6%**. Duas redações de REGRA já tinham falhado no mesmo formato. **Os dois portões
> ainda reprovam por UM caso cada, e todo erro restante diz `nao-fala`** — o detector julga o TEMA
> do documento. **Próximo desenho é DUAS PASSADAS, como o juiz; não é uma terceira redação.**
> 🔑 **(B) O gabarito que não apodrece chegou à régua.** As 8 de `estado` são julgadas contra
> apuração da hora, `nao_apurado` TIRA a pergunta da corrida, o campo `resposta` delas está VAZIO no
> `dourado.json` com teste segurando. Achado de brinde: **o portão do juiz se dizia congelado e lia
> um arquivo mutável** — gabarito agora inlinado em `dourado_congelado`. Juiz intacto: 87,5% / 10-10.
> 💰 **(C.1) O portfólio NÃO COBRA, e essa é a resposta que faltava.** 1 gateway ligado (`atma`), 1
> servido e sem régua lendo (`orcaobra`/Kiwify), 3 só com página de preço, **30 sem caminho de
> cobrança nenhum**. A leitura de "1 de 35" é **"faltam 2", não "faltam 34"**. Fechou a C.4:
> `receitaProvada` NÃO entra no score (condição nova escrita em `lib/score.mjs`).
> 🚨 **(D) CONTINUA VENCIDA: o token de PRODUÇÃO do Mercado Pago em repo PÚBLICO ainda funciona** —
> a régua do dinheiro rodou com ele hoje. Só o Jean pode, no painel do MP, e são TRÊS envs.
>
> ✅ **A spec que originou o trabalho acima — [`handoff/handoff-o-veredito-vem-antes-do-raciocinio.md`](handoff/handoff-o-veredito-vem-antes-do-raciocinio.md)
> (01/08, 00h40): a casa mede bem e LIGA MAL.** Especificação de trabalho, não relatório. A tese:
> nenhuma das três frentes abertas precisa de régua nova — as três precisam que o que já existe seja
> ligado ao que já existe.
> 🔑 **(A) O detector de defasagem responde ANTES de pensar.** O formato de saída pede `VEREDITO:` na
> **linha 1** e o `MOTIVO:` na linha 3 — o modelo crava o veredito antes de escrever o raciocínio que
> o justifica, e é exatamente a forma do bug visto 3×. Duas redações de REGRA já falharam; a hipótese
> não testada é o FORMATO. **Inverter a ordem + falha fechada quando `desmente` vem sem `TRECHO`
> literal. ~1 h, e decide se a fase F existe.**
> 🔑 **(B) O juiz e o avaliador NÃO chamam `apurarEstado()`.** `avaliar-resposta.mjs:42` lê o
> `dourado.json` e `juiz.mjs:50` recebe o texto ESCRITO — as 8 perguntas cujo gabarito a casa sabe
> apurar seguem julgadas contra prosa que apodrece. **A frente inteira de 31/07 não chega à
> medição.** Conserto: apurado no lugar do texto, `nao_apurado` TIRA a pergunta da corrida (nunca
> fallback), e **esvaziar `resposta` das 8 de `estado`** — texto que não existe não apodrece.
> 💰 **(C) 34 dos 35 sem gateway, e ninguém sabe quantos sequer TÊM um.** C.1 é o inventário de
> gateways, zero LLM, e é o que muda a priorização. `sirius` travado em REDE (`:5434` ETIMEDOUT);
> `orcaobra`/Kiwify nunca tentado.
> 🚨 **(D) VEM PRIMEIRO, fora de ordem: rotacionar o token do Mercado Pago.** `SEC-04` registra
> token de PRODUÇÃO em repo PÚBLICO, em todo o histórico — **e é o token que a régua nova de dinheiro
> usa hoje.** É a única coisa do documento que fica mais cara a cada dia.
> **Ordem defendida: D → A → B → C → E → F → G.** Com pool ruim, **D → C.1 → B(código) não gastam
> uma chamada sequer.**
>
> ✅ **FASES A, B, C e D EXECUTADAS (01/08) —
> [`handoff/handoff-lastro-no-dinheiro-e-no-gabarito-executado.md`](handoff/handoff-lastro-no-dinheiro-e-no-gabarito-executado.md).**
> 💰 **(A) O dinheiro ganhou lastro em 1 dos 35: o Mercado Pago do `atma` tem 20 pagamentos
> `approved` com `live_mode: true`, R$ 47 cada — R$ 940 — e ZERO venda.** Os 20 têm payer
> `test_user_…@testuser.com` e CPF 11111111111: é o Jean testando o checkout. **Somar `approved`
> teria publicado R$ 940 de faturamento inexistente com autoridade de número apurado.** Quem separa
> é o payer; `live_mode` não separa nada. **8 de 8 apuradas.** `vendas` ausente ≠ `vendas: []` —
> ausente é "não olhei". O `sirius` NÃO foi ligado: `31.97.23.166:5434` dá **ETIMEDOUT** da máquina
> de dev (rede, não credencial), e as "3 vendas orgânicas" viraram **"AFIRMADAS"** no card.
> 🚩 **(B) Os dois portões do detector de defasagem REPROVARAM: holdout 71,4%, adversarial 3/10.** O
> modo de falha é um só — **`nao-fala` engole tudo**: ele julga o TEMA do documento, não a
> afirmação nele. **Isso INVERTE a leitura do 16,7%: um detector que absolve 7 de 10 corrupções
> deliberadas subestima a defasagem, não superestima.** Nenhum percentual sai, e **a fase F fica
> BLOQUEADA pela medição**, não pela agenda.
> 🆕 **(C) Holdout da curadoria: concordância 77,1% (família) e 85,7% (estado).** A derivação cega
> **reinventou a quarta família sozinha** (valida `nao-vende`) e **precisou de uma quinta:
> `produto`** — 4 projetos que a curadoria tinha em três famílias diferentes dizendo a mesma coisa.
> **6 das 8 divergências eram a DEFINIÇÃO, não o rótulo**; agora são testes com precedência.
> **(D) `VER-08`**: a primeira corrida de um check novo mede o CHECK — e **a quinta vez foi esta
> sessão**: 6 dos 20 rótulos do holdout eram inválidos por CONSTRUÇÃO. Ficaram no arquivo.
> ⏭️ **Faltam E (inventário do conversível, ~1 sessão de leitura) e G (remedir com `--juiz`).**
>
> ▶️ **SPEC ORIGINAL — [`handoff/handoff-lastro-no-dinheiro-e-no-gabarito.md`](handoff/handoff-lastro-no-dinheiro-e-no-gabarito.md)
> (31/07, 23h): as réguas de texto amadureceram; falta lastro no DINHEIRO e no gabarito mais novo.**
> Especificação de trabalho, não relatório. A tese: **o hub prioriza 35 projetos por um número de
> receita que nunca foi checado contra um sistema de pagamento**, e o gabarito de `D-70`, ligado
> ontem, é julgamento de agente sem holdout. Nenhuma das duas se resolve com mais LLM.
> 💰 Ordem defendida: **(A)** `D-67` contra o gateway — Mercado Pago primeiro, `mcp__mercadopago__*`
> está disponível; "o Jean não lembra as datas" fecha a pergunta errada, porque a pergunta é o que
> o gateway registra. **Zero chamadas.** **(B)** os dois portões do detector de defasagem — e
> refazer o `.cache/rerank.json` **uma vez só** aqui, que a fase 0 invalidou. **(C)** 🆕 o holdout
> da CURADORIA: derivação cega e independente de `familia`/`estado` nos 35 cards, concordância
> medida, e só os divergentes vão ao Jean. **(D)** o protocolo da primeira corrida — **a quarta vez
> chegou** (46→5, 8→3, 3→2). **(E)** inventário do conversível · **(F)** detector de contradição ·
> **(G)** remedir e publicar com a fronteira declarada.
> 🚩 **O 16,7% continua PRELIMINAR: a fase 0 consertou 1 das 3 causas de falso positivo, não 3.**
> **Com pool ruim, A → C → D não gastam uma chamada sequer** — e ainda assim são as três melhores
> coisas a fazer.
>
> ✅ **FASES 0 e 3 EXECUTADAS (31/07, 22h) —
> [`handoff/handoff-checar-em-vez-de-julgar-executado.md`](handoff/handoff-checar-em-vez-de-julgar-executado.md).**
> As duas de **zero chamadas**. **(0)** `ressalva` virou campo próprio: a limitação da medição saiu
> de dentro do fato apurado — era ela que fazia o detector ler `desmente` entre um documento que
> dizia "hoje 2" e um apurado de **2**. **(3)** `scripts/validade.mjs` no ar, dentro do `npm test`:
> varre os documentos **vivos** (protocolo, card, memória — **handoff nunca**) atrás de `(hoje N)`,
> e a absolvição é avaliada **dentro do trecho casado, nunca na linha** — na linha, o `PRT-03` que
> originou a norma seria absolvido pela data do *prazo* do gate. **A primeira corrida mediu o
> CHECK pela terceira vez seguida: 3 achados, 1 defeito limpo.** Os 2 de fronteira saíram datando o
> documento, porque afrouxar a regex teria absolvido justamente o real. Hoje: **0 achados em 230
> documentos vivos**, 238 testes verdes.
> ✅ **FASE 2 também, em 2 dos 3 campos: o dourado de `estado` está 7/8 APURADO.** `familia`,
> `estado` e `blockersLista: {texto,humano}` curados nos 35 cards ligaram `D-70` (27 travados, e
> uma **quarta família que a spec não previa — `nao-vende`**, 7 projetos que não tentam faturar por
> decisão) e `D-71` (8 bloqueios humanos). **`D-67` fica `nao_apurado` e é a resposta certa: o Jean
> não tem as datas das vendas, e inventar data de venda é fabricar registro.** ⚠️ **A curadoria por
> card é derivada e pede o olho do Jean** — a seção 3-bis do executado lista as 6 divergências
> contra o dourado escrito. **Fases 1, 4, 5 e 6 continuam abertas, e o 16,7% de defasagem continua
> PRELIMINAR.**
>
> ▶️ **PRÓXIMO PASSO — [`handoff/handoff-checar-em-vez-de-julgar.md`](handoff/handoff-checar-em-vez-de-julgar.md)
> (31/07): parar de somar régua de LLM e converter afirmação em CHECK.** Especificação de
> trabalho, não relatório. A tese: o que sobrevive nesta base é o que custa **zero pool** —
> `conformidade.mjs` e `dourado-estado.mjs` rodam em segundos, não têm variância, não precisam de
> calibração e não apodrecem; cada régua de LLM é custo recorrente que **morre quando o pool
> morre** — e ele morreu ontem, no meio da corrida que mediria o corpus.
> 🚩 **O número de ontem (16,7%) está PRELIMINAR de propósito: o detector errou 3 dos 8 flags
> (precisão 62,5%) e não passou por portão nenhum.** O juiz da síntese só pôde publicar depois de
> holdout cego + adversarial; este publicou sem. **Fase 1 = os dois portões, e nenhum percentual
> de defasagem sai antes disso.**
> 💰 Ordem defendida: **(0)** separar fato de ressalva — a ressalva embutida no texto apurado
> causou 1 dos 3 falsos positivos; **(1)** os dois portões do detector (~1 sessão, e o grosso é
> leitura humana de 20 rótulos); **(2)** os 3 campos do `projects.json` que destravam `D-67`,
> `D-70` e `D-71` **com zero chamadas**; **(3)** `scripts/validade.mjs`, o check sem LLM que
> impede `(hoje N)` de nascer; **(4)** o inventário do que é conversível em check; **(5)** só
> então o detector de contradição. **Se só couber uma coisa: fase 2 com pool ruim, fase 1 com pool
> bom.**
>
> ✅ **O DOURADO DE `estado` SAIU DO ACHISMO (31/07, 21h) —
> [`handoff/handoff-dourado-com-lastro-externo-executado.md`](handoff/handoff-dourado-com-lastro-externo-executado.md)**
> (spec: [`handoff/handoff-dourado-com-lastro-externo.md`](handoff/handoff-dourado-com-lastro-externo.md)).
> **5 das 8 perguntas de camada `estado` agora são APURADAS na fonte viva** (GitHub, GSC,
> arquivos do repo) por `scripts/dourado-estado.mjs` — zero LLM, sem rede diz `nao_apurado` e
> nunca um valor velho. **228 verdes.**
> 🔑 **Existe pela primeira vez uma taxa de erro do corpus** (`scripts/corpus-defasado.mjs`, 50
> chamadas): **8 de 30 documentos desmentiam a fonte viva — e ler os 8 baixou para 5 (16,7%)**,
> porque 3 eram o CHECK errado (um deles com o MOTIVO dizendo "o veredito correto é nao-fala").
> **Os 5 reais são UM defeito só: `(hoje N)` escrito em prosa** — era verdade no dia e continua
> se afirmando presente para sempre. `PRT-03` e os cards do sirius/tapepro foram corrigidos; os
> 4 handoffs **não** — handoff é registro datado, reescrever história para o corpus "bater" é
> falsificar o único lugar onde se vê o que se sabia na hora da decisão.
> 🚩 **A premissa da spec caiu em 3 das 8**: `D-67`, `D-70` e `D-71` NÃO têm fonte viva neste
> repo (`receita` é nota 0-10 de prioridade, não faturamento; família e `humano` não existem como
> campo). Saem `nao_apurado` com o campo que falta escrito no motivo — preencher é curadoria, não
> código.
> ⚠️ **Fase 0 primeiro, e ela se provou no mesmo dia:** corrida que perde o pool **aborta** em 3
> falhas de conta seguidas e não imprime agregado nenhum. A 1ª corrida da fase 3 morreu de pool e
> abortou sozinha; a 2ª retomou do cache. Aberto: fase 5 (detector de contradição, agora **com**
> conjunto de calibração) e remedir `estado` com o juiz.
>
> ▶️ **PRÓXIMO PASSO — [`handoff/handoff-juiz-de-verdade.md`](handoff/handoff-juiz-de-verdade.md)
> (31/07): construir o JUIZ DE VERDADE.** Especificação de trabalho, não relatório: nenhuma régua
> deste sistema mede corretude, e **citar a fonte certa e resumi-la errado passa com 100% nas
> duas réguas de hoje**. O desenho defendido lá, com o argumento de cada decisão:
> **(1) duas passadas** — fidelidade (juiz cego às fontes esperadas) e concordância (juiz vê o
> dourado) — porque a célula `fiel + discorda` é o **primeiro mecanismo do sistema que aponta
> erro DENTRO do corpus** (frente 6 nascendo de graça); **(2) quatro vereditos separados**
> (`correta/incompleta/contradiz/recusou`), nunca um score — incompleta custa uma consulta,
> contradiz manda a próxima sessão errar com confiança; **(3) o campo `armadilha`**, preenchido
> nas 78 perguntas e **nunca lido por código nenhum**, vira o número mais duro do sistema;
> **(4) calibrar contra 20 rótulos humanos (≥85%) e (5) controle adversarial (reprovar ≥9 de 10
> respostas corrompidas) ANTES de publicar qualquer número** — juiz que aprova tudo dá 97% e não
> vale nada; **(6) quebra por camada** (protocolo 65 · estado 8 · episodio 5 — o agregado esconde
> tudo) e **(7) persistir toda corrida**.
> 💰 **Franqueza sobre prazo: o juiz que produz um número cabe em 1 sessão; o juiz em que se pode
> CONFIAR são 2.** Número não confiável sobre corretude é pior que nenhum, porque vira meta.
> 🌉 Fica aberta a ponte que vale mais que o juiz: as **8 perguntas de camada `estado`** são as
> únicas cuja resposta certa existe FORA do corpus (GitHub, GSC, banco, `conformidade.mjs`) — é o
> caminho de "consistência interna" para verdade, e só ficou visível agora que a frente 1 existe.
>
> ✅ **AS NORMAS RODARAM (31/07, 20h) —
> [`handoff/handoff-normas-que-rodam.md`](handoff/handoff-normas-que-rodam.md)**: frente 1
> executada. `scripts/conformidade.mjs` roda **10 protocolos × 35 projetos** em ~40 s, sem LLM
> (**193 verdes**). Placar: **41 violações**; `VER-01` e `DEP-03` passam em **35/35** (nenhum
> cert quebrado, nenhum site fora do ar).
> 🚨 **O achado veio ANTES do código, no passo "verificar produção": a busca estava morta e
> reportando o erro errado.** `rodarClaude` usava sempre `tokens[0]`, e 2 das 3 contas do pool
> estavam mortas (429 "monthly spend limit" e 403 "subscription access disabled"). Nenhuma das
> duas mensagens tem palavra de rate limit ou auth — **só `api_error_status` separa "a conta
> acabou" de "a resposta é ruim"**. O autopublishing nunca esteve sujeito a isso (rotaciona desde
> sempre); a busca copiou o `spawn` e não o loop.
> ⚠️ **3 das normas estavam mal escritas, e o runner reescreveu as três**: `SEC-01` supunha
> next-auth (o `context` usa Auth0) — 3 falsos positivos viraram **0 falhas em 10 apps**;
> `VER-02` adivinhava `/sitemap.xml` (o `tapepro` serve `sitemap-index.xml` e anuncia certo);
> `GEO-02` acusava os perfis da marca Atma. **A primeira corrida de um check novo mede o check.**
> 💸 Achado caro em aberto: o **`estetiacrm` serve `twitter.com/roilabs` e
> `linkedin.com/company/roilabs`** no JSON-LD — os dois perfis que a norma lista como queimados
> (um deletado, outro de terceiro), em dois blocos `sameAs` na mesma página.
>
> ▶️ **PRÓXIMO PASSO — [`handoff/handoff-proximo-passo-corpus-verdade.md`](handoff/handoff-proximo-passo-corpus-verdade.md)
> (31/07 18h): fazer o sistema MEDIR VERDADE.** A recuperação está resolvida o suficiente
> (88,0% @10, teto da síntese em 100%); o que não existe é qualquer medida de **corretude do
> corpus** — e a síntese acabou de transformar erro silencioso em erro fluente e citado.
> Ranqueado e argumentado lá: **(1) executar os 97 protocolos** (`verificacao.como` × 35
> projetos — a única operação do sistema que produz informação nova sobre o mundo real, 2–4
> sessões), **(2) juiz de verdade sobre `dourado.resposta`** + quebra por camada (1 sessão),
> **(3) MCP + `/api/busca`** (o único item cujo retorno compõe: a próxima sessão de Claude é a
> maior usuária do corpus e a única sem acesso), (4) camada `estado` roteada para fonte viva,
> (5) o pool que a busca divide com o autopublishing, (6) detecção de contradição.
> ⚠️ **NÃO é a fase 4** (contextual retrieval) — despriorizada pela 2ª vez, com número.
> 🧾 O handoff também lista **a dívida contraída hoje**, item por item.
>
> ⏸️ Adiado, não cancelado: abrir as 5 lacunas de protocolo (`BKP`, `CST`, `OBS`, `PRV`,
> `A11Y`), **com a checagem definida antes da norma**.
>
> ✅ **A ABA RESPONDE, NÃO SÓ LISTA (31/07) —
> [`handoff/handoff-resposta-com-citacao.md`](handoff/handoff-resposta-com-citacao.md)**:
> síntese com **citação obrigatória** sobre o top-10, `lib/resposta.mjs` + `scripts/avaliar-resposta.mjs`
> (**181 verdes**). Régua nova, 78 perguntas: **respondeu 97,4% · citação ancorada 94,9%**.
> **Falha FECHADA** — resposta sem `[n]` não é renderizada. Segunda chamada de claude-cli, então
> a busca vai de 4,8 s para ~12 s; `?resposta=0` desliga.
> 🚨 **A régua mede ANCORAGEM, não verdade** — citar a fonte certa e resumi-la errado passa.
> Isso põe a **corretude do corpus** (3ª frente do handoff anterior) em 1º: síntese amplifica o
> que o corpus tem de errado.
> ⚠️ **O bug que quase virou número publicado:** procurar a frase de recusa em qualquer lugar do
> texto apagou **5 respostas completas e citadas** que só abriam com uma ressalva — 83,3% viraram
> 97,4% ao trocar a ordem (quem decide é a citação, não a frase). Ler as respostas, não só o
> agregado: `--ver`.
>
> ✅ **A RECUPERAÇÃO VIROU NÚMERO (31/07) —
> [`handoff/handoff-fase3-hibrido-medido.md`](handoff/handoff-fase3-hibrido-medido.md)**.
> Fase 3 fechada: `node scripts/avaliar.mjs` mede BM25 (82,3% recall@10), denso (76,7%) e
> **híbrido (83,0%)** sobre 258 docs, com `lib/corpus.mjs` · `lib/bm25.mjs` · `lib/denso.mjs` ·
> `lib/busca.mjs` e `test/busca.test.mjs` no `npm test` (**153 verdes**). Zero dependência nova,
> zero Postgres: 258 docs indexam em 40 ms na memória.
> 🚨 **O vetor perde sozinho em tudo, menos onde o BM25 é cego** — −5,6 pontos no agregado,
> **+18,7 na camada `estado`**. Medir por camada é o que impediu de descartar o único ganho real.
> **`c = 60` da RRF (o valor de manual) deixava a fusão ABAIXO do BM25 sozinho**; com `c = 10`
> passa. **Reranker recusado por falta de prova** — teto medido de 10,3 pontos, sem cross-encoder
> local viável. E o que sobrou de buraco (camada `estado`, 42,7%) **não é índice ruim, é fonte
> errada**: "quantos projetos hoje" mora no GitHub/GSC/banco, não em texto.
> ✅ **E virou aba (31/07) — [`handoff/handoff-busca-hibrida-no-ar.md`](handoff/handoff-busca-hibrida-no-ar.md)**:
> `/busca` no hub, híbrida (`BM25 + vetor`), ~200 ms morno. Corpus e vetores em
> `hub_corpus`/`hub_embeddings` — é o que põe as **123 memórias** (que moram em `~/.claude`, fora
> do repo) dentro do container. Reindexar: `node --env-file=.env scripts/indexar.mjs`.
> ✅ **CONFIRMADO NO AR EM 31/07 18h30: rodapé `BM25 + vetor` numa consulta real** — o container
> tem a env **e** alcança `sofia_ollama`, 0,9 s por busca. Fase 3 fechada sem pendência.
> ▶️ Para reconferir: **BUSCAR alguma coisa**, não só abrir — sem `?q=` o rodapé não chama o
> Ollama. A aba pede basic auth (`HUB_USER`/`HUB_PASS` só na EasyPanel, pedir ao Jean).
> ✅ **RERANKER NO AR E VERIFICADO EM PRODUÇÃO (31/07 19h40) —
> [`handoff/handoff-reranker-no-ar.md`](handoff/handoff-reranker-no-ar.md)**: recall@10
> **82,4% → 88,0%**, @3 65,4% → 70,5%. claude-cli sobre o top-50, **1 chamada por busca** (mesmo
> pool do autopublishing), busca de 1,0 s → 4,8 s em prod, `?rerank=0` no rodapé desliga.
> **A lição que custou duas medições: o ranking do reranker é para FUNDIR (`rrf c=10`), não para
> obedecer** — obedecido ele derruba o @1 de 32,0% para 19,5%, porque acerta o conjunto e erra a
> ordem. ▶️ **O próximo passo NÃO é a fase 4.** O gargalo deixou de ser recuperação: `@1` ainda é
> 34,2% (a aba lista, não responde) e a camada `estado` dá 74,0% em @50 — **um quarto dela não
> está no corpus em k nenhum**. As três frentes, ranqueadas e argumentadas, estão no handoff.
> ⚠️ **O piso `--min 0.83` foi aposentado (31/07 18h)**: os **mesmos 259 docs** da fase 3 rendem
> **82,4%** hoje, não 83,0%, **sem mudança de código** — handoff e memória são reescritos toda
> sessão e isso mexe em vetor e IDF. (Testada e **descartada por medição** a hipótese óbvia de
> que os 4 docs novos é que sujavam: custo real deles = **0,0 ponto**.) Agora é `--min bm25`,
> o BM25 da mesma execução. Ele expõe o problema real: **o vetor ganha do BM25 por 0,1 ponto**,
> fração de uma pergunta em 78.
>
> ✅ **O CONJUNTO DOURADO EXISTE (31/07) — 78 perguntas —
> [`handoff/handoff-conjunto-dourado.md`](handoff/handoff-conjunto-dourado.md)**.
> Fase 2b fechada: [`data/dourado.json`](data/dourado.json), pergunta real + resposta conhecida +
> `fontes` (o alvo de recall@k) + `armadilha` (a resposta plausível e errada) + `camada`
> (protocolo 65 · estado 8 · episódio 5, separadas porque recall medido em bloco esconde qual
> índice está ruim). `test/dourado.test.mjs` na lista do `npm test` (**147 verdes**) amarra as
> fontes ao corpus: fonte `AREA-NN` tem que existir em `data/protocolos/`, e **área com protocolo
> tipado tem que ter pergunta** — as 13 cobertas. Nenhum script de avaliação foi escrito:
> `recall@k` sem índice é código morto, nasce na fase 3.
> **⚠️ As fases 3+ já podem começar** — o que estava proibido era começá-las antes disto.
>
> ✅ **OS PROTOCOLOS ESTÃO TIPADOS (31/07) — 97 registros —
> [`handoff/handoff-protocolos-tipados.md`](handoff/handoff-protocolos-tipados.md)**
> (plano: [`handoff/handoff-tipar-protocolos.md`](handoff/handoff-tipar-protocolos.md)).
> Fase 2 fechada: `data/protocolos/<AREA>-<NN>.json`, um arquivo por protocolo, **todos com
> `verificacao.como`**, mais `test/protocolos.test.mjs` na lista do `npm test` (**140 verdes**).
> DEP 16 · AGT 12 · UI 11 · CNT 10 · VER 7 · INT 7 · SEO 6 · DNS 6 · SEC 6 · PRT 6 · DAT 4 ·
> PRF 4 · GEO 2. Triagem dos 123 arquivos de memória em
> [`docs/protocolos-triagem.md`](docs/protocolos-triagem.md).
> 🚨 **O achado: o protocolo mais caro do repo estava em CÓDIGO, não em memória.** As regras
> editoriais que governam **10 sites publicando sozinhos toda noite** (fonte real, nunca
> concorrente direto, BLUF 40–60 palavras, tabela em comparação, gate YMYL) só existiam no
> prompt do `autopublish-clients.ts` — `CNT` era a área mais subdimensionada do portfólio
> (estimada ~4, tipada **10**). A fase 5 não pode assumir que toda norma nasceu em `memory/`.
> **Nenhum candidato caiu por falta de checagem** (o handoff anterior previa perder alguns): as
> memórias já nascem com *How to apply*, então o trabalho caro foi **traduzir prosa em comando**.
> ⏸️ **Continua aberto e adiado por decisão:** o `UND_ERR_HEADERS_TIMEOUT` (agora normatizado em
> `INT-02`, patch **ainda não aplicado**) do
> [`handoff/handoff-harness-decidido.md`](handoff/handoff-harness-decidido.md) § D — pode estar
> custando artigo toda noite no `polarisia` e no `reviewshield`; confirmar custa ~10 min.
>
> ✅ **HARNESS DECIDIDO (31/07) — fica o `spawn("claude")`.** O Claude Agent SDK só autentica
> por `ANTHROPIC_API_KEY`/Bedrock/Vertex/Foundry; `CLAUDE_CODE_OAUTH_TOKEN` não existe na doc
> dele. Fora por [[budget_claude_cli_only]] — e a mesma doc diz que rodar o CLI como
> subprocesso com `-p --output-format json` **é o padrão**, que é o que este repo já faz.
> OpenCode/Aider/Codex/`nanocodex` saem na triagem de ToS. `CLAUDE.md` +
> `.claude/settings.json` escritos. Detalhe e fontes em
> [`handoff/handoff-harness-decidido.md`](handoff/handoff-harness-decidido.md).
>
> ✅ **A ABA `/resumo` ESTÁ NO AR (31/07, 10h30) —
> [`handoff/handoff-resumo-entregue-e-as-26-decisoes.md`](handoff/handoff-resumo-entregue-e-as-26-decisoes.md)**
> (plano: [`handoff/handoff-pagina-resumo-executivo.md`](handoff/handoff-pagina-resumo-executivo.md)).
> Sexta aba, **35 resumos executivos**, seis campos fixos, `npm test` verde (132) e push.
> `estado` e `dinheiro` **não vieram de card**: os 35 hosts curlados **sem `-k`** (todos 200) e os
> quatro backends mortos re-resolvidos — `cardioapi`, `aitradingapi`, `arquiteturaapi` e `pathback`
> seguem **NXDOMAIN em 31/07**.
> 🚨 **O achado é o agregado, não a página: 26 dos 35 estão parados numa DECISÃO, não numa tarefa.**
> **1 de 35** tem receita provada (`sirius`, e o card não registra as datas das 3 vendas); **2** têm
> checkout vivo (`orcaobra`, e o `atma` nunca testado em produção); **5** estão em
> `no-ar-inutilizavel`. As 26 decisões são três famílias — *não tem como cobrar* (9), *não tem quem
> venda* (5), *não tem tráfego* (o resto) — e **só a terceira** é tratada pelas abas que já existem.
> ⚠️ **A agenda não guarda decisão** (ela quer data e checkbox; "matar ou investir o `orion`?" não
> tem nenhum dos dois). Nada foi construído para isso — pergunta aberta pro Jean: **as 26 viram uma
> triagem ou o `/resumo` é só onde elas moram?**
>
> ✅ **A LEVA DO AGENTE FOI EXECUTADA (31/07, 12h) —
> [`handoff/handoff-fabrica-e-leva-de-um-linha-31-07.md`](handoff/handoff-fabrica-e-leva-de-um-linha-31-07.md)**
> (plano: [`handoff/handoff-proximo-passo-pos-sirius.md`](handoff/handoff-proximo-passo-pos-sirius.md)).
> 🚨 **A tarefa nº 1 não existia.** URL Inspection nas 26 URLs do `fabrica` antes de mexer:
> **24 em `Submitted and indexed`, incluindo 20 dos 21 artigos.** Não havia bloqueio de indexação —
> o `errors: 1` do sitemap é real, persiste, e **não era o que segurava os artigos**. O `fabrica`
> sai da fila de SEO técnico: o gargalo dele é **tráfego**, não descoberta. Sobram 2 Request
> Indexing manuais (`/termos` e `/blog/como-atrair-pacientes-clinica-de-estetica`).
> ✅ **Entregue e verificado no ar:** OG card próprio no `orcaobra` (era placeholder do lovable.dev)
> e no `potencialarquitetado` (apontava para domínio NXDOMAIN); H1 do `cardiorisk` alinhado ao
> `<title>`; **`/sitemap.xml` E `/robots.txt`** criados no `vertice` e no `compass` (o card só citava
> o sitemap — o robots também estava 404 nos dois) e submetidos ao GSC.
> 🚨 **Segundo achado: 3 projetos publicavam quebrado.** Os pushes deram `● Error` em 5–9 s —
> **Root Directory `/` com o app em subpasta** ([[vercel_root_dir_slash_push_kills_subfolder_site]]).
> Corrigido via API no `reforma-maestro` (`frontend-next`) e no `vertice` (`app`): **build por git
> voltou nos dois.** O `compass` continua só por CLI de dentro de `web/` — com `rootDirectory` ele
> compila e quebra ao publicar (`ENOENT .next/routes-manifest-deterministic.json`, Next 16.2.6).
> 🙋 **Jean, 5 min, inalterado:** verificar `goiania.roilabs.com.br` no **Bing Webmaster Tools** —
> maior score acionável (44) e mata o IndexNow 403 que reaparece a cada build. Depois: as 4 chaves
> do Stripe do `compass`, o `GOOGLE_CLIENT_ID` do `reviewshield` e — o mais antigo e perigoso —
> **rotacionar os segredos vazados** ([[secrets_to_rotate]]).
> 🤖 **Agente, próxima sessão: `polarisia`, spec 012 T001–T017** (home V4) — única tarefa de sessão
> longa que sobrou sem dependência de credencial.
>
> 🎯 **PRÓXIMO PASSO — DUAS COISAS, e uma delas é uma data.**
>
> 1️⃣ ✅ **A FRENTE DO `sirius` FOI EXECUTADA (31/07, 08h30) —
> [`handoff/handoff-sirius-agaas-ctr-31-07.md`](handoff/handoff-sirius-agaas-ctr-31-07.md)**
> (plano original: [`handoff/handoff-proximo-passo-31-07.md`](handoff/handoff-proximo-passo-31-07.md)).
> 🚨 **A premissa do passo 1 era FALSA:** o `hreflang` **já existia e já é servido** nos dois pares
> (`curl` sem `-k`, 31/07) — `lib/seo/canonical.ts`. Cada página ser `canonical` de si mesma **com** o
> par completo é o comportamento correto, não canibalização. **Zero linha de `hreflang` escrita.**
> ✅ Feito no lugar: **CTR do `agaas`** (`titleEn` → `AgaaS Meaning: Agentic-as-a-Service vs
> Traditional SaaS`, meta em BLUF, conteúdo abrindo com a definição, **slug intocado**) e **dono do
> `crm roi`** (o post; link no componente compartilhado `CalculadoraROI` cobre as 5 calculadoras).
> 🚨 **`crm roi` estava partido em QUATRO URLs, não duas** — o plano só tinha visto duas.
> ✅ Remedição própria confirma o gate: **2 cliques não-branded**, e `agaas` (85 imp, pos 8,1) é a
> **única** query não-branded de página 1 com volume. O gate é CTR de UMA página.
> ⚠️ **`sirius` NÃO é Vercel** (não está em `vercel project ls`; a CSP cita `*.easypanel.host`) — o
> `CLAUDE.md` do repo diz "Deploy: Vercel" e está desatualizado. Clone agora existe em `C:\dev\sirius`.
> ⚠️ **CI de `main` já estava vermelho antes:** 54 erros de `tsc` pré-existentes, nenhum nos arquivos
> alterados.
> ▶️ **Próxima leitura: ~14/08** — cliques não-branded em 28d, por query × país. Conteúdo solar
> (~215 imp em pos 26–41) só depois disso.
>
> ✅ **A FRENTE DO ATMA ENCERROU (31/07, 07h50) —
> [`handoff/handoff-atma-reindexado.md`](handoff/handoff-atma-reindexado.md).**
> O Jean pediu a reindexação na UI e a URL Inspection confirma: **as 5 URLs voltaram para
> `Submitted and indexed`**, `verdict: PASS`, com **`lastCrawlTime` do próprio 31/07** — contra os
> 04–06/06 congelados de antes. É o desfecho bom da tabela, não o "crawl novo mas segue not indexed".
> **O maior ativo orgânico da ROI Labs (era ~1.600 imp/dia, caiu para 10–20) está de volta ao índice.**
> ⚠️ **Agora é TEMPO, não trabalho:** tráfego é indicador atrasado. **Reconferir a série em ~14 dias**
> — e **não baixar o `decay 10`** do card antes de a série reagir.
> 🔧 Ler o estado sem abrir a UI: `node --env-file=.env scripts/inspect-url.mjs <url> [...]` (novo).
> 💡 **O que o horário do crawl entregou:** a home e o artigo campeão foram rastreados às 22h55 BRT,
> o minuto exato do **resubmit do sitemap pela API** — o "empurrão secundário" reindexou 2 das 5
> sozinho. Da próxima vez, submeter o sitemap primeiro.
> As tarefas 2 e 3 já haviam fechado, verificadas no ar
> ([`handoff/handoff-proximo-passo-atma-executado.md`](handoff/handoff-proximo-passo-atma-executado.md)):
> `orion` serve zero `aggregateRating`/endereço/telefone/depoimento/selo falso (`94a6bdb`, prova de
> build novo = `AggregateOffer` em `99.90/999.90`); `pathfinder` serve `/sitemap.xml` em **200 com
> corpo `<?xml` e 36 `<loc>`** (`aee6e09`).
> ⚠️ **Armadilha que continua valendo:** o push do `pathfinder` **não publica** — a Vercel dele não
> escuta o git. Deploy é `npx vercel deploy --prod --yes` de dentro de `frontend/`. O `orion` publica
> sozinho no push (EasyPanel, ~10 min).
> ⚠️ **O backend do `pathfinder` continua morto** (`/api/*` → NXDOMAIN): consertamos a descoberta,
> não o produto.
> ⚠️ **O Atma não está "pronto":** restam o MercadoPago nunca testado em produção e o resíduo de DNS
> `clerk.`/`www.`. Ninguém viu a desindexação porque a home responde **200** e o `checkHealth` só olha
> `res.ok` — essa cegueira do hub segue de pé.
> ✅ **`orion`: o `aggregateRating` fabricado SAIU** (30/07, `94a6bdb`) — junto com endereço,
> telefones, `sameAs`, depoimentos inventados e os selos "ISO 27001"/"AWS Partner". O risco era do
> DOMÍNIO, não do projeto; falta só confirmar no HTML servido.
>
> ✅ **A curadoria do hub FECHOU: 20 → 35.** Não sobra nenhum projeto não-curado —
> `CURADO: 35 · NÃO-CURADO: 0 · hosts duplicados: ZERO`, 130/130 testes.
> Só **3 dos 15** estão de fato no índice do Google (`aprovai`, `roi-labs-links`, `qprime`);
> `compass` e `pathfinder` são `URL is unknown to Google`. Receita original em
> [`handoff/handoff-curar-os-15.md`](handoff/handoff-curar-os-15.md).
> ⚠️ **O Clerk do Atma já tinha sido arrancado** (`726e45f`, 30/07) — o briefing anterior mandava
> nascer com ele como blocker e o card teria nascido mentindo. Premissa velha em 24h.
> ⚠️ **Defeito de régua registrado e NÃO consertado:** o critério `seo` é "tração merece atenção",
> então quem desaba tira nota BAIXA — o Atma tirou **0,7** por ter colapsado. Compensei à mão com
> `decay 10`. Mexer nos pesos é decisão do Jean.
>
> ✅ **A frente de nomenclatura FECHOU (30/07, 22h BRT).**
> [`handoff/handoff-renomear-subdominios-executado.md`](handoff/handoff-renomear-subdominios-executado.md)
> — **9 renomeações + 2 limpezas**, todas verificadas pelo corpo. **Zero duplicados.**
> A frente de domínio próprio já havia fechado na 2ª leva; agora todo host vivo também tem **nome de
> produto**. Os 10 hosts antigos ficam em **308** por semanas — não apagar antes de o `Crawl requests`
> deles cair. Receita original em
> [`handoff/handoff-renomear-subdominios.md`](handoff/handoff-renomear-subdominios.md); histórico das
> levas em [`handoff/handoff-proximo-passo-leva-2.md`](handoff/handoff-proximo-passo-leva-2.md).
> 🚨 **A ordem é literal: push → deploy manual → verificação.** Os 3 estáticos que publicam de
> `site/` têm `Root Directory = /`, então o push serve a raiz do repo e derruba o host novo para
> **404**. Verificar antes do push dá verde no deploy errado.
> 🚨 **`redirect` da API da Vercel só aceita destino no MESMO projeto** — cross-project dá
> `400 bad_request`. Saída: `DELETE` no projeto velho + `POST` no novo já com o `redirect`.
> ⚠️ **Decisão do Jean, já tomada e reafirmada: ZERO arquivamentos** — *"quero todos ativos, vou
> monetizar/produtizar todos"*. Não relitigar; o custo aceito é NXDOMAIN futuro em quem for abandonado.
> 🗑️ Único resíduo aberto: **`housingpro.com.br` usa o DNS do Registro.br** (`d/e.sec.dns.br`), não
> Cloudflare nem Hostinger — limpeza é à mão, no painel. Já responde 404 e não está em propriedade
> nenhuma do GSC, então **impacto zero**: é higiene, não pendência.
>
> 2️⃣ **A data, que não depende de sessão:**
> [`handoff/handoff-proximo-passo-02-08.md`](handoff/handoff-proximo-passo-02-08.md)
> (30/07): domingo **02/08, 10:00 BRT**.
> É o **primeiro run do robô de crawl stats** (`LastTaskResult 267011` = nunca rodou), e ele é as
> duas coisas ao mesmo tempo: o **único instrumento de medição** do conserto do NXDOMAIN — existe
> **um só** export do `roilabs.com.br` no repo, o de 25/07, que é o baseline de *antes* — e **código
> que nunca executou de ponta a ponta** (Chrome + 10 exports + `analyze.py` + `narrate.py` +
> `git push`, sozinho).
> 🚨 **O sinal certo é `Crawl requests` dos hosts mortos CAINDO, não o OK%** — janela de 90 dias.
>
> ✅ **NXDOMAIN dos 14 subdomínios: APLICADO e verificado.** Medido em 30/07 com
> `cloudflare-redirects.mjs --verify`: `pathfinder`/`orion`/`vertice`/`atma` em **200**, `atmaadmin`
> 307→`/admin`, `atmaapi` **200**, `sirius`/`sofiaia` em 301 com path preservado, e
> **`goiania`/`tapepro` intactos em 200** — o teste de segurança passou. Só `www.sirius` e
> `www.goiania` ficaram em `http://` (Universal SSL cobre 1 label; curar exige ACM pago — **decidido
> não fazer**). Receita e execução em
> [`handoff/handoff-nxdomain-subdominios.md`](handoff/handoff-nxdomain-subdominios.md).
>
> ⛔ **`alibi_ai` excluído (Jean, 30/07)** — era o último host em `RESSUSCITAR`, agora é morto
> permanente (`MORTOS` no script). **Mudança semântica, não operacional:** a Regra 4 é montada com
> `[...MORTOS, ...RESSUSCITAR]`, a expressão publicada é idêntica e o host já responde 301.
> **Não rode o script por causa disso.**
>
> ✅ **36 repos ativos, 34 com site**, 2 sem `homepage` (`roihub`, `repo-de-teste`) — decisão fechada.
> Caiu de 41 porque `cardioqwen3code`, `synth-bot-buddy` e `housingpro` foram **apagados**, não
> porque algo saiu do ar.
> A frente "repos sem site" está **encerrada**.
>
> **O que sobra não é código do roihub:** Compass (Etapas 2 e 3 — GitHub OAuth, Resend, Stripe),
> 2 cards da agenda vencidos (`sirius` gate 28/07, `nimblabs` ~20/07) + `tapepro` sem ação, e
> domínio próprio dos sites novos. Backlog de código real está **nos projetos rankeados**.

> ✅ **Compass NO AR** em `https://compass.polarisia.com.br` (29/07, 14h) — banco ligado, DNS
> corrigido, `/pricing` 200 e o ápice do Polaris intacto. O item "compass" **sai da fila de ops**.
>
> 🎯 **PENDÊNCIA que sobrou — Etapas 2 e 3 do
> [`C:\dev\compass\handoff.md`](https://github.com/JeanZorzetti/compass/blob/main/handoff.md):**
> o app está de pé mas **não é usável nem cobrável**.
> - **Etapa 2 · login** — `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET` (callback
>   `https://compass.polarisia.com.br/api/auth/callback/github`) e `AUTH_RESEND_KEY`. `/login`
>   responde 200, mas **sem provider ninguém entra**.
> - **Etapa 3 · cobrança** — `STRIPE_SECRET_KEY`, os dois `price_…` e o `STRIPE_WEBHOOK_SECRET`.
>   Crie o webhook **já no domínio final** (webhook morto = cliente paga e não vira assinante).
>
> As duas são **painel de terceiro, com o Jean** (GitHub, Resend, Stripe) — não há código a escrever.
> Enquanto elas não saem, "distribuição" continua sem sentido: não há como o usuário logar.
>
> 🔴 **Dívida aberta:** o Postgres escolhido foi o do **VPS EasyPanel** (`2.24.207.200:5451`), e o
> servidor **não suporta TLS** — senha e dados trafegam em texto puro até a Vercel, com a senha de
> `secrets_to_rotate`. Resolver **antes do primeiro pagante**, não antes do primeiro login.
>
> ✅ **[`handoff/handoff-quatro-sites.md`](handoff/handoff-quatro-sites.md) foi EXECUTADO** na 4ª
> sessão de 29/07: **4 de 4 no ar**, `homepage` gravada e confirmada com 200 —
> `roi-labs-links.vercel.app`, `lumina-demo-beryl.vercel.app` (rotulada **demo**),
> `cannibalscan.vercel.app` (com `robots`/`llms`/`sitemap`/`FAQPage`) e `aprovai-locacao.vercel.app`
> (nome próprio, para não encostar no `aprovai.vercel.app` de terceiro).
> **Sem `homepage`: 6 → 2**, e os 2 são os de decisão (`roihub`, `repo-de-teste`) — o `<details>` da
> home fica vazio e some sozinho, sem mexer no código do hub.
> ⚠️ Achado que vale para qualquer repo "site pronto, é só deployar": a página do `roi-labs-links`
> **estava quebrada** (gradiente Tailwind copiado à mão sem os `--tw-gradient-*-position` → texto
> branco sobre fundo branco) e ninguém sabia, porque nunca tinha sido aberta.
>
> **O que sobrou dos sites é painel/DNS**, não código — domínio próprio (`links.roilabs.com.br` na
> Cloudflare, `cannibalscan.nimblabs.com` na Hostinger, e a `homepage` tem de mudar **junto**) e
> submeter o CannibalScan ao GSC. Fica atrás do Compass na fila.
>
> ✅ **Feito na 3ª sessão:** `roihub` e `repo-de-teste` saíram da lista "repos sem site" — a
> `homepage` vazia deles é decisão, não pendência (`semSitePorDecisao` em `lib/projects.mjs`, teste
> 7/7).
>
> **Estado anterior** em [`handoff/handoff-proximo-passo-30-07.md`](handoff/handoff-proximo-passo-30-07.md)
> (29/07). Dos três itens que ele listava, **nenhum sobrou**: o `compass` foi resolvido acima —
> ⚠️ o diagnóstico dele ("um A record + 9 segredos") estava **errado nas duas metades**.
> ⛔ **SplitJud foi
> ENCERRADO** (repo deletado pelo Jean → sem repo não há projeto; não reanexar vhost, não apontar
> DNS), e os 6 boilerplate Lovable foram excluídos. **47 → 41 repos ativos, 12 → 6 sem `homepage`.**
>
> <details>
> <summary>Resumo do handoff de 30/07 como estava escrito (histórico)</summary>
>
> **Resumo: não há frente de código aberta — não abra o repo.** Sobraram **três** itens, todos de
> **painel e DNS**. Por ordem:
> (1) 🔴 **SplitJud fora do ar, e o `www` está servindo o site ZUMBI** (`185.158.133.1`, build Vite
> pré-split) para usuário e Googlebot enquanto o IP do site bom (`187.127.2.204`) está morto.
> ✅ **O passo bloqueante caiu:** o Astro roda no **EasyPanel `2.24.207.200`, que está VIVO** e só
> perdeu o vhost (o 404 de 28/07 foi lido ao contrário — 404 prova que o servidor é aquele). Agora é
> tarefa de painel: **reanexar os domínios aos serviços `site`/`app`**, depois apontar os três nomes
> para `2.24.207.200` no **Registro.br** (não Cloudflare). ⛔ Só então apagar o zumbi;
> (2) 🟠 **`compass` já está verde na Vercel** (`compass-ten-plum.vercel.app`) — falta **um A record**
> (`compass → 76.76.21.21`, na **Hostinger**; o domínio já está `verified`) e **9 segredos** (não 8),
> sem os quais `/pricing` fica em 500. Hoje só existem 4 env vars no projeto;
> (3) 🟡 **12 repos sem `homepage`** — mas só **2** dependem de painel: **6 são boilerplate Lovable**
> a arquivar/excluir, 2 são decisão fechada e 1 é o splitjud. ⚠️ Os 2 do painel **não têm atalho por
> CLI**: o CannibalScan não tem página publicada e `aprovai.vercel.app` **é de terceiro**.
> 🟢 Domínio próprio para os 6 sites novos segue opcional.
>
> **Encerrados em 29/07, não reabrir:** o **hub fica fora do próprio ranking** ("roihub é 100% admin,
> não terá site público" — Jean), então a `homepage` vazia do repo é intencional e a checagem de saúde
> **não** deve tratar 401/403 como "no ar"; e o **ProLife saiu do hub** (repos `ProLife` e `mhedicos`
> deletados pelo Jean), o que tira `prolifemed.com.br` do A1.
>
> **Executado em 29/07:** `homepage` preenchida em 8 repos medidos com 200 (`context-keeper`,
> `estetia`, `estetia-demo`, `review-dispute`, `nimblabs`, `roilabs`, `tape`, `aftercare-nimblabs`) +
> `meridian` (EasyPanel) + os **6 repos "não é site" que viraram site**
> ([`handoff-seis-sites.md`](handoff/handoff-seis-sites.md), 6/6 no ar). `cannibal-scan`, `jizreel` e
> `medlly` deletados pelo Jean; `repo-de-teste` fica mas não entra no hub.
> **Repos com `homepage`: 20 → 35. Sem: 31 → 13.** Medição completa em
> [`handoff-compass-e-repos-sem-site.md`](handoff/handoff-compass-e-repos-sem-site.md).
>
> </details>
>
> **Frente anterior** em [`handoff/handoff-21-projetos-no-ar.md`](handoff/handoff-21-projetos-no-ar.md):
> executada em 29/07 — 12 protótipos deployados com os builds consertados, `sirius` e `sofia-ia`
> resolvidos por `homepage` errada, `orion-nova-ui` com a migration que faltava, 9 repos excluídos pelo
> Jean. Guarda as armadilhas caras da sessão (OneDrive quebra `vercel --prod`; `yes | vercel project
> rm` apaga projetos vizinhos; app "fora do ar" pode estar rodando no EasyPanel).
>
> **Estado anterior** (28/07, 3ª sessão) em [`handoff/handoff-proximo-passo.md`](handoff/handoff-proximo-passo.md):
> **o ML fechou (F0–F4) e não há frente de código aberta** — o último
> card podre (`aftercare`) foi reescrito em 28/07 e o que ele pedia já foi ligado no mesmo dia
> (`editorialFocus` B2B, uma linha, não uma feature). O que sobrou é **espera medida**: (1) ver em
> `/seo` se a pauta do robô migrou pro cluster B2B e no `/insights` se **cliques saem do 0** antes do
> D+180 (28/11); (2) duas verificações que só o Jean faz (`/insights` em prod e o run automático de
> 02/08, o primeiro com o `narrate.py` encadeado); e (3) **A1 — três sites de produção fora do ar**
> (`prolifemed.com.br`, `seven-md.com.br`, `compass.polarisia.com.br`), que é **ops de DNS/vhost, não
> commit**: nenhuma sessão de código resolve isso, só acesso ao host.
>
> O hub deixou de ter lista fixa de 10 projetos: agora todo repo do GitHub com `homepage`
> preenchida é um projeto — detalhe técnico em [`handoff/handoff-hub-github.md`](handoff/handoff-hub-github.md).

## Índice dos handoffs (`handoff/`)

Este arquivo é a porta de entrada e o histórico do hub. Os handoffs temáticos vivem em
[`handoff/`](handoff/) — **nome do arquivo preservado**, só mudou a pasta (28/07).

| arquivo | assunto | estado |
|---|---|---|
| [`handoff-a-definicao-de-pronto-executado.md`](handoff/handoff-a-definicao-de-pronto-executado.md) | **comece por aqui**: fases C, D, R e F executadas. A fase D (duas passadas) foi medida contra o fixture congelado e **reprovou** — 83,3% → 65,9% e as células perigosas saíram de zero. Traz o holdout em 44/20 com âncora, a reprodutibilidade medida 2× com movimento zero, o piso do portão 2 que afrouxava sozinho, e o inventário pelo REPO que acha 10 projetos com cobrança escrita e não ligada | 🟢 vivo (01/08) — frente ativa |
| [`handoff-a-definicao-de-pronto.md`](handoff/handoff-a-definicao-de-pronto.md) | a SPEC que o originou: os 3 níveis de PRONTO (instrumento / feature / loop), o custo honesto de ~20–26 h e o que está explicitamente FORA do escopo | 🟢 vivo (01/08) — nível 1 ainda aberto |
| [`handoff-proximo-passo-31-07.md`](handoff/handoff-proximo-passo-31-07.md) | **comece por aqui numa sessão de trabalho**: o próximo passo é o `sirius` e o gate de 31/08 (≥5 cliques não-branded/28d, hoje 2). Traz a medição por query/país/página que desmonta o plano do card — `agaas` é query internacional, `crm roi` e `crm solar` estão canibalizados, e o par PT/EN serve **zero `hreflang`** — mais a ordem de execução (hreflang → dono do `crm roi` → CTR do `agaas` → só então conteúdo solar) | 🟢 vivo (31/07) — frente ativa |
| [`handoff-atma-reindexado.md`](handoff/handoff-atma-reindexado.md) | o desfecho da frente mais cara do portfólio — as 5 URLs do Atma medidas em `Submitted and indexed` com crawl de 31/07, o script novo `scripts/inspect-url.mjs`, e por que o resubmit do sitemap (22h55 BRT) reindexou 2 delas antes do pedido manual. O que NÃO concluir: tráfego ainda não reagiu, `decay` fica em 10 | ✅ encerrado 31/07 — só resta reconferir a série em ~14 dias |
| [`handoff-proximo-passo-atma-executado.md`](handoff/handoff-proximo-passo-atma-executado.md) | o que as 3 tarefas viraram em 30/07 e o que sobrou (pedido manual de indexação do Atma + verificar 2 deploys no ar). Traz os 2 achados que só apareceram abrindo o código: o `AggregateOffer` do `orion` também era inventado (4 planos de R$ 299–1.499 contra 3 planos reais) e o sitemap do `pathfinder` listava rotas inexistentes — consertar o DNS do backend teria devolvido um sitemap de 404s | ✅ executado 30/07 — o que sobrava fechou em 31/07 |
| [`handoff-proximo-passo-atma.md`](handoff/handoff-proximo-passo-atma.md) | a receita das 3 tarefas — **ainda é onde estão as 5 URLs do Atma na ordem de valor** e como MEDIR se a reindexação pegou (`coverageState`, não tráfego). O passo manual foi feito pelo Jean em 31/07 e medido no handoff do topo | ✅ executado 30–31/07 |
| [`handoff-curar-os-15-executado.md`](handoff/handoff-curar-os-15-executado.md) | a medição por trás da frente acima: a curadoria fechou (20 → 35, zero não-curados) e destravou o achado mais caro do portfólio — **o Atma desindexado, −98% de impressões, com a queda datada em 09→10/06** — mais o `aggregateRating` fabricado do `orion` num subdomínio de `roilabs.com.br` e o sitemap em 502 `DNS_HOSTNAME_NOT_FOUND` do `pathfinder`. Traz o estado de índice dos 15 e o defeito da régua de score | 🟢 vivo (30/07) — frente ativa |
| [`handoff-curar-os-15.md`](handoff/handoff-curar-os-15.md) | a receita e a régua que originaram a curadoria acima: o grep de host morto que funciona (por URL absoluta, não por nome de env var), a calibração de `receita` e por que `seo`/`decay` são automáticos | ✅ executado 30/07 — 15/15 curados |
| [`handoff-renomear-subdominios.md`](handoff/handoff-renomear-subdominios.md) | encurtar 8 subdomínios para nome de produto, limpar o `synth-bot-buddy` (repo apagado, host em 200) e decidir 2 nomes. Traz a receita do **308 do host antigo** (renomear sem gerar NXDOMAIN) e o PATCH da API da Vercel, que a CLI não expõe | ✅ executado 30/07 — 9 renomeações, zero duplicados |
| [`handoff-proximo-passo-leva-2.md`](handoff/handoff-proximo-passo-leva-2.md) | a 2ª leva de domínios executada de ponta a ponta (15 projetos) e as **5 correções que só apareceram rodando**: título igual não diz qual pasta é deployada, sitemap em 200 não prova deploy, `builds` legado exige `routes`, `git push` desfaz deploy manual, canonical cruzado entre projetos homônimos | ✅ executado 30/07 — **35 próprio × 1 fornecedor** |
| [`handoff-proximo-passo-dominios.md`](handoff/handoff-proximo-passo-dominios.md) | a 1ª leva e a receita de 6 passos que originou tudo: por que host de fornecedor deixa o projeto fora do GSC (a prova do CannibalScan) e o critério de triagem | ✅ executado 30/07 — superado pelos dois acima |
| [`handoff-proximo-passo-02-08.md`](handoff/handoff-proximo-passo-02-08.md) | **comece por aqui**: o próximo passo é uma data (02/08, 1º run do robô de crawl), como medir o NXDOMAIN sem cair na janela de 90 dias, e o que sobra fora do roihub. Inclui a medição dos 3 cards podres da agenda (30/07): branded do Sirius passou, `repo` do tapepro estava errado, sitemap do CannibalScan nunca submetido | 🟢 vivo (30/07) — frente ativa |
| [`handoff-nxdomain-subdominios.md`](handoff/handoff-nxdomain-subdominios.md) | os 14 subdomínios em NXDOMAIN do `roilabs.com.br`: receita, script e as 6 promoções | ✅ executado 29–30/07 — falta só medir com export novo |
| [`handoff-proximo-passo-30-07.md`](handoff/handoff-proximo-passo-30-07.md) | briefing anterior: os 3 itens de painel/DNS, o que foi encerrado, e como medir DNS sem errar | ⚠️ superado 30/07 — os 3 itens saíram; guarda as armadilhas de DNS |
| [`handoff-dns-e-paineis.md`](handoff/handoff-dns-e-paineis.md) | a medição detalhada por trás do briefing acima: IPs, NS, fingerprint do zumbi do splitjud, os 12 repos sem `homepage` | 🟢 vivo (29/07) — referência do item ativo |
| [`handoff-compass-e-repos-sem-site.md`](handoff/handoff-compass-e-repos-sem-site.md) | a medição que gerou a frente acima: `compass`, repos sem `homepage`, os 2 sites mortos em `187.127.2.204` | ✅ executado 29/07 — 9 `homepage` preenchidas |
| [`handoff-seis-sites.md`](handoff/handoff-seis-sites.md) | as 6 landing pages novas (lib/CLI/API que viraram site) e o padrão que as gerou | ✅ executado 29/07 — 6/6 no ar |
| [`handoff-21-projetos-no-ar.md`](handoff/handoff-21-projetos-no-ar.md) | recolocar no ar os projetos apagados da Vercel + armadilhas de deploy | ✅ executado 29/07 — 19/20 no ar |
| [`handoff-proximo-passo.md`](handoff/handoff-proximo-passo.md) | espera medida do ML + A1 (ops de DNS/vhost) | ⚠️ superado 29/07 por `handoff-proximo-passo-30-07.md` — o A1 encolheu (`prolifemed` saiu com a exclusão do repo); a **espera medida do ML segue válida** |
| [`handoff-ml.md`](handoff/handoff-ml.md) | motor de ML (`ml/`), F0–F4, decisões de modelagem | 🟢 vivo — F0–F4 completos |
| [`handoff-hub-github.md`](handoff/handoff-hub-github.md) | projetos vêm do GitHub (repo com `homepage`), não de lista fixa | 🟢 vivo (28/07) |
| [`handoff-crawl-stats-semanal.md`](handoff/handoff-crawl-stats-semanal.md) | robô Playwright que abastece `/infra` + `/insights` toda semana | 🟢 vivo — agendado dom. 10:00 |
| [`handoff-autopublish.md`](handoff/handoff-autopublish.md) | como o robô de 1 artigo/dia funciona (guardrails, operação) | 📘 referência |
| [`handoff-polimento-editorial.md`](handoff/handoff-polimento-editorial.md) | qualidade do artigo gerado (não encanamento) | 📘 referência |
| [`handoff-insights-automatico.md`](handoff/handoff-insights-automatico.md) | o `/insights` parar de envelhecer (acoplado ao robô de crawl) | ✅ executado 25/07 |
| [`handoff-crawl-plano-acao.md`](handoff/handoff-crawl-plano-acao.md) | plano de ação de crawl por projeto (datado no CSV) | ✅ executado 25/07 |
| [`handoff-ativacao-total.md`](handoff/handoff-ativacao-total.md) | ligar os 10 projetos do autopublishing + horário do cron | ✅ executado 25/07 |
| [`handoff-correcao-e-rollout.md`](handoff/handoff-correcao-e-rollout.md) | correção dos 3 primeiros artigos + rollout | ✅ executado 25/07 |

**O que é:** hub administrativo dos 10 projetos full-SEO em `hub.roilabs.com.br` (EasyPanel, repo privado `JeanZorzetti/roihub`, deploy por push). Rankeia por score de prioridade 0–100 e responde: **em qual projeto trabalhar hoje**. SplitJud fica de fora por decisão do Jean (10/07/2026) — projeto dividido com o Aldo.

## 28/07 (2ª sessão) — F4: o hub passou a explicar em português; handoffs organizados em `handoff/`

- **Organização dos handoffs.** Os 10 temáticos saíram da raiz pra [`handoff/`](handoff/) (nome de
  arquivo preservado — as referências cruzadas entre eles continuam válidas de graça) e este
  arquivo ganhou o índice no topo, com o estado de cada um (vivo / referência / executado).
- **F4 — narrativa (`ml/narrate.py`)**: cada card do `/insights` abre com 2–3 frases em pt-BR
  escritas pelo `claude-cli` em cima do próprio `insights.json`. **Uma chamada por run** com todos
  os projetos no mesmo prompt — o gargalo é rate limit de assinatura, não token, então 11 prompts
  pequenos só multiplicariam a chance de 429. 11/11 no primeiro run.
- **O prompt leva fatos, não o JSON cru** (`project_facts`): uma linha por sinal. E leva as regras
  duras do portfólio (só os números do JSON, nunca mídia paga, `insufficient-data` é série curta e
  não queda, banda larga é incerteza do modelo) — sem elas o modelo lê "sem dados" como notícia ruim.
- **A ordem importa e é por design:** o `analyze.py` reescreve o arquivo inteiro com
  `narrative: None`, então narrativa velha nunca sobrevive a número novo — e por isso o `/insights`
  não precisa de checagem de staleness nenhuma. O preço: sem rodar o narrate depois, o card fica
  sem prosa. Por isso o robô de crawl encadeia os dois — mas a falha do narrate **não** entra no
  exit code dele (enfeite em cima do número; rate limit não é robô quebrado).
- Já saiu insight de negócio do primeiro run: **sirius** com impressões subindo e cliques caindo
  14%/sem = problema de CTR (title/meta), não de ranking; **nimblabs** com posição média piorando
  de 64,8 → 69,1 enquanto impressões crescem = conteúdo novo indexando fundo.
- Verificado: 24/24 pytest (6 novos, todos em função pura — nenhum spawna o CLI), 128/128 npm test,
  tsc limpo, build 5 rotas ƒ, e a página renderizada em dev com as 11 narrativas reais.

## 28/07 (noite) — F3: o hub passou a responder o kill-gate sozinho (+ as 2 tarefas de ops)

Sessão fechou 3 das 4 frentes do handoff anterior (`7d2ec87`). O que ficou de aprendizado:

- **F3 — forecast + kill-gates** (`ml/forecast.py`, render em `/insights`). Holt amortecido
  (ETS(A,Ad,N)) em `log1p` da série semanal do GSC, **sem statsmodels**: 68 pontos semanais não
  sustentam sazonalidade nenhuma, e impressão de site novo cresce multiplicativamente (1 → 540 em
  9 semanas), onde tendência aditiva na escala crua subestima a curva e projeta negativo. Intervalo
  de **80%** com a variância h-passos exata (Hyndman tab. 7.8) — a aproximação sem trend dá banda
  estreita, e banda estreita numa decisão de **matar um bet** é falsa confiança. Decisões que não
  devem ser reabertas estão em `handoff/handoff-ml.md` (bloco "STATUS 28/07").
- **O primeiro run já mudou uma decisão de negócio, não só a tela:** Aftercare **passou** o D+90
  (540 imp/sem contra o gate de 100) **um mês antes** de 30/08; ReviewShield **não cruza** (~84,
  banda 35–200) até 02/09; Context Keeper saiu do zero absoluto (49 imp/sem, era 0 em 11/07 — o
  Request Indexing pegou) mas ainda é curto demais pra projetar.
- **Nova instância da armadilha dos cards podres:** o `acao` do aftercare manda fazer à mão a
  leitura que o hub agora faz sozinho. **Toda automação nova candidata um card a apodrecer** —
  quem ligar a automação atualiza o card no mesmo commit.
- **A2 — robô de crawl stats agendado** (domingo 10:00 BRT, primeiro disparo 02/08). `schtasks`
  **não serve**: o CLI não expõe `StartWhenAvailable` ("run if missed"), que era exatamente o
  requisito. `Register-ScheduledTask` expõe, e o `-WorkingDirectory` ainda resolve o gotcha do
  Task Scheduler iniciar em `System32` (o `git add` cairia no lugar errado). Até aqui o `/infra`
  congelava em 25/07.
- **A3 — `Atma` arquivado.** Repo arquivado é ignorado pelo hub e o histórico continua lá: **é a
  forma canônica de aposentar um projeto**, melhor que limpar a `homepage` (paliativo de 28/07).
- Verificado: 18/18 pytest (7 novos), 128/128 npm test, tsc limpo, build 5 rotas ƒ, e a página
  renderizada em dev com os dados reais das 3 apostas.

## 13/07 — auditoria dos 10 cards de ação: 3 estavam improcedentes/errados; convenção "Repo:" adotada

- **Gatilho (Jean):** "já é a quarta tarefa improcedente que pego da agenda". Auditei os 10 `acao`/`acaoDesc` do
  projects.json contra os repos e a prod ANTES de reescrever — cada afirmação nova tem verificação datada.
- **Padrão da falha (é processo, não código):** os cards são texto curado à mão; o trabalho acontece
  (ou uma investigação conclui) e ninguém volta pra atualizar o card — o hub segue mandando executar
  o que já morreu. Agravante: nenhum card dizia **em qual repo** executar.
- **Caso pior (13/07):** o card do **estetiacrm** ("233 console.* → pino") foi executado **no monorepo roilabs**
  por engano — sem "Repo:" no texto, o executor assumiu o repo errado. A premissa numérica era quase certa
  **no Doc-CRM**: 1.084 console.* versionados, ~222 em runtime (lib 76, components 74, app 52, hooks 18).
  E "pino" era prescrição errada: Doc-CRM builda `output: standalone` (worker_threads do transport não é
  traçado no bundle; quebra só em prod). Card reescrito: logger JSON zero-dep, referência em
  `ROI Labs/app/src/lib/log.ts` (shipped 13/07 no roilabs).
- **goiania:** "Consertar IndexNow 403" → causa JÁ achada 13/07 (Bing não conhece o subdomínio; Yandex 202
  prova chave/arquivo ok). Card virou o desbloqueio real: **manual**, verificar o host no Bing Webmaster Tools.
- **roilabs:** "Investigar crawl 40,6% OK" → investigação CONCLUÍDA 13/07, zero bug vivo (Crawl Stats = média
  de 90 dias; 222/234 requisições pré-fix; www 301 e /obrigado noindex sondados hoje). Card virou a tarefa viva
  e verificada: logo de 173.709 bytes em `site/public/roilabs-logo.png` (conferido em disco hoje).
- **Válidos, mantidos:** sirius (gate 28/07), fabrica (sitemap GSC — pendente por handoff de hoje), polarisia
  (spec 012), reviewshield (/checker p78), context (**llms.txt confirmado 404 hoje**), aftercare (gate ~29/08),
  nimblabs (backlink npm; adicionado aviso pra DATAR as falhas antes de investigar o "60,3% OK" — mesmo gotcha
  de 90 dias do roilabs).
- **Convenção nova:** todo card com tarefa de dev começa com `Repo: …` (ou `MANUAL (Jean…)`). Ao fechar
  trabalho de um projeto, **atualizar o card no projects.json faz parte do fechamento** — o rodapé da /agenda
  já dizia isso; agora é regra de handoff.
- Verificado: JSON parseia (10 projetos, todos com acao+acaoDesc), suíte verde. projects.json é import
  estático — o push publica via redeploy automático.

## 12/07 — recorrência DIÁRIA na agenda (weekday=7) + 10 tarefas de artigo/dia

- Pedido do Jean: 10 tarefas contínuas, 1 por projeto, "publicar um novo artigo por dia". A agenda só tinha recorrência semanal (weekday 0-6) → **`weekday = 7` agora = diária** (ocorrência sempre = hoje; cai no bucket "Hoje" e reseta a cada dia). Diff mínimo: 1 branch em `nextOccurrence()` (lib/agenda.mjs), label "todo dia" no meta, opção nos 2 selects (add + modal), regex `^[0-7]$` no actions.ts, e CHECK do banco trocado de 0-6 → 0-7 (par DROP IF EXISTS + ADD no `ensure()`, idempotente — padrão aditivo; já apliquei no PROD direto).
- **10 tarefas inseridas** (ids 6–15): "Publicar 1 artigo novo no blog", weekday=7, uma por slug do projects.json, com descrição de cadência. Inserção idempotente (checa título+projeto+weekday antes).
- Ação da fabrica "Publicar artigos 4–20..." **EXECUTADA** (blog do estetia-demo 3→20 artigos, ver handoff s5 lá) → marcada feita em hub_done (`acao:fabrica:e0c29431`) e card atualizado: nova acao = submeter sitemap + indexação no GSC.
- Verificado: tsc 0 erros, testes (incl. 2 casos novos de `nextOccurrence(7,…)`).

## 12/07 — ação do Context Keeper era fantasma: publish já tinha saído em 10/06

- Pedido do Jean: executar "npm publish do daemon com os 4 fixes e2e" e atualizar a /agenda. Verificado no registry ANTES de publicar: `@jeanzorzetti/context-keeper@1.2.0` (e MCP 0.2.0) publicados em **10/06 16:32 UTC** — tarball conferido (contém `quality.js`/providers/hook + `response_format: json_object` no groq.js, o fix do bug 4). Nada a publicar; a ação do ranking estava desatualizada (memória/projects.json).
- Atualização: `projects.json` do card `context` → blocker removido (`blockers` 5→2, lista vazia), acaoDesc com ✅ e nova acao "Hashear User.apiToken (hoje plaintext no banco)" (confirmado no código: `findUnique({ where: { apiToken } })`). Ação antiga marcada feita em `hub_done` (`acao:context:9547cb72`) pro histórico.
- Verificação da página ao vivo bloqueada por basic auth (HUB_PASS só no EasyPanel); dados conferidos direto nas duas fontes da página (projects.json na main + hub_done no PG).

## 11/07 — SEM Google Ads em nenhum projeto (decisão do Jean)

- Portfólio é **100% SEO** — nada de tráfego pago, nem branded defense. A ação "Subir Google Ads branded 'sirius crm'" (reintroduzida em `33ea5f2` após a investigação do declining) foi trocada por: validar entity SEO em prod (Rich Results Test) + medir posição branded no GSC ~28/07; sem recuperação → reforçar entity SEO on-site.
- Regra pra edições futuras do projects.json (soma à regra "só tarefa DEV"): **acao/blockers nunca propõem mídia paga**.

## 11/07 — /agenda ordena as ações pelo ranking da home

- Pedido do Jean: "Ações dos projetos" estava na ordem do arquivo projects.json, não na prioridade da home. `evaluate()`/`evaluateAll()` extraídos de `app/page.tsx` para `lib/evaluate.ts` (fonte única de score) — home e agenda usam a MESMA avaliação ao vivo (saúde + GSC + insights), então a ordem nunca diverge. Cada ação ganhou meta `#N · score S`.
- Custo: /agenda agora faz os mesmos 10 health checks + 10 gscTrend da home a cada load (paralelo, 1 usuário — ok; se pesar, cachear o evaluateAll por request/minuto).
- Tarefas do banco (buckets datados) seguem ordenadas por data/id — prioridade por projeto dentro do bucket não foi pedida (adicionar se fizer falta).
- Verificado E2E local: DOM da /agenda com pendentes #2..#10 na ordem exata da home (#1 goiania em Feitas por já estar riscada).

## 11/07 — home risca ações já feitas na agenda

- Pedido do Jean: a home não refletia o check da /agenda. Agora a home lê o mesmo `hub_done` (`listDone()`, chave `acao:{slug}:{hash8(acao)}@1970-01-01`) e risca a ação no hero (✓ + cinza) e na coluna "Próxima ação". Sem `DATABASE_URL`/DB fora → nada riscado (catch → set vazio, hub nunca cai por DB).
- Home ganhou `force-dynamic` explícito (antes dependia só do `no-store` do health check; agora tem query PG).
- Riscar ≠ concluir: conclusão real segue sendo trocar a ação no projects.json (rodapé explica).
- Verificado E2E local com DB real (goiania riscada de verdade + sirius com row de teste, removida depois).

## 11/07 — data de início no GSC por projeto (`gscInicio`)

- Pedido do Jean: marcar quando cada projeto entrou no GSC pra ter régua de revisão de performance/crawl. Decisão (confirmada): **campo opcional `gscInicio: "AAAA-MM-DD"` no projects.json** — sem DB, sem arquivo novo; editar+push como todo metadado manual.
- Exibição via `sinceGsc()` em `app/viz.tsx`: "/seo" mostra "· GSC desde 28/06 · D+13" ao lado da URL do card; "/infra" mostra no "cobre: Nome (GSC desde … · D+N)". Projeto sem o campo não mostra nada.
- Preenchido por enquanto **só goiânia (28/06/2026)** — os outros 9 entram quando o Jean confirmar as datas.

## 11/07 — agenda: modal de edição de tarefa

- Pedido do Jean: clicar na tarefa → modal de edição. Título da tarefa (só as do banco; "ações do ranking" continuam texto) virou botão que abre `<dialog>` nativo com os mesmos campos do form de adicionar (título, data, recorrência, projeto) → server action `update` → `UPDATE hub_tasks`.
- **+ campo `descricao`** (pedido seguinte): coluna nova via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` no `ensure()` (o padrão aditivo combinado), textarea no modal (2000 chars), exibida em cinza sob o título quando a tarefa está pendente (some quando feita). Form de adicionar NÃO tem o campo — descrição entra pelo modal. As 3 tarefas seed já foram descritas direto no banco (passo-a-passo da rotina de sexta; alerta do serper quebrado 06/07 no rank tracking; pré-requisitos do checkpoint da malha).
- Único client component da aba: `app/agenda/edit-task.tsx` (precisa de `showModal()`); resto segue 100% server. Parsing de campos unificado em `taskFields()` no actions.ts (add e update validam igual).
- Done antigo não é limpo ao mudar data/recorrência: linhas órfãs em `hub_done` são inertes (lookup usa a ocorrência nova).
- Verificado: tsc + build + 24/24 testes.

## 11/07 — aba Agenda (checklist com persistência em Postgres)

- Pedido do Jean: "calendário com checklist" interativo. Duas correções dele mudaram o desenho: o vault Obsidian só cobre roilabs/goiânia (2 de 10 — o hub é o único agregador dos 10) e o "sem-DB" era decisão minha, não requisito dele → **agora tem Postgres**.
- **DB: `roihub_db` DEDICADO** (`2.24.207.200:5445`, user `roihub_db` — o Jean criou na EasyPanel em 11/07; a 1ª versão usava o servidor do roilabs_db com prefixo `hub_`, tabelas de lá já dropadas): `hub_tasks` (titulo, projeto?, due?, weekday? 0-6 = recorrente semanal) e `hub_done` (key, occurrence, PK composto). Sem migration formal por design: schema auto-criado no 1º uso (`CREATE TABLE IF NOT EXISTS` em `lib/db.ts`, pool pg singleton) — schema novo no futuro = editar o `ensure()` (aditivo) ou rodar SQL manual. Schema + seeds já aplicados no banco dedicado em 11/07. Sem `DATABASE_URL` → banner de setup + ações do ranking em modo leitura.
- `/agenda`: buckets Atrasadas / Hoje / Próximos 7 dias / Mais tarde / Sem data + **"Ações dos projetos"** (espelha a `acao` do projects.json de graça — key com hash do texto, mudou a ação = check reseta) + "✓ Feitas" recolhido com undo. Form de nova tarefa (data OU recorrência semanal + projeto opcional). Tudo server actions + forms, zero JS no cliente; helpers de data puros em `lib/agenda.mjs` (fuso São Paulo, testados).
- Recorrente reseta a cada ocorrência (done por data); ocorrência perdida some sem cobrar (ponytail: sem nag de recorrente atrasado — upgrade se fizer falta).
- Seeds no DB (11/07): rotina de sexta (crawl+analyze.py), conferir rank tracking (toda segunda), checkpoint da malha 15/07.
- Verificado: 24/24 testes, build limpo, **E2E local com DB real** (marcar→Feitas, desmarcar, adicionar, apagar via Playwright).
- ⚠️ **Ops pendente (Jean, 2 min): setar `DATABASE_URL` na EasyPanel do hub + redeploy** — valor no `.env` local (externo `2.24.207.200:5445/roihub_db`; do serviço na mesma EasyPanel o hostname interno do postgres novo na porta 5432 também vale). Senha PG segue na lista de rotação.

## 11/07 — hub é só do Jean (dev): tarefas comerciais fora da equação

- Decisão do Jean: captação/comercial é da Maria Eduarda e NÃO entra no ranking. `projects.json` limpo: goiânia perdeu o blocker "contatar fornecedor" (9→4, ação virou os secrets do checkpoint 15/07 + redirects do crawl), sirius perdeu "subir Google Ads" (7→2, ação virou investigar o trend declining do /insights), reviewshield perdeu "primeiro outreach US" (6→4). Receita segue intocada — mede valor na mesa, não tarefa.
- **Regra pra edições futuras do projects.json: blockers/acao = só tarefa DEV.** Tarefas da Duda vivem no vault (`backlog-pendencias` seção "Não-dev").
- Ranking resultante (sim. com seoSeed): goiania 64 > sirius 56 > fabrica 55 > roilabs 55 > …

## 11/07 — decay do score agora vem do insights.json (ML)

- **Pedido do Jean**: o ranking da home não reagia às abas novas; o `/insights` já tinha `health` 0–100 por projeto sem alimentar o score. Semântica confirmada com ele: saúde baixa = precisa de atenção = decay ALTO (mapeamento invertido).
- `decayFromHealth(health, generatedAt)` em `lib/score.mjs`: `10 − saúde/10`, só quando o insights.json foi gerado há ≤ 10 dias (mesma régua de "velho" do /insights); senão `null` → cai no `decay` manual do projects.json. Site fora do ar continua forçando 10 (precedência máxima).
- Flags do insights (hoje só `crawl-waste`, com o detail do crawl) entram como linhas ⚠ nos blockers exibidos do foco — **não** mudam a nota `blockers` (manual).
- Meter do foco ganha sufixo "· ML" quando o decay é automático; rodapé explica a regra.
- Efeito medido na simulação (seoSeed, dados de 10/07): top 4 estável (receita+blockers dominam); polarisia (saúde 80) cai 5º→8º; context/nimblabs/estetiacrm/reviewshield (crawl-waste) sobem. Ou seja: rodar `ml/analyze.py` na sexta agora move o ranking sozinho.
- Testes 19/19 (`decayFromHealth` coberto) + tsc limpo.

## Estado atual (fim da sessão de 10/07, tarde)

- **App no ar** em `hub.roilabs.com.br` com basic auth. **GSC conectado em prod** (rodapé "conectado — 10 propriedades", confirmado pelo Jean 10/07).
- **Aba SEO de progressão SHIPPED** nesta sessão: `/seo` com small multiples (1 card por projeto), verificada local com dados reais (10/10 cards com GSC).
  - Por card: 3 stats 28d vs 28d anteriores (cliques Δ%, impressões Δ%, posição média Δ absoluto com leitura invertida — cair é verde) + 2 mini-gráficos de colunas de 12 semanas (cliques/sem e impressões/sem, séries separadas — nunca 2 escalas num eixo).
  - Sem DB: `gscSeries()` busca 84 dias diários da API (16 meses de histórico disponível), `lib/series.mjs` agrega em semanas e janelas 28d na hora, a cada load (`force-dynamic`).
  - Posição média ponderada por impressões (média simples mente); semana/janela sem impressão → `—`.
  - Tooltip = `<title>` nativo do SVG (sem JS no cliente); tabela-gêmea em `<details>` cobre teclado/a11y. Upgrade pra tooltip JS só se fizer falta.
  - Cards ordenados por impressões 28d desc; projeto sem propriedade GSC → estado vazio honesto com pill SEED.
  - Navegação por abas (Ranking | SEO) no topo das duas páginas; chrome compartilhado em `app/tabs.tsx` (Tabs + GscFoot).

- **Aba Infra (crawl stats) SHIPPED 10/07** (`d930830`): `/infra` lê os exports manuais de "Estatísticas de rastreamento" do GSC (a API NÃO expõe crawl stats). 1 card por propriedade: requisições 28d Δ%, resposta média 28d ponderada (cair = melhor), % por classe de resposta (OK/redirect/404/5xx/outros) com alerta (OK < 85% ou 5xx ≥ 1%), 2 charts de 12 semanas, tabela semanal por card. Verificado local com 9 propriedades reais.
  - **Rotina de sexta do Jean**: GSC → Configurações → Estatísticas de rastreamento → Exportar; descompactar em `docs/` (qualquer subpasta) e **commit+push** — o nome da pasta (`{host}-Crawl-stats-AAAA-MM-DD`) identifica host e data, o app acha sozinho (scan recursivo).
  - Cada export cobre 90 dias; exports de semanas seguintes se emendam por data (merge, export mais novo vence no dia sobreposto) — histórico cresce sem DB.
  - Achados do 1º export (10/07): roilabs.com.br só 40,6% OK (32,5% redirect + 22,7% outros!), goiania 65,2% OK (33,6% redirect — eco do gotcha trailing-slash do nginx), nimblabs 60,3% OK. Candidatos a investigação.

## Arquivos-chave

- `lib/gsc.ts` — auth + sites.list (cache 10 min) + `gscTrend` (home) + `gscSeries`/`queryTimeseries` (aba SEO, `dimensions:["date"]`).
- `lib/series.mjs` — agregação pura da série GSC (bucketWeeks, totals28, addDays), JS+JSDoc.
- `lib/crawl.mjs` — parse dos CSVs de crawl stats (localizados pt-BR: parse por POSIÇÃO de coluna; classe "(5xx)" agrupada no label), merge de exports, buckets.
- `app/viz.tsx` — WeekChart/Stat/Delta/InvDelta compartilhados entre /seo e /infra (100% server, tooltip `<title>` SVG).
- `app/seo/page.tsx` e `app/infra/page.tsx` — as abas.
- `data/projects.json` — critérios manuais; editar + push = redeploy.
- `ml/forecast.py` — Holt amortecido + kill-gates da tese nimblabs (relógios vêm de
  `nimblabs/docs/PORTFOLIO-EN-STRATEGY.md` §6: data da **submissão do sitemap**, não do deploy).
- `ml/narrate.py` — F4: 1 chamada de claude-cli por run escreve o `narrative` de cada projeto. Roda
  DEPOIS do analyze.py (que zera as narrativas); `--dry-run` mostra o prompt sem chamar o CLI.
- `npm test` — 128/128 (score + series + crawl + agenda + autopublish + projects). Node 22: listar
  arquivos explícitos no script (dir não resolve). ML: `C:\venvs\roihub-ml\Scripts\python -m pytest ml/test_ml.py -q` (24/24).
- Dockerfile copia `docs/` pra imagem (a /infra lê via fs em runtime).

## Commits (todos na main, deploy automático)

- `879c5fa` app inicial completo (score+health+GSC+auth+Docker)
- `3b4c7f3` GSC auto-descoberta de propriedades (sites.list, cache 10 min, filtro por host)
- `3d2c552` linha de status GSC no rodapé
- `c4e1e50` fix: env malformada mostrava 500 em vez do estado de erro
- (10/07 tarde) aba SEO de progressão — ver `git log`

## Decisões de arquitetura

- **Sem DB**: critérios manuais em `data/projects.json` versionado. Histórico SEO vem da API do GSC a cada load — 10 projetos × 1 request, latência ok pra 1 usuário.
- **Página dinâmica** (sem ISR): 1 usuário, health `no-store`; site fora do ar → decay forçado 10 + banner.
- **Service account REUSADA** do projeto GCP `review-dispute-agent-498311` (API já ativa). ⚠️ Se esse projeto GCP for deletado, o hub perde o GSC.
- Basic auth fail-closed: sem `HUB_PASS` em produção → 503.
- Score em `lib/score.mjs`, agregação em `lib/series.mjs` (JS puro com JSDoc pra rodar no node:test sem tooling).

## Aba Insights (ML) — SHIPPED 10/07 (noite)

- **F0–F2 do `handoff/handoff-ml.md` implementados**: `ml/` (Python 3.13, venv em `C:\venvs\roihub-ml`) gera `data/insights.json` (versionado) e a aba `/insights` renderiza — health 0–100 explicável, tendência Theil-Sen 4/12/26 sem, changepoints PELT, anomalias MAD, diagnóstico crawl↔SEO. Detalhes/gotchas/pendências (F3 forecast, F4 narrativa) em `handoff/handoff-ml.md`.
- **Rotina de sexta agora**: export de crawl em `docs/` → `C:\venvs\roihub-ml\Scripts\python ml\analyze.py` → commit+push.
- pytest 11/11 em `ml/test_ml.py`; extração validada 100% contra os totais 28d do hub.

## Próximos candidatos

- **A1 (ops, não código): 3 sites de produção fora do ar** — detalhe e diagnóstico já feito em
  `handoff/handoff-proximo-passo.md`. É o item de maior impacto e nenhuma sessão de código o resolve.
- Calibrar o threshold do gate D+180 (10 cliques/sem, constante em `GATE_SPECS`) quando 28/11 se
  aproximar: é o único número do sistema que não sai de um documento.
- **Medir o custo da home em prod** (38 projetos × 1 health check + 2 queries GSC; 2,2–3,0 s em
  dev). Medir antes de otimizar; se doer, cachear o health check por minutos resolve.
- Conferir `/seo`, `/infra` e `/insights` em prod depois do deploy (deploy é automático no push).
- `.env` local com a credencial agora existe (gitignorado) — dev local mostra dados reais.
- Se a aba SEO pedir interação real (crosshair, filtro de janela), aí sim entra client JS — hoje é 100% server.

## Gotchas (vários valem pra qualquer projeto novo nesta máquina)

- **TypeScript pinado `^5`**: npm resolve TS 7 por padrão e o build do Next 16 quebra com ele.
- **`turbopack.root` obrigatório** no next.config: há um `package-lock.json` solto em `C:\Users\jeanz` que faz o Next inferir o root errado.
- **PS 5.1 + git commit**: aspas duplas dentro de here-string `-m` quebram o argumento — usar o Bash tool ou não usar `"` na mensagem.
- **Matar dev server**: `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where { $_.CommandLine -match "next" } | ForEach { Stop-Process -Id $_.ProcessId -Force }` — kill simples deixa órfão segurando a porta 3000.
- **`node --test <dir>` não resolve no Node 22** — listar os arquivos de teste explícitos no script.
- GSC atrasa ~3 dias; janelas de 28d e semanas fecham em D-3.
- Falha de GSC nunca derruba o hub — home cai pro `seoSeed` (pill SEED), `/seo` mostra estado vazio; `gscStatus` reporta o motivo no rodapé das duas.
- Warning "middleware → proxy" no build é só deprecation do Next 16 (e o "1 Issue" no dev overlay é DeprecationWarning de zlib de dependência — ignorar).
