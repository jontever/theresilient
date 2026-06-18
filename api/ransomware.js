// Recent UK ransomware / leak-site victims via ransomware.live (free v2 API).
const URL = "https://api.ransomware.live/v2/countryvictims/GB";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theresilient.uk-dashboard/1.0", Accept: "application/json" },
    });
    clearTimeout(t);
    if (!r.ok) throw new Error("ransomware.live upstream " + r.status);
    const data = await r.json();

    const items = (Array.isArray(data) ? data : [])
      .map((v) => ({
        victim: v.post_title || v.website || "Undisclosed",
        group: v.group_name || "Unknown",
        sector: v.activity && v.activity !== "Not Found" ? v.activity : null,
        discovered: v.discovered || v.published || null,
        published: v.published || null,
        // Link to the group's page on ransomware.live (avoid exposing raw .onion URLs).
        link: v.group_name ? `https://www.ransomware.live/group/${encodeURIComponent(v.group_name)}` : null,
      }))
      .sort((a, b) => Date.parse(b.discovered || 0) - Date.parse(a.discovered || 0))
      .slice(0, 12);

    res.status(200).json({ updated: new Date().toISOString(), country: "GB", total: items.length, items });
  } catch (e) {
    res.status(200).json({ error: "Ransomware feed temporarily unavailable", items: [] });
  }
};
