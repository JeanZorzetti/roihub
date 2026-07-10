# Same asserts as test/crawl.test.mjs (parse parity) + diagnostics checks.
import crawl
import diagnostics as dx


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
