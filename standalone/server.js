#!/usr/bin/env node
// Local server for the LAX widebody tracker. No dependencies — needs Node 18+.
//
//   node server.js            then open http://localhost:8765
//
// It serves the app and fetches the flight feeds on the page's behalf (the
// feeds can't be read straight from a browser page). Optional: set
// AVIATIONSTACK_KEY in the environment instead of pasting the key in the app.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getFeed, getRoutes, getArrivals } from "./lax-core.js";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8765;

const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = req => new Promise((resolve, reject) => {
  let s = "";
  req.on("data", c => { s += c; if (s.length > 200000) { reject(new Error("too large")); req.destroy(); } });
  req.on("end", () => resolve(s));
  req.on("error", reject);
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/api/lax-feed") return send(res, 200, await getFeed());
    if (url.pathname === "/api/lax-routes" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      return send(res, 200, await getRoutes(body.planes));
    }
    if (url.pathname === "/api/lax-arrivals") {
      const key = process.env.AVIATIONSTACK_KEY || req.headers["x-av-key"];
      if (!key) return send(res, 501, { error: "no_key" });
      return send(res, 200, await getArrivals(String(key)));
    }
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/lax-tracker.html") {
      const html = await readFile(path.join(DIR, "index.html")).catch(() => readFile(path.join(DIR, "lax-tracker.html")));
      return send(res, 200, html, "text/html; charset=utf-8");
    }
    send(res, 404, { error: "not_found" });
  } catch (e) {
    send(res, 502, { error: String(e.code || e.message || e) });
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`\n  LAX widebody tracker running:  http://localhost:${PORT}\n\n  Leave this window open while you use it. Ctrl+C to stop.\n`);
});
