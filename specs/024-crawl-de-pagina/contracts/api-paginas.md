# Contrato: `POST /api/paginas`

**Feature**: `024-crawl-de-pagina`

A corrida semanal que lê o sitemap do projeto, percorre o site a partir da home, busca o HTML de
cada URL declarada e grava uma linha em `hub_pagina_corrida` mais uma linha por URL em
`hub_pagina`. Único consumidor: `.github/workflows/paginas.yml`.

---

## Autenticação

`Authorization: Bearer <CRON_SECRET>`, validado no `middleware.ts` — a mesma isenção que
`/api/estado`, `/api/seo/autopublish`, `/api/gsc-serie` e `/api/indexacao` já têm. Sem cabeçalho
⇒ `401` `{"error":"unauthorized"}`.

Segredo próprio seria capacidade a mais sem ganho: **ler HTML público de um site da casa é a menor
capacidade do conjunto** — quem já pode publicar artigo em 10 repos não ganha nada podendo baixar
36 páginas que qualquer navegador baixa.

---

## Ambiente (Princípio V)

Validado **na entrada**, antes de qualquer trabalho:

```http
503 Service Unavailable
{"error":"ambiente incompleto","faltando":["DATABASE_URL"]}
```

Apenas os **nomes**. Nunca valor, nunca prefixo, nunca comprimento.

| Variável | Obrigatória | Padrão |
|---|---|---|
| `DATABASE_URL` | sim | — |
| `PAGINAS_POR_CORRIDA` | não | `300` |

Nenhuma credencial de Google aqui: esta corrida **não** fala com o Search Console. É a diferença
mais barata entre esta feature e a 022 — não há quota a gastar, só HTTP contra um host da casa.

`PAGINAS_POR_CORRIDA` é teto de **tempo**, não de cota. Com 36 URLs a Atma não chega perto; ele
existe para o dia em que um site maior entrar em `SLUGS_DE_BUSCA`, e quando corta, a corrida
devolve `tetoAtingido: true` e a tela **diz** que o número está incompleto (FR-012).

---

## Execução

`runtime = "nodejs"`, `maxDuration = 800` — o **mesmo** valor de `/api/indexacao`, então o proxy do
EasyPanel não muda (Princípio IV).

Busca em **lotes de 4**, não 8. É contra **um único host** — o de um cliente da casa —, ao
contrário da 022, que abre 8 conexões contra 8 hosts diferentes. Educação com o servidor do
cliente, não performance.

Ordem de trabalho:

1. `projetosDeBusca()` (FR-014). Hoje: `atma`.
2. `buscar(base + "/robots.txt")` → `urlDoSitemap()` → `lerSitemap()` — o inventário da 022.
3. **Fase largura** a partir da home canonizada; para no teto (D7).
4. **Fase colheita**: URLs do sitemap que a fase 3 não alcançou, buscadas e marcadas **órfãs**.
5. `navegacao()` → `densidades()` → `agregar()`.
6. `DELETE` + `INSERT` multi-linha em `hub_pagina`; upsert em `hub_pagina_corrida`.

---

## Resposta `200`

Falha parcial responde `200` — uma página fora não é a corrida fora (FR-016). O corpo lista
nominalmente o que caiu, para o Actions não ter que adivinhar pelo status.

```jsonc
{
  "dia": "2026-09-14",
  "projetos": 1,
  "apurados": [
    {
      "projeto": "atma",
      "declaradas": 36,
      "visitadas": 36,
      "falhas": 0,
      "orfas": 4,
      "linkadasNaoDeclaradas": 2,
      "linksNavegacao": 14,
      "tetoAtingido": false,
      "profundidadeMaxima": 4,
      "semTitulo": 0,
      "schemaAusente": 21,
      "schemaInvalido": 1,
      "semDataDeclarada": 12,
      "jsDependente": 0
    }
  ],
  "pulados": [],
  "falhas": [
    { "projeto": "atma", "url": "https://atmaaligner.com.br/blog/antigo", "erro": "HTTP 404" }
  ]
}
```

`falhas` é lista de **URL**, não de projeto: com um projeto só no escopo, "a corrida falhou" seria
inútil e "esta URL do sitemap devolve 404" é exatamente o achado da FR-013.

`pulados` recebe o projeto quando `motivo` está preenchido — `sem_sitemap`, `sitemap_vazio` ou
`home_inacessivel`. Os três são estados **diferentes** e nunca somam num "0 páginas": sem sitemap
aponta o build do site, sitemap vazio é declaração do próprio site, e home inacessível significa
que **não há origem para a travessia** — nesse caso nenhuma linha de `hub_pagina` é gravada,
porque toda página do sitemap sairia órfã por culpa de um `ETIMEDOUT`.

---

## Erros

| Status | Quando | Corpo |
|---|---|---|
| `401` | sem `Authorization` válido (middleware) | `{"error":"unauthorized"}` |
| `503` | falta variável de ambiente | `{"error":"ambiente incompleto","faltando":[...]}` |
| `200` | sempre que a corrida rodou, mesmo com falha parcial | o objeto acima |

Não existe `500` planejado. Exceção por projeto é capturada, truncada em 60 caracteres e entra em
`falhas` — nenhuma mensagem carrega valor de ambiente.

---

## Leitura — `lerCrawlDePagina(projeto)`

`lib/db.ts`. Devolve a **última** corrida do projeto: o agregado mais a lista de páginas.

```ts
type CrawlDePagina = {
  dia: string;                 // "YYYY-MM-DD" — a tela é obrigada a datar (FR-015)
  declaradas: number;
  visitadas: number;
  falhas: number;
  orfas: number;
  linkadasNaoDeclaradas: number;
  linksNavegacao: number;
  tetoAtingido: boolean;
  motivo: string | null;
  paginas: Pagina[];           // ordenadas: órfã, depois profundidade desc, depois url
};
```

`dia` sai junto porque **um crawl de semanas atrás não pode se apresentar como o estado de hoje**
(FR-015). Número sem data sempre parece de hoje.

A tela **lê o gravado e nunca busca**. Uma página com `revalidate` que crawleasse ao carregar
transformaria cada visita numa varredura do site do cliente — e a corrida semanal existe
exatamente para isso não acontecer.

---

## O que a rota NÃO faz

- **Não executa JavaScript.** Lê o HTML servido; quando o conteúdo depende de JS, grava
  `conteudo_estado = 'js-dependente'` (D12).
- **Não fala com o Search Console.** O termo principal do título entra na **leitura**, na tela que
  já carrega as consultas (D10).
- **Não conserta nada.** Mede.
- **Não sugere onde adicionar links.** Entrega a lista ordenada por periferia; a decisão editorial
  é humana.
