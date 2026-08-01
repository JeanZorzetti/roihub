# Handoff — a 2ª via de seleção está no ar, e a 1ª corrida dela não fabricou nada (01/08/2026)

> Executa o **passo 3** da seção 5 de [`handoff-o-teste-de-20-minutos-deu-vermelho.md`](handoff-o-teste-de-20-minutos-deu-vermelho.md):
> *"2ª via de seleção no `corpus-defasado.mjs` — é barato, é nomeado, e é o único caminho da frente
> do detector que não exige dobrar a camada `estado`."*
>
> Os passos **1 (token do MP), 2 (porta 5434) e 4 (chaves da Stripe) continuam parados em você** —
> os três são credencial de painel ou infra de VPS, e nenhum foi contornado.

`npm test` **258 verdes** (eram 254) · `npx tsc --noEmit` limpo · `npm run validade` limpo.

---

## 1. O que mudou

A busca da aba recupera por **semelhança de TEMA**. Número defasado citado de passagem num
documento sobre outro assunto nunca chegava ao detector — foi assim que a memória
`project_cannibalscan` afirmou `Hub: 39 projetos` por semanas sem que o `corpus-defasado.mjs`
emitisse o achado uma única vez.

Agora o script tem **duas vias de seleção**:

| via | como escolhe | custo |
|---|---|---|
| 1ª (existia) | BM25 + vetor + reranker, top-10 por pergunta | 1 chamada por doc |
| **2ª (nova)** | **grep ancorado no fato: quem CITA a quantidade com outro número** | **zero LLM na seleção**; 1 chamada por doc novo |

- `docsQueCitam()` em [`lib/defasagem.mjs`](../lib/defasagem.mjs) — zero LLM, zero rede, grep sobre
  o corpus que a busca já carregou.
- As âncoras são `CITACOES_D66` em [`lib/dourado-estado.mjs`](../lib/dourado-estado.mjs), declaradas
  ao lado de onde o número é apurado.
- Documento já trazido pela busca **não é julgado duas vezes**.

## 2. As três decisões que valem mais que o código

### 🚩 A âncora é ESTREITA, e a largura foi MEDIDA antes de escrever

`(\d+) projetos` solto seleciona **43 documentos** do corpus. Quase todos são **quantidade
homônima** — "10 projetos" é o autopublishing, "21 projetos" são os apagados da Vercel, "19 no ar"
é outra conta. Cada um custaria **uma chamada do pool para o modelo responder `nao-fala`**, quase
dobrando a corrida.

Com as duas âncoras de D-66: **6 documentos**. É o mesmo conjunto que a mineração de hoje encontrou
lendo os candidatos um a um.

> **Âncora nova só entra depois de medida contra o corpus.** Sem isso ela não acha mais defasagem —
> ela compra homônimo com pool.

### 🚩 O PERCENTUAL SAI SÓ DA BUSCA

A 2ª via **só seleciona documento cujo número já diverge do apurado**. É amostra **procurada**, não
recuperada. Somá-la ao denominador publicaria uma "taxa de erro do corpus" que **sobe sozinha toda
vez que a âncora melhora** — o número passaria a medir a consulta, não o corpus.

O campo `via` separa as duas em toda a saída e no JSON gravado. A **lista nominal junta**, porque lá
cada linha é uma edição de memória ou handoff e a origem do documento não muda o trabalho que ele dá.

### Bloco cercado é literal, e o conserto foi na função COMPARTILHADA

