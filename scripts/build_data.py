"""Turn the raw ESPN season files + hand-kept overrides/content into site/data/league.json.

Usage:  python3 scripts/build_data.py
Reads:  data/raw/<year>.json (from fetch_espn.py), data/overrides.json, data/content.json
League rules applied here are documented in data/league_notes.md.
"""
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "site" / "data" / "league.json"

OV = json.loads((ROOT / "data" / "overrides.json").read_text())
CONTENT = json.loads((ROOT / "data" / "content.json").read_text())
FIRST = OV["first_season"]

# muted, distinguishable owner colors (all readable with white initials)
PALETTE = ["#7a1f1f", "#2f5d50", "#6b4e16", "#4a3b73", "#2d4a6e", "#8a5a00", "#6e2d5c", "#3d6b2f",
           "#8c3b1f", "#1f5f7a", "#5a5a62", "#56701f", "#7a3b3b", "#35606e", "#6d5a2e", "#4f4a7a"]


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def playoff_format(year):
    f = OV["playoff_format"]
    return f.get(str(year)) or f[max(k for k in f if k.endswith("+") and int(k[:-1]) <= year)]


def load_season(year):
    d = json.loads((RAW / f"{year}.json").read_text())
    members = {m["id"]: clean(f'{m.get("firstName", "")} {m.get("lastName", "")}') for m in d["members"]}
    div_names = {x["id"]: x["name"] for x in d["settings"]["scheduleSettings"]["divisions"]}
    rename = OV.get("division_names", {}).get(str(year), {})
    teams = {}
    for t in d["teams"]:
        name = members.get(t["primaryOwner"], "Unknown owner")
        owner = OV["owner_aliases"].get(name, name)
        teams[t["id"]] = {
            "id": t["id"], "owner": owner, "team": clean(t.get("name") or f'{t.get("location", "")} {t.get("nickname", "")}'),
            "div": rename.get(div_names.get(t["divisionId"], ""), div_names.get(t["divisionId"], "")),
            "espnRank": t.get("rankCalculatedFinal") or 0,
        }
    reg_weeks = d["settings"]["scheduleSettings"]["matchupPeriodCount"]
    games = []
    for m in d["schedule"]:
        h, a = m["home"], m.get("away")
        tier = m["playoffTierType"]
        done = m["winner"] != "UNDECIDED" or (a is None and tier != "NONE" and m["matchupPeriodId"] < d["status"]["currentMatchupPeriod"])
        g = {"y": year, "wk": m["matchupPeriodId"], "tier": tier, "done": done,
             "a": teams[h["teamId"]]["owner"], "at": h["teamId"], "as": round(h["totalPoints"], 2),
             "b": teams[a["teamId"]]["owner"] if a else None, "bt": a["teamId"] if a else None,
             "bs": round(a["totalPoints"], 2) if a else None, "winner": None}
        if a and m["winner"] in ("HOME", "AWAY"):
            g["winner"] = g["a"] if m["winner"] == "HOME" else g["b"]
        games.append(g)
    status = d["status"]
    return {"year": year, "teams": teams, "games": games, "regWeeks": reg_weeks,
            "currentWeek": status.get("currentMatchupPeriod"),
            "complete": not status.get("isActive", False) or status.get("currentMatchupPeriod", 0) > reg_weeks + 3}


def reg_records(season, through_week=None):
    """Regular season W/L/T, PF, PA and streak per team id, from completed games."""
    rec = {tid: {"w": 0, "l": 0, "t": 0, "pf": 0.0, "pa": 0.0, "results": []} for tid in season["teams"]}
    for g in sorted(season["games"], key=lambda g: g["wk"]):
        if g["tier"] != "NONE" or not g["done"] or g["bt"] is None:
            continue
        if through_week is not None and g["wk"] > through_week:
            continue
        for me, my, opp in ((g["at"], g["as"], g["bs"]), (g["bt"], g["bs"], g["as"])):
            r = rec[me]
            r["pf"] += my; r["pa"] += opp
            res = "W" if my > opp else "L" if my < opp else "T"
            r[{"W": "w", "L": "l", "T": "t"}[res]] += 1
            r["results"].append(res)
    for r in rec.values():
        r["pf"], r["pa"] = round(r["pf"], 2), round(r["pa"], 2)
        res = r.pop("results")
        n = 0
        while n < len(res) and res[-1 - n] == res[-1]:
            n += 1
        r["streak"] = f"{res[-1]}{n}" if res else ""
    return rec


def by_record(rec):
    return lambda tid: (-rec[tid]["w"], rec[tid]["l"], -rec[tid]["pf"])


