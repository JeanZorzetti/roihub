# 019 — A ficha responde em 30 segundos

**Implementada em 06/09/2026** · base `ca06a62` · linha de base em
[handoff-019-linha-de-base.md](./handoff-019-linha-de-base.md)

Nada foi recalculado (FR-036), com a exceção escrita: `n1Total`/`n1Janela`, que estavam
**suprimidos** pela guarda 8 de `projetar()` e voltaram a sair apurados. O que mudou foi **onde os
números aparecem**, e dois que estavam calados passaram a falar.

---

## 1. O que a dobra faz agora

| medida | antes (03–06/09) | depois | |
|---|---|---|---|
| altura do documento a 1280×800 | 3.438px | **1.463px** | −57% |
| altura do documento a 360×640 | 5.543px | **2.417px** | −56% |

**SC-001 — as três respostas acima da dobra a 1280×800** (medido no navegador, borda inferior de
cada elemento contra os 800px):

| pergunta | onde responde | y |
|---|---|---|
| qual degrau é o pior | legenda do diagrama da cadeia — *"Trava em tratamento INICIADO (0 apurado)"* | **500px** |
| por quê | *"sem resposta sozinho é 56% dos 52 leads reais da janela"* | **742px** |
| o que fazer | linha **Fazer:** | **779px** |

A 360×640 a ordem é a mesma (742 / 1.252 / 1.357px).

> **Altura não é meta** (FR-038). O que fechou a SC-001 foi a **sequência**; a altura é
> consequência. E o último ajuste que a fez passar não foi cortar bloco: foi encurtar de três
> linhas para uma a prosa da régua de mercado AUSENTE, que empurrava o "o que fazer" para 801px —
> 1px abaixo da dobra.

**Ordem final da ficha**: cadeia (com o veredito virando legenda dela e a régua de mercado uma
linha abaixo) → motivo + ação num bloco só → buracos → placar (projeção + valor em risco) →
Descoberta (só perfis A/B) → um link para o método.

Saíram da ficha: o índice de âncoras `N0…N6`, as sete seções N0–N6, a árvore de metas, "Onde
trava" como bloco próprio, "Quanto falta" separado do valor em risco.

---

## 2. Os dois números que estavam calados

### `n1Total` — a guarda 8 partida (FR-008..FR-012)

`meta ÷ ticket` **não toca a âncora**, e saía suprimido junto com ela. A guarda 8 de
`lib/projecao.mjs` foi movida para **depois** do cálculo de `n1Total`/`n1Janela`/`normalizacao` e
passou a devolver retorno **parcial**. As guardas 1–7 não se tocaram — cada uma nomeia um fator que
falta na própria divisão da meta, e a 8 é a única que fala da cadeia.

**A FR-011 revoga por escrito a FR-034 da 018** (`lib/projecao.mjs` não ganha regra nova). Está
comentado no código.

Na tela, hoje: `Meta: R$ 50.000,00 em R$ 4.600,87 por unidade (ticket apurado) · N1 necessário no
prazo: 10,87, na janela de 28 dias: 2,62` **e**, logo abaixo, `âncora zerada — meta não se divide
por volume nenhum`. Os dois lados, na mesma tela (FR-012).

**Consequência declarada (FR-008a), conferida**: o card da atma em `/okr` trocou
`projeção: não apurado — âncora zerada…` pela linha da meta. Os outros 16 continuam em
`projeção: não apurado — sem meta declarada` (guarda 2, intocada), e **o ranking não mudou** —
`posicaoDeAtaque()` lê só `ficha`, nunca `projecao`.

### O pipeline somado — `valorEmRisco()` (FR-013..FR-017)

Exigiu **uma coluna a mais** no SELECT de `patient_leads`: `id`. Confirmada no
`information_schema` **antes** de escrever código (T004) — é `integer`, mesmo tipo de
`orcamentos.paciente_lead_id`; o mapa é chaveado por `String(id)` nos dois lados.

Na tela, hoje: `R$ 41.407,86 enviados (9 orçamentos) · 0 tratamento INICIADO · 2 ainda vivos
(R$ 10.922,50)`, mais `3 perdidos — R$ 26.444,36` e `1 orçamento sem lead vinculado — R$ 4.041,00`.
A taxonomia usada sai **no bloco, textualmente**.

- **`fechados` vem do degrau `tratamento`, nunca de `orcamentos.status`** (FR-013a). Conferido no
  banco em 06/09: 9 de 9 linhas em `enviado`, um valor só. Coluna que só conheceu um valor não
  separa nada.
