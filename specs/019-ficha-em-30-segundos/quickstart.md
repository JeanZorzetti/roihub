# Quickstart — como reproduzir, verificar e não se enganar

> **Nenhum número desta spec pode virar constante.** Os valores abaixo são de **06/09/2026** e vão
> estar errados na implementação: a janela de CONVERSAO cresce todo dia. O que se testa é a
> **regra**; o banco é o oráculo, sempre no momento da verificação.

---

## 0. SC-000 — medir ANTES de editar (primeira tarefa, sem exceção)

Medir depois do conserto mede o conserto. Mesma disciplina da SC-000 da 018 e de
`first_run_measures_the_check`.

```
Playwright em https://hub.roilabs.com.br/okr/atma
  - 1280×800: altura total do documento, e o que está acima da dobra
  - 360×640 : altura total do documento
Registrar em handoff/ com data, build e as duas capturas.
```

Referência de 03/09/2026: **5.267px em 360px**. Se a medição de hoje der outra coisa, é a de hoje
que vale — e a diferença já é informação.

---

## 1. O oráculo: rodar as queries direto no banco da Atma

`ATMA_DATABASE_URL`. Leitura apenas — nenhuma escrita, nenhum DDL.

```sql
-- 0) BLOQUEANTE: a chave primária de patient_leads existe e se chama o quê?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'patient_leads' ORDER BY ordinal_position;

-- 1) a cadeia da janela (época 2026-07-31 → hoje)
SELECT count(*) FILTER (WHERE created_at::date >= '2026-07-31')                                AS leads,
       count(*) FILTER (WHERE motivo IS NOT NULL AND motivo <> 'sem_resposta')                 AS respondeu,
       count(*) FILTER (WHERE motivo IS NULL)                                                  AS indeterminados
FROM patient_leads WHERE created_at::date >= '2026-07-31';

-- 2) a palitagem — quem domina a perda
SELECT motivo, count(*) FROM patient_leads
WHERE created_at::date >= '2026-07-31' GROUP BY motivo ORDER BY 2 DESC;

-- 3) o pipeline: enviados, vivos, perdidos, órfão
SELECT o.id, o.paciente_lead_id, l.motivo,
       o.preco, o.desconto_vista,
       o.preco * (1 - coalesce(o.desconto_vista, 0)) AS liquido
FROM orcamentos o LEFT JOIN patient_leads l ON l.id = o.paciente_lead_id
WHERE o.criado_em::date >= '2026-07-31' ORDER BY o.criado_em;

-- 4) a coluna que não separa nada (FR-013a)
SELECT status, count(*) FROM orcamentos GROUP BY status;
```

**O que a query 4 tem que continuar mostrando**: um valor só (`enviado`). Se um dia mostrar dois, a
FR-013a merece reexame — mas até lá, "fechado" vem do degrau `tratamento`.

Em 06/09/2026 a query 3 deu **9 orçamentos, R$ 44.945,43**, de 5 pessoas + 1 órfão sem
`paciente_lead_id` (R$ 4.490,00), 2 ainda vivos (R$ 11.970,00). **O handoff de 05/09 registra 7 e
R$ 37.465,43** — a diferença de um dia é exatamente a razão de nenhum desses números poder entrar
em código ou teste.

---

## 2. Rodar a suíte

```bash
npm test
```

Zero arquivo de teste novo nesta spec: buracos e valor em risco em `test/okr.test.mjs`, a guarda
partida em `test/projecao.test.mjs`, janelas longas em `test/janelas.test.mjs`, costura da época em
`test/arvore-metas.test.mjs`. Todos já na lista do `package.json` — `test/validade.test.mjs`
continua fechando lista × diretório nos dois sentidos.

**Se algum teste de N0–N6 precisar ser editado, pare**: a FR-019 diz que `montarNiveis()` não muda
de saída, e um teste reescrito ali é sinal de que a mudança saiu do escopo (US4-AC2).

---

## 3. Verificar no navegador (o critério de aceitação real)

| SC | como verificar | reprova quando |
|---|---|---|
| **SC-001** | `/okr/atma` a 1280×800, **sem rolar**: dizer em voz alta qual degrau é o pior, por que, e o que fazer. Captura da dobra com as três respostas apontadas | qualquer das três exige rolagem |
| **SC-002** | contar as linhas da lista de buracos da atma | mais de 2 linhas, ou alguma com `tela-nao-le` |
| **SC-003** | procurar **10,1 tratamentos até 31/12/2026** e, na mesma tela, o motivo de a meta não se dividir para trás | um dos dois lados ausente |
| **SC-004** | comparar `enviados · fechados · vivos` com a query 3 **no momento da verificação**; conferir que o órfão está nomeado à parte | qualquer soma `enviados ÷ meta` ou barra de progresso na tela |
| **SC-005** | `/okr/<slug>/metodo` nos 17 slugs; N0–N6 **e** a árvore; nenhuma árvore na ficha | rota 404 em algum projeto, ou árvore ainda na ficha |
| **SC-006** | `/okr/<slug>/aquisicao` nos 17; na atma, 8 meses de GSC e 12 de GA4, cada número com a janela real ao lado | número sem janela, ou janela pedida exibida no lugar da recebida |
| **SC-007** | `/okr` antes × depois: mesma célula `visitante` e **mesmo ranking** nos 17 | qualquer troca de posição |
| **SC-008** | procurar taxa cujo numerador e denominador venham de janelas diferentes, nas três telas | existir uma |
| **SC-009** | árvore da atma desce de impressão até venda dentro da época; projeto sem `epoca` para onde para hoje | camada de impressões compondo períodos |
| **SC-010** | `npm test` verde | vermelho |

**SC-007 é a regressão que importa**: mexer na tela da atma não pode mudar o placar de mais ninguém.
Capturar `/okr` **antes** de começar, e comparar no fim.

---

## 4. Armadilhas conhecidas desta spec

1. **A primeira checagem depois do push mente.** O roihub deploya por push mas leva ~15 min
   (`roihub_push_nao_deploya`). Conferir a tela **duas vezes**, espaçadas.
2. **A working tree tem outros escritores** (`roihub_working_tree_has_other_writers`): conferir
   **conteúdo** de arquivo, não `git diff`.
3. **Janela de push** (Princípio IV): nada entre 23:30–01:00 e 08:00–08:45 BRT.
4. **Constante de contagem em teste é reprovação**, não descuido (FR-016, SC-004). Um teste contra
   "9 orçamentos" reprovaria hoje mesmo — ontem eram 7.
5. **`R$ 0,00 enviados` não existe.** Sem orçamento na janela o bloco some (FR-017); um zero
   formatado lê como fato apurado sobre um projeto que não tem a fonte.
6. **Lista de buracos vazia não some** (FR-005): diz que está vazia. Sumir em silêncio é
   indistinguível de não ter sido calculada.
7. **Altura não é meta** (FR-038). Se couber em 1.500px e não passar no teste dos 30 segundos, não
   adiantou. A sequência dos blocos é o requisito; a altura é consequência.
