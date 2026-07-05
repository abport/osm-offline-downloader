/*
 * OSM Offline Cartography Downloader
 *
 * Displays the OSM world basemap (online, for area selection only), lets
 * the user draw a bounding box, then downloads the raw OpenStreetMap
 * vector data for that box from the Overpass API. The data is converted
 * to GeoJSON and packaged together with a code-based reimplementation of
 * the OSM Carto cartography (libs/osm-carto-style.js) into a zip saved on
 * the user's hard drive. The bundled viewer.html renders every map
 * feature from code - NO raster tiles are downloaded or stored.
 */

'use strict';

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'; // selection basemap only
const LEAFLET_JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
// Same Overpass endpoint and bbox method used by the OSMDownloader QGIS
// plugin (https://github.com/lcoandrade/OSMDownloader). Several public
// mirrors are listed; the downloader rotates across them to spread load
// and to recover when one server is rate-limiting (HTTP 429).
const OVERPASS_URL = 'https://overpass-api.de/api/map';
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/map',
  'https://overpass.kumi.systems/api/map',
  'https://maps.mail.ru/osm/tools/overpass/api/map',
  'https://overpass.private.coffee/api/map'
];

const WARN_AREA_KM2 = 10;       // confirm with the user above this
// Previously a hard cap blocked downloads above 100 km². Instead of
// blocking, large selections are now automatically split into a grid of
// smaller sub-requests (tiles) so each individual Overpass request stays
// reasonable. There is no longer a hard area limit.
const TILE_AREA_KM2 = 90;       // target max area per Overpass sub-request
const BIG_AREA_KM2 = 250;       // extra confirmation above this (many tiles)
const TILE_DELAY_MS = 2000;     // polite pause between Overpass sub-requests
const MAX_TILES = 400;          // safety guard on the number of sub-requests
// Per-tile automatic retry with exponential backoff. This is what avoids
// most HTTP 429 ("Too Many Requests") failures: instead of giving up, a
// rate-limited tile waits and retries, honouring the server's
// Retry-After header when present.
const TILE_MAX_RETRIES = 5;     // automatic attempts per tile before asking the user
const RETRY_BASE_MS = 3000;     // first backoff wait; doubles each attempt
const RETRY_MAX_MS = 30000;     // cap on a single backoff wait

