# Handoff — AftercareGen: por que a posição não melhora (17/08/2026)

Tarefa da `/agenda`: *"Steer B2B ligado 28/07: acompanhar em /seo se a pauta migrou e no
/insights se cliques saem do 0"* + pedido do Jean: **"precisamos melhorar a posição"**.

## Resposta curta

A pauta não migrou porque **nunca houve pauta**: o autopublish do aftercare publicou **zero
artigos na vida**. E a posição não melhora porque **os links internos do site apontavam para as
páginas erradas** — isso foi consertado e está no ar.

## O que o GSC diz (90 dias, `sc-domain:aftercare.nimblabs.com`)

| | |
|---|---|
| Cliques | **0** |
| Impressões | 2588 |
| Posição média | **57,6** |
| Queries em página 1 | **nenhuma** |
| Cluster B2B (28 artigos) | **4 impressões**, as de compra em pos. 80 e 83 |

63% de toda a impressão do site está numa única página: `/blog/cheek-filler-aftercare` (1638).
Zero canibalização — nenhuma query é servida por mais de uma página.

**O B2B não é "demanda sem ranking", é sem demanda.** 28 artigos escritos para o comprador
somaram 4 impressões em 90 dias. Toda a demanda medida é consumer (cheek filler, botox+álcool).

## Defeito 1 — o link interno automático era ordenado por data (CONSERTADO, no ar)

`getRelatedPosts` (3 links × 68 artigos) e a página de procedimento (4 links × 12) herdavam a
ordem de `getAllPosts()`, que é `publishedAt` desc. Os posts B2B de 20/06 são ao mesmo tempo os
**mais recentes** e os que declaram **quase todo procedimento** — então capturavam todos os
~250 slots de link interno do site.

Inspeção de URL, medida hoje:

```
/aftercare/botox linkava:
  aftercare-follow-up-message-templates-clinics          URL is unknown to Google
  aftercareGen-pabau-integration-clinic-software         URL is unknown to Google
  automated-sms-whatsapp-aftercare-messages-...          (B2B, 0 impressão)
  aftercare-software-roi-calculator-guide                (B2B, 0 impressão)

e NÃO linkava:
  how-long-after-botox-can-you-drink-alcohol             136 impressões — órfão
  botox-gummy-smile                                       79 impressões — órfão
```

Fix: ordenar por quantos procedimentos o post declara (1 = dedicado, 12 = genérico).
`byProcedureSpecificity` em [posts.ts](../../aftercare/src/lib/blog/posts.ts), usado nos dois
pontos de consumo. Guardado por `tests/blog-links.test.ts` (4 testes). Commit `fa68973`.

Verificado no HTML de produção, não presumido — `/aftercare/botox`, `/dermal-fillers`,
`/lip-filler` e `/microneedling` já servem os posts dedicados. `dermal-fillers-aftercare` e
`lip-filler-dissolving-hyaluronidase` (ambos "unknown to Google") passaram a receber link de
página indexada.

## Defeito 2 — sitemap parado há 2 meses (CONSERTADO)

`lastDownloaded` era **19/06** com 78 URLs; o sitemap no ar tem 86. Resubmetido por `PUT`
(`scripts/submit-sitemap.mjs`). Mesmo padrão de [[sitemap_stale_copy_google_never_redownloads]].

## Defeito 3 — o autopublish nunca publicou (DECISÃO DO JEAN)

```sql
SELECT * FROM seo_publications WHERE project_slug='aftercare';
-- 4 linhas, 26–29/07, TODAS status=blocked reason=draft:ymyl

SELECT * FROM seo_projects WHERE project_slug='*';
-- enabled=false, paused_reason='Canários 24/07', updated_at=2026-07-31
```

Duas consequências:

1. **O card dizia "autopublish 1/dia desde 25/07" — falso.** Zero commit de artigo no repo desde
   12/07, que foi manual. 4 tentativas, 4 bloqueios.
2. **O steer B2B de 28/07 teve UMA corrida para se provar e ela bloqueou.** Não dá para concluir
   que o `editorialFocus` é fraco: o motor não rodou. E desde 31/07 o kill switch global parou
   os 10 projetos — zero corrida de qualquer um nos últimos 14 dias.

Não religuei: `'*'` desligado é decisão deliberada ("Canários") e afeta 10 projetos.

**O que decidir:** (a) religar o `'*'`; (b) calibrar o gate ymyl — 4 de 4 bloqueios não é
"draft:ymyl com frequência", é 100%, e com o gate assim o aftercare produz zero para sempre;
(c) se o D+180 (10 cliques/sem em 28/11) vai ser perseguido pelo lado que tem demanda medida.

## O que NÃO é o problema

- **On-page**: `cheek-filler-aftercare` tem 2303 palavras, FAQ de 7 perguntas, timeline dia-a-dia,
  autor com credenciais. Não é conteúdo fino.
- **Canibalização**: zero. Nenhuma query dividida entre páginas.
- **Indexação por robots/canonical**: as páginas indexadas estão `ALLOWED` + `INDEXING_ALLOWED`,
  canonical do usuário = canonical do Google. O que falta é descoberta, não permissão.
- **Mais conteúdo**: o site tem 68 posts e 86 URLs; ~40 delas o Google nem conhece. Escrever o
  69º não move nada enquanto o 40º não for descoberto.
