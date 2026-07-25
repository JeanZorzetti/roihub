# Handoff — ativar os 5 projetos restantes e mover o cron para 00:00 BRT

> **EXECUTADO em 25/07 (11:07 BRT).** Os 10 projetos estão `enabled = true` no banco e o cron é
> `13 3 * * *` (**00:13 BRT**, a recomendação da §2, não o `0 3`). O que sobra é a verificação do
> dia 26/07 na §1.3 e a contagem de `llm-rate` — é ela que decide se 10/dia cabe na cota.

**Criado: 2026-07-25.** Duas tarefas independentes: a 2 pode ser feita antes da 1.
O nome não é `handoff.md` porque esse já existe no roihub (histórico do hub inteiro).

Leia antes: `handoff-autopublish.md` (como o robô funciona) · `handoff-correcao-e-rollout.md`
(o que foi corrigido em 25/07 e por que o rollout estava em 2 projetos/dia).

## Estado de partida

| ligados (5) | pausados (5) |
|---|---|
| `goiania`, `tapepro`, `sirius`, `roilabs`, `context` | `fabrica`, `polarisia`, `estetiacrm`, `reviewshield`, `aftercare` |

Kill switch global **ATIVO**. Cron hoje: `17 11 * * *` = **08:17 BRT**.

---

## 0. O que muda quando os 10 estiverem ligados

Não é código, é cota e janela de tempo. Três consequências que a operação sente no primeiro dia:

1. **Rate limit é o teto.** No dry-run completo dos 10, as 3 contas esgotaram no **9º projeto**. Ligar
   os 10 não cria cota: cria 1–2 `llm-rate` por dia. O que mudou em 25/07 é que a fila agora
   **rotaciona** (`projectQueue(runDate)` em `scripts/run-autopublish.mjs`), então o prejuízo circula
   em vez de cair sempre no `aftercare`. Se `llm-rate` aparecer todo dia, a decisão é uma destas:
   somar conta, baixar a cadência (rodar 5 projetos por dia, alternando) ou aceitar que 1–2 falham.
2. **O run passa de ~20 min para ~45–60 min.** São 10 chamadas em série, e `polarisia` (92 arquivos),
   `reviewshield` (77) e `aftercare` (69) mandam inventário grande. Isso interage com a tarefa 2.
3. **O proxy do EasyPanel corta o cliente em ~300s.** Nos projetos lentos o Actions reporta
   `request-failed` **enquanto o hub termina e commita normalmente**. Confira o repo antes de
   acreditar no log — a linha do banco e o commit no repo alvo são a verdade.

O `verify` **não reverte mais** por falta de sinal de deploy (corrigido em `ad10da1`), então ligar
tudo não corre mais o risco de reverter 10 artigos por dia. Esse era o bloqueador anterior.

---

## 1. Ativar os 5 restantes

### 1.1 Pré-voo por projeto — o que quebra o build do site alvo

Cada projeto novo é canário do próprio renderizador: **se o frontmatter não satisfizer o schema do
repo, o build do site quebra**, e o site fica com o último build bom até alguém perceber.

| projeto | renderizador | risco específico | já verificado |
|---|---|---|---|
| `fabrica` | `typescript-post` | `registryUpsert` só aceita `import { post as X } from './posts/slug'` + `export const blogPosts: BlogPost[] = [...]` com aliases 1:1; falha fechado em `render:registry-format` | pré-voo OK em 25/07 contra `src/lib/blog/index.ts` |
| `estetiacrm` | `typescript-post` | idem, em `lib/blog/index.ts` | pré-voo OK em 25/07 |
| `polarisia` | `mdx` | inventário de 92 arquivos → run mais lento do lote; layout **não** renderiza capa/FAQ/related, o corpo sai completo | layout conferido em 25/07 |
| `reviewshield` | `mdx` | `en-US`, `risk: legal-safe`; layout renderiza FAQ e "Related articles" → já declarado `layoutRenders: ["faq","related"]` | layout conferido em 25/07 |
| `aftercare` | `mdx` | `ymyl-restricted`: o gate exige classificação `operational`, todo bloco no escopo operacional e nenhuma palavra clínica → **espere `draft:ymyl` com frequência, não é bug** | layout conferido; `layoutRenders: ["hero","faq","related"]` |

Se alguém tiver mexido no `index.ts` do sirius, fabrica ou estetiacrm desde 25/07, rode o pré-voo de
novo antes de ligar — o `registryUpsert` é exigente e falha antes de qualquer pesquisa.

### 1.2 Ligar

UI (preferido): `hub.roilabs.com.br/seo` → **Sala de Controle Editorial**. O botão mostra **a ação**,
não o estado: `PAUSADO` + "Ativar" liga. O campo **Motivo** só grava ao pausar.

SQL (se a UI estiver fora) — `DATABASE_URL` está no `.env` do roihub:

```sql
update seo_projects
   set enabled = true, paused_reason = null
 where project_slug in ('fabrica','polarisia','estetiacrm','reviewshield','aftercare');

select project_slug, enabled, paused_reason from seo_projects order by 1;   -- 10 true + o '*'
```

A linha `nimblabs` é órfã (o projeto saiu do código) e pode ficar como está.

