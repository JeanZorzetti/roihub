# Quickstart: conferir o funil de N3

**Fase 1** | **Branch**: `012-n3-funil-visual` | **Date**: 2026-09-02

Guia de validação. As referências de forma estão em [contracts/funil-n3.md](./contracts/funil-n3.md)
e [data-model.md](./data-model.md) — aqui só o que rodar e o que tem de aparecer.

## Pré-requisitos

- Node 22, `npm ci` feito.
- Para a conferência em tela: a ficha servida pelo **EasyPanel**, não `next dev`. Medida local sob
  OneDrive não é evidência (`.art/log.json`, `lcp_medido: null` pelo mesmo motivo).

## 1. Suíte — o portão que reprova sozinho

```bash
npm test
```

Verde, suíte inteira (~1,6 s), não só `test/ficha.test.mjs`. Nenhum arquivo de teste novo foi
criado, então `test/validade.test.mjs` não deve acusar divergência de lista — se acusar, alguém
criou arquivo fora da lista do `package.json` (Princípio II).

Asserções que precisam existir em `test/ficha.test.mjs`, uma por garantia do contrato:

| Cenário | Espera |
|---|---|
| Perfil D, cadeia da `atma` (`visitante` 525, `lead` 35, resto sem coletor, `tratamento` 0) | `funil.length === 5`; `funil[0].estado === "apurado"`; os quatro seguintes `"nao-apurado"` (AS-1) |
| Laço sobre `Object.keys(PERFIS)` — os **quatro** perfis | `funil.length === PERFIS[k].marcos.length - 1` (A/B/C = 4, D = 5). O laço é o que prova ausência de branch por perfil (FR-002, SC-003) |
| Qualquer cadeia | `funil.length === n3.celulas.length` e `funil[i].estado === n3.celulas[i].estado` para todo `i` (C1, C2) |
| Segmento apurado | tem `entrada`/`saida` em `[0,1]` com `saida <= entrada` (C3) |
| Segmento não apurado | **não** tem `entrada` nem `saida` (C4, SC-002) |
| Marco apurado com `valor: 0` | altura `0` exata, sem piso (C5) |
| Todos os marcos apurados em `0` | alturas `0`, sem `NaN`/`Infinity` (C6) |
| **Nenhum** marco apurado (funil 100% hachurado) | contagem certa, todos `nao-apurado`, sem `-Infinity` — conjunto vazio, não conjunto de zeros (C8, Edge Case 1) |
| Taxa `0/0` | segmento `nao-apurado`, nunca apurado com altura `0` (C9, Edge Case 3, R1) |
| Projeto sem perfil | `funil` é `[]` (FR-005) |
| N0, N1, N2, N4, N5, N6 | nenhum tem campo `funil` |

## 2. Regressão de N3 — o que NÃO pode mudar

Ainda em `npm test`: os testes de N3 que já existem (`R2 — N3 cola a fração no percentual...`)
continuam passando **sem edição**. Se algum precisou ser reescrito, a FR-004 caiu — o funil é
aditivo, não substitui nem reformata linha nenhuma.

## 3. A ficha em tela

```bash
curl -s https://<host>/okr/atma | grep -c 'ficha-funil'   # 1
curl -s https://<host>/okr/atma | grep -c 'n3-hachura'    # >= 1
```

Depois, no navegador, em `/okr/atma`:

1. **Contagem e forma (SC-001)**: cinco segmentos, o primeiro um trapézio sólido que afunila forte
   (`525 → 35` = 6,67%), os quatro seguintes hachurados. Dá para responder "quantos degraus?" e
   "onde o dado para?" sem ler uma linha de texto.
2. **As linhas continuam (FR-004, US2)**: abaixo do funil, as mesmas cinco linhas de sempre, mesma
   ordem, `6,67% (35/525)` com a fração colada e os quatro motivos por extenso.
3. **Outro perfil (SC-003)**: abrir a ficha de um projeto de perfil A, B ou C — **quatro**
   segmentos. Se aparecerem cinco, a contagem virou constante.
4. **Sem perfil (FR-005)**: abrir a ficha de um projeto sem `perfil` no card — nenhum SVG, só a
   linha "não apurado — sem perfil declarado".
5. **Listagem intocada (FR-006)**: `/okr` sem nenhum funil.

## 4. Orçamento e acessibilidade

- **JS (SC-004)**: DevTools → Network → filtro JS, comparar o total transferido de `/okr/<slug>`
  antes e depois. Tem de ser **idêntico**. Se subiu, algo virou Client Component.
  - **Linha de base (T001, medida em `hub.roilabs.com.br/okr/atma`, 2026-09-02, antes da
    implementação)**: 8 arquivos `.js`, **149.089 bytes** transferidos (encoded), 520.478 bytes
    decodificados. `npm test` verde, 472/472, antes de qualquer edição.
- **Decorativo (FR-008)**: DevTools → Elements → aba Accessibility, ou o eixo de acessibilidade do
  Playwright. O `<svg>` não aparece na árvore. Percorrer a página com leitor de tela lê as linhas
  de N3 **uma vez** — não uma vez pelo funil e outra pelo texto.
- **Teclado**: `Tab` pela ficha não para em nenhum segmento.

## 5. Direção visual

Larguras 1440 / 1024 / 390: o funil ocupa a largura do card e escala junto, sem barra de rolagem
horizontal e sem hachura esticada (escala uniforme, `viewBox` fixo). Raio 0, sombra 0, nenhuma
camada com `opacity` — os três limites da direção corte-seco registrada em `.art/log.json`.
