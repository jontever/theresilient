# The Resilient

Landing page for **theresilient.uk** — a curated hub of free resilience, cyber security and assurance tools for UK businesses.

It's a single static `index.html` (no build step, no dependencies), with a `vercel.json` that adds sensible security headers.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The landing page (self-contained: HTML, CSS and inline UK map SVG). |
| `vercel.json` | Static config + security headers (HSTS, X-Frame-Options, etc.). |
| `README.md` | This file. |

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

Just open `index.html` in a browser, or:

```powershell
python -m http.server 8000
# then visit http://localhost:8000
```

## Edit the tool links

All links live in the `.grid` section of `index.html` as `<a class="card">` blocks — edit the `href`, `<h3>` title and `.desc` text to add, remove or reorder tools.
