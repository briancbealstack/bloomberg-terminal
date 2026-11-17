import { getRoutes } from "../../standalone/lax-core.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    res.status(200).json(await getRoutes(body.planes));
  } catch (e) { res.status(502).json({ error: String(e.code || e.message) }); }
}
