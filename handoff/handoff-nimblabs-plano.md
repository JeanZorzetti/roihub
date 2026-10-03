# Handoff — nimblabs: mapa e plano de SEO (03/10/2026)

Pedido do Jean: criar para a nimblabs o plano que a Atma tem em `/gsc/mapa/atma/plano`.

Commits em `origin/main`: `40d9d2a` (demanda e `--curadoria`) e `89933d7` (card, mapa, plano).

## O que mudou no hub

- **Card `nimblabs`** reescrito. Ele descrevia o portfólio antigo de micro-SaaS (Context Keeper,
  CannibalScan), que saiu do hub hoje em `6968e96`. Agora descreve o site reiniciado em 22/09: fábrica
  de software, repo `nimblabs-site` (código em `C:/dev/nimblabs`), lançamento em 06/10. Marca
  declarada: `nimblabs`, `nimb labs`. O resumo em `data/resumos.json` também foi trocado.
- **O slug continua `nimblabs`.** Entrou em `SLUGS_DE_BUSCA`, então `/gsc/mapa/nimblabs` e
  `/gsc/mapa/nimblabs/plano` passaram a existir.
- **`perfil` ficou vazio de propósito.** Ele liga a árvore do `/okr` e é declaração do dono. Uma fábrica
  que vende por proposta seria o C ("serviço / agência / projeto"), mas quem decide é o Jean.
- **`consultar-demanda.mjs --curadoria arquivo.json`**: recebe `{excluir: {termo: motivo}, mover:
  {termo: semente}}`. As 576 exclusões, cada uma com motivo, passavam do limite de 32 mil caracteres da
  linha de comando do Windows.

## Demanda congelada

117 termos, 37.590 buscas/mês (Brasil), 8 clusters, piso 10. Três consultas em `docs/demanda/`:

| Arquivo | O que traz | Custo |
|---|---|---|
| `dataforseo-nimblabs-2026-10-03T152649.json` | 9 sementes: uma por página do site e 3 cabeças do produto fiscal | US$ 0,09, hoje |
| `dataforseo-nimblabs-2026-10-02-reforma-relacionados.json` | 20 sementes do Mapa de Desejo do cadastro fiscal | já paga em 02/10 |
| `dataforseo-nimblabs-2026-10-02-reforma-exatos.json` | 76 termos exatos (concorrentes, ERPs, cClassTrib) | já paga em 02/10 |

As duas de 02/10 vieram de `nimblabs-site/docs/demanda/`, sem alterar volume. Só ganharam `projeto` e
`objetivo` na procedência, que o script exige.

| Cluster | Termos | Buscas/mês | Página que deveria responder |
|---|---|---|---|
| cclasstrib | 13 | 14.900 | nenhuma (apoio do produto fiscal) |
| ibs cbs | 9 | 9.240 | `/saneamento-cadastro-fiscal` |
| reforma tributária 2027 | 14 | 4.770 | nenhuma (apoio do produto fiscal) |
| desenvolvimento de software | 9 | 4.540 | nenhuma |
| fábrica de software | 21 | 2.010 | `/` |
| integração de sistemas | 36 | 1.650 | `/integracao-de-sistemas` |
| software sob medida | 14 | 470 | `/software-sob-medida` |
| portal do cliente | 1 | 10 | `/portal-do-cliente` |

### O que ficou fora, e por quê

A curadoria inteira está em `docs/demanda/curadoria-nimblabs.json`. Os motivos que mais pesam, em
buscas/mês:

- **Marca de terceiro: 111.760.** Concorrentes do produto fiscal (Qive, e-Auditoria, ROIT, Mastersaf,
  Systax…), ERPs e plataformas (TOTVS, Bling, Onvio…).
- **Split payment: 33.100.** É o mecanismo de pagamento do IBS/CBS, não cadastro nem sistema.
- **"portal do cliente": 32.720.** É gente entrando no portal de outra empresa. Das 85 variantes,
  sobrou `software de portal do cliente` (10). Bate com o Mapa de Desejo de 29/09: o portal não tem busca.
- **Consulta de código NCM/NBS: 27.950.** A nimblabs não vende sugestão de código: é commodity, e o ERP
  dá de graça (skill `cadastro-fiscal-2027`). `cclasstrib` ficou porque é o código novo da reforma e quem
  procura por ele é exatamente quem precisa pôr o sistema para emitir.
