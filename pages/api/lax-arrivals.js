const AVIATIONSTACK = "https://api.aviationstack.com/v1/flights";
const KEY = process.env.AVIATIONSTACK_KEY;

// aviationstack's free tier is 100 requests/month, so cache hard
let cache = { at: 0, data: null };
const TTL_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (!KEY) return res.status(501).json({ error: "AVIATIONSTACK_KEY not configured" });

  if (cache.data && Date.now() - cache.at < TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cache.data);
  }

  const url = `${AVIATIONSTACK}?${new URLSearchParams({ access_key: KEY, arr_iata: "LAX", limit: "100" })}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `aviationstack error ${r.status}` });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.code || "aviationstack error" });
    cache = { at: Date.now(), data };
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
    res.status(200).json(data);
  } catch (err) {
    if (cache.data) return res.status(200).json(cache.data); // stale beats nothing
    res.status(500).json({ error: err.message });
  }
}
