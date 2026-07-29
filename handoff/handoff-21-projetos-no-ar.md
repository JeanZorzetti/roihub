# Handoff — colocar os 21 projetos no ar

Criado em **2026-07-29**, **executado no mesmo dia**. Índice: [`../handoff.md`](../handoff.md).
Como a lista de projetos vem do GitHub: [`handoff-hub-github.md`](handoff-hub-github.md).

**Resumo em uma linha:** os 21 "fora do ar" devolviam `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` porque
**os projetos não existiam mais na Vercel**. Resolvido: 6 repos excluídos pelo Jean + 13 redeployados.
O hub saiu de **5 no ar / 23 fora** para **18 no ar / 4 fora**.

---

## Estado em 29/07 (medido no fim da execução)

| resultado | quantos | quais |
|---|---|---|
| **200** | **19** | `alibi_ai` `cardio-risk-insight-hub` `cardioqwen3code` `cyberspace` `eg` `housingpro` `matchfios-textile-connector` `monolith-muse` `orion-nova-ui` `pathfinder` `portfolio` `potencial-arquitetado` `qprime` `reforma-maestro` `roi-zenith` `sirius` `synth-bot-buddy` `tape-vision-ai-92` `vertex-landing-craft` |
| 404 | 3 | `compass` `sofia-ia` `vertice` — ver §3 |

**Repos excluídos pelo Jean** (somem do hub sozinhos, a lista vem do GitHub): `amaze`,
`secure-business-architect`, `andorinha-digital`, `pulse-tronic-install-pro`, `sofia-ai-lux-dash`,
`mk6`, `prolife`.

`sirius` era só `homepage` errada — apontava pro alias morto `sirius-ebon.vercel.app` enquanto
`siriuscrm.com.br` respondia 200 o tempo todo. **Use a apex**, `www.siriuscrm.com.br` dá 404.

---

## 1. ⛔ A armadilha que quase matou a execução: OneDrive quebra `vercel --prod`

`vercel --prod` rodado de qualquer pasta **dentro do OneDrive** morre com:

```
Error: UNKNOWN: unknown error, read
```

O CLI lê os arquivos pra subir e bate num que o OneDrive não hidratou. `--archive=tgz` não ajuda.

**A solução é clonar fora do OneDrive** (`$TEMP`, `C:\dev`) e deployar de lá:

```bash
cd /c/dev && git clone --depth 1 https://github.com/JeanZorzetti/<repo>.git
cd <repo>            # ou cd <repo>/<subdir> nos monorepos — ver §2
vercel link --yes --project <nome>
vercel --prod --yes
```

⚠️ `git clone` também falha em repo com `node_modules` commitado (`Filename too long`, foi o
`cardioqwen3code`). Use `git -c core.longpaths=true clone`.

---

## 2. Monorepo: entre no subdiretório, não configure root directory

O handoff original mandava setar **Root Directory** no dashboard. **Não precisa**: como o deploy é
upload local, basta rodar o `vercel link` + `vercel --prod` **de dentro do subdiretório**. Zero config.

Root directory de cada um (confirmado abrindo o `package.json`, não chutado):

| repo | subdir | por quê |
|---|---|---|
| `reforma-maestro` | `frontend-next` | o `frontend` é o scaffold Lovable (Vite) legado |
| `cardio-risk-insight-hub` | `frontend` | o `cardio-risk-insight-hub-main` é o scaffold Lovable legado |
| `pathfinder` · `cardioqwen3code` | `frontend` | o outro subdir é backend |
| `tape-vision-ai-92` | `Frontend` (maiúsculo) | idem |
| `synth-bot-buddy` | `frontend` | o repo é Python (bot Deriv), mas o `frontend/` builda e sobe |

---

## 3. O que ainda está fora (3)

