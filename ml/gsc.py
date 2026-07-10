# GSC Search Analytics extraction — mirrors lib/gsc.ts (auth, sites.list,
# resolveProperty precedence, host filter). Pulls up to 16 months of daily data:
# the long history is the whole point of the ML layer (the hub only shows 84 days).
import json
import os
from datetime import date, timedelta
from urllib.parse import quote

from google.oauth2 import service_account
from google.auth.transport.requests import AuthorizedSession

API = "https://searchconsole.googleapis.com/webmasters/v3"
SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]


def load_credentials(repo_root):
    """Env GOOGLE_SERVICE_ACCOUNT_JSON wins; falls back to the gitignored .env."""
    raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not raw:
        env_path = os.path.join(repo_root, ".env")
        if os.path.exists(env_path):
            # utf-8-sig: the .env on this machine carries a BOM (written by PowerShell)
            with open(env_path, encoding="utf-8-sig") as f:
                for line in f:
                    if line.startswith("GOOGLE_SERVICE_ACCOUNT_JSON="):
                        raw = line.split("=", 1)[1].strip()
                        break
    if not raw:
        raise SystemExit(
            "GOOGLE_SERVICE_ACCOUNT_JSON ausente (env ou .env na raiz do repo)."
        )
    return json.loads(raw)


def make_session(repo_root):
    creds = service_account.Credentials.from_service_account_info(
        load_credentials(repo_root), scopes=SCOPES
    )
    return AuthorizedSession(creds)


def list_sites(sess):
    r = sess.get(f"{API}/sites")
    r.raise_for_status()
    return [
        s["siteUrl"]
        for s in r.json().get("siteEntry", [])
        if s.get("permissionLevel") != "siteUnverifiedUser"
    ]


def resolve_property(host, site_urls):
    """Exact sc-domain > parent sc-domain > URL-prefix (same order as lib/gsc.ts)."""
    names = set(site_urls)
    labels = host.split(".")
    for i in range(len(labels) - 1):
        candidate = "sc-domain:" + ".".join(labels[i:])
        if candidate in names:
            return candidate
    return next((n for n in sorted(names) if n.startswith(f"https://{host}/")), None)


def iso_days_ago(n):
    return (date.today() - timedelta(days=n)).isoformat()


def query_timeseries(sess, prop, host, start, end):
    """Daily series; page filter isolates the project when the property covers siblings."""
    r = sess.post(
        f"{API}/sites/{quote(prop, safe='')}/searchAnalytics/query",
        json={
            "startDate": start,
            "endDate": end,
            "dimensions": ["date"],
            "dimensionFilterGroups": [
                {
                    "filters": [
                        {
                            "dimension": "page",
                            "operator": "contains",
                            "expression": f"https://{host}/",
                        }
                    ]
                }
            ],
            "rowLimit": 1000,  # 16 months ≈ 487 daily rows
        },
    )
    r.raise_for_status()
    return [
        {
            "date": row["keys"][0],
            "clicks": row["clicks"],
            "impressions": row["impressions"],
            "position": row["position"],
        }
        for row in r.json().get("rows", [])
    ]
