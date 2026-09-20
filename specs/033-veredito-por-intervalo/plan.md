# Implementation Plan: O veredito sai do intervalo da amostra, não de um piso de impressões

**Branch**: `033-veredito-por-intervalo` | **Date**: 2026-09-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/033-veredito-por-intervalo/spec.md`

## Summary

Trocar o critério de suficiência de amostra de **contagem de impressões**
(`PISO_IMPRESSOES_VEREDITO = 100`) por **exclusão da régua pelo intervalo de confiança de 95% da
própria amostra**, calculado pelo **intervalo de Wilson**. O método não foi escolhido por
preferência: Wilson a 95% **reproduz os dois números que a spec publica** — `0/21` devolve
`[0,0% ; 15,5%]` e `3/105` devolve `[1,0% ; 8,1%]`, ambos conferidos aritmeticamente em
`research.md` §R1. A aproximação normal reprova a FR-003 por devolver limite inferior negativo.

A mudança tem três entregas encadeadas:

1. **Um módulo folha novo** (`lib/intervalo.mjs`) com Wilson e as duas formas de veredito — contra
   régua escalar (US1/US2) e contra faixa do board (US3) — e a família por URL de
   `lib/kpis-busca.mjs` reescrita para emitir `atinge` / `abaixo` / `indecisa`, publicando o Índice
   de Conformidade nas duas leituras (por página com meta, por tráfego sem meta) e nomeando a
   página de maior impressão entre as decididas.
2. **Seis faixas de posição derivadas de `BENCHMARK`**, nunca uma segunda lista, agregadas a partir
   da leitura por página com a janela declarada.
3. **O mapa de `/gsc/mapa` passa a ler o real medido**, o que reverte por escrito a decisão de
   19/09/2026 de a tela não ler dado de projeto nenhum (ver Complexity Tracking).

O piso fixo **sai do repositório inteiro**, não de um chamador: são 6 pontos em `lib/` e ~18 em
`app/okr/[slug]/aquisicao/page.tsx`, enumerados em `research.md` §R6. Consertar o chamador e deixar
a constante viva é o defeito que este hub já pagou seis vezes.

## Technical Context

**Language/Version**: JavaScript ESM (`.mjs`) para a lógica pura + TypeScript 5.9 só na borda. Node 22.

**Primary Dependencies**: Next.js 16 (App Router), React 19, `mind-elixir` 5.15.1,
`google-auth-library` 10. **Zero dependência nova** — Wilson é forma fechada e só usa `Math.sqrt`.

**Storage**: nenhuma escrita nova. Leitura do Search Console na janela de descoberta
(`descoberta()` de `lib/janelas.mjs`, 28 dias fechando em D-3), via `gscPaginas()`. Nada em `pg`.

**Testing**: `node:test` + `assert/strict`. Arquivos `test/*.test.mjs` registrados **à mão** na lista
explícita de `package.json` no mesmo commit (Princípio II). Suíte inteira em ~1,6 s.

**Target Platform**: Linux/Alpine em Docker no EasyPanel (`output: "standalone"`), dev em Windows.

**Project Type**: aplicação web Next.js monolítica (App Router), com a lógica medível em `.mjs`.

**Performance Goals**: nenhuma requisição nova ao Search Console por render — `/gsc/mapa` adota o
mesmo `revalidate = 3600` de `/okr/[slug]/aquisicao`. Wilson é O(1) por linha; o pior caso real
medido é 29 URLs (Atma, 20/09/2026), agregadas em 6 faixas.

**Constraints**: `lib/intervalo.mjs` é FOLHA da árvore de dependências (zero imports), pelo mesmo
motivo de `lib/janelas.mjs` — `scripts/` importa sem arrastar `pg` nem `google-auth-library`. Sem
framework de teste, sem linter, sem formatter (estilo do arquivo vizinho). Comentário explica o
**porquê**, com o fato medido que motivou a linha.

**Scale/Scope**: 6 faixas × 1 projeto no mapa; 29 URLs / 24 com régua / 4 decididas na Atma.
Tocados: 3 libs (`intervalo.mjs` novo, `kpis-busca.mjs`, `gsc-delta.mjs`), mais `board-gsc.mjs`,
2 telas (`app/okr/[slug]/aquisicao/page.tsx`, `app/gsc/mapa/{page.tsx,mapa.tsx}`), 4 arquivos de teste.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constituição v1.0.0 (ratificada 2026-08-29). Os cinco princípios, cada um como portão cobrável:

| # | Princípio | Como esta feature o atende | Antes da Fase 0 | Após a Fase 1 |
|---|---|---|---|---|
| I | Contrato único de dados — `listProjects()` é o único ponto de leitura de projeto | `/gsc/mapa` passa a precisar dos hosts da Atma e os obtém por `listProjects()` + `hostsDeclarados()`, como `app/okr/[slug]/aquisicao/page.tsx` já faz. **Nenhum import de `data/projects.json`.** | ✅ | ✅ |
| II | Teste é `node --test`, registrado à mão | `test/intervalo.test.mjs` é novo e entra na lista de `package.json` **no mesmo commit**. `test/validade.test.mjs` já reprova divergência nos dois sentidos. Sem jest/vitest. | ✅ | ✅ |
| III | `.mjs` para lógica pura, `.ts` só na borda | Wilson, os dois vereditos, as seis faixas, o índice nas duas leituras e a escolha da página nomeada são **todos** `.mjs`. As telas só formatam. Nenhuma conta nova em `.tsx`. | ✅ | ✅ |
| IV | Push é deploy — a janela noturna é intocável | Sem push em 23:30–01:00 e 08:00–08:45 BRT. A feature não altera `maxDuration` de rota nenhuma, então não há ajuste de proxy do EasyPanel a fazer. | ✅ | ✅ |
| V | Ambiente explícito, segredo nunca em log | `/gsc/mapa` passa a depender de `GOOGLE_SERVICE_ACCOUNT_JSON`. É **página**, não rota, então o `503` do princípio não se aplica: o contrato é o de `gscPaginas()` — `null` = "não há onde olhar", `{erro}` = falha transitória —, e a tela renderiza os dois como estado **nomeado**, nunca como `0%`. Nenhum nome de variável, valor ou prefixo em log. | ✅ | ✅ |

**Portões de merge** (seção "Fluxo de Desenvolvimento e Portões de Qualidade"), todos aplicáveis:

1. `npm test` verde na suíte inteira — não só nos arquivos tocados.
2. Todo arquivo de teste novo registrado em `package.json`.
3. Nenhum import direto de `data/projects.json` fora de `lib/projects.*`.
4. Nenhum segredo em log, resposta ou mensagem de erro.

**Nenhuma violação de MUST sem justificativa registrada.** As duas reversões de decisão documentada
estão na tabela de Complexity Tracking, com a alternativa mais simples e o motivo da recusa.

### O portão que a constituição não escreve, e esta feature precisa

A constituição não tem portão de **design de informação**, e as FR-006, FR-010, FR-012 e as SC-006 a
SC-010 são todas sobre leitura de tela. O harness de `information-design` foi rodado nos passos 0 a 3
(pré-voo, pergunta única, inventário do dado real, escolha da forma) e o resultado está em
`research.md` §R7 e em `data-model.md`. Os passos 5 a 8 do harness — construir, os 32 gates, a prova
em Playwright e o registro em `.info/log.json` — pertencem ao `speckit-implement`, **não** a este
plano, e estão escritos como critério de saída em [quickstart.md](./quickstart.md).

## Project Structure

### Documentation (this feature)

```text
specs/033-veredito-por-intervalo/
├── spec.md              # Entrada
├── plan.md              # Este arquivo
├── research.md          # Fase 0 — as 7 decisões, com a aritmética
├── data-model.md        # Fase 1 — as 7 entidades e os 5 estados de tela
├── contracts/
│   ├── intervalo.md     # A folha nova: Wilson e os dois vereditos
│   ├── kpis-busca.md    # A família por URL reescrita + as seis faixas
│   └── telas.md         # O que cada nó e cada leitura declara nas duas telas
├── quickstart.md        # Fase 1 — como validar que a feature funciona
├── checklists/
│   └── requirements.md  # Já existente, aprovado em 20/09/2026
└── tasks.md             # Fase 2 — NÃO criado por /speckit-plan
```

### Source Code (repository root)

```text
lib/
├── intervalo.mjs              # NOVO · folha, zero imports. Wilson + veredito contra régua e faixa
├── kpis-busca.mjs             # REESCRITO na família por URL: FAIXAS, porFaixaDePosicao(),
│                              #   conformidadeDeCtr(), paginaNomeada(); PISO_IMPRESSOES_VEREDITO SAI
├── gsc-delta.mjs              # seloDaMedida()/limiarEmTexto() perdem o piso; CTR_PISO ganha a
│                              #   condição de SERP (FR-008); cliquesNaoCapturados() migra
├── board-gsc.mjs              # DIVERGENCIAS.ctrPorPosicao reaponta para a régua que julga (FR-005)
├── janelas.mjs                # INTOCADO — descoberta() é a janela desta feature
└── projects.ts                # INTOCADO — o contrato único por onde o mapa lê os hosts da Atma

app/
├── gsc/mapa/
│   ├── page.tsx               # force-static → revalidate = 3600; lê a Atma e as 6 faixas
│   └── mapa.tsx               # o nó da faixa carrega base/janela/veredito no TOPIC (note não renderiza)
└── okr/[slug]/aquisicao/
    └── page.tsx               # as duas leituras do índice, a página nomeada, os 5 estados, o segmento

test/
├── intervalo.test.mjs         # NOVO · Wilson contra os números da spec + as bordas de veredito
├── kpis-busca.test.mjs        # as seis faixas, as duas leituras, a página nomeada
├── gsc-delta.test.mjs         # as asserções de piso saem; a condição de SERP entra
└── board-gsc.test.mjs         # a divergência reaponta

package.json                   # test/intervalo.test.mjs na lista explícita (Princípio II)
```

**Structure Decision**: monolito Next.js já existente, sem estrutura nova. A lógica nasce em
`lib/*.mjs` porque é testável sem subir o Next (Princípio III) e porque `scripts/` precisa poder
importá-la; as telas em `app/` só formatam o que a lib devolve. `lib/intervalo.mjs` é módulo novo em
vez de mais funções em `lib/kpis-busca.mjs` por dois motivos: a US3 compara contra uma **faixa** e as
US1/US2 contra uma **régua escalar**, e as duas formas precisam existir sem que a segunda importe a
família por URL inteira; e um módulo folha de ~60 linhas é verificável contra os dois números
publicados da spec sem carregar mais nada.

## Complexity Tracking

> Duas decisões documentadas do repositório são **revertidas** por esta feature. Nenhuma é violação
> de princípio da constituição, mas a Governance manda que conflito com documento existente seja
> corrigido no mesmo commit, e não descoberto depois comparando dois arquivos.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **`/gsc/mapa` deixa de ser `force-static` e passa a ler dado de projeto.** O cabeçalho de `app/gsc/mapa/page.tsx` declara em ⚠️ que "ESTA TELA TAMBÉM NÃO LÊ DADO DE PROJETO NENHUM", com o motivo: repetir os números da Atma daria duas telas discordando sobre o mesmo KPI. | A US2 é P1 e a FR-005 é explícita: *o mapa* MUST mostrar, em cada faixa, a base e o veredito. Nenhuma outra tela do hub tem a faixa de posição como unidade — a aba de aquisição lê por URL e por termo. E o board é o da **Atma**, não do portfólio, então a tela lendo a Atma é coerente com o escopo dela. | (a) **Publicar as seis faixas só em `/okr/atma/aquisicao`** e o mapa apenas linkar: recusado porque a FR-005 nomeia o mapa, e porque a faixa não é unidade daquela tela. (b) **Manter `force-static` e congelar os números no build**: recusado porque número de janela móvel congelado em build vira `dado velho` sem carimbo — o defeito da própria spec um nível acima. (c) O risco original ("duas telas discordando") é **neutralizado por construção**, não aceito: as duas telas consomem a MESMA `porFaixaDePosicao()`, e discordar exigiria duas implementações, que é o que a função única impede. |
| **`PISO_IMPRESSOES_VEREDITO` é removido, e com ele a derivação da 026** — `test/kpis-busca.test.mjs:473` afirma a propriedade "1 impressão vale no máximo 1 ponto" sobre a constante, e `lib/gsc-delta.mjs` a usa no selo `piso`, em `limiarEmTexto()` e na re-exportação. | FR-009: o piso fixo MUST deixar de existir como critério de veredito em **todas** as medidas que o usam hoje. Deixar a constante viva com um único chamador é exatamente `guarda_no_chamador_volta_pela_porta_seguinte` — o padrão que este hub já pagou 6 vezes. | (a) **Manter a constante como piso de exibição** (não de veredito): recusado porque dois critérios de suficiência de amostra no mesmo painel é o que a US3 existe para eliminar, e porque "piso que não decide nada" é um selo que o leitor lê como decisão. (b) **Deprecar sem remover**: recusado pelo Princípio II — constante sem consumidor não é coberta por teste nenhum, e a próxima feature a encontra e a usa. A derivação da 026 **não se perde**: migra para o comentário de `LIMIAR_PAGINAS_DECIDIDAS = 20`, onde a spec já escreveu por que os dois critérios divergem (faixa de 5 pontos → `n ≥ 20`, contra as 200 páginas que o critério da 026 pediria). |
