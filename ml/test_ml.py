# Same asserts as test/crawl.test.mjs (parse parity) + diagnostics/forecast checks.
import crawl
import diagnostics as dx
import forecast as fc


def day(d, requests, ms=100):
    return {"date": d, "requests": requests, "bytes": 0, "ms": ms}


def gsc_day(d, clicks=0, impressions=0, position=0):
    return {"date": d, "clicks": clicks, "impressions": impressions, "position": position}


def test_parse_csv_bom_quotes():
    assert crawl.parse_csv('﻿a,"b,c","d""e"\n1,2,3') == [["a", "b,c", 'd"e'], ["1", "2", "3"]]


def test_parse_daily_chart_skips_header_and_junk():
    csv = "Data,Total,Bytes,Ms\n2026-07-01,923,9736711,209\nlixo,x,y,z"
    assert crawl.parse_daily_chart(csv) == [
        {"date": "2026-07-01", "requests": 923, "bytes": 9736711, "ms": 209}
    ]


def test_classify_responses_groups_by_class():
    r = crawl.classify_responses(
        crawl.parse_ratios(
            "Resposta,Relação\nOK (200),0.80\nNão modificado (304),0.05\n"
            "Movido permanentemente (301),0.04\nNão encontrado (404),0.06\n"
            "Erro do servidor (5xx),0.02\nFalha de DNS,0.03"
        )
    )
    rounded = {k: round(v, 4) for k, v in r.items()}
    assert rounded == {"ok": 0.85, "redirect": 0.04, "notFound": 0.06, "serverError": 0.02, "other": 0.03}


def test_merge_exports_newest_wins():
    merged = crawl.merge_exports(
        [
            {"exportDate": "2026-07-10", "days": [day("2026-07-01", 999), day("2026-07-02", 5)]},
            {"exportDate": "2026-07-03", "days": [day("2026-06-30", 1), day("2026-07-01", 2)]},
        ]
    )
    assert [(d["date"], d["requests"]) for d in merged] == [
        ("2026-06-30", 1),
        ("2026-07-01", 999),
        ("2026-07-02", 5),
    ]


def test_crawl_totals28_window_split():
    days = [day("2026-06-10", 3, 90), day("2026-06-09", 5, 50)]
    t = dx.crawl_totals28(days, "2026-07-07")
    assert (t["current"]["requests"], t["current"]["ms"]) == (3, 90)
    assert (t["previous"]["requests"], t["previous"]["ms"]) == (5, 50)


def test_fill_calendar_zeros_missing_days():
    days = dx.fill_calendar([gsc_day("2026-07-02", clicks=3, impressions=10)], "2026-07-01", "2026-07-03")
    assert [d["date"] for d in days] == ["2026-07-01", "2026-07-02", "2026-07-03"]
    assert [d["clicks"] for d in days] == [0, 3, 0]


def test_bucket_weeks_weighted_position_and_empty_week():
    days = [
        gsc_day("2026-07-06", impressions=10, position=2),
        gsc_day("2026-07-07", impressions=30, position=6),
    ]
    weeks = dx.bucket_weeks(days, "2026-07-07", 2)
    assert weeks[1]["impressions"] == 40
    assert weeks[1]["position"] == (2 * 10 + 6 * 30) / 40  # 5.0
    assert weeks[0]["impressions"] == 0 and weeks[0]["position"] is None


def test_trend_metric_states():
    up = [{"impressions": 10 + 5 * i} for i in range(12)]
    down = [{"impressions": 100 - 6 * i} for i in range(12)]
    flat = [{"impressions": 50} for _ in range(12)]
    sparse = [{"impressions": 1} for _ in range(12)]
    assert dx.trend_metric(up, "impressions", 12)["state"] == "improving"
    assert dx.trend_metric(down, "impressions", 12)["state"] == "declining"
    assert dx.trend_metric(flat, "impressions", 12)["state"] == "flat"
    assert dx.trend_metric(sparse, "impressions", 12)["state"] == "insufficient-data"
    assert dx.trend_metric(up, "impressions", 26)["state"] == "insufficient-data"  # short series


def test_anomaly_detects_crash_and_skips_sparse():
    weeks = [{"clicks": 100 + (i % 3), "impressions": 2} for i in range(12)]
    weeks.append({"clicks": 0, "impressions": 2})  # clicks crashed; impressions too sparse
    found = dx.anomalies(weeks)
    assert [a["metric"] for a in found] == ["clicks"]
    assert found[0]["direction"] == "below"


