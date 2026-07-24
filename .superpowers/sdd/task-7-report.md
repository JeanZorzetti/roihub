# Relatório da Tarefa 7 — histórico, pausas e kill switch

## Status

DONE_WITH_CONCERNS

## RED → GREEN

- RED: o teste focado falhou com `ERR_MODULE_NOT_FOUND` porque o parser dos controles ainda não existia.
- GREEN: o parser aceita somente os dez slugs de `projects.json` ou `*`, exige `enabled` literal `true`/`false`, limita o motivo a 300 caracteres e limpa o motivo ao ativar.
- Três testes cobrem slug/estado inválidos, kill switch global, limite do motivo e ativação.

## Implementação

- `listPublications` clampa o limite em `1..200`; `listProjectStates` e `setProjectEnabled` usam queries parametrizadas e o update falha para projeto ausente.
- A server action valida todos os campos antes da escrita, não escreve com DB desligado e só revalida `/seo` após sucesso ou no-op seguro.
- `/seo` mantém GSC, publicações e estados concorrentes no mesmo `Promise.all`; com DB desligado não chama funções de banco.
- A sala de controle mostra primeiro o kill switch global, depois exatamente os dez projetos de `projects.json`, e usa formulários nativos sem JavaScript client-side.
- O histórico mostra projeto, data, ação, status, query, destino, commit, custo USD e motivo, com fallbacks legíveis.
- O banner de setup informa `DATABASE_URL` sem revelar seu valor.

## Verificações

- Teste focado: PASS, 3/3.
- `npm test`: PASS, 91/91.
- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS na primeira rodada completa; na repetição final, compilação e TypeScript passaram, mas o host falhou em `spawn UNKNOWN` ao abrir o worker seguinte.
- `$env:CIRCLE_NODE_TOTAL='1'; npx next build --webpack`: PASS completo com um worker, sem alteração de config/package.
- Markup: inputs visíveis têm `label`; botões têm texto ativo e `aria-label`; links externos têm `target="_blank" rel="noreferrer"`; foco nativo não foi sobrescrito.

## Preocupações

- O build mantém somente o warning preexistente do Next.js sobre migrar a convenção `middleware` para `proxy`.
- O host estava com paginação/processos esgotados (`0x800705AF`); por isso o gate final exato perdeu o worker após compilar, enquanto a alternativa de baixa concorrência passou.
- Não houve teste com Postgres real; os contratos de persistência foram verificados por tipos, queries parametrizadas e build.
