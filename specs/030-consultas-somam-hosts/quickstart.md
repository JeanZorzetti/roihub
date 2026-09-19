# Quickstart — como provar que a leitura por página soma os hosts

**Feature**: `030-consultas-somam-hosts` | **Data**: 2026-09-19

Guia de VALIDAÇÃO, não de implementação. Cada seção fecha um critério da spec e diz o que conta
como prova. Detalhe de forma está em [contracts/](contracts/leitura-por-pagina.md) e
[data-model.md](data-model.md).

## Pré-requisitos

| O quê | Onde | Por quê |
|---|---|---|
| Node 22 | — | a stack do repo |
| `.env` com `GOOGLE_SERVICE_ACCOUNT_JSON` | raiz | conferência ao vivo |
| `.env` com `DATABASE_URL` | raiz | só para a tela; a mescla não toca banco |
| `atma` com `url` e `dominioAnterior` | `data/projects.json` | é o único projeto em migração |

> Princípio V: ler os `.env` ANTES de olhar código quando algo falhar. Nenhum valor de ambiente sai
> em log, mensagem ou tela.

---

## 1. A suíte, que é o portão (Princípio II)

```bash
npm test
```

**Esperado**: verde, suíte inteira, ~1,6 s. Não só o arquivo tocado.

Arquivo de teste novo (`test/gsc-hosts.test.mjs`) tem de estar registrado na lista explícita de
`package.json` **no mesmo commit** que o cria — `test/validade.test.mjs` compara a lista com o
diretório nos dois sentidos e reprova quando divergem. Teste fora da lista nunca roda e portanto
não reprova nada.

---

## 2. A mescla, sem rede e sem Next (SC-003, FR-002, FR-003, FR-006)

```bash
node --test test/gsc-hosts.test.mjs
```

O que o arquivo precisa provar, no mínimo:

| Cenário | Esperado |
|---|---|
| mesma página nos dois hosts | **uma** linha; cliques e impressões somados |
| a campeã da Atma (22.059 @ 7,3 + 5 @ 21) | posição ponderada ≈ 7,3, **nunca** ≈ 14 |
| linha com 0 impressões | não vota na posição |
| nenhuma impressão na página | `posicao === null`, nunca `0` |
| um host só | linhas idênticas às de hoje, `page` byte a byte igual |
| `/x` e `/x/` | duas linhas, não uma |
| `?p=2` | linha própria |
| URL que não parseia | descartada, não vira chave crua |
| página só no domínio antigo | `page` no host de `url`, `hosts` com um item |

---

## 3. A testemunha independente (SC-004)

O script da 029 já pergunta ao Google por fora, host a host. Ele responde pela dimensão `date`;
para esta feature a conferência é pela dimensão de PÁGINA, na janela de descoberta:

```bash
node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16
```

**Esperado**: as duas propriedades listadas, e o total somado batendo com a soma das colunas.
Referência medida em 19/09/2026 na janela 20/08→16/09:

| Host | Impressões | Cliques |
|---|---:|---:|
| `usealigner.com` | 98 | 8 |
| `atma.roilabs.com.br` | 24.566 | 426 |
| **Total** | **24.664** | **434** |

**A prova da SC-004**: o total de impressões do bloco de consultas da tela fecha com esses 24.664,
**diferença zero**. Diferença diferente de zero é achado, não arredondamento.

> ⚠️ A dimensão `query`+`page` devolve menos que o total do site (42% na Atma, medido) — o Search
> Console omite as consultas raras. Compare bloco contra bloco: a soma das propriedades **na mesma
> dimensão** da tela. Comparar o bloco de `query` contra o total do site acusa um buraco que é da
> API e não da soma.

---

## 4. A aba de aquisição (US1 — SC-001, SC-002, SC-006, SC-003)

```bash
npm run dev    # http://localhost:3000/okr/atma/aquisicao
```

| # | O que conferir | Prova de |
|---|---|---|
| 1 | O bloco de consultas nomeia os hosts somados | FR-008 |
| 2 | O total do bloco fecha com a soma da seção 3 | SC-004 |
| 3 | O Índice de Conformidade tem denominador e avalia 23 páginas | SC-002 |
| 4 | O veredito sai ≈ **13,04%** (3 de 23) contra a meta de 75–80% do board | o fato da spec |
| 5 | Nenhuma URL repetida na lista — sem a mescla seriam 5 duplicatas | SC-003 |
| 6 | O selo `piso, não total` continua no lugar | D9 |

