# Régua de mercado — o segundo veredito da árvore OKR

**APROVADO 03/09/2026 · implementado na spec `015-okr-regua-de-mercado`.**
Complementa `handoff/okr-kpi-template.md` (§7) — não o substitui.

---

## 1. O problema que isto resolve

A §7 hoje diz **que** um fator está zerado. Não diz **do tamanho de quê**.

Para `atma`, o veredito atual é `§7.1 — fator ZERADO no fim da cadeia`. Verdadeiro e acionável,
mas mudo em duas perguntas que decidem trimestre:

- O topo do funil está bom, ou também está ruim e o zero está escondendo isso?
- O buraco do fim é de que tamanho — 1 tratamento ou 12?

Sem referência externa, todo número apurado é um número solto. `7,29%` é bom ou ruim? A árvore
não sabe responder, e "no mínimo bater a média do mercado" é um piso legítimo que ela não expressa.

## 2. Por que isto NÃO viola a R6

A R6 (`benchmark é ontologia, nunca previsão`) nasceu de um defeito específico, documentado em
`handoff/funil-seo/01-a-leitura-da-pesquisa.md`: a pesquisa empilhou o percentil de **elite em
quatro estágios seguidos** e apresentou o produto como determinístico. As mesmas 35.294 sessões
davam 5 ou 300 clientes — **barra de erro de 56×**.

O defeito é a **multiplicação**, não a comparação.

| | |
|---|---|
| ❌ Proibido pela R6 | `35.294 × 8% × 42,5% × 62,5% × 40%` → "€1,8M de ARR". Benchmark como **previsão** e como **meta de KR**. |
| ✅ O que esta régua faz | "Seu `visitante→lead` apurado é 7,29%. A mediana do vertical é 3,6%." Comparação de **um** degrau, contra a faixa dele. |

Um degrau comparado sozinho carrega a barra de erro **dele** (média→elite ≈ 2–4×), não o produto
de quatro. É a diferença entre uma régua e uma bola de cristal.

### As cinco travas (o que impede virar a projeção de €1,8M)

1. **Um degrau por vez. Nunca multiplicar duas faixas.** Se o código algum dia compuser dois
   benchmarks, ele virou a pesquisa que a R6 recusa.
2. **Só lê degrau com os DOIS lados apurados.** Furo na cadeia → cala e devolve para a §7.2
   (`apurar antes de melhorar`). Benchmark não preenche buraco de medição.
3. **Faixa, nunca ponto.** Sempre `média…elite`. Ponto único é o que dá autoridade falsa a chute.
4. **Fonte por linha e vertical declarado** (R8). Régua de SaaS não lê clínica. Sem linha para o
   degrau → `sem régua`, que é um estado legítimo e visível.
5. **Nunca vira meta de KR.** Sai como diagnóstico (`0,4× a média`), nunca como
   `KR: atingir 3,6%`. A R6 continua valendo na letra.

---

## 3. A tabela

Faixas de **novos pacientes / aquisição fria**, que é o que o SEO entrega. Onde a fonte separa
cliente novo de recorrente, a coluna usa o número de **novo** — misturar os dois infla o piso.

### Perfil D — Clínica / orçamento / lead de alto valor  ⭐ `atma`

| Degrau | Média | Elite | Fonte |
|---|---|---|---|
| `visitante → lead` | 2–5% (mediana **3,6%**) | 8–15% | PatientGain (4,2% méd.), Runner Agency (mediana 3,6%, top 25% ≥20,4%) |
| `lead → contato feito` | **39,9%** dos leads chegam a agendar | alvo 60–75% | InfluxMD, análise de **278.000 leads** de saúde |
| `orçamento → aceito` | **25–35%** (paciente NOVO) | 70–90% | Dentx / GrowthRx / Henry Schein One (Catalyst Index: média 45%, top 10% 75%) |
| `contato → orçamento` | — | — | ⚠️ **sem régua** — ninguém publica este degrau isolado |
| `aceito → tratamento iniciado` | — | — | ⚠️ **sem régua** — confundido com aceite na literatura |

> ⚠️ **Paciente novo ≠ paciente da base.** As manchetes de "50–60% de case acceptance" misturam os
> dois. Para base existente é 40–50%; para **novo**, 25–35%. Usar 50% como piso do `atma` seria
> cobrar dela o número de uma clínica com carteira — e ela está captando frio.

### Perfil A — SaaS / assinatura

| Degrau | Média | Elite | Fonte |
|---|---|---|---|
| `visitante → signup` | 2–5% | 7,1% | ChartMogul; Orbix (visitor-to-trial 2,1–7,1% por setor) |
| `trial pago → primeira cobrança` | mediana **8%**; opt-in 8,9% / cartão exigido 31,4% | >35% | ChartMogul, *SaaS Conversion Report* |
| `signup → ativado` | — | — | ⚠️ **sem régua** — "ativação" é definição própria de cada produto |
| `ativado → trial pago` | — | — | ⚠️ **sem régua** — depende do modelo de trial |

> ⚠️ **O modelo de trial move a régua em 3,5×** (8,9% opt-in vs 31,4% com cartão). A linha só pode
> ser lida depois que o projeto declarar qual modelo usa. Sem essa declaração: `sem régua`.

