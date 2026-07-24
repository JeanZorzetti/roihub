# Publicação automática de artigos dos projetos ROI Labs

Data: 2026-07-24
Status: aprovado

## Resumo

O ROI Hub passa a orquestrar a geração e a publicação diária de conteúdo para os
dez projetos monitorados em `/seo`. A meta é uma ação editorial por projeto por
dia, normalmente um artigo novo, mas o sistema atualiza uma URL existente ou
bloqueia a execução quando uma nova publicação causaria canibalização ou falharia
nos gates factuais, técnicos ou de segurança.

O desenho reutiliza o Google Search Console, o Postgres e os pipelines de deploy
existentes. O publicador cria commits nos repositórios de cada projeto por meio da
API do GitHub. Não haverá CMS novo, fila externa nem banco adicional.

## Objetivos

- Executar uma ação editorial diária para cada um dos dez projetos às 08:00 BRT.
- Escolher pautas a partir de queries/páginas do GSC e do inventário publicado.
- Gerar e publicar sem aprovação humana.
- Evitar canibalização por meio da regra `1 intenção → 1 URL canônica`.
- Preservar o idioma, a voz, os clusters, o CTA e o formato de cada projeto.
- Usar foto gratuita como primeira opção e imagem gerada como fallback.
- Registrar custo, decisão, commit, URL, deploy e falhas no ROI Hub.
- Bloquear ou reverter conteúdo que não passe nas validações.

## Não objetivos

- Criar um CMS ou editor de artigos.
- Migrar os blogs para um formato comum.
- Substituir os pipelines de deploy existentes.
- Produzir orientação médica, jurídica ou financeira sem autoria especialista
  real e verificável.
- Garantir dez URLs novas por dia quando não houver dez intenções inéditas e
  seguras.

## Portfólio e formatos atuais

| Projeto | Repositório/local | Formato atual | Idioma padrão |
|---|---|---|---|
| ROI Labs Goiânia | `ROI Labs/site-goiania` | páginas Astro | pt-BR |
| Sirius CRM | `CRM/crm-project` | objetos TypeScript com HTML | pt-BR |
| Estética Fábrica | `C:/dev/estetia-demo` | objetos TypeScript com HTML | pt-BR |
| ROI Labs institucional | `ROI Labs/site` | Markdown/Astro Content | pt-BR |
| Polaris IA | `Imob/sofia-next` | MDX | pt-BR |
| Estetia CRM | `Doc-CRM` | objetos TypeScript com HTML | pt-BR |
| ReviewShield | `review-dispute-agent` | MDX | en-US |
| Context Keeper | `context-keeper/apps/web` | MDX | en-US |
| AftercareGen | `aftercare` | MDX | en-US |
| Nimblabs | `nimblabs` | catálogo TypeScript | en-US |

O orquestrador terá apenas quatro renderizadores: Astro, Markdown/MDX, objeto
TypeScript e catálogo TypeScript. A configuração de projeto escolhe um desses
renderizadores e define repositório, branch, diretório, idioma, URL, clusters,
CTA, autoria permitida e limites YMYL.

## Arquitetura

### 1. Acionamento

Um endpoint protegido no ROI Hub processa um projeto por chamada. Um único
workflow agendado em `.github/workflows/seo-autopublish.yml` roda às 11:00 UTC
(08:00 BRT) e chama sequencialmente os dez slugs. Cada execução adquire uma trava
única por `project_slug + run_date`; uma repetição segura devolve o resultado já
registrado.

O endpoint exige `Authorization: Bearer CRON_SECRET`. A autenticação Basic do
Hub não substitui esse segredo.

Cada projeto usa duas chamadas curtas ao mesmo endpoint: `phase: "publish"` cria
o commit e devolve `publication_id`; após uma espera, `phase: "verify"` verifica
o deploy e faz rollback quando necessário. O workflow repete a verificação até
cinco vezes antes de declarar falha. Não há processo em background no Next.js.

### 2. Coleta

Para o projeto da vez, o orquestrador:

1. consulta no GSC as combinações de query e página dos últimos 28 dias e dos 28
   dias anteriores;
2. lê pelo GitHub o inventário editorial do diretório configurado;
3. extrai slug, título, palavra-chave principal, headings, cluster, data, links e
   canonical;
4. carrega as publicações recentes e bloqueios do Postgres.

O GSC continua usando `GOOGLE_SERVICE_ACCOUNT_JSON`. A integração será ampliada
sem alterar o comportamento atual de `/seo`.

### 3. Decisão editorial

Os candidatos são avaliados nesta ordem:

1. **Atualização:** query na posição 4–20, CTR fraco ou impressões crescentes
   cuja intenção já possui URL.
2. **Novo artigo:** query com impressões crescentes e sem URL dedicada.
3. **Lacuna de cluster:** quando o GSC ainda não tem volume suficiente, a IA
   identifica uma pergunta long-tail ausente dentro dos clusters existentes.
