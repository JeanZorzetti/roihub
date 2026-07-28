# Handoff — próximo passo do ROI Hub (comece por aqui)

Escrito em 2026-07-28, logo depois do commit `4931c55` (`feat(hub): source the project list from
GitHub, keyed by site URL`), já em `main`.

**Contexto em uma frase:** o roihub deixou de ter lista fixa de 10 projetos — agora todo repo
vivo do GitHub com `homepage` preenchida é um projeto. O detalhe técnico completo está em
`handoff-hub-github.md`; **este arquivo é só o que fazer a seguir, em ordem.**

O código está pronto, testado (128/128), buildado e no ar. **Tudo abaixo é configuração e
curadoria — nada aqui pede alterar código**, exceto o passo 4.

---

## P0 — Confirmar `GITHUB_TOKEN` no ambiente de PRODUÇÃO (bloqueia todo o resto)

Sem essa env o deploy de hoje é **inerte**: o hub roda exatamente como antes (só os 10 curados)
e nada quebra — o que é justamente o risco, porque falha em silêncio.

**Como verificar (30 s):** abrir `https://hub.roilabs.com.br/` e ler o rodapé.

| O que aparece | Significado |
|---|---|
| `GitHub: conectado — 67 repositórios lidos (cache de 10 min).` | ✅ funcionou, pule para o P1 |
| `GitHub: desligado — a env GITHUB_TOKEN não está configurada…` | falta a env no serviço do site |
| `GitHub: ERRO — …` | env existe mas o token está expirado/sem escopo |

**Não consegui verificar isso sozinho:** a prod responde `401` (Basic Auth funcionando, app no
ar), e o `.env` local só tem `GOOGLE_SERVICE_ACCOUNT_JSON` e `DATABASE_URL` — sem `HUB_PASS`.

**Se estiver desligado:** EasyPanel → serviço do roihub → Environment → `GITHUB_TOKEN`. A env já
existe no `.env.example` e é usada pelo autopublishing para commitar, mas **pode estar só no
ambiente do cron, não no do site**. Escopo mínimo: `repo` (sem ele os 8 repos privados somem da
lista). Depois de salvar, redeploy e reconferir o rodapé.

---

## P1 — Limpar os 2 repos que viraram "projeto" sem ser projeto

`Atma` e `repo-de-teste` estão no ranking hoje porque têm `homepage` de preview e não estão
arquivados. `Atma` está **aposentado** (registrado no `handoff-crawl-plano-acao.md`).

```bash
gh repo archive JeanZorzetti/Atma            # ou: gh repo edit JeanZorzetti/Atma --homepage ""
gh repo edit JeanZorzetti/repo-de-teste --homepage ""
```

Some do ranking no próximo load, sem redeploy (cache de 10 min). **Repo arquivado é ignorado
pelo hub** — essa é a forma canônica de aposentar um projeto daqui pra frente.

---

## P2 — Apontar as `homepage` para os domínios reais

São **29 repos com `homepage` preenchida, e os 29 apontam para `*.vercel.app`** — nenhum para o
domínio de produção. Hoje isso não quebra nada (nos 10 curados a URL do `projects.json` vence),
mas em todo repo **não curado** o hub está medindo saúde e GSC contra a URL de preview.

Comece pelos que têm domínio real conhecido:

```bash
gh repo edit JeanZorzetti/prolife_next.js --homepage https://prolifemed.com.br/
gh repo edit JeanZorzetti/roihub          --homepage https://hub.roilabs.com.br/
gh repo edit JeanZorzetti/qprime          --homepage https://qprime.roilabs.com.br/
gh repo edit JeanZorzetti/seven-md        --homepage https://seven-md.com.br/
gh repo edit JeanZorzetti/compass         --homepage https://compass.polarisia.com.br/
```

`qprime.roilabs.com.br` **já está verificado no GSC** e não era medido por ninguém — é o de
maior retorno imediato da lista.

