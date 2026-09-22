# Research — 054 A próxima ação de cada KPI no mapa

Decisões tomadas no plano, com o que foi descartado. Leituras do Sirius em produção de 22/09/2026
(`/gsc/mapa/sirius`, versão em lista) são a amostra real de todas elas.

## D1 — Onde a regra mora: um módulo `.mjs` novo, `lib/proxima-acao.mjs`

- **Decisão:** as 32 regras, as alavancas, os degraus, a avaliação e a montagem do painel moram num
  módulo puro novo. A página só monta a leitura de cada folha e desenha.
- **Por quê:** Princípio III (lógica testável nasce em `.mjs`). `gsc-delta.mjs` guarda o que JULGA
  a folha (régua, selo, classe); a regra guarda o que FAZER com ela, e mistura as duas coisas foi
  exatamente o que a 028/033 separou.
- **Descartado:** um campo `regra` em `CATALOGO`. Obrigaria `gsc-delta.mjs` a conhecer alavanca e
  degrau, que não são natureza da folha, e o teste de lista-contra-lista já garante as mesmas 32
  chaves nos dois lados (D6).

## D2 — O limiar ◆ vem da régua viva; o ◇ tem casa única aqui

- **Decisão:** limiar com régua publicada é LIDO de `CATALOGO[k].balizador.limite` e de
  `BENCHMARK`, nunca escrito. Meta do board sem fonte é escrita uma vez, em `REGRAS`. As duas metas
  que a página já escrevia como constante local (`CLIQUES_DO_BOARD = 3`, `LINKS_DO_BOARD = [5, 10]`)
  mudam-se para o módulo e a página passa a importá-las.
- **Por quê:** FR-002 e SC-003. Uma segunda cópia diverge calada na primeira correção.
- **Descartado:** transcrever os números a partir de `board-gsc.mjs`: lá eles estão em PROSA
  ("Meta: ≥ 95%"), e prosa não passa por teste nenhum (a lição da `DIVERGENCIAS`).

## D3 — Nenhum selo novo: a origem usa as palavras do selo da folha

- **Decisão:** o "▣" do template (`329388d`) sai. A origem da ação é escrita como o selo que a folha
  JÁ carrega: `◆ régua publicada`, `◇ norma, não régua`, e para a meta sem fonte
  `◇ meta do board, sem fonte` (Q1). A frescor diz `◇ política do dono, sem fonte`, porque o prazo
  de 6/12 meses é política editorial declarada (`EDITORIAIS`), não meta do board.
- **Por quê:** `seloDaMedida` proíbe taxonomia paralela ("NENHUM selo novo nasce aqui"). A folha e a
  ação lado a lado com glifos diferentes seriam duas taxonomias para a mesma coisa.
- **Palavra que separa ◆ de ◇ na ação:** `régua` só aparece em origem ◆. Origem ◇ diz `meta`
  (board) ou `norma`. Nenhuma ação ◇ usa `▼`, que é glifo de veredito das faixas (Q1, FR-006).

## D4 — Estado "sem ação", nunca "dentro" nem "✓"

- **Decisão:** o estado de folha que não dispara é escrito `sem ação · <leitura>`. Nada de `✓`,
  `▲` ou "atinge".
- **Por quê:** numa folha ◇, "dentro da meta" é o veredito que a folha recusa emitir. "Sem ação"
  afirma só o que a regra decidiu: não há trabalho pedido.

## D5 — Leitura de piso

- **Decisão:** regra `<` sobre leitura de piso: piso abaixo do limiar dispara com a ressalva
  `piso: o número real pode ser maior`; piso no limiar ou acima dele é `sem ação`.
- **Por quê:** o piso só erra para baixo (a dimensão `query` omite as consultas raras). Acima do
  limiar, o real está mais acima ainda; abaixo, não dá para afirmar, mas o dono pediu o gatilho
  (Q1) e a ressalva impede ler o piso como total.

## D6 — Resultado aponta para UMA alavanca

- **Decisão:** cada regra de folha de resultado nomeia uma alavanca de destino (a primeira, na
  ordem de ataque, das que o template cita). Folhas de higiene e de alavanca apontam para si mesmas
  ou para o grupo delas (os cinco vitais viram a alavanca `vitais`).
- **Por quê:** FR-008/009. Com dois destinos o mesmo motivo apareceria em duas entradas, e o
  painel contaria o mesmo problema duas vezes, o defeito que a 051 fechou ao não somar moedas.
- **Mapa:** penetração, striking e impressões no Top 3 → `links`; crescimento não-marca, footprint,
  Top 20, consultas por página e TAM → `cobertura`; CTR por posição, CTR Gap, % de URLs acima do
  benchmark e reescrita → `titulo`; Active Index → `poda` (a mesma ação da rejeição de rastreio:
  consolidar, enriquecer ou desindexar).

