# Handoff — 041 · Alinhamento de Intenção medido no board

**Data:** 21/09/2026 · **Commit:** `1d5022b` · **Estado:** no ar e **conferido em produção duas
vezes** (curl às 08:39 BRT e render no Chrome headless logo depois, mesma leitura, console limpo).

## O que mudou

A folha `5. Taxa de Alinhamento de Intenção (Search Intent Match)` de `/gsc/mapa` ganhou DOIS nós
de leitura. Sétima folha `-medido` do mapa.

| Onde | Mudança |
|---|---|
| `lib/grafo.mjs` | `taxaAlinhamento()` ganhou `compartilhado` (URLs que servem o mesmo `<title>`, quantas delas passam, a fração entre títulos próprios). **`fracao` intacta.** `correspondenciaDeIntencao()` nova: intenção da busca × do título. |
| `app/gsc/mapa/page.tsx` | Nós `intencao-medido` e `intencao-match`, `noteDoAlinhamento()`, `noteDoMatch()`, `contrafactualDoAno()`. |
| `app/okr/[slug]/aquisicao/page.tsx` | A leitura de alinhamento carrega a mesma ressalva do título compartilhado. |
| `lib/gsc-delta.mjs` | `MEDIDO_POR.intencao` credita os DOIS coletores. |
| `test/grafo.test.mjs` | +5 testes (1.193 no total, verde). |

**Zero requisição nova.** A corrida de página e a leitura consulta×página já estavam na tela.

## O número (Atma, crawl de 14/09, janela 22/08 → 18/09)

```
Medido: 54,3% · 19 de 35 títulos com modificador · mas 13 são o MESMO título de fallback
· 27,3% (6 de 22) entre títulos próprios

⚠ 1 de 10 pares com intenção declarada nos DOIS lados · em 9 a consulta principal não traz modificador
```

## Decisões (e por quê)

- **`fracao` não mudou.** Tirar as URLs de título compartilhado de dentro dela mudaria o número de
  `/okr/atma/aquisicao` sem ninguém decidir qual denominador o board quer. O campo novo sai ao
  lado e as duas telas publicam a ressalva.
- **O match publica contagem, não percentual.** 1 caso decidível contra `LIMIAR_PAGINAS_DECIDIDAS`
  de 20 (a regra da 038).
- **Nenhuma cifra da nota está escrita no código**, inclusive o contrafactual do ano, porque a régua
  inclui o ano vigente e muda de valor sozinha em 01/01.

## Próximos passos, em ordem

1. **No site, não no hub (humano):** dar `<title>` próprio às 13 URLs que servem «Alinhadores
   Invisíveis | Preço 50% Menor | Use Aligner Brasil» (entre elas `/sobre`, `/contato`, `/blog`,
   `/ortodontistas/*`, a paginação do blog). É o layout raiz do Next servindo o default.
2. **No site:** os 13 títulos carimbados com 2025. Em 2025 a folha daria 80%.
3. Depois da próxima corrida de página, conferir se a folha subiu sozinha. Nada no hub precisa
   mudar para isso.
4. Decisão em aberto para o dono: qual denominador a meta "100% das páginas-chave" quer — as 35 do
   crawl ou só as de título próprio? Hoje as duas leituras aparecem, nenhuma é escolhida.

## Gotchas do ambiente

- `next dev` com `node --env-file` falha: o Next repassa por `NODE_OPTIONS`, que não aceita a flag.
  O Next carrega `.env` sozinho.
- Já havia um `next dev` do dono na :3000 (PID 15828) — um segundo na mesma pasta recusa subir.
  A leitura foi feita nele, com Basic auth, sem derrubar.
- O mapa abre com a folha RECOLHIDA: para fotografar, clicar no `me-epd` irmão do tópico.
