# Quickstart — validar a 056

## Local (hub)

1. `npm test`: a suíte inteira fica verde, com `test/rum.test.mjs` registrado no `package.json`.

## Produção, depois dos dois deploys (hub ~15 min, Sirius ~3 min)

1. **Recusa (SC-004)**: três `curl` na rota, todos 204:
   - `-H "Origin: https://exemplo.com"` com corpo válido;
   - `Origin` do Sirius e `"v": -5`;
   - `Origin` do Sirius e `-A "Chrome-Lighthouse"`.
   Conferir no banco que `hub_vitais` não ganhou linha nenhuma.
2. **Ponta a ponta (SC-001, US1)**: abrir `https://siriuscrm.com.br/pricing` num navegador real,
   clicar num botão e trocar de aba. No banco, aparecem linhas `sirius` / `siriuscrm.com.br` /
   `/pricing` com `lcp`, `cls`, `ttfb` e `inp`. Nenhuma coluna tem IP ou parâmetro de URL (SC-006).
3. **Área logada (FR-002)**: abrir `/login`. Nenhuma linha nova com esse caminho.
4. **Laboratório (SC-003)**: rodar o PageSpeed Insights em `/pricing`. O n de `/pricing` não muda.
5. **Mapa (US2)**: abrir `/gsc/mapa/sirius`. As quatro folhas de vital dizem "RUM próprio" com n e
   janela, ou "não decide", ou "nenhuma visita". A linha do degrau 2 não diz mais "a origem não tem
   visita suficiente na CrUX".
6. **Atma inalterada (SC-005)**: `/gsc/mapa/atma`. As quatro folhas de vital têm o mesmo texto de
   antes (LCP/CLS/TTFB da origem anterior, INP "parcial").
7. **Peso (SC-007)**: no Sirius, o chunk novo do coletor tem até 3 KB comprimido e nenhum
   `<script>` bloqueante novo no `<head>`.

## D+7 (03/10/2026)

SC-002: nenhuma das cinco folhas do degrau 2 do Sirius está em "sem leitura" pelo motivo da CrUX.
