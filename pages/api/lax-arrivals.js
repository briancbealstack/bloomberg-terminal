const AVIATIONSTACK = "https://api.aviationstack.com/v1/flights";
const KEY = process.env.AVIATIONSTACK_KEY;

// aviationstack's free tier is 100 requests/month; a full refresh below is up
// to 6 requests (2 dates × 3 pages), so cache hard and serve stale on failure
let cache = { at: 0, data: null };
const TTL_MS = 60 * 60 * 1000;
const PAGES = 3;

const laDate = offsetDays =>
  new Date(Date.now() + offsetDays * 86400000)
    .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export default async function handler(req, res) {
  if (!KEY) return res.status(501).json({ error: "AVIATIONSTACK_KEY not configured" });

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cache.data);
  }

  try {
    const all = [];
    for (const flightDate of [laDate(0), laDate(1)]) {
      for (let offset = 0; offset < PAGES * 100; offset += 100) {
        const url = `${AVIATIONSTACK}?${new URLSearchParams({
          access_key: KEY, arr_iata: "LAX", limit: "100",
          offset: String(offset), flight_date: flightDate
        })}`;
        const r = await fetch(url);
        if (!r.ok) throw new Error(`aviationstack error ${r.status}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error.code || "aviationstack error");
        all.push(...(Array.isArray(j.data) ? j.data : []));
        const total = (j.pagination && j.pagination.total) || 0;
        if (offset + 100 >= total) break;
      }
    }
    cache = { at: Date.now(), data: { data: all } };
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json(cache.data);
  } catch (err) {
    if (cache.data) return res.status(200).json(cache.data); // stale beats nothing
    res.status(500).json({ error: err.message });
  }
}
