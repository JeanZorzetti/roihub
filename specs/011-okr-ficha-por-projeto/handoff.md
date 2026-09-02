# Handoff — polimento de UI da ficha `/okr/[slug]`

**Feature**: `011-okr-ficha-por-projeto` | **Data**: 2026-09-02 | **Origem**: design-review completo de `/okr/atma`, rodado nesta mesma feature.

Dos 10 achados do design-review, **5 já foram implementados** nesta sessão (itens 1, 3, 5, 6, 8 — abaixo). Este handoff é para os **5 que ficaram** (2, 4, 7, 9, 10), na ordem em que apareceram no relatório — não é a ordem recomendada de execução, ver §Ordem sugerida.

---

## 0. O que já está feito (contexto, não é tarefa)

Working tree do `roihub` tem 4 arquivos modificados, **ainda não commitados**:
`app/globals.css`, `app/okr/[slug]/page.tsx`, `lib/ficha.mjs`, `lib/okr.mjs`.

- Veredito (`escolherFamilia()`) subiu do rodapé do card N5 para logo abaixo do `<h1>`.
- `<h1>` ganhou a classe `.ficha-nome` (22px) — antes usava o default do browser e quebrava em ~5 linhas a 390px.
- `montarN3` (lib/ficha.mjs) passa a fonte real (`fonteNumerador`/`fonteDenominador`, novos campos em `lib/okr.mjs`) como `consultar`, em vez do rótulo da seta.
- `célula que move` no card N6 lê `item.celulaQueMove` em vez de string fixa no JSX.
- Espaço antes de `{item.meta}` no card N6.

`npm test` (471/471), `npx tsc --noEmit` limpos. Verificado em 1440px/390px contra o dev server local — screenshots em `.playwright-mcp/okr-depois2-{1440,390}.png`, um nível acima do repo.

**Efeito colateral não corrigido**: o rodapé do card N5 (`app/okr/[slug]/page.tsx:172-176`, `família: {n.familia} — {n.motivoFamilia}`) agora **duplica** o veredito que subiu para o cabeçalho. Não mexi nisso porque o item 4 abaixo já toca o mesmo card N5 — resolver junto.

---

## 1. Item 2 — funil visual em N3 (dataviz, severidade 4)

**Achado**: N3 é a cadeia de 5 degraus em texto corrido — 1 apurado (`6,67% (35/525)`), 4 não. A tela nunca mostra `525 → 35 → ? → ? → ? → 0` como forma; só como 5 parágrafos.

**Correção**: funil horizontal (barras = degrau apurado, trilho vazio hachurado = não apurado) acima das linhas de texto atuais — as linhas de texto **continuam existindo embaixo**, R1 exige que o motivo ocupe o lugar do número, o funil é reforço visual, não substituição.

**Por que isso pede `/speckit-specify` e não um diff direto:**

- `app/okr/[slug]/page.tsx` só recebe `niveis` (`CelulaFicha[]` já achatado e formatado em string, ex. `"6,67% (35/525)"`). Pra desenhar barras preciso do **valor numérico** e do **nome** de cada marco, não da string formatada — ou seja, `ficha.marcos` bruto precisa chegar até o componente, e hoje ele para em `montarNiveis()` (lib/ficha.mjs). Decisão em aberto: `montarN3` passa a devolver os marcos crus junto das células formatadas, ou o funil lê `ficha.marcos` direto (bypassando a camada de apresentação que R1/R2 governam)?
- Número de degraus **varia por perfil** — conferir `PERFIS` em `lib/okr.mjs` (perfil D/atma tem 5, os outros têm outra contagem). O funil precisa ser genérico para N degraus, não hardcoded em 5.
- O mesmo funil serviria em `/okr` (a listagem, que já tem uma tabela de marcos por projeto em `app/okr/page.tsx:176-207`) ou é exclusivo da ficha? Vale perguntar antes de construir.
- Orçamento: `.art/log.json` declara `js_kb: 0` para o chrome da direção `corte-seco` — o funil deve ser SVG inline, zero lib nova (a skill `dataviz` já orienta isso).

