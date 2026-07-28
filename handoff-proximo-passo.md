# Handoff — próximo passo do ROI Hub (comece por aqui)

Atualizado em 2026-07-28 (sessão da tarde). A versão anterior deste arquivo listava P0–P4; **P1,
P2, P3 e P4 estão fechados**. O que sobrou está aqui em cima, em ordem.

O detalhe técnico de como o hub passou a ler o GitHub está em `handoff-hub-github.md`.

---

## 🔴 A1 — Três sites de produção estão FORA DO AR

Descoberto ao apontar as `homepage` para os domínios reais (P2). **Não é bug do hub** — foi
confirmado por fora, do host Windows, com `Resolve-DnsName` + `Invoke-WebRequest`:

| site | DNS resolve para | resposta |
|---|---|---|
| `prolifemed.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `seven-md.com.br` | 187.127.2.204 | **timeout** (20 s, sem resposta) |
| `compass.polarisia.com.br` | 2.24.207.200 (VPS EasyPanel) | **404** — vhost não roteado |

Os dois primeiros apontam para o **mesmo IP**, que é um host diferente do VPS do EasyPanel: é
provável que seja **um host caído derrubando dois sites**, não dois problemas. Começar por aí.

O `compass` é outro problema: o DNS chega no VPS certo, mas o EasyPanel não tem domínio
configurado pra esse subdomínio — é config de proxy, não de código.

Os três agora aparecem `✕ FORA DO AR` no ranking do hub, como deviam.

---

## 🔴 A2 — Confirmar `GITHUB_TOKEN` no ambiente de PRODUÇÃO

**Continua pendente e continua bloqueando.** Sem essa env o deploy é inerte: o hub roda como
antes (só a curadoria) e **falha em silêncio**.

**Como verificar (30 s):** abrir `https://hub.roilabs.com.br/` e ler o rodapé.

| O que aparece | Significado |
|---|---|
| `GitHub: conectado — 67 repositórios lidos (cache de 10 min).` | ✅ funcionou |
| `GitHub: desligado — a env GITHUB_TOKEN não está configurada…` | falta a env no serviço do site |
| `GitHub: ERRO — …` | env existe mas o token está expirado/sem escopo |

**Não dá pra verificar daqui:** a prod pede Basic Auth e `HUB_PASS` não está no `.env` local.
Localmente, com `GITHUB_TOKEN=$(gh auth token)`, o rodapé diz **`conectado — 67 repositórios
lidos`** — ou seja, o código está certo; é só a env do serviço.

**Se estiver desligado:** EasyPanel → serviço do roihub → Environment → `GITHUB_TOKEN`. Escopo
mínimo: `repo` (sem ele os repos privados somem da lista). Depois de salvar, redeploy e
reconferir o rodapé.

---

## 🟡 A3 — Arquivar o `Atma` no GitHub (ação manual sua)

`Atma` está aposentado e já **saiu do ranking** (a `homepage` foi limpa), mas o repo continua
vivo. O `gh repo archive` foi **bloqueado pelo classificador de permissões** desta sessão.

```bash
gh repo archive JeanZorzetti/Atma
```

Arquivar é a forma canônica de aposentar um projeto: repo arquivado é ignorado pelo hub, e o
histórico continua lá.

---

## ✅ O que foi feito nesta sessão

**P1 — repos que viraram "projeto" sem ser projeto.** `Atma` e `repo-de-teste` com a `homepage`
limpa; sumiram do ranking (confirmado no render). Falta só arquivar o `Atma` (A3).

**P2 — `homepage` apontando pro domínio real.** Quatro repos corrigidos via API:

| repo | homepage nova | resultado no hub |
|---|---|---|
| `qprime` | `https://qprime.roilabs.com.br/` | **200** · 1277 ms — era o de maior retorno, agora medido |
| `prolife_next.js` | `https://prolifemed.com.br/` | ✕ FORA DO AR (ver A1) |
| `seven-md` | `https://seven-md.com.br/` | ✕ FORA DO AR (ver A1) |
| `compass` | `https://compass.polarisia.com.br/` | ✕ FORA DO AR (ver A1) |

⚠️ **O `roihub` NÃO recebeu `homepage`, de propósito.** O hub está atrás de Basic Auth e
`lib/health.ts` usa `res.ok` — um 401 faria o hub se reportar como "FORA DO AR" pra sempre. Se
alguém quiser o roihub no ranking, o health check precisa aceitar 401 antes.

**P3 — `tapepro` entrou no ranking.** Entrada nova em `data/projects.json` com `"repo":
"roilabs"` (dois sites, um repositório). Valores confirmados com o Jean: `receita: 6` (1ª cadeira
ocupada do Growth Partner, comissão 15%/10% contratada, sem venda registrada), `blockers: 1`,
`seoSeed: 3` (ignorado — o tapepro tem GSC, o dado real vence), `decay: 3`. **`acao` vazia de
propósito** — não há tarefa de dev real, e card inventado apodrece (ver Armadilhas). Renderiza
na 7ª posição, health 200 · 958 ms.

**P4 — a régua do ranking: decidido "não mexer".** Todos os repos com `homepage` entram, sem
filtro de atividade e sem arquivar os protótipos. "Ver tudo" é o ponto de um hub de todos os
repos. Zero código. **Não reabrir sem o Jean pedir.**

---

## Como validar

```bash
npm test                 # 128/128
npx tsc --noEmit         # limpo
npm run build            # 5 rotas ƒ (dynamic)

# hub real, com dados de verdade (o token vem do gh, não precisa mexer no .env):
GITHUB_TOKEN="$(gh auth token)" HUB_USER=roi HUB_PASS=devcheck npx next dev -p 3199
curl -s -u roi:devcheck http://localhost:3199/ | grep -o 'GitHub: [^<]*'
```

Para inspecionar as `homepage` sem abrir o browser:

```bash
gh repo list JeanZorzetti --limit 100 --json name,homepageUrl,isArchived,pushedAt
```

Editar `homepage` pelo `gh repo edit --homepage ""` **não funciona no PowerShell** (a string
vazia é engolida e o flag reclama de argumento). Use a API:

```bash
echo '{"homepage":""}' | gh api repos/JeanZorzetti/<repo> -X PATCH --input -
```

---

## Armadilhas conhecidas (já custaram tempo)

- **Card da agenda ≠ verdade.** As `acao`/`acaoDesc` do `projects.json` são texto à mão e
  apodrecem. Ler o `Repo:` do card e **validar a premissa antes de executar** — em 13/07, 3 de
  10 estavam podres e um mandou trabalhar no repositório errado.
- **`homepage` errada falha em silêncio.** O hub vai health-checkar e consultar o GSC contra a
  URL de preview sem reclamar de nada; o sintoma é "esse projeto não tem dados de SEO".
- **Site atrás de Basic Auth se reporta como fora do ar.** `lib/health.ts` usa `res.ok`, então
  401 conta como caído. Vale pro roihub e pra qualquer coisa protegida.
- **A chave de um projeto é a URL do site, nunca o nome do repo.** Um repo serve N sites. Se
  aparecer a tentação de chavear por repo, releia o `handoff-hub-github.md`.
- **SplitJud fica de fora do hub** por decisão do Jean (10/07) — projeto dividido com o Aldo.
  O repo `splitjud` aparece na lista "sem site"; **não** preencha a homepage dele.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
