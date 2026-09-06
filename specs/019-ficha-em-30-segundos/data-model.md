# Fase 1 — Data model

Nenhuma entidade de banco nasce aqui: **zero migração, zero DDL, zero escrita**. O que segue são as
formas em memória que a 019 acrescenta, e o campo de card que as alimenta.

---

## 1. Campo de card: `motivosDePerda`

`lib/projects.ts`, tipo `Project`:

```ts
/** A taxonomia de perda é do CLIENTE, não do template (FR-015). Ausente = o projeto exibe
 *  `enviados` e OMITE vivos/perdidos, nomeando o que falta declarar (FR-015b) — nunca herda a
 *  lista da Atma de graça, que é o defeito que a 017 matou na palitagem. */
motivosDePerda?: string[];
```

`data/projects.json`, card `atma`:

```json
"motivosDePerda": ["sem_resposta", "sem_interesse", "perdido_concorrencia", "preco_alto"]
```

Vivos, por complemento: `contato_futuro`, `enviou_documentacao` e **lead sem motivo**.

---

## 2. `Buraco` — o item da lista da dobra

Derivado, não persistido. Produzido por `buracosDeVerdade(marcos)` em `lib/okr.mjs`.

| campo | tipo | origem |
|---|---|---|
| `chave` | `string` | `marco.chave` |
| `nome` | `string` | `marco.nome` — o texto exibido |
| `fonte` | `string` | `marco.fonte` — **a fonte a consultar** (US2-AC2 exige que cada linha a nomeie) |
| `motivo` | `string` | `marco.celula.naoApurado` |
| `familia` | `"D1".."D4"` | `marco.familiaDoBuraco` |
| `transitorio` | `boolean` | `marco.celula.rotuloBuraco === "falhou-agora"` |

**Invariantes**

- Célula com `rotuloBuraco === "tela-nao-le"` **nunca** entra (018/FR-029, US2-AC1).
- Lista vazia é um estado exibido, não uma ausência (FR-005): "nenhum buraco de medição na cadeia".
- `transitorio: true` renderiza separado, sem competir com o permanente (US2-AC4).
- É a **mesma** lista que `posicaoDeAtaque()` consome — nenhuma segunda régua (FR-002).

---

## 3. `ValorEmRisco` — o pipeline somado

Produzido por `valorEmRisco(linhasOrc, leadsPorId, janela, motivosDePerda)` em `lib/okr.mjs`.
**Puro**: recebe linhas, não abre conexão.

```
entrada:
  linhasOrc      {criado, status, paciente_lead_id, preco, desconto_vista}[]
  leadsPorId     Map<string, {motivo: string|null}>
  janela         {inicio, fim}   ← CONVERSAO (época → hoje)
  motivosDePerda string[] | null ← do card; null = taxonomia não declarada
```

| campo | tipo | regra |
|---|---|---|
| `enviados` | `{valor, n}` | soma de `preco × (1 − coalesce(desconto_vista, 0))` das linhas da janela, com `preco` numérico. Mesma aritmética de `ticketDeOrcamentos()` — `pg` devolve `numeric` como **string** |
| `fechados` | `Celula` | **do degrau `tratamento`** da cadeia, nunca de `orcamentos.status` (FR-013a) |
| `vivos` | `{pessoas, valor} \| null` | lead cujo `motivo` **não** está em `motivosDePerda`, incluindo `motivo === null`. `null` quando `motivosDePerda` é `null` (FR-015b) |
| `perdidos` | `{pessoas, valor} \| null` | complemento de `vivos`, mesma condição de `null` |
| `semLead` | `{n, valor} \| null` | `paciente_lead_id == null`: entra em `enviados`, fica **fora** de vivos e perdidos, nomeado à parte (FR-015a). `null` quando não há nenhum |

**Invariantes**

- `vivos.pessoas + perdidos.pessoas + semLead.n` **não** precisa fechar com `enviados.n`:
  `enviados` conta **documentos**, vivos/perdidos contam **pessoas**. Os dois denominadores saem
  juntos na tela, mesma regra que `ticketDeOrcamentos()` já aplica (`docs` × `pessoas`).
- Nenhuma contagem é constante no código nem no teste (FR-016, SC-004). O teste monta linhas
  sintéticas e verifica a **regra**; o número real se confere contra o banco no momento da
  verificação.
- Sem orçamento na janela → a função devolve `null` e o bloco **não renderiza** (FR-017).
  `R$ 0,00 enviados` seria fato apurado sobre um projeto que não tem a fonte.
- O valor **nunca** é somado à meta nem apresentado como progresso (FR-014) — a soma
  `enviados ÷ meta` não existe em lugar nenhum da tela nem do módulo.
- `status` do lead **não** entra na classificação: manda o `motivo` (contradição do id 44 —
  `exames_enviados` com `sem_interesse` — fica sem modelagem, como na 018).

---

## 4. Janelas longas

`lib/janelas.mjs`, ao lado das três de hoje, **mesmo formato** `{nome, inicio, fim, porque}`:

| função | tamanho | fecha em | consumidor |
|---|---|---|---|
| `descoberta(agora)` | 28 d | D-3 | ficha, ranking — **inalterada** (FR-024) |
| `comportamento(agora)` | 28 d | D-3 | ficha — **inalterada** (FR-024) |
| `conversao(agora, epoca)` | época → hoje | hoje | cadeia — **inalterada** |
| `descobertaLonga(agora)` | 8 meses | D-3 | `/okr/[slug]/aquisicao` (FR-023) |
| `comportamentoLongo(agora)` | 12 meses | D-3 | `/okr/[slug]/aquisicao` (FR-023) |

**Janela pedida × janela recebida** (FR-027): a tela exibe a **recebida**. `{inicio, fim}` da fonte
sai ao lado de cada número; quando difere da pedida, o truncamento é nomeado. Nunca se rotula de 12
meses um dado de 3.

---

## 5. Costura da época na árvore

`montarArvore({ ficha, projecao, ctr })` — `ctr` ganha a janela que o produziu:

```
ctr: { valor, impressoes, janela: {inicio, fim} }
```

**Guarda nova** (FR-031), no lugar de `marcos[0]?.chave === "visitante"`:

```
camada de impressões entra ⟺ ctr.janela.inicio <= conversao.inicio
                            ∧ ctr.janela.fim   >= conversao.fim
```

Contém, não iguala: a série do GSC é maior que a época e é fatiada por ela. Se `ctr.janela` não
contém a de Conversão, a árvore **para e nomeia** o que faltou (FR-033) — nunca compõe períodos.
Projeto sem `epoca` mantém o comportamento de hoje (FR-032): a janela de Conversão é 28d/D-3 e a
contenção falha por construção onde já falhava.

---

## 6. O que NÃO entra nesta spec

- `status_historico` (velocidade, passagem cumulativa, coorte) — FR-034, spec futura.
- Qualquer leitura de `orcamentos.status` para separar fechado de aberto — FR-013a.
- Réguas de mercado pesquisadas e `DELETE` de `market_benchmarks` — FR-037, spec 020.
- Alargamento das janelas curtas na ficha — FR-024/FR-024a: a janela longa vive só nas subpáginas.
