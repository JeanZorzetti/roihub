# Contrato — `POST /api/vitais`

Aberta: isenta do Basic auth no `middleware.ts`, sem segredo (quem chama é o navegador do
visitante).

## Requisição

- Cabeçalhos usados: `Origin` (obrigatório), `User-Agent`, `X-Forwarded-For` (só para o limite em
  memória; nunca gravado).
- Corpo: texto (o `sendBeacon` manda `text/plain;charset=UTF-8`), até 512 bytes, com JSON
  `{"m": "LCP"|"INP"|"CLS"|"TTFB", "v": number, "p": "/caminho"}`.

## Resposta

- **204 sem corpo** em todos os casos de recusa (D6) e no sucesso. Nenhum corpo nunca (FR-006).
- **503** `{"faltando": ["DATABASE_URL"]}` sem banco (Princípio V).

## Efeito

- Sucesso: uma linha em `hub_vitais`.
- Recusa: nenhuma escrita.

## Envio do lado do site (Sirius)

`components/marketing/vitais-de-campo.tsx`, montado no fim de `app/[locale]/(marketing)/layout.tsx`:
um `sendBeacon` por métrica, com o caminho do documento carregado (research D2) e sem os caminhos de
conta (D3).
