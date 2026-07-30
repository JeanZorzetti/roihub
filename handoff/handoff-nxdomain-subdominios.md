# NXDOMAIN dos 14 subdomínios do roilabs.com.br — guiar o Jean no Cloudflare

**29/07/2026.** Item nº 1 da tabela "Ordem de execução" do
[`handoff-crawl-plano-acao.md`](handoff-crawl-plano-acao.md) — o único que nunca saiu, porque é
painel de terceiro e nenhuma sessão de código o resolve.

**Resumo:** 4.908 dos 6.408 requests do Googlebot na propriedade `roilabs.com.br` (**76,6%**) vão
para 14 hosts que não resolvem. `NXDOMAIN` não converge — o bot tenta para sempre e o número
**piora sozinho** conforme a janela de 90 dias rola. Conserto = 14 registros A + 4 Redirect Rules na
borda do Cloudflare. **~20 min de painel, zero código.** Vale +43 pp de OK no roilabs e é o único
item do plano de crawl que muda a ordem do ranking do hub.

---

## ⚠️ Leia isto antes de abrir a receita

### 1. O caminho da receita está errado em dois lugares

`handoff-crawl-plano-acao.md:214` e a memória `roilabs_dns_cloudflare_retired_subdomains` apontam
para `ROI Labs/Docs/Obsidian/80-dev/roilabs-subdominios-aposentados.md`. **Essa pasta não existe** a
partir da raiz do desktop. O arquivo real está no repo `roilabs` aninhado:

```
C:\Users\jeanz\OneDrive\Desktop\ROI Labs\ROI Labs\Docs\Obsidian\80-dev\roilabs-subdominios-aposentados.md
```

