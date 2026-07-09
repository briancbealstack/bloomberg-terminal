const AVIATIONSTACK = "https://api.aviationstack.com/v1/flights";
const KEY = process.env.AVIATIONSTACK_KEY;

// aviationstack's free tier is 100 requests/month, so cache hard and serve stale
// on failure. The free plan only includes the real-time /flights query (no
// `flight_date`); dated today/tomorrow queries are a paid bonus, skipped once the
// plan rejects them so we don't burn quota re-failing.
let cache = { at: 0, data: null };
const TTL_MS = 60 * 60 * 1000;
const PAGES = 3;
const SKIP_DATED = new Set(["function_access_restricted", "historical_data_restricted",
  "usage_limit_reached", "rate_limit_reached"]);

const laDate = offsetDays =>
  new Date(Date.now() + offsetDays * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

async function collect(flightDate) {
  const out = [];
  for (let offset = 0; offset < PAGES * 100; offset += 100) {
    const params = { access_key: KEY, arr_iata: "LAX", limit: "100", offset: String(offset) };
    if (flightDate) params.flight_date = flightDate;
    const r = await fetch(`${AVIATIONSTACK}?${new URLSearchParams(params)}`);
    if (!r.ok) { const e = new Error(`http_${r.status}`); e.code = `http_${r.status}`; throw e; }
    const j = await r.json();
    if (j.error) { const e = new Error(j.error.code || "error"); e.code = j.error.code || "error"; throw e; }
    const data = Array.isArray(j.data) ? j.data : [];
    out.push(...data);
    if (data.length < 100) break;
  }
  return out;
}

export default async function handler(req, res) {
  if (!KEY) return res.status(501).json({ error: "AVIATIONSTACK_KEY not configured" });

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cache.data);
  }

  try {
    const all = await collect(null);            // real-time baseline (free-compatible)
    for (const flightDate of [laDate(0), laDate(1)]) {   // bonus: explicit today + tomorrow
      try { all.push(...await collect(flightDate)); }
      catch (e) { if (SKIP_DATED.has(e.code)) break; /* else ignore, keep baseline */ }
    }
    cache = { at: Date.now(), data: { data: all } };
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json(cache.data);
  } catch (err) {
    if (cache.data) return res.status(200).json(cache.data); // stale beats nothing
    res.status(502).json({ error: err.code || err.message });
  }
}
