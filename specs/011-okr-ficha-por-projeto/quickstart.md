# Quickstart — como conferir a ficha N0-N6

**Feature**: `011-okr-ficha-por-projeto` | **Data**: 2026-09-01

> ⚠️ **Toda leitura desta feature se confere no HTML servido pelo EasyPanel, nunca no `next dev`.**
> `ATMA_DATABASE_URL` não está em produção: lá a célula de leads sai `não apurado` e a âncora da 010
> recua de `lead` para `visitante`. Os `7,29%` da spec existem onde a env existe. A primeira corrida
> de um check mede o check, não o negócio — confira **uma** linha à mão antes de citar qualquer
> contagem.

Substitua `$HUB` pela URL servida (produção) em tudo abaixo.

---

## 0. Pré-requisitos

- Node 22, `npm ci` feito.
- Para o teste puro: nada além disso — `lib/ficha.mjs` não toca env, banco nem rede.
- Para a conferência em produção: acesso HTTP ao hub. Sem VPN, sem credencial.

---

## 1. A suíte (SC-016)

```bash
npm test
```

Espera-se: verde, `test/ficha.test.mjs` **na lista** do `package.json`, suíte inteira abaixo de ~2s.
`test/validade.test.mjs` reprova se o arquivo novo não estiver registrado — é o gate do Princípio II
e ele já existe.

---

## 2. As duas rotas respondem (SC-002, SC-011)

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$HUB/okr"            # 200
curl -s -o /dev/null -w "%{http_code}\n" "$HUB/okr/atma"       # 200
curl -s -o /dev/null -w "%{http_code}\n" "$HUB/okr/nao-existe" # 404
```

Os sete títulos:

```bash
curl -s "$HUB/okr/atma" | grep -o 'N[0-6] —' | sort -u | wc -l   # 7
```

---

## 3. Nenhum número sem fonte nem rótulo (SC-003, SC-004)

Varredura do HTML servido. O que se procura é **ausência**:

```bash
# zero célula em branco, zero travessão solto, zero "0" de preguiça
curl -s "$HUB/okr/atma" | grep -c '<td></td>'        # 0
curl -s "$HUB/okr/atma" | grep -c '<td>—</td>'       # 0

# todo bloco "não apurado" traz motivo E fonte a consultar
curl -s "$HUB/okr/atma" | grep -o 'não apurado[^<]*' | grep -vc 'consultar\|—'   # 0
```

Repita em um projeto sem perfil (SC-012) e em um de perfil A/B/C (SC-017): a mesma varredura, os
mesmos zeros.

---

## 4. Os casos que a `atma` prova

| # | o que abrir | o que tem que aparecer | requisito |
|---|---|---|---|
| 1 | `/okr/atma`, nível **N2** | veredito **"não fecha"**, com `CR(lead→consulta)` e `CR(consulta→tratamento)` nomeados como faltantes; `Valor do tratamento` rotulado **declarado** com a data 01/09/2026 | SC-006 |
| 2 | `/okr/atma`, nível **N4** | `orgânico` apurado (Search Console) e os outros cinco `não apurados`. **Nenhum total, nenhuma soma.** A diferença entre canais medidos e a entrada da cadeia sai `não apurado` | SC-008 |
| 3 | `/okr/atma`, nível **N5** | medidores de **uma** família só, com a família nomeada e o motivo da escolha. `posição média` sai `não apurado: sem corte por país mistura branded com genérico` | SC-005, FR-029 |
| 4 | `/okr/atma`, nível **N6** | os mesmos itens que `$HUB/agenda?projeto=atma` mostra, com os mesmos donos, cada um com data e `célula que move: não declarada` | SC-018 |
| 5 | `/okr/atma`, nível **N1** | a contagem apurada e o valor em R$ rotulado **declarado** — porque o ticket é declaração, e a herança contamina o produto | FR-010 |

**Conferência de N6 lado a lado** (SC-018) — abra as duas telas e compare a lista item a item:

```
$HUB/agenda?projeto=atma
$HUB/okr/atma
```

Item extra, item faltando ou dono diferente reprova: a ficha chama `acoesDoRanking()`, a mesma
projeção, e reimplementá-la é proibido (FR-030).

---

## 5. A `/okr` não mudou (SC-001)

Antes de tocar em qualquer coisa, guarde a linha de base:

```bash
curl -s "$HUB/okr" > /tmp/okr-antes.html
```

Depois do deploy:

```bash
curl -s "$HUB/okr" > /tmp/okr-depois.html
diff <(sed 's/<a href="\/okr\/[^"]*">//g; s/<\/a>//g' /tmp/okr-antes.html) \
     <(sed 's/<a href="\/okr\/[^"]*">//g; s/<\/a>//g' /tmp/okr-depois.html)
