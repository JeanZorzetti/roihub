# Handoff — renomear subdomínios: EXECUTADO (30/07/2026, 21h–22h BRT)

A leva de nomenclatura de [`handoff-renomear-subdominios.md`](handoff-renomear-subdominios.md) está
**fechada**. 9 renomeações + 2 limpezas, todas verificadas pelo corpo. **Zero hosts duplicados.**

Segue valendo, sem alteração: [`handoff-proximo-passo-02-08.md`](handoff-proximo-passo-02-08.md) —
domingo **02/08, 10:00 BRT**, 1º run do robô de crawl.

---

## ✅ As 9 renomeações

Todas com o mesmo estado final: host novo em 200 servindo `sitemap.xml` que abre com `<?xml` e cujo
`<loc>` aponta para ele mesmo; `homepage` do repo atualizada; sitemap novo aceito no GSC; sitemap
antigo removido do GSC; **host antigo vivo em 308** para o novo.

| host antigo | → host novo | publicação |
|---|---|---|
| `tape-vision-ai-92` | **`tapevision`** | manual, de `Frontend/` |
| `cardio-risk-insight-hub` | **`cardiorisk`** | git push (root = `frontend`) |
| `vertex-landing-craft` | **`verticemarketing`** | git push (o build de git passou; não precisou de manual) |
| `matchfios-textile-connector` | **`matchfios`** | git push |
| `potencial-arquitetado` | **`potencialarquitetado`** | git push |
| `whatsmeow-gateway` | **`whatsmeow`** | manual, de `site/` |
| `claude-loop-runner` | **`claudeloop`** | manual, de `site/` |
| `sem-swarm.nimblabs.com` | **`swarm.nimblabs.com`** | manual, de `site/` |
| `financeiro-obras` | **`orcaobra`** | manual, de `frontend-next/` |

Decisões do Jean nesta sessão: **`orcaobra`** (não `reformamaestro`) e **`cardioqwen3code` e
`cardio-risk-insight-hub` são o mesmo produto**.

### 🚨 A armadilha do push confirmou-se — e na direção oposta à da 2ª leva

Na 2ª leva o push desfez um deploy manual. Aqui foi o inverso e **pior**: os 3 projetos estáticos
(`whatsmeow`, `claudeloop`, `swarm`) publicam de `site/`, mas o `Root Directory` na Vercel é `/`.
O push disparou um build de git que serviu a **raiz do repo**, onde não existe `index.html` — e os
três hosts novos foram para **404**, junto com o `tapevision` (cujo build de git sempre dá ERROR).

Verificar antes do push teria dado verde nos quatro. A ordem que funciona é a do handoff, e ela é
literal: **push primeiro, deploy manual depois, verificação por último**. Foi assim que os quatro
voltaram para 200.

`tape-vision-ai-92` e `reforma-maestro` **só publicam manualmente** — o build de git dá ERROR em
todo commit, nos dois. Não é regressão: é o estado normal deles.

---

## ✅ `cardioqwen3code` — resolvido como canibalização, não como renomeação

O repo **já não existe no GitHub** (404, como o `synth-bot-buddy`) — então já estava fora do hub
sozinho. Sobrava o host, que o GSC conhecia desde 30/07. Feito:

- `cardioqwen3code.roilabs.com.br` **movido** para o projeto `cardio-risk-insight-hub` e posto em
  **308 → `cardiorisk.roilabs.com.br`**. Não foi apagado: matar o host devolveria NXDOMAIN, e aqui
  existe sucessor, então 308 é estritamente melhor.
- Sitemap removido do GSC.
- **Títulos destrocados**: o sobrevivente servia `<title>Sistema IA Médica</title>`. Agora serve
  `CardioCare AI — Análise de Risco Cardiovascular`, que é o nome no README.

🔎 **Gotcha da API da Vercel:** `redirect` só aceita destino que esteja **no mesmo projeto**. Um
`PATCH` cross-project devolve `400 bad_request: "that domain is not added to the project"`. A saída
é `DELETE` do host no projeto velho + `POST` no projeto novo já com `redirect`/`redirectStatusCode`.

