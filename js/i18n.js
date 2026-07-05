/*
 * i18n.js - lightweight English/Persian (Farsi) internationalisation for
 * the OSM Offline GIS app. No framework; just a string table, a current
 * language, and a translate() helper. Switching to Persian flips the
 * document to RTL (dir="rtl") and applies the .rtl class used by the
 * stylesheet to mirror the sidebar/panels.
 *
 * Usage:
 *   I18n.set('fa');            // switch language (persists to localStorage)
 *   I18n.t('select_area');     // translate a key
 *   I18n.apply();              // translate all [data-i18n] / [data-i18n-ph] nodes
 *   I18n.onChange(fn);         // observe language changes
 */
'use strict';

var I18n = (function () {
  var STRINGS = {
    en: {
      app_title: 'OSM Offline GIS',
      select_area: 'Select area',
      selecting: 'Drag on map\u2026 (click to cancel)',
      clear_selection: 'Clear selection',
      no_area: 'No area selected.',
      download_bundle: 'Download offline bundle',
      download_btn: 'Download',
      download_include: 'Include in download',
      mode_both: 'Offline map + GIS files',
      mode_offline: 'Offline map only',
      mode_gis: 'GIS files only (GeoJSON + raw OSM)',
      layers: 'Layers',
      style_editor: 'Style editor',
      fill_color: 'Fill color',
      stroke_color: 'Stroke color',
      stroke_width: 'Stroke width',
      opacity: 'Opacity',
      dash: 'Dash pattern',
      visible: 'Visible',
      label_color: 'Label color',
      label_size: 'Label size',
      labels: 'Labels',
      reset_layer: 'Reset to default',
      reset_styles: 'Reset styles',
      language: 'Language',
      english: 'English',
      persian: 'Persian',
      map_style: 'Map style',
      osm_layers: 'OpenStreetMap layers',
      class_landuse: 'Landuse',
      class_water: 'Water',
      class_building: 'Buildings',
      class_road: 'Roads',
      class_rail: 'Railways',
      class_waterway: 'Waterways',
      class_boundary: 'Boundaries',
      class_place: 'Place labels',
      class_poi: 'POI labels',
      class_roadlabel: 'Road labels',
      class_waterwaylabel: 'Waterway labels'
    },
    fa: {
      app_title: '\u0633\u06cc\u0633\u062a\u0645 \u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0645\u06a9\u0627\u0646\u06cc \u0622\u0641\u0644\u0627\u06cc\u0646 OSM',
      select_area: '\u0627\u0646\u062a\u062e\u0627\u0628 \u0645\u062d\u062f\u0648\u062f\u0647',
      selecting: '\u0631\u0648\u06cc \u0646\u0642\u0634\u0647 \u0628\u06a9\u0634\u06cc\u062f\u2026 (\u0628\u0631\u0627\u06cc \u0644\u063a\u0648 \u06a9\u0644\u06cc\u06a9 \u06a9\u0646\u06cc\u062f)',
      clear_selection: '\u067e\u0627\u06a9 \u06a9\u0631\u062f\u0646 \u0627\u0646\u062a\u062e\u0627\u0628',
      no_area: '\u0645\u062d\u062f\u0648\u062f\u0647\u200c\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.',
      download_bundle: '\u062f\u0627\u0646\u0644\u0648\u062f \u0628\u0633\u062a\u0647 \u0622\u0641\u0644\u0627\u06cc\u0646',
      download_btn: '\u062f\u0627\u0646\u0644\u0648\u062f',
      download_include: '\u0645\u062d\u062a\u0648\u0627\u06cc \u062f\u0627\u0646\u0644\u0648\u062f',
      mode_both: '\u0646\u0642\u0634\u0647 \u0622\u0641\u0644\u0627\u06cc\u0646 + \u0641\u0627\u06cc\u0644\u200c\u0647\u0627\u06cc GIS',
      mode_offline: '\u0641\u0642\u0637 \u0646\u0642\u0634\u0647 \u0622\u0641\u0644\u0627\u06cc\u0646',
      mode_gis: '\u0641\u0642\u0637 \u0641\u0627\u06cc\u0644\u200c\u0647\u0627\u06cc GIS (GeoJSON + OSM \u062e\u0627\u0645)',
      layers: '\u0644\u0627\u06cc\u0647\u200c\u0647\u0627',
      style_editor: '\u0648\u06cc\u0631\u0627\u06cc\u0634\u06af\u0631 \u0627\u0633\u062a\u0627\u06cc\u0644',
      fill_color: '\u0631\u0646\u06af \u067e\u0631\u200c\u06a9\u0646\u0646\u062f\u0647',
      stroke_color: '\u0631\u0646\u06af \u062e\u0637',
      stroke_width: '\u0636\u062e\u0627\u0645\u062a \u062e\u0637',
      opacity: '\u0634\u0641\u0627\u0641\u06cc\u062a',
      dash: '\u0627\u0644\u06af\u0648\u06cc \u062e\u0637\u200c\u0686\u06cc\u0646',
      visible: '\u0642\u0627\u0628\u0644 \u0645\u0634\u0627\u0647\u062f\u0647',
      label_color: '\u0631\u0646\u06af \u0628\u0631\u0686\u0633\u0628',
      label_size: '\u0627\u0646\u062f\u0627\u0632\u0647 \u0628\u0631\u0686\u0633\u0628',
      labels: '\u0628\u0631\u0686\u0633\u0628\u200c\u0647\u0627',
      reset_layer: '\u0628\u0627\u0632\u0631\u0633\u062a\u0627\u0646\u06cc \u0628\u0647 \u067e\u06cc\u0634\u200c\u0641\u0631\u0636',
      reset_styles: '\u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06cc \u0627\u0633\u062a\u0627\u06cc\u0644',
      language: '\u0632\u0628\u0627\u0646',
      english: '\u0627\u0646\u06af\u0644\u06cc\u0633\u06cc',
      persian: '\u0641\u0627\u0631\u0633\u06cc',
      map_style: '\u0633\u0628\u06a9 \u0646\u0642\u0634\u0647',
      osm_layers: '\u0644\u0627\u06cc\u0647\u200c\u0647\u0627\u06cc OpenStreetMap',
      class_landuse: '\u06a9\u0627\u0631\u0628\u0631\u06cc \u0632\u0645\u06cc\u0646',
      class_water: '\u0622\u0628',
      class_building: '\u0633\u0627\u062e\u062a\u0645\u0627\u0646\u200c\u0647\u0627',
      class_road: '\u062c\u0627\u062f\u0647\u200c\u0647\u0627',
      class_rail: '\u0631\u0627\u0647\u200c\u0622\u0647\u0646',
      class_waterway: '\u0622\u0628\u0631\u0627\u0647\u0647\u200c\u0647\u0627',
      class_boundary: '\u0645\u0631\u0632\u0647\u0627',
      class_place: '\u0628\u0631\u0686\u0633\u0628 \u0645\u06a9\u0627\u0646\u200c\u0647\u0627',
      class_poi: '\u0628\u0631\u0686\u0633\u0628 \u0646\u0642\u0627\u0637 \u0645\u0648\u0631\u062f \u0639\u0644\u0627\u0642\u0647',
      class_roadlabel: '\u0628\u0631\u0686\u0633\u0628 \u062c\u0627\u062f\u0647\u200c\u0647\u0627',
      class_waterwaylabel: '\u0628\u0631\u0686\u0633\u0628 \u0622\u0628\u0631\u0627\u0647\u0647\u200c\u0647\u0627'
    }
  };

  var lang = 'en';
  try {
    var saved = localStorage.getItem('osmgis_lang');
    if (saved && STRINGS[saved]) lang = saved;
  } catch (e) { /* ignore */ }

  var listeners = [];

  function t(key) {
    var table = STRINGS[lang] || STRINGS.en;
    return table[key] != null ? table[key] : (STRINGS.en[key] != null ? STRINGS.en[key] : key);
  }

  function apply(root) {
    var scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
    scope.querySelectorAll('[data-i18n-title]').forEach(function (el) {
      el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
    });
  }

  function applyDir() {
    var rtl = lang === 'fa';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    document.body && document.body.classList.toggle('rtl', rtl);
  }

  function set(next) {
    if (!STRINGS[next] || next === lang) { lang = STRINGS[next] ? next : lang; }
    else { lang = next; }
    try { localStorage.setItem('osmgis_lang', lang); } catch (e) { /* ignore */ }
    applyDir();
    apply();
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) { /* ignore */ } });
  }

  function onChange(fn) { listeners.push(fn); }
  function current() { return lang; }
  function isRtl() { return lang === 'fa'; }

  return { t: t, set: set, apply: apply, applyDir: applyDir, onChange: onChange, current: current, isRtl: isRtl };
})();
