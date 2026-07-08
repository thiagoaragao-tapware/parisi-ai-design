# ParisiFinder

A minimalist, premium black-and-gold PWA for looking up Parisi Bathware warehouse
products by code, and for building a "Back to Stock" list of items to return to
the warehouse. Built with plain HTML, CSS, and JavaScript — no frameworks, no
build step, no backend.

## Files

| File | Purpose |
|---|---|
| `index.html` | App markup (Search, Product Detail, Back to Stock views) |
| `styles.css` | All styling (black + gold theme, layout, responsive rules) |
| `script.js` | App logic: search, suggestions, recent searches, stock list |
| `data.json` | Product catalogue, generated from the warehouse spreadsheet |
| `manifest.json` | PWA manifest (name, icons, colors, install behavior) |
| `service-worker.js` | Offline caching for the app shell + data |
| `icons/` | App icons (192px and 512px) used for install/home screen |

## Running locally

Because the app fetches `data.json` and registers a service worker, it needs to
be served over HTTP (not opened directly as a `file://` URL, which browsers
block for `fetch`). Any static file server works, for example:

```bash
cd parisifinder
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one).
2. Copy all files in this folder (`index.html`, `styles.css`, `script.js`,
   `data.json`, `manifest.json`, `service-worker.js`, `icons/`) into the root
   of the repository — keep them all at the same level, do not nest them in a
   subfolder unless you also update the paths.
3. Commit and push to GitHub:
   ```bash
   git init
   git add .
   git commit -m "ParisiFinder PWA"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```
4. In your GitHub repository, go to **Settings → Pages**.
5. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   choose the `main` branch and the `/ (root)` folder, then **Save**.
6. GitHub will publish the site at:
   `https://<your-user>.github.io/<your-repo>/`
   (this can take a minute or two the first time).
7. Open that URL on your phone and use **"Add to Home Screen"** (Safari) or
   the browser's install prompt (Chrome/Android) to install it as an app.

All paths in this project are relative, so it works correctly whether it's
served from the domain root or from a GitHub Pages project subpath.

## Updating the product data

The warehouse data lives entirely in `data.json`, generated from the supplied
spreadsheet. Each product has this shape:

```json
{
  "code": "P30.02WF240",
  "description": "Envy 30 Wall Bath Spout 240mm Chrome",
  "category": "Bath Wall Spout",
  "status": "Stocked",
  "quantity": 16,
  "available": 16,
  "location": "D1.03",
  "shelf": ""
}
```

Notes on the source data:

- **Location** was normalized from the spreadsheet's `LOCATION` column
  (e.g. `"D1 03"` → `"D1.03"`). Products with no location in the spreadsheet
  have `"location": ""`, which the app shows as **"No location"** (grey, not
  green).
- **Shelf** is left blank (`""`) because the source spreadsheet does not
  contain a separate shelf column — the app displays **"Not available"**
  for it. If you get a shelf mapping later, add a `"shelf"` value per
  product and it will show automatically.
- **Quantity** comes from the spreadsheet's `Stock Level` column.
- **Last updated** (`updated` field, optional, ISO date string) is not in the
  source spreadsheet either; add it per product if you want real timestamps
  to show instead of "Not available".

### Regenerating `data.json` from a new spreadsheet

If you get an updated spreadsheet with the same column layout
(`Product`, `Description`, `Description.1`, `Stocking Status`, `Stock Level`,
`Available Stock`, `LOCATION`, ...), you can regenerate `data.json` with a
short Python script using `pandas`:

```python
import pandas as pd, json, re

df = pd.read_excel("your-file.xlsx", dtype=str).fillna("")

def clean_num(s):
    s = str(s).strip().replace(",", "")
    if not s:
        return None
    try:
        f = float(s)
        return int(f) if f == int(f) else f
    except ValueError:
        return None

def clean_loc(s):
    s = str(s).strip()
    return re.sub(r"\s+", ".", s).upper() if s else ""

products = []
for _, row in df.iterrows():
    code = row["Product"].strip()
    if not code:
        continue
    products.append({
        "code": code,
        "description": row["Description"].strip(),
        "category": row["Description.1"].strip(),
        "status": row["Stocking Status"].strip(),
        "quantity": clean_num(row["Stock Level"]),
        "available": clean_num(row["Available Stock"]),
        "location": clean_loc(row["LOCATION"]),
        "shelf": "",
    })

json.dump({"products": products}, open("data.json", "w"),
           ensure_ascii=False, separators=(",", ":"))
```

Then just replace `data.json` in the repo and push — the service worker
fetches it network-first, so users get the fresh data next time they're
online, and it still works offline from the last cached version.

## Features

- **Search** — type a product code to see live suggestions, or press Enter /
  tap the arrow to jump straight to the closest match.
- **Suggestions** — ranked so products **with** a location appear first,
  without hiding products that have no location.
- **Product detail** — shows Description, Code, Quantity, Location, Shelf,
  and Last Updated, with graceful "No location" / "Not available" fallback
  text for missing fields.
- **Recent searches** — stored locally on the device (`localStorage`), shown
  on the home screen with a colored status pill (green = has a location,
  grey = no location).
- **Back to Stock** — search and add multiple items to a return list, shown
  as Item Code + Location, removable individually, with a
  "Send to Stock (n)" action that clears the list.
- **Installable PWA** — add-to-home-screen on iOS/Android, works offline
  after first load thanks to the service worker caching the app shell and
  data.

## Design

Matte black background with a very subtle CSS-only noise texture (no image
assets used anywhere in the app), a serif "PARISI / BATHWARE" wordmark, thin
uppercase tracked labels, gold-outlined pill buttons and search bar with a
soft glow, and green-only status indicators for items that have a warehouse
location.
