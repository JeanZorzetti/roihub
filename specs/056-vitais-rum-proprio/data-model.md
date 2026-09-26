# Data Model — 056

## 1. `hub_vitais` (Postgres do hub, criada em `ensure()` de `lib/db.ts`)

| coluna    | tipo               | regra                                              |
|-----------|--------------------|----------------------------------------------------|
| projeto   | TEXT NOT NULL      | slug de `SLUGS_DE_CAMPO`, resolvido do `Origin`    |
| host      | TEXT NOT NULL      | host do `Origin`, sem `www.`                       |
| caminho   | TEXT NOT NULL      | começa com `/`, sem `?` nem `#`, até 300 caracteres |
| metrica   | TEXT NOT NULL      | `lcp` \| `inp` \| `cls` \| `ttfb` (os ids de `VITAIS`) |
| valor     | DOUBLE PRECISION NOT NULL | unidade crua da fonte: ms, ou fração no CLS |
| em        | TIMESTAMPTZ NOT NULL DEFAULT now() | hora do recebimento              |

Índice `(projeto, em)`. Sem chave primária: nenhuma linha é lida ou apagada sozinha. Nenhuma
coluna identifica o visitante (FR-004).

## 2. Medida recebida (`lib/rum.mjs#lerMedida`)

Entrada: corpo `{m, v, p}` e os cabeçalhos `Origin` e `User-Agent`. Saída:
`{projeto, host, caminho, metrica, valor}` ou `null` (recusa, D6).

## 3. Leitura do RUM (`lib/rum.mjs#leituraRum`)

Por vital, sobre os valores da janela:

```
{ n, p75: number|null, acima, fracaoAcima: number|null,
  veredito: "fora"|"dentro"|"nao-decide"|null }   // null ⇔ n = 0
```

## 4. O que o mapa recebe (`lib/db.ts#lerRum`)

```
{ instalado: boolean,                 // alguma medida em 90 dias
  janela: {inicio, fim},              // YYYY-MM-DD, fim = ontem
  medidas: {host, caminho, metrica, valor}[] }   // só a janela
```

## 5. Leitura entregue a `proxima-acao.mjs#avaliar` (contrato da 054)

- fora ou dentro: `{valor: p75, texto: "p75 …", fonte: "RUM próprio, p75 de 28 dias",
  ressalva: "RUM próprio · n visitas"}`. O `op`/`limiar` da regra decide o disparo, e D7 garante
  que ele concorda com o veredito.
- não decide: `{indecisa: "RUM próprio: a amostra não decide · n visitas, x% acima do limite"}`.
- zero na janela: `{ausente: "nenhuma visita no RUM em 28 dias"}`.

## 6. URLs boas, misto (`lib/rum.mjs#passRateMisto`)

Entrada: `porUrl` da CrUX (`passRate()` de `lib/crux.mjs`) e as medidas da janela. Cada URL em
`sem-amostra` troca de estado para o do RUM: `passa` | `reprova` | `indecisa` | `sem-amostra`.
Saída com a forma de `passRate()`, mais `rum`, a contagem de URLs decididas pelo RUM:
`{consultadas, comDado, passam, porUrl, fracao, motivo, rum}`.
