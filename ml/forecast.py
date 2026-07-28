# Forecast (Holt damped trend = ETS(A,Ad,N)) sobre a série semanal do GSC + os kill-gates
# da tese nimblabs. Responde a única pergunta que a tese faz: "no ritmo atual, esse bet
# cruza o gate antes da data?"
#
# Ajuste em log1p: impressões de site novo crescem multiplicativamente (3 → 11 → 20 → 93);
# tendência aditiva na escala crua subestima a curva e projeta negativo. Em log1p o
# intervalo também vira multiplicativo, que é o formato certo pra contagem.
#
# ponytail: sem statsmodels — 68 pontos semanais, nenhuma sazonalidade ajustável nesse
# tamanho; o modelo inteiro é a recursão de _fit. Só trocar por statsmodels/ETSModel se um
# dia houver sazonalidade real pra estimar.
import math

from diagnostics import add_days

# Relógios da tese (nimblabs/docs/PORTFOLIO-EN-STRATEGY.md §6): a data é a da SUBMISSÃO DO
# SITEMAP ao GSC, não a do deploy — os gates são D+90/180/270 contados daí.
GATES = {
    "aftercare": ("Aftercare", "2026-06-01"),
    "reviewshield": ("ReviewShield", "2026-06-04"),
    "context": ("Context Keeper", "2026-06-12"),
}

# (dias, métrica, threshold semanal). Regra 4 da tese.
GATE_SPECS = (
    (90, "impressions", 100),  # documentado: indexado + crescendo, >=100 imp/7d
    # ponytail: a tese diz "cliques + primeiros signups/leads" sem número; 10/sem é o botão
    # de calibragem — é o único valor aqui que não sai do doc.
    (180, "clicks", 10),
    (270, None, None),  # receita: o GSC não enxerga, logo não existe veredito por forecast
)

HORIZON = 8  # semanas projetadas (a tese decide em 4-8 semanas; além disso é chute)
MAX_GATE_WEEKS = 12  # gate mais longe que isso não recebe veredito, só a data
MIN_WEEKS = 6  # menos que isso depois de tirar o prefixo morto = sem forecast
MIN_TOTAL = 20  # série viva demais pra ignorar, fraca demais pra modelar
Z80 = 1.2816  # intervalo de 80%: 95% com 8 pontos sai largo demais pra decidir algo

_ALPHAS = (0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9)
_BETAS = (0.005, 0.01, 0.02, 0.05, 0.1, 0.2)
_PHIS = (0.80, 0.85, 0.90, 0.95, 0.98)

PT_METRIC = {"impressions": "imp", "clicks": "cliques"}


def _fmt_day(iso):
    return f"{iso[8:10]}/{iso[5:7]}"


def _weeks_between(a, b):
    """Semanas inteiras de `a` até `b`, arredondando pra cima (0 = já venceu)."""
    from datetime import date

    days = (date.fromisoformat(b) - date.fromisoformat(a)).days
    return math.ceil(days / 7)


def _fit(y):
    """Grid-search de alpha/beta/phi minimizando SSE de 1 passo. Devolve o estado final."""
    n = len(y)
    best = None
    for alpha in _ALPHAS:
        for beta in _BETAS:
            if beta > alpha:  # beta* = beta/alpha tem que ficar em (0,1)
                continue
            for phi in _PHIS:
                level, trend, sse = y[0], y[1] - y[0], 0.0
                for t in range(1, n):
                    f = level + phi * trend
                    e = y[t] - f
                    sse += e * e
                    level = f + alpha * e
                    trend = phi * trend + beta * e
                if best is None or sse < best[0]:
                    best = (sse, alpha, beta, phi, level, trend)
    sse, alpha, beta, phi, level, trend = best
    return alpha, beta, phi, level, trend, math.sqrt(sse / max(n - 2, 1))


def _sigma_h(sigma, alpha, beta, phi, h):
    """Variância h passos à frente de ETS(A,Ad,N) — Hyndman & Athanasopoulos, tabela 7.8.

    sigma*sqrt(1 + alpha^2*(h-1)) (o caso sem tendência) subestima o intervalo quando há
    trend, e intervalo estreito demais é pior que nenhum: vira falsa confiança no gate.
    """
    if h <= 1:
        return sigma
    a, b, p = alpha, beta, phi
    if p >= 1 - 1e-9:  # limite não-amortecido (A,A,N)
        inner = (h - 1) * (a * a + a * b * h + b * b * h * (2 * h - 1) / 6)
    else:
        inner = (
            a * a * (h - 1)
            + (b * p * h) / (1 - p) ** 2 * (2 * a * (1 - p) + b * p)
            - (b * p * (1 - p**h))
            / ((1 - p) ** 2 * (1 - p * p))
            * (2 * a * (1 - p * p) + b * p * (1 + 2 * p - p**h))
        )
    return sigma * math.sqrt(1 + max(inner, 0.0))


