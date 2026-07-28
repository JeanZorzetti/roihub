# ROI Hub — handoff: ML de diagnóstico e insights

**Objetivo:** um motor que diagnostica e gera insights por projeto a partir dos dados das duas abas do hub — `/seo` (Search Console via API) e `/infra` (crawl stats via export manual) — e entrega as conclusões DENTRO do hub. Pedido do Jean em 10/07/2026.

## ✅ STATUS 10/07 (noite): F0–F2 SHIPPED

- `ml/` implementado (gsc.py, crawl.py, diagnostics.py, analyze.py, test_ml.py 11/11 pytest) + aba `/insights` no hub.
- **Venv fora do OneDrive**: `C:\venvs\roihub-ml` (Python 3.13; `C:\venvs\roihub-ml\Scripts\python -m pip install -r ml/requirements.txt`). ruptures instala limpo no 3.13.
- **Rotina de sexta ganha um passo**: depois do export de crawl, `C:\venvs\roihub-ml\Scripts\python ml\analyze.py` → commit+push (o JSON versionado é o deploy).
- **F0 validado**: `--dump` bate 100% com os totais 28d do hub (script node descartável na sessão de 10/07, todas as 10 propriedades idênticas).
- **Achado real do 1º run**: 4 projetos (sirius, polarisia, estetiacrm, nimblabs) com changepoint de impressões PRA CIMA na mesma semana de 13/05/2026 — padrão de algo update; cruzar manualmente com deploys/updates.
- Gotchas novos: `.env` do repo tem BOM UTF-8 (ler com `utf-8-sig`); console Windows é cp1252 (prints do analyze.py só ASCII).
- **Falta**: F4 (narrativa via claude-cli) — brief abaixo continua válido. Conferir `/insights` em prod.

## ✅ STATUS 28/07: F3 SHIPPED (forecast + kill-gates)

`ml/forecast.py` (+7 testes, 18/18 pytest) → `insights.json` ganha `forecast` e `gates` por projeto;
`/insights` renderiza a frase do gate e a tabela da projeção. **Primeiros vereditos reais:**

| bet | gate D+90 | veredito automático |
|---|---|---|
| Aftercare | 30/08 | ✔ **PASSOU** — 540 imp na última semana contra o gate de 100. Um mês antes da data |
| ReviewShield | 02/09 | ✖ **NÃO cruza** — projeção ~84 imp/sem (35–200) contra 100. Confirma "em risco" de 11/07 |
| Context Keeper | 10/09 | ◷ série curta demais pra projetar — mas **49 imp na última semana**: saiu do zero absoluto da revisão de 11/07 (o Request Indexing pegou) |

Decisões de modelagem, pra não reabrir:

- **Holt amortecido (ETS(A,Ad,N)) em `log1p`, sem statsmodels.** 68 pontos semanais não sustentam
  sazonalidade nenhuma, e impressão de site novo cresce multiplicativamente (1 → 11 → 540 em 9
  semanas): tendência aditiva na escala crua subestima a curva e projeta negativo. O modelo inteiro
  é a recursão de `_fit` — statsmodels só entra se algum dia houver sazonalidade real.
- **Intervalo de 80%, não 95%** — com 8 pontos o de 95% sai largo demais pra decidir qualquer coisa.
  A variância h passos à frente é a fórmula exata de ETS(A,Ad,N) (Hyndman, tabela 7.8): a
  aproximação `σ√(1+α²(h-1))` ignora o trend e dá intervalo estreito = falsa confiança no gate.
- **Banda gigante em bet novo não é bug** (aftercare: 7–821.088 em 8 semanas). É o modelo dizendo
  "não sei prever tão longe" numa série que multiplicou por 500 em 9 semanas. O veredito só usa `hi`
  pra separar "em risco" de "não cruza", e errar pro lado largo é o lado conservador certo.
- **Prefixo morto é cortado**: bet novo tem ~60 semanas de zero antes do sitemap entrar no índice, e
  zero antigo puxaria o nível pra baixo como se fosse queda.
- **Gate longe = "distante", nunca "sem dados"** (a ordem dos ramos em `evaluate_gates` é de
  propósito): D+180 a 18 semanas não é problema de dado, é o calendário que não andou. Rotular de
  "sem dados" mandaria caçar bug onde não há.
- **D+270 nunca recebe veredito**: mede receita, e o GSC não vê receita. Fica no card só com a data.
- **O único número inventado é o threshold do D+180** (10 cliques/sem). A tese diz "cliques +
  primeiros signups/leads" sem número — está isolado numa constante em `GATE_SPECS`, com comentário.
