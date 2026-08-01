# Handoff — a camada `estado` dobrou (8 → 15) e o custo era LIGAR, não construir (01/08/2026)

> Para a próxima sessão. Sessão anterior:
> [`handoff-proximo-passo-dobrar-a-camada-estado.md`](handoff-proximo-passo-dobrar-a-camada-estado.md)
> (o plano que esta executou). Índice: [`../handoff.md`](../handoff.md).

`npm test` **269 verdes** (era 258) · `npx tsc --noEmit` limpo · `npm run validade` limpo ·
`data/dourado.json` com **85 perguntas**, 15 de camada `estado`.

---

## 1. O que ficou de pé

As sete fontes que já rodavam e não estavam ligadas agora são fato apurado na hora da medição:

| id | o fato | custo (`rede`) |
|---|---|---|
| `D-79` | quantos documentos vivos afirmam presente com número sem data | offline |
| `D-80` | quantos repos têm SDK de pagamento **escrito** | **caro** (GitHub) |
| `D-81` | o CRUZAMENTO: dos com SDK escrito, quantos de fato cobram | **caro** (GitHub + produção) |
| `D-82` | quantos sites servem caminho de cobrança, e em que balde | **caro** (produção) |
| `D-83` | quantos projetos violam os 10 protocolos que rodam | **caro** (produção) |
| `D-84` | as homes estão no índice do Google | gsc |
| `D-85` | crawl requests / OK% por propriedade, e de quando é o dado | offline |

O trabalho real não foi escrever apurador: foi **mover a lógica de script top-level para `lib/`**
(`gateways-repo.mjs`, `gateways-servido.mjs`, `indexacao.mjs`, `crawl-exports.mjs`). Script que só
imprime não se importa de lugar nenhum — e a aba `/infra` agora lê o MESMO `acharExports` que o
`D-85`, para as duas não divergirem sobre qual export é o mais novo.

## 2. 🚩 Fonte cara ganhou MODO PRÓPRIO, e isso é o que impede a régua de ficar cara

`apurarEstado` tem **três níveis**: `offline` < `tudo` (GitHub/GSC) < `caro`. O
`corpus-defasado.mjs` e o `avaliar-resposta.mjs` chamam com `tudo` — se o inventário de gateways
entrasse nesse nível, **toda corrida de régua dispararia ~250 requisições contra produção**, que é
exatamente o motivo pelo qual o conformidade está fora do `npm test`. Para incluí-los:

```
node --env-file=.env scripts/dourado-estado.mjs --estado caro
node --env-file=.env scripts/corpus-defasado.mjs --estado caro --ids D-80,D-81,D-82,D-83
```

As perguntas que leem a mesma varredura **compartilham um cache por execução** (`memo` no ctx):
`D-80` e `D-81` leem UMA varredura do GitHub, `D-81` e `D-82` leem UMA varredura HTTP. Há teste
que conta as árvores pedidas — sem ele o custo declarado em `rede` seria mentira.

## 3. 🚩 A 1ª corrida mediu o CHECK — duas vezes, e as duas valem para o próximo

- **`D-85` listou 34 "hosts com problema" e NENHUM era problema de agora.** Grep por `problem` casa
  os três estados que o GSC emite (`No problems`, `Problemas no passado`, `Alguns problemas`) e o
  CSV vem localizado. Agora `classificarStatusHost` separa os três, e "problemas no passado" sai
  contado à parte — é histórico da janela de 90 dias, não falha de hoje.
- **`D-81` decompunha 10 com SDK em subgrupos que somavam 9:** o balde `ligado` (o `atma`) sumia do
  texto. Leitor nenhum acha o que a apuração não nomeia. O teste agora **soma os subgrupos**.

## 4. As âncoras da 2ª via foram MEDIDAS antes de escrever (4 de 6 entraram)

Contra o corpus inteiro (298 documentos), com a largura em documentos:

| âncora | largura | veredito |
|---|---|---|
| `(\d+) com SDK … escrito` (`D-80`) | 5 | entrou |
| `(\d+) servem preço` (`D-81`) | 2 | entrou |
| `(\d+) sem caminho de cobrança` (`D-82`) | 2 | entrou |
| `(\d+) protocolos × N projetos` (`D-83`) | 3 | entrou |
| `(\d+) protocolos?` solto | **13** | ❌ homônimo (97 escritos, 85 tipados, 29 candidatos) |
| `(\d+) com gateway ligado` | 2 | ❌ casa o **denominador** ("1 de 35 com gateway LIGADO") |

`D-79`, `D-84` e `D-85` ficaram **sem âncora de propósito**: nenhum é quantidade que a casa cite em
prosa, e "10 propriedades GSC" NÃO é o mesmo fato que "10 propriedades com export no repo" —
casar os dois seria fabricar acusação em cima de sinônimo.

**A 2ª via trouxe ZERO documentos novos nesta corrida, e não é falha:** os dois candidatos (`30 sem
caminho de cobrança`) já tinham vindo pela busca. Ela só paga quando o TEMA do documento esconde o
número.

## 5. O que a corrida achou: 4 `desmente`, 3 reais e 1 falso positivo

Lidos um a um, como manda o `VER-08`:

- **3 reais, e os três na MESMA memória viva** (`roihub_portfolio_nao_cobra`), já corrigida:
  a tabela do topo guardava a 2ª corrida (3 só-preço, 30 sem-gateway) enquanto o fim do documento
  já registrava a 3ª (6 e 27) — **o documento se contradizia internamente** — e dizia "UM faturou"
  onde a régua da casa diz **ligado ≠ faturou**: os 20 `approved` do atma são teste.
- **1 falso positivo:** `handoff-crawl-stats-semanal.md` ("9 exports, todos de 2026-07-10"). É
  handoff DATADO e **não se reescreve** — é o único lugar onde se vê o que se sabia na hora.

**Nenhum percentual saiu daqui** (os dois portões do detector continuam reprovando: 83,3% e 14/20).
Fato novo aumenta a bancada; ele não move portão.

## 6. O que ISTO mudou nos números das outras réguas (leia antes de comparar corridas)

- **O dourado foi de 78 para 85 perguntas.** O recall da busca (`avaliar.mjs`) tem denominador
  novo: **não compare os 88,0% de ontem com o número de amanhã** — piso relativo, sempre
  (`--min bm25`).
- **`avaliar-resposta.mjs` no default deixa 4 de fora** (as `caro` saem como `nao_apurado`), e o
  relatório imprime quantas entraram e quantas saíram. Com `--estado caro` entram as 15.

## 7. O próximo passo

- **Os itens 1, 2 e 4 da ordem vigente continuam abertos e NÃO são tarefa de agente**: invalidar o
  token antigo do MP e exigir 401; destravar `31.97.23.166:5434`; as 4 chaves da Stripe do
  `context`. Contornar qualquer um deles é o defeito, não o atalho.
- **Para 20 fatos faltam ~5, e esses exigem fonte nova** — não há mais script pronto para ligar.
- **O alvo de `desmente` agora tem bancada:** com 15 fatos, refazer a calibração do detector
  (`defasagem-calibrar.mjs`) passa a ter material que não existia. **Não** é uma quarta redação de
  regra nem uma segunda decomposição — as duas já reprovaram medidas.
- `D-83` acusou **GEO-01 em 28 de 35** e `DEP-08` em 11. Números do check que já rodava; ler as
  linhas antes de abrir frente.
- ⏰ **Não dar push entre 00:00 e 01:00 BRT** — o cron do autopublishing dispara 00:13.
