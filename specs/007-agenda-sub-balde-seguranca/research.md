# Phase 0 Research: Sub-balde Segurança na Agenda

Nenhum `NEEDS CLARIFICATION` ficou aberto no Technical Context — as decisões de design abaixo
já foram tomadas e verificadas com dados reais em `roihub/handoff/handoff-sub-balde-seguranca.md`
(31/08/2026). Este arquivo consolida essas decisões no formato Decision/Rationale/Alternatives
para o registro da feature.

## 1. Segurança como predicado independente, não como quarto `TIPOS`

**Decision**: `seguranca(titulo)` é uma função booleana separada de `tipoDe(titulo)`, não um
quarto valor de `tipo`.

**Rationale**: `tipoDe` classifica **esforço** (o que o card exige: medir, escrever, decidir).
Segurança é **assunto**, um eixo ortogonal. Um card pode ser "de execução" e "de segurança" ao
mesmo tempo. `tipoDe` devolve um único valor — se segurança fosse um quarto `tipo`, um card de
conferência sobre segredo vazado teria que escolher entre os dois baldes, e o contador
"Execução (N)" perderia esses cards.

**Alternatives considered**:
- Quarto item em `TIPOS` (`{ id: "seguranca", ... }`) — rejeitado: quebra a contagem por
  esforço e força escolha artificial quando segurança cruza com Conferência.
- Campo livre `hub_tasks.categoria` no banco — rejeitado por escopo: não há necessidade hoje de
  categorização geral, só do caso de segurança furando a fila da Execução; adicionar coluna e
  UI de categoria é mais código do que o pedido original.

## 2. Heurística por palavra-chave (regex), mesmo padrão de `tipoDe`

**Decision**: `RE_SEGURANCA` é uma regex sobre o título, no mesmo estilo de `RE_DECISAO`/
`RE_CONFERENCIA` já existentes em `lib/agenda.mjs`.

**Rationale**: Consistência com o padrão já validado em produção (heurística + override manual
quando erra). Regra prática do projeto: se o override virar frequente, a lista de palavras é
revisada — não se remenda caso a caso no render.

**Alternatives considered**:
- Classificação por LLM/embedding — rejeitado: custo e latência desnecessários para ~60 títulos
  curtos, e o projeto já tem um padrão de regex funcionando para os três baldes.
- Override manual desde o início (`hub_tasks.seguranca` no banco) — adiado para fora de escopo
  (§7 do handoff): só se justifica se a heurística errar com frequência, o que ainda não foi
  medido.

## 3. `auth` sem `\b`, com lookaround negativo para caminho de URL

**Decision**: o termo `auth` na regex usa `(?<![/\w])auth(?![/\w])` em vez de `\bauth\b`.

**Rationale**: medido em 31/08/2026 contra os 61 títulos reais (`hub_tasks` + `acao` dos
projetos curados) — `\bauth\b` não gera falso positivo com "author" (o `\b` já resolve isso),
mas casa "auth" dentro de um segmento de URL como `.../api/auth/callback/github`, classificando
como segurança um card que é "ligar login" (feature nova), não incidente. O lookaround
`(?<![/\w])...(?![/\w])` exclui especificamente vizinhança de barra ou caractere de palavra,
cobrindo o caso de URL sem reintroduzir o falso positivo de "author".

**Alternatives considered**:
- `\bauth\b` simples — rejeitado: falso positivo real medido (o card do GitHub OAuth).
- Remover "auth" da lista de termos — rejeitado: perde verdadeiro positivo real ("Rota /admin
  sem auth", "auth quebrada na Atma").
- Excluir só quando precedido de `/` — insuficiente: não cobre `auth` seguido de `/` (`auth/`)
  nem `auth` colado a outro caractere de palavra fora de URL.

## 4. Partição no render, não novo comparador

**Decision**: "furar a fila" é implementado particionando a lista renderizada em dois grupos
(segurança primeiro, resto depois), cada grupo ordenado pelo `ordenar()`/`porUrgencia` já
existentes. Nenhuma mudança em `porUrgencia`.

**Rationale**: `porUrgencia` (`lib/agenda.mjs:199`) acabou de ser corrigido (bug de ranking
afundando no rodapé, medido/consertado em 29/08/2026) e é compartilhado pelos três baldes. Um
quarto termo de comparação ali afetaria Conferência e Decisão também, sem necessidade — a
"fila furada" só precisa valer dentro da seção Execução.

**Alternatives considered**:
- Adicionar peso de segurança ao comparador `porUrgencia` — rejeitado: efeito colateral nos
  outros dois baldes e risco de reintroduzir o bug recém-corrigido.
- Reordenar a lista inteira do balde por um novo `sort` combinado — rejeitado: mais complexo
  que particionar e ordenar cada metade com a função que já existe.

## 5. Grupo vazio não aparece

**Decision**: quando não há nenhum card de segurança no balde Execução, a lista renderiza
exatamente como hoje (sem subtítulo, sem grupo).

**Rationale**: medição de 31/08/2026 mostra que a feature nasce com apenas 2 de 61 cards —
a maioria dos dias terá zero cards de segurança. Um subtítulo "🔒 Segurança (0)" todo dia é
ruído; os três `TIPOS` continuam visíveis mesmo vazios porque representam a taxonomia inteira,
mas o subgrupo de segurança é um destaque pontual dentro de um balde, não uma categoria
permanente da tela.

**Alternatives considered**:
- Sempre mostrar o subtítulo de segurança, mesmo com contagem 0 — rejeitado por ruído medido.
