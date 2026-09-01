# Implementation Plan: Projeção invertida — da meta para o fator obrigatório

**Branch**: `010-okr-projecao-invertida` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

## Summary

Um módulo `.mjs` novo que divide a **meta declarada** pela **cadeia apurada** e devolve quanto o
resto do funil precisa valer — mais um bloco na `/okr` existente que mostra isso ao lado do
veredito da 009.

A 009 para na posição 3 porque projetar **pra frente** exige benchmark, e a R6 proíbe. Esta
feature vai **pra trás**: `meta ÷ cadeia` é divisão, não estimativa, e nenhum número novo entra no
sistema — entram a meta e o ticket, que são declarações do humano, rotuladas como declaradas. O
teto de 100% cai de graça como teste de viabilidade: fator obrigatório maior que 1 prova que a
meta é aritmeticamente impossível com o volume atual, e é a única saída do sistema que pode dizer
"essa meta é fantasia" com prova em vez de opinião.

Quase tudo já existe. `montarFicha()` produz a cadeia com as células; `razao()` é a razão; a
página já coleta GSC, CRM e vendas por request. O que entra é: o campo `meta` no card, a eleição
da âncora, a normalização de prazo para janela, e a divisão.

## Technical Context

**Linguagem**: JS puro `.mjs` com JSDoc para a lógica; TypeScript `.tsx` só na página
(Princípio III). Node 22.

**Dependências**: nenhuma nova. Nenhuma consulta nova a banco, GSC ou rede — a inversão é
aritmética sobre células que a 009 já produz.

**Armazenamento**: `data/projects.json`, campo `meta` curado à mão. Sem migração, sem tabela, sem
escrita em runtime.

**Testes**: `test/projecao.test.mjs`, `node:test` + `assert/strict`, registrado na lista de
`npm test` do `package.json` no mesmo commit (Princípio II, FR-016).

**Plataforma**: Next.js 16 App Router, React 19. Deploy Docker/EasyPanel (`output: "standalone"`),
dev em Windows.

**Tipo de projeto**: aplicação web — rota existente `/okr`, `dynamic = "force-dynamic"`.

**Escala**: 40 projetos, ~6 degraus por cadeia. Custo da feature é O(degraus) por projeto sobre
dados já em memória; o tempo da página continua sendo o do GSC.

**Restrições**: R1 (`não apurado` nunca é `0`), R2 (fração colada em toda razão), R6 (nada de
benchmark como meta), R7 (uma janela declarada — 28 dias fechando em D-3). A página continua
sendo leitura pura.

## Constitution Check

*GATE: passa antes da Fase 0 e revalidado após a Fase 1.*

| Princípio | Como esta feature cumpre | Pós-Fase 1 |
|---|---|---|
| **I. Contrato único de dados** | `meta` entra no tipo `Project` de `lib/projects.ts` e chega pela `listProjects()`. Nenhum import de `data/projects.json` fora de `lib/projects.*`. O campo atravessa o spread de `mergeProjects()` pelo mesmo caminho de `perfil` e `vendas` — dentro do contrato, não ao lado dele. | ✅ ver `contracts/meta-no-card.md` |
| **II. `node --test` registrado à mão** | `test/projecao.test.mjs` novo, adicionado à lista de `npm test` no mesmo commit. `test/validade.test.mjs` reprova se eu esquecer. Nenhum framework instalado. | ✅ |
| **III. `.mjs` puro, `.ts` na borda** | `lib/projecao.mjs` é pura: sem env, sem banco, sem rede, sem relógio — `hoje` entra como parâmetro (D3). `app/okr/page.tsx` só busca e renderiza. | ✅ |
| **IV. Push é deploy** | Feature de leitura. Sem cron, sem `maxDuration`, sem rota nova. Push fora de 23:30-01:00 e 08:00-08:45 BRT. | ✅ |
| **V. Ambiente explícito, segredo nunca em log** | Nenhuma variável de ambiente nova. A feature não toca em segredo; os motivos de `não apurado` nomeiam campos do card, não valores. | ✅ |

**Sem violação.** Tabela de Complexity Tracking vazia.

Nota sobre a R6, que é regra do template e não da constituição, mas é o gate real desta feature:
a inversão só divide. Nenhum caminho do código produz um número que não seja (a) medido pelos
coletores da 009 ou (b) declarado à mão no card e rotulado como declarado. A garantia G2 do
contrato existe para ser testada, não para ser prometida aqui.

## Decisões de desenho

Detalhadas em [research.md](./research.md); resumo com o motivo de uma linha:

