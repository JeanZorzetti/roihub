# Quickstart — validar a 020

Como provar que a régua está certa, em ordem. Cada passo tem um resultado esperado; se um falhar, os
seguintes não valem nada.

**Pré-requisitos**: `.env` com `ATMA_DATABASE_URL`, `HUB_USER`/`HUB_PASS` para a tela no ar, e o
código do app da Atma em `C:\dev\atma`.

---

## Passo 1 — A suíte

```bash
npm test
```

**Esperado**: verde, incluindo `test/benchmark.test.mjs`. A suíte inteira roda em ~1,6 s
(Princípio II). Contagem de testes **sobe** — a 020 acrescenta as travas 6 a 9 de
`contracts/regua.md §5`.

⚠️ **Teste existente que muda de significado**, não de resultado:

```
"degrau sem linha devolve `sem régua` MESMO com os dois lados apurados"
```

Ele usa `leituraDoDegrau("D", taxa, "lead→respondeu")` justamente porque `lead→respondeu` **não tinha
entrada**. Depois da 020 ele tem — uma **recusa**. O `rotulo` continua `"sem régua"` e o teste
continua passando, mas agora por outro caminho. **O teste tem de ser estendido** para afirmar o
`motivo` específico, senão ele passa a testar nada.

---

## Passo 2 — Os seis vereditos existem (SC-001)

```bash
node -e "
import('./lib/benchmark.mjs').then(({ REGUA }) => {
  const d = REGUA.D ?? {};
  for (const [k, v] of Object.entries(d))
    console.log(k.padEnd(24), v.recusa ? 'RECUSA: ' + v.recusa.motivo.slice(0, 60) : 'LINHA  ' + JSON.stringify(v.media));
  console.log('--- entradas em D:', Object.keys(d).length);
});"
```

**Esperado**: 3 entradas, as 3 `RECUSA`, com motivos **diferentes** entre si —
`lead→respondeu`, `respondeu→orcamento`, `orcamento→tratamento`.

Os outros três vereditos (aquisição) **não** estão em `REGUA.D` — não há marcos para eles, e criar
marco fantasma é o defeito que a 017 matou. Eles vivem em `research.md §D4/D5/D6`, e a exibição é a
**022** (D2 da spec).

---

## Passo 3 — Toda linha nova abre (SC-002)

```bash
node -e "
import('./lib/benchmark.mjs').then(({ REGUA }) => {
  const LEGADAS = new Set(['A:visitante→signup','A:trial→cobranca','B:produto→carrinho',
    'B:carrinho→checkout','B:checkout→pago','C:conversa→proposta','C:proposta→contrato']);
  let faltando = 0;
  for (const [perfil, linhas] of Object.entries(REGUA))
    for (const [chave, l] of Object.entries(linhas)) {
      if (LEGADAS.has(perfil + ':' + chave) || l.recusa) continue;
      if (!l.url || !l.acessadoEm) { console.log('SEM URL/DATA:', perfil, chave); faltando++; }
    }
  console.log(faltando === 0 ? 'OK: toda linha nova tem url + acessadoEm' : 'FALHA: ' + faltando);
});"
```

**Esperado**: `OK`. Esta é a trava nº 6, e ela também roda como teste — o comando aqui é para
inspeção manual.

**Verificação humana, que nenhum script faz**: abrir cada `url` e confirmar que **o número citado
está na página**. Foi assim que duas fontes candidatas caíram na Fase 0 (`navboost` e `cufinder`
prometiam número de saúde que a página não tinha) e uma terceira devolveu 403.

---

## Passo 4 — A tela do roihub (SC-003, SC-001a)

```bash
npm run dev
# abrir http://localhost:3000/okr/atma
```

**Esperado, na linha "Mercado" do bloco da cadeia** — *uma* linha, não três:

> **Mercado** · `orçamento → tratamento` não tem régua: os benchmarks de aceitação (45%–75%) medem
> aceite depois de consulta presencial, e a Atma não tem consulta.

**Reprova se**: aparecer o texto genérico *"nenhum degrau com régua e os dois lados apurados"*, ou se
a linha virar duas.

