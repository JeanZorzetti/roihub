# Quickstart — conferir a 035 no ar

## 1. A suíte

```bash
npm test
```

Verde inteiro, não só `kpis-busca`. Os casos novos moram em `test/kpis-busca.test.mjs` (arquivo já
registrado no `package.json` — nenhum arquivo novo, nada a registrar).

O caso que não pode passar por acidente:

```bash
node --test test/kpis-busca.test.mjs
```

Deve haver um teste que alimenta `strikingDistancePorTermo()` com linhas de `query`+`page` (campo
`query`, sem `termo`) e exige `null`. Se ele devolver um número, o defeito da 035 voltou.

## 2. A medida, contra a fonte real

```bash
node --env-file=.env -e "
import('./lib/gsc.js').catch(()=>{});
" 2>/dev/null
```

`lib/gsc.ts` não roda direto em `node`. Para conferir o número sem subir o Next, use o dev server
(passo 3) — ou confira a aritmética pura com linhas de mentira:

```bash
node --env-file=.env --input-type=module -e "
import { strikingDistancePorTermo } from './lib/kpis-busca.mjs';
const linhas = [
  { termo: 'alinhador invisível preço', cliques: 6, impressoes: 344, posicao: 5.6 },
  { termo: 'atma aligner',              cliques: 70, impressoes: 423, posicao: 4.4 },
  { termo: 'fora da faixa',             cliques: 0, impressoes: 10,  posicao: 22.1 },
  { termo: 'sem voto',                  cliques: 0, impressoes: 0,   posicao: null },
];
const ehMarca = (t) => /\\batma\\b/i.test(t);
console.log(strikingDistancePorTermo(linhas, ehMarca));
console.log('forma errada ->', strikingDistancePorTermo([{ query: 'x', cliques: 0, impressoes: 5, posicao: 6 }], ehMarca));
"
```

Esperado: `{ total: 1, impressoes: 344, cliques: 6, removidas: 1, base: 4, cauda: 0 }` e
`forma errada -> null`.

## 3. A tela

```bash
npm run dev
```

Abrir `http://localhost:3000/gsc/mapa` e conferir, **nos dois portadores**:

**No mapa** — navegar `CLIQUE` → `3. KPI de Oportunidade Imediata: Volume em Striking Distance
(Posições 4 a 10)` → expandir. O **primeiro** filho é o nó medido, antes de "Métrica: consultas
entre as posições 4,0 e 10,9" e de "Meta de execução". Clicar nele abre o painel com a nota inteira.

**Na lista sem JavaScript** — a segunda seção da página ("O mesmo board em lista"). `Ctrl+F` por
`Medido:` deve achar **dois** — o da penetração (034) e o do striking (035). A nota aparece em texto
corrido, sem clique.

### O que conferir no número

Em 20/09/2026, janela `2026-08-21 → 2026-09-17`, a folha deve dizer:

- `Medido: 344 consultas entre as posições 4,0 e 10,9 · base 893 termos lidos`
- na nota: `3 termo(s) de marca removido(s)`, `93 ... uma única impressão`, `190 das 344 estão no
  inventário declarado de 725 termos`, e a frase que explica o 362 de `/okr/atma/aquisicao`

**344 e não 347.** Se a tela disser 347, a guarda de marca está desligada — `atma aligner` (70
cliques) está na contagem, e o defeito que a 035 existe para consertar foi reintroduzido.

**344 e não 362.** 362 é a leitura `query`+`page`. Se a folha do board disser 362, ela está lendo a
dimensão errada.

### Os estados de ausência

```bash
# sem credencial — a folha precisa dizer QUAL é a ausência, nunca 0
npm run dev   # com GOOGLE_SERVICE_ACCOUNT_JSON fora do ambiente
```

Esperado: `∅ não apurado · sem leitura do Search Console` com o motivo nomeado. **Nunca** `Medido: 0`.

## 4. No ar

Push em `main` dispara o deploy no EasyPanel — **~15 min**, e fora das janelas do Princípio IV
(23:30–01:00 e 08:00–08:45 BRT).

Depois do deploy, conferir `https://hub.roilabs.com.br/gsc/mapa` **duas vezes**, com alguns minutos
entre elas: o container reinicia e a primeira leitura pode pegar a rota ainda subindo.

A rota é `force-dynamic` desde a 033 — não há cache a invalidar, e não existe a armadilha do `null`
assado no build.
