# The Resilient

Landing page for **theresilient.uk** — a curated hub of free resilience, cyber security and assurance tools for UK businesses.

A static `index.html` (no build step) plus a few dependency-free Vercel serverless functions in `/api` that power two live dashboards: a **UK Cyber Threat Dashboard** and a **Ransomware & Breach Tracker**.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The landing page — tool links, UK map, and the two live dashboards. |
| `api/kev.js` | CISA Known Exploited Vulnerabilities + "latest exploited vulnerability" callout (newest KEV, favouring ransomware-linked). |
| `api/news.js` | Cyber-threat news from security-press RSS (Infosecurity Magazine, The Register, BleepingComputer, The Hacker News, Graham Cluley). |
| `api/advisories.js` | NCSC reports/news (+ best-effort Action Fraud) via RSS. |
| `api/ransomware.js` | Recent UK ransomware/leak-site victims (ransomware.live). |
| `api/_rss.js` | Shared RSS/Atom parser (not a route; `_`-prefixed files are ignored by Vercel routing). |
| `vercel.json` | Function config + security headers (HSTS, X-Frame-Options, etc.). |
| `README.md` | This file. |

## How the live data works

The page calls four same-origin endpoints (`/api/kev`, `/api/news`, `/api/advisories`, `/api/ransomware`). Each function fetches its upstream feed **server-side** (avoiding browser CORS limits), normalises it to small JSON, and sets edge-cache headers (`s-maxage`) so the upstreams aren't hammered and the page stays fast. If a feed is briefly unavailable, that panel shows a graceful "temporarily unavailable" message instead of breaking the page.

| Endpoint | Source | Cache |
|----------|--------|-------|
| `/api/kev` | CISA KEV JSON feed | 1 hour |
| `/api/news` | Security-press RSS (Infosecurity Magazine, The Register, BleepingComputer, The Hacker News, Graham Cluley) | 5 min |
| `/api/advisories` | NCSC RSS (+ Action Fraud, best-effort) | 30 min |
| `/api/ransomware` | ransomware.live `v2/countryvictims/GB` | 1 hour |

### History of the news panel (NVD → GDELT → RSS)

This panel went through two data sources before landing on RSS:

1. **NVD critical CVEs** — NVD's API times out and rate-limits from serverless/datacenter IPs, so it frequently showed "unavailable".
2. **GDELT** — free and keyless, but its API rate-limits to ~1 request / 5 seconds *per IP*, and Vercel runs functions on shared IPs, so it returned HTTP 429 on virtually every request. It also produced noisy false positives for `sourcecountry:UK`.
3. **UK security-press RSS** (current) — `api/news.js` aggregates a few UK-focused security outlets via the shared `api/_rss.js` parser. RSS feeds don't rate-limit, are reliable server-side, and give cleaner UK-relevant signal. Edit the `SOURCES` array in `api/news.js` to add or change outlets.

## Deploy from GitHub to Vercel

These steps use PowerShell and assume your GitHub username is `jontever`.

### 1. Create the repo and push (PowerShell)

```powershell
cd "$env:USERPROFILE\Documents\Claude\Projects\Resilient"
git init
git add .
git commit -m "Initial landing page for theresilient.uk"
git branch -M main
git remote add origin https://github.com/jontever/theresilient.git
git push -u origin main
```

(Create the empty `theresilient` repo on github.com first, or use the GitHub CLI: `gh repo create jontever/theresilient --public --source . --push`.)

### 2. Import into Vercel

1. Go to https://vercel.com/new and import the `jontever/theresilient` repo.
2. Framework preset: **Other**. Build command: *(leave empty)*. Output directory: *(leave empty / root)*.
3. Click **Deploy**. You'll get a `*.vercel.app` URL.

### 3. Add your custom domain

1. In the Vercel project → **Settings → Domains** → add `theresilient.uk` (and `www.theresilient.uk`).
2. Vercel shows the DNS records to set at your domain registrar:
   - **Apex** `theresilient.uk` → A record to `76.76.21.21`, **or** use Vercel's nameservers.
   - **www** → CNAME to `cname.vercel-dns.com`.
3. Once DNS propagates, Vercel issues an SSL certificate automatically.

Any future `git push` to `main` redeploys the site automatically.

## Local preview

Opening `index.html` directly shows the page, but the `/api/*` dashboards only run on Vercel. To preview them locally with the functions, use the Vercel CLI:

```powershell
npm i -g vercel
vercel dev
# then visit the printed http://localhost:3000
```

## Edit the tool links

All links live in the `.grid` section of `index.html` as `<a class="card">` blocks — edit the `href`, `<h3>` title and `.desc` text to add, remove or reorder tools.

## Notes on the threat data

The dashboards are an at-a-glance signpost, not an exhaustive or authoritative feed — always confirm against the original source before acting. Ransomware victims are shown as self-reported on leak sites (country tagging can be imperfect), and links point to the group's ransomware.live page rather than raw `.onion` addresses.
