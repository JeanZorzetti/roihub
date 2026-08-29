# Contrato — `app/api/pauta/anexo/[[...id]]/route.ts`

A **única** superfície que toca bytes. Todo o resto do sistema conhece apenas a URL
`/api/pauta/anexo/<id>`. Trocar Postgres por storage externo no futuro mexe só aqui (R-001).

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Mesmo cabeçalho de `app/api/crm/leads/route.ts`.

---

## Autenticação — herdada, não escrita

O matcher do [middleware.ts](../../../middleware.ts) é `/((?!_next|favicon.ico).*)` e cobre `/api/*`.
As isenções são **nominais** (`/api/seo/autopublish`, `/api/estado`, `/api/crm/leads`), então uma rota
nova cai automaticamente no Basic auth do `HUB_PASS`.

> ⚠️ **Não acrescentar isenção para esta rota no middleware.** A regra da casa é que segredo próprio
> existe para capacidade MAIOR (foi o caso do `CRM_INGEST_SECRET`); aqui a capacidade é a mesma de
> quem já lê o hub inteiro. Isenção aqui exporia as imagens publicamente e quebraria FR-023.

---

## `POST /api/pauta/anexo` — subir imagens

**Request** — formulário HTML nativo, sem JavaScript:

```html
<form method="post" action="/api/pauta/anexo" enctype="multipart/form-data">
  <input type="hidden" name="pauta_id" value="…">
  <input type="hidden" name="voltar"   value="/marketing?vista=kanban">
  <input type="file" name="imagens" accept="image/png,image/jpeg,image/webp" multiple>
  <button>Anexar</button>
</form>
```

| Campo | Regra |
|---|---|
| `pauta_id` | inteiro; card tem que existir |
| `imagens` | um ou vários; lidos com `formData.getAll("imagens")` |
| `voltar` | **caminho relativo começando com `/`**. Absoluto ou `//` é descartado e vira o padrão do quadro — parâmetro de redirect vindo do formulário é entrada de usuário, e redirect aberto é a falha clássica dessa forma |

**Validação** — por arquivo, via `validarAnexo()` do módulo puro:

| Situação | Resposta |
|---|---|
| Tudo aceito | `303` para `voltar` |
| Algum recusado | `303` para `voltar` com `?erro=<codigo>` — os aceitos são gravados |
| `pauta_id` inexistente | `404` |
| Sem `DATABASE_URL` | `503` (mesmo formato de `crm/leads`) |

**Códigos de erro estáveis**: `mime`, `tamanho`, `quantidade`. A tela traduz; o código é o que o teste
e o log leem.

**`303` e não `302`**: força o navegador a trocar `POST` por `GET` no redirect, então recarregar a
página de destino não reenvia o upload.

**`ordem`** do anexo novo = maior `ordem` do card + 1, na ordem em que os arquivos vieram no
`getAll` — o carrossel sai na sequência em que a pessoa selecionou.

---

## `GET /api/pauta/anexo/<id>` — servir a imagem

Referenciada por `<img src="/api/pauta/anexo/42">`. O navegador reenvia a credencial Basic nas
sub-requisições de mesma origem, então carrega normalmente depois do login.

| Situação | Resposta |
|---|---|
| Anexo com bytes | `200`, `Content-Type` = `mime` gravado, `Content-Length` = `tamanho` |
| Anexo já liberado (`bytes IS NULL`) | `410 Gone` — **não 404**: a diferença entre "nunca existiu" e "expirou" é a informação que a retenção existe para preservar |
| Id inexistente | `404` |

**Cache**: `Cache-Control: private, max-age=3600`. Nunca `public` — conteúdo atrás de autenticação.
`private` permite ao navegador do usuário reusar, sem autorizar cache intermediário.

---

## `POST /api/pauta/anexo/<id>/remover` e `/mover`

Também formulários HTML nativos, mesmo padrão de `voltar` e `303`.

- **remover** — apaga a linha. Buraco na sequência de `ordem` é irrelevante: a exibição ordena por
  `ordem`, não por valor contíguo.
- **mover** — troca a `ordem` com o vizinho (`?dir=-1|1`). Duas linhas trocadas numa transação.

> Estas duas poderiam ser Server Actions, já que não carregam arquivo. Ficam aqui **para o carrossel
> inteiro ter uma superfície só** — três formas de mexer em anexo espalhadas em dois mecanismos é o
> tipo de divergência que aparece seis meses depois.

---

## O que esta rota NÃO faz

- **Não redimensiona nem recomprime.** O limite de 3 MB é recusa, não conversão silenciosa — o
  usuário precisa saber que o PNG dele é grande (é o que torna o custo visível, FR-036).
- **Não gera miniatura.** A `<img>` com `width` resolve; miniatura seria uma segunda cópia dos bytes
  no mesmo banco que a retenção existe para aliviar.
- **Não roda a varredura de liberação.** Isso mora no carregamento das páginas dos quadros (R-005).
