# Template de OKR e KPIs — checklist para qualquer projeto

**Documento reaplicável. Não é sobre um projeto.** Copie a ficha do §6, preencha, ataque na ordem do §7.

Nasceu do subprojeto `funil-seo/`, que fez isso à mão para o portfólio inteiro e descobriu que
34 de 35 projetos não tinham como responder "quanto vale um cliente a mais". O que aquele
subprojeto aprendeu na marra está aqui como regra, sem a parte de SEO.

---

## 1. A regra que faz tudo funcionar

> **Uma KPI só é filha de outra se entrar na CONTA que produz a mãe.**

Não é tema, não é "área relacionada", não é seção de dashboard. É aritmética. Se você não
consegue escrever a linha `mãe = filha × filha × filha`, você não tem uma árvore — tem uma lista.

**O teste de filiação, em uma pergunta:**

> Se esta KPI dobrar e mais nada mudar, a mãe se move? Quanto?

- **Move, e eu sei quanto** → é filha. Entra na árvore.
- **Move, mas não sei quanto** → é filha *suspeita*. Entra marcada como `elo não fechado`.
- **Não move / não sei se move** → **não é KPI deste projeto.** É curiosidade. Fica fora.

Isso derruba de cara a maioria das métricas que aparecem em dashboard: impressão, seguidor,
pageview, tempo na página, número de commits, tarefas fechadas. Todas *podem* virar filhas
legítimas — mas só depois que você escreve a conta que liga cada uma ao dinheiro.

**Corolário caro:** dinheiro é uma **multiplicação**, e multiplicação com um fator zerado dá
zero. Você pode medir performance, indexação e uptime com perfeição absoluta e a OKR ainda
resolver para R$ 0, porque a taxa de fecho é `0`. **Não existe número escondido que conserte um
fator zerado.** Procure o fator zerado ANTES de otimizar qualquer coisa.

---

## 2. OKR e KPI não são a mesma coisa

| | é | tem | quantos |
|---|---|---|---|
| **Objetivo (O)** | frase qualitativa, sem número, que diz o que muda no mundo | direção | **1** por projeto/trimestre |
| **Key Result (KR)** | um movimento: `de X para Y até <data>` | baseline, meta, prazo | **2 a 3**, nunca mais |
| **KPI** | o medidor: o número em si, sempre vivo | valor ou motivo de ausência | quantas a árvore tiver |

**Um KR é uma KPI + baseline + meta + prazo.** Se você não tem baseline, você não tem KR —
tem desejo. E o KR só é legítimo se a árvore mostrar que mexer nele move a KPI primária.

- ❌ `O: Ser referência em X` + `KR: aumentar o tráfego` → sem número, sem baseline, sem elo com dinheiro.
- ✅ `O: Provar que o canal orgânico paga o produto` + `KR: CR(visitante→lead) de "não apurado" para ≥2% apurado, até 30/11`.

**Regra do baseline:** KR cujo baseline é `não apurado` tem um único primeiro passo válido —
**apurar**. A meta numérica vem depois de existir o primeiro número. Chutar a meta antes do
baseline é como se fabrica uma OKR que ninguém consegue avaliar no fim do trimestre.

---

## 3. A árvore — N0 a N6

Cada nível responde uma pergunta diferente. Desça um nível só quando o de cima tiver valor ou
motivo. **Descer sem fechar o de cima é o erro mais comum e mais caro.**

```
N0  OBJETIVO ................ o que muda no mundo?              (frase, sem número)
     │
N1  KPI PRIMÁRIA ............ quanto isso vale em R$?           (1 métrica, dinheiro)
     │   = produto dos fatores abaixo
N2  KPI SECUNDÁRIAS ......... de que fatores o dinheiro é feito?  (2-4, muda por perfil)
     │   cada fator se abre em uma cadeia de etapas
N3  KPI TERCIÁRIAS .......... quanto se perde em cada etapa?      (taxas de conversão)
     │   cada taxa tem denominador que vem de cima
N4  KPI QUATERNÁRIAS ........ o que alimenta o topo?              (volume, leading)
     │   cada volume tem uma causa mecânica
N5  KPI QUINÁRIAS ........... por que o volume é esse?            (diagnóstico)
     │
N6  EXECUÇÃO ................ o que eu faço segunda-feira?        (ação, dono, prazo)
```

