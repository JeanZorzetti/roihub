# Contrato: o campo `ficha` no card, e o contrato de projetos

**Feature**: `011-okr-ficha-por-projeto` | Princípio I

## 1. O campo em `data/projects.json`

Opcional, curado à mão, ao lado de `perfil`, `meta`, `estado` e `vendas`. Escrito por humano; nunca
inferido, nunca herdado, sem valor padrão (FR-013).

```jsonc
{
  "slug": "atma",
  "perfil": "D",
  "meta": { "valor": 50000, "ticket": 4000, "prazo": "2026-12-31", "declaradaEm": "2026-09-01" },
  "ficha": {
    "declaradaEm": "2026-09-01",
    "objetivo": "Atma volta a converter busca orgânica em tratamento iniciado",
    "krs": [
      { "kpi": "leads na janela", "baseline": 39, "meta": 120,
        "prazo": "2026-12-31", "dono": "jean", "celula": "n3:lead" },
      { "kpi": "consulta agendada", "baseline": null, "meta": 30,
        "prazo": "2026-12-31", "dono": "jean", "celula": "n3:agendada" }
    ]
  }
}
```

| campo | tipo | regra |
|---|---|---|
| `declaradaEm` | `"YYYY-MM-DD"` | ausente → exibido como `data não registrada`; a declaração **não** some |
| `objetivo` | `string` | uma frase, **sem número** — objetivo com número dentro é N1 disfarçado |
| `krs` | `array` | acima de 3 → todos exibidos, o excedente marcado (FR-018), nunca truncado |
| `krs[].kpi` | `string` | o nome que o humano deu |
| `krs[].baseline` | `number\|null` | `null` é legítimo: é o caso em que a célula ainda não é apurada |
| `krs[].meta` | `number` | — |
| `krs[].prazo` | `"YYYY-MM-DD"` | — |
| `krs[].dono` | `string` | ausente → `sem dono`, KR **continua visível**. Nunca inferido nem herdado do `responsavel` da ação (FR-016) |
| `krs[].celula` | `"n3:…"\|"n4:…"\|"n5:…"` | prefixo **obrigatório**; a validação não depende de os nomes serem únicos entre níveis (FR-017) |

**Ausência do campo inteiro é legítima**: o projeto abre a ficha normalmente, com N0 e os KRs em
`não apurado: sem declaração no card` e os outros seis níveis funcionando.

## 2. O tipo `Project` em `lib/projects.ts`

O campo atravessa `mergeProjects()` pelo mesmo spread de `perfil`, `meta` e `vendas` — **dentro** do
contrato, não ao lado (FR-035).

```ts
/** Declaração humana do §6 do template: o objetivo (N0) e os KRs. Curado à mão, como `perfil` e
 *  `meta`. Rotulado como DECLARADO em toda exibição, com a data — declaração sem data apodrece
 *  calada. Ausente é legítimo: a ficha abre com N0 em `não apurado` e os outros seis normais. */
ficha?: {
  declaradaEm?: string;
  objetivo?: string;
  krs?: { kpi: string; baseline: number | null; meta: number;
          prazo: string; dono?: string; celula: string }[];
};
```

## 3. `listFichas()` — a lista para o menu

```ts
/** Só os projetos com `ficha` curada, para o menu da aba OKR. Lê a curadoria direto porque `ficha`
 *  SÓ existe nela — repo vindo do GitHub nunca tem o campo, então esta lista e a de
 *  `listProjects()` concordam por construção. Sem `listRepos()`: uma barra de navegação presente em
 *  12 telas não paga chamada de rede para se desenhar. */
export async function listFichas(): Promise<{ slug: string; nome: string }[]>;
```

Registrado na tabela de Complexity Tracking do [plano](../plan.md) como a única violação assumida do
Princípio I, com a alternativa recusada e o motivo.

**Invariante**: `listFichas()` ⊆ `listProjects()` por `slug`. Um teste em `test/ficha.test.mjs`
confere isso contra a curadoria — se um dia um repo do GitHub passar a poder trazer `ficha`, o teste
reprova e a justificativa da tabela deixa de valer.

## 4. `listDonoDatas()` em `lib/db.ts`

```ts
/** A data em que alguém assumiu cada ação — `hub_acao_dono.atualizado`, coluna que já existe. É a
 *  única data que o hub tem por ação: a `acao` do card não é datada, e N6 precisa dela porque
 *  premissa de card apodrece (FR-030a). NÃO altera `listDonos()`: a assinatura dela é lida pela
 *  /agenda e por `acoesDoRanking()`, e a SC-018 exige que os itens e donos da ficha sejam
 *  exatamente os de lá. */
export async function listDonoDatas(): Promise<Map<string, string>>;
```

Chave: a mesma `acaoKey(slug, acao)` que `acoesDoRanking()` monta — o contrato entre projeção e
banco nasce lá e não é recalculado aqui.

## 5. O que este contrato proíbe

- Importar `data/projects.json` fora de `lib/projects.*`.
- Inferir `objetivo`, `krs`, `dono` ou `celula` de qualquer outro campo do card.
- Escrever no card, no banco ou na agenda a partir da ficha — a página é leitura (FR-036).
- Criar env, tabela, coluna ou coletor novo.
