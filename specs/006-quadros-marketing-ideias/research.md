# Phase 0 — Research: Quadros de Marketing e Ideias

**Feature**: `006-quadros-marketing-ideias` | **Data**: 2026-08-29

Nenhum `NEEDS CLARIFICATION` sobrou da spec. O que este documento resolve são as **decisões técnicas**
que a spec não pode conter por regra do template — e que, sem estarem escritas, seriam reinventadas
(provavelmente diferente) na próxima sessão.

---

## R-001 — Onde guardam-se os bytes das imagens

**Decisão**: coluna `BYTEA` no Postgres que o hub já usa.

**Rationale**: o [Dockerfile](../../Dockerfile) copia tudo para dentro da imagem e **não monta volume
nenhum**; todo push em `main` reconstrói a imagem. Arquivo escrito em disco pelo container sumiria no
deploy seguinte — o que viola FR-022 ("os anexos devem sobreviver a publicações de novas versões").
O Postgres é a única coisa que já persiste neste ambiente.

**Alternativas consideradas**:

| Alternativa | Rejeitada porque |
|---|---|
| Volume persistente no EasyPanel | Exige mudança de infra ANTES de a feature funcionar, e o usuário pediu explicitamente para não afetar o resto da roihub |
| Object storage (S3/R2) | Dependência nova + segredo novo + custo, para um volume medido em dezenas de MB |
| Só link colado (Canva/Drive) | Considerado e descartado pelo usuário: quebra se o link morrer e obriga a abrir outra aba no dia de publicar |
| Sistema de arquivos do container | **Perda de dados garantida** a cada deploy |

**Consequência aceita**: o banco cresce e o backup junto. Mitigado pela retenção (R-005), que faz o
crescimento ser função dos cards ABERTOS ao mesmo tempo — um número pequeno e controlado — em vez do
tempo. Teto prático estimado: dezenas de MB.

**Ponto de escape**: toda leitura e escrita de bytes passa por **um arquivo só**
(`app/api/pauta/anexo/[[...id]]/route.ts`). O resto do sistema só conhece a URL. Trocar Postgres por
storage externo no futuro mexe nesse arquivo e em mais nada.

---

## R-002 — Como receber o upload sem JavaScript e sem esbarrar em limite de corpo

**Decisão**: `<form method="post" enctype="multipart/form-data" action="/api/pauta/anexo">` HTML puro
apontando para um **Route Handler**, que responde `303` de volta para a página.

**Rationale**: duas razões independentes, e cada uma sozinha já decide.

1. **Limite de corpo.** Server Action tem teto de corpo de ~1 MB por padrão
   (`serverActions.bodySizeLimit`), e um PNG do Canva passa disso com folga. Usar Server Action
   obrigaria a mexer no [next.config.mjs](../../next.config.mjs) — arquivo existente que o escopo
   manda não tocar. Route Handler no App Router recebe um `Request` padrão e **não herda** esse teto
   (o teto de 1 MB do `bodyParser` era do Pages Router; aqui é App Router, e o servidor é Node
   standalone auto-hospedado, sem limite de plataforma).
2. **Zero JavaScript.** Formulário HTML nativo com `enctype` sobe arquivo sem uma linha de JS,
   preservando a decisão da casa de páginas serverside (o único client component do repo é o modal
   de edição da agenda).

**A verificar na implementação**: subir um arquivo de ~3 MB de verdade e confirmar que chega inteiro.
Se o valor acima estiver errado em Next 16, o conserto é uma linha no `next.config.mjs` — mas a
verificação é barata e vem antes de assumir.

**Alternativas consideradas**: Server Action com `bodySizeLimit` aumentado (toca arquivo fora do
escopo); upload por `fetch` em client component (JS onde não precisa).

---

## R-003 — Como servir a imagem protegida

**Decisão**: `GET /api/pauta/anexo/<id>` devolvendo os bytes com o `Content-Type` gravado.
Referenciada normalmente por `<img src="…">`.

**Rationale**: o matcher do [middleware.ts](../../middleware.ts) é
`/((?!_next|favicon.ico).*)` — cobre `/api/*`. As isenções são nominais (`/api/seo/autopublish`,
`/api/estado`, `/api/crm/leads`); uma rota nova **cai automaticamente no Basic auth do `HUB_PASS`**.
Isso satisfaz FR-023 sem escrever uma linha de autenticação e **sem segredo novo** — a regra da casa
é que segredo próprio é para capacidade MAIOR, não para cada rota.

O navegador reenvia a credencial Basic nas sub-requisições de mesma origem, então a `<img>` carrega
normalmente depois do login.

**Cabeçalhos**: `Cache-Control: private, max-age=…`. Nunca `public` — é conteúdo atrás de
autenticação.

---

## R-004 — Colunas como dado, não como enum no `.mjs`

**Decisão**: tabela `hub_pauta_coluna`. O card referencia `coluna_id`, nunca o nome.

