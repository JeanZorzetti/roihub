# PLANO — sub-balde `Segurança` dentro de `Execução`

**Data:** 31/08/2026 · **Estado:** especificado, **não implementado** · **Escopo:** `/agenda`
**Decidido com o Jean:** entra por **palavra-chave** (como os três baldes) e **fura a fila** —
o grupo Segurança vem antes do resto da Execução, independente do score do projeto.

---

## 1. Por que NÃO é um quarto balde

O reflexo é pôr `{ id: "seguranca", label: "Segurança", icone: "🔒" }` em `TIPOS`
(`lib/agenda.mjs:48`) e acabar. **Isso quebra a doutrina dos baldes e o pedido.**

Os três baldes classificam **o que o card exige de você** — esforço: medir (Conferência),
escrever/publicar (Execução), ou nada até você decidir (Decisão). Segurança não é um esforço, é um
**assunto**. São **dois eixos ortogonais**, e empilhar um no outro tem dois efeitos:

- Um quarto `TIPOS` seria **irmão**, não sub-balde: os cards SAEM da Execução, o contador
  "Execução (18)" cai, e você perde a leitura de quanto trabalho de escrita existe.
- `tipoDe()` devolve **um** valor. Card de segurança que é conferência ("conferir se o token vazou
  no repo público") teria que escolher entre estar em Conferência ou em Segurança.

**Modelo correto:** `tipo` continua sendo o eixo do esforço; `seguranca` é um **predicado booleano
independente**, que hoje só é renderizado dentro de Execução porque foi esse o pedido. O predicado
nasce geral — ligar em Conferência depois é uma linha (§7).

## 2. O predicado

Em `lib/agenda.mjs`, logo abaixo de `tipoDe()` (`:72`):

```js
/**
 * Assunto do card, não esforço — ortogonal a `tipoDe`. Card de segurança é o que expõe
 * credencial, dado ou superfície: rotação de segredo, chave no repo, CORS/auth aberta, CVE.
 *
 * Só o TÍTULO, pelo mesmo motivo de `tipoDe`: a `descricao` destes cards é diário de bordo
 * ("✅ token rotacionado em 31/07…") e classificaria o card pelo que JÁ foi resolvido.
 */
const RE_SEGURANCA =
  /\btoken\b|\bcredencia(?:l|is)\b|\bsegredo\b|\bsecret\b|\brotacionar\b|\bchave (?:de api|secreta|privada)\b|\bvaz(?:ou|amento|ada)\b|\bexpost[oa]\b|\bCVE-\d|\bCORS\b|(?<![/\w])auth(?![/\w])|\bautentica[çc][ãa]o\b|\bvulnerab/i;

/** ponytail: heurística de palavra-chave, igual `tipoDe`. Erra do mesmo jeito e se conserta do
 * mesmo jeito — se o erro virar regra, troque a lista, não remende no render. */
export function seguranca(titulo) {
  return RE_SEGURANCA.test(String(titulo ?? ""));
}
```

⚠️ **`auth` NÃO usa `\b`, e a razão foi medida (§3), não imaginada.** `\bauth\b` casa "author"?
Não — o `\b` resolve esse. O que ele não resolve é **`auth` dentro de caminho de URL**: o card
`"Configurar GitHub OAuth (callback …/api/auth/callback/github)"` entrava no sub-balde por causa do
`/auth/` no meio de uma URL, e esse card é *ligar login*, não incidente de segurança. `(?<![/\w])`
/ `(?![/\w])` corta a barra além do caractere de palavra. Verificado: pega `"Rota /admin sem auth"`
e `"auth quebrada na Atma"`, ignora o card do OAuth e `"Definir o author do post"`.

## 3. 🚨 Passo ZERO — medir o predicado ANTES de encostar na UI

A primeira corrida de um check novo mede **o check**, não o mundo. Rodar isto e **ler a lista
inteira** antes de escrever uma linha de JSX:

```bash
node --env-file=.env --input-type=module -e '
import { seguranca } from "./lib/agenda.mjs";
import { createRequire } from "node:module";
import pg from "pg";
const projects = createRequire(import.meta.url)("./data/projects.json");
const p = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await p.query("select titulo from hub_tasks");
const alvos = [...rows.map(r => r.titulo), ...projects.filter(x => x.acao).map(x => x.acao)];
for (const t of alvos) if (seguranca(t)) console.log("🔒", t.slice(0, 110));
console.log("---", alvos.filter(seguranca).length, "de", alvos.length);
await p.end();'
```

**Critério de aceite do passo zero:** cada linha que sair é olhada e classificada em *é segurança* /
*não é*. Se mais de ~20% for falso-positivo, a lista de palavras está errada — **corrigir a lista,
não adicionar exceção no render.**

### ✅ Já rodado em 31/08 — e mudou o regex

**2 de 61 cards** (`hub_tasks` + `acao` dos 32 curados):

| card | veredito |
|---|---|
| `Rotacionar o token de produção do MercadoPago…` (`atma`, `#1`, `execucao`) | ✅ verdadeiro positivo — é exatamente o alvo |
| `Configurar GitHub OAuth (callback …/api/auth/callback/github) e Resend…` | ❌ **falso positivo**, e ensinou o §2: casou pelo `/auth/` **de uma URL**. É card de *ligar login*, não de segurança. Corrigido com `(?<![/\w])auth(?![/\w])` |

🚩 **Isto muda a expectativa de quem for implementar: o sub-balde nasce com UM card.** Não é
argumento contra construir — é argumento a favor de esconder o grupo quando vazio (§5), porque na
maioria dos dias ele estará. Se depois de ligar continuar em 1 por semanas, a pergunta certa não é
"melhorar a heurística", é **"a agenda tem pouco trabalho de segurança ou eu não estou escrevendo
esses cards?"** — e essa não se responde com regex.

## 4. A ordem — partição no render, não comparador novo

**Não mexer em `porUrgencia` (`lib/agenda.mjs:199`).** Ele acabou de ser consertado
(`balde de data → rank do projeto → data`) e um quarto termo lá afetaria os três baldes.

"Furar a fila" se resolve **particionando a lista**: dois grupos dentro da mesma `<section>`, cada
um ordenado pelo `ordenar()` que já existe. Zero mudança no comparador.

```
🔨 EXECUÇÃO (18)                  ← contador segue o total: segurança continua sendo execução

   🔒 Segurança (2)
   ├─ Rotacionar token de produção do MP     atma   #1
   └─ CORS fixo no checkout do app           mana   #22   ← o #22 acima do #4

   ── resto ──
   ├─ Publicar artigo                      goiania  #4
   └─ Subir sitemap novo                     orion  #5
```

Segredo vazado de um projeto #30 não espera o #1 — é essa a razão de existir do sub-balde. **Dentro
de cada grupo** a ordem é a de sempre: ação do ranking, urgência, rank, data.

## 5. Onde encostar

| Arquivo | Mudança |
|---|---|
| `lib/agenda.mjs:72` | `RE_SEGURANCA` + `export function seguranca(titulo)` |
| `app/agenda/page.tsx:34` | `Item` ganha `seguranca: boolean` |
| `app/agenda/page.tsx:216` | ação do ranking: `seguranca: seguranca(p.acao)` |
| `app/agenda/page.tsx` (`itemFromTask`) | tarefa do banco: `seguranca: seguranca(t.titulo)` |
| `app/agenda/page.tsx:148` (`Balde`) | particionar quando `tipo.id === "execucao"` |
| `app/globals.css:280` | `.ag-sub` — subtítulo `<h3>` do grupo, no tom do `.ag-h` |
| `test/agenda.test.mjs` | os cinco testes do §6 |

### O render do `Balde`

```tsx
const seg = tipo.id === "execucao" ? items.filter((i) => i.seguranca) : [];
const resto = seg.length ? items.filter((i) => !i.seguranca) : items;
```

- **`seg.length === 0` → lista chapada, exatamente como hoje.** O sub-balde vazio não aparece: os
  TRÊS baldes ficam na tela mesmo vazios porque são a taxonomia e sumir esconderia que existem;
  Segurança é destaque dentro de um deles, e um "🔒 Segurança (0)" todo dia é ruído.
- **`seg.length > 0` → os dois grupos ganham subtítulo**, inclusive o "resto". Um grupo rotulado e
  outro solto faz a lista parecer arbitrária.
- Subtítulo é `<h3>` dentro do `<h2>` da seção — **não pular nível**, a página já faz `h1`→`h2`.
- O contador do `<h2>` e o `· N atrasadas` continuam contando **o balde inteiro**.

## 6. Testes (em `test/agenda.test.mjs`)

1. `seguranca()` casa os positivos reais: `"Rotacionar o token de produção do MercadoPago"`,
   `"CORS fixo no checkout"`, `"CVE-2026-1234 no next"`, `"credencial exposta no repo público"`.
2. **`seguranca("Definir o author do post") === false`** — `\bauth\b` não pode pegar "author".
3. Ortogonalidade: `tipoDe("Rotacionar o token…") === "execucao"` **e** `seguranca(…) === true`.
   O card não sai da Execução.
4. Partição: com 1 card de segurança rank 20 e 1 comum rank 2, o de segurança vem primeiro; e
   **dentro** do grupo de segurança, rank 2 vem antes de rank 20 — o `ordenar` segue valendo.
5. `seguranca(null)` e `seguranca(undefined)` não estouram (mesmo contrato de `tipoDe`).

**Fechar com:** `npm test` verde e `npx tsc --noEmit` limpo.
**Verificar na tela:** `next dev` com `HUB_PASS=` (pula o basic auth do `middleware.ts`), screenshot
a 1440 e 360 com pelo menos um card de segurança visível, e a árvore de acessibilidade mostrando
`h2` → `h3` na ordem.

## 7. Fora de escopo — decidir depois, não agora

- **Ligar o predicado em Conferência e Decisão.** Ele já é geral; é o `tipo.id === "execucao"` do
  `Balde` que segura. Vale quando aparecer o primeiro card de "conferir se vazou".
- **Filtro `?seguranca=1`.** Uma entrada em `lerFiltros`, uma cláusula em `filtrar` e um select, no
  molde do `?tipo=` entregue em 31/08. Só vale se a lista crescer.
- **Override manual.** Hoje não existe: o balde tem `BALDE FIXADO` (`hub_tasks.tipo`), segurança
  não tem equivalente. Se a heurística errar com frequência, o caminho é `hub_tasks.seguranca TEXT`
  (`null` = heurística, `'sim'`/`'nao'` = fixado), mesmo contrato do `tipo` — **e aí a ação do
  ranking continua só na heurística**, porque não tem linha no banco.

## 8. Ao terminar

Entrada `★ ENTREGUE` no topo de `handoff.md` **só quando estiver no ar**. Este arquivo é plano, não
entrega, e por isso não foi indexado lá.
