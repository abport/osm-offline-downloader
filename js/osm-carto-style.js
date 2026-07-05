/*
 * OsmCartoStyle - vector cartography engine for raw OSM GeoJSON.
 *
 * Renders features with Leaflet canvas layers and a collision-aware label
 * engine. Map appearance is driven by CartographyStyles profiles (see
 * cartography-styles.js): each profile defines its own drawing rules for
 * landuse, water, buildings, roads, rail, boundaries and labels.
 *
 * Usage:  OsmCartoStyle.render(map, geojsonFeatureCollection);
 */
function OsmCartoStyleFactory() {
  'use strict';

  var DEFAULT_STYLE = 'standard';
  var activeStyle = DEFAULT_STYLE;

  var INVISIBLE = { opacity: 0, fillOpacity: 0, weight: 0 };

  /* ------------------------------------------------ polygon fills (Atlas baseline data) */
  var POLYGON_FILLS = {
    forest: '#add19e', wood: '#add19e',
    grass: '#cdebb0', grassland: '#cdebb0', meadow: '#cdebb0',
    village_green: '#cdebb0', greenfield: '#cdebb0',
    park: '#c8facc', garden: '#cfeca8', recreation_ground: '#dffce2',
    playground: '#dffce2', dog_park: '#e5f5dd',
    residential: '#e0dfdf',
    commercial: '#eecfcc', retail: '#fed7d4',
    industrial: '#ebdbe8', railway: '#ebdbe8', garages: '#dfddce',
    farmland: '#eef0d5', greenhouse_horticulture: '#eef0d5',
    farmyard: '#f5dcba',
    orchard: '#aedfa3', vineyard: '#aedfa3', plant_nursery: '#aedfa3',
    allotments: '#c9e1bf',
    cemetery: '#aacbaf', grave_yard: '#aacbaf',
    beach: '#fff1ba', sand: '#f5e9c6', dune: '#f5e9c6', mud: '#e6dcd1',
    heath: '#d6d99f', scrub: '#c8d7ab',
    wetland: '#d3e9d3', marsh: '#d3e9d3',
    bare_rock: '#eee5dc', scree: '#eee5dc', shingle: '#eee5dc',
    glacier: '#ddecec',
    school: '#f0f0d8', college: '#f0f0d8', university: '#f0f0d8',
    kindergarten: '#f0f0d8', hospital: '#ffffe5', clinic: '#ffffe5',
    parking: '#eeeeee', bicycle_parking: '#efef9b',
    pitch: '#aae0cb', sports_centre: '#dffce2', stadium: '#dffce2',
    track: '#dffce2', golf_course: '#b5e3b5', miniature_golf: '#b5e3b5',
    swimming_pool: '#aad3df', water_park: '#aad3df',
    nature_reserve: '#abde96',
    construction: '#c7c7b4', brownfield: '#c7c7b4', landfill: '#b6b592',
    quarry: '#c5c3c3',
    military: '#f3e9e9', danger_area: '#f3e9e9',
    aerodrome: '#e9e7e2', apron: '#dadae0', runway: '#bbbbcc', taxiway: '#bbbbcc'
  };
  var POLY_KEYS = ['landuse', 'leisure', 'natural', 'amenity', 'aeroway', 'tourism', 'man_made'];

  var ROADS = {
    motorway:       { fill: '#e892a2', casing: '#dc2a67', w: 4.5, minZoom: 5 },
    motorway_link:  { fill: '#e892a2', casing: '#dc2a67', w: 2.6, minZoom: 10 },
    trunk:          { fill: '#f9b29c', casing: '#c84e2f', w: 4.2, minZoom: 6 },
    trunk_link:     { fill: '#f9b29c', casing: '#c84e2f', w: 2.4, minZoom: 10 },
    primary:        { fill: '#fcd6a4', casing: '#a06b00', w: 4.0, minZoom: 7 },
    primary_link:   { fill: '#fcd6a4', casing: '#a06b00', w: 2.2, minZoom: 11 },
    secondary:      { fill: '#f7fabf', casing: '#707d05', w: 3.6, minZoom: 9 },
    secondary_link: { fill: '#f7fabf', casing: '#707d05', w: 2.0, minZoom: 12 },
    tertiary:       { fill: '#ffffff', casing: '#8f8f8f', w: 3.0, minZoom: 11 },
    tertiary_link:  { fill: '#ffffff', casing: '#8f8f8f', w: 1.8, minZoom: 12 },
    unclassified:   { fill: '#ffffff', casing: '#bbbbbb', w: 2.6, minZoom: 12 },
    residential:    { fill: '#ffffff', casing: '#bbbbbb', w: 2.6, minZoom: 12 },
    living_street:  { fill: '#ededed', casing: '#bbbbbb', w: 2.4, minZoom: 13 },
    service:        { fill: '#ffffff', casing: '#bbbbbb', w: 1.6, minZoom: 14 },
    pedestrian:     { fill: '#dddde8', casing: '#999999', w: 2.0, minZoom: 14 },
    road:           { fill: '#ddcccc', casing: '#cccccc', w: 2.0, minZoom: 13 },
    raceway:        { fill: '#ffc0cb', casing: null,      w: 2.0, minZoom: 12 },
    track:          { fill: '#9d7b32', dash: '5 3', w: 1.4, minZoom: 13 },
    bridleway:      { fill: '#0a7d00', dash: '4 2', w: 1.2, minZoom: 15 },
    cycleway:       { fill: '#1010ff', dash: '2 3', w: 1.2, minZoom: 15 },
    footway:        { fill: '#fa8072', dash: '3 2', w: 1.2, minZoom: 15 },
    path:           { fill: '#6b4e2e', dash: '2 3', w: 1.0, minZoom: 15 },
    steps:          { fill: '#fa8072', dash: '1 1', w: 2.6, minZoom: 16 }
  };
  var DEFAULT_ROAD = { fill: '#ffffff', casing: '#bbbbbb', w: 2.0, minZoom: 14 };

  var WATER = '#aad3df';
  var BUILDING_FILL = '#d9d0c9';

  /* ------------------------------------------------ helpers */
  function props(f) { return (f && f.properties) || {}; }

  function widthScale(zoom) {
    return Math.max(0.3, Math.pow(1.5, zoom - 15));
  }

  function polygonFill(p) {
    for (var i = 0; i < POLY_KEYS.length; i++) {
      var v = p[POLY_KEYS[i]];
      if (v && POLYGON_FILLS[v]) return POLYGON_FILLS[v];
    }
    return null;
  }

  function roadBase(p) {
    var key = ROADS[p.highway] ? p.highway : null;
    var base = key ? ROADS[key] : DEFAULT_ROAD;
    return {
      fill: base.fill, casing: base.casing, w: base.w,
      minZoom: base.minZoom, dash: base.dash, _key: key
    };
  }

  function isVisibleRail(p) {
    return p.railway === 'rail' || p.railway === 'light_rail' ||
           p.railway === 'subway' || p.railway === 'tram' || p.railway === 'narrow_gauge';
  }

  /* Build cartography profiles (each with its own element style functions). */
  var CARTOGRAPHIES = CartographyStylesBuilder({
    props: props,
    INVISIBLE: INVISIBLE,
    widthScale: widthScale,
    polygonFill: polygonFill,
    roadBase: roadBase,
    isVisibleRail: isVisibleRail
  });

  function cartography() {
    return CARTOGRAPHIES[activeStyle] || CARTOGRAPHIES[DEFAULT_STYLE];
  }

  function styleIds() { return Object.keys(CARTOGRAPHIES); }
  function styleLabel(id) {
    var c = CARTOGRAPHIES[id] || CARTOGRAPHIES[DEFAULT_STYLE];
    return c.label;
  }
  function bg() { return cartography().background; }

  var BACKGROUND = CARTOGRAPHIES.standard.background;

  function classify(f) {
    var p = props(f);
    var g = f.geometry && f.geometry.type;
    var isPoly = g === 'Polygon' || g === 'MultiPolygon';
    var isLine = g === 'LineString' || g === 'MultiLineString';
    var isPoint = g === 'Point';
    if (isPoly) {
      if (p.natural === 'water' || p.waterway === 'riverbank' ||
          p.landuse === 'reservoir' || p.landuse === 'basin') return 'water';
      if (p.building && p.building !== 'no') return 'building';
      if (p.amenity === 'marketplace' || p.historic === 'bazaar' ||
          (p.landuse === 'retail' && p.historic)) return 'landuse';
      if (polygonFill(p)) return 'landuse';
      return 'other';
    }
    if (isLine) {
      if (p.highway) return 'road';
      if (p.railway) return 'rail';
      if (p.waterway) return 'waterway';
      if (p.boundary === 'administrative') return 'boundary';
      return 'other';
    }
    if (isPoint) {
      if (p.place && p.name) return 'place';
      if (p.railway === 'station' || p.railway === 'halt' || p.railway === 'subway' ||
          p.station === 'subway' || p.subway === 'yes') return 'poi';
      if (p.amenity === 'clinic' || p.amenity === 'hospital' || p.amenity === 'doctors') {
        return 'poi';
      }
      if (p.name && (p.amenity || p.shop || p.tourism || p.leisure || p.historic)) return 'poi';
      return 'other';
    }
    return 'other';
  }

  /* ------------------------------------------------ labels */
  var PLACE_MINZOOM = {
    city: 0, town: 8, village: 12, suburb: 12,
    hamlet: 13, neighbourhood: 14, quarter: 13, locality: 14
  };
  var PLACE_CLASS = { city: 'osm-place-city', town: 'osm-place-town' };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function resolveLabelContent(p, name, labelCfg) {
    if (labelCfg && labelCfg.formatLabelText) {
      var formatted = labelCfg.formatLabelText(p);
      if (formatted && typeof formatted === 'object' && formatted.lines && formatted.lines.length) {
        return { text: formatted.lines[0], stackedLines: formatted.lines };
      }
      if (typeof formatted === 'string' && formatted) return { text: formatted };
      if (typeof formatted === 'string') return { text: '' };
    }
    return { text: name || '' };
  }

  var cssInjected = false;
  function injectCss() {
    if (cssInjected) return;
    cssInjected = true;
    var st = document.createElement('style');
    st.textContent =
      '.osm-place-label{position:absolute;transform:translate(-50%,-50%);' +
      'font-family:"Noto Sans","DejaVu Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
      'color:#2b2b2b;white-space:nowrap;' +
      'text-shadow:-1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px -1.5px 0 #fff,1.5px 1.5px 0 #fff,' +
      '-1px 0 0 #fff,1px 0 0 #fff,0 -1px 0 #fff,0 1px 0 #fff;}' +
      '.osm-place-city{font-size:15px;font-weight:700;}' +
      '.osm-place-town{font-size:13px;font-weight:600;}' +
      '.osm-place-small{font-size:11px;}' +
      '.osm-poi{position:absolute;transform:translate(-50%,-50%);' +
      'font-size:10px;font-family:"Noto Sans","DejaVu Sans",system-ui,sans-serif;color:#2b2b2b;' +
      'white-space:nowrap;text-shadow:-1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px -1.5px 0 #fff,1.5px 1.5px 0 #fff;}' +
      '.osm-poi-dot{display:inline-block;width:4px;height:4px;border-radius:2px;' +
      'background:#734a08;margin-right:3px;vertical-align:middle;}' +
      '.osm-road-label{position:absolute;' +
      'font-size:10px;font-family:"Noto Sans","DejaVu Sans",system-ui,sans-serif;color:#2b2b2b;' +
      'white-space:nowrap;text-shadow:-1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px -1.5px 0 #fff,1.5px 1.5px 0 #fff;}' +
      '.osm-water-label{position:absolute;' +
      'font-size:10px;font-style:italic;font-family:"Noto Sans","DejaVu Sans",system-ui,sans-serif;color:#1c547a;' +
      'white-space:nowrap;text-shadow:-1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px -1.5px 0 #fff,1.5px 1.5px 0 #fff;}' +
      '.osm-icon-clinic{display:block;width:14px;height:14px;position:relative;background:#fff;' +
      'border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,0.12),0 1px 3px rgba(0,0,0,0.15);}' +
      '.osm-icon-clinic:before,.osm-icon-clinic:after{content:"";position:absolute;background:#E53935;' +
      'border-radius:0.5px;}' +
      '.osm-icon-clinic:before{left:6px;top:3px;width:2px;height:8px;}' +
      '.osm-icon-clinic:after{left:3px;top:6px;width:8px;height:2px;}' +
      '.osm-icon-metro{display:flex;align-items:center;justify-content:center;' +
      'width:16px;height:16px;background:#007AFF;color:#fff;border-radius:4px;' +
      'font:bold 10px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.22);}' +
      '.osm-label-stack{display:flex;flex-direction:column;align-items:center;line-height:1.15;}' +
      '.osm-label-stack-line{display:block;white-space:nowrap;}' +
      '.osm-label-text{display:inline-block;white-space:inherit;line-height:normal;' +
      'color:var(--osm-lbl-color,inherit);font-size:var(--osm-lbl-size,inherit);}' +
      '.osm-icon-metro-hc{display:flex;align-items:center;justify-content:center;' +
      'width:16px;height:16px;background:#0055a5;color:#fff;border-radius:50%;' +
      'border:1px solid #000;font:bold 9px/1 "Noto Sans","DejaVu Sans",system-ui,sans-serif;}' +
      '.osm-icon-clinic-hc{display:block;width:14px;height:14px;position:relative;background:#fff;' +
      'border:1px solid #000;border-radius:2px;}' +
      '.osm-icon-clinic-hc:before,.osm-icon-clinic-hc:after{content:"";position:absolute;background:#cc0000;' +
      'border-radius:0.5px;}' +
      '.osm-icon-clinic-hc:before{left:6px;top:3px;width:2px;height:8px;}' +
      '.osm-icon-clinic-hc:after{left:3px;top:6px;width:8px;height:2px;}' +
      '.osm-icon-parking-hc{display:flex;align-items:center;justify-content:center;' +
      'width:14px;height:14px;background:#fff;border:1px solid #000;border-radius:2px;' +
      'font:bold 9px/1 "Noto Sans","DejaVu Sans",system-ui,sans-serif;color:#004b87;}' +
      '.osm-icon-park-hc{display:block;width:14px;height:14px;background:#fff;' +
      'border:1px solid #000;border-radius:2px;position:relative;}' +
      '.osm-icon-park-hc:before{content:"";position:absolute;left:7px;top:2px;width:0;height:0;' +
      'border-left:4px solid transparent;border-right:4px solid transparent;border-bottom:6px solid #228822;}' +
      '.osm-icon-park-hc:after{content:"";position:absolute;left:4px;bottom:2px;width:6px;height:4px;' +
      'background:#228822;border-radius:1px 1px 0 0;}';
    document.head.appendChild(st);
  }

  function lineMidInfo(geom) {
    var coords = geom.type === 'LineString' ? geom.coordinates :
                 geom.type === 'MultiLineString' ? geom.coordinates[0] : null;
    if (!coords || coords.length < 2) return null;
    var i = Math.floor(coords.length / 2);
    var a = coords[Math.max(0, i - 1)];
    var b = coords[Math.min(coords.length - 1, i)];
    var midLon = (a[0] + b[0]) / 2;
    var midLat = (a[1] + b[1]) / 2;
    var latRad = (midLat * Math.PI) / 180;
    var dx = (b[0] - a[0]) * Math.cos(latRad);
    var dy = b[1] - a[1];
    var angle = (-Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return { lat: midLat, lon: midLon, angle: angle };
  }

  /* ------------------------------------------------ style overrides (user editor) */
  var STYLE_CLASSES = ['landuse', 'water', 'building', 'road', 'rail',
                       'waterway', 'boundary', 'place', 'poi',
                       'roadlabel', 'waterwaylabel'];

  var LABEL_ONLY_CLASSES = ['place', 'poi', 'roadlabel', 'waterwaylabel'];

  function isLabelOnlyClass(cls) {
    return LABEL_ONLY_CLASSES.indexOf(cls) >= 0;
  }

  function isLabelHidden(ov) {
    return !!(ov && (ov.labelHidden || ov.hidden));
  }

  function defaultStyleFor(cls) {
    /* Geometry colors/weights come from the active cartography profile.
     * Overrides only store user edits (null = use profile default). */
    switch (cls) {
      case 'landuse':  return { fillColor: null, fillOpacity: 1, color: null, weight: null, dashArray: '', hidden: false };
      case 'water':    return { fillColor: null, fillOpacity: 1, color: null, weight: null, dashArray: '', hidden: false };
      case 'building': return { fillColor: null, fillOpacity: 1, color: null, weight: null, dashArray: '', hidden: false };
      case 'road':     return { color: null, fillOpacity: 1, weight: null, opacity: 1, dashArray: '', hidden: false };
      case 'rail':     return { color: null, weight: null, opacity: 1, dashArray: '', hidden: false };
      case 'waterway': return { color: null, weight: null, opacity: 1, dashArray: '', hidden: false };
      case 'boundary': return { color: null, weight: null, opacity: null, dashArray: '', hidden: false };
      case 'place':    return { labelColor: null, labelSize: null, labelHidden: false, hidden: false };
      case 'poi':      return { labelColor: null, labelSize: null, labelHidden: false, hidden: false };
      case 'roadlabel':     return { labelColor: null, labelSize: null, labelHidden: false, hidden: false };
      case 'waterwaylabel': return { labelColor: null, labelSize: null, labelHidden: false, hidden: false };
      default:         return {};
    }
  }

  function defaultOverrides() {
    var out = {};
    STYLE_CLASSES.forEach(function (c) { out[c] = defaultStyleFor(c); });
    return out;
  }

  function applyOverride(style, ov) {
    if (!ov) return style;
    if (ov.hidden) {
      var hidden = {};
      for (var k in style) {
        if (Object.prototype.hasOwnProperty.call(style, k)) hidden[k] = style[k];
      }
      hidden.opacity = 0;
      hidden.fillOpacity = 0;
      return hidden;
    }
    var out = {};
    for (var k in style) {
      if (Object.prototype.hasOwnProperty.call(style, k)) out[k] = style[k];
    }
    if (ov.fillColor != null) out.fillColor = ov.fillColor;
    if (ov.fillOpacity != null && out.fillOpacity != null) out.fillOpacity = ov.fillOpacity;
    if (ov.color != null && (out.color != null)) out.color = ov.color;
    if (ov.weight != null && out.weight != null) out.weight = ov.weight;
    if (ov.opacity != null && out.opacity != null) out.opacity = ov.opacity;
    if (ov.dashArray != null && ov.dashArray !== '') out.dashArray = ov.dashArray;
    if (out.fillColor != null) {
      out.fill = true;
      if (style.stroke === false) out.stroke = false;
    } else if (out.color != null || (out.weight != null && out.weight > 0)) {
      out.stroke = true;
    }
    return out;
  }

  /* Style dispatch — delegates to the active cartography profile. */
  function cartoStyle(kind, f, zoom) {
    var c = cartography();
    switch (kind) {
      case 'landuse': return c.landuseStyle(f, zoom);
      case 'water': return c.waterPolyStyle(f, zoom);
      case 'building': return c.buildingStyle(f, zoom);
      case 'waterway': return c.waterwayStyle(f, zoom);
      case 'roadCasing': return c.roadCasingStyle(f, zoom);
      case 'roadFill': return c.roadFillStyle(f, zoom);
      case 'rail': return c.railStyle(f, zoom);
      case 'railDash': return c.railDashStyle(f, zoom);
      case 'boundary': return c.boundaryStyle(f, zoom);
      default: return INVISIBLE;
    }
  }

  /* ------------------------------------------------ renderer */
  function render(map, geojson, userOverrides, initialTheme) {
    if (initialTheme && CARTOGRAPHIES[initialTheme]) {
      activeStyle = initialTheme;
    }
    injectCss();
    map.getContainer().style.background = bg();
    var overrides = userOverrides || {};

    var paneDefs = [
      ['osm-landuse', 401], ['osm-waterpoly', 402], ['osm-waterway', 403],
      ['osm-building', 404], ['osm-roadcasing', 405], ['osm-roadfill', 406],
      ['osm-rail', 407], ['osm-boundary', 408]
    ];
    paneDefs.forEach(function (d) {
      var pane = map.createPane(d[0]);
      pane.style.zIndex = d[1];
    });

    var buckets = {
      landuse: [], water: [], building: [], road: [],
      rail: [], waterway: [], boundary: [], place: [], poi: []
    };
    ((geojson && geojson.features) || []).forEach(function (f) {
      var c = classify(f);
      if (buckets[c]) buckets[c].push(f);
    });

    function fc(arr) { return { type: 'FeatureCollection', features: arr }; }

    function wrap(cls, kind) {
      return function (f, zoom) {
        return applyOverride(cartoStyle(kind, f, zoom), overrides[cls]);
      };
    }

    function makeLayer(arr, pane, cls, kind) {
      var wrapped = wrap(cls, kind);
      var lyr = L.geoJSON(fc(arr), {
        pane: pane,
        renderer: L.canvas({ pane: pane }),
        interactive: false,
        style: function (f) { return wrapped(f, map.getZoom()); }
      }).addTo(map);
      return { layer: lyr, styleFn: wrapped, cls: cls };
    }

    var styled = [
      makeLayer(buckets.landuse, 'osm-landuse', 'landuse', 'landuse'),
      makeLayer(buckets.water, 'osm-waterpoly', 'water', 'water'),
      makeLayer(buckets.waterway, 'osm-waterway', 'waterway', 'waterway'),
      makeLayer(buckets.building, 'osm-building', 'building', 'building'),
      makeLayer(buckets.road, 'osm-roadcasing', 'road', 'roadCasing'),
      makeLayer(buckets.road, 'osm-roadfill', 'road', 'roadFill'),
      makeLayer(buckets.rail, 'osm-rail', 'rail', 'rail'),
      makeLayer(buckets.rail, 'osm-rail', 'rail', 'railDash'),
      makeLayer(buckets.boundary, 'osm-boundary', 'boundary', 'boundary')
    ];

    var labelCandidates = [];

    function addCandidate(lat, lon, text, cls, opts) {
      labelCandidates.push({
        lat: lat, lon: lon, text: String(text), cls: cls,
        angle: opts.angle || 0,
        minZoom: opts.minZoom,
        priority: opts.priority,
        fontSize: opts.fontSize || 10,
        dedupeKey: opts.dedupeKey || null,
        dot: !!opts.dot,
        icon: opts.icon || null,
        ovClass: opts.ovClass || null,
        labelKind: opts.labelKind || null,
        highway: opts.highway || null,
        stackedLines: opts.stackedLines || null,
        marker: null
      });
    }

    function buildLabelCandidates() {
      labelCandidates.forEach(function (c) {
        if (c.marker && map.hasLayer(c.marker)) map.removeLayer(c.marker);
        c.marker = null;
      });
      labelCandidates.length = 0;

      var labelCfg = cartography().labels || {};

      buckets.place.forEach(function (f) {
        var p = props(f);
        var lc = resolveLabelContent(p, p.name, labelCfg);
        if (!lc.text) return;
        var prio = p.place === 'city' ? 0 : p.place === 'town' ? 1 : 2;
        var cls = 'osm-place-label ' + (PLACE_CLASS[p.place] || 'osm-place-small');
        var fs = p.place === 'city' ? 15 : p.place === 'town' ? 13 : 11;
        addCandidate(f.geometry.coordinates[1], f.geometry.coordinates[0], lc.text, cls, {
          minZoom: PLACE_MINZOOM[p.place] != null ? PLACE_MINZOOM[p.place] : 14,
          priority: prio,
          fontSize: fs,
          ovClass: 'place',
          labelKind: 'place',
          stackedLines: lc.stackedLines
        });
      });

      if (labelCfg.showRoad !== false) {
        buckets.road.forEach(function (f) {
          var p = props(f);
          if (!p.name) return;
          var lc = resolveLabelContent(p, p.name, labelCfg);
          if (!lc.text) return;
          var info = lineMidInfo(f.geometry);
          if (!info) return;
          var mz = labelCfg.roadMinZoom ? labelCfg.roadMinZoom(p) : 14;
          if (mz >= 99) return;
          addCandidate(info.lat, info.lon, lc.text, 'osm-road-label', {
            minZoom: mz,
            priority: mz === 14 ? 4 : mz === 15 ? 5 : 6,
            angle: info.angle,
            dedupeKey: 'road:' + p.name,
            ovClass: 'roadlabel',
            labelKind: 'road',
            highway: p.highway,
            stackedLines: lc.stackedLines
          });
        });
      }

      if (labelCfg.showWater !== false) {
        buckets.waterway.forEach(function (f) {
          var p = props(f);
          if (!p.name) return;
          var lc = resolveLabelContent(p, p.name, labelCfg);
          if (!lc.text) return;
          var info = lineMidInfo(f.geometry);
          if (!info) return;
          addCandidate(info.lat, info.lon, lc.text, 'osm-water-label', {
            minZoom: 14,
            priority: 5,
            angle: info.angle,
            dedupeKey: 'water:' + p.name,
            ovClass: 'waterwaylabel',
            labelKind: 'water',
            stackedLines: lc.stackedLines
          });
        });
      }

      if (labelCfg.showPoi !== false || labelCfg.showPoiIcons) {
        buckets.poi.forEach(function (f) {
          var p = props(f);
          var lat = f.geometry.coordinates[1];
          var lon = f.geometry.coordinates[0];
          var iconType = labelCfg.poiIconType ? labelCfg.poiIconType(p) : null;
          if (iconType && labelCfg.showPoiIcons !== false) {
            addCandidate(lat, lon, p.name || '', 'osm-poi-icon', {
              minZoom: labelCfg.poiIconMinZoom != null ? labelCfg.poiIconMinZoom : 15,
              priority: 6,
              icon: iconType,
              ovClass: 'poi',
              labelKind: 'poi'
            });
          } else if (labelCfg.showPoi !== false) {
            if (!p.name) return;
            var plc = resolveLabelContent(p, p.name, labelCfg);
            if (!plc.text) return;
            var poiKind = 'poi';
            if (labelCfg.poiLabelKind) {
              var pk = labelCfg.poiLabelKind(p);
              if (pk) poiKind = pk;
            }
            addCandidate(lat, lon, plc.text, 'osm-poi', {
              minZoom: labelCfg.poiMinZoom != null ? labelCfg.poiMinZoom : 17,
              priority: poiKind === 'transit' ? 5 : 7,
              dot: poiKind !== 'transit',
              ovClass: 'poi',
              labelKind: poiKind,
              stackedLines: plc.stackedLines
            });
          }
        });
      }

      labelCandidates.sort(function (a, b) { return a.priority - b.priority; });
    }

    buildLabelCandidates();

    function buildLabelDecorationStyle(labelCfg, labelKind) {
      if (!labelCfg || !labelCfg.labelCssExtra) return '';
      return labelCfg.labelCssExtra(labelKind || '').split(';').filter(function (part) {
        var key = part.split(':')[0].trim().toLowerCase();
        return key && key !== 'color' && key.indexOf('font-size') !== 0 && key !== 'font';
      }).join(';').replace(/;;+/g, ';');
    }

    function buildLabelOuterStyle(ov) {
      if (!ov) return '';
      var parts = [];
      if (ov.labelColor != null && ov.labelColor !== '') {
        parts.push('--osm-lbl-color:' + ov.labelColor);
      }
      if (ov.labelSize != null && !isNaN(ov.labelSize)) {
        parts.push('--osm-lbl-size:' + ov.labelSize + 'px');
      }
      return parts.length ? ';' + parts.join(';') : '';
    }

    function makeMarker(c) {
      var inner;
      var labelCfg = cartography().labels || {};
      var iconStyle = labelCfg.iconStyle || 'default';
      if (c.icon === 'metro' || c.icon === 'metro-u') {
        if (iconStyle === 'contrast') {
          var letter = c.icon === 'metro-u' ? 'U' : 'M';
          inner = '<span class="osm-icon-metro-hc" aria-hidden="true">' + letter + '</span>';
        } else {
          inner = '<span class="osm-icon-metro" aria-hidden="true">M</span>';
        }
      } else if (c.icon === 'clinic') {
        inner = iconStyle === 'contrast'
          ? '<span class="osm-icon-clinic-hc" aria-hidden="true"></span>'
          : '<span class="osm-icon-clinic" aria-hidden="true"></span>';
      } else if (c.icon === 'parking') {
        inner = '<span class="osm-icon-parking-hc" aria-hidden="true">P</span>';
      } else if (c.icon === 'park') {
        inner = '<span class="osm-icon-park-hc" aria-hidden="true"></span>';
      } else if (c.stackedLines && c.stackedLines.length > 1) {
        inner = '<span class="osm-label-stack">' + c.stackedLines.map(function (line) {
          return '<span class="osm-label-stack-line">' + escapeHtml(line) + '</span>';
        }).join('') + '</span>';
      } else {
        inner = (c.dot ? '<span class="osm-poi-dot"></span>' : '') + escapeHtml(c.text);
      }
      var ov = c.ovClass && overrides[c.ovClass];
      var rotate = c.icon ? '' : 'rotate(' + (c.angle || 0).toFixed(1) + 'deg)';
      var outerStyle = 'transform:translate(-50%,-50%)' + (rotate ? ' ' + rotate : '');
      if (!c.icon) {
        outerStyle += buildLabelOuterStyle(ov);
        var deco = buildLabelDecorationStyle(labelCfg, c.labelKind);
        inner = '<span class="osm-label-text"' + (deco ? ' style="' + deco + '"' : '') + '>' + inner + '</span>';
      }
      return L.marker([c.lat, c.lon], {
        interactive: false,
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: '<span class="' + c.cls + '" style="' + outerStyle + '">' + inner + '</span>'
        })
      });
    }

    var DEDUPE_DIST = 250;
    var PAD = 3;

    function labelAllowed(c) {
      var cfg = cartography().labels || {};
      if (c.labelKind === 'road' && cfg.showRoad === false) return false;
      if (c.labelKind === 'water' && cfg.showWater === false) return false;
      if (c.labelKind === 'poi') {
        if (c.icon && cfg.showPoiIcons) return true;
        if (cfg.showPoi === false) return false;
      }
      return true;
    }

    function placeLabels() {
      var z = map.getZoom();
      var size = map.getSize();
      var placedBoxes = [];
      var dedupePts = {};

      labelCandidates.forEach(function (c) {
        var show = false;
        if (!labelAllowed(c)) {
          if (c.marker && map.hasLayer(c.marker)) map.removeLayer(c.marker);
          c.marker = null;
          return;
        }
        var ovv = c.ovClass && overrides[c.ovClass];
        if (isLabelHidden(ovv)) {
          if (c.marker && map.hasLayer(c.marker)) map.removeLayer(c.marker);
          c.marker = null;
          return;
        }
        var minZ = c.minZoom;
        if (c.labelKind === 'road' && c.highway) {
          var rfn = cartography().labels && cartography().labels.roadMinZoom;
          if (rfn) minZ = rfn({ highway: c.highway });
          if (minZ >= 99) {
            if (c.marker && map.hasLayer(c.marker)) map.removeLayer(c.marker);
            c.marker = null;
            return;
          }
        }
        if (z >= minZ) {
          var pt = map.latLngToContainerPoint([c.lat, c.lon]);
          if (pt.x > -80 && pt.y > -40 && pt.x < size.x + 80 && pt.y < size.y + 40) {
            var effSize = (ovv && ovv.labelSize != null && !isNaN(ovv.labelSize)) ? ovv.labelSize : c.fontSize;
            var textLen = c.stackedLines
              ? Math.max.apply(null, c.stackedLines.map(function (l) { return l.length; }))
              : c.text.length;
            var w = c.icon ? 18 : (textLen * effSize * 0.62 + (c.dot ? 8 : 0));
            var h = c.icon ? 18 : (c.stackedLines
              ? (effSize + 2) * c.stackedLines.length + 2
              : (effSize + 4));
            var rad = (c.angle * Math.PI) / 180;
            var bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
            var bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
            var box = {
              x1: pt.x - bw / 2 - PAD, y1: pt.y - bh / 2 - PAD,
              x2: pt.x + bw / 2 + PAD, y2: pt.y + bh / 2 + PAD
            };
            var collides = placedBoxes.some(function (b) {
              return box.x1 < b.x2 && box.x2 > b.x1 && box.y1 < b.y2 && box.y2 > b.y1;
            });
            var dupTooClose = false;
            if (c.dedupeKey) {
              var pts = dedupePts[c.dedupeKey];
              if (pts) {
                dupTooClose = pts.some(function (q) {
                  var dx = q.x - pt.x, dy = q.y - pt.y;
                  return dx * dx + dy * dy < DEDUPE_DIST * DEDUPE_DIST;
                });
              }
            }
            if (!collides && !dupTooClose) {
              show = true;
              placedBoxes.push(box);
              if (c.dedupeKey) {
                (dedupePts[c.dedupeKey] = dedupePts[c.dedupeKey] || []).push({ x: pt.x, y: pt.y });
              }
            }
          }
        }
        if (show) {
          if (c.marker) {
            if (map.hasLayer(c.marker)) map.removeLayer(c.marker);
            c.marker = null;
          }
          c.marker = makeMarker(c);
          c.marker.addTo(map);
        } else if (c.marker) {
          if (map.hasLayer(c.marker)) map.removeLayer(c.marker);
          c.marker = null;
        }
      });
    }

    function rebuildLabels() {
      dropMarkers();
      placeLabels();
    }

    function refresh() {
      var z = map.getZoom();
      styled.forEach(function (s) {
        var fn = function (f) { return s.styleFn(f, z); };
        s.layer.setStyle(fn);
        s.layer.eachLayer(function (lyr) {
          if (lyr.feature) lyr.setStyle(fn(lyr.feature));
          if (lyr.redraw) lyr.redraw();
        });
      });
      rebuildLabels();
    }

    map.on('zoomend', refresh);
    map.on('moveend', rebuildLabels);
    refresh();

    function dropMarkers() {
      labelCandidates.forEach(function (c) {
        if (c.marker) {
          if (map.hasLayer(c.marker)) map.removeLayer(c.marker);
          c.marker = null;
        }
      });
    }

    return {
      setOverrides: function (next) {
        if (next) overrides = next;
        refresh();
      },
      setTheme: function (id) {
        if (!CARTOGRAPHIES[id]) return;
        activeStyle = id;
        map.getContainer().style.background = bg();
        dropMarkers();
        buildLabelCandidates();
        refresh();
        if (map._renderer && map._renderer._update) map._renderer._update();
      },
      getTheme: function () { return activeStyle; },
      getOverrides: function () { return overrides; },
      refresh: refresh,
      rebuildLabels: rebuildLabels,
      destroy: function () {
        map.off('zoomend', refresh);
        map.off('moveend', rebuildLabels);
        styled.forEach(function (s) {
          if (s.layer && map.hasLayer(s.layer)) map.removeLayer(s.layer);
        });
        dropMarkers();
      }
    };
  }

  function splitLayers(geojson) {
    var out = { points: [], lines: [], multilinestrings: [], multipolygons: [] };
    ((geojson && geojson.features) || []).forEach(function (f) {
      var g = f.geometry && f.geometry.type;
      if (g === 'Point' || g === 'MultiPoint') out.points.push(f);
      else if (g === 'LineString') out.lines.push(f);
      else if (g === 'MultiLineString') out.multilinestrings.push(f);
      else if (g === 'Polygon' || g === 'MultiPolygon') out.multipolygons.push(f);
    });
    return out;
  }

  return {
    render: render,
    classify: classify,
    splitLayers: splitLayers,
    defaultOverrides: defaultOverrides,
    defaultStyleFor: defaultStyleFor,
    STYLE_CLASSES: STYLE_CLASSES,
    LABEL_ONLY_CLASSES: LABEL_ONLY_CLASSES,
    isLabelOnlyClass: isLabelOnlyClass,
    isLabelHidden: isLabelHidden,
    BACKGROUND: BACKGROUND,
    CARTOGRAPHIES: CARTOGRAPHIES,
    themeIds: styleIds,
    themeLabel: styleLabel,
    DEFAULT_THEME: DEFAULT_STYLE,
    THEMES: CARTOGRAPHIES
  };
}

var OsmCartoStyle = OsmCartoStyleFactory();
