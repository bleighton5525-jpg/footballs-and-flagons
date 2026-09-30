"""Download raw league data from ESPN's fantasy API, one JSON file per season.

Usage:
    python3 scripts/fetch_espn.py            # every season from 2019 to the current one
    python3 scripts/fetch_espn.py 2024 2025  # just these seasons

Needs ESPN_S2 and ESPN_SWID in a .env file at the project root (see .env.example),
or set as environment variables (how the scheduled job will provide them).
"""
import json
import os
import sys
import time
from datetime import date
from pathlib import Path

import requests

LEAGUE_ID = 958519
FIRST_SEASON = 2019  # the 12-team era; 2018 (8 teams) is excluded from the record books
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"

BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"
# mTeam: teams + owners, mMatchupScore: every game's score, mSettings: divisions and
# schedule settings, mStandings: final ranks and playoff seeds, mNav: member names
VIEWS = ["mTeam", "mMatchupScore", "mSettings", "mStandings", "mNav"]


def load_env():
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    s2, swid = os.environ.get("ESPN_S2"), os.environ.get("ESPN_SWID")
    if not s2 or not swid:
        sys.exit("Missing ESPN_S2 or ESPN_SWID. Copy .env.example to .env and fill both in.")
    return {"espn_s2": s2, "SWID": swid}


def current_season():
    today = date.today()
    # the NFL season is labelled by the year it starts; before August, the latest season is last year's
    return today.year if today.month >= 8 else today.year - 1


def fetch_season(session, year):
    params = [("view", v) for v in VIEWS]
    url = f"{BASE}/seasons/{year}/segments/0/leagues/{LEAGUE_ID}"
    r = session.get(url, params=params, timeout=30)
    if r.status_code == 404:
        # older seasons sometimes live only under leagueHistory, which returns a one-item list
        r = session.get(f"{BASE}/leagueHistory/{LEAGUE_ID}", params=params + [("seasonId", year)], timeout=30)
        r.raise_for_status()
        data = r.json()
        return data[0] if isinstance(data, list) and data else data
    if r.status_code == 401:
        sys.exit("ESPN returned 401 Unauthorized. The ESPN_S2/ESPN_SWID cookies are wrong or expired.")
    r.raise_for_status()
    return r.json()


def main():
    cookies = load_env()
    years = [int(y) for y in sys.argv[1:]] or list(range(FIRST_SEASON, current_season() + 1))
    session = requests.Session()
    session.cookies.update(cookies)
    session.headers["User-Agent"] = "footballs-and-flagons-site/1.0"
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    for year in years:
        data = fetch_season(session, year)
        out = RAW_DIR / f"{year}.json"
        out.write_text(json.dumps(data, indent=1))
        teams = len(data.get("teams", []))
        games = len(data.get("schedule", []))
        print(f"{year}: {teams} teams, {games} matchups -> {out.relative_to(ROOT)}")
        time.sleep(1)  # be polite to an unofficial API


if __name__ == "__main__":
    main()
