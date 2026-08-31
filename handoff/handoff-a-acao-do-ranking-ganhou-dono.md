# A ação do ranking ganhou dono — e a spec 005 foi revogada no ponto certo

**31/08/2026** · spec `specs/008-acao-responsavel/` · ENTREGUE

## O pedido

> "As ações precisam ter responsáveis, eu (Jean Zorzetti) ou a Maria Zorzetti. Quem fica eu
> decido de forma manual via seletor."

Seguido de: **"A Maria vai ser DEV também, agora."**

## A premissa que mudou, e por que ela importa mais que o código

Isto não é um campo novo — é a revogação de uma decisão de dois meses atrás.

- **11/07**: "o hub é SÓ DEV. Captação/comercial é da Maria e NÃO entra no ranking."
- **29/08 (spec 005)**: responsável nasceu em `hub_tasks`, e o FR-007 dela diz literalmente
  *"ações do ranking NÃO recebem responsável"*.
- **31/08 manhã (`614714d`)**: a `/agenda` virou projeção pura do ranking, parou de renderizar
  `hub_tasks` — e o responsável saiu da tela junto com o filtro dele.
- **31/08 tarde (isto)**: a Maria virou dev. A regra "só dev" **continua valendo**; o que mudou
  é que agora existem dois devs, então ação dela é ação de dev e entra no ranking normalmente.
  Comercial e captação seguem fora do hub, no vault.

Sem esse parágrafo, a próxima sessão lê o filtro por responsável na `/agenda` e conclui que a
decisão de 11/07 caiu. Ela não caiu — o conjunto de quem é dev é que cresceu.

## As duas decisões que o Jean tomou antes de eu escrever a spec

**1. A chave é o TEXTO da ação, não o projeto.** `acao:<slug>:<hash8>`, a mesma do check.
Consequência assumida e escrita nos Edge Cases: reescrever a `acao` no `data/projects.json`
zera o dono, e a linha volta para "sem responsável". Não é perda de dado — é a regra: ação nova
é decisão nova de quem faz. Em troca, a aba passa a ter **uma** regra de identidade em vez de
duas.

**2. O filtro por responsável volta**, com a opção **"sem responsável"** — que é o que torna
verificável em um clique a regra "toda ação tem dono". Sem ela, a atribuição existe e ninguém
sabe quanto falta.

## O que foi construído

- **`hub_acao_dono (key PK, responsavel NOT NULL, atualizado)`** — tabela própria, criada pelo
  `ensure()` aditivo. Não é coluna em `hub_tasks`: aquela é dono de *tarefa*, e reaproveitá-la
  exigiria criar uma tarefa por ação, que é o caminho `promote` removido em `614714d` e proibido
  pelo FR-009. **`responsavel NOT NULL` de propósito: "sem dono" é a AUSÊNCIA de linha.**
  Desatribuir é `DELETE` — um estado, uma representação. Confirmado no banco real.
- **Seletor de 1 clique, zero JS**: par de botões `Jean | Maria` com `aria-pressed`; clicar no
  ativo desatribui. Um `<select>` precisaria de um submit ao lado — dois cliques por linha e
  ~60 na primeira passada da fila inteira.
- **`acaoKey(slug, acao)` em `lib/agenda.mjs`**: a expressão da chave estava copiada na agenda e
  na home, e o dono seria a terceira cópia. Virou função — é o contrato entre a projeção do JSON
  e as duas camadas que o banco guarda por cima dela.
- **`rotuloResp` desceu de `app/quadro.tsx` para `lib/agenda.mjs`** (Princípio III): era const
  local, fora de teste, e agora é coberta.
- **A home exibe e não atribui.** Duas telas escrevendo o mesmo campo divergem calado.

## 🚨 A armadilha que custou a primeira corrida vermelha

**Crase em comentário SQL fecha o template literal do JS.** O comentário do `ensure()` citava
`` `promote` `` e `` `acao:<slug>:<hash8>` `` com crase; o parser do Node acusou
`ERR_INVALID_TYPESCRIPT_SYNTAX` **no `lib/db.ts:165`, dentro de um teste de autopublishing** —
393 testes verdes e um arquivo vermelho por um erro que não estava nele.

Isto **já estava escrito no `handoff-o-ranking-nao-e-porta-de-entrada-e-ordem.md` de hoje de
manhã**, ao lado da irmã dele (`\d` colapsa para `d` em SQL dentro de template literal). Reincidi
na mesma armadilha no mesmo dia. O comentário no código agora diz por que não há crase ali.

## Verificado (não "deve funcionar")

- **`npm test` 392/392**, `npm run build` de produção limpo.
- **Navegador, banco real** (dev em `:3008`, screenshot em anexo à sessão): atribuí Maria ao
  `atma` (#1) e Jean ao `meridian` (#23), **naveguei para outra URL** e os dois seguiam lá, com
  o botão ativo virando "Tirar …".
- **Desatribuir apaga a linha**: cliquei no Jean já ativo do meridian e o `SELECT` direto no
  Postgres voltou com **só** `acao:atma:83b0b828 → maria`.
- **Filtros**: `?responsavel=jean` → 1 · `maria` → 1 · `sem` → **30** · `?responsavel=aldo` → sem
  filtro aplicado (FR-008). 30 + 1 + 1 = 32 ações, fecha.
- **Sem `DATABASE_URL`** (dev em `:3009`): 32 linhas, **zero seletor**, 32 pills "sem
  responsável", banner de setup — a tela degrada e não cai (FR-010).
- **Teclado**: check → Jean → Maria → contexto, todos focáveis, `outline` visível,
  `aria-pressed` correto. Botões de 26px (WCAG 2.2 AA pede 24; o `.ag-check` vizinho tem 22).
- **Console limpo.** ⚠️ O único erro que apareceu na sessão foi artefato do meu setup —
  credenciais embutidas na URL (`http://user:pass@host`) quebram o `fetch` de server action do
  Next. Não é bug da feature; para verificar a agenda no navegador, suba o dev com `HUB_PASS=`
  em vez de pôr a senha na URL.

## O que NÃO foi feito, de propósito

- **Nenhuma ação foi atribuída.** As 32 estão "sem responsável" — a alocação é decisão do Jean,
  e o link do rodapé leva direto para a lista do que falta decidir.
- **Nada valida "toda ação precisa ter dono" bloqueando a tela.** A regra é cobrada por
  visibilidade (pill de alerta + filtro), nunca por travar o uso da agenda.
- **A atribuição não entra no score.** Responsável particiona a lista; não reordena nada.
