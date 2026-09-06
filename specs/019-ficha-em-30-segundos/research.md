# Fase 0 — Research: as 9 decisões da 019

Cada decisão nasceu de leitura do código no ar (build `64bb0a7`, 06/09/2026), não de preferência.
O que não foi lido está marcado como **a confirmar**, com o comando que confirma.

---

## D1 — A lista de buracos já existe: ela está escondida dentro de `posicaoDeAtaque()`

**Decisão**: extrair `lib/okr.mjs:451` para um export `buracosDeVerdade(marcos)` e fazer
`posicaoDeAtaque()` chamá-lo. A dobra usa a **mesma** função.

**Por quê**: a linha já é exatamente o que a FR-004 pede —
`marcos.filter(m => !ehApurado(m.celula) && m.celula?.rotuloBuraco !== "tela-nao-le")`. Escrever
uma segunda seria criar a segunda régua de "pior" que a FR-002 proíbe, uma casa adiante.

**Alternativas rejeitadas**:

- *Usar `ehBuracoDeVerdade()` de `lib/ficha.mjs`.* Ela testa `c.estado === "nao-apurado"` —
  assinatura de `CelulaFicha`. Os marcos carregam `Celula` de `lib/funil.mjs`
  (`{valor} | {naoApurado}`), que não tem `estado`. As duas convivem de propósito; forçar uma a
  servir a outra é o tipo de unificação que quebra em silêncio.
- *Montar a lista na tela.* Regra testável em `.tsx` é regressão pelo Princípio III.

**Consequência**: `falhou-agora` sai marcado como transitório pela própria célula
(`m.celula.rotuloBuraco === "falhou-agora"`) — a tela não precisa de heurística (US2-AC4).

---

## D2 — A guarda 8 não some: ela muda de alcance

**Decisão**: em `projetar()`, mover a guarda de âncora zerada para **depois** do cálculo de
`n1Total`/`n1Janela`/`normalizacao`, e devolver os campos que dependem da cadeia (`fatorObrigatorio`,
`multiploNecessario`, `folga`, `multiploDeVolume`, `degrausAMedir`) como `não apurado` com o motivo
`âncora zerada — meta não se divide por volume nenhum`. `veredito` continua `"nao-apurado"`.

**Por quê**: `n1Total = meta.valor / meta.ticket` **não lê a âncora**. As guardas 1–7 continuam
devolvendo `naoApuradaCompleta()` inteira, porque cada uma nomeia um fator que falta na própria
divisão da meta (sem perfil, sem meta, sem valor, sem ticket, prazo inválido, prazo vencido, sem
âncora nenhuma). A guarda 8 é a única que fala **da cadeia**, e é a única que se parte.

**Alternativas rejeitadas**:

- *Corrigir na tela da atma.* `app/okr/page.tsx:131` renderiza `<Projecao>` para os 17 — o
  portfólio ficaria calado pelo mesmo motivo (FR-008a).
- *Remover a guarda.* `fatorObrigatorio`/`multiploNecessario` dividem **por** `ancora.valor`;
  sem guarda vira divisão por zero e a R6/spec 010 proíbe a projeção pra trás sem volume.

**Ordem final das guardas**: 1–7 iguais → cálculo de `n1Total`, `n1Janela`, `normalizacao` →
guarda 8 (retorno parcial) → ramos de taxa/múltiplo.

---

## D3 — `<Projecao>` hoje aborta no primeiro `if`

**Decisão**: `app/okr/projecao.tsx` deixa de fazer `return` cedo em
`p.veredito === "nao-apurado"`. Passa a renderizar em duas partes: **o que a meta exige** (linha de
`n1Total`/`n1Janela`, sempre que apurados) e **por que a cadeia não a distribui** (`p.motivo`).

**Por quê**: a FR-012 pede os dois lados juntos. Hoje o componente joga fora `n1Total` antes de
olhar para ele. Sem essa mudança, a FR-008 sai em `lib/` e não chega à tela.

**Consequência declarada** (FR-008a): todo projeto de cadeia zerada muda o texto em `/okr`. O
ranking não muda — `posicaoDeAtaque()` lê só `ficha` (verificado em `lib/okr.mjs:435-470`).

---

## D4 — Ligar orçamento a `motivo` exige uma coluna que a query nunca pediu

**Decisão**: o SELECT de `patient_leads` (`lib/okr-coleta.ts:55`) ganha `id`. Sem ele, a chave
estrangeira `orcamentos.paciente_lead_id` não tem contraparte e "vivo" é indecidível.

**Por quê**: hoje a query é `SELECT nome, email, status, motivo, to_char(created_at…)`. Os
orçamentos já vêm com `paciente_lead_id` (`lib/okr-coleta.ts:63`), mas não há do outro lado a que
ligar. É o mesmo padrão da 018 (`preco`/`desconto_vista` sempre existiram, a query nunca os pediu).

