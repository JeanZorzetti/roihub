# Quickstart: validar o ranking ponderado da página /seo

Pré-requisito: `lib/seo-score.mjs` implementado conforme [contracts/seo-score.md](./contracts/seo-score.md) e `app/seo/page.tsx` consumindo-o conforme [data-model.md](./data-model.md).

## 1. Validar a lógica de score isoladamente (sem rede, sem GSC)

```bash
node --test test/seo-score.test.mjs
```

Cenários mínimos que o teste deve cobrir (ver Acceptance Scenarios do spec.md):

- Projeto com poucas impressões mas muitos cliques aparece antes de um projeto com muitas impressões e poucos cliques (User Story 1, Acceptance #1).
- Projeto com CTR alto e posição pior vence um projeto com posição ótima e CTR baixo quando o score composto favorece o primeiro (User Story 1, Acceptance #2).
- Mesma entrada (em qualquer ordem de array) sempre produz o mesmo `result` — determinismo (FR-006, SC-003).
- `ctr`/`position` nulos entram como pior valor, sem lançar erro nem excluir o projeto (Edge Cases).
- Empate exato de score é resolvido por cliques brutos, depois por nome (FR-006).
- Único projeto no conjunto → `components` todos `1`, sem divisão por zero (data-model.md, regra 3).

## 2. Validar a página completa localmente

```bash
npm run dev
```

Abrir `http://localhost:3000/seo` e conferir visualmente:

- [ ] A ordem dos cards não é mais "maior impressão primeiro" — comparar com um cálculo manual do score para os 2-3 projetos com mais cliques.
- [ ] Cada card com dado GSC mostra um badge de posição (#1, #2, #3...).
- [ ] O(s) card(s) de melhor score têm acento visual (`--accent`) perceptível numa olhada rápida.
- [ ] Projetos `SEED` (sem dado GSC) continuam ao final, sem badge/acento de destaque, com o texto explicativo atual.
- [ ] Redimensionar para largura mobile (<520px): grid vira coluna única, badge/acento continuam visíveis.
- [ ] Recarregar a página duas vezes seguidas sem mudança de dado: ordem idêntica nas duas.
- [ ] O score composto (ou seus componentes) fica visível para qualquer projeto com dado — hover/tooltip ou texto direto no card.

## 3. Rodar a suíte completa antes de finalizar

```bash
npm test
```

Confirma que `test/seo-score.test.mjs` foi adicionado à lista do script `"test"` em `package.json` (não há glob automático neste projeto) e que nenhum teste existente quebrou.
