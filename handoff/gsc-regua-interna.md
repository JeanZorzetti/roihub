# Régua interna — o terceiro veredito, ainda não ativo

**Escrito em 19/09/2026. NÃO IMPLEMENTADO — ativação condicionada, ver §3.**
Decisão do dono na mesma data: `A agora, B depois`. Este arquivo é o `B`.
Complementa `handoff/gsc-balizador-estudo.md` (que produziu o `A`) e obedece a `handoff/okr-regua-de-mercado.md`.

---

## 1. O problema que isto resolve

O estudo de 19/09/2026 levantou fonte para as 26 folhas do board de GSC. Resultado: **4 linhas, 21 recusas, 1 procedimento.**

As 21 recusas não são iguais. Elas se dividem em duas naturezas, e só uma tem conserto:

| Natureza | Exemplos | Conserto |
|---|---|---|
| **Não existe régua no mundo** | penetração no Top 3, active index ratio, consultas por página, catálogo no Top 20 | Nenhum estudo publica, porque o denominador é definido por quem mede. Ninguém nunca vai publicar. |
| **Não existe medição nossa** | referring domains, profundidade de clique, rejeição de rastreio, TAM | Falta coletor. Conserto é ligar a fonte, não procurar estudo. |

A primeira natureza é a maioria, e é onde este documento age.

O insight é simples: **o denominador ser definido por quem mede deixa de ser defeito quando quem mede é sempre o mesmo.** "40% do inventário no Top 3" é incomparável entre empresas porque cada uma monta o inventário do seu jeito. Entre os 35 projetos do roihub, o inventário é montado pelo **mesmo processo**, com a mesma definição, pela mesma pessoa. O denominador vira comum.

Não vira benchmark de mercado. Vira comparação com você mesmo — e isso responde uma pergunta legítima que a §7 e a régua de mercado não respondem: *"esse número é ruim, ou é assim para todos os meus projetos?"*

## 2. O que é, e o que não é

```
  régua de mercado ...... "a mediana do vertical é 3,6%"     → lib/benchmark.mjs
  régua interna ......... "a mediana dos seus projetos é X"  → este documento
```

A diferença não é de grau, é de categoria. E o risco é que ela seja lida como se fosse a primeira.

**Nunca**, em nenhuma superfície, a régua interna aparece com a palavra `mercado`, `benchmark` ou `padrão`. O rótulo é **`seus projetos (n=N)`**, e o `n` aparece sempre, colado no número. Um percentil sem `n` é a porta de entrada para alguém tratar 3 observações como lei.

Ela também **não** herda autoridade externa. Se os 35 projetos forem todos ruins no mesmo KPI, a mediana interna vai parecer saudável e não é. A régua interna mede **dispersão**, não qualidade. Isso precisa estar escrito na tela, não só aqui.

## 3. Condição de ativação — o gatilho

A régua interna só passa a existir para um KPI quando **pelo menos 10 projetos** têm aquele KPI apurado na mesma janela.

O 10 é arbitrário e está aqui para ser contestado, não obedecido: é o menor `n` em que uma mediana deixa de ser anedota e um quartil deixa de ser um único projeto. Se o dono quiser 8 ou 12, o número muda aqui e no código, nunca só no código.

Abaixo de 10, o KPI continua em `sem régua`. Nunca em "régua provisória" — a régua fraca rotulada como régua é pior que a ausência, porque a ausência não produz decisão.

**Em 19/09/2026 a condição está longe:** conforme `lib/okr.mjs`, em 01/09/2026 apenas a `atma` tinha cadeia apurada no portfólio inteiro, e 34 dos 35 projetos não sabiam responder quanto vale um cliente a mais. Com `n=1`, a mediana é o próprio projeto, comparado consigo mesmo.

### Onde o gatilho mora

**Não aqui.** Este arquivo é o porquê; ele não avisa ninguém.

O gatilho fica no rodapé da seção `sem régua` de `/gsc/[slug]`, como contador visível:

> `régua interna: 2 de 35 projetos com este KPI apurado — ativa em 10`

Motivo: a tela é aberta toda semana, este arquivo não. Um TODO que mora fora do caminho apodrece; um contador embaixo das linhas que incomodam não tem como ser esquecido. O contador é por KPI, não global — `activeIndexRatio` pode cruzar o limiar meses antes de `queryToPageRatio`.

## 4. As travas

Herdadas de `handoff/okr-regua-de-mercado.md`, com uma a mais que só a régua interna precisa.

1. **Um KPI por vez. Nunca compor dois.** Idêntica à trava 1 da régua de mercado, pelo mesmo motivo: compor é como nasceu a barra de erro de 56×. Régua interna não é exceção; se algo, é mais tentadora, porque os dados são todos nossos e parecem mais confiáveis do que são.
2. **Só entra projeto com o KPI apurado.** `não apurado` não conta para o `n` e não entra no cálculo. Tratar ausência como zero rebaixaria a mediana e faria todo mundo parecer bom.
3. **Faixa, nunca ponto.** Sai como `p25…p75` do portfólio, jamais só a mediana. Mesmo motivo da trava 3 original: ponto único dá autoridade falsa.
4. **`n` sempre visível, colado ao número.** Sem `n`, um quartil de 10 projetos é indistinguível de um quartil de 10.000.
5. **Nunca vira meta.** Sai como posição (`no quartil inferior dos seus projetos`), nunca como alvo (`atingir a mediana`). Idêntica à trava 5, e vale ainda mais aqui: bater a própria mediana é uma meta que o portfólio inteiro pode cumprir enquanto afunda junto.
6. **Trava nova — rótulo de origem obrigatório.** Toda saída carrega `seus projetos (n=N)`. Nenhuma superfície pode exibir régua interna e régua de mercado com a mesma tipografia, na mesma coluna, sem distinção. São epistemologias diferentes e a tela precisa dizer qual está falando.

A trava 1 e a trava 6 são as que o código não impede sozinho — quem as violar escreve código que compila. Pelo precedente de `test/benchmark.test.mjs`, ambas nascem como teste no dia da implementação, não como comentário.

## 5. KPIs candidatos

Das 21 recusas, estes viram régua interna quando o `n` permitir — todos são do tipo "denominador definido por quem mede", que é exatamente o que um portfólio comum resolve:

- penetração no Top 3 (item 2)
- impressões concentradas no Top 3 (item 6)
- conformidade com o benchmark de CTR (item 7b)
- palavras-chave no Top 20 (item 23)
- consultas por página / query-to-page (item 24)
- active index ratio (item 25)

Estes **não** viram, e é importante dizer por quê agora, para ninguém tentar depois:

- **crescimento de impressões, consultas únicas** (itens 4 e 22) — função da base, não do portfólio. Projeto novo e projeto maduro crescem em ritmos incomparáveis mesmo sendo da mesma casa. Régua interna não conserta isso.
- **cobertura de Schema, canibalização, alinhamento de intenção** (itens 8, 18, 10) — normas binárias. Não existe `p25…p75` de "válido ou inválido".
- **referring domains, profundidade de clique, rejeição de rastreio, TAM** (itens 20, 15, 14, 26) — falta coletor, não falta régua. Ligar a fonte primeiro; a régua é discussão posterior.
- **reescrita de título** (item 9b) — tem régua de mercado real e melhor (Zyppy, 61,6%). Substituir fonte externa sólida por mediana interna seria trocar para baixo.

## 6. Dívida

A régua interna aumenta a tentação de tratar dado próprio como mais confiável do que é, por ser próprio. Ele não é: é a mesma medição, com a mesma barra de erro, apenas mais familiar. Esta frase existe para ser lida no dia da implementação.