4. **Bloqueio:** intenção duplicada, risco YMYL, fontes insuficientes, projeto
   pausado ou ausência de pauta segura.

Uma query que aparece para duas ou mais URLs abre decisão de atualização ou
consolidação, nunca um terceiro artigo. Título, slug, pergunta central e headings
passam por comparação normalizada e por uma classificação semântica do modelo.
Não haverá banco vetorial.

### 4. Pesquisa e geração

O fluxo usa a Responses API da OpenAI:

- `gpt-5.6-terra`, `reasoning.effort: "medium"`, para equilibrar qualidade e
  custo;
- ferramenta `web_search` para pesquisa atual com fontes;
- Structured Outputs para produzir primeiro um plano factual e depois o artigo.

São duas chamadas:

1. **Pesquisador:** devolve intenção, outline, claims permitidos, fontes,
   internal links, riscos e decisão `new | update | block`.
2. **Redator/revisor:** devolve o documento estruturado no idioma e formato
   editorial do projeto, usando somente claims aprovados.

O prompt base é compartilhado. Voz, CTA, autoria, clusters e campos obrigatórios
ficam na configuração de cada projeto. Não haverá uma cadeia de agentes.

### 5. Imagem

O sistema busca primeiro uma foto horizontal na API do Unsplash, com filtro de
conteúdo alto. Ele preserva a URL retornada para hotlink, registra fotógrafo e
Unsplash, exibe a atribuição e dispara o endpoint de download exigido pela API.

Se não houver imagem semanticamente adequada, gera uma capa com a Image API:

- modelo `gpt-image-2`;
- `1536x1024`;
- qualidade `low`;
- WebP com compressão;
- sem texto, logo, interface falsa ou pessoa identificável.

Uma única imagem é gerada. Não há variações automáticas.

### 6. Renderização e publicação

O artigo validado é convertido pelo renderizador do projeto. O publicador usa a
API de conteúdo/commits do GitHub para:

1. confirmar que a branch ainda aponta para o SHA lido no início;
2. gravar o artigo e, quando gerada, a imagem;
3. criar um commit isolado por projeto;
4. registrar o SHA e a URL esperada.

Conflito de SHA encerra a execução como `blocked`; o sistema não sobrescreve uma
mudança humana. Os deploys já configurados nos repositórios publicam o commit.

### 7. Verificação e rollback

Após o deploy, o verificador exige:

- build/deploy bem-sucedido;
- URL com HTTP 200;
- canonical própria;
- página indexável;
- HTML textual em SSR/SSG;
- título, H1 e conteúdo esperados;
- JSON-LD válido e sem entidades inventadas;
- sitemap contendo a URL;
- links internos e fontes acessíveis.

Se a verificação pós-commit falhar, o sistema cria um commit de reversão usando o
SHA anterior e marca a execução como `reverted`. Nunca força push.

## Contrato editorial

Todo artigo novo deve conter:

- resposta BLUF de 40–60 palavras após o H1;
- headings que correspondam às perguntas reais da pauta;
- blocos que façam sentido isoladamente;
- links internos para o cluster e para a página de conversão do produto;
- metadata completa, alt text específico e CTA do projeto;
- `datePublished` e `dateModified`;
- fontes acessíveis para estatísticas, citações e afirmações temporais;
- exatamente um `@graph` na página final, ligando Article, autor e Organization
  por `@id`.

O sistema bloqueia:

- intenção duplicada ou possível canibalização;
- estatística, citação ou promessa sem fonte verificável;
- fonte inacessível;
- keyword stuffing;
- placeholder, `sameAs`, pessoa, credencial ou entidade inventada;
- FAQ no schema que não esteja visível na página;
- marca, idioma ou CTA incorretos;
- canonical, sitemap, robots ou HTML renderizado inválidos;
- afirmação médica, jurídica ou financeira sem autoria autorizada.

### Regra YMYL

AftercareGen fica restrito automaticamente a operação de clínicas, experiência
do paciente e software enquanto não existir um especialista real, verificado e
configurado. O sistema não publica diagnóstico, contraindicação, dosagem,
gravidez, complicações ou instrução clínica por autoria editorial genérica.

Os projetos de CRM e Estética Fábrica podem abordar operação e marketing de
clínicas, mas não aconselhamento clínico.

## Estado e dados

Uma tabela `seo_publications` no Postgres existente guarda:

- `id`;
- `project_slug`;
- `run_date`;
- `status` (`running`, `published`, `updated`, `blocked`, `failed`, `reverted`);
- `action` (`new`, `update`, `block`);
- `query`;
- `intent`;
- `target_url`;
- `repository`;
- `commit_sha`;
- `previous_sha`;
- `model`;
- `input_tokens`;
- `output_tokens`;
- `image_source`;
- `estimated_cost_usd`;
- `reason`;
- `metadata` (`jsonb` para fontes, atribuição e dados da imagem);
- `created_at`;
- `finished_at`.

