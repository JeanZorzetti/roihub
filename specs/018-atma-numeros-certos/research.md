# Research — 018 · Nenhum número da `/okr/atma` está errado

**Fase 0.** Nenhum `NEEDS CLARIFICATION` sobrou do Technical Context: a stack é fixa (constituição
§Restrições Técnicas), não entra dependência e as 17 decisões de produto já foram fechadas na
sessão de grilling de 05/09/2026 e estão nos FR. O que esta fase resolve são as decisões de
**implementação** — onde cada regra mora, para que a Fase 1 não invente duas casas para a mesma
coisa.

Cada decisão foi tirada lendo o código que ela toca, não o que a spec supõe sobre ele. Onde a
leitura mudou a decisão, o registro diz o quê.

---

## D1 — As janelas moram num `.mjs` puro, e a época é parâmetro, não relógio

**Decisão**: `lib/janelas.mjs` exporta `DESCOBERTA`, `COMPORTAMENTO` e `CONVERSAO` como
**funções de `agora`** (`(agora = Date.now()) => ({inicio, fim, nome})`), não como constantes já
avaliadas. `CONVERSAO(agora, epoca?)` devolve `epoca → hoje` quando a época existe e `28d/D-3`
quando não.

**Racional**: `lib/okr-coleta.ts` hoje avalia `isoDaysAgo(3)` **no import** (`export const FIM =
isoDaysAgo(3)`). Em módulo puro isso é relógio escondido — o teste não consegue fixar o dia e a
FR-001 proíbe literalmente ("sem relógio além do parâmetro"). Função com `agora` default é o
mesmo padrão que `lib/gsc-consulta.mjs:17` já usa (`diasAtras(n, agora = Date.now())`), então não
é convenção nova: é a convenção que já existe no repo, aplicada onde faltava.

`lib/okr-coleta.ts` continua exportando `INICIO`/`FIM`/`HOJE` avaliados, agora **derivados** de
`lib/janelas.mjs` — as telas importam de lá como sempre e nenhum call site muda de forma.

**Alternativas rejeitadas**:
- *Constantes puras já avaliadas em `janelas.mjs`*: mata a testabilidade (a época faz a janela
  crescer todo dia; sem `agora` parametrizado o teste passa hoje e reprova amanhã).
- *Deixar em `okr-coleta.ts` e o script importar de lá*: `okr-coleta.ts` importa `pg` e
  `google-auth-library`; `scripts/funil.mjs` passaria a arrastar a borda inteira, e `node --test`
  nunca poderia cobrir a regra de janela. Fere o Princípio III.

---

## D2 — Só a fonte própria muda de janela; a escolha é feita na borda, uma vez

**Decisão**: `coletarDoProjeto()` deixa de receber **uma** janela e passa a receber (e devolver)
as três. GSC, GA4 e o `vendas` do card continuam em `DESCOBERTA`/`COMPORTAMENTO` (28d/D-3);
`patient_leads` e `orcamentos` passam a `CONVERSAO`. Quem escolhe é a borda — `lib/okr-coleta.ts`
—, não a regra pura.

**Racional**: a FR-003 é uma trava de amplitude, não uma preferência: esticar o GSC trocaria a
célula `visitante` dos 17 projetos e o `posicaoDeAtaque()` de `/okr` reordenaria o portfólio
inteiro dentro de uma spec chamada "correção". Manter a escolha na borda também é o que garante a
SC-007: projeto sem `epoca` recebe `CONVERSAO` = 28d/D-3, byte a byte a janela de hoje.

**Alternativa rejeitada**: passar a janela para dentro de `montarFicha()` e deixar cada marco
escolher. Espalharia a decisão por `lib/okr.mjs` e faria o degrau saber de calendário — o
contrário do que `montarFicha()` é hoje (recebe células prontas, não sabe de onde vieram).

---

## D3 — `respondeu` é coletor derivado, e o piso viaja como campo da própria célula

**Decisão**: `celulaDeResposta(reais)` em `lib/okr.mjs` devolve
`apurado(21)` com um campo extra `piso: { indeterminados: 1, teto: 22 }` quando há lead sem
motivo. `montarFicha()` copia esse campo para a **taxa** cujo numerador é o marco `respondeu`, e
`montarN3()` (`lib/ficha.mjs`) renderiza "no mínimo 41,2% (21/51) · 1 indeterminado".

