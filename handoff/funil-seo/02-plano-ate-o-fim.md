# Plano até o fim — o que falta, em ordem, com critério de pronto

**Aberto 01/09/2026.** Leia `00-LEIA-PRIMEIRO.md` antes. Marque o passo aqui quando fechar.

## O que fecha este subprojeto

> Existe uma OKR de receita cujos números vêm de medição, e não de benchmark de terceiro.

Só isso. Ele NÃO fecha com dashboard bonito, com os 35 instrumentados, nem com o N4 medido. Fecha
quando `scripts/funil.mjs` produzir uma cadeia apurada de ponta a ponta em **pelo menos um** projeto
e essa cadeia der um número que se possa perseguir.

E fecha **negativamente** também, o que é um desfecho legítimo: se P1 e P3 provarem que não há
demanda nem conversão a medir, o subprojeto encerra com "a OKR de receita não é escrevível ainda" e
entrega o bastão para a frente de COBRANÇA (KR1). Isso é resultado, não fracasso — é a diferença
entre não saber e saber que não dá.

---

## P1 — Instrumentar lead nos 3 que têm tráfego · **1/3 FECHADO, 2/3 esperando env**

> **Fechado em 01/09/2026 para a `atma`**, e não como este passo previa: ela já capturava lead
> havia dois meses no próprio banco (`patient_leads`, 43 reais). Não foi preciso instrumentar
> nada — o hub passou a LER a fonte (`FONTES_PROPRIAS` em `scripts/funil.mjs`). Resultado:
> **535 → 39 (7,29%) → 0**. A `atma` é o primeiro e único projeto com cadeia apurada.
>
> `sirius` e `estetiacrm` são o caso que este passo descrevia: os formulários dos dois
> (`/api/contact` e `/api/leads/capture-calculator`, mesmo código, um é fork do outro) só
> disparavam e-mail e criavam contato no Resend. O `POST /api/crm/leads` foi ligado nos dois
> (`lib/roihub-crm.ts`, best-effort em `after()`), as pipelines foram cadastradas, e **o que
> falta é uma coisa só: `ROIHUB_CRM_URL` e `ROIHUB_CRM_SECRET` nos dois serviços do EasyPanel.**
> Sem elas o formulário responde 200 igual e o lead não chega — falha silenciosa por desenho,
> e é por isso que a prova é a linha em `crm_leads`, nunca o 200.

### O texto original do passo, para contexto

`atma` (535 cliques/28d), `sirius` (56), `estetiacrm` (23). São os únicos do portfólio com tráfego
relevante e nenhum denominador. Sem isto, `CR(clique→lead)` continua existindo em **um** projeto.

- O caminho já existe: `POST /api/crm/leads` + `CRM_INGEST_SECRET`, e o `sofia-next` já manda
  (é de lá que vêm os 2 leads do `polarisia`). O buraco é o lado dos 3 sites.
- Cada um precisa de uma pipeline em `data/pipelines.json`. `atma` já tem; `sirius` e `estetiacrm`
  não têm — e o `parseLead` devolve 400 para pipeline desconhecida, então cadastrar vem primeiro.
- ⚠️ **`origem` é obrigatória e é ela que separa canal.** O padrão que os leads existentes usam é
  `<slug>:<superfície>` (`polaris:peca-seu-site`, `matchfios:industria`). Seguir, senão a leitura
  por canal nasce impossível.

**Pronto quando:** `scripts/funil.mjs` mostrar os 3 com a coluna `leads` **apurada** (não basta a
pipeline existir — o gate é ter recebido ≥1 lead de verdade, ver `00-`).

**⚠️ E não confunda lead com lead de teste.** Adicionado em 01/09: os 5 leads que o `crm_leads`
tinha na vida inteira eram os 5 nossos, e deles saía a única taxa do portfólio. `ehLeadDeTeste()`
agora os exclui e o `--ver` lista os contados nome a nome. Testar o encanamento é obrigatório —
mandar `metadata.teste: true` ao testar também.

**⚠️ Não confunda pronto com instrumentado:** o card pode dizer "instrumentado" e o funil continuar
`não apurado` porque nenhum lead chegou ainda. Os dois estados são diferentes e o segundo é o que
vale. Se depois de 28 dias com tráfego nenhum lead entrar, isso É o achado — e aí o gargalo é
oferta, não encanamento.

---

## P2 — Nível 0: DEMANDA, antes de qualquer conserto técnico · **PRÓXIMO**

> Com a `atma` medida, a pergunta que ela levanta é de demanda e de oferta, não de tráfego:
> **39 leads, 22 cancelados, 0 convertidos.** Mais clique multiplica um `CR(fecho)` que hoje é
> zero. Antes de perseguir volume em qualquer projeto, este passo decide se há mercado.

31 dos 35 param nos cliques, quase todos com **0**. `0 clique` é ambíguo entre duas causas que pedem
trabalho oposto:

