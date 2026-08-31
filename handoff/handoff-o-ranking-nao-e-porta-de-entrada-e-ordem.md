# O ranking não é porta de entrada da agenda — é a ordem dela

**Data:** 31/08/2026 · **Escopo:** `/agenda` (ordem, ciclo de vida do card noturno, filtro de balde)

## O pedido, e por que ele não foi executado ao pé da letra

> "O que acha de toda tarefa em agenda vir do ranking (para passar pelo filtro)?"

**Recusado nessa forma, e o motivo é aritmético.** O ranking tem **uma** `acao` por projeto — 32 de
35 curados. Fazer toda tarefa nascer de lá põe um **teto de 32 cards** na agenda e mata o 2º passo
de qualquer projeto: para escrever "renovar o cert" você teria que editar `data/projects.json`. A
ponte no sentido certo já existia e continua: `promote()` em `app/agenda/actions.ts` transforma ação
do ranking em tarefa do banco.

## 🚩 O filtro não estava furado por tarefa manual — o furo é do robô

Medido no banco antes de escrever qualquer linha (`hub_tasks`, 29/08):

| | |
|---|---|
| tarefas pendentes | 20 |
| **sem projeto** | **14** |
| dessas 14, criadas pelo cron `POST /api/estado` | **14 (todas)** |
| tarefas manuais pendentes sem projeto | **0** |

**As seis tarefas manuais pendentes já tinham projeto, todas.** O Jean já fazia à mão exatamente o
que a regra ia obrigar. Quem despejava card órfão era o card noturno de estado — `projeto: null`
fixo no código, um por dia, empilhados desde **12/08** no balde Conferência, nenhum conferido.
Premissa do pedido furada; o defeito estava em outro lugar.

## O que foi entregue

**1. O rank do projeto virou chave de ordenação, não rótulo.** `porUrgencia` (`lib/agenda.mjs`)
agora compara `balde de data → rank do projeto → data`. Dentro da mesma urgência, tarefa do #1 vem
antes da tarefa do #20 — antes as duas empatavam e quem decidia era a **data de vencimento, que não
sabe nada de prioridade**. Rótulo `#N` e chave de ordem saem do **mesmo array** (`curados`), então
não podem divergir — que é o bug medido em 29/08, quando `#N` era só enfeite.
Efeito na tela: as atrasadas de `sirius` e `fabrica` subiram acima dos 14 cards `Estado` sem projeto.

**2. Card noturno tem validade.** Coluna nova `hub_tasks.gerador` (NULL = humano digitou) e
`dropPendentesGeradas('estado')`: a corrida recolhe o card **pendente** da véspera antes de publicar
o de hoje. **Só o pendente** — o que já foi conferido continua em "Feitas", e o mapa apurado vive em
`hub_estado`, então nada se perde. 14 avisos não lidos não são 14 avisos, são zero.
⚠️ A coluna existe para **não casar por título**: o texto do card é rótulo de exibição, e rótulo
nunca é chave — "Estado 2026-08-29: …" digitado à mão viraria alvo de `DELETE`.

**3. Filtro por balde.** Conferência/Execução/Decisão ganharam seletor na URL (`?tipo=`), com chip
e `lerFiltros` validando contra `TIPOS`. Com o filtro ligado **os outros dois baldes saem da tela**:
sem filtro eles ficam visíveis mesmo vazios para não esconder que existem, mas quando você escolhe um
balde a escolha já é a resposta — mostrar dois vazios é ruído, não transparência.

## 🚨 Duas armadilhas de escape que quase passaram caladas

Ambas em SQL dentro de **template literal do JS** (`ensure()` em `lib/db.ts`):

1. **`\d` colapsa para `d`.** A migração de backfill escrita como `titulo ~ '^Estado \d{4}-...'`
   chega no Postgres como `^Estado d{4}-...` e casa **zero linhas, sem erro nenhum**. Trocado por
   `[0-9]{4}`, que não tem escape para perder. Provado contra o banco: **14 cards marcados**, 13
   pendentes recolhíveis, 1 preservado por estar em Feitas, 14 manuais intocadas.
2. **Backtick dentro do comentário SQL fecha o template literal.** `-- \`[0-9]\` e não \`\d\``
   quebrou o parse do TypeScript (`TS1127: Invalid character`). Comentário dentro de template
   literal não usa crase.

## Estado e próximo passo

- ✅ `npx tsc --noEmit` limpo · **349 testes verdes** (7 novos em `test/agenda.test.mjs`, incluindo
  um que trava `SEM_RANK` finito — `Infinity - Infinity` é `NaN`, e comparador que devolve `NaN`
  entrega ordem indefinida sem erro).
- ✅ Verificado em dev (`next dev -p 3111`) a 1440 e 360: seletor com nome acessível, chip
  "Decisão ×", "6 de 64 cards", só o balde escolhido na tela, ações em ordem crescente de rank.
- ▶️ **Os 13 cards `Estado` pendentes saem sozinhos na próxima corrida das 23:37 BRT.** A coluna
  `gerador` e o backfill já foram aplicados no banco de produção; o `DELETE` é do robô, não foi
  rodado à mão.
- ⚠️ Não verificado: dispositivo real, leitor de tela, e a corrida noturna de verdade (o efeito só
  se prova depois das 23:37).
