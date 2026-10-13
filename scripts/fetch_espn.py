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
VIEWS = ["mTeam", "mMatchupScore", "mSettings", "mStandings", "mNav", "mStatus"]


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


POSITIONS = {1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST"}


def fetch_projections(session, year, season):
    """Weekly projected points for every rostered player, for the rest of the regular season.

    ESPN returns a player's projections for the requested week and the week before it, so
    every other week is requested. Saved as data/raw/<year>_projections.json for build_data.py.
    """
    sched = season["settings"]["scheduleSettings"]
    reg = sched["matchupPeriodCount"]
    current = season["status"]["currentMatchupPeriod"]
    if not season["status"].get("isActive") or current > reg:
        return None
    url = f"{BASE}/seasons/{year}/segments/0/leagues/{LEAGUE_ID}"
    weeks = list(range(current, reg + 1, 2))
    if weeks[-1] < reg:
        weeks.append(reg)
    teams = {}
    for i, week in enumerate(weeks):
        r = session.get(url, params={"view": "mRoster", "scoringPeriodId": week}, timeout=30)
        r.raise_for_status()
        for t in r.json()["teams"]:
            players = teams.setdefault(str(t["id"]), {})
            for e in t["roster"]["entries"]:
                p = e["playerPoolEntry"]["player"]
                row = players.setdefault(str(p["id"]), {
                    "name": p["fullName"], "pos": POSITIONS.get(p.get("defaultPositionId"), ""),
                    "elig": p.get("eligibleSlots", []), "slot": e["lineupSlotId"], "proj": {}})
                if i == 0:
                    row["slot"] = e["lineupSlotId"]  # lineup as set for the current week
                for s in p.get("stats", []):
                    if s.get("statSourceId") == 1 and s.get("statSplitTypeId") == 1:
                        row["proj"][str(s["scoringPeriodId"])] = round(s.get("appliedTotal", 0), 2)
        time.sleep(1)
    slots = {k: v for k, v in season["settings"]["rosterSettings"]["lineupSlotCounts"].items() if v}
    return {"year": year, "currentWeek": current, "lineupSlotCounts": slots, "teams": teams}


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
        proj = fetch_projections(session, year, data) if year == current_season() else None
        if proj:
            pout = RAW_DIR / f"{year}_projections.json"
            pout.write_text(json.dumps(proj, separators=(",", ":")))
            print(f"{year}: projections from week {proj['currentWeek']} -> {pout.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
