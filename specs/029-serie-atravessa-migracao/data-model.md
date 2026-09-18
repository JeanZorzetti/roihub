# Modelo de dados — 029

## `hub_gsc_dia` — sem DDL nova

Chave, colunas e tipos **não mudam**. O que muda é a semântica de uma coluna:

| Coluna | Antes | Depois |
|---|---|---|
| `host` | o host que a corrida mediu naquele dia | a **assinatura** dos hosts somados: normalizados, ordenados, unidos por `+` |

Uma linha antiga (`atma.roilabs.com.br`) é uma assinatura válida de um elemento — por isso não há
migração, e por isso a leitura antiga continua correta para os 248 dias anteriores à troca.

`impressoes`, `cliques` e as sete colunas de marca passam a carregar a **soma** dos hosts da
assinatura. `posicao` passa a ser a média ponderada por impressão (D3).

### Estado da Atma em 18/09/2026, antes da feature

```
host                    n    de           até
atma.roilabs.com.br    248   2026-01-11   2026-09-15
usealigner.com           1   2026-09-16   2026-09-16
```

### Estado esperado depois da correção

```
host                                     n     de           até
atma.roilabs.com.br                     243    2026-01-11   2026-09-10
atma.roilabs.com.br+usealigner.com        6+   2026-09-11   (corrente)
```

**Medido depois da correção, em 18/09/2026**: 14/09 passou de 687 para 719, 15/09 de 1.146 para
1.177 e 16/09 de **35 para 1.002**. Nenhum dia anterior a 11/09 mudou de valor.

A assinatura nomeia os hosts **consultados**, não só os que tiveram impressão: 11/09 a 13/09 saem
com os dois hosts embora o domínio novo valesse 0 neles. É o que a FR-007 pede — assinatura pelos
que contribuíram faria "o domínio anterior zerou" (dado legítimo) ficar idêntico a "o domínio
anterior saiu da conta" (mudança de régua), que é justamente a distinção que ela existe para
guardar.

**É a mudança de assinatura que a tela marca como fronteira** — ela sai do DADO, como já saía na
026. Aqui ela coincide com a data declarada da troca porque foi de 11/09 que a correção partiu.

## `hostsDeclarados(projeto)` — reusada, não alterada

Já existe em `lib/projects.mjs` e já é o que o bloco de GA4 desta tela usa. Devolve os hosts de
`url` e de `dominioAnterior.url`, com `www.` removido e sem repetição:

```js
hostsDeclarados(atma) // → ["usealigner.com", "atma.roilabs.com.br"]
hostsDeclarados(goiania) // → ["goiania.roilabs.com.br"]
```

Projeto sem `dominioAnterior` devolve um host, a corrida consulta um host, a assinatura tem um
elemento e o comportamento é idêntico ao atual (FR-014).

## Entidades derivadas (só em memória)

| Entidade | Onde | O que é |
|---|---|---|
| Série por host | rota, durante a corrida | a resposta do GSC para cada host declarado, antes da soma |
| Assinatura | `lib/serie-gsc.mjs` | a string que identifica o conjunto somado |
| Segmento | `lib/marca.mjs` | bloco contíguo de dias cujas assinaturas cabem no mesmo conjunto declarado |
| Fronteira | tela | o primeiro dia em que a assinatura muda dentro do declarado, com data e hosts dos dois lados |

## Invariantes

1. Toda assinatura gravada contém apenas hosts declarados pelo projeto naquele momento.
2. Nenhum dia anterior à troca declarada muda de valor (SC-005) — verificado por teste, não por
   janela artificial na escrita.
3. Um dia nunca é gravado com soma parcial: host que FALHA aborta o projeto na corrida; host sem
   propriedade é encerrado e relatado (FR-004, FR-004a).
4. A soma de um host só é o próprio host — o caminho sem migração é o caminho comum, não um caso
   especial.
