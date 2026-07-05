/*
 * CartographyStyles — vector map style profiles (per-element drawing rules).
 *
 * Standard   = neutral, minimal grey map (white/grey roads, simplified land).
 * Carto      = full OSM Carto palette (colored road hierarchy, urban land use).
 * Wikimedia  = classic Wikimedia tile style (cream land, soft blues, pastel greens).
 * Contrast   = bold black outlines, heavy road casings, high legibility labels & POI badges.
 * Warm Carto = soft cream palette, low-contrast buildings, warm road hierarchy.
 */
function CartographyStylesFactory() {
  'use strict';

  return function buildCartographyProfiles(H) {
    var props = H.props;
    var INV = H.INVISIBLE;
    var ws = H.widthScale;
    var pf = H.polygonFill;
    var roadBase = H.roadBase;
    var railOk = H.isVisibleRail;

    function cfg(p) { return roadBase(p); }

    function dualLanguageLabel(p) {
      var primary = p.name || '';
      if (!primary) return '';
      var secondary = null;
      if (p['name:en'] && p['name:en'] !== primary) secondary = p['name:en'];
      else if (p['name:fa'] && p['name:fa'] !== primary) secondary = p['name:fa'];
      else if (p.alt_name && p.alt_name !== primary) secondary = p.alt_name;
      if (secondary) return { lines: [primary, secondary] };
      return primary;
    }

    /* ========================================================= Standard (minimal grey) */
    var STD_LAND = {
      forest: '#d8e8cc', wood: '#d8e8cc', scrub: '#dde8d0', heath: '#dde8d0',
      park: '#d0e8c0', grass: '#d0e8c0', meadow: '#d0e8c0', grassland: '#d0e8c0',
      village_green: '#d0e8c0', greenfield: '#d0e8c0', garden: '#d0e8c0',
      recreation_ground: '#d0e8c0', playground: '#d0e8c0',
      cemetery: '#d0ddd0', grave_yard: '#d0ddd0',
      farmland: '#eef0e0', orchard: '#e4ecd8', vineyard: '#e4ecd8',
      wetland: '#dceee8', marsh: '#dceee8',
      sand: '#f0ece0', beach: '#f0ece0',
      residential: '#ececec', commercial: '#ececec', retail: '#ececec',
      industrial: '#ececec', railway: '#ececec',
      hospital: '#ececec', clinic: '#ececec', school: '#ececec',
      construction: '#e4e4e4', brownfield: '#e4e4e4'
    };

    function stdLandColor(p) {
      var keys = ['natural', 'landuse', 'leisure', 'amenity'];
      for (var i = 0; i < keys.length; i++) {
        var v = p[keys[i]];
        if (v && STD_LAND[v]) return STD_LAND[v];
      }
      return null;
    }

    /* White/grey road network — no orange, yellow or pink hierarchy. */
    var STD_ROADS = {
      motorway:       { fill: '#ffffff', casing: '#b0b0b0' },
      motorway_link:  { fill: '#ffffff', casing: '#b8b8b8' },
      trunk:          { fill: '#ffffff', casing: '#bbbbbb' },
      trunk_link:     { fill: '#ffffff', casing: '#c0c0c0' },
      primary:        { fill: '#ffffff', casing: '#c4c4c4' },
      primary_link:   { fill: '#ffffff', casing: '#c8c8c8' },
      secondary:      { fill: '#ffffff', casing: '#cccccc' },
      secondary_link: { fill: '#ffffff', casing: '#d0d0d0' },
      tertiary:       { fill: '#ffffff', casing: '#d4d4d4' },
      tertiary_link:  { fill: '#ffffff', casing: '#d4d4d4' },
      unclassified:   { fill: '#ffffff', casing: '#d8d8d8' },
      residential:    { fill: '#ffffff', casing: '#d8d8d8' },
      living_street:  { fill: '#f8f8f8', casing: '#d8d8d8' },
      service:        { fill: '#ffffff', casing: '#dddddd' },
      road:           { fill: '#ffffff', casing: '#d8d8d8' },
      pedestrian:     { fill: '#f0f0f0', casing: '#cccccc' },
      footway:        { fill: '#aaaaaa', casing: null, dash: '2 3' },
      cycleway:       { fill: '#aaaaaa', casing: null, dash: '2 3' },
      path:           { fill: '#aaaaaa', casing: null, dash: '2 3' },
      steps:          { fill: '#aaaaaa', casing: null, dash: '1 2' },
      bridleway:      { fill: '#aaaaaa', casing: null, dash: '3 3' },
      track:          { fill: '#999999', casing: null, dash: '4 3' }
    };

    function stdRoadSpec(highway) {
      return STD_ROADS[highway] || { fill: '#ffffff', casing: '#d8d8d8' };
    }

    var standard = {
      label: 'Standard',
      background: '#f5f5f5',
      landuseStyle: function (f) {
        return { fillColor: stdLandColor(props(f)) || '#f0f0f0', fillOpacity: 1, stroke: false };
      },
      waterPolyStyle: function () {
        return { fillColor: '#c6d8e8', fillOpacity: 1, stroke: false };
      },
      buildingStyle: function (f, zoom) {
        if (zoom < 14) return INV;
        return { fillColor: '#e0e0e0', fillOpacity: 0.9, color: '#cccccc', weight: 0.4, opacity: 0.8 };
      },
      waterwayStyle: function (f, zoom) {
        var p = props(f);
        var base = p.waterway === 'river' ? 2.0 : p.waterway === 'canal' ? 1.6 : 1.0;
        if ((p.waterway === 'stream' || p.waterway === 'ditch' || p.waterway === 'drain') && zoom < 14) {
          return INV;
        }
        return { color: '#c6d8e8', weight: Math.max(0.8, base * ws(zoom)), opacity: 1, lineCap: 'round' };
      },
      roadCasingStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        var spec = stdRoadSpec(p.highway);
        if (!spec.casing || spec.dash || zoom < c.minZoom) return INV;
        return {
          color: spec.casing,
          weight: Math.max(1, c.w * ws(zoom)) + 1.5,
          opacity: 1,
          lineCap: 'round'
        };
      },
      roadFillStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        if (zoom < c.minZoom) return INV;
        var spec = stdRoadSpec(p.highway);
        var st = {
          color: spec.fill,
          weight: Math.max(1, c.w * ws(zoom)),
          opacity: 1,
          lineCap: spec.dash ? 'butt' : 'round'
        };
        if (spec.dash) st.dashArray = spec.dash;
        return st;
      },
      railStyle: function (f, zoom) {
        var p = props(f);
        if (!railOk(p) || zoom < 11) return INV;
        return { color: '#999999', weight: Math.max(0.8, 1.2 * ws(zoom)), opacity: 0.85 };
      },
      railDashStyle: function () {
        return INV;
      },
      boundaryStyle: function () {
        return { color: '#bbbbbb', weight: 1, dashArray: '4 4', opacity: 0.6, fill: false };
      },
      labels: {
        showRoad: true, showWater: true, showPoi: true, showPoiIcons: false,
        labelCssExtra: function () {
          return 'color:#444;font-family:system-ui,sans-serif;' +
            'text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;';
        }
      }
    };

    /* ========================================================= Carto Classic
     * Full OSM Carto design palette (land, urban, roads, labels, rail). */
    var LABEL_FONT = '"Noto Sans","DejaVu Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    var LABEL_HALO = 'text-shadow:-1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px -1.5px 0 #fff,1.5px 1.5px 0 #fff,' +
      '-1px 0 0 #fff,1px 0 0 #fff,0 -1px 0 #fff,0 1px 0 #fff';

    function cartoLabelExtra(kind) {
      if (kind === 'water') {
        return 'color:#1c547a;font-style:italic;font-family:' + LABEL_FONT + ';' + LABEL_HALO + ';';
      }
      return 'color:#2b2b2b;font-family:' + LABEL_FONT + ';' + LABEL_HALO + ';';
    }

    var CARTO_LAND = {
      forest: '#add19e', wood: '#add19e',
      park: '#cdecbe', grass: '#cdecbe', meadow: '#cdecbe', grassland: '#cdecbe',
      village_green: '#cdecbe', greenfield: '#cdecbe', garden: '#cdecbe',
      recreation_ground: '#cdecbe', playground: '#cdecbe',
      cemetery: '#aacbaf', grave_yard: '#aacbaf',
      residential: '#e0dfdf',
      commercial: '#f2dad9', retail: '#ffd6d6',
      industrial: '#dfd1d6',
      hospital: '#f0e3e3', clinic: '#f0e3e3'
    };

    function cartoLandColor(p) {
      var keys = ['natural', 'landuse', 'leisure', 'amenity'];
      for (var i = 0; i < keys.length; i++) {
        var v = p[keys[i]];
        if (v && CARTO_LAND[v]) return CARTO_LAND[v];
      }
      return pf(p);
    }

    var CARTO_ROADS = {
      motorway:       { fill: '#e892a2', casing: '#dc2a67' },
      motorway_link:  { fill: '#e892a2', casing: '#dc2a67' },
      trunk:          { fill: '#f9b29c', casing: '#c84e2f' },
      trunk_link:     { fill: '#f9b29c', casing: '#c84e2f' },
      primary:        { fill: '#fcd6a4', casing: '#a06b00' },
      primary_link:   { fill: '#fcd6a4', casing: '#a06b00' },
      secondary:      { fill: '#f7fabf', casing: '#707d05' },
      secondary_link: { fill: '#f7fabf', casing: '#707d05' },
      tertiary:       { fill: '#ffffff', casing: '#b5b5b5' },
      tertiary_link:  { fill: '#ffffff', casing: '#b5b5b5' },
      unclassified:   { fill: '#ffffff', casing: '#cfcfcf' },
      residential:    { fill: '#ffffff', casing: '#cfcfcf' },
      living_street:  { fill: '#ffffff', casing: '#cfcfcf' },
      service:        { fill: '#ffffff', casing: '#cfcfcf' },
      road:           { fill: '#ffffff', casing: '#cfcfcf' },
      pedestrian:     { fill: '#e2e0d3', casing: '#b0af9f' },
      footway:        { fill: '#9e9e9e', casing: null, dash: '3 2' },
      cycleway:       { fill: '#9e9e9e', casing: null, dash: '2 3' },
      path:           { fill: '#9e9e9e', casing: null, dash: '2 3' },
      steps:          { fill: '#9e9e9e', casing: null, dash: '1 1' },
      bridleway:      { fill: '#9e9e9e', casing: null, dash: '4 2' },
      track:          { fill: '#9e9e9e', casing: null, dash: '5 3' }
    };

    function cartoRoadSpec(highway) {
      return CARTO_ROADS[highway] || { fill: '#ffffff', casing: '#cfcfcf' };
    }

    function isMetroRail(p) {
      return p.railway === 'subway' || p.railway === 'light_rail' || p.railway === 'tram';
    }

    var carto = {
      label: 'Carto Classic',
      background: '#f2efe9',
      landuseStyle: function (f) {
        var col = cartoLandColor(props(f));
        return { fillColor: col || '#f2efe9', fillOpacity: 1, stroke: false };
      },
      waterPolyStyle: function () {
        return { fillColor: '#aad3df', fillOpacity: 1, stroke: false };
      },
      buildingStyle: function (f, zoom) {
        if (zoom < 13) return INV;
        return { fillColor: '#d9d0c9', fillOpacity: 1, color: '#c2b8ab', weight: 0.6, opacity: 1 };
      },
      waterwayStyle: function (f, zoom) {
        var p = props(f);
        var base = p.waterway === 'river' ? 2.5 : p.waterway === 'canal' ? 2.0 : 1.2;
        if ((p.waterway === 'stream' || p.waterway === 'ditch' || p.waterway === 'drain') && zoom < 13) {
          return INV;
        }
        return { color: '#aad3df', weight: Math.max(1, base * ws(zoom) * 1.3), opacity: 1, lineCap: 'round' };
      },
      roadCasingStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        var spec = cartoRoadSpec(p.highway);
        if (!spec.casing || spec.dash || zoom < c.minZoom) return INV;
        return {
          color: spec.casing,
          weight: Math.max(1, c.w * ws(zoom)) + 2,
          opacity: 1,
          lineCap: 'round'
        };
      },
      roadFillStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        if (zoom < c.minZoom) return INV;
        var spec = cartoRoadSpec(p.highway);
        var st = {
          color: spec.fill,
          weight: Math.max(1, c.w * ws(zoom)),
          opacity: 1,
          lineCap: spec.dash ? 'butt' : 'round'
        };
        if (spec.dash) st.dashArray = spec.dash;
        return st;
      },
      railStyle: function (f, zoom) {
        var p = props(f);
        if (!railOk(p) || zoom < 10) return INV;
        if (isMetroRail(p)) {
          return {
            color: '#808080',
            weight: Math.max(0.8, 1.2 * ws(zoom)),
            opacity: 1,
            dashArray: '4 4',
            lineCap: 'butt'
          };
        }
        return {
          color: '#555555',
          weight: Math.max(1.5, 2.2 * ws(zoom)),
          opacity: 1,
          dashArray: '6 6',
          lineCap: 'butt'
        };
      },
      railDashStyle: function (f, zoom) {
        var p = props(f);
        if (isMetroRail(p) || p.railway !== 'rail' || zoom < 12) return INV;
        return {
          color: '#ffffff',
          weight: Math.max(0.5, 0.85 * ws(zoom)),
          opacity: 1,
          lineCap: 'round'
        };
      },
      boundaryStyle: function () {
        return { color: '#9e7cc1', weight: 1.5, dashArray: '6 3 2 3', opacity: 0.75, fill: false };
      },
      labels: {
        showRoad: true, showWater: true, showPoi: true, showPoiIcons: false,
        labelCssExtra: cartoLabelExtra
      }
    };

    /* ========================================================= Wikimedia Classic
     * Classic Wikimedia tile palette (pale cream land, soft road hierarchy). */
    var WIKI_BG = '#f8f4f0';
    var WIKI_WATER = '#c4dbf6';
    var WIKI_LABEL_FONT = '"Open Sans","Noto Sans","Arial Unicode MS",system-ui,sans-serif';
    var WIKI_LABEL_HALO =
      'text-shadow:-2px -2px 0 rgba(255,255,255,0.85),2px -2px 0 rgba(255,255,255,0.85),' +
      '-2px 2px 0 rgba(255,255,255,0.85),2px 2px 0 rgba(255,255,255,0.85),' +
      '-1px 0 0 rgba(255,255,255,0.85),1px 0 0 rgba(255,255,255,0.85),' +
      '0 -1px 0 rgba(255,255,255,0.85),0 1px 0 rgba(255,255,255,0.85);';

    function wikiLabelExtra(kind) {
      if (kind === 'water') {
        return 'color:#4c7ca2;font-style:italic;font-family:' + WIKI_LABEL_FONT + ';' + WIKI_LABEL_HALO;
      }
      return 'color:#444444;font-family:' + WIKI_LABEL_FONT + ';' + WIKI_LABEL_HALO + ';';
    }

    var WIKI_LAND = {
      forest: '#d8e8c8', wood: '#d8e8c8', scrub: '#d8e8c8', heath: '#d8e8c8',
      park: '#d8e8c8', grass: '#d8e8c8', meadow: '#d8e8c8', grassland: '#d8e8c8',
      village_green: '#d8e8c8', greenfield: '#d8e8c8', garden: '#d8e8c8',
      cemetery: '#d2e2c4', grave_yard: '#d2e2c4',
      pitch: '#d2e2c4', sports_centre: '#d2e2c4', stadium: '#d2e2c4',
      recreation_ground: '#d2e2c4', playground: '#d2e2c4',
      track: '#d2e2c4', golf_course: '#d8e8c8',
      residential: '#efebe4',
      commercial: '#ebe7df', retail: '#ebe7df',
      industrial: '#ebe7df', railway: '#ebe7df'
    };

    function wikiLandColor(p) {
      var keys = ['natural', 'landuse', 'leisure', 'amenity'];
      for (var i = 0; i < keys.length; i++) {
        var v = p[keys[i]];
        if (v && WIKI_LAND[v]) return WIKI_LAND[v];
      }
      return null;
    }

    var WIKI_ROADS = {
      motorway:       { fill: '#fca993', casing: '#e57e65' },
      motorway_link:  { fill: '#fca993', casing: '#e57e65' },
      trunk:          { fill: '#fcd37f', casing: '#e5ad55' },
      trunk_link:     { fill: '#fcd37f', casing: '#e5ad55' },
      primary:        { fill: '#fcd37f', casing: '#e5ad55' },
      primary_link:   { fill: '#fcd37f', casing: '#e5ad55' },
      secondary:      { fill: '#fdebaf', casing: '#d1b87a' },
      secondary_link: { fill: '#fdebaf', casing: '#d1b87a' },
      tertiary:       { fill: '#ffffff', casing: '#d0cbc2' },
      tertiary_link:  { fill: '#ffffff', casing: '#d0cbc2' },
      unclassified:   { fill: '#ffffff', casing: '#e0dcd3' },
      residential:    { fill: '#ffffff', casing: '#e0dcd3' },
      living_street:  { fill: '#ffffff', casing: '#e0dcd3' },
      service:        { fill: '#ffffff', casing: '#e0dcd3' },
      road:           { fill: '#ffffff', casing: '#e0dcd3' },
      pedestrian:     { fill: '#eae6de', casing: '#d5d0c5' },
      footway:        { fill: '#a5a095', casing: null, dash: '2 3' },
      cycleway:       { fill: '#a5a095', casing: null, dash: '2 4' },
      path:           { fill: '#a5a095', casing: null, dash: '1 3' },
      steps:          { fill: '#a5a095', casing: null, dash: '1 2' },
      bridleway:      { fill: '#a5a095', casing: null, dash: '3 3' },
      track:          { fill: '#a5a095', casing: null, dash: '4 3' }
    };

    function wikiRoadSpec(highway) {
      return WIKI_ROADS[highway] || { fill: '#ffffff', casing: '#e0dcd3' };
    }

    var wikimedia = {
      label: 'Wikimedia',
      background: WIKI_BG,
      landuseStyle: function (f) {
        return { fillColor: wikiLandColor(props(f)) || WIKI_BG, fillOpacity: 1, stroke: false };
      },
      waterPolyStyle: function () {
        return { fillColor: WIKI_WATER, fillOpacity: 1, stroke: false };
      },
      buildingStyle: function (f, zoom) {
        if (zoom < 13) return INV;
        return { fillColor: '#f2eae2', fillOpacity: 1, color: '#ebd6d6', weight: 0.5, opacity: 1 };
      },
      waterwayStyle: function (f, zoom) {
        var p = props(f);
        var base = p.waterway === 'river' ? 2.5 : p.waterway === 'canal' ? 2.0 : 1.2;
        if ((p.waterway === 'stream' || p.waterway === 'ditch' || p.waterway === 'drain') && zoom < 13) {
          return INV;
        }
        return { color: WIKI_WATER, weight: Math.max(1, base * ws(zoom) * 1.3), opacity: 1, lineCap: 'round' };
      },
      roadCasingStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        var spec = wikiRoadSpec(p.highway);
        if (!spec.casing || spec.dash || zoom < c.minZoom) return INV;
        return {
          color: spec.casing,
          weight: Math.max(1, c.w * ws(zoom)) + 2,
          opacity: 1,
          lineCap: 'round'
        };
      },
      roadFillStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        if (zoom < c.minZoom) return INV;
        var spec = wikiRoadSpec(p.highway);
        var st = {
          color: spec.fill,
          weight: Math.max(1, c.w * ws(zoom)),
          opacity: 1,
          lineCap: spec.dash ? 'butt' : 'round'
        };
        if (spec.dash) st.dashArray = spec.dash;
        return st;
      },
      railStyle: function (f, zoom) {
        var p = props(f);
        if (!railOk(p) || zoom < 10) return INV;
        if (isMetroRail(p)) {
          return {
            color: '#aaaaaa',
            weight: Math.max(0.8, 1.2 * ws(zoom)),
            opacity: 1,
            dashArray: '4 4',
            lineCap: 'butt'
          };
        }
        return {
          color: '#bbbbbb',
          weight: Math.max(1, 1.8 * ws(zoom)),
          opacity: 1,
          lineCap: 'butt'
        };
      },
      railDashStyle: function (f, zoom) {
        var p = props(f);
        if (isMetroRail(p) || p.railway !== 'rail' || zoom < 12) return INV;
        return {
          color: '#ffffff',
          weight: Math.max(0.5, 0.85 * ws(zoom)),
          opacity: 1,
          dashArray: '4 6',
          lineCap: 'butt'
        };
      },
      boundaryStyle: function () {
        return { color: '#bbbbbb', weight: 1, dashArray: '4 4', opacity: 0.6, fill: false };
      },
      labels: {
        showRoad: true, showWater: true, showPoi: true, showPoiIcons: false,
        labelCssExtra: wikiLabelExtra
      }
    };

    /* ========================================================= High Contrast
     * Bold black outlines, heavy road casings, stacked dual-language labels. */
    var HC_BG = '#ffffff';
    var HC_WATER = '#a3dde8';
    var HC_FONT = '"Noto Sans","DejaVu Sans Bold","DejaVu Sans",system-ui,sans-serif';
    var HC_HALO =
      'text-shadow:-2px -2px 0 #fff,2px -2px 0 #fff,-2px 2px 0 #fff,2px 2px 0 #fff,' +
      '-2.5px 0 0 #fff,2.5px 0 0 #fff,0 -2.5px 0 #fff,0 2.5px 0 #fff,' +
      '-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff;';

    function hcLabelExtra(kind) {
      if (kind === 'water' || kind === 'transit') {
        return 'color:#004b87;font-weight:700;font-family:' + HC_FONT + ';' + HC_HALO;
      }
      return 'color:#000000;font-weight:700;font-family:' + HC_FONT + ';' + HC_HALO + ';';
    }

    function hcDualLanguage(p) {
      return dualLanguageLabel(p);
    }

    function hcIsWood(p) {
      return p.natural === 'wood' || p.natural === 'forest' || p.landuse === 'forest';
    }

    function hcIsPark(p) {
      return p.leisure === 'park' || p.leisure === 'garden' || p.leisure === 'meadow' ||
             p.natural === 'grassland' || p.landuse === 'grass';
    }

    var HC_ROADS = {
      motorway:       { fill: '#e07000', casing: '#000000', casingExtra: 3.5 },
      motorway_link:  { fill: '#e07000', casing: '#000000', casingExtra: 3 },
      trunk:          { fill: '#e07000', casing: '#000000', casingExtra: 3.5 },
      trunk_link:     { fill: '#e07000', casing: '#000000', casingExtra: 3 },
      primary:        { fill: '#eed02c', casing: '#000000', casingExtra: 3.5 },
      primary_link:   { fill: '#eed02c', casing: '#000000', casingExtra: 3 },
      secondary:      { fill: '#eed02c', casing: '#000000', casingExtra: 3.5 },
      secondary_link: { fill: '#eed02c', casing: '#000000', casingExtra: 3 },
      tertiary:       { fill: '#ffffff', casing: '#000000' },
      tertiary_link:  { fill: '#ffffff', casing: '#000000' },
      unclassified:   { fill: '#ffffff', casing: '#000000' },
      residential:    { fill: '#ffffff', casing: '#000000' },
      living_street:  { fill: '#ffffff', casing: '#000000' },
      service:        { fill: '#ffffff', casing: '#000000' },
      road:           { fill: '#ffffff', casing: '#000000' },
      pedestrian:     { fill: '#222222', casing: null, dash: '3 3' },
      footway:        { fill: '#222222', casing: null, dash: '2 3' },
      cycleway:       { fill: '#222222', casing: null, dash: '2 4' },
      path:           { fill: '#222222', casing: null, dash: '1 3' },
      steps:          { fill: '#222222', casing: null, dash: '1 2' },
      bridleway:      { fill: '#222222', casing: null, dash: '3 3' },
      track:          { fill: '#222222', casing: null, dash: '4 3' }
    };

    function hcRoadSpec(highway) {
      return HC_ROADS[highway] || { fill: '#ffffff', casing: '#000000' };
    }

    function hcCasingExtra(spec, zoom) {
      if (spec.casingExtra != null) return spec.casingExtra;
      return zoom >= 14 ? 1.5 : 1;
    }

    function hcPoiIconType(p) {
      if (p.railway === 'subway' || p.station === 'subway' || p.subway === 'yes') return 'metro-u';
      if (p.railway === 'station' || p.railway === 'halt') return 'metro';
      if (p.amenity === 'hospital' || p.amenity === 'clinic' || p.amenity === 'doctors') return 'clinic';
      if (p.amenity === 'parking' || p.amenity === 'parking_space') return 'parking';
      if (p.leisure === 'park') return 'park';
      return null;
    }

    var contrast = {
      label: 'High Contrast',
      background: HC_BG,
      landuseStyle: function (f) {
        var p = props(f);
        if (hcIsWood(p)) {
          return { fillColor: '#cedcb4', fillOpacity: 1, color: '#4a5238', weight: 0.5, opacity: 0.9 };
        }
        if (hcIsPark(p)) {
          return { fillColor: '#e2f0d9', fillOpacity: 1, stroke: false };
        }
        return { fillColor: HC_BG, fillOpacity: 1, stroke: false };
      },
      waterPolyStyle: function () {
        return { fillColor: HC_WATER, fillOpacity: 1, color: '#5090b0', weight: 1, opacity: 1 };
      },
      buildingStyle: function (f, zoom) {
        if (zoom < 13) return INV;
        return {
          fillColor: '#333333', fillOpacity: 1,
          color: '#000000', weight: zoom >= 15 ? 1.5 : 1, opacity: 1
        };
      },
      waterwayStyle: function (f, zoom) {
        var p = props(f);
        var base = p.waterway === 'river' ? 2.5 : p.waterway === 'canal' ? 2.0 : 1.2;
        if ((p.waterway === 'stream' || p.waterway === 'ditch' || p.waterway === 'drain') && zoom < 13) {
          return INV;
        }
        return { color: HC_WATER, weight: Math.max(1.2, base * ws(zoom) * 1.3), opacity: 1, lineCap: 'round' };
      },
      roadCasingStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        var spec = hcRoadSpec(p.highway);
        if (!spec.casing || spec.dash || zoom < c.minZoom) return INV;
        return {
          color: spec.casing,
          weight: Math.max(1, c.w * ws(zoom)) + hcCasingExtra(spec, zoom),
          opacity: 1,
          lineCap: 'round'
        };
      },
      roadFillStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        if (zoom < c.minZoom) return INV;
        var spec = hcRoadSpec(p.highway);
        var st = {
          color: spec.fill,
          weight: Math.max(1, c.w * ws(zoom)),
          opacity: 1,
          lineCap: spec.dash ? 'butt' : 'round'
        };
        if (spec.dash) st.dashArray = spec.dash;
        return st;
      },
      railStyle: function (f, zoom) {
        var p = props(f);
        if (!railOk(p) || zoom < 10) return INV;
        if (isMetroRail(p)) {
          return {
            color: '#222222',
            weight: Math.max(1, 1.6 * ws(zoom)),
            opacity: 1,
            dashArray: '4 4',
            lineCap: 'butt'
          };
        }
        return {
          color: '#000000',
          weight: Math.max(1.5, 2.4 * ws(zoom)),
          opacity: 1,
          lineCap: 'butt'
        };
      },
      railDashStyle: function () {
        return INV;
      },
      boundaryStyle: function () {
        return { color: '#000000', weight: 1.5, dashArray: '6 3', opacity: 0.85, fill: false };
      },
      labels: {
        showRoad: true, showWater: true, showPoi: true, showPoiIcons: true,
        iconStyle: 'contrast',
        poiIconMinZoom: 14,
        formatLabelText: hcDualLanguage,
        poiIconType: hcPoiIconType,
        labelCssExtra: hcLabelExtra
      }
    };

    /* ========================================================= Warm Carto
     * Soft cream palette, minimal buildings, warm road fills, bazaar shading. */
    var WARM_BG = '#faf6f0';
    var WARM_WATER = '#b9dae3';
    var WARM_FONT = '"Noto Sans","Open Sans",system-ui,sans-serif';
    var WARM_HALO =
      'text-shadow:-2px -2px 0 rgba(255,255,255,0.9),2px -2px 0 rgba(255,255,255,0.9),' +
      '-2px 2px 0 rgba(255,255,255,0.9),2px 2px 0 rgba(255,255,255,0.9),' +
      '-1px 0 0 rgba(255,255,255,0.9),1px 0 0 rgba(255,255,255,0.9),' +
      '0 -1px 0 rgba(255,255,255,0.9),0 1px 0 rgba(255,255,255,0.9);';

    function warmLabelExtra(kind) {
      if (kind === 'water') {
        return 'color:#2d2d2d;font-family:' + WARM_FONT + ';' + WARM_HALO;
      }
      if (kind === 'transit') {
        return 'color:#3a7cb4;font-weight:600;font-family:' + WARM_FONT + ';' + WARM_HALO;
      }
      return 'color:#2d2d2d;font-family:' + WARM_FONT + ';' + WARM_HALO + ';';
    }

    function warmIsBazaar(p) {
      if (p.amenity === 'marketplace' || p.historic === 'bazaar') return true;
      if (p.landuse === 'retail' && p.historic) return true;
      if (p.name && /بازار|bazaar/i.test(p.name) &&
          (p.landuse === 'retail' || p.historic || p.tourism)) return true;
      return false;
    }

    var WARM_LAND = {
      forest: '#daf0d8', wood: '#daf0d8', scrub: '#daf0d8', heath: '#daf0d8',
      park: '#daf0d8', grass: '#daf0d8', meadow: '#daf0d8', grassland: '#daf0d8',
      village_green: '#daf0d8', greenfield: '#daf0d8', garden: '#daf0d8',
      recreation_ground: '#daf0d8', playground: '#daf0d8',
      cemetery: '#e1edd8', grave_yard: '#e1edd8',
      orchard: '#e1edd8', vineyard: '#e1edd8', plant_nursery: '#e1edd8'
    };

    function warmLandColor(p) {
      var keys = ['natural', 'landuse', 'leisure', 'amenity'];
      for (var i = 0; i < keys.length; i++) {
        var v = p[keys[i]];
        if (v && WARM_LAND[v]) return WARM_LAND[v];
      }
      return null;
    }

    var WARM_ROADS = {
      motorway:       { fill: '#fba387', casing: '#9a8a81' },
      motorway_link:  { fill: '#fba387', casing: '#9a8a81' },
      trunk:          { fill: '#fba387', casing: '#9a8a81' },
      trunk_link:     { fill: '#fba387', casing: '#9a8a81' },
      primary:        { fill: '#fbc875', casing: '#b0a095' },
      primary_link:   { fill: '#fbc875', casing: '#b0a095' },
      secondary:      { fill: '#fffbd3', casing: '#c5b8ad' },
      secondary_link: { fill: '#fffbd3', casing: '#c5b8ad' },
      tertiary:       { fill: '#ffffff', casing: '#e2dbd5' },
      tertiary_link:  { fill: '#ffffff', casing: '#e2dbd5' },
      unclassified:   { fill: '#ffffff', casing: '#e2dbd5' },
      residential:    { fill: '#ffffff', casing: '#e2dbd5' },
      living_street:  { fill: '#ffffff', casing: '#e2dbd5' },
      service:        { fill: '#ffffff', casing: '#e2dbd5' },
      road:           { fill: '#ffffff', casing: '#e2dbd5' },
      pedestrian:     { fill: '#f5e9da', casing: '#c5b8ad' },
      footway:        { fill: '#b0a095', casing: null, dash: '2 3' },
      cycleway:       { fill: '#b0a095', casing: null, dash: '2 4' },
      path:           { fill: '#b0a095', casing: null, dash: '1 3' },
      steps:          { fill: '#b0a095', casing: null, dash: '1 2' },
      bridleway:      { fill: '#b0a095', casing: null, dash: '3 3' },
      track:          { fill: '#b0a095', casing: null, dash: '4 3' }
    };

    function warmRoadSpec(highway) {
      return WARM_ROADS[highway] || { fill: '#ffffff', casing: '#e2dbd5' };
    }

    function warmCasingExtra(highway) {
      var major = ['motorway', 'motorway_link', 'trunk', 'trunk_link',
                   'primary', 'primary_link', 'secondary', 'secondary_link'];
      if (major.indexOf(highway) >= 0) return 2;
      return 1;
    }

    function warmPoiLabelKind(p) {
      if (p.railway === 'subway' || p.station === 'subway' || p.subway === 'yes') return 'transit';
      if (p.railway === 'station' || p.railway === 'halt') return 'transit';
      return null;
    }

    var warm = {
      label: 'Warm Carto',
      background: WARM_BG,
      landuseStyle: function (f) {
        var p = props(f);
        if (warmIsBazaar(p)) {
          return {
            fillColor: '#fcedec', fillOpacity: 0.72,
            color: '#e8a3a3', weight: 1, opacity: 0.85
          };
        }
        return { fillColor: warmLandColor(p) || WARM_BG, fillOpacity: 1, stroke: false };
      },
      waterPolyStyle: function () {
        return { fillColor: WARM_WATER, fillOpacity: 1, color: '#94b2bd', weight: 1, opacity: 1 };
      },
      buildingStyle: function (f, zoom) {
        if (zoom < 14) return INV;
        return {
          fillColor: '#ece9e2', fillOpacity: 0.85,
          color: '#dfdacd', weight: 0.5, opacity: 0.6
        };
      },
      waterwayStyle: function (f, zoom) {
        var p = props(f);
        var base = p.waterway === 'river' ? 2.5 : p.waterway === 'canal' ? 2.0 : 1.2;
        if ((p.waterway === 'stream' || p.waterway === 'ditch' || p.waterway === 'drain') && zoom < 13) {
          return INV;
        }
        return { color: WARM_WATER, weight: Math.max(1, base * ws(zoom) * 1.3), opacity: 1, lineCap: 'round' };
      },
      roadCasingStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        var spec = warmRoadSpec(p.highway);
        if (!spec.casing || spec.dash || zoom < c.minZoom) return INV;
        return {
          color: spec.casing,
          weight: Math.max(1, c.w * ws(zoom)) + warmCasingExtra(p.highway),
          opacity: 1,
          lineCap: 'round'
        };
      },
      roadFillStyle: function (f, zoom) {
        var p = props(f);
        var c = cfg(p);
        if (zoom < c.minZoom) return INV;
        var spec = warmRoadSpec(p.highway);
        var st = {
          color: spec.fill,
          weight: Math.max(1, c.w * ws(zoom)),
          opacity: 1,
          lineCap: spec.dash ? 'butt' : 'round'
        };
        if (spec.dash) st.dashArray = spec.dash;
        return st;
      },
      railStyle: function (f, zoom) {
        var p = props(f);
        if (!railOk(p) || zoom < 11) return INV;
        if (isMetroRail(p)) {
          return {
            color: '#3a7cb4',
            weight: Math.max(0.8, 1.2 * ws(zoom)),
            opacity: 0.85,
            dashArray: '4 4',
            lineCap: 'butt'
          };
        }
        return {
          color: '#9a8a81',
          weight: Math.max(1, 1.6 * ws(zoom)),
          opacity: 0.8,
          dashArray: '5 5',
          lineCap: 'butt'
        };
      },
      railDashStyle: function (f, zoom) {
        var p = props(f);
        if (isMetroRail(p) || p.railway !== 'rail' || zoom < 12) return INV;
        return {
          color: '#ffffff',
          weight: Math.max(0.5, 0.75 * ws(zoom)),
          opacity: 0.9,
          lineCap: 'round'
        };
      },
      boundaryStyle: function () {
        return { color: '#c5b8ad', weight: 1, dashArray: '4 4', opacity: 0.55, fill: false };
      },
      labels: {
        showRoad: true, showWater: true, showPoi: true, showPoiIcons: false,
        poiMinZoom: 15,
        formatLabelText: dualLanguageLabel,
        poiLabelKind: warmPoiLabelKind,
        labelCssExtra: warmLabelExtra
      }
    };

    return { standard: standard, carto: carto, wikimedia: wikimedia, contrast: contrast, warm: warm };
  };
}

var CartographyStylesBuilder = CartographyStylesFactory();
