# League rules the ESPN data doesn't capture

Source: the league commissioner (Ben Leighton), 2026-09-28.

## Scope
- Record books cover 2019 onward. 2018 was an 8-team league and is excluded.
- Wins, losses, points for and points against in the all-time standings are regular season only.

## Owner history (team handovers)
ESPN owner names that differ from the spreadsheet, and who took over each team:

| ESPN name | Spreadsheet name | Seasons | Team name(s) | Team taken over by |
|---|---|---|---|---|
| Jeffrey Riley | Jeff Riley | 2019 (spreadsheet shows 2 seasons) | Thielen Mythelf | Michael LeGrand (likely) |
| Jarol Torres | Jarol Torres | 2019 | Wambology M | Xavier Scott (likely) |
| Monica Gagne | Monica Gagne | 2019–2020 (spreadsheet shows 3 seasons) | The Osmonian Cliff Divers (2019), The Raging K. Hunts (2020) | Nicholas Gobran |
| Michael Legrand | Michael LeGrand | 2020 | League of LeGrands | Kelsey Kimball |
| Nicholas Gobran | Nick Gobran | | | |

Stats belong to the owner, not the ESPN team slot.

Other ESPN names that need mapping: "Matt J" = Matt Jass (2022 onward), "Rachel Ketz" = Rachel Leighton,
"Jarol  Torres" (double space in ESPN) = Jarol Torres.

Jeff Riley and Monica Gagne also played in 2018. The spreadsheet counts that season in their seasons
(2 and 3) and in their points for/against; the site counts 2019+ only (1 and 2 seasons).

## What ESPN gets right and wrong (checked 2026-09-28 against the spreadsheet)
- Playoff format: 8 teams / 13-week regular season in 2019–2020; 6 teams / 14 weeks from 2021.
- Seeding history (confirmed by commissioner): 2019–2020 by record, points for as tiebreaker.
  6-team playoff from 2021. The 6th seed rule (6th seed = top scorer outside seeds 1–5) took effect in 2022.
- Data decisions (approved): use ESPN's exact scores; count 2019+ only for every owner (fixes Jeff's and
  Monica's points); use ESPN for Kelsey's points against (7,407.80).
- ESPN's `playoffSeed` field does not match who actually played in the playoffs (2022, 2024, 2025).
  Count playoff appearances from WINNERS_BRACKET games instead; that matches the spreadsheet.

## Trophies
- **Toilet Bowl:** the last-place finisher.
- **Tropny:** started in 2021 with the 6-team playoff; it's 7th place (the top of the consolation ladder).
  Official winners and the 2022 Damar Hamlin ruling are in data/overrides.json.
- **Rematch rule (confirmed):** any final-week placement game between two teams that already met in the
  postseason is decided by their combined score across those meetings. Applies to both the consolation
  ladder and the playoff losers' bracket (e.g. 5th place), every season.
- Original note: the Tropny is the winner of ESPN's consolation bracket. The bracket is a ladder, so a team can play twice;
  the winner is decided by the **cumulative score of both consolation matchups**, not by ESPN's bracket result.
- Final standings for non-playoff places follow the same cumulative-score ranking, which feeds **average finish**.
  ESPN's own final ranks may disagree for these places and need reconciling.
