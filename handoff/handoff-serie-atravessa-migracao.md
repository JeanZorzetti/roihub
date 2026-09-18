# A série atravessa a migração de domínio (029) — 18/09/2026

## O que estava quebrado

A troca de domínio da Atma (`atma.roilabs.com.br` → `usealigner.com`, declarada em 11/09) fez a
corrida diária passar a ler **só a `url` do card**. Medido nas duas propriedades no mesmo ato:

| dia | domínio anterior | domínio novo | soma | o que o banco tinha |
|---|---|---|---|---|
| 2026-09-14 | 687 | 32 | 719 | 687 |
| 2026-09-15 | 1.146 | 31 | 1.177 | 1.146 |
| 2026-09-16 | 967 | 35 | 1.002 | **35** |

Quatro dias depois da troca, o domínio ANTERIOR ainda carregava **97%** das impressões: o 301 leva
semanas para transferir os sinais. A corrida das 17:15 de 18/09 gravou 35 impressões para 16/09 —
**~3% da realidade**.

A tela não mostrava o erro porque a 026 manda ler o último segmento COM forma, e o segmento novo não
tinha duas semanas fechadas. **Em duas semanas ela teria declarado uma queda de 97% que nunca
aconteceu**, sobre a mesma série que diz "estacionado em 8,8% do pico".

## O que mudou

**A régua**: a série deixou de medir um host e passou a medir o conjunto de hosts que o card declara
(`hostsDeclarados`) — a mesma definição de "o site" que o bloco de GA4 desta tela já usava.

- `lib/serie-gsc.mjs`: `somarSeriesPorHost()` (posição **ponderada por impressão**, nunca média de
  médias) e `assinaturaDeHosts()`.
- `lib/marca.mjs`: `dentroDoDeclarado()`, e `segmentosPorHost`/`semanasNaoMarca`/
  `ritmoDoSegmentoAtual` passam a aceitar os declarados. Duas assinaturas dentro do mesmo conjunto
  declarado são o MESMO site — a série volta a ser uma só.
- `lib/db.ts`: a guarda da 026 passa de "mesmo host" para "todos os hosts da assinatura estão entre
  os declarados". **A proteção que salvou 248 dias continua inteira** para troca NÃO declarada.
- `app/api/gsc-serie/route.ts`: laço por host, soma, e `desde` opcional no corpo para reabrir a
  janela do total (é assim que o histórico de uma transição se corrige — mesma corrida, outro
  início).
- `scripts/conferir-soma-hosts.mjs`: a testemunha independente. Pergunta ao Google de novo, por
  fora, e imprime host a host.

**A coluna `host` agora guarda a assinatura da soma** — hosts ordenados e unidos por `+`. Sem DDL:
uma linha antiga é uma assinatura de um elemento. A assinatura nomeia os hosts **consultados**, não
só os que tiveram impressão — senão "o domínio anterior zerou" (dado legítimo) ficaria idêntico a
"o domínio anterior saiu da conta" (mudança de régua).

## O que foi corrigido no banco

`POST /api/gsc-serie` com `{"desde":"2026-09-11"}`, rodado duas vezes (idempotente):

- 14/09: 687 → **719** · 15/09: 1.146 → **1.177** · 16/09: 35 → **1.002**
- **Zero dias anteriores a 11/09 mudaram de valor** (conferido contra
  `specs/029-serie-atravessa-migracao/antes.csv`, snapshot dos 249 dias tirado antes de qualquer
  escrita).

## 🚩 O que fica para quem vier depois

- **A contribuição POR HOST não existe no dado.** A tabela guarda a soma do dia. A tela diz quem
  entrou e desde quando; dizer "97% vem do antigo" exigiria uma linha por host (PK
  `(projeto, dia, host)`), que está avaliada e rejeitada em `research.md` D4 — é o caminho se um dia
  for preciso ler a série por host isoladamente.
- **A soma termina quando a DECLARAÇÃO terminar.** Enquanto o card tiver `dominioAnterior`, os dois
  contam. O hub não decide sozinho que o 301 "já terminou" — apagar a declaração é ato humano, como
  a lista de termos de marca da 025.
- **Os outros problemas da tela seguem abertos** e não são desta spec: a indexação falhava 25/25 por
  propriedade errada (a `url` do card só virou `usealigner.com` em 18/09, depois da corrida das 06h
  — a próxima resolve sozinha), o crawl cego (corrigido no código em 18/09, espera a corrida de
  segunda), e os achados de conteúdo do site (4 títulos, 6 páginas sem modificador de intenção, 8
  fora da cadência) que moram no repo da Atma.
- **A 1ª semana completa depois da troca é 14/09–20/09.** É ela que prova a costura na tela: se
  vier na casa dos milhares em vez de ~200, a série mediu o negócio. Conferir na segunda.