/* ---------------------------------------------------------------- DOM */
const selectBtn = document.getElementById('selectBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const estimateEl = document.getElementById('estimate');
const progressWrap = document.getElementById('progressWrap');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const statusEl = document.getElementById('status');

/* ---------------------------------------------------------------- Map */
const map = L.map('map', { worldCopyJump: true }).setView([20, 0], 2);

const baseTiles = L.tileLayer(OSM_TILE_URL, {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

/* ---------------------------------------------------- GIS state */
// The most recent downloaded OSM data + live code-rendered cartography
// controller. Populated after a successful Overpass fetch so the style
// editor can restyle every OSM class live on this map.
let lastGeojson = null;
let cachedOsmXml = null;
let cachedBoundsKey = null;
let cartoController = null;
let osmRenderActive = false;
let offlineAttributionAdded = false;

// Initialise i18n + the GIS toolkit (layers panel, style editor).
// The toolkit owns the style overrides and exposes getState() for export.
I18n.applyDir();
I18n.apply();
GisToolkit.init({ map: map });
I18n.onChange(function () { updateEstimate(); });

/* Render the downloaded OSM GeoJSON into the editing map using the
 * code-based cartography, replacing the raster basemap so the user edits
 * the same rendering that gets exported. Map options and chrome match the
 * offline bundle viewer.html exactly. */
function renderOsmLive(geojson, options) {
  options = options || {};
  if (baseTiles && map.hasLayer(baseTiles)) map.removeLayer(baseTiles);
  GisToolkit.syncUiToState();
  var gisState = GisToolkit.getState();

  if (options.styleUpdateOnly && cartoController && osmRenderActive) {
    cartoController.setTheme(gisState.theme);
    cartoController.setOverrides(gisState.overrides);
  } else {
    if (cartoController && cartoController.destroy) cartoController.destroy();
    cartoController = OsmCartoStyle.render(map, geojson, gisState.overrides, gisState.theme);
    osmRenderActive = true;
    GisToolkit.setCartoController(cartoController);
  }

  if (selectionBounds) {
    var bounds = selectionBounds;
    map.setMaxBounds(bounds.pad(0.5));
    map.options.maxBoundsViscosity = 0.8;
    map.setMinZoom(0);
    map.setMaxZoom(19);

    if (selectionRect) map.removeLayer(selectionRect);
    selectionRect = L.rectangle(bounds, {
      color: '#2f6fed',
      weight: 1,
      fill: false,
      dashArray: '4 4'
    }).addTo(map);

    map.fitBounds(bounds);
    if (!offlineAttributionAdded) {
      map.attributionControl.addAttribution(
        'Map data \u00a9 OpenStreetMap contributors \u2022 cartography rendered offline from code'
      );
      offlineAttributionAdded = true;
    }
    updateMapInfo(geojson);
  }
}

function updateMapInfo(geojson) {
  var infoEl = document.getElementById('mapInfo');
  if (!infoEl) {
    infoEl = document.createElement('div');
    infoEl.id = 'mapInfo';
    document.getElementById('map').appendChild(infoEl);
  }
  var count = geojson.features ? geojson.features.length : 0;
  infoEl.textContent =
    'Offline OSM map \u2022 ' + count +
    ' features rendered from code \u2022 all zoom levels 0\u201319 \u2022 raw data: data/map.geojson';
}

/* ---------------------------------------------------- Area selection */
let selecting = false;
let drawing = false;
let startLatLng = null;
let selectionRect = null;
let selectionBounds = null;

function setSelecting(on) {
  selecting = on;
  selectBtn.classList.toggle('active', on);
  selectBtn.textContent = on ? 'Drag on map\u2026 (click to cancel)' : 'Select area';
  document.getElementById('map').classList.toggle('selecting', on);
  if (on) {
    map.dragging.disable();
  } else {
    map.dragging.enable();
    drawing = false;
    startLatLng = null;
  }
}

selectBtn.addEventListener('click', () => setSelecting(!selecting));

clearBtn.addEventListener('click', () => {
  if (selectionRect) {
    map.removeLayer(selectionRect);
    selectionRect = null;
  }
  selectionBounds = null;
  clearBtn.disabled = true;
  updateEstimate();
});

map.on('mousedown', (e) => {
  if (!selecting) return;
  drawing = true;
  startLatLng = e.latlng;
  if (selectionRect) map.removeLayer(selectionRect);
  selectionRect = L.rectangle(L.latLngBounds(startLatLng, startLatLng), {
    color: '#2f6fed',
    weight: 2,
    fillOpacity: 0.12
  }).addTo(map);
});

map.on('mousemove', (e) => {
  if (!selecting || !drawing || !selectionRect) return;
  selectionRect.setBounds(L.latLngBounds(startLatLng, e.latlng));
});

map.on('mouseup', (e) => {
  if (!selecting || !drawing) return;
  drawing = false;
  const bounds = L.latLngBounds(startLatLng, e.latlng);
  if (bounds.getSouthWest().equals(bounds.getNorthEast())) {
    if (selectionRect) {
      map.removeLayer(selectionRect);
      selectionRect = null;
    }
  } else {
    selectionBounds = normalizeBounds(bounds);
    selectionRect.setBounds(selectionBounds);
    clearBtn.disabled = false;
  }
  setSelecting(false);
  updateEstimate();
});

/** Clamp a bounds object to valid lat/lon ranges. */
function normalizeBounds(bounds) {
  const south = Math.max(-85.0511, bounds.getSouth());
  const north = Math.min(85.0511, bounds.getNorth());
  const west = Math.max(-180, bounds.getWest());
  const east = Math.min(180, bounds.getEast());
  return L.latLngBounds([south, west], [north, east]);
}

/* ----------------------------------------------------- Area estimate */
function areaKm2(bounds) {
  const dLat = bounds.getNorth() - bounds.getSouth();
  const dLon = bounds.getEast() - bounds.getWest();
  const midLat = ((bounds.getNorth() + bounds.getSouth()) / 2) * (Math.PI / 180);
  return Math.abs(dLat * 110.574 * dLon * 111.32 * Math.cos(midLat));
}

function updateEstimate() {
  if (!selectionBounds) {
    estimateEl.textContent = 'No area selected.';
    estimateEl.classList.remove('warn');
    downloadBtn.disabled = true;
    return;
  }
  const km2 = areaKm2(selectionBounds);
  const tiles = tileCountFor(selectionBounds);
  if (tiles > 1) {
    estimateEl.textContent =
      'Selected area: ' + km2.toFixed(1) + ' km\u00b2. This is larger than a single ' +
      'Overpass request, so it will be downloaded automatically in ' + tiles +
      ' tiles (\u2264 ' + TILE_AREA_KM2 + ' km\u00b2 each) and merged into one dataset.';
    estimateEl.classList.add('warn');
  } else {
    estimateEl.textContent =
      'Selected area: ' + km2.toFixed(2) + ' km\u00b2. All OSM features in this area ' +
      'will be downloaded as vector data and rendered with code-based OSM cartography.';
    estimateEl.classList.toggle('warn', km2 > WARN_AREA_KM2);
  }
  downloadBtn.disabled = false;
}

/* ----------------------------------------------------- Helpers */
function setStatus(msg) {
  statusEl.textContent = msg;
}

function setProgress(step, total, label) {
  progressWrap.hidden = false;
  const pct = total === 0 ? 0 : Math.round((step / total) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = label;
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.text();
}

/* ----------------------------------------------------- Overpass download
 * Same method as the OSMDownloader QGIS plugin
 * (https://github.com/lcoandrade/OSMDownloader): a single bounding-box
 * GET request to the Overpass API "map" endpoint, which returns the full
 * raw .osm XML file for the area (bbox order: W,S,E,N).
 */
function bboxParam(bounds) {
  return [
    bounds.getWest().toFixed(6),
    bounds.getSouth().toFixed(6),
    bounds.getEast().toFixed(6),
    bounds.getNorth().toFixed(6)
  ].join(',');
}

/** Stable key for comparing whether two selections cover the same area. */
function boundsKey(bounds) {
  return bboxParam(bounds);
}

function hasCachedDataFor(bounds) {
  return !!(lastGeojson && cachedOsmXml && cachedBoundsKey === boundsKey(bounds));
}

// Index of the mirror currently in use. Rotated on rate-limit errors so
// load is spread across the public Overpass servers.
let mirrorIndex = 0;

/** An error that carries the HTTP status so callers can react to 429/504. */
function httpError(status, url) {
  const e = new Error('Overpass API returned HTTP ' + status);
  e.status = status;
  e.url = url;
  return e;
}

/** Single-bbox request against the current mirror (no retry logic here). */
async function fetchOsmData(bounds) {
  const url = OVERPASS_MIRRORS[mirrorIndex % OVERPASS_MIRRORS.length] +
    '?bbox=' + bboxParam(bounds);
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    // Network/CORS failure: treat like a transient error so it gets retried.
    throw httpError(0, url);
  }
  if (!res.ok) {
    const err = httpError(res.status, url);
    // Surface the server's Retry-After hint (seconds) if it sent one.
    const ra = res.headers && res.headers.get && res.headers.get('Retry-After');
    if (ra) {
      const secs = parseInt(ra, 10);
      if (!isNaN(secs)) err.retryAfterMs = secs * 1000;
    }
    throw err;
  }
  return res.text(); // raw OSM XML, exactly the file OSMDownloader saves to disk
}

/** True for errors that are worth retrying (rate limit / busy / network). */
function isTransient(err) {
  const s = err && err.status;
  return s === 0 || s === 429 || s === 502 || s === 503 || s === 504;
}

/* Fetch one tile with automatic exponential backoff. On a rate-limit
 * (429) or busy (5xx) response it waits and retries up to
 * TILE_MAX_RETRIES times, rotating to the next mirror and honouring any
 * Retry-After header. Throws only after all automatic attempts fail. */
async function fetchOsmDataWithRetry(bounds, onWait) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fetchOsmData(bounds);
    } catch (err) {
      attempt++;
      if (!isTransient(err) || attempt > TILE_MAX_RETRIES) throw err;
      // Rotate mirror so the next try hits a different server.
      mirrorIndex++;
      let wait = err.retryAfterMs != null
        ? err.retryAfterMs
        : Math.min(RETRY_BASE_MS * Math.pow(2, attempt - 1), RETRY_MAX_MS);
      if (typeof onWait === 'function') onWait(attempt, Math.round(wait / 1000), err);
      await sleep(wait);
    }
  }
}

