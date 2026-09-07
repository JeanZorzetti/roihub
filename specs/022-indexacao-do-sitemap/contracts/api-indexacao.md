# Contrato: `POST /api/indexacao`

**Feature**: `022-indexacao-do-sitemap`

A corrida diária que lê o sitemap de cada projeto, inspeciona o que couber no orçamento e grava
uma linha por projeto em `hub_indexacao`. Único consumidor:
`.github/workflows/indexacao.yml`.

---

## Autenticação

`Authorization: Bearer <CRON_SECRET>`, validado no `middleware.ts` — mesma isenção que
`/api/estado`, `/api/seo/autopublish` e `/api/gsc-serie` já têm. Sem cabeçalho ⇒ `401`
`{"error":"unauthorized"}`.

Segredo próprio seria capacidade a mais sem ganho: quem já pode publicar artigo em 10 repos não
ganha nada podendo ler o índice do Google.

---

## Ambiente (Princípio V)

Validado **na entrada**, antes de qualquer trabalho. Faltando qualquer um:

```http
503 Service Unavailable
{"error":"ambiente incompleto","faltando":["DATABASE_URL","GOOGLE_SERVICE_ACCOUNT_JSON"]}
```

Apenas os **nomes**. Nunca valor, nunca prefixo, nunca comprimento.

| Variável | Obrigatória | Padrão |
|---|---|---|
| `DATABASE_URL` | sim | — |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | sim | — |
| `INSPECOES_POR_PROPRIEDADE` | não | `2000` |
| `INSPECOES_POR_CORRIDA` | não | `400` |

As duas últimas são tetos **configuráveis de propósito** (D10): o `~2000/dia` é a cota
documentada pelo Google e precisa ser confirmada contra o comportamento real, não tratada como
constante de fé.

---

## Resposta `200`

Falha parcial responde `200` — um projeto fora não é a corrida fora (FR-013). O corpo lista
nominalmente quem caiu, para o Actions não ter que adivinhar pelo status.

```jsonc
{
  "dia": "2026-09-07",
  "projetos": 35,
  "propriedades": {
    "sc-domain:roilabs.com.br": { "orcamento": 2000, "gastas": 380, "falhasDeQuota": 0 },
    "sc-domain:atmaaligner.com.br": { "orcamento": 2000, "gastas": 20, "falhasDeQuota": 0 }
  },
  "apurados": [
    { "projeto": "goiania", "declaradas": 1200, "inspecionadas": 200, "indexadas": 168,
      "rastreadasNaoIndexadas": 21, "descobertasNaoIndexadas": 9, "outras": 2, "falhas": 0 }
  ],
  "pulados":  [ { "projeto": "tapepro", "motivo": "sem_orcamento", "declaradas": 340 } ],
  "semSitemap": ["mana"],
  "sitemapVazio": [],
  "semPropriedade": ["aprovai"],
  "falhas": [ { "projeto": "seven", "erro": "ETIMEDOUT" } ]
}
```

### Garantias verificáveis na resposta

- **SC-003**: para toda propriedade, `gastas ≤ orcamento`. A resposta é a prova, não uma promessa
  no plano.
- **SC-005**: `falhas` de inspeção aparecem no campo `falhas` de cada apurado e **não** entram em
  `indexadas` nem no denominador da taxa.
- **FR-015**: `pulados` é uma lista separada de `apurados`. Um projeto sem orçamento nunca
  aparece com `indexadas: 0`.
- **D5**: `semSitemap` e `sitemapVazio` são listas SEPARADAS. Colapsá-las numa só desfaria, já na
  resposta da corrida, a distinção que a tela precisa fazer: "o site não publica sitemap" pede o
  build, "o sitemap declara zero URLs" pede a geração. São passos diferentes.
- **D10**: `falhasDeQuota` por propriedade é o instrumento que mede o teto real. `> 0` com
  `gastas < orcamento` ⇒ o teto configurado está alto demais e `INSPECOES_POR_PROPRIEDADE` desce
  — por env, sem deploy.

---

## Efeitos

- Escreve `hub_indexacao`, `ON CONFLICT (projeto, dia) DO UPDATE`. **Idempotente**: rodar duas
  vezes no mesmo dia regrava as mesmas linhas e gasta quota de novo, mas não duplica dado.
- Lê o sitemap de cada projeto por HTTP (não custa quota do GSC).
- Consome quota da URL Inspection API, no teto declarado acima.
- Não escreve em `hub_tasks`, `seo_*`, `crm_*` nem `hub_gsc_dia`.

---

## `maxDuration`

`800` s. É rota nova, então **não** altera a `maxDuration` de `/api/estado` e o proxy do
EasyPanel não muda (Princípio IV). `INSPECOES_POR_CORRIDA = 400` a ~300 ms cada dá ~2 min — a
folga até 800 é para sitemap grande e rede lenta, não para gastar.

---

## Contrato de leitura — `lerIndexacao(projeto)`

`lib/db.ts`. A **última** apuração de um projeto, ou `null` se nunca houve.

```ts
type Apuracao = {
  dia: string;                        // "YYYY-MM-DD"
  propriedade: string | null;
  declaradas: number;
  inspecionadas: number;
  indexadas: number;
  rastreadasNaoIndexadas: number;
  descobertasNaoIndexadas: number;
  outras: number;
  falhas: number;
  motivo: string | null;              // sem_sitemap | sitemap_vazio | sem_propriedade | sem_orcamento
};
```

`dia` é obrigatório na saída porque a FR-014 obriga a tela a datar o número: um inventário de
semanas atrás não pode se apresentar como o estado de hoje.
