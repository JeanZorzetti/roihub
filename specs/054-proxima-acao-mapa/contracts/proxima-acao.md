# Contrato — `lib/proxima-acao.mjs`

Módulo puro (Princípio III): nenhuma leitura de disco, rede ou `process.env`.

| Export | Assinatura | Garante |
|---|---|---|
| `DEGRAUS` | `{id, nome, porque}[]` | ordem de ataque fixa (data-model §1) |
| `ALAVANCAS` | `Record<id, {degrau, curta, acao}>` | ordem de declaração = desempate (D7) |
| `REGRAS` | `Record<chaveDoCatalogo, Regra \| null>` | exatamente as chaves de `CATALOGO`; `null` só em procedimento |
| `LINKS_DO_BOARD`, `PROFUNDIDADE_DO_BOARD` | `[5, 10]`, `3` | casa única das duas metas que a página escrevia |
| `regraEmTexto(chave)` | `→ string` | "Se <condição>, <ação>. Origem: <selo>." — para a `note` da folha e a lista |
| `avaliar(leituras)` | `Record<chave, Leitura> → Record<chave, Disparo>` | 32 disparos, um por chave de `REGRAS`, mesmo sem leitura |
| `etiqueta(disparo)` | `→ string` | o texto da tag do nó (research D10) |
| `plano(disparos)` | `→ Plano` | data-model §6; nenhuma alavanca repetida; degraus na ordem de `DEGRAUS` |

Consumidor único: `app/gsc/mapa/[slug]/page.tsx`.
