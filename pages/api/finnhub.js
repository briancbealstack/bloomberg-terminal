const FINNHUB = "https://finnhub.io/api/v1";
const KEY = process.env.FINNHUB_API_KEY;

export default async function handler(req, res) {
  const { endpoint, ...params } = req.query;

  if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

  const qs = new URLSearchParams({ ...params, token: KEY }).toString();
  const url = `${FINNHUB}/${endpoint}?${qs}`;

  try {
    const r = await fetch(url);
    if (!r.ok) return res.status(r.status).json({ error: `Finnhub error ${r.status}` });
    const data = await r.json();
    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=20");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
