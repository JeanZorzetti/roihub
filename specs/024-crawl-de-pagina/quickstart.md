# Quickstart: validar o crawl de página

**Feature**: `024-crawl-de-pagina` | **Date**: 2026-09-08

Como provar que a feature funciona. Contrato da rota em
[contracts/api-paginas.md](./contracts/api-paginas.md); formas e regras em
[data-model.md](./data-model.md).

## Pré-requisitos

- Node 22, `npm ci` feito.
- Para os passos que tocam a rede: `.env` com `DATABASE_URL`.
- Os passos 1 e 2 **não precisam de credencial nenhuma** — é o ponto do Princípio III, e aqui ele
  vale duplo: as três armadilhas 🚩 da spec são erros de parsing, e parsing se prova sem rede.

---

## 1. A suíte inteira, verde

```bash
npm test
```

**Esperado**: verde, ~2 s. Os arquivos novos (`test/pagina.test.mjs`, `test/grafo.test.mjs`)
precisam estar na lista explícita de `package.json`; `test/validade.test.mjs` reprova se não
estiverem (Princípio II).

---

## 2. As três armadilhas, sem rede

São os testes que decidem se os números desta feature valem alguma coisa.

**SC-005 — o regex guloso está reprovado.** HTML **minificado de uma linha** com dois blocos
`<script>` e um `<h1>` no meio:

```html
<html><head><script>var a=1;</script><title>x</title></head><body><h1>Alinhador invisível em Goiânia</h1><p>texto</p><script>var b=2;</script></body></html>
```

`contarPalavras()` sobre isso devolve as palavras do `<h1>` e do `<p>` — **nunca 0**. Com o `.*`
guloso do `D-84` o resultado seria 0, e a página tem `<h1>`: a contradição interna é a asserção.

**SC-003 — o menu está fora da conta.** O mesmo conjunto de páginas, duas vezes: uma com menu de
5 links em todas, outra com menu de 15. `densidades()` devolve **exatamente os mesmos números**.
Teste de invariância — não precisa saber o número certo para reprovar o defeito.

**SC-004 — pixel não é caractere.** `larguraDoTitulo("iiiiiiiiii")` e
`larguraDoTitulo("WWWWWWWWWW")` têm o mesmo `length` e larguras **diferentes**. E as duas devolvem
`metodo: "arial-20px-tabela"` — o número nunca sai sozinho.

**Órfã não é raiz, e não é erro.** Grafo com a home linkando A e B, e uma URL C só no sitemap:
`profundidade(home) = 0`, `profundidade(A) = 1`, `profundidade(C) = null` com `orfa = true`. Uma
quarta URL D que falhou na busca tem `profundidade = null` **e `erro` preenchido** — e **não** entra
em `orfas`.

**Ciclo termina.** A → B → A com teto 100 encerra e não estoura.

**Ausente ≠ inválido.** `blocosJsonLd()` sobre `@graph` com três tipos devolve os três;
sobre JSON-LD malformado devolve `estado: "invalido"`, **não** `"ausente"`.

**Sem data não é desatualizada.** Página sem `dateModified`, sem `article:modified_time` e sem
`<time datetime>` devolve `dataDeclarada: null`, e a agregação da cadência a mantém fora do
numerador **e** do denominador.

---

## 3. Extrair de uma página real, sem gravar nada

```bash
node -e "Promise.all([import('./lib/pagina.mjs'), import('./lib/conformidade.mjs')]).then(async ([p, c]) => { const r = await c.buscar('https://atma.roilabs.com.br/pacientes/precos'); console.log(p.extrair(r.corpo, new Date().getFullYear())) })"
```

**Esperado**: `titulo` preenchido, `larguraPx` entre ~400 e ~700, `metodo` presente,
`schema.estado` em `valido`/`invalido`/`ausente`, `palavras` **acima de zero**, `conteudo`
`com-conteudo`, e `links` com dezenas de entradas.

**Confere isto** (Independent Test da US2): trocar a URL por uma com título visivelmente mais
curto muda `larguraPx` na direção certa. E `palavras: 0` numa página que você vê texto no navegador
significa que o §2 falhou — pare e leia o `D-84`.

---

## 4. A corrida completa, contra o banco

```bash
curl -sS -X POST "$HUB_URL/api/paginas" -H "authorization: Bearer $CRON_SECRET" | jq
```

**Esperado**: `200` com o objeto do contrato. Para a Atma hoje: `declaradas: 36`,
`visitadas` ≥ 36, `tetoAtingido: false`.

**Confere isto antes de acreditar em qualquer número:**

| Confira | Por quê |
|---|---|
| `visitadas` bate com `SELECT count(*) FROM hub_pagina WHERE projeto='atma' AND dia=<hoje>` | invariante §2 do data-model |
| `orfas` conta só quem tem `erro IS NULL` | erro de rede virando achado de arquitetura é a inversão que esta casa já pagou |
| `linksNavegacao` é da ordem do menu + rodapé (dezenas), não centenas | se for centenas, o limiar da D1 está classificando link contextual como menu |
| `profundidadeMaxima` é um número pequeno (3-5), não `null` | `null` em todo mundo = a travessia não saiu da home |
| **rodar duas vezes no mesmo dia não duplica linha** | PK `(projeto, dia, url)` + `DELETE` antes do `INSERT` |

⚠️ **A primeira corrida mede o check.** Antes de tratar qualquer número como fato sobre a Atma,
abra 3 páginas no navegador e confira à mão: o título que o crawl leu é o título que o navegador
mostra? A página que ele chamou de órfã realmente não é linkada de lugar nenhum? É a décima
primeira vez que esta base precisa desse passo.

---

## 5. A tela

`/okr/atma/aquisicao`, bloco novo abaixo de Indexação.

**Confere isto:**

- A **data da apuração** aparece (FR-015). Sem ela, o número parece de hoje.
- A largura do título aparece com a palavra **"estimativa"** e o método (SC-004). Se aparecer um
  número de pixels solto, a FR-005 está violada.
- Páginas órfãs aparecem como **órfãs**, não como profundidade 0 (US1, cenário 2).
- As páginas com menos de 5 links contextuais estão **ordenadas por impressões** (US1, cenário 3).
- URL sem consulta no GSC exibe **"sem termo apurado"**, nunca "termo ausente do título" (D10).
- **SC-006, o teste de 30 segundos**: abra a tela e tente nomear, cronometrando, quais páginas são
  órfãs ou periféricas. Se precisar rolar, comparar duas tabelas ou fazer conta de cabeça, a tela
  não passou — é a mesma régua da 019.

---

## 6. O workflow

```bash
gh workflow run paginas.yml
```

**Esperado**: verde, e uma linha nova em `hub_pagina_corrida` para hoje.

⚠️ **Não dispare entre 23:30-01:00 nem entre 08:00-08:45 BRT** (Princípio IV). O cron da corrida é
`17 9 * * 1` — segunda, 06:17 BRT, 30 min depois da corrida de indexação.

⚠️ **`curl` que expira em 780 s não deve ser repetido**: a corrida pode estar viva no servidor, e
uma segunda escrevendo o mesmo `(projeto, dia)` produz um número que ninguém consegue explicar. O
retry do workflow cobre só falha de conexão (`7`, `35`, `52`), igual ao da 022.
