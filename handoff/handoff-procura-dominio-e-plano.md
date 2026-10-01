# Handoff — Procura: domínio novo, mapa e plano de SEO (01/10/2026)

Pedido do Jean: (1) `verticemarketing.roilabs.com.br` mudou para `procuramarketing.com`; (2) criar para
ela o plano que a ROI Labs tem em `/gsc/mapa/roilabs/plano`.

Commits em `origin/main`: `327f456` (script de demanda) e `543aad9` (card, mapa, plano, demanda).

## O que está no ar

- **Card `verticemarketing`**: nome "Procura — agência de marketing em Goiânia e Aparecida", `url`
  `https://procuramarketing.com/`, `dominioAnterior` (o host antigo responde 301), `marca` declarada
  (`vertice marketing`, `vértice marketing`, `procura marketing`, corte `bra`). `pipelines.json` e
  `resumos.json` com o nome novo; o aviso de lead no Telegram sai "Lead novo · Procura".
- **O slug continua `verticemarketing`**, de propósito: é a chave da pipeline que o formulário do site
  envia (`vertex-landing-craft/lib/actions/submit-lead.ts`), das tabelas `hub_*` e dos avisos.
  Renomear exige migração no banco e deploy coordenado com o site.
- **`SLUGS_DE_BUSCA`** ganhou o slug: `/gsc/mapa/verticemarketing` e `/gsc/mapa/verticemarketing/plano`
  respondem 200. Antes era 404.
- **Homepage do repo** `JeanZorzetti/vertex-landing-craft` no GitHub aponta para o domínio novo.
- **Corridas disparadas à mão em 01/10**: crawl (15 declaradas, 16 visitadas, 0 órfã), série (261 dias
  do host antigo: 69 impressões, 7 cliques; marca fecha com resíduo 0), indexação (`sem_propriedade`).

## Demanda congelada

26 termos, 4.690 buscas/mês, 5 clusters, piso 20. Três consultas salvas em `docs/demanda/`:

| Arquivo | Região | O que traz |
|---|---|---|
| `dataforseo-verticemarketing-2026-10-01T183527.json` | Goiânia | 1.797 termos relacionados às 5 sementes (paga hoje, US$ 0,09) |
| `dataforseo-verticemarketing-2026-09-30-buscado-de-goiania.json` | Goiânia | 11 termos genéricos, copiados do repo do site |
| `dataforseo-verticemarketing-2026-09-30-cidade-no-texto.json` | Brasil | 14 termos com Goiânia/Aparecida no texto, copiados do repo do site |

As duas de 30/09 já estavam pagas em `vertex-landing-craft/docs/demanda/dataforseo-2026-09-30.json`;
foram copiadas sem alterar volume.

⚠️ Saldo DataForSEO: US$ 47,755 antes da consulta (15:33 BRT) e US$ 47,485 às 16:05 BRT. Caíram
US$ 0,27, e esta sessão fez uma única chamada paga, com custo reportado de US$ 0,09. Os outros US$ 0,18
não saíram de nenhuma chamada daqui e não foram explicados: conferir o extrato no painel da DataForSEO.

| Cluster | Termos | Buscas/mês | Página |
|---|---|---|---|
| criacao-de-site | 5 | 1.760 | `/criacao-de-sites-goiania` |
| agencia-de-marketing | 11 | 1.140 | `/` |
| landing-page | 2 | 970 | sem página |
| seo | 4 | 540 | `/blog/1736365200000` |
| gestao-de-trafego | 4 | 280 | sem página |

Por que três consultas e piso 20:

- A consulta por cidade não devolve nenhum termo com "goiânia" no texto, e esses são os alvos da
  landing (`criação de site em goiânia` 590, `criação de sites goiânia` 260). Vieram da consulta de
  30/09 no recorte Brasil.
- Em recorte de cidade, 10 é o menor balde que o Google Ads reporta: 819 dos 860 termos estavam nele
  (8.190 das 16.210 buscas). Com piso 10 o inventário seria 97% ruído.
- 28 exclusões, cada uma com o motivo gravado: 19 variantes com o mesmo volume (ficou a grafia
  acentuada), 4 de nicho que o site não declara (médico; advogado saiu por decisão do dono em 30/09),
  3 que não são busca pelo serviço (`seo pack`, `seo brasileiro`, `seost`) e 2 grafias com símbolo.

Recurar não custa nada:

```bash
D=docs/demanda
node scripts/consultar-demanda.mjs verticemarketing \
  --de $D/dataforseo-verticemarketing-2026-10-01T183527.json \
  --de $D/dataforseo-verticemarketing-2026-09-30-buscado-de-goiania.json \
  --de $D/dataforseo-verticemarketing-2026-09-30-cidade-no-texto.json \
  --piso 20 --excluir "termo:motivo" --mover "termo=semente" [--gravar]
```

Os `--excluir` e `--mover` vigentes estão em `procedencia.excluidos` e `procedencia.movidos` de
`data/demanda-estimada.json`. Semente nova é consulta nova (US$ 0,09).

## O que o plano diz hoje

Prévia com as premissas padrão, nenhuma versão criada. Semana 1 de 26, a partir de 28/09. Backlog de 60
tarefas. Projeção aos 180 dias: Top 20 em 26,9% dos termos, cobertura do TAM de 36,5%, 1.710
impressões e 34 cliques por mês. Duas páginas a criar: «landing page» e «gestor de trafego»; uma de
apoio: «criacao de sites goiania».

## Pendências

1. **Search Console de `procuramarketing.com` (só o Jean).** A conta de serviço do hub
   (`nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`) recebe 403 em
   `sc-domain:procuramarketing.com`. Enquanto isso o mapa só soma o host antigo, a indexação fica em
   `sem_propriedade` e toda página existente aparece no plano como "consertar o índice". Verificar o
   domínio, adicionar a conta como usuário e disparar `POST /api/gsc-serie` e `POST /api/indexacao`.
   Está como blocker humano no card.
2. **Versão 1 do plano e metas.** Criar a versão e aprovar meta a meta é decisão do dono; não foi feito.
3. **As 5 sementes são proposta minha**, tiradas do que o site declara vender e do que a pesquisa de
   30/09 consultou. E-commerce, CRM e consultoria de performance ficaram fora.
4. **Aparecida não soma.** O volume genérico é só o de quem busca em Goiânia; a consulta de Aparecida
   de 30/09 (agência de marketing 50, gestor de tráfego 50) não entrou. O total é piso.

## Gotchas

- `consultar-demanda.mjs` agora grava toda resposta paga em `docs/demanda/` antes da curadoria, e
  `--de` relê sem gastar. O mesmo termo em duas regiões reprova: os recortes não se misturam.
- Projeto sem autopublishing não está em `lib/autopublish-projects.mjs`: o script lê host e marca do
  card e exige `--sementes` e `--idioma`.
- O inventário casa a consulta do Search Console por texto exato. Onde o Google Ads devolveu a mesma
  busca com e sem acento, ficou só a acentuada: a grafia sem acento não entra no Top 20.
- `POST /api/indexacao` leva minutos e o proxy derruba a conexão do cliente (reset aos 196 s). A
  corrida termina no servidor: conferir `hub_indexacao` antes de repetir.
- O crawl acusa 1 falha: o site linka `/admin`, que responde 401 e está em `Disallow` no robots.