**A confirmar antes de escrever tela** — primeira tarefa da US3:

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'patient_leads' ORDER BY ordinal_position;
```

Se a PK não se chamar `id`, o nome real entra aqui e no contrato — **nunca** se assume. Precedente:
`tela_nao_le_nao_e_buraco_de_medicao` (quatro design-reviews falharam por não abrir o
`information_schema` antes).

---

## D5 — "Vivo" é taxonomia do cliente, e mora no card

**Decisão**: `Project` ganha `motivosDePerda?: string[]`. Para a `atma`:
`["sem_resposta", "sem_interesse", "perdido_concorrencia", "preco_alto"]`. `lib/okr.mjs` recebe a
lista como **parâmetro**; nenhuma constante de motivo entra em `lib/`.

**Por quê**: FR-015 é explícita, e a 017 já pagou esse preço uma vez — a palitagem é do cliente,
não do template. Projeto sem a lista declarada exibe `enviados` e **omite** vivos/perdidos,
nomeando o que falta (FR-015b): assumir a taxonomia da Atma para o `aftercare` inventaria dado.

**Rejeitado**: default `[]` (silencioso — vira "todo mundo vivo") e default com a lista da Atma
(vira taxonomia herdada de graça, o defeito que a 017 matou).

---

## D6 — "Fechado" vem do degrau `tratamento`, nunca de `orcamentos.status`

**Decisão**: `valorEmRisco()` **não lê `status`**. `fechados` = valor derivado do marco
`tratamento` da cadeia.

**Por quê**: medido em 06/09/2026 — 9 de 9 linhas em `enviado`, em cinco semanas de produção. Uma
coluna que só conheceu um valor não separa nada; derivar dela produziria um zero com cara de
apurado (FR-013a). Mesmo achado que matou o marco `orçamento ACEITO` na 017.

---

## D7 — As janelas longas entram por parâmetro, não por novo default

**Decisão**:

- `lib/janelas.mjs` ganha `descobertaLonga(agora)` (8 meses fechando em D-3) e
  `comportamentoLongo(agora)` (12 meses fechando em D-3). Módulo continua **puro**.
- `gscSeries(siteUrl, inicio = isoDaysAgo(86), fim = isoDaysAgo(3))` — parâmetros **opcionais**,
  default byte a byte o de hoje (`lib/gsc.ts:232`, FR-025).
- `ga4Canais(propertyId, janela)` **já** recebe janela (`lib/ga4.ts:30`): nada a mudar.

**Por quê**: um segundo `gscSerieLonga()` duplicaria autenticação, `resolveProperty` e tratamento
de erro para trocar duas datas. O default intocado é o que protege os 17 projetos (FR-024, SC-007).

---

## D8 — Truncamento (FR-027): o GSC se autodeclara; o GA4 precisa de uma sonda

**Decisão**:

- **GSC**: a janela real sai da própria série — `days[0].date` e `days.at(-1).date`. Zero chamada
  extra.
- **GA4**: `ga4Cobertura(propertyId, janela)` nova — um relatório com dimensão `date` e métrica
  `sessions`, do qual se toma o menor e o maior dia com dado. Uma chamada a mais numa página de
  relógio trimestral servida por ISR de 1 h.

**Por quê**: a Data API não devolve a data de criação da propriedade nem a retenção configurada.
Sem sonda, rotular "12 meses" um dado de 3 é a mentira que a FR-027 proíbe — e não há como
detectá-la a partir de `ga4Canais()`, que agrega por canal e descarta a data.

**Rejeitado**: acrescentar `date` às dimensões de `ga4Canais()` — mudaria a forma do retorno para
todos os consumidores atuais, para servir um só (mesmo argumento que a 016 usou em `gscPaginas`).

---

## D9 — A costura da época não custa uma chamada: a série de 84 dias já a contém

**Decisão**: a guarda de `lib/arvore-metas.mjs:176` (`marcos[0]?.chave === "visitante"`) é
substituída por **coincidência de janela**: a camada de impressões só entra quando a janela do
`ctr` **contém** a janela de Conversão (FR-031). O `ctr` passa a carregar a janela que o produziu.

**Por quê**: nome de marco não prova que as janelas batem — foi a trava certa na 018 porque era a
única disponível. A época da atma (2026-07-31 → hoje, 37 dias) cabe inteira dentro dos **84 dias**
que `gscSeries()` já busca; basta fatiar a série pelo intervalo da época para ter impressões e
cliques na janela certa, sem rede nova.

**Quando para** (FR-033): se a série começar **depois** do início da época, a árvore **para e
nomeia** o que faltou. Nunca compõe períodos diferentes (018/FR-007 continua íntegra). É o caso que
aparece sozinho quando a época passar de 84 dias — em 2026-10-23, para a atma. **O teste desse
caso é obrigatório**: ele é a bomba-relógio desta decisão.

**Rejeitado**: buscar o GSC numa janela própria da época. Duas chamadas para o mesmo dado, e a
segunda podendo divergir da primeira por quota ou por atraso do GSC.