### N0 — Objetivo
- [ ] Uma frase. Sem número. Sem "melhorar", sem "otimizar", sem "ser referência".
- [ ] Passa no teste do contrário: alguém razoável poderia querer o oposto? Se não, é banalidade.
- **Pronto quando:** cabe em uma linha e você consegue dizer o que fica FALSO se ele for atingido.

### N1 — KPI primária (a métrica de dinheiro)
- [ ] **Uma só.** Duas primárias = nenhuma primária.
- [ ] É dinheiro, ou vira dinheiro por uma multiplicação de um passo.
- [ ] Tem janela declarada (mês, trimestre, 12 meses corridos) e a mesma janela vale para a árvore toda.
- [ ] Tem estado: `{valor}` ou `{não apurado: motivo}`. **Nunca `0` por preguiça** — ver R1.
- **Pronto quando:** você aponta a fonte (tabela, extrato, painel) de onde ela é lida hoje.

### N2 — KPI secundárias (os fatores da receita)
- [ ] Escreva a conta explícita: `N1 = f1 × f2 × f3`.
- [ ] **A conta fecha?** Multiplique os valores reais e compare com N1. Se não bate, falta um fator — ache antes de seguir.
- [ ] Cada fator tem dono do dado (quem sabe onde ele mora).
- [ ] Marque qual fator está **ZERADO** e qual está **não apurado**. São problemas opostos.
- **Pronto quando:** a multiplicação reproduz N1 dentro de ~10%, ou você sabe nomear o que falta.

### N3 — KPI terciárias (as taxas da cadeia)
- [ ] Cada fator de N2 vira uma cadeia: `entrada → etapa → etapa → saída`.
- [ ] Toda taxa sai **com a fração colada**: `7,29% (39/535)`. Percentual solto é proibido — ver R2.
- [ ] O denominador de uma etapa é o numerador da anterior. Se não for, a cadeia tem furo.
- [ ] Etapa sem numerador instrumentado é `não apurado`, **não é 0**.
- **Pronto quando:** existe pelo menos UMA cadeia que vai da entrada ao dinheiro sem `não apurado` no meio.

### N4 — KPI quaternárias (volume / leading)
- [ ] O que entra no topo, **por canal, separado**: orgânico, direto, pago, indicação, outbound, social.
- [ ] Volume é o **denominador** de N3. Canal que não aparece em denominador nenhum não está sendo medido — está sendo torcido.
- [ ] Volume sem cadeia abaixo dele é vaidade. Marque `sem elo` em vez de comemorar.
- **Pronto quando:** a soma dos canais bate com a entrada total da cadeia de N3.

### N5 — KPI quinárias (diagnóstico: por que o número é esse)

Quatro famílias. **Só desça na família do gargalo** que N2/N3 apontaram.

| família | pergunta | exemplos de medidor |
|---|---|---|
| **D1 Descoberta** | o canal te encontra? | páginas indexadas / publicadas, posição média com corte por país, cobertura, alcance, citação por IA |
| **D2 Entrega** | a página chega inteira? | LCP, INP, CLS, TTFB, uptime, taxa de 5xx, build quebrado, certificado válido |
| **D3 Persuasão** | ela convence? | scroll até a oferta, cliques no CTA / visitantes, abandono por campo do formulário, saída do checkout |
| **D4 Encanamento** | **o evento chega ao banco?** | lead gravado / lead enviado, webhook 2xx, gateway ligado de verdade, e-mail entregue |

> **D4 antes das outras três.** É a família que mais destrói OKR e a que menos aparece em
> dashboard, porque falha em silêncio: tudo responde 200 e nada é gravado. Um `não apurado` em
> N3 é quase sempre D4, não D1.

- **Pronto quando:** cada `não apurado` de N3 está atribuído a uma das quatro famílias.

### N6 — Execução
- [ ] Toda ação tem **dono nominal** e prazo. Sem dono não é ação — é observação.
- [ ] A ação cita QUAL célula da árvore ela move. Ação que não move célula não entra no plano.
- [ ] Ação que fecha um `não apurado` vale mais que ação que melhora um número já apurado — ver §7.
- **Pronto quando:** dá para conferir por um comando ou uma URL, não por opinião.

---

