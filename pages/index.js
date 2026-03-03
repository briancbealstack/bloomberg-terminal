import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:          "#060608",
  panel:       "#09090d",
  panelAlt:    "#0c0c12",
  border:      "#16161e",
  accent:      "#f0a500",
  accentDim:   "#3a2800",
  green:       "#00c97a",
  greenDim:    "#002a18",
  red:         "#f04040",
  redDim:      "#2a0808",
  blue:        "#3a9fff",
  text:        "#c8c8d8",
  textDim:     "#50506a",
  textBright:  "#f0f0ff",
  header:      "#0a0a10",
};

const DEFAULT_TICKERS = ["AAPL","MSFT","NVDA","GOOGL","AMZN","META","TSLA","JPM","V","UNH"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n, d = 2) => (n != null && !isNaN(n)) ? Number(n).toFixed(d) : "—";
const fmtB = (n) => {
  if (!n) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  return String(n);
};

async function apiFetch(endpoint, params = {}) {
  const qs = new URLSearchParams({ endpoint, ...params }).toString();
  const r = await fetch(`/api/finnhub?${qs}`);
  if (!r.ok) throw new Error(`API ${r.status}`);
  return r.json();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useAllQuotes(tickers) {
  const [quotes, setQuotes] = useState({});
  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled(
      tickers.map(t => apiFetch("quote", { symbol: t }).then(d => ({ t, d })))
    );
    setQuotes(prev => {
      const next = { ...prev };
      results.forEach(r => { if (r.status === "fulfilled") next[r.value.t] = r.value.d; });
      return next;
    });
  }, [tickers.join(",")]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 20000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return quotes;
}

function useCandles(ticker) {
  const [candles, setCandles] = useState([]);
  useEffect(() => {
    if (!ticker) return;
    setCandles([]);
    // Try today first, then walk back up to 5 days to find last trading session
    const tryFetch = async (daysBack = 0) => {
      if (daysBack > 5) return;
      const to   = Math.floor(Date.now() / 1000) - daysBack * 86400;
      const from = to - 24 * 60 * 60;
      try {
        const d = await apiFetch("stock/candle", { symbol: ticker, resolution: "5", from, to });
        if (d.s === "ok" && d.t?.length > 0) {
          setCandles(d.t.map((ts, i) => ({
            time:  new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            price: d.c[i],
            vol:   d.v[i],
          })));
        } else {
          tryFetch(daysBack + 1);
        }
      } catch { tryFetch(daysBack + 1); }
    };
    tryFetch();
  }, [ticker]);
  return candles;
}

function useProfile(ticker) {
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!ticker) return;
    setProfile(null);
    apiFetch("stock/profile2", { symbol: ticker }).then(setProfile).catch(() => {});
  }, [ticker]);
  return profile;
}

function useMetrics(ticker) {
  const [metrics, setMetrics] = useState(null);
  useEffect(() => {
    if (!ticker) return;
    setMetrics(null);
    apiFetch("stock/metric", { symbol: ticker, metric: "all" })
      .then(d => setMetrics(d?.metric ?? null))
      .catch(() => {});
  }, [ticker]);
  return metrics;
}

function useNews() {
  const [news, setNews] = useState([]);
  useEffect(() => {
    const to   = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    apiFetch("news", { category: "general", from, to })
      .then(d => setNews(Array.isArray(d) ? d.slice(0, 15) : []))
      .catch(() => {});
  }, []);
  return news;
}

function useMarketStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    apiFetch("stock/market-status", { exchange: "US" }).then(setStatus).catch(() => {});
  }, []);
  return status;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function PanelHeader({ title, right }) {
  return (
    <div style={{
      padding: "5px 10px", background: C.header,
      borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexShrink: 0,
    }}>
      <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: 1.5 }}>{title}</span>
      {right && <span style={{ color: C.textDim, fontSize: 9 }}>{right}</span>}
    </div>
  );
}

