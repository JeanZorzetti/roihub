# Quickstart: validar a indexação do sitemap

**Feature**: `022-indexacao-do-sitemap` | **Date**: 2026-09-07

Como provar que a feature funciona. Contrato da rota em
[contracts/api-indexacao.md](./contracts/api-indexacao.md); formas e regras em
[data-model.md](./data-model.md).

## Pré-requisitos

- Node 22, `npm ci` feito.
- Para os passos que tocam a rede: `.env` com `GOOGLE_SERVICE_ACCOUNT_JSON` e `DATABASE_URL`.
- Os passos 1 e 2 **não** precisam de credencial nenhuma — é o ponto do Princípio III.

---

## 1. A suíte inteira, verde

```bash
npm test
```

**Esperado**: verde, ~2 s. Os arquivos novos (`test/sitemap.test.mjs`,
`test/indexacao-corrida.test.mjs`) precisam estar na lista explícita de `package.json`;
`test/validade.test.mjs` reprova se não estiverem (Princípio II).

---

## 2. As três regras que mais podem mentir, sem rede

Os testes puros cobrem, no mínimo:

**SC-003 — a corrida cabe no orçamento da propriedade.** 21 projetos fictícios de 1.000 URLs
cada, todos na mesma propriedade, teto 2.000. A soma das cotas de `repartir()` é exatamente
2.000 — não 21.000. É o modo de falha que a spec nomeia como o pior.

**SC-004 — a amostra não se move.** `amostra(urls, 200)` chamada duas vezes sobre o mesmo
inventário devolve o mesmo array. E chamada sobre um sitemap que ganhou URLs **no fim** devolve
o mesmo prefixo — o número não pode se mexer por troca de amostra.

**SC-005 — falha nunca é não-indexação.** `classificar({erro: "429 quota exceeded"})` devolve
`falha`, e `agregar()` com 10 linhas das quais 3 são falha calcula a taxa sobre **7**, não 10.
Com as 10 em falha, a taxa é `null` — nunca `0`.

**A invariante.** Para qualquer entrada, `agregar()` satisfaz
`inspecionadas = indexadas + rastreadas + descobertas + outras + falhas`. Se quebrar, uma URL
caiu em dois baldes ou em nenhum.

---

## 3. Ler um sitemap real, sem gastar quota

```bash
node -e "import('./lib/sitemap.mjs').then(async m => { const c = await import('./lib/conformidade.mjs'); console.log(await m.lerSitemap('https://goianiacadeiras.com.br/sitemap.xml', c.buscar)) })"
```

**Esperado**: `{ urls: [...], motivo: null, filhos: N, profundidadeExcedida: false }`.

**Confere isto** (Independent Test da US1): o tamanho de `urls` bate com o número de `<loc>` do
arquivo. Num `<sitemapindex>`, bate com a **soma de todos os filhos** — se bater só com o
primeiro, a FR-002 não foi cumprida e o site está subcontado.

Contra um projeto sem sitemap alcançável, `motivo` é `sem_sitemap` e `urls` é `[]` — os dois
estados que a FR-003 exige distinguir de "sitemap com zero URLs" (`sitemap_vazio`).

---

## 4. A corrida, contra o banco

```bash
npm run dev
curl -sS -X POST localhost:3000/api/indexacao -H "authorization: Bearer $CRON_SECRET" | jq
```

**Esperado**: `200` com o corpo do contrato.

**Confere na resposta**:
- Toda propriedade tem `gastas ≤ orcamento` (SC-003, verificável na saída como a spec pede).
- `pulados` é lista separada de `apurados` — nenhum projeto sem orçamento aparece com
  `indexadas: 0` (FR-015).
- `falhasDeQuota` por propriedade: `> 0` com `gastas < orcamento` significa que o teto real do
  Google é menor que 2.000 e `INSPECOES_POR_PROPRIEDADE` desce por env, sem deploy (D10).

**Sem `DATABASE_URL`**: `503` com `{"faltando":["DATABASE_URL"]}` — só o nome (Princípio V).

**Idempotência**: rodar duas vezes no mesmo dia não duplica linha.

```bash
psql "$DATABASE_URL" -c "select projeto, count(*) from hub_indexacao where dia = current_date group by 1 having count(*) > 1"
```

**Esperado**: zero linhas.

---

## 5. A tela

`http://localhost:3000/okr/goiania/aquisicao`

**US1** — a frase traz `indexadas ÷ inspecionadas`, com a data da apuração e, havendo amostragem,
"200 de 1.200 inspecionadas" **na mesma frase**, não em nota de rodapé (FR-007, SC-002).

Os quatro cenários da US1, cada um numa tela diferente:

| Projeto | Esperado |
|---|---|
| sitemap pequeno, tudo inspecionado | fração sobre o total, **sem** rótulo de amostra |
| sitemap grande, amostrado | "N de M inspecionadas", e a fração declarada como valendo para a amostra |
| sem sitemap | "não há sitemap" — **nunca** 0% de indexação |
| host fora de toda propriedade | "não há onde olhar" + domínio próprio como passo — **nunca** "não indexado" |

**US2** — "rastreada, não indexada" e "descoberta, não indexada" aparecem **separadas**, cada uma
com sua contagem, e a taxa de rejeição contra a meta de 5%. Se aparecerem somadas num balde de
"não indexadas", o cenário 2 da US2 falhou.

**US3** — o Active Index Ratio é fração contra os 70% do board; num projeto sem apuração ele volta
a ser contagem **com o motivo do denominador ausente** (FR-011). Uma razão exibida com denominador
chutado é falha, não detalhe.

**SC-006, o teste de 30 segundos**: abra a aba e responda em voz alta se o problema do projeto é
"o Google não conhece as páginas" (descobertas altas) ou "o Google conhece e recusou" (rastreadas
altas). Se levar mais de 30 s, a tela não cumpriu a US2, mesmo com os números certos.

---

## 6. Antes do merge (Princípio IV e os portões)

- [ ] `npm test` verde — a suíte inteira, não só os arquivos tocados.
- [ ] Arquivos de teste novos registrados em `package.json`, no mesmo commit.
- [ ] Nenhum import de `data/projects.json` fora de `lib/projects.*`.
- [ ] Nenhum segredo em log, resposta ou mensagem de erro.
- [ ] Push **fora** de 23:30-01:00 e 08:00-08:45 BRT.
- [ ] Depois do deploy, `workflow_dispatch` do `indexacao.yml` uma vez, à mão, e leitura da
      resposta antes de confiar no cron. A primeira corrida mede o check.
