# OSM Offline Downloader

A **static, browser-based tool** for downloading OpenStreetMap vector data for any area of the world, styling it with code-rendered cartography (no raster tiles), and exporting an **offline web map** and/or **GIS-ready files**.

Select a rectangle on the map, customize colors and labels, then download a zip you can open offline or import into QGIS and other GIS software.

---

## Features

- **Area download** — Draw a bounding box anywhere on the world map. Data is fetched from the [Overpass API](https://overpass-api.de) and converted to GeoJSON with [osmtogeojson](https://github.com/tyrasd/osmtogeojson).
- **No tile storage** — The map is drawn from vector data + JavaScript cartography code, not downloaded PNG/JPEG tiles. One download covers zoom levels 0–19.
- **Live style editor** — Adjust every OSM layer class (landuse, water, buildings, roads, railways, waterways, boundaries, place/POI labels): colors, stroke width, opacity, dashes, visibility, label color/size. Changes apply instantly on the preview map.
- **Multiple map themes** — Standard, Carto Classic, Wikimedia, High Contrast, and Warm Carto palettes, all rendered in code.
- **Persian (فارسی) UI** — English/Persian toggle with full RTL layout support.
- **Flexible export** — Choose what to download:
  - **Offline map only** — Self-contained `viewer.html` + bundled libraries + your style settings.
  - **GIS files only** — GeoJSON layers + raw `.osm` XML (`osm-gis-export.zip`).
  - **Both** — Offline map and GIS folder in one zip (`osm-offline-map.zip`).
- **Smart caching** — After the first download for an area, change the theme or layer styles and download again **without re-fetching** from Overpass (data is reused from memory).
- **Large areas** — Selections bigger than a single Overpass request are split into ~90 km² tiles, fetched sequentially with retries and mirror rotation, then merged.

---

## Quick start

No build step, no backend, no API keys.

1. Clone or download this repository.
2. Open `index.html` in a modern browser (Chrome, Firefox, Edge, Safari).

   You can also serve the folder over HTTP:

   ```bash
   python -m http.server 8080
   # open http://localhost:8080
   ```

3. Click **Select area**, drag a rectangle on the map, pick a download option, and click **Download**.

> **Note:** The app needs network access for the OSM basemap (area selection only), Overpass API requests, and CDN scripts while you use the downloader. The **exported zip** works fully offline.

---

## How to use

1. **Select area** — Click the button, then drag a rectangle on the world map.
2. **Style the map** (optional) — Choose a **Map style** theme and open the layer gear icons to edit per-class styling.
3. **Choose download content** — Radio buttons under **Download**:
   - *Offline map + GIS files* (default)
   - *Offline map only*
   - *GIS files only (GeoJSON + raw OSM)*
4. **Download** — Wait for Overpass fetch, packaging, and save the zip to disk.
5. **Offline map** — Extract the zip and open `viewer.html` in a browser. No server required.
6. **GIS workflow** — Use files under `gis/` (see below). For shapefiles, import GeoJSON or `.osm` in QGIS and export from there (see [GIS export](#gis-export-geojson--raw-osm)).

To repackage the same area with a new style, change settings and click **Download** again — cached OSM data is reused when the bounding box matches.

---

## Download output

| Option | Zip filename | Contents |
|--------|--------------|----------|
| Offline map (+ optional GIS) | `osm-offline-map.zip` | `viewer.html`, `libs/`, `data/`, optional `gis/` |
| GIS only | `osm-gis-export.zip` | `gis/` folder + `README.txt` |

### Offline map bundle

```
osm-offline-map.zip
├── viewer.html              # Open this for the offline map (read-only)
├── README.txt               # Bundle info and attribution
├── libs/
│   ├── leaflet.js           # Bundled for offline use
│   ├── leaflet.css
│   └── osm-carto-style.js   # Cartography renderer + style profiles
└── data/
    ├── map.osm              # Raw OSM XML (Overpass bbox export)
    ├── map.geojson          # Full GeoJSON for the area
    └── map-data.js          # GeoJSON + your style overrides + theme
                             # (embedded as JS so viewer.html works via file://)
```

When GIS export is included, a `gis/` folder is added (see below).

---

## GIS export (GeoJSON + raw OSM)

Shapefiles are **not** included. OSM tag sets are too varied for DBF shapefile columns (10-character names, 255-field limit, sparse `access:*` / `change:*` tags across features). **GeoJSON preserves every tag** with original names, including Persian text in UTF-8.

```
gis/
├── osm_all.geojson           # Complete dataset, all features and tags
├── data/map.osm              # Raw OSM XML
├── osm_all_points.geojson    # All points
├── osm_all_lines.geojson     # All lines
├── osm_all_polygons.geojson  # All polygons
├── osm_<class>.geojson       # Per map layer (roads, buildings, place, …)
├── osm_other_*.geojson       # Features not used by the styled map
└── README.txt                # Export manifest
```

**Using in QGIS**

1. *Vector* → *Add Vector Layer* → select `gis/osm_all.geojson` or `gis/data/map.osm`.
2. All OSM tags appear in the attribute table with original keys (e.g. `name:fa`).
3. To create shapefiles: right-click layer → *Export* → *Save Features As…* → ESRI Shapefile (QGIS handles field naming better than a browser-side converter).

---

## Map style themes

All themes are **reimplemented in JavaScript** (`js/cartography-styles.js` + `js/osm-carto-style.js`). They are inspired by well-known basemap palettes, not copied tile assets or official style files. This project is **not affiliated** with Wikimedia, the OSM Carto project, or any third-party map provider.

| Theme | Description | Inspiration |
|-------|-------------|-------------|
| **Standard** | Minimal grey/white road network, neutral landuse | [openstreetmap-carto](https://github.com/gravitystorm/openstreetmap-carto) (simplified palette) |
| **Carto Classic** | Full OSM Carto-style road hierarchy and landcover colors | [openstreetmap-carto](https://github.com/gravitystorm/openstreetmap-carto) |
| **Wikimedia** | Cream land, soft blues, pastel greens, warm road hierarchy | [Wikimedia Maps](https://maps.wikimedia.org/) basemap tile style |
| **High Contrast** | Bold black outlines, heavy road casings, strong labels and POI badges | Similar to OpenTopoMap style |
| **Warm Carto** | Soft cream background, low-contrast buildings, warm road fills | Warm variant inspired by OSM Carto–like palettes |

The active theme and your per-layer overrides are saved into `data/map-data.js` and applied in the offline `viewer.html`.

---

## Cartography engine

`js/osm-carto-style.js` renders OSM GeoJSON in the browser using Leaflet and HTML5 Canvas:

- Polygon fills (landuse, water, buildings) with theme-specific palettes
- Roads in casing + fill passes, zoom-dependent widths, dashed paths/tracks
- Railways, administrative boundaries, waterways
- **Labels** — Place names, road names (rotated along lines), waterway names, POI labels; collision detection and zoom-based visibility
- Layer ordering via Leaflet panes (land → water → buildings → roads → rail → boundaries → labels)

For palette sources and inspiration credits, see [Map style themes](#map-style-themes) above.

---

## Project structure

```
.
├── index.html              # App entry point
├── css/style.css           # UI styles (incl. RTL)
├── js/
│   ├── app.js              # Map, download flow, zip bundling
│   ├── i18n.js             # English / Persian strings
│   ├── gis-toolkit.js      # Layer panel & style editor UI
│   ├── gis-export.js       # GeoJSON + OSM GIS export
│   ├── osm-carto-style.js  # Vector renderer & style overrides
│   └── cartography-styles.js # Theme definitions (Standard, Carto, …)
└── README.md
```

**Runtime dependencies (CDN, not bundled in repo):**

- [Leaflet](https://leafletjs.com/) 1.9.4
- [JSZip](https://stuk.github.io/jszip/) 3.x
- [osmtogeojson](https://github.com/tyrasd/osmtogeojson) 3.x

Leaflet and the cartography scripts are **copied into each offline zip** under `libs/`.

---

## Download method (Overpass)

The download **workflow** is inspired by the [OSMDownloader](https://github.com/lcoandrade/OSMDownloader) QGIS plugin: draw a bounding box, fetch OSM from Overpass, save raw `.osm` XML. This app is **not** a port of that plugin — it is original JavaScript with its own implementation.

| | OSMDownloader (QGIS) | This app |
|--|----------------------|----------|
| Overpass call | POST `/api/interpreter` (Overpass XML query) | GET `/api/map?bbox=W,S,E,N` |
| Large areas | Single request | Split into ~90 km² tiles, then merged |
| Output | `.osm` file | `.osm` + GeoJSON + offline viewer + GIS export |
| Styling | Bundled QML for QGIS | In-browser cartography (JavaScript) |

Steps in this app:

1. User selects a bounding box.
2. Raw OSM XML is requested from Overpass (`/api/map?bbox=…`) and saved as `map.osm`.
3. Data is converted to GeoJSON and rendered with the in-browser cartography engine.

### Fair use

- The app warns on large selections and splits areas **≈90 km² per tile**, with a short delay between requests.
- Failed tiles retry with exponential backoff, honour `Retry-After` on HTTP 429, and rotate across public Overpass mirrors.
- If a tile still fails, you can choose to keep retrying or abort; completed tiles are kept.

For continent-scale or bulk extracts, prefer [Geofabrik](https://download.geofabrik.de/) or [planet.osm](https://planet.openstreetmap.org/).

---

## GitHub Pages (optional)

To host a live demo from this repo:

1. Push to GitHub.
2. *Settings* → *Pages* → deploy from branch `main`, folder `/ (root)`.
3. Open `https://<username>.github.io/<repo>/`.

The app still requires Overpass and CDN access when downloading; exported zips remain fully offline.

---

## License & attribution

- **Map data** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, licensed under [ODbL](https://opendatacommons.org/licenses/odbl/).
- **Overpass API** — volunteer-run service; please use responsibly ([Overpass usage policy](https://operations.osmfoundation.org/policies/overpass/)).
- **Map style palettes** — visual inspiration only (reimplemented in this repo’s JavaScript). See the [Map style themes](#map-style-themes) table for per-theme credits, including [openstreetmap-carto](https://github.com/gravitystorm/openstreetmap-carto) and [Wikimedia Maps](https://maps.wikimedia.org/).
- **Application source** — add your own `LICENSE` file if you publish this repository (e.g. MIT, Apache-2.0).

When sharing maps or derivatives, credit OpenStreetMap contributors and respect the ODbL share-alike requirements for the underlying data.

---

## Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) contributors
- [Overpass API](https://overpass-api.de/)
- [OSMDownloader](https://github.com/lcoandrade/OSMDownloader) — workflow inspiration (bbox → Overpass → raw `.osm`; no code copied)
- [openstreetmap-carto](https://github.com/gravitystorm/openstreetmap-carto) — palette reference for Standard and Carto Classic themes
- [Wikimedia Maps](https://maps.wikimedia.org/) — palette reference for the Wikimedia theme (not affiliated)
- [Leaflet](https://leafletjs.com/), [osmtogeojson](https://github.com/tyrasd/osmtogeojson), [JSZip](https://stuk.github.io/jszip/)
