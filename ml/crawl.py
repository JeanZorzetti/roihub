# Crawl-stats export parsing — 1:1 port of lib/crawl.mjs + the docs/ scan from
# app/infra/page.tsx. Headers are localized (pt-BR): parse by column POSITION,
# never by name. Files are UTF-8 with BOM.
import csv
import os
import re

EXPORT_DIR_RE = re.compile(r"^(.+)-Crawl-stats-(\d{4}-\d{2}-\d{2})$", re.IGNORECASE)
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CODE_RE = re.compile(r"\((\d[\dx]{2})\)", re.IGNORECASE)


def _num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def parse_csv(text):
    return list(csv.reader(text.lstrip("﻿").splitlines()))


def parse_daily_chart(text):
    """Summary chart: date, total requests, bytes, avg response time (ms)."""
    return [
        {"date": r[0], "requests": _num(r[1]), "bytes": _num(r[2]), "ms": _num(r[3])}
        for r in parse_csv(text)[1:]
        if r and DATE_RE.match(r[0])
    ]


def parse_ratios(text):
    return [{"label": r[0], "ratio": _num(r[1])} for r in parse_csv(text)[1:] if r]


def classify_responses(ratios):
    """Label carries "(200)", "(404)" or grouped "(5xx)"; no code (DNS, robots…) → other.
    2xx and 304 = ok; 3xx = redirect; 404/410 = notFound; 5xx = serverError; other 4xx = other."""
    out = {"ok": 0.0, "redirect": 0.0, "notFound": 0.0, "serverError": 0.0, "other": 0.0}
    for row in ratios:
        m = CODE_RE.search(row["label"])
        code = m.group(1).lower() if m else None
        if not code:
            out["other"] += row["ratio"]
        elif code.startswith("2") or code == "304":
            out["ok"] += row["ratio"]
        elif code.startswith("3"):
            out["redirect"] += row["ratio"]
        elif code in ("404", "410"):
            out["notFound"] += row["ratio"]
        elif code.startswith("5"):
            out["serverError"] += row["ratio"]
        else:
            out["other"] += row["ratio"]
    return out


def merge_exports(exps):
    """Merge overlapping 90-day exports of one host: dedupe by date, newest export wins."""
    by_date = {}
    for e in sorted(exps, key=lambda e: e["exportDate"]):
        for d in e["days"]:
            by_date[d["date"]] = d
    return sorted(by_date.values(), key=lambda d: d["date"])


def find_exports(docs_dir):
    """Recursive scan for "{host}-Crawl-stats-YYYY-MM-DD" folders (same convention as /infra)."""
    out = []
    if not os.path.isdir(docs_dir):
        return out
    for root, dirs, _files in os.walk(docs_dir):
        for name in dirs:
            m = EXPORT_DIR_RE.match(name)
            if m:
                out.append(
                    {
                        "host": m.group(1).lower(),
                        "exportDate": m.group(2),
                        "dir": os.path.join(root, name),
                    }
                )
    return out


def _read_csv_file(dirpath, pattern):
    """Inner file names are localized — match by accent-free keyword like /infra does."""
    try:
        for f in os.listdir(dirpath):
            if re.search(pattern, f, re.IGNORECASE):
                with open(os.path.join(dirpath, f), encoding="utf-8-sig") as fh:
                    return fh.read()
    except OSError:
        pass
    return None


def load_crawl(repo_root):
    """host → {days (merged daily series), resp (latest export's response classes), lastExport}."""
    by_host = {}
    for e in find_exports(os.path.join(repo_root, "docs")):
        by_host.setdefault(e["host"], []).append(e)

    out = {}
    for host, exps in by_host.items():
        days = merge_exports(
            [
                {
                    "exportDate": e["exportDate"],
                    "days": parse_daily_chart(_read_csv_file(e["dir"], r"resumo|chart") or ""),
                }
                for e in exps
            ]
        )
        if not days:
            continue
        latest = max(exps, key=lambda e: e["exportDate"])
        out[host] = {
            "days": days,
            "resp": classify_responses(
                parse_ratios(_read_csv_file(latest["dir"], r"respostas|response") or "")
            ),
            "lastExport": latest["exportDate"],
        }
    return out


def host_covers(crawl_host, project_host):
    """Same coverage rule as /infra: exact host or subdomain of the crawl property."""
    return project_host == crawl_host or project_host.endswith("." + crawl_host)