/* ----------------------------------------------------- Tiling
 * To remove the single-request size limit, a large selection is split
 * into a grid of sub-rectangles ("tiles"), each no larger than
 * TILE_AREA_KM2. Every tile is a normal single-bbox Overpass request
 * (the same OSMDownloader method); the results are merged afterwards.
 */

/** Number of tiles a selection would be split into (1 = no split). */
function tileCountFor(bounds) {
  return tileGrid(bounds).length;
}

/** Build an array of L.latLngBounds tiles that cover the selection. */
function tileGrid(bounds) {
  const km2 = areaKm2(bounds);
  if (km2 <= TILE_AREA_KM2) return [bounds];

  // Split each axis so every cell is <= TILE_AREA_KM2. Keep cells roughly
  // square by dividing the dimension that the area exceeds the budget by,
  // shared between the two axes.
  const factor = Math.sqrt(km2 / TILE_AREA_KM2);
  let cols = Math.max(1, Math.ceil(factor));
  let rows = Math.max(1, Math.ceil(km2 / TILE_AREA_KM2 / cols));

  // Guard against an unreasonable number of requests.
  while (cols * rows > MAX_TILES) {
    if (cols >= rows) cols--; else rows--;
  }

  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const dLat = (north - south) / rows;
  const dLon = (east - west) / cols;

  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const s = south + r * dLat;
      const w = west + c * dLon;
      tiles.push(L.latLngBounds([s, w], [s + dLat, w + dLon]));
    }
  }
  return tiles;
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/** Stable key used to deduplicate features that appear in adjacent tiles. */
function featureKey(f) {
  if (f && f.id != null) return String(f.id);
  if (f && f.properties && f.properties.id != null) return String(f.properties.id);
  // Fallback: hash of geometry + a couple of identifying tags.
  try {
    return JSON.stringify(f.geometry) + '|' + JSON.stringify(f.properties || {});
  } catch (e) {
    return Math.random().toString(36);
  }
}