**Medir a dobra** (herdado da 019): a 1280×800, *"o que fazer"* tem de continuar **acima de 800px**.
A 019 mediu 801px com três linhas de prosa — 1px abaixo. Esta spec troca o texto, não acrescenta
linha; confirmar que continuou assim.

---

## Passo 5 — Nada apurado mudou (SC-006)

```bash
node --env-file=.env scripts/funil.mjs --ver | grep -i atma
```

**Esperado**: a cadeia da Atma idêntica a antes da 020 — `52 → 21 → 4 → 0`, ticket R$ 4.932,34,
janela `2026-07-31 → 2026-09-05`. A régua acrescenta referência externa e **não toca em número
apurado** (FR-018).

Confirmar também na tela: `CR(lead→respondeu) 40,38%`, `CR(respondeu→orçamento) 19,05%`,
`CR(orçamento→tratamento) 0,00%`, `98% contatados (declarado)`.

---

## Passo 6 — A base da Atma (SC-004)

```bash
node --env-file=.env -e "
import('pg').then(async ({default: pg}) => {
  const c = new pg.Client({ connectionString: process.env.ATMA_DATABASE_URL, ssl:{rejectUnauthorized:false} });
  await c.connect();
  const r = await c.query('SELECT metric_key, metric_value, source FROM market_benchmarks ORDER BY id');
  for (const x of r.rows) console.log(String(x.metric_key).padEnd(26), String(x.metric_value ?? 'NULL').padStart(7), '|', x.source);
  const ruim = r.rows.filter(x => !x.source || /a definir/i.test(x.source) || !/^https?:\/\//.test(x.source.match(/https?:\/\/\S+/)?.[0] ?? ''));
  console.log('--- linhas:', r.rowCount, '| sem fonte verificável:', ruim.length);
  await c.end();
});"
```

**Esperado**: **0** linhas sem fonte verificável. Linha de base antes da 020: **12 de 12**.

**Esperado também**: nenhum dos 7 `metric_key` de degrau que a Atma não tem (FR-014) —
`cadastro_to_agendamento`, `agendamento_to_comparecimento`, `comparecimento_to_conversao`,
`taxa_cancelamento`, `tempo_medio_funil`, `bounce_rate`, `cac_medio`.

---

## Passo 7 — A trava de escrita da Atma (FR-015a)

```bash
# com o backend da Atma rodando
curl -s -X PUT "$ATMA_API/market-benchmarks/1" \
  -H 'Content-Type: application/json' \
  -d '{"metric_value": 42, "source": "A definir - aguardando pesquisa de mercado"}' | head -c 400
```

**Esperado**: `400`, dizendo qual regra falhou. Nunca `200`.

Repetir com `source` vazio e com `source` sem `http`. Os três reprovam.

---

## Passo 8 — A tela do admin da Atma (SC-004, US2)

Abrir `/admin/benchmark-mercado`.

**Esperado**: a tela **carrega** (não 500, não tabela vazia sem explicação) e cada linha exibida ou
mostra faixa com fonte clicável, ou declara a recusa com o motivo.

**Reprova se**: sobrar qualquer comparação contra número sem fonte, ou se a tela quebrar. Trocar um
veredito falso por uma tela quebrada não é conserto.

---

## Passo 9 — Depois do push, conferir DUAS vezes

Herdado, à própria custa, da auditoria da 018:

> O roihub **deploya sozinho no push** — o build é que demora ~15 min. Uma checagem única, 14 minutos
> depois, serviu o build anterior e "provou" que o deploy não tinha subido. Não há workflow em
> `.github/workflows/`; o gatilho é webhook do EasyPanel, invisível no git.

**Procedimento**: esperar ~15 min, conferir **duas** vezes, procurando uma string que **só exista na
versão nova** — aqui, o trecho `"consulta presencial"` na linha de Mercado.

⚠️ **Janela de push (Princípio IV da constituição)**: nunca entre **23:30–01:00** nem **08:00–08:45
BRT**. Um push reinicia o container e mata o estado noturno ou o autopublishing em curso.
