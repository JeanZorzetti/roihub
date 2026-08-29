# Quickstart — validar os Quadros de Marketing e Ideias

**Feature**: `006-quadros-marketing-ideias`

Como provar que a feature funciona de ponta a ponta. Roteiro de validação, não de implementação.

---

## Pré-requisitos

```bash
node --version          # 22.x
```

`.env` na raiz com `DATABASE_URL` apontando para o Postgres do hub. Sem ele as duas abas mostram o
aviso de configuração (igual à Agenda e ao CRM) e nada é gravado — esse é o **primeiro cenário a
verificar**, não um impedimento.

As tabelas são criadas sozinhas no primeiro acesso pelo `ensure()` de `lib/db.ts`. **Não há passo de
migração manual.**

```bash
npm run dev             # http://localhost:3000
```

---

## 1. Testes puros (sem banco, sem rede)

```bash
npm test
```

Tem que passar **inteiro**, não só o arquivo novo — SC-004 é "as abas existentes continuam se
comportando como antes", e a suíte é a prova.

> ⚠️ **`test/pauta.test.mjs` precisa estar na lista explícita do `package.json`.** A lista é
> escrita à mão; arquivo não registrado nunca roda, e teste que não roda não reprova nada. O
> `test/validade.test.mjs` compara a lista com o disco nos dois sentidos e pega o esquecimento —
> mas contar com isso é contar com a rede de segurança em vez do procedimento.

Cobertura mínima esperada em `test/pauta.test.mjs` (tudo puro, zero banco):

| Alvo | Casos que não podem faltar |
|---|---|
| `gradeDoMes` | mês começando no domingo, fevereiro bissexto, virada de ano |
| `mesVizinho` | dezembro → janeiro do ano seguinte, e o inverso |
| `validarAnexo` | mime recusado, tamanho acima do teto, 21º arquivo |
| `validarColunaRemovivel` | coluna com cards, última coluna, coluna vazia |
| `agruparPorColuna` | coluna vazia **continua na saída** (FR-030) |
| `agruparPorDia` | card sem data não aparece em dia nenhum |
| `lerFiltros` | valor desconhecido vira "sem filtro", nunca filtro que não casa |
| `podeLiberar` | 29 dias não, 30 dias sim, card não arquivado nunca |

---

## 2. Quadro de Ideias (US1)

1. Abrir `/ideias` — três seções semeadas: Produto novo, Melhoria, Gaveta.
2. Criar um card com título, descrição, projeto e responsável. **Recarregar**: continua na seção.
3. Mover para outra seção. Recarregar: mudou de lugar. ✅ SC-001, SC-002
4. Arquivar um card: sai da lista e aparece na área recolhida.
5. Filtrar por responsável; conferir que o filtro está na URL e sobrevive ao recarregar.
6. **Abrir `/agenda` e o ranking**: nenhum card das Ideias aparece. ✅ SC-003

---

## 3. Quadro de Marketing (US2, US3)

1. Abrir `/marketing` — quatro colunas: Pauta, Produzindo, Agendado, Publicado.
2. Criar card com canal, data e projeto. Mover pelas colunas.
3. Filtrar por canal: **as quatro colunas continuam na tela**, inclusive as que esvaziaram. ✅ SC-006 *(FR-030)*
4. Adicionar uma coluna nova pelo `+`. Renomear. Mover de posição. ✅ SC-005
5. **Renomear uma coluna que tem cards** e conferir que nenhum card se moveu ou sumiu. *(FR-015)*
6. **Tentar apagar uma coluna com card dentro**: recusado, com a contagem na mensagem. ✅ SC-006
7. Esvaziar essa coluna e apagar: agora vai.
8. **Tentar apagar a última coluna restante**: recusado. *(FR-014)*

---

## 4. Anexos e carrossel (US4)

1. Anexar uma imagem a um card. Recarregar: continua lá.
2. Anexar mais nove. Conferir a ordem dos slides, nome e tamanho de cada um. ✅ SC-007
3. Reordenar dois slides e remover um; conferir que a ordem dos demais se manteve.
4. **Subir um arquivo de ~3 MB** e confirmar que chega inteiro — é a verificação que R-002 deixou
   pendente sobre o limite de corpo do Route Handler. Se truncar, o conserto é `bodySizeLimit` no
   `next.config.mjs`, mas **meça antes de mexer**.
5. Tentar subir um `.pdf` → recusado com motivo. Tentar subir 4 MB → recusado com motivo. ✅ SC-008
6. Copiar a URL de uma imagem e abrir **numa janela anônima**: tem que pedir senha. ✅ *(FR-023)*
7. Apagar um card com anexos e conferir no banco que as linhas de anexo foram junto. *(FR-021)*

---

## 5. Calendário (US5)

1. Marcar datas em cards de dois meses diferentes.
2. `/marketing?vista=calendario` — cada card no seu dia, canal identificado. ✅ SC-009
3. Navegar para o mês seguinte e voltar; conferir que os filtros continuam aplicados.
4. Card **sem** data não aparece em dia nenhum e continua acessível no kanban.
5. Copiar a URL e abrir em outra janela: mesmo mês, mesmos filtros. *(FR-027)*

---

## 6. Documentação (US6)

1. `/marketing?vista=docs` — criar um documento de processo e um de estudo.
2. Anexar uma imagem a um documento.
3. Conferir que **nenhum dos dois aparece** no kanban nem no calendário. *(FR-026)*

---

## 7. Retenção (US7)

O cenário mais difícil de validar, porque envolve 30 dias. Três formas, da mais fraca à mais forte:

1. **Unitário** (é a que conta): `podeLiberar()` com datas fabricadas — 29 dias não libera, 30 sim,
   card não arquivado nunca libera. Sem banco, sem esperar.
2. **Manual no banco**: arquivar um card com imagens, depois
   `UPDATE hub_pauta SET arquivado_em = now() - interval '31 days' WHERE id = …`, recarregar a aba e
   conferir que os bytes sumiram e o registro ficou. ✅ SC-010
3. **Dentro da carência**: arquivar, conferir o aviso com a data de liberação, **restaurar** e ver as
   imagens intactas. ✅ SC-011

Depois da liberação, conferir na tela que ainda se lê: título, descrição, canal, data, link do post e
a lista dos arquivos que existiram (nome, formato, tamanho, ordem). Abrir a URL de um anexo liberado
tem que dar **`410 Gone`**, não `404` — a diferença entre "expirou" e "nunca existiu" é justamente o
que a retenção preserva.

Conferir também o contador de espaço no topo da aba. ✅ SC-012

---

## 8. Antes de fechar

```bash
npm test          # verde, inteiro
npm run build     # o build tem que passar — o deploy é imagem Docker
```

- `git status` não pode mostrar mudança em `app/agenda/*`, `lib/evaluate.ts`, `data/projects.json`,
  `middleware.ts` ou em qualquer workflow do `.github/`. **Os únicos existentes que mudam são
  `app/tabs.tsx`, `lib/db.ts` e `package.json`.** ✅ SC-004
- **Não dar push entre 23:30 e 01:00 BRT.** São dois crons na janela — estado noturno às 23:37 e
  autopublishing às 00:13 — e um deploy no meio derruba a publicação de 10 projetos ou a corrida do
  estado.
