# Contrato: `lib/telemetria.mjs` + `lib/telemetria-db.mjs`

Dois módulos, no molde de `corpus.mjs`/`corpus-db.mjs`: o primeiro é puro (testável por `node --test`,
zero I/O), o segundo é o dono único das tabelas `ia_*`. Ambos `.mjs` porque os scripts de medição em
node puro e a aba do Next precisam importar o mesmo código.

---

## `lib/telemetria.mjs` (puro)

### `hashConta(token) → string`

`sha256(token)` truncado em 8 caracteres. `hashConta("")` e `hashConta(null)` devolvem
`"cli-ambiente"` — chamada sem pool não tem conta da qual derivar identidade, e atribuí-la a uma conta
arbitrária seria pior que não atribuir.

### `codigo(empregado, erro) → string`

`ok` quando não há erro. Com erro, troca o prefixo da mensagem pelo prefixo do empregado, preservando
o sufixo de classe: `codigo("juiz", new Error("rerank-conta")) === "juiz-conta"`. Mensagem sem sufixo
conhecido vira `<prefixo>-output` — o mesmo default que os consumidores já usam.

Classes válidas: `auth`, `rate`, `cli`, `output`, `parse`, `timeout`, `conta`, `corrida-incompleta`.
Classe fora do conjunto é erro de programação e o teste reprova (o mesmo papel do regex de status em
`run-autopublish.mjs`).

### `montarRegistro({ empregado, modelo, effort, token, tentativa, pedido, corrida, inicio, fim, payload, erro, prompt, cache }) → Registro`

Devolve o objeto pronto para gravar, com o formato exato da tabela `ia_chamadas`. Garantias:

- **`prompt` nunca sai daqui**: só `prompt_hash` (sha1, a mesma chave de `chave()` do `reranker.mjs`) e
  `prompt_chars`.
- **Nada do payload além de `usage`, `num_turns` e `api_error_status` é lido**; `result` é ignorado por
  construção.
- `cache: true` → `conta = "cache"`, `duracao_ms = 0`, tokens zerados.
- `ambiente` sai de `HUB_AMBIENTE ?? (NODE_ENV === "production" ? "prod" : "dev")`.

### `ambiente() → "prod" | "dev"`

### `resumirDia(linhas) → Resumo[]`

Agrupa por `(ambiente, empregado)` e devolve o formato de `ia_resumo`. Função pura sobre um array de
linhas — é ela que o teste usa para conferir que o resumo consolidado bate com o detalhe (FR-023), sem
precisar de banco.

### `estadoDoEmpregado(linhas, ultimaSonda, agora) → "nao-acionado" | "sem-falhas" | "com-falhas" | "sem-telemetria"`

Os três estados que a FR-016 exige, mais o quarto óbvio. **Lacuna vence tudo**: janela sem telemetria
é lacuna, nunca "zero chamadas" e nunca "zero falhas".

**Lacuna = `ultimaSonda` ausente ou mais velha que 36 h.** Não "sem linha de sonda na janela de 24 h":
o cron do Actions atrasa o agendamento em ~97 min (medido — `37 2 * * *` disparou 04:15 e
`13 3 * * *` disparou 04:49), então uma janela rígida de 24 h põe a sonda para fora sozinha e o
sistema saudável passa a se declarar cego. 36 h = 24 h + duas vezes o atraso observado. É a única
constante numérica desta feature, e ela existe porque o atraso foi medido, não estimado.

### `transicaoPool(anterior, leitura, agora) → { inserir?: Linha, tocar?: Linha }`

Compara o estado lido com o gravado. Estado igual → `tocar` (atualiza `visto`). Estado diferente ou
conta nova → `inserir`. Nunca as duas.

### `celulasIA(linhas, contas, ultimaSonda, agora) → Record<string,string>`

O mapa chave→rótulo do coletor do estado noturno. **Só transição categórica** — ver
`estado-noturno-ia.md`.

---

## `lib/telemetria-db.mjs` (`pg`)

`ensure()` idempotente com os três `CREATE TABLE IF NOT EXISTS`, no molde de `corpus-db.mjs`.

### `registrar(registro) → Promise<void>`

