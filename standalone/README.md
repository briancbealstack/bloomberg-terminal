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

Open `index.html` in a browser. That's it — the live tab is fully functional
with zero setup.

### Schedule board (needs a free API key)

The scheduled-arrivals tab uses [aviationstack](https://aviationstack.com/)
(free tier: 100 requests/month). Two ways to wire it up:

1. **Vercel (recommended)** — import this repo into
   [Vercel](https://vercel.com/new) (zero config: static site + one serverless
   function) and set the `AVIATIONSTACK_KEY` environment variable. The included
   `/api/lax-arrivals` proxy keeps the key server-side and caches responses for
   an hour so all visitors share the same quota spend (~6 requests per cache
   refresh: 2 days × up to 3 pages).
2. **Paste a key in the app** — on the Schedule tab, enter your aviationstack
   key; it's stored only in your browser (localStorage) and results are cached
   locally for an hour. Note: on an `https://` host (e.g. GitHub Pages) this
   requires an aviationstack plan that supports HTTPS.

## Deployment

- **GitHub Pages** — pushes to `main` deploy automatically via
  `.github/workflows/deploy-pages.yml` (live tab keyless; schedule via
  paste-a-key).
- **Vercel** — import the repo, set `AVIATIONSTACK_KEY`, done. Both the static
  app and the schedule proxy work.

## Data sources & caveats

- Live positions: [adsb.lol](https://adsb.lol) / [airplanes.live](https://airplanes.live)
  community ADS-B networks (free, no key). Coverage is crowd-sourced.
- Routes: adsb.lol route database (best effort — flights without route data show
  origin `LAX?` until confirmed).
- Schedules: aviationstack. The free tier omits equipment type on many flights,
  hence the *likely widebody* heuristic.
- ETA is great-circle distance ÷ ground speed.
- Runway predictions follow normal LAX ops (arrivals on the outer runways, 24R
  north / 25L south in west flow; inner 24L/25R get used at peaks; overnight
  over-ocean and Santa Ana east ops land on the 06/07s). Trust your ears on the
  day.

All times are shown in America/Los_Angeles.
