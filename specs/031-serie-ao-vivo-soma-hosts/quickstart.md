# Quickstart — como provar que a leitura ao vivo da série soma os hosts

**Feature**: `031-serie-ao-vivo-soma-hosts` | **Data**: 2026-09-19

Guia de VALIDAÇÃO, não de implementação. Cada seção fecha um critério da spec e diz o que conta como
prova. Forma em [contracts/](contracts/leitura-de-serie.md) e [data-model.md](data-model.md).

## Pré-requisitos

| O quê | Onde | Por quê |
|---|---|---|
| Node 22 (≥ 22.18) | — | roda `lib/gsc.ts` direto no `node --test`, como a 030 |
| `.env` com `GOOGLE_SERVICE_ACCOUNT_JSON` | raiz | conferência ao vivo |
| `.env` com `DATABASE_URL` | raiz | só para a tela; as leituras não tocam banco |
| `atma` com `url` e `dominioAnterior` | `data/projects.json` | único projeto em migração |

> Princípio V: ler os `.env` ANTES de olhar código quando algo falhar. Nenhum valor de ambiente sai
> em log, mensagem ou tela.

---

## 1. A suíte, que é o portão (Princípio II)

```bash
npm test
```

**Esperado**: verde, suíte inteira, ~1,6 s. Os testes novos entram em **arquivos já registrados**
(`test/gsc-hosts.test.mjs`, `test/serie-soma-hosts.test.mjs`) — nenhum arquivo novo, nenhuma edição
em `package.json`.

**Ordem que importa**: rode a suíte **depois do extrato de `lerHosts` e antes de qualquer leitura
nova**. Os testes da 030 são o que prova que o extrato não mudou nada.

---

## 2. A soma e o voto único, sem rede e sem Next (FR-002, FR-006)

```bash
node --test test/serie-soma-hosts.test.mjs
```

| Cenário | Esperado |
|---|---|
| `3,9` com `1146` impressões, um host | posição **exatamente** `3,9` (hoje `3,8999999999999995`) |
| dia só num host (o outro calou) | o dia existe, com o que houver |
| mesmo dia nos dois hosts | uma linha; métricas somadas; posição ponderada |
| dia sem impressão em ninguém | `position === null`, nunca `0` |

---

## 3. As leituras, com cliente falso (SC-004, SC-006, FR-006)

```bash
node --test test/gsc-hosts.test.mjs
```

| Cenário | Esperado |
|---|---|
| `gscSeries` com dois hosts | total de impressões = soma das duas respostas, **diferença zero** |
| `gscSeries`, mesma data nos dois | uma linha só |
| `gscSeries` com um host | **uma** requisição; `days` idênticos à resposta crua |
| `gscSeries`, um host falha | `{erro}` começando pelo host; **nenhum** dia |
| `gscSeries`, um host sem propriedade | soma dos vivos; o host em `encerrados` |
| `gscSeries`, todos sem propriedade / lista vazia | `null`; zero requisição |
| `gscSeries`, default | janela `D-86 → D-3`, a mesma de antes |
| `gscTrend` com dois hosts | `current` e `previous` somam os dois, por janela |
| `gscTrend` com um host | **duas** requisições; o número de hoje |
| `gscTrend`, um host falha | `null` (não a soma do que respondeu) |
| as quatro leituras | consultam os **mesmos** hosts (FR-007) |

---

## 4. A testemunha independente (SC-001, SC-002, SC-004)

O script da 029 pergunta ao Google por fora, host a host, e imprime a soma — **sem** passar por
`lib/gsc.ts`. A testemunha não pode ser o código que ela confere.

```bash
node --env-file=.env scripts/conferir-soma-hosts.mjs atma 2026-01-17 2026-09-17
```

Referência medida em 19/09/2026:

| Host | Dias com dado | Impressões | Cliques |
|---|---:|---:|---:|
| `usealigner.com` | 7 | 127 | 9 |
| `atma.roilabs.com.br` | 244 | 370.432 | 4.541 |
| **Total** | **244** | **370.559** | **4.550** |

> O script hoje imprime só impressões na coluna de soma. **Uma linha nova** faz-lhe imprimir também os
> cliques somados — sem ela o SC-005 (a célula é de cliques) não é conferível à mão.
>
> Use a **mesma janela que a tela declara** (leia-a na régua do bloco), não a de referência acima: a
> tela fecha em D-3 e os dias mudam de um dia para o outro. Os números acima valem para
> 2026-01-17 → 2026-09-17.

---

## 5. A aba de aquisição (US1 — SC-001, SC-002, SC-003, SC-006)

```bash
npm run dev    # http://localhost:3000/okr/atma/aquisicao
```