- Relógios (`GATES` em `forecast.py`) saem de `nimblabs/docs/PORTFOLIO-EN-STRATEGY.md` §6 — a data é
  a da **submissão do sitemap**, não a do deploy. Bet novo = uma linha lá.

## Decisão de linguagem: Python, SOZINHO

- **Python** porque: dataset minúsculo (10 projetos × ~16 meses de dados diários ≈ 20–50k pontos no total), execução batch semanal (zero exigência de latência), e todo o ferramental necessário é Python maduro: `pandas`, `scipy`, `statsmodels` (Holt-Winters), `ruptures` (changepoint detection), `scikit-learn` se precisar.
- **Rust NÃO entra**: só pagaria em motor de alto volume/baixa latência, que este problema não tem nem vai ter neste escopo. Python+Rust juntos = 2 toolchains pra manter sem retorno. (O aprendizado CannibalScan "Rust=motor, TS=orquestração" continua válido — aqui simplesmente não há motor que justifique.)
- **Honestidade sobre "ML"**: com 10 projetos e granularidade semanal, deep learning/modelos gordos = overfitting garantido. A v1 é **estatística robusta bem escolhida** (tendência, changepoint, anomalia, correlação, forecast simples) — isso JÁ é o motor de diagnóstico. Modelos maiores só se os dados um dia justificarem.
- **Narrativa em linguagem natural (opcional, F4)**: via `claude-cli` (assinatura, budget = claude-cli only, NUNCA API paga — regra global do Jean).

## Arquitetura (encaixa no padrão do hub: sem DB, sem serviço novo)

```
ml/ (subpasta NOVA dentro do repo roihub)
  analyze.py          ← entrypoint: puxa dados → computa → escreve data/insights.json
  gsc.py              ← GSC API (mesma service account do hub)
  crawl.py            ← parser dos CSVs de docs/ (espelho do lib/crawl.mjs)
  diagnostics.py      ← as análises (ver "O que computar")
  requirements.txt
data/insights.json    ← OUTPUT versionado; commit+push = deploy (padrão projects.json)
```

- **Job batch local** (roda na máquina do Jean, na rotina de sexta junto com o export de crawl): `python ml/analyze.py` → escreve `data/insights.json` → commit+push → hub renderiza.
- **Zero infra nova**: sem serviço Python no EasyPanel, sem DB, sem cron remoto. O hub (Next) só LÊ o JSON versionado — a renderização é uma seção/aba nova barata.
- Se um dia precisar automatizar: vira um cron no EasyPanel que faz o push. Não começar por aí.

## Dados disponíveis (tudo já resolvido, é só consumir)

1. **GSC API** — série diária de até 16 meses por propriedade: clicks, impressions, ctr, position (`searchAnalytics/query`, `dimensions:["date"]`; dá pra abrir por `query` e `page` também — útil pros insights). Auth: service account `nimblabs@review-dispute-agent-498311.iam.gserviceaccount.com`, JSON em `nimblabs/docs/review-dispute-agent-498311-oneline.txt` (⚠️ NUNCA commitar; ler via env `GOOGLE_SERVICE_ACCOUNT_JSON` ou path local). 10 propriedades, auto-descoberta via `sites.list` — replicar a lógica de `lib/gsc.ts` (resolveProperty: sc-domain exato > domínio-pai > URL-prefix; filtro de página por host).
2. **Crawl stats** — CSVs em `roihub/docs/**/{host}-Crawl-stats-AAAA-MM-DD/`: série diária de 90d (requisições, bytes, tempo de resposta) + snapshots (% por resposta, hosts, finalidades, tipos de arquivo — os dois últimos HOJE não são usados pelo hub, o ML pode usar). Regras de parse já resolvidas em `lib/crawl.mjs` (**portar 1:1**): header pt-BR → parse por POSIÇÃO de coluna; UTF-8 com BOM; label "(5xx)" agrupado; merge de exports sobrepostos por data (mais novo vence).
3. **Contexto por projeto** — `data/projects.json`: receita/blockers/decay/ação manual de cada um.

## O que computar (fases; cada uma já entrega valor sozinha)

**F0 — extração:** módulos `gsc.py` + `crawl.py` devolvendo DataFrames diários por projeto. Puxar 16 meses do GSC (não os 84 dias do hub — o histórico longo é a vantagem do ML). Critério: `analyze.py --dump` imprime as séries dos 10 projetos.

