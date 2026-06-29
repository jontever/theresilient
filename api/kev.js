// CISA Known Exploited Vulnerabilities (KEV) — newest entries + "latest exploited vuln".
const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(KEV_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theresilient.uk-dashboard/1.0", Accept: "application/json" },
    });
    clearTimeout(t);
    if (!r.ok) throw new Error("KEV upstream " + r.status);
    const data = await r.json();

    const vulns = (data.vulnerabilities || [])
      .map((v) => ({
        cveID: v.cveID,
        vendor: v.vendorProject,
        product: v.product,
        name: v.vulnerabilityName,
        dateAdded: v.dateAdded,
        dueDate: v.dueDate,
        action: v.requiredAction,
        description: (v.shortDescription || "").slice(0, 240),
        ransomware: v.knownRansomwareCampaignUse === "Known",
      }))
      .sort((a, b) => (a.dateAdded < b.dateAdded ? 1 : -1));

    // Latest exploited vulnerability: take CISA's most recent publication (the entries
    // sharing the newest dateAdded) and prefer a ransomware-linked one; otherwise the
    // single newest. This updates whenever CISA adds new KEV entries.
    const newest = vulns[0] || null;
    const latestBatch = newest ? vulns.filter((v) => v.dateAdded === newest.dateAdded) : [];
    const featured = latestBatch.find((v) => v.ransomware) || newest;

    // Exclude the featured CVE from the list so it isn't shown twice.
    const featuredId = featured ? featured.cveID : null;
    const items = vulns.filter((v) => v.cveID !== featuredId).slice(0, 12);

    res.status(200).json({
      updated: data.dateReleased || new Date().toISOString(),
      total: data.count || vulns.length,
      featured,
      items,
    });
  } catch (e) {
    res.status(200).json({ error: "KEV feed temporarily unavailable", items: [], featured: null });
  }
};
