// Server-side data access for the LAX widebody tracker. Shared by the local
// server (server.js), the Vercel functions (api/*.js) and the Next.js routes.
//
// Why this exists: the public ADS-B feeds don't send CORS headers, so a web
// page can't read them directly — a server has to fetch them on its behalf.

const LAX = { lat: 33.9425, lon: -118.4081 };
const HEADERS = { "User-Agent": "lax-widebody-tracker (personal, non-commercial)", Accept: "application/json" };

async function getJson(url, opts = {}, ms = 9000) {
  const r = await fetch(url, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) { const e = new Error(`http_${r.status}`); e.code = `http_${r.status}`; throw e; }
  return r.json();
}

/* ------------------------------ live aircraft ------------------------------ */
const FEEDS = [
  ["adsb.fi",  `https://opendata.adsb.fi/api/v3/lat/${LAX.lat}/lon/${LAX.lon}/dist/250`],
  ["adsb.lol", `https://api.adsb.lol/v2/point/${LAX.lat}/${LAX.lon}/250`]
];
let feedCache = { at: 0, data: null };
let feedIdx = 0;

export async function getFeed() {
  // adsb.fi asks for at most 1 request/second; every browser tab polls through here
  if (feedCache.data && Date.now() - feedCache.at < 5000) return feedCache.data;
  for (let i = 0; i < FEEDS.length; i++) {
    const idx = (feedIdx + i) % FEEDS.length;
    try {
      const j = await getJson(FEEDS[idx][1], {}, 8000);
      const ac = Array.isArray(j.ac) ? j.ac : j.aircraft;
      if (!Array.isArray(ac)) throw new Error("bad payload");
      feedIdx = idx;
      feedCache = { at: Date.now(), data: { ac, now: j.now || Date.now() / 1000, source: FEEDS[idx][0] } };
      return feedCache.data;
    } catch (e) { /* next feed */ }
  }
  if (feedCache.data && Date.now() - feedCache.at < 60000) return feedCache.data; // briefly stale beats nothing
  const e = new Error("all ADS-B feeds failed"); e.code = "feeds_unreachable"; throw e;
}

/* ---------------------------------- routes --------------------------------- */
const routeCache = new Map();           // callsign → { at, item }
const ROUTE_TTL = 6 * 3600000, UNKNOWN_TTL = 15 * 60000;
let routesetDownUntil = 0;

function cachedRoute(cs) {
  const c = routeCache.get(cs);
  if (!c) return null;
  const unknown = c.item._airport_codes_iata === "unknown";
  return Date.now() - c.at < (unknown ? UNKNOWN_TTL : ROUTE_TTL) ? c.item : null;
}

async function adsbdbRoute(cs) {
  try {
    const r = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`,
      { headers: HEADERS, signal: AbortSignal.timeout(7000) });
    if (r.status === 404) return { callsign: cs, _airport_codes_iata: "unknown" };
    if (!r.ok) return null;
    const fr = ((await r.json()).response || {}).flightroute;
    if (!fr || !fr.origin || !fr.destination) return { callsign: cs, _airport_codes_iata: "unknown" };
    const o = fr.origin, d = fr.destination;
    return {
      callsign: cs,
      _airport_codes_iata: `${o.iata_code}-${d.iata_code}`,
      airports: [{ iata: o.iata_code, lat: o.latitude, lon: o.longitude, location: o.municipality, name: o.name }]
    };
  } catch (e) { return null; }
}

// planes: [{ callsign, lat, lng }]. Returns only the callsigns resolved so far
// (known or confirmed-unknown); the page simply asks again for the rest.
export async function getRoutes(planes) {
  const list = (Array.isArray(planes) ? planes : [])
    .filter(p => p && typeof p.callsign === "string" && /^[A-Z0-9]{2,8}$/.test(p.callsign)).slice(0, 80);
  const need = list.filter(p => !cachedRoute(p.callsign));
  if (need.length) {
    let done = false;
    if (Date.now() > routesetDownUntil) {
      try {
        const arr = await getJson("https://api.adsb.lol/api/0/routeset", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planes: need.map(p => ({ callsign: p.callsign, lat: +p.lat || 0, lng: +p.lng || 0 })) })
        }, 6000);
        if (Array.isArray(arr)) {
          for (const it of arr) if (it && it.callsign) routeCache.set(it.callsign, { at: Date.now(), item: it });
          done = true;
        }
      } catch (e) { routesetDownUntil = Date.now() + 10 * 60000; }
    }
    if (!done) {
      // fallback: adsbdb, one callsign per request — do a few per call
      const batch = need.slice(0, 10);
      const got = await Promise.all(batch.map(p => adsbdbRoute(p.callsign)));
      got.forEach(it => { if (it) routeCache.set(it.callsign, { at: Date.now(), item: it }); });
    }
  }
  return list.map(p => cachedRoute(p.callsign)).filter(Boolean);
}

/* --------------------------- scheduled arrivals ---------------------------- */
// aviationstack: the free plan is HTTP-only, 100 requests/month, and rejects
// dated queries. So: plain HTTP, real-time queries by status, cache for hours.
const AVIATIONSTACK = "http://api.aviationstack.com/v1/flights";
const SCHED_TTL = 3 * 3600000, PAGES = 3;
const SKIP_DATED = new Set(["function_access_restricted", "historical_data_restricted",
  "usage_limit_reached", "rate_limit_reached"]);
const schedCache = new Map();           // key → { at, data }

const laDate = offsetDays => new Date(Date.now() + offsetDays * 86400000)
  .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

async function collect(key, extra, pages = PAGES) {
  const out = [];
  for (let offset = 0; offset < pages * 100; offset += 100) {
    const params = { access_key: key, arr_iata: "LAX", limit: "100", offset: String(offset), ...extra };
    const r = await fetch(`${AVIATIONSTACK}?${new URLSearchParams(params)}`, { signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => null);
    if (!j) { const e = new Error(`http_${r.status}`); e.code = `http_${r.status}`; throw e; }
    if (j.error) { const e = new Error(j.error.code || "error"); e.code = j.error.code || "error"; throw e; }
    const data = Array.isArray(j.data) ? j.data : [];
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

export async function getArrivals(key) {
  if (!key) { const e = new Error("no key"); e.code = "no_key"; throw e; }
  const c = schedCache.get(key);
  if (c && Date.now() - c.at < SCHED_TTL) return c.data;
  try {
    const all = await collect(key, { flight_status: "active" }, 2);
    try { all.push(...await collect(key, { flight_status: "scheduled" })); }
    catch (e) { if (!all.length) throw e; }
    for (const flightDate of [laDate(0), laDate(1)]) {       // paid-plan bonus
      try { all.push(...await collect(key, { flight_date: flightDate })); }
      catch (e) { if (SKIP_DATED.has(e.code)) break; }
    }
    const data = { data: all };
    schedCache.set(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    if (c) return c.data;                                    // stale beats nothing
    throw e;
  }
}
