/*
 * gis-export.js - exports OSM data as GeoJSON (UTF-8) plus raw .osm XML.
 *
 * Shapefile is not used: OSM tag sets are too varied to fit DBF cleanly
 * (10-character field names, 255 columns, sparse access:/change: tags, etc.).
 * GeoJSON preserves every tag with original names, including Persian text.
 */
'use strict';

var GisExport = (function () {

  var LABEL_ONLY = { roadlabel: 'road', waterwaylabel: 'waterway' };

  function geometryKind(f) {
    var g = f.geometry && f.geometry.type;
    if (g === 'Point' || g === 'MultiPoint') return 'Point';
    if (g === 'LineString' || g === 'MultiLineString') return 'LineString';
    if (g === 'Polygon' || g === 'MultiPolygon') return 'Polygon';
    return null;
  }

  function osmGeomType(cls) {
    if (cls === 'landuse' || cls === 'water' || cls === 'building') return 'Polygon';
    if (cls === 'road' || cls === 'rail' || cls === 'waterway' || cls === 'boundary') return 'LineString';
    return 'Point';
  }

  function featureCollection(features) {
    return {
      type: 'FeatureCollection',
      features: features.map(function (f) {
        return {
          type: 'Feature',
          id: f.id,
          geometry: f.geometry,
          properties: Object.assign({}, f.properties || {})
        };
      })
    };
  }

  function splitAllByGeometry(features) {
    var points = [];
    var lines = [];
    var polys = [];
    features.forEach(function (f) {
      var kind = geometryKind(f);
      if (kind === 'Point') points.push(f);
      else if (kind === 'LineString') lines.push(f);
      else if (kind === 'Polygon') polys.push(f);
    });
    return { points: points, lines: lines, polys: polys };
  }

  function addToZip(zip, geojson, state, options) {
    options = options || {};
    var features = (geojson && geojson.features) || [];
    var manifest = [
      'GIS EXPORT',
      '==========',
      '',
      'GeoJSON files contain the full OSM attribute tables with original tag',
      'names (e.g. name:fa). Text is UTF-8.',
      '',
      'For raw OSM XML open data/map.osm in JOSM, Merkaartor, or ogr2ogr.',
      '',
      'Files:',
      '  osm_all.geojson            all features, all tags',
      '  data/map.osm               raw OpenStreetMap XML',
      '  osm_all_points.geojson     all point features',
      '  osm_all_lines.geojson      all line features',
      '  osm_all_polygons.geojson   all polygon features',
      '  osm_<class>.geojson        features grouped by map layer class',
      '  osm_other_*.geojson        remaining OSM features',
      ''
    ];

    function emitLayer(name, layerFeatures, geomType) {
      if (!layerFeatures.length) return;
      var safe = name.replace(/[^A-Za-z0-9_\-]+/g, '_').slice(0, 40) || 'layer';
      zip.file('gis/' + safe + '.geojson', JSON.stringify(featureCollection(layerFeatures)));
      manifest.push('  ' + safe + '.geojson (' + geomType + ', ' + layerFeatures.length + ' features)');
    }

    zip.file('gis/osm_all.geojson', JSON.stringify(geojson));
    manifest.push('  osm_all.geojson (all geometry types, ' + features.length + ' features)');

    if (options.osmXml) {
      zip.file('gis/data/map.osm', options.osmXml);
      manifest.push('  data/map.osm (raw OSM XML)');
    }

    var all = splitAllByGeometry(features);
    emitLayer('osm_all_points', all.points, 'Point');
    emitLayer('osm_all_lines', all.lines, 'LineString');
    emitLayer('osm_all_polygons', all.polys, 'Polygon');

    var byClass = {};
    OsmCartoStyle.STYLE_CLASSES.forEach(function (c) { byClass[c] = []; });
    byClass.other = [];
    features.forEach(function (f) {
      var c = OsmCartoStyle.classify(f);
      if (byClass[c]) byClass[c].push(f);
      else byClass.other.push(f);
    });

    OsmCartoStyle.STYLE_CLASSES.forEach(function (cls) {
      if (LABEL_ONLY[cls]) return;
      emitLayer('osm_' + cls, byClass[cls], osmGeomType(cls));
    });

    var other = splitAllByGeometry(byClass.other);
    emitLayer('osm_other_points', other.points, 'Point');
    emitLayer('osm_other_lines', other.lines, 'LineString');
    emitLayer('osm_other_polygons', other.polys, 'Polygon');

    ((state && state.customLayers) || []).forEach(function (l) {
      emitLayer('custom_' + l.name, l.features, l.geomType);
    });

    zip.file('gis/README.txt', manifest.join('\n'));
    return Promise.resolve();
  }

  return { addToZip: addToZip };
})();