**Nunca lança.** Todo o corpo dentro de `try/catch` que descarta — nem a busca nem a publicação pode
falhar porque o registro falhou (FR-007). Sem `DATABASE_URL`, é no-op silencioso.

O chamador **não faz `await`** no caminho de trabalho: a promessa é disparada e o `catch` já está
dentro. A visibilidade da falha não vem de log — vem da ausência das linhas da sonda naquela janela
(D7 do `research.md`).

### `consolidar(dia) → Promise<number>`

Upsert em `ia_resumo` para o **dia anterior** ao corrente. Idempotente (PK `(dia, ambiente, empregado)`).
Devolve quantas linhas de resumo escreveu.

### `expirar(dias = 90) → Promise<number>`

`DELETE FROM ia_chamadas WHERE inicio < now() - interval`. Devolve quantas apagou. Roda **depois** de
`consolidar`, sempre — a ordem inversa perderia o último dia.

### `atualizarPool(contas, agora) → Promise<void>`

Aplica `transicaoPool` conta a conta. Lista vazia **estoura** (`pool vazio: CLAUDE_CODE_OAUTH_TOKENS
ausente`), no molde exato de `coletarPool`.

### Leituras da aba

| Função | Devolve |
|---|---|
| `janela({ desde, ate, ambiente = "prod" })` | linhas cruas do período |
| `porEmpregado({ desde, ate })` | chamadas, pedidos, falhas por código, p50/p95 — do detalhe quando existe, do `ia_resumo` quando o dia já expirou |
| `ultimaSonda()` | `SELECT max(inicio) FROM ia_chamadas WHERE empregado = 'sonda'` — o relógio do batimento de coração, nunca uma contagem dentro da janela |
| `poolDatado()` | por conta: estado, `desde`, `visto` |
| `orcamento({ chamadasPrevistas })` | contas vivas, consumo já feito na janela, e as duas grandezas comparadas com `chamadasPrevistas` |

`orcamento` devolve **números, não adjetivo**. "Arriscada" sem regra declarada é veredito que ninguém
consegue conferir depois, e o que decide uma corrida de 85 chamadas é contas vivas × consumo já feito
× previsto — três números que cabem numa linha de saída.

`porEmpregado` **exclui `ambiente = 'dev'` por default** (FR-009). O consumo do pool é a única leitura
que aceita incluir `dev`, porque o pool é o mesmo — é a latência e a taxa de erro que não se misturam.

---

## Delta nos caminhos instrumentados

### `lib/reranker.mjs`

```
spawnClaude(...)      resolve o PAYLOAD inteiro (hoje resolve payload.result e joga fora
                      total_cost_usd, duration_ms, num_turns, usage e session_id)
rodarClaude(prompt, { ..., empregado = "nao-declarado" })
                      gera `pedido`, e a cada volta do laço do pool chama registrar()
                      com a tentativa — sucesso OU falha. Continua devolvendo string:
                      NENHUM dos 4 consumidores muda de contrato.
rodarCacheado(...)    acerto de cache chama registrar() com cache: true e NÃO chama rodarClaude
```

### `lib/autopublish-clients.ts`

`claudeRun` ganha `empregado` nas opções (`autopublish-draft` quando `webSearch`, `autopublish-ymyl`
caso contrário) e registra por tentativa dentro do laço `for (const token of tokens)` — o `usage` que
ele já lê para `seo_publications` passa a ir também para a série.

**`seo_publications` não é substituída**: ela continua sendo o registro de *publicação* (uma linha por
projeto por dia, com commit e resultado editorial). A série nova é de *chamada*, um nível abaixo. As
duas coexistem e devem bater — a soma de `tokens_entrada` das chamadas de um projeto num dia é
conferível contra `input_tokens` da publicação daquele dia.

### Declaração de empregado nos chamadores

Uma linha em cada: `resposta.mjs`, `juiz.mjs`, `rerank()`, `sondar()`, `corpus-defasado.mjs`. Quem não
declarar aparece como `nao-declarado` — visível na aba, que é o comportamento certo: empregado novo
sem instrumentação tem que **aparecer**, não sumir.