Os outros ~24 (`monolith-muse`, `vertice`, `mk6`, `alibi_ai`, `pathfinder`, `cyberspace`,
`cardio-risk-insight-hub`, …) parecem ser protótipos/experimentos que só existem no preview da
Vercel. Se for o caso, o certo é **arquivar**, não corrigir a homepage — ver a decisão em aberto
no fim deste doc.

---

## P3 — `tapepro` não é medido por ninguém

`tapepro.roilabs.com.br` está no ar, é a **primeira cadeira ocupada do Growth Partner** (Gate 3,
destravado 22/07), tem propriedade verificada no GSC, está ativo no autopublishing… e **não
existe no ranking do hub**, porque não tem repo próprio (mora no monorepo `roilabs`).

Corrige-se com uma entrada nova em `data/projects.json` — o campo `repo` existe exatamente para
esse caso (dois sites, um repositório):

```json
{
  "slug": "tapepro",
  "nome": "Tapepro (fitas adesivas — 1ª cadeira)",
  "url": "https://tapepro.roilabs.com.br/",
  "repo": "roilabs",
  "receita": 0,
  "receitaNota": "",
  "blockers": 0,
  "blockersLista": [],
  "seoSeed": 0,
  "decay": 0,
  "decayNota": "",
  "acao": "",
  "acaoDesc": ""
}
```

Preencher receita/blockers/ação com o Jean antes de commitar — entrada com tudo zerado só
adiciona uma linha morta no fim do ranking. Depois: commit + push (deploy automático).

⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).

---

## P4 — Decisão em aberto: qual é a régua para um repo entrar no ranking?

**Não implemente nada aqui sem decidir com o Jean.** É a única questão de design que ficou
aberta, e ela vai voltar.

Hoje o ranking mostra **37 projetos**, sendo 27 sem curadoria — a maioria protótipo antigo
(`potencial-arquitetado`, `cyberspace`, `mk6`…, vários sem push desde 2025). Eles ficam no fim
(score 0–20, pill `SEM CURADORIA`) e **não** poluem a agenda nem o /insights, mas a tabela da
home ficou longa, e cada um custa 1 health check + 2 queries GSC por load (home hoje: 2,2–3,0 s
em dev).

Três saídas, da mais barata para a mais cara:

1. **Arquivar os protótipos no GitHub.** Zero código, resolve na origem, e o histórico continua
   lá. É a resposta certa se eles de fato estão mortos — provavelmente a maioria.
2. **Filtrar por atividade** (ex.: sem push há > 12 meses não entra). ~3 linhas em
   `lib/projects.mjs`, com teste. Esconde o problema em vez de resolvê-lo, e um projeto parado
   mas vivo some sem aviso.
3. **Não mexer.** "Ver tudo" pode ser exatamente o ponto de um hub de todos os repos.

Recomendação: **(1)**, e só considerar (2) se sobrar cauda longa depois de arquivar.

---

## Como validar que qualquer coisa acima funcionou

```bash
npm test                 # 128/128
npx tsc --noEmit         # limpo
npm run build            # 5 rotas ƒ (dynamic)

# hub real, com dados de verdade (o token vem do gh, não precisa mexer no .env):
GITHUB_TOKEN="$(gh auth token)" HUB_USER=roi HUB_PASS=devcheck npx next dev -p 3199
curl -s -u roi:devcheck http://localhost:3199/ | grep -o 'GitHub: [^<]*'
```

---

## Armadilhas conhecidas (já custaram tempo)

- **Card da agenda ≠ verdade.** As `acao`/`acaoDesc` do `projects.json` são texto à mão e
  apodrecem. Ler o `Repo:` do card e **validar a premissa antes de executar** — em 13/07, 3 de
  10 estavam podres e um mandou trabalhar no repositório errado.
- **`homepage` errada falha em silêncio.** O hub vai health-checkar e consultar o GSC contra a
  URL de preview sem reclamar de nada; o sintoma é "esse projeto não tem dados de SEO".
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites. Se
  aparecer a tentação de chavear por repo, releia o `handoff-hub-github.md`.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo.
  O repo `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
