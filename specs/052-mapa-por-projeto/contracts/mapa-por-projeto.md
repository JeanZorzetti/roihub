# Contract: a rota, o cabeçalho, as frases e as corridas

## Rotas

| Pedido | Resposta |
|---|---|
| `GET /gsc/mapa` | `307` → `/gsc/mapa/atma` (o `#fragmento` do link segue no navegador) |
| `GET /gsc/mapa/atma` | `200`, o mapa da Atma, com os números iguais aos de `/gsc/mapa` antes da mudança (SC-002) |
| `GET /gsc/mapa/sirius` | `200`, o mapa do Sirius |
| `GET /gsc/mapa/{slug}`, slug fora de `SLUGS_DE_BUSCA` | `404` |
| `GET /gsc/mapa/{slug}`, slug no escopo e sem card curado (mesmo que o repo do GitHub traga `homepage`) | `404` |

`<title>`: `Board GSC — {nomeCurto}`. Continua `force-dynamic`, pelo mesmo motivo de hoje (033/T070).

## Cabeçalho

1. **Seletor (FR-011)**: um `<nav aria-label="Projetos com mapa">` com uma lista, na ordem de
   `SLUGS_DE_BUSCA`. O item atual vai sem link e com `aria-current="page"`. Os outros são `<a>` para
   `/gsc/mapa/{slug}`, e o texto do link é o `nomeCurto`. Só com o teclado, um Tab chega ao outro
   projeto e Enter abre (SC-006).
2. **Projeto medido (FR-004)**: "**O que esta tela mede é o projeto {nomeCurto}** — {hosts unidos por " + "},
   janela {início} → {fim} (28 dias, fecha em D-3) …". A frase "é o board dela, não do portfólio" sai, e
   no lugar entra "O board `okr-Saw2eoSKZDPLJAk6xeDBuS` é de SEO: a mesma definição vale para os {n} projetos
   com mapa", com `n` computado de `projetosDeBusca().length`.

## Frases: medida × evidência

- Toda frase que **afirma algo sobre o projeto medido** usa `nomeCurto`, "este projeto" ou `/okr/{slug}…`.
  A lista completa das trocas está em research D5.
- Uma frase que **cita a Atma como a medição que justificou uma regra** continua dizendo "Atma" e tem de
  casar com uma das `EVIDENCIAS` de `lib/mapa-projeto.mjs`.
- Testemunha: `scripts/conferir-mapa.mjs alheio <html do Sirius> Atma` devolve **zero** frases (SC-005).

## Estados que a spec nomeia (nenhum publica `0`/`0%`)

| Folha / bloco | Sirius, sem marca aceita | Sirius, marca aceita e inventário congelado |
|---|---|---|
| Penetração no Top 3, TAM | `∅ não apurado · inventário de termos não declarado para este projeto` | penetração medida; TAM `∅ não estimado · sem demanda estimada declarada para este projeto` |
| Striking distance | medido, **sem** guarda de marca (`decl.motivo`), e a nota diz isso | medido com a guarda |
| Crescimento não-marca, buscas de marca | o estado de marca não declarada, que já existe | medido depois da primeira corrida (research D7) |
| Vitais e Pass Rate | `∅ sem dado na CrUX` se a origem estiver abaixo do limiar | idem |
| Canibalização, vitais por origem, Active Index | o caminho "sem domínio anterior", que já existe | idem |
| Depois do clique | `∅ sem cadeia de R$ ligada ao hub: signup, ativado e trial pago não têm coletor`, sem taxa e sem `CadeiaDiagrama` | idem |

## Corridas (FR-005)

`POST /api/gsc-serie`, `POST /api/indexacao` e `POST /api/paginas`: o corpo da resposta passa a trazer
`sirius` nas mesmas listas em que já traz `atma` (`gravados`, `apurados`, `somados`…). Nenhum campo novo e
nenhuma `maxDuration` nova.

`/okr/sirius/aquisicao` deixa de mostrar "⚠️ Fora do escopo" e passa a ler os KPIs do Search Console pela
mesma função que o mapa usa.