| # | O que conferir | Prova de |
|---|---|---|
| 1 | Bloco "Descoberta — Search Console, 8 meses": impressões = total da seção 4, **diferença zero** | SC-001, SC-004 |
| 2 | A régua diz "a fonte cobre **244** de 244 dia(s) — a janela inteira" (não "truncada") | SC-002 |
| 3 | O bloco de **série** e o de **consultas** declaram a **mesma** lista: `usealigner.com + atma.roilabs.com.br` | SC-003, FR-005 |
| 4 | O bloco "A troca de domínio" e a linha "Recebida: … dos 28 dias" **sumiram** sozinhos | D8 |
| 5 | O gráfico mensal mostra os meses do domínio antigo, não 1 mês de 7 dias | US1 |

**SC-006 — desligando uma propriedade**: retire temporariamente o acesso da service account a UMA das
duas propriedades no Search Console e recarregue.

- **Esperado**: o bloco da série **não publica número nenhum** e a frase traz o host
  (`Search Console indisponível (<host>: …)`).
- **Reprovado**: o bloco aparece com o total encolhido. Soma parcial lê como queda de tráfego — é o
  defeito que a 029 já pagou uma vez.

> Leia a frase da tela, não só a ausência do número: "sem propriedade" (estrutural) e "falhou agora"
> (transitório) pedem conserto diferente.

---

## 6. A ficha e o painel de SEO (US2, US3 — SC-005)

```
http://localhost:3000/okr/atma      (a célula `visitante`)
http://localhost:3000/seo           (o card da Atma)
```

**Esperado**: a célula `visitante` da ficha bate com a soma dos cliques dos dois hosts na mesma
janela de 28 dias (a testemunha da seção 4, com `D-30 → D-3`). O card da Atma no `/seo` não aparece
zerado nem em colapso ao lado dos outros.

**Reprovado**: a célula reflete só os poucos dias do domínio novo.

`gscTrend` (home e agenda): compare `current` do card da Atma com os cliques de `D-31 → D-3` pela
testemunha.

---

## 7. O que NÃO pode mudar (FR-006)

Os outros 34 projetos saem **byte a byte** iguais, com **uma** requisição por janela.

```bash
node --test test/serie-migracao-regressao.test.mjs   # a suíte da 029, intacta
```

Confira também que a corrida que grava não mudou: `git diff app/api/gsc-serie/route.ts` deve mostrar
**só** o nome `gscSeries` → `gscSerieDeUmHost` (import e chamada).

---

## 8. Antes do push

| # | Portão | Comando |
|---|---|---|
| 1 | Suíte inteira verde | `npm test` |
| 2 | Tipos (o rename e as assinaturas novas são a cobrança da FR-007) | `npx tsc --noEmit` |
| 3 | Nenhum import de `data/projects.json` fora de `lib/projects.*` | `grep -rn "data/projects.json" --include=*.ts --include=*.mjs --include=*.tsx app lib` |
| 4 | Nenhuma segunda lista de hosts (FR-001) | `grep -rn "dominioAnterior" --include=*.ts --include=*.mjs --include=*.tsx app lib` |
| 5 | A primitiva de um host só tem `route.ts` como consumidor | `grep -rn "gscSerieDeUmHost" app lib` |
| 6 | O componente de declaração tem dois usos | `grep -c HostsDaLeitura "app/okr/[slug]/aquisicao/page.tsx"` |
| 7 | Nenhum segredo em log, resposta ou erro | leitura do diff |
| 8 | Tela conferida no navegador, antes/depois | skill `ui-verification` |

**Tripwire do `www.` (D9)**: se algum projeto passar a declarar `url` com `www.`, a série dele sai
vazia. Confira antes do push:

```bash
gh api "users/JeanZorzetti/repos?per_page=100&type=owner" --paginate \
  --jq '.[] | select(.archived==false and ((.homepage//"") | test("^(https?://)?www[.]"))) | .name'
```

**Esperado**: nenhuma linha (vazio em 19/09/2026, 35 repos com homepage), e nenhum `url` com `www.`
em `data/projects.json`. Sem barra invertida no regex de propósito: o `gh --jq` a rejeita.

> ⏰ **Janela de push (Princípio IV)**: `main` faz auto-deploy e o container reinicia. NÃO dar push
> entre **23:30–01:00 BRT** (estado noturno 23:37, autopublishing 00:13) nem entre **08:00–08:45
> BRT** (cron diário do autopublishing).

> ⏳ O deploy demora ~15 min depois do push. Conferir a TELA **duas** vezes: uma checagem cedo
> "prova" que não subiu.