- **SEO ruim** — existe gente buscando e o site não aparece → tem conserto.
- **Sem mercado** — ninguém busca → nenhum conserto de SEO move o número.

A pesquisa **não tem esse nível** (trata `Σ Vᵢ` como dado) e é o ponto cego que mais custa aqui:
o `aftercare` tem 28 artigos e 4 impressões em 90 dias.

A ferramenta já existe na casa: **OpenSEO Keyword Planner** (DataForSEO). Não precisa dos 35 — só
dos que têm alguma tese comercial.

**Pronto quando:** cada projeto que se pretende perseguir tiver volume de busca apurado do seu termo
central, e a lista estiver partida em "tem demanda / não tem demanda / não apurado".

**Por que ANTES do P3:** medir INP de um site cujo mercado não busca é otimizar um fator que está
sendo multiplicado por zero.

---

## P3 — Nível 4 (CWV + TTFB), e o gate para decidir se vale a pena

É o nível que a pesquisa chama de "os números ocultos". **A análise em `01-` conclui que aqui ele
não é o gargalo** — então este passo tem um portão antes:

> **Só execute o P3 se o P1 e o P2 mostrarem pelo menos um projeto com demanda real E tráfego
> chegando E conversão medível.** Sem isso, o P3 é trabalho bonito sobre um fator irrelevante.

Se o portão abrir, é barato:
- **CrUX API** para os domínios que importam: LCP/INP/CLS de usuário real, por origem, sem
  instrumentar nada nos sites. Uma chamada HTTP por projeto.
- **TTFB e status code**: o coletor `CONF` do estado noturno **já faz um request contra cada uma das
  35 URLs de produção**. Gravar `ttfb_ms` ali custa zero marginal.

**Pronto quando:** os projetos do portão tiverem LCP/INP/CLS e TTFB apurados, com a mesma disciplina
de célula (`não apurado` quando o CrUX não tem amostra — origem com pouco tráfego **não tem dados no
CrUX**, e isso é `não apurado`, nunca "está bom").

---

## P4 — `nivelDoGargalo` (N0…N5) como RELATÓRIO

O campo que responde "onde este projeto está travado", derivado do que P1–P3 apurarem. É a única
peça deste subprojeto que toca o ranking, e ela entra pelo caminho já escrito em `lib/score.mjs`
para a `receitaProvada`:

**relatório primeiro, peso depois, com a condição de entrada escrita NO CÓDIGO.**

- **NÃO adicione ao `computeScore` agora.** Qualquer número de funil hoje é nulo em 34 de 35, e
  campo quase todo nulo no score empurra 33 projetos para o mesmo lugar — a decisão já foi tomada
  uma vez, está comentada em `lib/score.mjs`, e não se retoma sem o número mudar.
- Condição sugerida para virar peso: **≥10 dos 35 com N1 apurável** (lead OU venda medida).

**Pronto quando:** o campo existir, for não-nulo para os 35, e a condição de promoção estiver escrita
no código — não na memória de quem leu.

---

## P5 — Escrever a OKR

Só depois do P1. Os key results são a **existência** das medições enquanto o funil não fecha:

- **KR1** — N projetos com caminho de cobrança provado por **POST real devolvendo `init_point`**.
  200 na página de preço **não conta** — o `atma` desmentiu esse balde duas vezes.
- **KR2** — N projetos com `CR(clique→lead)` apurado (o P1 entrega isto).
- **KR3** — primeiro R$ contado por `lib/vendas.mjs` com payer real.

Quando o KR2 der ≥1 projeto com taxa estável e o KR1 der ≥1 com cobrança viva, **aí** a OKR vira de
receita e os KRs viram valores em vez de contagens.

**Pronto quando:** a OKR estiver escrita com cada número apontando para o comando que o apura.

---

## Regras que valem em todo passo

1. **A primeira corrida mede o CHECK.** Já aconteceu neste subprojeto (o `6,67%` sem denominador).
   Lista nominal antes de percentual, sempre.
2. **Nunca escreva 0 onde a resposta é "não olhei".** É a regra que `lib/funil.mjs` existe para
   sustentar e a que este subprojeto inteiro está testando.
3. **Confira contra uma régua independente** antes de publicar número. O `atma` foi conferido em
   535 cliques por dois caminhos diferentes; foi isso que deu confiança na coluna inteira.
4. **Número novo aqui não vira meta no mesmo dia.** Uma amostra de 2 leads não é uma taxa.
5. **Ao fechar um passo:** marque neste arquivo, escreva o resultado em `00-LEIA-PRIMEIRO.md`
   (seção do estado) e rode `node --env-file=.env scripts/indexar.mjs` — sem reindexar, o que você
   escreveu some da `/busca` em silêncio. Precisa do Ollama de pé nesta máquina.