## 4. Os 4 perfis — N1 a N3 instanciados

A espinha (§3) e as regras (§5) são iguais para todos. **Só o miolo muda.** Escolha o perfil,
copie o bloco, ajuste os nomes.

### Perfil A — SaaS / assinatura
*Polaris, Compass, Context Keeper, Vértice, Meridian, Sirius*

```
N1  MRR   (ou ARR = MRR × 12)

N2  MRR = Clientes pagantes × ARPA × (1 − churn de receita)

N3  Clientes pagantes:
      visitante → signup .................. CR1  __% (__/__)
      signup → ativado .................... CR2  __% (__/__)   "ativado" precisa de definição ESCRITA
      ativado → trial pago ................ CR3  __% (__/__)
      trial → primeira cobrança APROVADA .. CR4  __% (__/__)   ← o fator que mais zera
    ARPA  = receita do período / clientes pagantes
    Churn = receita cancelada no mês / receita no início do mês

N4  visitantes por canal · signups por canal · trials abertos · convites aceitos

N5  D4 primeiro: o gateway está ligado? existe UMA cobrança aprovada de TERCEIRO?
```

> ⚠️ **Trial expirado que continua com `plan: 'pro'` no banco não é cliente.** Conte só quem tem
> cobrança aprovada de terceiro. `plan` é intenção; extrato é fato.

### Perfil B — E-commerce
*goiania (cadeiras) e qualquer loja*

```
N1  Receita líquida  (bruta − cancelado − estornado − frete subsidiado)

N2  Receita = Sessões × CR(sessão→pedido) × AOV × (1 − devolução)

N3  visitante → viu produto ................ __% (__/__)
    produto → carrinho ..................... __% (__/__)
    carrinho → checkout iniciado ........... __% (__/__)
    checkout → pagamento APROVADO E LIQUIDADO  __% (__/__)   ← ver aviso
    AOV = receita / pedidos    ·    itens por pedido × preço médio

N4  sessões por canal · impressões de produto · itens em estoque disponíveis

N5  D2 e D3 pesam mais aqui: LCP e abandono de checkout são os dois vazamentos clássicos
```

> ⚠️ **`approved` no gateway não é venda.** Aprovação em conta de teste, ou com você mesmo como
> pagador, aprova igual. Só o **pagador distinto** separa venda de teste — confira
> nome/e-mail/documento antes de contar.

### Perfil C — Serviço / agência / projeto
*ROI Labs, Estética Fábrica, growth partner, consultoria*

```
N1  Receita contratada no período   (+ recorrente, se houver success fee)

N2  Receita = Propostas enviadas × Taxa de fecho × Ticket médio × (1 + expansão)

N3  contato → conversa qualificada ......... __% (__/__)
    conversa → proposta enviada ............ __% (__/__)
    proposta → contrato ASSINADO ........... __% (__/__)
    contrato → primeiro pagamento RECEBIDO . __% (__/__)   ← fecho ≠ caixa
    Ticket = valor médio do contrato   ·   Expansão = success fee / receita base

N4  leads por origem (indicação, orgânico, outbound, evento) · conversas abertas

N5  D3 e D4: o formulário grava? o lead chega em alguém? quanto tempo até a 1ª resposta?
```

> ⚠️ **Contrato assinado não é receita.** Se a KPI primária é caixa, a última etapa é *pagamento
> recebido*. Se é receita contratada, declare isso no N1 — e não misture as duas no mesmo trimestre.

### Perfil D — Clínica / agendamento / lead de alto valor
*Atma, AftercareGen, e qualquer negócio local com procedimento*

```
N1  Receita de tratamentos iniciados no período

N2  Receita = Leads × CR(lead→consulta) × CR(consulta→tratamento) × Valor médio do tratamento

N3  visitante → lead (form / WhatsApp) ..... __% (__/__)
    lead → contato feito ................... __% (__/__)
    contato → consulta AGENDADA ............ __% (__/__)
    consulta agendada → COMPARECEU ......... __% (__/__)   no-show é etapa própria, não ruído
    compareceu → tratamento INICIADO ....... __% (__/__)

N4  visitantes por canal · ligações · mensagens no WhatsApp · vagas na agenda

N5  D4 primeiro: o lead do WhatsApp entra em alguma tabela? o no-show é registrado?
```