/* Download the selection as one or more tiles, convert each to GeoJSON
 * and merge into a single FeatureCollection (deduplicating by feature
 * key). Returns the merged GeoJSON plus the concatenated raw .osm XML so
 * the bundle still ships a map.osm file.
 *
 * Each tile is fetched with automatic exponential-backoff retry. If a
 * tile still fails after all automatic attempts, onTileFailure(...) is
 * called; it should resolve to 'retry' (try the same tile again) or
 * 'abort'. Because progress is kept per tile, a retry resumes from the
 * failed tile instead of restarting the whole download. */
async function fetchOsmDataTiled(bounds, callbacks) {
  callbacks = callbacks || {};
  const onTile = callbacks.onTile;
  const onWait = callbacks.onWait;
  const onTileFailure = callbacks.onTileFailure;

  const tiles = tileGrid(bounds);
  const merged = { type: 'FeatureCollection', features: [] };
  const seen = Object.create(null);
  const osmParts = [];

  for (let i = 0; i < tiles.length; i++) {
    if (typeof onTile === 'function') onTile(i, tiles.length);

    let xml = null;
    // Keep trying this tile until it succeeds or the user chooses to abort.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        xml = await fetchOsmDataWithRetry(tiles[i], function (attempt, secs, err) {
          if (typeof onWait === 'function') onWait(i, tiles.length, attempt, secs, err);
        });
        break;
      } catch (err) {
        let choice = 'abort';
        if (typeof onTileFailure === 'function') {
          choice = await onTileFailure(i, tiles.length, err);
        }
        if (choice === 'retry') {
          // Longer cool-down before resuming, then loop to retry this tile.
          await sleep(RETRY_MAX_MS);
          continue;
        }
        const abortErr = new Error(
          'Stopped at tile ' + (i + 1) + '/' + tiles.length + ': ' + err.message);
        abortErr.aborted = true;
        throw abortErr;
      }
    }

    osmParts.push(xml);
    const dom = new DOMParser().parseFromString(xml, 'text/xml');
    const gj = osmtogeojson(dom);
    const feats = (gj && gj.features) || [];
    for (let j = 0; j < feats.length; j++) {
      const key = featureKey(feats[j]);
      if (seen[key]) continue;
      seen[key] = true;
      merged.features.push(feats[j]);
    }
    if (i < tiles.length - 1) await sleep(TILE_DELAY_MS);
  }

  return { geojson: merged, osmXml: osmParts.join('\n'), tileCount: tiles.length };
}