def final_places(season):
    """ESPN final ranks, corrected by the rematch rule and hand overrides."""
    teams = season["teams"]
    rank = {tid: t["espnRank"] for tid, t in teams.items()}
    post = [g for g in season["games"] if g["tier"] != "NONE" and g["bt"] is not None]
    notes = {}
    if post:
        last = max(g["wk"] for g in post)
        for g in (g for g in post if g["wk"] == last):
            a, b = g["at"], g["bt"]
            meets = [x for x in post if {x["at"], x["bt"]} == {a, b}]
            if len(meets) > 1:
                tot = lambda t: round(sum(x["as"] if x["at"] == t else x["bs"] for x in meets), 2)
                hi, lo = sorted((rank[a], rank[b]))
                w, l = (a, b) if tot(a) > tot(b) else (b, a)
                rank[w], rank[l] = hi, lo
                notes[hi] = {"combined": True, "ws": tot(w), "ls": tot(l)}
    by_owner = {t["owner"]: tid for tid, t in teams.items()}
    for o in OV["placement_overrides"]:
        if o["season"] == season["year"]:
            w, l = by_owner[o["winner"]], by_owner[o["loser"]]
            rank[w], rank[l] = o["place"], o["place"] + 1
            notes[o["place"]] = {"override": o["reason"]}
    return rank, notes


def place_game(season, rank, notes, place):
    """Winner, loser and score of the final-week game that decided `place`."""
    inv = {r: tid for tid, r in rank.items()}
    w, l = inv.get(place), inv.get(place + 1)
    if w is None or l is None:
        return None
    n = notes.get(place, {})
    if "ws" in n:
        return {"ws": n["ws"], "ls": n["ls"], "note": "Combined score of two meetings"}
    post = [g for g in season["games"] if g["tier"] != "NONE" and g["bt"] is not None and {g["at"], g["bt"]} == {w, l}]
    if not post:
        return None
    g = max(post, key=lambda g: g["wk"])
    ws, ls = (g["as"], g["bs"]) if g["at"] == w else (g["bs"], g["as"])
    out = {"ws": ws, "ls": ls}
    if "override" in n:
        out["note"] = n["override"]
    return out


def seed_teams(season, rec, rule):
    """Playoff seeds for the current season under the league's rules."""
    teams = season["teams"]
    order = sorted(teams, key=by_record(rec))
    if rule == "record":
        return {tid: i + 1 for i, tid in enumerate(order[:6])}
    divs = defaultdict(list)
    for tid in order:
        divs[teams[tid]["div"]].append(tid)
    winners = sorted((v[0] for v in divs.values()), key=by_record(rec))
    rest = [tid for tid in order if tid not in winners]
    top5 = winners + rest[:2]
    outside = sorted((tid for tid in order if tid not in top5), key=lambda t: -rec[t]["pf"])
    seeds = {tid: i + 1 for i, tid in enumerate(top5)}
    if outside:
        seeds[outside[0]] = 6
    return seeds


def power_rankings(season, rec, through):
    """All-play record (each week vs every other team) blended with actual win %."""
    scores = defaultdict(dict)
    for g in season["games"]:
        if g["tier"] == "NONE" and g["done"] and g["bt"] is not None and g["wk"] <= through:
            scores[g["wk"]][g["at"]] = g["as"]
            scores[g["wk"]][g["bt"]] = g["bs"]
    ap = {tid: [0, 0] for tid in season["teams"]}
    for wk, s in scores.items():
        for t, v in s.items():
            for u, x in s.items():
                if t != u:
                    ap[t][0 if v > x else 1] += 1 if v != x else 0.5
    out = []
    for tid in season["teams"]:
        w, l = ap[tid]
        games = rec[tid]["w"] + rec[tid]["l"] + rec[tid]["t"]
        ap_pct = w / (w + l) if w + l else 0
        win_pct = (rec[tid]["w"] + 0.5 * rec[tid]["t"]) / games if games else 0
        out.append({"tid": tid, "apW": w, "apL": l, "score": round(0.65 * ap_pct + 0.35 * win_pct, 4)})
    out.sort(key=lambda x: (-x["score"], -rec[x["tid"]]["pf"]))
    return out