---

## ✅ `synth-bot-buddy` — limpo, na ordem certa

1. Sitemap removido do GSC.
2. Projeto apagado na Vercel **pela API, pelo `projectId` exato** (`DELETE /v9/projects/{id}` → 204).
   Conferido depois: 29 → **28 projetos**, e só o `synth-bot-buddy` sumiu — nenhum vizinho.
3. Só então o registro A no Cloudflare.

Diff da zona contra o backup: **40 → 47 registros**, `+8` novos e `−1` (`synth-bot-buddy`). Nada
mais foi tocado. Zona `nimblabs.com` na Hostinger: 14 → 15, com `PUT {"overwrite": false}`.

---

## ⚠️ O que ficou aberto

### `housingpro` — bloqueado por falta de acesso, não por decisão

O Jean pediu o mesmo tratamento do `synth-bot-buddy`. Três dos quatro passos **já não se aplicam**:

- sitemap no GSC: **não existe** (`housingpro` não é propriedade em nenhuma conta);
- projeto na Vercel: **não existe** (por isso `www.housingpro.com.br` já responde **404**, não 200
  como dizia o handoff anterior — mudou entre 30/07 de manhã e a noite);
- repo no GitHub: já apagado.

Sobra só o DNS, e ele **não está no Cloudflare nem na Hostinger**: `housingpro.com.br` usa o DNS do
próprio **Registro.br** (`d.sec.dns.br` / `e.sec.dns.br`). Não há token para isso nesta sessão —
é painel, à mão. Mesmo padrão do resíduo `www` do SplitJud.

**Impacto de deixar como está: zero.** O host devolve 404 e não está em propriedade nenhuma do GSC,
então não consome crawl budget medido. É higiene, não pendência.

### Projeto `cardioqwen3code` vazio na Vercel

Ficou sem nenhum domínio custom (só o `.vercel.app`). Apagar é seguro agora, mas **não foi pedido** —
apagar projeto na Vercel é irreversível, então ficou de fora de propósito.

### Achados de borda, não corrigidos

- `potencial-arquitetado/index.html` tem `og:image` apontando para **`arquiteturadopotencial.com`**
  (sem `.roilabs`), domínio que não existe. Imagem de compartilhamento quebrada. Fora do escopo da
  renomeação.
- `vertice.roilabs.com.br` e `verticemarketing.roilabs.com.br` **não** são canibalização: o primeiro
  é *"Vértice – Automated Client Onboarding"*, o segundo é *"Vértice Marketing"*. Nomes parecidos,
  produtos diferentes. Verificado por título.
- O `reforma-maestro` tinha `reforma-maestro.roilabs.com.br` anexado na Vercel **sem registro DNS
  nenhum** — anexo órfão que o Google nunca viu. Removido, sem 308 (não há o que preservar). O
  canonical morto que apontava para ele, no `frontend/index.html` (Vite aposentado), foi repontado.

---

## 📋 Estado atual

- **36 repos ativos, 34 com site**, 2 sem `homepage` por decisão (`roihub`, `repo-de-teste`).
  O número caiu de 41 porque `cardioqwen3code`, `synth-bot-buddy` e `housingpro` foram apagados —
  não porque algo saiu do ar.
- Cloudflare `roilabs.com.br`: **47 registros**. Hostinger `nimblabs.com`: **15**.
- Vercel: **28 projetos**, cada host servindo um único projeto. **Zero duplicados.**
- GSC: os 9 sitemaps novos aceitos, os 11 antigos removidos (9 renomeados + `cardioqwen3code` +
  `synth-bot-buddy`).

### 🔜 Quando revisitar os 308

Os 10 hosts antigos (9 + `cardioqwen3code`) ficam em 308 **por semanas**, até o Google reprocessar.
O sinal de que pode remover é o `Crawl requests` deles caindo no relatório de crawl stats —
**a mesma métrica de 02/08**, e sujeita à mesma janela de 90 dias. Não remover antes disso.