**Racional**: `ehApurado()` só olha `typeof c.valor === "number"` — um campo extra na célula
atravessa `razao()`, `montarFicha()` e `avaliarN2()` sem que nenhum deles precise saber que ele
existe. É exatamente o que a FR-016 pede ("flag no rótulo que a célula já carrega — não um quarto
estado ao lado de `apurado`/`declarado`/`inferido`/`ponte`"). Um quinto estado obrigaria a revisar
`combinar()`, `validarKrs()`, `escolherFamilia()` e a tela.

O denominador continua sendo `lead` inteiro (51), nunca 50: trocar faria a cadeia ter duas
populações, que é o defeito dos orçamentos órfãos que a 017 acabou de matar (FR-015).

**Alternativas rejeitadas**:
- *Quarto/quinto estado `piso`*: espalha um `if` por todo consumidor de célula.
- *Excluir o lead sem motivo do denominador*: duas populações na mesma cadeia (proibido por
  FR-015).
- *Tratar o indeterminado como "não respondeu"*: inventa um fato; o piso existe justamente para
  não escolher por ele.

---

## D4 — O ticket é resolvido por UMA função, chamada em dois lugares que leem o mesmo resultado

**Decisão**: `ticketDeOrcamentos(rows, janela)` (`lib/okr.mjs`, puro) devolve
`apurado(média de preco × (1 − coalesce(desconto_vista,0)))` ou `naoApurado(...)`.
`resolverTicket(ticketApurado, meta)` (`lib/ficha.mjs`, puro) devolve **uma `CelulaFicha`**:
`apurado` com fonte `"média de 7 orçamentos, líquido de desconto"` quando há apuração, senão
`declarada(meta.ticket)`. `app/okr/[slug]/page.tsx` chama `resolverTicket()` **antes** de
`projetar()` e passa `{...meta, ticket: resolvido.valor}`; `montarNiveis()` recebe a mesma célula
já resolvida e a usa em `montarN1()` e em `avaliarN2()`.

**Racional**: FR-022 exige "num lugar só" e FR-034 proíbe regra nova em `lib/projecao.mjs`. Uma
função pura chamada duas vezes com a mesma entrada devolve o mesmo objeto — a página e a ficha não
podem divergir. O rótulo sai junto (FR-023), o que fecha o defeito medido: `projecao.tsx` hoje
imprime "declarada (D1)" em cima do ticket.

**Verificado no código**: `avaliarN2()` recebe hoje `{ticket, ticketDeclaradoEm}` e monta a célula
`declarada()` internamente — é esse ponto que passa a receber a célula pronta, não dois números.
`montarN1()` faz o mesmo por `combinar([contagem, declarada(meta.ticket, ...)])`; com a célula
apurada entrando, `combinar()` já devolve `apurado` sozinho (ele só rebaixa para `declarado`
quando algum insumo é declarado). Nenhuma regra nova em `combinar()`.

**Alternativa rejeitada**: resolver dentro de `projetar()`. Viola FR-034 e criaria a terceira
casa do ticket (hoje já são duas: `montarN1` e `avaliarN2`).

---

## D5 — `contatado` vira nota do card lido pela ficha, e `celulaDeContato()` continua viva

**Decisão**: `PERFIS.D.marcos` passa a `lead → respondeu → orcamento → tratamento`.
`celulaDeContato()` (`lib/okr.mjs`) não é apagada: `coletarDoProjeto()` continua devolvendo
`contatados`, e `montarNiveis()` a transforma numa **nota** de N3 — "100% contatados (declarado
pelo operador, 05/09/2026)" — sem taxa, fora do cálculo de gargalo.

**Racional**: FR-013 é literal ("continua existindo e DEVE alimentar uma nota, não um marco").
Apagar a função jogaria fora a leitura que prova o ponto (51 de 51 fora de `novo`) e faria a tela
esquecer por que o degrau saiu. `nivel()` já aceita `nota` como terceiro parâmetro (usado hoje pelo
N4) — não é mecanismo novo.

**Consequência verificada**: com `visitante` fora de `PERFIS.D.marcos`, `montarN4()` já marca o
canal orgânico como `semElo` sozinho (`primeiroMarco !== "visitante"`, `lib/ficha.mjs:302`), que é
exatamente o comportamento correto da FR-007 — a travessia de cadeia deixa de existir por
construção, não por um `if` novo.

---

## D6 — A trava de cadeia é aritmética em `arvore-metas.mjs`, não um comentário

