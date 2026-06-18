// NVD recent CRITICAL CVEs (CVSS >= 9.0) from the last 7 days.
// Optional env var NVD_API_KEY raises the rate limit (set in Vercel project settings).

function iso(d) {
  return d.toISOString().replace("Z", "");
}

function scoreOf(cve) {
  const m = cve.metrics || {};
  const pick = (arr) => (arr && arr[0] && arr[0].cvssData ? arr[0].cvssData.baseScore : null);
  return pick(m.cvssMetricV31) ?? pick(m.cvssMetricV30) ?? pick(m.cvssMetricV2) ?? null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  try {
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
    const url =
      "https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL" +
      `&pubStartDate=${encodeURIComponent(iso(start) + ":000")}` +
      `&pubEndDate=${encodeURIComponent(iso(end) + ":000")}` +
      "&resultsPerPage=50";

    const headers = { "User-Agent": "theresilient.uk-dashboard/1.0", Accept: "application/json" };
    if (process.env.NVD_API_KEY) headers.apiKey = process.env.NVD_API_KEY;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch(url, { signal: ctrl.signal, headers });
    clearTimeout(t);
    if (!r.ok) throw new Error("NVD upstream " + r.status);
    const data = await r.json();

    const items = (data.vulnerabilities || [])
      .map((w) => w.cve)
      .map((c) => ({
        id: c.id,
        published: c.published,
        score: scoreOf(c),
        description: ((c.descriptions || []).find((d) => d.lang === "en") || {}).value?.slice(0, 240) || "",
        link: `https://nvd.nist.gov/vuln/detail/${c.id}`,
      }))
      .filter((c) => c.score == null || c.score >= 9)
      .sort((a, b) => (b.score || 0) - (a.score || 0) || (a.published < b.published ? 1 : -1))
      .slice(0, 10);

    res.status(200).json({ updated: new Date().toISOString(), window: "7d", items });
  } catch (e) {
    res.status(200).json({ error: "NVD feed temporarily unavailable", items: [] });
  }
};
