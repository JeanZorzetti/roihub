# Handoff — 030 · a leitura por página soma os hosts declarados

**Estado em 19/09/2026 (noite)**: US1, US2 e US3 implementadas e verdes (`npm test` 1065/1065, `tsc` limpo).
**No ar** desde 19/09 20:35 BRT (e1a22ed; conferido 20:38 e 20:49).
**Não feito**: rollout do autopublishing (T030/T031) e dois critérios de sucesso que a spec não consegue
cumprir do jeito que estão escritos (abaixo).

## O que mudou

- `lib/gsc-hosts.mjs` (novo, puro) — `mesclarPorCaminho`: uma linha por caminho, posição ponderada por impressões.
- `lib/gsc.ts` — `lerPorHosts` é o caminho ÚNICO; `gscConsultas`, `gscPaginas` e `gscQueryPages` recebem `hosts: string[]`.
- `app/okr/[slug]/aquisicao/page.tsx` — passa `hostsDeclarados(p)`; declara "hosts somados: A + B" (mesma assinatura da série); frases de ausência e de teto por propriedade.
- `lib/okr-coleta.ts` — `gscPaginas(hostsDeclarados(p), …)`.
- `lib/autopublish.ts` + `app/api/seo/autopublish/route.ts` + `lib/projects.ts` — `dominioAnteriorDoSlug`, injetado (ver gotcha 1).
- `scripts/conferir-soma-hosts.mjs` — `--pagina` e `--consulta`, sem passar por `mesclarPorCaminho`.
- `test/gsc-hosts.test.mjs` (29 testes, novo) e 3 testes em `test/autopublish.test.mjs`. `GLOSSARIO.md`: "Host sem propriedade".

## Decisões que não estavam na spec (e por quê)

1. **Injeção do `dominioAnterior` no autopublishing.** `lib/projects.ts` usa `@/` e não carrega no Node; `lib/autopublish.ts` e a rota são carregados pelos testes. Import estático derrubou 4 testes de rota. Hoje: dependência em `publishProject`, injetada pela rota por `import()` dinâmico. **Sem injeção, um host só** — quem criar um segundo chamador de `publishProject` precisa lembrar disso.
2. **strict + host sem propriedade continua `[]`** (o contrato C4.3 dizia "lança"). Lançar pararia a pauta de um projeto que hoje roda; só lista vazia lança. Fixado por teste.
3. **`null` quando nenhum host tem propriedade**; `encerrados` só aparece com algum host vivo. A tela nomeia `hostsDeclarados(p)` no caso `null`.
4. **`{erro}` = `"<host>: <msg>"`, msg em 60 caracteres.** Falha global (token, lista de sites) nomeia todos os hosts.

## Pendências, em ordem

1. **Decidir SC-001/SC-002** (dono). Medido: o bloco lê `query`+`page` e o Search Console omite as consultas raras — **10.395 de 24.664 impressões (42,1%)**, 14 URLs, **6 avaliadas, 0% no piso**. A spec afirmava ≥ 99%, 23 páginas, 13,04%: esses números saem da dimensão `page` (29 páginas, 24 avaliáveis, 3 atingem = 12,5%). Opções: reescrever os SC contra `query`+`page`, ou alimentar o CTR Gap pela dimensão `page`.
2. **Spec 031: `gscSeries(p.url)` multi-host** (D8 da research). É o que a tela contradiz hoje: "recebido 6 dos 28 dias" ao lado de "hosts somados". Também trava a T024 (`impressoesV` de um host contra média por página de dois).
3. **Rollout do autopublishing** (constituição): `dry_run=true` e os quatro canários (goiania, tapepro, sirius, context). Nenhum foi executado — precisa do `CRON_SECRET` de produção e gasta quota do claude-cli. O risco que eles protegem (a leitura de busca) foi coberto por paridade byte a byte com dado real nos 10 sites; o que sobra é o restante do fluxo, que não foi tocado.
4. Defeito pré-existente, achado no caminho: no bloco de consultas a 360px as linhas `ul.lts > li` do componente `Leitura` passam da borda (direita em 381 > 360). Não é desta spec.

## Gotchas do ambiente

- A rota do autopublishing foi exercitada localmente (dry-run com `GITHUB_TOKEN` inválido → `github-auth`): o `import()` dinâmico resolve.
- Verificação na tela sem o segredo real: `HUB_USER=roi HUB_PASS=<qualquer> npm run dev` — o `.env` não sobrescreve variável já definida no shell.
- Falha injetada para provar o caminho de erro: `HTTPS_PROXY=http://127.0.0.1:9 npm run dev` (o gaxios respeita; tudo do Google falha).
- Os números da spec (98/8, 24.566/426, 24.664/434, 5 páginas em comum) foram **reproduzidos** por `node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-08-20 2026-09-16 --pagina`. `--consulta` dá os 10.395.
- A lista de sites do Search Console fica em cache 10 min no módulo: teste com client falso tem de usar a MESMA lista e variar os hosts pedidos.
- Posição de uma linha só não pode passar por `(p × i) ÷ i`: `(3,9 × 1146) ÷ 1146 = 3,8999999999999995`. A mescla devolve o valor do Google como veio.
