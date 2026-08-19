# Phase 0 Research: Ranking Ponderado de Projetos na Página SEO

Nenhum `NEEDS CLARIFICATION` restou no Technical Context do plan.md — as decisões abaixo foram tomadas por inspeção direta do código existente (`lib/series.mjs`, `lib/score.mjs`, `app/globals.css`) e pela sessão de clarificação da spec, e são registradas aqui para rastreabilidade.

## Método de normalização das 4 métricas

- **Decision**: min-max relativo ao conjunto de projetos com dado GSC exibidos na página (`normalizado = (valor - min) / (max - min)`, com posição invertida antes de normalizar: `valorInvertido = -posição`).
- **Rationale**: as métricas têm unidades incompatíveis (cliques/impressões em contagem absoluta sem teto, CTR em fração 0–1, posição em ranking 1+ onde menor é melhor). Não existe no sistema hoje um valor de referência absoluto de mercado ("cliques bons") para normalizar contra um teto fixo. Min-max relativo ao próprio conjunto reflete a pergunta real que a página responde: "qual projeto do meu portfólio está indo melhor que os outros", não "está acima de um benchmark de mercado".
- **Alternatives considered**:
  - Z-score (desvio padrão): mais sensível a outliers com poucos projetos (~10-35 amostras), resultado menos intuitivo para leitura humana direta do score.
  - Percentil/rank puro (ignora magnitude): perderia a informação de "quão à frente" um projeto está, relevante para o acento visual gradual.
  - Escala fixa arbitrária (ex.: 0-1000 cliques = 0-1): exigiria manutenção manual de tetos por métrica sem base real nos dados do portfólio.

## Tratamento de métricas nulas (CTR/posição)

- **Decision**: quando `ctr` ou `position` são `null`, o componente correspondente entra no score como pior valor normalizado (0), sem excluir o projeto do ranking nem redistribuir peso entre as métricas restantes.
- **Rationale**: por `lib/series.mjs:33-34`, `ctr`/`position` só são `null` quando `impressions === 0` na janela de 28 dias — o que implica `clicks === 0` também (cliques ⊆ impressões). Ou seja, esse projeto já teria cliques=0 e impressões=0 normalizando naturalmente para 0 nos dois componentes de maior peso (70%); tratar CTR/posição como 0 apenas completa o mesmo sinal, sem necessidade de um caminho de cálculo especial.
- **Alternatives considered**:
  - Redistribuir peso entre as métricas não-nulas: adicionaria complexidade e uma segunda fórmula de score para um caso que já converge para "pior score" pelo caminho simples.
  - Excluir o projeto do ranking (tratá-lo como SEED): incorreto — o projeto tem conexão GSC ativa (`t !== null`), só não teve impressões na janela; não é o mesmo caso de "sem dado" que já existe na página.

## Critério de desempate

- **Decision**: em empate exato de score composto, desempatar por maior número de cliques absolutos (métrica de maior peso, 40%); em novo empate, por ordem alfabética do nome do projeto.
- **Rationale**: cliques absolutos já é o sinal mais importante do próprio modelo de pesos, então usá-lo como primeiro desempate é consistente com a justificativa de negócio do usuário. Nome do projeto garante um critério final 100% determinístico (nunca dois projetos têm o mesmo nome), atendendo FR-006/SC-003.
- **Alternatives considered**: desempate por ordem original da lista (`Array.sort` estável) — rejeitado por depender da ordem de retorno de `listProjects()`, que mistura curadoria manual e GitHub e não é uma ordem com significado de produto.

## Forma do destaque visual

- **Decision**: badge numérico de posição (#1, #2, #3...) em cada card + acento de cor/borda (reaproveitando o token `--accent` já definido em `app/globals.css`) nos projetos mais bem colocados, sem alterar o tamanho do card nem o grid `auto-fill, minmax(430px, 1fr)` existente.
- **Rationale**: decidido na sessão de clarificação de 2026-08-19 (ver spec.md → Clarifications) especificamente para não desestabilizar o grid uniforme nem a densidade de dados dos cards (4 stats + 2 gráficos cada). Reaproveitar `--accent` em vez de criar uma cor nova segue a regra "1 cor de acento" do design system do hub.
- **Alternatives considered**: card do topo maior (spans variáveis no grid) e agrupamento em seções por tier — ambos descartados nesta sessão por exigirem reestruturação de layout maior que o necessário para o efeito pedido (perceptível em 2s de varredura, SC-002).

## Exibição do score (FR-008)

- **Decision**: reaproveitar o padrão visual já existente em `app/page.tsx` (`.score-cell` / `.score-num` / `.score-track` / `.score-fill`, definido em `app/globals.css:175-178`) para mostrar o score composto em cada card com dado GSC.
- **Rationale**: o hub já tem uma convenção estabelecida para "como mostrar um score 0-100 com barra de preenchimento" (usada no ranking geral da home). Reusar evita inventar um segundo padrão visual para o mesmo conceito, seguindo a regra do design system de reuso de componentes antes de criar novos.
- **Alternatives considered**: tooltip só-hover com os 4 valores brutos — mantido como complemento (acessível via `title`/hover), não como único meio, para não esconder a informação atrás de uma interação em uma página que hoje é 100% visível sem interação.
