# 019 — linha de base medida ANTES de editar (SC-000, SC-007)

**Data**: 2026-09-06 · **Build**: `ca06a62` · **Base**: `https://hub.roilabs.com.br`

Medir depois do conserto mede o conserto (`first_run_measures_the_check`). Nada foi editado antes
desta medição.

## T001 — SC-000: altura da ficha `/okr/atma`

| viewport | altura do documento | acima da dobra |
|---|---|---|
| 1280×800 | **3.438px** | eyebrow · `h1 Atma Aligner` · **Onde trava** · **Quanto falta** · **Árvore de metas** |
| 360×640 | **5.543px** | eyebrow · `h1 Atma Aligner` · **Onde trava** |

A referência de 03/09/2026 no quickstart era 5.267px em 360px; **hoje deu 5.543px** — vale a de
hoje, e a diferença de +276px já é informação (a árvore da 016 e a palitagem da 017 entraram no
meio).

**O que a dobra de 1280×800 NÃO responde hoje** (é o defeito que a spec existe para matar):

- *qual degrau é o pior* — a cadeia (diagrama de `N3`) só aparece ~2.000px abaixo;
- *por quê* — a palitagem ("Por que não avançou") fica depois da árvore;
- *o que fazer* — o bloco "O que fazer" é o penúltimo da seção.

Capturas: `antes-atma-1280.png`, `antes-atma-360.png` (scratchpad da sessão).

## T002 — SC-007: linha de base de `/okr`

17 cards + 2 cards de texto. Ordem e veredito de partida (a regressão que importa: mexer na tela da
atma não pode mudar o placar de mais ninguém):

| # | projeto | veredito |
|---|---|---|
| 1 | Atma Aligner | §7.1 — fator ZERADO no fim da cadeia |
| 2 | CannibalScan | §7.1 — fator ZERADO na ENTRADA |
| 3 | Compass | §7.1 — fator ZERADO na ENTRADA |
| 4 | Context Keeper | §7.1 — fator ZERADO na ENTRADA |
| 5 | ReviewShield | §7.1 — fator ZERADO na ENTRADA |
| 6 | SEO Forecaster | §7.1 — fator ZERADO na ENTRADA |
| 7 | Tapepro | §7.1 — fator ZERADO na ENTRADA |
| 8 | Vértice | §7.1 — fator ZERADO na ENTRADA |
| 9 | AftercareGen | §7.2 — apurar antes de melhorar (D4) |
| 10 | Estetia CRM | §7.2 — apurar antes de melhorar (D4) |
| 11 | Estética Fábrica | §7.2 — apurar antes de melhorar (D4) |
| 12 | ROI Labs Goiânia | §7.2 — apurar antes de melhorar (D4) |
| 13 | Polaris IA | §7.2 — apurar antes de melhorar (D4) |
| 14 | QPrime | §7.2 — apurar antes de melhorar (D4) |
| 15 | ROI Labs (institucional) | §7.2 — apurar antes de melhorar (D4) |
| 16 | Sirius CRM | §7.2 — apurar antes de melhorar (D4) |
| 17 | Vértice Marketing | §7.2 — apurar antes de melhorar (D4) |

Janela dos 16 sem época: `2026-08-07 → 2026-09-03`. Atma: `2026-07-31 → 2026-09-06`.

Captura: `antes-okr.png`.

## T003 — suíte de partida

`npm test` → **617 testes, 617 passando, 0 falhas**, `duration_ms 7097` (~7,1s de relógio: 8,1s).
O plano falava em "~1,6s / teto ~2s"; **esse número está defasado** — a linha de base real é ~7s, e
é contra ela que a SC-010 se compara no fim.

## T004 — BLOQUEANTE da US3: a chave primária de `patient_leads`

Rodado contra `ATMA_DATABASE_URL` (somente leitura):

```
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'patient_leads' ORDER BY ordinal_position;
```

**A PK se chama `id`, tipo `integer`** — confirmado também por `pg_index`/`indisprimary`. A suposição
do contrato se sustenta; o SELECT da T024 usa `id` literal, sem renomeação.

Colunas de `patient_leads`: `id, nome, email, telefone, cep, consentimento, status, ortodontista_id,
observacoes, created_at, updated_at, cidade, bairro, motivo`.

`orcamentos.paciente_lead_id` é `integer` — **mesmo tipo** da PK. O mapa `lead → motivo` é chaveado
por `String(id)` nos dois lados, porque `pg` devolve `integer` como number e `numeric` como string;
normalizar para string nos dois lados evita a comparação `44 === "44"` falhar em silêncio.

## Oráculo do dia (06/09/2026) — NÃO vira constante

`SELECT status, count(*) FROM orcamentos GROUP BY status` → **`enviado: 9`, um valor só**. A FR-013a
continua de pé: `fechados` vem do degrau `tratamento`, nunca de `orcamentos.status`.

Pipeline da janela `>= 2026-07-31` (query 3): **9 orçamentos**, sendo

