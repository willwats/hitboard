// Fetches DraftKings game lines from The Odds API and writes odds.json.
// Needs the ODDS_API_KEY secret. Costs 3 credits per sport per run (3 markets x 1 region).
// The events list is free, so a sport with no games in the next 30 hours is skipped.
import fs from 'node:fs';

const KEY = process.env.ODDS_API_KEY;
const BASE = process.env.ODDS_API_BASE || 'https://api.the-odds-api.com/v4';
const OUT = process.env.ODDS_OUT || 'odds.json';
const SPORTS = { nfl: 'americanfootball_nfl', nba: 'basketball_nba', ncaafb: 'americanfootball_ncaaf' };
const RESERVE = 25; // stop spending when fewer credits than this remain
const AHEAD_H = 30;

if (!KEY) { console.log('ODDS_API_KEY is not set. Add it under Settings > Secrets and variables > Actions. Nothing fetched.'); process.exit(0); }

let prev = { at: null, games: [] };
try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
const now = Date.now();
let games = (prev.games || []).filter(g => Date.parse(g.start) > now - 5 * 3600e3);
let remaining = prev.remaining ?? null;
let touched = false;

async function get(path, params) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries({ apiKey: KEY, ...params })) u.searchParams.set(k, v);
  const r = await fetch(u);
  const rem = r.headers.get('x-requests-remaining');
  if (rem != null) remaining = Number(rem);
  if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`);
  return r.json();
}

const price = o => (o && Number.isFinite(o.price) ? o.price : null);

for (const [lg, key] of Object.entries(SPORTS)) {
  try {
    if (remaining != null && remaining < RESERVE) { console.log(`Only ${remaining} credits left, stopping.`); break; }
    const ev = await get(`/sports/${key}/events`, { dateFormat: 'iso' });
    const soon = ev.filter(e => { const t = Date.parse(e.commence_time); return t > now - 3 * 3600e3 && t < now + AHEAD_H * 3600e3; });
    if (!soon.length) { console.log(`${lg}: no games in the next ${AHEAD_H}h, skipped`); continue; }
    const to = new Date(now + AHEAD_H * 3600e3).toISOString().replace(/\.\d+Z$/, 'Z');
    const data = await get(`/sports/${key}/odds`, { regions: 'us', markets: 'h2h,spreads,totals', bookmakers: 'draftkings', oddsFormat: 'american', dateFormat: 'iso', commenceTimeTo: to });
    games = games.filter(g => g.lg !== lg || !data.some(d => d.id === g.id));
    let n = 0;
    for (const e of data) {
      const bk = (e.bookmakers || []).find(b => b.key === 'draftkings');
      if (!bk) continue;
      const m = k => (bk.markets || []).find(x => x.key === k);
      const g = { lg, id: e.id, start: e.commence_time, away: e.away_team, home: e.home_team, updated: bk.last_update };
      const h2h = m('h2h');
      if (h2h) { const a = price(h2h.outcomes.find(o => o.name === e.away_team)), h = price(h2h.outcomes.find(o => o.name === e.home_team)); if (a != null && h != null) g.ml = { a, h }; }
      const sp = m('spreads');
      if (sp) { const h = sp.outcomes.find(o => o.name === e.home_team), a = sp.outcomes.find(o => o.name === e.away_team); if (h && Number.isFinite(h.point)) g.spread = { h: h.point, hp: price(h), ap: price(a) }; }
      const tt = m('totals');
      if (tt) { const o = tt.outcomes.find(x => x.name === 'Over'), u = tt.outcomes.find(x => x.name === 'Under'); if (o && Number.isFinite(o.point)) g.total = { pt: o.point, o: price(o), u: price(u) }; }
      games.push(g); n++;
    }
    touched = true;
    console.log(`${lg}: ${n} games with DraftKings lines (credits left: ${remaining})`);
  } catch (err) { console.log(`${lg}: ${err.message}`); }
}

games.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
const out = { at: touched ? new Date().toISOString() : prev.at, remaining, source: 'DraftKings via The Odds API', games };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