**Decisão**: `montarArvore()` só acrescenta a camada de impressões quando `marcos[0].chave ===
"visitante"`. Sem isso, com a cadeia D começando em `lead`, a árvore dividiria `lead` pelo CTR do
GSC e publicaria uma taxa `impressão → lead` que cruza Descoberta e Conversão.

**Racional**: este é o achado que só apareceu lendo `lib/arvore-metas.mjs:170` — a spec fala de
"nenhuma taxa cruza cadeias" e ninguém tinha olhado que a árvore anexa a camada de impressões
depois do **primeiro** marco, qualquer que ele seja. Sem a guarda, a US1-AC5 passaria no teste da
ficha e falharia na tela da árvore.

**Alternativa rejeitada**: tirar `ctr` da chamada em `app/okr/[slug]/page.tsx`. Consertaria a
`atma` e deixaria a bomba armada para o próximo perfil que perder o `visitante`.

---

## D7 — O rótulo de buraco é campo **opcional**, e a regex de hoje continua sendo o default

**Decisão**: `naoApurado(motivo, rotuloBuraco?)` em `lib/funil.mjs` e
`naoApurada(motivo, consultar, rotulo, rotuloBuraco?)` em `lib/ficha.mjs`. Valores:
`nao-mede` | `falhou-agora` | `tela-nao-le`. Ausente = comportamento de hoje.
`EH_FALHA_TRANSITORIA` (a regex de `app/okr/[slug]/page.tsx:94`) **fica**, como fallback só para
célula sem rótulo.

**Racional**: FR-028 proíbe regex *como definição do rótulo* e exige que sem rótulo nada mude. As
duas coisas juntas significam: campo quando declarado, comportamento atual quando não. Rótulo
obrigatório com default gravaria `nao-mede` em ~70 dos 72 call sites que ninguém revisou —
produzindo em massa a declaração falsa que a spec existe para acabar.

**Nome do campo**: `rotuloBuraco`, não `rotulo`. `CelulaNaoApurada` de `lib/ficha.mjs` **já** tem
um `rotulo`, que é o texto exibido ("orçamento ENVIADO"). Reusar a palavra criaria dois
significados no mesmo objeto — o defeito que `rotulo_de_exibicao_nunca_e_chave` já custou uma vez.

**Consequência (FR-031)**: `status_historico` **não vira célula**. Criar célula só para
escondê-la da lista é scaffolding; o backlog (velocidade, passagem cumulativa, coorte) fica
registrado em `handoff/`.

---

## D8 — `form_submit` sai do catálogo e o abandono passa a comparar GA4 com o banco

**Decisão**: `EVENTOS_D3` (`lib/ga4.ts:77`) perde `form_submit`. `medidoresDeEventos()` passa a
receber `(ga4ev, { lead, janelaGa4, epoca })` e calcula
`abandono = form_start − lead`, **só quando `janelaGa4` COBRE a época inteira** (a época cabe
dentro do GA4, nunca o contrário); fora disso, `não apurado` nomeando a divergência de janela.

**Racional**: o evento disparou 1 vez em 12 meses e 0 na época, contra 51 leads gravados. O medidor
publicava há semanas um "não apurado" pedindo instrumentação para um degrau que o banco já mede.
O banco é canônico para `lead` (FR-032).

**Correção em implementação (05/09/2026) — a guarda nasce DISPARADA, não inerte**: a decisão
original desta seção dizia "GA4 (28d) cabe dentro da época (37d), o guard não dispara hoje" — e
tinha a direção AO CONTRÁRIO. Rodando `medidoresDeEventos()` contra os dados reais, `form_start`
medido só nos 28 dias de COMPORTAMENTO deu **37**, contra **51** leads que cobrem os 37 dias
inteiros da época — `37 − 51 = -14`, um abandono **negativo** (mais lead vindo do WhatsApp, que
não passa pelo formulário, do que form_start no recorte curto). Medido nos 37 dias inteiros da
época, `form_start` dá **64**, batendo com os "12 (19,1%)" que a spec sempre citou como resultado
esperado. A guarda certa não é "GA4 cabe dentro da época" — é **"GA4 COBRE a época inteira"**:
comparar um numerador de período mais curto com um denominador de período mais longo é o mesmo
defeito de composição que a FR-033 existe para impedir, só que apresentado ao contrário. Com a
guarda corrigida, o ramo `não apurado` DISPARA hoje (COMPORTAMENTO 28d não cobre os 37 dias da
atma) — só deixa de disparar quando a 019 esticar o GA4 para cobrir a época (ou mais).