| # | Decisão | Por quê |
|---|---|---|
| **D1** | `lib/projecao.mjs` novo, não `okr.mjs` estendido | o comentário de `posicaoDeAtaque()` declara onde a 009 para; a 010 é ao lado, não a continuação |
| **D2** | **FR-005 literal**: a âncora pode ser o degrau final | a exclusão que eu tinha proposto consertava um caso que **nenhum dos 17 projetos alcança** — torcer requisito por exemplo inalcançável |
| **D3** | Uma fórmula de normalização só, contando de **hoje** | encurtar a janela e escalar a meta são algebricamente idênticos; contar da declaração congelaria o sinal que a US2 existe para dar |
| **D4** | Múltiplo de volume = múltiplo de ticket = o próprio fator | sai da mesma divisão relida, sem número de referência (R6) |
| **D5** | `meta` curada no card; `valor` é **o que falta** | descontar o realizado seria acompanhamento, que a spec proíbe — o desconto vira curadoria |
| **D6** | A "coluna" é um bloco no card | a `/okr` não é tabela de projetos; coluna literal quebra em 390px |
| **D7** | **`exigencia()` exportada de `lib/funil.mjs`**, colada em `razao()` | `razao()` é hoje a ÚNICA divisão em `lib/*.mjs`; a segunda tem que nascer adjacente ou as duas regras divergem |
| **D8** | Fator > 1 nunca é formatado como percentual de célula | SC-005; o 187% é prova dentro de uma frase, não medição numa célula |
| **D9** | **Dois campos exclusivos**, e o teto de 100% preso ao da taxa | um `if` só declararia "impossível" numa cadeia fechada que só precisa crescer 2× |
| **D10** | **`declaradaEm`** exibido, e a tela nunca recusa por idade | `valor` só se atualiza à mão; limiar de "velha demais" seria benchmark disfarçado |

## Project Structure

### Documentation (this feature)

```text
specs/010-okr-projecao-invertida/
├── spec.md                     ← escrito
├── plan.md                     ← este arquivo
├── research.md                 ← Fase 0: D1-D8
├── data-model.md               ← Fase 1: Meta, Âncora, Normalização, Projeção
├── contracts/
│   ├── projecao-mjs.md         ← API pública + garantias G1-G8 + regras de renderização
│   └── meta-no-card.md         ← o campo `meta` em data/projects.json e no tipo Project
├── quickstart.md               ← Fase 1: validação por SC
├── checklists/requirements.md  ← escrito
└── tasks.md                    ← /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
lib/
├── funil.mjs        +exigencia() colada em razao() (D7). Nada existente é alterado.
├── okr.mjs          (intocado — a ficha entra pronta em projetar())
├── projecao.mjs     NOVO: ancoraDe(), projetar()
└── projects.ts      +meta no tipo Project

app/okr/
└── page.tsx         +bloco de projeção no card, +item na seção "O que isto NÃO vê" (FR-018)

data/
└── projects.json    +meta SÓ no card da atma (os outros 39 seguem sem — Q4)

test/
├── funil.test.mjs     +casos de exigencia() (arquivo já registrado)
└── projecao.test.mjs  NOVO (registrado em package.json no mesmo commit)

package.json         +test/projecao.test.mjs na lista de `npm test`
```

**Structure Decision**: aplicação web Next.js já existente, sem separação frontend/backend. A
lógica pura vai para `lib/*.mjs` e a borda para `app/okr/page.tsx`, exatamente como a 009 fez —
nenhuma estrutura nova de diretório é criada.

## Cobertura dos requisitos

| FR | Onde | FR | Onde |
|---|---|---|---|
| FR-001 | `contracts/meta-no-card.md`, D5 | FR-010 | `Projecao.multiplo` / `.folga`, D2 |
| FR-002 | regra de renderização R-c | FR-011 | R-a, SC-004 |
| FR-003 | guarda 4, `n1Total` | FR-012 | garantia G2 |
| FR-004 | `Normalizacao`, D3 | FR-013 | garantia G1, D6 |
| FR-005 | `ancoraDe()`, D2 | FR-014 | D6 |
| FR-006 | `fatorObrigatorio` | FR-015 | contrato de imports, D7 |
| FR-007 | veredito `impossivel`, D8 | FR-016 | quickstart §1, Princípio II |
| FR-008 | `multiploDeVolume`, R-e, D4 | FR-017 | `contracts/meta-no-card.md`, Princípio I |
| FR-009 | `degrausAMedir`, garantia G6 | FR-018 | regra de renderização R-f |

FR-006/FR-007 valem só no ramo da taxa; FR-010 só no ramo do múltiplo — ver D9 e as garantias
G4/G9.

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| A âncora da `atma` mudar de degrau quando `contatado` passar a ser medido, alterando o fator sem ninguém notar | os degraus a medir são exibidos nominalmente (FR-009): quando a lista encurta, a tela mostra |
| Teste amarrado aos números datados da `atma` (`lead = 39`) apodrecer | cadeia **sintética** com `hoje` fixo no teste; conferência com `atma` é manual e datada — nota do `checklists/requirements.md`, quickstart §2 |
| A tela ganhar 40 blocos de `não apurado` e virar ruído | o bloco sem meta é uma linha `.foot`, não um card — D6, mesmo padrão do `.sem-site` da home |
| `meta` escrita à mão com prazo no passado passar despercebida | guarda 6 exibe `prazo vencido em <data>`; é `não apurado`, não um fator errado |
| **`valor` apodrecer**: escrito há 90 dias e ainda lido como "o que falta hoje" | `declaradaEm` exibido ao lado (D10). Aceito conscientemente: invalidar por idade exigiria escolher um limiar, que é a R6 |
| **O ramo do múltiplo (D9/FR-010) nascer sem nunca ter rodado contra dado real** | zero projetos com cadeia fechada hoje. Coberto só por teste sintético, e isso está escrito no edge case da spec — a "primeira corrida mede o CHECK" agravada |

## Complexity Tracking

> Preenchido só se o Constitution Check tiver violações a justificar.

Nenhuma violação constitucional a justificar.