> **Ressalva registrada, decisão do Jean:** o `handoff-correcao-e-rollout.md` recomendava 2 projetos
> por dia justamente para que uma falha de renderizador aparecesse isolada. Ligando os 5 de uma vez,
> se dois sites quebrarem no mesmo run, o diagnóstico compete com o rate limit. Se quiser o meio
> termo: ligue `estetiacrm`+`fabrica` (renderizador já provado pelo sirius) num dia e os três `mdx`
> no seguinte.

### 1.3 Verificar no dia seguinte

Para cada projeto ligado, nessa ordem:

1. `/seo` → a linha do projeto tem `published`/`updated` (ou um guardrail explicável: `draft:ymyl`,
   `decision:duplicate`, `gsc-unavailable`).
2. O **build do site alvo** ficou verde (EasyPanel/Vercel do repo em questão).
3. A URL do artigo responde **200** e aparece no **sitemap** do site.
4. Se der `llm-rate`: **pare de ligar** e resolva cota antes de qualquer outra coisa.

---

## 2. Mudar o cron para 00:00 BRT

Arquivo: `.github/workflows/seo-autopublish.yml`. O cron do Actions é **UTC** e o Brasil não tem mais
horário de verão, então **00:00 BRT = 03:00 UTC**.

```yaml
on:
  schedule:
    - cron: "0 3 * * *"     # 00:00 BRT
```

### ⚠️ Leia isto antes de commitar o `0 3`

**O minuto `:00` é exatamente o que fez o run de 25/07 não existir.** O `schedule` do Actions não é
garantido: na hora cheia a fila é maior, o run atrasa e às vezes **nem chega a ser criado** — foi por
isso que o horário saiu de 08:00 para 08:17. Repetir `minute: 0` reintroduz esse risco, agora numa
hora em que ninguém está acordado para notar que o dia não publicou.

**Recomendação:** `- cron: "13 3 * * *"` → **00:13 BRT**. Mesma "meia-noite" para efeito prático,
sem a fila da hora cheia.

Se ainda assim for `00:00` cravado, o passo abaixo é obrigatório, porque **o teste trava o horário**:

```js
// test/autopublish.test.mjs — "workflow agenda a manhã BRT fora da hora cheia…"
assert.equal(hour, "11", "11 UTC = manhã em São Paulo");
assert.notEqual(minute, "0");
```

Atualize os dois asserts junto com o YAML (`hour` → `"3"`, e o `notEqual` precisa sair ou virar outra
regra), senão `npm test` fecha vermelho e o gate de CI não deixa passar. O comentário do YAML e o
nome do teste ("agenda a manhã BRT") também deixam de ser verdade — corrija os dois.

### O que mais muda de horário junto

- **Janela de não-push.** Hoje é "não pushe no roihub entre 08:00–08:45 BRT"; passa a ser
  **00:00–01:00 BRT** (com 10 projetos o run é mais longo). Push no roihub durante a execução troca o
  container do hub e os projetos em voo voltam `http-502`/`request-failed`.
- **`runDate`.** `runDateInSaoPaulo()` usa o fuso de São Paulo: às 00:13 BRT o dia **já virou**, então
  o `run_date` é o dia que está começando. É o comportamento certo — 1 artigo por dia civil.
- **Deploy dos sites alvo à noite.** Os builds disparados pelos commits do robô passam a rodar de
  madrugada. Bom (ninguém navegando), com uma ressalva: se um build quebrar, o site fica quebrado
  desde a madrugada até alguém olhar de manhã. Com 10 projetos ligados, vale checar `/seo` logo cedo.
- **Cota.** Rodar à meia-noite tem uma vantagem real: a janela de rate limit chega intacta, sem
  competir com o uso do Jean durante o dia. É o principal argumento a favor da mudança.

### Testar sem esperar 24h

```bash
gh workflow run "SEO autopublish" --ref main -f dry_run=true      # não escreve em repo nenhum
gh run watch <id> --exit-status
```

`dry_run=true` gera o artigo e para antes da imagem e do commit. Um dry-run dos 10 leva ~45 min e
**consome cota de verdade** (a chamada ao modelo acontece), então não rode dois seguidos.

---

## 3. Checklist de fechamento

- [x] `select project_slug, enabled from seo_projects` → 10 projetos `true` (25/07, os 5 de uma vez;
      `nimblabs` segue `false` de propósito — linha órfã)
- [x] `.github/workflows/seo-autopublish.yml` com `13 3 * * *` **e** o teste atualizado
      (`hour === "3"`, nome do teste virou "meia-noite BRT"; o `notEqual(minute, "0")` continua válido)
- [x] `npm test` verde (117/117) e `npx tsc --noEmit` limpo
- [x] Push feito **fora** da janela do cron (11:07 BRT, antes da 1ª execução do horário novo)
- [ ] No dia seguinte: 10 linhas em `/seo`, nenhum build de site vermelho, e o número de `llm-rate`
      anotado — é ele que decide se 10/dia cabe na cota ou se a cadência precisa cair
- [x] Cards de `data/projects.json` atualizados nos 5 que passaram a publicar (risco de renderizador
      de cada um + "run agora à 00:13 BRT")

**Primeiro run no horário novo: 26/07 às 00:13 BRT** (o de 25/07 já rodou às 08:17 pelo cron antigo,
com 5 projetos). Amanhã de manhã é a verificação da §1.3 nos 10.
