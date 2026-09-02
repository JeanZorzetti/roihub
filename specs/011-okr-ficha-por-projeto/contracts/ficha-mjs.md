# Contrato: `lib/ficha.mjs`

**Feature**: `011-okr-ficha-por-projeto`

Módulo **puro**: sem env, sem banco, sem rede, sem relógio. `hoje` e a janela entram por parâmetro
(Princípio III, FR-033). Importa `lib/funil.mjs`, `lib/okr.mjs` e `lib/projecao.mjs` e **não
reimplementa** célula, razão, cadeia, veredito nem inversão.

## Imports permitidos

```js
import { ehApurado, razao, pct }              from "./funil.mjs";
import { PERFIS, FAMILIAS, posicaoDeAtaque }  from "./okr.mjs";
```

`montarFicha()` e `projetar()` são chamadas **pela página**, não aqui — a ficha recebe os dois
resultados prontos. Isso mantém o módulo puro e prova, por assinatura, que ele não pode inventar um
degrau que a 009 não produziu.

## API

### `estadoDeApurado(celula, fonte) → CelulaFicha`

Embrulha uma célula da 009 (`{valor}` ou `{naoApurado}`). `{valor}` → `apurado` com `fonte`;
`{naoApurado}` → `nao-apurado` com o motivo intacto e `consultar` vindo do `fonte` do marco.

### `declarada(valor, { em, oQue, rotulo }) → CelulaDeclarada`

Nasce de um campo do card. `em` ausente → `declaradoEm: "data não registrada"`; a declaração **não
some** por falta de data.

### `naoApurada(motivo, consultar, rotulo) → CelulaNaoApurada`

`consultar` é obrigatório e não pode ser vazio — R4: a fonte a consultar, não a instrumentação a
escrever.

### `combinar(insumos, calcular) → CelulaFicha`

A herança da FR-010. Ver a tabela em [data-model.md §1](../data-model.md). `calcular` só é chamada
quando nenhum insumo é `nao-apurado`.

### `avaliarN2(fatores, marcos, taxas, declaracoes) → { fatores: CelulaFicha[], veredito: CelulaFicha, erroDeDefinicao: string|null }`

FR-019 a FR-022. `erroDeDefinicao` não-nulo quando as coberturas dos fatores **de cadeia** têm buraco
ou sobreposição, ou não terminam no último marco.

### `montarN4(canais, cliquesCelula, marcos) → CanalN4[]`

FR-023 a FR-025. `semElo` derivado; sem total, sem soma.

### `escolherFamilia(veredito, ficha) → { familia: string|null, motivo: string }`

FR-027. Ver a tabela de escolha em [data-model.md §6](../data-model.md).

### `montarN5(familia, disponiveis) → MedidorN5[]`

FR-026, FR-028, FR-029. `disponiveis` é o mapa do que **esta requisição** já carrega
(`impressoes`, `lead-gravado`, `gateway-ligado`); todo medidor fora dele sai `nao-apurado` **na
lista**, nunca omitido.

### `validarKrs(krs, espacos) → KrValidado[]`

FR-013, FR-015 a FR-018. Ordem de validação em [data-model.md §8](../data-model.md).

### `montarNiveis(entrada) → Nivel[]`

O ponto de entrada. Sempre **7 elementos**, na ordem `N0..N6`.

```js
montarNiveis({
  slug, ficha,        // ficha = saída de montarFicha() da 009
  projecao,           // saída de projetar() da 010
  veredito,           // saída de posicaoDeAtaque() da 009
  declarada,          // campo `ficha` do card, ou null
  meta,               // campo `meta` do card, ou null
  itensAgenda,        // saída de acoesDoRanking() filtrada pelo slug, ou null se a fonte caiu
  erroAgenda,         // string|null
  datasDono,          // Map<key, "YYYY-MM-DD">
  disponiveisN5,      // { impressoes?, "lead-gravado"?, "gateway-ligado"? }
  janela,             // { inicio, fim }
});
```

## Garantias — o que o `test/ficha.test.mjs` prova

| # | garantia | requisito |
|---|---|---|
| **G1** | `montarNiveis()` devolve exatamente 7 níveis, na ordem, para qualquer entrada — inclusive projeto sem perfil, sem meta e sem `ficha` | FR-008, SC-002 |
| **G2** | Nenhuma `CelulaFicha` produzida tem `estado` fora dos três; nenhuma `apurado` sem `fonte`; nenhuma `declarado` sem `declaradoEm`; nenhuma `nao-apurado` sem `motivo` **e** `consultar` | FR-009, SC-003, SC-004 |
| **G3** | Célula derivada de insumo declarado sai `declarado`. Caso literal: `0 tratamentos × R$ 4.000` → `declarado`, nunca `apurado` | FR-010, SC-006 |
| **G4** | Fator de cadeia com **um** degrau não apurado no trecho sai `nao-apurado`, mesmo com os outros degraus do trecho apurados | FR-020, SC-007 |
| **G5** | Cobertura com buraco ou sobreposição → `erroDeDefinicao`. Degraus **acima** do primeiro fator **não** produzem erro | FR-021 |
| **G6** | Veredito de N2 com qualquer fator faltando → `nao-apurado` nomeando os fatores; nunca `fecha` | FR-022, SC-006 |
| **G7** | N4 nunca produz total nem soma; a diferença sai `nao-apurado`; perfil C marca `organico` como `sem elo` | FR-024, FR-025, SC-008 |
| **G8** | N5 devolve medidores de **uma** família só; `posicao-media-com-corte-pais` sempre `nao-apurado` | FR-026, FR-029, SC-005 |
| **G9** | KR sobre célula não apurada → `nao-verificavel`; sobre apurada → sem marca. As duas no mesmo teste | FR-015, SC-009 |
| **G10** | KR com chave inexistente no nível do prefixo → `chave-invalida` nomeando a chave. **Zero** casamento por aproximação, e a chave não é procurada nos outros níveis | FR-017, SC-010, SC-020 |
| **G11** | KR sem dono → marcado e **visível**; 4º KR → `excedente` e **visível** | FR-016, FR-018 |
| **G12** | Sem perfil: N1 a N5 saem `nao-apurado` com o motivo, **zero** números; N0 e N6 continuam válidos | Edge Case, SC-012 |
| **G13** | Perfil A/B/C: N2 inteiro `nao-apurado: fatores do perfil ainda não declarados`; os outros seis níveis normais | FR-019a, SC-017 |
| **G14** | N6 com `itensAgenda: null` e `erroAgenda` → `nao-apurado` com o motivo; com `[]` → `sem ação declarada`. Textos **diferentes** | FR-030b, US5 |
| **G15** | `celulaQueMove` é `nao-declarada` mesmo quando o título do item cita literalmente o nome de um degrau | FR-031, US5-AC3 |

## Proibições verificáveis por leitura do arquivo

- Nenhum `Date.now()`, `new Date()` sem argumento, `process.env` ou `import` de `pg`/`gsc`.
- Nenhuma reimplementação de `razao()`, `montarFicha()`, `posicaoDeAtaque()` ou `projetar()`.
- Nenhum literal `0` devolvido como valor de célula por ausência de dado.
