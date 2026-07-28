# Entrypoint: pulls GSC (16 months) + crawl exports, runs diagnostics and writes
# data/insights.json (versioned output — commit+push = deploy, same as projects.json).
#
#   python ml/analyze.py          → writes data/insights.json
#   python ml/analyze.py --dump   → prints extracted series + 28d totals (F0 check vs hub)
import json
import os
import sys
from datetime import date
from urllib.parse import urlparse

import crawl as crawl_mod
import diagnostics as dx
import forecast as fc
import gsc

WEEKS = 68  # 68 whole weeks ≈ 16 months, the API's history ceiling


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(repo_root, "data", "projects.json"), encoding="utf-8") as f:
        projects = json.load(f)

    sess = gsc.make_session(repo_root)
    sites = gsc.list_sites(sess)
    end = gsc.iso_days_ago(3)  # GSC lags ~3 days
    start = dx.add_days(end, -(WEEKS * 7 - 1))
    crawl_by_host = crawl_mod.load_crawl(repo_root)
    dump = "--dump" in sys.argv

    out = {"generatedAt": date.today().isoformat(), "windowEnd": end, "projects": {}}
    for p in projects:
        host = urlparse(p["url"]).hostname
        prop = gsc.resolve_property(host, sites)
        crawl_entry = next(
            (e for h, e in crawl_by_host.items() if crawl_mod.host_covers(h, host)), None
        )
        if prop is None:
            out["projects"][p["slug"]] = _empty(p, "sem propriedade GSC", crawl_entry)
            continue
        try:
            raw = gsc.query_timeseries(sess, prop, host, start, end)
        except Exception as e:
            out["projects"][p["slug"]] = _empty(p, f"erro GSC: {e}", crawl_entry)
            continue

        days = dx.fill_calendar(raw, start, end)
        weeks = dx.bucket_weeks(days, end, WEEKS)
        t28 = dx.totals28(days, end)

        if dump:
            c, pr = t28["current"], t28["previous"]
            pos = "—" if c["position"] is None else f"{c['position']:.1f}"
            print(
                f"{p['slug']:<12} {prop:<32} {len(raw)} dias com dado · 28d: "
                f"cliques {c['clicks']} (ant {pr['clicks']}) · impressões {c['impressions']} "
                f"(ant {pr['impressions']}) · posição {pos}"
            )
            continue

        tr = dx.trends(weeks)
        imp12, clk12 = tr["impressions"]["12w"], tr["clicks"]["12w"]
        cps = dx.changepoints(weeks)
        an = dx.anomalies(weeks)
        crawl_diag = dx.crawl_diagnosis(crawl_entry, imp12["state"])
        health, reasons = dx.health_score(
            {"impressions": imp12, "clicks": clk12}, an, crawl_diag, t28
        )

        dx_forecast = fc.project(weeks)
        gates = fc.evaluate_gates(p["slug"], weeks)

        flags = []
        if any(g["status"] in ("nao-cruza", "falhou") for g in gates):
            flags.append("kill-gate")
        if crawl_diag["diagnosis"] in ("crawl-waste", "slow-crawl"):
            flags.append(crawl_diag["diagnosis"])
        if imp12["state"] == "declining":
            flags.append("declining")
        if any(a["direction"] == "below" for a in an):
            flags.append("anomaly")

        out["projects"][p["slug"]] = {
            "property": prop,
            "health": health,
            "reasons": reasons,
            "trend": {
                "impressions": imp12["state"],
                "clicks": clk12["state"],
                "slopePctWeek": imp12["slopePctWeek"],
                "windows": tr,
            },
            "changepoints": cps,
            "anomalies": an,
            "crawl": {"diagnosis": crawl_diag["diagnosis"], "detail": crawl_diag["detail"]},
            "forecast": dx_forecast,
            "gates": gates,
            "flags": flags,
            "narrative": None,
        }
        print(f"{p['slug']:<12} health {health:>3} · {', '.join(flags) or 'sem flags'}")
        for g in gates:
            print(f"  {g['gate']}: {g['status']}")  # ASCII only: console is cp1252

    if dump:
        return
    path = os.path.join(repo_root, "data", "insights.json")
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"wrote {path}")  # ASCII only: Windows console may be cp1252


def _empty(p, reason, crawl_entry):
    crawl_diag = dx.crawl_diagnosis(crawl_entry, "insufficient-data")
    return {
        "property": None,
        "health": None,
        "reasons": [reason],
        "trend": {"impressions": "insufficient-data", "clicks": "insufficient-data", "slopePctWeek": None, "windows": None},
        "changepoints": [],
        "anomalies": [],
        "crawl": {"diagnosis": crawl_diag["diagnosis"], "detail": crawl_diag["detail"]},
        "forecast": None,
        "gates": [],
        "flags": [],
        "narrative": None,
    }


if __name__ == "__main__":
    main()