### Perfil B — E-commerce

| Degrau | Média | Elite | Fonte |
|---|---|---|---|
| `viu produto → carrinho` | 6–7,5% (bench. 6,8%) | 8–10% | Mida, Triple Whale, ChatBoq (2025–26) |
| `carrinho → checkout iniciado` | 30–35% | 40–50% | ChatBoq, Growers (50–60% do carrinho nunca inicia checkout) |
| `checkout → pago` | 20–40% (Shopify méd. **45%**) | 45–55% | Littledata / Blend Commerce |
| `visitante → viu produto` | — | — | ⚠️ **sem régua** — publicado como CR ponta a ponta (2,5–3%), não como degrau |

### Perfil C — Serviço / agência / projeto

| Degrau | Média | Elite | Fonte |
|---|---|---|---|
| `proposta → contrato ASSINADO` | 25–35% (agência 2–10 pessoas: 20–35%) | ≥60% | Pitchsite, Waco3, Flowcase (RFP geral: 45%) |
| `conversa qualificada → proposta` | 22% (demo→close serv. prof.) | 38% | Optifai, 939 empresas (B2B geral: 25%) |
| `contato → conversa qualificada` | — | — | ⚠️ **sem régua** — "qualificado" não tem definição comum |
| `contrato → primeiro pagamento` | — | — | ⚠️ **sem régua** — e a distância aqui é caixa, não marketing |

**Cobertura: 10 de 17 degraus têm linha na tabela** (A:4, B:4, C:4, D:5 degraus). Os 7 `sem régua` ficam declarados na tela, não
preenchidos por estimativa. Buraco visível vale mais que número inventado.

---

## 4. Como o veredito sai

Veredito **paralelo** à §7, não dentro dela. A §7 continua mandando por fato apurado; a régua
dimensiona.

```
posição de ataque  (§7, apurado)  →  §7.1 — fator ZERADO no fim da cadeia
distância do mercado (régua)      →  visitante→lead: 7,29% = 3,6× o piso ✅ acima da média
                                     demais degraus: sem par apurado
```

A razão é sempre contra o **piso da média** — o número mais conservador da faixa. Isso dá ao `1,0×`
um significado único e é o pedido original: **`1,0×` = atingiu o mínimo do mercado.**

Faixas do rótulo, por degrau:

| Rótulo | Condição |
|---|---|
| `abaixo do piso` | apurado < média |
| `na média` | dentro da faixa da média |
| `acima da média` | entre o topo da média e o piso da elite |
| `elite` | ≥ piso da elite |
| `sem régua` | degrau sem linha na tabela |
| `sem par apurado` | um dos dois lados é `não apurado` → §7.2 manda |

Onde os dois lados estiverem apurados, sai também o **buraco em unidades**:
`39 leads × 25% (piso do mercado) = ~10 esperados; 0 apurado → buraco de ~10`.
Uma multiplicação só, contra denominador apurado. Nunca duas.

---

## 5. A leitura do `atma` hoje (o que muda na prática)

Cadeia apurada, janela 01/08→29/08/2026: `535 cliques → 39 leads → 0 vendas`.

| Degrau | Apurado | Mercado | Leitura |
|---|---|---|---|
| `visitante → lead` | **7,29%** | piso 2% · mediana 3,6% · elite 8–15% | ✅ **3,6× o piso**, a um passo da elite |
| `lead → contato feito` | não apurado | 39,9% | `sem par apurado` |
| `orçamento → aceito` | não apurado | 25–35% | `sem par apurado` |
| `→ tratamento` | **0** | — | fator zerado (§7.1) |

**O que a régua acrescenta e a §7 sozinha não diz:** o topo do funil da `atma` não é o problema —
ele está *acima* do mercado. O único degrau comparável está ganhando. Isso fecha por número a
tentação de mandar mais SEO para lá, e confirma o veredito da §7.1 por um caminho independente.

**E expõe o buraco real:** entre `lead` e `tratamento` existem quatro degraus, três deles **sem
medição nenhuma**. O zero do fim não é diagnóstico — é o que sobra quando não se mede o meio. Pela
régua, a próxima ação não é otimizar nada: é apurar `contatado` e `orcamento`, os dois degraus que
transformariam esse zero em um diagnóstico de verdade.

---

## 6. Se aprovado

Spec Kit `015-okr-regua-de-mercado`, seguindo a constituição (III: `.mjs` puro, testável):

| | |
|---|---|
| `lib/benchmark.mjs` | a tabela como dado, `fonte` por linha (espelha a §3 acima) + `distanciaDoMercado(ficha)` pura |
| `test/benchmark.test.mjs` | trava nº 1 como teste: compor duas faixas DEVE falhar. Registrado no `package.json` (Princípio II) |
| `app/okr/[slug]/page.tsx` | segunda linha ao lado do veredito da §7 |
| `handoff/okr-kpi-template.md` | nota na R6 apontando para cá — a régua é o uso *permitido* de benchmark |

`lib/okr.mjs` **não é tocado.** A §7 sai desta feature exatamente como entrou.