/* ----------------------------------------------------- Offline viewer */
function buildViewerHtml() {
  var BULLET = String.fromCharCode(8226);  // •
  var NDASH = String.fromCharCode(8211);   // –
  var featNote = '0' + NDASH + '19';       // "0\u201319"

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>Offline OSM Map (code-rendered cartography)</title>',
    '  <link rel="stylesheet" href="libs/leaflet.css" />',
    '  <style>',
    '    html, body { margin: 0; height: 100%; font-family: system-ui, sans-serif; }',
    '    #map { height: 100%; background: #f2efe9; }',
    '    #info { position: absolute; bottom: 10px; left: 10px; z-index: 1000;',
    '            background: rgba(255,255,255,0.9); padding: 6px 10px;',
    '            border-radius: 6px; font-size: 12px; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="map"></div>',
    '  <div id="info"></div>',
    '  <script src="libs/leaflet.js"><' + '/script>',
    '  <script src="libs/osm-carto-style.js"><' + '/script>',
    '  <script src="data/map-data.js"><' + '/script>',
    '  <script>',
    '    var bounds = L.latLngBounds(OSM_BOUNDS);',
    '    var map = L.map("map", {',
    '      maxBounds: bounds.pad(0.5),',
    '      maxBoundsViscosity: 0.8,',
    '      minZoom: 0,',
    '      maxZoom: 19',
    '    });',
    '    var initialTheme = (typeof OSM_THEME !== "undefined" ? OSM_THEME : null);',
    '    var ctrl = OsmCartoStyle.render(map, OSM_GEOJSON, OSM_STYLE_OVERRIDES, initialTheme);',
    '    map.fitBounds(bounds);',
    '    L.rectangle(bounds, { color: "#2f6fed", weight: 1, fill: false, dashArray: "4 4" }).addTo(map);',
    '    map.attributionControl.addAttribution(',
    '      "Map data &copy; OpenStreetMap contributors ' + BULLET + ' cartography rendered offline from code");',
    '    document.getElementById("info").textContent =',
    '      "Offline OSM map ' + BULLET + ' " + (OSM_GEOJSON.features ? OSM_GEOJSON.features.length : 0) +',
    '      " features rendered from code ' + BULLET + ' all zoom levels ' + featNote + ' ' + BULLET + ' raw data: data/map.geojson";',
    '  <' + '/script>',
    '</body>',
    '</html>'
  ].join('\n');
}

function buildBundleReadme(bounds, featureCount) {
  return [
    'OFFLINE OPENSTREETMAP BUNDLE (CODE-RENDERED CARTOGRAPHY)',
    '=========================================================',
    '',
    'Contents:',
    '  viewer.html              - open this in any browser; fully offline',
    '  libs/leaflet.js / .css   - bundled map library (no internet needed)',
    '  libs/osm-carto-style.js  - the OSM cartography implemented as code',
    '  data/map.osm             - raw OSM XML (same file the OSMDownloader',
    '                             QGIS plugin saves; open it in QGIS if needed)',
    '  data/map-data.js         - the downloaded OSM features (GeoJSON, as JS)',
    '  data/map.geojson         - the same data as a plain GeoJSON file',
    '',
    'This bundle contains NO raster tiles. Every map feature (' + featureCount + ' total) is',
    'drawn from the raw OpenStreetMap vector data using a code implementation',
    'of the OSM Carto style: landuse fills, water, buildings, roads with',
    'casings, railways, boundaries, place and POI labels.',
    '',
    'Because the data is vector, this ONE download covers EVERY zoom level:',
    'the viewer re-renders the cartography at each zoom from 0 to 19 with',
    'zoom-specific rules (visibility, widths, labels), like a live OSM map.',
    '',
    'Area (south, west, north, east):',
    '  ' + bounds.getSouth().toFixed(6) + ', ' + bounds.getWest().toFixed(6) + ', ' +
      bounds.getNorth().toFixed(6) + ', ' + bounds.getEast().toFixed(6),
    '',
    'How to use: extract this zip anywhere on your hard drive, then open',
    'viewer.html. No internet connection is required.',
    '',
    'Map data (c) OpenStreetMap contributors, ODbL.',
    'https://www.openstreetmap.org/copyright'
  ].join('\n');
}

/* ----------------------------------------------------- Download flow */
let downloading = false;

function getDownloadMode() {
  var el = document.querySelector('input[name="downloadMode"]:checked');
  return el ? el.value : 'both';
}

function wantsOfflineBundle(mode) {
  return mode === 'offline' || mode === 'both';
}