> ⚠️ **Pipeline trabalhado que fecha zero é um número, não um erro.** `22 cancelado, 14 contatado,
> 7 pré-orçamento, 0 convertido` diz "a oferta não fecha". É diferente de `0` por ninguém ter
> olhado — e as duas leituras pedem trabalho oposto.

---

## 5. As 8 regras de apuração — o que separa número de invenção

Estas regras são o que impede a árvore de virar ficção. **Nenhuma é opcional.**

**R1 · `0` e `não apurado` são coisas diferentes.**
Toda célula é `{valor}` ou `{não apurado: motivo}`. Somar "0 vendas" de um projeto sem
instrumentação com "0 vendas" de um instrumentado fabrica uma taxa com cara de apurada.
`0` significa *medi e deu zero*. Se você não mediu, escreva o motivo no lugar do número.

**R2 · Denominador DENTRO do texto, nunca ao lado.**
`7,29% (39/535)` — sempre. `6,67%` sozinho parece elite e são 2 leads em 30 cliques. Aviso ao
lado perde para o percentual em qualquer leitura rápida; fração colada não tem como perder.

**R3 · `0/0` não é 0%. Numerador maior que denominador não é taxa acima de 100%.**
Os dois viram `não apurado`. Numerador maior significa que a entrada veio de um canal que você
não está medindo — isso é uma descoberta, não um arredondamento.

**R4 · Procure o dado onde ele JÁ cai, antes de instrumentar.**
Instrumentar cedo demais cria uma cópia PIOR da tabela que já existe: sem histórico, contando
só de hoje em diante. **Ordem da caçada, sempre nesta sequência:**

1. tabela do próprio projeto — o app já grava? (`\dt` no banco dele)
2. gateway de pagamento — o **extrato**, não o painel de "aprovados"
3. CRM, planilha ou Trello de quem atende
4. e-mail transacional (Resend, Brevo) e a caixa de entrada
5. GA4 / Search Console / painel do canal
6. o WhatsApp e a cabeça do dono — sim, isso conta como fonte
7. **só então** escreva encanamento novo

**R5 · Dado de teste seu fabrica taxa.**
Um `curl` seu fecha a cadeia inteira e a OKR passa a existir sobre nada. Filtre por nome, por
e-mail e por domínio da casa — e **confira nome a nome** antes de citar qualquer taxa. A
heurística é o piso; a lista nominal é a garantia.

**R6 · Benchmark é ontologia, nunca previsão.**
Tabela de mercado serve para saber QUAIS etapas existem, não que número você vai fazer.
Empilhar o percentil de elite em todas as etapas produz projeções dezenas de vezes acima da
média — o mesmo tráfego vira 5 ou 300 clientes. **Nunca cite benchmark como meta de KR.**

**R7 · Uma janela só, declarada, para a árvore inteira.**
Numerador de agosto sobre denominador de 90 dias é uma taxa inventada. Se as fontes têm janelas
diferentes, corte todas na menor e diga qual é.

**R8 · Toda célula tem fonte citável.**
Nome da tabela, do painel ou do comando. Célula sem fonte é lembrança — e lembrança apodrece em
silêncio. Se você não consegue reproduzir o número amanhã, ele não está apurado hoje.

---

## 6. Ficha do projeto — copiar, colar, preencher

```markdown
# OKR <projeto> · <trimestre> · janela <dd/mm → dd/mm>
Perfil: [ ] A SaaS   [ ] B E-commerce   [ ] C Serviço   [ ] D Clínica/lead

## N0 Objetivo
<uma frase, sem número>

## N1 KPI primária
<métrica>: <valor>  |  não apurado: <motivo>
Fonte: <tabela / painel / comando>

## N2 Fatores — a conta
N1 = f1 × f2 × f3

| fator | valor | fonte | estado |
|---|---|---|---|
| f1 |  |  | apurado / não apurado / ZERADO |
| f2 |  |  |  |
| f3 |  |  |  |

A conta fecha?  [ ] sim   [ ] não → o que falta: __________

## N3 Cadeia — taxas com fração colada
entrada → e1 : __% (__/__)   fonte:
e1 → e2      : __% (__/__)   fonte:
e2 → e3      : __% (__/__)   fonte:
e3 → R$      : __% (__/__)   fonte:

Cadeia completa, sem `não apurado` no meio?  [ ] sim   [ ] não

## N4 Volume por canal
| canal | entrada | % do total | tem cadeia abaixo? |
|---|---|---|---|

## N5 Diagnóstico — só da família do gargalo
Gargalo apontado por N2/N3: __________
Família: [ ] D1 Descoberta  [ ] D2 Entrega  [ ] D3 Persuasão  [ ] D4 Encanamento
Medidores:

## Key Results — máx. 3, um por fator atacado
KR1: <KPI> de <baseline> para <meta> até <data> · dono: ______
KR2:
KR3:

## N6 Ações
| ação | célula que move | dono | prazo | como conferir |
|---|---|---|---|---|
```