| id | lead | motivo | preço | desconto | líquido | criado |
|---|---|---|---|---|---|---|
| 3 | 21 | sem_resposta | 6355,93 | 0,10 | 5.720,34 | 2026-08-05 |
| 5 | 22 | perdido_concorrencia | 5084,75 | 0,05 | 4.830,51 | 2026-08-05 |
| 6 | 22 | perdido_concorrencia | 5084,75 | 0,05 | 4.830,51 | 2026-08-17 |
| 7 | 44 | sem_interesse | 5980,00 | 0,10 | 5.382,00 | 2026-08-17 |
| 8 | 44 | sem_interesse | 5980,00 | 0,05 | 5.681,00 | 2026-08-17 |
| 9 | 51 | contato_futuro | 4490,00 | 0,10 | 4.041,00 | 2026-09-01 |
| 10 | 51 | contato_futuro | 4490,00 | 0,10 | 4.041,00 | 2026-09-01 |
| 11 | **null** | — | 4490,00 | 0,10 | 4.041,00 | 2026-09-05 |
| 12 | 53 | enviou_documentacao | 2990,00 | 0,05 | 2.840,50 | 2026-09-05 |

Total enviado (líquido): **R$ 41.407,86** em 9 documentos, 5 pessoas + 1 órfão (R$ 4.041,00).
Vivos pela taxonomia declarada: leads 51 (`contato_futuro`) e 53 (`enviou_documentacao`) →
**2 pessoas, R$ 10.922,50**. Perdidos: leads 21, 22 e 44 → **3 pessoas, R$ 26.444,36**.
Fecha: 10.922,50 + 26.444,36 + 4.041,00 = 41.407,86.

> O quickstart registrava R$ 44.945,43 para "9 orçamentos" em 06/09; esse é o valor **BRUTO**
> (soma dos `preco`). A soma **líquida de desconto** — a que a tela exibe, e a mesma aritmética de
> `ticketDeOrcamentos()` — é R$ 41.407,86. É exatamente por isso que nenhum destes números entra
> em código ou teste: a verificação roda a query na hora.

Palitagem `>= 2026-07-31` (query 2): `sem_resposta 29 · sem_interesse 9 · contato_futuro 8 ·
enviou_documentacao 3 · perdido_concorrencia 1 · preco_alto 1 · sem motivo 1` = **52 leads**.

---

## T055 — o DEPOIS, medido no mesmo navegador

Implementação em `bd0373e`, medida em `http://localhost:3001` (dev), mesmo script, mesma máquina.

| viewport | antes | depois | |
|---|---|---|---|
| 1280×800 | 3.438px | **1.463px** | −57% |
| 360×640 | 5.543px | **2.417px** | −56% |

Posição das três respostas contra a dobra de 800px (borda inferior de cada elemento):

| pergunta | y a 1280×800 | y a 360×640 |
|---|---|---|
| qual degrau é o pior (legenda do diagrama) | **500px** | 742px |
| por quê (palitagem dominante) | **742px** | 1.252px |
| o que fazer (linha `Fazer:`) | **779px** | 1.357px |

As três cabem acima da dobra a 1280×800. A 360×640 a **ordem** é a mesma, dentro das duas primeiras
rolagens.

> O último ajuste que fez a SC-001 passar não foi cortar bloco: a linha `Fazer:` estava em **801px**,
> 1px abaixo da dobra. O que a trouxe para 779px foi encurtar de três linhas para uma a prosa da
> régua de mercado AUSENTE — texto que não responde nenhuma das três perguntas.

Capturas: `v-_okr_atma-{360,768,1440}.png`, e o mesmo para `/metodo` e `/aquisicao`.

## ui-verification — as 3 telas, no navegador

| checagem | `/okr/atma` | `/okr/atma/metodo` | `/okr/atma/aquisicao` |
|---|---|---|---|
| headings / `h1` | 6 / **1** | 9 / **1** | 3 / **1** |
| salto de nível de heading | nenhum | nenhum | nenhum |
| link ou botão sem nome acessível | nenhum | nenhum | nenhum |
| paradas de foco alcançáveis | 21 | 24 | 22 |
| estouro horizontal a 360/768/1440 | nenhum | nenhum | nenhum |
| console | **limpo** | **limpo** | **limpo** |
| requisições com status ≥ 400 | 0 | 0 | 0 |
| domínios de terceiro | nenhum | nenhum | nenhum |
| CLS | 0,0000 | 0,0000 | 0,0000 |

Dois achados apareceram nas **três** telas e foram rastreados até a origem: uma "imagem sem
descrição" e um focável invisível. Os dois são o **overlay de dev do Next** (`nextjs-portal`, um
`<svg>` 40×40 dentro do shadow root) — não existem em produção e não vieram desta spec. O `<svg>` do
diagrama de cadeia está `aria-hidden="true"` com o `<figcaption>` carregando a mesma leitura em
texto, e por isso **não** aparece como imagem sem nome na árvore.

**Não verificado**: aparelho real (toque, teclado virtual, rede móvel), leitor de tela de verdade
(NVDA/VoiceOver anunciam diferente do snapshot) e dado de campo. LCP local (4,1s na ficha, 1,6s na
aquisição) é de **dev server sem build de produção**, com as chamadas reais de banco/GSC/GA4 — não
serve de linha de base e não foi usado para decidir nada.