```

Espera-se: **nenhuma diferença** além dos links da FR-006 que o `sed` remove. Mesmos 40 projetos,
mesma ordem, mesmas posições de ataque, mesmos blocos de projeção.

Contagem de sanidade:

```bash
curl -s "$HUB/okr" | grep -c 'hero-name'   # o mesmo número de antes
```

---

## 6. Navegação e teclado (SC-013)

Sem mouse, a partir de qualquer aba:

1. `Tab` a partir do topo → o **primeiro** alvo é "Pular para o conteúdo". Se não for, reprova.
2. `Tab` até a aba **OKR** → foco visível.
3. `Enter` no link OKR → `/okr`. **Um** acionamento.
4. De volta em outra aba: `Tab` até o disclosure ao lado de OKR, `Enter` (ou `Espaço`) → menu abre;
   `Tab` → `Portfólio`; `Tab` → `Atma`; `Enter` → `/okr/atma`. **Dois** acionamentos.
5. Em `/okr/atma`, recarregue: o menu já está **aberto** e `Atma` está marcada como página atual.
6. Com JavaScript **desligado** no navegador, repita 4 e 5. Tudo continua funcionando.

Zero fichas curadas (FR-005): remova temporariamente o campo `ficha` do card e confira que a aba OKR
volta a ser um link simples, sem disclosure.

---

## 7. 390px (SC-014)

Abra `$HUB/okr/atma` com a viewport em 390px, o menu **aberto**:

```js
// no console do navegador
document.documentElement.scrollWidth <= document.documentElement.clientWidth  // true
```

A barra de abas e a faixa do menu quebram em linhas. Rolagem horizontal só é permitida **dentro** de
`.tabela-rolavel`, que é focável e nomeada.

---

## 8. O teste que só produção faz (SC-015)

Compare a ficha da `atma` com e sem `ATMA_DATABASE_URL`:

- **com** a env (local, se você a tiver): `lead = 39`, `CR(visitante→lead) = 7,29% (39/535)`.
- **sem** a env (produção hoje): a célula de leads inteira vira `não apurado`, N2 perde o fator
  `Leads`, N3 perde uma taxa e a âncora da 010 recua para `visitante`.

**Nenhum `0` novo pode aparecer nessa diferença.** Banco fora produzindo "0 leads" é o melhor placar
possível saindo do pior estado possível — é o defeito que a feature inteira existe para não ter.

---

## 9. Checklist de fechamento

- [ ] `npm test` verde, `test/ficha.test.mjs` na lista do `package.json`
- [ ] `/okr/atma` 200 com os sete títulos; `/okr/<inexistente>` 404
- [ ] Varredura de HTML: zero célula em branco, zero `—`, zero `0` de preguiça
- [ ] `diff` da `/okr` limpo, exceto os links da FR-006
- [ ] N6 idêntico à `/agenda` filtrada, item a item, dono a dono
- [ ] Passagem de teclado completa, com JavaScript desligado
- [ ] 390px sem rolagem horizontal
- [ ] Push **fora** de 23:30-01:00 e 08:00-08:45 BRT (Princípio IV — push é deploy)
