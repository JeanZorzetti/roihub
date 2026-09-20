# Quickstart — conferir a 036 no ar

## 1. A suíte

```bash
npm test
```

854 verdes antes desta feature. Os casos novos entram em `test/marca.test.mjs`, que **já** está
registrado — `package.json` não é editado e `test/validade.test.mjs` continua verde sem ajuste.

Os cinco casos que não podem faltar:

```
✓ estado "medido" com baseInterrompida NÃO abre a linha pela razão   (FR-014/SC-006)
✓ estado "nao-declarada" quando nenhum dia traz impressoesNaoMarca   (33 dos 34 projetos)
✓ estado "poucos-meses" ≠ "nao-declarada"                            (causas opostas)
✓ estado "nao-consecutivos" nomeia os dois meses                     (sintético)
✓ variacao(41.95) === "43×"   e   variacao(0.072) === "7,2%"         (SC-002)
```

## 2. A medida, contra a fonte real

Antes de olhar a tela, conferir que a função devolve o que a `research.md` mediu em 20/09/2026:

```bash
node --env-file=.env -e "
import('pg').then(async ({default: pg}) => {
  const { crescimentoNaoMarca, linhaDeCrescimento } = await import('./lib/marca.mjs');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const r = await pool.query(\`SELECT to_char(dia,'YYYY-MM-DD') AS dia,
      impressoes_nao_marca AS \\\"impressoesNaoMarca\\\" FROM hub_gsc_dia
      WHERE projeto='atma' ORDER BY dia\`);
  await pool.end();
  const m = crescimentoNaoMarca(r.rows, new Date().toISOString().slice(0,10));
  console.log(JSON.stringify(m)); console.log(linhaDeCrescimento(m));
})"
```

Esperado enquanto agosto for o último mês fechado:

```
{"estado":"medido","de":"2026-07","para":"2026-08","deImpressoes":342,
 "paraImpressoes":14689,"valor":41.95…,"diasZeroDe":27,"diasDe":31,"baseInterrompida":true}
Medido: 14.689 impressões não-marca em 2026-08, contra 342 em 2026-07 — base interrompida (27 de 31 dias em zero)
```

⚠️ **A partir de 04/10/2026 o esperado MUDA** e isso não é regressão: setembro fecha, a comparação
vira ago→set, `baseInterrompida` vira `false` e a linha passa a abrir pela razão — que, pelo ritmo
medido (223 impressões/dia contra 474/dia de agosto), deve sair perto de **−54%**. Conferir os dois
comportamentos é o teste real da FR-003/FR-003b.

## 3. A tela

```bash
npm run dev   # localhost:3002
```

Abrir `http://localhost:3002/gsc/mapa`, ramo **CLIQUE** → `4. KPI de Escala: Crescimento de
Impressões Não-Marca (Non-Branded)`, e expandir.

### O que conferir no nó

- [ ] O nó `Medido:` é o **primeiro** filho, acima de `Fórmula` e `Meta` (FR-001).
- [ ] A linha de topo abre pelos **absolutos**, não pelo `43×` (FR-003/SC-006). Ler a linha sozinha,
      sem expandir, e perguntar: *dá para concluir que a Atma está acima da meta?* Se der, reprova.
- [ ] Em lugar nenhum aparece **`4.195%`** (SC-002).
- [ ] Nenhum glifo `▼`/`▲`/`◐` no nó — a folha segue `◇ sem fonte` (FR-008).
- [ ] Clicar no nó: o painel declara a janela em **meses fechados**, e não a de 28 dias que o
      cabeçalho da página declara para as seis faixas de posição (FR-010).
- [ ] O painel traz a forma da série: `1.492` (07→13/09) contra o pico `17.020` (06→12/04), **8,8%**
      (FR-013).
- [ ] Desligar o JavaScript e recarregar: a lista aninhada no fim da página mostra o mesmo nó e a
      mesma nota (FR-011).

### Os dois números que precisam bater entre telas (SC-005)

Abrir `http://localhost:3002/okr/atma/aquisicao` lado a lado:

| | mapa | aquisição |
|---|---|---|
| meses comparados | 2026-07 → 2026-08 | 2026-07 → 2026-08 |
| absolutos | 342 → 14.689 | 342 → 14.689 |
| pico citado | 17.020 · 06→12/04 | 17.020 · 06→12/04 |

Divergência em qualquer linha reprova — as duas telas leem o mesmo módulo e a mesma série.

### Os estados de ausência

```bash
# marca não declarada — qualquer projeto que não seja a atma
open http://localhost:3002/okr/sirius/aquisicao
```

- [ ] Nenhum estado renderiza `0` ou `0%` (SC-003).
- [ ] `/okr/sirius/aquisicao` continua publicando o parágrafo de `marcaDeclarada()` com o motivo
      (`ausente`), e **não** "ainda não há dois meses fechados" (FR-007).
- [ ] Com `DATABASE_URL` ausente: o nó do mapa diz **banco indisponível**, não "marca não declarada"
      — falha transitória e ausência estrutural pedem consertos opostos.

## 4. No ar

Push em `main` → EasyPanel reconstrói (~15 min). Respeitar a janela do Princípio IV: **nunca**
23:30–01:00 nem 08:00–08:45 BRT.

Depois do deploy, conferir a **tela** em `https://hub.roilabs.com.br/gsc/mapa` — não o build. Dois
carregamentos, com intervalo: o container serve a versão antiga até terminar de trocar, e um único
acerto na janela errada confirma o que ainda não subiu.