def main():
    years = sorted(int(p.stem) for p in RAW.glob("*.json") if int(p.stem) >= FIRST)
    seasons = {y: load_season(y) for y in years}
    current = max(years)
    cur = seasons[current]
    # every earlier season is finished; the latest one is finished once its championship game is decided
    title_done = any(g["tier"] == "WINNERS_BRACKET" and g["winner"] and g["wk"] == max(x["wk"] for x in cur["games"])
                     for g in cur["games"])
    completed = [y for y in years if y < current or title_done]

    # ----- owners -----
    first_seen, last_team = {}, {}
    for y in years:
        for t in seasons[y]["teams"].values():
            first_seen.setdefault(t["owner"], y)
            last_team[t["owner"]] = (y, t["team"])
    ordered = sorted(first_seen, key=lambda o: (first_seen[o], o))
    owners = {o: {"initials": "".join(p[0] for p in o.split()[:2]).upper(), "color": PALETTE[i % len(PALETTE)],
                  "since": first_seen[o], "active": last_team[o][0] == current, "team": last_team[o][1]}
              for i, o in enumerate(ordered)}

    # ----- completed seasons -----
    season_out, at = {}, defaultdict(lambda: defaultdict(float))
    rec_champ, rec_tropny, rec_toilet, rec_hi_season, rec_hi_against = [], [], [], [], []
    for y in completed:
        s = seasons[y]
        rec = reg_records(s)
        rank, notes = final_places(s)
        fmt = playoff_format(y)
        playoff = {g[k] for g in s["games"] if g["tier"] == "WINNERS_BRACKET" for k in ("at", "bt") if g[k] is not None}
        finalists = {tid for tid, r in rank.items() if r <= 2}
        divs = defaultdict(list)
        for tid in sorted(s["teams"], key=by_record(rec)):
            divs[s["teams"][tid]["div"]].append(tid)
        div_winners = {v[0] for v in divs.values()}
        top_scorer = max(s["teams"], key=lambda t: (rec[t]["pf"], rec[t]["w"]))
        last_place = max(rank, key=lambda t: rank[t])
        tropny_tid = None
        if y >= OV["tropny_first_season"]:
            official = OV["tropny_winners"].get(str(y))
            tropny_tid = next((tid for tid, r in rank.items() if r == 7), None)
            if official and s["teams"][tropny_tid]["owner"] != official:
                print(f"WARNING {y}: Tropny by rule is {s['teams'][tropny_tid]['owner']}, official list says {official}")
                tropny_tid = next(tid for tid, t in s["teams"].items() if t["owner"] == official)

        rows = []
        for tid, t in s["teams"].items():
            r = rec[tid]
            rows.append({"owner": t["owner"], "team": t["team"], "div": t["div"], "w": r["w"], "l": r["l"], "t": r["t"],
                         "pf": r["pf"], "pa": r["pa"], "finish": rank[tid], "playoffs": tid in playoff,
                         "divWin": tid in div_winners, "topScorer": tid == top_scorer})
            a = at[t["owner"]]
            a["seasons"] += 1; a["w"] += r["w"]; a["l"] += r["l"]; a["t"] += r["t"]; a["pf"] += r["pf"]; a["pa"] += r["pa"]
            a["finSum"] += rank[tid]; a["po"] += tid in playoff; a["ca"] += tid in finalists; a["ch"] += rank[tid] == 1
            a["div"] += tid in div_winners; a["hi"] += tid == top_scorer; a["tr"] += tid == tropny_tid; a["tb"] += tid == last_place
            rec_hi_season.append({"owner": t["owner"], "team": t["team"], "y": y, "v": r["pf"], "rec": f'{r["w"]}–{r["l"]}', "games": r["w"] + r["l"] + r["t"]})
            rec_hi_against.append({"owner": t["owner"], "team": t["team"], "y": y, "v": r["pa"], "rec": f'{r["w"]}–{r["l"]}', "games": r["w"] + r["l"] + r["t"]})
        rows.sort(key=lambda x: x["finish"])
        season_out[y] = {"teams": rows, "playoffTeams": fmt["teams"], "regWeeks": s["regWeeks"]}

        inv = {r: tid for tid, r in rank.items()}
        ch = inv[1]
        rec_champ.append({"y": y, "owner": s["teams"][ch]["owner"], "team": s["teams"][ch]["team"],
                          "rec": f'{rec[ch]["w"]}–{rec[ch]["l"]}', "ru": s["teams"][inv[2]]["owner"], "game": place_game(s, rank, notes, 1)})
        if tropny_tid is not None:
            ru = inv.get(rank[tropny_tid] + 1)
            rec_tropny.append({"y": y, "owner": s["teams"][tropny_tid]["owner"], "team": s["teams"][tropny_tid]["team"],
                               "ru": s["teams"][ru]["owner"] if ru else None, "game": place_game(s, rank, notes, rank[tropny_tid])})
        rec_toilet.append({"y": y, "owner": s["teams"][last_place]["owner"], "team": s["teams"][last_place]["team"],
                           "rec": f'{rec[last_place]["w"]}–{rec[last_place]["l"]}', "pf": rec[last_place]["pf"]})

    # ----- single-game records (every completed game, including postseason and playoff byes) -----
    scores = []
    for y in years:
        s = seasons[y]
        for g in s["games"]:
            if not g["done"]:
                continue
            kind = "Regular season" if g["tier"] == "NONE" else "Playoff bye" if g["bt"] is None else \
                "Playoffs" if g["tier"] in ("WINNERS_BRACKET", "WINNERS_CONSOLATION_LADDER") else "Consolation"
            for me, tid, v, opp in ((g["a"], g["at"], g["as"], g["b"]), (g["b"], g["bt"], g["bs"], g["a"])):
                if me is None or (kind != "Playoff bye" and v == 0):
                    continue
                scores.append({"owner": me, "team": s["teams"][tid]["team"], "y": y, "wk": g["wk"], "v": v, "opp": opp, "kind": kind})
    real = [x for x in scores if x["kind"] != "Playoff bye"]
    records = {
        "champions": sorted(rec_champ, key=lambda x: -x["y"]),
        "tropny": sorted(rec_tropny, key=lambda x: -x["y"]),
        "toilet": sorted(rec_toilet, key=lambda x: -x["y"]),
        "hiSeason": sorted(rec_hi_season, key=lambda x: -x["v"])[:10],
        "hiAgainst": sorted(rec_hi_against, key=lambda x: -x["v"])[:10],
        "hiGame": sorted(scores, key=lambda x: -x["v"])[:10],
        "loGame": sorted(real, key=lambda x: x["v"])[:10],
    }

    all_time = []
    for o, a in at.items():
        n = int(a["seasons"])
        all_time.append({"owner": o, "szn": n, "ch": int(a["ch"]), "div": int(a["div"]), "hi": int(a["hi"]),
                         "fin": round(a["finSum"] / n, 2), "w": int(a["w"]), "l": int(a["l"]), "t": int(a["t"]),
                         "pf": round(a["pf"], 2), "pa": round(a["pa"], 2), "tr": int(a["tr"]), "tb": int(a["tb"]),
                         "ca": int(a["ca"]), "po": int(a["po"])})
    all_time.sort(key=lambda r: (-r["po"], -r["ca"], -r["hi"], -r["div"], -r["ch"], -(r["w"] / max(1, r["w"] + r["l"]))))

    # ----- current season -----
    cs = None
    if current not in completed:
        rec = reg_records(cur)
        done_weeks = sorted({g["wk"] for g in cur["games"] if g["tier"] == "NONE" and g["done"]})
        last_week = done_weeks[-1] if done_weeks else 0
        rule = playoff_format(current)["seeding"]
        seeds = seed_teams(cur, rec, rule)
        pr_now = power_rankings(cur, rec, last_week)
        prev_rank = {}
        if last_week > 1:
            prev = power_rankings(cur, reg_records(cur, last_week - 1), last_week - 1)
            prev_rank = {x["tid"]: i + 1 for i, x in enumerate(prev)}
        teams = cur["teams"]
        standings = []
        for tid in sorted(teams, key=by_record(rec)):
            r = rec[tid]
            standings.append({"owner": teams[tid]["owner"], "team": teams[tid]["team"], "div": teams[tid]["div"],
                              "w": r["w"], "l": r["l"], "t": r["t"], "pf": r["pf"], "pa": r["pa"], "streak": r["streak"],
                              "seed": seeds.get(tid)})
        week_games = lambda wk: [{"a": g["a"], "b": g["b"], "as": g["as"], "bs": g["bs"], "done": g["done"]}
                                 for g in cur["games"] if g["wk"] == wk and g["bt"] is not None]
        cs = {
            "year": current, "lastWeek": last_week, "nextWeek": last_week + 1, "regWeeks": cur["regWeeks"],
            "seeding": rule, "divisions": sorted({t["div"] for t in teams.values()}),
            "standings": standings,
            "lastResults": week_games(last_week) if last_week else [],
            "upcoming": week_games(last_week + 1) if last_week < cur["regWeeks"] else [],
            "power": [{"owner": teams[x["tid"]]["owner"], "team": teams[x["tid"]]["team"], "apW": x["apW"], "apL": x["apL"],
                       "w": rec[x["tid"]]["w"], "l": rec[x["tid"]]["l"], "pf": rec[x["tid"]]["pf"],
                       "move": (prev_rank[x["tid"]] - (i + 1)) if prev_rank else 0}
                      for i, x in enumerate(pr_now)],
        }

    # ----- head-to-head game log (completed matchups, byes excluded) -----
    h2h = [[g["y"], g["wk"], "R" if g["tier"] == "NONE" else "P" if g["tier"].startswith("WINNERS") else "C",
            g["a"], g["as"], g["b"], g["bs"]]
           for y in years for g in seasons[y]["games"] if g["done"] and g["bt"] is not None]

    out = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="minutes"),
        "firstSeason": FIRST, "completedThrough": max(completed) if completed else None,
        "owners": owners, "current": cs, "seasons": season_out, "records": records,
        "allTime": all_time, "games": h2h, "content": CONTENT,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB): seasons {years[0]}–{years[-1]}, "
          f"{len(h2h)} games, current season {'week ' + str(cs['lastWeek']) if cs else 'none'}")


if __name__ == "__main__":
    main()
