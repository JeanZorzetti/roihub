# Handoff — os seis repos "sem site" viraram site

Criado e **executado em 2026-07-29**, a partir da decisão do Jean no
[`handoff-compass-e-repos-sem-site.md`](handoff-compass-e-repos-sem-site.md).
Índice: [`../handoff.md`](../handoff.md).

**Estado: 6 de 6 no ar.** O handoff anterior tinha classificado estes repos como "não é site — deixar
`homepage` vazia de propósito". O Jean reverteu: **todos viram site.** Feito.

| repo | URL | signature do hero |
|---|---|---|
| `sem-swarm` | https://sem-swarm.vercel.app | a memória epistêmica enchendo: `raw → pendente → verificado` |
| `claude-loop-runner` | https://claude-loop-runner.vercel.app | as mesmas 12 tarefas em sessão única (contexto estoura) vs. em loop (contexto plano) |
| `seo-forecaster` | https://seo-forecaster-pi.vercel.app | candidato em breakout: observado à esquerda do "hoje", projeção do Chronos à direita |
| `whatsmeow-gateway` | https://whatsmeow-gateway.vercel.app | rack de instâncias; a nova percorre `qr → conectando → sincronizando → online` |
| `housing-pro-api` | https://housing-pro-api.vercel.app | a pergunta é digitada e os resultados chegam **sem repetir nenhuma palavra dela** |
| `moderador` | https://moderador.vercel.app | 24 h de tráfego do grupo, com o resumo caindo nos 4 horários do cron |

Repos com `homepage`: **29 → 35**. Sem `homepage`: **20 → 14**.

---

## As decisões que valem para o próximo site

**1. Uma página, um arquivo, zero build.** Cada repo ganhou só `site/index.html` — CSS e JS inline,
nenhuma dependência, nenhum passo de build. O deploy é `vercel --prod` de dentro de `site/`, que a
Vercel serve como estático. Um Astro aqui só somaria tooling para uma página.

**2. O hero é a ferramenta rodando, não uma frase sobre ela.** Foi a regra que gerou os seis
diferentes: em vez de um número grande com gradiente, cada página anima a **saída real** do próprio
projeto. É o que impede seis páginas do mesmo template de parecerem seis páginas do mesmo template.
O roteiro é fixo e escrito à mão — não é dado ao vivo, e as páginas dizem isso.

**3. Identidade de família, alma por projeto.** Todas partilham o mesmo esqueleto (fundo
`#E4E7E6` frio, tinta `#12171A`, monoespaçada como display, barra de status no topo que é o painel do
próprio projeto) e **cada uma tem sua cor de sinal**: pinho `#1F6F5C`, ferrugem `#B0442A`, índigo
`#3A4FA0`, violeta `#6B3FA0`, ocre `#A8761F`, granada `#8C1D45`. Trocar a variável `--signal` é
trocar a identidade da página inteira.

**4. Numeração só onde é sequência de verdade.** Os passos de uma iteração do runner e os estágios do
pipeline do forecaster são numerados porque a ordem é informação (cada um depende do anterior). A
lista de stack e a de armadilhas não são.

**5. Conteúdo veio do repo, não de invenção.** Números, rotas, nomes de módulo e armadilhas saíram do
README, do `.env.example` e do código. As armadilhas documentadas nas páginas — Reddit 403 em IP de
datacenter, GDELT `gkg_partitioned`, LID→PN, extensão `vector` esquecida — são as mesmas que já
custaram tempo aqui.

## Gotchas da execução

- **Clonar fora do OneDrive.** Os seis foram para `C:\dev\<repo>`; `vercel --prod` de dentro do
  OneDrive falha com `UNKNOWN: unknown error, read`.
- **`vercel link --yes --project <nome>`** antes do deploy, senão o projeto nasce com o nome da pasta
  (`site`) e todos colidiriam.
- **A URL de produção nem sempre é `<projeto>.vercel.app`.** O `seo-forecaster` saiu como
  `seo-forecaster-pi.vercel.app` (sufixo de desambiguação da Vercel). **Ler a URL do
  `vercel project ls`, não montar na mão** — foi por isso que a `homepage` de cada um só foi gravada
  depois de um `curl` devolver 200.
- **Escala em raiz no gráfico do forecaster.** Numa escala linear com máximo em 162, a fase inicial
  (3 → 44 menções) — que é justamente o que o detector de breakout enxerga — virava uma reta no chão.
- **Marcas de hora posicionadas por fração da hora** (`(h+.5)/24`) no `moderador`; com `flex:1` em 4
  colunas iguais, "08:00" e "14:00" colidiam e nenhuma ficava sobre a própria barra.

## O que sobrou

- **Domínio próprio.** Os seis estão em `*.vercel.app`. Quando quiser subdomínio de `roilabs.com.br`,
  é anexar na Vercel + registro DNS, **e trocar a `homepage` do repo** — a chave do projeto no hub é
  a URL, então trocar o domínio sem trocar a `homepage` cria um projeto duplicado no ranking.
- **Sem `sitemap.xml`, `robots.txt` nem `llms.txt`.** São páginas de ferramenta interna; nenhuma
  entrou em estratégia de conteúdo. Se alguma virar aposta de SEO, aí sim vale o pacote do
  [[geo_aeo_playbook]].
- **Sem dark mode**, por decisão: a estética é "instrumento sobre papel" e um tema escuro seria uma
  segunda identidade para manter em seis lugares.
