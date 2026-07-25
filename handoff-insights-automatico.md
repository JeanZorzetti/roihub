# Handoff — o /insights se atualiza sozinho, junto com o /infra

**Criado: 2026-07-25.** Não é `handoff.md` (esse é o histórico do hub inteiro) nem substitui
`handoff-ml.md` — aquele continua sendo o doc do motor (F0–F4, decisões, schema). Este trata de
**uma coisa só: o dado parar de envelhecer**.

Leia antes: `handoff-ml.md` (como o motor funciona) e `handoff-crawl-stats-semanal.md` (o robô ao
qual isto se acopla).

---

## Estado

`data/insights.json` estava em **10/07 — 15 dias parado**, com a própria aba se acusando
("Insights desatualizados: gerados há N dias. Rode `python ml/analyze.py` e dê push").

**Rodado à mão em 25/07** (já commitado): `generatedAt` = 2026-07-25, `windowEnd` = 22/07. O que
mudou, e vale ler antes de tirar conclusão:

| projeto | health | flags |
|---|---|---|
| `polarisia` | **80 → 50** | ganhou `declining` — **único que piorou, é o insight do dia** |
| `context`, `nimblabs`, `reviewshield` | 30→65, 35→70, 45→75 | perderam `crawl-waste` |
| `goiania`, `roilabs`, `estetiacrm` | 30→55, 40→50, 50→60 | seguem `crawl-waste` |
| `sirius`, `fabrica`, `aftercare` | 60→65, 60→75, 75→80 | sem flags |

⚠️ **Oito projetos "melhoraram" no mesmo dia — desconfie.** Crawl Stats do GSC é média de 90 dias:
o export novo empurrou para fora da janela os dias ruins anteriores aos fixes. Sumir `crawl-waste`
de três projetos aqui é a **janela rolando**, não trabalho feito nesta semana. O sinal que interessa
é o que destoa: `polarisia` caindo enquanto todo o resto sobe.

O motor rodou limpo com os exports de hoje: **38 segundos**, 10 projetos, zero erro.

---

## 1. O problema não é o motor, é a mão

O `analyze.py` funciona desde 10/07. O que não funciona é a "rotina de sexta" descrita no
`handoff-ml.md:9`: *"depois do export de crawl, rode o analyze.py → commit+push"*. Duas semanas
depois, nem o export nem o analyze aconteceram. **É a mesma doença que deixou o `/infra` 15 dias
parado** — e ela acabou de ser curada lá, com o robô semanal.

O `/insights` depende do `/infra`: `ml/crawl.py` lê os mesmos CSVs de `docs/`. Rodar o analyze
**antes** dos exports novos entrarem só recalcula em cima de dado velho. A ordem certa já existe
dentro de um único processo — o robô de domingo.

---

## 2. A mudança

Em `scripts/fetch-crawl-stats.mjs`, **depois do loop de download e antes do `git add`**:

```js
// O analyze.py lê docs/: só faz sentido depois que os exports novos entraram.
if (ok.length > 0) {
  try {
    execFileSync(PYTHON, [path.join(REPO, "ml", "analyze.py")], { cwd: REPO, stdio: "inherit" });
  } catch (e) {
    // Insights são derivados; crawl stats são o dado bruto. Falhar aqui não pode custar o commit
    // dos exports — mas tem que aparecer no exit code.
    failed.push({ property: "ml/analyze.py", message: e.message });
  }
}
git("add", "docs/Crawl-stats", "data/insights.json");
```

`PYTHON` = `process.env.ROIHUB_PYTHON ?? "C:/venvs/roihub-ml/Scripts/python.exe"`. O caminho é
absoluto e **fora do OneDrive** de propósito (venv dentro do OneDrive corrompe, mesmo padrão do
`node_modules`); o override por env existe para quem recriar o venv em outro lugar.

Três decisões embutidas, todas com motivo:

1. **Só roda se algum export entrou** (`ok.length > 0`). Sem export novo, o insights sairia igual e
   o commit seria vazio.