**Alternativa rejeitada**: manter a guarda como "cabe dentro" e aceitar o número negativo,
documentando a limitação. Rejeitada porque publicar "-14" tem cara de resultado e mandaria
investigar um "excesso de abandono" que não existe — é exatamente o número com cara de apurado e
procedência errada que esta spec inteira existe para evitar.

---

## D9 — A `REGUA.D` perde duas linhas, e a régua é chaveada por `chave`, não por `nome`

**Decisão**: `REGUA.D` perde `lead→contatado` (fonte InfluxMD, que mede *agendamento* — degrau que
a Atma não tem) e `visitante→lead` (cruza cadeias). As citações ficam em comentário, como a 017 fez
com case acceptance.

**Racional**: `test/benchmark.test.mjs` já percorre `PERFIS` nos dois sentidos e reprova linha que
aponta para degrau inexistente — com `contatado` e `visitante` fora de `PERFIS.D.marcos`, a suíte
fica vermelha antes do deploy se as linhas ficarem. A trava já existe; a spec só a está acionando.

**Fora de escopo**: as seis réguas pesquisadas e o `DELETE` de `market_benchmarks` são a 020
(FR-035).

---

## D10 — A linha de base da SC-000 é medida ANTES de qualquer edição, e é registrada em `handoff/`

**Decisão**: a primeira tarefa da 018 é rodar a contagem de células `nao-apurado` da ficha da
`atma` **no código de hoje** e gravar o número em
`handoff/handoff-a-ficha-chamava-de-buraco-o-que-ja-estava-medido.md` (seção nova, datada). Sem
script novo: `node --env-file=.env` importando `montarNiveis()` já dá a lista, e a corrida é
manual e única.

