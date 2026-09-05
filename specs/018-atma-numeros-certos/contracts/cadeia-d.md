# Contrato: a cadeia do perfil D — `lib/okr.mjs`

**Feature**: `018-atma-numeros-certos` · FR-007, FR-011 a FR-019

Módulo puro, como já é. Importa só `lib/funil.mjs`. **Não** ganha import novo.

## A cadeia

```
antes:  visitante → lead → contatado → orcamento → tratamento
depois:            lead → respondeu → orcamento → tratamento
```

`visitante` sai porque é `DESCOBERTA` e ligá-lo a `lead` é taxa entre cadeias (FR-011).
`contatado` sai porque é degrau de 100% **declarado** — não pode ser gargalo, não pode melhorar, e
ocupava a linha do degrau real.

## API nova

### `celulaDeResposta(reais) → Celula`

```js
// reais: leads já filtrados por celulaDeLeads (teste removido, na janela CONVERSAO)
celulaDeResposta(reais)
// → { valor: 21, piso: { indeterminados: 1, teto: 22 } }
```

Regra (FR-014): `motivo IS NOT NULL AND motivo <> 'sem_resposta'`.

| Situação | Devolve |
|---|---|
| há leads reais, algum sem motivo | `apurado(n)` **com** `piso: {indeterminados, teto}` |
| há leads reais, todos com motivo | `apurado(n)`, **sem** `piso` |
| nenhum lead real na janela | `naoApurado("sem lead real na janela para checar resposta")` |
| fonte própria não devolve `motivo` | `naoApurado(...)` nomeando a fonte a consultar (FR-017) |

**A regra é do cliente, não do template.** Projeto perfil D sem fonte própria que devolva `motivo`
(hoje `aftercare`) recebe `não apurado` nomeando a fonte — não herda a regra da Atma de graça,
mesmo tratamento que `contatado` recebeu na 017.

### `ticketDeOrcamentos(rows, { inicio, fim }) → Celula`

Ver [ticket.md](./ticket.md).

## API que muda de papel, não de assinatura

### `celulaDeContato(reais) → Celula`

**Continua existindo e continua sendo chamada** (FR-013). O que muda é o destino: alimenta uma
**nota** de N3, nunca um marco.

```
"100% contatados (declarado pelo operador, 05/09/2026)"
```

Sem taxa, fora do cálculo de gargalo, fora de `posicaoDeAtaque()`. Apagar a função jogaria fora a
leitura que prova o ponto (51 de 51 fora de `novo`) e faria a tela esquecer por que o degrau saiu.

### `montarFicha({ slug, perfil, coletado })`

Assinatura idêntica. `coletado` ganha a chave `respondeu` e mantém `contatados` (que agora vira
nota, não marco).

**Uma linha nova**: a taxa cujo **numerador** carrega `piso` copia esse campo para si. É assim que
o "no mínimo" chega em `montarN3()` sem um quinto estado de célula (FR-016).

`razao()`, `ehApurado()` e `exigencia()` **não mudam** — `piso` é campo extra que atravessa a
cadeia inteira sem que nenhuma delas precise saber que existe.

## `PERFIS.D` — a tabela nova

```js
n1: "Tratamentos iniciados na janela",
n2: "Receita = Leads × CR(lead→respondeu) × CR(respondeu→orçamento) × CR(orçamento→tratamento) × Valor do tratamento",
marcos: [
  { chave: "lead",        coletor: "leads",      familia: "D4" },
  { chave: "respondeu",   coletor: "respondeu",  familia: "D4" },  // NOVO
  { chave: "orcamento",   coletor: "orcamentos", familia: "D3" },
  { chave: "tratamento",  coletor: "vendas",     familia: "D4" },
],
fatores: [
  { nome: "Leads",                    tipo: "cadeia", cobertura: ["lead"] },
  { nome: "CR(lead→respondeu)",       tipo: "cadeia", cobertura: ["respondeu"] },
  { nome: "CR(respondeu→orçamento)",  tipo: "cadeia", cobertura: ["orcamento"] },
  { nome: "CR(orçamento→tratamento)", tipo: "cadeia", cobertura: ["tratamento"] },
  { nome: "Valor do tratamento",      tipo: "valor" },
]
```

`avaliarN2()` exige cobertura **contígua** terminando no último marco — a tabela satisfaz, sem
buraco nem sobreposição (FR-018).

## Perfis A e B — a trava latente

`visitante` **fica** em A e B (FR-012). A travessia de cadeia existe lá também
(`visitante→signup`, `visitante→produto`), mas os coletores são `null` e a taxa nunca chega a ser
calculada: o defeito é latente, não vivo.

O que segura é **teste**, não comentário:

```js
// test/okr.test.mjs — reprova se signup/produto ganhar coletor sem tratar a travessia
assert.equal(PERFIS.A.marcos.find((m) => m.chave === "signup").coletor, null);
assert.equal(PERFIS.B.marcos.find((m) => m.chave === "produto").coletor, null);
```

Sem isso, o primeiro projeto A/B com fonte própria reintroduz a taxa entre cadeias em silêncio
(SC-004).

## `REGUA.D` — `lib/benchmark.mjs`

Saem duas linhas (FR-019):

| linha | por quê |
|---|---|
| `lead→contatado` | fonte InfluxMD mede **agendamento** — degrau que a Atma não tem |
| `visitante→lead` | cruza cadeias (Descoberta × Conversão) |

As citações ficam em **comentário**, como a 017 fez com case acceptance. `test/benchmark.test.mjs`
já percorre `PERFIS` nos dois sentidos: a suíte fica vermelha sozinha se as linhas ficarem.

As seis réguas pesquisadas e o `DELETE` de `market_benchmarks` são a **020** (FR-035).

## Trava de cadeia na árvore — `lib/arvore-metas.mjs`

`montarArvore()` só acrescenta a camada de impressões quando `marcos[0].chave === "visitante"`.

Sem isso, com a cadeia D começando em `lead`, a árvore dividiria `lead` pelo CTR do GSC e
publicaria uma taxa `impressão → lead` que cruza Descoberta e Conversão — a US1-AC5 passaria no
teste da ficha e falharia na tela da árvore (FR-007).