**F1 — diagnóstico estatístico → `insights.json`:**
- **Tendência robusta**: Theil-Sen slope sobre cliques/impressões semanais (janelas 4/12/26 sem) → `improving | flat | declining` + magnitude. Robusto > OLS (outliers de semana).
- **Changepoints**: `ruptures` (PELT) na série de impressões → "impressões quebraram pra cima na semana de X" (cruzar depois com deploys/algo updates manualmente).
- **Anomalias**: última semana vs esperado (mediana móvel ± k·MAD) → alertas tipo "cliques 3σ abaixo do normal".
- **Diagnóstico crawl↔SEO**: % redirect/404/outros alto + impressões estagnadas = crawl waste (roilabs 40,6% OK, goiania 65,2%, nimblabs 60,3% no export de 10/07 — já são os 3 primeiros casos de teste reais); tempo de resposta subindo vs volume de crawl caindo (Google desiste de site lento).
- **Score de saúde SEO 0–100 por projeto** combinando os sinais acima, com os motivos listados (explicável, nunca só o número).

**F2 — render no hub:** seção "Insights" por card (ou 4ª aba "Insights") lendo `data/insights.json` + data de geração ("gerado em 11/07 — rode ml/analyze.py pra atualizar" se velho > 10 dias). Estado vazio honesto se o JSON não existir.

**F3 — forecast + kill-gates (✅ SHIPPED 28/07, ver bloco de status):** Holt-Winters/ETS nas impressões semanais → projeção 4–8 semanas com intervalo. Uso direto: **kill-gates D+90/180/270 dos bets nimblabs** (tese do portfólio) — "no ritmo atual, aftercare NÃO cruza o gate D+180". É o insight de maior valor de negócio do sistema.

**F4 (opcional) — narrativa:** prompt com o JSON pro `claude-cli -p` gerar 2–3 frases pt-BR por projeto ("Impressões 3× em 6 sem mas posição média piorou: conteúdo novo rankeando fundo; reforce internal links de X"). Batch, 1×/semana, custo assinatura.

## Schema proposto do insights.json (F1)

```json
{
  "generatedAt": "2026-07-11",
  "projects": {
    "goiania": {
      "health": 62,
      "trend": { "impressions": "improving", "clicks": "flat", "slopePctWeek": 8.2 },
      "changepoints": [{ "date": "2026-06-02", "metric": "impressions", "direction": "up" }],
      "anomalies": [],
      "crawl": { "diagnosis": "crawl-waste", "detail": "33,6% redirect — eco do gotcha trailing-slash nginx" },
      "flags": ["crawl-waste"],
      "narrative": null
    }
  }
}
```

## Gotchas pra próxima sessão

- **GSC atrasa ~3 dias** e OMITE dias com zero impressões — reindexar a série por calendário com fill 0 antes de qualquer análise (o hub já faz isso em JS).
- **Séries curtas/esparsas** (nimblabs ~0 cliques): métodos precisam degradar com elegância — sem dado suficiente → `"insufficient-data"`, nunca NaN/crash. Impressões são o sinal primário em site novo, não cliques.
- **Credencial**: `.gitignore` do repo já cobre `.env`; `ml/` deve ler a env ou o path do txt do nimblabs — nunca copiar o JSON pra dentro do repo.
- **Windows + OneDrive**: venv dentro do OneDrive pode corromper (mesmo padrão do node_modules, errno -4094). Criar venv FORA (`C:\venvs\roihub-ml`) ou usar `uv` com cache fora do OneDrive.
- **Python no PATH da máquina**: conferir versão ≥3.11 antes de começar (`python --version`).
- Crawl stats: cada export = 90 dias; com 1 export só (10/07) as janelas de comparação 28d-vs-28d anteriores já funcionam, mas changepoint em crawl precisa de ~2–3 meses de exports emendados — implementar, deixar ativar sozinho conforme o histórico cresce.
- Testes: seguir o padrão do repo (funções puras testáveis; `pytest` simples, sem fixtures gordas). O parse de crawl tem os casos prontos em `test/crawl.test.mjs` — portar os mesmos asserts.

## Primeiro passo concreto da sessão nova

1. Ler este arquivo + `../handoff.md` + `lib/crawl.mjs` + `lib/gsc.ts`.
2. F0: `ml/` com extração GSC (16 meses, 10 propriedades) e parse dos CSVs — validar contra os números que o hub mostra (mesmos totais 28d).
3. F1 na sequência; F2 fecha o loop no hub. F3/F4 só depois de F1–F2 verificados.