- **`vivos` é o complemento**, lead sem `motivo` incluído. `motivosDePerda` ausente → vivos e
  perdidos saem `null` e a tela **nomeia o que falta declarar** (FR-015b). Só o card `atma` declara
  a lista.
- **Nenhuma razão `enviados ÷ meta`, barra de progresso ou "% da meta"** (FR-014) — nem na tela nem
  no módulo.
- Sem orçamento na janela o bloco **não renderiza** (FR-017).

---

## 3. As duas rotas novas

| rota | conteúdo | render | conferida |
|---|---|---|---|
| `/okr/[slug]/metodo` | N0–N6 + árvore de metas | ISR 1h (FR-028a) | **17/17 → 200** |
| `/okr/[slug]/aquisicao` | GSC 8 meses, GA4 12 meses | ISR 1h (FR-028a) | **17/17 → 200** |

As duas são do **template**, nunca `app/okr/atma/…`. A ficha continua `force-dynamic`.

**FR-027 — janela pedida × janela recebida**, funcionando na atma:

- GSC pedida `2026-01-03 → 2026-09-03`, **recebida `2026-01-11 → 2026-09-03` — truncada**
  (4.468 cliques, 366.980 impressões em 236 dias com dado). A série se autodeclara: `days[0].date` /
  `days.at(-1).date`, zero chamada extra.
- GA4 pedida `2025-09-03 → 2026-09-03`, **recebida `2025-09-07 → 2026-09-03` — truncada**
  (7.422 sessões). Sonda `ga4Cobertura()`, uma chamada a mais numa página de ISR de 1h.

**FR-029/SC-008**: nenhuma razão entre cliques (GSC) e sessões (GA4). Há uma asserção em
`test/janelas.test.mjs` que lê o fonte da tela e falha se alguma aparecer.

**SC-007, a regressão que importa**: `/okr` antes × depois — **mesmos 17 cards, mesma ordem, mesmos
vereditos, mesma célula `visitante`**. Comparado programaticamente, não a olho.

---

## 4. Duas coisas que a spec pedia e NÃO acontecem hoje

Ambas estão implementadas e cobertas por teste. Nenhuma consegue acender em produção agora, e os
dois motivos são de dado, não de código.

### 4.1 SC-009 — a árvore da atma não desce até impressões

**A árvore para no PRIMEIRO degrau**, e isso **antecede a 019**: `orcamento → tratamento` é
`0/6 = 0`, e taxa zero não divide (`x/0` é `Infinity` com cara de meta). Não há régua de mercado
para esse span — e réguas são a **spec 020** (FR-037). O teste
`"atma de hoje: a árvore para no primeiro degrau — a RÉGUA não cobre o span"` já registrava isso
antes desta spec.

A costura da época (US6) só roda **depois** de uma descida completa. Enquanto a árvore parar no
primeiro degrau, ela nunca é alcançada.

### 4.2 A contenção de janela nunca vale com época declarada

A guarda da FR-031 é, literalmente:

```
ctr.janela.inicio <= conversao.inicio  ∧  ctr.janela.fim >= conversao.fim
```

Mas `conversao(agora, epoca).fim` é **`hoje()` (D-0)** e o Search Console fecha em **D-3**. A fatia
da série sempre termina 3 dias antes do fim da janela de Conversão, então a contenção **falha por
construção** para qualquer projeto com `epoca` — hoje, `2026-09-03 >= 2026-09-06` é falso.

O comportamento resultante é o correto e honesto (a árvore **para e nomeia** o que faltou, FR-033),
mas não é o que a SC-009 espera. O plano supunha que "a época da atma cabe inteira dentro dos 84
dias que `gscSeries()` já busca" — cabe no **começo**, não no **fim**.

**Conserto de uma linha, quando alguém decidir**: comparar contra
`min(conversao.fim, ctr.janela.fim)` e nomear os dias sem cobertura, **ou** fechar a janela de
Conversão em D-3 quando ela alimentar comparação com o GSC. As duas mudam a regra — por isso não
foram feitas aqui. Está tudo coberto por teste: `019/T047 caso 3b` é exatamente o caso real de
hoje.

### 4.3 O `revalidate = 3600` está declarado, mas não morde