`validade.mjs` mascarava crase e **não** mascarava ` ``` `. Saída de script colada num bloco traz
número de sobra e não afirma nada — foi um dos 5 defeitos do check da mineração de hoje. `semLiteral`
virou exportada, passou a rodar no **texto inteiro antes de quebrar em linhas** (bloco cercado
atravessa linha; mascarar linha a linha nunca o veria) e **preserva os `\n`**, senão o achado
seguinte apontaria a linha errada. A 2ª via usa a MESMA função.

## 3. A 1ª corrida — `D-66`, 16 chamadas

Rodada só contra `D-66` de propósito: é o único fato com âncora, e as outras 5 perguntas só
remediriam o detector congelado por ~50 chamadas.

```
13 documentos julgados (10 pela busca, 3 pela 2ª via)
falam do assunto          4   (só os da busca)
DESMENTEM a fonte viva    1   25.0% dos que falam
2ª via (citação)          3   0 desmentem — FORA do percentual
```

**Os 3 da 2ª via voltaram `nao-fala`, e os 3 estão CERTOS** — lidos um a um, como manda a norma:

| documento | cita | por que não é achado |
|---|---|---|
| `handoff-dns-e-paineis.md` | 47 repos ativos | handoff datado de 29/07 |
| `handoff-quatro-sites.md` | 41 repos ativos | handoff datado de 29/07 |
| `project_roihub` (memória VIVA) | 41 repos ativos | mora dentro do bullet **`★ Estado 30/07`** |

O terceiro é o que importa: **memória viva não é absolvida por ser memória, é absolvida pela data
grudada no span** — exatamente a regra do `validade.mjs` (*"a absolvição é avaliada DENTRO do trecho
casado, nunca na linha"*). Se aquele bullet perder o `Estado 30/07`, ele vira achado no dia seguinte.

> **Décima vez que a 1ª corrida de um check novo mede o CHECK — e desta vez ele passou:** 3
> seleções, 3 absolvições corretas, **zero acusação fabricada**. O lado caro é o falso `desmente`,
> e ele ficou em zero.

O único `desmente` do dia saiu pela **1ª via** (`handoff-proximo-passo-02-08.md`: *"40 repos ativos,
39 projetos"*) e **não se conserta** — handoff datado não se reescreve.

## 4. O que NÃO foi feito, e por quê

- **A corrida completa das 6 perguntas.** As outras 5 não têm âncora, então a 2ª via não acrescenta
  documento nenhum a elas: seriam ~50 chamadas remedindo o detector que o handoff anterior
  **congelou**. A frente segue congelada — nada aqui move portão.
- **Âncora para `D-68`/`D-69`.** Nos gates o **ALVO** ("≥ 5 cliques não-branded") é curadoria
  correta para sempre e casaria como se fosse o valor de hoje. Foi um dos 5 defeitos do check de
  hoje; repeti-lo em produção compraria falso positivo com pool.
- **Uma quarta redação de regra ou uma segunda decomposição.** Continuam proibidas: as três já
  foram medidas e as três perderam.

## 5. A ordem daqui pra frente (inalterada, menos o item 3)

1. **🚨 Invalidar o token antigo do MP e exigir 401.** Aberto há 2 dias; é a única coisa da lista
   que pode custar dinheiro enquanto não é feita.
2. **Destravar `31.97.23.166:5434`** e conferir OU MATAR as 3 vendas do `sirius`.
3. ~~2ª via de seleção~~ ✅ **feita** — e o que ela ensina é que **o corpus vivo está limpo em
   `D-66` hoje**, não que a via seja inútil: ela é a única que alcança a classe de defeito do
   `project_cannibalscan`, e roda de graça em toda corrida daqui pra frente.
4. **As chaves da Stripe do `context`**, e aí o checkout de ponta a ponta.
5. **Dobrar a camada `estado` para ~20 fatos apuráveis** — só isto destrava o critério `1.8`, e cada
   fato novo **também ganha uma âncora**, o que agora vale o dobro.

## 6. Armadilhas desta sessão

- **Medir a largura da âncora ANTES de escrevê-la custou um comando e economizou ~37 chamadas.**
  43 → 6 documentos. Check que seleciona demais não acha mais; gasta mais.
- **Amostra procurada não entra em percentual.** É a mesma classe do `n/a` que não é aprovação: o
  número teria subido sozinho a cada melhora da âncora, com cara de corpus piorando.
- **Absolvição correta com motivo errado ainda é absolvição correta — mas anote.** O detector
  absolveu `project_roihub` dizendo *"trata do robô de crawl"* (TEMA), quando o certo é *"o número
  está num bullet datado"*. É o mesmo modo de falha `→ nao-fala` que os dois portões já nomeiam;
  aqui ele caiu no lado seguro.
