// UK cyber-threat news via GDELT DOC 2.0 API (free, no key).
// Surfaces recent news of cyber attacks, ransomware and breaches reported by UK sources.
//
// Add ?debug=1 to the request to see, per attempt, the upstream HTTP status, the number
// of articles, the exact URL and a short body snippet — handy for diagnosing zero-result
// or blocked responses in production.

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const PRIMARY = '(cyberattack OR ransomware OR "data breach" OR hacking) sourcecountry:UK';
const FALLBACK = '(cyber OR ransomware OR breach OR hacking OR NCSC) sourcecountry:UK';

// Vanilla browser User-Agent. GDELT / its CDN returns empty or blocked bodies to some
// non-browser or unusual agents, so we present as a normal browser.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Encode spaces as %20 and quotes as %22, but keep ":" literal. GDELT treats an encoded
// "sourcecountry%3AUK" as a keyword (0 results) instead of the operator.
function buildUrl(q, timespan) {
  const query = encodeURIComponent(q).replace(/%3A/g, ":");
  return (
    BASE +
    "?query=" + query +
    "&mode=ArtList&format=json&maxrecords=30&sort=DateDesc&timespan=" + timespan
  );
}

// GDELT seendate looks like "20260618T163000Z" -> ISO 8601.
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
    return { status: r.status, ok: r.ok, snippet: (text || "").slice(0, 300), data };
  } catch (e) {
    return { status: 0, ok: false, snippet: String((e && e.message) || e), data: null };
  } finally {
    clearTimeout(t);
  }
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
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  const debug = req.query && (req.query.debug === "1" || req.query.debug === "true");
  const diag = [];
  try {
    const attempts = [
      [PRIMARY, "14d", 9000],
      [FALLBACK, "30d", 6000],
    ];
    let data = null;
    for (const [q, span, ms] of attempts) {
      const url = buildUrl(q, span);
      const r = await tryFetch(url, ms);
      diag.push({
        query: q,
        timespan: span,
        status: r.status,
        articles: r.data && r.data.articles ? r.data.articles.length : 0,
        snippet: debug ? r.snippet : undefined,
        url: debug ? url : undefined,
      });
      if (r.data && (r.data.articles || []).length) { data = r.data; break; }
    }
    const items = normalise(data && data.articles);
    const out = { updated: new Date().toISOString(), source: "GDELT", items };
    if (debug) out._debug = diag;
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({
      error: "News feed temporarily unavailable",
      items: [],
      _debug: debug ? String((e && e.message) || e) : undefined,
    });
  }
};