As duas rotas novas exportam `revalidate = 3600` (FR-028a). Só que as duas chamam `listProjects()`
→ `listRepos()`, e esse `fetch` usa `cache: "no-store"` (`lib/github.ts:41`) — o que torna a rota
**dinâmica** no App Router e faz o `revalidate` virar letra morta. Na prática, `/aquisicao` paga as
duas chamadas de janela longa a cada request.

Não foi consertado aqui de propósito: trocar a política de cache de `listRepos()` mexeria no
**contrato único de dados** (Princípio I), que 12 telas consomem. `listRepos()` já tem memo próprio
de 10 min em processo, então o custo real é do GSC/GA4, não da lista.

**Caminho, quando alguém decidir**: envolver só as chamadas caras (`gscSeries` longa, `ga4Canais`,
`ga4Cobertura`) num cache de rota, ou dar `generateStaticParams()` às duas rotas — esta segunda
opção foi **recusada** por ora: prerenderizar 17 slugs faria a build do Docker bater no GSC/GA4
34+ vezes, com as env vars que podem não existir em tempo de build (`ssg_db_query_build_time_gotcha`).

---

## 5. O que ficou pelo caminho, e por quê

- **FR-003, o bloco "motivo + ação"**: a spec manda **omitir o bloco** quando a fonte não grava
  `motivo`. Ler assim ao pé da letra tiraria a **ação** de 16 dos 17 projetos — e "o que fazer" é
  uma das três perguntas que a SC-001 exige. O que foi feito: o **lado do motivo** é omitido quando
  não há palitagem (nunca preenchido com placeholder, US1-AC5); o bloco continua renderizando com a
  ação.
- **`R$ <fechados> fechados`** (formato literal do `contracts/valor-em-risco.md`): `fechados` é o
  **degrau `tratamento`**, uma contagem de tratamentos — o `data-model.md` o tipa como `Celula`.
  Multiplicá-lo pelo ticket para escrever `R$` inventaria uma receita que ninguém mediu. Sai na
  unidade que ele tem: `0 tratamento INICIADO`.
- **`status_historico`** — fora de escopo (FR-034). **Réguas de mercado e `market_benchmarks`** —
  spec 020 (FR-037).

---

## 6. Testes

**651 passando, 0 falhas** (eram 617 na linha de base), `duration_ms ~3.8s`.
**Zero arquivo de teste novo**: as 34 suítes registradas no `package.json` continuam as mesmas — a
lista não precisou de edição, e `test/validade.test.mjs` fecha lista × diretório nos dois sentidos.

Três testes existentes foram **atualizados**, não reescritos, porque a 019 revoga a regra que eles
travavam:

- `guarda 8 — âncora zerada` (018) → os seis casos de `contracts/projecao-guarda-8.md`. O caso 5
  trava as guardas 1–7 byte a byte: é a não-regressão dos 16 projetos sem meta.
- Os dois testes de `018/FR-007` que decidiam a camada de impressões pelo **nome do primeiro
  marco** → decidem por **coincidência de janela** (FR-031). O nome nunca provou que as janelas
  batiam; foi a trava certa na 018 porque era a única disponível.

---

## 7. Arquivos

**Novos**: `lib/ficha-dados.ts` (a orquestração movida — borda, nenhuma regra nova) ·
`app/okr/[slug]/celulas.tsx` (a apresentação compartilhada pelas duas telas) ·
`app/okr/[slug]/buracos.tsx` · `app/okr/[slug]/risco.tsx` · `app/okr/[slug]/metodo/page.tsx` ·
`app/okr/[slug]/aquisicao/page.tsx`.

**Tocados**: `lib/okr.mjs` (+`buracosDeVerdade`, +`valorEmRisco`; `posicaoDeAtaque` passa a consumir
a primeira) · `lib/projecao.mjs` (guarda 8 partida) · `lib/arvore-metas.mjs` (coincidência de
janela) · `lib/janelas.mjs` (+`descobertaLonga`, +`comportamentoLongo`) · `lib/okr-coleta.ts`
(`id` no SELECT, expõe linhas/mapa/série) · `lib/gsc.ts` (`gscSeries` com janela opcional, default
intocado) · `lib/ga4.ts` (+`ga4Cobertura`) · `lib/projects.ts` (+`motivosDePerda`) ·
`app/okr/projecao.tsx` (sem `return` cedo) · `app/okr/[slug]/page.tsx` (reordenada) ·
`data/projects.json` (card `atma`).

**Zero dependência nova, zero framework de teste, zero migração, zero DDL, zero escrita em banco.**