function wantsGisExport(mode) {
  return mode === 'gis' || mode === 'both';
}

function buildGisReadme(featureCount) {
  return [
    'OSM GIS Export',
    '==============',
    '',
    featureCount + ' OSM features with full attribute tables in GeoJSON.',
    'Open the gis/ folder in QGIS, ArcGIS, or other GIS software.',
    '',
    'GeoJSON keeps every OSM tag with original names (UTF-8, e.g. name:fa).',
    'Raw OSM XML is in gis/data/map.osm.',
    '',
    'Map data (c) OpenStreetMap contributors, ODbL.',
    'https://www.openstreetmap.org/copyright'
  ].join('\n');
}

downloadBtn.addEventListener('click', async () => {
  if (downloading || !selectionBounds) return;

  const mode = getDownloadMode();
  const includeOffline = wantsOfflineBundle(mode);
  const includeGis = wantsGisExport(mode);
  const reuseData = hasCachedDataFor(selectionBounds);

  if (!reuseData) {
    const km2 = areaKm2(selectionBounds);
    const tileCount = tileCountFor(selectionBounds);
    if (km2 > BIG_AREA_KM2 || tileCount > 1) {
      const ok = window.confirm(
        'This will download all OSM data for ' + km2.toFixed(1) + ' km\u00b2 from the ' +
        'volunteer-run Overpass API' +
        (tileCount > 1
          ? ', split automatically into ' + tileCount + ' tiles fetched one after another'
          : '') +
        '. Large areas can take a while and produce big files.\n\nContinue?'
      );
      if (!ok) return;
    } else if (km2 > WARN_AREA_KM2) {
      const ok = window.confirm(
        'This will download all OSM data for ' + km2.toFixed(1) + ' km\u00b2 from the ' +
        'volunteer-run Overpass API. Large areas can take a while and produce big files.\n\nContinue?'
      );
      if (!ok) return;
    }
  }

  downloading = true;
  downloadBtn.disabled = true;
  selectBtn.disabled = true;
  clearBtn.disabled = true;
  setStatus('');

  let totalSteps = 2;
  if (includeOffline) totalSteps += 2;
  if (includeGis) totalSteps += 1;
  totalSteps += 1;
  let step = 0;

  function advance(label) {
    step++;
    setProgress(step, totalSteps, label);
  }

  try {
    const zip = new JSZip();
    let geojson;
    let osmXmlText;

    if (reuseData) {
      advance('Step ' + step + '/' + totalSteps + ': reusing cached OSM data');
      geojson = lastGeojson;
      osmXmlText = cachedOsmXml;
    } else {
      advance('Step ' + step + '/' + totalSteps + ': downloading raw OSM data (Overpass API)\u2026');
      const tiled = await fetchOsmDataTiled(selectionBounds, {
        onTile: function (i, total) {
          const label = total > 1
            ? 'Step ' + step + '/' + totalSteps + ': downloading tile ' + (i + 1) + '/' + total
            : 'Step ' + step + '/' + totalSteps + ': downloading raw OSM data (Overpass API)\u2026';
          progressWrap.hidden = false;
          progressFill.style.width = Math.round((i / total) * 100) + '%';
          progressText.textContent = label;
        },
        onWait: function (i, total, attempt, secs, err) {
          const reason = err && err.status === 429 ? 'rate limited (HTTP 429)'
            : err && err.status ? ('server busy (HTTP ' + err.status + ')')
            : 'network error';
          progressText.textContent =
            'Tile ' + (i + 1) + (total > 1 ? '/' + total : '') + ': ' + reason +
            ' \u2014 waiting ' + secs + 's then retrying (attempt ' + attempt +
            '/' + TILE_MAX_RETRIES + ', switching mirror)\u2026';
        },
        onTileFailure: function (i, total, err) {
          const keepGoing = window.confirm(
            'Overpass kept failing on tile ' + (i + 1) + ' of ' + total + ' (' +
            err.message + ').\n\n' +
            'Click OK to keep retrying automatically (recommended \u2014 the ' +
            'server is usually just busy), or Cancel to stop here and change ' +
            'your selection.'
          );
          return keepGoing ? 'retry' : 'abort';
        }
      });
      osmXmlText = tiled.osmXml;
      geojson = tiled.geojson;
      lastGeojson = geojson;
      cachedOsmXml = osmXmlText;
      cachedBoundsKey = boundsKey(selectionBounds);
    }

    const featureCount = geojson.features ? geojson.features.length : 0;
    if (featureCount === 0) {
      throw new Error('No OSM features found in the selected area.');
    }

    advance('Step ' + step + '/' + totalSteps + ': updating map preview (' + featureCount + ' features)');
    renderOsmLive(geojson, { styleUpdateOnly: reuseData && osmRenderActive });

    const gisState = GisToolkit.getExportState();
    const b = selectionBounds;
    const boundsArr = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
    const geojsonStr = JSON.stringify(geojson);

    if (includeOffline) {
      advance('Step ' + step + '/' + totalSteps + ': bundling offline map libraries');
      const [leafletJs, leafletCss] = await Promise.all([
        fetchText(LEAFLET_JS_URL),
        fetchText(LEAFLET_CSS_URL)
      ]);
      const styleJs =
        '/* Cartography style profiles + vector renderer (offline bundle) */\n' +
        CartographyStylesFactory.toString() +
        '\n\nvar CartographyStylesBuilder = CartographyStylesFactory();\n\n' +
        OsmCartoStyleFactory.toString() +
        '\n\nvar OsmCartoStyle = OsmCartoStyleFactory();\n';
      zip.file('libs/leaflet.js', leafletJs);
      zip.file('libs/leaflet.css', leafletCss);
      zip.file('libs/osm-carto-style.js', styleJs);

      advance('Step ' + step + '/' + totalSteps + ': writing offline viewer');
      zip.file('data/map.osm', osmXmlText);
      zip.file('data/map.geojson', geojsonStr);
      zip.file(
        'data/map-data.js',
        'var OSM_BOUNDS = ' + JSON.stringify(boundsArr) + ';\n' +
        'var OSM_GEOJSON = ' + geojsonStr + ';\n' +
        'var OSM_STYLE_OVERRIDES = ' + JSON.stringify(gisState.overrides) + ';\n' +
        'var OSM_THEME = ' + JSON.stringify(gisState.theme || 'standard') + ';\n'
      );
      zip.file('viewer.html', buildViewerHtml());
      zip.file('README.txt', buildBundleReadme(b, featureCount));
    }

    if (includeGis) {
      advance('Step ' + step + '/' + totalSteps + ': writing GIS exports (GeoJSON + OSM)');
      await GisExport.addToZip(zip, geojson, gisState, { osmXml: osmXmlText });
      if (!includeOffline) {
        zip.file('README.txt', buildGisReadme(featureCount));
      }
    }

    advance('Step ' + step + '/' + totalSteps + ': packaging zip');
    const blob = await zip.generateAsync({ type: 'blob' }, (meta) => {
      progressFill.style.width = Math.round(meta.percent) + '%';
      progressText.textContent = 'Packaging zip (' + Math.round(meta.percent) + '%)\u2026';
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (includeGis && !includeOffline) ? 'osm-gis-export.zip' : 'osm-offline-map.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);

    setProgress(totalSteps, totalSteps, 'Done');
    if (includeOffline && includeGis) {
      setStatus(
        (reuseData ? 'Done. Bundle and GIS files updated (' : 'Done. ') + featureCount +
        ' OSM features.\nOpen viewer.html for the offline map, or use the gis/ folder in QGIS/ArcGIS.'
      );
    } else if (includeOffline) {
      setStatus(
        reuseData
          ? 'Done. Offline map updated (' + featureCount + ' features, cached data reused).\n' +
            'Extract the zip and open viewer.html.'
          : 'Done. ' + featureCount + ' OSM features downloaded.\n' +
            'Extract the zip and open viewer.html. Change the style and download again to repackage without re-fetching.'
      );
    } else {
      setStatus('Done. GIS export saved (' + featureCount + ' features, full OSM attribute tables).\n' +
        'Extract the gis/ folder into your GIS software.');
    }
  } catch (err) {
    if (err && err.aborted) {
      setStatus('Download stopped: ' + err.message + '\n' +
        'You can try again later (the Overpass API is often just temporarily ' +
        'busy) or select a smaller area to reduce the number of requests.');
    } else {
      setStatus('Download failed: ' + err.message +
        '\nIf the Overpass API is busy or the area is too dense, try again or select a smaller area.');
    }
  } finally {
    downloading = false;
    selectBtn.disabled = false;
    clearBtn.disabled = !selectionBounds;
    updateEstimate();
  }
});

updateEstimate();
