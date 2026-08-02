# `/busca` — instruções de uso e casos práticos

> `https://hub.roilabs.com.br/busca` (protegida por Basic Auth). Os exemplos abaixo foram
> **executados contra o índice real em 01/08/2026** — não são hipotéticos.

## O básico

1. Abra a aba **Busca** no hub.
2. Escreva a pergunta **em português, como você faria a um colega**. Não é campo de palavra-chave.
3. Aperte Buscar. Em ~12 s vem uma **resposta de até 5 frases** e a lista dos 10 documentos.
4. Toda frase da resposta termina com `[1]`, `[3]`… — **esse número é o card logo abaixo**. Clique
   com os olhos e confira.

A URL fica compartilhável: `?q=sua+pergunta` cola no Slack e abre igual para quem receber.

## Como perguntar (e como não)

| ✅ funciona | ❌ desperdiça |
|---|---|
| `por que o sitemap em 200 não prova indexação?` | `sitemap` |
| `posso confiar no curl -k para testar certificado?` | `curl` |
| `o que quebra o build do Next com output standalone?` | `erro build` |

**Pergunta inteira é melhor que palavra solta.** A camada semântica precisa de contexto para
entender o que você quer, e a camada literal aproveita todos os termos raros que a frase carrega.

**Se não vier nada:** a busca por palavra literal casa termo exato. Tente o **slug, o código de erro
ou o nome do projeto** — `NXDOMAIN`, `standalone`, `orcaobra`, `GEO-01`.

## Os controles do rodapé

| link/parâmetro | quando usar |
|---|---|
| **só a lista** (link) | você quer velocidade: ~0,3 s em vez de ~12 s, sem IA nenhuma |
| `?rerank=0` | desliga só a reordenação |
| `?resposta=0` | desliga só a resposta sintetizada |

O rodapé também diz **qual motor rodou** (`BM25`, `BM25 + vetor`, `+ rerank`) e, se algo caiu, **por
quê**. Rodapé dizendo só `BM25` com um ⚠️ ao lado significa que a camada semântica está fora — vale
avisar, a busca está pior nesse momento.

## Como ler o que aparece

**Resposta com citação** → use, conferindo o card citado.

**Só a lista, sem resposta e sem aviso** → a IA achou que nenhum dos 10 responde. Isso é o sistema
funcionando: ela foi instruída a escrever `NÃO ESTÁ NO CORPUS` em vez de inventar.

**Só a lista, com ⚠️ no rodapé** → a resposta existiu e foi **suprimida**, por falta de citação ou
falha técnica. A lista continua válida.

**Etiqueta de cada card:**

| etiqueta | o que é | confiabilidade |
|---|---|---|
| `protocolo` | regra vigente da casa | alta — revogado não entra no índice |
| `handoff` | diário de uma sessão, **datado** | é o que se sabia **naquele dia** |
| `memoria` | lição avulsa | vive fora do repo, precisa de reindexação |

⚠️ **Handoff é registro histórico e não se reescreve.** Se um handoff de julho diz um número que
hoje é outro, ele não está "errado" — ele registra o que se sabia quando a decisão foi tomada. Olhe
a data no card antes de tratar o número como atual.

---

## Casos de uso

### 1. Antes de debugar — "isso já aconteceu antes?"

> **`o deploy da vercel nao publica depois do push`**
>
> 1. `[protocolo]` Projeto da Vercel sem conexão com o git: push não publica e não avisa
> 2. `[protocolo]` Root Directory `/` com site em subpasta: o push derruba o host para 404
> 3. `[memoria]` Projeto Vercel com Root Directory = `/` mas site em subpasta

**O ganho:** três causas já diagnosticadas antes de abrir um log. É o uso de maior retorno — a
alternativa é redescobrir por conta própria o que já custou horas uma vez.

### 2. Antes de confiar em uma medição — "essa régua vale?"

> **`lighthouse local no windows e confiavel`**
>
> 1. `[memoria]` Medir Lighthouse/Web Vitals local nesta máquina (Windows+OneDrive) dá valor ruim
> 2. `[protocolo]` Uma run de medição de performance não decide nada
> 3. `[memoria]` Como o LCP do goiânia caiu de 5,9s para 2,5s — e as 4 armadilhas

**O ganho:** evita a conclusão errada com cara de dado. Vale rodar **antes** de publicar qualquer
número, não depois.

### 3. Antes de escrever código — "qual é a norma?"

> **`o que quebra o build do Next com output standalone`**
>
> 1. `[memoria]` Não adicionar pino em app Next com `output: standalone` — thread-stream/worker
> 2. `[protocolo]` Não adicionar pino em app Next com output standalone

**O ganho:** a regra vem com o **motivo medido** junto, não só a proibição. Protocolo e memória
concordando é o sinal mais forte que o índice dá.

### 4. Antes de afirmar um número — "qual é o estado hoje?"

> **`quais projetos tem gateway de pagamento ligado`**
>
> 1. `[memoria]` Inventário de cobrança dos 35 projetos por DUAS vias (HTML servido × código)
> 2. `[handoff]` handoff-a-camada-estado-dobrou.md
> 3. `[handoff]` handoff-o-cruzamento-achou-o-check-errado.md

⚠️ **Aqui é onde mais se erra.** A busca devolve o que estava escrito, e número escrito envelhece.
Use o resultado para achar **qual script apura o número** e rode o script. Para perguntas de estado
existe apuração ao vivo (`scripts/dourado-estado.mjs`), com zero LLM.

### 5. Onboarding — "por que isso é assim?"

> **`como rotacionar o pool de tokens do claude-cli`**
>
> 1. `[memoria]` Quem faz spawn do claude-cli tem que percorrer o pool inteiro — e só `api_error_status` separa
> 2. `[memoria]` claude-cli (assinatura) é a ÚNICA opção interna
> 3. `[memoria]` Sem orçamento para API LLM paga

**O ganho:** a decisão vem com o **incidente que a causou**. Quem chega entende por que o código é
daquele jeito e para de propor a "simplificação" que já foi tentada e reprovou.

### 6. Revisão de checklist — "o que eu ia esquecer?"

> **`posso confiar no curl -k para testar certificado`**
>
> 1. `[memoria]` Vercel não re-emite certificado sozinha depois que o DNS ficou NXDOMAIN
> 2. `[memoria]` `curl -k` desliga a validação que está quebrada — 200 no terminal, erro no browser
> 3. `[protocolo]` Host promovido para domínio próprio exige nuvem cinza e cobre um label só

**O ganho:** perguntar sobre o comando que você **ia** usar frequentemente devolve a armadilha dele.

---

## Rotina de quem escreve no corpus

Documento novo **não entra na busca sozinho**:

```
node --env-file=.env scripts/indexar.mjs
```

Rode depois de escrever handoff ou memória. Sem isso o documento existe no disco e **não existe na
aba, em silêncio** — as memórias moram em `~/.claude`, fora do repo, e o container lê do banco.

## Limites — leia antes de agir com base numa resposta

1. **A busca mede recuperação, não verdade.** Ela acha o documento certo em 88% das perguntas; se
   esse documento estiver desatualizado, a resposta sai desatualizada com a mesma fluência.
2. **Em 1 de cada 8 buscas o documento certo não está nos 10.** Resposta ausente ou fraca não
   significa que a casa não sabe — tente outros termos.
3. **A citação é o produto.** Uma resposta sem `[n]` nunca chega à tela; uma com `[n]` que você não
   conferiu vale tanto quanto uma frase de corredor.
4. **São 2 chamadas de IA por busca**, do mesmo pool do autopublishing. Para varrer muita coisa, use
   o link **só a lista**.
