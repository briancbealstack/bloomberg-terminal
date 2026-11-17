# LAX Tracker — Widebody Arrivals

A single-file HTML app for flight spotting at LAX. It tracks every **widebody**
inbound to LAX — 747, 767, 777, 787, A330, A340, A350, A380, plus other heavies
(MD-11, DC-10/KC-10, A300/A310, An-124, C-17, C-5M) — and filters out narrowbody
domestic traffic entirely.

## Features

- **Live inbound board** — no API key needed. Positions come from free community
  ADS-B feeds (adsb.lol, falling back to airplanes.live), refreshed every 20 s,
  with origin airports resolved from the adsb.lol route database. Shows distance,
  altitude, ground speed, ETA, and phase (enroute / descent / approach / final /
  landed).
- **Radar scope** — range rings (100/250 NM), SoCal coastline, nearby airports,
  approach corridor, hover tooltips, click-to-highlight.
- **Runway prediction** — auto-detects the airport flow from live traffic
  (west ops 24R/25L, east ops 06/07) and predicts the arrival runway from the
  approach corridor; aircraft established on final are resolved north/south
  complex from their actual cross-track position. Predictions, not ATC
  assignments.
- **Schedule board** — the next 24 hours of scheduled widebody arrivals
  (today + tomorrow via aviationstack), with time, airline, origin, equipment,
  predicted runway, and status. Rows with no equipment data are flagged
  *likely widebody* from airline/route heuristics (toggleable).
- **Fleet filter** — per-family chips (persisted), colorblind-safe palette.

## Running it

The public ADS-B feeds can't be read straight from a web page (they don't send
CORS headers), so the app needs a small server to fetch them on its behalf.
Opening `index.html` by double-clicking it will not load live flights.

**On your own computer** (needs [Node.js](https://nodejs.org) 18 or newer, nothing else):

- Windows: double-click `START-windows.bat`
- Mac / Linux: run `./start-mac-linux.command`, or `node server.js`

Then use <http://localhost:8765>. Leave the server window open.

**Hosted:** import this repo into [Vercel](https://vercel.com/new) (zero
config). The functions in `api/` do the same job as the local server.

### Schedule board (needs a free API key)

The scheduled-arrivals tab uses [aviationstack](https://aviationstack.com/)
(free tier: 100 requests/month, today's flights only). Paste your key into the
Schedule tab, or set `AVIATIONSTACK_KEY` in the server's environment. Either
way the server makes the request, caches it for 3 hours, and keeps working
with the free plan's HTTP-only restriction.

## Data sources & caveats

- Live positions: [adsb.fi](https://adsb.fi) (with adsb.lol as backup), community
  ADS-B networks (free, no key, personal non-commercial use). Coverage is crowd-sourced.
- Routes: adsb.lol route database, falling back to adsbdb (best effort — flights without route data show
  origin `LAX?` until confirmed).
- Schedules: aviationstack. The free tier omits equipment type on many flights,
  hence the *likely widebody* heuristic.
- ETA is great-circle distance ÷ ground speed.
- Runway predictions follow normal LAX ops (arrivals on the outer runways, 24R
  north / 25L south in west flow; inner 24L/25R get used at peaks; overnight
  over-ocean and Santa Ana east ops land on the 06/07s). Trust your ears on the
  day.

All times are shown in America/Los_Angeles.