function Header({ status, time }) {
  const open = status?.isOpen;
  return (
    <div style={{
      background: C.header, borderBottom: `2px solid ${C.accent}`,
      padding: "0 14px", height: 38,
      display: "flex", alignItems: "center", gap: 14, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ background: C.accent, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#000", fontSize: 12, fontWeight: 900, fontFamily: "Georgia, serif" }}>B</span>
        </div>
        <span style={{ color: C.accent, fontWeight: 900, fontSize: 12, letterSpacing: 3 }}>BLOOMBERG</span>
        <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 1 }}>PROFESSIONAL</span>
      </div>
      <div style={{ width: 1, height: 16, background: C.border }} />
      {status !== null && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: open ? C.green : C.red,
            boxShadow: `0 0 6px ${open ? C.green : C.red}`,
          }} />
          <span style={{ color: open ? C.green : C.red, fontSize: 10, letterSpacing: 1 }}>
            {open ? "MARKET OPEN" : "MARKET CLOSED"}
          </span>
        </div>
      )}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 0.5 }}>LIVE · FINNHUB</span>
        <span style={{ color: C.green, fontSize: 9, animation: "pulse 2s infinite" }}>●</span>
        <span style={{ color: C.textDim, fontSize: 10, fontFamily: "monospace" }}>{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

function TickerTape({ quotes, tickers }) {
  const items = [...tickers, ...tickers];
  if (!Object.keys(quotes).length) {
    return (
      <div style={{ height: 26, background: "#06060a", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", paddingLeft: 12 }}>
        <span style={{ color: C.textDim, fontSize: 10 }}>Fetching live quotes…</span>
      </div>
    );
  }
  return (
    <div style={{ height: 26, background: "#06060a", borderBottom: `1px solid ${C.border}`, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <div style={{ display: "flex", animation: "scroll 45s linear infinite", whiteSpace: "nowrap" }}>
        {items.map((t, i) => {
          const q  = quotes[t];
          const up = (q?.d ?? 0) >= 0;
          return (
            <span key={i} style={{ marginRight: 28, fontSize: 10, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "monospace" }}>
              <span style={{ color: C.accent, fontWeight: 700 }}>{t}</span>
              <span style={{ color: C.textBright }}>{q?.c ? `$${fmt(q.c)}` : "—"}</span>
              {q?.d !== undefined && (
                <span style={{ color: up ? C.green : C.red }}>
                  {up ? "▲" : "▼"}{fmt(Math.abs(q.dp))}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Watchlist({ tickers, quotes, selected, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PanelHeader title="WATCHLIST" right={`${tickers.length} securities`} />
      <div style={{ overflowY: "auto", flex: 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#08080e", position: "sticky", top: 0, zIndex: 1 }}>
              {["TICKER", "LAST", "CHG", "%"].map(h => (
                <th key={h} style={{ padding: "4px 8px", color: C.textDim, fontWeight: 400, textAlign: "left", borderBottom: `1px solid ${C.border}`, letterSpacing: 0.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((t, i) => {
              const q    = quotes[t];
              const up   = (q?.d ?? 0) >= 0;
              const isSel = selected === t;
              return (
                <tr key={t} onClick={() => onSelect(t)} style={{
                  cursor: "pointer",
                  background: isSel ? "#16120a" : i % 2 === 0 ? C.panel : C.panelAlt,
                  borderLeft: `2px solid ${isSel ? C.accent : "transparent"}`,
                }}>
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ color: C.accent, fontWeight: 700, fontSize: 11 }}>{t}</div>
                  </td>
                  <td style={{ padding: "6px 8px", color: C.textBright, fontFamily: "monospace" }}>
                    {q?.c ? `$${fmt(q.c)}` : <span style={{ color: C.textDim }}>…</span>}
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                    {q?.d !== undefined
                      ? <span style={{ color: up ? C.green : C.red }}>{up ? "+" : ""}{fmt(q.d)}</span>
                      : "—"}
                  </td>
                  <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                    {q?.dp !== undefined ? (
                      <span style={{
                        color: up ? C.green : C.red,
                        background: up ? C.greenDim : C.redDim,
                        padding: "1px 4px", borderRadius: 2, fontSize: 9,
                      }}>
                        {up ? "+" : ""}{fmt(q.dp)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, color }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: "#111118", border: `1px solid ${C.border}`, padding: "6px 10px", fontSize: 10, fontFamily: "monospace" }}>
      <div style={{ color: C.textDim, marginBottom: 2 }}>{d.time}</div>
      <div style={{ color, fontWeight: 700 }}>Close: ${fmt(d.price)}</div>
      {d.vol && <div style={{ color: C.textDim }}>Vol: {fmtB(d.vol)}</div>}
    </div>
  );
}

function ChartPanel({ ticker, candles, quote, profile }) {
  if (!ticker) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textDim, fontSize: 12 }}>
      ← Select a security
    </div>
  );

  const up    = (quote?.d ?? 0) >= 0;
  const color = up ? C.green : C.red;
  const prices = candles.map(d => d.price).filter(Boolean);
  const minP   = prices.length ? Math.min(...prices) * 0.9995 : 0;
  const maxP   = prices.length ? Math.max(...prices) * 1.0005 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div style={{
        padding: "6px 12px", background: C.header, borderBottom: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <span style={{ color: C.accent, fontWeight: 900, fontSize: 15, letterSpacing: 1 }}>{ticker}</span>
        {profile?.name && <span style={{ color: C.textDim, fontSize: 10 }}>{profile.name}</span>}
        {profile?.exchange && <span style={{ color: C.textDim, fontSize: 9 }}>· {profile.exchange}</span>}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {quote?.c && (
            <span style={{ color: C.textBright, fontWeight: 700, fontSize: 18, fontFamily: "monospace" }}>
              ${fmt(quote.c)}
            </span>
          )}
          {quote?.d !== undefined && (
            <span style={{ color, fontSize: 12, fontFamily: "monospace" }}>
              {up ? "▲" : "▼"} {fmt(Math.abs(quote.d))} ({fmt(Math.abs(quote.dp))}%)
            </span>
          )}
          <span style={{ color: C.textDim, fontSize: 9 }}>5min · INTRADAY</span>
        </div>
      </div>

      {candles.length > 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "6px 0 0" }}>
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={candles} margin={{ top: 4, right: 10, bottom: 0, left: 48 }}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill: C.textDim, fontSize: 8 }} tickLine={false} axisLine={false}
                       interval={Math.max(1, Math.floor(candles.length / 6))} />
                <YAxis domain={[minP, maxP]} tick={{ fill: C.textDim, fontSize: 8 }} tickLine={false} axisLine={false}
                       tickFormatter={v => `$${fmt(v)}`} width={46} />
                <Tooltip content={<ChartTooltip color={color} />} />
                <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill="url(#cg)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ height: 44 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={candles} margin={{ top: 0, right: 10, bottom: 0, left: 48 }}>
                <Bar dataKey="vol" fill={color} opacity={0.35} />
                <XAxis hide /> <YAxis hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 11 }}>
          Loading chart…
        </div>
      )}
    </div>
  );
}

function FundamentalsPanel({ quote, metrics, profile }) {
  const rows = [
    ["OPEN",       quote?.o  ? `$${fmt(quote.o)}`  : "—"],
    ["PREV CLOSE", quote?.pc ? `$${fmt(quote.pc)}` : "—"],
    ["DAY HIGH",   quote?.h  ? `$${fmt(quote.h)}`  : "—"],
    ["DAY LOW",    quote?.l  ? `$${fmt(quote.l)}`  : "—"],
    ["52W HIGH",   metrics?.["52WeekHigh"]  ? `$${fmt(metrics["52WeekHigh"])}`  : "—"],
    ["52W LOW",    metrics?.["52WeekLow"]   ? `$${fmt(metrics["52WeekLow"])}`   : "—"],
    ["MKT CAP",    profile?.marketCapitalization ? fmtB(profile.marketCapitalization * 1e6) : "—"],
    ["P/E TTM",    metrics?.peNormalizedAnnual ? fmt(metrics.peNormalizedAnnual) : "—"],
    ["EPS TTM",    metrics?.epsTTM      ? `$${fmt(metrics.epsTTM)}`     : "—"],
    ["DIV YIELD",  metrics?.dividendYieldIndicatedAnnual ? `${fmt(metrics.dividendYieldIndicatedAnnual)}%` : "—"],
    ["BETA",       metrics?.beta ? fmt(metrics.beta) : "—"],
    ["EMPLOYEES",  profile?.employeeTotal ? fmtB(profile.employeeTotal) : "—"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PanelHeader title="FUNDAMENTALS" />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {rows.map(([label, val], i) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between",
            padding: "5px 10px",
            background: i % 2 === 0 ? C.panel : C.panelAlt,
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ color: C.textDim, fontSize: 9, letterSpacing: 0.5 }}>{label}</span>
            <span style={{ color: C.textBright, fontSize: 10, fontFamily: "monospace", fontWeight: 600 }}>{val}</span>
          </div>
        ))}
        {profile?.weburl && (
          <div style={{ padding: "8px 10px" }}>
            <a href={profile.weburl} target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 9 }}>
              {profile.weburl}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function NewsPanel({ news }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PanelHeader title="MARKET NEWS" right={
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.5s infinite" }} />
          LIVE
        </span>
      } />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {news.length === 0 && (
          <div style={{ padding: 16, color: C.textDim, fontSize: 10 }}>Loading news…</div>
        )}
        {news.map((item, i) => (
          <a key={i} href={item.url} target="_blank" rel="noreferrer"
            style={{ display: "block", padding: "8px 10px", borderBottom: `1px solid ${C.border}`, transition: "background 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#111118"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <span style={{ color: C.textDim, fontSize: 8, fontFamily: "monospace" }}>
                {new Date(item.datetime * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {item.source && (
                <span style={{ background: C.accentDim, color: C.accent, fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 2, letterSpacing: 0.5 }}>
                  {item.source.toUpperCase().slice(0, 9)}
                </span>
              )}
            </div>
            <div style={{ color: C.text, fontSize: 10, lineHeight: 1.5 }}>{item.headline}</div>
            {item.summary && (
              <div style={{
                color: C.textDim, fontSize: 9, lineHeight: 1.4, marginTop: 3,
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              }}>
                {item.summary}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function QuoteDetail({ ticker, quote }) {
  const up = (quote?.d ?? 0) >= 0;
  const cells = quote ? [
    ["BID",    `$${fmt((quote.c ?? 0) - 0.01)}`],
    ["ASK",    `$${fmt((quote.c ?? 0) + 0.01)}`],
    ["OPEN",   `$${fmt(quote.o)}`],
    ["CLOSE",  `$${fmt(quote.pc)}`],
    ["HI",     `$${fmt(quote.h)}`],
    ["LO",     `$${fmt(quote.l)}`],
  ] : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PanelHeader title="QUOTE DETAIL" right={ticker} />
      {cells.length > 0 ? (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {cells.map(([k, v], i) => (
            <div key={i} style={{
              padding: "8px 10px",
              borderRight: i % 2 === 0 ? `1px solid ${C.border}` : "none",
              borderBottom: `1px solid ${C.border}`,
              background: Math.floor(i / 2) % 2 === 0 ? C.panel : C.panelAlt,
            }}>
              <div style={{ color: C.textDim, fontSize: 8, letterSpacing: 0.5, marginBottom: 4 }}>{k}</div>
              <div style={{ color: C.textBright, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim, fontSize: 10 }}>
          No data
        </div>
      )}
    </div>
  );
}

function CommandBar({ onCommand, message }) {
  const [input, setInput] = useState("");
  const inputRef = useRef(null);
  const handleKey = (e) => {
    if (e.key === "Enter" && input.trim()) {
      onCommand(input.trim().toUpperCase());
      setInput("");
    }
  };
  return (
    <div style={{ background: "#060608", borderTop: `1px solid ${C.border}`, padding: "5px 12px 6px", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: C.accent, fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>CMD</span>
        <span style={{ color: C.textDim, fontSize: 12 }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          placeholder="Enter ticker (e.g. AAPL, TSLA, COIN, SPY)…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: C.green, fontSize: 11, fontFamily: "monospace", caretColor: C.green,
          }}
        />
        <span style={{ color: C.textDim, fontSize: 8 }}>↵ ENTER</span>
      </div>
      {message && (
        <div style={{ color: C.textDim, fontSize: 9, fontFamily: "monospace", marginTop: 2 }}>› {message}</div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function Terminal() {
  const [tickers, setTickers]   = useState(DEFAULT_TICKERS);
  const [selected, setSelected] = useState(DEFAULT_TICKERS[0]);
  const [cmdMsg, setCmdMsg]     = useState("");
  const [time, setTime]         = useState(null);

  useEffect(() => {
    setTime(new Date());
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const quotes  = useAllQuotes(tickers);
  const candles = useCandles(selected);
  const profile = useProfile(selected);
  const metrics = useMetrics(selected);
  const news    = useNews();
  const mktStatus = useMarketStatus();

  const handleCommand = (cmd) => {
    if (/^[A-Z.]{1,6}$/.test(cmd)) {
      if (!tickers.includes(cmd)) setTickers(prev => [cmd, ...prev.slice(0, 9)]);
      setSelected(cmd);
      setCmdMsg(`Loaded ${cmd}`);
    } else {
      setCmdMsg(`Unknown: ${cmd}`);
    }
  };

  return (
    <>
      <Head>
        <title>Bloomberg Terminal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: C.bg, color: C.text, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Header status={mktStatus} time={time ?? new Date()} />
        <TickerTape quotes={quotes} tickers={tickers} />

        {/* Main Grid */}
        <div style={{
          flex: 1, minHeight: 0,
          display: "grid",
          gridTemplateColumns: "260px 1fr 210px",
          gridTemplateRows: "1fr 190px",
          gap: 1,
          background: C.border,
          overflow: "hidden",
        }}>
          {/* Watchlist — spans both rows */}
          <div style={{ background: C.panel, overflow: "hidden", gridRow: "1 / 3" }}>
            <Watchlist tickers={tickers} quotes={quotes} selected={selected} onSelect={setSelected} />
          </div>

          {/* Chart */}
          <div style={{ background: C.panel, overflow: "hidden" }}>
            <ChartPanel ticker={selected} candles={candles} quote={quotes[selected]} profile={profile} />
          </div>

          {/* Fundamentals */}
          <div style={{ background: C.panel, overflow: "hidden" }}>
            <FundamentalsPanel quote={quotes[selected]} metrics={metrics} profile={profile} />
          </div>

          {/* News */}
          <div style={{ background: C.panel, overflow: "hidden" }}>
            <NewsPanel news={news} />
          </div>

          {/* Quote Detail */}
          <div style={{ background: C.panel, overflow: "hidden" }}>
            <QuoteDetail ticker={selected} quote={quotes[selected]} />
          </div>
        </div>

        <CommandBar onCommand={handleCommand} message={cmdMsg} />
      </div>
    </>
  );
}