2. **Falha do analyze não aborta o commit dos exports.** São dados de níveis diferentes: crawl stats
   é fonte, insights é derivado. Perder o derivado por uma semana custa pouco; perder o export custa
   um buraco permanente na série (o GSC só oferece os últimos 90 dias).
3. **Um commit só**, com `docs/` e `data/insights.json` juntos. As duas abas contam a mesma semana;
   separar em dois commits só cria a chance de um deles ficar para trás.

A mensagem de commit do robô passa a valer para as duas abas — troque
`chore: crawl stats <data> (<n> propriedades)` por algo como
`chore: crawl stats + insights <data> (<n> propriedades)` quando o analyze tiver rodado.

**Custo:** +38s num run que hoje leva ~3 min. Nada muda no agendamento.

---

## 3. Gotchas

1. **Os CSVs agora vêm em inglês.** O robô abre a UI com `&hl=en` (para estabilizar o botão Export),
   então os arquivos chegam como `Summary crawl stats chart.csv` / `Response table.csv`. O
   `ml/crawl.py` casa `resumo|chart` e `respostas|response`, então **funciona nos dois idiomas** —
   verificado no run de hoje. Quem "limpar" esses regex para só português quebra o motor inteiro, e
   o sintoma será `insufficient-data` em todos os projetos, não um erro.
2. **Console do Windows é cp1252.** O `analyze.py` imprime só ASCII de propósito (`handoff-ml.md:12`);
   o `·` dos prints já sai como `?`. Um acento novo num `print` derruba o script com
   `UnicodeEncodeError` — e sob Task Scheduler isso vira falha silenciosa.
3. **`.env` do repo perdeu o BOM em 25/07.** O `ml/gsc.py:23` lê com `utf-8-sig`, que aceita os dois
   casos, então nada a fazer — mas o comentário lá ("o .env desta máquina carrega BOM") já não
   descreve a realidade.
4. **GSC atrasa ~3 dias.** Um run de 25/07 fecha a janela em 22/07 (`windowEnd`). É esperado; não é
   dado faltando.
5. **`data/insights.json` é versionado e o Dockerfile o copia** (`COPY --from=build /app/data ./data`).
   Igual aos exports: sem push, sem rebuild, sem atualização em produção.
6. **A aba já sabe se está velha** (`app/insights/page.tsx:93`) — se o aviso de "gerados há N dias"
   aparecer depois de um domingo, o problema é o robô, não o motor.

---

## 4. Verificar

```bash
node scripts/fetch-crawl-stats.mjs goiania    # 1 propriedade: rápido, exercita o caminho inteiro
git log -1 --stat                             # docs/Crawl-stats/... E data/insights.json no MESMO commit
```

No `/insights`: cabeçalho com a data de hoje e **sem** a faixa de desatualizado.

Se o analyze falhar sozinho, o run tem que terminar com os exports commitados, `exit 1`, e a linha
`ml/analyze.py` na lista de falhas — é isso que separa "insights velho" de "semana perdida".

---

## 5. Checklist

- [x] `data/insights.json` regenerado em 25/07 e commitado (10 projetos, 38s)
- [ ] `scripts/fetch-crawl-stats.mjs` chamando o `analyze.py` e incluindo `data/insights.json` no add
- [ ] `ROIHUB_PYTHON` documentado no topo do script (com o default do venv)
- [ ] Mensagem de commit do robô refletindo as duas abas
- [ ] Run filtrado de ponta a ponta: um commit com `docs/` **e** `data/insights.json`
- [ ] `npm test` verde (o robô não tem teste de browser; o que muda aqui é orquestração)

---

## 6. O que este handoff NÃO faz

`F3` (forecast Holt-Winters + kill-gates D+90/180/270 dos bets nimblabs) e `F4` (narrativa pt-BR via
claude-cli) continuam pendentes, com os briefs em `handoff-ml.md:57-59`. Automatizar a atualização
não os aproxima — só garante que, quando existirem, rodem toda semana sem ninguém lembrar.

O gate D+90 do `aftercare` cai **~29/08**: é a data que torna o F3 útil, não urgente.
