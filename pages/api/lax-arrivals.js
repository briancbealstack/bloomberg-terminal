import { getArrivals } from "../../standalone/lax-core.js";

// Key comes from the AVIATIONSTACK_KEY environment variable, or — if that isn't
// set — from the key the visitor pasted into the app (sent as a header).
export default async function handler(req, res) {
  const key = process.env.AVIATIONSTACK_KEY || req.headers["x-av-key"];
  if (!key) return res.status(501).json({ error: "no_key" });
  res.setHeader("Cache-Control", "no-store");
  try { res.status(200).json(await getArrivals(String(key))); }
  catch (e) { res.status(502).json({ error: String(e.code || e.message) }); }
}
