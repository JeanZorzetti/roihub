# Phase 1 — Data Model: Quadros de Marketing e Ideias

**Feature**: `006-quadros-marketing-ideias` | **Data**: 2026-08-29

Três tabelas novas, todas com prefixo `hub_`, criadas no bloco `ensure()` de
[lib/db.ts](../../lib/db.ts) junto das existentes. **Nenhuma tabela existente é alterada.**

---

## `hub_pauta_coluna` — as colunas/seções configuráveis

```sql
CREATE TABLE IF NOT EXISTS hub_pauta_coluna (
  id SERIAL PRIMARY KEY,
  quadro TEXT NOT NULL,                    -- 'marketing' | 'ideia'
  nome TEXT NOT NULL,
  icone TEXT,
  ordem INT NOT NULL DEFAULT 0,
  criado TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quadro, nome)
);
```

| Campo | Regra |
|---|---|
| `quadro` | sem `CHECK` — a lista dos dois quadros vive em `lib/pauta.mjs`, validada na action (convenção da casa) |
| `nome` | 1–40 caracteres, único dentro do quadro |
| `icone` | emoji opcional, só decoração |
| `ordem` | posição da esquerda para a direita (Marketing) ou de cima para baixo (Ideias) |

**Semeadura idempotente** no `ensure()`, com `ON CONFLICT (quadro, nome) DO NOTHING` — atende FR-016
(quadro utilizável sem configuração prévia) sem sobrescrever o que o usuário já mexeu:

| Quadro | Colunas iniciais |
|---|---|
| `marketing` | 📝 Pauta · 🔨 Produzindo · 📅 Agendado · ✅ Publicado |
| `ideia` | 🌱 Produto novo · 🔧 Melhoria · 🗄️ Gaveta |

**Invariantes** (validados na action, não no banco):

- **FR-013** — remover coluna com card é recusado; a mensagem traz a contagem.
- **FR-014** — remover a última coluna de um quadro é recusado.
- **FR-015** — renomear NÃO toca em card nenhum: o card aponta para `id`, não para `nome`.

---

## `hub_pauta` — o card

```sql
CREATE TABLE IF NOT EXISTS hub_pauta (
  id SERIAL PRIMARY KEY,
  quadro TEXT NOT NULL,                    -- 'marketing' | 'ideia'
  coluna_id INT REFERENCES hub_pauta_coluna(id),
  tipo TEXT NOT NULL DEFAULT 'card',       -- 'card' | 'doc'
  titulo TEXT NOT NULL,
  descricao TEXT,
  projeto TEXT,                            -- slug de listProjects(); NULL = transversal
  responsavel TEXT,                        -- mesma lista de lib/agenda.mjs; NULL = sem dono
  canal TEXT,                              -- só marketing; NULL nos demais
  data DATE,                               -- só marketing: alimenta o calendário
  url TEXT,                                -- endereço da publicação no ar
  arquivado_em TIMESTAMPTZ,                -- NULL = ativo
  criado TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_pauta_quadro ON hub_pauta (quadro, coluna_id);
```

| Campo | Regra | Requisito |
|---|---|---|
| `titulo` | obrigatório, ≤ 200 caracteres | FR-002 |
| `descricao` | ≤ 4000 caracteres (o dobro da agenda — a vista `docs` guarda texto de processo) | FR-002, FR-026 |
| `projeto` | validado contra `listProjects()` na action; desconhecido vira `NULL` | FR-003 |
| `responsavel` | validado contra `RESPONSAVEL_IDS` de `lib/agenda.mjs`; desconhecido vira `NULL` | FR-004 |
| `canal` | validado contra `CANAIS` de `lib/pauta.mjs`; ignorado fora do Marketing | FR-005 |
| `data` | `YYYY-MM-DD`; ausente = não aparece no calendário | FR-005, FR-025 |
| `tipo` | `'doc'` sai do fluxo: não aparece em coluna nem no calendário | FR-026 |
| `coluna_id` | obrigatório para `tipo = 'card'`; irrelevante para `'doc'` | FR-006 |

**`tipo` reusa a convenção da casa** (sem `CHECK` no banco, lista no `.mjs`, validação na action) —
diferente de `coluna_id`, que é dado do usuário e por isso virou tabela (ver R-004 no research).