def project(weeks, metric="impressions", horizon=HORIZON):
    """Projeção de `horizon` semanas com intervalo de 80%. None se a série não sustenta."""
    vals = [w[metric] for w in weeks]
    # Corta o prefixo morto: bet novo tem ~60 semanas de zero antes do sitemap entrar no
    # índice, e zero antigo puxa o nível pra baixo como se fosse queda.
    first = next((i for i, v in enumerate(vals) if v > 0), None)
    if first is None:
        return None
    vals = vals[first:]
    if len(vals) < MIN_WEEKS or sum(vals) < MIN_TOTAL:
        return None

    # ponytail: em bet novo (1 → 11 → 540 em 9 semanas) a banda de 8 semanas estoura ordens
    # de grandeza — é o modelo dizendo "não sei", não bug. O veredito de gate só usa `hi`
    # pra separar "em risco" de "não cruza", e errar pro lado largo é o lado certo. Se um
    # dia incomodar: mais histórico aperta sozinho, ou rotular semana a semana a confiança.
    y = [math.log1p(v) for v in vals]
    alpha, beta, phi, level, trend, sigma = _fit(y)
    end = weeks[-1]["end"]
    out, damp = [], 0.0
    for h in range(1, horizon + 1):
        damp += phi**h
        mu = level + damp * trend
        s = _sigma_h(sigma, alpha, beta, phi, h)
        out.append(
            {
                "date": add_days(end, 7 * h),
                "value": round(max(math.expm1(mu), 0.0)),
                "lo": round(max(math.expm1(mu - Z80 * s), 0.0)),
                "hi": round(max(math.expm1(mu + Z80 * s), 0.0)),
            }
        )
    return {"metric": metric, "lastWeek": vals[-1], "weeks": out}


def _at_week(proj, h):
    """Ponto da projeção na semana h (a última disponível se o gate cair além dela)."""
    return proj["weeks"][min(h, len(proj["weeks"])) - 1]


def evaluate_gates(slug, weeks):
    """Kill-gates do bet: veredito só quando a data está ao alcance da projeção."""
    if slug not in GATES or not weeks:
        return []
    bet, clock = GATES[slug]
    end = weeks[-1]["end"]
    out = []
    for days, metric, threshold in GATE_SPECS:
        when = add_days(clock, days)
        g = {
            "gate": f"D+{days}",
            "date": when,
            "metric": metric,
            "threshold": threshold,
            "projected": None,
            "lo": None,
            "hi": None,
        }
        h = _weeks_between(end, when)
        unit = PT_METRIC.get(metric, metric)

        if metric is None:
            g["status"] = "nao-mensuravel"
            g["sentence"] = f"D+{days} ({_fmt_day(when)}) mede receita — fora do alcance do GSC"
            out.append(g)
            continue

        last = weeks[-1][metric]
        proj = None

        if h <= 0:  # a data já passou: julgar pelo dado, não pela projeção
            ok = last >= threshold
            g["status"] = "passou" if ok else "falhou"
            g["projected"] = last
            g["sentence"] = (
                f"D+{days} venceu em {_fmt_day(when)}: {last} {unit}/sem contra o gate "
                f"de {threshold} — {'passou' if ok else 'FALHOU'}"
            )
        elif h > MAX_GATE_WEEKS:
            # Vem antes de "sem dados" de propósito: gate longe não é problema de dado, e
            # rotular de "sem dados" mandaria caçar bug onde só falta o calendário andar.
            g["status"] = "distante"
            g["sentence"] = (
                f"D+{days} em {_fmt_day(when)} ({h} semanas): longe demais pra projetar — "
                f"hoje são {last} {unit}/sem contra o gate de {threshold}"
            )
        elif last >= threshold:
            g["status"] = "passou"
            g["projected"] = last
            g["sentence"] = (
                f"o {bet} já cruzou o gate D+{days} ({threshold} {unit}/sem) antes de "
                f"{_fmt_day(when)}: {last} {unit} na última semana"
            )
        elif (proj := project(weeks, metric)) is None:
            g["status"] = "sem-dados"
            g["sentence"] = (
                f"D+{days} em {_fmt_day(when)}: série curta ou vazia demais pra projetar "
                f"({last} {unit} na última semana)"
            )
        else:
            p = _at_week(proj, h)
            g["projected"], g["lo"], g["hi"] = p["value"], p["lo"], p["hi"]
            crosses = p["value"] >= threshold
            g["status"] = "no-ritmo" if crosses else "em-risco" if p["hi"] >= threshold else "nao-cruza"
            verb = "cruza" if crosses else "NÃO cruza"
            g["sentence"] = (
                f"no ritmo atual, o {bet} {verb} o gate D+{days} ({threshold} {unit}/sem) "
                f"em {_fmt_day(when)}: ~{p['value']} {unit}/sem projetadas "
                f"({p['lo']}–{p['hi']}), hoje {last}"
            )
        out.append(g)
    return out
