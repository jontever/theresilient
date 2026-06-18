// UK cyber-threat news via GDELT DOC 2.0 API (free, no key).
// Surfaces recent news of cyber attacks, ransomware and breaches reported by UK sources.
//
// GDELT can be slow and rate-limits frequent callers, so we keep this to one primary
// request (with a single light fallback), stay inside the function's maxDuration, and
// rely on edge caching (see Cache-Control below) to keep upstream calls infrequent.

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";
const PRIMARY = '(cyberattack OR ransomware OR "data breach" OR hacking) sourcecountry:UK';
const FALLBACK = '(cyber OR ransomware OR breach OR hacking OR NCSC) sourcecountry:UK';

// Encode spaces as %20 and quotes as %22, but keep ":" literal. GDELT treats an
// encoded "sourcecountry%3AUK" as a keyword (0 results) instead of the operator,
// so the colon must NOT be percent-encoded.
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
      headers: {
        // GDELT serves empty/blocked responses to some non-browser agents.
        "User-Agent": "Mozilla/5.0 (compatible; theresilient.uk/1.0; +https://theresilient.uk)",
        Accept: "application/json",
      },
    });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || text.trim()[0] !== "{") return null; // GDELT returns plain-text on a bad query / rate limit
    return JSON.parse(text);
  } catch {
    return null;
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
  try {
    let data = await tryFetch(buildUrl(PRIMARY, "14d"), 9000);
    if (!data || !(data.articles || []).length) {
      data = await tryFetch(buildUrl(FALLBACK, "30d"), 5000);
    }
    const items = normalise(data && data.articles);
    res.status(200).json({ updated: new Date().toISOString(), source: "GDELT", items });
  } catch (e) {
    res.status(200).json({ error: "News feed temporarily unavailable", items: [] });
  }
};
