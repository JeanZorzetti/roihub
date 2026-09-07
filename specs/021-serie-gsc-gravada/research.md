# Research: Série do GSC gravada e os sete KPIs de busca

**Feature**: `021-serie-gsc-gravada` | **Date**: 2026-09-07

Cada decisão abaixo foi tomada contra o código que já está no repo, não contra o ideal.

---

## D1 — Qual chamada traz `query` + `page`

**Decisão**: exportar `queryPageWindow` de `lib/gsc.ts` e chamá-la **uma vez** com a janela de
`descoberta()`.

**Por quê**: `gscQueryPages` (`lib/gsc.ts:180`) já existe e faz quase isso, mas com dois
problemas para este uso:

1. A janela é **hardcoded**: `isoDaysAgo(31)` → `isoDaysAgo(3)`, enquanto `descoberta()`
   (`lib/janelas.mjs`) é `diasAtras(30)` → `diasAtras(3)`. **Um dia de diferença.** Os cliques e
   impressões que a aba já mostra vêm da janela de descoberta; a lista de consultas viria de uma
   janela um dia mais larga. Números da mesma tela em janelas diferentes é a falha que a 019 já
   pagou (`janela D-0 nunca cabe em fonte D-3`), e ela não aparece em teste — aparece como um
   total que não fecha com a soma das partes.
2. Ela faz uma **segunda** chamada (`isoDaysAgo(59)` → `isoDaysAgo(32)`) e mescla as duas por
   `mergeGscWindows`, porque o autopublishing precisa comparar janelas. Nenhum dos sete KPIs
   desta spec olha para a janela anterior. Seria o dobro de rede para descartar metade.

**Alternativas rejeitadas**:

- *Chamar `gscQueryPages` como está.* Zero código novo, mas herda a divergência de um dia e
  gasta uma chamada a mais por projeto.
- *Duplicar a chamada dentro de `okr-coleta.ts`.* Criaria uma terceira definição de janela no
  repo, exatamente o que `lib/janelas.mjs` foi criada para impedir (FR-001 da 018).
- *Mudar a janela de `gscQueryPages` para `descoberta()`.* Ela serve ao autopublishing, cuja
  comparação de duas janelas depende do recorte atual. Mexer ali arrasta risco para o robô
  editorial por conveniência desta aba.

---

## D2 — Onde a corrida diária vive

**Decisão**: rota nova `/api/gsc-serie` + workflow próprio `serie-gsc.yml`, cron `17 8 * * *`
UTC (05:17 BRT).

**Por quê**: o padrão está pronto e provado em `estado-noturno.yml` — o Actions só dispara, o
trabalho é server-side, retry **só** em falha de conexão (7/28/35/52/56) e nunca em erro HTTP,
porque repetir um 500 re-executaria trabalho já cobrado. Copiar esse arquivo é mais barato do
que inventar.

O horário respeita o Princípio IV: fora de 23:30–01:00 BRT (estado noturno + autopublish) e
fora de 08:00–08:45 BRT (cron diário do autopublishing).

**Alternativas rejeitadas**:

- *Pendurar a coleta na corrida de `/api/estado`.* Seria zero rota nova e zero workflow novo —
  a opção mais preguiçosa. Rejeitada por duas razões concretas: (a) o Princípio IV declara a
  janela noturna intocável e avisa que mexer em `maxDuration` exige ajuste correspondente no
  proxy do EasyPanel, então a mudança não é local; (b) acoplaria a coleta ao card noturno — uma
  indisponibilidade do GSC passaria a poder derrubar o card, e o hub já é intermitentemente
  inacessível naquela janela.
- *Rodar pelo runner do Actions em vez do servidor.* O runner não tem
  `GOOGLE_SERVICE_ACCOUNT_JSON` nem `DATABASE_URL`, e colocá-los lá espalharia segredo por um
  segundo ambiente sem ganho nenhum.
- *Reaproveitar `scripts/serie-gsc.mjs`.* Ele imprime no console e não grava; não está em
  workflow nenhum. Continua sendo a ferramenta de diagnóstico de linha de comando que já é —
  esta feature não o altera. (Vale o registro: ele *parece* resolver o problema pelo nome, e não
  resolve. É o caso clássico de script que apura e nunca foi ligado.)

---

## D3 — O que a tabela guarda

**Decisão**: uma linha por `(projeto, dia)` com impressões, cliques, CTR e posição do site
inteiro. **Não** guardar `query` nem `page`.

**Por quê**: os KPIs de crescimento que o board pede — +10–20%/trimestre em consultas únicas,
5–10% MoM em impressões não-marca — precisam de série temporal. A granularidade de dia responde
todos eles. Guardar `query`+`page` diariamente seria dezenas de milhares de linhas por dia por
projeto para responder perguntas que esta spec não faz, e a decisão de guardar é fácil de tomar
depois; a de apagar, não.

**Consequência aceita e declarada**: "crescimento de consultas únicas" (KPI 1 do bloco
IMPRESSÕES) **não** fica calculável com esta tabela — ele precisa da contagem de `query` por
dia. Fica registrado como o primeiro candidato de uma segunda tabela, se e quando alguém quiser
o número. Não é omissão: é a escolha de não gravar 25 mil linhas/dia/projeto por antecipação.

---

## D4 — Idempotência e o dia que o GSC não fechou

**Decisão**: PK `(projeto, dia)` com `ON CONFLICT ... DO UPDATE`, exatamente o padrão de
`gravarEstado` (`lib/db.ts:755`), e a corrida sempre repede uma janela recente que **inclui** os
dias já gravados.

**Por quê**: os ~3 últimos dias do GSC saem baixos porque não foram fechados, não porque
caíram — o comentário de `scripts/serie-gsc.mjs` registra o caso medido no atma (30/07 = 30
impressões, 31/07 = 827). Se a gravação fosse *insert-only*, o valor provisório de D-1 ficaria
gravado para sempre e toda série teria uma cratera falsa nos últimos dias. Regravar é o
comportamento correto, não uma tolerância.

**Alternativa rejeitada**: *só gravar dias já fechados (≤ D-3).* Mais simples, mas deixa a série
permanentemente 3 dias atrasada e não protege contra o GSC revisar um dia mais antigo — o que
ele faz.

---

## D5 — O backfill inicial

**Decisão**: a corrida pede a janela longa quando o projeto ainda não tem linha na tabela, e a
janela curta quando já tem.

**Por quê**: sem backfill, o histórico nasce vazio e os KPIs de crescimento levariam um trimestre
para dizer qualquer coisa — quando o GSC já guarda 16 meses que estão ali de graça. Com backfill,
boa parte do que o board pede fica calculável perto do merge, e não meses depois.

---

## D6 — O que a tela precisa dizer sobre a própria medida

**Decisão**: três rótulos obrigatórios na aba, tratados como requisito e não como enfeite:

1. A contagem de consultas únicas é um **piso** — a dimensão `query` omite as raras
   (`lib/gsc-consulta.mjs:23` registra 5 contra 33 medidos no tapepro).
2. "Sem propriedade no GSC" é **ausência estrutural**, não tráfego zero. `okr-coleta.ts` já faz
   essa distinção entre `null` e `{erro}`; a aba herda a mesma regra.
3. Resultado truncado no teto de 25 000 linhas é **truncamento**, não fim dos dados.

**Por quê**: o histórico deste projeto tem várias medições que mentiram por falta exatamente
desse rótulo — `zero na janela ≠ zero no mundo`, `GEO-01 mede a palavra`, `status 0 ≠ degrau não
aconteceu`. O número sem a ressalva é pior do que número nenhum, porque parece confiável.
