# Contrato — leitura do GA4 (borda, `lib/ga4.ts`)

**Feature**: `013-n4-canais-ga4-somado`

`.ts` porque toca rede e `google-auth-library` (Princípio III). **Não contém regra nenhuma**: o
mapa de canais, os estados e a soma moram em `lib/ficha.mjs`. Este módulo devolve linhas cruas ou
um motivo de falha — o mesmo desenho de `lib/okr-coleta.ts` em relação a `lib/okr.mjs`.

---

## `ga4Canais(propertyId, { inicio, fim })`

```ts
export async function ga4Canais(
  propertyId: string | undefined,
  janela: { inicio: string; fim: string },
): Promise<
  | null                                    // não configurado — SEM tocar a rede
  | { erro: string }                        // configurado e falhou
  | { linhas: { grupo: string; sessoes: number }[]; janela: { inicio: string; fim: string }; propriedade: string }
>;
```

**Ordem das guardas** (a primeira que bater devolve, e nenhuma delas faz I/O desnecessário):

1. `!propertyId` → `null`. Projeto sem GA4 configurado não abre conexão nem consome cota.
2. `!process.env.GOOGLE_SERVICE_ACCOUNT_JSON` → `{ erro: "GOOGLE_SERVICE_ACCOUNT_JSON ausente" }`.
   **O nome da variável, nunca o valor** (FR-013, Princípio V).
3. Chamada: `POST https://analyticsdata.googleapis.com/v1beta/{property}:runReport`

   ```json
   {
     "dateRanges": [{ "startDate": "<inicio>", "endDate": "<fim>" }],
     "dimensions": [{ "name": "sessionDefaultChannelGroup" }],
     "metrics":    [{ "name": "sessions" }]
   }
   ```

4. Qualquer exceção → `{ erro: <code ou 60 primeiros caracteres da mensagem> }`. **Falha FECHADA**
   (FR-008): o erro é devolvido como dado, nunca propagado — a ficha inteira não pode deixar de
   abrir porque o GA4 caiu (SC-006).

**Garantias**:

- `propertyId` é normalizado: `"123456"` e `"properties/123456"` produzem a mesma URL.
- `janela` devolvida é **a que foi pedida**, para a guarda da FR-006 em `montarN4()` (D8).
- `linhas` vem sem mapa, sem filtro e sem ordenação — nenhuma decisão de canal acontece aqui.
- Resposta bem-sucedida sem `rows` devolve `linhas: []`, que a camada pura lê como **zero apurado**
  (FR-004) e não como falha. É a distinção central da casa, e ela mora nesta linha.
- Nenhum log. Nem sucesso, nem erro, nem `propertyId` (Princípio V).
- Cliente `GoogleAuth` **próprio**, escopo `analytics.readonly`, memoizado em módulo. Não importa,
  não toca e não compartilha estado com `lib/gsc.ts` (D1).

---

## Integração em `lib/okr-coleta.ts`

`coletarDoProjeto()` ganha dois campos no retorno, **sem alterar os seis atuais**:

```ts
{
  cliques, leads, vendas, impressoes, orcamentos, orcamentosAceitos,  // inalterados
  ga4,                  // LeituraGa4 — o retorno de ga4Canais()
  orcamentosSemLead,    // { valor:number } | null — a inferência da US3
}
```

- `ga4` é obtido com `p.ga4?.propertyId`, vindo do `Project` que `listProjects()` já entregou
  (Princípio I — nenhum import de `data/projects.json`, nenhum mapa paralelo).
- **A chamada ao GA4 entra em `Promise.all` com o GSC**, não em série: são duas fontes
  independentes e serializá-las somaria latência sem motivo.
- `orcamentosSemLead` conta as linhas de `orcamentos` na janela com `paciente_lead_id` nulo — a
  coluna **já vem** no `SELECT` de `FONTES_PROPRIAS.atma` e hoje é descartada (D6). `null` quando
  não há fonte de orçamento, e `null` nunca vira `0`.
- Projeto sem `ga4` no card: `ga4` sai `null` e **nenhuma chamada é feita** — é o que torna a
  SC-004 verdadeira sem esforço (os 34 projetos restantes não mudam de comportamento nem de
  latência).

---

## Pré-requisito operacional (fora do código)

A conta de serviço de `GOOGLE_SERVICE_ACCOUNT_JSON` precisa ser **Visualizador** na propriedade
GA4 de cada projeto configurado. Sem isso a API devolve 403 e os quatro canais saem `não apurado`
nomeando a falha — comportamento correto, não regressão. Passo a passo no
[quickstart.md](../quickstart.md).