- Fora também: cursos e faculdade, carreira de programador, metodologia (scrum, cascata), calculadoras,
  apuração assistida da Receita, consultoria tributária e variantes com o mesmo volume.
- 🚩 `sistema integrar` (1.600/mês, estável o ano todo) ficou fora como provável nome de sistema. Vale
  conferir a SERP antes de reincluir.

Recurar não custa nada: edite `docs/demanda/curadoria-nimblabs.json` e rode

```bash
D=docs/demanda
node scripts/consultar-demanda.mjs nimblabs \
  --de $D/dataforseo-nimblabs-2026-10-03T152649.json \
  --de $D/dataforseo-nimblabs-2026-10-02-reforma-relacionados.json \
  --de $D/dataforseo-nimblabs-2026-10-02-reforma-exatos.json \
  --curadoria $D/curadoria-nimblabs.json [--gravar]
```

As sementes são as da primeira consulta. Semente nova é consulta nova (US$ 0,09).

## O que o plano diz hoje

É uma prévia com as premissas padrão: nenhuma versão foi criada. Está na semana 1 de 26, a partir de
28/09. Corridas disparadas à mão em 03/10, depois do deploy: crawl (7 URLs declaradas, 12 visitadas,
0 falha) e série (25 dias de `nimblabs.com`). O mapa foi aberto uma vez, às 12:35, para fotografar os
cards.

- **Backlog:** 152 tarefas, com **27 páginas novas** propostas. Dez delas são variações de cClassTrib.
- **Projeção aos 180 dias:**
  - 91,4% do TAM: 34.350 das 37.590 buscas/mês, em termos com página estabilizada.
  - 30 de 117 termos na página 1.
  - 687 cliques/mês.
- **Aos 90 dias:** Top 20 = 0%. Nenhuma página amadurece a tempo, com a premissa de 12 semanas.
- **Esta semana:**
  - cobrir «tabela cst cclasstrib», «tabela cclasstrib excel» e «tabela cclasstrib»;
  - consertar o índice de `/saneamento-cadastro-fiscal`, `/` e `/integracao-de-sistemas` (hoje estão em
    `noindex`).

### 🚩 Por que essa projeção está inflada

1. **Uma página por variação de cClassTrib.** A regra literal da D14 faz o rótulo de uma página planejada
   cobrir todo termo cujas palavras estão nele. Assim, «tabela cst cclasstrib», «tabela cclasstrib excel»,
   «consulta cclasstrib» e as outras sete somam, cada uma, o termo-cabeça `cclasstrib` (9.900) no
   impacto. São 10 páginas disputando a mesma busca: é canibalização. É o mesmo achado aberto da Tape Pro
   (memória da 057).
   - Saída do lado do site: **uma** página de cClassTrib cujo título e H1 cubram os modificadores
     (tabela, CST, consulta, por NCM, planilha, excel). Foi o que se fez com `/produtos/fita-gomada`.
   - Saída do lado do hub: clarify da D14, para que a página planejada cubra só o próprio termo.
2. **«ibs cbs» virou página nova**, mesmo com `/saneamento-cadastro-fiscal` existindo. O plano acha a
   página do cluster pela frase exata da semente no caminho ou no título, e o título é "IBS **e** CBS na
   nota". O termo `ibs cbs` em si conta como coberto pela página de produto, porque a cobertura do termo
   é palavra a palavra.

## Pendências

1. **Lançamento em 06/10.** Até lá o site responde `noindex` e o Google não tem o que indexar. No dia,
   disparar `POST /api/indexacao` (hoje ela só diria "excluída por noindex" e gastaria cota).
2. **As 3 páginas de produto estão com `publicado: false`.** Se o cadastro fiscal não for ao ar, os dois
   maiores clusters (ibs cbs e cclasstrib, 24.140/mês) ficam sem página que responda. Decisão dos sócios.
3. **Versão 1 do plano e metas**: decisão do dono, não foi criada.
4. **As 9 sementes são proposta minha.** Saíram das páginas que o site declara e do Mapa de Desejo do
   cadastro fiscal. "Desenvolvimento de software" (4.400) é na maior parte estudante e carreira. Ficou como
   cluster porque é o nome do serviço, mas é o primeiro candidato a sair se a meta parecer inflada.
5. **`perfil` do card** (liga o `/okr`): sem declarar.
