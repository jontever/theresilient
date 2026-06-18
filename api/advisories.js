// NCSC advisories/news (+ best-effort Action Fraud / NFIB). Degrades gracefully per source.
const { fetchFeed } = require("./_rss");

const SOURCES = [
  { url: "https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml", source: "NCSC Reports" },
  { url: "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml", source: "NCSC News" },
  { url: "https://www.ncsc.gov.uk/api/1/services/v1/all-rss-feed.xml", source: "NCSC" },
  { url: "https://www.actionfraud.police.uk/feeds/alerts", source: "Action Fraud" },
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
      .sort((a, b) => ts(b.date) - ts(a.date))
      .slice(0, 10);
    res.status(200).json({ updated: new Date().toISOString(), items });
  } catch (e) {
    res.status(200).json({ error: "Advisory feeds temporarily unavailable", items: [] });
  }
};
