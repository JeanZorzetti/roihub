# Quickstart — 034

## Ver o número

`/gsc/mapa` → ramo **CLIQUE** → expandir `2. KPI de Distribuição: Taxa de Penetração no Top 3`.
O primeiro filho é o medido; clicar na folha abre o painel com a procedência do coletor.

## Conferir o número contra a fonte

Sem subir o Next, com a credencial do `.env`:

```bash
node --env-file=.env -e '
const { pathToFileURL } = await import("node:url");
const { readFileSync } = await import("node:fs");
const b = pathToFileURL(process.cwd() + "/").href;
const { gscTermos } = await import(b + "lib/gsc.ts");
const { penetracaoNoTop3 } = await import(b + "lib/kpis-busca.mjs");
const { lerInventario } = await import(b + "lib/inventario.mjs");
const { descoberta } = await import(b + "lib/janelas.mjs");
const { hostsDeclarados } = await import(b + "lib/projects.mjs");
const cards = JSON.parse(readFileSync("data/projects.json", "utf8"));
const atma = (Array.isArray(cards) ? cards : cards.projects).find(p => p.slug === "atma");
const inv = lerInventario("atma", JSON.parse(readFileSync("data/inventario-de-termos.json", "utf8")));
const lida = await gscTermos(hostsDeclarados(atma), descoberta());
console.log(penetracaoNoTop3(lida.linhas, inv));
' --input-type=module
```

Saída de 20/09/2026: `{ fracao: 0.102…, noTop3: 74, total: 725, cobertura: 454, piso: true }`.

## Refazer o inventário

```bash
# imprime e NÃO grava — sempre rode assim primeiro
node --env-file=.env scripts/derivar-inventario.mjs atma --piso 20 --meses 8

# congela por cima do anterior
node --env-file=.env scripts/derivar-inventario.mjs atma --piso 20 --meses 8 --gravar
```

**Trocar o inventário troca o denominador de um KPI.** A comparação com qualquer leitura anterior
morre no mesmo commit: 49,0% em março e 10,2% hoje só se comparam porque os dois foram medidos
contra a MESMA lista. Se a lista mudar, o histórico anterior vira outra medida — registre o porquê
no commit, como a `procedencia.congeladoEm` registra o quando.

## Dar inventário a outro projeto

1. O card precisa declarar `marca.termos` em `data/projects.json` — sem isso o script recusa, e com
   razão: inventário com a marca dentro mede a própria marca.
2. `node --env-file=.env scripts/derivar-inventario.mjs <slug> --piso 20 --meses 8` e ler a saída.
   O piso de 20 é o da Atma; um site com outra ordem de grandeza de tráfego pede outro piso, e a
   escolha vai na `procedencia.porque`.
3. Rodar de novo com `--gravar`.
4. `npm test` — `lerInventario()` valida o arquivo novo (lista vazia, duplicata, marca dentro).

O mapa segue lendo só a Atma (o board é dela). Para outro projeto aparecer na tela é preciso mudar
`app/gsc/mapa/page.tsx`, que hoje resolve `atma` literalmente.

## O que quebra se alguém mexer

| mudança | o que quebra |
|---|---|
| editar `data/inventario-de-termos.json` à mão com um termo de marca | `npm test` reprova em `test/inventario.test.mjs` |
| trocar a dimensão de `gscTermos()` para `["query","page"]` | a penetração cai para perto de 0 sem erro — as linhas passam a ter `query`, não `termo` |
| pendurar `penetracaoNoTop3()` em `kpisPorTermo()` | mesma coisa, pelo mesmo motivo; o docblock da função explica |
| dar régua à folha (`balizador` ≠ `recusa`) | o mapa passa a publicar veredito contra os 20% a 30% do board, que não têm fonte |
