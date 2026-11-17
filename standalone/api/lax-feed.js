import { getFeed } from "../lax-core.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try { res.status(200).json(await getFeed()); }
  catch (e) { res.status(502).json({ error: String(e.code || e.message) }); }
}
