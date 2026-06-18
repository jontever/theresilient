// Minimal dependency-free RSS/Atom parser.
// Returns [{ title, link, date, summary }] sorted newest-first.

function decode(s) {
  if (!s) return "";
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1] : "";
}

function parseFeed(xml) {
  const items = [];
  // RSS <item> ... </item>
  const rss = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of rss) {
    items.push({
      title: decode(tag(block, "title")),
      link: decode(tag(block, "link")),
      date: tag(block, "pubDate") || tag(block, "dc:date") || "",
      summary: decode(tag(block, "description")).slice(0, 220),
    });
  }
  // Atom <entry> ... </entry>
  const atom = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of atom) {
    const linkM = block.match(/<link[^>]*href="([^"]+)"/i);
    items.push({
      title: decode(tag(block, "title")),
      link: linkM ? linkM[1] : decode(tag(block, "id")),
      date: tag(block, "updated") || tag(block, "published") || "",
      summary: decode(tag(block, "summary") || tag(block, "content")).slice(0, 220),
    });
  }
  return items;
}

async function fetchFeed(url, source, timeoutMs = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "theresilient.uk-dashboard/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    return parseFeed(xml).map((i) => ({ ...i, source }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

module.exports = { parseFeed, fetchFeed, decode };