## D7 — Ordem do painel

- **Decisão:** degraus na ordem fixa índice → desempenho → página certa → posição → snippet. Dentro
  do degrau: entrada crítica primeiro, depois a pedida por mais KPIs, depois a ordem declarada em
  `ALAVANCAS`. Dentro da entrada, os alvos vêm na ordem da fila da 051 onde ela existe (cliques não
  capturados no título, milissegundos nos vitais), porque `filaDoMapa()` continua sendo chamada e
  passa a fornecer os alvos.
- **Por quê:** Q2. A fila deixa de ser um bloco e vira a ordem interna. Entradas de um mesmo degrau
  quase sempre têm moedas diferentes (links contam páginas, cobertura conta termos), então a ordem
  entre elas não pode ser por impacto sem comparar moedas.
- **Consequência na spec:** FR-010 fica como está no texto ("sem comparar moedas"); a ordem por
  impacto age nos alvos, e o critério entre entradas é crítica → nº de KPIs → ordem declarada.

## D8 — Onde a ação aparece no mapa: etiqueta no nó da folha

- **Decisão:** uma etiqueta (`tags`) no nó da própria folha (id = chave do catálogo), ao lado do
  selo e da classe que ela já tem. A regra inteira ("se X, fazer Y") é acrescentada à `note` da
  folha, que o painel de seleção mostra e a versão em lista imprime.
- **Por quê:** o nó da folha é visível antes de expandir, e o `-medido` não. Um nó-filho novo por
  folha somaria 32 nós a um mapa que já mediu 2.693px de altura com 113.
- **Descartado:** nó-filho `-acao`. Mesmo conteúdo, 32 nós a mais, e o contador de nós do cabeçalho
  mudaria sem nada ter sido medido.

## D9 — Forma do painel (information-design)

### Lista ordenada por degrau
**Responde:** o que a equipe faz primeiro neste projeto, e qual KPI pede isso, com que número?
**Codifica:** degrau → posição vertical (ordem); alavanca → linha; motivo → texto com número +
origem em palavra e glifo; crítica → palavra "crítica" e topo do degrau.
**Descartei:** tabela KPI × ação (32 linhas servem para consultar, não dizem o primeiro); barra de
impacto única entre ações (moedas incomparáveis, 051).
**Estados:** degrau com ação; degrau sem ação (omitido e contado no rodapé); nenhuma ação
("Nenhuma regra disparou nesta janela", com as contagens); fonte que falhou (a folha cai em
"sem leitura" e o rodapé diz quais degraus podem estar incompletos).
**Custo:** SSR, zero JS, zero CSS global novo além de 3 classes no escopo do bloco. Pior caso real:
16 disparos em 11 entradas (Sirius, 22/09).

Hierarquia dentro do bloco: a primeira entrada é a resposta (peso maior); as demais são a evidência;
o rodapé (contagens de sem ação, não decide, sem leitura e o lembrete do §0 do template) é contexto.

## D10 — Textos (ux-writing)

| Onde | Texto | Regra |
|---|---|---|
| Título do bloco | "O que fazer primeiro" | pergunta do dono, verbo; substitui "Primeiro na fila" |
| Degraus | "1 · Índice", "2 · Desempenho", "3 · Página certa para o termo", "4 · Posição", "5 · Snippet" | substantivo curto; o número é a ordem |
| Ação | infinitivo + objeto ("Consertar o índice: …") | verbo + objeto; um verbo por alavanca |
| Etiqueta que dispara | `→ <verbo curto> · <leitura> · <meta ou régua>` | lida fora de contexto, a etiqueta ainda diz o que fazer e por quê |
| Etiqueta crítica | `‼ crítica → …` | a palavra carrega o estado, não a cor |
| Sem ação | `sem ação · <leitura>` | D4 |
| Não decide | `◐ sem ação · a amostra não decide` | glifo das faixas (033) |
| Sem leitura | `∅ sem ação · <motivo>` | glifo de ausência do mapa |

Termos novos entram no `GLOSSARIO.md` no mesmo commit (T-glossário).

## D11 — O template de `handoff/` deixa de ter limiar

- **Decisão:** `handoff/gsc-template-de-melhoria.md` fica com o §0 (recorte), a ordem de ataque e o
  "como ler", e troca as tabelas por um ponteiro: a regra de cada folha está na versão em lista do
  mapa e em `lib/proxima-acao.mjs`.
- **Por quê:** FR-014. Tabela com limiar no markdown é a segunda cópia que D2 proíbe.
