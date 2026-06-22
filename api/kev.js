// CISA Known Exploited Vulnerabilities (KEV) — newest entries + "vuln of the week".
const KEV_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
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

    // Vulnerability of the week: rotate through recent KEV entries one per week so it
    // actually changes weekly (and stays stable within a week), rather than pinning to
    // the latest ransomware entry until a newer one happens to appear. Prefer the pool of
    // ransomware-associated vulns when there are enough of them to rotate through.
    const recent = vulns.slice(0, 30);
    const ransomPool = recent.filter((v) => v.ransomware);
    const pool = ransomPool.length >= 4 ? ransomPool : recent;
    const weekIndex = Math.floor(Date.now() / 604800000); // ms in a week
    const featured = pool.length ? pool[weekIndex % pool.length] : null;

    res.status(200).json({
      updated: data.dateReleased || new Date().toISOString(),
      total: data.count || vulns.length,
      featured,
      items: vulns.slice(0, 12),
    });
  } catch (e) {
    res.status(200).json({ error: "KEV feed temporarily unavailable", items: [], featured: null });
  }
};
