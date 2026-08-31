# Quickstart: Validar o sub-balde Segurança

Pré-requisito: implementação da feature aplicada em `lib/agenda.mjs`, `app/agenda/page.tsx`,
`app/globals.css` e `test/agenda.test.mjs` (ver `tasks.md`).

## 1. Passo zero — medir o predicado antes de mexer na UI

Já rodado em 31/08/2026 (ver `roihub/handoff/handoff-sub-balde-seguranca.md` §3): 2 de 61
cards classificados como segurança, 1 falso positivo encontrado e corrigido no regex. Ao alterar
`RE_SEGURANCA` de novo, repetir esse script e ler a lista inteira antes de seguir:

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

Critério de aceite: cada linha impressa é olhada e classificada manualmente como
*é segurança* / *não é*. Mais de ~20% de falso-positivo ⇒ corrigir a lista de palavras, não
adicionar exceção no render.

## 2. Testes automatizados

```bash
npm test
npx tsc --noEmit
```

Ambos devem terminar sem erro. `npm test` inclui os 5 casos novos de `test/agenda.test.mjs`
(positivos reais, exclusão de "author"/URL de OAuth, ortogonalidade com `tipoDe`, partição
respeitando `ordenar`, `null`/`undefined` sem exceção).

## 3. Verificação visual

```bash
HUB_PASS= npx next dev
```

(`HUB_PASS=` vazio pula o basic auth do `middleware.ts` em dev.)

- Abrir `/agenda` em 1440px e 360px de largura.
- Confirmar visualmente pelo menos um card de segurança (se não houver nenhum pendente no
  banco no momento do teste, adicionar temporariamente uma tarefa cujo título contenha um termo
  da regex, ex. "Rotacionar token de teste", só para o teste local).
- Confirmar: subtítulo "🔒 Segurança (N)" acima do grupo, subtítulo do "resto" abaixo, ordem
  hierárquica `h2` (seção) → `h3` (subgrupo) sem pular nível.
- Confirmar que o contador do `<h2>` da seção Execução continua somando todos os cards,
  incluindo os de segurança.
- Remover a tarefa de teste, recarregar e confirmar que a tela volta a ficar chapada (sem
  subtítulo) quando não há nenhum card de segurança.

## 4. Árvore de acessibilidade

Usar a skill `ui-verification` / Playwright para capturar a árvore de acessibilidade da seção
Execução com pelo menos um card de segurança visível e confirmar a ordem `h2` → `h3` → itens.
