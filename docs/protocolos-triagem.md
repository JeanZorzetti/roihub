# Triagem do corpus — protocolo × estado × episódio (31/07/2026)

> Resultado do passo 1 da fase 2 de [`rag-arquitetura.md`](rag-arquitetura.md). Registra o que
> foi tipado, o que **não** foi, e por quê. Sem este arquivo a próxima sessão re-triaria os
> mesmos 123 arquivos.

## O que entrou

| Fonte | Arquivos | Viraram protocolo |
|---|---|---|
| `memory/` — candidatos diretos (nem `project_*` nem `feedback_*`) | 79 | 69 |
| `memory/feedback_*` | 6 | **6** (todos) |
| `memory/project_*` | 38 | 3 (exceções abaixo) |
| Código: `lib/autopublish-clients.ts`, `-core.mjs` | 2 | 4 protocolos de `CNT` |

**97 protocolos** com **87 fontes distintas** em `origem`. A contagem passa a estimativa de ~85
do handoff porque memória densa rende mais de um protocolo: `roihub_autopublishing_gotchas` (15
gotchas numeradas) virou **11 registros em 5 áreas**, `roilabs_dns_cloudflare_retired_subdomains`
virou 4, e `goiania_lcp_root_causes`, `nextauth_installed_but_never_wired` e
`vendor_domain_hides_project_from_gsc` viraram 3 cada.

## Os 6 `feedback_*` — todos eram protocolo de trabalho de verdade

| Memória | Virou |
|---|---|
| `feedback_no_lazy_features` | `UI-02` |
| `feedback_full_seo_no_ads` | `PRT-02` |
| `feedback_push_apos_concluir` | `DEP-12` |
| `feedback_handoff_md` | `PRT-05` |
| `feedback_docs_no_vault` | `PRT-06` |
| `feedback_claude_loop_runner_push_main` | `AGT-10` |

## Os 3 `project_*` promovidos, contra a regra do handoff

O handoff diz "não force tipagem em `project_*`" — e ela vale para os outros 35. Estes três
carregam norma verificável que não existe em nenhum outro lugar:

- `project_reddit_api_blocked` → `INT-07`. Não é estado de projeto: é restrição de fornecedor.
- `project_nimblabs_portfolio` → `PRT-03` (gates com número e data, kill D+90/180/270, WIP ≤ 3).
  A própria taxonomia cita isso como o conteúdo de `PRT`.
- `project_roihub` → co-origem de `PRT-03`.

Dois outros `project_*` entraram só como **co-origem** de um protocolo cuja norma nasceu em
outro lugar: `project_compass_prod_setup` (`DEP-02`), `project_aftercare_blog_funnel` (`CNT-04`)
e `project_roihub_autopublishing` (`DEP-12`).

## O que NÃO virou protocolo — e a razão

Dez candidatos ficaram fora. Nenhum foi descartado: onde havia lição, ela virou protocolo com
o arquivo citado em `origem`.

| Memória | Classe | Destino |
|---|---|---|
| `secrets_to_rotate` | **estado** (lista viva de pendência) | doou `SEC-04`; a lista continua sendo estado, não norma |
| `context_keeper_e2e_bugs` | episódio | doou `AGT-05` |
| `sofia_next_refactor_roadmap` | episódio (roadmap de sprints) | doou `DAT-03` |
| `prolife_supabase_vercel_env` | episódio | doou `DAT-04` |
| `splitjud_www_dns_orphan` | episódio (projeto encerrado) | doou `DNS-06` |
| `estetia_audit_2026_06` | episódio | nada de reutilizável fora do projeto |
| `polaris_reviewer_blind_root_cause` | episódio | diagnóstico de uma run; a norma seria só "não confie no relato do worker" |
| `polaris_reviewer_summed_diff_root_cause` | episódio | idem, e o conserto virou spec 010 |
| `polaris_preview_vps_local` | **estado** (env var faltando) | pendência de infra |
| `polaris_rename_sofia_deferred` | **estado** | explica o "sofia" no repo |
| `splitjud_007_t002_pending` | **estado** (projeto excluído) | morto |

**Nenhum candidato caiu por falta de `verificacao.como`.** O handoff previa perder alguns nesse
passo ("esperado perder alguns, e isso é resultado") — não aconteceu, porque as memórias da casa
já nascem com a seção *How to apply*, que é a checagem escrita em prosa. O passo caro não foi
descobrir opinião disfarçada de protocolo: foi **traduzir prosa em comando**.

## O achado desta triagem

🚨 **O protocolo editorial estava em código, não em memória.** As regras de `CNT` (fonte real,
nunca concorrente direto, BLUF de 40–60 palavras, 4–6 seções, tabela em toda comparação,
`imageScene` como cena fotografável, gate YMYL) só existiam no prompt de
`lib/autopublish-clients.ts` e nas validações de `lib/autopublish-core.mjs`. Elas governam **10
sites que publicam sozinhos toda noite** e nunca tinham sido escritas como norma consultável —
`CNT` era a área mais subdimensionada do portfólio (estimada em ~4, tipada em 10).

Consequência para a fase 5 (manifesto por repo): protocolo pode morar em código. A varredura de
conformidade não pode assumir que toda norma nasceu em `memory/`.

## Onde a taxonomia atritou

Três decisões de fronteira que a próxima sessão não precisa re-litigar:

- **"200 não prova X" é `VER`, não a área do X.** `curl -k`, sitemap em 200, landing com backend
  morto, `vercel project ls`, clone quebrado — todos em `VER`. A exceção é `SEO-04` (indexação),
  que o próprio doc de áreas já fixou como exemplo canônico de `SEO`.
- **Protocolo de processo de trabalho não tem área própria** e foi distribuído: fechar entrega
  em `DEP`, handoff e vault em `PRT`. Se essa família crescer, é candidata a área nova — hoje
  são 3 registros e não justifica.
- **`SEC` × `DAT` no Postgres sem TLS:** ficou em `SEC-05` porque o que a norma protege é
  credencial em claro na internet pública, não a integridade do dado.