def test_changepoint_detects_step_up():
    weeks = [{"start": f"2026-01-{i + 1:02d}", "impressions": 10} for i in range(20)]
    for i in range(20, 40):
        weeks.append({"start": f"2026-02-{i - 19:02d}", "impressions": 100})
    cps = dx.changepoints(weeks)
    assert len(cps) >= 1
    assert cps[-1]["direction"] == "up"


def test_health_score_clamped_with_reasons():
    trend12 = {
        "impressions": {"state": "declining", "slopePctWeek": -8.0},
        "clicks": {"state": "declining", "slopePctWeek": -5.0},
    }
    anomalies = [{"metric": "clicks", "direction": "below", "value": 0, "expected": 10, "z": -5.0}]
    crawl_diag = {"diagnosis": "crawl-waste", "detail": "", "okPct": 0.4}
    t28 = {
        "current": {"clicks": 0, "impressions": 200, "position": 30.0},
        "previous": {"clicks": 10, "impressions": 400, "position": 20.0},
    }
    score, reasons = dx.health_score(trend12, anomalies, crawl_diag, t28)
    assert 0 <= score <= 100 and score < 50
    assert len(reasons) >= 4


# --- F3: forecast + kill-gates ---------------------------------------------------------
# LAST_END fixo: os gates são datas absolutas da tese, então o veredito só é determinístico
# com a ponta da série fixa. 2026-07-25 → D+90 do aftercare (30/08) cai em 6 semanas.
LAST_END = "2026-07-25"


def series(values, metric="impressions", last_end=LAST_END):
    out = []
    for i, v in enumerate(values):
        end = dx.add_days(last_end, -7 * (len(values) - 1 - i))
        out.append({"start": dx.add_days(end, -6), "end": end, "clicks": 0, "impressions": 0, metric: v})
    return out


def test_project_none_on_dead_or_sparse_series():
    assert fc.project(series([0] * 12)) is None
    assert fc.project(series([1] * 12)) is None  # viva, mas total abaixo do mínimo
    assert fc.project(series([50, 60, 70])) is None  # histórico curto demais


def test_project_trims_dead_prefix_and_projects_growth():
    proj = fc.project(series([0] * 30 + [3, 1, 11, 10, 20, 45, 93]))
    assert proj["lastWeek"] == 93  # zeros antigos não entram na série ajustada
    assert len(proj["weeks"]) == fc.HORIZON
    assert proj["weeks"][0]["date"] == "2026-08-01" and proj["weeks"][-1]["date"] == "2026-09-19"
    assert proj["weeks"][-1]["value"] > 93  # curva subindo → projeção acima da última semana
    for w in proj["weeks"]:
        assert 0 <= w["lo"] <= w["value"] <= w["hi"]


def test_interval_widens_with_horizon():
    proj = fc.project(series([40, 55, 48, 70, 66, 90, 85, 110]))
    spreads = [w["hi"] - w["lo"] for w in proj["weeks"]]
    assert spreads == sorted(spreads) and spreads[-1] > spreads[0]


def test_gate_d90_kill_when_flat_below_threshold():
    g = fc.evaluate_gates("aftercare", series([10] * 12))[0]
    assert (g["gate"], g["date"], g["threshold"]) == ("D+90", "2026-08-30", 100)
    assert g["status"] == "nao-cruza"
    assert "NÃO cruza" in g["sentence"]


def test_gate_d90_passed_when_already_above_threshold():
    g = fc.evaluate_gates("reviewshield", series([300] * 12))[0]
    assert g["status"] == "passou" and g["projected"] == 300


def test_gate_far_and_revenue_gates_have_no_forecast_verdict():
    gates = fc.evaluate_gates("aftercare", series([10] * 12))
    assert [g["gate"] for g in gates] == ["D+90", "D+180", "D+270"]
    assert gates[1]["status"] == "distante"  # 28/11 está a 18 semanas: além do alcance
    assert gates[2]["status"] == "nao-mensuravel" and gates[2]["projected"] is None


def test_gates_only_for_bets_with_a_clock():
    assert fc.evaluate_gates("goiania", series([500] * 12)) == []
    assert fc.evaluate_gates("aftercare", []) == []
