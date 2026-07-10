# Statistical diagnostics over the GSC daily series and crawl exports.
# Robust stats on a tiny dataset (10 projects, weekly grain): Theil-Sen trend,
# PELT changepoints, MAD anomalies, crawl↔SEO diagnosis, explainable 0–100 health.
from datetime import date, timedelta
from statistics import median

import numpy as np
from scipy.stats import theilslopes

try:
    import ruptures as rpt
except ImportError:  # ponytail: naive fallback if ruptures has no cp313 wheel
    rpt = None

TREND_WINDOWS = (4, 12, 26)
FLAT_PCT_WEEK = 2.0  # |slope| ≤ 2%/week of the window mean = flat
SPARSE_TOTAL = 30  # less than this over the window → insufficient-data


def add_days(iso, n):
    return (date.fromisoformat(iso) + timedelta(days=n)).isoformat()


def fill_calendar(days, start, end):
    """GSC omits days with zero impressions — reindex on the calendar with fill 0."""
    by_date = {d["date"]: d for d in days}
    out = []
    d = start
    while d <= end:
        out.append(by_date.get(d) or {"date": d, "clicks": 0, "impressions": 0, "position": 0})
        d = add_days(d, 1)
    return out


def _sum_window(by_date, start, end):
    clicks = impressions = pos_weighted = 0
    d = start
    while d <= end:
        row = by_date.get(d)
        d = add_days(d, 1)
        if not row:
            continue
        clicks += row["clicks"]
        impressions += row["impressions"]
        pos_weighted += row["position"] * row["impressions"]
    return {
        "clicks": clicks,
        "impressions": impressions,
        "position": pos_weighted / impressions if impressions > 0 else None,
    }


def bucket_weeks(days, end, weeks):
    """7-day buckets closing at `end`, oldest first — mirrors lib/series.mjs."""
    by_date = {d["date"]: d for d in days}
    out = []
    for i in range(weeks - 1, -1, -1):
        b_end = add_days(end, -7 * i)
        b_start = add_days(b_end, -6)
        out.append({"start": b_start, "end": b_end, **_sum_window(by_date, b_start, b_end)})
    return out


def totals28(days, end):
    by_date = {d["date"]: d for d in days}
    return {
        "current": _sum_window(by_date, add_days(end, -27), end),
        "previous": _sum_window(by_date, add_days(end, -55), add_days(end, -28)),
    }


def trend_metric(weeks, metric, window):
    """Theil-Sen slope over the last `window` weekly values, as % of the window mean."""
    vals = [w[metric] for w in weeks][-window:]
    if len(vals) < window or sum(vals) < SPARSE_TOTAL:
        return {"state": "insufficient-data", "slopePctWeek": None}
    slope = theilslopes(vals, range(len(vals)))[0]
    pct = slope / (sum(vals) / len(vals)) * 100 + 0.0  # +0.0 kills "-0.0"
    state = "improving" if pct > FLAT_PCT_WEEK else "declining" if pct < -FLAT_PCT_WEEK else "flat"
    return {"state": state, "slopePctWeek": round(pct, 1)}


def trends(weeks):
    out = {}
    for metric in ("clicks", "impressions"):
        out[metric] = {f"{w}w": trend_metric(weeks, metric, w) for w in TREND_WINDOWS}
    return out


def _detect_breaks(vals):
    """Indices where a new mean segment starts (conservative penalty: big breaks only)."""
    sig = np.asarray(vals, dtype=float)
    sd = sig.std() or 1.0
    norm = (sig - sig.mean()) / sd
    pen = 3 * np.log(len(vals))
    if rpt is not None:
        return [b for b in rpt.Pelt(model="l2", min_size=4).fit(norm).predict(pen=pen) if b < len(vals)]
    # ponytail: single-split binary segmentation, enough until ruptures installs
    n = len(norm)
    best, best_gain = None, pen
    for b in range(4, n - 3):
        left, right = norm[:b], norm[b:]
        gain = len(left) * len(right) / n * (left.mean() - right.mean()) ** 2
        if gain > best_gain:
            best, best_gain = b, gain
    return [best] if best is not None else []


def changepoints(weeks, metric="impressions", min_rel_change=0.25, max_points=3):
    """Mean shifts on the weekly series → "impressions broke upward in week X"."""
    vals = [w[metric] for w in weeks]
    if len(vals) < 12:
        return []
    out = []
    for b in _detect_breaks(vals):
        before = vals[max(0, b - 8) : b]
        after = vals[b : b + 8]
        if not before or not after:
            continue
        mb = sum(before) / len(before)
        ma = sum(after) / len(after)
        rel = (ma - mb) / max(mb, 1.0)
        if abs(rel) >= min_rel_change and mb + ma >= 20:  # ignore noise on dead series
            out.append(
                {
                    "date": weeks[b]["start"],
                    "metric": metric,
                    "direction": "up" if rel > 0 else "down",
                    "changePct": round(rel * 100),
                }
            )
    return out[-max_points:]