**SC-001**: o bloco passa a decidir sobre ≥ 99% das impressões que o Search Console tem do site.
Hoje: 0,4%. A conta é `impressões do bloco ÷ 24.664`.

**SC-006 — desligando uma propriedade**: retire temporariamente o acesso da service account a uma
das duas propriedades no Search Console e recarregue.

- **Esperado**: **nenhum número do bloco é publicado** e a tela nomeia o host.
- **Reprovado**: o bloco aparece com o total encolhido. Soma parcial é indistinguível de queda real
  — é o defeito que a 029 já pagou uma vez.

> Cuidado de medição: a diferença entre "sem propriedade" (estrutural) e "falhou agora"
> (transitório) precisa continuar visível. Remover o acesso produz um dos dois conforme o que a API
> devolve; leia a frase da tela, não só a ausência do número.

---

## 5. A ficha (US2 — SC-005)

```
http://localhost:3000/okr/atma      (e a ficha do projeto)
```

**Esperado**: `/blog/quanto-custa-alinhador-invisivel` aparece com as ~22.000 impressões da janela.

**Reprovado**: aparece com 5 impressões (a fatia do domínio novo) ou aparece duas vezes.

A camada de entrega (`camadaDeEntrega`, `lib/arvore-metas.mjs:241`) calcula "páginas necessárias" a
partir da média por página. Com a lista cortada pela metade, a média mentia — confira que o número
de páginas mudou junto com as impressões, e não só uma das duas.

---

## 6. O autopublishing (US3)

Nenhum dos 10 projetos do autopublishing declara `dominioAnterior` hoje (`grep -c atma
lib/autopublish-projects.mjs` = 0). Portanto o comportamento **não pode mudar** — é a FR-006 sendo
cobrada no lugar onde ela mais importa.

```bash
node --test test/autopublish.test.mjs
```

**Esperado**: verde sem alterar as expectativas existentes. Mudança em asserção de pauta é achado,
não ajuste.

Dois testes novos, no mesmo arquivo:

| Cenário | Esperado |
|---|---|
| `hosts` vazio com `strict: true` | **lança**, nunca `[]` |
| dois hosts | as URLs dos dois entram no histórico antes de a pauta ser classificada |

Rollout (constituição, seção *Fluxo de Desenvolvimento*): `dry_run=true` primeiro, depois os quatro
canários — `goiania`, `tapepro`, `sirius`, `context` — validando build, HTTP 200, canonical, schema,
sitemap e atribuição de imagem. Só então os demais. Kill switch global (`*`) permanece **desligado**.

```bash
curl -X POST "$HUB/api/autopublish" -H "Authorization: Bearer $HUB_CRON_SECRET" \
  -d '{"dry_run":true}'
```

**Esperado**: dez resumos transitórios, nenhuma linha em `seo_publications`, nenhuma imagem,
nenhuma escrita no GitHub.

---

## 7. Antes do push

| # | Portão | Comando |
|---|---|---|
| 1 | Suíte inteira verde | `npm test` |
| 2 | Teste novo registrado em `package.json` | `node --test test/validade.test.mjs` |
| 3 | Nenhum import de `data/projects.json` fora de `lib/projects.*` | `grep -rn "data/projects.json" --include=*.ts --include=*.mjs --include=*.tsx app lib scripts` |
| 4 | Nenhuma segunda lista de hosts (FR-001) | `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx app lib scripts` |
| 5 | Nenhum segredo em log, resposta ou erro | leitura do diff |

> ⏰ **Janela de push (Princípio IV)**: `main` faz auto-deploy e o container reinicia. NÃO dar push
> entre **23:30–01:00 BRT** (estado noturno 23:37, autopublishing 00:13) nem entre **08:00–08:45
> BRT** (cron diário do autopublishing).

> ⏳ O deploy demora ~15 min depois do push. Conferir a TELA **duas vezes**: uma checagem cedo
> "prova" que não subiu.
