# Handoff — 056 Vitais de campo próprios (RUM)

**Estado em 26/09/2026**: no ar nos dois repositórios. Hub `7980902` (rota, tabela, mapa) e Sirius
`3897bdbd` (coletor no layout `(marketing)`). `hub_vitais` está com 0 linhas: as de teste foram
apagadas, e o mapa do Sirius só troca de fonte na primeira visita real (research D8).

## O que foi feito

- `POST /api/vitais`, aberta: projeto pelo `Origin` e pela curadoria, recusa de laboratório, robô,
  valor implausível e rajada, sempre 204 vazio. Não grava IP nem parâmetro de URL.
- `lib/rum.mjs`: p75 por posto e veredito de Wilson (033) da fração de visitas acima do limite
  contra 25%. Sem piso fixo de visitas.
- Mapa: o vital lê o RUM só quando nenhuma origem tem amostra na CrUX **e** o projeto já mandou
  beacon. Nas URLs boas, o RUM julga só as URLs `sem-amostra` da CrUX.
- Sirius: `components/marketing/vitais-de-campo.tsx`, com `useReportWebVitals` do Next e um
  `sendBeacon` por métrica, usando o caminho do documento carregado e pulando as páginas de conta.

## Próximos passos

1. **27/09**: conferir `SELECT metrica, count(*) FROM hub_vitais GROUP BY 1`. Zero linha depois de
   24 h com visitas no GA4 é defeito do coletor, não falta de tráfego (SC-001).
2. **03/10 (D+7)**: SC-002 em `/gsc/mapa/sirius`. As cinco folhas do degrau 2 devem mostrar RUM com
   veredito, "◐ não decide" com n, ou "nenhuma visita". Com ~2 cliques de busca por dia, "não decide"
   é o resultado esperado.
3. **Decisão do dono**: SC-007 estourou em ~0,3 KB (3.298 B gz contra 3 KB). Duas saídas: aceitar e
   subir a meta, ou trocar `next/web-vitals` pelo pacote `web-vitals` direto, para tirar FCP e FID.

## Gotchas

- O clone `C:\dev\sirius` estava **68 commits atrás**, com um commit local nunca empurrado:
  `9a0b5e81 feat(leads)` (01/09). Ele já estava no remoto como `bcb2c86f` ("Cherry-picked from
  9a0b5e81"), e a rota da calculadora tinha sido removida como código morto em `cbc3f32`. O `main`
  local foi alinhado a `origin/main` com `reset --keep`, e o `9a0b5e81` fica só no reflog. Não
  empurrar.
- O `main` do Sirius exige o status check "All Checks Passed ✓". O push de admin passa com aviso.
- Playwright headless não esconde a aba: CLS e INP só saem simulando `visibilitychange`. O agente
  `HeadlessChrome` é recusado de propósito, então o teste real precisa de outro agente.
- `playwright-core` 1.62 do roihub pede um Chromium que não está baixado: usar `executablePath` do
  `chromium-1243` em `%LOCALAPPDATA%\ms-playwright`.
