// UK cyber-threat news via GDELT DOC 2.0 API (free, no key).
// Surfaces recent news of cyber attacks, ransomware and breaches reported by UK sources.
//
// GDELT rate-limits to ~1 request / 5 seconds per IP (HTTP 429). We therefore:
//   * make a SINGLE request (not several back-to-back),
//   * retry once after a >5s pause if we hit the limit,
//   * cache a successful result for 1 hour with 24h stale-while-revalidate, so one good
//     fetch is reused for everyone and survives later rate-limited refreshes,
//   * cache failures for only 30s so the panel recovers quickly.
// Add ?debug=1 to inspect each attempt's HTTP status, article count and body snippet.

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const QUERY = '(cyberattack OR ransomware OR "data breach" OR hacking) sourcecountry:UK';
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Encode spaces as %20 and quotes as %22, but keep ":" literal (GDELT treats an encoded
// "sourcecountry%3AUK" as a keyword -> 0 results).
function buildUrl(q, timespan) {
  const query = encodeURIComponent(q).replace(/%3A/g, ":");
  return BASE + "?query=" + query + "&mode=ArtList&format=json&maxrecords=30&sort=DateDesc&timespan=" + timespan;
}

// GDELT seendate "20260618T163000Z" -> ISO 8601.
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : s;
}

async function tryFetch(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*" },
    });
    const text = await r.text();
    let data = null;
    if (text && text.trim()[0] === "{") {
      try { data = JSON.parse(text); } catch (e) {}
    }
    return { status: r.status, ok: r.ok, snippet: (text || "").slice(0, 200), data };
  } catch (e) {
    return { status: 0, ok: false, snippet: String((e && e.message) || e), data: null };
  } finally {
    clearTimeout(t);
  }
}

function hasArticles(r) {
  return !!(r && r.data && Array.isArray(r.data.articles) && r.data.articles.length);
}

function normalise(articles) {
  const seen = new Set();
  return (articles || [])
    .filter((a) => !a.language || a.language === "English")
    .map((a) => ({
      title: (a.title || "").trim(),
      url: a.url || "",
      domain: a.domain || "",
      date: parseDate(a.seendate),
    }))
    .filter((a) => a.title && a.url)
    .filter((a) => {
      const key = a.title.toLowerCase().slice(0, 60);
      return seen.has(key) ? false : seen.add(key);
    })
    .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))
    .slice(0, 10);
}

module.exports = async (req, res) => {
  const debug = req.query && (req.query.debug === "1" || req.query.debug === "true");
  const diag = [];
  const url = buildUrl(QUERY, "14d");
  try {
    let r = await tryFetch(url, 7000);
    diag.push({ attempt: 1, status: r.status, articles: hasArticles(r) ? r.data.articles.length : 0, snippet: debug ? r.snippet : undefined });

    // If rate-limited (or no usable data), wait past the 5s window and retry once.
    if (!hasArticles(r)) {
      await sleep(5500);
      r = await tryFetch(url, 7000);
      diag.push({ attempt: 2, status: r.status, articles: hasArticles(r) ? r.data.articles.length : 0, snippet: debug ? r.snippet : undefined });
    }

    const items = normalise(r.data && r.data.articles);
    if (items.length) {
      res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    } else {
      res.setHeader("Cache-Control", "s-maxage=30"); // recover quickly
    }
    const out = { updated: new Date().toISOString(), source: "GDELT", items };
    if (debug) { out._debug = diag; out._url = url; }
    res.status(200).json(out);
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(200).json({ error: "News feed temporarily unavailable", items: [], _debug: debug ? String((e && e.message) || e) : undefined });
  }
};