### Estados do card

```
                 arquivar                    varredura (30d)
   [ ativo ] ─────────────────► [ arquivado ] ─────────────────► [ arquivado, imagens liberadas ]
       ▲                              │                                        │
       └──────── restaurar ───────────┘                                        │
                                                              (sem volta: os bytes não existem mais)
```

- **ativo** → `arquivado_em IS NULL`. Aparece na coluna.
- **arquivado** → `arquivado_em` preenchido, anexos intactos. Área recolhida. Restaurável (FR-034).
- **liberado** → passados 30 dias, `bytes` dos anexos viraram `NULL`. O card continua legível
  (FR-033). Ainda pode ser restaurado ao quadro; só as imagens não voltam.

Restaurar limpa `arquivado_em` — e se o card for arquivado de novo, a carência recomeça do zero.

---

## `hub_pauta_anexo` — as imagens do carrossel

```sql
CREATE TABLE IF NOT EXISTS hub_pauta_anexo (
  id SERIAL PRIMARY KEY,
  pauta_id INT NOT NULL REFERENCES hub_pauta(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,            -- slide 1, 2, 3… do carrossel
  nome TEXT NOT NULL,
  mime TEXT NOT NULL,                      -- image/png | image/jpeg | image/webp
  tamanho INT NOT NULL,                    -- bytes; gravado no upload, SOBREVIVE à liberação
  bytes BYTEA,                             -- NULL = liberado
  liberado_em TIMESTAMPTZ,
  criado TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_pauta_anexo_vivo
  ON hub_pauta_anexo (pauta_id) WHERE bytes IS NOT NULL;
```

| Campo | Regra | Requisito |
|---|---|---|
| `mime` | lista fechada: PNG, JPEG, WebP. Fora dela = recusado | FR-019 |
| `tamanho` | ≤ 3 MB por arquivo, ≤ 20 arquivos por card | FR-017, FR-019 |
| `ordem` | define a sequência do carrossel; reordenável | FR-017, FR-018 |
| `bytes` | anulável **por desenho** — é o que a retenção esvazia | FR-032, FR-033 |

**`ON DELETE CASCADE`** atende FR-021 no banco em vez de em código: apagar card leva os anexos, sem
depender de alguém lembrar de limpar.

**O índice é parcial** (`WHERE bytes IS NOT NULL`) porque só as linhas com bytes interessam à
varredura de liberação. Depois de liberada, a linha sai do índice — então o índice encolhe com o
tempo e a varredura continua barata mesmo com anos de histórico.

### Varredura de liberação (R-005)

```sql
UPDATE hub_pauta_anexo a
   SET bytes = NULL, liberado_em = now()
  FROM hub_pauta p
 WHERE a.pauta_id = p.id
   AND a.bytes IS NOT NULL
   AND p.arquivado_em IS NOT NULL
   AND p.arquivado_em < now() - ($1 || ' days')::interval;
```

Idempotente: a segunda execução não acha linha. O prazo entra como parâmetro (constante exportada
`ANEXO_CARENCIA_DIAS = 30` em `lib/pauta.mjs`), no mesmo formato do `ACAO_DONE_DIAS` que
[lib/db.ts:544](../../lib/db.ts) já usa.

---

## Relacionamentos

```
hub_pauta_coluna 1 ──── N hub_pauta 1 ──── N hub_pauta_anexo
       │                      │                     │
   (id, quadro)         (coluna_id)          (pauta_id, CASCADE)
```

## Constantes em `lib/pauta.mjs` (puras, testáveis)

| Constante | Valor |
|---|---|
| `QUADROS` | `marketing`, `ideia` |
| `CANAIS` | blog, instagram, facebook, linkedin, youtube, email, outro |
| `TIPOS_CARD` | `card`, `doc` |
| `COLUNAS_INICIAIS` | mapa quadro → colunas semeadas |
| `MIMES_ACEITOS` | `image/png`, `image/jpeg`, `image/webp` |
| `ANEXO_MAX_BYTES` | `3 * 1024 * 1024` |
| `ANEXO_MAX_POR_CARD` | `20` |
| `ANEXO_CARENCIA_DIAS` | `30` |
