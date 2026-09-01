# Quickstart — validar a projeção invertida

Guia de validação, não de implementação. Cada bloco fecha um Success Criteria da spec.

## Pré-requisitos

```bash
cd roihub
npm ci          # Node 22
```

Para a conferência na tela (§3 em diante): `DATABASE_URL` e as credenciais do GSC no `.env.local`.
Sem elas a página sobe igual — todas as células viram `não apurado`, que é o comportamento
correto e não invalida os checks de §3.

---

## 1. Suíte verde, com o arquivo novo registrado — SC-008

```bash
npm test
```

Espera-se: `pass` em tudo, incluindo `test/projecao.test.mjs` (novo) e os casos de `exigencia()`
em `test/funil.test.mjs` (arquivo já registrado — a primitiva mora em `lib/funil.mjs`, então o
teste dela mora ao lado dos de `razao()`).

`test/validade.test.mjs` compara a lista de `npm test` com o diretório **nos dois sentidos**. Se
`test/projecao.test.mjs` existir e não estiver em `package.json`, ele reprova — é o portão do
Princípio II, e é o motivo de o registro entrar no mesmo commit que cria o arquivo (FR-016).

Para rodar só o arquivo novo durante o desenvolvimento:

```bash
node --test test/projecao.test.mjs
```

---

## 2. A aritmética, sem subir o Next — Princípio III

Cadeia **sintética**, nunca `atma` (os números da `atma` mudam com a janela — ver a nota do
`checklists/requirements.md`).

```bash
node -e '
import("./lib/projecao.mjs").then(({ projetar }) => {
  const cel = (v) => ({ valor: v });
  const na  = (m) => ({ naoApurado: m });
  const ficha = { perfil: "D", marcos: [
    { chave: "visitante",  nome: "visitante",  celula: cel(535) },
    { chave: "lead",       nome: "lead",       celula: cel(39)  },
    { chave: "contatado",  nome: "contatado",  celula: na("sem coletor") },
    { chave: "agendada",   nome: "agendada",   celula: na("sem coletor") },
    { chave: "compareceu", nome: "compareceu", celula: na("sem coletor") },
    { chave: "tratamento", nome: "tratamento", celula: cel(0) },
  ], taxas: [] };
  const meta = { valor: 50000, ticket: 4000, prazo: "2026-09-29" };
  const p = projetar({ ficha, meta, hoje: "2026-09-01", janelaDias: 28 });
  console.log(p.veredito, p.ancora, p.fatorObrigatorio, p.degrausAMedir.length);
});'
```

Esperado: âncora `lead = 39` (não `tratamento`, que é apurado **depois** de três buracos — SC-007),
`veredito: "cabe"`, fator ≈ `0,3205`, e `4` degraus a medir (SC-002).

**Confira à mão**: `50000 ÷ 4000 = 12,5`; prazo de 28 dias = 1 janela, logo `12,5` na janela;
`12,5 ÷ 39 = 0,3205`. Se a conta na sua cabeça não bater com a saída, a saída está errada — esta é
a feature inteira.

### Normalização — SC-006

Repita com `prazo: "2026-12-22"` (112 dias). O fator obrigatório tem que cair para **um quarto**
(≈ `0,0801`). Razão de 4 para 1 entre os dois.

### Meta impossível — SC-005

Repita com `valor: 400000`: `100 ÷ 39 = 2,56`. Esperado `veredito: "impossivel"`,
`multiploDeVolume ≈ 2,6`, e **nenhuma** taxa acima de 100% em campo de célula — o percentual só
aparece dentro da frase de prova.

### Sem ticket — SC-009

Repita com `meta: { valor: 50000, prazo: "2026-09-29" }`. Esperado: `veredito: "nao-apurado"` com
`sem ticket declarado — R$ não vira contagem sem valor por unidade`. **Nunca** `0`, nunca `100%`.

### Cadeia fechada — G4, G9, D9

Repita com **todos** os seis degraus apurados (`contatado: 30, agendada: 20, compareceu: 15,
tratamento: 10`) e `valor: 400000`:

- âncora = `tratamento`, `ehFinal: true`;
- `fatorObrigatorio` sai **`não apurado`** (`âncora é o próprio N1 — não há trecho a exigir`);
- `multiploNecessario ≈ 10` e `veredito: "multiplo"`;
- **`veredito` NÃO pode ser `"impossivel"`** por maior que seja o múltiplo, e a palavra
  "impossível" não aparece no `motivo`;
- `degrausAMedir` vazio.

É o ramo que **nenhum dos 17 projetos com perfil alcança hoje** — 16 não têm o campo `vendas`, e o
único que tem (`atma`) tem três degraus não apurados acima dele. Só o teste sintético o exercita, e
por isso ele é o mais fácil de quebrar sem ninguém ver.

### Meta velha — G10

Repita com `declaradaEm: "2025-01-01"`. O resultado tem que ser **idêntico** ao de
`declaradaEm: "2026-09-01"`: a data é exibição, nunca entra em conta e nunca invalida a meta.

---

## 3. A tela

```bash
npm run dev
# abrir http://localhost:3000/okr
```

| Verificar | Critério |
|---|---|
| a página responde 200 e lista os 40 projetos | SC-001 |
| nenhum veredito da 009 mudou de posição em relação a antes do commit | SC-001 |
| `atma` (o único com `meta`) exibe âncora `lead = 39`, N1 necessário e os 4 degraus nomeados | SC-002 |
| o percentual da `atma` bate com a conta do dia — em 01/09/2026, `7,42% (2,89/39)` | SC-002 |
| `valor` e `ticket` levam `declarada em 01/09` ao lado | FR-002, D10 |
| os outros 39 exibem `não apurado — sem meta declarada` | SC-003 |
| todo fator na tela tem a fração colada | SC-004, FR-011 |
| `valor` e `ticket` aparecem rotulados como **declarados** | FR-002 |

Varredura do HTML servido, que é o que a SC-003 e a SC-004 pedem:

```bash
# SC-003 — nenhum fator obrigatório sem meta declarada
curl -s localhost:3000/okr | grep -c "fator obrigatório"

# SC-005 — nenhuma taxa acima de 100% renderizada como célula
curl -s localhost:3000/okr | grep -oE "[0-9]{3,},[0-9]{2}%" || echo "ok: nenhuma"
```

O primeiro `grep -c` tem que dar **1** — só `atma` tem `meta` nesta feature (Q4). Confira com
`grep -c '"meta"' data/projects.json`. Qualquer diferença é um card produzindo número sem meta
(FR-013).

```bash
# G9 — a palavra "impossível" nunca sai no ramo do múltiplo. Hoje o portfólio não tem cadeia
# fechada, então este grep tem que voltar vazio; se algum dia voltar algo, é o teto de 100%
# vazando para onde ele não vale.
curl -s localhost:3000/okr | grep -c "múltiplo necessário" || echo "0 — nenhuma cadeia fechada"
```

---

## 4. Antes de fechar

1. `npm test` verde (suíte inteira, não só o arquivo tocado).
2. `test/projecao.test.mjs` registrado em `package.json` — Princípio II.
3. Nenhum import de `data/projects.json` fora de `lib/projects.*` — Princípio I.
4. Push **fora** de 23:30-01:00 e 08:00-08:45 BRT — Princípio IV. Push em `main` é deploy.

⚠️ **A primeira corrida de um check mede o CHECK**, não o negócio. Confira uma linha à mão antes
de citar qualquer contagem desta tela.