Recomendo abrir com `/speckit-specify` quando for começar — é decisão de contrato de dados, não só de CSS.

---

## 2. Item 4 — colapsar linhas repetidas em N4/N5 (design-systems, severidade 3)

**Achado**: N4 tem 5 linhas idênticas (`"não apurado — sem coletor para este canal"` para direto/pago/indicação/outbound/social) e N5 tem 4 (`"não apurado — sem coletor nesta requisição"`). 9 das 33 linhas da página inteira repetem o mesmo texto.

**Correção**: agrupar por `motivo` igual e colapsar em uma linha de resumo + `<details>` com a lista completa. Ex.: *"5 canais sem coletor: direto, pago, indicação, outbound, social"*.

**Onde**: `app/okr/[slug]/page.tsx`, dentro do `.map(niveis...)` (linha ~151). Hoje N4 e N5 não têm bloco dedicado — caem no `n.celulas.map(...)` genérico junto com todos os outros níveis. Precisa um branch tipo `n.id === "N4"` (e outro pra N5) que separa células apuradas (renderiza normal via `<Linha>`) das não-apuradas com motivo repetido (agrupa antes de renderizar).

**Cuidados**:
- É agrupamento **só de apresentação** — `montarN4Nivel`/`montarN5` em `lib/ficha.mjs` continuam devolvendo lista plana de `CelulaFicha`, não precisa mexer no `.mjs`. `Object.groupBy(celulas, c => c.motivo)` ou `reduce` equivalente.
- Faça isso **depois** de resolver a duplicação do veredito no rodapé do N5 (ver §0) — os dois tocam o mesmo card.
- G2 (`test/ficha.test.mjs`) valida a forma de `CelulaFicha`, não o agrupamento visual — não deve quebrar, mas rode `npm test` de qualquer forma.

---

## 3. Item 7 — rótulos técnicos crus na tela (ux-writing, severidade 3)

**Achado**: `nao-verificavel`, `paginas-indexadas`, `posicao-media-com-corte-pais`, `citacao-por-ia`, `indicacao`, `impressoes` aparecem exatamente como as chaves de código.

**Correção**: dicionário de rótulo amigável aplicado **só na apresentação**.

**Onde e como**:
- Um `ROTULOS_AMIGAVEIS: Record<string, string>` em `app/okr/[slug]/page.tsx`, aplicado no `rotulo` de cada `CelulaFicha` na hora de renderizar (dentro de `<Linha>` ou como wrapper antes dela) — **não** na origem (`montarN4`/`montarN5`/`MEDIDORES` em `lib/ficha.mjs`). As chaves (`paginas-indexadas`, `citacao-por-ia`, etc.) são o espaço de chaves de `n5:` que `validarKrs()` casa por igualdade exata (FR-017/R-017) — mudar a string na origem quebraria esse casamento.
- **Antes de decidir onde o mapa mora**, grep em `test/ficha.test.mjs` por `assert.equal(...rotulo...)` — se algum teste prende o rótulo cru contra uma dessas chaves, o mapa fica travado na camada de apresentação (é o caso mais provável, mas confirme).
- `nao-verificavel` é diferente dos outros: é o valor de `kr.marca` (bloco N0, `app/okr/[slug]/page.tsx:159-170`, `{k.marca && <span className="pill pill-warn">{k.marca}</span>}`), não um `CelulaFicha.rotulo`. Os 4 valores possíveis de `marca` estão em `validarKrs()` (`lib/ficha.mjs`): `"chave-invalida"`, `"nao-verificavel"`, `"sem-dono"`, `"excedente"` — mapa separado para esses.

---

## 4. Item 9 — N6 mistura ação pendente com decisão revogada (usability, severidade 2)

**Achado**: o card N6 ("o que eu faço segunda?") mostra o item `🚫 DESCONTINUADO em 01/09/2026...` com o mesmo peso de uma ação de fato pendente.

