/* Footballs & Flagons league site. Renders every page from data/league.json (built by scripts/build_data.py). */
(async function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const f1 = n => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const f2 = n => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } };

  let D;
  try {
    const r = await fetch("data/league.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    D = await r.json();
  } catch (e) {
    $("loading").outerHTML = '<p class="err">The league data didn\'t load. Refresh the page to try again.</p>';
    return;
  }
  $("loading").remove();

  const O = D.owners, C = D.current, CT = D.content, R = D.records;
  const first = n => n.split(" ")[0];
  const crest = o => `<span class="crest" style="background:${(O[o] || {}).color || "#5a5a62"}">${esc((O[o] || {}).initials || "?")}</span>`;
  const who = (o, sub) => `<span class="tm">${crest(o)}<span><b>${esc(o)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span></span>`;
  const rec = r => `${r.w}–${r.l}${r.t ? "–" + r.t : ""}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  $("tagline").textContent = `Fantasy Football League · Est. ${CT.founded}`;
  $("updated").textContent = "Updated " + new Date(D.generated).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  /* ---------- current season: seeding ---------- */
  const S = C ? C.standings : [];
  const top5 = S.filter(r => r.seed && r.seed <= 5).sort((a, b) => a.seed - b.seed);
  const outside = S.filter(r => !r.seed || r.seed > 5);
  const race = [...outside].sort((a, b) => b.pf - a.pf);
  const fifth = top5[4];
  const gb = r => { const g = ((fifth.w - r.w) + (r.l - fifth.l)) / 2; return g <= 0 ? "—" : g };
  const seedCell = r => `<span class="seed${r.seed === 6 ? " six" : r.seed ? "" : " none"}">${r.seed || "–"}</span>`;
  const divWinners = new Set(top5.slice(0, 3).map(r => r.owner));
  const teamOf = o => (S.find(r => r.owner === o) || {}).team || "";

  /* ---------- hero ---------- */
  const champ = R.champions[0];
  const champTitles = R.champions.filter(c => c.owner === champ.owner).map(c => c.y).sort();
  const wkLabel = C ? `${C.year} Season · ${C.lastWeek ? "Through Week " + C.lastWeek : "Preseason"}` : `${D.completedThrough} Season complete`;
  $("heroIn").innerHTML = `
    <div>
      <div class="eyebrow">${wkLabel}</div>
      <h1>The Trojan War is Upon Us</h1>
      <p>The official hub of the Footballs &amp; Flagons Fantasy Football League. Standings, the playoff race, rivalries and every record since the league went to 12 teams.</p>
      <div class="ctas"><a class="btn" href="#season" data-tab="tab-po">Playoff picture</a><a class="btn ghost" href="#records">Record books</a></div>
    </div>
    <div class="champ">
      <div class="yr">Reigning champion · ${champ.y}</div>
      <div class="nm">${esc(champ.owner)}</div>
      <div class="meta">${esc(champ.team)} · ${champ.rec} regular season${champ.game ? ` · beat ${esc(champ.ru)} ${f2(champ.game.ws)}–${f2(champ.game.ls)}` : ""}</div>
      <div class="meta">${champTitles.length > 1 ? `${champTitles.length} titles (${champTitles.join(", ")})` : "1st title"}</div>
    </div>`;
  document.querySelectorAll('[data-tab]').forEach(a => a.addEventListener("click", () => showTab(a.dataset.tab)));

  /* ---------- home ---------- */
  const recOf = o => { const r = S.find(x => x.owner === o); return r ? rec(r) : "" };
  const matchRow = (g, scores) => `<div class="match">${who(g.a, scores ? teamOf(g.a) : recOf(g.a))}
    <span class="sc">${scores ? `${f2(g.as)}<br>${f2(g.bs)}` : '<span class="vs">vs</span>'}</span>
    <span class="tm r"><span style="text-align:right"><b>${esc(g.b)}</b><small>${esc(scores ? teamOf(g.b) : recOf(g.b))}</small></span>${crest(g.b)}</span></div>`;
  if (C) {
    $("upTitle").textContent = C.upcoming.length ? `Week ${C.nextWeek} matchups` : "Regular season complete";
    $("upSub").textContent = C.upcoming.length ? "Records through last week" : "";
    $("homeUpcoming").innerHTML = C.upcoming.map(g => matchRow(g, false)).join("") || '<p class="empty">The playoffs are underway.</p>';
    $("lastTitle").textContent = C.lastWeek ? `Week ${C.lastWeek} results` : "Last week";
    $("homeLast").innerHTML = C.lastResults.map(g => {
      const aw = g.as > g.bs;
      return `<div class="match">${who(g.a, teamOf(g.a))}<span class="sc"><span class="${aw ? "" : "eq"}">${f2(g.as)}</span><br><span class="${aw ? "eq" : ""}">${f2(g.bs)}</span></span>
        <span class="tm r"><span style="text-align:right"><b>${esc(g.b)}</b><small>${esc(teamOf(g.b))}</small></span>${crest(g.b)}</span></div>`;
    }).join("") || '<p class="empty">No games played yet.</p>';
    $("homePoSub").textContent = `Through Week ${C.lastWeek}`;
    $("homeStand").innerHTML = `<thead><tr><th class="c">Seed</th><th class="l">Owner</th><th>W–L</th><th>PF</th></tr></thead><tbody>${[...top5, race[0]].filter(Boolean).map(r => `<tr><td class="c">${seedCell(r)}</td><td class="l">${who(r.owner, r.team)}</td><td>${rec(r)}</td><td>${f1(r.pf)}</td></tr>`).join("")}</tbody>`;
    const p1 = C.power[0];
    $("homePR").innerHTML = `${who(p1.owner, p1.team)}<p style="margin:10px 0 14px">${esc(CT.powerNotes[p1.owner] || `${p1.w}–${p1.l} with a ${p1.apW}–${p1.apL} all-play record and ${f1(p1.pf)} points.`)}</p><a class="btn" href="#power">Full rankings</a>`;
  }
  const latest = CT.changelog[0];
  const lab = { add: ["p-add", "Added"], chg: ["p-chg", "Changed"], rem: ["p-rem", "Removed"] };
  $("homeRule").innerHTML = `<p class="sub" style="margin:0 0 10px;font-size:13px">${esc(latest.label)}</p>${latest.items.slice(0, 3).map(i => `<p style="margin:0 0 10px"><span class="pill ${lab[i[0]][0]}">${lab[i[0]][1]}</span> ${esc(i[1])}</p>`).join("")}<p style="margin:14px 0 0"><a class="btn" href="#rules">Open rulebook</a></p>`;

  /* ---------- season ---------- */
  if (C) {
    $("seasonEyebrow").textContent = `${C.year} season · through Week ${C.lastWeek} of ${C.regWeeks}`;
    $("seasonTable").innerHTML = `<thead><tr><th>Owner</th><th class="c">Seed</th><th class="l hide-sm">Div</th><th>W–L</th><th>PF</th><th class="hide-sm">PA</th><th class="hide-sm">Diff</th><th>Strk</th></tr></thead><tbody>${S.map((r, k) => `<tr><td><span class="tm"><span class="rk">${k + 1}</span>${crest(r.owner)}<span><b>${esc(r.owner)}</b><small>${esc(r.team)}</small></span></span></td><td class="c">${seedCell(r)}</td><td class="l hide-sm">${esc(r.div)}</td><td>${rec(r)}</td><td>${f1(r.pf)}</td><td class="hide-sm">${f1(r.pa)}</td><td class="hide-sm">${(r.pf >= r.pa ? "+" : "") + f1(r.pf - r.pa)}</td><td>${r.streak}</td></tr>`).join("")}</tbody>`;

    const statusPill = r => r.seed <= 3 ? `<span class="pill p-div">Leading ${esc(r.div)}${r.seed <= 2 ? " · Bye" : ""}</span>` : '<span class="pill p-in">In · Record</span>';
    const bubble = outside.slice(0, 3);
    $("poTop").innerHTML = `<thead><tr><th class="c">Seed</th><th class="l">Owner</th><th class="l hide-sm">Div</th><th>W–L</th><th>PF</th><th class="l">Status</th></tr></thead><tbody>
      ${top5.map(r => `<tr><td class="c">${seedCell(r)}</td><td class="l">${who(r.owner, r.team)}</td><td class="l hide-sm">${esc(r.div)}</td><td>${rec(r)}</td><td>${f1(r.pf)}</td><td class="l">${statusPill(r)}</td></tr>`).join("")}
      <tr class="sep"><td colspan="6">On the bubble · games back of the 5th seed</td></tr>
      ${bubble.map(r => `<tr><td class="c">${seedCell(r)}</td><td class="l">${who(r.owner, r.team)}</td><td class="l hide-sm">${esc(r.div)}</td><td>${rec(r)} <small class="sub">(${gb(r)} GB)</small></td><td>${f1(r.pf)}</td><td class="l">${r.seed === 6 ? '<span class="pill p-six">Holds 6th seed</span>' : '<span class="pill p-bub">Bubble</span>'}</td></tr>`).join("")}</tbody>`;
    $("poSix").innerHTML = `<thead><tr><th class="c">#</th><th class="l">Owner</th><th>PF</th><th>Behind</th><th>W–L</th><th class="l">Status</th></tr></thead><tbody>${race.map((r, i) => `<tr class="${i === 0 ? "lead" : ""}"><td class="c"><span class="rk">${i + 1}</span></td><td class="l">${who(r.owner, r.team)}</td><td class="pts">${f1(r.pf)}</td><td>${i ? "−" + f1(race[0].pf - r.pf) : "—"}</td><td>${rec(r)}</td><td class="l">${i === 0 ? '<span class="pill p-six">6th seed</span>' : i < 3 ? '<span class="pill p-bub">Chasing</span>' : '<span class="pill p-out">Long shot</span>'}</td></tr>`).join("")}</tbody>`;
    const t1 = top5[0], divRival = S.filter(r => r.div === t1.div)[1], lead = race[0], chase = race[1];
    const gap = divRival ? ((t1.w - divRival.w) + (divRival.l - t1.l)) / 2 : 0;
    $("snap").innerHTML = `
      <div><span class="l">Top seed</span><span class="v">${esc(t1.owner)}</span><span class="w">${rec(t1)} · ${gap > 0 ? `leads the ${esc(t1.div)} by ${plural(gap, "game")}` : `tied atop the ${esc(t1.div)}, ahead on points`}</span></div>
      <div><span class="l">Last spot in by record</span><span class="v">${esc(fifth.owner)}</span><span class="w">${rec(fifth)} · 5th seed with ${f1(fifth.pf)} PF</span></div>
      <div class="gold"><span class="l">6th seed leader</span><span class="v">${esc(lead.owner)}</span><span class="w">${f1(lead.pf)} PF${chase ? ` · ${f1(lead.pf - chase.pf)} ahead of ${esc(chase.owner)}` : ""}</span></div>`;
  }
  const tabs = [...document.querySelectorAll('[role="tab"][aria-controls^="pane"]')];
  function showTab(id) { tabs.forEach(t => { const on = t.id === id; t.setAttribute("aria-selected", on); $(t.getAttribute("aria-controls")).hidden = !on }); store.set("ffTab", id) }
  tabs.forEach(t => t.onclick = () => showTab(t.id));
  const savedTab = store.get("ffTab"); if (savedTab && $(savedTab)) showTab(savedTab);

  /* ---------- power rankings ---------- */
  if (C) {
    $("prEyebrow").textContent = `Week ${C.lastWeek} edition · ${C.year}`;
    $("prList").innerHTML = C.power.map((p, i) => `<div class="pr"><div class="n">${i + 1}</div><div>${who(p.owner, p.team)}
      <div class="rec" style="margin-top:6px">${p.w}–${p.l} · all-play ${p.apW}–${p.apL} · ${f1(p.pf)} PF</div>${CT.powerNotes[p.owner] ? `<p>${esc(CT.powerNotes[p.owner])}</p>` : ""}</div>
      <div class="mv ${p.move > 0 ? "up" : p.move < 0 ? "dn" : "eq"}">${p.move > 0 ? "▲ " + p.move : p.move < 0 ? "▼ " + (-p.move) : "— 0"}</div></div>`).join("");
  }

  /* ---------- record books ---------- */
  $("recEyebrow").textContent = `${D.firstSeason} – ${D.completedThrough}`;
  const cell = (o, team) => `<td class="l">${who(o, team)}</td>`;
  const games13 = r => r.games && r.games < 14 ? '<span class="note-i" title="13-game regular season">13 G</span>' : "";
  const gameScore = g => !g ? "—" : `${f2(g.ws)}–${f2(g.ls)}${g.note ? ` <span class="note-i" title="${esc(g.note)}">${g.adjusted ? "Special ruling" : "2 games"}</span>` : ""}`;
  const kindTag = x => x.kind === "Regular season" ? "" : ` <span class="note-i" title="${esc(x.kind)}">${x.kind === "Playoff bye" ? "Bye" : x.kind === "Playoffs" ? "PO" : "Cons."}</span>`;
  const books = [
    { id: "champs", grp: "Postseason", name: "League champions", note: "Championship game results, newest first.",
      head: ["Year", "Champion", "Runner-up", "Score"], hideSm: [2], rows: R.champions.map(r => ({ o: [r.owner, r.ru], h: `<td>${r.y}</td>${cell(r.owner, r.team)}<td class="l hide-sm">${esc(r.ru)}</td><td>${gameScore(r.game)}</td>` })),
      hero: () => { const c = {}; R.champions.forEach(r => c[r.owner] = (c[r.owner] || []).concat(r.y)); const [o, ys] = Object.entries(c).sort((a, b) => b[1].length - a[1].length)[0]; return { l: "Most titles", nm: o, meta: ys.sort().join(", "), v: ys.length, u: ys.length > 1 ? "Championships" : "Championship" } } },
    { id: "tropny", grp: "Postseason", name: "Tropny winners", note: "The Tropny goes to the consolation bracket winner (7th place), awarded since 2021. Rematches are decided by combined score.",
      head: ["Year", "Tropny winner", "Runner-up", "Score"], hideSm: [2], rows: R.tropny.map(r => ({ o: [r.owner, r.ru], h: `<td>${r.y}</td>${cell(r.owner, r.team)}<td class="l hide-sm">${esc(r.ru || "")}</td><td>${gameScore(r.game)}</td>` })),
      hero: () => { const c = {}; R.tropny.forEach(r => c[r.owner] = (c[r.owner] || []).concat(r.y)); const [o, ys] = Object.entries(c).sort((a, b) => b[1].length - a[1].length)[0]; return { l: "Most Tropnys", nm: o, meta: ys.sort().join(", "), v: ys.length, u: ys.length > 1 ? "Tropnys" : "Tropny" } } },
    { id: "toilet", grp: "Postseason", name: "Toilet Bowl", note: "The last-place “prize”, for the team that finished 12th.",
      head: ["Year", "Last place", "W–L", "Points for"], hideSm: [3], rows: R.toilet.map(r => ({ o: [r.owner], h: `<td>${r.y}</td>${cell(r.owner, r.team)}<td>${r.rec}</td><td class="hide-sm">${f2(r.pf)}</td>` })),
      hero: () => { const r = R.toilet[0]; return { l: "Most recent", nm: r.owner, meta: `${r.team} · ${r.y} · ${r.rec}`, v: r.y, u: "Season" } } },
    { id: "hiSeason", grp: "Scoring highs", name: "Most points in a season", note: "Regular season points for, top 10. 2019 and 2020 had one fewer game.",
      head: ["#", "Owner", "Season", "W–L", "Points"], hideSm: [3], rows: R.hiSeason.map((r, i) => ({ o: [r.owner], h: `<td><span class="rk">${i + 1}</span></td>${cell(r.owner, r.team)}<td>${r.y}${games13(r)}</td><td class="hide-sm">${r.rec}</td><td class="pts">${f2(r.v)}</td>` })),
      hero: () => { const r = R.hiSeason[0]; return { l: "Record", nm: r.owner, meta: `${r.team} · ${r.y} · ${r.rec}`, v: f2(r.v), u: "Points" } } },
    { id: "hiGame", grp: "Scoring highs", name: "Most points in a game", note: "Every game counts, including the postseason and scores posted during a playoff bye.",
      head: ["#", "Owner", "Season", "Week", "Opponent", "Points"], hideSm: [4], rows: R.hiGame.map((r, i) => ({ o: [r.owner, r.opp], h: `<td><span class="rk">${i + 1}</span></td>${cell(r.owner, r.team)}<td>${r.y}</td><td>${r.wk}${kindTag(r)}</td><td class="l hide-sm">${esc(r.opp || "—")}</td><td class="pts">${f2(r.v)}</td>` })),
      hero: () => { const r = R.hiGame[0]; return { l: "Record", nm: r.owner, meta: `${r.team} · Week ${r.wk}, ${r.y}${r.opp ? " vs " + r.opp : ""}`, v: f2(r.v), u: "Points" } } },
    { id: "loGame", grp: "Scoring lows", name: "Fewest points in a game", note: "Lowest single-game scores, regular season and postseason.",
      head: ["#", "Owner", "Season", "Week", "Opponent", "Points"], hideSm: [4], rows: R.loGame.map((r, i) => ({ o: [r.owner, r.opp], h: `<td><span class="rk">${i + 1}</span></td>${cell(r.owner, r.team)}<td>${r.y}</td><td>${r.wk}${kindTag(r)}</td><td class="l hide-sm">${esc(r.opp)}</td><td class="pts">${f2(r.v)}</td>` })),
      hero: () => { const r = R.loGame[0]; return { l: "Record low", nm: r.owner, meta: `${r.team} · Week ${r.wk}, ${r.y} vs ${r.opp}`, v: f2(r.v), u: "Points" } } },
    { id: "hiAgainst", grp: "Scoring lows", name: "Most points against in a season", note: "The toughest schedules in league history. Regular season points against, top 10.",
      head: ["#", "Owner", "Season", "W–L", "Points against"], hideSm: [3], rows: R.hiAgainst.map((r, i) => ({ o: [r.owner], h: `<td><span class="rk">${i + 1}</span></td>${cell(r.owner, r.team)}<td>${r.y}${games13(r)}</td><td class="hide-sm">${r.rec}</td><td class="pts">${f2(r.v)}</td>` })),
      hero: () => { const r = R.hiAgainst[0]; return { l: "Record", nm: r.owner, meta: `${r.team} · ${r.y} · ${r.rec}`, v: f2(r.v), u: "Points against" } } },
    { id: "allTime", grp: "All-time", name: "All-time standings", custom: true,
      note: `Regular season only, ${D.firstSeason}–${D.completedThrough}. Default order: playoff appearances, then championship appearances, high-score titles, division titles and championships.`,
      hero: () => { const r = [...D.allTime].sort((a, b) => b.ch - a.ch || b.w / (b.w + b.l) - a.w / (a.w + a.l))[0]; return { l: "Most championships", nm: r.owner, meta: `${plural(r.ch, "title")} in ${r.szn} seasons · ${r.w}–${r.l} · ${r.po} playoff trips`, v: r.ch, u: "Championships" } } },
  ];
  let grp = "";
  $("cats").innerHTML = books.map(b => { const g = b.grp !== grp ? `<div class="grp">${(grp = b.grp)}</div>` : ""; return g + `<button role="tab" data-id="${b.id}" aria-selected="false">${b.name}</button>` }).join("");
  $("catsel").innerHTML = books.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
  const ownerNames = Object.keys(O).sort();
  $("recTeam").innerHTML = `<option value="">All owners</option>` + ownerNames.map(o => `<option>${esc(o)}</option>`).join("");
  let cur = books.some(b => b.id === store.get("ffBook")) ? store.get("ffBook") : "champs";
  function drawBook() {
    const b = books.find(x => x.id === cur), tf = $("recTeam").value;
    $("cats").querySelectorAll("button").forEach(x => x.setAttribute("aria-selected", x.dataset.id === cur)); $("catsel").value = cur;
    const h = b.hero();
    $("holder").innerHTML = `<div class="holder"><div><div class="l">${b.name} · ${h.l}</div><div class="nm">${esc(h.nm)}</div><div class="meta">${esc(h.meta)}</div></div><div class="v">${h.v}<small>${h.u}</small></div></div>`;
    $("recNote").textContent = b.note;
    $("recTeamLbl").hidden = $("recPanel").hidden = !!b.custom; $("atBox").hidden = !b.custom;
    store.set("ffBook", cur);
    if (b.custom) { drawAllTime(); return }
    const rows = b.rows.filter(r => !tf || r.o.includes(tf));
    $("recTable").innerHTML = `<thead><tr>${b.head.map((c, i) => `<th class="${i === 1 || /Runner|Opponent/.test(c) ? "l" : ""}${b.hideSm.includes(i) ? " hide-sm" : ""}">${c}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.h}</tr>`).join("") : `<tr><td colspan="${b.head.length}" style="text-align:left;color:var(--muted)">${esc(tf)} doesn't appear in this record book.</td></tr>`}</tbody>`;
  }
  $("cats").onclick = e => { const x = e.target.closest("button"); if (x) { cur = x.dataset.id; drawBook() } };
  $("catsel").onchange = () => { cur = $("catsel").value; drawBook() }; $("recTeam").onchange = drawBook;

  /* all-time standings: simple / expanded, sortable */
  const AT = D.allTime.map((r, i) => ({ ...r, i, pct: r.w / (r.w + r.l), diff: r.pf - r.pa, pfs: r.pf / r.szn, pas: r.pa / r.szn, poP: r.po / r.szn, cp: r.ch / r.szn }));
  const pctF = v => (v * 100).toFixed(1) + "%", n0 = v => String(v), n1 = v => v.toFixed(1);
  const ATC = [["szn", "Seasons", "", n0, 1, 1],
    ["w", "W", "Record", n0, 1, 0], ["l", "L", "Record", n0, 0, 0], ["wl", "W–L", "Record", null, 1, 2], ["pct", "Win %", "Record", pctF, 1, 1], ["fin", "Avg finish", "Record", n1, 0, 0],
    ["po", "Playoffs", "Postseason", n0, 1, 1], ["poP", "Playoff %", "Postseason", pctF, 1, 0], ["ca", "Title games", "Postseason", n0, 1, 0], ["ch", "Titles", "Postseason", n0, 1, 1], ["cp", "Title %", "Postseason", pctF, 1, 0],
    ["div", "Division titles", "Hardware", n0, 1, 0], ["hi", "High-score titles", "Hardware", n0, 1, 0], ["tr", "Tropnys", "Hardware", n0, 1, 0], ["tb", "Toilet Bowls", "Hardware", n0, 0, 0],
    ["pf", "Points for", "Scoring", f2, 1, 1], ["pa", "Points against", "Scoring", f2, 0, 0], ["diff", "Diff", "Scoring", f2, 1, 0], ["pfs", "PF / season", "Scoring", f2, 1, 0], ["pas", "PA / season", "Scoring", f2, 0, 0]];
  let atMode = store.get("ffAtMode") || "simple", atSort = null, atDir = 1, atUpd = () => {};
  function drawAllTime() {
    const cols = ATC.filter(c => atMode === "simple" ? c[5] : c[5] !== 2);
    const rows = [...AT];
    if (atSort) { const c = ATC.find(x => x[0] === atSort); rows.sort((a, b) => ((b[atSort] - a[atSort]) * (c[4] ? 1 : -1) * atDir) || a.i - b.i) }
    const best = {};
    cols.forEach(c => { if (c[0] === "wl" || c[0] === "szn") return; const v = AT.filter(r => r.szn >= 3).map(r => r[c[0]]); best[c[0]] = c[4] ? Math.max(...v) : Math.min(...v) });
    const groups = []; cols.forEach(c => { const g = groups[groups.length - 1]; if (g && g.n === c[2]) g.span++; else groups.push({ n: c[2], span: 1 }) });
    const th = c => { const on = atSort === c[0]; return `<th${on ? ` aria-sort="${(c[4] ? 1 : -1) * atDir > 0 ? "descending" : "ascending"}"` : ""}>${c[0] !== "wl" ? `<button class="sortb${on ? " on" : ""}" data-k="${c[0]}">${c[1]}<span aria-hidden="true">${on ? (atDir > 0 ? " ▼" : " ▲") : ""}</span></button>` : c[1]}</th>` };
    $("atBox").innerHTML = `
    <div class="at-bar">
      <div class="seg" role="group" aria-label="Table view"><button data-m="simple" aria-pressed="${atMode === "simple"}">Simple</button><button data-m="expanded" aria-pressed="${atMode === "expanded"}">Expanded · ${ATC.length - 1} stats</button></div>
      <div class="at-tools">${atSort ? `<button class="linkb" id="atReset">Reset to league order</button>` : `<span class="sub" style="margin:0;font-size:13px">Tap a column to sort</span>`}
        <span class="scrollbtns"><button class="sb" data-d="-1" aria-label="Scroll table left">◀</button><button class="sb" data-d="1" aria-label="Scroll table right">▶</button></span></div>
    </div>
    <div class="at-wrap"><div class="at-scroll" id="atScroll"><table class="at ${atMode}">
      ${atMode === "expanded" ? `<thead><tr class="grp"><th class="own" rowspan="2">Owner</th>${groups.map(g => `<th colspan="${g.span}" class="${g.n ? "g" : ""}">${g.n}</th>`).join("")}</tr><tr>` : `<thead><tr><th class="own">Owner</th>`}
      ${cols.map(th).join("")}</tr></thead>
      <tbody>${rows.map((r, k) => `<tr${r.szn < 3 ? ' class="dim"' : ""}><td class="own"><span class="tm"><span class="rk">${k + 1}</span>${crest(r.owner)}<b>${esc(r.owner)}</b></span></td>${cols.map(c => { if (c[0] === "wl") return `<td>${r.w}–${r.l}</td>`; const v = r[c[0]]; const isB = best[c[0]] !== undefined && r.szn >= 3 && Math.abs(v - best[c[0]]) < 1e-9 && v !== 0; return `<td class="${isB ? "best" : ""}${c[0] === "diff" ? (v > 0 ? " up" : " dn") : ""}">${c[0] === "diff" && v > 0 ? "+" : ""}${c[3](v)}</td>` }).join("")}</tr>`).join("")}</tbody>
    </table></div></div>
    <div class="legend"><span><span class="best-key">Gold</span> League best (owners with 3+ seasons)</span><span>Faded rows: fewer than 3 seasons</span><span>Final places use the league's rematch rule</span></div>`;
    const sc = $("atScroll"), wrap = sc.parentElement;
    const upd = () => { const over = sc.scrollWidth > sc.clientWidth + 2; wrap.classList.toggle("more-r", over && sc.scrollLeft + sc.clientWidth < sc.scrollWidth - 2); wrap.classList.toggle("more-l", sc.scrollLeft > 2); $("atBox").querySelector(".scrollbtns").hidden = !over };
    sc.addEventListener("scroll", upd, { passive: true }); requestAnimationFrame(upd); atUpd = upd;
  }
  addEventListener("resize", () => atUpd());
  $("atBox").addEventListener("click", e => {
    const m = e.target.closest("[data-m]"); if (m) { atMode = m.dataset.m; store.set("ffAtMode", atMode); drawAllTime(); return }
    const s = e.target.closest(".sortb"); if (s) { const k = s.dataset.k; if (atSort === k) atDir = -atDir; else { atSort = k; atDir = 1 } const x = $("atScroll").scrollLeft; drawAllTime(); $("atScroll").scrollLeft = x; return }
    if (e.target.closest("#atReset")) { atSort = null; atDir = 1; drawAllTime(); return }
    const b = e.target.closest(".sb"); if (b) $("atScroll").scrollBy({ left: +b.dataset.d * Math.max(200, $("atScroll").clientWidth * .6), behavior: "smooth" });
  });
  drawBook();

  /* ---------- head-to-head ---------- */
  // games: [year, week, type R|P|C, ownerA, scoreA, ownerB, scoreB]
  const active = ownerNames.filter(o => O[o].active), former = ownerNames.filter(o => !O[o].active);
  const opts = `<optgroup label="Current owners">${active.map(o => `<option>${esc(o)}</option>`).join("")}</optgroup><optgroup label="Former owners">${former.map(o => `<option>${esc(o)}</option>`).join("")}</optgroup>`;
  $("a").innerHTML = opts; $("b").innerHTML = opts;
  $("a").value = active[0]; $("b").value = active[1];
  const meetings = (x, y, t) => D.games.filter(g => ((g[3] === x && g[5] === y) || (g[3] === y && g[5] === x)) && (t === "all" || t.includes(g[2])))
    .map(g => g[3] === x ? { y: g[0], wk: g[1], t: g[2], me: g[4], op: g[6], note: g[7] } : { y: g[0], wk: g[1], t: g[2], me: g[6], op: g[4], note: g[7] });
  const series = ms => ms.reduce((s, m) => { s[m.me > m.op ? "w" : m.me < m.op ? "l" : "t"]++; s.pf += m.me; s.pa += m.op; return s }, { w: 0, l: 0, t: 0, pf: 0, pa: 0 });
  const typeName = { R: "Regular season", P: "Playoffs", C: "Consolation" };
  function duelDraw() {
    const x = $("a").value, y = $("b").value, t = $("gtype").value;
    if (x === y) { $("duel").innerHTML = '<p class="sub">Pick two different owners.</p>'; return }
    const ms = meetings(x, y, t), s = series(ms), g = ms.length;
    if (!g) { $("duel").innerHTML = `<p class="empty">${esc(x)} and ${esc(y)} haven't played each other${t === "all" ? "" : " in these games"}.</p>`; return }
    const cx = O[x].color, cy = O[y].color;
    const recent = [...ms].sort((a, b) => b.y - a.y || b.wk - a.wk);
    $("duel").innerHTML = `<div class="duel"><div><div class="big" style="color:${cx}">${s.w}</div><div class="nm">${esc(x)}</div></div><div class="mid">${plural(g, "meeting")}${s.t ? ` · ${plural(s.t, "tie")}` : ""}</div><div><div class="big" style="color:${cy}">${s.l}</div><div class="nm">${esc(y)}</div></div></div>
      <div class="bar2" role="img" aria-label="${s.w} wins to ${s.l}"><span style="width:${s.w / g * 100}%;background:${cx}"></span><span style="flex:1;background:${cy}"></span></div>
      <div class="grid"><div class="panel"><h3>All meetings</h3><div class="tw" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>Season</th><th class="l">Game</th><th>${esc(first(x))}</th><th>${esc(first(y))}</th><th>Result</th></tr></thead><tbody>${recent.map(m => `<tr><td>${m.y}</td><td class="l">${m.t === "R" ? "Week " + m.wk : typeName[m.t] + " · Wk " + m.wk}${m.note ? ` <span class="note-i" title="${esc(m.note)}">Special ruling</span>` : ""}</td><td>${f2(m.me)}</td><td>${f2(m.op)}</td><td class="${m.me > m.op ? "up" : m.me < m.op ? "dn" : "eq"}">${m.me > m.op ? "W" : m.me < m.op ? "L" : "T"}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="panel"><h3>Series totals</h3><div class="pad"><dl style="display:grid;grid-template-columns:1fr auto;gap:8px;margin:0;font-variant-numeric:tabular-nums">
        <dt>${esc(first(x))} points</dt><dd style="margin:0">${f2(s.pf)}</dd><dt>${esc(first(y))} points</dt><dd style="margin:0">${f2(s.pa)}</dd>
        <dt>Avg margin (${esc(first(x))})</dt><dd style="margin:0">${((s.pf - s.pa) / g > 0 ? "+" : "") + ((s.pf - s.pa) / g).toFixed(2)}</dd>
        <dt>Postseason meetings</dt><dd style="margin:0">${ms.filter(m => m.t !== "R").length}</dd>
        <dt>Biggest win (${esc(first(x))})</dt><dd style="margin:0">${(() => { const m = ms.filter(m => m.me > m.op).sort((a, b) => (b.me - b.op) - (a.me - a.op))[0]; return m ? `+${f2(m.me - m.op)} (${m.y})` : "—" })()}</dd>
      </dl></div></div></div>`;
  }
  $("a").onchange = $("b").onchange = $("gtype").onchange = duelDraw; duelDraw();
  $("matrix").innerHTML = `<thead><tr><th></th>${active.map(o => `<th title="${esc(o)}">${esc(O[o].initials)}</th>`).join("")}</tr></thead><tbody>${active.map(x => `<tr><td>${who(x)}</td>${active.map(y => { if (x === y) return '<td class="self">—</td>'; const s = series(meetings(x, y, "all")); return `<td class="${s.w > s.l ? "w" : s.w < s.l ? "lo" : ""}">${s.w}–${s.l}${s.t ? "–" + s.t : ""}</td>` }).join("")}</tr>`).join("")}</tbody>`;

  /* ---------- rulebook ---------- */
  const dl = rows => `<dl>${rows.map(r => `<dt>${esc(r[0])}</dt><dd>${esc(r[1])}</dd>`).join("")}</dl>`;
  $("rulesGrid").innerHTML = `
    <div class="panel"><h3>Format</h3><div class="pad">${dl(CT.format)}</div></div>
    <div class="panel"><h3>Playoff seeding</h3><div class="pad">${dl(CT.seeding)}</div></div>
    <div class="panel"><h3>Postseason rematches</h3><div class="pad"><p>${esc(CT.rematchRule)}</p></div></div>
    <div class="panel"><h3>Transactions</h3><div class="pad">${dl(CT.transactions)}</div></div>
    <div class="panel"><h3>Trophies</h3><div class="pad">${dl(CT.trophies)}</div></div>
    <div class="panel"><h3>Payouts · ${esc(CT.payouts.buyIn)} buy-in</h3><div class="pad">${dl(CT.payouts.rows)}<p class="fn" style="margin-top:10px">${esc(CT.payouts.note)}</p></div></div>
    <div class="panel wide"><h3>Choosing draft slots</h3><div class="pad">${CT.draftOrder.map(p => `<p>${esc(p)}</p>`).join("")}</div></div>`;
  $("log").innerHTML = CT.changelog.map(s => `<div class="season"><h4>${esc(s.label)}</h4><ul>${s.items.map(c => `<li><span class="pill ${lab[c[0]][0]}">${lab[c[0]][1]}</span><span>${esc(c[1])}</span></li>`).join("")}</ul></div>`).join("");

  /* ---------- routing ---------- */
  const views = [...document.querySelectorAll(".view")], links = [...$("nav").querySelectorAll("a")];
  function go() {
    const id = (location.hash || "#home").slice(1), v = views.some(x => x.dataset.view === id) ? id : "home";
    views.forEach(x => x.hidden = x.dataset.view !== v); links.forEach(l => l.toggleAttribute("aria-current", l.hash === "#" + v));
    $("hero").hidden = v !== "home"; $("nav").classList.remove("open"); $("menuBtn").setAttribute("aria-expanded", "false"); window.scrollTo(0, 0);
  }
  addEventListener("hashchange", go); go();
  $("menuBtn").onclick = () => { const o = $("nav").classList.toggle("open"); $("menuBtn").setAttribute("aria-expanded", o) };
})();