(Note o `ROI Labs\ROI Labs\` — desktop, depois o repo.) A receita está **completa e correta**:
expressões prontas, por que 301 e não 410, por que não usar wildcard. **Não reescreva.** Este
handoff só corrige a Regra 4 e conduz a execução.

### 2. A Regra 4 mudou — 4 dos 10 "mortos" estão vivos

A receita foi escrita em 25/07, quando os 14 hosts eram "todos aposentadoria". Na sessão de 29/07 o
Jean decidiu **ressuscitar ~20 projetos como subdomínio do roilabs** para disputarem espaço no GSC.
Cruzando essa lista com a tabela de hosts, **4 dos 10 da Regra 4 são repos ativos com site no ar**:

| host morto | req | repo ativo no GitHub | site hoje |
|---|---|---|---|
| `alibi.roilabs.com.br` | 482 | `alibi_ai` | `alibi-ai.vercel.app` |
| `pathfinder.roilabs.com.br` | 146 | `pathfinder` | `pathfinder-two-phi.vercel.app` |
| `orion.roilabs.com.br` | 60 | `orion-nova-ui` | `orion-nova-ui.vercel.app` |
| `vertice.roilabs.com.br` | 56 | `vertice` | `vertice-weld.vercel.app` |

**Isso é sorte, não problema.** Esses 4 hosts já têm histórico de crawl (744 requests somados) — o
Googlebot já conhece o hostname. Revivê-los no mesmo nome custa menos que criar subdomínio novo do
zero, que começa em zero.

**Mas vira armadilha se você errar a ordem:** Redirect Rule dispara **na borda, antes do origin**.
Se o host estiver na Regra 4 no dia em que o site subir, o site fica invisível — 301 para o apex,
sem nunca chegar no servidor. E o sintoma parece "deploy quebrado".

**A decisão (não espere os sites ficarem prontos):** deixe os 4 na Regra 4 **agora** — 301 hoje é
melhor que NXDOMAIN por mais algumas semanas — e **remova o hostname da expressão no dia em que cada
site for apontado.** Uma edição de uma linha por site. O checklist está no fim deste doc.

---

## Estado medido (baseline de 25/07 — comparar contra isto)

Fonte: `roihub/docs/Crawl-stats/roilabs.com.br/roilabs.com.br-Crawl-stats-2026-07-25/Hosts table.csv`
(**é o único export que existe**; o próximo export é a régua).

| grupo | hosts | requests | % |
|---|---|---|---|
| ✅ **Vivos** — não tocar | `roilabs`, `www.roilabs`, `goiania`, `tapepro`, `app` | 1.500 | 23,4% |
| 🔵 **Com sucessor** → 301 preservando path | `sirius`, `www.sirius`, `sofiaia`, `www.goiania` | 2.849 | 44,5% |
| 🟡 **A ressuscitar** → 301 temporário | `alibi`, `pathfinder`, `orion`, `vertice` | 744 | 11,6% |
| 🔴 **Mortos de verdade** → 301 estático | `atma`, `atmaadmin`, `atmaapi`, `clerk.atma`, `jbadvocacia`, `andorinha` | 1.315 | 20,5% |

`atma`, `atmaadmin`, `atmaapi` e `clerk.atma` são morte confirmada — o Jean confirmou em 25/07 que
**o Atma não existe mais**. `jbadvocacia` e `andorinha` não têm repo correspondente no GitHub.

---

## ✅ APLICADO em 29/07/2026 — o que está no ar agora

Rodado por `scripts/cloudflare-redirects.mjs` com token de zona (DNS + Dynamic URL Redirects, Edit).
14 registros A proxied criados, 4 Redirect Rules no phase `http_request_dynamic_redirect`
(ruleset `13d7deb171a04a8e909b4812347b168a`, nenhuma regra de terceiro existia).

| host | https | destino |
|---|---|---|
| `sirius` | 301 | `siriuscrm.com.br` + path |
| `sofiaia` | 301 | `polarisia.com.br` + path |
| `atmaadmin` `atmaapi` `clerk.atma` `jbadvocacia` `andorinha` `alibi` | 301 | `roilabs.com.br/` |
| `atma` `pathfinder` `orion` `vertice` | **200** | promovidos horas depois — ver abaixo |
| `www.sirius` `www.goiania` | ⚠️ falha TLS | 301 só em `http://` (ver nota 2 abaixo) |
| `goiania` `tapepro` | **200** | intactos, grey cloud, nada encostou em produção |

**Não olhe o OK% do GSC** para validar — leia a seção "Como saber se funcionou" no fim.

## ✅ Ressurreição executada no mesmo dia — `atma`, `pathfinder`, `orion`, `vertice`

O Jean pediu esses quatro de volta poucas horas depois (e dispensou o `alibi`, que segue em 301).
Os quatro saíram da Regra 4 e viraram `A 76.76.21.21` **DNS only** — a nuvem laranja impede a Vercel
de emitir o certificado do domínio. No script isso é uma linha em `PROMOVIDOS`: mover o sub de
`RESSUSCITAR` para lá e rodar faz os passos 1 e 2 do checklist **num ato só, na ordem certa**.

| host | projeto Vercel | repo (homepage já apontada) |
|---|---|---|
| `atma` | `atma` — o domínio **nunca saiu do projeto**, só o DNS tinha sumido | `Atma` (estava **arquivado**, desarquivado em 29/07) |
| `pathfinder` | `pathfinder` | `pathfinder` |
| `orion` | `orion-nova-ui` | `orion-nova-ui` |
| `vertice` | `vertice` | `vertice` |

O `vercel domains add <host> <projeto>` **já estava feito** para os quatro — o CLI responde
`alias_conflict` quando o domínio já está no projeto, e a primeira execução (que parece falhar,
porque imprime as instruções de nameserver) na verdade adiciona. `vercel domains inspect <host>` é
quem diz a verdade. Depois do DNS a Vercel leva alguns minutos para emitir o cert: nesse meio-tempo
o host dá `CERT_HAS_EXPIRED` ou 404, e isso **não é erro de configuração**.

### O Atma ficou pela metade — de propósito

O Jean quer **app + admin + api** (dispensou o `clerk`). Só o app voltou:

| host | estado | o que falta |
|---|---|---|
| `atma` | ✅ 200 | — |
| `atmaadmin` | 🔴 301 para o apex | **não existe projeto na Vercel.** O admin é `Atma/Site/admin`; precisa de projeto novo + as env (`NEXT_PUBLIC_API_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` — ver `Site/DEPLOY_PRODUCAO.md`). ⚠️ o repo está no OneDrive, e `vercel --prod` quebra lá ([[vercel_deploy_fails_under_onedrive]]) — clonar fora antes |
| `atmaapi` | 🔴 301 para o apex | **container + MySQL no EasyPanel** (`DB_HOST=atma-mysql`, `atma_aligner`). Painel de terceiro, sem credencial nesta sessão. O `Site/Backend` tem Dockerfile pronto |

Os dois ficam em `MORTOS` no script (301) **enquanto não existir destino** — não é engano, é a mesma
armadilha de ordem: apontar o A antes de o serviço existir troca um 301 por um 404, que é pior.
Quando subirem, viram linha em `PROMOVIDOS`.

---

## Execução — o caminho curto (29/07)

**`node scripts/cloudflare-redirects.mjs` faz os 18 passos abaixo por API.** Os 14 registros + as 4
regras estão codificados lá com as mesmas expressões desta receita; o `RESSUSCITAR` no topo do
arquivo é a lista da Regra 4 que sai por último (checklist do fim deste doc = apagar uma linha e
rodar de novo). É idempotente e preserva Redirect Rules de terceiros no mesmo phase.

```bash
node scripts/cloudflare-redirects.mjs --verify    # sem token, só mede (roda hoje)
CLOUDFLARE_API_TOKEN=... node scripts/cloudflare-redirects.mjs
```

O token é o único clique que sobra: **My Profile → API Tokens → Create Token → "Edit zone DNS"**,
zona `roilabs.com.br`, **mais a permissão `Zone → Config → Edit`** (é ela que libera Redirect
Rules — o template de DNS sozinho dá 403 nas regras).

Se preferir clicar, os passos manuais abaixo continuam válidos e idênticos.

### Duas coisas medidas em 29/07 que a receita de 25/07 não tinha

1. **Hoje nada na zona é proxied.** `roilabs`, `goiania` e `tapepro` resolvem direto para
   `2.24.207.200` (nuvem cinza). Ou seja: nenhuma Redirect Rule dispara hoje, e a **nuvem laranja
   nos 14 novos não é detalhe — é o que faz a solução existir.**
2. **`www.sirius` e `www.goiania` só ficam curados no `http://`** (medido depois de aplicar, não
   teórico). O certificado Universal do Cloudflare cobre `roilabs.com.br` + `*.roilabs.com.br` — um
   label — então esses dois dão `SEC_E_ILLEGAL_MESSAGE` no handshake, antes de a regra rodar; no
   `http://` redirecionam normal. **`clerk.atma` também tem 3 labels e funciona em https** (tem
   certificado de algum pack antigo da época do Atma; o token não tem permissão de ler
   `ssl/certificate_packs` para confirmar). Curar os dois exigiria Total TLS/ACM (~US$10/mês) —
   **não vale por uma faxina de índice**, mas os 698 req do `www.sirius` não somem inteiros.

### Onde tudo mora

Tudo em **Cloudflare → zona `roilabs.com.br`**. Os nameservers são `stephane.ns.cloudflare.com` /
`javier.ns.cloudflare.com` — confirmado 25/07 e de novo em 29/07. **Não é EasyPanel**, não procure
vhost.

### Passo 1 · DNS — 14 registros A

`DNS → Records → Add record`. Para cada host: tipo `A`, valor `2.24.207.200`, **Proxied (nuvem
laranja)**.

```
sirius            atma              alibi
www.sirius        atmaadmin         pathfinder
sofiaia           atmaapi           orion
www.goiania       clerk.atma        vertice
                  jbadvocacia
                  andorinha
```

> 🚫 **Não use wildcard `*.roilabs.com.br`.** Casa **um label só**: pega `sirius` mas não
> `www.sirius` (698 req), `www.goiania` nem `clerk.atma`. Deixaria 3 dos 14 de fora, incluindo o
> segundo maior. A economia de digitar é ilusória.

O IP é quase irrelevante (a regra dispara antes do origin), mas apontar para a máquina real evita
`522` se alguma regra falhar.

### Passo 2 · Redirect Rules — 4 regras

`Rules → Redirect Rules → Create rule`. Todas com **301** e **"Preserve query string"** ligado.

**1. Sirius → siriuscrm.com.br** — 2.000 req, o maior e o único que carrega sinal de verdade

```
http.host in {"sirius.roilabs.com.br" "www.sirius.roilabs.com.br"}
→ concat("https://siriuscrm.com.br", http.request.uri.path)
```

**2. Sofia → polarisia.com.br** — 845 req

```
http.host eq "sofiaia.roilabs.com.br"
→ concat("https://polarisia.com.br", http.request.uri.path)
```

**3. www.goiania → goiania** — 4 req, só a variante www de um destino que está no ar

```
http.host eq "www.goiania.roilabs.com.br"
→ concat("https://goiania.roilabs.com.br", http.request.uri.path)
```

**4. Sem destino → apex** — ⚠️ **expressão corrigida: 10 hosts, dos quais 4 saem depois**

```
http.host in {"atma.roilabs.com.br" "atmaadmin.roilabs.com.br" "atmaapi.roilabs.com.br"
              "clerk.atma.roilabs.com.br" "jbadvocacia.roilabs.com.br" "andorinha.roilabs.com.br"
              "alibi.roilabs.com.br" "pathfinder.roilabs.com.br" "orion.roilabs.com.br"
              "vertice.roilabs.com.br"}
→ https://roilabs.com.br/     (URL estática — NÃO use concat)
```

**Por que estático na Regra 4 e `concat` nas 1–3:** nas três primeiras as URLs migraram 1:1 (mesmo
app, domínio novo), então preservar o path leva o visitante à página certa. Na Regra 4 não existe
página correspondente — mandar `/dashboard` do Atma para `roilabs.com.br/dashboard` só troca um 404
por outro.

**Por que 301 e não 410:** `410 Gone` é mais correto para conteúdo que não volta, mas Redirect Rule
não emite 410 — precisaria de um Worker, e um Worker em rota `*.roilabs.com.br/*` passaria a
interceptar **goiania e tapepro, que são produção**. Não vale pôr código na frente de um e-commerce
por uma faxina de índice. O 301 em massa para página irrelevante o Google trata como soft 404 e
derruba as URLs do mesmo jeito.

### Passo 3 · Conferir na hora

```bash
curl -sI https://sirius.roilabs.com.br/pricing | head -3   # 301 → siriuscrm.com.br/pricing
curl -sI https://atma.roilabs.com.br/qualquer  | head -3   # 301 → roilabs.com.br/  (sem path)
curl -sI https://alibi.roilabs.com.br/         | head -3   # 301 → roilabs.com.br/  (temporário)
curl -sI https://goiania.roilabs.com.br/       | head -3   # 200 — INTACTO, este é o teste que importa
curl -sI https://tapepro.roilabs.com.br/       | head -3   # 200 — INTACTO
```

Os dois últimos são o teste de segurança: as regras são presas a hostname explícito justamente para
não encostar em produção. Se algum deles não der 200, desligue a regra antes de investigar.

---

## Como saber se funcionou (e o erro que você vai querer cometer)

🚨 **NÃO olhe o Crawl Stats na semana que vem e NÃO olhe o OK%.** A janela do GSC é de 90 dias
([[gsc_crawl_stats_stale_90d_window]]): os dias ruins continuam dentro da média por ~3 meses, então
o percentual de erro de DNS **vai continuar subindo mesmo com tudo certo**. Já aconteceu antes nesta
mesma propriedade — o "40,6% OK" do roilabs era problema já corrigido, zero bug vivo.

**O sinal correto é o `Crawl requests` dos hosts mortos CAINDO** na tabela de hosts do próximo
export. Baixe um export novo, salve em
`roihub/docs/Crawl-stats/roilabs.com.br/roilabs.com.br-Crawl-stats-<data>/` e compare o
`Hosts table.csv` com o de 25/07 acima.

**Prazo real:** 33,6% → ~90% de OK ao longo de ~90 dias.

---

## Checklist de ressurreição — fazer JUNTO com cada site novo

No dia em que `alibi` / `pathfinder` / `orion` / `vertice` ganhar site próprio, **nesta ordem**:

1. **Remover o hostname de `RESSUSCITAR` em `scripts/cloudflare-redirects.mjs` e rodar o script**
   (ou tirar o hostname da expressão da Regra 4 no painel) — e só então
2. Trocar o registro A daquele host para o destino real (Vercel: `A 76.76.21.21`, ou o CNAME que a
   Vercel pedir; desligar o proxy laranja se a Vercel reclamar do cert)
3. Atualizar a `homepage` do repo no GitHub — `gh repo edit JeanZorzetti/<repo> --homepage https://<host>.roilabs.com.br` — senão o roihub continua rankeando a URL `.vercel.app` velha
4. `curl -sI` no host: 200, não 301

Inverter 1 e 2 dá "deploy quebrado" que não é deploy quebrado: a Redirect Rule ganha do origin.

---

## O que NÃO fazer

- ❌ **Não apagar os registros DNS** achando que resolve. Apagar É o problema atual — NXDOMAIN não
  converge, o Googlebot nunca desiste e a autoridade do host evapora.
- ❌ **Não criar vhost catch-all no EasyPanel.** O DNS está no Cloudflare; a solução na borda não
  encosta em `2.24.207.200` e por isso não arrisca goiania/tapepro. Uma sessão anterior já propôs o
  catch-all e era solução muito maior com risco em produção.
- ❌ **Não usar wildcard DNS nem Worker em rota wildcard** — os dois pegam produção junto.
- ❌ **Não mexer em `app.roilabs.com.br`.** Já resolvido: `src/app/robots.ts` com `Disallow: /`
  (é painel, não deveria estar no índice).

---

## Pergunta em aberto (não bloqueia — decidir só no passo 3 do checklist)

Na sessão de 29/07 a recomendação foi separar por marca: produto BR sob `*.roilabs.com.br`, dev tool
em inglês sob `*.nimblabs.com`, para o painel do GSC não virar média de coisas incomparáveis. Os 4
hosts a ressuscitar (`alibi`, `pathfinder`, `orion`, `vertice`) parecem produto BR e ficam bem no
roilabs — mas se algum for reposicionado como dev tool em inglês, ele muda de marca e o registro A
não deve ser criado aqui. Isso só importa na hora de apontar o site, não agora.

---

## Contexto herdado

- Receita original: `ROI Labs\ROI Labs\Docs\Obsidian\80-dev\roilabs-subdominios-aposentados.md`
- Plano de crawl completo (8 propriedades, itens 2–5 já executados):
  [`handoff-crawl-plano-acao.md`](handoff-crawl-plano-acao.md)
- Estado de DNS/painéis dos outros domínios: [`handoff-dns-e-paineis.md`](handoff-dns-e-paineis.md)
- Memórias relevantes: `roilabs_dns_cloudflare_retired_subdomains`,
  `gsc_crawl_stats_stale_90d_window`, `roihub_github_sourced_projects`
