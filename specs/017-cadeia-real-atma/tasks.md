# Tasks: A cadeia da `atma` é a que o app da Atma escreve

**Branch**: `017-cadeia-real-atma` · **Plan**: `plan.md`

## Nota de escopo (05/09/2026)

O que saiu do forno é MENOR que T001/T005/T006 abaixo, por decisão consciente, não por atalho:
Jean aprovou 4 mudanças pontuais discutidas em conversa (matar `aceito`, ligar `contatado` via
`status`, contar orçamento por pessoa, ler `motivo`) — não o rename completo dos `chave` dos
marcos para os slugs exatos da Atma (`novo/pre_orcamento/exames_enviados/convertido`). Os nomes
de exibição (`nome`) já refletiam a Atma (`orçamento ENVIADO` etc.); o que estava
**inventado e sem fonte** era só o marco `aceito`. Renomear `lead`/`orcamento`/`tratamento` para os
slugs exatos do enum (T001) fica em aberto — é mudança maior (toca `REGUA.D`, `arvore-metas.mjs`
por chave, e todo teste que referencia essas chaves) e não foi pedida nesta rodada.

## US1 + US2 — a cadeia certa e o `contatado` apurado (P1, mesmo commit)

- [ ] **T001** — NÃO feito nesta rodada (ver nota de escopo acima). `PERFIS.D.marcos` continua com
      as chaves `visitante/lead/contatado/orcamento/tratamento`; o que mudou foi remover o marco
      fantasma e ligar `contatado` a uma fonte real, não renomear os que já tinham fonte.
- [x] **T002** `lib/okr.mjs`: marco `aceito` removido, `STATUS_ACEITE` removido, `celulasDeOrcamento()` devolve só `{enviados}` (a chave `aceitos` não existe mais — não tem sentido "chutar o enum" quando não há enum a chutar). `PERFIS.D.fatores` recoberto: `CR(orçamento→tratamento)` agora cobre só `["tratamento"]` (o marco anterior, `orcamento`, já é o fim do fator de cima — repeti-lo acusaria sobreposição em `avaliarN2()`). `lib/benchmark.mjs`: linha `REGUA.D["orcamento→aceito"]` removida, citação (Dentx/GrowthRx/Henry Schein) preservada em comentário para quando — e se — a Atma vier a distinguir aceite de envio.
- [x] **T003** `lib/okr-coleta.ts`: `status` e `motivo` (T017 abaixo) na query de `patient_leads` — mesma query, duas colunas a mais.
- [x] **T004** `lib/okr.mjs`: `celulaDeContato(reais)` — `status <> 'novo'` sobre os leads REAIS já filtrados por `celulaDeLeads` (não reimplementa o filtro de teste). Marco `contatado` com `coletor: "contatados"`, `fonte` citando a regra declarada. Verificado contra o banco real (05/09/2026, janela 06/08→02/09): **20 de 20** leads reais contatados.
- [ ] **T005** — NÃO feito (depende de T001: sem rename, não há `visitante→novo`/`novo→contatado`/`exames_enviados→convertido` para chavear).
- [ ] **T006** — NÃO feito (mesmo motivo: o teste de espelho contra `funil.ts` faz sentido quando as chaves espelham os slugs; hoje o espelho seria com os RÓTULOS, que já são testados em `test/ficha.test.mjs`/`test/okr.test.mjs`).
- [x] **T007** `test/okr.test.mjs` (marcos.length 6→5, teste do fallback "coletor não rodou", 12 testes novos para `celulaDeContato`/`celulasDeOrcamento`/`motivosDoFunil`), `test/benchmark.test.mjs` (REGUA 10→9 linhas, degraus 17→16, 2 testes recalibrados para não referenciar `orcamento→aceito`), `test/ficha.test.mjs` (comentários), `test/arvore-metas.test.mjs` (índice do marco `tratamento` 5→4). Nenhum teste apagado; `npm test` = 567/567.

## T017 (novo, fora do plano original) — a palitagem

- [x] `lib/okr.mjs`: `motivosDoFunil(reais)` — conta por `motivo`, ordenado desc, `semMotivo` e
      `total` separados (achado da sessão: nenhum arquivo do hub lia esta coluna). Não classifica
      motivo em família D3/D4 — é taxonomia do cliente, não do hub.
- [x] `lib/okr-coleta.ts` + `app/okr/[slug]/page.tsx`: bloco "Por que não avançou" na ficha,
      só quando a fonte própria confirma o campo e há pelo menos um motivo real na janela.

## US3 — o zero que é medido (P2)

- [ ] **T008** `lib/okr.mjs`: `pre_orcamento` conta pela tabela `orcamentos` (D3); `exames_enviados` e `convertido` contam por `patient_leads.status`, com a declaração do Jean na `fonte`.
- [ ] **T009** `lib/okr.mjs` + `app/okr/[slug]/page.tsx`: contagem de órfãs (`orcamentos` sem `paciente_lead_id`) exibida quando > 0 (FR-006). Hoje: 2 de 7.
- [ ] **T010** Teste: `apurado(0)` chega ao `divisorDe()` e é recusado pela FR-003 da 016; a árvore para com motivo `pré-orçamento → exames enviados: 0 de 7` (SC-003).

## US4 — CTR × posição, com a D7 revogada (P3)

- [ ] **T011** `lib/benchmark.mjs`: `CTR_POR_POSICAO` — faixa e fonte **por linha**, nunca ponto (FR-007).
- [ ] **T012** `lib/arvore-metas.mjs`: `alavancaDePosicao()` devolve faixa de posição além do CTR necessário (FR-008), e o render na `page.tsx`.
- [ ] **T013** Teste: a tabela nunca aparece como divisor de camada; o teste "duas faixas DEVEM falhar" da 016 continua verde (FR-009).

## Pendente de decisão do Jean

- [ ] **T014** Algum lead hoje em `cancelado` chegou a mandar exames antes de cancelar?
  - **Não** → `exames_enviados = apurado(0)`, e o gargalo `pré-orçamento → exames enviados` está **provado**.
  - **Sim** → `exames_enviados = não apurado`, porque a posição atual apaga a passagem e não há log de evento. A árvore para uma camada acima e o motivo muda de "0 de 7" para "sem log de transição".
  - Só T008 e T010 dependem disso. T001-T007 e T011-T013 seguem sem a resposta.

## Portões

- [x] `npm test` verde (suíte inteira) — 567/567.
- [ ] `test/cadeia-atma.test.mjs` — não existe (T006 não feito, ver nota de escopo).
- [x] `lib/projecao.mjs` sem diff (FR-010) — confirmado, arquivo não tocado.
- [x] `grep -rn "aceito" lib/` sem ocorrência como `chave` de marco (SC-001, ajustado: `tratamento`
      continua sendo chave legítima, nunca foi o problema).
- [ ] `/okr/atma` em produção mostra `contato feito` apurado — **43 era a contagem histórica
      completa** (43 dos 51 leads sempre existentes); a janela de 30 dias que a ficha usa (R7) dá
      **20 de 20**, não 43. Verificado contra o banco real em 05/09/2026 antes do commit — SC-002
      ajustado para refletir o número que a janela realmente produz, não o da vida inteira.
- [ ] Push fora de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV) — verificar horário no momento do push.