---

## 7. Ordem de ataque — em que ordem mexer

Com a ficha preenchida, o que fazer é **determinado**, não opinião:

1. **Existe fator ZERADO em N2?** → só ele importa. Todo o resto é otimizar um zero.
2. **Existe `não apurado` em N3 por falta de encanamento (D4)?** → apurar vem antes de melhorar.
   Você não sabe o tamanho do problema; pode ser que já esteja bom.
3. **A cadeia fecha inteira em pelo menos um caminho?** → agora sim: ataque a **menor taxa** da
   cadeia. É multiplicação — dobrar 2% rende mais que dobrar 40%.
4. **Todas as taxas razoáveis e o dinheiro ainda pequeno?** → o gargalo é N4 (volume) ou o ticket.
5. **Só então N5.** Performance, indexação e microcopy movem números que já existem.

> **A pergunta que economiza um trimestre inteiro:** *este projeto tem demanda?*
> Taxa boa com volume nenhum e volume bom com taxa nenhuma são **doenças opostas**. A primeira
> não se conserta com landing melhor; a segunda não se conserta com mais tráfego. A árvore
> separa as duas — é para isso que ela serve.

---

## 8. Armadilhas já pagas — não pise de novo

- **Um site que responde 200 não prova nada.** Nem que está indexado, nem que grava lead, nem que
  o produto por trás existe. Autentique e leia o CORPO.
- **`não apurado` na conversão não quer dizer "o site não captura".** Quer dizer, no máximo, "o
  lugar onde eu olhei não tem". Ver R4.
- **Pipeline com zero evento na história inteira é `não apurado`, nunca 0.** Não separa "o site não
  manda" de "manda e ninguém converteu" — e as duas pedem trabalho oposto.
- **A primeira corrida de um relatório mede o RELATÓRIO, não o negócio.** Trate o primeiro número
  como suspeito até conferir uma linha à mão.
- **Duas leituras que "batem" podem estar erradas juntas**, se saírem do mesmo código com o mesmo
  defeito. Concordância não é verificação; fonte independente é.
- **Rótulo de exibição nunca é chave.** Casar projeto por nome (em vez de URL ou id) casa a linha
  errada em silêncio e contamina a árvore inteira.
- **Cuidado com a métrica que some quando melhora.** Se o painel remove o item quando ele fica bom,
  você perde a série e não consegue mais provar que melhorou.
- **Ação sem dono não é ação.** E reescrever o texto de uma ação costuma ZERAR o dono no banco —
  confira depois de editar.

---

## 9. De onde isso veio

| | |
|---|---|
| O caso que gerou o template | `handoff/funil-seo/` — comece por `00-LEIA-PRIMEIRO.md` |
| A leitura crítica do benchmark (por que R6 existe) | `handoff/funil-seo/01-a-leitura-da-pesquisa.md` |
| Implementação de referência de R1-R3 | `lib/funil.mjs` — célula, razão, `ehLeadDeTeste` |
| Coleta multi-projeto | `scripts/funil.mjs` — `--ver` lista os nomes por trás de cada taxa |

**Único exemplo de cadeia apurada até hoje no portfólio** (`atma`, janela 01/08→29/08/2026).
Está aqui como ilustração do **formato**, não como meta de ninguém:

```
535 cliques  →  39 leads  →  0 vendas
              7,29% (39/535)     0 de 39
```

Perfil D, com o fator zerado em `CR(consulta→tratamento)`. Pela §7 item 1: nada em performance,
indexação ou copy muda esse resultado enquanto o último fator for zero.