**Racional**: SC-000 é literal ("medir depois do conserto mede o conserto — a primeira corrida tem
que ser a linha de base"). É o mesmo erro que `first_run_measures_the_check` registra: a primeira
corrida de um check novo mede o check. E SC-005 pede que a lista **encolheu**, não que ela caiba
num teto chutado — comparação exige as duas pontas medidas.

**Alternativa rejeitada**: script permanente em `scripts/`. Corrida única não vira ferramenta;
seria scaffolding pelo mesmo argumento da FR-031.

---

## D11 — `ehLeadDeTeste()` não corre em fonte própria, e o degrau `orcamento` é pacientes, não linhas

**Decisão** (tomada em implementação, 05/09/2026, confirmada por Jean): `celulaDeLeads()` ganha
`propria?: boolean`; quando `true`, pula inteiramente o filtro `ehLeadDeTeste()`. `coletarDoProjeto()`
passa `propria: true` para a leitura de `patient_leads`; `scripts/funil.mjs` faz o mesmo em
`agrupar()` para `lerFontesProprias()`.

**Racional**: rodando a coleta real contra o banco da Atma com a janela de época já ligada
(T010/US1), o `lead` saiu em **43**, não 51 — 8 registros com nome real ("Lucas Pimentel - Wpp",
"Adriene Almeida - Wpp"...) mas e-mail `teste@teste.com.br`/`teste@teste.com` batiam em
`ehLeadDeTeste()` porque `teste.com.br` está em `DOMINIOS_INTERNOS`. Jean confirmou: são leads
REAIS vindos direto do WhatsApp sem formulário — sem e-mail para capturar, o placeholder
"teste@..." foi preenchido à mão. `ehLeadDeTeste()` existe para separar demanda real do lead que o
TIME DA ROI LABS cria testando o CRM COMPARTILHADO (`crm_leads`) — não faz sentido nenhum aplicá-la
em `patient_leads`, tabela PRÓPRIA de um projeto onde só cai paciente real, por construção.

**Consequência para o degrau `orcamento`** (mesma sessão): as 7 linhas de `orcamentos` cobrem só
**4 pacientes distintos** (paciente 22, 44 e 51 pedem preço duas vezes — o mesmo padrão do Túlio
que motivou o dedup da 017). `celulasDeOrcamento()` já deduplica por `paciente_lead_id` desde
aquela spec; o "orçamento: 7" do quickstart original desta 018 foi medido por `count(*)` cru, sem
passar pela mesma regra de negócio que a tela aplica — o defeito de leitura que a 018 existe para
corrigir, medido na própria medição da 018. Corrigido para **4** em spec.md/data-model.md/
quickstart.md/tasks.md; o cálculo do ticket (D4 acima) continua sobre as 7 linhas cruas — reemissão
de preço é dado válido para a MÉDIA, mesmo não sendo um segundo degrau vencido.

**Alternativas rejeitadas**:
- *Editar os 8 e-mails no banco da Atma*: exigiria migração em produção fora deste repositório, e
  a próxima leitura por WhatsApp sem e-mail reproduziria o mesmo defeito.
- *Remover `teste.com.br` de `DOMINIOS_INTERNOS`*: mudaria `ehLeadDeTeste()` para os 35 projetos do
  portfólio sem necessidade — o defeito é aplicar o filtro fora do lugar (fonte própria), não o
  próprio filtro.
- *Contar as 7 linhas de `orcamentos` como o degrau*: reintroduziria o defeito que o dedup do
  Túlio (017) corrigiu — mesmo paciente pedindo preço duas vezes infla `CR(lead→orçamento)`.

## D12 — "10,1 vendas" é a aritmética do ticket, não o que `/okr/atma` mostra — e está certo

**Decisão** (achado em implementação, 05/09/2026, confirmado por Jean): não tocar
`lib/projecao.mjs` (FR-034 já proibia) nem tentar fazer a tela exibir "10,1". SC-002/quickstart
item 7 corrigidos para descrever o resultado real: **"âncora zerada — meta não se divide por
volume nenhum"**.

**Racional**: com o ticket apurado ligado (T037), rodei `projetar()` contra a ficha real da atma
(`lead 51 → respondeu 21 → orçamento 4 → tratamento 0`, todos apurados) e o veredito saiu
`nao-apurado`, não `10,1`. Motivo: `ancoraDe()` (`lib/projecao.mjs`, inalterado por esta spec)
escolhe o **último** marco como âncora quando a cadeia fecha ponta a ponta — e o último marco é
`tratamento = 0`. A guarda 8 de `projetar()` ("âncora zerada") intercepta antes de `n1Total`
chegar à tela. Isso não é regressão da 018: `contatado` e `orçamento` já eram apurados desde a
017, então a cadeia **já fechava inteira antes** desta spec — "12,5" citado no handoff
(`§4`) foi aritmética manual (`50000/4000`), não o que `projetar()` de fato devolvia.

`tratamento = 0` aqui é um zero MEDIDO, não um buraco — a `fonte` do marco já diz as duas coisas
(zero declarado pelo dono **e** checkout descontinuado, FR-026). "Âncora zerada" é a leitura
verdadeira de uma cadeia medida até o fim que termina em zero venda: não dá para dividir uma meta
de receita por um volume que é zero, e fingir que dá seria o mesmo defeito que esta spec existe
para fechar (número com cara de resultado, procedência apagada).

**Fora de escopo**: reapresentar o zero como "pipeline em risco" (`R$ 37.465 enviados · R$ 0
fechados · 2 ainda vivos`, handoff §5 "Estrutura") em vez de bloquear a projeção é redesenho da
UI/da leitura — explicitamente a **019** (FR-035, handoff §6).

**Alternativa rejeitada**: mudar `ancoraDe()` para pular um último marco zerado e usar o
penúltimo apurado como âncora. Reescreveria uma regra de `lib/projecao.mjs` que a FR-034 desta
spec proíbe tocar, e mudaria o comportamento para os OUTROS perfis/projetos que dependem da mesma
função — risco maior que o benefício de uma spec de correção.

## Fatos do código que mudaram a leitura da spec

Registrados porque são o que sobrevive à próxima spec:

1. **`lib/okr-coleta.ts` avalia a janela no import**, não por chamada. Qualquer teste de janela
   escrito antes de ver isso passaria por acidente (D1).
2. **`lib/arvore-metas.mjs` anexa impressões depois do primeiro marco, seja ele qual for** — a
   cadeia nova arma uma taxa entre cadeias que a ficha não pega (D6).
3. **`montarN4()` já detecta cadeia sem `visitante`** e marca `semElo` — metade da FR-007 já está
   implementada desde a 013 e ninguém sabia (D5).
4. **`combinar()` rebaixa para `declarado` só quando algum insumo é declarado** — com o ticket
   apurado entrando, o N1 vira `apurado` sem uma linha nova (D4).
5. **`test/benchmark.test.mjs` já percorre `PERFIS` nos dois sentidos** — a régua órfã reprova
   sozinha assim que o marco sair (D9).