⚠️ **A correção que sugeri no relatório original estava errada — não implemente como descrito lá.** Eu tinha proposto separar por `item.titulo.startsWith("🚫")`. Ao escrever este handoff percebi que isso é o **mesmo anti-padrão que o próprio código já proíbe**: `lib/ficha.mjs:458-459` (comentário acima de `celulaQueMove: "nao-declarada"`) diz explicitamente *"inferir do texto é proibido, nem por palavra nem por parecença — constante"* (FR-031). Prefixo de emoji no título é inferência por parecença.

**Correção revisada**: antes de fazer qualquer coisa por string-matching, verificar quantos cards em `data/projects.json` têm esse padrão hoje (`grep -c '"acao".*🚫' data/projects.json` ou equivalente). Se for só a `atma`, provavelmente vale abrir um campo curado (`descontinuado: true` ou similar em `data/projects.json`) em vez de inferir do emoji — mais trabalho, mas consistente com como o resto da 011 trata curadoria (`familia`/`estado` também são campo, não grep). Se a decisão for mesmo usar prefixo de texto por ser baixo risco/baixo volume, documente explicitamente a exceção ao FR-031 no commit.

**Onde, uma vez decidido o critério**: `app/okr/[slug]/page.tsx:178-191`, bloco `n.id === "N6" && n.itens...` — separar `n.itens` em dois arrays antes do `.map`, segundo grupo em `<details>`.

---

## 5. Item 10 — regiões sem nome acessível (accessibility, severidade 2)

**Achado**: os 7 níveis (N0-N6) são `<section>` sem nome acessível — aparecem como `generic` na árvore de acessibilidade, sem navegação por região (confirmado no snapshot do Playwright durante o design-review).

**Correção**: `<section aria-labelledby={n.id}>` + `id={n.id}` no `<h2>` correspondente.

**Onde**: `app/okr/[slug]/page.tsx:151-153`:
```tsx
{niveis.map((n) => (
  <section className="card ag-section" key={n.id}>
    <h2 className="eyebrow">{n.titulo}</h2>
```
vira
```tsx
{niveis.map((n) => (
  <section className="card ag-section" aria-labelledby={n.id} key={n.id}>
    <h2 className="eyebrow" id={n.id}>{n.titulo}</h2>
```

Menor diff dos 5 (2 atributos) — bom para fazer primeiro, zero risco. Não achei `aria-labelledby` nem teste que prenda o HTML exato de `<section>`/`<h2>` em `test/`.

---

## Ordem sugerida (não é a ordem do relatório)

1. **Item 10** — 2 atributos, zero risco, aquece.
2. **Item 7** — depois de confirmar no teste onde o mapa pode morar.
3. **Item 9** — só depois de decidir o critério (grep primeiro, não assuma emoji).
4. **Item 4** — junto com a limpeza da duplicação do veredito em N5 (§0).
5. **Item 2** — via `/speckit-specify`, é o único que muda contrato de dados.

## Gotchas de ambiente

- **Correção a uma afirmação minha anterior nesta mesma sessão**: eu disse ao Jean que não rodava `npm run build` aqui "porque o CLAUDE.md proíbe, submete ao IndexNow" — **isso é falso para o roihub**, é uma regra de um projeto DIFERENTE (roilabs/site-goiania). Conferido: `grep -n "IndexNow\|build" CLAUDE.md` neste repo não acusa nada — deploy aqui é Docker via EasyPanel, disparado por push em `main` (CLAUDE.md ponto 3 dos "5 coisas"). `npm run build`/`next build` local é seguro de rodar.
- Não dar push entre 23:30-01:00 BRT (dois crons na janela — ver CLAUDE.md).
- Teste é `node --test`, sem framework — arquivo de teste novo precisa entrar na lista explícita do `package.json`.
- Para conferir a UI localmente sem expor a senha: já existe um dev server rodando na porta 3311 (não meu, não derrubei) atrás de `HUB_PASS`. Um proxy de 15 linhas que injeta o header (visto nesta sessão, descartável, não commitado) resolve sem passar a senha pelo transcript — buscar em `scratchpad/authproxy.mjs` da sessão anterior se precisar do padrão de novo.