def anomalies(weeks, k=3.0, lookback=12):
    """Last closed week vs rolling median ± k·MAD of the previous `lookback` weeks."""
    if len(weeks) < lookback + 1:
        return []
    last = weeks[-1]
    hist = weeks[-1 - lookback : -1]
    out = []
    for metric in ("clicks", "impressions"):
        vals = [w[metric] for w in hist]
        med = median(vals)
        if med < 5:  # dead/sparse series: no meaningful "normal" to deviate from
            continue
        scale = 1.4826 * median([abs(v - med) for v in vals]) or max(med * 0.25, 1.0)
        z = (last[metric] - med) / scale
        if abs(z) >= k:
            out.append(
                {
                    "metric": metric,
                    "direction": "above" if z > 0 else "below",
                    "value": last[metric],
                    "expected": round(med),
                    "z": round(z, 1),
                }
            )
    return out


def crawl_totals28(days, end):
    """Requests + response time (weighted by requests) for [end-27..end] vs the 28d before."""

    def win(start, stop):
        by_date = {d["date"]: d for d in days}
        requests = ms_weighted = 0
        d = start
        while d <= stop:
            row = by_date.get(d)
            d = add_days(d, 1)
            if not row:
                continue
            requests += row["requests"]
            ms_weighted += row["ms"] * row["requests"]
        return {"requests": requests, "ms": ms_weighted / requests if requests > 0 else None}

    return {
        "current": win(add_days(end, -27), end),
        "previous": win(add_days(end, -55), add_days(end, -28)),
    }


def _pct(r):
    return f"{r * 100:.1f}".replace(".", ",") + "%"


def crawl_diagnosis(entry, impressions_state):
    """Crawl waste (budget burned on non-OK responses) and slow-crawl (Google giving up)."""
    if entry is None:
        return {"diagnosis": "no-data", "detail": "sem export de crawl stats", "okPct": None}
    resp = entry["resp"]
    t = crawl_totals28(entry["days"], entry["days"][-1]["date"])
    cur, prev = t["current"], t["previous"]
    slow = (
        cur["ms"] is not None
        and prev["ms"] is not None
        and cur["ms"] > prev["ms"] * 1.2
        and cur["requests"] < prev["requests"] * 0.8
    )
    if resp["ok"] < 0.85:
        worst = [
            f"{_pct(resp[key])} {label}"
            for key, label in (("redirect", "redirect"), ("notFound", "404"), ("serverError", "5xx"), ("other", "outros"))
            if resp[key] >= 0.05
        ]
        detail = f"só {_pct(resp['ok'])} OK ({' · '.join(worst)})"
        if impressions_state in ("flat", "declining"):
            detail += " com impressões estagnadas — crawl budget queimado"
        return {"diagnosis": "crawl-waste", "detail": detail, "okPct": round(resp["ok"], 4)}
    if slow:
        return {
            "diagnosis": "slow-crawl",
            "detail": f"resposta {round(prev['ms'])}→{round(cur['ms'])} ms e requisições em queda — Google desiste de site lento",
            "okPct": round(resp["ok"], 4),
        }
    return {"diagnosis": "ok", "detail": f"{_pct(resp['ok'])} OK", "okPct": round(resp["ok"], 4)}


def health_score(trend12, anomaly_list, crawl, t28):
    """0–100 with the applied reasons listed — explainable, never just the number."""
    score = 50
    reasons = []

    def apply(delta, why):
        nonlocal score
        score += delta
        reasons.append(f"{why}: {'+' if delta >= 0 else ''}{delta}")

    imp, clk = trend12["impressions"], trend12["clicks"]
    imp_deltas = {"improving": 15, "flat": 5, "declining": -15}
    if imp["state"] in imp_deltas:
        apply(imp_deltas[imp["state"]], f"impressões 12sem {PT_STATE[imp['state']]} ({imp['slopePctWeek']:+.1f}%/sem)".replace(".", ","))
    else:
        reasons.append("impressões 12sem: sem dados suficientes")
    clk_deltas = {"improving": 10, "flat": 3, "declining": -10}
    if clk["state"] in clk_deltas:
        apply(clk_deltas[clk["state"]], f"cliques 12sem {PT_STATE[clk['state']]}")

    below = [a for a in anomaly_list if a["direction"] == "below"]
    above = [a for a in anomaly_list if a["direction"] == "above"]
    if below:
        apply(max(-20, -10 * len(below)), f"{len(below)} anomalia(s) abaixo do normal na última semana")
    if above:
        apply(5, "semana anormalmente acima do normal")

    if crawl["okPct"] is not None:
        if crawl["okPct"] < 0.7:
            apply(-20, f"crawl crítico ({_pct(crawl['okPct'])} OK)")
        elif crawl["okPct"] < 0.85:
            apply(-10, f"crawl com desperdício ({_pct(crawl['okPct'])} OK)")
        else:
            apply(10, f"crawl saudável ({_pct(crawl['okPct'])} OK)")
    if crawl["diagnosis"] == "slow-crawl":
        apply(-10, "resposta subindo com crawl caindo")

    cur, prev = t28["current"], t28["previous"]
    if cur["position"] is not None and prev["position"] is not None and cur["impressions"] >= 100:
        if cur["position"] < prev["position"] - 0.5:
            apply(5, f"posição média melhorou ({prev['position']:.1f}→{cur['position']:.1f})".replace(".", ","))
        elif cur["position"] > prev["position"] + 0.5:
            apply(-5, f"posição média piorou ({prev['position']:.1f}→{cur['position']:.1f})".replace(".", ","))

    return max(0, min(100, score)), reasons


PT_STATE = {"improving": "subindo", "flat": "estáveis", "declining": "caindo"}
