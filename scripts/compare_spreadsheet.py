"""One-off check: ESPN-derived all-time regular season stats vs. the League Record Books spreadsheet.

Run after fetch_espn.py:  python3 scripts/compare_spreadsheet.py
"""
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEASONS = range(2019, 2026)  # completed seasons only

# ESPN name -> spreadsheet name (see data/league_notes.md)
ALIASES = {"Jeffrey Riley": "Jeff Riley", "Michael Legrand": "Michael LeGrand", "Nicholas Gobran": "Nick Gobran"}

# From the "All-Time League Standings" sheet, 2026-09-28 export. Seasons for Jeff Riley and
# Monica Gagne corrected to 1 and 2 (the sheet counted their 2018 season).
# name: (seasons, W, L, PF, PA, avgFinish, divTitles, playoffApps, champs)
SHEET = {
    "Wilson Kozel": (7, 58, 38, 10810.60, 10082.60, 3.7, 4, 6, 2),
    "Keenan Bergstrom": (7, 58, 38, 10253.80, 9726.42, 4.0, 5, 6, 1),
    "Ben Leighton": (7, 54, 42, 10437.70, 9668.06, 4.4, 2, 6, 1),
    "Matt Jass": (7, 48, 48, 10145.78, 10128.06, 5.4, 2, 4, 1),
    "Paul Yaeger": (7, 52, 44, 10330.86, 9992.76, 5.9, 2, 5, 1),
    "Nick Gobran": (5, 37, 33, 7363.06, 7435.78, 4.4, 1, 4, 1),
    "Kelsey Kimball": (5, 41, 29, 7719.38, 7289.96, 5.2, 2, 4, 0),
    "Quincy Kozel": (7, 45, 51, 10226.12, 10135.72, 7.6, 1, 3, 0),
    "Xavier Scott": (6, 35, 48, 8126.16, 8463.16, 8.2, 1, 2, 0),
    "Rachel Leighton": (7, 46, 50, 9766.66, 10061.20, 8.7, 1, 2, 0),
    "Jon Vogel": (7, 39, 57, 9977.78, 10386.56, 7.0, 0, 3, 0),
    "Ryan Joynes": (7, 45, 51, 9559.22, 10068.06, 9.7, 0, 1, 0),
    "Monica Gagne": (2, 8, 18, 3875.20, 4681.50, 9.5, 0, 0, 0),
    "Jarol Torres": (1, 5, 8, 1264.00, 1410.20, 11.0, 0, 0, 0),
    "Michael LeGrand": (1, 3, 10, 1117.00, 1424.70, 12.0, 0, 0, 0),
    "Jeff Riley": (1, 2, 11, 2397.10, 2969.10, 12.0, 0, 0, 0),
}


def owner_name(season, team):
    members = {m["id"]: m for m in season["members"]}
    m = members.get(team["primaryOwner"])
    name = f'{m["firstName"]} {m["lastName"]}'.strip() if m else f'?{team["primaryOwner"]}'
    return ALIASES.get(name, name)


def main():
    agg = defaultdict(lambda: defaultdict(float))
    per_season = []
    for year in SEASONS:
        d = json.loads((ROOT / "data" / "raw" / f"{year}.json").read_text())
        sched = d["settings"]["scheduleSettings"]
        for t in d["teams"]:
            o = owner_name(d, t)
            rec = t["record"]["overall"]
            divwin = min((x for x in d["teams"] if x["divisionId"] == t["divisionId"]),
                         key=lambda x: (-x["record"]["overall"]["wins"], -x["record"]["overall"]["pointsFor"]))["id"] == t["id"]
            a = agg[o]
            a["seasons"] += 1; a["w"] += rec["wins"]; a["l"] += rec["losses"]; a["t"] += rec["ties"]
            a["pf"] += rec["pointsFor"]; a["pa"] += rec["pointsAgainst"]
            a["fin"] += t["rankCalculatedFinal"]; a["div"] += divwin
            a["po"] += t["playoffSeed"] <= sched["playoffTeamCount"]
            a["ch"] += t["rankCalculatedFinal"] == 1
            per_season.append((year, o, t["name"], rec["wins"], rec["losses"], t["playoffSeed"], t["rankCalculatedFinal"]))

    names = sorted(set(agg) | set(SHEET))
    diffs = 0
    for n in names:
        a, s = agg.get(n), SHEET.get(n)
        if not a or not s:
            print(f"!! {n}: {'only in spreadsheet' if s else 'only in ESPN'}"); diffs += 1; continue
        espn = (int(a["seasons"]), int(a["w"]), int(a["l"]), round(a["pf"], 2), round(a["pa"], 2),
                round(a["fin"] / a["seasons"], 1), int(a["div"]), int(a["po"]), int(a["ch"]))
        labels = ("seasons", "W", "L", "PF", "PA", "avgFinish", "divTitles", "playoffs", "titles")
        bad = [f"{l}: sheet {sv} vs ESPN {ev}" for l, sv, ev in zip(labels, s, espn) if abs(sv - ev) > 0.011]
        if a["t"]:
            bad.append(f"ties in ESPN: {int(a['t'])}")
        if bad:
            diffs += 1
            print(f"-- {n}\n   " + "\n   ".join(bad))
    print(f"\n{len(names)} owners, {diffs} with differences")

    print("\nPer season (year, owner, team, W, L, seed, ESPN final rank):")
    for row in sorted(per_season, key=lambda r: (r[0], r[6])):
        print("  ", *row)


if __name__ == "__main__":
    main()