- **`sofia-ia` (Polaris)** — único de produção ativa. Projeto Vercel **já criado e conectado ao
  GitHub**, sem envs. Falta: (a) preencher `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `CRON_SECRET`,
  `NEXT_PUBLIC_APP_URL` + chaves Evolution/OpenRouter/Threads/Sirius; (b) recriar o registro DNS no
  **Cloudflare** — `sofiaia.roilabs.com.br` é **NXDOMAIN**, caiu junto com os 14 subdomínios
  aposentados ([[roilabs_dns_cloudflare_retired_subdomains]]). Segredos de produção não foram copiados
  sem autorização explícita.
- **`vertice`** → `X-Vercel-Error: NOT_FOUND`, não `DEPLOYMENT_NOT_FOUND`. O projeto existe, a rota `/`
  é que não casa. **É config de rota, não deploy.**
- **`compass`** → o A1, 404 na EasyPanel. Segue em [`handoff-proximo-passo.md`](handoff-proximo-passo.md).

### `prolifemed` — resolvido por exclusão
O handoff de 28/07 dizia que precisava de vhost na EasyPanel; depois se descobriu que o app estava na
Vercel (`prolife-next-js`, segundo ambiente com Supabase **vazio**). **O Jean excluiu o repo `prolife`**
— saiu do hub, assunto encerrado.

---

## 4. Consertos de build aplicados (commitados e pushados nos repos)

| repo | erro | conserto |
|---|---|---|
| `reforma-maestro` | build **passava**, deploy bloqueado: `Vulnerable version of Next.js detected` | `next` → `^16.2.12` |
| `cardioqwen3code` | `tailwindcss` como plugin PostCSS direto | `package.json` pedia v4 mas o CSS usa `@tailwind base` (v3) → pinado `^3.4.17` |
| `potencial-arquitetado` | `experimentalServices` não existe mais na plataforma | removido do `vercel.json` |
| `potencial-arquitetado` | depois disso: `framework is set to "services", but no services are declared` | **`"framework": "vite"` no `vercel.json`** — a 1ª tentativa falhada gravou `services` nas settings do projeto e ele fica travado lá |
| `orion-nova-ui` | `P1012 Environment variable not found: DATABASE_URL` | `DATABASE_URL` (banco `orion_db`, porta 5449) na env `production` da Vercel |
| `orion-nova-ui` | `P3018 / 42P01 relation "notifications" does not exist` | **o model `Notification` e o enum `NotificationType` entraram no schema sem migration** — `add_notification_metadata` fazia `ALTER TABLE` numa tabela que nunca foi criada. Criada a `20260124000000_add_notifications` + `prisma migrate resolve --rolled-back` pra destravar o registro falho |
| `orion-nova-ui` | `Missing API key. Pass it to the constructor new Resend(...)` | `new Resend()` no topo do módulo em 2 arquivos → lazy. As guardas de "não configurado" já existiam no envio; só a **construção** era ansiosa |

---

## Como reverificar tudo (~2 min)

```bash
gh repo list JeanZorzetti --limit 200 --json name,homepageUrl,isArchived \
  --jq '.[] | select(.isArchived==false) | select(.homepageUrl != "") | [.name,.homepageUrl] | @tsv' \
| while IFS=$'\t' read -r name url; do
    code=$(curl -sk -L -o /dev/null -w '%{http_code}' --max-time 20 "$url")
    err=$(curl -skI --max-time 12 "$url" | grep -i '^x-vercel-error' | tr -d '\r' | cut -d' ' -f2)
    printf '%s\t%s\t%s\t%s\n' "$code" "${err:--}" "$name" "$url"
  done | sort

vercel project ls        # a lista de quem REALMENTE existe — é a fonte da verdade
```

---

## Armadilhas (desta execução)

- ⛔ **`vercel --prod` não funciona sob OneDrive** — `UNKNOWN: unknown error, read`. Clone fora. §1.
- **Status 404 não classifica nada.** Os mesmos 404 vinham de **três** causas (projeto apagado, rota
  não casada, vhost ausente). Sem o header `x-vercel-error` você conserta o errado.
- **`vercel project ls` é a fonte da verdade, não o browser.**
- **A chave de um projeto no hub é a URL, nunca o repo.** Deploy feito + `homepage` velha = segue ✕.
  **Mas:** se o projeto Vercel nascer com o mesmo nome do alias antigo, o alias volta e o PATCH é
  desnecessário — foi o caso de 8 dos 13. Confira antes de PATCHar.
- **`gh repo edit --homepage` não funciona no PowerShell** — usar `gh api -X PATCH --input -`.
- **`vercel project rm` é interativo e `--yes` não existe nele** — `yes |` não resolve, trava. Se o
  projeto ficar com setting ruim, **sobrescreva pelo `vercel.json`** em vez de recriar.
- **Alias de preview ≠ URL de produção.** Foi a causa-raiz dos 21. Sempre a Latest Production URL.
- ⚠️ **Janela de não-push: 00:00–01:00 BRT** (o cron do autopublishing roda 00:13).
