# Contrato: `lib/crux.ts` — a borda com a CrUX API

**Feature**: 023 | **Princípio III**: `.ts` só na borda. **Princípio V**: segredo nunca em log.

Única responsabilidade: falar com a rede e traduzir o resultado nos **três estados** que o módulo
puro consome. Nenhuma regra de negócio mora aqui — nem formatação, nem veredito, nem Pass Rate.

---

## A chamada

```
POST https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=<CRUX_API_KEY>
Content-Type: application/json

{ "origin": "https://atma.roilabs.com.br" }     // ou { "url": "https://…/pagina" }
```

`formFactor` **omitido** de propósito = agregado de todos os dispositivos (FR-010, D2). Um POST
devolve os quatro vitais no mesmo `record` — não quatro chamadas.

---

## Assinatura

```ts
export type LeituraDaFonte =
  | { estado: "record"; record: RecordCrux }
  | { estado: "sem-amostra" }
  | { estado: "falhou"; erro: string }
  | { estado: "sem-chave" };

export function cruxOn(): boolean;
export async function lerCampo(alvo: Alvo): Promise<LeituraDaFonte>;
```

`cruxOn()` é o gêmeo de `dbOn()` (`lib/db.ts`): responde se `CRUX_API_KEY` existe e não é só
espaço em branco. Permite decidir sem chamar.

---

## A tradução de status — o coração da FR-003

| resposta | `estado` | por quê |
|---|---|---|
| `200` com `record` | `"record"` | há dado |
| **`404`** | `"sem-amostra"` | protocolo da fonte: o alvo não tem visitas suficientes. **Não é erro** |
| `403`, `401` | `"falhou"` | chave inválida ou sem a API habilitada — conserta-se, e até lá é falha |
| `429` | `"falhou"` | quota estourada é transitória por definição |
| `5xx`, timeout, rede | `"falhou"` | a fonte caiu agora |
| `200` com JSON inválido ou sem `record` | `"falhou"` | resposta que não dá para ler é falha, não ausência |
| `CRUX_API_KEY` ausente | `"sem-chave"` | **sem `fetch` nenhum** — não se gasta rede para descobrir que não há chave |

Este é o mesmo idioma que `lib/gsc.ts` já usa ao separar `null` (ausência estrutural) de `{erro}`
(falha transitória) — ver `app/api/gsc-serie/route.ts:44-51`. Colapsar `404` com `5xx` é o defeito
que a spec proíbe nominalmente.

---

## Princípio V — o que a mensagem de erro pode conter

- `erro` **truncado em 60 caracteres**, como em `app/api/gsc-serie/route.ts:60`.
- **A chave nunca aparece** — nem valor, nem prefixo, nem comprimento, nem em log, nem na
  mensagem, nem na URL registrada. O `key=` vai na query string da chamada e em lugar nenhum mais.
- Nenhum `console.log` do corpo da resposta.

---

## Princípio V — a validação de ambiente, sem rota

O Princípio V manda **rota** validar ambiente na entrada e responder `503` com só os nomes. Aqui
não há rota (D1: a leitura é no render). O equivalente é o estado `"sem-chave"`, que o módulo puro
converte em quatro células dizendo `CRUX_API_KEY ausente` — **apenas o nome da variável** (FR-011).

E a FR-012 proíbe o contrário: **a ficha não pode virar erro por causa de um medidor**. Portanto
`lerCampo()` **nunca lança**. Todo caminho — inclusive `JSON.parse` e `AbortError` de timeout —
sai como `"falhou"`, no mesmo idioma de `lerApuracao()` (`app/okr/[slug]/aquisicao/page.tsx:47-54`).

---

## Timeout

`AbortSignal.timeout(...)` explícito. A ficha é `force-dynamic`: sem teto, uma CrUX lenta segura a
página inteira, que é a FR-012 violada por lentidão em vez de por exceção.

---

## O consumo

| chamador | alvo | quantas | cache |
|---|---|---|---|
| `lib/ficha-dados.ts` → `disponiveisN5` | `{tipo:"origem"}` | **1** por render | nenhum (`force-dynamic`) |
| `app/okr/[slug]/aquisicao/page.tsx` → Pass Rate | `{tipo:"url"}` | até `CAP_URLS_PASS_RATE` | `revalidate = 3600` |

Só quando `SLUGS_DE_CAMPO.includes(slug)` (FR-014). Projeto fora da lista **não gasta chamada** e
mantém o `"sem coletor nesta requisição"` que a ficha já exibe hoje.

As chamadas de URL vão **em série**, pelo mesmo motivo de `app/api/gsc-serie/route.ts:36-38`:
disparar um punhado de POSTs simultâneos ao mesmo endpoint do Google com a mesma chave é o caminho
mais curto para um `429` que transformaria a leitura inteira em falha por pressa.

---

## `.env.example`

```
# Core Web Vitals de CAMPO (spec 023). Chave de API simples do Google Cloud com a
# Chrome UX Report API habilitada — NAO e service account, nao reusa a do Search Console.
# Sem ela os medidores de Entrega dizem "CRUX_API_KEY ausente"; a ficha nao quebra.
CRUX_API_KEY=
```

Valor real nunca entra neste arquivo (Princípio V).

---

## A confirmar na primeira corrida

Como a 022 fez com a quota da URL Inspection — **número de documentação não é número medido**:

1. O corpo real do `404` (para confirmar que ele é mesmo "sem amostra", e não outra condição).
2. A quota real da chave, e se ela é por minuto, por dia, ou as duas.
3. Se a CrUX normaliza a URL da Atma (`urlNormalizationDetails` na resposta) — normalização
   silenciosa mediria uma página diferente da pedida.