**Rationale**: isto **quebra de propósito** a convenção documentada em
[lib/db.ts:144-150](../../lib/db.ts) ("a lista de tipos vive no `.mjs`, e duplicá-la aqui daria uma
migração a cada rótulo novo — a validação é na action"). A convenção continua certa para `tipo` e
`responsavel`, que são decisão de quem programa. **Coluna de kanban é decisão do usuário em tempo de
uso** (FR-012: "sem exigir publicação de uma versão nova"), e enum em código exigiria exatamente o
deploy que a história existe para eliminar.

Referenciar por `id` e não por nome é o que faz FR-015 ser verdade de graça: renomear não pode
mover nem perder card.

**Alternativas consideradas**: nome como chave estrangeira (renomear órfã os cards — reprovado por
FR-015); array JSON de colunas dentro de uma linha de configuração (perde integridade referencial e
a checagem "coluna tem cards?" vira varredura).

---

## R-005 — Onde roda a liberação das imagens vencidas

**Decisão**: `UPDATE` idempotente no carregamento das duas abas novas. **Nunca em cron.**

**Rationale**: o [CLAUDE.md](../../CLAUDE.md) documenta que já existem dois crons na janela da
madrugada (estado noturno 23:37 BRT, autopublishing 00:13 BRT), que **o hub fica intermitentemente
inacessível nessa janela**, e que o GitHub Actions atrasa o agendamento em ~97 min. Um terceiro cron
acrescentaria superfície de falha a uma janela já frágil — e para nada: com carência de **30 dias**
(FR-032), um atraso de horas ou dias na varredura é irrelevante.

A varredura é segura de repetir (`WHERE bytes IS NOT NULL` faz a segunda execução não ter o que
fazer) e barata (índice parcial mantém indexadas só as linhas ainda com bytes, então é no-op de
microssegundos no dia comum).

**Alternativas consideradas**: pendurar em `POST /api/estado` como a telemetria faz — é o padrão da
casa, mas tocaria máquina crítica que o escopo proíbe mexer; cron próprio (acima); só botão manual
(rejeitado pelo usuário na conversa de desenho, por depender de lembrar).

---

## R-006 — Retenção: esvaziar os bytes, nunca apagar a linha

**Decisão**: `bytes` vira `NULL`; `nome`, `mime`, `ordem` e `tamanho` permanecem para sempre.

**Rationale**: FR-033 exige que o registro do que foi publicado sobreviva. `DELETE` da linha levaria
junto a informação de que existiu um carrossel de 10 slides — que é justamente "a execução por
escrito" que o usuário pediu guardar. `tamanho` é gravado no upload **exatamente para sobreviver ao
apagamento dos bytes**, senão o histórico não sabe dizer o que ocupou espaço.

Formato copiado de um precedente da casa: a telemetria de IA já expira `ia_chamadas` (detalhe, 90
dias) mantendo `ia_resumo` (permanente). Aqui o byte é o detalhe e o texto é o resumo.

**Relógio conta do ARQUIVAMENTO, não do upload** (FR-035): uma arte enviada com três semanas de
antecedência expiraria antes de ser usada se o relógio começasse no envio. Isso é um requisito de
corretude, não de conveniência.

---

## R-007 — Uma tabela com `quadro`, não duas tabelas

**Decisão**: `hub_pauta` com coluna `quadro` ('marketing' | 'ideia').

**Rationale**: os dois quadros compartilham praticamente tudo — título, descrição, projeto,
responsável, coluna, arquivamento, anexos, filtros. Duas tabelas dariam duas cópias de cada função
de acesso e duas cópias do módulo puro, que divergiriam. O que difere entre os quadros (canal, data,
vistas) é **um campo opcional e um componente de tela**, não uma entidade.

**Alternativas consideradas**: `hub_marketing` + `hub_ideias` separadas (duplicação garantida);
tabela genérica com `meta JSONB` (a casa reserva JSONB para carga opaca — `seo_publications.metadata`
—, nunca para campo que se filtra; `canal` se filtra).

---

## R-008 — Layout: Marketing em colunas, Ideias em seções empilhadas

**Decisão**: componente comum para os dados e filtros, dois arranjos visuais distintos.

**Rationale**: pedido explícito do usuário — Ideias deve "copiar o jeito da Agenda". A assimetria é
justificada pelo conteúdo: Marketing tem **fluxo** (o card anda da pauta até a publicação, o que a
leitura da esquerda para a direita expressa), Ideias é **depósito** (não há progressão; a seção diz
o tipo, não o estágio).

"Copiar o jeito" significa reproduzir o formato visual, **nunca importar nem alterar** os arquivos da
Agenda — FR-010 e FR-011.

---

## R-009 — A grade do calendário é função pura

**Decisão**: `gradeDoMes(ym)` em `lib/pauta.mjs`, devolvendo semanas de datas ISO com os dias vazios
do começo e do fim.

**Rationale**: é a única lógica não-trivial da vista (bissexto, mês que começa no meio da semana,
virada de ano). Como função pura ela entra no `node --test` com zero DOM e zero banco — a régua da
casa. Reusa `todaySP` e `addDaysISO`, que já existem em [lib/agenda.mjs](../../lib/agenda.mjs) e são
importáveis sem tocar naquele arquivo.

Navegação por `?mes=YYYY-MM` mantém a decisão documentada em
[app/agenda/page.tsx:307](../../app/agenda/page.tsx): "a visão inteira cabe na URL, então ela é
compartilhável e sobrevive ao reload e às server actions". Atende FR-027 sem client component.

---

## R-010 — Nenhuma dependência nova

**Decisão**: zero pacotes acrescentados ao `package.json`.

**Rationale**: tudo que a feature precisa já está no lugar — `pg` para `bytea`, `FormData` nativo do
runtime para multipart, CSS Grid para o calendário, e as classes `.ag-*`, `.card` e `.pill` que
[app/globals.css](../../app/globals.css) já define para a Agenda. Biblioteca de kanban ou de
calendário traria client-side rendering e drag & drop, que estão fora de escopo por decisão.

A única mudança no `package.json` é **registrar `test/pauta.test.mjs` na lista do `npm test`** — que
é obrigatório nesta casa: a lista é explícita e arquivo de teste não registrado nunca roda.
