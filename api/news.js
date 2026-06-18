// UK cyber-threat news from UK security-press RSS/Atom feeds.
//
// Replaces the earlier GDELT-backed version: GDELT's free API rate-limits to ~1 request
// / 5s per IP and Vercel runs functions on shared IPs, so it returned HTTP 429 almost
// every time. These RSS feeds don't rate-limit, are reachable server-side, and give
// cleaner UK-relevant signal. Each source degrades independently if briefly unavailable.

const { fetchFeed } = require("./_rss");

const SOURCES = [
  { url: "https://www.infosecurity-magazine.com/rss/news/", source: "Infosecurity Magazine" },
  { url: "https://www.theregister.com/security/headlines.atom", source: "The Register" },
  { url: "https://grahamcluley.com/feed/", source: "Graham Cluley" },
];

function ts(d) {
  const n = Date.parse(d);
  return isNaN(n) ? 0 : n;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=86400");
  try {
    const results = await Promise.all(SOURCES.map((s) => fetchFeed(s.url, s.source)));
    const seen = new Set();
    const items = results
      .flat()
      .filter((i) => i.title && i.link && !seen.has(i.link) && seen.add(i.link))
      .map((i) => ({ title: i.title, url: i.link, date: i.date, source: i.source }))
      .sort((a, b) => ts(b.date) - ts(a.date))
      .slice(0, 10);

    if (!items.length) res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json({ updated: new Date().toISOString(), items });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json({ error: "News feed temporarily unavailable", items: [] });
  }
};