Há índice único em `(project_slug, run_date)`. Uma tabela separada não é
necessária para fontes ou imagens; esses metadados ficam em JSON no próprio
registro.

Uma tabela `seo_projects` guarda apenas `project_slug`, `enabled`, `paused_reason`
e `updated_at`, permitindo pausa manual ou automática sem editar código. A linha
reservada `project_slug = '*'` funciona como kill switch global.

## Interface em `/seo`

A página mantém os gráficos existentes e acrescenta uma seção compacta de
publicações:

- projeto;
- última execução;
- ação e pauta;
- status;
- URL e commit;
- custo estimado;
- motivo de bloqueio/erro;
- controle de pausa por projeto;
- kill switch global.

Não haverá editor, preview ou fila de aprovação.

## Falhas, retries e pausas

- Falhas transitórias de GSC, OpenAI, Unsplash ou GitHub recebem até duas novas
  tentativas com atraso crescente.
- Validação editorial ou técnica falha uma vez e bloqueia, sem retry.
- Um projeto pausa automaticamente após duas janelas semanais consecutivas com
  queda igual ou superior a 20% em cliques ou impressões das URLs afetadas, ou
  problemas recorrentes de indexação nas URLs publicadas.
- Indexação é verificada após 14 dias por amostragem das URLs novas por meio da
  URL Inspection API; menos de 90% indexadas pausa o projeto.
- Ação manual do Google, PII, afirmação médica/jurídica falsa, marca errada, loop
  de duplicação ou conteúdo corrompido ativa o kill switch global e reverte o
  último lote afetado.

## Segurança

- `OPENAI_API_KEY`, `UNSPLASH_ACCESS_KEY`, `GITHUB_TOKEN` e `CRON_SECRET` ficam
  somente em variáveis de ambiente.
- O workflow guarda o mesmo segredo como `HUB_CRON_SECRET`; ele nunca aparece no
  arquivo YAML ou nos logs.
- Nenhum segredo, prompt completo ou conteúdo sensível entra nos logs.
- O token do GitHub terá permissão de conteúdo somente nos dez repositórios e
  não poderá administrar configurações, secrets ou usuários.
- `middleware.ts` trata somente a rota do cron por Bearer token e mantém Basic
  Auth em todas as demais páginas e APIs; a própria rota repete a validação do
  segredo com comparação de tempo constante.
- O endpoint valida slug contra a lista fechada de projetos.
- URLs externas são aceitas apenas de `api.openai.com`, `api.unsplash.com`,
  `images.unsplash.com`, `api.github.com`, Google APIs e hosts dos dez projetos.
- Conteúdo gerado nunca é executado; os renderizadores escapam delimitadores e
  rejeitam imports, scripts, componentes ou HTML não permitido.

## Testes e rollout

### Testes automatizados

- decisão `new | update | block`, incluindo canibalização e idempotência;
- um fixture por renderizador;
- sanitização de Markdown, MDX, Astro e template literal TypeScript;
- validações editoriais e YMYL;
- conflito de SHA e geração do commit de reversão;
- rota protegida e controles de pausa.

As chamadas externas usam respostas gravadas; a suíte normal não consome API.

### Rollout

1. dry-run dos dez projetos, sem escrita no GitHub;
2. canário de um projeto por renderizador;
3. verificação de build, URL e schema dos quatro canários;
4. liberação dos dez projetos;
5. revisão operacional após 7 e 14 dias.

## Critérios de aceite

- Cada projeto recebe no máximo uma ação editorial por data.
- Uma segunda chamada na mesma data não cria novo commit.
- Pauta duplicada resulta em atualização ou bloqueio.
- Conteúdo YMYL sem especialista real é bloqueado.
- Artigo válido é renderizado no formato nativo do projeto.
- Cada publicação cria um commit isolado e rastreável.
- Falha pós-deploy cria reversão sem force push.
- `/seo` mostra estado, custo e motivo de cada execução.
- Pausa manual, pausa automática e kill switch impedem novos commits.
- Dry-run e os quatro canários passam antes da liberação global.

## Referências

- ROI Labs Notebook: `Otimização de Sites para IA.md`, seções “Arquitetura
  BLUF”, “Metodologias de Chunking”, “Arquitetura do @graph”, “sameAs”,
  “Tipologias de Schema”, “robots.txt e WAF”, “llms.txt” e “Mensuração de
  Desempenho”.
- ROI Labs Notebook: `Neural_Web_Architecture (1).pdf`, pp. 5–6, 8–12 e 14.
- OpenAI: <https://developers.openai.com/api/docs/models>,
  <https://developers.openai.com/api/docs/guides/tools-web-search> e
  <https://developers.openai.com/api/docs/guides/image-generation>.
- Unsplash: <https://unsplash.com/documentation> e
  <https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines>.
