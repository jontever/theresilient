// UK cyber-threat news via GDELT DOC 2.0 API (free, no key).
// Surfaces recent news of cyber attacks, ransomware and breaches reported by UK sources.

const BASE = "https://api.gdeltproject.org/api/v2/doc/doc";

// Tried in order; first query that returns articles wins.
const QUERIES = [
  '(cyberattack OR ransomware OR "data breach" OR "cyber attack" OR hacked) sourcecountry:UK',
  '(cyber OR ransomware OR breach OR hacking OR NCSC) sourcecountry:UK',
  '(ransomware OR "cyber attack" OR "data breach")',
];

function buildUrl(q, timespan) {
  const p = new URLSearchParams({
    query: q,
    mode: "ArtList",
    format: "json",
    maxrecords: "30",
    timespan: timespan,
    sort: "DateDesc",
  });
  return BASE + "?" + p.toString();
}

// GDELT seendate looks like "20260618T120000Z" -> ISO.
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return s;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

async function tryFetch(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theresilient.uk-dashboard/1.0", Accept: "application/json" },
    });
    if (!r.ok) return null;
    const text = await r.text();
    if (!text || text.trim()[0] !== "{") return null; // GDELT returns plain-text on bad query
    return JSON.parse(text);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  try {
    let articles = [];
    outer: for (const span of ["14d", "30d"]) {
      for (const q of QUERIES) {
        const data = await tryFetch(buildUrl(q, span));
        if (data && Array.isArray(data.articles) && data.articles.length) {
          articles = data.articles;
          break outer;
        }
      }
    }

    const seen = new Set();
    const items = articles
      .filter((a) => !a.language || a.language === "English")
      .map((a) => ({
        title: a.title || "",
        url: a.url || "",
        domain: a.domain || "",
        date: parseDate(a.seendate),
        country: a.sourcecountry || "",
      }))
      .filter((a) => a.title && a.url)
      .filter((a) => {
        const key = a.title.toLowerCase().slice(0, 60);
        return seen.has(key) ? false : seen.add(key);
      })
      .sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0))
      .slice(0, 10);

    res.status(200).json({ updated: new Date().toISOString(), source: "GDELT", items });
  } catch (e) {
    res.status(200).json({ error: "News feed temporarily unavailable", items: [] });
  }
};
